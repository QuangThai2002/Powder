import type { CombatUnitState } from './CombatState';
import { FROSTBITE_DAMAGE_MULTIPLIER } from './CombatControlEngine';
import { CombatIdentityRules } from './CombatIdentityRules';
import { CombatLegacyStatEngine } from './CombatLegacyStatEngine';
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
  freezeShattered: boolean;
  defeated: boolean;
  crit: boolean;
  critMultiplier: number;
  evaded: boolean;
  hitChance: number;
  critChance: number;
  mitigation: number;
}

export class BasicAttackResolver {
  private readonly identity = new CombatIdentityRules();
  private readonly legacyStats: CombatLegacyStatEngine;

  constructor(random: () => number = () => 0.5) {
    this.legacyStats = new CombatLegacyStatEngine(random);
  }

  resolve(attacker: CombatUnitState, target: CombatUnitState): BasicAttackResult {
    const basicPower = this.safeStat(attacker.pow.abilities.basic.power, 100);
    const coefficient = Math.min(3, Math.max(0.1, basicPower / 100));
    const targetHpBefore = this.safeHp(target.hp, target.pow.maxHp);
    const identity = this.identity.evaluateDamage(attacker, target, 'basic', 'physical');
    const hit = this.legacyStats.resolveHit(attacker, target, {
      offenseStat: 'attack',
      critMode: 'natural-ad',
      unavoidable: Boolean(attacker.pow.abilities.basic.unavoidable || attacker.pow.abilities.basic.sureHit),
      area: Boolean(attacker.pow.abilities.basic.area)
    });
    const frostbitten = target.freezeStage === 2 && target.freezeStageActionsRemaining > 0;
    const vulnerability = frostbitten ? FROSTBITE_DAMAGE_MULTIPLIER : 1;

    const damage = !hit.hit || identity.totalMultiplier <= 0
      ? 0
      : Math.max(
          1,
          Math.round(
            coefficient *
            hit.offense *
            (1 - hit.mitigation) *
            identity.totalMultiplier *
            hit.critMultiplier *
            vulnerability *
            (1 - hit.damageReduction)
          )
        );
    const shieldBefore = this.safeStat(target.shield, 0);
    const shieldDamage = Math.min(shieldBefore, damage);
    const hpDamage = Math.max(0, damage - shieldDamage);
    const targetHpAfter = Math.max(0, targetHpBefore - hpDamage);

    target.shield = Math.max(0, shieldBefore - shieldDamage);
    target.hp = targetHpAfter;
    target.alive = targetHpAfter > 0;
    const freezeShattered = false;

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
      freezeShattered,
      defeated: !target.alive,
      crit: hit.crit,
      critMultiplier: hit.critMultiplier,
      evaded: hit.evaded,
      hitChance: hit.hitChance,
      critChance: hit.critChance,
      mitigation: hit.mitigation
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
