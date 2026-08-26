import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';

export type CombatAbilityTargetMode = 'enemy' | 'self' | 'ally' | 'deadAlly';

const SELF_STATUSES = new Set([
  'shield',
  'regeneration',
  'attack up',
  'defense up',
  'ap up'
]);

function normalizedStatus(ability: CombatAbility): string {
  const raw = String(ability.status || '').trim().toLowerCase();
  return raw.startsWith('self:') ? raw.slice(5).trim() : raw;
}

export function abilityTargetMode(ability: CombatAbility): CombatAbilityTargetMode {
  const status = normalizedStatus(ability);
  const type = String(ability.type || '').trim().toLowerCase();

  if (status === 'revive' || status === 'resurrection') {
    return 'deadAlly';
  }

  if (status === 'cleanse' || status === 'purify') {
    return 'ally';
  }

  if (
    String(ability.status || '').trim().toLowerCase().startsWith('self:') ||
    type === 'support' ||
    SELF_STATUSES.has(status)
  ) {
    return 'self';
  }

  return 'enemy';
}

export function hasNegativeStatus(unit: CombatUnitState): boolean {
  return Boolean(
    unit.controlActionsRemaining > 0 ||
    unit.dotActionsRemaining > 0 ||
    unit.speedDebuffActionsRemaining > 0
  );
}

export function abilityHasLegalTarget(
  ability: CombatAbility,
  actor: CombatUnitState,
  units: readonly CombatUnitState[]
): boolean {
  const mode = abilityTargetMode(ability);

  if (mode === 'self') {
    return actor.alive;
  }

  if (mode === 'enemy') {
    return units.some(
      (unit) => unit.side !== actor.side && unit.alive && unit.fieldSlot !== null
    );
  }

  if (mode === 'ally') {
    return units.some(
      (unit) =>
        unit.side === actor.side &&
        unit.alive &&
        unit.fieldSlot !== null &&
        hasNegativeStatus(unit)
    );
  }

  return units.some((unit) => unit.side === actor.side && !unit.alive);
}
