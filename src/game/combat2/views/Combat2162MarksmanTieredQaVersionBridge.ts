const VERSION = '2.16.2';

function installCombat2162MarksmanTieredQaVersionBridge(): void {
  const root = globalThis as any;
  const renderer = root.POWDER_COMBAT2_MARKSMAN_TIER_QA;
  const tierUi = root.POWDER_COMBAT2_2162_MARKSMAN_TIER_UI;
  const ui = root.POWDER_COMBAT2_PROFESSION_TEST_UI;
  const projectile = root.POWDER_COMBAT2_NIGHT_PROJECTILE;

  const checks = {
    rendererReady: renderer?.version === VERSION
      && renderer?.role === 'marksman'
      && renderer?.realThreeTierGeometry === true,
    noQualityTierProxy: renderer?.qualityTierProxy === false
      && tierUi?.qualityTierProxy === false,
    exactlyThreeRealTiers: Array.isArray(renderer?.tiers)
      && renderer.tiers.length === 3
      && renderer.tiers[0] === 'normal'
      && renderer.tiers[1] === 'skill'
      && renderer.tiers[2] === 'ultimate',
    normalDistinct: renderer?.normal?.form === 'compact-spiral-rail'
      && Number(renderer?.normal?.length) === 126
      && Number(renderer?.normal?.impactRings) === 1,
    skillDistinct: renderer?.skill?.form === 'piercing-spiral-shot'
      && Number(renderer?.skill?.length) === 176
      && Number(renderer?.skill?.impactRings) === 2,
    ultimateDistinct: renderer?.ultimate?.form === 'rail-breaker'
      && Number(renderer?.ultimate?.length) === 232
      && Number(renderer?.ultimate?.impactRings) === 3
      && renderer?.ultimate?.cameraKick === true,
    tierApiReady: tierUi?.version === VERSION
      && tierUi?.ready === true
      && tierUi?.api === 'playMarksmanTier'
      && tierUi?.realDistinctTierVfx === true,
    tierFormsExposed: tierUi?.normalForm === 'compact-spiral-rail'
      && tierUi?.skillForm === 'piercing-spiral-shot'
      && tierUi?.ultimateForm === 'rail-breaker',
    uiVisibleVersion: !ui || (
      ui?.version === VERSION
      && Number(ui?.marksmanTierButtons) === 3
      && ui?.marksmanRealDistinctTierVfx === true
      && ui?.marksmanQualityTierProxy === false
    ),
    realCombatUntouched: projectile?.marksmanDirectRuntime === true
      && projectile?.marksmanDirectVersion === '2.16.0'
      && projectile?.marksmanForm === 'spiral-rail-bolt',
    boundedPresentation: renderer?.particleEmitters === false
      && renderer?.repeatingTweenLoops === false,
    qaOnlyCombatLogicUnchanged: renderer?.combatLogicChanged === false
      && tierUi?.combatLogicChanged === false
      && projectile?.combatLogicChanged === false
  };

  const pass = Object.values(checks).every(Boolean);
  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Marksman Real Three-Tier QA VFX',
    scope: 'marksman-only-real-normal-skill-ultimate-qa-vfx',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2162_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.16.2 Regression PASS]', { renderer, tierUi, ui, projectile, checks });
    else console.error('[Combat2 2.16.2 Regression FAIL - branch only]', { renderer, tierUi, ui, projectile, checks });
  }
}

installCombat2162MarksmanTieredQaVersionBridge();
