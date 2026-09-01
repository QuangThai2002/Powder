import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';
import { playCombat2105SlashCue } from '../views/Combat2105AudioImpactPatch';

export const COMBAT2187_KNIGHT_VERSION = '2.18.7';
export const COMBAT2186_KNIGHT_VERSION = COMBAT2187_KNIGHT_VERSION;
export const COMBAT2179_KNIGHT_VERSION = COMBAT2187_KNIGHT_VERSION;
export const COMBAT2168_KNIGHT_VERSION = COMBAT2187_KNIGHT_VERSION;
export type Combat2168KnightTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };
type SlashSpec = { half: number; thickness: number; core: number; afterOffset: number };

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

function wait(scene: Phaser.Scene, duration: number): Promise<void> {
  return new Promise((resolve) => {
    let event: Phaser.Time.TimerEvent | null = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { event?.remove(false); } catch { /* cleanup only */ }
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, finish);
      scene.events.off(Phaser.Scenes.Events.DESTROY, finish);
      resolve();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);
    scene.events.once(Phaser.Scenes.Events.DESTROY, finish);
    event = scene.time.delayedCall(duration, finish);
  });
}

function slashSpec(tier: Combat2168KnightTier): SlashSpec {
  if (tier === 'ultimate') return { half: 148, thickness: 18, core: 4.8, afterOffset: 18 };
  if (tier === 'skill') return { half: 112, thickness: 13, core: 4, afterOffset: 14 };
  return { half: 78, thickness: 9, core: 3.2, afterOffset: 10 };
}

function facing(options: Options): number {
  return options.target.x >= options.source.x ? 1 : -1;
}

function slashRotation(options: Options, tier: Combat2168KnightTier): number {
  const face = facing(options);
  const angle = tier === 'ultimate' ? 0.58 : tier === 'skill' ? 0.52 : 0.64;
  return -face * angle;
}

function bladePoints(half: number, thickness: number): number[] {
  return [
    -half, 0,
    -half * 0.64, -thickness * 0.22,
    -half * 0.18, -thickness * 0.88,
    half * 0.42, -thickness * 0.48,
    half, 0,
    half * 0.42, thickness * 0.34,
    -half * 0.18, thickness * 0.62,
    -half * 0.66, thickness * 0.18
  ];
}

function corePoints(half: number, thickness: number): number[] {
  return [
    -half, 0,
    -half * 0.48, -thickness * 0.52,
    half * 0.56, -thickness * 0.2,
    half, 0,
    half * 0.5, thickness * 0.18,
    -half * 0.46, thickness * 0.4
  ];
}

function buildKnightSlash(
  options: Options,
  p: Palette,
  tier: Combat2168KnightTier
): Phaser.GameObjects.Container {
  const spec = slashSpec(tier);
  const face = facing(options);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + (tier === 'ultimate' ? 23 : tier === 'skill' ? 21 : 19))
    .setRotation(slashRotation(options, tier));

  const shadow = options.scene.add.polygon(
    0,
    2,
    bladePoints(spec.half * 1.02, spec.thickness * 1.18),
    p.dark,
    tier === 'normal' ? 0.72 : 0.78
  );

  const after = options.scene.add.polygon(
    -face * 9,
    spec.afterOffset,
    bladePoints(spec.half * 0.9, spec.thickness * 0.62),
    p.main,
    tier === 'normal' ? 0.18 : tier === 'skill' ? 0.24 : 0.3
  ).setBlendMode(Phaser.BlendModes.ADD);

  const glow = options.scene.add.polygon(
    0,
    0,
    bladePoints(spec.half * 1.01, spec.thickness * 1.34),
    p.main,
    tier === 'normal' ? 0.12 : tier === 'skill' ? 0.16 : 0.2
  ).setBlendMode(Phaser.BlendModes.ADD);

  const body = options.scene.add.polygon(
    0,
    0,
    bladePoints(spec.half, spec.thickness),
    p.accent,
    tier === 'normal' ? 0.88 : 0.96
  ).setBlendMode(Phaser.BlendModes.ADD);

  const core = options.scene.add.polygon(
    face * spec.half * 0.05,
    -spec.thickness * 0.05,
    corePoints(spec.half * 0.88, spec.core),
    p.core,
    1
  ).setBlendMode(Phaser.BlendModes.ADD);

  const impact = options.scene.add.circle(
    face * 7,
    0,
    tier === 'ultimate' ? 22 : tier === 'skill' ? 15 : 9,
    p.core,
    tier === 'ultimate' ? 0.34 : tier === 'skill' ? 0.26 : 0.18
  ).setBlendMode(Phaser.BlendModes.ADD);

  root.add([shadow, after, glow, body, core, impact]);

  if (tier === 'skill') {
    const breakMarks = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    breakMarks.lineStyle(2.8, p.core, 0.66);
    breakMarks.lineBetween(spec.half * 0.2, -26, spec.half * 0.42, -47);
    breakMarks.lineBetween(spec.half * 0.27, -5, spec.half * 0.56, -8);
    breakMarks.lineBetween(spec.half * 0.24, 15, spec.half * 0.48, 35);
    root.add(breakMarks);
  }

  if (tier === 'ultimate') {
    const royalShock = options.scene.add.ellipse(0, 0, 222, 112, 0x000000, 0)
      .setStrokeStyle(3.5, p.main, 0.4)
      .setBlendMode(Phaser.BlendModes.ADD);
    const secondary = options.scene.add.polygon(
      -face * 18,
      20,
      bladePoints(spec.half * 0.72, spec.thickness * 0.32),
      p.core,
      0.36
    ).setBlendMode(Phaser.BlendModes.ADD);
    root.add([royalShock, secondary]);
  }

  return root;
}

async function animateKnightSlash(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2168KnightTier
): Promise<void> {
  const face = facing(options);
  const enterMs = options.reducedMotion ? 34 : tier === 'ultimate' ? 62 : tier === 'skill' ? 52 : 44;
  const holdMs = options.reducedMotion ? 24 : tier === 'ultimate' ? 88 : tier === 'skill' ? 66 : 52;
  const exitMs = options.reducedMotion ? 58 : tier === 'ultimate' ? 132 : tier === 'skill' ? 108 : 92;

  root.setScale(0.24, 0.78).setAlpha(0.2);
  try {
    await tween(options.scene, root, {
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      x: root.x + face * 5,
      duration: enterMs,
      ease: 'Cubic.easeOut'
    }, enterMs + 150);

    await wait(options.scene, holdMs);

    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.08 : 1.04,
      scaleY: 0.88,
      alpha: 0,
      x: root.x + face * (tier === 'ultimate' ? 20 : 13),
      duration: exitMs,
      ease: 'Quad.easeOut'
    }, exitMs + 180);
  } finally {
    root.destroy(true);
  }
}

async function playHeavyCut(options: Options, p: Palette): Promise<void> {
  playCombat2105SlashCue(options.element, options.role ?? 'knight', 0.84, 1);
  await animateKnightSlash(options, buildKnightSlash(options, p, 'normal'), 'normal');
}

async function playGuardBreakCleave(options: Options, p: Palette): Promise<void> {
  playCombat2105SlashCue(options.element, options.role ?? 'knight', 1.04, 1);
  await animateKnightSlash(options, buildKnightSlash(options, p, 'skill'), 'skill');
}

async function playRoyalJudgmentSlash(options: Options, p: Palette): Promise<void> {
  const root = buildKnightSlash(options, p, 'ultimate');
  playCombat2105SlashCue(options.element, options.role ?? 'knight', 1.28, 1);

  if (options.scene.cameras?.main) {
    options.scene.cameras.main.shake(
      options.reducedMotion ? 86 : 165,
      options.reducedMotion ? 0.0014 : 0.0053,
      false
    );
  }

  await animateKnightSlash(options, root, 'ultimate');
}

export async function playCombat2168KnightDistinctTierVfx(
  options: Options,
  tier: Combat2168KnightTier
): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  if (tier === 'ultimate') return playRoyalJudgmentSlash(options, p);
  if (tier === 'skill') return playGuardBreakCleave(options, p);
  return playHeavyCut(options, p);
}

(globalThis as any).POWDER_COMBAT2_KNIGHT_DISTINCT_TIERS = {
  version: COMBAT2187_KNIGHT_VERSION,
  role: 'knight',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'sharp-heavy-blade-streak-contact',
    skill: 'guard-break-tapered-cleave-contact',
    ultimate: 'royal-judgment-blade-streak-contact'
  },
  slashShape: 'tapered-blade-streak',
  curvedArcRemoved: true,
  slashAudio: 'dedicated-contact-whoosh',
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
