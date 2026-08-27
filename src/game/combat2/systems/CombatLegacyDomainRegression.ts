import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import {
  CombatLegacyDomainEngine,
  LEGACY_EXPANSION_DOMAINS,
  LEGACY_SIMPLE_DOMAINS
} from './CombatLegacyDomainEngine';
import { CombatState } from './CombatState';

export interface CombatLegacyDomainRegressionReport {
  noDefaultGrantChecked: boolean;
  simpleChargesChecked: boolean;
  branchGateChecked: boolean;
  pvpGateChecked: boolean;
  canonicalCatalogChecked: boolean;
  statProfileChecked: boolean;
  lifestealChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Legacy Domain Regression] ${message}`);
}

export function runCombatLegacyDomainRegression(): CombatLegacyDomainRegressionReport {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const engine = new CombatLegacyDomainEngine(state.units);
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'fixture requires active player and enemy units');

  const empty = engine.snapshot('player');
  assert(empty.equippedSimple === null && empty.equippedExpansion === null, 'Domains must never be granted by default');
  assert(empty.simpleCharges === 3 && empty.expansionUsed === false, 'fresh side must preserve 3 Simple charges and unused Expansion');

  assert(Object.keys(LEGACY_SIMPLE_DOMAINS).length === 3, 'canonical Simple Domain count must remain exactly 3');
  assert(Object.keys(LEGACY_EXPANSION_DOMAINS).length === 9, 'canonical Expansion Domain count must remain exactly 9');
  assert(Object.values(LEGACY_EXPANSION_DOMAINS).filter((row) => row.kind === 'normal').length === 6, 'Expansion catalog must keep 6 normal Domains');
  assert(Object.values(LEGACY_EXPANSION_DOMAINS).filter((row) => row.kind === 'special').length === 3, 'Expansion catalog must keep 3 special Domains');

  assert(!engine.configureLoadout('player', { simpleId: 'crimson', simpleLevel: 3, expansionId: 'diamond_guard' }), 'mismatched branches must be rejected');
  assert(engine.configureLoadout('player', { simpleId: 'crimson', simpleLevel: 3, expansionId: 'nine_suns' }), 'matching branch loadout must be accepted');
  assert(!engine.activateExpansion('player', 'pve').ok, 'Bành Trướng must remain PvP-only');

  const first = engine.activateSimple('player');
  assert(first.ok && first.chargesRemaining === 2, 'first Simple activation must consume exactly one charge');
  const profile = engine.profile(actor);
  assert(Math.abs(profile.damage - 0.45) < 1e-9, 'Cao cấp Xích Viêm must restore +45% damage');
  assert(profile.crit === 20 && profile.critDamage === 100, 'Cao cấp Xích Viêm must restore +20 crit and +100 crit damage');
  engine.afterActorAction(actor);
  assert(engine.profile(actor).damage === 0, 'Simple Domain must expire after the activating Pow action');

  assert(engine.activateSimple('player').ok, 'second Simple charge must be usable after the first Domain expires');
  engine.afterActorAction(actor);
  assert(engine.activateSimple('player').ok, 'third Simple charge must be usable after the second Domain expires');
  engine.afterActorAction(actor);
  assert(!engine.activateSimple('player').ok, 'Simple Domain must stop at three activations per battle');

  assert(engine.configureLoadout('player', { simpleId: 'verdant', simpleLevel: 3, expansionId: 'draw_swords' }), 'leaf loadout must be accepted');
  assert(engine.activateSimple('player').ok, 'Verdant Simple must activate');
  actor.hp = Math.max(1, Math.round(actor.pow.maxHp * 0.5));
  const beforeHeal = actor.hp;
  engine.afterDamage(actor, target, 100, 0, 1);
  assert(actor.hp > beforeHeal, 'Verdant Domain must restore lifesteal in real runtime state');

  engine.dispose();
  return {
    noDefaultGrantChecked: true,
    simpleChargesChecked: true,
    branchGateChecked: true,
    pvpGateChecked: true,
    canonicalCatalogChecked: true,
    statProfileChecked: true,
    lifestealChecked: true
  };
}
