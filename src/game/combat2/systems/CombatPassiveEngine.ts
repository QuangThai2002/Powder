import type { CombatUnitState } from './CombatState';
import { effectiveHealingReduction } from './CombatHealingReduction';

export interface PassiveActionContext {
  combo?: number;
  sameElementAllies?: number;
}

export interface PassiveRuntimeEvent {
  type: 'heal' | 'status' | 'team-buff';
  passiveId: string;
  targetIds: string[];
  amount?: number;
  status?: string;
}

export class CombatPassiveEngine {
  advanceCombo(current: number, academicCorrect: boolean): number {
    return academicCorrect ? Math.min(5, Math.max(0, Math.floor(this.number(current))) + 1) : 0;
  }

  attackMultiplier(unit: CombatUnitState): number {
    return this.statMultiplier(unit, 'attack');
  }

  defenseMultiplier(unit: CombatUnitState): number {
    return this.statMultiplier(unit, 'defense');
  }

  outgoingDamageMultiplier(actor: CombatUnitState, context: PassiveActionContext = {}): number {
    const effect = actor.pow.passive?.mechanic?.effect;
    const condition = actor.pow.passive?.mechanic?.condition;
    if (!effect || !this.conditionMatches(actor, context)) return 1;
    if (effect.kind === 'damageMultiplier') return 1 + this.number(effect.coefficient);
    if (effect.kind === 'damageMultiplierPerStack') {
      const combo = Math.max(0, Math.floor(this.number(context.combo)));
      return 1 + Math.min(this.number(effect.maxBonus), combo * this.number(effect.coefficient));
    }
    if (condition?.kind === 'minimumSameElementAllies' && this.number(context.sameElementAllies) < this.number(condition.value)) return 1;
    return 1;
  }

  extraTurnChance(
    actor: CombatUnitState,
    target: CombatUnitState,
    baseChance: number,
    context: PassiveActionContext = {}
  ): number {
    const effect = actor.pow.passive?.mechanic?.effect;
    const condition = actor.pow.passive?.mechanic?.condition;
    if (effect?.kind !== 'extraTurnChance' || condition?.kind !== 'speedRatioAbove') return Math.min(0.35, Math.max(0, baseChance));
    const threshold = this.number(condition.value);
    if (actor.speed <= Math.max(1, target.speed) * threshold || !this.conditionMatches(actor, context)) return Math.min(0.35, Math.max(0, baseChance));
    return Math.min(this.number(effect.maxChance) || 0.35, Math.max(0, baseChance) + this.number(effect.coefficient));
  }

  applyAfterAction(
    actor: CombatUnitState,
    target: CombatUnitState,
    allies: CombatUnitState[],
    context: PassiveActionContext = {},
    random: () => number = Math.random
  ): PassiveRuntimeEvent[] {
    const passive = actor.pow.passive;
    const mechanic = passive?.mechanic;
    if (!passive || mechanic?.trigger !== 'AFTER_ACTION' || !this.conditionMatches(actor, context)) return [];
    const effect = mechanic.effect;
    const livingAllies = allies.filter((unit) => unit.alive && unit.fieldSlot !== null);

    if (effect.kind === 'healMaxHp') {
      if (this.number(effect.perBattleLimit) > 0 && actor.passiveUsed) return [];
      const recipients = effect.targetRule === 'allLivingAllies' ? livingAllies : [actor];
      let total = 0;
      const targetIds: string[] = [];
      for (const recipient of recipients) {
        const reduction = effectiveHealingReduction(recipient.grievousTier, [recipient.antiHeal]);
        const amount = Math.max(0, Math.round(recipient.pow.maxHp * this.number(effect.coefficient) * (1 - reduction)));
        const healed = Math.min(Math.max(0, recipient.pow.maxHp - recipient.hp), amount);
        recipient.hp += healed;
        if (healed > 0) { total += healed; targetIds.push(recipient.instanceId); }
      }
      if (this.number(effect.perBattleLimit) > 0) actor.passiveUsed = true;
      return total > 0 ? [{ type: 'heal', passiveId: passive.id, targetIds, amount: total }] : [];
    }

    if (effect.kind === 'applyStatus') {
      if (!target.alive || target.fieldSlot === null) return [];
      if (this.safeRandom(random) >= this.number(effect.chance)) return [];
      target.controlStatus = effect.status === 'stun' ? 'stun' : target.controlStatus;
      target.controlActionsRemaining = Math.max(target.controlActionsRemaining, Math.floor(this.number(effect.duration)));
      return [{ type: 'status', passiveId: passive.id, targetIds: [target.instanceId], status: String(effect.status || '') }];
    }

    if (effect.kind === 'rotatingTeamBuff') {
      const sequence = Array.isArray(effect.sequence) ? effect.sequence : [];
      const combo = Math.max(0, Math.floor(this.number(context.combo)));
      const stat = String(sequence[combo % Math.max(1, sequence.length)] || 'attack');
      const duration = Math.max(1, Math.floor(this.number(effect.duration)));
      for (const ally of livingAllies) {
        if (stat === 'defense') { ally.defenseMultiplier = Math.max(ally.defenseMultiplier, 1.3); ally.defenseBuffActionsRemaining = Math.max(ally.defenseBuffActionsRemaining, duration); }
        else if (stat === 'ability-power') { ally.abilityPowerMultiplier = Math.max(ally.abilityPowerMultiplier, 1.3); ally.abilityPowerBuffActionsRemaining = Math.max(ally.abilityPowerBuffActionsRemaining, duration); }
        else { ally.attackMultiplier = Math.max(ally.attackMultiplier, 1.3); ally.attackBuffActionsRemaining = Math.max(ally.attackBuffActionsRemaining, duration); }
      }
      return [{ type: 'team-buff', passiveId: passive.id, targetIds: livingAllies.map((unit) => unit.instanceId), status: stat }];
    }

    return [];
  }

  private statMultiplier(unit: CombatUnitState, stat: 'attack' | 'defense'): number {
    const effect = unit.pow.passive?.mechanic?.effect;
    if (effect?.kind !== 'statMultiplier' || effect.stat !== stat) return 1;
    const maxHp = Math.max(1, Number(unit.pow.maxHp) || 1);
    const missing = Math.min(1, Math.max(0, 1 - (Number(unit.hp) || 0) / maxHp));
    return 1 + missing * this.number(effect.coefficient);
  }

  private conditionMatches(actor: CombatUnitState, context: PassiveActionContext): boolean {
    const condition = actor.pow.passive?.mechanic?.condition;
    if (!condition) return true;
    if (condition.kind === 'minimumCombo') return this.number(context.combo) >= this.number(condition.value);
    if (condition.kind === 'minimumSameElementAllies') return this.number(context.sameElementAllies) >= this.number(condition.value);
    if (condition.kind === 'hpRatioAtMost') return actor.hp / Math.max(1, actor.pow.maxHp) <= this.number(condition.value);
    if (condition.kind === 'speedRatioAbove') return true;
    if (condition.kind === 'missingHpRatio') return actor.hp < actor.pow.maxHp;
    return false;
  }

  private number(value: unknown): number { return Number.isFinite(Number(value)) ? Number(value) : 0; }
  private safeRandom(random: () => number): number {
    const value = Number(random());
    return Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0.5;
  }


  speedExtraTurnChance(actor: CombatUnitState, target: CombatUnitState): number {
    const targetSpeed = Math.max(1, Number(target.speed) || 1);
    const ratio = (Number(actor.speed) || 0) / targetSpeed;
    const baseChance = ratio > 1.15 ? Math.min(0.35, Math.max(0, (ratio - 1.15) * 0.42)) : 0;
    return this.extraTurnChance(actor, target, baseChance);
  }
}
