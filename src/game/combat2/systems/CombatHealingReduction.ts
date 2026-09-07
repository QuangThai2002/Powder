import type { GrievousTier } from '../data/CombatPow';

export const GRIEVOUS_40: GrievousTier = 'grievous-40';
export const GRIEVOUS_60: GrievousTier = 'grievous-60';

const REDUCTION_BY_TIER: Readonly<Record<GrievousTier, number>> = Object.freeze({
  [GRIEVOUS_40]: 0.4,
  [GRIEVOUS_60]: 0.6
});

export function grievousReduction(tier: GrievousTier | null | undefined): number {
  return tier ? REDUCTION_BY_TIER[tier] ?? 0 : 0;
}

export function strongestGrievousTier(
  ...tiers: ReadonlyArray<GrievousTier | null | undefined>
): GrievousTier | null {
  return tiers.some((tier) => tier === GRIEVOUS_60)
    ? GRIEVOUS_60
    : tiers.some((tier) => tier === GRIEVOUS_40)
      ? GRIEVOUS_40
      : null;
}

/** Compatibility adapter: legacy numeric reductions become one canonical tier. */
export function grievousTierFromLegacyReduction(value: number): GrievousTier | null {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (safe > 0.4) return GRIEVOUS_60;
  if (safe > 0) return GRIEVOUS_40;
  return null;
}

export function effectiveHealingReduction(
  canonicalTier: GrievousTier | null | undefined,
  legacyReductions: number | readonly number[] = 0
): number {
  const values = Array.isArray(legacyReductions) ? legacyReductions : [legacyReductions];
  const adapted = values.map(grievousTierFromLegacyReduction);
  return grievousReduction(strongestGrievousTier(canonicalTier, ...adapted));
}
