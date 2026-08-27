import type { CombatUnitState } from './CombatState';

export const CRIT_DAMAGE_CAP = 250;
export const CRIT_RESIST_CAP = 50;
export const DEF_PEN_CAP = 0.45;
export const DEF_PEN_ULTIMATE_CAP = 0.6;
export const TENACITY_CAP = 60;
export const DAMAGE_REDUCTION_CAP = 0.45;
export const HEAL_POWER_CAP = 60;
export const SHIELD_POWER_CAP = 60;
export const HIT_CHANCE_MIN = 0.25;

export interface LegacyHitResult {
  hit: boolean;
  evaded: boolean;
  hitChance: number;
  crit: boolean;
  critChance: number;
  critMultiplier: number;
  offense: number;
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
      usesAttack: boolean;
      ultimate?: boolean;
      unavoidable?: boolean;
      area?: boolean;
    }
  ): LegacyHitResult {
    const offense = options.usesAttack
      ? this.safePositive(actor.pow.attack, 1) * this.safeMultiplier(actor.attackMultiplier)
      : this.safePositive(actor.pow.abilityPower, actor.pow.attack) * this.safeMultiplier(actor.abilityPowerMultiplier);
    const targetDefense = this.safeNonNegative(target.pow.defense) * this.safeMultiplier(target.defenseMultiplier);
    const penCap = options.ultimate ? DEF_PEN_ULTIMATE_CAP : DEF_PEN_CAP;
    const defPen = this.clamp(actor.pow.defPen, 0, penCap);
    const effectiveDefense = Math.max(0, targetDefense * (1 - defPen));
    const mitigation = this.mitigationFromDefense(offense, effectiveDefense);

    const evasionCap = ['wind', 'storm', 'dark'].includes(String(target.pow.elementKey).toLowerCase()) ? 75 : 60;
    let effectiveEvasion = this.clamp(target.pow.evasion, 0, evasionCap);
    if (options.area) effectiveEvasion *= 0.7;
    const accuracyBonus = (this.clamp(actor.pow.accuracy, 25, 200) - 100) + (options.ultimate ? 10 : 0);
    const hitChance = options.unavoidable
      ? 1
      : this.clamp((100 + accuracyBonus - effectiveEvasion) / 100, HIT_CHANCE_MIN, 1);
    const hit = Boolean(options.unavoidable) || this.safeRandom() < hitChance;

    const critChance = this.clamp(
      (this.clamp(actor.pow.critRate, 0, 100) - this.clamp(target.pow.critResist, 0, CRIT_RESIST_CAP)) / 100,
      0,
      1
    );
    const crit = hit && this.safeRandom() < critChance;
    const critMultiplier = crit
      ? this.clamp(actor.pow.critDamage, 150, CRIT_DAMAGE_CAP) / 100
      : 1;
    const damageReduction = this.clamp(target.pow.damageReduction, 0, DAMAGE_REDUCTION_CAP);

    return {
      hit,
      evaded: !hit,
      hitChance,
      crit,
      critChance,
      critMultiplier,
      offense,
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
    return this.clamp(ratio * 0.75, 0.1, 0.7);
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
