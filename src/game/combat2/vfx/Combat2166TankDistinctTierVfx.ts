import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2176_TANK_VERSION = '2.17.6';
export const COMBAT2166_TANK_VERSION = COMBAT2176_TANK_VERSION;
export type Combat2166TankTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xe96d49, core: 0xffddb0, dark: 0x67291c },
  lava: { main: 0xe45132, core: 0xffc75d, dark: 0x5f2117 },
  water: { main: 0x4aaad1, core: 0xdff8ff, dark: 0x1c5069 },
  ice: { main: 0x86cee7, core: 0xf8ffff, dark: 0x356c7d },
  lightning: { main: 0xd7c45d, core: 0xfffbd2, dark: 0x70621b },
  storm: { main: 0x718bbf, core: 0xebf0ff, dark: 0x394866 },
  wind: { main: 0x65bfb4, core: 0xeafffb, dark: 0x2b625c },
  leaf: { main: 0x69b979, core: 0xecffe9, dark: 0x345c3b },
  poison: { main: 0x91bd5d, core: 0xf0ffd4, dark: 0x4b5f2c },
  earth: { main: 0xa77d55, core: 0xffdfba, dark: 0x5b4431 },
  steel: { main: 0xaebfc9, core: 0xf8ffff, dark: 0x515f67 },
  light: { main: 0xdccb8f, core: 0xffffef, dark: 0x7b7041 },
  dark: { main: 0x876eae, core: 0xeee7ff, dark: 0x433653 },
  neutral: { main: 0x8eb7c2, core: 0xf7ffff, dark: 0x40575e }
});

export function isCombat2166TankRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('do don') || value.includes('tank');
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

function incomingAngle(options: Options): number {
  return Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
}

function shieldPlate(
  options: Options,
  p: Palette,
  width: number,
  height: number,
  stroke: number,
  alpha = 0.96
): Phaser.GameObjects.Polygon {
  const hw = width / 2;
  const hh = height / 2;
  return options.scene.add.polygon(0, 0, [
    -hw * 0.72, -hh,
    hw * 0.28, -hh * 0.9,
    hw, -hh * 0.2,
    hw * 0.72, hh * 0.72,
    0, hh,
    -hw * 0.72, hh * 0.72,
    -hw, -hh * 0.2
  ], p.dark, alpha).setStrokeStyle(stroke, p.main, 0.98);
}

async function playShieldBash(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 18)
    .setRotation(incomingAngle(options));
  const plate = shieldPlate(options, p, 64, 58, 3.5);
  const face = shieldPlate(options, p, 42, 38, 2, 0.92).setFillStyle(p.main, 0.68);
  const core = options.scene.add.rectangle(5, 0, 30, 5, p.core, 0.88).setBlendMode(Phaser.BlendModes.ADD);
  const contact = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  contact.lineStyle(3, p.core, 0.56);
  contact.lineBetween(28, -18, 54, -27);
  contact.lineBetween(31, 0, 61, 0);
  contact.lineBetween(28, 18, 54, 27);
  root.add([contact, plate, face, core]);
  root.setScale(0.82);
  try {
    await tween(options.scene, root, {
      scaleX: 1.12,
      scaleY: 1.12,
      alpha: 0,
      x: options.target.x + Math.cos(root.rotation) * 14,
      y: options.target.y + Math.sin(root.rotation) * 14,
      duration: options.reducedMotion ? 78 : 125,
      ease: 'Cubic.easeOut'
    }, 360);
  } finally {
    root.destroy(true);
  }
}

async function playBulwarkSlam(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 19)
    .setRotation(incomingAngle(options));
  const center = shieldPlate(options, p, 82, 72, 4.5);
  const face = shieldPlate(options, p, 54, 48, 2.5, 0.94).setFillStyle(p.main, 0.72);
  const upper = shieldPlate(options, p, 46, 36, 2.5, 0.82).setPosition(-8, -46).setScale(0.86);
  const lower = shieldPlate(options, p, 46, 36, 2.5, 0.82).setPosition(-8, 46).setScale(0.86);
  const core = options.scene.add.rectangle(8, 0, 42, 6, p.core, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  const ground = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  ground.lineStyle(4, p.main, 0.5);
  ground.lineBetween(-18, -42, 58, -66);
  ground.lineBetween(-6, -18, 69, -28);
  ground.lineBetween(-6, 18, 69, 28);
  ground.lineBetween(-18, 42, 58, 66);
  root.add([ground, upper, lower, center, face, core]);
  root.setScale(0.78);
  try {
    await Promise.all([
      tween(options.scene, upper, { y: -27, duration: options.reducedMotion ? 70 : 120, ease: 'Cubic.easeIn' }, 300),
      tween(options.scene, lower, { y: 27, duration: options.reducedMotion ? 70 : 120, ease: 'Cubic.easeIn' }, 300),
      tween(options.scene, root, {
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 0,
        duration: options.reducedMotion ? 105 : 175,
        ease: 'Quad.easeOut'
      }, 420)
    ]);
  } finally {
    root.destroy(true);
  }
}

async function playFortressBreaker(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 21)
    .setRotation(incomingAngle(options));
  const outer = shieldPlate(options, p, 126, 110, 6, 0.98);
  const middle = shieldPlate(options, p, 92, 80, 4.5, 0.94).setFillStyle(p.main, 0.5);
  const inner = shieldPlate(options, p, 58, 50, 3, 0.96).setFillStyle(p.core, 0.22);
  const core = options.scene.add.rectangle(11, 0, 60, 9, p.core, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  const braces = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  braces.lineStyle(6, p.main, 0.7);
  braces.lineBetween(-70, -48, 74, -76);
  braces.lineBetween(-46, -22, 90, -36);
  braces.lineBetween(-46, 22, 90, 36);
  braces.lineBetween(-70, 48, 74, 76);
  braces.lineStyle(3, p.core, 0.65);
  braces.lineBetween(-24, -62, 34, -95);
  braces.lineBetween(-24, 62, 34, 95);
  const shock = options.scene.add.ellipse(18, 0, 182, 122, 0x000000, 0)
    .setStrokeStyle(6, p.main, 0.62)
    .setBlendMode(Phaser.BlendModes.ADD);
  const flash = options.scene.add.circle(20, 0, 32, p.core, 0.28).setBlendMode(Phaser.BlendModes.ADD);
  root.add([braces, shock, outer, middle, inner, flash, core]);
  root.setScale(0.62);

  if (options.scene.cameras?.main) {
    options.scene.cameras.main.shake(options.reducedMotion ? 90 : 175, options.reducedMotion ? 0.0017 : 0.0058, false);
  }

  try {
    await tween(options.scene, root, {
      scaleX: 1.42,
      scaleY: 1.42,
      alpha: 0,
      duration: options.reducedMotion ? 150 : 265,
      ease: 'Cubic.easeOut'
    }, 540);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2166TankDistinctTierVfx(options: Options, tier: Combat2166TankTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  if (tier === 'ultimate') {
    await playFortressBreaker(options, p);
    return;
  }
  if (tier === 'skill') {
    await playBulwarkSlam(options, p);
    return;
  }
  await playShieldBash(options, p);
}

(globalThis as any).POWDER_COMBAT2_TANK_MANUAL_RENDERER = playCombat2166TankDistinctTierVfx;
(globalThis as any).POWDER_COMBAT2_TANK_DISTINCT_TIERS = {
  version: COMBAT2176_TANK_VERSION,
  role: 'tank',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'shield-bash-contact',
    skill: 'bulwark-slam-contact',
    ultimate: 'fortress-breaker-contact'
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
