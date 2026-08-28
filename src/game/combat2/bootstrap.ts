// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// main.ts evaluates PowderDataAdapter and installs the full Combat2 patch stack.
//
// 2.14.2: every presentation/VFX patch is installed inside main.ts BEFORE
// new Phaser.Game() is created. Do not install VFX patches here after importing
// main.ts: Phaser may already have executed BattleScene.preload/create by then,
// which leaves the img + img2 textures unavailable for the first battle.
import '../../../js/data.js';
import './main';
