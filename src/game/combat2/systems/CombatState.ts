import type { CombatPow, CombatSide, GrievousTier } from '../data/CombatPow';
import { ACTIVE_TEAM_SIZE } from '../data/PowderDataAdapter';
import { RAGE_START_POINTS, sanitizeRagePoints } from './CombatRageEngine';

export type CombatPhase = 'ready' | 'selecting' | 'resolving' | 'finished';
export type ControlStatus = 'stun' | 'freeze' | null;
export type HardControlStatus = 'silence' | 'stun' | 'paralysis' | 'freeze';
export type FreezeStage = 0 | 1 | 2;
export type DotStatus = 'burn' | 'poison' | null;
export type CombatRuntimeMode = 'pve' | 'pvp' | 'boss' | 'daily_boss' | 'dungeon' | 'event';

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
  /** Legacy secondary-stat runtime modifiers restored in Combat 2.6. */
  critRateBonus: number;
  critBuffActionsRemaining: number;
  evasionBonus: number;
  evasionBuffActionsRemaining: number;
  accuracyBonus: number;
  accuracyDebuffActionsRemaining: number;
  tenacityBonus: number;
  tenacityBuffActionsRemaining: number;
  damageReductionBonus: number;
  guardActionsRemaining: number;
  antiHeal: number;
  /** Canonical non-stacking healing reduction; legacy antiHeal remains an adapter input. */
  grievousTier: GrievousTier | null;
  antiHealActionsRemaining: number;
  regenerationActionsRemaining: number;
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
  /** Compatibility DOT summary; dedicated Burn/Poison state below is authoritative in 2.6+. */
  dotStatus: DotStatus;
  dotDamage: number;
  dotActionsRemaining: number;
  burnDamage: number;
  burnActionsRemaining: number;
  poisonStacks: number;
  poisonActionsRemaining: number;
  passiveUsed: boolean;
  reviveMarkerActionsRemaining: number;
  alive: boolean;
  actionLocked: boolean;
  /** Legacy Boss meter expressed as an initial timeline lead, not a second resource. */
  initialInitiative: number;
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
  readonly battleMode: CombatRuntimeMode;
  readonly bossContext: Record<string, unknown>;
  round = 1;
  phase: CombatPhase = 'ready';
  currentUnitId: string | null = null;

  constructor(
    playerTeam: CombatPow[],
    enemyTeam: CombatPow[],
    options: Readonly<{ battleMode?: CombatRuntimeMode; bossContext?: Record<string, unknown>; initialRageByPowId?: Readonly<Record<string, number>>; initialInitiativeByPowId?: Readonly<Record<string, number>> }> = {}
  ) {
    this.battleMode = options.battleMode ?? 'pve';
    this.bossContext = options.bossContext ?? {};
    this.units = [
      ...this.makeUnits(playerTeam, 'player', options),
      ...this.makeUnits(enemyTeam, 'enemy', options)
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
      unit.initialInitiative = this.finiteClamp(unit.initialInitiative, 0, 92, 0);
      unit.shield = this.finiteClamp(unit.shield, 0, unit.pow.maxHp * 0.8, 0);
      unit.speed = this.finiteClamp(unit.speed, 1, 9999, unit.pow.speed);
      unit.speedBuffActionsRemaining = this.safeDuration(unit.speedBuffActionsRemaining);
      unit.speedDebuffActionsRemaining = this.safeDuration(unit.speedDebuffActionsRemaining);
      unit.attackMultiplier = this.finiteClamp(unit.attackMultiplier, 0.1, 10, 1);
      unit.abilityPowerMultiplier = this.finiteClamp(unit.abilityPowerMultiplier, 0.1, 10, 1);
      unit.defenseMultiplier = this.finiteClamp(unit.defenseMultiplier, 0.1, 10, 1);
      unit.attackBuffActionsRemaining = this.safeDuration(unit.attackBuffActionsRemaining);
      unit.abilityPowerBuffActionsRemaining = this.safeDuration(unit.abilityPowerBuffActionsRemaining);
      unit.defenseBuffActionsRemaining = this.safeDuration(unit.defenseBuffActionsRemaining);
      unit.critRateBonus = this.finiteClamp(unit.critRateBonus, -100, 100, 0);
      unit.critBuffActionsRemaining = this.safeDuration(unit.critBuffActionsRemaining);
      unit.evasionBonus = this.finiteClamp(unit.evasionBonus, -75, 75, 0);
      unit.evasionBuffActionsRemaining = this.safeDuration(unit.evasionBuffActionsRemaining);
      unit.accuracyBonus = this.finiteClamp(unit.accuracyBonus, -100, 100, 0);
      unit.accuracyDebuffActionsRemaining = this.safeDuration(unit.accuracyDebuffActionsRemaining);
      unit.tenacityBonus = this.finiteClamp(unit.tenacityBonus, -60, 60, 0);
      unit.tenacityBuffActionsRemaining = this.safeDuration(unit.tenacityBuffActionsRemaining);
      unit.damageReductionBonus = this.finiteClamp(unit.damageReductionBonus, 0, 0.45, 0);
      unit.guardActionsRemaining = this.safeDuration(unit.guardActionsRemaining);
      unit.antiHeal = this.finiteClamp(unit.antiHeal, 0, 0.6, 0);
      if (unit.grievousTier !== 'grievous-40' && unit.grievousTier !== 'grievous-60') {
        unit.grievousTier = null;
      }
      unit.antiHealActionsRemaining = this.safeDuration(unit.antiHealActionsRemaining);
      unit.regenerationActionsRemaining = this.safeDuration(unit.regenerationActionsRemaining);
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
      unit.burnDamage = Math.floor(this.finiteClamp(unit.burnDamage, 0, unit.pow.maxHp, 0));
      unit.burnActionsRemaining = this.safeDuration(unit.burnActionsRemaining);
      unit.poisonStacks = Math.floor(this.finiteClamp(unit.poisonStacks, 0, 3, 0));
      unit.poisonActionsRemaining = this.safeDuration(unit.poisonActionsRemaining);
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
      if (unit.burnActionsRemaining <= 0 || unit.burnDamage <= 0) {
        unit.burnDamage = 0;
        unit.burnActionsRemaining = 0;
      }
      if (unit.poisonActionsRemaining <= 0 || unit.poisonStacks <= 0) {
        unit.poisonStacks = 0;
        unit.poisonActionsRemaining = 0;
      }
      // Legacy summary remains populated for old UI/tests that still inspect it.
      if (unit.poisonActionsRemaining > 0) {
        unit.dotStatus = 'poison';
        unit.dotDamage = Math.max(1, Math.round(unit.pow.maxHp * 0.02 * unit.poisonStacks));
        unit.dotActionsRemaining = unit.poisonActionsRemaining;
      } else if (unit.burnActionsRemaining > 0) {
        unit.dotStatus = 'burn';
        unit.dotDamage = unit.burnDamage;
        unit.dotActionsRemaining = unit.burnActionsRemaining;
      } else {
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
      this.resetRuntimeEffects(fallen);
      fallen.reviveMarkerActionsRemaining = 1;
      fallen.actionLocked = false;
      fallen.alive = true;
    }
  }

  resetRuntimeEffects(unit: CombatUnitState): void {
    unit.controlStatus = null;
    unit.controlActionsRemaining = 0;
    unit.silenceActionsRemaining = 0;
    unit.paralysisActionsRemaining = 0;
    unit.freezeStage = 0;
    unit.freezeStageActionsRemaining = 0;
    unit.controlImmunityActionsRemaining = 0;
    unit.controlHistory = [];
    unit.dotStatus = null;
    unit.dotDamage = 0;
    unit.dotActionsRemaining = 0;
    unit.burnDamage = 0;
    unit.burnActionsRemaining = 0;
    unit.poisonStacks = 0;
    unit.poisonActionsRemaining = 0;
    unit.speedDebuffActionsRemaining = 0;
    unit.speedBuffActionsRemaining = 0;
    unit.speed = Math.max(1, unit.pow.speed);
    unit.attackMultiplier = 1;
    unit.abilityPowerMultiplier = 1;
    unit.defenseMultiplier = 1;
    unit.attackBuffActionsRemaining = 0;
    unit.abilityPowerBuffActionsRemaining = 0;
    unit.defenseBuffActionsRemaining = 0;
    unit.critRateBonus = 0;
    unit.critBuffActionsRemaining = 0;
    unit.evasionBonus = 0;
    unit.evasionBuffActionsRemaining = 0;
    unit.accuracyBonus = 0;
    unit.accuracyDebuffActionsRemaining = 0;
    unit.tenacityBonus = 0;
    unit.tenacityBuffActionsRemaining = 0;
    unit.damageReductionBonus = 0;
    unit.guardActionsRemaining = 0;
    unit.antiHeal = 0;
    unit.grievousTier = null;
    unit.antiHealActionsRemaining = 0;
    unit.regenerationActionsRemaining = 0;
  }

  private makeUnits(team: CombatPow[], side: CombatSide, options: Readonly<{ initialRageByPowId?: Readonly<Record<string, number>>; initialInitiativeByPowId?: Readonly<Record<string, number>> }>): CombatUnitState[] {
    return team.map((pow, slot) => ({
      instanceId: `${side}-${slot}-${pow.id}`,
      pow,
      side,
      slot,
      fieldSlot: slot < ACTIVE_TEAM_SIZE ? slot : null,
      hp: pow.hp,
      ragePoints: this.initialRage(options.initialRageByPowId, pow.id),
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
      critRateBonus: 0,
      critBuffActionsRemaining: 0,
      evasionBonus: 0,
      evasionBuffActionsRemaining: 0,
      accuracyBonus: 0,
      accuracyDebuffActionsRemaining: 0,
      tenacityBonus: 0,
      tenacityBuffActionsRemaining: 0,
      damageReductionBonus: 0,
      guardActionsRemaining: 0,
      antiHeal: 0,
      grievousTier: null,
      antiHealActionsRemaining: 0,
      regenerationActionsRemaining: 0,
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
      burnDamage: 0,
      burnActionsRemaining: 0,
      poisonStacks: 0,
      poisonActionsRemaining: 0,
      passiveUsed: false,
      reviveMarkerActionsRemaining: 0,
      alive: pow.hp > 0,
      actionLocked: false,
      initialInitiative: this.initialInitiative(options.initialInitiativeByPowId, pow.id)
    }));
  }

  private initialRage(values: Readonly<Record<string, number>> | undefined, powId: string): number {
    const value = values?.[powId] ?? values?.[powId.toLowerCase()];
    return sanitizeRagePoints(value === undefined ? RAGE_START_POINTS : value);
  }

  private initialInitiative(values: Readonly<Record<string, number>> | undefined, powId: string): number {
    const value = values?.[powId] ?? values?.[powId.toLowerCase()];
    return this.finiteClamp(Number(value ?? 0), 0, 92, 0);
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
