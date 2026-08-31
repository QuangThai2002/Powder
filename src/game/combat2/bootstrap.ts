// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the isolated Combat2 test roster.
//
// 2.15.6 changes the test workflow itself: Random is now a PRE-BATTLE roster setup.
// The user randomizes 10 real Pow slots, can edit each slot/image, then explicitly
// starts the battle. Live VFX random spam is retired from the UI.
//
// 2.15.7 is intentionally narrow: Marksman only. It replaces the old arrow-like
// shape with an axis-locked spiral magic bolt. Every other profession delegates.
import '../../../js/data.js';
import './views/Combat2144BalancedVfxTestRosterPatch';
import './views/Combat2150ProfessionTestRosterPatch';
import './views/Combat2156PreBattleRandomizer';
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

// Combat2 2.15.5 baseline runtime presentation owners.
await import('./vfx/Combat2155ReliableProjectileAndKnightVfxPatch');
await import('./views/Combat2155SupportTravelBridge');
await import('./views/Combat2155DirectVfxLab');
await import('./views/Combat2155VersionBridge');

// Combat2 2.15.6 fixes for the three runtime QA cases.
await import('./vfx/Combat2156MarksmanHealerTankFixVfxPatch');
await import('./views/Combat2156VersionBridge');

// Combat2 2.15.7 FINAL owner for Marksman only.
await import('./vfx/Combat2157MarksmanSpiralBoltVfxPatch');
await import('./views/Combat2157VersionBridge');
