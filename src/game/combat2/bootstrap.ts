// Keep Combat 2.0 on the exact same canonical Pow catalog as the main game.
// Import order is intentional: data.js populates window.POWDER_DATA before
// PowderDataAdapter builds the isolated Combat2 test roster.
//
// 2.15.6 changes the test workflow itself: Random is a PRE-BATTLE roster setup.
// 2.15.7/2.15.8 remain historical generic Marksman visual owners for compatibility gates.
// 2.16.0 keeps the proven direct runtime ownership model introduced in 2.15.9,
// but replaces the Marksman visual itself with the narrower Spiral Rail Bolt.
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

// Combat2 2.15.6 compatibility fixes.
await import('./vfx/Combat2156MarksmanHealerTankFixVfxPatch');
await import('./views/Combat2156VersionBridge');

// Historical generic Marksman owners retained only for their compatibility gates.
// Real Marksman combat bypasses this stack in CombatNightProjectileBridge.
await import('./vfx/Combat2157MarksmanSpiralBoltVfxPatch');
await import('./views/Combat2157VersionBridge');
await import('./vfx/Combat2158MarksmanPremiumRifledBoltVfxPatch');
await import('./views/Combat2158VersionBridge');

// Combat2 2.16.0: localhost Xạ thủ QA calls the exact same direct function as real combat.
await import('./views/Combat2160MarksmanLabBridge');
await import('./views/Combat2160VersionBridge');
