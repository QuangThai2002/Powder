// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the Combat2 roster.
//
// 2.14.4 test roster: install a balanced visual/mechanic showcase BEFORE main.ts
// snapshots COMBAT2_STARTER_ROSTER. This patch only mutates the isolated Combat2
// test objects; it does not write back to the canonical main-game catalog.
//
// Presentation/VFX patches themselves remain installed inside main.ts BEFORE
// new Phaser.Game() so BattleScene.preload/create sees every registered texture.
import '../../../js/data.js';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './main';
