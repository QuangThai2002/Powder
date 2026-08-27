import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';

export type CombatAbilityTargetMode = 'enemy' | 'self' | 'ally' | 'deadAlly';

const SELF_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'ap up', 'defense up', 'rage gain',
  'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
]);
const ALLY_TARGETS = new Set([
  'ally', 'allies', 'team', 'two-allies', 'three-allies', 'self-and-ally', 'self-and-lowest-ally'
]);

function normalizedStatus(ability: CombatAbility): string {
  const raw = String(ability.status || '').trim().toLowerCase();
  return raw.startsWith('self:') ? raw.slice(5).trim() : raw;
}

function normalizedTarget(ability: CombatAbility): string {
  return String(ability.target || '').trim().toLowerCase();
}

export function abilityTargetMode(ability: CombatAbility): CombatAbilityTargetMode {
  const rawStatus = String(ability.status || '').trim().toLowerCase();
  const status = normalizedStatus(ability);
  const type = String(ability.type || '').trim().toLowerCase();
  const target = normalizedTarget(ability);

  if (status === 'revive' || status === 'resurrection') return 'deadAlly';
  if (status === 'cleanse' || status === 'purify') return 'ally';
  if (target === 'self') return 'self';
  if (ALLY_TARGETS.has(target)) return target.startsWith('self-and-') ? 'self' : 'ally';

  // A damaging skill may carry a self: side effect while still targeting an enemy.
  if (type === 'support' || (SELF_STATUSES.has(status) && !rawStatus.startsWith('self:'))) {
    return 'self';
  }
  return 'enemy';
}

export function hasNegativeStatus(unit: CombatUnitState): boolean {
  return Boolean(
    unit.controlActionsRemaining > 0 ||
    unit.silenceActionsRemaining > 0 ||
    unit.paralysisActionsRemaining > 0 ||
    (unit.freezeStage > 0 && unit.freezeStageActionsRemaining > 0) ||
    unit.burnActionsRemaining > 0 ||
    unit.poisonActionsRemaining > 0 ||
    unit.dotActionsRemaining > 0 ||
    unit.speedDebuffActionsRemaining > 0 ||
    unit.antiHealActionsRemaining > 0 ||
    (unit.attackBuffActionsRemaining > 0 && unit.attackMultiplier < 1) ||
    (unit.abilityPowerBuffActionsRemaining > 0 && unit.abilityPowerMultiplier < 1) ||
    (unit.defenseBuffActionsRemaining > 0 && unit.defenseMultiplier < 1) ||
    (unit.accuracyDebuffActionsRemaining > 0 && unit.accuracyBonus < 0)
  );
}

export function abilityRequiresDebuffedAlly(ability: CombatAbility): boolean {
  const status = normalizedStatus(ability);
  return status === 'cleanse' || status === 'purify';
}

export function abilityHasLegalTarget(
  ability: CombatAbility,
  actor: CombatUnitState,
  units: readonly CombatUnitState[]
): boolean {
  const mode = abilityTargetMode(ability);
  if (mode === 'self') return actor.alive;
  if (mode === 'enemy') {
    return units.some((unit) => unit.side !== actor.side && unit.alive && unit.fieldSlot !== null);
  }
  if (mode === 'ally') {
    const requireDebuff = abilityRequiresDebuffedAlly(ability);
    return units.some((unit) =>
      unit.side === actor.side && unit.alive && unit.fieldSlot !== null && (!requireDebuff || hasNegativeStatus(unit))
    );
  }
  return units.some((unit) => unit.side === actor.side && !unit.alive);
}
