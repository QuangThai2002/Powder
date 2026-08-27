import type { CombatSide } from '../data/CombatPow';
import {
  CombatLegacyDomainEngine,
  combatLegacyDomainForUnit,
  type LegacyDomainFeedback
} from '../systems/CombatLegacyDomainEngine';
import { CombatState, type CombatUnitState } from '../systems/CombatState';

const PATCH_FLAG = '__powderCombat295LegacyDomainParityInstalled';
const SWORDS = [
  { id: 'flame', name: 'XÍCH DIỆM PHẦN THIÊN KIẾM' },
  { id: 'poison', name: 'VẠN ĐỘC PHỆ TÂM KIẾM' },
  { id: 'thunder', name: 'THIÊN LÔI TRẤN PHÁ KIẾM' },
  { id: 'sever', name: 'ĐOẠN SINH TUYỆT MẠCH KIẾM' },
  { id: 'ice', name: 'HUYỀN BĂNG PHONG NGỤC KIẾM' }
] as const;

type Sword = typeof SWORDS[number];

const swordDecks = new WeakMap<CombatLegacyDomainEngine, Record<CombatSide, Sword[]>>();

function otherSide(side: CombatSide): CombatSide {
  return side === 'player' ? 'enemy' : 'player';
}

function units(engine: CombatLegacyDomainEngine): CombatUnitState[] {
  const raw = (engine as any).units;
  return Array.isArray(raw) ? raw as CombatUnitState[] : [];
}

function activeLiving(engine: CombatLegacyDomainEngine, side: CombatSide): CombatUnitState[] {
  return units(engine).filter((unit) => unit.side === side && unit.alive && unit.fieldSlot !== null);
}

function shuffleSwords(): Sword[] {
  const deck = [...SWORDS];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function deckFor(engine: CombatLegacyDomainEngine, side: CombatSide): Sword[] {
  let decks = swordDecks.get(engine);
  if (!decks) {
    decks = { player: [], enemy: [] };
    swordDecks.set(engine, decks);
  }
  if (decks[side].length <= 0) decks[side] = shuffleSwords();
  return decks[side];
}

function dealRawDamage(target: CombatUnitState, amount: number): number {
  if (!target.alive || amount <= 0) return 0;
  const safe = Math.max(1, Math.round(amount));
  const shieldDamage = Math.min(Math.max(0, target.shield), safe);
  const hpDamage = Math.min(Math.max(0, target.hp), Math.max(0, safe - shieldDamage));
  target.shield = Math.max(0, target.shield - shieldDamage);
  target.hp = Math.max(0, target.hp - hpDamage);
  target.alive = target.hp > 0;
  return shieldDamage + hpDamage;
}

function applySwordStatus(target: CombatUnitState, sword: Sword): void {
  switch (sword.id) {
    case 'flame':
      target.burnDamage = Math.max(target.burnDamage, Math.max(1, Math.round(target.pow.maxHp * 0.06)));
      target.burnActionsRemaining = Math.max(target.burnActionsRemaining, 3);
      break;
    case 'poison':
      target.poisonStacks = Math.min(6, Math.max(1, target.poisonStacks + 1));
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
}

function refreshedSpeed(unit: CombatUnitState): number {
  const base = Number.isFinite(unit.pow.speed) && unit.pow.speed > 0 ? unit.pow.speed : 1;
  let multiplier = 1;
  if (unit.speedBuffActionsRemaining > 0) multiplier *= 1.2;
  if (unit.speedDebuffActionsRemaining > 0) multiplier *= 0.8;
  if (unit.freezeStage === 1 && unit.freezeStageActionsRemaining > 0) multiplier *= 0.9;
  if (unit.freezeStage === 2 && unit.freezeStageActionsRemaining > 0) multiplier *= 0.8;
  return Math.max(1, base * multiplier);
}

function installDrawSwordParity(): void {
  const proto = CombatLegacyDomainEngine.prototype as any;
  if (proto.__powderCombat295DrawSword) return;
  proto.__powderCombat295DrawSword = true;

  const originalActivate = proto.activateExpansion;
  proto.activateExpansion = function combat295ActivateExpansion(side: CombatSide, mode: 'pve' | 'pvp'): any {
    const result = originalActivate.call(this, side, mode);
    if (result?.ok && this.snapshot(side).expansion?.id === 'draw_swords') {
      let decks = swordDecks.get(this);
      if (!decks) {
        decks = { player: [], enemy: [] };
        swordDecks.set(this, decks);
      }
      decks[side] = shuffleSwords();
    }
    return result;
  };

  proto.drawSword = function combat295DrawSword(actor: CombatUnitState): LegacyDomainFeedback[] {
    const expansion = this.snapshot(actor.side).expansion;
    if (!expansion || expansion.id !== 'draw_swords') return [];
    const foes = activeLiving(this, otherSide(actor.side));
    if (!foes.length) return [];

    const deck = deckFor(this, actor.side);
    const sword = deck.shift()!;
    const target = foes[Math.floor(Math.random() * foes.length)] || foes[0];
    const resistance = this.simpleExpansionResistance(target.side);
    const damage = dealRawDamage(target, Math.round(target.pow.maxHp * 0.20 * (1 - resistance)));
    applySwordStatus(target, sword);
    return [{
      kind: 'damage',
      targetId: target.instanceId,
      value: damage,
      label: `${sword.name} · TẤT TRÚNG -${damage}`
    }];
  };
}

function installColdSpeedCleanup(): void {
  const proto = CombatLegacyDomainEngine.prototype as any;
  if (proto.__powderCombat295ColdCleanup) return;
  proto.__powderCombat295ColdCleanup = true;
  const original = proto.tickDomainDebuffs;
  proto.tickDomainDebuffs = function combat295TickDomainDebuffs(unit: CombatUnitState): void {
    const runtime = (this as any).domainRuntime(unit);
    const coldBefore = Number(runtime?.coldActionsRemaining) || 0;
    original.call(this, unit);
    const coldAfter = Number(runtime?.coldActionsRemaining) || 0;
    if (coldBefore > 0 && coldAfter <= 0) unit.speed = refreshedSpeed(unit);
  };
}

function installPoisonSixStackSanitizer(): void {
  const proto = CombatState.prototype as any;
  if (proto.__powderCombat295PoisonSixStack) return;
  proto.__powderCombat295PoisonSixStack = true;
  const original = proto.sanitizeRuntimeNumbers;
  proto.sanitizeRuntimeNumbers = function combat295Sanitize(this: CombatState): void {
    const preserve = new Map<string, number>();
    for (const unit of this.units) {
      const engine = combatLegacyDomainForUnit(unit);
      if (!engine) continue;
      const hostile = engine.snapshot(otherSide(unit.side)).expansion;
      if (hostile?.id === 'myriad_poison' && unit.poisonStacks > 3) {
        preserve.set(unit.instanceId, Math.min(6, Math.max(0, Math.floor(unit.poisonStacks))));
      }
    }
    original.call(this);
    for (const [instanceId, stacks] of preserve) {
      const unit = this.getUnit(instanceId);
      if (unit) unit.poisonStacks = stacks;
    }
  };
}

export function installCombat295LegacyDomainParityPatch(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installDrawSwordParity();
  installColdSpeedCleanup();
  installPoisonSixStackSanitizer();
}
