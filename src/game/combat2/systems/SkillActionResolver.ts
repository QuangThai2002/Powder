import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState, ControlStatus, DotStatus } from './CombatState';

export type CombatSkillSlot = 0 | 1;

export interface SkillActionResult {
  skillSlot: CombatSkillSlot;
  abilityName: string;
  manaCost: number;
  damage: number;
  shieldDamage: number;
  hpDamage: number;
  healed: number;
  shieldGranted: number;
  statusLabel: string | null;
  targetSpeedChanged: boolean;
  defeated: boolean;
}

const SKILL_COSTS: Record<CombatSkillSlot, number> = {
  0: 18,
  1: 24
};

export class SkillActionResolver {
  costFor(slot: CombatSkillSlot): number {
    return SKILL_COSTS[slot];
  }

  canUse(actor: CombatUnitState, slot: CombatSkillSlot): boolean {
    return actor.alive && actor.mana >= this.costFor(slot);
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

    const isPureSupport = ability.type.toLowerCase() === 'support';
    const damageResult = isPureSupport
      ? { damage: 0, shieldDamage: 0, hpDamage: 0 }
      : this.applyDamage(actor, target, ability.power);
    const statusResult = this.applyStatus(actor, target, ability.status);

    target.alive = target.hp > 0;

    return {
      skillSlot: slot,
      abilityName: ability.name,
      manaCost,
      ...damageResult,
      ...statusResult,
      defeated: !target.alive
    };
  }

  private applyDamage(
    actor: CombatUnitState,
    target: CombatUnitState,
    power: number
  ): Pick<SkillActionResult, 'damage' | 'shieldDamage' | 'hpDamage'> {
    const attack =
      this.safeStat(actor.pow.attack, 1) *
      this.safeMultiplier(actor.attackMultiplier);
    const defense =
      this.safeStat(target.pow.defense, 0) *
      this.safeMultiplier(target.defenseMultiplier);
    const coefficient = Math.min(5, Math.max(0.1, this.safeStat(power, 100) / 100));
    const damage = Math.max(
      1,
      Math.round(attack * coefficient - defense * 0.35)
    );
    const shieldBefore = this.safeStat(target.shield, 0);
    const shieldDamage = Math.min(shieldBefore, damage);
    const hpDamage = Math.max(0, damage - shieldDamage);

    target.shield = Math.max(0, shieldBefore - shieldDamage);
    target.hp = Math.max(0, target.hp - hpDamage);

    return { damage, shieldDamage, hpDamage };
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
    let healed = 0;
    let shieldGranted = 0;
    let statusLabel: string | null = rawStatus ? String(rawStatus) : null;
    let targetSpeedChanged = false;

    switch (status) {
      case 'shield': {
        shieldGranted = Math.max(1, Math.round(actor.pow.maxHp * 0.18));
        actor.shield = Math.min(actor.pow.maxHp * 3, actor.shield + shieldGranted);
        break;
      }
      case 'regeneration': {
        const missingHp = Math.max(0, actor.pow.maxHp - actor.hp);
        healed = Math.min(
          missingHp,
          Math.max(1, Math.round(actor.pow.maxHp * 0.15))
        );
        actor.hp += healed;
        break;
      }
      case 'attack up': {
        actor.attackMultiplier = Math.max(actor.attackMultiplier, 1.2);
        // completeAction consumes one count immediately, leaving two future turns.
        actor.attackBuffActionsRemaining = Math.max(
          actor.attackBuffActionsRemaining,
          3
        );
        break;
      }
      case 'defense up': {
        actor.defenseMultiplier = Math.max(actor.defenseMultiplier, 1.2);
        actor.defenseBuffActionsRemaining = Math.max(
          actor.defenseBuffActionsRemaining,
          3
        );
        break;
      }
      case 'ap up': {
        actor.mana = Math.min(actor.pow.maxMana, actor.mana + 15);
        break;
      }
      case 'stun':
      case 'freeze': {
        target.controlStatus = status as ControlStatus;
        target.controlActionsRemaining = Math.max(
          target.controlActionsRemaining,
          1
        );
        break;
      }
      case 'slow': {
        const baseSpeed = Math.max(1, this.safeStat(target.pow.speed, 1));
        target.speed = Math.max(1, baseSpeed * 0.8);
        target.speedDebuffActionsRemaining = Math.max(
          target.speedDebuffActionsRemaining,
          2
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
        target.dotActionsRemaining = Math.max(target.dotActionsRemaining, 2);
        break;
      }
      case '': {
        statusLabel = null;
        break;
      }
      default: {
        // Unknown catalog statuses are deliberately presentation-only until a
        // deterministic resolver exists. The action still completes safely.
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
