const VERSION = '2.16.0';

function installCombat2160VersionBridge(): void {
  const root = globalThis as any;
  const marksman = root.POWDER_COMBAT2_MARKSMAN_SPIRAL_RAIL;
  const projectile = root.POWDER_COMBAT2_NIGHT_PROJECTILE;

  const checks = {
    marksmanModulePresent: marksman?.version === VERSION
      && marksman?.role === 'marksman'
      && marksman?.directRuntimeOnly === true,
    spiralRailForm: marksman?.form === 'spiral-rail-bolt',
    arrowRemoved: marksman?.body?.physicalArrowHead === false
      && marksman?.body?.physicalShaft === false
      && marksman?.body?.physicalFletching === false,
    taperedRailBody: marksman?.body?.taperedEnergyDart === true
      && marksman?.body?.darkOuterDepthShell === true
      && marksman?.body?.brightInnerCore === true,
    twoStrandRifling: Number(marksman?.rifling?.strands) === 2
      && Number(marksman?.rifling?.fullTurns) === 2.25,
    directRealCombat: projectile?.marksmanDirectRuntime === true
      && projectile?.marksmanDirectVersion === VERSION
      && projectile?.marksmanForm === 'spiral-rail-bolt',
    realCombatEntryPointPreserved: projectile?.runtimeEntryPoint === 'PowView.playAttackLunge'
      && projectile?.attackLungeOwner === true,
    boundedTrail: Number(marksman?.trail?.points?.full) === 16
      && Number(marksman?.trail?.points?.balanced) === 13
      && Number(marksman?.trail?.points?.lite) === 9,
    noFullBeam: marksman?.trail?.noFullPathBeam === true,
    noParticlesOrLoops: marksman?.particleEmitters === false
      && marksman?.repeatingTweenLoops === false,
    combatLogicUnchanged: marksman?.combatLogicChanged === false
      && projectile?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_2160_REGRESSION = { version: VERSION, pass, checks, qaVersionIndependent: true };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.16.0 Real Combat Regression PASS]', { marksman, projectile, checks });
    else console.error('[Combat2 2.16.0 Real Combat Regression FAIL - branch only]', { marksman, projectile, checks });
  }
}

installCombat2160VersionBridge();
