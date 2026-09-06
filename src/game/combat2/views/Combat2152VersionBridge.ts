export {};

const VERSION = '2.15.2';
const REQUIRED_RANGED_ROLES = ['marksman', 'mage', 'enchanter', 'healer', 'musician'] as const;
const REQUIRED_ELEMENTS = [
  'fire', 'water', 'ice', 'lightning', 'wind', 'leaf', 'poison',
  'earth', 'steel', 'light', 'dark', 'lava', 'storm'
] as const;

function includesAllKeys(value: unknown, required: readonly string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function installCombat2152VersionBridge(): void {
  const root = globalThis as any;
  const trail = root.POWDER_COMBAT2_PROJECTILE_TRAIL_VFX;
  const ranged = root.POWDER_COMBAT2_RANGED_ROLE_VFX;
  const budget = root.POWDER_COMBAT2_FX_BUDGET;
  const liveBridge = root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE;
  const previous = root.POWDER_COMBAT2_2151_REGRESSION;

  const checks = {
    previous2151Gate: previous?.pass === true,
    trailOwnerPresent: Boolean(trail),
    trailOwnerVersion: trail?.version === VERSION,
    fiveRangedRoles: Array.isArray(trail?.rangedRoles)
      && REQUIRED_RANGED_ROLES.every((role) => trail.rangedRoles.includes(role)),
    allThirteenElementTrails: includesAllKeys(trail?.trailStyles, REQUIRED_ELEMENTS),
    distinctElementTrail: trail?.distinctElementTrail === true,
    distinctElementImpact: trail?.distinctElementImpactAccent === true,
    magicArrowNoFeathers: trail?.magicArrow?.physicalFeathers === false
      && trail?.noPhysicalArrowFletching === true,
    magicArrowEnergyBody: trail?.magicArrow?.elementalEnergyBody === true,
    magicArrowCorkscrew: trail?.magicArrow?.corkscrewRings === true
      && trail?.magicArrow?.rotatingTipEnergy === true,
    attachedShortWake: trail?.attachedTrail === true && trail?.shortWakeOnly === true,
    healerOrb80: Number(trail?.healerScaleVsMage) === 0.8
      && Number(ranged?.healerScaleVsMage) === 0.8,
    sourceTargetReadable: ranged?.sourceToTargetReadable === true,
    oneProjectileContainer: trail?.singleProjectileContainerPerRangedAction === true
      && budget?.singleProjectileContainer === true,
    noFullPathBeam: trail?.noFullPathBeam === true,
    noDuplicateGuide: trail?.noDuplicateGuideProjectile === true,
    noParticles: trail?.particleEmitters === false && budget?.particleEmitters === false,
    noRepeatingTweenLoops: trail?.repeatingTweenLoops === false
      && budget?.repeatingTweenLoops === false,
    finiteSpinOnly: trail?.finiteSpinTweenOnly === true,
    meleeDelegated: trail?.delegatesNonRangedToPreviousOwner === true
      && budget?.delegatesMelee === true,
    liveTestBridgeInstalled: Boolean(liveBridge)
      && liveBridge?.installed === true
      && liveBridge?.livePlayAttackLunge === true
      && liveBridge?.presentationOnly === true
      && liveBridge?.damageApplied === false
      && liveBridge?.turnAdvanced === false,
    combatLogicUnchanged: trail?.combatLogicChanged === false
      && ranged?.combatLogicChanged === false
      && budget?.combatLogicChanged === false
      && liveBridge?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  if (root.POWDER_COMBAT2_TEST_ROSTER) {
    root.POWDER_COMBAT2_TEST_ROSTER = {
      ...root.POWDER_COMBAT2_TEST_ROSTER,
      version: VERSION,
      mode: 'profession-live-test+magic-projectile-trails+13-element-wakes+status-hooks'
    };
  }

  root.POWDER_COMBAT2_ROLE_ATTACKS = {
    ...(root.POWDER_COMBAT2_ROLE_ATTACKS || {}),
    version: VERSION,
    releaseFamily: 'Combat2',
    rangedPolish: ranged?.roles ?? {},
    magicArrow: trail?.magicArrow ?? {},
    elementTrailStyles: trail?.trailStyles ?? {},
    healerScaleVsMage: 0.8,
    liveProfessionTest: true
  };

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Magic Projectile Trails + Live Profession Test',
    scope: 'profession-test+marksman-magic-arrow+five-ranged-trails+13-element-impact-identity',
    previousUpdateNamingRetired: true,
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2152_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.2 Regression PASS]', { trail, ranged, liveBridge, checks });
    else console.error('[Combat2 2.15.2 Regression FAIL - branch only]', { trail, ranged, liveBridge, checks });
  }
}

installCombat2152VersionBridge();
