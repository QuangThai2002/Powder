import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2185_KNIGHT_VERSION = '2.18.5';
export const COMBAT2179_KNIGHT_VERSION = COMBAT2185_KNIGHT_VERSION;
export const COMBAT2168_KNIGHT_VERSION = COMBAT2185_KNIGHT_VERSION;
export type Combat2168KnightTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

type SlashSpec = {
  half: number;
  bend: number;
  shadowWidth: number;
  glowWidth: number;
  bodyWidth: number;
  coreWidth: number;
  afterOffset: number;
};

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
    let done = false;
    let event: Phaser.Time.TimerEvent | null = null;
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

function slashDirection(options: Options): number {
  return options.target.x >= options.source.x ? 1 : -1;
}

function slashSpec(tier: Combat2168KnightTier): SlashSpec {
  if (tier === 'ultimate') {
    return { half: 132, bend: 104, shadowWidth: 34, glowWidth: 29, bodyWidth: 17, coreWidth: 6.5, afterOffset: 19 };
  }
  if (tier === 'skill') {
    return { half: 96, bend: 76, shadowWidth: 26, glowWidth: 22, bodyWidth: 13, coreWidth: 5, afterOffset: 15 };
  }
  return { half: 70, bend: 54, shadowWidth: 20, glowWidth: 17, bodyWidth: 10, coreWidth: 4, afterOffset: 12 };
}

function strokeCrescent(
  graphics: Phaser.GameObjects.Graphics,
  spec: SlashSpec,
  direction: number,
  width: number,
  color: number,
  alpha: number,
  offsetY = 0
): void {
  const startY = direction * (spec.bend * 0.42) + offsetY;
  const endY = -direction * (spec.bend * 0.38) + offsetY;
  const controlY = -direction * spec.bend + offsetY;
  graphics.lineStyle(width, color, alpha);
  graphics.beginPath();
  graphics.moveTo(-spec.half, startY);
  graphics.quadraticBezierTo(0, controlY, spec.half, endY);
  graphics.strokePath();
}

function buildKnightSlash(
  options: Options,
  p: Palette,
  tier: Combat2168KnightTier
): Phaser.GameObjects.Container {
  const spec = slashSpec(tier);
  const direction = slashDirection(options);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + (tier === 'ultimate' ? 23 : tier === 'skill' ? 21 : 19));

  const shadow = options.scene.add.graphics();
  strokeCrescent(shadow, spec, direction, spec.shadowWidth, p.dark, tier === 'normal' ? 0.58 : 0.68);

  const afterimage = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  strokeCrescent(
    afterimage,
    spec,
    direction,
    tier === 'ultimate' ? 8 : tier === 'skill' ? 6 : 4.5,
    p.main,
    tier === 'normal' ? 0.38 : tier === 'skill' ? 0.5 : 0.62,
    direction * spec.afterOffset
  );

  const glow = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  strokeCrescent(glow, spec, direction, spec.glowWidth, p.main, tier === 'normal' ? 0.2 : tier === 'skill' ? 0.27 : 0.34);

  const blade = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  strokeCrescent(blade, spec, direction, spec.bodyWidth, p.accent, tier === 'normal' ? 0.88 : 0.96);
  strokeCrescent(blade, spec, direction, spec.coreWidth, p.core, 1);

  const contact = options.scene.add.circle(
    spec.half * 0.08,
    -direction * spec.bend * 0.12,
    tier === 'ultimate' ? 25 : tier === 'skill' ? 17 : 11,
    p.core,
    tier === 'ultimate' ? 0.34 : tier === 'skill' ? 0.26 : 0.2
  ).setBlendMode(Phaser.BlendModes.ADD);

  const tipA = options.scene.add.circle(-spec.half * 0.92, direction * spec.bend * 0.39, tier === 'ultimate' ? 5 : 3.5, p.core, 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);
  const tipB = options.scene.add.circle(spec.half * 0.94, -direction * spec.bend * 0.36, tier === 'ultimate' ? 5 : 3.5, p.core, 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);

  root.add([shadow, afterimage, glow, blade, contact, tipA, tipB]);

  if (tier === 'skill') {
    const breakMarks = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    breakMarks.lineStyle(3.5, p.main, 0.58);
    const x = spec.half * 0.48;
    breakMarks.lineBetween(x, -direction * 18, x + 25, -direction * 34);
    breakMarks.lineBetween(x + 5, -direction * 4, x + 34, -direction * 7);
    breakMarks.lineBetween(x + 4, direction * 8, x + 28, direction * 24);
    root.addAt(breakMarks, 2);
  }

  if (tier === 'ultimate') {
    const inner = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    strokeCrescent(inner, { ...spec, half: spec.half * 0.82, bend: spec.bend * 0.73 }, direction, 3.5, p.core, 0.64, -direction * 13);
    const royalShock = options.scene.add.ellipse(0, 0, 238, 134, 0x000000, 0)
      .setStrokeStyle(5, p.main, 0.52)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.addAt(royalShock, 0);
    root.add(inner);
  }

  return root;
}

async function animateKnightSlash(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2168KnightTier
): Promise<void> {
  const enterMs = options.reducedMotion ? 38 : tier === 'ultimate' ? 64 : tier === 'skill' ? 54 : 44;
  const holdMs = options.reducedMotion ? 24 : tier === 'ultimate' ? 96 : tier === 'skill' ? 76 : 58;
  const exitMs = options.reducedMotion ? 62 : tier === 'ultimate' ? 138 : tier === 'skill' ? 112 : 92;

  root.setScale(tier === 'ultimate' ? 0.76 : tier === 'skill' ? 0.82 : 0.86).setAlpha(0.42);
  try {
    await tween(options.scene, root, {
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: enterMs,
      ease: 'Cubic.easeOut'
    }, enterMs + 160);

    await wait(options.scene, holdMs);

    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.1 : tier === 'skill' ? 1.075 : 1.055,
      scaleY: tier === 'ultimate' ? 1.1 : tier === 'skill' ? 1.075 : 1.055,
      alpha: 0,
      duration: exitMs,
      ease: 'Quad.easeOut'
    }, exitMs + 180);
  } finally {
    root.destroy(true);
  }
}

async function playHeavyCut(options: Options, p: Palette): Promise<void> {
  await animateKnightSlash(options, buildKnightSlash(options, p, 'normal'), 'normal');
}

async function playGuardBreakCleave(options: Options, p: Palette): Promise<void> {
  await animateKnightSlash(options, buildKnightSlash(options, p, 'skill'), 'skill');
}

async function playRoyalJudgmentSlash(options: Options, p: Palette): Promise<void> {
  const root = buildKnightSlash(options, p, 'ultimate');

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
  version: COMBAT2185_KNIGHT_VERSION,
  role: 'knight',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'clear-crescent-heavy-cut',
    skill: 'guard-break-crescent-cleave',
    ultimate: 'royal-judgment-grand-crescent'
  },
  slashShape: 'three-layer-curved-crescent',
  slashPersistence: 'reveal-hold-fade',
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
