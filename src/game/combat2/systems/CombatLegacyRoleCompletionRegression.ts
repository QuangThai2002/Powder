import type { CombatAbility } from '../data/CombatPow';
import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import {
  CombatLegacyRoleCompletionEngine,
  LEGACY_ASSASSIN_EXECUTE_MULTIPLIER,
  LEGACY_ROLE_HASTE_PROGRESS,
  legacyRoleMark
} from './CombatLegacyRoleCompletionEngine';
import { CombatState } from './CombatState';
import { TurnManager } from './TurnManager';

export interface CombatLegacyRoleCompletionRegressionReport {
  healerChecked: boolean;
  hasteChecked: boolean;
  marksChecked: boolean;
  roleAiChecked: boolean;
  executeChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Legacy Role Completion Regression] ${message}`);
}

export function runCombatLegacyRoleCompletionRegression(): CombatLegacyRoleCompletionRegressionReport {
  const engine = new CombatLegacyRoleCompletionEngine();
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const turns = new TurnManager(state);
  const actor = state.activeLiving('player')[0];
  const ally = state.activeLiving('player')[1];
  const enemies = state.activeLiving('enemy');
  assert(actor && ally && enemies.length === 3, 'fixture requires actor, ally and 3 enemies');

  const healAbility: CombatAbility = { name: 'Role Heal Fixture', power: 100, type: 'support', target: 'ally' };
  ally.hp = Math.round(ally.pow.maxHp * 0.4);
  const hpBeforeSingle = ally.hp;
  const single = engine.healTarget(actor, ally, healAbility, 0, false);
  assert(single.healed > 0 && ally.hp > hpBeforeSingle, 'single healer mechanic must restore HP');
  ally.hp = Math.round(ally.pow.maxHp * 0.4);
  const team = engine.healTarget(actor, ally, healAbility, 0, true);
  assert(single.requested > team.requested, 'single heal must be stronger than team heal on the same target');

  const speedBefore = ally.speed;
  const haste = engine.applyHaste(ally);
  state.refreshSpeed(ally);
  turns.rescheduleUnit(ally.instanceId);
  const timelineAdvance = turns.advanceUnit(ally.instanceId, haste.timelineProgress);
  assert(haste.timelineProgress === LEGACY_ROLE_HASTE_PROGRESS, 'Haste must preserve legacy +12 meter equivalence');
  assert(ally.speed > speedBefore, 'Haste must grant Speed Up');
  assert(timelineAdvance > 0, 'Haste must advance the target timeline');

  engine.applyMark(enemies[0], 'role_marksman_focus');
  assert(legacyRoleMark(enemies[0]) === 'aim', 'marksman focus must apply Aim Mark');
  engine.tickMarks(enemies[0]);
  assert(legacyRoleMark(enemies[0]) === 'aim', 'Aim Mark must survive the first marked target turn');
  engine.tickMarks(enemies[0]);
  assert(legacyRoleMark(enemies[0]) === null, 'Aim Mark must expire after two marked target turns');

  engine.applyMark(enemies[1], 'role_assassin_mark');
  assert(legacyRoleMark(enemies[1]) === 'hunt', 'assassin mark must apply Hunt Mark');

  const originalRole = actor.pow.role;
  try {
    actor.pow.role = 'Xạ thủ';
    engine.applyMark(enemies[2], 'role_marksman_focus');
    const marksmanTarget = engine.chooseRoleTarget(actor, enemies, actor.pow.abilities.skills[0]);
    assert(marksmanTarget?.instanceId === enemies[2].instanceId, 'marksman AI must prioritize Aim Mark');

    actor.pow.role = 'Sát thủ';
    enemies[0].hp = Math.round(enemies[0].pow.maxHp * 0.9);
    enemies[1].hp = Math.round(enemies[1].pow.maxHp * 0.7);
    enemies[2].hp = Math.round(enemies[2].pow.maxHp * 0.95);
    const assassinTarget = engine.chooseRoleTarget(actor, enemies, actor.pow.abilities.skills[0]);
    assert(assassinTarget?.instanceId === enemies[1].instanceId, 'assassin AI must value Hunt Mark plus injured targets');
  } finally {
    actor.pow.role = originalRole;
  }

  enemies[0].hp = Math.floor(enemies[0].pow.maxHp * 0.34);
  assert(
    engine.executeMultiplier(enemies[0], 'role_assassin_execute') === LEGACY_ASSASSIN_EXECUTE_MULTIPLIER,
    'Execute must gain +30% below 35% HP'
  );
  enemies[0].hp = Math.ceil(enemies[0].pow.maxHp * 0.35);
  assert(engine.executeMultiplier(enemies[0], 'role_assassin_execute') === 1, 'Execute must not trigger at or above 35% HP');

  return {
    healerChecked: true,
    hasteChecked: true,
    marksChecked: true,
    roleAiChecked: true,
    executeChecked: true
  };
}
