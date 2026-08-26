import type { CombatUnitState } from './CombatState';
import { ACTION_BASE_RAW_GAIN, applyRawRageGain } from './CombatRageEngine';

export type SupportActionKind = 'speed' | 'heal' | 'shield';

export interface SupportActionResult {
  kind: SupportActionKind;
  value: number;
  label: string;
  rageGained: number;
}

export class SupportActionResolver {
  resolve(kind: SupportActionKind, actor: CombatUnitState): SupportActionResult {
    let result: Omit<SupportActionResult, 'rageGained'>;
    switch (kind) {
      case 'speed': result = this.applySpeed(actor); break;
      case 'heal': result = this.applyHeal(actor); break;
      case 'shield': result = this.applyShield(actor); break;
    }
    const rage = applyRawRageGain(actor.ragePoints, ACTION_BASE_RAW_GAIN);
    actor.ragePoints = rage.next;
    return { ...result, rageGained: rage.effectiveGain };
  }

  private applySpeed(actor: CombatUnitState): Omit<SupportActionResult, 'rageGained'> {
    const baseSpeed = Number.isFinite(actor.pow.speed) && actor.pow.speed > 0 ? actor.pow.speed : 1;
    const boosted = Math.min(9999, Math.max(1, baseSpeed * 1.25));
    actor.speed = boosted;
    actor.speedBuffActionsRemaining = 3;
    return { kind: 'speed', value: Math.round((boosted / baseSpeed - 1) * 100), label: 'TỐC ĐỘ' };
  }

  private applyHeal(actor: CombatUnitState): Omit<SupportActionResult, 'rageGained'> {
    const missing = Math.max(0, actor.pow.maxHp - actor.hp);
    const amount = Math.min(missing, Math.max(1, Math.round(actor.pow.maxHp * 0.2)));
    actor.hp += amount;
    return { kind: 'heal', value: amount, label: 'HỒI MÁU' };
  }

  private applyShield(actor: CombatUnitState): Omit<SupportActionResult, 'rageGained'> {
    const amount = Math.max(1, Math.round(actor.pow.maxHp * 0.18));
    actor.shield = Math.min(actor.pow.maxHp * 3, actor.shield + amount);
    return { kind: 'shield', value: amount, label: 'KHIÊN' };
  }
}
