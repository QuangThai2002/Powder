import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2166_TANK_VERSION = '2.16.6';
export type Combat2166TankTier = 'normal' | 'skill' | 'ultimate';
type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xe96d49, core: 0xffddb0, dark: 0x67291c }, lava: { main: 0xe45132, core: 0xffc75d, dark: 0x5f2117 },
  water: { main: 0x4aaad1, core: 0xdff8ff, dark: 0x1c5069 }, ice: { main: 0x86cee7, core: 0xf8ffff, dark: 0x356c7d },
  lightning: { main: 0xd7c45d, core: 0xfffbd2, dark: 0x70621b }, storm: { main: 0x718bbf, core: 0xebf0ff, dark: 0x394866 },
  wind: { main: 0x65bfb4, core: 0xeafffb, dark: 0x2b625c }, leaf: { main: 0x69b979, core: 0xecffe9, dark: 0x345c3b },
  poison: { main: 0x91bd5d, core: 0xf0ffd4, dark: 0x4b5f2c }, earth: { main: 0xa77d55, core: 0xffdfba, dark: 0x5b4431 },
  steel: { main: 0xaebfc9, core: 0xf8ffff, dark: 0x515f67 }, light: { main: 0xdccb8f, core: 0xffffef, dark: 0x7b7041 },
  dark: { main: 0x876eae, core: 0xeee7ff, dark: 0x433653 }, neutral: { main: 0x8eb7c2, core: 0xf7ffff, dark: 0x40575e }
});

export function isCombat2166TankRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('do don') || value.includes('tank');
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

function travelMs(options: Options, tier: Combat2166TankTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 455 : tier === 'skill' ? 380 : 315;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.04, base, base + 90));
}

function normal(options: Options, p: Palette): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 6).setRotation(angle);
  const wake = options.scene.add.rectangle(-28, 0, 56, 8, p.main, 0.16).setBlendMode(Phaser.BlendModes.ADD);
  const plate = options.scene.add.polygon(0, 0, [-30,-18, 8,-22, 32,0, 8,22, -30,18, -18,0], p.dark, 0.97).setStrokeStyle(2.5, p.main, 0.94);
  const face = options.scene.add.polygon(5, 0, [-19,-12, 7,-15, 23,0, 7,15, -19,12, -10,0], p.main, 0.9);
  const core = options.scene.add.rectangle(0, 0, 28, 4, p.core, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  root.add([wake, plate, face, core]);
  return root;
}

function skill(options: Options, p: Palette): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 7).setRotation(angle);
  const aura = options.scene.add.ellipse(-8, 0, 128, 72, p.main, 0.09).setBlendMode(Phaser.BlendModes.ADD);
  const center = options.scene.add.polygon(0, 0, [-42,-24, 12,-29, 48,0, 12,29, -42,24, -24,0], p.dark, 0.98).setStrokeStyle(3, p.main, 0.98);
  const face = options.scene.add.polygon(4, 0, [-28,-16, 10,-19, 36,0, 10,19, -28,16, -15,0], p.main, 0.92);
  const upper = options.scene.add.polygon(-7, -34, [-28,-7, 15,-9, 32,0, 15,9, -28,7], p.main, 0.62).setStrokeStyle(1.5, p.core, 0.72);
  const lower = options.scene.add.polygon(-7, 34, [-28,-7, 15,-9, 32,0, 15,9, -28,7], p.main, 0.62).setStrokeStyle(1.5, p.core, 0.72);
  const braces = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  braces.lineStyle(2, p.core, 0.55); braces.lineBetween(-18, -26, -18, 26); braces.lineBetween(8, -30, 8, 30);
  root.add([aura, upper, lower, center, face, braces]);
  return root;
}

function ultimate(options: Options, p: Palette): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 9).setRotation(angle);
  const aura = options.scene.add.ellipse(-22, 0, 235, 112, p.main, 0.13).setBlendMode(Phaser.BlendModes.ADD);
  const ram = options.scene.add.polygon(0, 0, [-82,-34, 18,-39, 86,-11, 106,0, 86,11, 18,39, -82,34, -54,0], p.dark, 0.99).setStrokeStyle(4, p.main, 1);
  const armor = options.scene.add.polygon(7, 0, [-61,-23, 19,-27, 77,-8, 91,0, 77,8, 19,27, -61,23, -39,0], p.main, 0.94);
  const core = options.scene.add.rectangle(5, 0, 130, 8, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  const rings = options.scene.add.container(-68, 0);
  [-28, 0, 28].forEach((x, i) => rings.add(options.scene.add.ellipse(x, 0, 13 + i * 2, 74 + i * 12, 0x000000, 0).setStrokeStyle(3-i*0.4, i % 2 ? p.core : p.main, 0.7).setBlendMode(Phaser.BlendModes.ADD)));
  const wedge = options.scene.add.triangle(119, 0, -22, -34, -22, 34, 28, 0, p.main, 0.22).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, rings, ram, armor, core, wedge]);
  (root as any).__tankRings = rings;
  return root;
}

async function impact(options: Options, tier: Combat2166TankTier, p: Palette): Promise<void> {
  const size = tier === 'ultimate' ? 74 : tier === 'skill' ? 52 : 35;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 10);
  const disk = options.scene.add.circle(0, 0, size * 0.42, p.main, tier === 'ultimate' ? 0.28 : 0.2).setBlendMode(Phaser.BlendModes.ADD);
  const ring = options.scene.add.circle(0, 0, size, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.9);
  const cross = options.scene.add.graphics(); cross.lineStyle(tier === 'ultimate' ? 5 : 3, p.core, 0.78); cross.lineBetween(-size * 0.75, 0, size * 0.75, 0); cross.lineBetween(0, -size * 0.55, 0, size * 0.55);
  root.add([disk, ring, cross]);
  try { await tween(options.scene, root, { scaleX: 1.45, scaleY: 1.45, alpha: 0, duration: tier === 'ultimate' ? 235 : 170, ease: 'Quad.easeOut' }, 440); }
  finally { root.destroy(true); }
}

export async function playCombat2166TankDistinctTierVfx(options: Options, tier: Combat2166TankTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const root = tier === 'ultimate' ? ultimate(options, p) : tier === 'skill' ? skill(options, p) : normal(options, p);
  const ms = travelMs(options, tier);
  const rings = (root as any).__tankRings as Phaser.GameObjects.Container | undefined;
  try {
    const jobs: Promise<void>[] = [tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: tier === 'ultimate' ? 'Quad.easeIn' : 'Sine.easeInOut' }, ms + 280)];
    if (rings && !options.reducedMotion) jobs.push(tween(options.scene, rings, { angle: 115, duration: ms, ease: 'Linear' }, ms + 280));
    await Promise.all(jobs);
  } finally { root.destroy(true); }
  await impact(options, tier, p);
}

(globalThis as any).POWDER_COMBAT2_TANK_DISTINCT_TIERS = {
  version: COMBAT2166_TANK_VERSION,
  role: 'tank',
  realCombatReady: true,
  tiers: { normal: 'guard-plate-ram', skill: 'tri-plate-bulwark-charge', ultimate: 'fortress-breaker-ram' },
  sourceToTarget: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
