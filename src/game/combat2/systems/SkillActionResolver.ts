import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState, ControlStatus, DotStatus } from './CombatState';
import {
  CombatIdentityRules,
  type ElementOutcome
} from './CombatIdentityRules';

export type CombatSkillSlot = 0 | 1;
export type CombatAbilitySlot = CombatSkillSlot | 'ultimate';

export interface SkillActionResult {
  abilitySlot: CombatAbilitySlot;
  abilityName: string;
  manaCost: number;
  rageCost: number;
  damage: number;
  shieldDamage: number;
  hpDamage: number;
  healed: number;
  shieldGranted: number;
  statusLabel: string | null;
  targetSpeedChanged: boolean;
  identityMultiplier: number;
  elementOutcome: ElementOutcome;
  defeated: boolean;
}

const SKILL_COSTS: Record<CombatSkillSlot, number> = {
  0: 18,
  1: 24
};
const ULTIMATE_RAGE_COST = 100;
const SELF_STATUSES = new Set([
  'shield',
  'regeneration',
  'attack up',
  'defense up',
  'ap up'
]);

export class SkillActionResolver {
  private readonly identity = new CombatIdentityRules();

  costFor(slot: CombatSkillSlot): number {
    return SKILL_COSTS[slot];
  }

  ultimateRageCost(): number {
    return ULTIMATE_RAGE_COST;
  }

  canUse(actor: CombatUnitState, slot: CombatSkillSlot): boolean {
    return actor.alive && actor.mana >= this.costFor(slot);
  }

  canUseUltimate(actor: CombatUnitState): boolean {
    return actor.alive && actor.rage >= ULTIMATE_RAGE_COST;
  }

  resolve(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    slot: CombatSkillSlot
  ): SkillActionResult {
    const manaCost = this.costFor(slot);

    if (!this.canUse(actor, slot)) {
      throw new Error(
        `[Combat2] ${actor.pow.name} does not have enough Mana for ${ability.name}.`
      );
    }

    actor.mana = Math.max(0, actor.mana - manaCost);
    actor.rage = Math.min(
      actor.pow.maxRage,
      actor.rage + (slot === 0 ? 18 : 22)
    );

    return this.resolveAbility(actor, target, ability, slot, manaCost, 0);
  }

  resolveUltimate(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility
  ): SkillActionResult {
    if (!this.canUseUltimate(actor)) {
      throw new Error(
        `[Combat2] ${actor.pow.name} does not have enough Rage for ${ability.name}.`
      );
    }

    actor.rage = Math.max(0, actor.rage - ULTIMATE_RAGE_COST);
    return this.resolveAbility(
      actor,
      target,
      ability,
      'ultimate',
      0,
      ULTIMATE_RAGE_COST
    );
  }

  private resolveAbility(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    abilitySlot: CombatAbilitySlot,
    manaCost: number,
    rageCost: number
  ): SkillActionResult {
    const abilityType = String(ability.type || '').trim().toLowerCase();
    const status = String(ability.status || '').trim().toLowerCase();
    const noDirectDamage =
      abilityType === 'support' ||
      abilityType === 'debuff' ||
      (actor.instanceId === target.instanceId && SELF_STATUSES.has(status));
    const damageKind = abilitySlot === 'ultimate' ? 'ultimate' : 'skill';
    const damageResult = noDirectDamage
      ? {
          damage: 0,
          shieldDamage: 0,
          hpDamage: 0,
          identityMultiplier: 1,
          elementOutcome: 'neutral' as ElementOutcome
        }
      : this.applyDamage(
          actor,
          target,
          ability.power,
          damageKind,
          ability.type
        );
    const statusResult = this.applyStatus(actor, target, ability.status);

    target.alive = target.hp > 0;

    return {
      abilitySlot,
      abilityName: ability.name,
      manaCost,
      rageCost,
      ...damageResult,
      ...statusResult,
      defeated: !target.alive
    };
  }

  private applyDamage(
    actor: CombatUnitState,
    target: CombatUnitState,
    power: number,
    kind: 'skill' | 'ultimate',
    abilityType: string
  ): Pick<
    SkillActionResult,
    'damage' | 'shieldDamage' | 'hpDamage' | 'identityMultiplier' | 'elementOutcome'
  > {
    const attack =
      this.safeStat(actor.pow.attack, 1) *
      this.safeMultiplier(actor.attackMultiplier);
    const defense =
      this.safeStat(target.pow.defense, 0) *
      this.safeMultiplier(target.defenseMultiplier);
    const coefficient = Math.min(5, Math.max(0.1, this.safeStat(power, 100) / 100));
    const identity = this.identity.evaluateDamage(actor, target, kind, abilityType);
    const rawDamage = Math.max(1, attack * coefficient - defense * 0.35);
    const damage = identity.totalMultiplier <= 0
      ? 0
      : Math.max(1, Math.round(rawDamage * identity.totalMultiplier));
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
  ): Pick<
    SkillActionResult,
    'healed' | 'shieldGranted' | 'statusLabel' | 'targetSpeedChanged'
  > {
    const status = String(rawStatus || '').trim().toLowerCase();
    const supportMultiplier = this.identity.supportMultiplier(actor);
    const durationBonus = this.identity.statusDurationBonus(actor, status);
    let healed = 0;
    let shieldGranted = 0;
    let statusLabel: string | null = rawStatus ? String(rawStatus) : null;
    let targetSpeedChanged = false;

    switch (status) {
      case 'shield': {
        shieldGranted = Math.max(
          1,
          Math.round(actor.pow.maxHp * 0.18 * supportMultiplier)
        );
        actor.shield = Math.min(actor.pow.maxHp * 3, actor.shield + shieldGranted);
        break;
      }
      case 'regeneration': {
        const missingHp = Math.max(0, actor.pow.maxHp - actor.hp);
        healed = Math.min(
          missingHp,
          Math.max(1, Math.round(actor.pow.maxHp * 0.15 * supportMultiplier))
        );
        actor.hp += healed;
        break;
      }
      case 'attack up': {
        actor.attackMultiplier = Math.max(actor.attackMultiplier, 1.2);
        actor.attackBuffActionsRemaining = Math.max(
          actor.attackBuffActionsRemaining,
          3 + durationBonus
        );
        break;
      }
      case 'defense up': {
        actor.defenseMultiplier = Math.max(actor.defenseMultiplier, 1.2);
        actor.defenseBuffActionsRemaining = Math.max(
          actor.defenseBuffActionsRemaining,
          3 + durationBonus
        );
        break;
      }
      case 'ap up': {
        actor.mana = Math.min(
          actor.pow.maxMana,
          actor.mana + Math.round(15 * supportMultiplier)
        );
        break;
      }
      case 'stun':
      case 'freeze': {
        target.controlStatus = status as ControlStatus;
        target.controlActionsRemaining = Math.max(
          target.controlActionsRemaining,
          1 + durationBonus
        );
        break;
      }
      case 'slow': {
        const baseSpeed = Math.max(1, this.safeStat(target.pow.speed, 1));
        target.speed = Math.max(1, baseSpeed * 0.8);
        target.speedDebuffActionsRemaining = Math.max(
          target.speedDebuffActionsRemaining,
          2 + durationBonus
        );
        targetSpeedChanged = true;
        break;
      }
      case 'burn':
      case 'poison': {
        const dotDamage = Math.max(
          1,
          Math.round(this.safeStat(actor.pow.attack, 1) * 0.18)
        );
        target.dotStatus = status as DotStatus;
        target.dotDamage = Math.max(target.dotDamage, dotDamage);
        target.dotActionsRemaining = Math.max(
          target.dotActionsRemaining,
          2 + durationBonus
        );
        break;
      }
      case '': {
        statusLabel = null;
        break;
      }
      default: {
        // Unknown catalog statuses remain presentation-only until their
        // deterministic gameplay rule is explicitly implemented.
        break;
      }
    }

    return {
      healed,
      shieldGranted,
      statusLabel,
      targetSpeedChanged
    };
  }

  private safeMultiplier(value: number): number {
    return Number.isFinite(value) ? Math.min(10, Math.max(0.1, value)) : 1;
  }

  private safeStat(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  }
}
