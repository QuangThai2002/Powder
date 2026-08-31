const VERSION = '2.15.4';
const MELEE_ROLES = ['fighter', 'knight', 'assassin'] as const;

function hasKeys(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function installCombat2154VersionBridge(): void {
  const root = globalThis as any;
  const previous = root.POWDER_COMBAT2_2153_REGRESSION;
  const trajectory = root.POWDER_COMBAT2_TRAJECTORY_TRAIL;
  const melee = root.POWDER_COMBAT2_MELEE_VFX;
  const budget = root.POWDER_COMBAT2_FX_BUDGET;
  const live = root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE;

  const checks = {
    previous2153Gate: previous?.pass === true,
    trajectoryPresent: trajectory?.version === VERSION,
    trajectoryRecentPath: Number(trajectory?.recentPointsFull) === 7
      && Number(trajectory?.recentPointsBalanced) === 6
      && Number(trajectory?.recentPointsLite) === 5,
    trajectoryThreeLayers: Array.isArray(trajectory?.layers)
      && trajectory.layers.join('>') === 'outer-pressure-glow>element-color-line>bright-core-line',
    trajectoryActuallyFollowsTravel: trajectory?.followsActualTravelProgress === true,
    trajectoryShortOnly: trajectory?.shortRecentPathOnly === true
      && trajectory?.fullScreenBeam === false,
    oneGraphicsPerShot: trajectory?.oneGraphicsPerActiveRangedShot === true,
    trajectoryNoParticles: trajectory?.particleEmitters === false,
    trajectoryFinite: trajectory?.finiteTween === true,
    meleePresent: melee?.version === VERSION && hasKeys(melee?.routes, MELEE_ROLES),
    fighterNoProjectile: melee?.fighterProjectile === false
      && melee?.routes?.fighter === 'compressed-fist-impact+radial-shock',
    knightNoProjectile: melee?.knightProjectile === false
      && melee?.routes?.knight === 'single-heavy-triple-edge-slash+afterimage',
    assassinNoProjectile: melee?.assassinProjectile === false
      && melee?.routes?.assassin === 'dual-critical-slash-80pct-knight+intersection-burst',
    assassinScale80: Number(melee?.assassinScaleVsKnight) === 0.8,
    meleeTargetBound: melee?.targetBoundImpact === true,
    meleeElementColor: melee?.elementColorPreserved === true,
    meleeNoParticles: melee?.particleEmitters === false,
    meleeNoLoops: melee?.repeatingTweenLoops === false,
    randomLabInstalled: live?.version === VERSION
      && live?.installed === true
      && live?.randomSingle === true
      && live?.randomSeries === true
      && live?.stoppableRandomSeries === true,
    randomGroups: Array.isArray(live?.randomGroups)
      && ['all', 'melee', 'ranged'].every((group) => live.randomGroups.includes(group)),
    randomSeriesBounded: Number(live?.maxRandomSeriesCount) === 24,
    testPresentationOnly: live?.presentationOnly === true
      && live?.damageApplied === false
      && live?.turnAdvanced === false,
    budgetSafe: budget?.version === VERSION
      && budget?.oneTrajectoryGraphicsPerRangedShot === true
      && budget?.particleEmitters === false
      && budget?.repeatingTweenLoops === false
      && budget?.finiteTweensOnly === true,
    combatLogicUnchanged: trajectory?.combatLogicChanged === false
      && melee?.combatLogicChanged === false
      && budget?.combatLogicChanged === false
      && live?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  if (root.POWDER_COMBAT2_TEST_ROSTER) {
    root.POWDER_COMBAT2_TEST_ROSTER = {
      ...root.POWDER_COMBAT2_TEST_ROSTER,
      version: VERSION,
      mode: 'vfx-lab-random+world-trajectory-trail+melee-polish+13-element-projectiles'
    };
  }

  root.POWDER_COMBAT2_ROLE_ATTACKS = {
    ...(root.POWDER_COMBAT2_ROLE_ATTACKS || {}),
    version: VERSION,
    releaseFamily: 'Combat2',
    meleePolish: melee?.routes ?? {},
    trajectoryTrail: {
      recentPath: true,
      layers: trajectory?.layers ?? [],
      fullScreenBeam: false
    },
    randomVfxLab: true,
    randomMeleeTest: true,
    testDamageApplied: false,
    testTurnAdvanced: false
  };

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Combat VFX Lab + Trajectory Trail + Melee Polish',
    scope: 'random-vfx-lab+real-luminous-recent-path+fighter-knight-assassin-polish',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2154_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.4 Regression PASS]', { trajectory, melee, live, checks });
    else console.error('[Combat2 2.15.4 Regression FAIL - branch only]', { trajectory, melee, live, checks });
  }
}

installCombat2154VersionBridge();
