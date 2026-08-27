import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';
import type { CombatAbilitySlot, SkillActionResult, SkillActionResolver } from './SkillActionResolver';

export interface MultiTargetResolvedHit {
  target: CombatUnitState;
  result: SkillActionResult;
}

export interface MultiTargetCastResult {
  targets: CombatUnitState[];
  hits: MultiTargetResolvedHit[];
  primary: SkillActionResult;
}

export function normalizedAbilityTarget(ability: CombatAbility): string {
  return String(ability.target || '').trim().toLowerCase();
}

export function isMultiTargetAbility(ability: CombatAbility): boolean {
  const target = normalizedAbilityTarget(ability);
  return Boolean(
    ability.area ||
    [
      'all', 'all-enemies', 'team', 'allies', 'all-allies',
      'two-enemies', 'two-allies', 'three-allies',
      'self-and-ally', 'self-and-lowest-ally', 'front-row', 'back-row'
    ].includes(target)
  );
}

export function requiresManualPrimaryTarget(ability: CombatAbility): boolean {
  const target = normalizedAbilityTarget(ability);
  return ['two-enemies', 'two-allies', 'self-and-ally'].includes(target);
}

function sortField(units: readonly CombatUnitState[]): CombatUnitState[] {
  return [...units].sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));
}

function sortLowestHp(units: readonly CombatUnitState[]): CombatUnitState[] {
  return [...units].sort((a, b) => {
    const ar = a.hp / Math.max(1, a.pow.maxHp);
    const br = b.hp / Math.max(1, b.pow.maxHp);
    if (Math.abs(ar - br) > 1e-9) return ar - br;
    return (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99);
  });
}

export function selectLegacyCastTargets(
  actor: CombatUnitState,
  requestedTarget: CombatUnitState,
  ability: CombatAbility,
  units: readonly CombatUnitState[]
): CombatUnitState[] {
  const target = normalizedAbilityTarget(ability);
  const allies = sortField(units.filter((unit) => unit.side === actor.side && unit.alive && unit.fieldSlot !== null));
  const enemies = sortField(units.filter((unit) => unit.side !== actor.side && unit.alive && unit.fieldSlot !== null));
  const unique = (items: CombatUnitState[]): CombatUnitState[] => {
    const seen = new Set<string>();
    return items.filter((unit) => {
      if (seen.has(unit.instanceId)) return false;
      seen.add(unit.instanceId);
      return true;
    });
  };

  if (ability.area || target === 'all' || target === 'all-enemies') {
    const support = String(ability.type || '').trim().toLowerCase() === 'support';
    return support ? allies : enemies;
  }
  if (target === 'front-row') {
    const row = enemies.filter((unit) => Number(unit.fieldSlot) < 2);
    return row.length ? row : enemies.slice(0, 2);
  }
  if (target === 'back-row') {
    const row = enemies.filter((unit) => Number(unit.fieldSlot) >= 2);
    return row.length ? row : enemies.slice(-1);
  }
  if (target === 'team' || target === 'allies' || target === 'all-allies' || target === 'three-allies') {
    return allies.slice(0, 3);
  }
  if (target === 'two-enemies') {
    return unique([requestedTarget, ...enemies.filter((unit) => unit.instanceId !== requestedTarget.instanceId)]).slice(0, 2);
  }
  if (target === 'two-allies') {
    const others = sortLowestHp(allies.filter((unit) => unit.instanceId !== requestedTarget.instanceId));
    return unique([requestedTarget, ...others]).slice(0, 2);
  }
  if (target === 'self-and-ally') {
    return unique([actor, requestedTarget]);
  }
  if (target === 'self-and-lowest-ally') {
    const lowest = sortLowestHp(allies.filter((unit) => unit.instanceId !== actor.instanceId))[0];
    return unique(lowest ? [actor, lowest] : [actor]);
  }
  return [requestedTarget];
}

function abilityForHit(ability: CombatAbility, index: number): CombatAbility {
  if (index <= 0) return ability;
  const status = String(ability.status || '').trim();
  if (!status.toLowerCase().startsWith('self:')) return ability;
  return { ...ability, status: undefined };
}

export class CombatMultiTargetEngine {
  resolveCast(
    resolver: SkillActionResolver,
    actor: CombatUnitState,
    requestedTarget: CombatUnitState,
    ability: CombatAbility,
    slot: CombatAbilitySlot,
    units: readonly CombatUnitState[],
    currentRound: number
  ): MultiTargetCastResult {
    const targets = selectLegacyCastTargets(actor, requestedTarget, ability, units);
    if (!targets.length) throw new Error(`[Combat2] ${ability.name} has no legal multi-target recipients.`);

    const initialRage = actor.ragePoints;
    const initialSkillCooldowns: [number, number] = [
      actor.skillCooldownActionsRemaining[0],
      actor.skillCooldownActionsRemaining[1]
    ];
    const initialUltimateCooldown = actor.ultimateCooldownActionsRemaining;

    let committedRage = initialRage;
    let committedSkillCooldowns: [number, number] = [...initialSkillCooldowns];
    let committedUltimateCooldown = initialUltimateCooldown;
    const hits: MultiTargetResolvedHit[] = [];

    targets.forEach((target, index) => {
      if (index > 0) {
        actor.ragePoints = initialRage;
        actor.skillCooldownActionsRemaining = [...initialSkillCooldowns];
        actor.ultimateCooldownActionsRemaining = initialUltimateCooldown;
      }

      const hitAbility = abilityForHit(ability, index);
      const result = slot === 'ultimate'
        ? resolver.resolveUltimate(actor, target, hitAbility, currentRound)
        : resolver.resolve(actor, target, hitAbility, slot, currentRound);
      hits.push({ target, result });

      if (index === 0) {
        committedRage = actor.ragePoints;
        committedSkillCooldowns = [
          actor.skillCooldownActionsRemaining[0],
          actor.skillCooldownActionsRemaining[1]
        ];
        committedUltimateCooldown = actor.ultimateCooldownActionsRemaining;
      }
    });

    actor.ragePoints = committedRage;
    actor.skillCooldownActionsRemaining = committedSkillCooldowns;
    actor.ultimateCooldownActionsRemaining = committedUltimateCooldown;

    return { targets, hits, primary: hits[0].result };
  }
}
