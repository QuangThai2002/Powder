import type { CombatAbility, CombatRarity } from '../data/CombatPow';
import type { CombatUnitState, HardControlStatus } from './CombatState';

export type CombatCooldownSlot = 0 | 1 | 'ultimate';

export const CONTROL_EFFECT_CHANCE_CAP = 0.8;
export const PARALYSIS_SKIP_CHANCE = 0.3;
/** A landed CC counts for its own round plus the following four rounds. */
export const CONTROL_HISTORY_ROUNDS = 5;
export const CONTROL_IMMUNITY_TRIGGER_HITS = 4;
export const CONTROL_IMMUNITY_ACTIONS = 2;
export const FREEZE_STAGE_ACTIONS = 3;
export const FROSTBITE_DAMAGE_MULTIPLIER = 1.1;
export const FREEZE_SHATTER_MULTIPLIER = 1.3;
export const TENACITY_CAP = 60;

export const CONTROL_CHANCE_BY_RARITY: Readonly<Record<CombatRarity, number>> = {
  common: 0.4,
  rare: 0.45,
  super_rare: 0.5,
  epic: 0.55,
  legendary: 0.6,
  mythic: 0.65,
  ancient: 0.7
};

const HARD_CONTROL = new Set<HardControlStatus>(['silence', 'stun', 'paralysis', 'freeze']);

export interface ControlRollResult {
  success: boolean;
  blockedByImmunity: boolean;
  chance: number;
  roll: number;
}

export interface ControlWindowSnapshot {
  count: number;
  triggerAt: number;
  firstRound: number | null;
  expiresRound: number | null;
}

export function normalizedStatus(rawStatus: string | undefined): string {
  return String(rawStatus || '')
    .replace(/^self:/i, '')
    .trim()
    .toLowerCase();
}

export function isHardControlStatus(status: string): status is HardControlStatus {
  return HARD_CONTROL.has(status as HardControlStatus);
}

export function baseControlChance(rarity: CombatRarity): number {
  return CONTROL_CHANCE_BY_RARITY[rarity] ?? CONTROL_CHANCE_BY_RARITY.common;
}

/**
 * Rarity + Effect Accuracy determine the attacker's pre-resist chance (80% cap).
 * Legacy Tenacity then reduces that chance multiplicatively, matching Core V2.
 */
export function controlChanceFor(actor: CombatUnitState, target?: CombatUnitState): number {
  const base = baseControlChance(actor.pow.rarity);
  const bonus = Number.isFinite(actor.effectAccuracyBonus)
    ? Math.max(0, actor.effectAccuracyBonus)
    : 0;
  const preResist = Math.min(CONTROL_EFFECT_CHANCE_CAP, base + bonus);
  if (!target) return preResist;
  const tenacity = Math.min(
    TENACITY_CAP,
    Math.max(0, Number(target.pow.tenacity || 0) + Number(target.tenacityBonus || 0))
  ) / 100;
  return Math.max(0, preResist * (1 - tenacity));
}

export function pruneControlHistory(target: CombatUnitState, currentRound: number): void {
  const round = Math.max(1, Math.floor(Number.isFinite(currentRound) ? currentRound : 1));
  const earliestRound = Math.max(1, round - CONTROL_HISTORY_ROUNDS + 1);
  target.controlHistory = target.controlHistory.filter((entry) =>
    entry.round >= earliestRound && entry.round <= round
  );
}

export function controlWindowSnapshot(target: CombatUnitState): ControlWindowSnapshot {
  const rounds = target.controlHistory
    .map((entry) => Math.max(1, Math.floor(entry.round)))
    .sort((a, b) => a - b);
  const firstRound = rounds[0] ?? null;
  return {
    count: rounds.length,
    triggerAt: CONTROL_IMMUNITY_TRIGGER_HITS,
    firstRound,
    expiresRound: firstRound === null ? null : firstRound + CONTROL_HISTORY_ROUNDS - 1
  };
}

/** Cooldown is measured in the acting Pow's future turns. */
export function cooldownForAbility(
  ability: CombatAbility,
  slot: CombatCooldownSlot
): number {
  if (Number.isFinite(ability.cooldown)) return Math.max(0, Math.floor(Number(ability.cooldown)));
  const status = normalizedStatus(ability.status);
  if (isHardControlStatus(status)) return 2;
  if (status === 'revive' || status === 'resurrection') return 3;
  if (
    status === 'slow' ||
    status === 'shield' ||
    status === 'regeneration' ||
    status === 'attack up' ||
    status === 'ap up' ||
    status === 'defense up' ||
    status === 'rage gain' ||
    status === 'cleanse' ||
    status === 'purify' ||
    status === 'speed up' ||
    status === 'effect resist' ||
    status === 'guard' ||
    status === 'crit up' ||
    status === 'evasion up' ||
    status === 'anti heal' ||
    status === 'grievous-40' ||
    status === 'grievous 40' ||
    status === 'grievous-60' ||
    status === 'grievous 60' ||
    status === 'attack down' ||
    status === 'ap down' ||
    status === 'defense down' ||
    status === 'accuracy down'
  ) return 1;
  // Pure damage, Burn and Poison stay fluid; Rage already gates Ultimate.
  return slot === 'ultimate' ? 0 : 0;
}

export class CombatControlEngine {
  constructor(private readonly random: () => number = Math.random) {}

  rollControl(actor: CombatUnitState, target: CombatUnitState): ControlRollResult {
    const chance = controlChanceFor(actor, target);
    if (target.controlImmunityActionsRemaining > 0) {
      return { success: false, blockedByImmunity: true, chance, roll: 1 };
    }
    const roll = this.safeRandom();
    return { success: roll < chance, blockedByImmunity: false, chance, roll };
  }

  shouldParalysisSkip(): boolean {
    return this.safeRandom() < PARALYSIS_SKIP_CHANCE;
  }

  recordSuccessfulControl(
    target: CombatUnitState,
    status: HardControlStatus,
    currentRound: number,
    sourceKey: string
  ): boolean {
    const round = Math.max(1, Math.floor(Number.isFinite(currentRound) ? currentRound : 1));
    pruneControlHistory(target, round);
    const normalizedSource = String(sourceKey || status).trim().toLowerCase() || status;
    target.controlHistory.push({ status, round, sourceKey: normalizedSource });

    if (
      target.controlHistory.length < CONTROL_IMMUNITY_TRIGGER_HITS ||
      target.controlImmunityActionsRemaining > 0
    ) return false;

    target.controlImmunityActionsRemaining = CONTROL_IMMUNITY_ACTIONS;
    target.controlHistory = [];
    this.clearHardControl(target);
    return true;
  }

  clearHardControl(target: CombatUnitState): void {
    target.controlStatus = null;
    target.controlActionsRemaining = 0;
    target.silenceActionsRemaining = 0;
    target.paralysisActionsRemaining = 0;
    target.freezeStage = 0;
    target.freezeStageActionsRemaining = 0;
    this.restoreSpeedFromNonFreezeEffects(target);
  }

  applyFreezeStage(target: CombatUnitState): 'chill' | 'frostbite' | 'freeze' {
    if (target.freezeStage <= 0) {
      target.freezeStage = 1;
      target.freezeStageActionsRemaining = FREEZE_STAGE_ACTIONS;
      this.applySpeedComposition(target, 0.9);
      return 'chill';
    }
    if (target.freezeStage === 1) {
      target.freezeStage = 2;
      target.freezeStageActionsRemaining = FREEZE_STAGE_ACTIONS;
      this.applySpeedComposition(target, 0.8);
      return 'frostbite';
    }
    target.freezeStage = 0;
    target.freezeStageActionsRemaining = 0;
    target.controlStatus = 'freeze';
    target.controlActionsRemaining = Math.max(target.controlActionsRemaining, 1);
    this.restoreSpeedFromNonFreezeEffects(target);
    return 'freeze';
  }

  breakFreeze(target: CombatUnitState): void {
    if (target.controlStatus !== 'freeze' || target.controlActionsRemaining <= 0) return;
    target.controlStatus = null;
    target.controlActionsRemaining = 0;
  }

  restoreSpeedFromNonFreezeEffects(target: CombatUnitState): void {
    this.applySpeedComposition(target, 1);
  }

  private applySpeedComposition(target: CombatUnitState, freezeMultiplier: number): void {
    const baseSpeed = this.safeBaseSpeed(target);
    const slowMultiplier = target.speedDebuffActionsRemaining > 0 ? 0.8 : 1;
    const buffMultiplier = target.speedBuffActionsRemaining > 0 ? 1.2 : 1;
    target.speed = Math.max(1, baseSpeed * slowMultiplier * buffMultiplier * freezeMultiplier);
  }

  private safeBaseSpeed(target: CombatUnitState): number {
    return Number.isFinite(target.pow.speed) && target.pow.speed > 0 ? target.pow.speed : 1;
  }

  private safeRandom(): number {
    const value = this.random();
    if (!Number.isFinite(value)) return 1;
    return Math.min(0.999999, Math.max(0, value));
  }
}
