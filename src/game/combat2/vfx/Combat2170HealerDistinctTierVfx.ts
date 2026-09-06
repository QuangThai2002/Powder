import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { strokeQuadraticPath } from './CombatVfxDrawing';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2182_HEALER_VERSION = '2.18.2';
export const COMBAT2170_HEALER_VERSION = COMBAT2182_HEALER_VERSION;
export type Combat2170HealerTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff8a67, core: 0xfff5dc, dark: 0x74352b, accent: 0xffc08c },
  lava: { main: 0xf0724f, core: 0xffe184, dark: 0x672d22, accent: 0xffad6e },
  water: { main: 0x67c9ee, core: 0xf3fdff, dark: 0x245f76, accent: 0xa7e9ff },
  ice: { main: 0x9ae8fb, core: 0xffffff, dark: 0x3a7c8c, accent: 0xd2f8ff },
  lightning: { main: 0xeadb76, core: 0xffffee, dark: 0x786c25, accent: 0xffef9d },
  storm: { main: 0x91a8e1, core: 0xf8f9ff, dark: 0x48567d, accent: 0xbfcdf4 },
  wind: { main: 0x79d9c9, core: 0xf5fffc, dark: 0x316f65, accent: 0xaef1e5 },
  leaf: { main: 0x86d991, core: 0xf6ffef, dark: 0x3a6941, accent: 0xb7efbd },
  poison: { main: 0xaad875, core: 0xfbffe7, dark: 0x566e35, accent: 0xd7ef9f },
  earth: { main: 0xc29a72, core: 0xffeed5, dark: 0x654e39, accent: 0xe3bd91 },
  steel: { main: 0xcbdbe3, core: 0xffffff, dark: 0x5b6c75, accent: 0xedf5f8 },
  light: { main: 0xf2dfa0, core: 0xfffff9, dark: 0x81764d, accent: 0xfff2bd },
  dark: { main: 0xaa8ddd, core: 0xfaf4ff, dark: 0x513d6d, accent: 0xcfb6ef },
  neutral: { main: 0xa7d5dc, core: 0xffffff, dark: 0x47666d, accent: 0xd5f0f4 }
});

export function isCombat2170HealerRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('tri lieu') || value.includes('healer') || value.includes('healing');
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
    try { tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish }); }
    catch { finish(); }
  });
}

function travelMs(options: Options, tier: Combat2170HealerTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 445 : tier === 'skill' ? 355 : 280;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 85));
}

function angle(options: Options): number {
  return Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
}

async function playMendSpark(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 8)
    .setRotation(angle(options));
  const seed = options.scene.add.circle(8, 0, 11, p.dark, 0.96).setStrokeStyle(2.5, p.main, 0.95);
  const core = options.scene.add.circle(8, 0, 5.5, p.core, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  const wingA = options.scene.add.ellipse(-7, -10, 29, 9, p.accent, 0.64).setRotation(-0.35).setBlendMode(Phaser.BlendModes.ADD);
  const wingB = options.scene.add.ellipse(-7, 10, 29, 9, p.accent, 0.64).setRotation(0.35).setBlendMode(Phaser.BlendModes.ADD);
  root.add([wingA, wingB, seed, core]);
  const ms = travelMs(options, 'normal');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Sine.easeInOut' }, ms + 260); }
  finally { root.destroy(true); }

  const bloom = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 15);
  const ring = options.scene.add.circle(0, 0, 31, 0x000000, 0).setStrokeStyle(3, p.main, 0.72);
  const cross = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  cross.lineStyle(4, p.core, 0.66);
  cross.lineBetween(-14, 0, 14, 0);
  cross.lineBetween(0, -14, 0, 14);
  bloom.add([ring, cross]);
  try { await tween(options.scene, bloom, { scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 145, ease: 'Quad.easeOut' }, 330); }
  finally { bloom.destroy(true); }
}

async function playRestorationStream(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 9)
    .setRotation(angle(options));
  const top = options.scene.add.circle(6, -13, 10, p.main, 0.32).setStrokeStyle(2.5, p.core, 0.78);
  const bottom = options.scene.add.circle(6, 13, 10, p.accent, 0.28).setStrokeStyle(2.5, p.main, 0.72);
  const ribbon = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  ribbon.lineStyle(4, p.core, 0.6);
  strokeQuadraticPath(ribbon, -48, -12, [{ controlX: -5, controlY: -32, endX: 58, endY: 0 }]);
  ribbon.lineStyle(4, p.main, 0.56);
  strokeQuadraticPath(ribbon, -48, 12, [{ controlX: -5, controlY: 32, endX: 58, endY: 0 }]);
  root.add([ribbon, top, bottom]);
  const ms = travelMs(options, 'skill');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Sine.easeInOut' }, ms + 280); }
  finally { root.destroy(true); }

  const bloom = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 16);
  const petal = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI * 2 * i / 6;
    petal.lineStyle(5, i % 2 ? p.accent : p.main, 0.52);
    petal.lineBetween(Math.cos(a) * 15, Math.sin(a) * 15, Math.cos(a) * 52, Math.sin(a) * 52);
  }
  const ring = options.scene.add.circle(0, 0, 48, 0x000000, 0).setStrokeStyle(4, p.core, 0.6);
  const center = options.scene.add.circle(0, 0, 14, p.core, 0.26).setBlendMode(Phaser.BlendModes.ADD);
  bloom.add([petal, ring, center]);
  try { await tween(options.scene, bloom, { scaleX: 1.34, scaleY: 1.34, alpha: 0, duration: 195, ease: 'Cubic.easeOut' }, 410); }
  finally { bloom.destroy(true); }
}

async function playSanctuaryCrown(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 11)
    .setRotation(angle(options));
  const crown = options.scene.add.polygon(0, 0, [
    -34, 10, -27, -22, -11, -8, 0, -34, 12, -8, 28, -22, 35, 10, 0, 29
  ], p.dark, 0.98).setStrokeStyle(4, p.main, 1);
  const halo = options.scene.add.ellipse(0, 0, 96, 62, 0x000000, 0).setStrokeStyle(4, p.accent, 0.72).setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.circle(0, 3, 13, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  const ray = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  ray.lineStyle(8, p.core, 0.46); ray.lineBetween(35, 0, 126, 0);
  ray.lineStyle(3, p.main, 0.76); ray.lineBetween(31, -16, 118, -6); ray.lineBetween(31, 16, 118, 6);
  root.add([halo, crown, core, ray]);
  const ms = travelMs(options, 'ultimate');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Cubic.easeInOut' }, ms + 300); }
  finally { root.destroy(true); }

  const sanctuary = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 18).setScale(0.6);
  const outer = options.scene.add.circle(0, 0, 94, 0x000000, 0).setStrokeStyle(6, p.main, 0.72);
  const inner = options.scene.add.circle(0, 0, 62, 0x000000, 0).setStrokeStyle(4, p.accent, 0.68);
  const cross = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  cross.lineStyle(10, p.core, 0.58); cross.lineBetween(-44, 0, 44, 0); cross.lineBetween(0, -44, 0, 44);
  const glow = options.scene.add.circle(0, 0, 34, p.core, 0.28).setBlendMode(Phaser.BlendModes.ADD);
  sanctuary.add([outer, inner, cross, glow]);
  if (options.scene.cameras?.main) {
    options.scene.cameras.main.shake(options.reducedMotion ? 70 : 120, options.reducedMotion ? 0.0011 : 0.0032, false);
  }
  try { await tween(options.scene, sanctuary, { scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: options.reducedMotion ? 155 : 270, ease: 'Cubic.easeOut' }, 550); }
  finally { sanctuary.destroy(true); }
}

export async function playCombat2170HealerDistinctTierVfx(options: Options, tier: Combat2170HealerTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  if (tier === 'ultimate') return playSanctuaryCrown(options, p);
  if (tier === 'skill') return playRestorationStream(options, p);
  return playMendSpark(options, p);
}

(globalThis as any).POWDER_COMBAT2_HEALER_DISTINCT_TIERS = {
  version: COMBAT2182_HEALER_VERSION,
  role: 'healer',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'mend-spark',
    skill: 'restoration-stream',
    ultimate: 'sanctuary-crown'
  },
  normalCameraShake: false,
  skillCameraShake: false,
  ultimateCameraShake: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
