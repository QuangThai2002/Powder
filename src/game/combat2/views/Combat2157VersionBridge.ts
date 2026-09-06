export {};

const VERSION = '2.15.7';

function installCombat2157VersionBridge(): void {
  const root = globalThis as any;
  const previous = root.POWDER_COMBAT2_2156_REGRESSION;
  const marksman = root.POWDER_COMBAT2_MARKSMAN_VFX;

  const checks = {
    previous2156Gate: previous?.pass === true,
    marksmanOwnerPresent: marksman?.version === VERSION && marksman?.finalOwner === true,
    marksmanOnly: marksman?.role === 'marksman' && marksman?.delegatesEveryOtherRole === true,
    spiralBoltForm: marksman?.form === 'axis-locked-spiral-magic-bolt',
    arrowRemoved: marksman?.arrowShapeRemoved === true
      && marksman?.physicalArrowHead === false
      && marksman?.physicalShaft === false
      && marksman?.physicalFletching === false,
    capsuleBody: marksman?.capsuleEnergyBody === true
      && marksman?.roundedTaperedEnergyNose === true,
    axisLocked: marksman?.coreSpineCenteredY0 === true
      && marksman?.allStructuralPartsCenteredY0 === true
      && marksman?.singleSourceTargetRotation === true,
    noRotatingHelixContainer: marksman?.rotatingHelixContainer === false,
    helixAlongBody: marksman?.helixMethod === 'dual-sine-lines-redrawn-by-phase'
      && marksman?.helixRunsAlongBodyAxis === true,
    actualPositionTrail: marksman?.worldTrailUsesActualProjectilePosition === true,
    recentTrailBounded: Number(marksman?.recentTrailPoints?.full) === 17
      && Number(marksman?.recentTrailPoints?.balanced) === 14
      && Number(marksman?.recentTrailPoints?.lite) === 10,
    noFullBeam: marksman?.noFullPathBeam === true,
    noParticles: marksman?.particleEmitters === false,
    finiteOnly: marksman?.repeatingTweenLoops === false && marksman?.finiteTweensOnly === true,
    combatLogicUnchanged: marksman?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Marksman Spiral Magic Bolt',
    scope: 'marksman-only-axis-locked-spiral-bolt',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2157_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.7 Regression PASS]', { marksman, checks });
    else console.error('[Combat2 2.15.7 Regression FAIL - branch only]', { marksman, checks });
  }
}

installCombat2157VersionBridge();
