import type { CombatUnitState } from './CombatState';
import { CombatIdentityRules } from './CombatIdentityRules';
import { ACTION_BASE_RAW_GAIN, applyRawRageGain } from './CombatRageEngine';

export interface BasicAttackResult {
  damage: number;
  shieldDamage: number;
  hpDamage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  identityMultiplier: number;
  rawRageGain: number;
  rageGained: number;
  rageAfter: number;
  defeated: boolean;
}

export class BasicAttackResolver {
  private readonly identity = new CombatIdentityRules();

  resolve(attacker: CombatUnitState, target: CombatUnitState): BasicAttackResult {
    const attack = this.safeStat(attacker.pow.attack, 1) * this.safeMultiplier(attacker.attackMultiplier);
    const defense = this.safeStat(target.pow.defense, 0) * this.safeMultiplier(target.defenseMultiplier);
    const basicPower = this.safeStat(attacker.pow.abilities.basic.power, 100);
    const coefficient = Math.min(3, Math.max(0.1, basicPower / 100));
    const targetHpBefore = this.safeHp(target.hp, target.pow.maxHp);
    const identity = this.identity.evaluateDamage(attacker, target, 'basic', 'physical');

    const rawDamage = Math.max(1, attack * coefficient - defense * 0.45);
    const damage = Math.max(1, Math.round(rawDamage * identity.totalMultiplier));
    const shieldBefore = this.safeStat(target.shield, 0);
    const shieldDamage = Math.min(shieldBefore, damage);
    const hpDamage = Math.max(0, damage - shieldDamage);
    const targetHpAfter = Math.max(0, targetHpBefore - hpDamage);

    target.shield = Math.max(0, shieldBefore - shieldDamage);
    target.hp = targetHpAfter;
    target.alive = targetHpAfter > 0;

    const rage = applyRawRageGain(attacker.ragePoints, ACTION_BASE_RAW_GAIN);
    attacker.ragePoints = rage.next;

    return {
      damage,
      shieldDamage,
      hpDamage,
      targetHpBefore,
      targetHpAfter,
      identityMultiplier: identity.totalMultiplier,
      rawRageGain: rage.rawGain,
      rageGained: rage.effectiveGain,
      rageAfter: rage.next,
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
