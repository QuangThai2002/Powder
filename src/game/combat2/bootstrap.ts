// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// main.ts evaluates PowderDataAdapter and creates the Phaser game.
import '../../../js/data.js';
import { BattleScene } from './scenes/BattleScene';
import { installCombat2122CinematicMotionPatch } from './views/Combat2122CinematicMotionPatch';
import { installCombat2123CleanDomainCinematicPatch } from './views/Combat2123CleanDomainCinematicPatch';
import { installCombat2124PowSkillMotionIdentityPatch } from './views/Combat2124PowSkillMotionIdentityPatch';
import { installCombat2130AssetVfxPatch } from './views/Combat2130AssetVfxPatch';
import { installCombat2130PresentationVfxPatch } from './views/Combat2130PresentationVfxPatch';
import { installCombat2132AtlasFallbackPatch } from './views/Combat2132AtlasFallbackPatch';
import { CombatPresentationDirector } from './views/CombatPresentationDirector';
import { PowView } from './views/PowView';
import './main';

// The old procedural elemental/status presentation is intentionally not installed anymore.
// 2.12.x keeps real Pow artwork + camera/motion while 2.13.x moves presentation to transparent assets.
installCombat2122CinematicMotionPatch(BattleScene, PowView);
installCombat2123CleanDomainCinematicPatch(BattleScene);
installCombat2124PowSkillMotionIdentityPatch(BattleScene);
installCombat2130AssetVfxPatch(BattleScene, PowView);
installCombat2130PresentationVfxPatch(CombatPresentationDirector);
// Install last: the bundled atlas owns every remaining PowView fallback so missing preview files
// never force the visible combat back to circles/rectangles/lines.
installCombat2132AtlasFallbackPatch(BattleScene, PowView);
