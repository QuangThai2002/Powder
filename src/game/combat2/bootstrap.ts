// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the isolated Combat2 test roster.
//
// 2.15.0 owns the nine-profession roster and localhost VFX Lab UI.
// main.ts installs legacy compatibility owners plus the 2.15.1 ranged owner.
// 2.15.2 owns the first profession live tester and attached element wake layer.
// 2.15.3 sharpens the five ranged projectile bodies and three-phase impacts.
// 2.15.4 adds the first recent-path trajectory and melee polish.
// 2.15.5 installs LAST: explicit projectile ownership for Marksman/Mage/Enchanter/
// Healer/Musician/Tank, stronger Knight slash, support travel, and a direct VFX Lab
// that no longer depends on the selected profession being active in the roster.
import '../../../js/data.js';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './views/Combat2150ProfessionTestRosterPatch';
import './views/Combat2150ProfessionTestSwitcher';
import './vfx/CombatNightDomainFieldBridge';
import './main';

// Preserve previous release gates before newer releases overwrite public VFX metadata.
await import('./views/Combat2150VersionBridge');
await import('./views/Combat2151VersionBridge');

// Combat2 2.15.2 base trail owner + forward-compatible live tester.
await import('./vfx/Combat2152ProjectileTrailVfxPatch');
await import('./views/Combat2152ProfessionLiveTestBridge');
await import('./views/Combat2152VersionBridge');

// Combat2 2.15.3 sharp ranged projectile owner.
await import('./vfx/Combat2153ProjectileClarityVfxPatch');
await import('./views/Combat2153VersionBridge');

// Combat2 2.15.4 trajectory + melee owner.
await import('./vfx/Combat2154TrajectoryAndMeleeVfxPatch');
await import('./views/Combat2154VersionBridge');

// Combat2 2.15.5 FINAL runtime presentation owners.
await import('./vfx/Combat2155ReliableProjectileAndKnightVfxPatch');
await import('./views/Combat2155SupportTravelBridge');
await import('./views/Combat2155DirectVfxLab');
await import('./views/Combat2155VersionBridge');
