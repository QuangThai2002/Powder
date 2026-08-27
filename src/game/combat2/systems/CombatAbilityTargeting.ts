import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';

export type CombatAbilityTargetMode = 'enemy' | 'self' | 'ally' | 'deadAlly';
export type CombatAbilityTargetPattern =
  | 'enemy'
  | 'self'
  | 'ally'
  | 'dead-ally'
  | 'all-enemies'
  | 'team'
  | 'two-enemies'
  | 'two-allies'
  | 'three-allies'
  | 'front-row'
  | 'back-row'
  | 'self-and-ally'
  | 'self-and-lowest-ally';

const SELF_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'ap up', 'defense up', 'rage gain',
  'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
]);
const ALLY_TARGETS = new Set([
  'ally', 'two-allies', 'three-allies', 'self-and-ally'
]);
const TEAM_TARGETS = new Set(['team', 'allies']);
const ENEMY_MULTI_TARGETS = new Set(['all', 'all-enemies', 'two-enemies', 'front-row', 'back-row']);

function normalizedStatus(ability: CombatAbility): string {
  const raw = String(ability.status || '').trim().toLowerCase();
  return raw.startsWith('self:') ? raw.slice(5).trim() : raw;
}

export function normalizedAbilityTarget(ability: CombatAbility): string {
  return String(ability.target || '').trim().toLowerCase();
}

export function abilityTargetPattern(ability: CombatAbility): CombatAbilityTargetPattern {
  const target = normalizedAbilityTarget(ability);
  const status = normalizedStatus(ability);
  const rawStatus = String(ability.status || '').trim().toLowerCase();
  const type = String(ability.type || '').trim().toLowerCase();

  if (status === 'revive' || status === 'resurrection') return 'dead-ally';
  if (target === 'self') return 'self';
  if (target === 'all' || target === 'all-enemies') return 'all-enemies';
  if (target === 'team' || target === 'allies') return 'team';
  if (target === 'two-enemies') return 'two-enemies';
  if (target === 'two-allies') return 'two-allies';
  if (target === 'three-allies') return 'three-allies';
  if (target === 'front-row') return 'front-row';
  if (target === 'back-row') return 'back-row';
  if (target === 'self-and-ally') return 'self-and-ally';
  if (target === 'self-and-lowest-ally') return 'self-and-lowest-ally';
  if (target === 'ally') return 'ally';
  if (status === 'cleanse' || status === 'purify') return 'ally';
  if (type === 'support' || (SELF_STATUSES.has(status) && !rawStatus.startsWith('self:'))) return 'self';
  return 'enemy';
}

export function abilityTargetMode(ability: CombatAbility): CombatAbilityTargetMode {
  const pattern = abilityTargetPattern(ability);
  if (pattern === 'dead-ally') return 'deadAlly';
  if (pattern === 'self' || pattern === 'team' || pattern === 'self-and-lowest-ally') return 'self';
  if (pattern === 'ally' || pattern === 'two-allies' || pattern === 'three-allies' || pattern === 'self-and-ally') return 'ally';
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

export function expandAbilityTargets(
  ability: CombatAbility,
  actor: CombatUnitState,
  primary: CombatUnitState,
  units: readonly CombatUnitState[]
): CombatUnitState[] {
  const pattern = abilityTargetPattern(ability);
  const allies = units
    .filter((unit) => unit.side === actor.side && unit.alive && unit.fieldSlot !== null)
    .sort(byFieldSlot);
  const enemies = units
    .filter((unit) => unit.side !== actor.side && unit.alive && unit.fieldSlot !== null)
    .sort(byFieldSlot);
  const unique = (values: CombatUnitState[]): CombatUnitState[] => {
    const seen = new Set<string>();
    return values.filter((unit) => {
      if (!unit || seen.has(unit.instanceId)) return false;
      seen.add(unit.instanceId);
      return true;
    });
  };
  const anchored = (pool: CombatUnitState[], count: number): CombatUnitState[] =>
    unique([primary, ...pool.filter((unit) => unit.instanceId !== primary.instanceId)]).slice(0, count);

  switch (pattern) {
    case 'all-enemies': return enemies;
    case 'team': return allies;
    case 'two-enemies': return anchored(enemies, 2);
    case 'two-allies': return anchored(allies, 2);
    case 'three-allies': return anchored(allies, 3);
    case 'front-row': return enemies.slice(0, Math.min(2, enemies.length));
    case 'back-row': return enemies.length > 0 ? [enemies[enemies.length - 1]] : [];
    case 'self-and-ally': return unique([actor, primary]);
    case 'self-and-lowest-ally': {
      const lowest = allies
        .filter((unit) => unit.instanceId !== actor.instanceId)
        .sort((a, b) => hpRatio(a) - hpRatio(b) || byFieldSlot(a, b))[0];
      return unique([actor, ...(lowest ? [lowest] : [])]);
    }
    case 'self': return [actor];
    case 'ally': return [primary];
    case 'dead-ally': return [primary];
    default: return [primary];
  }
}

export function abilityHasLegalTarget(
  ability: CombatAbility,
  actor: CombatUnitState,
  units: readonly CombatUnitState[]
): boolean {
  const pattern = abilityTargetPattern(ability);
  const activeAllies = units.filter((unit) => unit.side === actor.side && unit.alive && unit.fieldSlot !== null);
  const activeEnemies = units.filter((unit) => unit.side !== actor.side && unit.alive && unit.fieldSlot !== null);
  if (pattern === 'dead-ally') return units.some((unit) => unit.side === actor.side && !unit.alive);
  if (pattern === 'self' || pattern === 'team' || pattern === 'self-and-lowest-ally') return actor.alive;
  if (pattern === 'ally' || pattern === 'two-allies' || pattern === 'three-allies' || pattern === 'self-and-ally') {
    const requireDebuff = abilityRequiresDebuffedAlly(ability);
    return activeAllies.some((unit) => !requireDebuff || hasNegativeStatus(unit));
  }
  return activeEnemies.length > 0;
}

function hpRatio(unit: CombatUnitState): number {
  return unit.pow.maxHp > 0 ? unit.hp / unit.pow.maxHp : 1;
}

function byFieldSlot(a: CombatUnitState, b: CombatUnitState): number {
  return (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99) || a.slot - b.slot;
}
