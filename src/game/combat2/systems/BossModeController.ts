import type { CombatUnitState } from './CombatState';
import { CombatState } from './CombatState';
import { TurnManager } from './TurnManager';
import { applyRawRageGain, sanitizeRagePoints } from './CombatRageEngine';

type BossType = 'daily' | 'weekly' | 'promotion' | 'story';
type PendingMechanic =
  | { response: 'cleanse'; targetId: string; mark: string }
  | { response: 'shield-break'; baseline: number; amount: number };

export type BossMechanicEvent = Readonly<{ label: string; targetIds: string[]; damage?: number; phaseChanged?: boolean }>;

type BossRageIntent = 'FULL_READY' | 'GAIN' | 'SPEND';

/**
 * Legacy Boss writes are mechanic intents, not percentages in the canonical
 * 0..8 resource. A mechanic hit is one raw gain event; an interruption is one
 * canonical penalty point. The old 25/30 values are intentionally not divided
 * into Rage points.
 */
function applyBossRageIntent(unit: CombatUnitState, intent: BossRageIntent): number {
  const before = sanitizeRagePoints(unit.ragePoints);
  if (intent === 'FULL_READY') unit.ragePoints = 4;
  else if (intent === 'GAIN') unit.ragePoints = applyRawRageGain(before, 1).next;
  else unit.ragePoints = Math.max(0, before - 1);
  return unit.ragePoints - before;
}

/** Direct Combat2 port of the legacy Boss 18.6 phase/signature contract. */
export class BossModeController {
  private readonly type: BossType;
  private readonly config: Record<string, any>;
  private readonly boss: CombatUnitState;
  private phase = 1;
  private signatureCounter = 0;
  private pending: PendingMechanic | null = null;

  static from(state: CombatState, turns: TurnManager): BossModeController | null {
    if (state.battleMode !== 'boss') return null;
    const context = state.bossContext;
    const type = String(context.bossType || context.bossChallengeId || '').toLowerCase();
    const config = context.phaseConfig;
    if (!['daily', 'weekly', 'promotion', 'story'].includes(type) || !config || typeof config !== 'object') return null;
    const boss = state.activeLiving('enemy')[0];
    return boss ? new BossModeController(state, turns, boss, type as BossType, config as Record<string, any>) : null;
  }

  private constructor(
    private readonly state: CombatState,
    private readonly turns: TurnManager,
    boss: CombatUnitState,
    type: BossType,
    config: Record<string, any>
  ) {
    this.boss = boss;
    this.type = type;
    this.config = config;
  }

  beforeEnemyAction(actor: CombatUnitState): BossMechanicEvent | null {
    if (actor.instanceId !== this.boss.instanceId || !this.pending) return null;
    const pending = this.pending;
    this.pending = null;
    if (pending.response === 'cleanse') {
      const target = this.state.getUnit(pending.targetId);
      if (!target || !target.alive) return { label: `${pending.mark} DA DUOC HOA GIAI`, targetIds: [] };
      if (this.type === 'story') {
        target.speedDebuffActionsRemaining = Math.max(target.speedDebuffActionsRemaining, 2);
        this.state.refreshSpeed(target);
        this.turns.delayUnit(target.instanceId, (this.phase >= 2 ? 18 : 14) / 100);
        return { label: 'TRAN AP · CHAM NHOI', targetIds: [target.instanceId] };
      }
      const ratio = this.phase >= 2 ? 0.11 : 0.085;
      const damage = this.applyRawDamage(target, Math.max(1, Math.round(target.pow.maxHp * ratio)));
      applyBossRageIntent(target, 'GAIN');
      return { label: 'HUYET LIEP · TRUY SAT', targetIds: [target.instanceId], damage };
    }
    const interrupted = this.boss.shield <= pending.baseline + 1;
    this.boss.shield = Math.max(pending.baseline, this.boss.shield - Math.min(pending.amount, Math.max(0, this.boss.shield - pending.baseline)));
    if (interrupted) {
      applyBossRageIntent(this.boss, 'SPEND');
      return { label: 'BOSS MECHANIC BI NGAT', targetIds: [this.boss.instanceId] };
    }
    if (this.type === 'promotion') {
      for (const target of this.state.living('player')) {
        target.shield = Math.max(0, target.shield - Math.round(target.shield * 0.30));
        target.antiHeal = Math.max(target.antiHeal, 0.25);
        target.antiHealActionsRemaining = Math.max(target.antiHealActionsRemaining, 2);
      }
      return { label: 'PHA TRAN · GIAM HOI PHUC', targetIds: this.state.living('player').map((unit) => unit.instanceId) };
    }
    const ratio = this.phase >= 3 ? 0.10 : 0.08;
    let damage = 0;
    for (const target of this.state.living('player')) {
      damage += this.applyRawDamage(target, Math.max(1, Math.round(target.pow.maxHp * ratio)));
      applyBossRageIntent(target, 'GAIN');
    }
    return { label: 'DAI NAN', targetIds: this.state.living('player').map((unit) => unit.instanceId), damage };
  }

  afterAction(actor: CombatUnitState, result: { cleansed?: boolean; targetId?: string } = {}): BossMechanicEvent | null {
    const phaseEvent = this.updatePhase();
    if (actor.side === 'player' && this.pending?.response === 'cleanse' && result.cleansed && result.targetId === this.pending.targetId) {
      this.pending = null;
      return { label: 'BOSS MARK DA DUOC THANH TAY', targetIds: [result.targetId] };
    }
    if (actor.instanceId !== this.boss.instanceId || !this.boss.alive || this.pending) return phaseEvent;
    this.signatureCounter += 1;
    const cadence = this.cadence();
    if (this.signatureCounter < cadence - 1) return phaseEvent;
    this.signatureCounter = 0;
    this.pending = this.armMechanic();
    return this.pending ? { label: `BOSS · ${String(this.config.signature?.name || 'MECHANIC').toUpperCase()}`, targetIds: this.pending.response === 'cleanse' ? [this.pending.targetId] : [this.boss.instanceId] } : phaseEvent;
  }

  snapshot(): Record<string, unknown> {
    return { bossChallengeId: this.type, phase: this.phase, maxPhase: this.thresholds().length + 1, pending: this.pending?.response ?? null, signatureCounter: this.signatureCounter, ragePoints: this.boss.ragePoints };
  }

  private updatePhase(): BossMechanicEvent | null {
    if (!this.boss.alive) return null;
    const desired = this.thresholds().reduce((phase, threshold, index) => this.boss.hp / Math.max(1, this.boss.pow.maxHp) <= threshold ? index + 2 : phase, 1);
    if (desired <= this.phase) return null;
    this.phase = desired;
    this.pending = null;
    this.signatureCounter = 0;
    const power = this.number('phasePower', 1);
    const speed = this.number('phaseSpeed', 1);
    this.boss.attackMultiplier = Math.min(10, this.boss.attackMultiplier * power);
    this.boss.abilityPowerMultiplier = Math.min(10, this.boss.abilityPowerMultiplier * power);
    this.boss.speed = Math.min(9999, this.boss.speed * speed);
    this.boss.shield += Math.max(1, Math.round(this.boss.pow.maxHp * this.number('phaseShield', 0)));
    // Legacy Boss phase changes add 12% timeline meter; the final phase adds
    // the separate 8% enrage push. Keep this as scheduling, not a resource.
    this.turns.advanceUnit(this.boss.instanceId, 0.12);
    if (this.phase >= this.thresholds().length + 1) this.turns.advanceUnit(this.boss.instanceId, 0.08);
    // Legacy phase/enrage writes rage=100. The boundary semantic is FULL_READY,
    // not a percentage arithmetic conversion.
    applyBossRageIntent(this.boss, 'FULL_READY');
    return { label: `BOSS PHA ${this.phase}`, targetIds: [this.boss.instanceId], phaseChanged: true };
  }

  private armMechanic(): PendingMechanic | null {
    if (this.type === 'daily' || this.type === 'story') {
      const target = [...this.state.living('player')].sort((a, b) => this.type === 'daily'
        ? a.hp / Math.max(1, a.pow.maxHp) - b.hp / Math.max(1, b.pow.maxHp)
        : b.speed - a.speed)[0];
      return target ? { response: 'cleanse', targetId: target.instanceId, mark: this.type === 'daily' ? 'BOSS MARK' : 'SUPPRESSION MARK' } : null;
    }
    const ratio = this.type === 'promotion' ? (this.phase >= 2 ? 0.10 : 0.08) : (this.phase >= 3 ? 0.12 : 0.10);
    const baseline = this.boss.shield;
    const amount = Math.max(1, Math.round(this.boss.pow.maxHp * ratio));
    this.boss.shield += amount;
    return { response: 'shield-break', baseline, amount };
  }

  private cadence(): number {
    const values = Array.isArray(this.config.signature?.cadence) ? this.config.signature.cadence : [3];
    return Math.max(2, Number(values[Math.min(values.length - 1, this.phase - 1)]) || 3);
  }

  private thresholds(): number[] { return Array.isArray(this.config.thresholds) ? this.config.thresholds.map(Number).filter((value) => value > 0 && value < 1) : []; }
  private number(key: string, fallback: number): number { const value = Number(this.config[key]); return Number.isFinite(value) ? value : fallback; }
  private applyRawDamage(target: CombatUnitState, amount: number): number {
    const shield = Math.min(target.shield, amount);
    const hp = Math.min(target.hp, Math.max(0, amount - shield));
    target.shield -= shield;
    target.hp -= hp;
    target.alive = target.hp > 0;
    return shield + hp;
  }
}
