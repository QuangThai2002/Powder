import type { CombatUnitState } from '../systems/CombatState';
import { CombatLegacyRoleMechanicEngine, legacyGuardBonus } from '../systems/CombatLegacyRoleMechanicEngine';
import type { CombatAbilitySlot } from '../systems/SkillActionResolver';

interface CatalogAbilityRow { mechanic?: string; }
interface CatalogPowRow {
  id?: string;
  abilities?: {
    basic?: CatalogAbilityRow;
    skills?: CatalogAbilityRow[];
    ultimate?: CatalogAbilityRow;
  };
}
interface PowderCatalogLike { pows?: CatalogPowRow[]; }

interface PatchableScene {
  combatState: { sanitizeRuntimeNumbers: () => void };
  powViews: Map<string, any>;
  performAbility: (actor: CombatUnitState, target: CombatUnitState, slot: CombatAbilitySlot) => Promise<void>;
  refreshViews: () => void;
  showFloatingLabel: (view: any, label: string, color: string) => void;
}

const PATCH_FLAG = '__powderCombat281LegacyRoleInstalled';

function catalogMechanic(actor: CombatUnitState, slot: CombatAbilitySlot): string {
  const catalog = (globalThis as any).POWDER_DATA as PowderCatalogLike | undefined;
  const pow = catalog?.pows?.find((row) => String(row.id || '') === actor.pow.id);
  if (!pow?.abilities) return '';
  const row = slot === 'ultimate'
    ? pow.abilities.ultimate
    : Array.isArray(pow.abilities.skills)
      ? pow.abilities.skills[slot]
      : undefined;
  return String(row?.mechanic || '').trim();
}

function installRoleCastPatch(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const originalPerform = proto.performAbility;
  const engine = new CombatLegacyRoleMechanicEngine();

  proto.performAbility = async function patchedLegacyRoleMechanic(
    this: PatchableScene,
    actor: CombatUnitState,
    target: CombatUnitState,
    slot: CombatAbilitySlot
  ): Promise<void> {
    await originalPerform.call(this, actor, target, slot);
    if (!actor.alive) return;

    const mechanic = catalogMechanic(actor, slot);
    if (!mechanic) return;
    const result = engine.apply(actor, mechanic);
    if (!result.applied) return;

    this.combatState.sanitizeRuntimeNumbers();
    this.refreshViews();
    const actorView = this.powViews.get(actor.instanceId);
    if (result.mechanic === 'role_tank_bulwark') {
      this.showFloatingLabel(actorView, `THÀNH LŨY · DEF ↑ · BẢO HỘ +${result.guardBonusDelta}%`, '#8fd7ff');
    } else if (result.mechanic === 'role_knight_guarded') {
      this.showFloatingLabel(actorView, `KHIÊN KỴ SĨ +${result.shieldGranted}`, '#8edfff');
    }
  };
}

function installGuardChancePatch(CombatGuardEngineClass: any): void {
  const proto = CombatGuardEngineClass.prototype as any;
  const originalGuardChance = proto.guardChance;
  proto.guardChance = function patchedLegacyGuardChance(unit: CombatUnitState): number {
    const base = Number(originalGuardChance.call(this, unit)) || 0;
    return Math.min(1, Math.max(0, base + legacyGuardBonus(unit) / 100));
  };
}

export function installCombat281LegacyRolePatch(BattleSceneClass: any, CombatGuardEngineClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installGuardChancePatch(CombatGuardEngineClass);
  installRoleCastPatch(BattleSceneClass);
}
