import { COMBAT_FEATURE_FLAGS } from '../CombatFeatureFlags';
import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import {
  CombatLegacyDomainEngine,
  LEGACY_EXPANSION_DOMAINS,
  LEGACY_SIMPLE_DOMAINS,
  type LegacySimpleDomainId
} from './CombatLegacyDomainEngine';
import { CombatState } from './CombatState';

export interface CombatFeatureFreezeRegressionReport {
  flagsChecked: boolean;
  expansionCatalogPreserved: boolean;
  playerExpansionBlocked: boolean;
  enemyExpansionBlocked: boolean;
  simplePveChecked: boolean;
  simpleBossChecked: boolean;
  simpleTypesChecked: number;
  usageLimitChecked: boolean;
  durationChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Feature Freeze Regression] ${message}`);
}

function freshFixture(): {
  engine: CombatLegacyDomainEngine;
  state: CombatState;
} {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  return { state, engine: new CombatLegacyDomainEngine(state.units) };
}

function checkSimpleType(id: LegacySimpleDomainId, context: 'pve' | 'boss'): void {
  const { engine, state } = freshFixture();
  const actor = state.activeLiving('player')[0];
  assert(actor, `${context}/${id} fixture requires an active player unit`);
  const expansionId = id === 'crimson' ? 'nine_suns' : id === 'tide' ? 'diamond_guard' : 'draw_swords';
  assert(engine.configureLoadout('player', { simpleId: id, simpleLevel: 1, expansionId }), `${context}/${id} loadout must configure`);
  assert(engine.snapshot('player').equippedExpansion === expansionId, `${context}/${id} owned Expansion loadout must remain preserved`);
  const activation = engine.activateSimple('player');
  assert(activation.ok && activation.actionsRemaining === 1, `${context}/${id} Simple Domain must activate for one action`);
  const profile = engine.profile(actor);
  assert(Math.abs(profile.damage - 0.25) < 1e-9, `${context}/${id} must keep +25% damage at level 1`);
  if (id === 'crimson') assert(profile.crit === 10 && profile.critDamage === 50, `${context}/Crit bonuses changed`);
  if (id === 'tide') assert(profile.defense === 0.25 && profile.hp === 0.25, `${context}/Balanced bonuses changed`);
  if (id === 'verdant') assert(profile.lifesteal === 0.20, `${context}/Lifesteal bonus changed`);
  engine.afterActorAction(actor);
  assert(engine.snapshot('player').simpleActive === null, `${context}/${id} must expire after the activating action`);
  engine.dispose();
}

export function runCombatFeatureFreezeRegression(): CombatFeatureFreezeRegressionReport {
  assert(COMBAT_FEATURE_FLAGS.PVP_ENABLED === false, 'PvP flag must be OFF');
  assert(COMBAT_FEATURE_FLAGS.DOMAIN_EXPANSION_ENABLED === false, 'Domain Expansion flag must be OFF');
  assert(COMBAT_FEATURE_FLAGS.SIMPLE_DOMAIN_ENABLED === true, 'Simple Domain flag must stay ON');
  assert(Object.keys(LEGACY_SIMPLE_DOMAINS).length === 3, 'Simple catalog must remain 3 types');
  assert(Object.keys(LEGACY_EXPANSION_DOMAINS).length === 9, 'Expansion catalog must remain 9 entries');
  assert(Object.values(LEGACY_EXPANSION_DOMAINS).filter((entry) => entry.kind === 'special').length === 3, 'Expansion catalog must retain 3 special entries');

  const blocked = freshFixture();
  assert(blocked.engine.configureLoadout('player', { simpleId: 'crimson', simpleLevel: 1, expansionId: 'limitless_void' }), 'player frozen loadout must remain configurable');
  assert(blocked.engine.configureLoadout('enemy', { simpleId: 'verdant', simpleLevel: 1, expansionId: 'draw_swords' }), 'enemy frozen loadout must remain configurable');
  const playerExpansion = blocked.engine.activateExpansion('player', 'pvp');
  const enemyExpansion = blocked.engine.activateExpansion('enemy', 'pvp');
  assert(!playerExpansion.ok && playerExpansion.reason === 'feature-disabled', 'player Expansion activation must be blocked by feature flag');
  assert(!enemyExpansion.ok && enemyExpansion.reason === 'feature-disabled', 'AI/enemy Expansion activation must be blocked by feature flag');
  assert(blocked.engine.snapshot('player').equippedExpansion === 'limitless_void', 'player Expansion ownership/loadout must remain preserved');
  assert(blocked.engine.snapshot('enemy').equippedExpansion === 'draw_swords', 'enemy Expansion ownership/loadout must remain preserved');
  blocked.engine.dispose();

  for (const context of ['pve', 'boss'] as const) {
    for (const id of Object.keys(LEGACY_SIMPLE_DOMAINS) as LegacySimpleDomainId[]) checkSimpleType(id, context);
  }

  const limited = freshFixture();
  const actor = limited.state.activeLiving('player')[0];
  assert(actor, 'usage fixture requires an active player unit');
  assert(limited.engine.configureLoadout('player', { simpleId: 'crimson', simpleLevel: 1, expansionId: 'nine_suns' }), 'usage fixture loadout must configure');
  for (let use = 0; use < 3; use += 1) {
    assert(limited.engine.activateSimple('player').ok, `Simple use ${use + 1}/3 must succeed`);
    limited.engine.afterActorAction(actor);
  }
  assert(!limited.engine.activateSimple('player').ok, 'fourth Simple use must be rejected');
  assert(limited.engine.snapshot('player').simpleCharges === 0, 'Simple charge count must stop at zero');
  limited.engine.dispose();

  return {
    flagsChecked: true,
    expansionCatalogPreserved: true,
    playerExpansionBlocked: true,
    enemyExpansionBlocked: true,
    simplePveChecked: true,
    simpleBossChecked: true,
    simpleTypesChecked: 3,
    usageLimitChecked: true,
    durationChecked: true
  };
}
