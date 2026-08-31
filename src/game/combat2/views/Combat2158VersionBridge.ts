const VERSION = '2.15.8';

function installCombat2158VersionBridge(): void {
  const root = globalThis as any;
  const previous = root.POWDER_COMBAT2_2157_REGRESSION;
  const marksman = root.POWDER_COMBAT2_MARKSMAN_VFX;

  const checks = {
    previous2157Gate: previous?.pass === true,
    marksmanOwnerPresent: marksman?.version === VERSION && marksman?.finalOwner === true,
    marksmanOnly: marksman?.role === 'marksman' && marksman?.delegatesEveryOtherRole === true,
    premiumRifledForm: marksman?.form === 'premium-rifled-spiral-energy-bolt',
    arrowRemoved: marksman?.arrowShapeRemoved === true
      && marksman?.physicalArrowHead === false
      && marksman?.physicalShaft === false
      && marksman?.physicalFletching === false,
    layeredBloom: marksman?.premiumBody?.layeredBloom === true
      && marksman?.premiumBody?.outerGlowLayer === true
      && marksman?.premiumBody?.innerGlowLayer === true,
    bodyDepth: marksman?.premiumBody?.darkContrastShell === true
      && marksman?.premiumBody?.whiteCoreSpine === true
      && marksman?.premiumBody?.pairedSpecularDepth === true,
    compressionRibs: marksman?.premiumBody?.energyCompressionRibs === true,
    roundedEnergyNose: marksman?.premiumBody?.roundedEnergyNose === true,
    frontBackHelix: marksman?.rifling?.method === 'front-back-dual-helix-with-local-energy-nodes'
      && marksman?.rifling?.frontBackDepthSeparation === true,
    noRotatingHelixContainer: marksman?.rifling?.helixContainerRotation === false
      && marksman?.rifling?.phaseRedrawOnly === true,
    finiteRifling: marksman?.rifling?.finitePhaseTween === true,
    actualPositionTrail: marksman?.trajectory?.usesActualProjectilePosition === true,
    boundedTrail: Number(marksman?.trajectory?.points?.full) === 18
      && Number(marksman?.trajectory?.points?.balanced) === 15
      && Number(marksman?.trajectory?.points?.lite) === 10,
    lifetimeFade: marksman?.trajectory?.cubicLifetimeFade === true,
    threeLayerTrail: marksman?.trajectory?.threeLayerCore === true,
    fullSideWisps: marksman?.trajectory?.twinRecentSideWispsFullOnly === true,
    noFullBeam: marksman?.trajectory?.noFullPathBeam === true,
    premiumImpact: marksman?.impact === 'rifled-pierce-flash+rotating-drill-arcs+finite-rings',
    additiveGlow: marksman?.additiveGlowLayers === true,
    adaptiveDetail: marksman?.adaptiveDetailTier === true,
    noParticles: marksman?.particleEmitters === false,
    finiteOnly: marksman?.repeatingTweenLoops === false && marksman?.finiteTweensOnly === true,
    conceptualReferenceOnly: marksman?.inspirationMethod === 'conceptual-reference-only-no-source-code-copy',
    combatLogicUnchanged: marksman?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Marksman Premium Rifled Energy Bolt',
    scope: 'marksman-only-premium-bloom-rifling-trail-impact',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2158_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.8 Regression PASS]', { marksman, checks });
    else console.error('[Combat2 2.15.8 Regression FAIL - branch only]', { marksman, checks });
  }
}

installCombat2158VersionBridge();
