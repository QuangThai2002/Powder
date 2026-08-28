import type Phaser from 'phaser';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2106AdaptiveFxInstalled';
type FxTier = 'full' | 'balanced' | 'lite';

type FxState = {
  tier: FxTier;
  fps: number;
  lowFrames: number;
  highFrames: number;
  auto: boolean;
};

function initialTier(): FxTier {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'lite';
  const memory = Number((navigator as any)?.deviceMemory || 0);
  const cores = Number(navigator?.hardwareConcurrency || 0);

  // Do not punish normal desktop/laptop hardware before a real FPS sample exists.
  // Only clearly weak devices start reduced; everything else gets Full first and the
  // measured-FPS loop below can still step down safely when required.
  if ((memory > 0 && memory <= 3) || (cores > 0 && cores <= 2)) return 'lite';
  if ((memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) return 'balanced';
  return 'full';
}

function applyTier(tier: FxTier): void {
  const root = globalThis as any;
  root.POWDER_COMBAT2_FX_TIER = tier;
  root.POWDER_COMBAT2_LOW_FX = tier === 'lite';
  root.POWDER_COMBAT2_BALANCED_FX = tier === 'balanced';
  root.POWDER_COMBAT2_FX_BUDGET = tier === 'full'
    ? { hitCap: 5, rays: 10, particles: 1 }
    : tier === 'balanced'
      ? { hitCap: 4, rays: 7, particles: 0.72 }
      : { hitCap: 2, rays: 4, particles: 0.42 };
}

export function installCombat2106AdaptiveFxPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const state: FxState = { tier: initialTier(), fps: 60, lowFrames: 0, highFrames: 0, auto: true };
  applyTier(state.tier);

  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.create;
  if (typeof originalCreate === 'function') {
    proto.create = function combat2107Create(this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalCreate.apply(this, args);
      let sampleElapsed = 0;
      let sampleFrames = 0;
      let disposed = false;

      const resetSample = (): void => {
        sampleElapsed = 0;
        sampleFrames = 0;
        state.lowFrames = 0;
        state.highFrames = 0;
      };

      const onUpdate = (_time: number, delta: number): void => {
        if (disposed || !state.auto || document.hidden) return;
        sampleElapsed += Math.max(0, Math.min(100, Number(delta) || 0));
        sampleFrames += 1;
        if (sampleElapsed < 1800) return;

        state.fps = sampleElapsed > 0 ? Math.round((sampleFrames * 1000) / sampleElapsed) : 60;
        sampleElapsed = 0;
        sampleFrames = 0;

        if (state.fps < 48) { state.lowFrames += 1; state.highFrames = 0; }
        else if (state.fps > 57) { state.highFrames += 1; state.lowFrames = 0; }
        else {
          state.lowFrames = Math.max(0, state.lowFrames - 1);
          state.highFrames = Math.max(0, state.highFrames - 1);
        }

        if (state.lowFrames >= 2 && state.tier !== 'lite') {
          state.tier = state.tier === 'full' ? 'balanced' : 'lite';
          state.lowFrames = 0;
          applyTier(state.tier);
        } else if (state.highFrames >= 3 && state.tier !== 'full') {
          state.tier = state.tier === 'lite' ? 'balanced' : 'full';
          state.highFrames = 0;
          applyTier(state.tier);
        }
      };

      const onVisibility = (): void => {
        if (document.hidden) resetSample();
      };

      const cleanup = (): void => {
        if (disposed) return;
        disposed = true;
        this.events.off('update', onUpdate);
        document.removeEventListener('visibilitychange', onVisibility);
        resetSample();
      };

      this.events.on('update', onUpdate);
      this.events.once('shutdown', cleanup);
      this.events.once('destroy', cleanup);
      document.addEventListener('visibilitychange', onVisibility, { passive: true });
      return result;
    };
  }

  const originalIntro = proto.showPreBattleIntro;
  proto.showPreBattleIntro = function combat2107Intro(this: Phaser.Scene & { startCombatFlow?: () => void }): void {
    if (typeof originalIntro === 'function') return originalIntro.call(this);
    this.startCombatFlow?.();
  };

  root.POWDER_COMBAT2_PERFORMANCE = {
    version: '2.14.3',
    mode: 'adaptive-fx-full-first-measured-downgrade',
    get tier(): FxTier { return state.tier; },
    get fps(): number { return state.fps; },
    get auto(): boolean { return state.auto; },
    get budget(): { hitCap: number; rays: number; particles: number } { return root.POWDER_COMBAT2_FX_BUDGET; },
    set auto(value: boolean) {
      state.auto = Boolean(value);
      state.lowFrames = 0;
      state.highFrames = 0;
    },
    setTier(tier: FxTier): void {
      if (!['full', 'balanced', 'lite'].includes(tier)) return;
      state.auto = false;
      state.tier = tier;
      state.lowFrames = 0;
      state.highFrames = 0;
      applyTier(tier);
    },
    useAuto(): void {
      state.auto = true;
      state.lowFrames = 0;
      state.highFrames = 0;
    }
  };

  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    root.POWDER_COMBAT2_PERFORMANCE.devLabel = (scene: Phaser.Scene): Phaser.GameObjects.Text => scene.add.text(scene.scale.width - 18, scene.scale.height - 78, '2.14.3 · ADAPTIVE FULL-FIRST', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '10px', color: '#bfefff', backgroundColor: '#04101888', padding: { x: 6, y: 3 }
    }).setOrigin(1, 1).setDepth(98).setAlpha(0.6);
  }
}
