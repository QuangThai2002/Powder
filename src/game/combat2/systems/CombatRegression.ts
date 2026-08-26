import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatState } from './CombatState';
import { TurnManager } from './TurnManager';

export interface CombatRegressionReport {
  turnsSimulated: number;
  promotedReserveSeen: boolean;
  playerActive: number;
  playerReserve: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[Combat2 Regression] ${message}`);
  }
}

/**
 * Lightweight deterministic smoke regression. It never renders and never
 * mutates the real battle scene. DEV bootstrap can run it before Phaser starts
 * so reserve/timeline regressions surface immediately in the console.
 */
export function runCombat2SmokeRegression(): CombatRegressionReport {
  const state = new CombatState(
    COMBAT2_STARTER_ROSTER.player,
    COMBAT2_STARTER_ROSTER.enemy
  );
  const turns = new TurnManager(state);

  assert(
    state.activeLiving('player').length === 3,
    'player must start with exactly three active Pow'
  );
  assert(
    state.reserveLiving('player').length === 2,
    'player must start with exactly two reserve Pow'
  );
  assert(
    state.activeLiving('enemy').length === 3,
    'enemy must start with exactly three active Pow'
  );
  assert(
    state.reserveLiving('enemy').length === 2,
    'enemy must start with exactly two reserve Pow'
  );

  const initialReserveIds = new Set(
    [...state.reserveLiving('player'), ...state.reserveLiving('enemy')].map(
      (unit) => unit.instanceId
    )
  );

  let turnsSimulated = 0;
  for (let index = 0; index < 180; index += 1) {
    const actor = turns.beginNextTurn();
    assert(actor, `scheduler returned null at warm-up turn ${index}`);
    assert(actor.fieldSlot !== null, 'reserve Pow entered the timeline before promotion');
    assert(
      !initialReserveIds.has(actor.instanceId),
      `reserve ${actor.pow.name} acted while still on the bench`
    );
    assert(Number.isFinite(actor.speed) && actor.speed > 0, 'active speed must stay finite');
    turns.completeAction(actor.instanceId);
    turnsSimulated += 1;
  }

  const defeated = state.activeLiving('player')[0];
  const expectedReserve = state.reserveLiving('player')[0];
  assert(defeated && expectedReserve, 'promotion fixture is incomplete');

  defeated.hp = 0;
  defeated.alive = false;
  turns.retireUnit(defeated.instanceId);

  const promotions = state.promoteReserves();
  const promotion = promotions.find(
    (entry) => entry.promotedUnitId === expectedReserve.instanceId
  );

  assert(promotion, 'first living reserve was not promoted after an active KO');
  turns.registerPromoted(expectedReserve.instanceId);

  assert(
    state.activeLiving('player').length === 3,
    'promotion must restore three active player slots while a reserve is available'
  );
  assert(
    state.reserveLiving('player').length === 1,
    'promotion must consume exactly one reserve slot'
  );

  expectedReserve.speed = Number.NaN;
  state.sanitizeRuntimeNumbers();
  assert(
    Number.isFinite(expectedReserve.speed) && expectedReserve.speed > 0,
    'runtime sanitizer failed to recover a non-finite speed value'
  );
  turns.rescheduleUnit(expectedReserve.instanceId);

  let promotedReserveSeen = false;
  for (let index = 0; index < 320; index += 1) {
    const actor = turns.beginNextTurn();
    assert(actor, `scheduler returned null after promotion at turn ${index}`);
    assert(actor.fieldSlot !== null, 'bench unit leaked into timeline after promotion cycle');

    if (actor.instanceId === expectedReserve.instanceId) {
      promotedReserveSeen = true;
    }

    turns.completeAction(actor.instanceId);
    turnsSimulated += 1;
  }

  assert(promotedReserveSeen, 'promoted reserve never received a legal turn');

  return {
    turnsSimulated,
    promotedReserveSeen,
    playerActive: state.activeLiving('player').length,
    playerReserve: state.reserveLiving('player').length
  };
}
