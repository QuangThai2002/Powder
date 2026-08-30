import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombatNightFxBudgetInstalled';
const BALANCED_BURST_THRESHOLD = 2;

const PROJECTILE_COLOR: Readonly<Record<CombatProjectileElement, number>> = Object.freeze({
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

  if (current === 'lite') return Phaser.Math.Clamp(requested > 0 ? requested : 195, 175, 215);
  if (current === 'balanced') {
    const natural = burstReducedMotion ? 215 : Math.round(225 + Math.min(35, distance * 0.035));
    return Phaser.Math.Clamp(requested > 0 ? requested : natural, burstReducedMotion ? 195 : 215, burstReducedMotion ? 235 : 275);
  }

  const natural = Math.round(240 + Math.min(55, distance * 0.05));
  return Phaser.Math.Clamp(requested > 0 ? requested : natural, 230, 310);
}

function tweenObject(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      if (settled) return;
      try { tween?.stop(); } catch { /* scene teardown owns the tween manager */ }
      finish();
    };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      tween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

async function playSimpleImpact(options: DirectionalProjectileOptions, reducedDetail: boolean): Promise<void> {
  const { scene, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const radius = reducedDetail ? 14 : 19;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 1);
  impact.add([
    scene.add.circle(0, 0, radius * 0.48, color, 0.34),
    scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, color, 0.88)
  ]);

  try {
    await tweenObject(scene, impact, {
      scaleX: reducedDetail ? 1.28 : 1.48,
      scaleY: reducedDetail ? 1.28 : 1.48,
      alpha: 0,
      duration: reducedDetail ? 115 : 155,
      ease: 'Quad.easeOut'
    }, reducedDetail ? 300 : 360);
  } finally {
    impact.destroy(true);
  }
}

async function playSimpleProjectile(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, source, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const angle = Math.atan2(dy, dx);
  const headRadius = reducedDetail ? 6 : 8;
  const tailLength = reducedDetail ? 20 : 30;
  const tailThickness = reducedDetail ? 4 : 5;

  // Night 42 intentionally uses ONE projectile object only.
  // There is no full source-to-target beam and no second guide layered on top.
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  projectile.add([
    scene.add.rectangle(-tailLength * 0.56, 0, tailLength, tailThickness, color, reducedDetail ? 0.28 : 0.4),
    scene.add.circle(1, 0, headRadius + 3, color, reducedDetail ? 0.18 : 0.24),
    scene.add.circle(3, 0, headRadius, color, 0.96),
    scene.add.circle(5, 0, Math.max(2.5, headRadius * 0.42), 0xffffff, 0.9)
  ]);

  try {
    await tweenObject(scene, projectile, {
      x: target.x,
      y: target.y,
      duration: durationMs,
      ease: element === 'lightning' ? 'Cubic.easeIn' : 'Sine.easeInOut'
    }, durationMs + 260);
  } finally {
    projectile.destroy(true);
  }

  await playSimpleImpact(options, reducedDetail);
}

export function installCombatNightFxBudgetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;

  // Final Night owner. Do not invoke the legacy projectile implementation here:
  // it draws a full path line and element-specific geometry which made attacks read
  // as multiple overlapping projectiles. Night42 intentionally replaces that stack.
  owner.play = async (options: DirectionalProjectileOptions): Promise<void> => {
    const current = tier();
    const concurrency = activeProjectiles + 1;
    const burstReducedMotion = current === 'balanced' && concurrency >= BALANCED_BURST_THRESHOLD;
    const reducedDetail = Boolean(options.reducedMotion) || current === 'lite' || burstReducedMotion;
    const durationMs = readableDuration(options, current, burstReducedMotion);

    activeProjectiles += 1;
    try {
      await playSimpleProjectile(options, durationMs, reducedDetail);
    } finally {
      activeProjectiles = Math.max(0, activeProjectiles - 1);
    }
  };

  root.POWDER_COMBAT2_NIGHT_FX_BUDGET = {
    version: 'night-42',
    source: 'POWDER_COMBAT2_FX_TIER',
    full: 'single-colored-shot-short-attached-tail-small-impact',
    balanced: 'single-colored-shot-short-tail-small-impact',
    lite: 'single-minimal-shot-small-impact',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    burstGuard: true,
    singleProjectileOwner: true,
    legacyFullPathLineDisabled: true,
    duplicateMovingGuideDisabled: true,
    attachedShortTailOnly: true,
    readableTravelMs: { full: '230-310', balanced: '215-275', lite: '175-215' },
    sceneShutdownSafeGuide: true,
    fullTierPreserved: true,
    counterFinallySafe: true,
    combatLogicChanged: false
  };
}

installCombatNightFxBudgetBridge();
