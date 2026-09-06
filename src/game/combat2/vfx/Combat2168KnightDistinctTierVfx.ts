import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';
import { playCombat2105SlashCue } from '../views/Combat2105AudioImpactPatch';

export const COMBAT2189_KNIGHT_VERSION = '2.18.9';
export const COMBAT2187_KNIGHT_VERSION = COMBAT2189_KNIGHT_VERSION;
export const COMBAT2186_KNIGHT_VERSION = COMBAT2189_KNIGHT_VERSION;
export const COMBAT2179_KNIGHT_VERSION = COMBAT2189_KNIGHT_VERSION;
export const COMBAT2168_KNIGHT_VERSION = COMBAT2189_KNIGHT_VERSION;
export type Combat2168KnightTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };
type SlashSpec = { half: number; width: number; echoOffset: number };

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
  config: CombatTweenConfig,
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
  if (tier === 'ultimate') return { half: 154, width: 13, echoOffset: 17 };
  if (tier === 'skill') return { half: 116, width: 10, echoOffset: 13 };
  return { half: 82, width: 7.5, echoOffset: 9 };
}

function facing(options: Options): number {
  return options.target.x >= options.source.x ? 1 : -1;
}

function slashRotation(options: Options, tier: Combat2168KnightTier): number {
  const face = facing(options);
  const angle = tier === 'ultimate' ? 0.67 : tier === 'skill' ? 0.6 : 0.72;
  return -face * angle;
}

function drawTaperedCut(
  g: Phaser.GameObjects.Graphics,
  half: number,
  width: number,
  color: number,
  alpha: number,
  y = 0
): void {
  const segments = [
    { a: -1, b: -0.72, w: 0.22 },
    { a: -0.72, b: -0.34, w: 0.48 },
    { a: -0.34, b: 0.34, w: 1 },
    { a: 0.34, b: 0.72, w: 0.5 },
    { a: 0.72, b: 1, w: 0.2 }
  ] as const;
  for (const segment of segments) {
    g.lineStyle(Math.max(1, width * segment.w), color, alpha);
    g.lineBetween(half * segment.a, y, half * segment.b, y);
  }
}

function drawCutCore(
  g: Phaser.GameObjects.Graphics,
  half: number,
  width: number,
  color: number,
  alpha: number
): void {
  g.lineStyle(Math.max(1.4, width), color, alpha);
  g.lineBetween(-half * 0.58, 0, half * 0.64, 0);
  g.lineStyle(Math.max(1, width * 0.55), color, alpha * 0.88);
  g.lineBetween(-half * 0.78, 0, -half * 0.58, 0);
  g.lineBetween(half * 0.64, 0, half * 0.83, 0);
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

  const shadow = options.scene.add.graphics();
  drawTaperedCut(shadow, spec.half * 1.025, spec.width * 1.65, p.dark, tier === 'normal' ? 0.68 : 0.76, 2);

  const glow = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawTaperedCut(glow, spec.half, spec.width * 2.05, p.main, tier === 'normal' ? 0.1 : tier === 'skill' ? 0.14 : 0.18);

  const edge = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawTaperedCut(edge, spec.half, spec.width, p.accent, tier === 'normal' ? 0.84 : 0.94);

  const core = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawCutCore(core, spec.half, tier === 'ultimate' ? 3.6 : tier === 'skill' ? 3 : 2.35, p.core, 1);

  const after = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawTaperedCut(
    after,
    spec.half * 0.72,
    tier === 'ultimate' ? 4 : tier === 'skill' ? 3.1 : 2.3,
    p.main,
    tier === 'normal' ? 0.2 : tier === 'skill' ? 0.27 : 0.34,
    face * spec.echoOffset
  );

  const impact = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const spark = tier === 'ultimate' ? 27 : tier === 'skill' ? 19 : 13;
  impact.lineStyle(tier === 'ultimate' ? 3 : 2.2, p.core, tier === 'normal' ? 0.62 : 0.78);
  impact.lineBetween(-spark, -5, spark, 5);
  impact.lineBetween(-5, -spark * 0.62, 5, spark * 0.62);

  root.add([shadow, glow, after, edge, core, impact]);

  if (tier === 'skill') {
    const chips = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    chips.lineStyle(2.2, p.accent, 0.58);
    chips.lineBetween(spec.half * 0.24, -20, spec.half * 0.39, -34);
    chips.lineBetween(spec.half * 0.34, 13, spec.half * 0.48, 24);
    root.add(chips);
  }

  if (tier === 'ultimate') {
    const verdict = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    verdict.lineStyle(2.4, p.core, 0.44);
    verdict.lineBetween(-spec.half * 0.46, -19, spec.half * 0.48, -19);
    verdict.lineStyle(2, p.main, 0.34);
    verdict.lineBetween(-spec.half * 0.34, 22, spec.half * 0.38, 22);
    root.add(verdict);
  }

  return root;
}

async function animateKnightSlash(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2168KnightTier
): Promise<void> {
  const face = facing(options);
  const enterMs = options.reducedMotion ? 34 : tier === 'ultimate' ? 58 : tier === 'skill' ? 50 : 42;
  const holdMs = options.reducedMotion ? 24 : tier === 'ultimate' ? 98 : tier === 'skill' ? 76 : 60;
  const exitMs = options.reducedMotion ? 58 : tier === 'ultimate' ? 134 : tier === 'skill' ? 110 : 94;

  root.setScale(0.08, 0.72).setAlpha(0.12);
  try {
    await tween(options.scene, root, {
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      x: root.x + face * 4,
      duration: enterMs,
      ease: 'Cubic.easeOut'
    }, enterMs + 150);

    await wait(options.scene, holdMs);

    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.07 : 1.035,
      scaleY: 0.9,
      alpha: 0,
      x: root.x + face * (tier === 'ultimate' ? 17 : 11),
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
  version: COMBAT2189_KNIGHT_VERSION,
  role: 'knight',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'anime-heavy-cut-line',
    skill: 'anime-guard-break-cut-line',
    ultimate: 'anime-royal-judgment-cut-line'
  },
  slashShape: 'segmented-tapered-anime-cut',
  polygonRibbonRemoved: true,
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
