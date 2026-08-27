import type { CombatAbility } from '../data/CombatPow';
import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatGuardEngine } from './CombatGuardEngine';
import { CombatLegacyRoleMechanicEngine, legacyGuardBonus } from './CombatLegacyRoleMechanicEngine';
import { selectLegacyCastTargets } from './CombatMultiTargetEngine';
import { CombatState } from './CombatState';

export interface CombatLegacyRoleRegressionReport {
  tankBulwarkChecked: boolean;
  knightGuardedChecked: boolean;
  guardBonusChecked: boolean;
  rowTargetChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Legacy Role Regression] ${message}`);
}

export function runCombatLegacyRoleRegression(): CombatLegacyRoleRegressionReport {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const actor = state.activeLiving('player')[0];
  const enemies = state.activeLiving('enemy');
  assert(actor && enemies.length === 3, 'fixture requires active actor and 3 enemies');

  const mechanic = new CombatLegacyRoleMechanicEngine();
  const guard = new CombatGuardEngine(() => 0.999999);
  const baseGuard = guard.guardChance(actor);

  const firstBulwark = mechanic.apply(actor, 'role_tank_bulwark');
  assert(firstBulwark.applied, 'Tank Bulwark must apply');
  assert(firstBulwark.guardBonusDelta === 20 && legacyGuardBonus(actor) === 20, 'Tank Bulwark first cast must add +20 Guard');
  assert(actor.defenseMultiplier >= 1.3 && actor.defenseBuffActionsRemaining >= 2, 'Tank Bulwark must grant Defense Up for 2 turns');
  assert(Math.abs(guard.guardChance(actor) - Math.min(1, baseGuard + 0.2)) < 1e-9, 'Guard chance must include +20 percentage points');

  const secondBulwark = mechanic.apply(actor, 'role_tank_bulwark');
  assert(secondBulwark.guardBonusDelta === 10 && legacyGuardBonus(actor) === 30, 'Tank Bulwark Guard bonus must cap at +30');
  assert(Math.abs(guard.guardChance(actor) - Math.min(1, baseGuard + 0.3)) < 1e-9, 'Guard chance must cap using +30 bonus');

  actor.shield = 0;
  const knight = mechanic.apply(actor, 'role_knight_guarded');
  const expectedKnightShield = Math.max(1, Math.round(actor.pow.maxHp * 0.06));
  assert(knight.shieldGranted === expectedKnightShield, 'Knight Guarded must grant 6% Max HP shield');
  for (let i = 0; i < 20; i += 1) mechanic.apply(actor, 'role_knight_guarded');
  assert(actor.shield <= Math.round(actor.pow.maxHp * 0.6), 'Knight Guarded shield must never exceed 60% Max HP');

  const frontAbility: CombatAbility = { name: 'Front Row Fixture', power: 100, type: 'physical', target: 'front-row' };
  const backAbility: CombatAbility = { name: 'Back Row Fixture', power: 100, type: 'physical', target: 'back-row' };
  const front = selectLegacyCastTargets(actor, enemies[0], frontAbility, state.units);
  const back = selectLegacyCastTargets(actor, enemies[0], backAbility, state.units);
  assert(front.length === 2 && front.every((unit) => (unit.fieldSlot ?? 99) < 2), 'front-row must target field slots 0 and 1');
  assert(back.length === 1 && (back[0].fieldSlot ?? -1) >= 2, 'back-row must target field slot 2');

  return {
    tankBulwarkChecked: true,
    knightGuardedChecked: true,
    guardBonusChecked: true,
    rowTargetChecked: true
  };
}
