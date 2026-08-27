import type { CombatSide } from '../data/CombatPow';
import {
  CombatLegacyDomainEngine,
  combatLegacyDomainForUnit,
  type LegacyDomainFeedback
} from '../systems/CombatLegacyDomainEngine';
import type { CombatUnitState } from '../systems/CombatState';
import { SkillActionResolver } from '../systems/SkillActionResolver';

interface PatchableScene {
  combatState: { units: CombatUnitState[]; sanitizeRuntimeNumbers: () => void };
  powViews: Map<string, any>;
  applyStartOfTurnEffects: (actor: CombatUnitState) => Promise<void>;
  refreshViews: () => void;
  showFloatingLabel: (view: any, label: string, color: string) => void;
}

interface BonusState { value: number; actions: number; }

const PATCH_FLAG = '__powderCombat293LegacyDomainTickInstalled';
const poisonMarks = new WeakMap<CombatLegacyDomainEngine, WeakMap<CombatUnitState, number>>();
const rebirthBurstBonus = new WeakMap<CombatLegacyDomainEngine, Record<CombatSide, BonusState>>();

function otherSide(side: CombatSide): CombatSide { return side === 'player' ? 'enemy' : 'player'; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }

function units(engine: CombatLegacyDomainEngine): CombatUnitState[] {
  const raw = (engine as any).units;
  return Array.isArray(raw) ? raw as CombatUnitState[] : [];
}

function activeLiving(engine: CombatLegacyDomainEngine, side: CombatSide): CombatUnitState[] {
  return units(engine).filter((unit) => unit.side === side && unit.alive && unit.fieldSlot !== null);
}

function markMap(engine: CombatLegacyDomainEngine): WeakMap<CombatUnitState, number> {
  let map = poisonMarks.get(engine);
  if (!map) { map = new WeakMap<CombatUnitState, number>(); poisonMarks.set(engine, map); }
  return map;
}

function bonusState(engine: CombatLegacyDomainEngine): Record<CombatSide, BonusState> {
  let state = rebirthBurstBonus.get(engine);
  if (!state) {
    state = { player: { value: 0, actions: 0 }, enemy: { value: 0, actions: 0 } };
    rebirthBurstBonus.set(engine, state);
  }
  return state;
}

function rawDamage(target: CombatUnitState, amount: number): number {
  if (!target.alive || amount <= 0) return 0;
  const safe = Math.max(1, Math.round(amount));
  const shield = Math.min(Math.max(0, target.shield), safe);
  const hp = Math.min(Math.max(0, target.hp), Math.max(0, safe - shield));
  target.shield = Math.max(0, target.shield - shield);
  target.hp = Math.max(0, target.hp - hp);
  target.alive = target.hp > 0;
  return shield + hp;
}

function healLowest(engine: CombatLegacyDomainEngine, side: CombatSide, amount: number): LegacyDomainFeedback | null {
  const allies = activeLiving(engine, side).sort((a, b) => a.hp / Math.max(1, a.pow.maxHp) - b.hp / Math.max(1, b.pow.maxHp));
  const target = allies[0];
  if (!target || amount <= 0) return null;
  const anti = clamp(target.antiHeal, 0, 0.95);
  const actual = Math.min(Math.max(0, target.pow.maxHp - target.hp), Math.max(0, Math.round(amount * (1 - anti))));
  target.hp += actual;
  return actual > 0 ? { kind: 'heal', targetId: target.instanceId, value: actual, label: `THỰC SINH +${actual}` } : null;
}

function applyPoisonTickLegacy(engine: CombatLegacyDomainEngine, target: CombatUnitState, stacksBefore: number): LegacyDomainFeedback[] {
  const ownerSide = otherSide(target.side);
  const expansion = engine.snapshot(ownerSide).expansion;
  if (expansion?.id !== 'myriad_poison' || stacksBefore <= 0) return [];
  const feedback: LegacyDomainFeedback[] = [];
  const estimatedTick = Math.max(1, Math.round(target.pow.maxHp * 0.02 * stacksBefore));
  const heal = healLowest(engine, ownerSide, Math.round(estimatedTick * 0.55));
  if (heal) feedback.push(heal);

  const marks = markMap(engine);
  const nextMark = (marks.get(target) || 0) + 1;
  if (nextMark < 3) {
    marks.set(target, nextMark);
    feedback.push({ kind: 'status', targetId: target.instanceId, label: `ĐỘC ẤN ${nextMark}/3` });
    return feedback;
  }

  marks.set(target, 0);
  if (target.alive) {
    target.poisonStacks = clamp(Math.max(1, target.poisonStacks) + 1, 1, 6);
    target.poisonActionsRemaining = Math.max(target.poisonActionsRemaining, 3);
    target.antiHeal = Math.max(target.antiHeal, 0.30);
    target.antiHealActionsRemaining = Math.max(target.antiHealActionsRemaining, 3);
    const resistance = engine.simpleExpansionResistance(target.side);
    const extra = rawDamage(target, Math.round(target.pow.maxHp * 0.02 * target.poisonStacks * (1 - resistance)));
    if (extra > 0) feedback.push({ kind: 'damage', targetId: target.instanceId, value: extra, label: `ĐỘC ẤN BỘC PHÁT -${extra}` });
    feedback.push({ kind: 'status', targetId: target.instanceId, label: `POISON ${target.poisonStacks}/6` });
    if (target.poisonStacks >= 6) {
      target.defenseMultiplier = Math.min(target.defenseMultiplier, 0.75);
      target.defenseBuffActionsRemaining = Math.max(target.defenseBuffActionsRemaining, 2);
      target.attackMultiplier = Math.min(target.attackMultiplier, 0.80);
      target.attackBuffActionsRemaining = Math.max(target.attackBuffActionsRemaining, 2);
      target.abilityPowerMultiplier = Math.min(target.abilityPowerMultiplier, 0.80);
      target.abilityPowerBuffActionsRemaining = Math.max(target.abilityPowerBuffActionsRemaining, 2);
      feedback.push({ kind: 'status', targetId: target.instanceId, label: 'ĐỘC THỰC · DEF/DAMAGE ↓' });
    }
  }
  return feedback;
}

function spreadPoison(engine: CombatLegacyDomainEngine, dead: CombatUnitState, stacks: number): LegacyDomainFeedback[] {
  const ownerSide = otherSide(dead.side);
  if (engine.snapshot(ownerSide).expansion?.id !== 'myriad_poison' || stacks <= 0) return [];
  const spreadStacks = Math.max(1, Math.ceil(stacks / 2));
  const feedback: LegacyDomainFeedback[] = [];
  for (const target of activeLiving(engine, dead.side).filter((unit) => unit.instanceId !== dead.instanceId).slice(0, 2)) {
    target.poisonStacks = clamp(Math.max(0, target.poisonStacks) + spreadStacks, 1, 6);
    target.poisonActionsRemaining = Math.max(target.poisonActionsRemaining, 3);
    target.antiHeal = Math.max(target.antiHeal, 0.30);
    target.antiHealActionsRemaining = Math.max(target.antiHealActionsRemaining, 3);
    feedback.push({ kind: 'status', targetId: target.instanceId, label: `ĐỘC LAN ×${spreadStacks}` });
  }
  return feedback;
}

function spreadBurn(engine: CombatLegacyDomainEngine, dead: CombatUnitState, burnDamage: number, burnTurns: number): LegacyDomainFeedback[] {
  const ownerSide = otherSide(dead.side);
  if (engine.snapshot(ownerSide).expansion?.id !== 'nine_suns' || burnDamage <= 0 || burnTurns <= 0) return [];
  const feedback: LegacyDomainFeedback[] = [];
  for (const target of activeLiving(engine, dead.side).filter((unit) => unit.instanceId !== dead.instanceId).slice(0, 3)) {
    target.burnDamage = Math.max(target.burnDamage, burnDamage);
    target.burnActionsRemaining = Math.max(target.burnActionsRemaining, Math.max(2, burnTurns));
    feedback.push({ kind: 'status', targetId: target.instanceId, label: 'PHẦN HỎA LAN · BURN' });
  }
  return feedback;
}

function showFeedback(scene: PatchableScene, feedback: readonly LegacyDomainFeedback[]): void {
  for (const row of feedback.slice(0, 8)) {
    const view = row.targetId ? scene.powViews.get(row.targetId) : undefined;
    const color = row.kind === 'heal' ? '#73f0aa' : row.kind === 'damage' ? '#ffd36a' : '#c9b0ff';
    if (view) scene.showFloatingLabel(view, row.label, color);
  }
  scene.combatState.sanitizeRuntimeNumbers();
  scene.refreshViews();
}

function installTickPatch(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const original = proto.applyStartOfTurnEffects;
  proto.applyStartOfTurnEffects = async function combat293StartEffects(this: PatchableScene, actor: CombatUnitState): Promise<void> {
    const engine = combatLegacyDomainForUnit(actor);
    const poisonBefore = Math.max(0, actor.poisonStacks);
    const poisonTurnsBefore = Math.max(0, actor.poisonActionsRemaining);
    const burnBefore = Math.max(0, actor.burnDamage);
    const burnTurnsBefore = Math.max(0, actor.burnActionsRemaining);
    const regenBefore = Math.max(0, actor.regenerationActionsRemaining);
    const hpBefore = actor.hp;

    await original.call(this, actor);
    if (!engine) return;
    const feedback: LegacyDomainFeedback[] = [];
    if (poisonBefore > 0 && poisonTurnsBefore > 0) feedback.push(...applyPoisonTickLegacy(engine, actor, poisonBefore));
    if (!actor.alive) {
      feedback.push(...spreadPoison(engine, actor, poisonBefore));
      feedback.push(...spreadBurn(engine, actor, burnBefore, burnTurnsBefore));
    }

    if (regenBefore > 0 && actor.alive && engine.snapshot(actor.side).expansion?.id === 'rebirth_wood') {
      const healed = Math.max(0, actor.hp - hpBefore);
      if (healed > 0) {
        const gain = Math.max(1, Math.round((healed / Math.max(1, actor.pow.maxHp)) * 50));
        const extra = (engine as any).gainSinhQi?.(actor.side, gain) as LegacyDomainFeedback[] | undefined;
        if (Array.isArray(extra)) feedback.push(...extra);
      }
    }
    if (feedback.length) showFeedback(this, feedback);
  };
}

function installHealingAndRebirthBonusPatch(): void {
  const engineProto = CombatLegacyDomainEngine.prototype as any;
  if (!engineProto.__powderCombat293Rebirth) {
    engineProto.__powderCombat293Rebirth = true;
    const originalAfterDamage = engineProto.afterDamage;
    const originalProfile = engineProto.profile;
    const originalAfterAction = engineProto.afterActorAction;

    engineProto.afterDamage = function combat293AfterDamage(actor: CombatUnitState, ...args: any[]): LegacyDomainFeedback[] {
      const feedback = originalAfterDamage.call(this, actor, ...args) as LegacyDomainFeedback[];
      if (this.snapshot(actor.side).expansion?.id === 'rebirth_wood' && feedback.some((row) => String(row.label || '').startsWith('LUÂN SINH'))) {
        bonusState(this)[actor.side] = { value: 0.25, actions: 3 };
      }
      return feedback;
    };

    engineProto.profile = function combat293Profile(unit: CombatUnitState): any {
      const result = originalProfile.call(this, unit);
      const bonus = bonusState(this)[unit.side];
      if (this.snapshot(unit.side).expansion?.id === 'rebirth_wood' && bonus.actions > 0) result.damage += bonus.value;
      return result;
    };

    engineProto.afterActorAction = function combat293AfterActorAction(actor: CombatUnitState): LegacyDomainFeedback[] {
      const result = originalAfterAction.call(this, actor) as LegacyDomainFeedback[];
      const bonus = bonusState(this)[actor.side];
      if (bonus.actions > 0) {
        bonus.actions -= 1;
        if (bonus.actions <= 0) bonus.value = 0;
      }
      return result;
    };
  }

  const skillProto = SkillActionResolver.prototype as any;
  if (!skillProto.__powderCombat293RebirthHealing) {
    skillProto.__powderCombat293RebirthHealing = true;
    const originalResolve = skillProto.resolve;
    const originalUltimate = skillProto.resolveUltimate;

    const record = (actor: CombatUnitState, result: any): void => {
      if (!result || Number(result.healed) <= 0) return;
      const engine = combatLegacyDomainForUnit(actor);
      if (!engine || engine.snapshot(actor.side).expansion?.id !== 'rebirth_wood') return;
      const gain = Math.max(1, Math.round((Number(result.healed) / Math.max(1, actor.pow.maxHp)) * 50));
      const feedback = (engine as any).gainSinhQi?.(actor.side, gain) as LegacyDomainFeedback[] | undefined;
      if (Array.isArray(feedback) && feedback.some((row) => String(row.label || '').startsWith('LUÂN SINH'))) {
        bonusState(engine)[actor.side] = { value: 0.25, actions: 3 };
      }
    };

    skillProto.resolve = function combat293SkillHeal(actor: CombatUnitState, target: CombatUnitState, ...args: any[]): any {
      const result = originalResolve.call(this, actor, target, ...args);
      record(actor, result);
      return result;
    };
    skillProto.resolveUltimate = function combat293UltimateHeal(actor: CombatUnitState, target: CombatUnitState, ...args: any[]): any {
      const result = originalUltimate.call(this, actor, target, ...args);
      record(actor, result);
      return result;
    };
  }
}

export function installCombat293LegacyDomainTickPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installTickPatch(BattleSceneClass);
  installHealingAndRebirthBonusPatch();
}
