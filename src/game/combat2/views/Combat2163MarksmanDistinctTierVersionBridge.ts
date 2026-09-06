export {};

const VERSION = '2.16.3';

function installCombat2163MarksmanDistinctTierVersionBridge(): void {
  const root = globalThis as any;
  const renderer = root.POWDER_COMBAT2_MARKSMAN_DISTINCT_TIERS;
  const tierUi = root.POWDER_COMBAT2_2163_MARKSMAN_TIER_UI;
  const ui = root.POWDER_COMBAT2_PROFESSION_TEST_UI;
  const projectile = root.POWDER_COMBAT2_NIGHT_PROJECTILE;
  const runtime = root.POWDER_COMBAT2_MARKSMAN_RUNTIME_TEST;

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
    realCombatTierRoute: projectile?.marksmanDirectRuntime === true
      && projectile?.marksmanDirectVersion === '2.16.4'
      && projectile?.marksmanTierContext === true
      && projectile?.marksmanForms?.normal === 'compact-spiral-rail'
      && projectile?.marksmanForms?.skill === 'piercing-triple-rail-shot'
      && projectile?.marksmanForms?.ultimate === 'rail-breaker-heavy-slug',
    runtimeHooksReady: runtime?.version === '2.16.4'
      && runtime?.ready === true
      && runtime?.realCombatHooks?.basic === 'normal'
      && runtime?.realCombatHooks?.skill1 === 'skill'
      && runtime?.realCombatHooks?.skill2 === 'skill'
      && runtime?.realCombatHooks?.ultimate === 'ultimate',
    boundedPresentation: renderer?.particleEmitters === false
      && renderer?.repeatingTweenLoops === false,
    combatLogicUnchanged: renderer?.combatLogicChanged === false
      && tierUi?.combatLogicChanged === false
      && projectile?.combatLogicChanged === false
      && runtime?.combatLogicChanged === false
  };

  const pass = Object.values(checks).every(Boolean);
  root.POWDER_COMBAT2_RELEASE = {
    version: '2.16.4',
    family: 'Combat2',
    title: 'Marksman Runtime Three-Tier Routing',
    scope: 'marksman-real-basic+skill+ultimate-and-direct-qa',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2163_REGRESSION = { version: VERSION, runtimeVersion: '2.16.4', pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.16.4 Marksman Runtime Regression PASS]', { renderer, tierUi, ui, projectile, runtime, checks });
    else console.error('[Combat2 2.16.4 Marksman Runtime Regression FAIL - branch only]', { renderer, tierUi, ui, projectile, runtime, checks });
  }
}

installCombat2163MarksmanDistinctTierVersionBridge();
