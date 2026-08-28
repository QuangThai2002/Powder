// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// main.ts evaluates PowderDataAdapter and creates the Phaser game.
import '../../../js/data.js';
import { BattleScene } from './scenes/BattleScene';
import { installCombat2120VisualActionSystemPatch } from './views/Combat2120VisualActionSystemPatch';
import { PowView } from './views/PowView';
import './main';

// Install after main.ts has applied the legacy/current presentation stack so this layer wraps
// the final action methods instead of being overwritten by older compatibility patches.
installCombat2120VisualActionSystemPatch(BattleScene, PowView);
