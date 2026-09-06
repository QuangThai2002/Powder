import Phaser from 'phaser';
import { warnCombatVfxDev } from './CombatVfxRegistry';

export type CombatVfxPresentationMode = 'normal' | 'reduced' | 'skip-intro';
export type CombatVfxTimelinePhase =
  | 'create' | 'appear' | 'build' | 'charge' | 'release' | 'fade' | 'destroy'
  | 'intro' | 'activate' | 'pow-emphasis' | 'magic-circle' | 'travel-or-slash' | 'impact' | 'hit-reaction' | 'finish';

export type CombatVfxTimelineStep = Readonly<{
  phase: CombatVfxTimelinePhase;
  run: () => Promise<void> | void;
}>;

export function resolveCombatVfxPresentationMode(reducedMotion = false): CombatVfxPresentationMode {
  if (reducedMotion) return 'reduced';
  const requested = String((globalThis as any).POWDER_COMBAT2_ULTIMATE_VFX_MODE || 'normal');
  if (requested === 'skip-intro') return 'skip-intro';
  if (requested === 'reduced' || String((globalThis as any).POWDER_COMBAT2_FX_TIER || '') === 'lite') return 'reduced';
  return 'normal';
}

function active(scene: Phaser.Scene): boolean {
  return Boolean(scene?.sys?.isActive?.());
}

/** Owns presentation callbacks only. It never controls combat state or damage. */
export class CombatVfxTimeline {
  private readonly activeTasks = new Set<Promise<void>>();
  private readonly phaseHistory: CombatVfxTimelinePhase[] = [];
  private cancelled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly label: string,
    readonly mode: CombatVfxPresentationMode = 'normal'
  ) {
    const cancel = (): void => { this.cancelled = true; };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
    scene.events.once(Phaser.Scenes.Events.DESTROY, cancel);
  }

  get phases(): readonly CombatVfxTimelinePhase[] { return this.phaseHistory; }

  private shouldSkip(phase: CombatVfxTimelinePhase): boolean {
    return this.mode === 'skip-intro' && ['intro', 'activate', 'pow-emphasis', 'magic-circle', 'appear', 'build', 'charge'].includes(phase);
  }

  async run(phase: CombatVfxTimelinePhase, work: () => Promise<void> | void): Promise<void> {
    if (this.cancelled || !active(this.scene) || this.shouldSkip(phase)) return;
    this.phaseHistory.push(phase);
    const task = Promise.resolve()
      .then(work)
      .catch(() => warnCombatVfxDev(`timeline:${this.label}:${phase}`, `Presentation phase '${phase}' failed in ${this.label}; cleanup/fallback continues.`));
    this.activeTasks.add(task);
    try { await task; }
    finally { this.activeTasks.delete(task); }
  }

  async runParallel(steps: readonly CombatVfxTimelineStep[]): Promise<void> {
    await Promise.all(steps.map((step) => this.run(step.phase, step.run)));
  }

  async finish(): Promise<void> {
    if (this.activeTasks.size > 0) await Promise.allSettled([...this.activeTasks]);
    this.phaseHistory.push('finish');
  }

  destroy(): void {
    this.cancelled = true;
    this.phaseHistory.push('destroy');
  }
}
