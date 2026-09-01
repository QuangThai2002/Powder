import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';
import { playCombat2105SlashCue } from '../views/Combat2105AudioImpactPatch';

export const COMBAT2186_ASSASSIN_VERSION = '2.18.6';
export const COMBAT2180_ASSASSIN_VERSION = COMBAT2186_ASSASSIN_VERSION;
export type Combat2180AssassinTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };
type CutSpec = {
  half: number;
  bend: number;
  shadowWidth: number;
  glowWidth: number;
  bodyWidth: number;
  coreWidth: number;
  afterOffset: number;
};

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

function cutSpec(tier: Combat2180AssassinTier): CutSpec {
  if (tier === 'ultimate') {
    return { half: 122, bend: 78, shadowWidth: 25, glowWidth: 21, bodyWidth: 12, coreWidth: 5, afterOffset: 17 };
  }
  if (tier === 'skill') {
    return { half: 96, bend: 60, shadowWidth: 20, glowWidth: 17, bodyWidth: 9.5, coreWidth: 4, afterOffset: 14 };
  }
  return { half: 74, bend: 46, shadowWidth: 16, glowWidth: 13, bodyWidth: 7, coreWidth: 3, afterOffset: 11 };
}

/** Safe curved cut approximation using only the stable Graphics.lineBetween() primitive. */
function drawCurveSegments(
  graphics: Phaser.GameObjects.Graphics,
  spec: CutSpec,
  direction: number,
  width: number,
  color: number,
  alpha: number,
  offsetY = 0,
  segments = 11
): void {
  const x0 = -spec.half;
  const y0 = direction * spec.bend * 0.5 + offsetY;
  const cx = 0;
  const cy = -direction * spec.bend + offsetY;
  const x1 = spec.half;
  const y1 = -direction * spec.bend * 0.46 + offsetY;
  let px = x0;
  let py = y0;

  graphics.lineStyle(width, color, alpha);
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    graphics.lineBetween(px, py, x, y);
    px = x;
    py = y;
  }
}

function makeCut(
  options: Options,
  p: Palette,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Phaser.GameObjects.Container {
  const spec = cutSpec(tier);
  const direction = hit === 1 ? 1 : -1;
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 22 + hit);

  const shadow = options.scene.add.graphics();
  drawCurveSegments(shadow, spec, direction, spec.shadowWidth, p.dark, tier === 'normal' ? 0.64 : 0.72);

  const afterimage = options.scene.add.graphics();
  drawCurveSegments(
    afterimage,
    spec,
    direction,
    tier === 'ultimate' ? 7 : tier === 'skill' ? 5.5 : 4,
    p.dark,
    tier === 'normal' ? 0.44 : tier === 'skill' ? 0.53 : 0.62,
    direction * spec.afterOffset
  );

  const glow = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawCurveSegments(glow, spec, direction, spec.glowWidth, p.main, tier === 'normal' ? 0.2 : tier === 'skill' ? 0.27 : 0.34);

  const blade = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  drawCurveSegments(blade, spec, direction, spec.bodyWidth, p.accent, tier === 'normal' ? 0.92 : 0.99);
  drawCurveSegments(blade, spec, direction, spec.coreWidth, p.core, 1);

  const razorEcho = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  if (tier !== 'normal') {
    drawCurveSegments(
      razorEcho,
      { ...spec, half: spec.half * 0.88, bend: spec.bend * 0.74 },
      direction,
      tier === 'ultimate' ? 3.5 : 2.6,
      p.main,
      tier === 'ultimate' ? 0.62 : 0.46,
      -direction * 10
    );
  }

  const contact = options.scene.add.circle(
    hit === 2 ? 8 : -6,
    -direction * 4,
    tier === 'ultimate' ? (hit === 2 ? 23 : 17) : tier === 'skill' ? (hit === 2 ? 15 : 12) : (hit === 2 ? 10 : 8),
    p.core,
    tier === 'ultimate' ? 0.47 : tier === 'skill' ? 0.33 : 0.23
  ).setBlendMode(Phaser.BlendModes.ADD);

  const tipA = options.scene.add.circle(
    -spec.half * 0.94,
    direction * spec.bend * 0.47,
    tier === 'ultimate' ? 4.5 : 3,
    p.core,
    0.76
  ).setBlendMode(Phaser.BlendModes.ADD);
  const tipB = options.scene.add.circle(
    spec.half * 0.95,
    -direction * spec.bend * 0.43,
    tier === 'ultimate' ? 4.5 : 3,
    p.core,
    0.76
  ).setBlendMode(Phaser.BlendModes.ADD);

  root.add([shadow, afterimage, glow, blade]);
  if (tier !== 'normal') root.add(razorEcho);
  root.add([contact, tipA, tipB]);

  if (tier === 'ultimate' && hit === 2) {
    const executionRing = options.scene.add.ellipse(0, 0, 190, 122, 0x000000, 0)
      .setStrokeStyle(4.5, p.main, 0.52)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.addAt(executionRing, 0);
  }

  return root;
}

async function revealCut(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Promise<void> {
  const enterMs = options.reducedMotion ? 30 : tier === 'ultimate' ? 52 : tier === 'skill' ? 44 : 36;
  root.setScale(tier === 'ultimate' ? (hit === 2 ? 0.77 : 0.73) : tier === 'skill' ? 0.81 : 0.85).setAlpha(0.36);
  await tween(options.scene, root, {
    scaleX: hit === 2 ? 1.04 : 1,
    scaleY: hit === 2 ? 1.04 : 1,
    alpha: 1,
    duration: enterMs,
    ease: 'Cubic.easeOut'
  }, enterMs + 155);
}

async function fadeCut(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Promise<void> {
  const exitMs = options.reducedMotion
    ? 56
    : tier === 'ultimate'
      ? (hit === 2 ? 130 : 116)
      : tier === 'skill'
        ? (hit === 2 ? 112 : 102)
        : (hit === 2 ? 96 : 88);
  await tween(options.scene, root, {
    scaleX: hit === 2 ? 1.14 : 1.09,
    scaleY: hit === 2 ? 1.14 : 1.09,
    alpha: 0,
    duration: exitMs,
    ease: 'Quad.easeOut'
  }, exitMs + 180);
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

    const gap = options.reducedMotion ? 10 : tier === 'ultimate' ? 28 : tier === 'skill' ? 30 : 32;
    await wait(options.scene, gap);

    second = makeCut(options, p, tier, 2);
    playCombat2105SlashCue(options.element, options.role ?? 'assassin', slashStrength(tier, 2), 2);
    await revealCut(options, second, tier, 2);

    if (tier === 'ultimate' && options.scene.cameras?.main) {
      options.scene.cameras.main.shake(
        options.reducedMotion ? 72 : 112,
        options.reducedMotion ? 0.0013 : 0.0045,
        false
      );
    }

    const holdMs = options.reducedMotion ? 24 : tier === 'ultimate' ? 92 : tier === 'skill' ? 72 : 58;
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
  version: COMBAT2186_ASSASSIN_VERSION,
  role: 'assassin',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'two-quick-contact-cuts',
    skill: 'two-shadow-afterimage-cuts',
    ultimate: 'two-execution-critical-style-cuts'
  },
  slashShape: 'segmented-curved-razor-cut',
  slashPrimitive: 'lineBetween-only',
  firstCutPersistsIntoSecond: true,
  slashPersistence: 'reveal-overlap-hold-fade',
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
