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
import { installCombat2134SourceImpactIdentityPatch } from './views/Combat2134SourceImpactIdentityPatch';
import { installCombat2140ExactVfxPatch } from './views/Combat2140ExactVfxPatch';
import { CombatPresentationDirector } from './views/CombatPresentationDirector';
import { PowView } from './views/PowView';
import './main';

// Procedural elemental/status presentation stays retired.
// The old 2.13.0 per-file preview loader also stays retired because those optional files are
// not part of the bundled runtime and could otherwise create dead/404 requests every battle.
installCombat2122CinematicMotionPatch(BattleScene, PowView);
installCombat2123CleanDomainCinematicPatch(BattleScene);
installCombat2124PowSkillMotionIdentityPatch(BattleScene);
// Atlas A remains the exact source for Fire / Steel / Water / Leaf / Earth.
installCombat2132AtlasFallbackPatch(BattleScene, PowView);
// Remaining procedural status geometry is never allowed to become primary VFX.
installCombat2133PrimitiveGuardPatch(PowView);
// Atlas presentation remains the correct base presentation for the five Atlas-A elements.
installCombat2133AtlasPresentationPatch(CombatPresentationDirector);
// Preserve stack-safe attacker ownership for target hit flashes.
installCombat2134SourceImpactIdentityPatch(BattleScene, PowView);
// Install last: exact img + img2 assets replace every former family-element fallback and the
// five temporary status stand-ins without changing combat mechanics.
installCombat2140ExactVfxPatch(BattleScene, PowView, CombatPresentationDirector);
