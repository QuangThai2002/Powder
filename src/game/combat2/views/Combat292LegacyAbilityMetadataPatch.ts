import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';

interface CatalogAbilityLike {
  name?: string;
  hits?: number;
  mechanic?: string;
  description?: string;
  rulesText?: string;
}

interface CatalogPowLike {
  id?: string;
  abilities?: {
    basic?: CatalogAbilityLike;
    skills?: CatalogAbilityLike[];
    ultimate?: CatalogAbilityLike;
  };
}

interface PatchableScene {
  combatState: { units: CombatUnitState[] };
  create: () => void;
}

const PATCH_FLAG = '__powderCombat292LegacyAbilityMetadataInstalled';

function safeHits(value: unknown): number | undefined {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(20, parsed) : undefined;
}

function copyMetadata(target: CombatAbility | undefined, source: CatalogAbilityLike | undefined): void {
  if (!target || !source) return;
  const hits = safeHits(source.hits);
  if (hits !== undefined) target.hits = hits;
  const mechanic = String(source.mechanic || '').trim();
  if (mechanic) target.mechanic = mechanic;
  const description = String(source.description || source.rulesText || '').trim();
  if (description) target.description = description;
}

function hydrateUnit(unit: CombatUnitState): void {
  const catalog = ((globalThis as any).POWDER_DATA?.pows || []) as CatalogPowLike[];
  const row = catalog.find((candidate) => String(candidate?.id || '') === unit.pow.id);
  if (!row?.abilities) return;
  copyMetadata(unit.pow.abilities.basic, row.abilities.basic);
  copyMetadata(unit.pow.abilities.skills[0], row.abilities.skills?.[0]);
  copyMetadata(unit.pow.abilities.skills[1], row.abilities.skills?.[1]);
  copyMetadata(unit.pow.abilities.ultimate, row.abilities.ultimate);
}

export function installCombat292LegacyAbilityMetadataPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.create;
  proto.create = function combat292Create(this: PatchableScene): void {
    originalCreate.call(this);
    for (const unit of this.combatState.units) hydrateUnit(unit);
  };
}
