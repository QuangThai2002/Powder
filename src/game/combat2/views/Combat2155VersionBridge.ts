const VERSION = '2.15.5';

function installCombat2155VersionBridge(): void {
  const root = globalThis as any;
  const previous = root.POWDER_COMBAT2_2154_REGRESSION;
  const projectile = root.POWDER_COMBAT2_2155_PROJECTILE;
  const melee = root.POWDER_COMBAT2_MELEE_VFX;
  const support = root.POWDER_COMBAT2_SUPPORT_TRAVEL_VFX;
  const lab = root.POWDER_COMBAT2_VFX_LAB;
  const bridge = root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE;

  const checks = {
    previous2154Gate: previous?.pass === true,
    finalProjectileOwner: projectile?.version === VERSION && projectile?.finalOwner === true,
    allProjectileRoles: Array.isArray(projectile?.projectileRoles)
      && ['marksman', 'mage', 'enchanter', 'healer', 'musician', 'tank'].every((role) => projectile.projectileRoles.includes(role)),
    healerVisible80: Number(projectile?.healerScaleVsMage) === 0.8,
    tankProjectileExplicit: projectile?.tankProjectile === 'heavy-guard-diamond-bolt',
    marksmanClearMagicArrow: String(projectile?.marksmanProjectile || '').includes('large-sharp-magic-arrow')
      && String(projectile?.marksmanProjectile || '').includes('no-feathers'),
    strongTrajectory: Number(projectile?.trajectoryPoints?.full) === 14
      && Number(projectile?.trajectoryPoints?.balanced) === 11
      && Number(projectile?.trajectoryPoints?.lite) === 8,
    trajectoryActualPosition: projectile?.trajectoryUsesActualProjectilePosition === true,
    noFullBeam: projectile?.noFullPathBeam === true,
    noParticles: projectile?.particleEmitters === false,
    noLoops: projectile?.repeatingTweenLoops === false,
    knightStrong: melee?.version === VERSION
      && melee?.knightProjectile === false
      && Number(melee?.knightLengthFull) === 300
      && String(melee?.knight || '').includes('impact-burst'),
    healerTankSupportTravel: support?.version === VERSION
      && Array.isArray(support?.roles)
      && support.roles.includes('healer')
      && support.roles.includes('tank')
      && support?.usesElementTravelNotLunge === true,
    supportLogicSafe: support?.damageChanged === false
      && support?.healingChanged === false
      && support?.shieldChanged === false
      && support?.turnFlowChanged === false,
    directLabReady: lab?.version === VERSION
      && lab?.ready === true
      && lab?.directFinalVfxOwner === true
      && lab?.rosterIndependent === true,
    directLabNineRoles: Array.isArray(lab?.roles) && lab.roles.length === 9,
    directLabRandom: typeof lab?.playRandom === 'function'
      && typeof lab?.playRandomSeries === 'function'
      && typeof lab?.stopRandomSeries === 'function'
      && lab?.randomRoleAndElement === true,
    labSafe: lab?.presentationOnly === true
      && lab?.damageApplied === false
      && lab?.turnAdvanced === false,
    bridgePointsToDirectLab: bridge?.version === VERSION
      && bridge?.directFinalVfxOwner === true
      && bridge?.rosterIndependent === true,
    combatLogicUnchanged: projectile?.combatLogicChanged === false
      && support?.combatLogicChanged === false
      && lab?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  if (root.POWDER_COMBAT2_TEST_ROSTER) {
    root.POWDER_COMBAT2_TEST_ROSTER = {
      ...root.POWDER_COMBAT2_TEST_ROSTER,
      version: VERSION,
      mode: 'direct-vfx-lab+reliable-six-projectile-roles+healer-tank-support-travel+strong-knight'
    };
  }

  root.POWDER_COMBAT2_ROLE_ATTACKS = {
    ...(root.POWDER_COMBAT2_ROLE_ATTACKS || {}),
    version: VERSION,
    releaseFamily: 'Combat2',
    directVfxLab: true,
    rosterIndependentRandom: true,
    tankProjectile: projectile?.tankProjectile,
    healerProjectileScaleVsMage: 0.8,
    marksmanProjectile: projectile?.marksmanProjectile,
    knightPolish: melee?.knight,
    supportTravelRoles: support?.roles ?? []
  };

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'VFX Reliability & Power Pass',
    scope: 'direct-random-lab+reliable-tank-healer-projectiles+clear-marksman+strong-knight+support-travel',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2155_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.5 Regression PASS]', { projectile, melee, support, lab, checks });
    else console.error('[Combat2 2.15.5 Regression FAIL - branch only]', { projectile, melee, support, lab, checks });
  }
}

installCombat2155VersionBridge();
