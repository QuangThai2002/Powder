import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2179_KNIGHT_VERSION = '2.17.9';
export const COMBAT2168_KNIGHT_VERSION = COMBAT2179_KNIGHT_VERSION;
export type Combat2168KnightTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xf27b4f, core: 0xfff1c7, dark: 0x6d2f22, accent: 0xffb86b },
  lava: { main: 0xe95d38, core: 0xffda72, dark: 0x61261b, accent: 0xff9b54 },
  water: { main: 0x55b9dc, core: 0xecfbff, dark: 0x1d5870, accent: 0x87d8ef },
  ice: { main: 0x8bdcf0, core: 0xffffff, dark: 0x337383, accent: 0xbcefff },
  lightning: { main: 0xe5cf62, core: 0xffffe4, dark: 0x756418, accent: 0xffe986 },
  storm: { main: 0x758fc9, core: 0xf3f5ff, dark: 0x3d4c70, accent: 0x9cb2e8 },
  wind: { main: 0x68cdbd, core: 0xf0fffb, dark: 0x2b685f, accent: 0x96e5d8 },
  leaf: { main: 0x73c67e, core: 0xf1ffe9, dark: 0x345f3b, accent: 0xa2e3a7 },
  poison: { main: 0x9ac463, core: 0xf7ffdc, dark: 0x4d632c, accent: 0xc7e58e },
  earth: { main: 0xb58a5c, core: 0xffe8c7, dark: 0x5d4732, accent: 0xd7ad79 },
  steel: { main: 0xbecdd4, core: 0xffffff, dark: 0x53646c, accent: 0xe4eef2 },
  light: { main: 0xe8d695, core: 0xfffff4, dark: 0x7a7047, accent: 0xffecad },
  dark: { main: 0x947ac5, core: 0xf5efff, dark: 0x493861, accent: 0xb9a0e4 },
  neutral: { main: 0x94c4cc, core: 0xfbffff, dark: 0x405c63, accent: 0xc0e4e9 }
});

export function isCombat2168KnightRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('hiep si') || value.includes('knight') || value.includes('paladin');
}

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let tw: Phaser.Tweens.Tween | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = () => {
      try { tw?.stop(); } catch { /* cleanup only */ }
      finish();
    };
    timer = setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

function attackAngle(options: Options): number {
  return Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
}

function slashLine(
  options: Options,
  p: Palette,
  length: number,
  thickness: number,
  slope: number,
  alpha: number
): Phaser.GameObjects.Graphics {
  const g = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  g.lineStyle(thickness * 2.15, p.main, alpha * 0.2);
  g.lineBetween(-length, length * slope, length, -length * slope);
  g.lineStyle(thickness, p.core, alpha);
  g.lineBetween(-length, length * slope, length, -length * slope);
  return g;
}

async function playHeavyCut(options: Options, p: Palette): Promise<void> {
  const angle = attackAngle(options);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 18)
    .setRotation(angle * 0.08);
  const slash = slashLine(options, p, 52, 5.5, 0.62, 0.96);
  const guardSpark = options.scene.add.circle(0, 0, 10, p.accent, 0.28).setBlendMode(Phaser.BlendModes.ADD);
  const edge = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  edge.lineStyle(2.5, p.main, 0.54);
  edge.lineBetween(-58, 39, 38, -31);
  root.add([edge, slash, guardSpark]);
  root.setScale(0.8);
  try {
    await tween(options.scene, root, {
      scaleX: 1.13,
      scaleY: 1.13,
      alpha: 0,
      duration: options.reducedMotion ? 80 : 125,
      ease: 'Cubic.easeOut'
    }, 360);
  } finally {
    root.destroy(true);
  }
}

async function playGuardBreakCleave(options: Options, p: Palette): Promise<void> {
  const angle = attackAngle(options);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 19)
    .setRotation(angle * 0.06);
  const mainSlash = slashLine(options, p, 74, 7.5, 0.58, 0.98);
  const after = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  after.lineStyle(4, p.accent, 0.52);
  after.lineBetween(-82, 54, 61, -42);
  const breakMark = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  breakMark.lineStyle(4, p.main, 0.58);
  breakMark.lineBetween(8, -28, 41, -52);
  breakMark.lineBetween(13, -10, 53, -17);
  breakMark.lineBetween(14, 10, 53, 18);
  breakMark.lineBetween(8, 28, 41, 52);
  const contact = options.scene.add.circle(10, 0, 15, p.core, 0.3).setBlendMode(Phaser.BlendModes.ADD);
  root.add([after, breakMark, mainSlash, contact]);
  root.setScale(0.73);
  try {
    await tween(options.scene, root, {
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: options.reducedMotion ? 105 : 180,
      ease: 'Cubic.easeOut'
    }, 430);
  } finally {
    root.destroy(true);
  }
}

async function playRoyalJudgmentSlash(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 22);
  const slash = slashLine(options, p, 108, 11, 0.68, 1);
  const royalEdge = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  royalEdge.lineStyle(5, p.accent, 0.78);
  royalEdge.lineBetween(-118, 80, 88, -63);
  royalEdge.lineStyle(3, p.core, 0.72);
  royalEdge.lineBetween(-110, 61, 98, -82);
  const crest = options.scene.add.polygon(0, -6, [
    -34, -16, -18, -36, 0, -20, 18, -36, 34, -16, 25, 16, 0, 31, -25, 16
  ], p.main, 0.12).setStrokeStyle(4, p.accent, 0.65).setBlendMode(Phaser.BlendModes.ADD);
  const shock = options.scene.add.ellipse(0, 0, 202, 118, 0x000000, 0)
    .setStrokeStyle(6, p.main, 0.62)
    .setBlendMode(Phaser.BlendModes.ADD);
  const flash = options.scene.add.circle(0, 0, 29, p.core, 0.34).setBlendMode(Phaser.BlendModes.ADD);
  root.add([shock, crest, royalEdge, slash, flash]);
  root.setScale(0.58);

  if (options.scene.cameras?.main) {
    options.scene.cameras.main.shake(
      options.reducedMotion ? 88 : 165,
      options.reducedMotion ? 0.0015 : 0.0055,
      false
    );
  }

  try {
    await tween(options.scene, root, {
      scaleX: 1.46,
      scaleY: 1.46,
      alpha: 0,
      duration: options.reducedMotion ? 150 : 270,
      ease: 'Cubic.easeOut'
    }, 550);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2168KnightDistinctTierVfx(
  options: Options,
  tier: Combat2168KnightTier
): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  if (tier === 'ultimate') {
    await playRoyalJudgmentSlash(options, p);
    return;
  }
  if (tier === 'skill') {
    await playGuardBreakCleave(options, p);
    return;
  }
  await playHeavyCut(options, p);
}

(globalThis as any).POWDER_COMBAT2_KNIGHT_DISTINCT_TIERS = {
  version: COMBAT2179_KNIGHT_VERSION,
  role: 'knight',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'heavy-cut-contact',
    skill: 'guard-break-cleave-contact',
    ultimate: 'royal-judgment-slash-contact'
  },
  sourceToTargetProjectile: false,
  contactOnly: true,
  normalCameraShake: false,
  skillCameraShake: false,
  ultimateCameraShake: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
