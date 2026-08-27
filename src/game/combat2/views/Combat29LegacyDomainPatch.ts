import type { CombatAbility, CombatSide } from '../data/CombatPow';
import { BasicAttackResolver } from '../systems/BasicAttackResolver';
import { CombatGuardEngine } from '../systems/CombatGuardEngine';
import {
  CombatLegacyDomainEngine,
  LEGACY_EXPANSION_DOMAINS,
  LEGACY_SIMPLE_DOMAINS,
  combatLegacyDomainForUnit,
  type LegacyDomainFeedback,
  type LegacyDomainLoadout,
  type LegacyDomainMode,
  type LegacyExpansionDomainId,
  type LegacySimpleDomainId,
  type LegacySimpleLevel
} from '../systems/CombatLegacyDomainEngine';
import { CombatLegacyStatEngine } from '../systems/CombatLegacyStatEngine';
import type { CombatUnitState } from '../systems/CombatState';
import { SkillActionResolver, type CombatAbilitySlot } from '../systems/SkillActionResolver';

interface PatchableScene {
  combatState: {
    units: CombatUnitState[];
    sanitizeRuntimeNumbers: () => void;
  };
  powViews: Map<string, any>;
  create: () => void;
  performBasicAttack: (actor: CombatUnitState, target: CombatUnitState) => Promise<void>;
  performAbility: (actor: CombatUnitState, target: CombatUnitState, slot: CombatAbilitySlot) => Promise<void>;
  refreshViews: () => void;
  showFloatingLabel: (view: any, label: string, color: string) => void;
  turnText: any;
}

interface TamerDomainMemory {
  awakenedSimple?: Record<string, unknown>;
  awakenedExpansion?: Record<string, unknown>;
  simpleLevels?: Record<string, number>;
  equippedSimple?: string | null;
  equippedExpansion?: string | null;
}

export interface Combat29DomainApi {
  version: string;
  mode: LegacyDomainMode;
  engine: () => CombatLegacyDomainEngine | null;
  configure: (side: CombatSide, loadout: LegacyDomainLoadout) => boolean;
  activateSimple: (side?: CombatSide) => boolean;
  activateExpansion: (side?: CombatSide) => boolean;
  setLimitlessAnswers: (side: CombatSide, ownerCorrect: number, enemyWrong: number) => void;
  snapshot: (side?: CombatSide) => unknown;
  catalog: {
    simple: typeof LEGACY_SIMPLE_DOMAINS;
    expansions: typeof LEGACY_EXPANSION_DOMAINS;
  };
}

const PATCH_FLAG = '__powderCombat29LegacyDomainInstalled';
const TamerMemoryKey = 'powder_tamer_domain_memory_v2133';
let currentEngine: CombatLegacyDomainEngine | null = null;
let currentScene: PatchableScene | null = null;
let currentMode: LegacyDomainMode = 'pvp';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function otherSide(side: CombatSide): CombatSide {
  return side === 'player' ? 'enemy' : 'player';
}

function readTamerLoadout(): LegacyDomainLoadout | null {
  let memory: TamerDomainMemory | null = null;
  try { memory = JSON.parse(localStorage.getItem(TamerMemoryKey) || 'null') as TamerDomainMemory | null; } catch { memory = null; }
  if (!memory) return null;
  const simpleId = String(memory.equippedSimple || '') as LegacySimpleDomainId;
  if (!simpleId || !LEGACY_SIMPLE_DOMAINS[simpleId] || !memory.awakenedSimple?.[simpleId]) return null;
  const expansionId = String(memory.equippedExpansion || '') as LegacyExpansionDomainId;
  const expansion = expansionId && LEGACY_EXPANSION_DOMAINS[expansionId] && memory.awakenedExpansion?.[expansionId]
    ? expansionId
    : null;
  const level = clamp(Math.floor(Number(memory.simpleLevels?.[simpleId]) || 1), 1, 3) as LegacySimpleLevel;
  return { simpleId, simpleLevel: level, expansionId: expansion };
}

function installLegacyStatPatch(): void {
  const proto = CombatLegacyStatEngine.prototype as any;
  if (proto.__powderDomain29Stats) return;
  proto.__powderDomain29Stats = true;
  const original = proto.resolveHit;
  proto.resolveHit = function domainAwareResolveHit(
    actor: CombatUnitState,
    target: CombatUnitState,
    options: { usesAttack: boolean; ultimate?: boolean; unavoidable?: boolean; area?: boolean }
  ): any {
    const engine = combatLegacyDomainForUnit(actor);
    if (!engine || engine !== combatLegacyDomainForUnit(target)) return original.call(this, actor, target, options);

    const actorProfile = engine.profile(actor);
    const targetProfile = engine.profile(target);
    const attackerExpansion = engine.snapshot(actor.side).expansion;
    const opponentExpansion = engine.snapshot(otherSide(actor.side)).expansion;
    const expansionResist = attackerExpansion ? engine.simpleExpansionResistance(target.side) : 0;
    let damageScale = (1 + actorProfile.damage) * (1 - expansionResist);

    if (opponentExpansion?.id === 'limitless_void') {
      if (opponentExpansion.limitlessEnemyWrong >= 2) damageScale = 0;
      else if (opponentExpansion.limitlessEnemyWrong === 1) damageScale *= 0.5;
    }

    const saved = {
      attackMultiplier: actor.attackMultiplier,
      abilityPowerMultiplier: actor.abilityPowerMultiplier,
      critRate: actor.pow.critRate,
      critDamage: actor.pow.critDamage,
      defenseMultiplier: target.defenseMultiplier,
      damageReductionBonus: target.damageReductionBonus
    };

    actor.attackMultiplier *= Math.max(0, damageScale);
    actor.abilityPowerMultiplier *= Math.max(0, damageScale);
    actor.pow.critRate += actorProfile.crit;
    actor.pow.critDamage += actorProfile.critDamage;
    target.defenseMultiplier *= Math.max(0.1, 1 + targetProfile.defense - engine.domainDefensePenalty(target));
    target.damageReductionBonus = clamp(target.damageReductionBonus + targetProfile.incomingReduction, 0, 0.45);
    const nextOptions = actorProfile.sureHit ? { ...options, unavoidable: true } : options;

    try {
      return original.call(this, actor, target, nextOptions);
    } finally {
      actor.attackMultiplier = saved.attackMultiplier;
      actor.abilityPowerMultiplier = saved.abilityPowerMultiplier;
      actor.pow.critRate = saved.critRate;
      actor.pow.critDamage = saved.critDamage;
      target.defenseMultiplier = saved.defenseMultiplier;
      target.damageReductionBonus = saved.damageReductionBonus;
    }
  };
}

function abilityHits(ability: CombatAbility): number {
  if (Number.isFinite(Number(ability.hits))) return Math.max(1, Math.round(Number(ability.hits)));
  const text = `${ability.name || ''} ${ability.description || ''}`;
  const match = text.match(/(\d+)\s*(?:phát|nhát|hit|đòn)/i);
  return match ? clamp(Number(match[1]) || 1, 1, 20) : 1;
}

function installResolverFeedbackPatch(): void {
  const basicProto = BasicAttackResolver.prototype as any;
  if (!basicProto.__powderDomain29Hit) {
    basicProto.__powderDomain29Hit = true;
    const originalBasic = basicProto.resolve;
    basicProto.resolve = function domainBasic(actor: CombatUnitState, target: CombatUnitState): any {
      const result = originalBasic.call(this, actor, target);
      const engine = combatLegacyDomainForUnit(actor);
      if (engine && engine === combatLegacyDomainForUnit(target) && result.damage > 0) {
        (result as any).domainFeedback = engine.afterDamage(actor, target, result.damage, result.shieldDamage, abilityHits(actor.pow.abilities.basic));
      }
      return result;
    };
  }

  const skillProto = SkillActionResolver.prototype as any;
  if (!skillProto.__powderDomain29Hit) {
    skillProto.__powderDomain29Hit = true;
    const originalResolve = skillProto.resolve;
    const originalUltimate = skillProto.resolveUltimate;
    skillProto.resolve = function domainSkill(
      actor: CombatUnitState,
      target: CombatUnitState,
      ability: CombatAbility,
      slot: 0 | 1,
      currentRound = 1
    ): any {
      const result = originalResolve.call(this, actor, target, ability, slot, currentRound);
      const engine = combatLegacyDomainForUnit(actor);
      if (engine && engine === combatLegacyDomainForUnit(target) && result.damage > 0) {
        (result as any).domainFeedback = engine.afterDamage(actor, target, result.damage, result.shieldDamage, abilityHits(ability));
      }
      return result;
    };
    skillProto.resolveUltimate = function domainUltimate(
      actor: CombatUnitState,
      target: CombatUnitState,
      ability: CombatAbility,
      currentRound = 1
    ): any {
      const result = originalUltimate.call(this, actor, target, ability, currentRound);
      const engine = combatLegacyDomainForUnit(actor);
      if (engine && engine === combatLegacyDomainForUnit(target) && result.damage > 0) {
        (result as any).domainFeedback = engine.afterDamage(actor, target, result.damage, result.shieldDamage, abilityHits(ability));
      }
      return result;
    };
  }
}

function installDomainGuardPatch(): void {
  const proto = CombatGuardEngine.prototype as any;
  if (proto.__powderDomain29Guard) return;
  proto.__powderDomain29Guard = true;
  const original = proto.guardChance;
  proto.guardChance = function domainGuardChance(unit: CombatUnitState): number {
    const base = Number(original.call(this, unit)) || 0;
    const engine = combatLegacyDomainForUnit(unit);
    return clamp(base + (engine?.profile(unit).guardBonus || 0) / 100, 0, 1);
  };
}

function feedbackColor(kind: LegacyDomainFeedback['kind']): string {
  if (kind === 'heal') return '#73f0aa';
  if (kind === 'shield') return '#8edfff';
  if (kind === 'damage') return '#ffd36a';
  if (kind === 'revive') return '#9dffbf';
  if (kind === 'status') return '#c9b0ff';
  return '#ffe08a';
}

function showFeedback(scene: PatchableScene, rows: readonly LegacyDomainFeedback[]): void {
  for (const row of rows.slice(0, 8)) {
    const view = row.targetId ? scene.powViews.get(row.targetId) : undefined;
    scene.showFloatingLabel(view || scene.powViews.values().next().value, row.label, feedbackColor(row.kind));
  }
  scene.combatState.sanitizeRuntimeNumbers();
  scene.refreshViews();
}

function installScenePatch(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.create;
  const originalBasic = proto.performBasicAttack;
  const originalAbility = proto.performAbility;

  proto.create = function domainCreate(this: PatchableScene): void {
    originalCreate.call(this);
    currentEngine?.dispose();
    currentEngine = new CombatLegacyDomainEngine(this.combatState.units);
    currentScene = this;
    currentMode = 'pvp';
    const loadout = readTamerLoadout();
    if (loadout) currentEngine.configureLoadout('player', loadout);
  };

  proto.performBasicAttack = async function domainBasicAction(
    this: PatchableScene,
    actor: CombatUnitState,
    target: CombatUnitState
  ): Promise<void> {
    await originalBasic.call(this, actor, target);
    const engine = combatLegacyDomainForUnit(actor);
    if (!engine) return;
    showFeedback(this, engine.afterActorAction(actor));
  };

  proto.performAbility = async function domainAbilityAction(
    this: PatchableScene,
    actor: CombatUnitState,
    target: CombatUnitState,
    slot: CombatAbilitySlot
  ): Promise<void> {
    await originalAbility.call(this, actor, target, slot);
    const engine = combatLegacyDomainForUnit(actor);
    if (!engine) return;
    showFeedback(this, engine.afterActorAction(actor));
  };
}

function exposeApi(): void {
  const api: Combat29DomainApi = {
    version: '2.9.0',
    get mode() { return currentMode; },
    set mode(value: LegacyDomainMode) { currentMode = value === 'pve' ? 'pve' : 'pvp'; },
    engine: () => currentEngine,
    configure: (side, loadout) => Boolean(currentEngine?.configureLoadout(side, loadout)),
    activateSimple: (side = 'player') => {
      if (!currentEngine) return false;
      const result = currentEngine.activateSimple(side);
      if (result.ok && currentScene) showFeedback(currentScene, [{ kind: 'domain', label: `${result.id ? LEGACY_SIMPLE_DOMAINS[result.id as LegacySimpleDomainId].short : 'GIẢN DỊ'} · ${result.chargesRemaining ?? 0} LẦN CÒN LẠI` }]);
      return result.ok;
    },
    activateExpansion: (side = 'player') => {
      if (!currentEngine) return false;
      const result = currentEngine.activateExpansion(side, currentMode);
      if (result.ok && currentScene) showFeedback(currentScene, [{ kind: 'domain', label: `${result.id ? LEGACY_EXPANSION_DOMAINS[result.id as LegacyExpansionDomainId].short : 'BÀNH TRƯỚNG'} · ${result.actionsRemaining ?? 0} HÀNH ĐỘNG` }]);
      return result.ok;
    },
    setLimitlessAnswers: (side, ownerCorrect, enemyWrong) => currentEngine?.setLimitlessAnswers(side, ownerCorrect, enemyWrong),
    snapshot: (side = 'player') => currentEngine?.snapshot(side) ?? null,
    catalog: { simple: LEGACY_SIMPLE_DOMAINS, expansions: LEGACY_EXPANSION_DOMAINS }
  };
  (globalThis as any).POWDER_COMBAT2_DOMAIN = api;
}

export function installCombat29LegacyDomainPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installLegacyStatPatch();
  installResolverFeedbackPatch();
  installDomainGuardPatch();
  installScenePatch(BattleSceneClass);
  exposeApi();
}
