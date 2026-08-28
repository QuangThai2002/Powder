// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// main.ts evaluates PowderDataAdapter and creates the Phaser game.
import '../../../js/data.js';
import { BattleScene } from './scenes/BattleScene';
import { installCombat2122CinematicMotionPatch } from './views/Combat2122CinematicMotionPatch';
import { installCombat2123CleanDomainCinematicPatch } from './views/Combat2123CleanDomainCinematicPatch';
import { installCombat2124PowSkillMotionIdentityPatch } from './views/Combat2124PowSkillMotionIdentityPatch';
import { installCombat2132AtlasFallbackPatch } from './views/Combat2132AtlasFallbackPatch';
import { installCombat2133AtlasPresentationPatch } from './views/Combat2133AtlasPresentationPatch';
import { installCombat2133PrimitiveGuardPatch } from './views/Combat2133PrimitiveGuardPatch';
import { CombatPresentationDirector } from './views/CombatPresentationDirector';
import { PowView } from './views/PowView';
import './main';

// Procedural elemental/status presentation stays retired.
// 2.13.3 also retires the old 2.13.0 per-file preview loader because those optional files are
// not part of the bundled runtime and could otherwise create dead/404 requests every battle.
installCombat2122CinematicMotionPatch(BattleScene, PowView);
installCombat2123CleanDomainCinematicPatch(BattleScene);
installCombat2124PowSkillMotionIdentityPatch(BattleScene);
// Bundled transparent atlas owns PowView cast/travel/impact/status fallbacks.
installCombat2132AtlasFallbackPatch(BattleScene, PowView);
// Installed after the atlas override so remaining procedural status geometry cannot resurface.
installCombat2133PrimitiveGuardPatch(PowView);
// Removes the last procedural skill/ultimate presentation shapes while preserving UI plates.
installCombat2133AtlasPresentationPatch(CombatPresentationDirector);
