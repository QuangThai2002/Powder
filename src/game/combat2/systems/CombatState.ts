import type { CombatPow, CombatSide } from '../data/CombatPow';

export type CombatPhase = 'ready' | 'selecting' | 'resolving' | 'finished';
export type ControlStatus = 'stun' | 'freeze' | null;
export type DotStatus = 'burn' | 'poison' | null;

export interface CombatUnitState {
  instanceId: string;
  pow: CombatPow;
  side: CombatSide;
  slot: number;
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
  alive: boolean;
  actionLocked: boolean;
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

  isBattleOver(): boolean {
    return this.living('player').length === 0 || this.living('enemy').length === 0;
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

  private makeUnits(team: CombatPow[], side: CombatSide): CombatUnitState[] {
    return team.map((pow, slot) => ({
      instanceId: `${side}-${slot}-${pow.id}`,
      pow,
      side,
      slot,
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
