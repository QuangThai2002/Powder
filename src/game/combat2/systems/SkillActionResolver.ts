import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState, ControlStatus, DotStatus } from './CombatState';
import { CombatIdentityRules, type ElementOutcome } from './CombatIdentityRules';
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
}

interface ParsedStatus {
  status: string;
  selfDirected: boolean;
  label: string | null;
}

const SELF_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'defense up', 'rage gain', 'ap up'
]);

export class SkillActionResolver {
  private readonly identity = new CombatIdentityRules();

  /** Normal skills no longer consume a separate resource. */
  canUse(actor: CombatUnitState, _slot: CombatSkillSlot): boolean {
    return actor.alive;
  }

  canUseUltimate(actor: CombatUnitState): boolean {
    return actor.alive && rageCanUseUltimate(actor.ragePoints);
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
    slot: CombatSkillSlot
  ): SkillActionResult {
    if (!this.canUse(actor, slot)) {
      throw new Error(`[Combat2] ${actor.pow.name} cannot use ${ability.name}.`);
    }
    return this.resolveAbility(actor, target, ability, slot, 0);
  }

  resolveUltimate(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility
  ): SkillActionResult {
    if (!this.canUseUltimate(actor)) {
      throw new Error(`[Combat2] ${actor.pow.name} needs 4 Rage points for ${ability.name}.`);
    }

    actor.ragePoints = spendUltimate(actor.ragePoints);
    return this.resolveAbility(actor, target, ability, 'ultimate', ULTIMATE_RAGE_COST);
  }

  private resolveAbility(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    abilitySlot: CombatAbilitySlot,
    rageSpent: number
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
          elementOutcome: 'neutral' as ElementOutcome
        }
      : this.applyDamage(actor, target, ability.power, damageKind, ability.type);

    const statusResult = this.applyStatus(actor, target, ability.status);
    const rawRageGain = this.previewRawRageGain(ability, abilitySlot);
    const rageResult = applyRawRageGain(actor.ragePoints, rawRageGain);
    actor.ragePoints = rageResult.next;
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
      defeated: !target.alive
    };
  }

  private applyDamage(
    actor: CombatUnitState,
    target: CombatUnitState,
    power: number,
    kind: 'skill' | 'ultimate',
    abilityType: string
  ): Pick<SkillActionResult, 'damage' | 'shieldDamage' | 'hpDamage' | 'identityMultiplier' | 'elementOutcome'> {
    const attack = this.safeStat(actor.pow.attack, 1) * this.safeMultiplier(actor.attackMultiplier);
    const defense = this.safeStat(target.pow.defense, 0) * this.safeMultiplier(target.defenseMultiplier);
    const coefficient = Math.min(5, Math.max(0.1, this.safeStat(power, 100) / 100));
    const identity = this.identity.evaluateDamage(actor, target, kind, abilityType);
    const rawDamage = Math.max(1, attack * coefficient - defense * 0.35);
    const damage = identity.totalMultiplier <= 0 ? 0 : Math.max(1, Math.round(rawDamage * identity.totalMultiplier));
    const shieldBefore = this.safeStat(target.shield, 0);
    const shieldDamage = Math.min(shieldBefore, damage);
    const hpDamage = Math.max(0, damage - shieldDamage);

    target.shield = Math.max(0, shieldBefore - shieldDamage);
    target.hp = Math.max(0, target.hp - hpDamage);

    return {
      damage,
      shieldDamage,
      hpDamage,
      identityMultiplier: identity.totalMultiplier,
      elementOutcome: identity.outcome
    };
  }

  private applyStatus(
    actor: CombatUnitState,
    target: CombatUnitState,
    rawStatus: string | undefined
  ): Pick<SkillActionResult, 'healed' | 'shieldGranted' | 'statusLabel' | 'targetSpeedChanged' | 'cleansed' | 'revived'> {
    const parsed = this.parseStatus(rawStatus);
    const status = parsed.status;
    const supportMultiplier = this.identity.supportMultiplier(actor);
    const durationBonus = this.identity.statusDurationBonus(actor, status);
    let healed = 0;
    let shieldGranted = 0;
    let statusLabel = parsed.label;
    let targetSpeedChanged = false;
    let cleansed = false;
    let revived = false;

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
      case 'attack up': {
        actor.attackMultiplier = Math.max(actor.attackMultiplier, 1.2);
        actor.attackBuffActionsRemaining = Math.max(actor.attackBuffActionsRemaining, 3 + durationBonus);
        break;
      }
      case 'defense up': {
        actor.defenseMultiplier = Math.max(actor.defenseMultiplier, 1.2);
        actor.defenseBuffActionsRemaining = Math.max(actor.defenseBuffActionsRemaining, 3 + durationBonus);
        break;
      }
      case 'rage gain':
      case 'ap up': {
        statusLabel = 'rage gain';
        break;
      }
      case 'cleanse':
      case 'purify': {
        const wasSlowed = target.speedDebuffActionsRemaining > 0;
        target.controlStatus = null;
        target.controlActionsRemaining = 0;
        target.dotStatus = null;
        target.dotDamage = 0;
        target.dotActionsRemaining = 0;
        target.speedDebuffActionsRemaining = 0;
        if (wasSlowed && target.speedBuffActionsRemaining <= 0) {
          target.speed = Math.max(1, this.safeStat(target.pow.speed, 1));
          targetSpeedChanged = true;
        }
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
          target.speed = Math.max(1, this.safeStat(target.pow.speed, 1));
          target.speedBuffActionsRemaining = 0;
          target.speedDebuffActionsRemaining = 0;
          target.attackMultiplier = 1;
          target.defenseMultiplier = 1;
          target.attackBuffActionsRemaining = 0;
          target.defenseBuffActionsRemaining = 0;
          target.controlStatus = null;
          target.controlActionsRemaining = 0;
          target.dotStatus = null;
          target.dotDamage = 0;
          target.dotActionsRemaining = 0;
          target.reviveMarkerActionsRemaining = 1;
          target.actionLocked = false;
          target.alive = true;
          revived = true;
        }
        statusLabel = 'revive';
        break;
      }
      case 'stun':
      case 'freeze': {
        target.controlStatus = status as ControlStatus;
        target.controlActionsRemaining = Math.max(target.controlActionsRemaining, 1 + durationBonus);
        break;
      }
      case 'slow': {
        const baseSpeed = Math.max(1, this.safeStat(target.pow.speed, 1));
        target.speed = Math.max(1, baseSpeed * 0.8);
        target.speedDebuffActionsRemaining = Math.max(target.speedDebuffActionsRemaining, 2 + durationBonus);
        targetSpeedChanged = true;
        break;
      }
      case 'burn':
      case 'poison': {
        const dotDamage = Math.max(1, Math.round(this.safeStat(actor.pow.attack, 1) * 0.18));
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

    return { healed, shieldGranted, statusLabel, targetSpeedChanged, cleansed, revived };
  }

  private resourceBonusRaw(rawStatus: string | undefined): number {
    const status = this.parseStatus(rawStatus).status;
    return status === 'rage gain' || status === 'ap up' ? 1 : 0;
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
