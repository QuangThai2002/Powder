import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';
import { playCombat2105SlashCue } from '../views/Combat2105AudioImpactPatch';

export const COMBAT2189_ASSASSIN_VERSION = '2.18.9';
export const COMBAT2187_ASSASSIN_VERSION = COMBAT2189_ASSASSIN_VERSION;
export const COMBAT2186_ASSASSIN_VERSION = COMBAT2189_ASSASSIN_VERSION;
export const COMBAT2180_ASSASSIN_VERSION = COMBAT2189_ASSASSIN_VERSION;
export type Combat2180AssassinTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };
type CutSpec = { half: number; width: number; echoOffset: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff6549, core: 0xffe7cc, dark: 0x5f211c, accent: 0xff9b74 },
  lava: { main: 0xed4e31, core: 0xffcf72, dark: 0x541b14, accent: 0xff8154 },
  water: { main: 0x48bce5, core: 0xeefcff, dark: 0x174f69, accent: 0x82dcf4 },
  ice: { main: 0x83def3, core: 0xffffff, dark: 0x2b6879, accent: 0xb9f2ff },
  lightning: { main: 0xe9d25d, core: 0xffffec, dark: 0x6d5d18, accent: 0xffea82 },
  storm: { main: 0x728ddb, core: 0xf3f5ff, dark: 0x36466c, accent: 0x9bb2ef },
  wind: { main: 0x62d5c3, core: 0xf2fffc, dark: 0x245f58, accent: 0x91eadc },
  leaf: { main: 0x6ccd7c, core: 0xf1ffeb, dark: 0x2d5c38, accent: 0xa0e8aa },
  poison: { main: 0x9bc95e, core: 0xf8ffdc, dark: 0x465e29, accent: 0xc8e78a },
  earth: { main: 0xb78358, core: 0xffe5c0, dark: 0x57412e, accent: 0xd9aa78 },
  steel: { main: 0xbacbd3, core: 0xffffff, dark: 0x4e5f67, accent: 0xe2eef3 },
  light: { main: 0xe9d591, core: 0xfffff4, dark: 0x746c43, accent: 0xffecaa },
  dark: { main: 0x9d74d5, core: 0xf7efff, dark: 0x49325f, accent: 0xc09deb },
  neutral: { main: 0x91c4cc, core: 0xffffff, dark: 0x3c5960, accent: 0xbfe4ea }
});

export function isCombat2180AssassinRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('sat thu') || value.includes('assassin');
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

function cutSpec(tier: Combat2180AssassinTier, hit: 1 | 2): CutSpec {
  const boost = hit === 2 ? 1.05 : 1;
  if (tier === 'ultimate') return { half: 126 * boost, width: 8.2, echoOffset: 13 };
  if (tier === 'skill') return { half: 98 * boost, width: 6.2, echoOffset: 10 };
  return { half: 74 * boost, width: 4.8, echoOffset: 8 };
}

function facing(options: Options): number {
  return options.target.x >= options.source.x ? 1 : -1;
}

function cutRotation(options: Options, hit: 1 | 2): number {
  const face = facing(options);
  return hit === 1 ? -face * 0.78 : face * 0.72;
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
    { a: -1, b: -0.74, w: 0.18 },
    { a: -0.74, b: -0.36, w: 0.42 },
    { a: -0.36, b: 0.38, w: 1 },
    { a: 0.38, b: 0.76, w: 0.42 },
    { a: 0.76, b: 1, w: 0.16 }
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
  g.lineStyle(Math.max(1.2, width), color, alpha);
  g.lineBetween(-half * 0.54, 0, half * 0.6, 0);
  g.lineStyle(1, color, alpha * 0.8);
  g.lineBetween(-half * 0.76, 0, -half * 0.54, 0);
  g.lineBetween(half * 0.6, 0, half * 0.8, 0);
}

function makeCut(
  options: Options,
  p: Palette,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Phaser.GameObjects.Container {
  const spec = cutSpec(tier, hit);
  const face = facing(options);
  const sign = hit === 1 ? 1 : -1;
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 22 + hit)
    .setRotation(cutRotation(options, hit));

  const shadow = options.scene.add.graphics();
  drawTaperedCut(shadow, spec.half * 1.02, spec.width * 1.55, p.dark, tier === 'normal' ? 0.64 : 0.72, 1.5);

  const glow = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawTaperedCut(glow, spec.half, spec.width * 1.9, p.main, tier === 'normal' ? 0.08 : tier === 'skill' ? 0.12 : 0.16);

  const edge = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawTaperedCut(edge, spec.half, spec.width, p.accent, tier === 'normal' ? 0.86 : 0.95);

  const core = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawCutCore(core, spec.half, tier === 'ultimate' ? 2.8 : tier === 'skill' ? 2.3 : 1.8, p.core, 1);

  const echo = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawTaperedCut(
    echo,
    spec.half * 0.64,
    tier === 'ultimate' ? 2.8 : tier === 'skill' ? 2.1 : 1.6,
    p.main,
    tier === 'normal' ? 0.16 : tier === 'skill' ? 0.23 : 0.3,
    sign * spec.echoOffset
  );

  const contact = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const spark = tier === 'ultimate' ? 20 : tier === 'skill' ? 14 : 9;
  contact.lineStyle(tier === 'ultimate' ? 2.2 : 1.7, p.core, hit === 2 ? 0.78 : 0.62);
  contact.lineBetween(-spark, -3, spark, 3);
  contact.lineBetween(-3, -spark * 0.55, 3, spark * 0.55);

  root.add([shadow, glow, echo, edge, core, contact]);

  if (tier !== 'normal') {
    const razor = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    razor.lineStyle(tier === 'ultimate' ? 2.2 : 1.6, p.core, tier === 'ultimate' ? 0.34 : 0.24);
    razor.lineBetween(-spec.half * 0.4, sign * 16, spec.half * 0.26, sign * 16);
    root.add(razor);
  }

  if (tier === 'ultimate' && hit === 2) {
    const execution = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    execution.lineStyle(2.4, p.main, 0.4);
    execution.lineBetween(-50, -24, 52, 24);
    execution.lineStyle(1.4, p.core, 0.35);
    execution.lineBetween(-38, 26, 42, -26);
    root.add(execution);
  }

  return root;
}

async function revealCut(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Promise<void> {
  const face = facing(options);
  const enterMs = options.reducedMotion ? 28 : tier === 'ultimate' ? 46 : tier === 'skill' ? 39 : 33;
  root.setScale(0.06, 0.72).setAlpha(0.1);
  await tween(options.scene, root, {
    scaleX: hit === 2 ? 1.025 : 1,
    scaleY: 1,
    alpha: 1,
    x: root.x + face * (hit === 2 ? 4 : 2),
    duration: enterMs,
    ease: 'Cubic.easeOut'
  }, enterMs + 145);
}

async function fadeCut(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Promise<void> {
  const face = facing(options);
  const exitMs = options.reducedMotion ? 52 : tier === 'ultimate' ? (hit === 2 ? 112 : 100) : tier === 'skill' ? 94 : 80;
  await tween(options.scene, root, {
    scaleX: hit === 2 ? 1.08 : 1.05,
    scaleY: 0.88,
    alpha: 0,
    x: root.x + face * (hit === 2 ? 13 : 10),
    duration: exitMs,
    ease: 'Quad.easeOut'
  }, exitMs + 170);
}

function slashStrength(tier: Combat2180AssassinTier, hit: 1 | 2): number {
  if (tier === 'ultimate') return hit === 2 ? 1.2 : 1.08;
  if (tier === 'skill') return hit === 2 ? 1 : 0.9;
  return hit === 2 ? 0.82 : 0.72;
}

export async function playCombat2180AssassinDistinctTierVfx(
  options: Options,
  tier: Combat2180AssassinTier
): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const first = makeCut(options, p, tier, 1);
  let second: Phaser.GameObjects.Container | null = null;

  try {
    playCombat2105SlashCue(options.element, options.role ?? 'assassin', slashStrength(tier, 1), 1);
    await revealCut(options, first, tier, 1);

    const gap = options.reducedMotion ? 8 : tier === 'ultimate' ? 20 : tier === 'skill' ? 22 : 24;
    await wait(options.scene, gap);

    second = makeCut(options, p, tier, 2);
    playCombat2105SlashCue(options.element, options.role ?? 'assassin', slashStrength(tier, 2), 2);
    await revealCut(options, second, tier, 2);

    if (tier === 'ultimate' && options.scene.cameras?.main) {
      options.scene.cameras.main.shake(
        options.reducedMotion ? 72 : 108,
        options.reducedMotion ? 0.0012 : 0.0042,
        false
      );
    }

    const holdMs = options.reducedMotion ? 20 : tier === 'ultimate' ? 70 : tier === 'skill' ? 54 : 44;
    await wait(options.scene, holdMs);

    await Promise.all([
      fadeCut(options, first, tier, 1),
      fadeCut(options, second, tier, 2)
    ]);
  } finally {
    if (first.active) first.destroy(true);
    if (second?.active) second.destroy(true);
  }
}

(globalThis as any).POWDER_COMBAT2_ASSASSIN_DISTINCT_TIERS = {
  version: COMBAT2189_ASSASSIN_VERSION,
  role: 'assassin',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'two-thin-anime-cross-cuts',
    skill: 'two-razor-line-cross-cuts',
    ultimate: 'two-execution-line-cross-cuts'
  },
  slashShape: 'thin-segmented-tapered-anime-cross',
  polygonRibbonRemoved: true,
  firstCutPersistsIntoSecond: true,
  slashAudio: 'two-contact-whooshes',
  visualHits: 2,
  damageHitsChanged: false,
  guaranteedCritChanged: false,
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
