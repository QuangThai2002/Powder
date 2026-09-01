import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2180_ASSASSIN_VERSION = '2.18.0';
export type Combat2180AssassinTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

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

function makeCut(
  options: Options,
  p: Palette,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 22 + hit);
  const direction = hit === 1 ? 1 : -1;
  const length = tier === 'ultimate' ? 112 : tier === 'skill' ? 82 : 60;
  const slope = tier === 'ultimate' ? 0.62 : tier === 'skill' ? 0.56 : 0.5;
  const width = tier === 'ultimate' ? 7.5 : tier === 'skill' ? 5.2 : 3.7;

  const slash = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  slash.lineStyle(width * 2.2, p.main, tier === 'normal' ? 0.12 : tier === 'skill' ? 0.16 : 0.2);
  slash.lineBetween(-length, direction * length * slope, length, -direction * length * slope);
  slash.lineStyle(width, p.core, 1);
  slash.lineBetween(-length, direction * length * slope, length, -direction * length * slope);

  const edge = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  edge.lineStyle(Math.max(2, width * 0.45), p.accent, tier === 'normal' ? 0.42 : tier === 'skill' ? 0.64 : 0.82);
  edge.lineBetween(-length - 7, direction * (length * slope + 9), length - 8, -direction * (length * slope - 5));

  const contact = options.scene.add.circle(
    hit === 2 ? 7 : -5,
    hit === 2 ? -4 : 4,
    tier === 'ultimate' ? (hit === 2 ? 22 : 16) : tier === 'skill' ? (hit === 2 ? 14 : 11) : (hit === 2 ? 9 : 7),
    p.core,
    tier === 'ultimate' ? 0.52 : tier === 'skill' ? 0.36 : 0.24
  ).setBlendMode(Phaser.BlendModes.ADD);

  root.add([edge, slash, contact]);

  if (tier !== 'normal') {
    const after = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    after.lineStyle(tier === 'ultimate' ? 4 : 2.5, p.main, tier === 'ultimate' ? 0.54 : 0.38);
    after.lineBetween(-length * 0.9, direction * length * (slope + 0.14), length * 0.82, -direction * length * (slope - 0.08));
    root.add(after);
  }

  if (tier === 'ultimate' && hit === 2) {
    const executionRing = options.scene.add.ellipse(0, 0, 176, 112, 0x000000, 0)
      .setStrokeStyle(5, p.main, 0.55)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.addAt(executionRing, 0);
  }

  return root;
}

async function playCut(
  options: Options,
  p: Palette,
  tier: Combat2180AssassinTier,
  hit: 1 | 2
): Promise<void> {
  const root = makeCut(options, p, tier, hit);
  const duration = options.reducedMotion
    ? 52
    : tier === 'ultimate'
      ? (hit === 2 ? 105 : 82)
      : tier === 'skill'
        ? 74
        : 60;
  root.setScale(tier === 'ultimate' ? (hit === 2 ? 0.68 : 0.64) : tier === 'skill' ? 0.75 : 0.8);

  if (tier === 'ultimate' && options.scene.cameras?.main && !options.reducedMotion) {
    options.scene.cameras.main.shake(hit === 2 ? 92 : 48, hit === 2 ? 0.0044 : 0.0022, false);
  }

  try {
    await tween(options.scene, root, {
      scaleX: hit === 2 ? 1.36 : 1.22,
      scaleY: hit === 2 ? 1.36 : 1.22,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut'
    }, duration + 190);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2180AssassinDistinctTierVfx(
  options: Options,
  tier: Combat2180AssassinTier
): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  await playCut(options, p, tier, 1);
  const gap = options.reducedMotion ? 8 : tier === 'ultimate' ? 16 : tier === 'skill' ? 22 : 30;
  await wait(options.scene, gap);
  await playCut(options, p, tier, 2);
}

(globalThis as any).POWDER_COMBAT2_ASSASSIN_DISTINCT_TIERS = {
  version: COMBAT2180_ASSASSIN_VERSION,
  role: 'assassin',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'two-quick-contact-cuts',
    skill: 'two-shadow-afterimage-cuts',
    ultimate: 'two-execution-critical-style-cuts'
  },
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
