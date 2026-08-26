import type { CombatUnitState } from './CombatState';

export type DamageKind = 'basic' | 'skill' | 'ultimate';
export type ElementOutcome = 'immune' | 'strong' | 'resisted' | 'weak' | 'neutral';

interface ElementCatalogRule {
  strong?: string[];
  weak?: string[];
  resist?: string[];
  immune?: string[];
  damageMultiplier?: {
    strong?: number;
    neutral?: number;
    resist?: number;
    weak?: number;
    immune?: number;
  };
}

interface ElementEvaluation {
  multiplier: number;
  outcome: ElementOutcome;
}

interface DamageEvaluation extends ElementEvaluation {
  roleOutgoing: number;
  roleIncoming: number;
  passiveOutgoing: number;
  passiveIncoming: number;
  totalMultiplier: number;
}

const DEFAULT_ELEMENT_MULTIPLIERS = {
  strong: 1.5,
  neutral: 1,
  resist: 0.75,
  weak: 0.67,
  immune: 0
} as const;

/**
 * Pure deterministic combat identity rules.
 *
 * No RNG, timers or renderer access are allowed here. Element, role and the
 * passives implemented in this layer stay reproducible in manual play and
 * regression tests.
 */
export class CombatIdentityRules {
  evaluateDamage(
    actor: CombatUnitState,
    target: CombatUnitState,
    kind: DamageKind,
    abilityType = 'physical'
  ): DamageEvaluation {
    const usesElement = kind !== 'basic' && abilityType.trim().toLowerCase() !== 'physical';
    const element = usesElement
      ? this.evaluateElement(actor.pow.elementKey, target.pow.elementKey)
      : { multiplier: 1, outcome: 'neutral' as const };
    const roleOutgoing = this.outgoingRoleMultiplier(actor, target, kind);
    const roleIncoming = this.incomingRoleMultiplier(target);
    const passiveOutgoing = this.outgoingPassiveMultiplier(actor);
    const passiveIncoming = this.incomingPassiveMultiplier(target);
    const totalMultiplier = this.clampMultiplier(
      element.multiplier *
        roleOutgoing *
        roleIncoming *
        passiveOutgoing *
        passiveIncoming,
      element.multiplier === 0 ? 0 : 0.1,
      4
    );

    return {
      ...element,
      roleOutgoing,
      roleIncoming,
      passiveOutgoing,
      passiveIncoming,
      totalMultiplier
    };
  }

  supportMultiplier(actor: CombatUnitState): number {
    const role = this.normalize(actor.pow.role);

    if (role.includes('tri lieu') || role.includes('healer')) {
      return 1.2;
    }
    if (role.includes('nhac cong') || role.includes('musician')) {
      return 1.12;
    }
    if (role.includes('thuat su') || role.includes('enchanter')) {
      return 1.08;
    }

    return 1;
  }

  statusDurationBonus(actor: CombatUnitState, status: string): number {
    const role = this.normalize(actor.pow.role);
    const normalizedStatus = this.normalize(status);
    const isControlOrDot = [
      'stun',
      'freeze',
      'slow',
      'burn',
      'poison'
    ].includes(normalizedStatus);
    const isBuff = [
      'shield',
      'regeneration',
      'attack up',
      'defense up',
      'ap up'
    ].includes(normalizedStatus);

    if ((role.includes('thuat su') || role.includes('enchanter')) && isControlOrDot) {
      return 1;
    }
    if ((role.includes('nhac cong') || role.includes('musician')) && isBuff) {
      return 1;
    }

    return 0;
  }

  private evaluateElement(attackerKey: string, targetKey: string): ElementEvaluation {
    const attacker = this.elementRule(attackerKey);
    const target = this.elementRule(targetKey);
    const attackerId = String(attackerKey || '').trim().toLowerCase();
    const targetId = String(targetKey || '').trim().toLowerCase();
    const multipliers = {
      ...DEFAULT_ELEMENT_MULTIPLIERS,
      ...(attacker?.damageMultiplier ?? {})
    };

    if (this.includes(target?.immune, attackerId)) {
      return { multiplier: this.safeFinite(multipliers.immune, 0), outcome: 'immune' };
    }
    if (this.includes(attacker?.strong, targetId)) {
      return {
        multiplier: this.safePositive(multipliers.strong, DEFAULT_ELEMENT_MULTIPLIERS.strong),
        outcome: 'strong'
      };
    }
    if (this.includes(target?.resist, attackerId)) {
      return {
        multiplier: this.safePositive(multipliers.resist, DEFAULT_ELEMENT_MULTIPLIERS.resist),
        outcome: 'resisted'
      };
    }
    if (this.includes(attacker?.weak, targetId)) {
      return {
        multiplier: this.safePositive(multipliers.weak, DEFAULT_ELEMENT_MULTIPLIERS.weak),
        outcome: 'weak'
      };
    }

    return {
      multiplier: this.safePositive(multipliers.neutral, 1),
      outcome: 'neutral'
    };
  }

  private outgoingRoleMultiplier(
    actor: CombatUnitState,
    target: CombatUnitState,
    kind: DamageKind
  ): number {
    const role = this.normalize(actor.pow.role);

    if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) {
      return kind === 'basic' ? 1.1 : 1.04;
    }
    if (role.includes('phap su') || role.includes('mage')) {
      return kind === 'basic' ? 1 : 1.1;
    }
    if (role.includes('thuat su') || role.includes('enchanter')) {
      return kind === 'basic' ? 1 : 1.06;
    }
    if (role.includes('dau si') || role.includes('fighter')) {
      return 1.06;
    }
    if (role.includes('sat thu') || role.includes('assassin')) {
      const hpRatio = target.pow.maxHp > 0 ? target.hp / target.pow.maxHp : 1;
      return hpRatio <= 0.5 ? 1.16 : 1.04;
    }
    if (role.includes('hiep si') || role.includes('knight')) {
      return kind === 'basic' ? 1.04 : 1;
    }

    return 1;
  }

  private incomingRoleMultiplier(target: CombatUnitState): number {
    const role = this.normalize(target.pow.role);

    if (role.includes('do don') || role.includes('tank')) {
      return 0.88;
    }
    if (role.includes('hiep si') || role.includes('knight')) {
      return 0.94;
    }
    if (role.includes('dau si') || role.includes('fighter')) {
      return 0.97;
    }

    return 1;
  }

  private outgoingPassiveMultiplier(actor: CombatUnitState): number {
    const passiveId = String(actor.pow.passive?.id || '').trim().toLowerCase();

    if (passiveId === 'missing_hp_atk') {
      const missingRatio = this.missingHpRatio(actor);
      return 1 + missingRatio * 0.25;
    }

    return 1;
  }

  private incomingPassiveMultiplier(target: CombatUnitState): number {
    const passiveId = String(target.pow.passive?.id || '').trim().toLowerCase();

    if (passiveId === 'missing_hp_def') {
      const missingRatio = this.missingHpRatio(target);
      return Math.max(0.8, 1 - missingRatio * 0.2);
    }

    return 1;
  }

  private missingHpRatio(unit: CombatUnitState): number {
    const maxHp = Number.isFinite(unit.pow.maxHp) && unit.pow.maxHp > 0
      ? unit.pow.maxHp
      : 1;
    const hp = Number.isFinite(unit.hp) ? unit.hp : maxHp;
    return Math.min(1, Math.max(0, 1 - hp / maxHp));
  }

  private elementRule(key: string): ElementCatalogRule | undefined {
    const catalog = (
      window as unknown as {
        POWDER_DATA?: { elements?: Record<string, ElementCatalogRule> };
      }
    ).POWDER_DATA;

    return catalog?.elements?.[String(key || '').trim().toLowerCase()];
  }

  private includes(values: string[] | undefined, target: string): boolean {
    return Array.isArray(values) && values.some((value) => String(value).toLowerCase() === target);
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private clampMultiplier(value: number, min: number, max: number): number {
    const safe = Number.isFinite(value) ? value : 1;
    return Math.min(max, Math.max(min, safe));
  }

  private safePositive(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
  }

  private safeFinite(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) ? (value as number) : fallback;
  }
}
