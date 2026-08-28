// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// main.ts evaluates PowderDataAdapter and creates the Phaser game.
import '../../../js/data.js';
import { BattleScene } from './scenes/BattleScene';
import { installCombat2122CinematicMotionPatch } from './views/Combat2122CinematicMotionPatch';
import { installCombat2123CleanDomainCinematicPatch } from './views/Combat2123CleanDomainCinematicPatch';
import { PowView } from './views/PowView';
import './main';

// The 2.12.0/2.12.1 procedural elemental layers are intentionally not installed here anymore.
// They remain in source temporarily as reference while real transparent VFX assets are being prepared.
// 2.12.2 uses existing Pow artwork + camera/motion only, so no triangle/circle elemental icon is added.
installCombat2122CinematicMotionPatch(BattleScene, PowView);
// 2.12.3 removes the old procedural Lãnh Địa motif from the visible stage and uses
// camera + atmosphere + typography only until real domain assets are available.
installCombat2123CleanDomainCinematicPatch(BattleScene);
