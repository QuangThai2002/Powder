import type { CombatAbility } from '../data/CombatPow';
import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatGuardEngine } from './CombatGuardEngine';
import {
  CombatMultiTargetEngine,
  selectLegacyCastTargets
} from './CombatMultiTargetEngine';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';

export interface CombatMultiTargetRegressionReport {
  twoEnemyChecked: boolean;
  allEnemyChecked: boolean;
  teamChecked: boolean;
  singleResourceCommitChecked: boolean;
  guardBypassChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 MultiTarget Regression] ${message}`);
}

function deterministic(): number { return 0; }

export function runCombatMultiTargetRegression(): CombatMultiTargetRegressionReport {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const actor = state.activeLiving('player')[0];
  const enemies = state.activeLiving('enemy');
  const allies = state.activeLiving('player');
  assert(actor && enemies.length === 3 && allies.length === 3, 'fixture requires 3v3 active field');

  const twoEnemyAbility: CombatAbility = {
    name: 'Regression Twin Strike',
    power: 100,
    type: 'physical',
    target: 'two-enemies'
  };
  const twoTargets = selectLegacyCastTargets(actor, enemies[1], twoEnemyAbility, state.units);
  assert(twoTargets.length === 2, 'two-enemies must select exactly two living enemies');
  assert(twoTargets[0].instanceId === enemies[1].instanceId, 'requested enemy must stay primary');

  const allEnemyAbility: CombatAbility = {
    name: 'Regression Full Field',
    power: 100,
    type: 'elemental',
    target: 'all-enemies',
    area: true
  };
  const allTargets = selectLegacyCastTargets(actor, enemies[0], allEnemyAbility, state.units);
  assert(allTargets.length === 3, 'all-enemies must select all three active enemies');

  const teamAbility: CombatAbility = {
    name: 'Regression Team Shield',
    power: 1,
    type: 'support',
    status: 'shield',
    target: 'team'
  };
  const teamTargets = selectLegacyCastTargets(actor, actor, teamAbility, state.units);
  assert(teamTargets.length === 3, 'team must select all three active allies');

  const resolver = new SkillActionResolver(deterministic);
  const engine = new CombatMultiTargetEngine();
  actor.ragePoints = 0;
  actor.skillCooldownActionsRemaining = [0, 0];
  const cast = engine.resolveCast(resolver, actor, enemies[0], twoEnemyAbility, 0, state.units, state.round);
  assert(cast.hits.length === 2, 'two-enemy cast must resolve two hit results');
  assert(actor.ragePoints === 2, 'multi-target Skill must gain base Rage only once');

  const ultState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const ultActor = ultState.activeLiving('player')[0];
  const ultEnemies = ultState.activeLiving('enemy');
  assert(ultActor && ultEnemies.length === 3, 'ultimate fixture incomplete');
  ultActor.ragePoints = 6;
  const ultResolver = new SkillActionResolver(deterministic);
  const ultEngine = new CombatMultiTargetEngine();
  const ultAbility: CombatAbility = {
    name: 'Regression Field Ultimate',
    power: 100,
    type: 'ultimate',
    target: 'all-enemies',
    area: true
  };
  const ultCast = ultEngine.resolveCast(ultResolver, ultActor, ultEnemies[0], ultAbility, 'ultimate', ultState.units, ultState.round);
  assert(ultCast.hits.length === 3, 'AoE Ultimate must resolve every active enemy');
  assert(ultActor.ragePoints === 2, 'AoE Ultimate must spend exactly four Rage once');

  const guard = new CombatGuardEngine(deterministic);
  const guardResult = guard.resolve(ultActor, ultEnemies[0], ultAbility, ultEnemies);
  assert(!guardResult.guarded && guardResult.target.instanceId === ultEnemies[0].instanceId, 'AoE must bypass Guard interception');

  return {
    twoEnemyChecked: true,
    allEnemyChecked: true,
    teamChecked: true,
    singleResourceCommitChecked: true,
    guardBypassChecked: true
  };
}
