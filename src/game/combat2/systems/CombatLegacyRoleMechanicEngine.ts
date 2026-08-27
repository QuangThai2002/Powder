import type { CombatUnitState } from './CombatState';

interface LegacyGuardUnit extends CombatUnitState {
  legacyGuardBonus?: number;
}

export interface LegacyRoleMechanicResult {
  mechanic: string;
  applied: boolean;
  guardBonusDelta: number;
  guardBonusAfter: number;
  shieldGranted: number;
  defenseBuffApplied: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function legacyGuardBonus(unit: CombatUnitState): number {
  return clamp(Number((unit as LegacyGuardUnit).legacyGuardBonus) || 0, 0, 30);
}

export class CombatLegacyRoleMechanicEngine {
  apply(actor: CombatUnitState, rawMechanic: unknown): LegacyRoleMechanicResult {
    const mechanic = String(rawMechanic || '').trim().toLowerCase();
    let guardBonusDelta = 0;
    let shieldGranted = 0;
    let defenseBuffApplied = false;

    if (mechanic === 'role_tank_bulwark') {
      actor.defenseMultiplier = Math.max(actor.defenseMultiplier, 1.3);
      actor.defenseBuffActionsRemaining = Math.max(actor.defenseBuffActionsRemaining, 2);
      defenseBuffApplied = true;

      const unit = actor as LegacyGuardUnit;
      const before = legacyGuardBonus(actor);
      const after = clamp(before + 20, 0, 30);
      unit.legacyGuardBonus = after;
      guardBonusDelta = after - before;
    } else if (mechanic === 'role_knight_guarded') {
      const cap = Math.max(1, Math.round(actor.pow.maxHp * 0.6));
      const amount = Math.max(1, Math.round(actor.pow.maxHp * 0.06));
      const before = Math.max(0, actor.shield);
      actor.shield = Math.min(cap, before + amount);
      shieldGranted = Math.max(0, actor.shield - before);
    }

    return {
      mechanic,
      applied: defenseBuffApplied || guardBonusDelta > 0 || shieldGranted > 0,
      guardBonusDelta,
      guardBonusAfter: legacyGuardBonus(actor),
      shieldGranted,
      defenseBuffApplied
    };
  }
}
