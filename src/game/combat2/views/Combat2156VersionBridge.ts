const VERSION = '2.15.6';

function installCombat2156VersionBridge(): void {
  const root = globalThis as any;
  const setup = root.POWDER_COMBAT2_PREBATTLE_RANDOMIZER;
  const fix = root.POWDER_COMBAT2_2156_PROJECTILE_FIX;
  const quickUi = root.POWDER_COMBAT2_PROFESSION_TEST_UI;
  const support = root.POWDER_COMBAT2_SUPPORT_TRAVEL_VFX;

  const checks = {
    preBattleSetupPresent: setup?.version === VERSION,
    randomDoesNotAutoPlay: setup?.randomDoesNotAutoPlay === true,
    editableAfterRandom: setup?.editableAfterRandom === true,
    explicitStartRequired: setup?.startsOnlyAfterExplicitButton === true,
    realPowImages: setup?.realPowImages === true,
    tenUniqueSlots: Number(setup?.slotCount) === 10 && setup?.uniqueSlots === true,
    marksmanFixPresent: fix?.version === VERSION,
    marksmanAxisLocked: fix?.marksman?.axisLockedSourceToTarget === true,
    marksmanHelixGroupRotationRemoved: fix?.marksman?.helixContainerRotationRemoved === true,
    marksmanNoPhysicalFeathers: fix?.marksman?.physicalFeathers === false,
    healerProjectileVisible: fix?.healer?.projectileVisible === true
      && fix?.healer?.strongWorldTrail === true
      && Number(fix?.healer?.mageScale) === 0.8,
    tankProjectileVisible: fix?.tank?.projectileVisible === true
      && fix?.tank?.form === 'aegis-energy-shield-ram'
      && fix?.tank?.heavyWorldTrail === true
      && fix?.tank?.shieldImpact === true,
    strongerRecentTrail: Number(fix?.trajectoryPoints?.full) === 19
      && Number(fix?.trajectoryPoints?.balanced) === 15
      && Number(fix?.trajectoryPoints?.lite) === 10,
    noFullScreenBeam: fix?.noFullPathBeam === true,
    noParticleEmitters: fix?.particleEmitters === false,
    noRepeatingTweenLoops: fix?.repeatingTweenLoops === false,
    liveRandomUiRetired: quickUi?.version === VERSION
      && quickUi?.randomButtonsRemoved === true
      && quickUi?.preBattleRandomizerOwnsRandom === true,
    supportTravelPreserved: support?.version === '2.15.5'
      && Array.isArray(support?.roles)
      && support.roles.includes('healer')
      && support.roles.includes('tank'),
    combatLogicUnchanged: setup?.combatLogicChanged === false
      && fix?.combatLogicChanged === false
      && quickUi?.combatLogicChanged === false
      && support?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Pre-Battle Randomizer + Marksman Alignment + Tank/Healer Readability',
    scope: 'random-edit-start-workflow+marksman-axis-fix+healer-trail+tank-shield-projectile',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2156_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.6 Regression PASS]', { setup, fix, checks });
    else console.error('[Combat2 2.15.6 Regression FAIL - branch only]', { setup, fix, quickUi, support, checks });
  }
}

installCombat2156VersionBridge();
