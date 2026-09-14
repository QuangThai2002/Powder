import type { CombatAbility, CombatDamageType, CombatScalingStat, CritMode } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';
import { FROSTBITE_DAMAGE_MULTIPLIER } from './CombatControlEngine';
import { CombatIdentityRules } from './CombatIdentityRules';
import { CombatLegacyStatEngine } from './CombatLegacyStatEngine';
import { CombatPyroonEngine, type PyroonMechanicDamageEvent } from './CombatPyroonEngine';
import { ACTION_BASE_RAW_GAIN, applyRawRageGain } from './CombatRageEngine';
import {
  createCombatActionProvenance,
  type CombatActionProvenance,
  type CombatActionProvenanceOverrides,
  type CombatPassiveLifecycleHook,
  type PassiveActionContext
} from './CombatPassiveEngine';

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
  provenance: CombatActionProvenance;
  focusGained: number;
  focusAfter: number;
  mechanicEvents: readonly PyroonMechanicDamageEvent[];
}

export class BasicAttackResolver {
  private readonly identity = new CombatIdentityRules();
  private readonly legacyStats: CombatLegacyStatEngine;
  private readonly pyroon: CombatPyroonEngine;

  constructor(
    random: () => number = () => 0.5,
    private readonly lifecycleHook: CombatPassiveLifecycleHook = () => {}
  ) {
    this.legacyStats = new CombatLegacyStatEngine(random);
    this.pyroon = new CombatPyroonEngine(random);
  }

  resolve(
    attacker: CombatUnitState,
    target: CombatUnitState,
    passiveContext: PassiveActionContext = {},
    currentRound = 1,
    provenanceOverrides: CombatActionProvenanceOverrides = {},
    battleUnits: readonly CombatUnitState[] = []
  ): BasicAttackResult {
    const ability = attacker.pow.abilities.basic;
    const basicPower = this.safeStat(ability.power, 100);
    const coefficient = Math.min(3, Math.max(0.1, basicPower / 100));
    const scalingStat = this.scalingStat(ability);
    const damageType = this.damageType(ability, scalingStat);
    const critMode = this.critMode(ability, damageType);
    const provenance = createCombatActionProvenance(
      attacker.instanceId,
      [target.instanceId],
      'basic',
      true,
      ability.name,
      provenanceOverrides
    );
    const focusSnapshot = this.pyroon.beginBasic(attacker, target, ability, provenance);
    const targetHpBefore = this.safeHp(target.hp, target.pow.maxHp);
    const identity = this.identity.evaluateDamage(attacker, target, 'basic', damageType, passiveContext);
    const hit = this.legacyStats.resolveHit(attacker, target, {
      offenseStat: scalingStat,
      critMode,
      ...(Number.isFinite(ability.magicCritMultiplier) ? { magicCritMultiplier: ability.magicCritMultiplier } : {}),
      unavoidable: Boolean(ability.unavoidable || ability.sureHit),
      area: Boolean(ability.area)
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
    const focusGained = this.pyroon.completeBasic(
      attacker,
      target,
      ability,
      focusSnapshot,
      hit.hit && damage > 0,
      hit.crit
    );
    const mechanicEvents = this.pyroon.resolveFireBait(attacker, target, provenance, damage, battleUnits);
    this.pyroon.completeMainAction(attacker, provenance);

    const rage = applyRawRageGain(attacker.ragePoints, ACTION_BASE_RAW_GAIN);
    attacker.ragePoints = rage.next;
    if (provenance.origin === 'main') {
      this.lifecycleHook({
        stage: 'after-main-action',
        actor: attacker,
        provenance,
        round: currentRound,
        rageSpent: 0,
        rageAfter: rage.next
      });
    }

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
      mitigation: hit.mitigation,
      provenance,
      focusGained,
      focusAfter: this.pyroon.getFocus(attacker),
      mechanicEvents
    };
  }

  private safeStat(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  }

  private scalingStat(ability: CombatAbility): CombatScalingStat {
    return ability.scalingStat === 'ability-power' ? 'ability-power' : 'attack';
  }

  private damageType(ability: CombatAbility, scalingStat: CombatScalingStat): CombatDamageType {
    if (ability.damageType === 'physical' || ability.damageType === 'magic') return ability.damageType;
    return scalingStat === 'ability-power' ? 'magic' : 'physical';
  }

  private critMode(ability: CombatAbility, damageType: CombatDamageType): CritMode {
    if (ability.critMode === 'natural-ad' || ability.critMode === 'magic' || ability.critMode === 'never') {
      return ability.critMode;
    }
    return damageType === 'physical' ? 'natural-ad' : 'never';
  }

  private safeHp(value: number, maxHp: number): number {
    const safeMax = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 1;
    const safeValue = Number.isFinite(value) ? value : safeMax;
    return Math.min(safeMax, Math.max(0, safeValue));
  }
}
