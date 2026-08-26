import type { CombatUnitState } from './CombatState';

export type SupportActionKind = 'speed' | 'heal' | 'shield';

export interface SupportActionResult {
  kind: SupportActionKind;
  value: number;
  label: string;
}

export class SupportActionResolver {
  resolve(kind: SupportActionKind, actor: CombatUnitState): SupportActionResult {
    switch (kind) {
      case 'speed':
        return this.applySpeed(actor);
      case 'heal':
        return this.applyHeal(actor);
      case 'shield':
        return this.applyShield(actor);
    }
  }

  private applySpeed(actor: CombatUnitState): SupportActionResult {
    const baseSpeed = Number.isFinite(actor.pow.speed) && actor.pow.speed > 0
      ? actor.pow.speed
      : 1;
    const boosted = Math.min(9999, Math.max(1, baseSpeed * 1.25));

    actor.speed = boosted;
    // completeAction() immediately consumes one count, leaving two future
    // actor actions at boosted speed before TurnManager restores base speed.
    actor.speedBuffActionsRemaining = 3;
    actor.mana = Math.min(actor.pow.maxMana, actor.mana + 4);

    return {
      kind: 'speed',
      value: Math.round((boosted / baseSpeed - 1) * 100),
      label: 'TỐC ĐỘ'
    };
  }

  private applyHeal(actor: CombatUnitState): SupportActionResult {
    const missing = Math.max(0, actor.pow.maxHp - actor.hp);
    const amount = Math.min(missing, Math.max(1, Math.round(actor.pow.maxHp * 0.2)));

    actor.hp += amount;
    actor.mana = Math.min(actor.pow.maxMana, actor.mana + 4);

    return {
      kind: 'heal',
      value: amount,
      label: 'HỒI MÁU'
    };
  }

  private applyShield(actor: CombatUnitState): SupportActionResult {
    const amount = Math.max(1, Math.round(actor.pow.maxHp * 0.18));

    actor.shield = Math.min(actor.pow.maxHp * 3, actor.shield + amount);
    actor.mana = Math.min(actor.pow.maxMana, actor.mana + 4);

    return {
      kind: 'shield',
      value: amount,
      label: 'KHIÊN'
    };
  }
}
