import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatLegacyDomainEngine } from './CombatLegacyDomainEngine';
import { CombatState } from './CombatState';
import { installCombat295LegacyDomainParityPatch } from '../views/Combat295LegacyDomainParityPatch';

export interface CombatLegacyDomainParityRegressionReport {
  swordsUniqueChecked: boolean;
  poisonSixStackChecked: boolean;
  coldSpeedCleanupChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Legacy Domain Parity Regression] ${message}`);
}

export function runCombatLegacyDomainParityRegression(): CombatLegacyDomainParityRegressionReport {
  installCombat295LegacyDomainParityPatch();
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const engine = new CombatLegacyDomainEngine(state.units);
  const player = state.activeLiving('player')[0];
  const enemy = state.activeLiving('enemy')[0];
  assert(player && enemy, 'fixture requires active units');

  const oldRandom = Math.random;
  try {
    Math.random = () => 0;
    assert(engine.configureLoadout('player', { simpleId: 'verdant', simpleLevel: 3, expansionId: 'draw_swords' }), 'Draw Swords loadout must configure');
    assert(engine.activateExpansion('player', 'pvp').ok, 'Draw Swords must activate in PvP');
    const swordLabels: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const feedback = engine.afterActorAction(player);
      const sword = feedback.find((row) => row.label.includes('KIẾM'));
      if (sword) swordLabels.push(sword.label.split(' · ')[0]);
    }
    assert(swordLabels.length === 5, 'Draw Swords must fire once per each of its five actions');
    assert(new Set(swordLabels).size === 5, 'Draw Swords must use all five swords without repeats');
  } finally {
    Math.random = oldRandom;
  }

  assert(engine.configureLoadout('enemy', { simpleId: 'verdant', simpleLevel: 3, expansionId: 'myriad_poison' }), 'Myriad Poison loadout must configure');
  assert(engine.activateExpansion('enemy', 'pvp').ok, 'Myriad Poison must activate');
  player.poisonStacks = 6;
  player.poisonActionsRemaining = 3;
  state.sanitizeRuntimeNumbers();
  assert(player.poisonStacks === 6, 'active Myriad Poison must preserve six Poison stacks through sanitization');

  assert(engine.configureLoadout('enemy', { simpleId: 'tide', simpleLevel: 3, expansionId: 'frozen_silence' }), 'Frozen Silence loadout must configure');
  assert(engine.activateExpansion('enemy', 'pvp').ok, 'Frozen Silence must activate');
  player.speedBuffActionsRemaining = 2;
  (engine as any).addCold(player, 'enemy');
  const runtime = (engine as any).domainRuntime(player);
  runtime.coldActionsRemaining = 1;
  player.speed = 1;
  (engine as any).tickDomainDebuffs(player);
  assert(Math.abs(player.speed - player.pow.speed * 1.2) < 0.001, 'expired Hàn Khí must restore speed while preserving existing speed buff');

  engine.dispose();
  return {
    swordsUniqueChecked: true,
    poisonSixStackChecked: true,
    coldSpeedCleanupChecked: true
  };
}
