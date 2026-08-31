const VERSION = '2.15.3';
const REQUIRED_RANGED_ROLES = ['marksman', 'mage', 'enchanter', 'healer', 'musician'] as const;
const REQUIRED_ELEMENTS = [
  'fire', 'water', 'ice', 'lightning', 'wind', 'leaf', 'poison',
  'earth', 'steel', 'light', 'dark', 'lava', 'storm'
] as const;

function includesAllKeys(value: unknown, required: readonly string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function installCombat2153VersionBridge(): void {
  const root = globalThis as any;
  const clarity = root.POWDER_COMBAT2_PROJECTILE_CLARITY_VFX;
  const trail = root.POWDER_COMBAT2_PROJECTILE_TRAIL_VFX;
  const ranged = root.POWDER_COMBAT2_RANGED_ROLE_VFX;
  const budget = root.POWDER_COMBAT2_FX_BUDGET;
  const previous = root.POWDER_COMBAT2_2152_REGRESSION;
  const liveBridge = root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE;

  const checks = {
    previous2152Gate: previous?.pass === true,
    clarityOwnerPresent: clarity?.version === VERSION,
    fiveRangedRoles: includesAllKeys(ranged?.roles, REQUIRED_RANGED_ROLES),
    allThirteenElementTrails: includesAllKeys(clarity?.elementTrailStyles, REQUIRED_ELEMENTS),
    sharpCore: clarity?.sharpCore === true,
    hardEdgeWake: clarity?.hardEdgeWake === true,
    threeLayerWake: clarity?.threeLayerWake === true,
    brokenWakeCuts: Number(clarity?.brokenWakeCuts) === 3,
    glowSecondary: clarity?.glowIsSecondary === true,
    magicArrowNoFeathers: clarity?.magicArrow?.physicalFeathers === false
      && trail?.noPhysicalArrowFletching === true,
    magicArrowSharpSpine: clarity?.magicArrow?.sharpEnergySpine === true,
    magicArrowNarrowCorkscrew: clarity?.magicArrow?.narrowCorkscrew === true,
    magicArrowEdgeLines: clarity?.magicArrow?.luminousEdgeLines === true,
    impactThreePhase: Array.isArray(clarity?.impactPhases)
      && clarity.impactPhases.join('>') === 'compress>pierce>burst',
    healerOrb80: Number(clarity?.healerScaleVsMage) === 0.8
      && Number(ranged?.healerScaleVsMage) === 0.8,
    speedPreserved: clarity?.travelSpeedPreservedFrom2152 === true,
    oneProjectileContainer: clarity?.singleProjectileContainerPerRangedAction === true
      && budget?.singleProjectileContainer === true,
    noFullPathBeam: clarity?.noFullPathBeam === true,
    noDuplicateGuide: clarity?.noDuplicateGuideProjectile === true,
    noParticles: clarity?.particleEmitters === false && budget?.particleEmitters === false,
    finiteTweensOnly: clarity?.finiteTweensOnly === true
      && clarity?.repeatingTweenLoops === false
      && budget?.finiteTweensOnly === true,
    meleeDelegated: clarity?.delegatesNonRangedToPreviousOwner === true
      && budget?.delegatesMelee === true,
    liveProfessionTestPreserved: Boolean(liveBridge)
      && liveBridge?.installed === true
      && liveBridge?.presentationOnly === true
      && liveBridge?.damageApplied === false
      && liveBridge?.turnAdvanced === false,
    combatLogicUnchanged: clarity?.combatLogicChanged === false
      && trail?.combatLogicChanged === false
      && ranged?.combatLogicChanged === false
      && budget?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  if (root.POWDER_COMBAT2_TEST_ROSTER) {
    root.POWDER_COMBAT2_TEST_ROSTER = {
      ...root.POWDER_COMBAT2_TEST_ROSTER,
      version: VERSION,
      mode: 'profession-live-test+projectile-clarity+13-element-hard-edge-wakes+status-hooks'
    };
  }

  root.POWDER_COMBAT2_ROLE_ATTACKS = {
    ...(root.POWDER_COMBAT2_ROLE_ATTACKS || {}),
    version: VERSION,
    releaseFamily: 'Combat2',
    rangedPolish: ranged?.roles ?? {},
    projectileClarity: {
      sharpCore: true,
      threeLayerWake: true,
      impact: 'compress-pierce-burst'
    },
    healerScaleVsMage: 0.8,
    liveProfessionTest: true
  };

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Projectile Clarity Polish',
    scope: 'five-ranged-professions+13-element-hard-edge-wakes+three-phase-impact',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2153_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.3 Regression PASS]', { clarity, ranged, checks });
    else console.error('[Combat2 2.15.3 Regression FAIL - branch only]', { clarity, ranged, checks });
  }
}

installCombat2153VersionBridge();
