import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2178_FIGHTER_VERSION = '2.17.8';
export const COMBAT2167_FIGHTER_VERSION = COMBAT2178_FIGHTER_VERSION;
export type Combat2167FighterTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff7048, core: 0xffe1b8, dark: 0x6b281d },
  lava: { main: 0xf25635, core: 0xffcf62, dark: 0x612118 },
  water: { main: 0x47b7dc, core: 0xe8fbff, dark: 0x18566f },
  ice: { main: 0x83d9ef, core: 0xffffff, dark: 0x327283 },
  lightning: { main: 0xe8cf58, core: 0xfffee0, dark: 0x756215 },
  storm: { main: 0x728fce, core: 0xf0f4ff, dark: 0x3a4b70 },
  wind: { main: 0x61cfbd, core: 0xf0fffb, dark: 0x27665e },
  leaf: { main: 0x6ac77a, core: 0xf0ffe9, dark: 0x315e39 },
  poison: { main: 0x99c95f, core: 0xf5ffd8, dark: 0x4a6429 },
  earth: { main: 0xb68555, core: 0xffe5c1, dark: 0x5d452f },
  steel: { main: 0xbccbd3, core: 0xffffff, dark: 0x53636b },
  light: { main: 0xe8d392, core: 0xfffff2, dark: 0x7d7041 },
  dark: { main: 0x9477c6, core: 0xf3ecff, dark: 0x49365f },
  neutral: { main: 0x91c2cc, core: 0xfbffff, dark: 0x3f5b62 }
});

export function isCombat2167FighterRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  return value.includes('dau si') || value.includes('fighter') || value.includes('brawler');
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

function hitAngle(options: Options): number {
  return Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
}

function fistCore(options: Options, p: Palette, size: number, stroke: number): Phaser.GameObjects.Container {
  const fist = options.scene.add.container(0, 0);
  const palm = options.scene.add.polygon(0, 0, [
    -size * 0.48, -size * 0.3,
    -size * 0.15, -size * 0.5,
    size * 0.28, -size * 0.42,
    size * 0.52, -size * 0.16,
    size * 0.58, size * 0.14,
    size * 0.26, size * 0.42,
    -size * 0.18, size * 0.5,
    -size * 0.5, size * 0.26
  ], p.dark, 0.98).setStrokeStyle(stroke, p.main, 0.98);
  const knuckles = options.scene.add.container(size * 0.25, -size * 0.02);
  [-0.28, -0.09, 0.1, 0.29].forEach((ratio) => {
    knuckles.add(options.scene.add.circle(size * 0.15, size * ratio, size * 0.095, p.core, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD));
  });
  const center = options.scene.add.circle(-size * 0.04, 0, size * 0.16, p.main, 0.25)
    .setStrokeStyle(Math.max(2, stroke - 1), p.core, 0.76)
    .setBlendMode(Phaser.BlendModes.ADD);
  fist.add([palm, center, knuckles]);
  return fist;
}

async function playHeavyStraight(options: Options, p: Palette): Promise<void> {
  const angle = hitAngle(options);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 18)
    .setRotation(angle);
  const fist = fistCore(options, p, 44, 3);
  const compression = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  compression.lineStyle(3, p.main, 0.5);
  compression.lineBetween(-58, -12, -24, -5);
  compression.lineBetween(-62, 0, -25, 0);
  compression.lineBetween(-58, 12, -24, 5);
  const contact = options.scene.add.circle(30, 0, 10, p.core, 0.28)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add([compression, fist, contact]);
  root.setScale(0.78);
  try {
    await tween(options.scene, root, {
      x: options.target.x + Math.cos(angle) * 18,
      y: options.target.y + Math.sin(angle) * 18,
      scaleX: 1.12,
      scaleY: 1.12,
      alpha: 0,
      duration: options.reducedMotion ? 78 : 125,
      ease: 'Cubic.easeOut'
    }, 360);
  } finally {
    root.destroy(true);
  }
}

async function playRisingBreaker(options: Options, p: Palette): Promise<void> {
  const angle = hitAngle(options);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 19)
    .setRotation(angle);
  const fist = fistCore(options, p, 56, 4).setRotation(-0.18);
  const lift = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  lift.lineStyle(5, p.main, 0.58);
  lift.lineBetween(-42, 32, 18, -36);
  lift.lineBetween(-26, 42, 34, -26);
  lift.lineStyle(2.5, p.core, 0.62);
  lift.lineBetween(-48, 14, 12, -50);
  const burst = options.scene.add.ellipse(18, -12, 86, 50, p.main, 0.05)
    .setStrokeStyle(4, p.main, 0.58)
    .setBlendMode(Phaser.BlendModes.ADD);
  const contact = options.scene.add.circle(24, -18, 14, p.core, 0.34)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add([lift, burst, fist, contact]);
  root.setScale(0.72);
  try {
    await tween(options.scene, root, {
      x: options.target.x + Math.cos(angle) * 14,
      y: options.target.y + Math.sin(angle) * 14 - 16,
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

async function playMeteorFist(options: Options, p: Palette): Promise<void> {
  const angle = hitAngle(options);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 21)
    .setRotation(angle);
  const fist = fistCore(options, p, 78, 6);
  const drive = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 5; i += 1) {
    const offset = (i - 2) * 17;
    drive.lineStyle(i === 2 ? 8 : 5, i % 2 ? p.core : p.main, i === 2 ? 0.74 : 0.54);
    drive.lineBetween(-112, offset, -38, offset * 0.38);
  }
  const shock = options.scene.add.ellipse(18, 0, 176, 112, 0x000000, 0)
    .setStrokeStyle(7, p.main, 0.66)
    .setBlendMode(Phaser.BlendModes.ADD);
  const innerShock = options.scene.add.ellipse(24, 0, 104, 66, 0x000000, 0)
    .setStrokeStyle(4, p.core, 0.74)
    .setBlendMode(Phaser.BlendModes.ADD);
  const flash = options.scene.add.circle(30, 0, 34, p.core, 0.3)
    .setBlendMode(Phaser.BlendModes.ADD);
  const fractures = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  fractures.lineStyle(4, p.main, 0.56);
  fractures.lineBetween(42, -18, 92, -48);
  fractures.lineBetween(46, -6, 108, -10);
  fractures.lineBetween(46, 6, 108, 10);
  fractures.lineBetween(42, 18, 92, 48);
  root.add([drive, shock, innerShock, fractures, fist, flash]);
  root.setScale(0.6);

  if (options.scene.cameras?.main) {
    options.scene.cameras.main.shake(
      options.reducedMotion ? 88 : 170,
      options.reducedMotion ? 0.0016 : 0.006,
      false
    );
  }

  try {
    await tween(options.scene, root, {
      x: options.target.x + Math.cos(angle) * 24,
      y: options.target.y + Math.sin(angle) * 24,
      scaleX: 1.46,
      scaleY: 1.46,
      alpha: 0,
      duration: options.reducedMotion ? 150 : 275,
      ease: 'Cubic.easeOut'
    }, 560);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2167FighterDistinctTierVfx(
  options: Options,
  tier: Combat2167FighterTier
): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  if (tier === 'ultimate') {
    await playMeteorFist(options, p);
    return;
  }
  if (tier === 'skill') {
    await playRisingBreaker(options, p);
    return;
  }
  await playHeavyStraight(options, p);
}

(globalThis as any).POWDER_COMBAT2_FIGHTER_DISTINCT_TIERS = {
  version: COMBAT2178_FIGHTER_VERSION,
  role: 'fighter',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'heavy-straight-punch-contact',
    skill: 'rising-breaker-punch-contact',
    ultimate: 'meteor-fist-finisher-contact'
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
