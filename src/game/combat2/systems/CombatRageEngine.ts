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

interface RageModel {
  rules: { ready: number; max: number; start: number; actionGain: number; ultimateCost: number };
  sanitizeRagePoints(value: number): number;
  totalRawGain(contributions: number | readonly number[]): number;
  applyRageEvent(current: number, contributions: number | readonly number[], spent?: number): RageGainResult;
  applyRawRageGain(current: number, contributions: number | readonly number[]): RageGainResult;
  canUseUltimate(value: number): boolean;
  spendUltimate(value: number): number;
  rageMarkerStates(value: number): RageMarkerState[];
}

const model = (globalThis as unknown as { POWDER_COMBAT_RAGE_MODEL: RageModel }).POWDER_COMBAT_RAGE_MODEL;
export const RAGE_READY_POINTS = model.rules.ready;
export const RAGE_MAX_POINTS = model.rules.max;
export const RAGE_START_POINTS = model.rules.start;
export const ACTION_BASE_RAW_GAIN = model.rules.actionGain;
export const ULTIMATE_RAGE_COST = model.rules.ultimateCost;
export const { sanitizeRagePoints, totalRawGain, applyRageEvent, applyRawRageGain, canUseUltimate, spendUltimate, rageMarkerStates } = model;
