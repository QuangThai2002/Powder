const VERSION = '2.16.3';

function installCombat2163MarksmanDistinctTierVersionBridge(): void {
  const root = globalThis as any;
  const renderer = root.POWDER_COMBAT2_MARKSMAN_DISTINCT_TIERS;
  const tierUi = root.POWDER_COMBAT2_2163_MARKSMAN_TIER_UI;
  const ui = root.POWDER_COMBAT2_PROFESSION_TEST_UI;
  const projectile = root.POWDER_COMBAT2_NIGHT_PROJECTILE;

  const checks = {
    rendererReady: renderer?.version === VERSION
      && renderer?.role === 'marksman',
    sharedBodyRendererRemoved: renderer?.sharedBodyRenderer === false,
    sharedTopologyRemoved: renderer?.sharedTopology === false,
    noQualityProxy: renderer?.qualityTierProxy === false
      && tierUi?.qualityTierProxy === false,
    normalSilhouette: renderer?.normal?.form === 'compact-spiral-rail'
      && renderer?.normal?.silhouette === 'single-compact-bolt',
    skillSilhouette: renderer?.skill?.form === 'piercing-triple-rail-shot'
      && renderer?.skill?.silhouette === 'center-bolt-plus-two-side-rail-blades',
    ultimateSilhouette: renderer?.ultimate?.form === 'rail-breaker-heavy-slug'
      && renderer?.ultimate?.silhouette === 'heavy-rail-slug-plus-shock-cone-plus-three-compression-rings',
    tierApiReady: tierUi?.version === VERSION
      && tierUi?.ready === true
      && tierUi?.api === 'playMarksmanTier',
    tierUiDistinct: tierUi?.realDistinctTierVfx === true
      && tierUi?.sharedTopology === false
      && tierUi?.sharedBodyRenderer === false,
    uiVisibleVersion: !ui || (
      ui?.version === VERSION
      && Number(ui?.marksmanTierButtons) === 3
      && ui?.marksmanSharedTopology === false
      && ui?.marksmanSharedBodyRenderer === false
    ),
    realCombatUntouched: projectile?.marksmanDirectRuntime === true
      && projectile?.marksmanDirectVersion === '2.16.0'
      && projectile?.marksmanForm === 'spiral-rail-bolt',
    boundedPresentation: renderer?.particleEmitters === false
      && renderer?.repeatingTweenLoops === false,
    combatLogicUnchanged: renderer?.combatLogicChanged === false
      && tierUi?.combatLogicChanged === false
      && projectile?.combatLogicChanged === false
  };

  const pass = Object.values(checks).every(Boolean);
  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Marksman Three Distinct Silhouettes QA',
    scope: 'marksman-only-compact-bolt+triple-rail+heavy-slug-qa',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2163_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.16.3 Regression PASS]', { renderer, tierUi, ui, projectile, checks });
    else console.error('[Combat2 2.16.3 Regression FAIL - branch only]', { renderer, tierUi, ui, projectile, checks });
  }
}

installCombat2163MarksmanDistinctTierVersionBridge();
