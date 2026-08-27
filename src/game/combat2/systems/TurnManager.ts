import { CombatState, type CombatUnitState } from './CombatState';

const TURN_DISTANCE = 1000;

/**
 * Deterministic timeline scheduler for Combat 2.0.
 *
 * Only active-field Pow participate in the timeline. Reserve Pow are registered
 * when CombatState promotes them into a vacant field slot. Every timeline value
 * is sanitized before ordering and completeAction() is the only normal path
 * that reschedules an actor after acting.
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
      this.nextReadyAt.set(unit.instanceId, this.intervalFor(unit));
    }
  }

  peekNext(): CombatUnitState | null {
    return this.findNextUnit();
  }

  beginNextTurn(): CombatUnitState | null {
    if (this.state.isBattleOver()) {
      this.state.phase = 'finished';
      this.state.currentUnitId = null;
      return null;
    }

    if (this.state.phase === 'resolving') {
      return null;
    }

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
      !unit ||
      !unit.alive ||
      unit.fieldSlot === null ||
      unit.actionLocked ||
      this.state.phase !== 'selecting' ||
      this.state.currentUnitId !== unitId
    ) {
      return false;
    }

    unit.actionLocked = true;
    this.state.phase = 'resolving';
    return true;
  }

  /** Must be called from an action pipeline's finally block. */
  completeAction(unitId: string): void {
    const unit = this.state.getUnit(unitId);

    if (unit) {
      unit.actionLocked = false;
      this.tickActorDurations(unit);

      if (unit.alive && unit.fieldSlot !== null) {
        this.nextReadyAt.set(
          unit.instanceId,
          this.timelineNow + this.intervalFor(unit)
        );
        this.actedThisRound.add(unit.instanceId);
      } else {
        this.retireUnit(unit.instanceId);
      }
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

  /** Register a reserve or revived active unit after it is field-ready. */
  registerPromoted(unitId: string): void {
    const unit = this.state.getUnit(unitId);

    if (!unit?.alive || unit.fieldSlot === null) {
      return;
    }

    unit.actionLocked = false;
    this.actedThisRound.delete(unitId);
    this.nextReadyAt.set(
      unitId,
      this.timelineNow + this.intervalFor(unit)
    );
  }

  retireUnit(unitId: string): void {
    this.nextReadyAt.delete(unitId);
    this.actedThisRound.delete(unitId);
  }

  /**
   * Recompute one waiting active unit after a speed debuff/buff is applied by
   * another actor. Reserve units never receive timeline entries.
   */
  rescheduleUnit(unitId: string): void {
    const unit = this.state.getUnit(unitId);

    if (
      !unit?.alive ||
      unit.fieldSlot === null ||
      this.state.currentUnitId === unitId
    ) {
      return;
    }

    this.nextReadyAt.set(
      unit.instanceId,
      this.timelineNow + this.intervalFor(unit)
    );
  }

  recoverActionLock(): void {
    const current = this.state.currentUnitId
      ? this.state.getUnit(this.state.currentUnitId)
      : undefined;

    if (current) {
      current.actionLocked = false;
    }

    this.state.currentUnitId = null;
    this.state.sanitizeRuntimeNumbers();
    this.state.phase = this.state.isBattleOver() ? 'finished' : 'ready';
  }

  private tickActorDurations(unit: CombatUnitState): void {
    if (unit.speedBuffActionsRemaining > 0) {
      unit.speedBuffActionsRemaining -= 1;
    }

    if (unit.speedDebuffActionsRemaining > 0) {
      unit.speedDebuffActionsRemaining -= 1;
    }

    if (
      unit.speedBuffActionsRemaining <= 0 &&
      unit.speedDebuffActionsRemaining <= 0
    ) {
      unit.speed = this.safeBaseSpeed(unit);
    }

    if (unit.attackBuffActionsRemaining > 0) {
      unit.attackBuffActionsRemaining -= 1;
      if (unit.attackBuffActionsRemaining <= 0) {
        unit.attackMultiplier = 1;
      }
    }

    if (unit.abilityPowerBuffActionsRemaining > 0) {
      unit.abilityPowerBuffActionsRemaining -= 1;
      if (unit.abilityPowerBuffActionsRemaining <= 0) {
        unit.abilityPowerMultiplier = 1;
      }
    }

    if (unit.defenseBuffActionsRemaining > 0) {
      unit.defenseBuffActionsRemaining -= 1;
      if (unit.defenseBuffActionsRemaining <= 0) {
        unit.defenseMultiplier = 1;
      }
    }

    if (unit.controlActionsRemaining > 0) {
      unit.controlActionsRemaining -= 1;
      if (unit.controlActionsRemaining <= 0) {
        unit.controlStatus = null;
      }
    }

    if (unit.reviveMarkerActionsRemaining > 0) {
      unit.reviveMarkerActionsRemaining -= 1;
    }
  }

  private findNextUnit(): CombatUnitState | null {
    let best: CombatUnitState | null = null;
    let bestTime = Number.POSITIVE_INFINITY;

    for (const unit of this.state.activeLiving()) {
      const fallback = this.timelineNow + this.intervalFor(unit);
      const readyAt = this.safeTimelineValue(
        this.nextReadyAt.get(unit.instanceId),
        fallback
      );

      if (readyAt < bestTime) {
        best = unit;
        bestTime = readyAt;
        continue;
      }

      if (readyAt === bestTime && best && unit.speed > best.speed) {
        best = unit;
      }
    }

    return best;
  }

  private intervalFor(unit: CombatUnitState): number {
    const speed = Number.isFinite(unit.speed) && unit.speed > 0 ? unit.speed : 1;
    return TURN_DISTANCE / Math.min(9999, Math.max(1, speed));
  }

  private safeBaseSpeed(unit: CombatUnitState): number {
    return Number.isFinite(unit.pow.speed) && unit.pow.speed > 0
      ? unit.pow.speed
      : 1;
  }

  private safeTimelineValue(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && (value as number) >= 0
      ? (value as number)
      : fallback;
  }

  private advanceRoundIfNeeded(): void {
    const activeIds = this.state.activeLiving().map((unit) => unit.instanceId);

    if (
      activeIds.length > 0 &&
      activeIds.every((instanceId) => this.actedThisRound.has(instanceId))
    ) {
      this.state.round += 1;
      this.actedThisRound.clear();
    }
  }
}
