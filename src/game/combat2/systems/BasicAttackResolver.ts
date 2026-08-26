import type { CombatUnitState } from './CombatState';

export interface BasicAttackResult {
  damage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  defeated: boolean;
}

/**
 * Pure gameplay resolver for the first Combat 2.0 action.
 * Presentation is intentionally kept outside this class so an animation can
 * never decide whether gameplay completes or the turn advances.
 */
export class BasicAttackResolver {
  resolve(attacker: CombatUnitState, target: CombatUnitState): BasicAttackResult {
    const attack = this.safeStat(attacker.pow.attack, 1);
    const defense = this.safeStat(target.pow.defense, 0);
    const targetHpBefore = this.safeHp(target.hp, target.pow.maxHp);

    // Simple deterministic baseline. This is deliberately easy to regression
    // test before importing the complete legacy skill coefficients.
    const damage = Math.max(1, Math.round(attack - defense * 0.45));
    const targetHpAfter = Math.max(0, targetHpBefore - damage);

    target.hp = targetHpAfter;
    target.alive = targetHpAfter > 0;

    attacker.mana = Math.min(attacker.pow.maxMana, attacker.mana + 8);
    attacker.rage = Math.min(attacker.pow.maxRage, attacker.rage + 12);

    return {
      damage,
      targetHpBefore,
      targetHpAfter,
      defeated: !target.alive
    };
  }

  private safeStat(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  }

  private safeHp(value: number, maxHp: number): number {
    const safeMax = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 1;
    const safeValue = Number.isFinite(value) ? value : safeMax;
    return Math.min(safeMax, Math.max(0, safeValue));
  }
}
