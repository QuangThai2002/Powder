const VERSION = '2.15.0';
const REQUIRED_ROLES = [
  'marksman', 'mage', 'fighter', 'knight', 'enchanter',
  'healer', 'musician', 'assassin', 'tank'
] as const;

function includesAll(values: unknown, required: readonly string[]): boolean {
  if (!Array.isArray(values)) return false;
  const set = new Set(values.map((value) => String(value)));
  return required.every((value) => set.has(value));
}

function installCombat2150VersionBridge(): void {
  const root = globalThis as any;
  const roster = root.POWDER_COMBAT2_PROFESSION_TEST_ROSTER;
  const legacyRoleAttacks = root.POWDER_COMBAT2_NIGHT_ROLE_ATTACKS;

  if (root.POWDER_COMBAT2_TEST_ROSTER) {
    root.POWDER_COMBAT2_TEST_ROSTER = {
      ...root.POWDER_COMBAT2_TEST_ROSTER,
      version: VERSION,
      mode: 'profession-coverage-9-role+status-hooks+asset-vfx-live'
    };
  }

  if (legacyRoleAttacks) {
    root.POWDER_COMBAT2_ROLE_ATTACKS = {
      ...legacyRoleAttacks,
      version: VERSION,
      releaseFamily: 'Combat2'
    };
  }

  const checks = {
    professionRosterPresent: Boolean(roster),
    nineRoleCoverage: roster?.nineRoleCoverage === true,
    requiredRolesPresent: includesAll(roster?.roles, REQUIRED_ROLES),
    canonicalCatalogOnly: roster?.canonicalCatalogOnly === true,
    mainCatalogUntouched: roster?.mainCatalogMutated === false,
    combatLogicUnchanged: roster?.combatLogicChanged === false,
    roleAttackBridgePresent: Boolean(root.POWDER_COMBAT2_ROLE_ATTACKS)
  };
  const pass = Object.values(checks).every(Boolean);

  root.POWDER_COMBAT2_RELEASE = {
    version: VERSION,
    family: 'Combat2',
    title: 'Profession Test Roster',
    previousUpdateNamingRetired: true,
    branchOnly: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2150_REGRESSION = { version: VERSION, pass, checks };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (pass) console.info('[Combat2 2.15.0 Regression PASS]', { roster, checks });
    else console.error('[Combat2 2.15.0 Regression FAIL - branch only]', { roster, checks });
  }
}

installCombat2150VersionBridge();
