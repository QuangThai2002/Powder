import { CombatState, type CombatUnitState } from './CombatState';

const TURN_DISTANCE = 1000;

/**
 * Deterministic timeline scheduler for Combat 2.0.
 *
 * It deliberately avoids the legacy mutable meter loop that could become NaN
 * after SPEED buffs. Every timeline value is sanitized before it participates
 * in ordering, and completing an action is the only place an actor is
 * rescheduled.
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

    for (const unit of this.state.living()) {
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

  /**
   * This must be called from an action pipeline's finally block.
   */
  completeAction(unitId: string): void {
    const unit = this.state.getUnit(unitId);

    if (unit) {
      unit.actionLocked = false;
      this.tickActorDurations(unit);

      if (unit.alive) {
        this.nextReadyAt.set(
          unit.instanceId,
          this.timelineNow + this.intervalFor(unit)
        );
        this.actedThisRound.add(unit.instanceId);
      } else {
        this.nextReadyAt.delete(unit.instanceId);
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
    if (unit.speedBuffActionsRemaining <= 0) {
      return;
    }

    unit.speedBuffActionsRemaining -= 1;

    if (unit.speedBuffActionsRemaining <= 0) {
      unit.speed = this.safeBaseSpeed(unit);
    }
  }

  private findNextUnit(): CombatUnitState | null {
    let best: CombatUnitState | null = null;
    let bestTime = Number.POSITIVE_INFINITY;

    for (const unit of this.state.living()) {
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
    const livingIds = this.state.living().map((unit) => unit.instanceId);

    if (
      livingIds.length > 0 &&
      livingIds.every((instanceId) => this.actedThisRound.has(instanceId))
    ) {
      this.state.round += 1;
      this.actedThisRound.clear();
    }
  }
}
