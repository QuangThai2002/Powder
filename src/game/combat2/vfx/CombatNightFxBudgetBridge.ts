import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombatNightFxBudgetInstalled';
const BALANCED_BURST_THRESHOLD = 2;

const TRACER_COLOR: Readonly<Record<CombatProjectileElement, number>> = Object.freeze({
  fire: 0xff7043,
  lava: 0xff4f2e,
  water: 0x4db9ff,
  ice: 0x8adfff,
  lightning: 0xf5dd62,
  storm: 0x78a9ff,
  wind: 0x76e4d2,
  leaf: 0x72d67f,
  poison: 0xa5df66,
  earth: 0xb78c5d,
  steel: 0xc3d3dc,
  light: 0xffefad,
  dark: 0xa88cf2,
  neutral: 0x9ed8e8
});

type FxTier = 'full' | 'balanced' | 'lite';

let activeProjectiles = 0;

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function readableDuration(options: DirectionalProjectileOptions, current: FxTier, burstReducedMotion: boolean): number {
  const requested = Number(options.durationMs || 0);
  const distance = Math.max(1, Phaser.Math.Distance.Between(
    options.source.x,
    options.source.y,
    options.target.x,
    options.target.y
  ));

  if (current === 'lite') {
    return Phaser.Math.Clamp(requested > 0 ? requested : 205, 185, 220);
  }

  if (current === 'balanced') {
    const natural = burstReducedMotion ? 225 : Math.round(245 + Math.min(45, distance * 0.045));
    return Phaser.Math.Clamp(requested > 0 ? requested : natural, burstReducedMotion ? 210 : 235, burstReducedMotion ? 245 : 295);
  }

  const natural = Math.round(265 + Math.min(85, distance * 0.07));
  return Phaser.Math.Clamp(requested > 0 ? requested : natural, 250, 360);
}

function tweenGuide(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  x: number,
  y: number,
  duration: number,
  ease: string
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;

    const cleanup = (): void => {
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const abort = (): void => {
      if (settled) return;
      try { tween?.stop(); } catch { /* scene teardown may already own tween cleanup */ }
      finish();
    };

    const timer = window.setTimeout(finish, duration + 220);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);

    try {
      tween = scene.tweens.add({
        targets: target,
        x,
        y,
        duration,
        ease,
        onComplete: finish,
        onStop: finish
      });
    } catch {
      finish();
    }
  });
}

async function playReadableGuide(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, source, target, element } = options;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const angle = Math.atan2(dy, dx);
  const color = TRACER_COLOR[element] ?? TRACER_COLOR.neutral;
  const length = reducedDetail ? 38 : 54;
  const thickness = reducedDetail ? 5 : 7;

  const guide = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  // Short moving tail + bright head: the eye follows the projectile itself instead of a full-path line.
  guide.add(scene.add.rectangle(-length * 0.18, 0, length, thickness, color, reducedDetail ? 0.38 : 0.52));
  if (!reducedDetail) {
    guide.add(scene.add.rectangle(length * 0.02, 0, length * 0.52, 2.5, 0xffffff, 0.78));
  }
  guide.add(scene.add.triangle(
    length * 0.48,
    0,
    -9,
    -7,
    -9,
    7,
    11,
    0,
    0xffffff,
    0.96
  ));

  try {
    await tweenGuide(
      scene,
      guide,
      target.x,
      target.y,
      durationMs,
      element === 'lightning' ? 'Cubic.easeIn' : 'Sine.easeInOut'
    );
  } finally {
    guide.destroy(true);
  }
}

export function installCombatNightFxBudgetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  const previousPlay = owner.play?.bind(DirectionalElementProjectileVfx) as
    | ((options: DirectionalProjectileOptions) => Promise<void>)
    | undefined;
  if (!previousPlay) return;

  owner.play = async (options: DirectionalProjectileOptions): Promise<void> => {
    const current = tier();
    const concurrency = activeProjectiles + 1;
    const burstReducedMotion = current === 'balanced' && concurrency >= BALANCED_BURST_THRESHOLD;
    const reducedMotion = Boolean(options.reducedMotion) || current === 'lite' || burstReducedMotion;
    const durationMs = readableDuration(options, current, burstReducedMotion);

    activeProjectiles += 1;
    try {
      await Promise.all([
        previousPlay({
          ...options,
          reducedMotion,
          durationMs
        }),
        playReadableGuide(options, durationMs, reducedMotion)
      ]);
    } finally {
      activeProjectiles = Math.max(0, activeProjectiles - 1);
    }
  };

  root.POWDER_COMBAT2_NIGHT_FX_BUDGET = {
    version: 'night-26',
    source: 'POWDER_COMBAT2_FX_TIER',
    full: 'readable-moving-core-with-native-element-vfx',
    balanced: 'readable-moving-core-with-burst-reduced-motion',
    lite: 'minimal-moving-core-and-short-element-vfx',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    burstGuard: true,
    movingProjectileGuide: true,
    fullPathGuideLineReplacedByMovingFocus: true,
    readableTravelMs: { full: '250-360', balanced: '235-295', lite: '185-220' },
    sceneShutdownSafeGuide: true,
    counterFinallySafe: true,
    combatLogicChanged: false
  };
}

installCombatNightFxBudgetBridge();
