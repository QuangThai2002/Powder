import type { CombatUnitState } from './CombatState';
import { effectiveHealingReduction } from './CombatHealingReduction';
import { chargeRageTo, type RageChargeEvent } from './CombatRageEngine';

const BRAMBLET_KHAI_MACH_PASSIVE_ID = 'bramblet_khai_mach';
const KHAI_MACH_INITIALIZED = 'khai-mach:initialized';
const KHAI_MACH_RECIPIENT = 'khai-mach:recipient';
const KHAI_MACH_CHARGE_PENDING = 'khai-mach:charge-pending';
const KHAI_MACH_CHARGE_USED = 'khai-mach:charge-used';
const KHAI_MACH_SHIELD_USED = 'khai-mach:shield-used';
const KHAI_MACH_MAIN_ACTIONS = 'khai-mach:main-actions';

export type CombatActionOrigin = 'main' | 'follow-up' | 'counter' | 'dot' | 'secondary-hit';
export type CombatActionType = 'basic' | 'skill' | 'ultimate' | 'status-tick';
export type CombatPassiveLifecycleStage = 'after-rage-cost' | 'after-ultimate-cast' | 'after-main-action';

export interface CombatActionProvenance {
  origin: CombatActionOrigin;
  directDamage: boolean;
  actorId: string;
  targetIds: readonly string[];
  actionType: CombatActionType;
  abilityName: string | null;
}

export interface CombatActionProvenanceOverrides {
  origin?: CombatActionOrigin;
  directDamage?: boolean;
  targetIds?: readonly string[];
  actionType?: CombatActionType;
  abilityName?: string | null;
}

export interface CombatPassiveLifecycleEvent {
  stage: CombatPassiveLifecycleStage;
  actor: CombatUnitState;
  provenance: CombatActionProvenance;
  round: number;
  rageSpent: number;
  rageAfter: number;
}

export type CombatPassiveLifecycleHook = (event: CombatPassiveLifecycleEvent) => void;

export function createCombatActionProvenance(
  actorId: string,
  targetIds: readonly string[],
  actionType: CombatActionType,
  directDamage: boolean,
  abilityName: string | null,
  overrides: CombatActionProvenanceOverrides = {}
): CombatActionProvenance {
  return {
    origin: overrides.origin ?? 'main',
    directDamage: overrides.directDamage ?? directDamage,
    actorId,
    targetIds: [...new Set(overrides.targetIds ?? targetIds)].filter(Boolean),
    actionType: overrides.actionType ?? actionType,
    abilityName: overrides.abilityName === undefined ? abilityName : overrides.abilityName
  };
}

export function isMainDirectDamageAction(provenance: CombatActionProvenance): boolean {
  return provenance.origin === 'main' && provenance.directDamage;
}

export interface PassiveActionContext {
  combo?: number;
  sameElementAllies?: number;
}

export interface PassiveRuntimeEvent {
  type: 'heal' | 'status' | 'team-buff' | 'passive-mark' | 'rage-charge' | 'shield';
  passiveId: string;
  targetIds: string[];
  amount?: number;
  status?: string;
  rageEvents?: readonly RageChargeEvent[];
}

export class CombatPassiveEngine {
  initializeBattle(units: readonly CombatUnitState[]): PassiveRuntimeEvent[] {
    const events: PassiveRuntimeEvent[] = [];
    for (const source of units.filter((unit) => this.isKhaiMachSource(unit))) {
      if (this.hasFlag(source, KHAI_MACH_INITIALIZED)) continue;
      this.setFlag(source, KHAI_MACH_INITIALIZED);
      const recipients = units.filter((unit) => unit.side === source.side && unit.instanceId !== source.instanceId);
      for (const recipient of recipients) {
        this.setFlag(recipient, KHAI_MACH_RECIPIENT);
        this.setFlag(recipient, KHAI_MACH_CHARGE_PENDING);
      }
      if (recipients.length > 0) {
        events.push({
          type: 'passive-mark',
          passiveId: BRAMBLET_KHAI_MACH_PASSIVE_ID,
          targetIds: recipients.map((unit) => unit.instanceId),
          status: 'mach-khoi'
        });
      }
    }
    return events;
  }

  applyLifecycle(event: CombatPassiveLifecycleEvent): PassiveRuntimeEvent[] {
    if (!this.hasFlag(event.actor, KHAI_MACH_RECIPIENT) || event.provenance.origin !== 'main') return [];
    if (event.stage === 'after-ultimate-cast') return this.applyKhaiMachUltimateShield(event.actor);
    if (event.stage === 'after-main-action') return this.applyKhaiMachMainAction(event.actor);
    return [];
  }

  hasKhaiMach(unit: CombatUnitState): boolean {
    return this.hasFlag(unit, KHAI_MACH_CHARGE_PENDING);
  }

  hasFlag(unit: CombatUnitState, key: string): boolean {
    return unit.passiveState.flags[this.ledgerKey(key)] === true;
  }

  setFlag(unit: CombatUnitState, key: string, value = true): void {
    unit.passiveState.flags[this.ledgerKey(key)] = value;
  }

  battleCounter(unit: CombatUnitState, key: string): number {
    return unit.passiveState.battleCounters[this.ledgerKey(key)] ?? 0;
  }

  incrementBattleCounter(unit: CombatUnitState, key: string, amount = 1): number {
    const normalized = this.ledgerKey(key);
    const next = this.safeLedgerCounter(this.battleCounter(unit, normalized) + amount);
    unit.passiveState.battleCounters[normalized] = next;
    return next;
  }

  roundCounter(unit: CombatUnitState, key: string, round: number): number {
    const entry = unit.passiveState.roundCounters[this.ledgerKey(key)];
    return entry?.round === this.safeRound(round) ? entry.value : 0;
  }

  incrementRoundCounter(unit: CombatUnitState, key: string, round: number, amount = 1): number {
    const normalized = this.ledgerKey(key);
    const safeRound = this.safeRound(round);
    const next = this.safeLedgerCounter(this.roundCounter(unit, normalized, safeRound) + amount);
    unit.passiveState.roundCounters[normalized] = { round: safeRound, value: next };
    return next;
  }

  ownedCounter(unit: CombatUnitState, key: string): number {
    return unit.passiveState.ownedCounters[this.ledgerKey(key)] ?? 0;
  }

  setOwnedCounter(unit: CombatUnitState, key: string, value: number, max = Number.MAX_SAFE_INTEGER): number {
    const normalized = this.ledgerKey(key);
    const next = Math.min(this.safeLedgerCounter(max), this.safeLedgerCounter(value));
    unit.passiveState.ownedCounters[normalized] = next;
    return next;
  }

  setDesignatedCarry(unit: CombatUnitState, instanceId: string | null): void {
    unit.passiveState.designatedCarryInstanceId = instanceId ? String(instanceId) : null;
  }

  private applyKhaiMachMainAction(unit: CombatUnitState): PassiveRuntimeEvent[] {
    if (!this.hasFlag(unit, KHAI_MACH_CHARGE_PENDING) || this.hasFlag(unit, KHAI_MACH_CHARGE_USED)) return [];
    const count = this.incrementBattleCounter(unit, KHAI_MACH_MAIN_ACTIONS);
    if (count < 2) return [];

    this.setFlag(unit, KHAI_MACH_CHARGE_PENDING, false);
    this.setFlag(unit, KHAI_MACH_CHARGE_USED);
    if (unit.ragePoints >= 4) return [];

    const charge = chargeRageTo(unit.ragePoints, 4);
    unit.ragePoints = charge.next;
    return charge.events.length > 0
      ? [{
          type: 'rage-charge',
          passiveId: BRAMBLET_KHAI_MACH_PASSIVE_ID,
          targetIds: [unit.instanceId],
          amount: charge.effectiveGain,
          status: 'mach-khoi',
          rageEvents: charge.events
        }]
      : [];
  }

  private applyKhaiMachUltimateShield(unit: CombatUnitState): PassiveRuntimeEvent[] {
    if (this.hasFlag(unit, KHAI_MACH_SHIELD_USED)) return [];
    this.setFlag(unit, KHAI_MACH_SHIELD_USED);
    const requested = Math.max(1, Math.round(unit.pow.maxHp * 0.03));
    const cap = Math.max(1, Math.round(unit.pow.maxHp * 0.8));
    const previous = unit.shield;
    unit.shield = Math.min(cap, previous + requested);
    const amount = Math.max(0, unit.shield - previous);
    return amount > 0
      ? [{
          type: 'shield',
          passiveId: BRAMBLET_KHAI_MACH_PASSIVE_ID,
          targetIds: [unit.instanceId],
          amount,
          status: 'khai-mach'
        }]
      : [];
  }

  private isKhaiMachSource(unit: CombatUnitState): boolean {
    return unit.pow.passive?.id === BRAMBLET_KHAI_MACH_PASSIVE_ID &&
      unit.pow.passive.mechanic?.effect.kind === 'brambletKhaiMach';
  }

  advanceCombo(current: number, academicCorrect: boolean): number {
    return academicCorrect ? Math.min(5, Math.max(0, Math.floor(this.number(current))) + 1) : 0;
  }

  attackMultiplier(unit: CombatUnitState): number {
    return this.statMultiplier(unit, 'attack');
  }

  defenseMultiplier(unit: CombatUnitState): number {
    return this.statMultiplier(unit, 'defense');
  }

  outgoingDamageMultiplier(actor: CombatUnitState, context: PassiveActionContext = {}): number {
    const effect = actor.pow.passive?.mechanic?.effect;
    const condition = actor.pow.passive?.mechanic?.condition;
    if (!effect || !this.conditionMatches(actor, context)) return 1;
    if (effect.kind === 'damageMultiplier') return 1 + this.number(effect.coefficient);
    if (effect.kind === 'damageMultiplierPerStack') {
      const combo = Math.max(0, Math.floor(this.number(context.combo)));
      return 1 + Math.min(this.number(effect.maxBonus), combo * this.number(effect.coefficient));
    }
    if (condition?.kind === 'minimumSameElementAllies' && this.number(context.sameElementAllies) < this.number(condition.value)) return 1;
    return 1;
  }

  extraTurnChance(
    actor: CombatUnitState,
    target: CombatUnitState,
    baseChance: number,
    context: PassiveActionContext = {}
  ): number {
    const effect = actor.pow.passive?.mechanic?.effect;
    const condition = actor.pow.passive?.mechanic?.condition;
    if (effect?.kind !== 'extraTurnChance' || condition?.kind !== 'speedRatioAbove') return Math.min(0.35, Math.max(0, baseChance));
    const threshold = this.number(condition.value);
    if (actor.speed <= Math.max(1, target.speed) * threshold || !this.conditionMatches(actor, context)) return Math.min(0.35, Math.max(0, baseChance));
    return Math.min(this.number(effect.maxChance) || 0.35, Math.max(0, baseChance) + this.number(effect.coefficient));
  }

  applyAfterAction(
    actor: CombatUnitState,
    target: CombatUnitState,
    allies: CombatUnitState[],
    context: PassiveActionContext = {},
    random: () => number = Math.random
  ): PassiveRuntimeEvent[] {
    const passive = actor.pow.passive;
    const mechanic = passive?.mechanic;
    if (!passive || mechanic?.trigger !== 'AFTER_ACTION' || !this.conditionMatches(actor, context)) return [];
    const effect = mechanic.effect;
    const livingAllies = allies.filter((unit) => unit.alive && unit.fieldSlot !== null);

    if (effect.kind === 'healMaxHp') {
      if (this.number(effect.perBattleLimit) > 0 && actor.passiveUsed) return [];
      const recipients = effect.targetRule === 'allLivingAllies' ? livingAllies : [actor];
      let total = 0;
      const targetIds: string[] = [];
      for (const recipient of recipients) {
        const reduction = effectiveHealingReduction(recipient.grievousTier, [recipient.antiHeal]);
        const amount = Math.max(0, Math.round(recipient.pow.maxHp * this.number(effect.coefficient) * (1 - reduction)));
        const healed = Math.min(Math.max(0, recipient.pow.maxHp - recipient.hp), amount);
        recipient.hp += healed;
        if (healed > 0) { total += healed; targetIds.push(recipient.instanceId); }
      }
      if (this.number(effect.perBattleLimit) > 0) actor.passiveUsed = true;
      return total > 0 ? [{ type: 'heal', passiveId: passive.id, targetIds, amount: total }] : [];
    }

    if (effect.kind === 'applyStatus') {
      if (!target.alive || target.fieldSlot === null) return [];
      if (this.safeRandom(random) >= this.number(effect.chance)) return [];
      target.controlStatus = effect.status === 'stun' ? 'stun' : target.controlStatus;
      target.controlActionsRemaining = Math.max(target.controlActionsRemaining, Math.floor(this.number(effect.duration)));
      return [{ type: 'status', passiveId: passive.id, targetIds: [target.instanceId], status: String(effect.status || '') }];
    }

    if (effect.kind === 'rotatingTeamBuff') {
      const sequence = Array.isArray(effect.sequence) ? effect.sequence : [];
      const combo = Math.max(0, Math.floor(this.number(context.combo)));
      const stat = String(sequence[combo % Math.max(1, sequence.length)] || 'attack');
      const duration = Math.max(1, Math.floor(this.number(effect.duration)));
      for (const ally of livingAllies) {
        if (stat === 'defense') { ally.defenseMultiplier = Math.max(ally.defenseMultiplier, 1.3); ally.defenseBuffActionsRemaining = Math.max(ally.defenseBuffActionsRemaining, duration); }
        else if (stat === 'ability-power') { ally.abilityPowerMultiplier = Math.max(ally.abilityPowerMultiplier, 1.3); ally.abilityPowerBuffActionsRemaining = Math.max(ally.abilityPowerBuffActionsRemaining, duration); }
        else { ally.attackMultiplier = Math.max(ally.attackMultiplier, 1.3); ally.attackBuffActionsRemaining = Math.max(ally.attackBuffActionsRemaining, duration); }
      }
      return [{ type: 'team-buff', passiveId: passive.id, targetIds: livingAllies.map((unit) => unit.instanceId), status: stat }];
    }

    return [];
  }

  private statMultiplier(unit: CombatUnitState, stat: 'attack' | 'defense'): number {
    const effect = unit.pow.passive?.mechanic?.effect;
    if (effect?.kind !== 'statMultiplier' || effect.stat !== stat) return 1;
    const maxHp = Math.max(1, Number(unit.pow.maxHp) || 1);
    const missing = Math.min(1, Math.max(0, 1 - (Number(unit.hp) || 0) / maxHp));
    return 1 + missing * this.number(effect.coefficient);
  }

  private conditionMatches(actor: CombatUnitState, context: PassiveActionContext): boolean {
    const condition = actor.pow.passive?.mechanic?.condition;
    if (!condition) return true;
    if (condition.kind === 'minimumCombo') return this.number(context.combo) >= this.number(condition.value);
    if (condition.kind === 'minimumSameElementAllies') return this.number(context.sameElementAllies) >= this.number(condition.value);
    if (condition.kind === 'hpRatioAtMost') return actor.hp / Math.max(1, actor.pow.maxHp) <= this.number(condition.value);
    if (condition.kind === 'speedRatioAbove') return true;
    if (condition.kind === 'missingHpRatio') return actor.hp < actor.pow.maxHp;
    return false;
  }

  private number(value: unknown): number { return Number.isFinite(Number(value)) ? Number(value) : 0; }
  private ledgerKey(value: string): string {
    const key = String(value || '').trim().toLowerCase();
    if (!key) throw new Error('[Combat2] Passive ledger key is required.');
    return key;
  }
  private safeLedgerCounter(value: number): number {
    return Math.min(9999, Math.max(0, Math.floor(this.number(value))));
  }
  private safeRound(value: number): number {
    return Math.max(1, Math.floor(this.number(value)));
  }
  private safeRandom(random: () => number): number {
    const value = Number(random());
    return Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0.5;
  }


  speedExtraTurnChance(actor: CombatUnitState, target: CombatUnitState): number {
    const targetSpeed = Math.max(1, Number(target.speed) || 1);
    const ratio = (Number(actor.speed) || 0) / targetSpeed;
    const baseChance = ratio > 1.15 ? Math.min(0.35, Math.max(0, (ratio - 1.15) * 0.42)) : 0;
    return this.extraTurnChance(actor, target, baseChance);
  }
}
