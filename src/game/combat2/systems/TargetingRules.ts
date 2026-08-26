import type { CombatAbility } from '../data/CombatPow';

export type AbilityTargetIntent = 'enemy' | 'self';

const SELF_STATUSES = new Set([
  'shield',
  'regeneration',
  'attack up',
  'defense up',
  'ap up'
]);

export function getAbilityTargetIntent(
  ability: CombatAbility
): AbilityTargetIntent {
  const type = String(ability.type || '').trim().toLowerCase();
  const status = String(ability.status || '').trim().toLowerCase();

  if (type === 'support' || SELF_STATUSES.has(status)) {
    return 'self';
  }

  return 'enemy';
}
