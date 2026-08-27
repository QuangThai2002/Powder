import type { CombatPow, CombatSide } from '../data/CombatPow';
import { ACTIVE_TEAM_SIZE } from '../data/PowderDataAdapter';
import { sanitizeRagePoints } from './CombatRageEngine';

export type CombatPhase = 'ready' | 'selecting' | 'resolving' | 'finished';
export type ControlStatus = 'stun' | 'freeze' | null;
export type HardControlStatus = 'silence' | 'stun' | 'paralysis' | 'freeze';
export type FreezeStage = 0 | 1 | 2;
export type DotStatus = 'burn' | 'poison' | null;

export interface ControlHistoryEntry {
  status: HardControlStatus;
  round: number;
  sourceKey: string;
}

export interface CombatUnitState {
  instanceId: string;
  pow: CombatPow;
  side: CombatSide;
  slot: number;
  fieldSlot: number | null;
  hp: number;
  /** Unified Combat 2.4+ resource: 0..8 effective Rage points. */
  ragePoints: number;
  shield: number;
  speed: number;
  speedBuffActionsRemaining: number;
  speedDebuffActionsRemaining: number;
  attackMultiplier: number;
  abilityPowerMultiplier: number;
  defenseMultiplier: number;
  attackBuffActionsRemaining: number;
  abilityPowerBuffActionsRemaining: number;
  defenseBuffActionsRemaining: number;
  /** Future own turns before Skill I/II become usable again. */
  skillCooldownActionsRemaining: [number, number];
  /** Future own turns before Ultimate becomes usable again. Rage is still required. */
  ultimateCooldownActionsRemaining: number;
  /** Additive control-effect accuracy from equipment/buffs; final CC chance is capped elsewhere at 80%. */
  effectAccuracyBonus: number;
  controlStatus: ControlStatus;
  controlActionsRemaining: number;
  silenceActionsRemaining: number;
  paralysisActionsRemaining: number;
  freezeStage: FreezeStage;
  freezeStageActionsRemaining: number;
  controlImmunityActionsRemaining: number;
  controlHistory: ControlHistoryEntry[];
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

const HARD_CONTROL_VALUES = new Set<HardControlStatus>([
  'silence', 'stun', 'paralysis', 'freeze'
]);

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
    return this.units.filter((unit) => unit.alive && (side === undefined || unit.side === side));
  }

  activeLiving(side?: CombatSide): CombatUnitState[] {
    return this.units.filter((unit) =>
      unit.alive && unit.fieldSlot !== null && (side === undefined || unit.side === side)
    );
  }

  reserveLiving(side: CombatSide): CombatUnitState[] {
    return this.units
      .filter((unit) => unit.alive && unit.side === side && unit.fieldSlot === null)
      .sort((a, b) => a.slot - b.slot);
  }

  isBattleOver(): boolean {
    return this.living('player').length === 0 || this.living('enemy').length === 0;
  }

  promoteReserves(): ReservePromotion[] {
    const promotions: ReservePromotion[] = [];

    for (const side of ['player', 'enemy'] as const) {
      this.resolveRevivePassives(side);
      const defeatedActive = this.units
        .filter((unit) => unit.side === side && !unit.alive && unit.fieldSlot !== null)
        .sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));

      for (const defeated of defeatedActive) {
        const fieldSlot = defeated.fieldSlot;
        defeated.fieldSlot = null;
        if (fieldSlot === null) continue;

        const reserve = this.reserveLiving(side)[0];
        if (!reserve) continue;
        reserve.fieldSlot = fieldSlot;
        reserve.actionLocked = false;
        promotions.push({ side, fieldSlot, defeatedUnitId: defeated.instanceId, promotedUnitId: reserve.instanceId });
      }
    }

    return promotions;
  }

  refreshSpeed(unit: CombatUnitState): void {
    const base = Number.isFinite(unit.pow.speed) && unit.pow.speed > 0 ? unit.pow.speed : 1;
    let multiplier = 1;
    if (unit.speedBuffActionsRemaining > 0) multiplier *= 1.2;
    if (unit.speedDebuffActionsRemaining > 0) multiplier *= 0.8;
    if (unit.freezeStage === 1 && unit.freezeStageActionsRemaining > 0) multiplier *= 0.9;
    if (unit.freezeStage === 2 && unit.freezeStageActionsRemaining > 0) multiplier *= 0.8;
    unit.speed = Math.max(1, base * multiplier);
  }

  sanitizeRuntimeNumbers(): void {
    for (const unit of this.units) {
      unit.hp = this.finiteClamp(unit.hp, 0, unit.pow.maxHp, 0);
      unit.ragePoints = sanitizeRagePoints(unit.ragePoints);
      unit.shield = this.finiteClamp(unit.shield, 0, unit.pow.maxHp * 3, 0);
      unit.speed = this.finiteClamp(unit.speed, 1, 9999, unit.pow.speed);
      unit.speedBuffActionsRemaining = this.safeDuration(unit.speedBuffActionsRemaining);
      unit.speedDebuffActionsRemaining = this.safeDuration(unit.speedDebuffActionsRemaining);
      unit.attackMultiplier = this.finiteClamp(unit.attackMultiplier, 0.1, 10, 1);
      unit.abilityPowerMultiplier = this.finiteClamp(unit.abilityPowerMultiplier, 0.1, 10, 1);
      unit.defenseMultiplier = this.finiteClamp(unit.defenseMultiplier, 0.1, 10, 1);
      unit.attackBuffActionsRemaining = this.safeDuration(unit.attackBuffActionsRemaining);
      unit.abilityPowerBuffActionsRemaining = this.safeDuration(unit.abilityPowerBuffActionsRemaining);
      unit.defenseBuffActionsRemaining = this.safeDuration(unit.defenseBuffActionsRemaining);
      unit.skillCooldownActionsRemaining = [
        this.safeDuration(unit.skillCooldownActionsRemaining?.[0] ?? 0),
        this.safeDuration(unit.skillCooldownActionsRemaining?.[1] ?? 0)
      ];
      unit.ultimateCooldownActionsRemaining = this.safeDuration(unit.ultimateCooldownActionsRemaining);
      unit.effectAccuracyBonus = this.finiteClamp(unit.effectAccuracyBonus, 0, 0.4, 0);
      unit.controlActionsRemaining = this.safeDuration(unit.controlActionsRemaining);
      unit.silenceActionsRemaining = this.safeDuration(unit.silenceActionsRemaining);
      unit.paralysisActionsRemaining = this.safeDuration(unit.paralysisActionsRemaining);
      unit.freezeStage = this.safeFreezeStage(unit.freezeStage);
      unit.freezeStageActionsRemaining = this.safeDuration(unit.freezeStageActionsRemaining);
      unit.controlImmunityActionsRemaining = this.safeDuration(unit.controlImmunityActionsRemaining);
      unit.controlHistory = this.sanitizeControlHistory(unit.controlHistory);
      unit.dotDamage = Math.floor(this.finiteClamp(unit.dotDamage, 0, unit.pow.maxHp, 0));
      unit.dotActionsRemaining = this.safeDuration(unit.dotActionsRemaining);
      unit.reviveMarkerActionsRemaining = this.safeDuration(unit.reviveMarkerActionsRemaining);

      if (unit.controlActionsRemaining <= 0) unit.controlStatus = null;
      if (unit.freezeStageActionsRemaining <= 0) unit.freezeStage = 0;
      if (unit.controlImmunityActionsRemaining > 0) {
        unit.controlStatus = null;
        unit.controlActionsRemaining = 0;
        unit.silenceActionsRemaining = 0;
        unit.paralysisActionsRemaining = 0;
        unit.freezeStage = 0;
        unit.freezeStageActionsRemaining = 0;
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
      .filter((unit) => unit.side === side && !unit.alive && unit.fieldSlot !== null)
      .sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));

    for (const fallen of defeated) {
      const reviver = this.units.find((unit) =>
        unit.side === side && unit.alive && !unit.passiveUsed &&
        String(unit.pow.passive?.id || '').toLowerCase() === 'revive_ally_once'
      );
      if (!reviver) break;

      reviver.passiveUsed = true;
      fallen.hp = Math.max(1, Math.round(fallen.pow.maxHp * 0.3));
      fallen.ragePoints = sanitizeRagePoints(fallen.ragePoints);
      fallen.shield = 0;
      fallen.controlStatus = null;
      fallen.controlActionsRemaining = 0;
      fallen.silenceActionsRemaining = 0;
      fallen.paralysisActionsRemaining = 0;
      fallen.freezeStage = 0;
      fallen.freezeStageActionsRemaining = 0;
      fallen.controlImmunityActionsRemaining = 0;
      fallen.controlHistory = [];
      fallen.dotStatus = null;
      fallen.dotDamage = 0;
      fallen.dotActionsRemaining = 0;
      fallen.speedDebuffActionsRemaining = 0;
      fallen.speedBuffActionsRemaining = 0;
      fallen.speed = Math.max(1, fallen.pow.speed);
      fallen.attackMultiplier = 1;
      fallen.abilityPowerMultiplier = 1;
      fallen.defenseMultiplier = 1;
      fallen.attackBuffActionsRemaining = 0;
      fallen.abilityPowerBuffActionsRemaining = 0;
      fallen.defenseBuffActionsRemaining = 0;
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
      ragePoints: 0,
      shield: 0,
      speed: this.finiteClamp(pow.speed, 1, 9999, 100),
      speedBuffActionsRemaining: 0,
      speedDebuffActionsRemaining: 0,
      attackMultiplier: 1,
      abilityPowerMultiplier: 1,
      defenseMultiplier: 1,
      attackBuffActionsRemaining: 0,
      abilityPowerBuffActionsRemaining: 0,
      defenseBuffActionsRemaining: 0,
      skillCooldownActionsRemaining: [0, 0],
      ultimateCooldownActionsRemaining: 0,
      effectAccuracyBonus: 0,
      controlStatus: null,
      controlActionsRemaining: 0,
      silenceActionsRemaining: 0,
      paralysisActionsRemaining: 0,
      freezeStage: 0,
      freezeStageActionsRemaining: 0,
      controlImmunityActionsRemaining: 0,
      controlHistory: [],
      dotStatus: null,
      dotDamage: 0,
      dotActionsRemaining: 0,
      passiveUsed: false,
      reviveMarkerActionsRemaining: 0,
      alive: pow.hp > 0,
      actionLocked: false
    }));
  }

  private sanitizeControlHistory(value: ControlHistoryEntry[] | undefined): ControlHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry) =>
        Boolean(entry) && HARD_CONTROL_VALUES.has(entry.status) && Number.isFinite(entry.round) && entry.round >= 1
      )
      .slice(-12)
      .map((entry) => ({
        status: entry.status,
        round: Math.floor(entry.round),
        sourceKey: String(entry.sourceKey || entry.status).trim().toLowerCase() || entry.status
      }));
  }

  private safeFreezeStage(value: number): FreezeStage {
    const safe = Math.floor(this.finiteClamp(value, 0, 2, 0));
    return (safe === 1 || safe === 2 ? safe : 0) as FreezeStage;
  }

  private safeDuration(value: number): number {
    return Math.floor(this.finiteClamp(value, 0, 20, 0));
  }

  private finiteClamp(value: number, min: number, max: number, fallback: number): number {
    const safe = Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, safe));
  }
}
