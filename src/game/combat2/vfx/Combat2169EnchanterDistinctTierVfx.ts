import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2169_ENCHANTER_VERSION = '2.16.9';
export type Combat2169EnchanterTier = 'normal' | 'skill' | 'ultimate';
type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xf08364, core: 0xfff0d2, dark: 0x6c3028, accent: 0xffba78 }, lava: { main: 0xe86642, core: 0xffd86f, dark: 0x61281d, accent: 0xffa05a },
  water: { main: 0x59b9dd, core: 0xecfbff, dark: 0x1d5870, accent: 0x8eddf3 }, ice: { main: 0x8cdef2, core: 0xffffff, dark: 0x337383, accent: 0xc2f2ff },
  lightning: { main: 0xe4d064, core: 0xffffe6, dark: 0x75651a, accent: 0xffeb8a }, storm: { main: 0x7a90cb, core: 0xf5f7ff, dark: 0x3d4d72, accent: 0xa5b8eb },
  wind: { main: 0x68cdbd, core: 0xf1fffb, dark: 0x2b685f, accent: 0x98e9dc }, leaf: { main: 0x76c982, core: 0xf1ffe9, dark: 0x345f3b, accent: 0xa7e8ad },
  poison: { main: 0x9fc769, core: 0xf8ffde, dark: 0x4f652f, accent: 0xcce993 }, earth: { main: 0xb58b60, core: 0xffe8c9, dark: 0x5d4732, accent: 0xdbb17e },
  steel: { main: 0xc0ced6, core: 0xffffff, dark: 0x53646c, accent: 0xe6f0f4 }, light: { main: 0xe9d79a, core: 0xfffff6, dark: 0x7b7149, accent: 0xffefb3 },
  dark: { main: 0x9a7dcb, core: 0xf6efff, dark: 0x4a3864, accent: 0xc0a5e8 }, neutral: { main: 0x98c7cf, core: 0xfcffff, dark: 0x405d64, accent: 0xc6e9ee }
});

export function isCombat2169EnchanterRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('thuat si') || value.includes('enchanter') || value.includes('warlock');
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

function travelMs(options: Options, tier: Combat2169EnchanterTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 420 : tier === 'skill' ? 335 : 260;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 78));
}

function makeRoot(options: Options, depth: number): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  return options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + depth).setRotation(angle);
}

function normal(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 6);
  const aura = options.scene.add.ellipse(-6, 0, 118, 42, p.main, 0.07).setBlendMode(Phaser.BlendModes.ADD);
  const sigil = options.scene.add.polygon(10, 0, [0,-15,13,-7,16,8,0,17,-16,8,-13,-7], p.dark, 0.96).setStrokeStyle(2.2, p.main, 0.95);
  const core = options.scene.add.circle(10, 0, 7, p.core, 0.95).setBlendMode(Phaser.BlendModes.ADD);
  const needle = options.scene.add.triangle(42, 0, 18, -5, 18, 5, 52, 0, p.accent, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, sigil, core, needle]);
  return root;
}

function skill(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 7);
  const aura = options.scene.add.ellipse(-4, 0, 175, 74, p.main, 0.09).setBlendMode(Phaser.BlendModes.ADD);
  const left = options.scene.add.polygon(-2, -15, [0,-17,14,-8,17,8,0,18,-17,8,-14,-8], p.dark, 0.96).setStrokeStyle(2.4, p.main, 0.96);
  const right = options.scene.add.polygon(24, 15, [0,-17,14,-8,17,8,0,18,-17,8,-14,-8], p.dark, 0.96).setStrokeStyle(2.4, p.accent, 0.92);
  const bind = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  bind.lineStyle(3.3, p.core, 0.78); bind.lineBetween(-13, -5, 34, 5); bind.lineStyle(2.5, p.main, 0.7); bind.lineBetween(-8, 7, 39, -7);
  const tip = options.scene.add.circle(60, 0, 7, p.core, 0.94).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, left, right, bind, tip]);
  return root;
}

function ultimate(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 9);
  const aura = options.scene.add.ellipse(-18, 0, 264, 118, p.main, 0.12).setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.circle(0, 0, 21, p.dark, 0.98).setStrokeStyle(4, p.main, 1);
  const eye = options.scene.add.ellipse(0, 0, 25, 8, p.core, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  const rings = options.scene.add.container(0, 0);
  [34, 50, 68].forEach((r, i) => rings.add(options.scene.add.ellipse(0, 0, r * 2, r * (i === 1 ? 0.88 : 1.12), 0x000000, 0).setStrokeStyle(3.2 - i * 0.45, i === 1 ? p.core : p.accent, 0.78 - i * 0.1).setBlendMode(Phaser.BlendModes.ADD)));
  const lance = options.scene.add.polygon(92, 0, [-28,-8,13,-10,50,-3,66,0,50,3,13,10,-28,8,-40,0], p.dark, 0.98).setStrokeStyle(3, p.main, 0.98);
  const lanceCore = options.scene.add.rectangle(96, 0, 88, 4.5, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, rings, core, eye, lance, lanceCore]);
  (root as any).__enchanterRings = rings;
  return root;
}

async function impact(options: Options, tier: Combat2169EnchanterTier, p: Palette): Promise<void> {
  const size = tier === 'ultimate' ? 88 : tier === 'skill' ? 62 : 42;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 11);
  const ring = options.scene.add.circle(0, 0, size, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.88);
  const hex = options.scene.add.polygon(0, 0, [0,-size*0.62,size*0.54,-size*0.3,size*0.54,size*0.3,0,size*0.62,-size*0.54,size*0.3,-size*0.54,-size*0.3], p.dark, 0.08).setStrokeStyle(2.4, p.accent, 0.75);
  const flash = options.scene.add.circle(0, 0, size * 0.26, p.core, 0.22).setBlendMode(Phaser.BlendModes.ADD);
  root.add([flash, ring, hex]);
  try { await tween(options.scene, root, { scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: tier === 'ultimate' ? 245 : 175, ease: 'Quad.easeOut' }, 460); }
  finally { root.destroy(true); }
}

export async function playCombat2169EnchanterDistinctTierVfx(options: Options, tier: Combat2169EnchanterTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const root = tier === 'ultimate' ? ultimate(options, p) : tier === 'skill' ? skill(options, p) : normal(options, p);
  const ms = travelMs(options, tier);
  const rings = (root as any).__enchanterRings as Phaser.GameObjects.Container | undefined;
  try {
    const jobs: Promise<void>[] = [tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: tier === 'ultimate' ? 'Cubic.easeIn' : 'Quad.easeInOut' }, ms + 280)];
    if (rings && !options.reducedMotion) jobs.push(tween(options.scene, rings, { angle: 120, duration: ms, ease: 'Linear' }, ms + 280));
    await Promise.all(jobs);
  } finally { root.destroy(true); }
  await impact(options, tier, p);
}

(globalThis as any).POWDER_COMBAT2_ENCHANTER_DISTINCT_TIERS = {
  version: COMBAT2169_ENCHANTER_VERSION,
  role: 'enchanter',
  realCombatReady: true,
  tiers: { normal: 'hex-needle', skill: 'binding-twin-sigil', ultimate: 'abyssal-seal-lance' },
  sourceToTarget: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
