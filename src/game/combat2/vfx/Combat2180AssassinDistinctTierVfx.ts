import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2186_ASSASSIN_VERSION = '2.18.6';
export const COMBAT2185_ASSASSIN_VERSION = COMBAT2186_ASSASSIN_VERSION;
export const COMBAT2180_ASSASSIN_VERSION = COMBAT2186_ASSASSIN_VERSION;
export type Combat2180AssassinTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };
type CutSpec = { half: number; bend: number; shadow: number; glow: number; body: number; core: number; afterOffset: number };

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
  if (tier === 'ultimate') return { half: 120, bend: 76, shadow: 25, glow: 21, body: 12, core: 5, afterOffset: 17 };
  if (tier === 'skill') return { half: 94, bend: 60, shadow: 20, glow: 17, body: 9.5, core: 4, afterOffset: 14 };
  return { half: 72, bend: 46, shadow: 16, glow: 13.5, body: 7.5, core: 3.2, afterOffset: 11 };
}

function quadraticPoints(
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  segments = 20
): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const mt = 1 - t;
    points.push(new Phaser.Math.Vector2(
      mt * mt * startX + 2 * mt * t * controlX + t * t * endX,
      mt * mt * startY + 2 * mt * t * controlY + t * t * endY
    ));
  }
  return points;
}

function strokeCut(
  graphics: Phaser.GameObjects.Graphics,
  spec: CutSpec,
  direction: number,
  width: number,
  color: number,
  alpha: number,
  offsetY = 0
): void {
  const startY = direction * spec.bend * 0.5 + offsetY;
  const endY = -direction * spec.bend * 0.46 + offsetY;
  const controlY = -direction * spec.bend + offsetY;
  graphics.lineStyle(width, color, alpha);
  graphics.strokePoints(
    quadraticPoints(-spec.half, startY, 0, controlY, spec.half, endY),
    false,
    false
  );
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
  strokeCut(shadow, spec, direction, spec.shadow, p.dark, tier === 'normal' ? 0.62 : 0.7);

  const after = options.scene.add.graphics();
  strokeCut(
    after,
    spec,
    direction,
    tier === 'ultimate' ? 7 : tier === 'skill' ? 5.5 : 4,
    p.dark,
    tier === 'normal' ? 0.42 : tier === 'skill' ? 0.5 : 0.6,
    direction * spec.afterOffset
  );

  const glow = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  strokeCut(glow, spec, direction, spec.glow, p.main, tier === 'normal' ? 0.19 : tier === 'skill' ? 0.25 : 0.32);

  const blade = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  strokeCut(blade, spec, direction, spec.body, p.accent, tier === 'normal' ? 0.9 : 0.98);
  strokeCut(blade, spec, direction, spec.core, p.core, 1);

  if (tier !== 'normal') {
    const razorEcho = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    strokeCut(
      razorEcho,
      { ...spec, half: spec.half * 0.88, bend: spec.bend * 0.74 },
      direction,
      tier === 'ultimate' ? 3.5 : 2.6,
      p.main,
      tier === 'ultimate' ? 0.6 : 0.45,
      -direction * 10
    );
    root.add(razorEcho);
  }

  const contact = options.scene.add.circle(
    hit === 2 ? 7 : -5,
    direction * -4,
    tier === 'ultimate' ? (hit === 2 ? 22 : 16) : tier === 'skill' ? (hit === 2 ? 14 : 11) : (hit === 2 ? 10 : 8),
    p.core,
    tier === 'ultimate' ? 0.46 : tier === 'skill' ? 0.32 : 0.22
  ).setBlendMode(Phaser.BlendModes.ADD);

  const tipA = options.scene.add.circle(-spec.half * 0.93, direction * spec.bend * 0.47, tier === 'ultimate' ? 4.5 : 3, p.core, 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);
  const tipB = options.scene.add.circle(spec.half * 0.94, -direction * spec.bend * 0.43, tier === 'ultimate' ? 4.5 : 3, p.core, 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);

  root.add([shadow, after, glow, blade, contact, tipA, tipB]);

  if (tier === 'ultimate' && hit === 2) {
    const executionRing = options.scene.add.ellipse(0, 0, 188, 120, 0x000000, 0)
      .setStrokeStyle(4.5, p.main, 0.5)
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
  root.setScale(tier === 'ultimate' ? (hit === 2 ? 0.76 : 0.72) : tier === 'skill' ? 0.8 : 0.84).setAlpha(0.38);
  await tween(options.scene, root, {
    scaleX: hit === 2 ? 1.04 : 1,
    scaleY: hit === 2 ? 1.04 : 1,
    alpha: 1,
    duration: enterMs,
    ease: 'Cubic.easeOut'
  }, enterMs + 150);
}

async function fadeCut(
  options: Options,
  root: Phaser.GameObjects.Container,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Promise<void> {
  const exitMs = options.reducedMotion ? 56 : tier === 'ultimate' ? (hit === 2 ? 118 : 104) : tier === 'skill' ? (hit === 2 ? 98 : 88) : (hit === 2 ? 84 : 76);
  try {
    await tween(options.scene, root, {
      scaleX: hit === 2 ? 1.13 : 1.08,
      scaleY: hit === 2 ? 1.13 : 1.08,
      alpha: 0,
      duration: exitMs,
      ease: 'Quad.easeOut'
    }, exitMs + 170);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2180AssassinDistinctTierVfx(
  options: Options,
  tier: Combat2180AssassinTier
): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const first = makeCut(options, p, tier, 1);
  await revealCut(options, first, tier, 1);

  const gap = options.reducedMotion ? 8 : tier === 'ultimate' ? 16 : tier === 'skill' ? 20 : 24;
  await wait(options.scene, gap);

  const second = makeCut(options, p, tier, 2);
  await revealCut(options, second, tier, 2);

  if (tier === 'ultimate' && options.scene.cameras?.main && !options.reducedMotion) {
    options.scene.cameras.main.shake(112, 0.0045, false);
  }

  const holdMs = options.reducedMotion ? 20 : tier === 'ultimate' ? 82 : tier === 'skill' ? 62 : 48;
  await wait(options.scene, holdMs);

  await Promise.all([
    fadeCut(options, first, tier, 1),
    fadeCut(options, second, tier, 2)
  ]);
}

(globalThis as any).POWDER_COMBAT2_ASSASSIN_DISTINCT_TIERS = {
  version: COMBAT2186_ASSASSIN_VERSION,
  role: 'assassin',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'two-clear-overlapping-crescent-cuts',
    skill: 'two-shadow-razor-crescent-cuts',
    ultimate: 'two-execution-grand-crescent-cuts'
  },
  slashShape: 'three-layer-curved-crescent-strokepoints',
  firstCutPersistsIntoSecond: true,
  slashPersistence: 'reveal-overlap-hold-fade',
  phaserGraphicsCompatibleCurve: true,
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
