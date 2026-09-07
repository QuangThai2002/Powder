import { pruneControlHistory } from './CombatControlEngine';
import { CombatState, type CombatUnitState } from './CombatState';

const TURN_DISTANCE = 1000;

/**
 * Deterministic timeline scheduler for Combat 2.0+.
 * Durations and cooldowns tick only when that Pow completes its own turn, so
 * one "turn" is measured from the Pow's action to its next action rather than
 * from unrelated actions elsewhere on the field.
 */
export class TurnManager {
  private readonly state: CombatState;
  private readonly nextReadyAt = new Map<string, number>();
  private timelineNow = 0;
  private actedThisRound = new Set<string>();

  constructor(state: CombatState) {
    this.state = state;
    this.resetTimeline();
  }

  resetTimeline(): void {
    this.timelineNow = 0;
    this.actedThisRound.clear();
    this.nextReadyAt.clear();
    this.state.currentUnitId = null;
    this.state.phase = 'ready';
    this.state.sanitizeRuntimeNumbers();

    for (const unit of this.state.activeLiving()) {
      const initiativeLead = Math.min(0.92, Math.max(0, Number(unit.initialInitiative) || 0) / 100);
      this.nextReadyAt.set(unit.instanceId, this.intervalFor(unit) * (1 - initiativeLead));
    }
  }

  peekNext(): CombatUnitState | null { return this.findNextUnit(); }

  beginNextTurn(): CombatUnitState | null {
    if (this.state.isBattleOver()) {
      this.state.phase = 'finished';
      this.state.currentUnitId = null;
      return null;
    }
    if (this.state.phase === 'resolving') return null;

    this.state.sanitizeRuntimeNumbers();
    const unit = this.findNextUnit();
    if (!unit) {
      this.state.phase = 'finished';
      this.state.currentUnitId = null;
      return null;
    }

    const readyAt = this.safeTimelineValue(
      this.nextReadyAt.get(unit.instanceId),
      this.timelineNow + this.intervalFor(unit)
    );
    this.timelineNow = Math.max(this.timelineNow, readyAt);
    this.state.currentUnitId = unit.instanceId;
    this.state.phase = 'selecting';
    unit.actionLocked = false;
    return unit;
  }

  lockAction(unitId: string): boolean {
    const unit = this.state.getUnit(unitId);
    if (
      !unit || !unit.alive || unit.fieldSlot === null || unit.actionLocked ||
      this.state.phase !== 'selecting' || this.state.currentUnitId !== unitId
    ) return false;
    unit.actionLocked = true;
    this.state.phase = 'resolving';
    return true;
  }

  completeAction(unitId: string): void {
    const unit = this.state.getUnit(unitId);
    if (unit) {
      unit.actionLocked = false;
      this.tickActorDurations(unit);
      if (unit.alive && unit.fieldSlot !== null) {
        this.nextReadyAt.set(unit.instanceId, this.timelineNow + this.intervalFor(unit));
        this.actedThisRound.add(unit.instanceId);
      } else this.retireUnit(unit.instanceId);
    }

    this.state.currentUnitId = null;
    this.state.sanitizeRuntimeNumbers();
    if (this.state.isBattleOver()) {
      this.state.phase = 'finished';
      return;
    }
    this.advanceRoundIfNeeded();
    this.state.phase = 'ready';
  }

  registerPromoted(unitId: string): void {
    const unit = this.state.getUnit(unitId);
    if (!unit?.alive || unit.fieldSlot === null) return;
    unit.actionLocked = false;
    this.actedThisRound.delete(unitId);
    this.nextReadyAt.set(unitId, this.timelineNow + this.intervalFor(unit));
  }

  retireUnit(unitId: string): void {
    this.nextReadyAt.delete(unitId);
    this.actedThisRound.delete(unitId);
  }

  rescheduleUnit(unitId: string): void {
    const unit = this.state.getUnit(unitId);
    if (!unit?.alive || unit.fieldSlot === null || this.state.currentUnitId === unitId) return;
    this.nextReadyAt.set(unit.instanceId, this.timelineNow + this.intervalFor(unit));
  }

  /** Delay the next action by a fraction of that Pow's normal timeline interval. */
  delayUnit(unitId: string, intervalRatio: number): void {
    const unit = this.state.getUnit(unitId);
    if (!unit?.alive || unit.fieldSlot === null || this.state.currentUnitId === unitId) return;
    const ratio = Math.min(1, Math.max(0, Number.isFinite(intervalRatio) ? intervalRatio : 0));
    const current = this.safeTimelineValue(this.nextReadyAt.get(unitId), this.timelineNow + this.intervalFor(unit));
    this.nextReadyAt.set(unitId, current + this.intervalFor(unit) * ratio);
  }

  /** Advance a non-active Pow by a fraction of its normal timeline interval. */
  advanceUnit(unitId: string, intervalRatio: number): void {
    const unit = this.state.getUnit(unitId);
    if (!unit?.alive || unit.fieldSlot === null || this.state.currentUnitId === unitId) return;
    const ratio = Math.min(1, Math.max(0, Number.isFinite(intervalRatio) ? intervalRatio : 0));
    const current = this.safeTimelineValue(this.nextReadyAt.get(unitId), this.timelineNow + this.intervalFor(unit));
    this.nextReadyAt.set(unitId, Math.max(this.timelineNow, current - this.intervalFor(unit) * ratio));
  }

  recoverActionLock(): void {
    const current = this.state.currentUnitId ? this.state.getUnit(this.state.currentUnitId) : undefined;
    if (current) current.actionLocked = false;
    this.state.currentUnitId = null;
    this.state.sanitizeRuntimeNumbers();
    this.state.phase = this.state.isBattleOver() ? 'finished' : 'ready';
  }

  private tickActorDurations(unit: CombatUnitState): void {
    let speedStateChanged = false;

    unit.skillCooldownActionsRemaining = [
      Math.max(0, unit.skillCooldownActionsRemaining[0] - 1),
      Math.max(0, unit.skillCooldownActionsRemaining[1] - 1)
    ];
    unit.ultimateCooldownActionsRemaining = Math.max(0, unit.ultimateCooldownActionsRemaining - 1);

    if (unit.silenceActionsRemaining > 0) unit.silenceActionsRemaining -= 1;
    if (unit.paralysisActionsRemaining > 0) unit.paralysisActionsRemaining -= 1;
    if (unit.controlImmunityActionsRemaining > 0) unit.controlImmunityActionsRemaining -= 1;

    if (unit.freezeStageActionsRemaining > 0) {
      unit.freezeStageActionsRemaining -= 1;
      if (unit.freezeStageActionsRemaining <= 0) {
        unit.freezeStage = 0;
        speedStateChanged = true;
      }
    }

    if (unit.speedBuffActionsRemaining > 0) {
      unit.speedBuffActionsRemaining -= 1;
      speedStateChanged = true;
    }
    if (unit.speedDebuffActionsRemaining > 0) {
      unit.speedDebuffActionsRemaining -= 1;
      speedStateChanged = true;
    }

    if (unit.attackBuffActionsRemaining > 0) {
      unit.attackBuffActionsRemaining -= 1;
      if (unit.attackBuffActionsRemaining <= 0) unit.attackMultiplier = 1;
    }
    if (unit.abilityPowerBuffActionsRemaining > 0) {
      unit.abilityPowerBuffActionsRemaining -= 1;
      if (unit.abilityPowerBuffActionsRemaining <= 0) unit.abilityPowerMultiplier = 1;
    }
    if (unit.defenseBuffActionsRemaining > 0) {
      unit.defenseBuffActionsRemaining -= 1;
      if (unit.defenseBuffActionsRemaining <= 0) unit.defenseMultiplier = 1;
    }

    if (unit.critBuffActionsRemaining > 0) {
      unit.critBuffActionsRemaining -= 1;
      if (unit.critBuffActionsRemaining <= 0) unit.critRateBonus = 0;
    }
    if (unit.evasionBuffActionsRemaining > 0) {
      unit.evasionBuffActionsRemaining -= 1;
      if (unit.evasionBuffActionsRemaining <= 0) unit.evasionBonus = 0;
    }
    if (unit.accuracyDebuffActionsRemaining > 0) {
      unit.accuracyDebuffActionsRemaining -= 1;
      if (unit.accuracyDebuffActionsRemaining <= 0) unit.accuracyBonus = 0;
    }
    if (unit.tenacityBuffActionsRemaining > 0) {
      unit.tenacityBuffActionsRemaining -= 1;
      if (unit.tenacityBuffActionsRemaining <= 0) unit.tenacityBonus = 0;
    }
    if (unit.guardActionsRemaining > 0) {
      unit.guardActionsRemaining -= 1;
      if (unit.guardActionsRemaining <= 0) unit.damageReductionBonus = 0;
    }
    if (unit.antiHealActionsRemaining > 0) {
      unit.antiHealActionsRemaining -= 1;
      if (unit.antiHealActionsRemaining <= 0) {
        unit.antiHeal = 0;
        unit.grievousTier = null;
      }
    }
    // Regeneration is a start-of-turn effect. Its duration is consumed only
    // after an actual regeneration tick so casting it never burns one tick immediately.

    if (unit.controlActionsRemaining > 0) {
      unit.controlActionsRemaining -= 1;
      if (unit.controlActionsRemaining <= 0) unit.controlStatus = null;
    }
    if (unit.reviveMarkerActionsRemaining > 0) unit.reviveMarkerActionsRemaining -= 1;

    if (speedStateChanged) this.state.refreshSpeed(unit);
  }

  private findNextUnit(): CombatUnitState | null {
    let best: CombatUnitState | null = null;
    let bestTime = Number.POSITIVE_INFINITY;
    for (const unit of this.state.activeLiving()) {
      const fallback = this.timelineNow + this.intervalFor(unit);
      const readyAt = this.safeTimelineValue(this.nextReadyAt.get(unit.instanceId), fallback);
      if (readyAt < bestTime) {
        best = unit;
        bestTime = readyAt;
        continue;
      }
      if (readyAt === bestTime && best && unit.speed > best.speed) best = unit;
    }
    return best;
  }

  private intervalFor(unit: CombatUnitState): number {
    const speed = Number.isFinite(unit.speed) && unit.speed > 0 ? unit.speed : 1;
    return TURN_DISTANCE / Math.min(9999, Math.max(1, speed));
  }

  private safeTimelineValue(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && (value as number) >= 0 ? (value as number) : fallback;
  }

  private advanceRoundIfNeeded(): void {
    const activeIds = this.state.activeLiving().map((unit) => unit.instanceId);
    if (activeIds.length > 0 && activeIds.every((instanceId) => this.actedThisRound.has(instanceId))) {
      this.state.round += 1;
      this.actedThisRound.clear();
      for (const unit of this.state.units) pruneControlHistory(unit, this.state.round);
    }
  }
}
