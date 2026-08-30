import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombatNightFxBudgetInstalled';
const BALANCED_BURST_THRESHOLD = 2;
const NIGHT43_PROJECTILE_SCALE = 1.5;
const NIGHT44_HEAD_SCALE_VS_NIGHT43 = 10;
const PROJECTILE_SIZE_VS_NIGHT44 = 0.4;
const PROJECTILE_HEAD_SCALE_VS_NIGHT43 = NIGHT44_HEAD_SCALE_VS_NIGHT43 * PROJECTILE_SIZE_VS_NIGHT44;
const PROJECTILE_DURATION_SCALE = 2.25;

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

function readableDuration(
  options: DirectionalProjectileOptions,
  current: FxTier,
  burstReducedMotion: boolean
): number {
  const requested = Number(options.durationMs || 0);
  const distance = Math.max(1, Phaser.Math.Distance.Between(
    options.source.x,
    options.source.y,
    options.target.x,
    options.target.y
  ));

  let baseDuration: number;
  if (current === 'lite') {
    baseDuration = Phaser.Math.Clamp(requested > 0 ? requested : 195, 175, 215);
  } else if (current === 'balanced') {
    const natural = burstReducedMotion ? 215 : Math.round(225 + Math.min(35, distance * 0.035));
    baseDuration = Phaser.Math.Clamp(
      requested > 0 ? requested : natural,
      burstReducedMotion ? 195 : 215,
      burstReducedMotion ? 235 : 275
    );
  } else {
    const natural = Math.round(240 + Math.min(55, distance * 0.05));
    baseDuration = Phaser.Math.Clamp(requested > 0 ? requested : natural, 230, 310);
  }

  // Night45 keeps Night44 travel speed unchanged; only projectile size is reduced.
  return Math.round(baseDuration * PROJECTILE_DURATION_SCALE);
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

async function playSimpleImpact(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean
): Promise<void> {
  const { scene, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const radius = reducedDetail ? 18 : 24;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 1);

  impact.add([
    scene.add.circle(0, 0, radius * 0.5, color, 0.38),
    scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, color, 0.9),
    scene.add.circle(0, 0, radius * 0.2, 0xffffff, 0.72)
  ]);

  try {
    await tweenObject(scene, impact, {
      scaleX: reducedDetail ? 1.3 : 1.55,
      scaleY: reducedDetail ? 1.3 : 1.55,
      alpha: 0,
      duration: reducedDetail ? 130 : 175,
      ease: 'Quad.easeOut'
    }, reducedDetail ? 320 : 390);
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
  const angle = Math.atan2(target.y - source.y, target.x - source.x);

  // Night45 = exactly 40% of Night44 projectile geometry.
  // Head/body becomes 4x Night43 instead of Night44's 10x.
  const night43HeadRadius = (reducedDetail ? 6 : 8) * NIGHT43_PROJECTILE_SCALE;
  const headRadius = night43HeadRadius * PROJECTILE_HEAD_SCALE_VS_NIGHT43;
  const auraRadius = headRadius * 1.16;
  const tailLength = (reducedDetail ? 92 : 126) * PROJECTILE_SIZE_VS_NIGHT44;
  const tailThickness = (reducedDetail ? 18 : 24) * PROJECTILE_SIZE_VS_NIGHT44;
  const noseLength = (reducedDetail ? 32 : 42) * PROJECTILE_SIZE_VS_NIGHT44;

  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  projectile.add([
    scene.add.rectangle(-tailLength * 0.58, 0, tailLength, tailThickness, color, reducedDetail ? 0.22 : 0.3),
    scene.add.rectangle(
      -tailLength * 0.4,
      0,
      tailLength * 0.72,
      Math.max(2.5, tailThickness * 0.38),
      0xffffff,
      reducedDetail ? 0.18 : 0.28
    ),
    scene.add.circle(0, 0, auraRadius, color, reducedDetail ? 0.08 : 0.12),
    scene.add.circle(0, 0, headRadius, color, 0.76),
    scene.add.circle(headRadius * 0.08, 0, headRadius * 0.58, color, 0.96),
    scene.add.circle(headRadius * 0.16, 0, headRadius * 0.28, 0xffffff, 0.92),
    scene.add.triangle(
      headRadius * 0.9,
      0,
      -noseLength * 0.46,
      -noseLength * 0.36,
      -noseLength * 0.46,
      noseLength * 0.36,
      noseLength * 0.54,
      0,
      0xffffff,
      reducedDetail ? 0.68 : 0.82
    )
  ]);

  try {
    await tweenObject(scene, projectile, {
      x: target.x,
      y: target.y,
      duration: durationMs,
      ease: element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut'
    }, durationMs + 320);
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
    version: 'night-45',
    source: 'POWDER_COMBAT2_FX_TIER',
    full: 'single-energy-comet-40pct-of-night44',
    balanced: 'single-energy-comet-40pct-of-night44',
    lite: 'single-energy-comet-40pct-of-night44-minimal-detail',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    burstGuard: true,
    singleProjectileOwner: true,
    projectileSizeVsNight44: PROJECTILE_SIZE_VS_NIGHT44,
    projectileHeadScaleVsNight43: PROJECTILE_HEAD_SCALE_VS_NIGHT43,
    projectileTravelDurationScaleVsNight42: PROJECTILE_DURATION_SCALE,
    projectileTravelSpeedUnchangedVsNight44: true,
    legacyFullPathLineDisabled: true,
    duplicateMovingGuideDisabled: true,
    attachedShortTailOnly: true,
    readableTravelMs: { full: '518-698', balanced: '484-619', lite: '394-484' },
    sceneShutdownSafeGuide: true,
    fullTierPreserved: true,
    counterFinallySafe: true,
    combatLogicChanged: false
  };
}

installCombatNightFxBudgetBridge();
