const VERSION = '2.15.1';
const REQUIRED_RANGED_ROLES = ['marksman', 'mage', 'enchanter', 'healer', 'musician'] as const;

function includesAllKeys(value: unknown, required: readonly string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function installCombat2151VersionBridge(): void {
  const root = globalThis as any;
  const ranged = root.POWDER_COMBAT2_RANGED_ROLE_VFX;
  const budget = root.POWDER_COMBAT2_FX_BUDGET;
  const previousRegression = root.POWDER_COMBAT2_2150_REGRESSION;

  const checks = {
    previous2150RosterGate: previousRegression?.pass === true,
    rangedOwnerPresent: Boolean(ranged),
    rangedOwnerVersion: ranged?.version === VERSION,
    fiveRolesPresent: includesAllKeys(ranged?.roles, REQUIRED_RANGED_ROLES),
    fiveImpactsPresent: includesAllKeys(ranged?.impacts, REQUIRED_RANGED_ROLES),
    marksmanArrow: ranged?.roles?.marksman === 'element-arrow-refined',
    mageOrb: ranged?.roles?.mage === 'layered-energy-orb',
    enchanterOrb: ranged?.roles?.enchanter === 'layered-energy-orb-arcane-diamond',
    healerOrb80: ranged?.roles?.healer === 'soft-energy-orb-80pct-mage'
      && Number(ranged?.healerScaleVsMage) === 0.8,
    musicianNote: ranged?.roles?.musician === 'single-note-with-contained-harmonic-echoes',
    speedPreserved: ranged?.travelSpeedPreservedFrom2150 === true,
    elementColorPreserved: ranged?.elementColorPreserved === true,
    oneProjectile: ranged?.singleProjectilePerRangedAction === true,
    noFullPathBeam: ranged?.noFullPathBeam === true,
    noDuplicateGuide: ranged?.noDuplicateGuideProjectile === true,
    noParticles: ranged?.particleEmitters === false,
    noTweenLoops: ranged?.tweenLoops === false,
    nonRangedDelegated: ranged?.delegatesNonRangedToPreviousOwner === true,
    combatLogicUnchanged: ranged?.combatLogicChanged === false,
    adaptiveBudgetPresent: budget?.version === VERSION
      && budget?.source === 'POWDER_COMBAT2_FX_TIER'
      && budget?.rangedSingleProjectile === true
      && budget?.meleeDelegated === true
  };
  const pass = Object.values(checks).every(Boolean);

  if (root.POWDER_COMBAT2_TEST_ROSTER) {
    root.POWDER_COMBAT2_TEST_ROSTER = {
      ...root.POWDER_COMBAT2_TEST_ROSTER,
      version: VERSION,
      mode: 'profession-coverage-9-role+ranged-vfx-polish+status-hooks+asset-vfx-live'
    };
  }

  root.POWDER_COMBAT2_ROLE_ATTACKS = {
    ...(root.POWDER_COMBAT2_ROLE_ATTACKS || {}),
    version: VERSION,
    releaseFamily: 'Combat2',
    rangedPolish: ranged?.roles ?? {},
    rangedImpacts: ranged?.impacts ?? {},
    healerScaleVsMage: 0.8
  };

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Ranged Profession VFX Polish',
    scope: 'marksman-mage-enchanter-healer-musician',
    previousUpdateNamingRetired: true,
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2151_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.1 Regression PASS]', { ranged, checks });
    else console.error('[Combat2 2.15.1 Regression FAIL - branch only]', { ranged, checks });
  }
}

installCombat2151VersionBridge();
