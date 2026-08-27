import type { CombatSide } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';

export type LegacySimpleDomainId = 'crimson' | 'tide' | 'verdant';
export type LegacyExpansionDomainId =
  | 'nine_suns'
  | 'infinite_strike'
  | 'limitless_void'
  | 'frozen_silence'
  | 'diamond_guard'
  | 'jackpot_bagua'
  | 'myriad_poison'
  | 'rebirth_wood'
  | 'draw_swords';
export type LegacyDomainMode = 'pve' | 'pvp';
export type LegacySimpleLevel = 1 | 2 | 3;

type DomainBranch = 'fire' | 'water' | 'leaf';

export interface LegacySimpleTier {
  damage: number;
  crit?: number;
  critDamage?: number;
  def?: number;
  hp?: number;
  lifesteal?: number;
  shieldCap?: number;
}

export interface LegacySimpleDomainConfig {
  id: LegacySimpleDomainId;
  name: string;
  short: string;
  branch: DomainBranch;
  tiers: Record<LegacySimpleLevel, LegacySimpleTier>;
}

export interface LegacyExpansionDomainConfig {
  id: LegacyExpansionDomainId;
  name: string;
  short: string;
  branch: DomainBranch;
  kind: 'normal' | 'special';
  durationActions: number;
  stats: {
    damage: number;
    crit?: number;
    critDamage?: number;
    def?: number;
    hp?: number;
    lifesteal?: number;
    shieldCap?: number;
  };
  incomingReduction?: number;
  shieldPower?: number;
  guardBonus?: number;
  antiHeal?: number;
  poisonStackCap?: number;
  sureHit?: boolean;
  swordsSureHit?: boolean;
  roleRestricted?: boolean;
}

export const LEGACY_SIMPLE_LEVEL_RESIST: Readonly<Record<LegacySimpleLevel, number>> = Object.freeze({
  1: 0.30,
  2: 0.40,
  3: 0.50
});

export const LEGACY_SIMPLE_DOMAINS: Readonly<Record<LegacySimpleDomainId, LegacySimpleDomainConfig>> = Object.freeze({
  crimson: {
    id: 'crimson', name: 'Xích Viêm Sát Giới', short: 'XÍCH VIÊM', branch: 'fire',
    tiers: {
      1: { damage: 0.25, crit: 10, critDamage: 50 },
      2: { damage: 0.35, crit: 15, critDamage: 75 },
      3: { damage: 0.45, crit: 20, critDamage: 100 }
    }
  },
  tide: {
    id: 'tide', name: 'Huyền Thủy Trấn Giới', short: 'HUYỀN THỦY', branch: 'water',
    tiers: {
      1: { damage: 0.25, def: 0.25, hp: 0.25 },
      2: { damage: 0.35, def: 0.35, hp: 0.35 },
      3: { damage: 0.45, def: 0.45, hp: 0.45 }
    }
  },
  verdant: {
    id: 'verdant', name: 'Thanh Mộc Huyết Giới', short: 'THANH MỘC', branch: 'leaf',
    tiers: {
      1: { damage: 0.25, lifesteal: 0.20, shieldCap: 0.25 },
      2: { damage: 0.35, lifesteal: 0.30, shieldCap: 0.35 },
      3: { damage: 0.45, lifesteal: 0.40, shieldCap: 0.50 }
    }
  }
});

export const LEGACY_EXPANSION_DOMAINS: Readonly<Record<LegacyExpansionDomainId, LegacyExpansionDomainConfig>> = Object.freeze({
  nine_suns: {
    id: 'nine_suns', name: 'Cửu Nhật Phần Thiên Giới', short: 'CỬU NHẬT PHẦN THIÊN', branch: 'fire', kind: 'normal', durationActions: 4,
    stats: { damage: 0.60, crit: 28, critDamage: 130 }
  },
  infinite_strike: {
    id: 'infinite_strike', name: 'Thiên Kích Vô Tận Giới', short: 'THIÊN KÍCH VÔ TẬN', branch: 'fire', kind: 'normal', durationActions: 4,
    stats: { damage: 0.60, crit: 28, critDamage: 130 }
  },
  limitless_void: {
    id: 'limitless_void', name: 'Vô Lượng Không Xứ', short: 'VÔ LƯỢNG KHÔNG XỨ', branch: 'fire', kind: 'special', durationActions: 2,
    stats: { damage: 0.50, crit: 22, critDamage: 110 }
  },
  frozen_silence: {
    id: 'frozen_silence', name: 'Huyền Băng Tịch Diệt Giới', short: 'HUYỀN BĂNG TỊCH DIỆT', branch: 'water', kind: 'normal', durationActions: 4,
    stats: { damage: 0.60, def: 0.55, hp: 0.55 }
  },
  diamond_guard: {
    id: 'diamond_guard', name: 'Bất Động Kim Cương Giới', short: 'BẤT ĐỘNG KIM CƯƠNG', branch: 'water', kind: 'normal', durationActions: 4,
    stats: { damage: 0.45, def: 0.60, hp: 0.60 }, incomingReduction: 0.30, shieldPower: 40, guardBonus: 20
  },
  jackpot_bagua: {
    id: 'jackpot_bagua', name: 'Tọa Sát Bát Đồ', short: 'TỌA SÁT BÁT ĐỒ', branch: 'water', kind: 'special', durationActions: 3,
    stats: { damage: 0.50, def: 0.50, hp: 0.50 }, sureHit: true
  },
  myriad_poison: {
    id: 'myriad_poison', name: 'Vạn Độc Phệ Sinh Giới', short: 'VẠN ĐỘC PHỆ SINH', branch: 'leaf', kind: 'normal', durationActions: 4,
    stats: { damage: 0.55, lifesteal: 0.55, shieldCap: 0.65 }, poisonStackCap: 6, antiHeal: 0.30
  },
  rebirth_wood: {
    id: 'rebirth_wood', name: 'Vạn Mộc Luân Sinh Giới', short: 'VẠN MỘC LUÂN SINH', branch: 'leaf', kind: 'normal', durationActions: 4,
    stats: { damage: 0.60, lifesteal: 0.60, shieldCap: 0.70 }
  },
  draw_swords: {
    id: 'draw_swords', name: 'Rút Kiếm Ra', short: 'RÚT KIẾM RA', branch: 'leaf', kind: 'special', durationActions: 5,
    stats: { damage: 0.30, hp: 0.30, lifesteal: 0.30, shieldCap: 0.50 }, swordsSureHit: true, roleRestricted: true
  }
});

export const LEGACY_DOMAIN_BRANCHES: Readonly<Record<DomainBranch, readonly LegacyExpansionDomainId[]>> = Object.freeze({
  fire: ['nine_suns', 'infinite_strike', 'limitless_void'],
  water: ['frozen_silence', 'diamond_guard', 'jackpot_bagua'],
  leaf: ['myriad_poison', 'rebirth_wood', 'draw_swords']
});

export interface LegacyDomainLoadout {
  simpleId?: LegacySimpleDomainId | null;
  simpleLevel?: LegacySimpleLevel;
  expansionId?: LegacyExpansionDomainId | null;
}

export interface LegacyDomainActivationResult {
  ok: boolean;
  reason: string;
  id: LegacySimpleDomainId | LegacyExpansionDomainId | null;
  chargesRemaining?: number;
  actionsRemaining?: number;
}

export interface LegacyDomainProfile {
  damage: number;
  defense: number;
  hp: number;
  crit: number;
  critDamage: number;
  lifesteal: number;
  shieldCap: number;
  incomingReduction: number;
  shieldPower: number;
  guardBonus: number;
  sureHit: boolean;
}

export interface LegacyDomainFeedback {
  kind: 'heal' | 'shield' | 'damage' | 'status' | 'domain' | 'revive';
  targetId?: string;
  value?: number;
  label: string;
}

interface ActiveSimple {
  id: LegacySimpleDomainId;
  level: LegacySimpleLevel;
  actionsRemaining: number;
}

interface ActiveExpansion {
  id: LegacyExpansionDomainId;
  actionsRemaining: number;
  comboHits: number;
  pursuitBursts: number;
  guardMarks: number;
  sinhQi: number;
  swordCursor: number;
  limitlessOwnerCorrect: number;
  limitlessEnemyWrong: number;
}

interface SideState {
  equippedSimple: LegacySimpleDomainId | null;
  simpleLevel: LegacySimpleLevel;
  equippedExpansion: LegacyExpansionDomainId | null;
  simpleCharges: number;
  simpleActive: ActiveSimple | null;
  expansion: ActiveExpansion | null;
  expansionUsed: boolean;
}

interface UnitDomainRuntime {
  baseMaxHp: number;
  coldStacks: number;
  coldActionsRemaining: number;
  coldOutgoingPenalty: number;
  domainDefensePenalty: number;
  domainDefensePenaltyActionsRemaining: number;
}

const FRONT_ROLES = new Set(['tank', 'knight', 'fighter']);
const SWORD_ORDER = ['flame', 'poison', 'thunder', 'sever', 'ice'] as const;

const DOMAIN_BY_UNIT = new WeakMap<CombatUnitState, CombatLegacyDomainEngine>();

function clamp(value: number, min: number, max: number): number {
  const safe = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, safe));
}

function roleKey(unit: CombatUnitState): string {
  const normalized = String(unit.pow.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('do don') || normalized.includes('tank')) return 'tank';
  if (normalized.includes('hiep si') || normalized.includes('knight')) return 'knight';
  if (normalized.includes('dau si') || normalized.includes('fighter')) return 'fighter';
  if (normalized.includes('sat thu') || normalized.includes('assassin')) return 'assassin';
  if (normalized.includes('phap su') || normalized.includes('mage')) return 'mage';
  if (normalized.includes('xa thu') || normalized.includes('marksman')) return 'marksman';
  if (normalized.includes('tri lieu') || normalized.includes('healer')) return 'healer';
  if (normalized.includes('nhac cong') || normalized.includes('musician')) return 'musician';
  return 'enchanter';
}

function otherSide(side: CombatSide): CombatSide {
  return side === 'player' ? 'enemy' : 'player';
}

function freshSide(): SideState {
  return {
    equippedSimple: null,
    simpleLevel: 1,
    equippedExpansion: null,
    simpleCharges: 3,
    simpleActive: null,
    expansion: null,
    expansionUsed: false
  };
}

export function combatLegacyDomainForUnit(unit: CombatUnitState): CombatLegacyDomainEngine | null {
  return DOMAIN_BY_UNIT.get(unit) ?? null;
}

export class CombatLegacyDomainEngine {
  private readonly side: Record<CombatSide, SideState> = { player: freshSide(), enemy: freshSide() };
  private readonly runtime = new WeakMap<CombatUnitState, UnitDomainRuntime>();

  constructor(private readonly units: readonly CombatUnitState[]) {
    for (const unit of units) {
      DOMAIN_BY_UNIT.set(unit, this);
      this.runtime.set(unit, {
        baseMaxHp: Math.max(1, Number(unit.pow.maxHp) || 1),
        coldStacks: 0,
        coldActionsRemaining: 0,
        coldOutgoingPenalty: 0,
        domainDefensePenalty: 0,
        domainDefensePenaltyActionsRemaining: 0
      });
    }
  }

  configureLoadout(side: CombatSide, loadout: LegacyDomainLoadout): boolean {
    const simpleId = loadout.simpleId ?? null;
    const expansionId = loadout.expansionId ?? null;
    if (simpleId && !LEGACY_SIMPLE_DOMAINS[simpleId]) return false;
    if (expansionId && !LEGACY_EXPANSION_DOMAINS[expansionId]) return false;
    if (expansionId) {
      if (!simpleId) return false;
      if (LEGACY_EXPANSION_DOMAINS[expansionId].branch !== LEGACY_SIMPLE_DOMAINS[simpleId].branch) return false;
    }

    const state = this.side[side];
    state.equippedSimple = simpleId;
    state.simpleLevel = clamp(Math.floor(Number(loadout.simpleLevel) || 1), 1, 3) as LegacySimpleLevel;
    state.equippedExpansion = expansionId;
    state.simpleActive = null;
    state.expansion = null;
    state.simpleCharges = 3;
    state.expansionUsed = false;
    this.refreshMaxHp(side);
    return true;
  }

  snapshot(side: CombatSide): Readonly<SideState> {
    const state = this.side[side];
    return {
      ...state,
      simpleActive: state.simpleActive ? { ...state.simpleActive } : null,
      expansion: state.expansion ? { ...state.expansion } : null
    };
  }

  activateSimple(side: CombatSide): LegacyDomainActivationResult {
    const state = this.side[side];
    const id = state.equippedSimple;
    if (!id) return { ok: false, reason: 'no-simple-equipped', id: null };
    if (state.expansion) return { ok: false, reason: 'expansion-active', id };
    if (state.simpleCharges <= 0) return { ok: false, reason: 'no-simple-charges', id };
    state.simpleCharges -= 1;
    state.simpleActive = { id, level: state.simpleLevel, actionsRemaining: 1 };
    this.refreshMaxHp(side);
    return { ok: true, reason: 'activated', id, chargesRemaining: state.simpleCharges, actionsRemaining: 1 };
  }

  activateExpansion(side: CombatSide, mode: LegacyDomainMode): LegacyDomainActivationResult {
    const state = this.side[side];
    const id = state.equippedExpansion;
    if (mode !== 'pvp') return { ok: false, reason: 'pvp-only', id };
    if (!id) return { ok: false, reason: 'no-expansion-equipped', id: null };
    if (state.expansionUsed) return { ok: false, reason: 'expansion-already-used', id };
    if (!state.equippedSimple || LEGACY_EXPANSION_DOMAINS[id].branch !== LEGACY_SIMPLE_DOMAINS[state.equippedSimple].branch) {
      return { ok: false, reason: 'branch-mismatch', id };
    }

    const config = LEGACY_EXPANSION_DOMAINS[id];
    state.simpleActive = null;
    state.expansionUsed = true;
    state.expansion = {
      id,
      actionsRemaining: config.durationActions,
      comboHits: id === 'infinite_strike' ? 1 : 0,
      pursuitBursts: 0,
      guardMarks: 0,
      sinhQi: id === 'rebirth_wood' ? 25 : 0,
      swordCursor: 0,
      limitlessOwnerCorrect: 0,
      limitlessEnemyWrong: 0
    };
    this.refreshMaxHp(side);
    this.applyExpansionOpening(side);
    return { ok: true, reason: 'activated', id, actionsRemaining: config.durationActions };
  }

  setLimitlessAnswers(side: CombatSide, ownerCorrect: number, enemyWrong: number): void {
    const expansion = this.side[side].expansion;
    if (!expansion || expansion.id !== 'limitless_void') return;
    expansion.limitlessOwnerCorrect = clamp(Math.floor(ownerCorrect), 0, 10);
    expansion.limitlessEnemyWrong = clamp(Math.floor(enemyWrong), 0, 5);
  }

  profile(unit: CombatUnitState): LegacyDomainProfile {
    const state = this.side[unit.side];
    const cold = this.runtime.get(unit);
    let damage = 0;
    let defense = 0;
    let hp = 0;
    let crit = 0;
    let critDamage = 0;
    let lifesteal = 0;
    let shieldCap = 0;
    let incomingReduction = 0;
    let shieldPower = 0;
    let guardBonus = 0;
    let sureHit = false;

    if (state.expansion) {
      const config = LEGACY_EXPANSION_DOMAINS[state.expansion.id];
      const restricted = config.id === 'draw_swords' && FRONT_ROLES.has(roleKey(unit));
      if (!restricted) {
        damage = config.stats.damage || 0;
        defense = config.stats.def || 0;
        hp = config.stats.hp || 0;
        crit = config.stats.crit || 0;
        critDamage = config.stats.critDamage || 0;
        lifesteal = config.stats.lifesteal || 0;
        shieldCap = config.stats.shieldCap || 0;
      }
      incomingReduction = config.incomingReduction || 0;
      shieldPower = config.shieldPower || 0;
      guardBonus = config.guardBonus || 0;
      sureHit = Boolean(config.sureHit);

      if (config.id === 'limitless_void') {
        damage += state.expansion.limitlessOwnerCorrect * 0.20;
      }
      if (config.id === 'rebirth_wood' && state.expansion.sinhQi >= 75) damage += state.expansion.sinhQi >= 100 ? 0.25 : 0.20;
    } else if (state.simpleActive) {
      const config = LEGACY_SIMPLE_DOMAINS[state.simpleActive.id];
      const tier = config.tiers[state.simpleActive.level];
      damage = tier.damage || 0;
      defense = tier.def || 0;
      hp = tier.hp || 0;
      crit = tier.crit || 0;
      critDamage = tier.critDamage || 0;
      lifesteal = tier.lifesteal || 0;
      shieldCap = tier.shieldCap || 0;
    }

    if (cold && cold.coldActionsRemaining > 0) damage -= cold.coldOutgoingPenalty;
    return {
      damage: Math.max(-0.95, damage), defense, hp, crit, critDamage, lifesteal, shieldCap,
      incomingReduction, shieldPower, guardBonus, sureHit
    };
  }

  simpleExpansionResistance(side: CombatSide): number {
    const active = this.side[side].simpleActive;
    return active ? LEGACY_SIMPLE_LEVEL_RESIST[active.level] : 0;
  }

  afterDamage(actor: CombatUnitState, target: CombatUnitState, damage: number, shieldDamage = 0, abilityHits = 1): LegacyDomainFeedback[] {
    const feedback: LegacyDomainFeedback[] = [];
    const totalDamage = Math.max(0, Math.round(Number(damage) || 0));
    if (totalDamage > 0) feedback.push(...this.applyLifesteal(actor, totalDamage));

    const ownerExpansion = this.side[actor.side].expansion;
    if (ownerExpansion) {
      switch (ownerExpansion.id) {
        case 'nine_suns':
          feedback.push(...this.nineSunsHit(actor, target, totalDamage, abilityHits));
          break;
        case 'infinite_strike':
          feedback.push(...this.infiniteStrikeHit(actor, target, totalDamage, abilityHits));
          break;
        case 'frozen_silence':
          feedback.push(...this.frozenSilenceHit(actor, target));
          break;
        case 'myriad_poison':
          feedback.push(...this.myriadPoisonHit(actor, target, abilityHits));
          break;
        default:
          break;
      }
    }

    const defenderExpansion = this.side[target.side].expansion;
    if (defenderExpansion?.id === 'diamond_guard' && totalDamage > 0) {
      defenderExpansion.guardMarks += 1;
      feedback.push({ kind: 'domain', targetId: target.instanceId, label: `TRẤN KHÍ ${Math.min(3, defenderExpansion.guardMarks)}/3` });
      if (shieldDamage > 0 && actor.alive) {
        const reflected = this.dealRawDamage(actor, Math.min(Math.round(actor.pow.maxHp * 0.10), Math.max(1, Math.round(shieldDamage * 0.55))));
        if (reflected > 0) feedback.push({ kind: 'damage', targetId: actor.instanceId, value: reflected, label: `PHẢN CHẤN -${reflected}` });
      }
      if (defenderExpansion.guardMarks >= 3) {
        defenderExpansion.guardMarks -= 3;
        for (const ally of this.activeLiving(target.side)) {
          const shield = this.addShield(ally, ally.pow.maxHp * 0.12, 0.40);
          if (shield > 0) feedback.push({ kind: 'shield', targetId: ally.instanceId, value: shield, label: `KIM CƯƠNG +${shield}` });
          this.cleanseOne(ally);
        }
      }
    }

    return feedback;
  }

  afterActorAction(actor: CombatUnitState): LegacyDomainFeedback[] {
    const feedback: LegacyDomainFeedback[] = [];
    const state = this.side[actor.side];
    if (state.expansion?.id === 'draw_swords') feedback.push(...this.drawSword(actor));

    if (state.simpleActive) {
      state.simpleActive.actionsRemaining -= 1;
      if (state.simpleActive.actionsRemaining <= 0) {
        const name = LEGACY_SIMPLE_DOMAINS[state.simpleActive.id].short;
        state.simpleActive = null;
        this.refreshMaxHp(actor.side);
        feedback.push({ kind: 'domain', label: `${name} KẾT THÚC` });
      }
    }
    if (state.expansion) {
      state.expansion.actionsRemaining -= 1;
      if (state.expansion.actionsRemaining <= 0) {
        const name = LEGACY_EXPANSION_DOMAINS[state.expansion.id].short;
        state.expansion = null;
        this.refreshMaxHp(actor.side);
        feedback.push({ kind: 'domain', label: `${name} KẾT THÚC` });
      }
    }

    this.tickDomainDebuffs(actor);
    feedback.push(...this.rebirthRescue(actor.side));
    return feedback;
  }

  dispose(): void {
    for (const side of ['player', 'enemy'] as const) {
      this.side[side].simpleActive = null;
      this.side[side].expansion = null;
      this.refreshMaxHp(side);
    }
    for (const unit of this.units) DOMAIN_BY_UNIT.delete(unit);
  }

  private applyExpansionOpening(side: CombatSide): void {
    const expansion = this.side[side].expansion;
    if (!expansion) return;
    const foes = this.activeLiving(otherSide(side));
    const allies = this.activeLiving(side);
    if (expansion.id === 'nine_suns') {
      for (const target of foes) this.domainRuntime(target).coldActionsRemaining = this.domainRuntime(target).coldActionsRemaining;
      for (const target of foes) this.setMark(target, side, 1);
    } else if (expansion.id === 'frozen_silence') {
      for (const target of foes) this.addCold(target, side);
    } else if (expansion.id === 'diamond_guard') {
      for (const ally of allies) this.addShield(ally, ally.pow.maxHp * 0.12, 0.40);
    } else if (expansion.id === 'myriad_poison') {
      for (const target of foes) {
        target.poisonStacks = Math.max(1, target.poisonStacks);
        target.poisonActionsRemaining = Math.max(3, target.poisonActionsRemaining);
        target.antiHeal = Math.max(target.antiHeal, 0.30);
        target.antiHealActionsRemaining = Math.max(3, target.antiHealActionsRemaining);
      }
    }
  }

  private nineSunsHit(actor: CombatUnitState, target: CombatUnitState, damage: number, hits: number): LegacyDomainFeedback[] {
    if (damage <= 0 || !target.alive) return [];
    const feedback: LegacyDomainFeedback[] = [];
    const burnSeed = Math.max(1, Math.round(damage * 0.45 * 1.5));
    target.burnDamage = Math.max(target.burnDamage, Math.min(Math.round(target.pow.maxHp * 0.16), burnSeed));
    target.burnActionsRemaining = Math.max(target.burnActionsRemaining, 3);
    const gain = Math.max(1, Math.round(hits)) * (String(actor.pow.elementKey).toLowerCase() === 'fire' ? 2 : 1);
    const marks = this.setMark(target, actor.side, this.mark(target, actor.side) + gain);
    feedback.push({ kind: 'status', targetId: target.instanceId, label: `PHẦN ẤN ${marks}/4` });
    if (marks >= 4) {
      this.setMark(target, actor.side, 0);
      const turns = Math.max(0, target.burnActionsRemaining);
      const raw = Math.round(target.pow.maxHp * (0.10 + 0.012 * Math.min(3, turns)) + actor.pow.attack * 0.45);
      const resist = this.simpleExpansionResistance(target.side);
      const burst = this.dealRawDamage(target, Math.min(Math.round(target.pow.maxHp * 0.22), Math.round(raw * (1 - resist))));
      target.burnActionsRemaining = Math.max(target.burnActionsRemaining, 3);
      if (burst > 0) feedback.push({ kind: 'damage', targetId: target.instanceId, value: burst, label: `BẠO VIÊM -${burst}` });
    }
    return feedback;
  }

  private infiniteStrikeHit(actor: CombatUnitState, target: CombatUnitState, damage: number, hits: number): LegacyDomainFeedback[] {
    const expansion = this.side[actor.side].expansion;
    if (!expansion || expansion.id !== 'infinite_strike' || damage <= 0 || !target.alive) return [];
    const feedback: LegacyDomainFeedback[] = [];
    expansion.comboHits += Math.max(1, Math.round(hits));
    while (expansion.comboHits >= 4 && target.alive) {
      expansion.comboHits -= 4;
      const resist = this.simpleExpansionResistance(target.side);
      const amount = Math.round(Math.min(damage * 0.45, target.pow.maxHp * 0.16) * (1 - resist));
      const dealt = this.dealRawDamage(target, amount);
      expansion.pursuitBursts += 1;
      if (dealt > 0) feedback.push({ kind: 'damage', targetId: target.instanceId, value: dealt, label: `TRUY KÍCH -${dealt}` });
      if (expansion.pursuitBursts % 2 === 0) {
        for (const foe of this.activeLiving(otherSide(actor.side))) {
          const aoe = this.dealRawDamage(foe, Math.round(foe.pow.maxHp * 0.06 * (1 - this.simpleExpansionResistance(foe.side))));
          if (aoe > 0) feedback.push({ kind: 'damage', targetId: foe.instanceId, value: aoe, label: `BẠO LIÊN -${aoe}` });
        }
      }
    }
    return feedback;
  }

  private frozenSilenceHit(actor: CombatUnitState, target: CombatUnitState): LegacyDomainFeedback[] {
    if (!target.alive) return [];
    const feedback: LegacyDomainFeedback[] = [];
    if (target.controlStatus === 'freeze' && target.controlActionsRemaining > 0) {
      target.controlStatus = null;
      target.controlActionsRemaining = 0;
      const damage = this.dealRawDamage(target, Math.round(target.pow.maxHp * 0.15 * (1 - this.simpleExpansionResistance(target.side))));
      const rt = this.domainRuntime(target);
      rt.domainDefensePenalty = 0.30 * (1 - this.simpleExpansionResistance(target.side));
      rt.domainDefensePenaltyActionsRemaining = 2;
      if (damage > 0) feedback.push({ kind: 'damage', targetId: target.instanceId, value: damage, label: `PHÁ BĂNG -${damage}` });
      for (const spread of this.activeLiving(target.side).filter((unit) => unit.instanceId !== target.instanceId).slice(0, 2)) this.addCold(spread, actor.side);
    } else {
      const stacks = this.addCold(target, actor.side);
      feedback.push({ kind: 'status', targetId: target.instanceId, label: `HÀN KHÍ ${stacks}/3` });
    }
    return feedback;
  }

  private myriadPoisonHit(actor: CombatUnitState, target: CombatUnitState, hits: number): LegacyDomainFeedback[] {
    if (!target.alive) return [];
    const config = LEGACY_EXPANSION_DOMAINS.myriad_poison;
    const gain = Math.max(1, Math.round(hits));
    target.poisonStacks = clamp(target.poisonStacks + gain, 1, config.poisonStackCap || 6);
    target.poisonActionsRemaining = Math.max(target.poisonActionsRemaining, 3);
    target.antiHeal = Math.max(target.antiHeal, config.antiHeal || 0.30);
    target.antiHealActionsRemaining = Math.max(target.antiHealActionsRemaining, 3);
    if (target.poisonStacks >= 6) {
      target.defenseMultiplier = Math.min(target.defenseMultiplier, 0.75);
      target.defenseBuffActionsRemaining = Math.max(target.defenseBuffActionsRemaining, 2);
      target.attackMultiplier = Math.min(target.attackMultiplier, 0.80);
      target.attackBuffActionsRemaining = Math.max(target.attackBuffActionsRemaining, 2);
      target.abilityPowerMultiplier = Math.min(target.abilityPowerMultiplier, 0.80);
      target.abilityPowerBuffActionsRemaining = Math.max(target.abilityPowerBuffActionsRemaining, 2);
    }
    return [{ kind: 'status', targetId: target.instanceId, label: `POISON ${target.poisonStacks}/${config.poisonStackCap || 6}` }];
  }

  private drawSword(actor: CombatUnitState): LegacyDomainFeedback[] {
    const expansion = this.side[actor.side].expansion;
    if (!expansion || expansion.id !== 'draw_swords') return [];
    const foes = this.activeLiving(otherSide(actor.side));
    if (!foes.length) return [];
    const target = foes[expansion.swordCursor % foes.length];
    const sword = SWORD_ORDER[expansion.swordCursor % SWORD_ORDER.length];
    expansion.swordCursor += 1;
    const damage = this.dealRawDamage(target, Math.round(target.pow.maxHp * 0.20 * (1 - this.simpleExpansionResistance(target.side))));
    switch (sword) {
      case 'flame':
        target.burnDamage = Math.max(target.burnDamage, Math.round(target.pow.maxHp * 0.06));
        target.burnActionsRemaining = Math.max(target.burnActionsRemaining, 3);
        break;
      case 'poison':
        target.poisonStacks = Math.max(target.poisonStacks, 1);
        target.poisonActionsRemaining = Math.max(target.poisonActionsRemaining, 3);
        break;
      case 'thunder':
        target.paralysisActionsRemaining = Math.max(target.paralysisActionsRemaining, 1);
        break;
      case 'sever':
        target.antiHeal = Math.max(target.antiHeal, 0.40);
        target.antiHealActionsRemaining = Math.max(target.antiHealActionsRemaining, 2);
        break;
      case 'ice':
        target.controlStatus = 'freeze';
        target.controlActionsRemaining = Math.max(target.controlActionsRemaining, 1);
        break;
    }
    return [{ kind: 'damage', targetId: target.instanceId, value: damage, label: `RÚT KIẾM · ${sword.toUpperCase()} -${damage}` }];
  }

  private applyLifesteal(actor: CombatUnitState, damage: number): LegacyDomainFeedback[] {
    const profile = this.profile(actor);
    if (profile.lifesteal <= 0 || damage <= 0) return [];
    const raw = Math.max(1, Math.round(damage * profile.lifesteal));
    const missing = Math.max(0, actor.pow.maxHp - actor.hp);
    const heal = Math.min(raw, missing);
    const feedback: LegacyDomainFeedback[] = [];
    if (heal > 0) {
      const received = Math.max(0, Math.round(heal * (1 - clamp(actor.antiHeal, 0, 0.95))));
      actor.hp = Math.min(actor.pow.maxHp, actor.hp + received);
      if (received > 0) feedback.push({ kind: 'heal', targetId: actor.instanceId, value: received, label: `HÚT MÁU +${received}` });
    }
    const excess = Math.max(0, raw - heal);
    if (excess > 0 && profile.shieldCap > 0) {
      const shield = this.addShield(actor, excess, profile.shieldCap);
      if (shield > 0) feedback.push({ kind: 'shield', targetId: actor.instanceId, value: shield, label: `HÚT MÁU → KHIÊN +${shield}` });
    }
    const expansion = this.side[actor.side].expansion;
    if (expansion?.id === 'rebirth_wood') {
      const qi = Math.max(0, (heal / Math.max(1, actor.pow.maxHp)) * 50 + (excess / Math.max(1, actor.pow.maxHp)) * 100);
      feedback.push(...this.gainSinhQi(actor.side, qi));
    }
    return feedback;
  }

  private gainSinhQi(side: CombatSide, amount: number): LegacyDomainFeedback[] {
    const expansion = this.side[side].expansion;
    if (!expansion || expansion.id !== 'rebirth_wood' || amount <= 0) return [];
    const feedback: LegacyDomainFeedback[] = [];
    const before = expansion.sinhQi;
    expansion.sinhQi = clamp(before + Math.max(1, Math.round(amount)), 0, 100);
    if (before < 50 && expansion.sinhQi >= 50) {
      for (const ally of this.activeLiving(side)) {
        const heal = Math.max(1, Math.round(ally.pow.maxHp * 0.06));
        const actual = Math.min(heal, Math.max(0, ally.pow.maxHp - ally.hp));
        ally.hp += actual;
        ally.regenerationActionsRemaining = Math.max(ally.regenerationActionsRemaining, 3);
        if (actual > 0) feedback.push({ kind: 'heal', targetId: ally.instanceId, value: actual, label: `SINH MẠCH +${actual}` });
      }
    }
    if (before < 100 && expansion.sinhQi >= 100) {
      for (const ally of this.activeLiving(side)) {
        const heal = Math.min(Math.round(ally.pow.maxHp * 0.20), Math.max(0, ally.pow.maxHp - ally.hp));
        ally.hp += heal;
        const shield = this.addShield(ally, ally.pow.maxHp * 0.15, 0.50);
        this.cleanseOne(ally);
        this.cleanseOne(ally);
        if (heal > 0) feedback.push({ kind: 'heal', targetId: ally.instanceId, value: heal, label: `LUÂN SINH +${heal}` });
        if (shield > 0) feedback.push({ kind: 'shield', targetId: ally.instanceId, value: shield, label: `LUÂN SINH KHIÊN +${shield}` });
      }
      expansion.sinhQi = 0;
    }
    return feedback;
  }

  private rebirthRescue(side: CombatSide): LegacyDomainFeedback[] {
    const expansion = this.side[side].expansion;
    if (!expansion || expansion.id !== 'rebirth_wood' || expansion.sinhQi < 20) return [];
    const feedback: LegacyDomainFeedback[] = [];
    for (const unit of this.units.filter((candidate) => candidate.side === side && !candidate.alive)) {
      if (expansion.sinhQi < 20) break;
      expansion.sinhQi -= 20;
      unit.hp = Math.max(1, Math.round(unit.pow.maxHp * 0.15));
      unit.alive = true;
      unit.actionLocked = false;
      feedback.push({ kind: 'revive', targetId: unit.instanceId, value: unit.hp, label: `LUÂN SINH CỨU +${unit.hp} HP` });
    }
    return feedback;
  }

  private addCold(target: CombatUnitState, sourceSide: CombatSide): number {
    const rt = this.domainRuntime(target);
    const potency = 1 - this.simpleExpansionResistance(target.side);
    rt.coldStacks = clamp(rt.coldStacks + 1, 1, 3);
    rt.coldActionsRemaining = 4;
    rt.coldOutgoingPenalty = 0.07 * rt.coldStacks * potency;
    target.speed = Math.max(1, target.pow.speed * (1 - 0.10 * rt.coldStacks * potency));
    if (rt.coldStacks >= 3) {
      rt.coldStacks = 0;
      rt.coldActionsRemaining = 0;
      rt.coldOutgoingPenalty = 0;
      target.controlStatus = 'freeze';
      target.controlActionsRemaining = Math.max(target.controlActionsRemaining, 1);
    }
    void sourceSide;
    return rt.coldStacks === 0 ? 3 : rt.coldStacks;
  }

  private tickDomainDebuffs(unit: CombatUnitState): void {
    const rt = this.domainRuntime(unit);
    if (rt.coldActionsRemaining > 0) {
      rt.coldActionsRemaining -= 1;
      if (rt.coldActionsRemaining <= 0) {
        rt.coldStacks = 0;
        rt.coldOutgoingPenalty = 0;
      }
    }
    if (rt.domainDefensePenaltyActionsRemaining > 0) {
      rt.domainDefensePenaltyActionsRemaining -= 1;
      if (rt.domainDefensePenaltyActionsRemaining <= 0) rt.domainDefensePenalty = 0;
    }
  }

  domainDefensePenalty(unit: CombatUnitState): number {
    const rt = this.domainRuntime(unit);
    return rt.domainDefensePenaltyActionsRemaining > 0 ? rt.domainDefensePenalty : 0;
  }

  private refreshMaxHp(side: CombatSide): void {
    for (const unit of this.units.filter((candidate) => candidate.side === side)) {
      const rt = this.domainRuntime(unit);
      const previousMax = Math.max(1, Number(unit.pow.maxHp) || rt.baseMaxHp);
      const nextMax = Math.max(1, Math.round(rt.baseMaxHp * (1 + this.profile(unit).hp)));
      if (nextMax > previousMax && unit.alive) unit.hp = Math.min(nextMax, unit.hp + (nextMax - previousMax));
      else if (nextMax < previousMax) unit.hp = Math.min(unit.hp, nextMax);
      unit.pow.maxHp = nextMax;
      if (!unit.alive) unit.hp = 0;
    }
  }

  private addShield(unit: CombatUnitState, amount: number, capRatio: number): number {
    const cap = Math.max(1, Math.round(unit.pow.maxHp * Math.max(0, capRatio)));
    const before = Math.max(0, unit.shield);
    unit.shield = Math.min(cap, before + Math.max(0, Math.round(amount)));
    return Math.max(0, unit.shield - before);
  }

  private dealRawDamage(target: CombatUnitState, amount: number): number {
    if (!target.alive || amount <= 0) return 0;
    const safe = Math.max(1, Math.round(amount));
    const shieldDamage = Math.min(target.shield, safe);
    const hpDamage = Math.min(target.hp, Math.max(0, safe - shieldDamage));
    target.shield = Math.max(0, target.shield - shieldDamage);
    target.hp = Math.max(0, target.hp - hpDamage);
    target.alive = target.hp > 0;
    return shieldDamage + hpDamage;
  }

  private cleanseOne(unit: CombatUnitState): boolean {
    if (unit.controlActionsRemaining > 0 || unit.silenceActionsRemaining > 0 || unit.paralysisActionsRemaining > 0 || unit.freezeStage > 0) {
      unit.controlStatus = null;
      unit.controlActionsRemaining = 0;
      unit.silenceActionsRemaining = 0;
      unit.paralysisActionsRemaining = 0;
      unit.freezeStage = 0;
      unit.freezeStageActionsRemaining = 0;
      return true;
    }
    if (unit.burnActionsRemaining > 0) { unit.burnActionsRemaining = 0; unit.burnDamage = 0; return true; }
    if (unit.poisonActionsRemaining > 0) { unit.poisonActionsRemaining = 0; unit.poisonStacks = 0; return true; }
    if (unit.antiHealActionsRemaining > 0) { unit.antiHealActionsRemaining = 0; unit.antiHeal = 0; return true; }
    return false;
  }

  private activeLiving(side: CombatSide): CombatUnitState[] {
    return this.units.filter((unit) => unit.side === side && unit.alive && unit.fieldSlot !== null);
  }

  private domainRuntime(unit: CombatUnitState): UnitDomainRuntime {
    let runtime = this.runtime.get(unit);
    if (!runtime) {
      runtime = {
        baseMaxHp: Math.max(1, Number(unit.pow.maxHp) || 1),
        coldStacks: 0,
        coldActionsRemaining: 0,
        coldOutgoingPenalty: 0,
        domainDefensePenalty: 0,
        domainDefensePenaltyActionsRemaining: 0
      };
      this.runtime.set(unit, runtime);
      DOMAIN_BY_UNIT.set(unit, this);
    }
    return runtime;
  }

  private readonly marks = new WeakMap<CombatUnitState, Partial<Record<CombatSide, number>>>();

  private mark(unit: CombatUnitState, side: CombatSide): number {
    return clamp(Number(this.marks.get(unit)?.[side]) || 0, 0, 4);
  }

  private setMark(unit: CombatUnitState, side: CombatSide, value: number): number {
    const row = this.marks.get(unit) ?? {};
    row[side] = clamp(Math.round(value), 0, 4);
    this.marks.set(unit, row);
    return row[side] || 0;
  }
}
