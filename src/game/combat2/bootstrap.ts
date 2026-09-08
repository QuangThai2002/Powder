// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the isolated Combat2 test roster.
//
// The QA roster and controls stay separate from the runtime combat presentation.
// All final presentation owners load before Phaser.Game starts, so first-action
// behavior is identical to every later action.
import '../../../js/data.js';
import { COMBAT_FEATURE_FLAGS } from './CombatFeatureFlags';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './views/Combat2150ProfessionTestRosterPatch';
import './views/Combat2156PreBattleRandomizer';

if (COMBAT_FEATURE_FLAGS.DOMAIN_EXPANSION_ENABLED) {
  await import('./vfx/CombatNightDomainFieldBridge');
}

// main.ts installs compatibility patches first and the current combat owners last.
// Loading the final bridge here would cache it too early, allowing an older wrapper
// in main.ts to sit above the dedicated melee route.
await import('./main');

await import('./views/Combat2155SupportTravelBridge');
