import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from './CombatState';
import type { CombatAbilitySlot } from './SkillActionResolver';

export interface LegacyMarkedUnit extends CombatUnitState {
  legacyAimMarkActionsRemaining?: number;
  legacyHuntMarkActionsRemaining?: number;
}

export interface LegacyRoleHealResult {
  healed: number;
  requested: number;
  cap: number;
}

export interface LegacyRoleHasteResult {
  speedBuffApplied: boolean;
  timelineProgress: number;
}

export const LEGACY_ROLE_HASTE_PROGRESS = 0.12;
export const LEGACY_ROLE_MARK_TURNS = 2;
export const LEGACY_ASSASSIN_EXECUTE_THRESHOLD = 0.35;
export const LEGACY_ASSASSIN_EXECUTE_MULTIPLIER = 1.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizedCombatRole(unit: CombatUnitState): string {
  const role = normalizeText(unit.pow.role);
  if (role.includes('sat thu') || role.includes('assassin')) return 'assassin';
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('enchanter')) return 'enchanter';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('dau si') || role.includes('fighter')) return 'fighter';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  return role;
}

export function legacyRoleMark(unit: CombatUnitState): 'aim' | 'hunt' | null {
  const marked = unit as LegacyMarkedUnit;
  if ((marked.legacyHuntMarkActionsRemaining || 0) > 0) return 'hunt';
  if ((marked.legacyAimMarkActionsRemaining || 0) > 0) return 'aim';
  return null;
}

export class CombatLegacyRoleCompletionEngine {
  healTarget(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    slot: CombatAbilitySlot,
    teamMode = false
  ): LegacyRoleHealResult {
    const ratio = teamMode ? 0.08 : 0.14;
    const ap = Math.max(0, actor.pow.abilityPower * actor.abilityPowerMultiplier);
    const raw = target.pow.maxHp * ratio + ap * 0.35 + Math.max(0, ability.power) * 1.4;
    const healPower = 1 + clamp(actor.pow.healPower, 0, 60) / 100;
    const poisonAntiHeal = Math.min(0.4, Math.max(0, target.poisonStacks) * 0.06);
    const antiHeal = Math.min(0.4, Math.max(0, target.antiHeal) + poisonAntiHeal);
    const capRatio = slot === 'ultimate' ? 0.5 : 0.35;
    const cap = Math.max(1, Math.round(target.pow.maxHp * capRatio));
    const requested = Math.max(0, Math.min(cap, Math.round(raw * healPower * (1 - antiHeal))));
    const missing = Math.max(0, target.pow.maxHp - target.hp);
    const healed = Math.min(missing, requested);
    target.hp += healed;
    return { healed, requested, cap };
  }

  applyHaste(target: CombatUnitState): LegacyRoleHasteResult {
    target.speedBuffActionsRemaining = Math.max(target.speedBuffActionsRemaining, 2);
    return { speedBuffApplied: true, timelineProgress: LEGACY_ROLE_HASTE_PROGRESS };
  }

  applyMark(target: CombatUnitState, mechanic: unknown): 'aim' | 'hunt' | null {
    const normalized = String(mechanic || '').trim().toLowerCase();
    const marked = target as LegacyMarkedUnit;
    if (normalized === 'role_marksman_focus') {
      marked.legacyAimMarkActionsRemaining = Math.max(marked.legacyAimMarkActionsRemaining || 0, LEGACY_ROLE_MARK_TURNS);
      return 'aim';
    }
    if (normalized === 'role_assassin_mark') {
      marked.legacyHuntMarkActionsRemaining = Math.max(marked.legacyHuntMarkActionsRemaining || 0, LEGACY_ROLE_MARK_TURNS);
      return 'hunt';
    }
    return null;
  }

  tickMarks(unit: CombatUnitState): void {
    const marked = unit as LegacyMarkedUnit;
    if ((marked.legacyAimMarkActionsRemaining || 0) > 0) {
      marked.legacyAimMarkActionsRemaining = Math.max(0, (marked.legacyAimMarkActionsRemaining || 0) - 1);
    }
    if ((marked.legacyHuntMarkActionsRemaining || 0) > 0) {
      marked.legacyHuntMarkActionsRemaining = Math.max(0, (marked.legacyHuntMarkActionsRemaining || 0) - 1);
    }
  }

  clearMarks(unit: CombatUnitState): void {
    const marked = unit as LegacyMarkedUnit;
    marked.legacyAimMarkActionsRemaining = 0;
    marked.legacyHuntMarkActionsRemaining = 0;
  }

  executeMultiplier(target: CombatUnitState, mechanic: unknown): number {
    if (String(mechanic || '').trim().toLowerCase() !== 'role_assassin_execute') return 1;
    const ratio = target.hp / Math.max(1, target.pow.maxHp);
    return ratio < LEGACY_ASSASSIN_EXECUTE_THRESHOLD ? LEGACY_ASSASSIN_EXECUTE_MULTIPLIER : 1;
  }

  chooseRoleTarget(
    actor: CombatUnitState,
    candidates: CombatUnitState[],
    ability: CombatAbility
  ): CombatUnitState | null {
    const living = candidates.filter((unit) => unit.alive && unit.fieldSlot !== null);
    if (!living.length) return null;
    const role = normalizedCombatRole(actor);

    if (role === 'marksman') {
      const aimed = living.filter((unit) => ((unit as LegacyMarkedUnit).legacyAimMarkActionsRemaining || 0) > 0);
      if (aimed.length) return [...aimed].sort((a, b) => a.hp - b.hp)[0] ?? null;
      if (ability === actor.pow.abilities.ultimate || ability === actor.pow.abilities.skills[1]) {
        return [...living].sort((a, b) => a.hp / a.pow.maxHp - b.hp / b.pow.maxHp)[0] ?? null;
      }
      return null;
    }

    if (role === 'assassin') {
      const score = (unit: CombatUnitState): number => {
        const hpRatio = unit.hp / Math.max(1, unit.pow.maxHp);
        const targetRole = normalizedCombatRole(unit);
        const fragile = ['mage', 'marksman', 'healer', 'enchanter'].includes(targetRole) ? 0.16 : 0;
        const marked = ((unit as LegacyMarkedUnit).legacyHuntMarkActionsRemaining || 0) > 0 ? 0.18 : 0;
        return (1 - hpRatio) * 0.72 + fragile + marked;
      };
      return [...living].sort((a, b) => score(b) - score(a))[0] ?? null;
    }

    return null;
  }
}
