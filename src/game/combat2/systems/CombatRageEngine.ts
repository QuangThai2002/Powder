import '../../../../js/combat-rage-model.js';

export type RageMarkerState = 'empty' | 'blue' | 'red';

export interface RageGainResult {
  previous: number;
  rawGain: number;
  normalRaw: number;
  overflowRaw: number;
  overflowEffective: number;
  effectiveGain: number;
  next: number;
}

export interface RageChargeEvent {
  type: 'charge-to';
  previous: number;
  target: number;
  effectiveGain: number;
  next: number;
}

export interface RageChargeResult {
  previous: number;
  target: number;
  effectiveGain: number;
  next: number;
  events: readonly RageChargeEvent[];
}

interface RageModel {
  rules: { ready: number; max: number; start: number; actionGain: number; ultimateCost: number };
  playerScale: { pointsPerInternal: number; ready: number; max: number; ultimateCost: number };
  sanitizeRagePoints(value: number): number;
  totalRawGain(contributions: number | readonly number[]): number;
  applyRageEvent(current: number, contributions: number | readonly number[], spent?: number): RageGainResult;
  applyRawRageGain(current: number, contributions: number | readonly number[]): RageGainResult;
  canUseUltimate(value: number): boolean;
  spendUltimate(value: number): number;
  rageMarkerStates(value: number): RageMarkerState[];
  toPlayerRagePoints(value: number): number;
  formatPlayerRageBalance(value: number, maximum?: number): string;
  formatPlayerRageCost(value: number): string;
  formatPlayerRageGain(value: number): string;
  formatPlayerRageSpend(spent: number, remaining: number): string;
}

const model = (globalThis as unknown as { POWDER_COMBAT_RAGE_MODEL: RageModel }).POWDER_COMBAT_RAGE_MODEL;
export const RAGE_READY_POINTS = model.rules.ready;
export const RAGE_MAX_POINTS = model.rules.max;
export const RAGE_START_POINTS = model.rules.start;
export const ACTION_BASE_RAW_GAIN = model.rules.actionGain;
export const ULTIMATE_RAGE_COST = model.rules.ultimateCost;
export const PLAYER_RAGE_SCALE = model.playerScale;
export const {
  sanitizeRagePoints,
  totalRawGain,
  applyRageEvent,
  applyRawRageGain,
  canUseUltimate,
  spendUltimate,
  rageMarkerStates,
  toPlayerRagePoints,
  formatPlayerRageBalance,
  formatPlayerRageCost,
  formatPlayerRageGain,
  formatPlayerRageSpend
} = model;

/** Charge is one Passive-owned resource event, not a sequence of synthetic +1 gains. */
export function chargeRageTo(current: number, target: number): RageChargeResult {
  const previous = sanitizeRagePoints(current);
  const requestedTarget = sanitizeRagePoints(target);
  const next = Math.max(previous, requestedTarget);
  const effectiveGain = next - previous;
  const event: RageChargeEvent | null = effectiveGain > 0
    ? { type: 'charge-to', previous, target: requestedTarget, effectiveGain, next }
    : null;
  return {
    previous,
    target: requestedTarget,
    effectiveGain,
    next,
    events: event ? [event] : []
  };
}
