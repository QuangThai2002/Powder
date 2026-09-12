import type {
  CombatAbility,
  CombatDamageType,
  CombatScalingStat,
  CritMode,
  GrievousTier
} from '../data/CombatPow';
import type { CombatUnitState, HardControlStatus } from './CombatState';
import { CombatIdentityRules, type ElementOutcome } from './CombatIdentityRules';
import {
  CombatControlEngine,
  FROSTBITE_DAMAGE_MULTIPLIER,
  FREEZE_SHATTER_MULTIPLIER,
  cooldownForAbility,
  isHardControlStatus
} from './CombatControlEngine';
import { CombatLegacyStatEngine } from './CombatLegacyStatEngine';
import {
  GRIEVOUS_40,
  GRIEVOUS_60,
  effectiveHealingReduction,
  grievousReduction,
  strongestGrievousTier
} from './CombatHealingReduction';
import {
  createCombatActionProvenance,
  type CombatActionProvenance,
  type CombatActionProvenanceOverrides,
  type CombatPassiveLifecycleHook,
  type PassiveActionContext
} from './CombatPassiveEngine';
import {
  ACTION_BASE_RAW_GAIN,
  ULTIMATE_RAGE_COST,
  applyRageEvent,
  canUseUltimate as rageCanUseUltimate,
  spendUltimate
} from './CombatRageEngine';

export type CombatSkillSlot = 0 | 1;
export type CombatAbilitySlot = CombatSkillSlot | 'ultimate';

export interface SkillActionResult {
  abilitySlot: CombatAbilitySlot;
  abilityName: string;
  damage: number;
  shieldDamage: number;
  hpDamage: number;
  healed: number;
  shieldGranted: number;
  statusLabel: string | null;
  targetSpeedChanged: boolean;
  cleansed: boolean;
  revived: boolean;
  rawRageGain: number;
  rageGained: number;
  rageSpent: number;
  rageAfter: number;
  identityMultiplier: number;
  elementOutcome: ElementOutcome;
  defeated: boolean;
  controlChance: number | null;
  controlRoll: number | null;
  controlApplied: boolean;
  controlMissed: boolean;
  controlBlocked: boolean;
  controlImmunityTriggered: boolean;
  freezeShattered: boolean;
  cooldownApplied: number;
  crit: boolean;
  critMultiplier: number;
  evaded: boolean;
  hitChance: number;
  critChance: number;
  mitigation: number;
  provenance: CombatActionProvenance;
}

interface ParsedStatus {
  status: string;
  selfDirected: boolean;
  label: string | null;
}

interface StatusApplicationResult {
  healed: number;
  shieldGranted: number;
  statusLabel: string | null;
  targetSpeedChanged: boolean;
  cleansed: boolean;
  revived: boolean;
  controlChance: number | null;
  controlRoll: number | null;
  controlApplied: boolean;
  controlMissed: boolean;
  controlBlocked: boolean;
  controlImmunityTriggered: boolean;
}

const SELF_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'ap up', 'defense up', 'rage gain',
  'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
]);

export class SkillActionResolver {
  private readonly identity = new CombatIdentityRules();
  private readonly control: CombatControlEngine;
  private readonly legacyStats: CombatLegacyStatEngine;

  constructor(
    random: () => number = Math.random,
    private readonly lifecycleHook: CombatPassiveLifecycleHook = () => {}
  ) {
    this.control = new CombatControlEngine(random);
    this.legacyStats = new CombatLegacyStatEngine(random);
  }

  canUse(actor: CombatUnitState, slot: CombatSkillSlot): boolean {
    return actor.alive && actor.silenceActionsRemaining <= 0 && this.cooldownRemaining(actor, slot) <= 0;
  }

  canUseUltimate(actor: CombatUnitState): boolean {
    return actor.alive &&
      actor.silenceActionsRemaining <= 0 &&
      actor.ultimateCooldownActionsRemaining <= 0 &&
      rageCanUseUltimate(actor.ragePoints);
  }

  isSilenced(actor: CombatUnitState): boolean {
    return actor.silenceActionsRemaining > 0;
  }

  cooldownRemaining(actor: CombatUnitState, slot: CombatAbilitySlot): number {
    if (slot === 'ultimate') return Math.max(0, actor.ultimateCooldownActionsRemaining || 0);
    return Math.max(0, actor.skillCooldownActionsRemaining?.[slot] || 0);
  }

  previewCooldown(ability: CombatAbility, slot: CombatAbilitySlot): number {
    return cooldownForAbility(ability, slot);
  }

  shouldParalysisSkip(actor: CombatUnitState): boolean {
    return actor.paralysisActionsRemaining > 0 && this.control.shouldParalysisSkip();
  }

  ultimateRageCost(): number {
    return ULTIMATE_RAGE_COST;
  }

  previewRawRageGain(ability: CombatAbility, slot: CombatAbilitySlot): number {
    if (ability.rageGainMode === 'none') return 0;
    const bonus = this.resourceBonusRaw(ability.status);
    return (slot === 'ultimate' ? 0 : ACTION_BASE_RAW_GAIN) + bonus;
  }

  resolve(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    slot: CombatSkillSlot,
    currentRound = 1,
    passiveContext: PassiveActionContext = {},
    provenanceOverrides: CombatActionProvenanceOverrides = {}
  ): SkillActionResult {
    if (!this.canUse(actor, slot)) {
      throw new Error(`[Combat2] ${actor.pow.name} cannot use ${ability.name}.`);
    }
    const provenance = this.provenanceFor(actor, target, ability, 'skill', provenanceOverrides);
    const result = this.resolveAbility(actor, target, ability, slot, 0, currentRound, passiveContext, provenance);
    if (provenance.origin === 'main') {
      this.emitLifecycle('after-main-action', actor, provenance, currentRound, 0, result.rageAfter);
    }
    return result;
  }

  resolveUltimate(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    currentRound = 1,
    passiveContext: PassiveActionContext = {},
    provenanceOverrides: CombatActionProvenanceOverrides = {}
  ): SkillActionResult {
    if (!this.canUseUltimate(actor)) {
      throw new Error(`[Combat2] ${actor.pow.name} cannot use ${ability.name}: Rage, silence or cooldown gate is active.`);
    }
    const provenance = this.provenanceFor(actor, target, ability, 'ultimate', provenanceOverrides);
    actor.ragePoints = spendUltimate(actor.ragePoints);
    this.emitLifecycle('after-rage-cost', actor, provenance, currentRound, ULTIMATE_RAGE_COST, actor.ragePoints);
    const result = this.resolveAbility(
      actor,
      target,
      ability,
      'ultimate',
      ULTIMATE_RAGE_COST,
      currentRound,
      passiveContext,
      provenance
    );
    this.emitLifecycle('after-ultimate-cast', actor, provenance, currentRound, ULTIMATE_RAGE_COST, result.rageAfter);
    if (provenance.origin === 'main') {
      this.emitLifecycle('after-main-action', actor, provenance, currentRound, ULTIMATE_RAGE_COST, result.rageAfter);
    }
    return result;
  }

  private resolveAbility(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    abilitySlot: CombatAbilitySlot,
    rageSpent: number,
    currentRound: number,
    passiveContext: PassiveActionContext,
    provenance: CombatActionProvenance
  ): SkillActionResult {
    const rageBeforeEvent = actor.ragePoints + rageSpent;
    const abilityType = String(ability.type || '').trim().toLowerCase();
    const parsedStatus = this.parseStatus(ability.status);
    const noDirectDamage =
      abilityType === 'support' ||
      abilityType === 'debuff' ||
      (actor.instanceId === target.instanceId && SELF_STATUSES.has(parsedStatus.status));
    const damageKind = abilitySlot === 'ultimate' ? 'ultimate' : 'skill';
    const damageResult = noDirectDamage
      ? {
          damage: 0,
          shieldDamage: 0,
          hpDamage: 0,
          identityMultiplier: 1,
          elementOutcome: 'neutral' as ElementOutcome,
          freezeShattered: false,
          crit: false,
          critMultiplier: 1,
          evaded: false,
          hitChance: 1,
          critChance: 0,
          mitigation: 0
        }
      : this.applyDamage(actor, target, ability, damageKind, passiveContext);

    const suppressFreezeReapply = damageResult.freezeShattered && parsedStatus.status === 'freeze';
    const statusResult = damageResult.evaded && !noDirectDamage
      ? this.emptyStatusResult('evade')
      : suppressFreezeReapply
        ? this.emptyStatusResult(null)
        : this.applyStatus(actor, target, ability, currentRound, damageResult.damage);
    const rageGainDisabled = ability.rageGainMode === 'none';
    const rageResult = applyRageEvent(rageBeforeEvent, [
      abilitySlot === 'ultimate' || rageGainDisabled ? 0 : ACTION_BASE_RAW_GAIN,
      rageGainDisabled ? 0 : this.resourceBonusRaw(ability.status)
    ], rageSpent);
    const rawRageGain = rageResult.rawGain;
    actor.ragePoints = rageResult.next;
    const cooldownApplied = cooldownForAbility(ability, abilitySlot);
    this.applyCooldown(actor, abilitySlot, cooldownApplied);
    target.alive = target.hp > 0;

    return {
      abilitySlot,
      abilityName: ability.name,
      ...damageResult,
      ...statusResult,
      rawRageGain,
      rageGained: rageResult.effectiveGain,
      rageSpent,
      rageAfter: rageResult.next,
      cooldownApplied,
      defeated: !target.alive,
      provenance
    };
  }

  private provenanceFor(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    actionType: 'skill' | 'ultimate',
    overrides: CombatActionProvenanceOverrides
  ): CombatActionProvenance {
    return createCombatActionProvenance(
      actor.instanceId,
      [target.instanceId],
      actionType,
      this.isDirectDamageAbility(actor, target, ability),
      ability.name,
      {
        ...(ability.passiveCounterGain ? { passiveCounterGain: ability.passiveCounterGain } : {}),
        ...overrides
      }
    );
  }

  private isDirectDamageAbility(actor: CombatUnitState, target: CombatUnitState, ability: CombatAbility): boolean {
    const abilityType = String(ability.type || '').trim().toLowerCase();
    const status = this.parseStatus(ability.status).status;
    return abilityType !== 'support' &&
      abilityType !== 'debuff' &&
      !(actor.instanceId === target.instanceId && SELF_STATUSES.has(status));
  }

  private emitLifecycle(
    stage: 'after-rage-cost' | 'after-ultimate-cast' | 'after-main-action',
    actor: CombatUnitState,
    provenance: CombatActionProvenance,
    round: number,
    rageSpent: number,
    rageAfter: number
  ): void {
    this.lifecycleHook({ stage, actor, provenance, round, rageSpent, rageAfter });
  }

  private applyDamage(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    kind: 'skill' | 'ultimate',
    passiveContext: PassiveActionContext
  ): Pick<SkillActionResult,
    'damage' | 'shieldDamage' | 'hpDamage' | 'identityMultiplier' | 'elementOutcome' |
    'freezeShattered' | 'crit' | 'critMultiplier' | 'evaded' | 'hitChance' | 'critChance' | 'mitigation'> {
    const normalizedType = String(ability.type || '').trim().toLowerCase();
    const damageType = this.damageTypeFor(ability, normalizedType);
    const offenseStat = this.scalingStatFor(ability, normalizedType);
    const critMode = this.critModeFor(ability, damageType);
    const coefficient = Math.min(5, Math.max(0.1, this.safeStat(ability.power, 100) / 100));
    const identity = this.identity.evaluateDamage(actor, target, kind, damageType, passiveContext);
    const hit = this.legacyStats.resolveHit(actor, target, {
      offenseStat,
      critMode,
      magicCritMultiplier: ability.magicCritMultiplier,
      ultimate: kind === 'ultimate',
      unavoidable: Boolean(ability.unavoidable || ability.sureHit),
      area: Boolean(ability.area)
    });
    const frozen = target.controlStatus === 'freeze' && target.controlActionsRemaining > 0;
    const frostbitten = target.freezeStage === 2 && target.freezeStageActionsRemaining > 0;
    const explicitShatter = Boolean(ability.shatterFrozen) && frozen;
    const conditionalDamageMultiplier = this.conditionalDamageMultiplier(ability, target);
    const vulnerability = explicitShatter
      ? FREEZE_SHATTER_MULTIPLIER
      : frostbitten
        ? FROSTBITE_DAMAGE_MULTIPLIER
        : 1;
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
            conditionalDamageMultiplier *
            (1 - hit.damageReduction)
          )
        );
    const shieldBefore = this.safeStat(target.shield, 0);
    const shieldDamage = Math.min(shieldBefore, damage);
    const hpDamage = Math.max(0, damage - shieldDamage);

    target.shield = Math.max(0, shieldBefore - shieldDamage);
    target.hp = Math.max(0, target.hp - hpDamage);
    const freezeShattered = explicitShatter && damage > 0;
    if (freezeShattered) this.control.breakFreeze(target);

    return {
      damage,
      shieldDamage,
      hpDamage,
      identityMultiplier: identity.totalMultiplier,
      elementOutcome: identity.outcome,
      freezeShattered,
      crit: hit.crit,
      critMultiplier: hit.critMultiplier,
      evaded: hit.evaded,
      hitChance: hit.hitChance,
      critChance: hit.critChance,
      mitigation: hit.mitigation
    };
  }

  private applyStatus(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    currentRound: number,
    impactDamage: number
  ): StatusApplicationResult {
    const parsed = this.parseStatus(ability.status);
    const status = parsed.status;
    const effectTarget = parsed.selfDirected ? actor : target;
    const supportMultiplier = this.identity.supportMultiplier(actor);
    const durationBonus = this.identity.statusDurationBonus(actor, status);
    let healed = 0;
    let shieldGranted = 0;
    let statusLabel = parsed.label;
    let targetSpeedChanged = false;
    let cleansed = false;
    let revived = false;
    let controlChance: number | null = null;
    let controlRoll: number | null = null;
    let controlApplied = false;
    let controlMissed = false;
    let controlBlocked = false;
    let controlImmunityTriggered = false;

    if (isHardControlStatus(status)) {
      const roll = this.control.rollControl(actor, target);
      controlChance = roll.chance;
      controlRoll = roll.roll;
      if (roll.blockedByImmunity) {
        return this.emptyStatusResult('control immune', { controlChance, controlRoll, controlBlocked: true });
      }
      if (!roll.success) {
        return this.emptyStatusResult('control miss', { controlChance, controlRoll, controlMissed: true });
      }

      controlApplied = true;
      switch (status as HardControlStatus) {
        case 'silence':
          target.silenceActionsRemaining = Math.max(target.silenceActionsRemaining, 1);
          statusLabel = 'silence';
          break;
        case 'stun':
          target.controlStatus = 'stun';
          target.controlActionsRemaining = Math.max(target.controlActionsRemaining, 1);
          statusLabel = 'stun';
          break;
        case 'paralysis':
          target.paralysisActionsRemaining = Math.max(target.paralysisActionsRemaining, 2);
          statusLabel = 'paralysis';
          break;
        case 'freeze':
          statusLabel = this.control.applyFreezeStage(target);
          targetSpeedChanged = target.instanceId !== actor.instanceId;
          break;
      }

      const sourceKey = `${actor.pow.id}:${ability.name}`;
      controlImmunityTriggered = this.control.recordSuccessfulControl(
        target,
        status as HardControlStatus,
        currentRound,
        sourceKey
      );
      if (controlImmunityTriggered) {
        statusLabel = 'control immunity';
        targetSpeedChanged = target.instanceId !== actor.instanceId;
      }

      return {
        healed, shieldGranted, statusLabel, targetSpeedChanged, cleansed, revived,
        controlChance, controlRoll, controlApplied, controlMissed, controlBlocked, controlImmunityTriggered
      };
    }

    switch (status) {
      case 'shield': {
        const role = this.normalizedRole(effectTarget);
        const capRatio = role.includes('do don') || role.includes('tank') ? 0.8 : 0.6;
        const raw = effectTarget.pow.maxHp * 0.2 * supportMultiplier * this.legacyStats.shieldMultiplier(actor);
        const cap = Math.max(1, Math.round(effectTarget.pow.maxHp * capRatio));
        const before = effectTarget.shield;
        effectTarget.shield = Math.min(cap, effectTarget.shield + Math.max(1, Math.round(raw)));
        shieldGranted = Math.max(0, effectTarget.shield - before);
        break;
      }
      case 'regeneration': {
        healed = this.healTarget(actor, effectTarget, effectTarget.pow.maxHp * 0.1 * supportMultiplier);
        effectTarget.regenerationActionsRemaining = Math.max(effectTarget.regenerationActionsRemaining, 2 + durationBonus);
        break;
      }
      case 'attack up':
        effectTarget.attackMultiplier = Math.max(effectTarget.attackMultiplier, 1.3);
        effectTarget.attackBuffActionsRemaining = Math.max(effectTarget.attackBuffActionsRemaining, 3 + durationBonus);
        break;
      case 'ap up':
        effectTarget.abilityPowerMultiplier = Math.max(effectTarget.abilityPowerMultiplier, 1.3);
        effectTarget.abilityPowerBuffActionsRemaining = Math.max(effectTarget.abilityPowerBuffActionsRemaining, 3 + durationBonus);
        break;
      case 'defense up':
        effectTarget.defenseMultiplier = Math.max(effectTarget.defenseMultiplier, 1.3);
        effectTarget.defenseBuffActionsRemaining = Math.max(effectTarget.defenseBuffActionsRemaining, 3 + durationBonus);
        break;
      case 'speed up':
        effectTarget.speedBuffActionsRemaining = Math.max(effectTarget.speedBuffActionsRemaining, 2 + durationBonus);
        this.refreshSpeed(effectTarget);
        targetSpeedChanged = effectTarget.instanceId === target.instanceId && target.instanceId !== actor.instanceId;
        break;
      case 'effect resist':
        effectTarget.tenacityBonus = Math.max(effectTarget.tenacityBonus, 20);
        effectTarget.tenacityBuffActionsRemaining = Math.max(effectTarget.tenacityBuffActionsRemaining, 2 + durationBonus);
        break;
      case 'guard':
        effectTarget.damageReductionBonus = Math.max(effectTarget.damageReductionBonus, 0.25);
        effectTarget.guardActionsRemaining = Math.max(effectTarget.guardActionsRemaining, 2 + durationBonus);
        break;
      case 'crit up':
        effectTarget.critRateBonus = Math.max(effectTarget.critRateBonus, 15);
        effectTarget.critBuffActionsRemaining = Math.max(effectTarget.critBuffActionsRemaining, 2 + durationBonus);
        break;
      case 'evasion up':
        effectTarget.evasionBonus = Math.max(effectTarget.evasionBonus, 15);
        effectTarget.evasionBuffActionsRemaining = Math.max(effectTarget.evasionBuffActionsRemaining, 2 + durationBonus);
        break;
      case 'rage gain':
        statusLabel = 'rage gain';
        break;
      case 'attack down':
        target.attackMultiplier = Math.min(target.attackMultiplier, 0.8);
        target.attackBuffActionsRemaining = Math.max(target.attackBuffActionsRemaining, 2 + durationBonus);
        break;
      case 'ap down':
        target.abilityPowerMultiplier = Math.min(target.abilityPowerMultiplier, 0.8);
        target.abilityPowerBuffActionsRemaining = Math.max(target.abilityPowerBuffActionsRemaining, 2 + durationBonus);
        break;
      case 'defense down':
        target.defenseMultiplier = Math.min(target.defenseMultiplier, 0.8);
        target.defenseBuffActionsRemaining = Math.max(target.defenseBuffActionsRemaining, 2 + durationBonus);
        break;
      case 'accuracy down':
        target.accuracyBonus = Math.min(target.accuracyBonus, -20);
        target.accuracyDebuffActionsRemaining = Math.max(target.accuracyDebuffActionsRemaining, 2 + durationBonus);
        break;
      case 'anti heal':
      case 'grievous-40':
      case 'grievous 40':
      case 'grievous-60':
      case 'grievous 60': {
        const requested = this.grievousTierFor(ability, status);
        target.grievousTier = strongestGrievousTier(target.grievousTier, requested);
        target.antiHeal = Math.max(target.antiHeal, grievousReduction(target.grievousTier));
        target.antiHealActionsRemaining = Math.max(target.antiHealActionsRemaining, 2 + durationBonus);
        break;
      }
      case 'cleanse':
      case 'purify': {
        const hadSpeedDebuff = target.speedDebuffActionsRemaining > 0 || target.freezeStage > 0;
        target.speedDebuffActionsRemaining = 0;
        this.control.clearHardControl(target);
        target.burnDamage = 0;
        target.burnActionsRemaining = 0;
        target.poisonStacks = 0;
        target.poisonActionsRemaining = 0;
        target.dotStatus = null;
        target.dotDamage = 0;
        target.dotActionsRemaining = 0;
        target.antiHeal = 0;
        target.grievousTier = null;
        target.antiHealActionsRemaining = 0;
        if (target.attackMultiplier < 1) { target.attackMultiplier = 1; target.attackBuffActionsRemaining = 0; }
        if (target.abilityPowerMultiplier < 1) { target.abilityPowerMultiplier = 1; target.abilityPowerBuffActionsRemaining = 0; }
        if (target.defenseMultiplier < 1) { target.defenseMultiplier = 1; target.defenseBuffActionsRemaining = 0; }
        if (target.accuracyBonus < 0) { target.accuracyBonus = 0; target.accuracyDebuffActionsRemaining = 0; }
        targetSpeedChanged = hadSpeedDebuff && target.instanceId !== actor.instanceId;
        this.refreshSpeed(target);
        cleansed = true;
        statusLabel = 'cleanse';
        break;
      }
      case 'revive':
      case 'resurrection': {
        if (!target.alive || target.hp <= 0) {
          target.hp = Math.max(1, Math.round(target.pow.maxHp * 0.35));
          target.ragePoints = Math.max(0, Math.floor(target.ragePoints));
          target.shield = 0;
          this.resetRevivedEffects(target);
          target.reviveMarkerActionsRemaining = 1;
          target.actionLocked = false;
          target.alive = true;
          revived = true;
          targetSpeedChanged = target.instanceId !== actor.instanceId;
        }
        statusLabel = 'revive';
        break;
      }
      case 'slow':
        target.speedDebuffActionsRemaining = Math.max(target.speedDebuffActionsRemaining, 2 + durationBonus);
        this.refreshSpeed(target);
        targetSpeedChanged = target.instanceId !== actor.instanceId;
        break;
      case 'burn': {
        const seed = impactDamage > 0
          ? impactDamage
          : this.safeStat(actor.pow.abilityPower, actor.pow.attack) * 0.5;
        const tick = Math.max(1, Math.min(
          Math.round(target.pow.maxHp * 0.12),
          Math.round(seed * 0.3)
        ));
        target.burnDamage = Math.max(target.burnDamage, tick);
        target.burnActionsRemaining = Math.max(target.burnActionsRemaining, 2 + durationBonus);
        target.dotStatus = 'burn';
        target.dotDamage = target.burnDamage;
        target.dotActionsRemaining = target.burnActionsRemaining;
        break;
      }
      case 'poison':
        target.poisonStacks = Math.min(3, Math.max(1, target.poisonStacks + 1));
        target.poisonActionsRemaining = Math.max(target.poisonActionsRemaining, 2 + durationBonus);
        target.dotStatus = 'poison';
        target.dotDamage = Math.max(1, Math.round(target.pow.maxHp * 0.02 * target.poisonStacks));
        target.dotActionsRemaining = target.poisonActionsRemaining;
        break;
      case '':
        statusLabel = null;
        break;
      default:
        break;
    }

    return {
      healed, shieldGranted, statusLabel, targetSpeedChanged, cleansed, revived,
      controlChance, controlRoll, controlApplied, controlMissed, controlBlocked, controlImmunityTriggered
    };
  }

  private healTarget(source: CombatUnitState, target: CombatUnitState, rawAmount: number): number {
    const poisonAntiHeal = Math.min(0.4, Math.max(0, target.poisonStacks) * 0.06);
    const antiHeal = effectiveHealingReduction(target.grievousTier, [target.antiHeal, poisonAntiHeal]);
    const boosted = Math.max(0, rawAmount) * this.legacyStats.healMultiplier(source);
    const amount = Math.min(
      Math.round(target.pow.maxHp * 0.35),
      Math.max(0, Math.round(boosted * (1 - antiHeal)))
    );
    const missing = Math.max(0, target.pow.maxHp - target.hp);
    const healed = Math.min(missing, amount);
    target.hp += healed;
    return healed;
  }

  private resetRevivedEffects(target: CombatUnitState): void {
    target.speedBuffActionsRemaining = 0;
    target.speedDebuffActionsRemaining = 0;
    target.attackMultiplier = 1;
    target.abilityPowerMultiplier = 1;
    target.defenseMultiplier = 1;
    target.attackBuffActionsRemaining = 0;
    target.abilityPowerBuffActionsRemaining = 0;
    target.defenseBuffActionsRemaining = 0;
    target.critRateBonus = 0;
    target.critBuffActionsRemaining = 0;
    target.evasionBonus = 0;
    target.evasionBuffActionsRemaining = 0;
    target.accuracyBonus = 0;
    target.accuracyDebuffActionsRemaining = 0;
    target.tenacityBonus = 0;
    target.tenacityBuffActionsRemaining = 0;
    target.damageReductionBonus = 0;
    target.guardActionsRemaining = 0;
    target.antiHeal = 0;
    target.grievousTier = null;
    target.antiHealActionsRemaining = 0;
    target.regenerationActionsRemaining = 0;
    target.controlImmunityActionsRemaining = 0;
    target.controlHistory = [];
    this.control.clearHardControl(target);
    target.burnDamage = 0;
    target.burnActionsRemaining = 0;
    target.poisonStacks = 0;
    target.poisonActionsRemaining = 0;
    target.dotStatus = null;
    target.dotDamage = 0;
    target.dotActionsRemaining = 0;
    this.refreshSpeed(target);
  }

  private refreshSpeed(target: CombatUnitState): void {
    let multiplier = 1;
    if (target.speedBuffActionsRemaining > 0) multiplier *= 1.2;
    if (target.speedDebuffActionsRemaining > 0) multiplier *= 0.8;
    if (target.freezeStage === 1 && target.freezeStageActionsRemaining > 0) multiplier *= 0.9;
    if (target.freezeStage === 2 && target.freezeStageActionsRemaining > 0) multiplier *= 0.8;
    target.speed = Math.max(1, this.safeStat(target.pow.speed, 1) * multiplier);
  }

  private emptyStatusResult(
    statusLabel: string | null = null,
    overrides: Partial<StatusApplicationResult> = {}
  ): StatusApplicationResult {
    return {
      healed: 0,
      shieldGranted: 0,
      statusLabel,
      targetSpeedChanged: false,
      cleansed: false,
      revived: false,
      controlChance: null,
      controlRoll: null,
      controlApplied: false,
      controlMissed: false,
      controlBlocked: false,
      controlImmunityTriggered: false,
      ...overrides
    };
  }

  private applyCooldown(actor: CombatUnitState, slot: CombatAbilitySlot, cooldown: number): void {
    const internal = Math.max(0, Math.floor(cooldown)) + 1;
    if (slot === 'ultimate') {
      actor.ultimateCooldownActionsRemaining = Math.max(actor.ultimateCooldownActionsRemaining, internal);
      return;
    }
    actor.skillCooldownActionsRemaining[slot] = Math.max(actor.skillCooldownActionsRemaining[slot], internal);
  }

  private damageTypeFor(ability: CombatAbility, normalizedType: string): CombatDamageType {
    if (ability.damageType === 'physical' || ability.damageType === 'magic') return ability.damageType;
    return normalizedType === 'physical' ? 'physical' : 'magic';
  }

  private scalingStatFor(ability: CombatAbility, normalizedType: string): CombatScalingStat {
    if (ability.scalingStat === 'attack' || ability.scalingStat === 'ability-power') return ability.scalingStat;
    return normalizedType === 'physical' ? 'attack' : 'ability-power';
  }

  private critModeFor(ability: CombatAbility, damageType: CombatDamageType): CritMode {
    if (ability.critMode === 'never') return 'never';
    if (damageType === 'physical') return 'natural-ad';
    return ability.critMode === 'magic' ? 'magic' : 'never';
  }

  private conditionalDamageMultiplier(ability: CombatAbility, target: CombatUnitState): number {
    const modifier = ability.conditionalDamageModifier;
    if (!modifier || modifier.condition.targetStatus !== 'paralysis') return 1;
    if (target.paralysisActionsRemaining <= 0) return 1;
    return Math.min(5, Math.max(1, this.safeStat(modifier.multiplier, 1)));
  }

  private grievousTierFor(ability: CombatAbility, status: string): GrievousTier {
    if (ability.grievousTier === GRIEVOUS_60 || status === 'grievous-60' || status === 'grievous 60') {
      return GRIEVOUS_60;
    }
    return GRIEVOUS_40;
  }

  private resourceBonusRaw(rawStatus: string | undefined): number {
    const status = this.parseStatus(rawStatus).status;
    return status === 'rage gain' ? 1 : 0;
  }

  private parseStatus(rawStatus: string | undefined): ParsedStatus {
    const raw = String(rawStatus || '').trim();
    if (!raw) return { status: '', selfDirected: false, label: null };
    const selfDirected = raw.toLowerCase().startsWith('self:');
    const label = selfDirected ? raw.slice(5).trim() : raw;
    return { status: label.toLowerCase(), selfDirected, label: label || null };
  }

  private normalizedRole(unit: CombatUnitState): string {
    return String(unit.pow.role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase();
  }

  private safeStat(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  }
}
