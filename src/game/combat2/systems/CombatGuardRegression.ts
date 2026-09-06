import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatGuardEngine } from './CombatGuardEngine';
import { CombatState } from './CombatState';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Guard Regression] ${message}`);
}

export interface CombatGuardRegressionReport {
  canonicalChancesChecked: boolean;
  interceptionChecked: boolean;
  actionLockChecked: boolean;
  bypassChecked: boolean;
}

export function runCombatGuardRegression(): CombatGuardRegressionReport {
  const player = COMBAT2_STARTER_ROSTER.player.map((pow, index) => ({
    ...pow,
    // Keep this fixture to a single possible interceptor so action-lock checks
    // cannot pass through a second guard-capable roster member.
    role: index === 0 ? 'tank' : index === 1 ? 'marksman' : 'mage'
  }));
  const enemy = COMBAT2_STARTER_ROSTER.enemy.map((pow, index) => ({
    ...pow,
    role: index === 0 ? 'assassin' : pow.role
  }));
  const state = new CombatState(player, enemy);
  const protector = state.activeLiving('player')[0];
  const requested = state.activeLiving('player')[1];
  const attacker = state.activeLiving('enemy')[0];
  assert(protector && requested && attacker, 'fixture requires three active units');

  const engine = new CombatGuardEngine(() => 0);
  assert(Math.abs(engine.guardChance(protector) - 0.70) < 1e-9, 'Tank guard chance must remain canonical 70%');

  const basic = { ...attacker.pow.abilities.basic, type: 'physical', area: false };
  const intercepted = engine.resolve(attacker, requested, basic, state.activeLiving('player'));
  assert(intercepted.guarded, 'eligible single-target hit should be intercepted with deterministic roll 0');
  assert(intercepted.target.instanceId === protector.instanceId, 'guard must redirect to the protector');
  assert(Math.abs(intercepted.chance - 0.70) < 1e-9, 'intercept chance must use the canonical role value');

  protector.controlStatus = 'stun';
  protector.controlActionsRemaining = 1;
  const locked = engine.resolve(attacker, requested, basic, state.activeLiving('player'));
  assert(!locked.guarded && locked.target.instanceId === requested.instanceId, 'Stun/Freeze action lock must prevent guarding');

  protector.controlStatus = null;
  protector.controlActionsRemaining = 0;
  protector.silenceActionsRemaining = 1;
  protector.paralysisActionsRemaining = 2;
  protector.freezeStage = 2;
  protector.freezeStageActionsRemaining = 2;
  const softControlled = engine.resolve(attacker, requested, basic, state.activeLiving('player'));
  assert(softControlled.guarded, 'Silence/Paralysis/Chill/Frostbite must not disable passive interception');

  const area = engine.resolve(attacker, requested, { ...basic, area: true }, state.activeLiving('player'));
  assert(!area.guarded, 'AoE must bypass Guard interception');
  const bypass = engine.resolve(attacker, requested, { ...basic, bypassGuard: true }, state.activeLiving('player'));
  assert(!bypass.guarded, 'bypassGuard must bypass interception');
  const pierce = engine.resolve(attacker, requested, { ...basic, pierceGuard: true }, state.activeLiving('player'));
  assert(!pierce.guarded, 'pierceGuard must bypass interception');
  const assassinFront = engine.resolve(attacker, requested, { ...basic, bypassFront: true }, state.activeLiving('player'));
  assert(!assassinFront.guarded, 'assassin bypassFront skill must bypass interception');

  return {
    canonicalChancesChecked: true,
    interceptionChecked: true,
    actionLockChecked: true,
    bypassChecked: true
  };
}
