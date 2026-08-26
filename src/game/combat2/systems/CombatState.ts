import type { CombatPow, CombatSide } from '../data/CombatPow';
import { ACTIVE_TEAM_SIZE } from '../data/PowderDataAdapter';

export type CombatPhase = 'ready' | 'selecting' | 'resolving' | 'finished';
export type ControlStatus = 'stun' | 'freeze' | null;
export type DotStatus = 'burn' | 'poison' | null;

export interface CombatUnitState {
  instanceId: string;
  pow: CombatPow;
  side: CombatSide;
  /** Stable roster index (0..4). */
  slot: number;
  /** Battlefield slot (0..2). Null means reserve/bench/defeated. */
  fieldSlot: number | null;
  hp: number;
  mana: number;
  rage: number;
  shield: number;
  speed: number;
  speedBuffActionsRemaining: number;
  speedDebuffActionsRemaining: number;
  attackMultiplier: number;
  defenseMultiplier: number;
  attackBuffActionsRemaining: number;
  defenseBuffActionsRemaining: number;
  controlStatus: ControlStatus;
  controlActionsRemaining: number;
  dotStatus: DotStatus;
  dotDamage: number;
  dotActionsRemaining: number;
  passiveUsed: boolean;
  reviveMarkerActionsRemaining: number;
  alive: boolean;
  actionLocked: boolean;
}

export interface ReservePromotion {
  side: CombatSide;
  fieldSlot: number;
  defeatedUnitId: string;
  promotedUnitId: string;
}

export class CombatState {
  readonly units: CombatUnitState[];

  round = 1;
  phase: CombatPhase = 'ready';
  currentUnitId: string | null = null;

  constructor(playerTeam: CombatPow[], enemyTeam: CombatPow[]) {
    this.units = [
      ...this.makeUnits(playerTeam, 'player'),
      ...this.makeUnits(enemyTeam, 'enemy')
    ];
  }

  getUnit(instanceId: string): CombatUnitState | undefined {
    return this.units.find((unit) => unit.instanceId === instanceId);
  }

  living(side?: CombatSide): CombatUnitState[] {
    return this.units.filter(
      (unit) => unit.alive && (side === undefined || unit.side === side)
    );
  }

  activeLiving(side?: CombatSide): CombatUnitState[] {
    return this.units.filter(
      (unit) =>
        unit.alive &&
        unit.fieldSlot !== null &&
        (side === undefined || unit.side === side)
    );
  }

  reserveLiving(side: CombatSide): CombatUnitState[] {
    return this.units
      .filter(
        (unit) => unit.alive && unit.side === side && unit.fieldSlot === null
      )
      .sort((a, b) => a.slot - b.slot);
  }

  isBattleOver(): boolean {
    return this.living('player').length === 0 || this.living('enemy').length === 0;
  }

  /**
   * Resolve one-time revive passives before consuming a reserve slot, then move
   * the next living reserve into any field slot that remains vacant.
   */
  promoteReserves(): ReservePromotion[] {
    const promotions: ReservePromotion[] = [];

    for (const side of ['player', 'enemy'] as const) {
      this.resolveRevivePassives(side);

      const defeatedActive = this.units
        .filter(
          (unit) =>
            unit.side === side &&
            !unit.alive &&
            unit.fieldSlot !== null
        )
        .sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));

      for (const defeated of defeatedActive) {
        const fieldSlot = defeated.fieldSlot;
        defeated.fieldSlot = null;

        if (fieldSlot === null) {
          continue;
        }

        const reserve = this.reserveLiving(side)[0];
        if (!reserve) {
          continue;
        }

        reserve.fieldSlot = fieldSlot;
        reserve.actionLocked = false;

        promotions.push({
          side,
          fieldSlot,
          defeatedUnitId: defeated.instanceId,
          promotedUnitId: reserve.instanceId
        });
      }
    }

    return promotions;
  }

  sanitizeRuntimeNumbers(): void {
    for (const unit of this.units) {
      unit.hp = this.finiteClamp(unit.hp, 0, unit.pow.maxHp, 0);
      unit.mana = this.finiteClamp(unit.mana, 0, unit.pow.maxMana, 0);
      unit.rage = this.finiteClamp(unit.rage, 0, unit.pow.maxRage, 0);
      unit.shield = this.finiteClamp(unit.shield, 0, unit.pow.maxHp * 3, 0);
      unit.speed = this.finiteClamp(unit.speed, 1, 9999, unit.pow.speed);
      unit.speedBuffActionsRemaining = this.safeDuration(unit.speedBuffActionsRemaining);
      unit.speedDebuffActionsRemaining = this.safeDuration(unit.speedDebuffActionsRemaining);
      unit.attackMultiplier = this.finiteClamp(unit.attackMultiplier, 0.1, 10, 1);
      unit.defenseMultiplier = this.finiteClamp(unit.defenseMultiplier, 0.1, 10, 1);
      unit.attackBuffActionsRemaining = this.safeDuration(unit.attackBuffActionsRemaining);
      unit.defenseBuffActionsRemaining = this.safeDuration(unit.defenseBuffActionsRemaining);
      unit.controlActionsRemaining = this.safeDuration(unit.controlActionsRemaining);
      unit.dotDamage = Math.floor(this.finiteClamp(unit.dotDamage, 0, unit.pow.maxHp, 0));
      unit.dotActionsRemaining = this.safeDuration(unit.dotActionsRemaining);
      unit.reviveMarkerActionsRemaining = this.safeDuration(
        unit.reviveMarkerActionsRemaining
      );

      if (unit.controlActionsRemaining <= 0) {
        unit.controlStatus = null;
      }
      if (unit.dotActionsRemaining <= 0 || unit.dotDamage <= 0) {
        unit.dotStatus = null;
        unit.dotDamage = 0;
        unit.dotActionsRemaining = 0;
      }

      unit.alive = unit.hp > 0;
    }
  }

  private resolveRevivePassives(side: CombatSide): void {
    const defeated = this.units
      .filter(
        (unit) =>
          unit.side === side &&
          !unit.alive &&
          unit.fieldSlot !== null
      )
      .sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));

    for (const fallen of defeated) {
      const reviver = this.units.find(
        (unit) =>
          unit.side === side &&
          unit.alive &&
          !unit.passiveUsed &&
          String(unit.pow.passive?.id || '').toLowerCase() === 'revive_ally_once'
      );

      if (!reviver) {
        break;
      }

      reviver.passiveUsed = true;
      fallen.hp = Math.max(1, Math.round(fallen.pow.maxHp * 0.3));
      fallen.mana = Math.min(fallen.pow.maxMana, Math.max(fallen.mana, 20));
      fallen.rage = Math.min(fallen.pow.maxRage, Math.max(0, fallen.rage));
      fallen.shield = 0;
      fallen.controlStatus = null;
      fallen.controlActionsRemaining = 0;
      fallen.dotStatus = null;
      fallen.dotDamage = 0;
      fallen.dotActionsRemaining = 0;
      fallen.reviveMarkerActionsRemaining = 1;
      fallen.actionLocked = false;
      fallen.alive = true;
    }
  }

  private makeUnits(team: CombatPow[], side: CombatSide): CombatUnitState[] {
    return team.map((pow, slot) => ({
      instanceId: `${side}-${slot}-${pow.id}`,
      pow,
      side,
      slot,
      fieldSlot: slot < ACTIVE_TEAM_SIZE ? slot : null,
      hp: pow.hp,
      mana: pow.mana,
      rage: pow.rage,
      shield: 0,
      speed: this.finiteClamp(pow.speed, 1, 9999, 100),
      speedBuffActionsRemaining: 0,
      speedDebuffActionsRemaining: 0,
      attackMultiplier: 1,
      defenseMultiplier: 1,
      attackBuffActionsRemaining: 0,
      defenseBuffActionsRemaining: 0,
      controlStatus: null,
      controlActionsRemaining: 0,
      dotStatus: null,
      dotDamage: 0,
      dotActionsRemaining: 0,
      passiveUsed: false,
      reviveMarkerActionsRemaining: 0,
      alive: pow.hp > 0,
      actionLocked: false
    }));
  }

  private safeDuration(value: number): number {
    return Math.floor(this.finiteClamp(value, 0, 20, 0));
  }

  private finiteClamp(
    value: number,
    min: number,
    max: number,
    fallback: number
  ): number {
    const safe = Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, safe));
  }
}
