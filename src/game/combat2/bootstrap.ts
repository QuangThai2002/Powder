// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the isolated Combat2 test roster.
//
// 2.15.0 owns the nine-profession roster and localhost profession switcher.
// main.ts then installs all legacy compatibility owners plus the 2.15.1 ranged owner.
// 2.15.2 owns magic-arrow trails and the live profession tester.
// 2.15.3 deliberately installs LAST for ranged projectiles so its sharper core,
// hard-edge wake and finite compress->pierce->burst impact cannot be overwritten.
// Non-ranged professions continue to delegate to the existing melee owner.
import '../../../js/data.js';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './views/Combat2150ProfessionTestRosterPatch';
import './views/Combat2150ProfessionTestSwitcher';
import './vfx/CombatNightDomainFieldBridge';
import './main';

// Preserve previous release gates before newer releases overwrite public VFX metadata.
await import('./views/Combat2150VersionBridge');
await import('./views/Combat2151VersionBridge');

// Combat2 2.15.2 owners and live tester.
await import('./vfx/Combat2152ProjectileTrailVfxPatch');
await import('./views/Combat2152ProfessionLiveTestBridge');
await import('./views/Combat2152VersionBridge');

// Combat2 2.15.3 FINAL ranged projectile owner.
await import('./vfx/Combat2153ProjectileClarityVfxPatch');
await import('./views/Combat2153VersionBridge');
