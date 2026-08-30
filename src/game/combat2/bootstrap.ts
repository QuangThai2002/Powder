// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the isolated Combat2 test roster.
//
// 2.15.0 owns the nine-profession roster and localhost profession switcher.
// main.ts then installs all legacy compatibility owners plus the 2.15.1 ranged owner.
// After main.ts completes, 2.15.2 deliberately becomes the FINAL ranged projectile owner.
// This guarantees the magic-arrow/trail work cannot be overwritten by 2.15.1.
//
// The live profession tester attaches to the already-running BattleScene when needed,
// so TEST NGHỀ can replay presentation VFX without damage or turn changes.
import '../../../js/data.js';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './views/Combat2150ProfessionTestRosterPatch';
import './views/Combat2150ProfessionTestSwitcher';
import './vfx/CombatNightDomainFieldBridge';
import './main';

// Preserve the previous release gates before 2.15.2 overwrites the public VFX metadata.
await import('./views/Combat2150VersionBridge');
await import('./views/Combat2151VersionBridge');

// Combat2 2.15.2 final owners.
await import('./vfx/Combat2152ProjectileTrailVfxPatch');
await import('./views/Combat2152ProfessionLiveTestBridge');
await import('./views/Combat2152VersionBridge');
