const VERSION = '2.16.0';

function installCombat2160VersionBridge(): void {
  const root = globalThis as any;
  const marksman = root.POWDER_COMBAT2_MARKSMAN_SPIRAL_RAIL;
  const projectile = root.POWDER_COMBAT2_NIGHT_PROJECTILE;
  const lab = root.POWDER_COMBAT2_2160_MARKSMAN_LAB;
  const ui = root.POWDER_COMBAT2_PROFESSION_TEST_UI;

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
      && marksman?.body?.brightInnerCore === true
      && marksman?.body?.whiteRailSpine === true
      && marksman?.body?.pairedSideRails === true,
    integratedNose: marksman?.body?.integratedRoundedNose === true,
    twoStrandRifling: Number(marksman?.rifling?.strands) === 2
      && Number(marksman?.rifling?.fullTurns) === 2.25,
    riflingDepth: marksman?.rifling?.depthUsesCosine === true
      && marksman?.rifling?.frontBackSeparated === true,
    finiteRifling: marksman?.rifling?.containerRotation === false
      && marksman?.rifling?.phaseRedrawOnly === true
      && marksman?.rifling?.finiteTween === true,
    directRealCombat: projectile?.marksmanDirectRuntime === true
      && projectile?.marksmanDirectVersion === VERSION
      && projectile?.marksmanForm === 'spiral-rail-bolt',
    realCombatEntryPointPreserved: projectile?.runtimeEntryPoint === 'PowView.playAttackLunge'
      && projectile?.attackLungeOwner === true,
    directQaButton: lab?.version === VERSION
      && lab?.ready === true
      && lab?.marksmanButtonDirect === true
      && lab?.marksmanForm === 'spiral-rail-bolt',
    sameFunctionForCombatAndQa: lab?.usesSameFunctionAsRealCombat === true
      && lab?.bypassesGenericOwnerStack === true,
    everyOtherRoleDelegated: lab?.everyOtherRoleDelegated === true,
    boundedTrail: Number(marksman?.trail?.points?.full) === 16
      && Number(marksman?.trail?.points?.balanced) === 13
      && Number(marksman?.trail?.points?.lite) === 9,
    trailReadability: marksman?.trail?.actualProjectilePosition === true
      && marksman?.trail?.threeLayerTaper === true
      && marksman?.trail?.shortRifledSideWisps === true,
    noFullBeam: marksman?.trail?.noFullPathBeam === true,
    premiumImpact: marksman?.impact === 'pierce-lance+finite-rifled-arcs',
    noParticlesOrLoops: marksman?.particleEmitters === false
      && marksman?.repeatingTweenLoops === false,
    visibleQaVersionIfMounted: !ui || (ui?.version === VERSION && ui?.marksmanSpiralRailLabel === true),
    combatLogicUnchanged: marksman?.combatLogicChanged === false
      && projectile?.combatLogicChanged === false
      && lab?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Marksman Spiral Rail Bolt',
    scope: 'marksman-only-direct-spiral-rail-bolt',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2160_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.16.0 Regression PASS]', { marksman, projectile, lab, ui, checks });
    else console.error('[Combat2 2.16.0 Regression FAIL - branch only]', { marksman, projectile, lab, ui, checks });
  }
}

installCombat2160VersionBridge();
