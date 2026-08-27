import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';

const ROLE_GUARD_CHANCE = Object.freeze({
  tank: 0.70,
  knight: 0.25,
  fighter: 0.18,
  enchanter: 0.10,
  musician: 0.10,
  healer: 0,
  mage: 0,
  marksman: 0,
  assassin: 0
});

type GuardRole = keyof typeof ROLE_GUARD_CHANCE;

export interface GuardResolution {
  target: CombatUnitState;
  guarded: boolean;
  protector: CombatUnitState | null;
  chance: number;
  roll: number | null;
}

export class CombatGuardEngine {
  constructor(private readonly random: () => number = Math.random) {}

  resolve(
    attacker: CombatUnitState,
    requestedTarget: CombatUnitState,
    ability: CombatAbility,
    allies: readonly CombatUnitState[]
  ): GuardResolution {
    if (!this.canBeGuarded(ability)) {
      return { target: requestedTarget, guarded: false, protector: null, chance: 0, roll: null };
    }

    const candidates = allies
      .filter((unit) =>
        unit.alive &&
        unit.fieldSlot !== null &&
        unit.instanceId !== requestedTarget.instanceId &&
        unit.instanceId !== attacker.instanceId &&
        !this.isHardControlled(unit) &&
        this.guardChance(unit) > 0
      )
      .sort((a, b) => {
        const chance = this.guardChance(b) - this.guardChance(a);
        if (Math.abs(chance) > 1e-9) return chance;
        return (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99);
      });

    const protector = candidates[0] ?? null;
    if (!protector) {
      return { target: requestedTarget, guarded: false, protector: null, chance: 0, roll: null };
    }

    const chance = this.guardChance(protector);
    const roll = this.safeRandom();
    if (roll >= chance) {
      return { target: requestedTarget, guarded: false, protector, chance, roll };
    }

    return { target: protector, guarded: true, protector, chance, roll };
  }

  guardChance(unit: CombatUnitState): number {
    const base = ROLE_GUARD_CHANCE[this.roleKey(unit)] ?? 0;
    // The explicit Guard effect from legacy Combat strengthens interception while active.
    const guardBonus = unit.guardActionsRemaining > 0 ? 0.15 : 0;
    return Math.min(0.85, Math.max(0, base + guardBonus));
  }

  private canBeGuarded(ability: CombatAbility): boolean {
    const type = String(ability.type || '').trim().toLowerCase();
    const target = String(ability.target || '').trim().toLowerCase();
    if (type === 'support') return false;
    if (ability.area) return false;
    if (['all', 'all-enemies', 'team', 'allies', 'two-enemies', 'two-allies', 'three-allies', 'front-row', 'back-row'].includes(target)) return false;
    if (ability.pierceGuard || ability.bypassGuard) return false;
    return true;
  }

  private isHardControlled(unit: CombatUnitState): boolean {
    return Boolean(
      unit.controlActionsRemaining > 0 ||
      unit.silenceActionsRemaining > 0 ||
      unit.paralysisActionsRemaining > 0 ||
      (unit.freezeStage > 0 && unit.freezeStageActionsRemaining > 0)
    );
  }

  private roleKey(unit: CombatUnitState): GuardRole {
    const normalized = String(unit.pow.role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (normalized.includes('do don') || normalized.includes('tank')) return 'tank';
    if (normalized.includes('hiep si') || normalized.includes('knight')) return 'knight';
    if (normalized.includes('dau si') || normalized.includes('fighter')) return 'fighter';
    if (normalized.includes('thuat su') || normalized.includes('enchanter')) return 'enchanter';
    if (normalized.includes('nhac cong') || normalized.includes('musician')) return 'musician';
    if (normalized.includes('tri lieu') || normalized.includes('healer')) return 'healer';
    if (normalized.includes('phap su') || normalized.includes('mage')) return 'mage';
    if (normalized.includes('sat thu') || normalized.includes('assassin')) return 'assassin';
    return 'marksman';
  }

  private safeRandom(): number {
    const value = Number(this.random());
    if (!Number.isFinite(value)) return 0.999999;
    return Math.min(0.999999, Math.max(0, value));
  }
}
