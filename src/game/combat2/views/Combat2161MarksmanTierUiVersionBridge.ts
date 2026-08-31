const VERSION = '2.16.1';

function installCombat2161MarksmanTierUiVersionBridge(): void {
  const root = globalThis as any;
  const tierUi = root.POWDER_COMBAT2_2161_MARKSMAN_TIER_UI;
  const ui = root.POWDER_COMBAT2_PROFESSION_TEST_UI;
  const projectile = root.POWDER_COMBAT2_NIGHT_PROJECTILE;
  const marksman = root.POWDER_COMBAT2_MARKSMAN_SPIRAL_RAIL;

  const checks = {
    tierApiReady: tierUi?.version === VERSION
      && tierUi?.ready === true
      && tierUi?.api === 'playMarksmanTier',
    exactlyThreeTiers: Array.isArray(tierUi?.tiers)
      && tierUi.tiers.length === 3
      && tierUi.tiers[0] === 'normal'
      && tierUi.tiers[1] === 'skill'
      && tierUi.tiers[2] === 'ultimate',
    tierMapping: tierUi?.mapping?.normal === 'lite'
      && tierUi?.mapping?.skill === 'balanced'
      && tierUi?.mapping?.ultimate === 'full',
    restoresGlobalFxTier: tierUi?.restoresPreviousFxTier === true,
    concurrentMarksmanPreviewBlocked: tierUi?.blocksConcurrentMarksmanPreview === true,
    sameSpiralRailFunction: tierUi?.sameSpiralRailFunction === true,
    uiMountedIfAvailable: !ui || (
      ui?.version === VERSION
      && Number(ui?.marksmanTierButtons) === 3
      && ui?.marksmanTierApi === 'playMarksmanTier'
      && ui?.singleMarksmanButtonRemoved === true
    ),
    uiTierNames: !ui || (
      Array.isArray(ui?.marksmanTiers)
      && ui.marksmanTiers.length === 3
      && ui.marksmanTiers[0] === 'normal'
      && ui.marksmanTiers[1] === 'skill'
      && ui.marksmanTiers[2] === 'ultimate'
    ),
    realCombatStill2160: projectile?.marksmanDirectRuntime === true
      && projectile?.marksmanDirectVersion === '2.16.0'
      && projectile?.marksmanForm === 'spiral-rail-bolt',
    marksmanVisualPreserved: marksman?.version === '2.16.0'
      && marksman?.form === 'spiral-rail-bolt',
    qaOnly: tierUi?.presentationOnly === true,
    combatLogicUnchanged: tierUi?.combatLogicChanged === false
      && projectile?.combatLogicChanged === false
      && marksman?.combatLogicChanged === false
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Marksman 3-Tier QA Buttons',
    scope: 'marksman-only-normal-skill-ultimate-qa-ui',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2161_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.16.1 Regression PASS]', { tierUi, ui, projectile, marksman, checks });
    else console.error('[Combat2 2.16.1 Regression FAIL - branch only]', { tierUi, ui, projectile, marksman, checks });
  }
}

installCombat2161MarksmanTierUiVersionBridge();
