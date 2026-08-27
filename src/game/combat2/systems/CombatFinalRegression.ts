import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatState } from './CombatState';
import { TurnManager } from './TurnManager';

export interface CombatFinalRegressionReport {
  sequentialKoChecked: boolean;
  reserveChainChecked: boolean;
  battleEndChecked: boolean;
  freshStateIsolationChecked: boolean;
  runtimeSanitizeChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Final Regression] ${message}`);
}

export function runCombatFinalRegression(): CombatFinalRegressionReport {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const turns = new TurnManager(state);
  for (const unit of state.units) {
    if (String(unit.pow.passive?.id || '').toLowerCase() === 'revive_ally_once') unit.passiveUsed = true;
  }

  let promotionsSeen = 0;
  let defeatedCount = 0;
  while (!state.isBattleOver() && defeatedCount < 8) {
    const target = state.activeLiving('enemy').sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99))[0];
    assert(target, 'enemy active target missing before battle end');
    target.hp = 0;
    target.alive = false;
    turns.retireUnit(target.instanceId);
    defeatedCount += 1;

    const promotions = state.promoteReserves();
    for (const promotion of promotions) {
      turns.registerPromoted(promotion.promotedUnitId);
      if (promotion.side === 'enemy') promotionsSeen += 1;
    }
  }

  assert(defeatedCount === COMBAT2_STARTER_ROSTER.enemy.length, 'all five enemy Pow must be defeated exactly once');
  assert(promotionsSeen === 2, 'enemy 3+2 formation must promote exactly two reserves');
  assert(state.isBattleOver(), 'battle must finish after final reserve is defeated');
  assert(state.living('enemy').length === 0, 'no enemy may remain alive after battle finish');
  assert(state.activeLiving('enemy').length === 0 && state.reserveLiving('enemy').length === 0, 'enemy field and reserve must both be empty');

  const fresh = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  assert(!fresh.isBattleOver(), 'a new battle must not inherit finished state');
  assert(fresh.activeLiving('player').length === 3 && fresh.reserveLiving('player').length === 2, 'fresh player formation must restore 3+2');
  assert(fresh.activeLiving('enemy').length === 3 && fresh.reserveLiving('enemy').length === 2, 'fresh enemy formation must restore 3+2');

  const fixture = fresh.activeLiving('player')[0];
  assert(fixture, 'sanitize fixture missing');
  fixture.hp = Number.NaN;
  fixture.shield = Number.POSITIVE_INFINITY;
  fixture.ragePoints = Number.NaN;
  fixture.speed = Number.NEGATIVE_INFINITY;
  fresh.sanitizeRuntimeNumbers();
  assert(Number.isFinite(fixture.hp) && fixture.hp >= 0 && fixture.hp <= fixture.pow.maxHp, 'HP sanitize failed');
  assert(Number.isFinite(fixture.shield) && fixture.shield >= 0 && fixture.shield <= fixture.pow.maxHp * 0.8, 'Shield sanitize failed');
  assert(Number.isFinite(fixture.ragePoints) && fixture.ragePoints >= 0 && fixture.ragePoints <= 8, 'Rage sanitize failed');
  assert(Number.isFinite(fixture.speed) && fixture.speed >= 1, 'Speed sanitize failed');

  return {
    sequentialKoChecked: true,
    reserveChainChecked: true,
    battleEndChecked: true,
    freshStateIsolationChecked: true,
    runtimeSanitizeChecked: true
  };
}
