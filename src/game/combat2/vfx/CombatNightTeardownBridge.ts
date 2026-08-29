import Phaser from 'phaser';
import { PowView } from '../views/PowView';
import { DirectionalElementProjectileVfx } from './DirectionalElementProjectileVfx';

const FLAG = '__powderCombatNightTeardownBridgeInstalled';

type TweenPromise = (config: Phaser.Types.Tweens.TweenBuilderConfig) => Promise<void>;

let activeSafeTweens = 0;
let peakSafeTweens = 0;
let shutdownAborts = 0;
let settledSafeTweens = 0;

function lifecycleSnapshot(): Readonly<{
  activeSafeTweens: number;
  peakSafeTweens: number;
  shutdownAborts: number;
  settledSafeTweens: number;
}> {
  return {
    activeSafeTweens,
    peakSafeTweens,
    shutdownAborts,
    settledSafeTweens
  };
}

function safeTween(
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackDuration = 180
): Promise<void> {
  activeSafeTweens += 1;
  peakSafeTweens = Math.max(peakSafeTweens, activeSafeTweens);

  return new Promise((resolve) => {
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;
    const duration = typeof config.duration === 'number' ? config.duration : fallbackDuration;
    const delay = typeof config.delay === 'number' ? config.delay : 0;
    const repeat = typeof config.repeat === 'number' && config.repeat > 0 ? config.repeat : 0;
    const cycles = (repeat + 1) * (config.yoyo ? 2 : 1);

    const cleanup = (): void => {
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      activeSafeTweens = Math.max(0, activeSafeTweens - 1);
      settledSafeTweens += 1;
      resolve();
    };
    const abort = (): void => {
      if (settled) return;
      shutdownAborts += 1;
      try { tween?.stop(); } catch { /* scene teardown may already own tween cleanup */ }
      finish();
    };

    const timer = window.setTimeout(
      finish,
      Math.max(260, delay + duration * cycles + 240)
    );
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);

    try {
      tween = scene.tweens.add({ ...config, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

function installPowTweenCleanup(): void {
  const proto = PowView.prototype as any;
  if (proto.__nightTeardownTweenInstalled) return;

  proto.tweenPromise = function combatNightTeardownTween(
    this: { scene: Phaser.Scene },
    config: Phaser.Types.Tweens.TweenBuilderConfig
  ): Promise<void> {
    return safeTween(this.scene, config, 160);
  } satisfies TweenPromise;

  proto.__nightTeardownTweenInstalled = true;
}

function installProjectileTweenCleanup(): void {
  const owner = DirectionalElementProjectileVfx as any;
  if (owner.__nightTeardownTweenInstalled) return;

  owner.tween = (
    scene: Phaser.Scene,
    config: Phaser.Types.Tweens.TweenBuilderConfig
  ): Promise<void> => safeTween(scene, config, 180);

  owner.__nightTeardownTweenInstalled = true;
}

export function installCombatNightTeardownBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  installPowTweenCleanup();
  installProjectileTweenCleanup();

  root.POWDER_COMBAT2_NIGHT_TEARDOWN = {
    version: 'night-24',
    sceneShutdownSafe: true,
    powTweens: true,
    projectileTweens: true,
    lifecycleCounters: true,
    getLifecycleSnapshot: lifecycleSnapshot,
    expectedActiveAfterShutdown: 0,
    perFramePolling: false,
    combatLogicChanged: false
  };
}

installCombatNightTeardownBridge();
