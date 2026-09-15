import type { CombatAbility } from '../data/CombatPow';
import type { CombatCoreMarkState, CombatUnitState } from './CombatState';
import { ensureCombatCoreState } from './CombatState';
import { CombatIdentityRules, type ElementOutcome } from './CombatIdentityRules';
import { CombatLegacyStatEngine } from './CombatLegacyStatEngine';
import type { CombatActionProvenance } from './CombatPassiveEngine';

export const PYROON_ID = 'pyroon';
export const PYROON_FOCUS_COUNTER = 'pyroon:focus';
export const PYROON_LAST_TARGET = 'pyroon:last-target';
export const PYROON_FIRE_BAIT_MARK = 'pyroon:fire-bait';

export interface PyroonBasicFocusSnapshot {
  active: boolean;
  sameTarget: boolean;
}

export interface PyroonMechanicDamageEvent {
  kind: 'pyroon-fire-bait';
  sourceId: string;
  targetId: string;
  damage: number;
  shieldDamage: number;
  hpDamage: number;
  burnApplied: number;
  triggerIndex: number;
  focusGained: number;
  focusAfter: number;
  burnRefreshed: boolean;
  markEnded: boolean;
  elementOutcome: ElementOutcome;
  defeated: boolean;
}

export class CombatPyroonEngine {
  private readonly identity = new CombatIdentityRules();
  private readonly stats: CombatLegacyStatEngine;

  constructor(random: () => number = Math.random) {
    this.stats = new CombatLegacyStatEngine(random);
  }

  getFocus(unit: CombatUnitState): number {
    return Math.min(3, Math.max(0, Math.floor(ensureCombatCoreState(unit).counters[PYROON_FOCUS_COUNTER] || 0)));
  }

  setFocus(unit: CombatUnitState, value: number): number {
    const next = Math.min(3, Math.max(0, Math.floor(Number(value) || 0)));
    ensureCombatCoreState(unit).counters[PYROON_FOCUS_COUNTER] = next;
    return next;
  }

  canUse(actor: CombatUnitState, ability: CombatAbility): boolean {
    const mechanic = ability.pyroonMechanic;
    if (mechanic?.kind === 'focus-pierce' && this.getFocus(actor) < mechanic.focusRequired) return false;
    return this.hasMana(actor, ability);
  }

  hasMana(actor: CombatUnitState, ability: CombatAbility): boolean {
    if (ability.usesMana !== true) return true;
    return this.mana(actor) >= this.manaCost(ability);
  }

  spendMana(actor: CombatUnitState, ability: CombatAbility): number {
    if (ability.usesMana !== true) return 0;
    const cost = this.manaCost(ability);
    if (this.mana(actor) < cost) throw new Error(`[Combat2] ${actor.pow.name} does not have ${cost} Mana for ${ability.name}.`);
    actor.manaPoints = this.mana(actor) - cost;
    return cost;
  }

  mana(actor: CombatUnitState): number {
    const max = Math.max(0, Math.floor(Number(actor.maxManaPoints ?? 100) || 100));
    return Math.min(max, Math.max(0, Math.floor(Number(actor.manaPoints ?? max) || 0)));
  }

  manaCost(ability: CombatAbility): number {
    return ability.usesMana === true ? Math.max(0, Math.floor(Number(ability.manaCost) || 0)) : 0;
  }

  beginBasic(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    provenance: CombatActionProvenance
  ): PyroonBasicFocusSnapshot {
    if (ability.pyroonMechanic?.kind !== 'focus-basic' || provenance.origin !== 'main' || !provenance.directDamage) {
      return { active: false, sameTarget: false };
    }
    const state = ensureCombatCoreState(actor);
    const previous = String(state.values[PYROON_LAST_TARGET] || '');
    const sameTarget = previous === target.instanceId;
    if (previous && !sameTarget) this.setFocus(actor, 0);
    return { active: true, sameTarget };
  }

  completeBasic(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    snapshot: PyroonBasicFocusSnapshot,
    landed: boolean,
    critical: boolean
  ): number {
    if (!snapshot.active || ability.pyroonMechanic?.kind !== 'focus-basic') return 0;
    ensureCombatCoreState(actor).values[PYROON_LAST_TARGET] = target.instanceId;
    if (!landed) return 0;
    const mechanic = ability.pyroonMechanic;
    const gain = Math.min(
      mechanic.actionGainCap,
      (snapshot.sameTarget ? mechanic.sameTargetGain : 0) + (critical ? mechanic.critGain : 0)
    );
    const before = this.getFocus(actor);
    const after = this.setFocus(actor, Math.min(mechanic.focusCap, before + gain));
    return after - before;
  }

  consumeFocusForPierce(actor: CombatUnitState, ability: CombatAbility, target: CombatUnitState): number {
    if (ability.pyroonMechanic?.kind !== 'focus-pierce') return 0;
    const focus = this.getFocus(actor);
    if (focus < ability.pyroonMechanic.focusRequired) {
      throw new Error(`[Combat2] ${ability.name} requires ${ability.pyroonMechanic.focusRequired} Tập Trung.`);
    }
    ensureCombatCoreState(actor).values[PYROON_LAST_TARGET] = target.instanceId;
    if (ability.pyroonMechanic.consumeAllFocus) this.setFocus(actor, 0);
    return focus;
  }

  placeFireBait(source: CombatUnitState, target: CombatUnitState, ability: CombatAbility): boolean {
    const mechanic = ability.pyroonMechanic;
    if (mechanic?.kind !== 'fire-bait' || !target.alive) return false;
    ensureCombatCoreState(target).marks[this.fireBaitKey(source.instanceId)] = {
      kind: 'pyroon-fire-bait',
      sourceInstanceId: source.instanceId,
      remainingActions: Math.max(1, Math.floor(mechanic.durationActions)),
      remainingTriggers: Math.max(1, Math.floor(mechanic.triggerLimit)),
      triggerCount: 0
    };
    return true;
  }

  hasFireBait(target: CombatUnitState, sourceInstanceId?: string): boolean {
    return this.activeFireBaits(target).some((entry) => !sourceInstanceId || entry.mark.sourceInstanceId === sourceInstanceId);
  }

  preferredUltimateTarget(
    source: CombatUnitState,
    requestedTarget: CombatUnitState,
    units: readonly CombatUnitState[]
  ): CombatUnitState | null {
    const enemies = this.livingEnemies(source, units);
    const marked = enemies.find((unit) => this.hasFireBait(unit, source.instanceId));
    if (marked) return marked;
    if (requestedTarget.alive && requestedTarget.side !== source.side && requestedTarget.fieldSlot !== null) return requestedTarget;
    return this.lowestHp(enemies);
  }

  nextUltimateTarget(source: CombatUnitState, locked: CombatUnitState, units: readonly CombatUnitState[]): CombatUnitState | null {
    if (locked.alive && locked.fieldSlot !== null) return locked;
    return this.lowestHp(this.livingEnemies(source, units));
  }

  resolveFireBait(
    actor: CombatUnitState,
    target: CombatUnitState,
    provenance: CombatActionProvenance,
    directDamage: number,
    units: readonly CombatUnitState[]
  ): PyroonMechanicDamageEvent[] {
    if (!target.alive || !provenance.directDamage || provenance.origin === 'dot' || provenance.actionType === 'status-tick' || directDamage <= 0) return [];
    const events: PyroonMechanicDamageEvent[] = [];
    for (const { key, mark } of this.activeFireBaits(target)) {
      const source = units.find((unit) => unit.instanceId === mark.sourceInstanceId);
      if (!source?.alive || source.side !== actor.side || source.side === target.side) continue;
      const ability = source.pow.abilities.skills[1];
      const mechanic = ability?.pyroonMechanic;
      if (mechanic?.kind !== 'fire-bait') continue;

      mark.remainingTriggers = Math.max(0, mark.remainingTriggers - 1);
      mark.triggerCount += 1;
      const hit = this.stats.resolveHit(source, target, {
        offenseStat: 'attack',
        critMode: 'never',
        unavoidable: true
      });
      const identity = this.identity.evaluateDamage(source, target, 'skill', 'physical', {
        combo: source.combo,
        sameElementAllies: units.filter((unit) => (
          unit.side === source.side && unit.alive && unit.instanceId !== source.instanceId &&
          unit.pow.elementKey === source.pow.elementKey
        )).length
      });
      const damage = identity.totalMultiplier <= 0
        ? 0
        : Math.max(1, Math.round(
            mechanic.procAttackRatio * hit.offense * (1 - hit.mitigation) *
            identity.totalMultiplier * (1 - hit.damageReduction)
          ));
      const shieldBefore = Math.max(0, Number(target.shield) || 0);
      const shieldDamage = Math.min(shieldBefore, damage);
      const hpDamage = Math.max(0, damage - shieldDamage);
      target.shield = Math.max(0, shieldBefore - shieldDamage);
      target.hp = Math.max(0, target.hp - hpDamage);
      target.alive = target.hp > 0;
      const burnRefreshed = target.burnActionsRemaining > 0 && target.burnDamage > 0;
      this.applyBurn(source, target, damage);

      const focusBefore = this.getFocus(source);
      const focusAfter = mark.triggerCount >= mechanic.triggerLimit
        ? this.setFocus(source, focusBefore + mechanic.focusOnFinalTrigger)
        : focusBefore;
      const markEnded = mark.remainingTriggers <= 0;
      events.push({
        kind: 'pyroon-fire-bait',
        sourceId: source.instanceId,
        targetId: target.instanceId,
        damage,
        shieldDamage,
        hpDamage,
        burnApplied: mechanic.burnPerTrigger,
        triggerIndex: mark.triggerCount,
        focusGained: focusAfter - focusBefore,
        focusAfter,
        burnRefreshed,
        markEnded,
        elementOutcome: identity.outcome,
        defeated: !target.alive
      });
      if (markEnded) delete ensureCombatCoreState(target).marks[key];
    }
    return events;
  }

  completeMainAction(actor: CombatUnitState, provenance: CombatActionProvenance): void {
    if (provenance.origin !== 'main') return;
    const state = ensureCombatCoreState(actor);
    for (const [key, mark] of Object.entries(state.marks)) {
      if (mark.kind !== 'pyroon-fire-bait') continue;
      mark.remainingActions = Math.max(0, mark.remainingActions - 1);
      if (mark.remainingActions <= 0 || mark.remainingTriggers <= 0) delete state.marks[key];
    }
  }

  private activeFireBaits(target: CombatUnitState): Array<{ key: string; mark: CombatCoreMarkState }> {
    return Object.entries(ensureCombatCoreState(target).marks)
      .filter((entry): entry is [string, CombatCoreMarkState] => (
        entry[1]?.kind === 'pyroon-fire-bait' && entry[1].remainingActions > 0 && entry[1].remainingTriggers > 0
      ))
      .map(([key, mark]) => ({ key, mark }));
  }

  private livingEnemies(source: CombatUnitState, units: readonly CombatUnitState[]): CombatUnitState[] {
    return units
      .filter((unit) => unit.side !== source.side && unit.alive && unit.fieldSlot !== null)
      .sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));
  }

  private lowestHp(units: readonly CombatUnitState[]): CombatUnitState | null {
    return [...units].sort((a, b) => {
      const ratio = a.hp / Math.max(1, a.pow.maxHp) - b.hp / Math.max(1, b.pow.maxHp);
      return Math.abs(ratio) > 1e-9 ? ratio : (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99);
    })[0] ?? null;
  }

  private fireBaitKey(sourceInstanceId: string): string {
    return `${PYROON_FIRE_BAIT_MARK}:${sourceInstanceId}`;
  }

  private applyBurn(source: CombatUnitState, target: CombatUnitState, impactDamage: number): void {
    const seed = impactDamage > 0 ? impactDamage : Math.max(1, source.pow.attack * 0.18);
    const tick = Math.max(1, Math.min(Math.round(target.pow.maxHp * 0.12), Math.round(seed * 0.3)));
    target.burnDamage = Math.max(target.burnDamage, tick);
    target.burnActionsRemaining = Math.max(target.burnActionsRemaining, 2);
    target.dotStatus = 'burn';
    target.dotDamage = target.burnDamage;
    target.dotActionsRemaining = target.burnActionsRemaining;
  }
}
