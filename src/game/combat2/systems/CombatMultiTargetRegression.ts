import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import {
  abilityTargetMode,
  expandAbilityTargets
} from './CombatAbilityTargeting';
import { CombatMultiTargetResolver } from './CombatMultiTargetResolver';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 MultiTarget Regression] ${message}`);
}

export function runCombatMultiTargetRegression(): {
  allEnemies: number;
  team: number;
  twoEnemies: number;
  frontRow: number;
  backRow: number;
  oneCostChecked: boolean;
} {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const actor = state.activeLiving('player')[0];
  const ally = state.activeLiving('player')[1];
  const enemy = state.activeLiving('enemy')[0];
  assert(actor && ally && enemy, 'fixture requires active 3v3 units');

  const allAbility = { name: 'All Enemy Fixture', power: 90, type: 'elemental', target: 'all-enemies', area: true };
  const teamAbility = { name: 'Team Fixture', power: 1, type: 'support', status: 'defense up', target: 'team' };
  const twoEnemyAbility = { name: 'Two Enemy Fixture', power: 90, type: 'physical', target: 'two-enemies', area: true };
  const frontAbility = { name: 'Front Fixture', power: 90, type: 'physical', target: 'front-row', area: true };
  const backAbility = { name: 'Back Fixture', power: 90, type: 'physical', target: 'back-row' };
  const allyAbility = { name: 'Ally Fixture', power: 1, type: 'support', status: 'attack up', target: 'ally' };

  assert(abilityTargetMode(allAbility) === 'enemy', 'all-enemies must use enemy target mode');
  assert(abilityTargetMode(teamAbility) === 'self', 'team support must auto-anchor on self');
  assert(abilityTargetMode(allyAbility) === 'ally', 'ally support must keep ally selection');

  const allEnemies = expandAbilityTargets(allAbility, actor, enemy, state.units);
  const team = expandAbilityTargets(teamAbility, actor, actor, state.units);
  const twoEnemies = expandAbilityTargets(twoEnemyAbility, actor, enemy, state.units);
  const frontRow = expandAbilityTargets(frontAbility, actor, enemy, state.units);
  const backRow = expandAbilityTargets(backAbility, actor, enemy, state.units);
  assert(allEnemies.length === 3, 'all-enemies must resolve all three active enemies');
  assert(team.length === 3 && team.every((unit) => unit.side === actor.side), 'team must resolve all active allies');
  assert(twoEnemies.length === 2, 'two-enemies must resolve exactly two active enemies when available');
  assert(frontRow.length === 2, 'front-row must resolve field slots 0 and 1');
  assert(backRow.length === 1 && backRow[0].fieldSlot === 2, 'back-row must resolve the rear field slot');

  const resourceState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const resourceActor = resourceState.activeLiving('player')[0];
  const resourceEnemies = resourceState.activeLiving('enemy');
  assert(resourceActor && resourceEnemies.length >= 2, 'resource fixture requires actor and two targets');
  const skill = new SkillActionResolver(() => 0.5);
  const secondary = new CombatMultiTargetResolver(skill);
  const beforeRage = resourceActor.ragePoints;
  const first = skill.resolve(resourceActor, resourceEnemies[0], twoEnemyAbility, 0, 1);
  const rageAfterPrimary = resourceActor.ragePoints;
  const cooldownAfterPrimary = resourceActor.skillCooldownActionsRemaining[0];
  secondary.resolveSecondary(resourceActor, resourceEnemies[1], twoEnemyAbility, 0, 1);
  assert(first.rawRageGain > 0 && rageAfterPrimary > beforeRage, 'primary target must receive normal action Rage');
  assert(resourceActor.ragePoints === rageAfterPrimary, 'secondary target must not generate extra Rage');
  assert(resourceActor.skillCooldownActionsRemaining[0] === cooldownAfterPrimary, 'secondary target must not reapply cooldown');

  return {
    allEnemies: allEnemies.length,
    team: team.length,
    twoEnemies: twoEnemies.length,
    frontRow: frontRow.length,
    backRow: backRow.length,
    oneCostChecked: true
  };
}
