const VERSION = '2.15.9';

function installCombat2159VersionBridge(): void {
  const root = globalThis as any;
  const projectile = root.POWDER_COMBAT2_NIGHT_PROJECTILE;
  const lab = root.POWDER_COMBAT2_2159_MARKSMAN_LAB;
  const ui = root.POWDER_COMBAT2_PROFESSION_TEST_UI;
  const uiPending = typeof document !== 'undefined' && document.readyState === 'loading' && !ui;

  const checks = {
    projectileBridgeDirect: projectile?.marksmanDirectRuntime === true
      && projectile?.marksmanDirectVersion === VERSION,
    realCombatEntryPointPreserved: projectile?.runtimeEntryPoint === 'PowView.playAttackLunge'
      && projectile?.attackLungeOwner === true,
    labDirect: lab?.version === VERSION
      && lab?.ready === true
      && lab?.marksmanButtonDirect === true,
    sameFunctionForCombatAndLab: lab?.usesSameFunctionAsRealCombat === true,
    bypassesGenericOwnerStack: lab?.bypassesGenericOwnerStack === true,
    everyOtherRoleDelegated: lab?.everyOtherRoleDelegated === true,
    visibleQaVersionReadyOrPending: uiPending || (
      ui?.version === VERSION && ui?.marksmanDirectRuntimeLabel === true
    ),
    combatLogicUnchanged: projectile?.combatLogicChanged === false
      && lab?.combatLogicChanged === false
      && (uiPending || ui?.combatLogicChanged === false)
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Marksman Direct Runtime VFX Route',
    scope: 'marksman-only-direct-runtime+direct-qa-button',
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2159_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.9 Regression PASS]', { projectile, lab, ui, uiPending, checks });
    else console.error('[Combat2 2.15.9 Regression FAIL - branch only]', { projectile, lab, ui, uiPending, checks });
  }
}

installCombat2159VersionBridge();
