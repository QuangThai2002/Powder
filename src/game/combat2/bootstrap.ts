// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the Combat2 roster.
//
// 2.14.4 keeps the existing status/mechanic showcase data and Rage test hooks.
// 2.15.0 then becomes the final Combat2 test-roster owner, replacing the visible
// lineup with canonical coverage for all nine professions. It only mutates isolated
// Combat2 test objects; it never writes back to the main-game POWDER_DATA catalog.
// The local-only switcher provides one-click profession focus without changing combat logic.
//
// Legacy compatibility VFX bridges still install before main.ts so the existing
// presentation patches can wrap them safely. New releases are versioned as Combat2.
//
// Presentation/VFX patches themselves remain installed before new Phaser.Game() so
// BattleScene.preload/create sees every registered texture and final method owner.
import '../../../js/data.js';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './views/Combat2150ProfessionTestRosterPatch';
import './views/Combat2150ProfessionTestSwitcher';
import './vfx/CombatNightDomainFieldBridge';
import './main';
