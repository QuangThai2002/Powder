import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';
import {
  SkillActionResolver,
  type CombatAbilitySlot,
  type SkillActionResult
} from './SkillActionResolver';
import { ULTIMATE_RAGE_COST } from './CombatRageEngine';

interface ActorResourceSnapshot {
  ragePoints: number;
  skillCooldownActionsRemaining: [number, number];
  ultimateCooldownActionsRemaining: number;
}

/**
 * Resolves secondary targets of one already-paid ability action.
 * Rage and cooldown are restored after each secondary resolution so one AoE
 * cast never pays or gains resources more than once. Self-directed side
 * effects are stripped from secondary copies so they cannot stack per target.
 */
export class CombatMultiTargetResolver {
  constructor(private readonly resolver: SkillActionResolver) {}

  resolveSecondary(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    slot: CombatAbilitySlot,
    currentRound: number
  ): SkillActionResult {
    const snapshot = this.snapshot(actor);
    const secondaryAbility = this.secondaryAbility(ability);

    try {
      if (slot === 'ultimate') {
        actor.ultimateCooldownActionsRemaining = 0;
        actor.ragePoints = Math.max(ULTIMATE_RAGE_COST, actor.ragePoints);
        const result = this.resolver.resolveUltimate(actor, target, secondaryAbility, currentRound);
        return this.withoutResourceSideEffects(result, snapshot.ragePoints);
      }

      actor.skillCooldownActionsRemaining[slot] = 0;
      const result = this.resolver.resolve(actor, target, secondaryAbility, slot, currentRound);
      return this.withoutResourceSideEffects(result, snapshot.ragePoints);
    } finally {
      this.restore(actor, snapshot);
    }
  }

  private secondaryAbility(ability: CombatAbility): CombatAbility {
    const status = String(ability.status || '').trim();
    if (!status.toLowerCase().startsWith('self:')) return ability;
    return { ...ability, status: undefined };
  }

  private snapshot(actor: CombatUnitState): ActorResourceSnapshot {
    return {
      ragePoints: actor.ragePoints,
      skillCooldownActionsRemaining: [
        actor.skillCooldownActionsRemaining[0],
        actor.skillCooldownActionsRemaining[1]
      ],
      ultimateCooldownActionsRemaining: actor.ultimateCooldownActionsRemaining
    };
  }

  private restore(actor: CombatUnitState, snapshot: ActorResourceSnapshot): void {
    actor.ragePoints = snapshot.ragePoints;
    actor.skillCooldownActionsRemaining = [...snapshot.skillCooldownActionsRemaining];
    actor.ultimateCooldownActionsRemaining = snapshot.ultimateCooldownActionsRemaining;
  }

  private withoutResourceSideEffects(result: SkillActionResult, rageAfter: number): SkillActionResult {
    return {
      ...result,
      rawRageGain: 0,
      rageGained: 0,
      rageSpent: 0,
      rageAfter,
      cooldownApplied: 0
    };
  }
}
