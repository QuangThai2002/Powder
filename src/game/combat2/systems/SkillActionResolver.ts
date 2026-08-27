import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState, DotStatus, HardControlStatus } from './CombatState';
import { CombatIdentityRules, type ElementOutcome } from './CombatIdentityRules';
import {
  CombatControlEngine,
  FROSTBITE_DAMAGE_MULTIPLIER,
  FREEZE_SHATTER_MULTIPLIER,
  cooldownForAbility,
  isHardControlStatus
} from './CombatControlEngine';
import {
  ACTION_BASE_RAW_GAIN,
  ULTIMATE_RAGE_COST,
  applyRawRageGain,
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
  'shield', 'regeneration', 'attack up', 'ap up', 'defense up', 'rage gain'
]);

export class SkillActionResolver {
  private readonly identity = new CombatIdentityRules();
  private readonly control: CombatControlEngine;

  constructor(random: () => number = Math.random) {
    this.control = new CombatControlEngine(random);
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
    const bonus = this.resourceBonusRaw(ability.status);
    return (slot === 'ultimate' ? 0 : ACTION_BASE_RAW_GAIN) + bonus;
  }

  resolve(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    slot: CombatSkillSlot,
    currentRound = 1
  ): SkillActionResult {
    if (!this.canUse(actor, slot)) {
      throw new Error(`[Combat2] ${actor.pow.name} cannot use ${ability.name}.`);
    }
    return this.resolveAbility(actor, target, ability, slot, 0, currentRound);
  }

  resolveUltimate(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    currentRound = 1
  ): SkillActionResult {
    if (!this.canUseUltimate(actor)) {
      throw new Error(`[Combat2] ${actor.pow.name} cannot use ${ability.name}: Rage, silence or cooldown gate is active.`);
    }

    actor.ragePoints = spendUltimate(actor.ragePoints);
    return this.resolveAbility(actor, target, ability, 'ultimate', ULTIMATE_RAGE_COST, currentRound);
  }

  private resolveAbility(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    abilitySlot: CombatAbilitySlot,
    rageSpent: number,
    currentRound: number
  ): SkillActionResult {
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
          freezeShattered: false
        }
      : this.applyDamage(actor, target, ability.power, damageKind, ability.type);

    const statusResult = this.applyStatus(actor, target, ability, currentRound);
    const rawRageGain = this.previewRawRageGain(ability, abilitySlot);
    const rageResult = applyRawRageGain(actor.ragePoints, rawRageGain);
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
      defeated: !target.alive
    };
  }

  private applyDamage(
    actor: CombatUnitState,
    target: CombatUnitState,
    power: number,
    kind: 'skill' | 'ultimate',
    abilityType: string
  ): Pick<SkillActionResult, 'damage' | 'shieldDamage' | 'hpDamage' | 'identityMultiplier' | 'elementOutcome' | 'freezeShattered'> {
    const normalizedType = String(abilityType || '').trim().toLowerCase();
    const usesAttack = normalizedType === 'physical';
    const offense = usesAttack
      ? this.safeStat(actor.pow.attack, 1) * this.safeMultiplier(actor.attackMultiplier)
      : this.safeStat(actor.pow.abilityPower, actor.pow.attack) * this.safeMultiplier(actor.abilityPowerMultiplier);
    const defense = this.safeStat(target.pow.defense, 0) * this.safeMultiplier(target.defenseMultiplier);
    const coefficient = Math.min(5, Math.max(0.1, this.safeStat(power, 100) / 100));
    const identity = this.identity.evaluateDamage(actor, target, kind, abilityType);
    const rawDamage = Math.max(1, offense * coefficient - defense * 0.35);
    const frozen = target.controlStatus === 'freeze' && target.controlActionsRemaining > 0;
    const frostbitten = target.freezeStage === 2 && target.freezeStageActionsRemaining > 0;
    const vulnerability = frozen
      ? FREEZE_SHATTER_MULTIPLIER
      : frostbitten
        ? FROSTBITE_DAMAGE_MULTIPLIER
        : 1;
    const damage = identity.totalMultiplier <= 0
      ? 0
      : Math.max(1, Math.round(rawDamage * identity.totalMultiplier * vulnerability));
    const shieldBefore = this.safeStat(target.shield, 0);
    const shieldDamage = Math.min(shieldBefore, damage);
    const hpDamage = Math.max(0, damage - shieldDamage);

    target.shield = Math.max(0, shieldBefore - shieldDamage);
    target.hp = Math.max(0, target.hp - hpDamage);
    const freezeShattered = frozen && damage > 0;
    if (freezeShattered) this.control.breakFreeze(target);

    return {
      damage,
      shieldDamage,
      hpDamage,
      identityMultiplier: identity.totalMultiplier,
      elementOutcome: identity.outcome,
      freezeShattered
    };
  }

  private applyStatus(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    currentRound: number
  ): StatusApplicationResult {
    const parsed = this.parseStatus(ability.status);
    const status = parsed.status;
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
        statusLabel = 'control immune';
        controlBlocked = true;
        return {
          healed, shieldGranted, statusLabel, targetSpeedChanged, cleansed, revived,
          controlChance, controlRoll, controlApplied, controlMissed, controlBlocked, controlImmunityTriggered
        };
      }
      if (!roll.success) {
        statusLabel = 'control miss';
        controlMissed = true;
        return {
          healed, shieldGranted, statusLabel, targetSpeedChanged, cleansed, revived,
          controlChance, controlRoll, controlApplied, controlMissed, controlBlocked, controlImmunityTriggered
        };
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
          targetSpeedChanged = true;
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
        targetSpeedChanged = true;
      }

      return {
        healed, shieldGranted, statusLabel, targetSpeedChanged, cleansed, revived,
        controlChance, controlRoll, controlApplied, controlMissed, controlBlocked, controlImmunityTriggered
      };
    }

    switch (status) {
      case 'shield': {
        shieldGranted = Math.max(1, Math.round(actor.pow.maxHp * 0.18 * supportMultiplier));
        actor.shield = Math.min(actor.pow.maxHp * 3, actor.shield + shieldGranted);
        break;
      }
      case 'regeneration': {
        const missingHp = Math.max(0, actor.pow.maxHp - actor.hp);
        healed = Math.min(missingHp, Math.max(1, Math.round(actor.pow.maxHp * 0.15 * supportMultiplier)));
        actor.hp += healed;
        break;
      }
      case 'attack up':
        actor.attackMultiplier = Math.max(actor.attackMultiplier, 1.2);
        actor.attackBuffActionsRemaining = Math.max(actor.attackBuffActionsRemaining, 3 + durationBonus);
        break;
      case 'ap up':
        actor.abilityPowerMultiplier = Math.max(actor.abilityPowerMultiplier, 1.2);
        actor.abilityPowerBuffActionsRemaining = Math.max(actor.abilityPowerBuffActionsRemaining, 3 + durationBonus);
        break;
      case 'defense up':
        actor.defenseMultiplier = Math.max(actor.defenseMultiplier, 1.2);
        actor.defenseBuffActionsRemaining = Math.max(actor.defenseBuffActionsRemaining, 3 + durationBonus);
        break;
      case 'rage gain':
        statusLabel = 'rage gain';
        break;
      case 'cleanse':
      case 'purify': {
        const hadSpeedDebuff = target.speedDebuffActionsRemaining > 0 || target.freezeStage > 0;
        target.speedDebuffActionsRemaining = 0;
        this.control.clearHardControl(target);
        target.dotStatus = null;
        target.dotDamage = 0;
        target.dotActionsRemaining = 0;
        targetSpeedChanged = hadSpeedDebuff;
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
          target.speedBuffActionsRemaining = 0;
          target.speedDebuffActionsRemaining = 0;
          target.attackMultiplier = 1;
          target.abilityPowerMultiplier = 1;
          target.defenseMultiplier = 1;
          target.attackBuffActionsRemaining = 0;
          target.abilityPowerBuffActionsRemaining = 0;
          target.defenseBuffActionsRemaining = 0;
          target.controlImmunityActionsRemaining = 0;
          target.controlHistory = [];
          this.control.clearHardControl(target);
          target.dotStatus = null;
          target.dotDamage = 0;
          target.dotActionsRemaining = 0;
          target.reviveMarkerActionsRemaining = 1;
          target.actionLocked = false;
          target.alive = true;
          revived = true;
          targetSpeedChanged = true;
        }
        statusLabel = 'revive';
        break;
      }
      case 'slow': {
        const baseSpeed = Math.max(1, this.safeStat(target.pow.speed, 1));
        let multiplier = 0.8;
        if (target.freezeStage === 1 && target.freezeStageActionsRemaining > 0) multiplier *= 0.9;
        if (target.freezeStage === 2 && target.freezeStageActionsRemaining > 0) multiplier *= 0.8;
        target.speed = Math.max(1, baseSpeed * multiplier);
        target.speedDebuffActionsRemaining = Math.max(target.speedDebuffActionsRemaining, 2 + durationBonus);
        targetSpeedChanged = true;
        break;
      }
      case 'burn':
      case 'poison': {
        const abilityPower = this.safeStat(actor.pow.abilityPower, actor.pow.attack) * this.safeMultiplier(actor.abilityPowerMultiplier);
        const dotDamage = Math.max(1, Math.round(abilityPower * 0.18));
        target.dotStatus = status as DotStatus;
        target.dotDamage = Math.max(target.dotDamage, dotDamage);
        target.dotActionsRemaining = Math.max(target.dotActionsRemaining, 2 + durationBonus);
        break;
      }
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

  private applyCooldown(actor: CombatUnitState, slot: CombatAbilitySlot, cooldown: number): void {
    const internal = Math.max(0, Math.floor(cooldown)) + 1;
    if (slot === 'ultimate') {
      actor.ultimateCooldownActionsRemaining = Math.max(actor.ultimateCooldownActionsRemaining, internal);
      return;
    }
    actor.skillCooldownActionsRemaining[slot] = Math.max(actor.skillCooldownActionsRemaining[slot], internal);
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

  private safeMultiplier(value: number): number {
    return Number.isFinite(value) ? Math.min(10, Math.max(0.1, value)) : 1;
  }

  private safeStat(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  }
}
