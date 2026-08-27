import type { CombatSide } from '../data/CombatPow';
import { BasicAttackResolver } from '../systems/BasicAttackResolver';
import {
  CombatLegacyDomainEngine,
  combatLegacyDomainForUnit,
  type LegacyDomainActivationResult
} from '../systems/CombatLegacyDomainEngine';
import { CombatLegacyStatEngine } from '../systems/CombatLegacyStatEngine';
import type { CombatUnitState } from '../systems/CombatState';
import { SkillActionResolver } from '../systems/SkillActionResolver';

const PATCH_FLAG = '__powderCombat291LegacyDomainHardeningInstalled';
const jackpotAttempt = new WeakMap<CombatLegacyDomainEngine, Record<CombatSide, { chance: number; attempted: boolean }>>();
const limitlessBurst = new WeakMap<CombatLegacyDomainEngine, Set<CombatSide>>();

function sides(): readonly CombatSide[] { return ['player', 'enemy'] as const; }
function otherSide(side: CombatSide): CombatSide { return side === 'player' ? 'enemy' : 'player'; }

function jackpotState(engine: CombatLegacyDomainEngine): Record<CombatSide, { chance: number; attempted: boolean }> {
  let state = jackpotAttempt.get(engine);
  if (!state) {
    state = { player: { chance: 0.25, attempted: false }, enemy: { chance: 0.25, attempted: false } };
    jackpotAttempt.set(engine, state);
  }
  return state;
}

function engineUnits(engine: CombatLegacyDomainEngine): CombatUnitState[] {
  const raw = (engine as any).units;
  return Array.isArray(raw) ? raw as CombatUnitState[] : [];
}

function protectJackpotTeam(engine: CombatLegacyDomainEngine, side: CombatSide): number {
  if (engine.snapshot(side).expansion?.id !== 'jackpot_bagua') return 0;
  let saved = 0;
  for (const unit of engineUnits(engine).filter((candidate) => candidate.side === side)) {
    if (!unit.alive || unit.hp <= 0) {
      unit.alive = true;
      unit.hp = 1;
      unit.actionLocked = false;
      saved += 1;
    }
    unit.ragePoints = 4;
  }
  return saved;
}

function installActivationHardening(): void {
  const proto = CombatLegacyDomainEngine.prototype as any;
  if (proto.__powderCombat291Activation) return;
  proto.__powderCombat291Activation = true;

  const originalSimple = proto.activateSimple;
  proto.activateSimple = function hardenedSimple(side: CombatSide): LegacyDomainActivationResult {
    const snapshot = this.snapshot(side);
    if (snapshot.simpleActive) return { ok: false, reason: 'simple-already-active', id: snapshot.simpleActive.id };
    return originalSimple.call(this, side);
  };

  const originalExpansion = proto.activateExpansion;
  proto.activateExpansion = function hardenedExpansion(side: CombatSide, mode: 'pve' | 'pvp'): LegacyDomainActivationResult {
    const snapshot = this.snapshot(side);
    if (snapshot.expansion) return { ok: false, reason: 'expansion-active', id: snapshot.expansion.id };
    if (snapshot.equippedExpansion !== 'jackpot_bagua') return originalExpansion.call(this, side, mode);
    if (mode !== 'pvp') return { ok: false, reason: 'pvp-only', id: 'jackpot_bagua' };

    const attempts = jackpotState(this)[side];
    if (attempts.attempted) return { ok: false, reason: 'jackpot-already-attempted-this-turn', id: 'jackpot_bagua' };
    attempts.attempted = true;
    const chance = Math.min(0.95, attempts.chance);
    if (Math.random() >= chance) {
      attempts.chance = Math.min(0.95, chance + 0.05);
      return { ok: false, reason: `jackpot-miss-${Math.round(chance * 100)}`, id: 'jackpot_bagua' };
    }

    const result = originalExpansion.call(this, side, mode) as LegacyDomainActivationResult;
    if (result.ok) {
      // Canonical Jackpot is multi-attempt. Success consumes its 3 team actions,
      // but does not permanently consume the Expansion for the rest of battle.
      (this as any).side[side].expansionUsed = false;
      attempts.chance = 0.25;
      protectJackpotTeam(this, side);
    }
    return result;
  };

  const originalAfterAction = proto.afterActorAction;
  proto.afterActorAction = function hardenedAfterAction(actor: CombatUnitState): any[] {
    const feedback = originalAfterAction.call(this, actor) as any[];
    jackpotState(this)[actor.side].attempted = false;
    for (const side of sides()) {
      const active = this.snapshot(side).expansion;
      if (active?.id === 'jackpot_bagua') protectJackpotTeam(this, side);
      else if (!active) jackpotState(this)[side].chance = 0.25;
    }
    return feedback;
  };
}

function installLimitlessBurst(): void {
  const proto = CombatLegacyDomainEngine.prototype as any;
  if (proto.__powderCombat291Limitless) return;
  proto.__powderCombat291Limitless = true;
  const original = proto.setLimitlessAnswers;
  proto.setLimitlessAnswers = function hardenedLimitless(side: CombatSide, ownerCorrect: number, enemyWrong: number): void {
    original.call(this, side, ownerCorrect, enemyWrong);
    const active = this.snapshot(side).expansion;
    const fired = limitlessBurst.get(this) ?? new Set<CombatSide>();
    limitlessBurst.set(this, fired);
    if (active?.id !== 'limitless_void') { fired.delete(side); return; }
    if (active.limitlessOwnerCorrect < 10 || fired.has(side)) return;
    fired.add(side);

    for (const target of engineUnits(this).filter((unit) => unit.side === otherSide(side) && unit.alive)) {
      const resist = this.simpleExpansionResistance(target.side);
      const hpLoss = Math.max(1, Math.round(target.pow.maxHp * 0.50 * (1 - resist)));
      target.hp = Math.max(0, target.hp - hpLoss);
      target.alive = target.hp > 0;
    }
    protectJackpotTeam(this, otherSide(side));
  };
}

function installJackpotResolverProtection(): void {
  const basicProto = BasicAttackResolver.prototype as any;
  if (!basicProto.__powderCombat291Jackpot) {
    basicProto.__powderCombat291Jackpot = true;
    const original = basicProto.resolve;
    basicProto.resolve = function jackpotBasic(actor: CombatUnitState, target: CombatUnitState): any {
      const result = original.call(this, actor, target);
      const engine = combatLegacyDomainForUnit(target);
      if (engine && engine.snapshot(target.side).expansion?.id === 'jackpot_bagua' && (!target.alive || target.hp <= 0)) {
        target.alive = true;
        target.hp = 1;
        result.defeated = false;
        result.targetHpAfter = 1;
      }
      return result;
    };
  }

  const skillProto = SkillActionResolver.prototype as any;
  if (!skillProto.__powderCombat291Jackpot) {
    skillProto.__powderCombat291Jackpot = true;
    const originalCanUltimate = skillProto.canUseUltimate;
    const originalUltimate = skillProto.resolveUltimate;
    const originalResolve = skillProto.resolve;

    skillProto.canUseUltimate = function jackpotCanUltimate(actor: CombatUnitState): boolean {
      const engine = combatLegacyDomainForUnit(actor);
      if (engine?.snapshot(actor.side).expansion?.id === 'jackpot_bagua' && actor.alive && actor.silenceActionsRemaining <= 0 && actor.ultimateCooldownActionsRemaining <= 0) return true;
      return originalCanUltimate.call(this, actor);
    };

    skillProto.resolve = function jackpotSkill(actor: CombatUnitState, target: CombatUnitState, ...args: any[]): any {
      const result = originalResolve.call(this, actor, target, ...args);
      const engine = combatLegacyDomainForUnit(target);
      if (engine && engine.snapshot(target.side).expansion?.id === 'jackpot_bagua' && (!target.alive || target.hp <= 0)) {
        target.alive = true;
        target.hp = 1;
        result.defeated = false;
      }
      return result;
    };

    skillProto.resolveUltimate = function jackpotUltimate(actor: CombatUnitState, target: CombatUnitState, ...args: any[]): any {
      const actorEngine = combatLegacyDomainForUnit(actor);
      if (actorEngine?.snapshot(actor.side).expansion?.id === 'jackpot_bagua') actor.ragePoints = 4;
      const result = originalUltimate.call(this, actor, target, ...args);
      if (actorEngine?.snapshot(actor.side).expansion?.id === 'jackpot_bagua') {
        actor.ragePoints = 4;
        result.rageAfter = 4;
      }
      const targetEngine = combatLegacyDomainForUnit(target);
      if (targetEngine && targetEngine.snapshot(target.side).expansion?.id === 'jackpot_bagua' && (!target.alive || target.hp <= 0)) {
        target.alive = true;
        target.hp = 1;
        result.defeated = false;
      }
      return result;
    };
  }
}

function installRebirthHealStage(): void {
  const proto = CombatLegacyStatEngine.prototype as any;
  if (proto.__powderCombat291RebirthHeal) return;
  proto.__powderCombat291RebirthHeal = true;
  const original = proto.healMultiplier;
  proto.healMultiplier = function rebirthHealMultiplier(actor: CombatUnitState): number {
    const base = Number(original.call(this, actor)) || 1;
    const engine = combatLegacyDomainForUnit(actor);
    const active = engine?.snapshot(actor.side).expansion;
    return active?.id === 'rebirth_wood' && active.sinhQi >= 25 ? base * 1.20 : base;
  };
}

export function installCombat291LegacyDomainHardeningPatch(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installActivationHardening();
  installLimitlessBurst();
  installJackpotResolverProtection();
  installRebirthHealStage();
}
