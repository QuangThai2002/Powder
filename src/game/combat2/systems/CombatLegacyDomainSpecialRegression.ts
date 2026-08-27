import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatLegacyDomainEngine } from './CombatLegacyDomainEngine';
import { CombatState } from './CombatState';
import { installCombat291LegacyDomainHardeningPatch } from '../views/Combat291LegacyDomainHardeningPatch';

export interface CombatLegacyDomainSpecialRegressionReport {
  simpleReentryChecked: boolean;
  jackpotChecked: boolean;
  jackpotImmortalChecked: boolean;
  limitlessBurstChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Legacy Domain Special Regression] ${message}`);
}

export function runCombatLegacyDomainSpecialRegression(): CombatLegacyDomainSpecialRegressionReport {
  installCombat291LegacyDomainHardeningPatch();
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const engine = new CombatLegacyDomainEngine(state.units);
  const actor = state.activeLiving('player')[0];
  const enemy = state.activeLiving('enemy')[0];
  assert(actor && enemy, 'fixture requires active player and enemy units');

  assert(engine.configureLoadout('player', { simpleId: 'crimson', simpleLevel: 3, expansionId: 'nine_suns' }), 'fire fixture loadout must configure');
  assert(engine.activateSimple('player').ok, 'first Simple activation must work');
  assert(!engine.activateSimple('player').ok, 'Simple Domain must not stack/re-enter before its activating action finishes');
  engine.afterActorAction(actor);

  const oldRandom = Math.random;
  try {
    Math.random = () => 0;
    assert(engine.configureLoadout('player', { simpleId: 'tide', simpleLevel: 3, expansionId: 'jackpot_bagua' }), 'Jackpot fixture loadout must configure');
    const jackpot = engine.activateExpansion('player', 'pvp');
    assert(jackpot.ok && engine.snapshot('player').expansion?.id === 'jackpot_bagua', '25% Jackpot hit must open Tọa Sát Bát Đồ');
    assert(engine.snapshot('player').expansionUsed === false, 'Jackpot must preserve canonical multi-attempt semantics');
    actor.hp = 0;
    actor.alive = false;
    engine.afterActorAction(actor);
    assert(actor.alive && actor.hp === 1 && actor.ragePoints === 4, 'active Jackpot must block death at 1 HP and refill Rage');
  } finally {
    Math.random = oldRandom;
  }

  assert(engine.configureLoadout('player', { simpleId: 'crimson', simpleLevel: 3, expansionId: 'limitless_void' }), 'Limitless fixture loadout must configure');
  assert(engine.activateExpansion('player', 'pvp').ok, 'Vô Lượng Không Xứ must activate in PvP');
  const hpBefore = enemy.hp;
  engine.setLimitlessAnswers('player', 10, 0);
  assert(enemy.hp < hpBefore, '10 correct Vô Lượng answers must trigger teamwide 50% Max HP burst');

  engine.dispose();
  return {
    simpleReentryChecked: true,
    jackpotChecked: true,
    jackpotImmortalChecked: true,
    limitlessBurstChecked: true
  };
}
