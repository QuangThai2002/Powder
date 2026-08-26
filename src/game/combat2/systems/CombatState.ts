import type { CombatPow, CombatSide } from '../data/CombatPow';

export type CombatPhase = 'ready' | 'selecting' | 'resolving' | 'finished';

export interface CombatUnitState {
  instanceId: string;
  pow: CombatPow;
  side: CombatSide;
  slot: number;
  hp: number;
  mana: number;
  rage: number;
  speed: number;
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
      unit.speed = this.finiteClamp(unit.speed, 1, 9999, unit.pow.speed);
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
      speed: this.finiteClamp(pow.speed, 1, 9999, 100),
      alive: pow.hp > 0,
      actionLocked: false
    }));
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
