import type { CombatRarity, CombatScalingStat, CritMode } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';

export const AD_CRIT_DEFAULT_MULTIPLIER = 2;
export const MAGIC_CRIT_MULTIPLIER_CAP = 2;
export const CRIT_RESIST_CAP = 50;
export const DEF_PEN_CAP = 0.45;
export const DEF_PEN_ULTIMATE_CAP = 0.6;
export const TENACITY_CAP = 60;
export const DAMAGE_REDUCTION_CAP = 0.45;
export const HEAL_POWER_CAP = 60;
export const SHIELD_POWER_CAP = 60;
export const HIT_CHANCE_MIN = 0.25;

const COMPAT_AD_CRIT_DAMAGE_CAP = 250;
const MYTHIC_AD_CRIT_DAMAGE_CAP = 280;

export function adCritDamageCapForRarity(rarity: CombatRarity): number {
  return rarity === 'mythic' ? MYTHIC_AD_CRIT_DAMAGE_CAP : COMPAT_AD_CRIT_DAMAGE_CAP;
}

export interface LegacyHitResult {
  hit: boolean;
  evaded: boolean;
  hitChance: number;
  crit: boolean;
  critChance: number;
  critMultiplier: number;
  critMode: CritMode;
  offense: number;
  lethality: number;
  armorPen: number;
  defenseAfterLethality: number;
  effectiveDefense: number;
  mitigation: number;
  damageReduction: number;
}

export class CombatLegacyStatEngine {
  constructor(private readonly random: () => number = Math.random) {}

  resolveHit(
    actor: CombatUnitState,
    target: CombatUnitState,
    options: {
      offenseStat: CombatScalingStat;
      critMode: CritMode;
      magicCritMultiplier?: number;
      lethality?: number;
      armorPen?: number;
      ultimate?: boolean;
      unavoidable?: boolean;
      area?: boolean;
    }
  ): LegacyHitResult {
    const offense = options.offenseStat === 'attack'
      ? this.safePositive(actor.pow.attack, 1) * this.safeMultiplier(actor.attackMultiplier)
      : this.safePositive(actor.pow.abilityPower, actor.pow.attack) * this.safeMultiplier(actor.abilityPowerMultiplier);
    const targetDefense = this.safeNonNegative(target.pow.defense) * this.safeMultiplier(target.defenseMultiplier);
    const penCap = options.ultimate ? DEF_PEN_ULTIMATE_CAP : DEF_PEN_CAP;
    const lethality = this.safeNonNegative(options.lethality ?? actor.pow.lethality ?? 0);
    const armorPen = this.clamp(options.armorPen ?? actor.pow.defPen, 0, penCap);
    const defenseAfterLethality = Math.max(0, targetDefense - lethality);
    const effectiveDefense = defenseAfterLethality * (1 - armorPen);
    const mitigation = this.mitigationFromDefense(offense, effectiveDefense);

    const evasionCap = ['wind', 'storm', 'dark'].includes(String(target.pow.elementKey).toLowerCase()) ? 75 : 60;
    let effectiveEvasion = this.clamp(target.pow.evasion + target.evasionBonus, 0, evasionCap);
    if (options.area) effectiveEvasion *= 0.7;
    const effectiveAccuracy = this.clamp(actor.pow.accuracy + actor.accuracyBonus, 25, 200);
    const accuracyBonus = (effectiveAccuracy - 100) + (options.ultimate ? 10 : 0);
    const hitChance = options.unavoidable
      ? 1
      : this.clamp((100 + accuracyBonus - effectiveEvasion) / 100, HIT_CHANCE_MIN, 1);
    const hit = Boolean(options.unavoidable) || this.safeRandom() < hitChance;

    const magicMultiplier = this.safeMagicCritMultiplier(options.magicCritMultiplier);
    const critEligible = options.critMode === 'natural-ad' ||
      (options.critMode === 'magic' && magicMultiplier > 1);
    const critChance = critEligible
      ? this.clamp(
          (this.clamp(actor.pow.critRate + actor.critRateBonus, 0, 100) - this.clamp(target.pow.critResist, 0, CRIT_RESIST_CAP)) / 100,
          0,
          1
        )
      : 0;
    // Preserve the legacy RNG stream: every landed hit consumes one Crit roll,
    // even when the typed mode makes the final Crit chance zero.
    const critRoll = hit ? this.safeRandom() : 1;
    const crit = critEligible && critRoll < critChance;
    const critMultiplier = !crit
      ? 1
      : options.critMode === 'magic'
        ? magicMultiplier
        : this.naturalAdCritMultiplier(actor);
    const damageReduction = this.clamp(
      target.pow.damageReduction + target.damageReductionBonus,
      0,
      DAMAGE_REDUCTION_CAP
    );

    return {
      hit,
      evaded: !hit,
      hitChance,
      crit,
      critChance,
      critMultiplier,
      critMode: options.critMode,
      offense,
      lethality,
      armorPen,
      defenseAfterLethality,
      effectiveDefense,
      mitigation,
      damageReduction
    };
  }

  healMultiplier(actor: CombatUnitState): number {
    return 1 + this.clamp(actor.pow.healPower, 0, HEAL_POWER_CAP) / 100;
  }

  shieldMultiplier(actor: CombatUnitState): number {
    return 1 + this.clamp(actor.pow.shieldPower, 0, SHIELD_POWER_CAP) / 100;
  }

  tenacityMultiplier(target: CombatUnitState): number {
    const base = this.clamp(target.pow.tenacity, 0, TENACITY_CAP);
    const runtime = this.clamp(target.tenacityBonus, -TENACITY_CAP, TENACITY_CAP);
    return 1 - this.clamp(base + runtime, 0, TENACITY_CAP) / 100;
  }

  mitigationFromDefense(offense: number, defense: number): number {
    const off = Math.max(1, Number(offense) || 1);
    const def = Math.max(0, Number(defense) || 0);
    const ratio = def / (def + 0.8 * off);
    return this.clamp(ratio * 0.75, 0, 0.7);
  }

  private naturalAdCritMultiplier(actor: CombatUnitState): number {
    const cap = adCritDamageCapForRarity(actor.pow.rarity);
    return this.clamp(actor.pow.critDamage, AD_CRIT_DEFAULT_MULTIPLIER * 100, cap) / 100;
  }

  private safeMagicCritMultiplier(value: number | undefined): number {
    if (!Number.isFinite(value)) return 1;
    return this.clamp(value as number, 1, MAGIC_CRIT_MULTIPLIER_CAP);
  }

  private safeRandom(): number {
    const value = Number(this.random());
    if (!Number.isFinite(value)) return 0.5;
    return this.clamp(value, 0, 0.999999999);
  }

  private safePositive(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private safeNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private safeMultiplier(value: number): number {
    return Number.isFinite(value) ? this.clamp(value, 0.1, 10) : 1;
  }

  private clamp(value: number, min: number, max: number): number {
    const safe = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, safe));
  }
}
