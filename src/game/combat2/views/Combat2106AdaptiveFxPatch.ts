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
  if ((memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) return 'lite';
  if ((memory > 0 && memory <= 8) || (cores > 0 && cores <= 8)) return 'balanced';
  return 'full';
}

function applyTier(tier: FxTier): void {
  const root = globalThis as any;
  root.POWDER_COMBAT2_FX_TIER = tier;
  root.POWDER_COMBAT2_LOW_FX = tier === 'lite';
  root.POWDER_COMBAT2_BALANCED_FX = tier === 'balanced';
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
    proto.create = function combat2106Create(this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalCreate.apply(this, args);
      let sampleElapsed = 0;
      let sampleFrames = 0;
      this.events.on('update', (_time: number, delta: number) => {
        if (!state.auto || document.hidden) return;
        sampleElapsed += Math.max(0, Math.min(100, Number(delta) || 0));
        sampleFrames += 1;
        if (sampleElapsed < 1800) return;
        state.fps = sampleElapsed > 0 ? Math.round((sampleFrames * 1000) / sampleElapsed) : 60;
        sampleElapsed = 0; sampleFrames = 0;
        if (state.fps < 48) { state.lowFrames += 1; state.highFrames = 0; }
        else if (state.fps > 57) { state.highFrames += 1; state.lowFrames = 0; }
        else { state.lowFrames = Math.max(0, state.lowFrames - 1); state.highFrames = Math.max(0, state.highFrames - 1); }

        if (state.lowFrames >= 2 && state.tier !== 'lite') {
          state.tier = state.tier === 'full' ? 'balanced' : 'lite';
          state.lowFrames = 0; applyTier(state.tier);
        } else if (state.highFrames >= 4 && state.tier !== 'full') {
          state.tier = state.tier === 'lite' ? 'balanced' : 'full';
          state.highFrames = 0; applyTier(state.tier);
        }
      });
      return result;
    };
  }

  const originalIntro = proto.showPreBattleIntro;
  proto.showPreBattleIntro = function combat2106Intro(this: Phaser.Scene & { startCombatFlow?: () => void }): void {
    if (typeof originalIntro === 'function') return originalIntro.call(this);
    this.startCombatFlow?.();
  };

  root.POWDER_COMBAT2_PERFORMANCE = {
    version: '2.10.6',
    mode: 'adaptive-fx-governor',
    get tier(): FxTier { return state.tier; },
    get fps(): number { return state.fps; },
    get auto(): boolean { return state.auto; },
    set auto(value: boolean) { state.auto = Boolean(value); },
    setTier(tier: FxTier): void {
      if (!['full', 'balanced', 'lite'].includes(tier)) return;
      state.tier = tier; state.lowFrames = 0; state.highFrames = 0; applyTier(tier);
    }
  };

  // Small DEV-only marker; no continuous text updates or telemetry rendering.
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    root.POWDER_COMBAT2_PERFORMANCE.devLabel = (scene: Phaser.Scene): Phaser.GameObjects.Text => scene.add.text(scene.scale.width - 18, scene.scale.height - 78, '2.10.6 · ADAPTIVE FX', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '10px', color: '#bfefff', backgroundColor: '#04101888', padding: { x: 6, y: 3 }
    }).setOrigin(1, 1).setDepth(98).setAlpha(0.6);
  }
}
