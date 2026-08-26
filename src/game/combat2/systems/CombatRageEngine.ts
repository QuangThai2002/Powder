export const RAGE_READY_POINTS = 4;
export const RAGE_MAX_POINTS = 8;
export const ACTION_BASE_RAW_GAIN = 2;
export const ULTIMATE_RAGE_COST = 4;

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

export function sanitizeRagePoints(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(RAGE_MAX_POINTS, Math.max(0, Math.floor(value)));
}

/**
 * Convert raw Rage into effective stored points.
 * Raw gain is 1:1 until the unit reaches 4 effective points. Any raw gain
 * beyond that threshold is converted at 50% and rounded down. One action is
 * processed as one gain event so crossing the threshold stays deterministic.
 */
export function applyRawRageGain(current: number, rawGain: number): RageGainResult {
  const previous = sanitizeRagePoints(current);
  const safeRaw = Number.isFinite(rawGain) ? Math.max(0, Math.floor(rawGain)) : 0;
  const roomToReady = Math.max(0, RAGE_READY_POINTS - previous);
  const normalRaw = Math.min(roomToReady, safeRaw);
  const overflowRaw = Math.max(0, safeRaw - normalRaw);
  const overflowEffective = Math.floor(overflowRaw / 2);
  const next = sanitizeRagePoints(previous + normalRaw + overflowEffective);

  return {
    previous,
    rawGain: safeRaw,
    normalRaw,
    overflowRaw,
    overflowEffective,
    effectiveGain: next - previous,
    next
  };
}

export function canUseUltimate(ragePoints: number): boolean {
  return sanitizeRagePoints(ragePoints) >= ULTIMATE_RAGE_COST;
}

export function spendUltimate(ragePoints: number): number {
  const current = sanitizeRagePoints(ragePoints);
  if (current < ULTIMATE_RAGE_COST) {
    throw new Error('[Combat2 Rage] Ultimate requires 4 Rage points.');
  }
  return current - ULTIMATE_RAGE_COST;
}

/** Four fixed UI markers. Blue = 1 point, red = 2 points. */
export function rageMarkerStates(ragePoints: number): RageMarkerState[] {
  const value = sanitizeRagePoints(ragePoints);
  const redCount = Math.max(0, value - RAGE_READY_POINTS);
  const blueCount = Math.max(0, value - redCount * 2);
  const emptyCount = Math.max(0, 4 - blueCount - redCount);

  return [
    ...Array<RageMarkerState>(blueCount).fill('blue'),
    ...Array<RageMarkerState>(redCount).fill('red'),
    ...Array<RageMarkerState>(emptyCount).fill('empty')
  ];
}
