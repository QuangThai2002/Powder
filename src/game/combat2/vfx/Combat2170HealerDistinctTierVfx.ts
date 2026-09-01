import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2170_HEALER_VERSION = '2.17.0';
export type Combat2170HealerTier = 'normal' | 'skill' | 'ultimate';
type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff8a67, core: 0xfff5dc, dark: 0x74352b, accent: 0xffc08c }, lava: { main: 0xf0724f, core: 0xffe184, dark: 0x672d22, accent: 0xffad6e },
  water: { main: 0x67c9ee, core: 0xf3fdff, dark: 0x245f76, accent: 0xa7e9ff }, ice: { main: 0x9ae8fb, core: 0xffffff, dark: 0x3a7c8c, accent: 0xd2f8ff },
  lightning: { main: 0xeadb76, core: 0xffffee, dark: 0x786c25, accent: 0xffef9d }, storm: { main: 0x91a8e1, core: 0xf8f9ff, dark: 0x48567d, accent: 0xbfcdf4 },
  wind: { main: 0x79d9c9, core: 0xf5fffc, dark: 0x316f65, accent: 0xaef1e5 }, leaf: { main: 0x86d991, core: 0xf6ffef, dark: 0x3a6941, accent: 0xb7efbd },
  poison: { main: 0xaad875, core: 0xfbffe7, dark: 0x566e35, accent: 0xd7ef9f }, earth: { main: 0xc29a72, core: 0xffeed5, dark: 0x654e39, accent: 0xe3bd91 },
  steel: { main: 0xcbdbe3, core: 0xffffff, dark: 0x5b6c75, accent: 0xedf5f8 }, light: { main: 0xf2dfa0, core: 0xfffff9, dark: 0x81764d, accent: 0xfff2bd },
  dark: { main: 0xaa8ddd, core: 0xfaf4ff, dark: 0x513d6d, accent: 0xcfb6ef }, neutral: { main: 0xa7d5dc, core: 0xffffff, dark: 0x47666d, accent: 0xd5f0f4 }
});

export function isCombat2170HealerRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('tri lieu') || value.includes('healer') || value.includes('healing');
}

function tween(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject | object, config: Phaser.Types.Tweens.TweenBuilderConfig, fallbackMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let tw: Phaser.Tweens.Tween | null = null;
    const finish = () => { if (done) return; done = true; window.clearTimeout(timer); scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort); scene.events.off(Phaser.Scenes.Events.DESTROY, abort); resolve(); };
    const abort = () => { try { tw?.stop(); } catch { /* cleanup */ } finish(); };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try { tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish }); } catch { finish(); }
  });
}

function travelMs(options: Options, tier: Combat2170HealerTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 430 : tier === 'skill' ? 340 : 265;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 82));
}

function makeRoot(options: Options, depth: number): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  return options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + depth).setRotation(angle);
}

function normal(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 6);
  const aura = options.scene.add.ellipse(-5, 0, 116, 46, p.main, 0.08).setBlendMode(Phaser.BlendModes.ADD);
  const seed = options.scene.add.circle(8, 0, 13, p.dark, 0.96).setStrokeStyle(2.2, p.main, 0.96);
  const core = options.scene.add.circle(8, 0, 6.5, p.core, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  const wingA = options.scene.add.ellipse(-4, -12, 30, 10, p.accent, 0.72).setRotation(-0.42).setBlendMode(Phaser.BlendModes.ADD);
  const wingB = options.scene.add.ellipse(-4, 12, 30, 10, p.accent, 0.72).setRotation(0.42).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, wingA, wingB, seed, core]);
  return root;
}

function skill(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 7);
  const aura = options.scene.add.ellipse(-8, 0, 184, 84, p.main, 0.1).setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.circle(2, 0, 16, p.dark, 0.97).setStrokeStyle(3, p.main, 0.98);
  const inner = options.scene.add.circle(2, 0, 7, p.core, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  const ribbons = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  ribbons.lineStyle(4, p.accent, 0.76); ribbons.beginPath(); ribbons.moveTo(-52, -18); ribbons.quadraticBezierTo(-6, -42, 58, -6); ribbons.strokePath();
  ribbons.lineStyle(4, p.main, 0.7); ribbons.beginPath(); ribbons.moveTo(-52, 18); ribbons.quadraticBezierTo(-6, 42, 58, 6); ribbons.strokePath();
  const tip = options.scene.add.circle(62, 0, 8, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, ribbons, core, inner, tip]);
  return root;
}

function ultimate(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 9);
  const aura = options.scene.add.ellipse(-20, 0, 282, 128, p.main, 0.13).setBlendMode(Phaser.BlendModes.ADD);
  const heart = options.scene.add.polygon(-4, 0, [0,-26,18,-36,36,-24,42,-5,32,14,0,42,-32,14,-42,-5,-36,-24,-18,-36], p.dark, 0.98).setStrokeStyle(4, p.main, 1);
  const core = options.scene.add.circle(-4, 0, 11, p.core, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  const halos = options.scene.add.container(0, 0);
  [46, 66, 88].forEach((r, i) => halos.add(options.scene.add.ellipse(-4, 0, r * 2, r * (i === 1 ? 0.78 : 1.08), 0x000000, 0).setStrokeStyle(3.4 - i * 0.5, i === 1 ? p.core : p.accent, 0.8 - i * 0.1).setBlendMode(Phaser.BlendModes.ADD)));
  const ray = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  ray.lineStyle(8, p.core, 0.5); ray.lineBetween(34, 0, 126, 0); ray.lineStyle(3, p.main, 0.88); ray.lineBetween(26, -15, 116, -5); ray.lineBetween(26, 15, 116, 5);
  root.add([aura, halos, heart, core, ray]);
  (root as any).__healerHalos = halos;
  return root;
}

async function impact(options: Options, tier: Combat2170HealerTier, p: Palette): Promise<void> {
  const size = tier === 'ultimate' ? 92 : tier === 'skill' ? 66 : 44;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 11);
  const ring = options.scene.add.circle(0, 0, size, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.9);
  const cross = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  cross.lineStyle(tier === 'ultimate' ? 9 : 6, p.core, 0.62); cross.lineBetween(-size * 0.42, 0, size * 0.42, 0); cross.lineBetween(0, -size * 0.42, 0, size * 0.42);
  const glow = options.scene.add.circle(0, 0, size * 0.28, p.accent, 0.2).setBlendMode(Phaser.BlendModes.ADD);
  root.add([glow, ring, cross]);
  try { await tween(options.scene, root, { scaleX: 1.48, scaleY: 1.48, alpha: 0, duration: tier === 'ultimate' ? 255 : 180, ease: 'Quad.easeOut' }, 470); }
  finally { root.destroy(true); }
}

export async function playCombat2170HealerDistinctTierVfx(options: Options, tier: Combat2170HealerTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const root = tier === 'ultimate' ? ultimate(options, p) : tier === 'skill' ? skill(options, p) : normal(options, p);
  const ms = travelMs(options, tier);
  const halos = (root as any).__healerHalos as Phaser.GameObjects.Container | undefined;
  try {
    const jobs: Promise<void>[] = [tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: tier === 'ultimate' ? 'Cubic.easeInOut' : 'Quad.easeInOut' }, ms + 290)];
    if (halos && !options.reducedMotion) jobs.push(tween(options.scene, halos, { angle: 110, duration: ms, ease: 'Linear' }, ms + 290));
    await Promise.all(jobs);
  } finally { root.destroy(true); }
  await impact(options, tier, p);
}

(globalThis as any).POWDER_COMBAT2_HEALER_DISTINCT_TIERS = {
  version: COMBAT2170_HEALER_VERSION,
  role: 'healer',
  realCombatReady: true,
  tiers: { normal: 'life-seed', skill: 'restoration-ribbon', ultimate: 'sanctuary-heart-ray' },
  sourceToTarget: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};