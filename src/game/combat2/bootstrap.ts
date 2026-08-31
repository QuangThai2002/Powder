// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the isolated Combat2 test roster.
//
// 2.15.0 owns the nine-profession roster and localhost VFX Lab UI.
// main.ts installs legacy compatibility owners plus the 2.15.1 ranged owner.
// 2.15.2 owns the first profession live tester and attached element wake layer.
// 2.15.3 sharpens the five ranged projectile bodies and three-phase impacts.
// 2.15.4 installs LAST: it adds a real recent-path luminous trajectory behind ranged
// projectiles and becomes the final melee owner for Fighter/Knight/Assassin.
import '../../../js/data.js';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './views/Combat2150ProfessionTestRosterPatch';
import './views/Combat2150ProfessionTestSwitcher';
import './vfx/CombatNightDomainFieldBridge';
import './main';

// Preserve previous release gates before newer releases overwrite public VFX metadata.
await import('./views/Combat2150VersionBridge');
await import('./views/Combat2151VersionBridge');

// Combat2 2.15.2 base trail owner + current forward-compatible VFX Lab bridge.
await import('./vfx/Combat2152ProjectileTrailVfxPatch');
await import('./views/Combat2152ProfessionLiveTestBridge');
await import('./views/Combat2152VersionBridge');

// Combat2 2.15.3 sharp ranged projectile owner.
await import('./vfx/Combat2153ProjectileClarityVfxPatch');
await import('./views/Combat2153VersionBridge');

// Combat2 2.15.4 FINAL presentation owner.
await import('./vfx/Combat2154TrajectoryAndMeleeVfxPatch');
await import('./views/Combat2154VersionBridge');
