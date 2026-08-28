import { CombatState } from '../systems/CombatState';

const PATCH_FLAG = '__powderCombat2145CanonicalRosterInstalled';
const RAGE_PATCH_FLAG = '__powderCombat2145FourRageInstalled';

function installFourRageTestStart(): void {
  const root = globalThis as any;
  if (root[RAGE_PATCH_FLAG]) return;
  root[RAGE_PATCH_FLAG] = true;

  const proto = CombatState.prototype as any;
  const originalMakeUnits = proto.makeUnits;
  if (typeof originalMakeUnits !== 'function') return;

  proto.makeUnits = function combat2145MakeUnitsWithFourRage(...args: any[]): any[] {
    const units = originalMakeUnits.apply(this, args) as any[];
    for (const unit of units) unit.ragePoints = 4;
    return units;
  };
}

export function installCombat2144BalancedVfxTestRoster(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  // 2.14.5 intentionally stops mutating the canonical Combat2 roster.
  // This restores the proven Pow asset keys/URLs and avoids placeholder portraits.
  installFourRageTestStart();
  root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER = {
    version: '2.14.5-canonical-roster',
    mode: 'canonical-roster',
    initialRage: 4,
    rosterMutation: false
  };
}

installCombat2144BalancedVfxTestRoster();
