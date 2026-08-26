import type { CombatUnitState } from './CombatState';

export interface BasicAttackResult {
  damage: number;
  shieldDamage: number;
  hpDamage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  defeated: boolean;
}

export class BasicAttackResolver {
  resolve(attacker: CombatUnitState, target: CombatUnitState): BasicAttackResult {
    const attack =
      this.safeStat(attacker.pow.attack, 1) *
      this.safeMultiplier(attacker.attackMultiplier);
    const defense =
      this.safeStat(target.pow.defense, 0) *
      this.safeMultiplier(target.defenseMultiplier);
    const targetHpBefore = this.safeHp(target.hp, target.pow.maxHp);

    const damage = Math.max(1, Math.round(attack - defense * 0.45));
    const shieldBefore = this.safeStat(target.shield, 0);
    const shieldDamage = Math.min(shieldBefore, damage);
    const hpDamage = Math.max(0, damage - shieldDamage);
    const targetHpAfter = Math.max(0, targetHpBefore - hpDamage);

    target.shield = Math.max(0, shieldBefore - shieldDamage);
    target.hp = targetHpAfter;
    target.alive = targetHpAfter > 0;

    attacker.mana = Math.min(attacker.pow.maxMana, attacker.mana + 8);
    attacker.rage = Math.min(attacker.pow.maxRage, attacker.rage + 12);

    return {
      damage,
      shieldDamage,
      hpDamage,
      targetHpBefore,
      targetHpAfter,
      defeated: !target.alive
    };
  }

  private safeMultiplier(value: number): number {
    return Number.isFinite(value) ? Math.min(10, Math.max(0.1, value)) : 1;
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
