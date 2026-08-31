import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2165_MAGE_VERSION = '2.16.5';
export type Combat2165MageTier = 'normal' | 'skill' | 'ultimate';
type Options = DirectionalProjectileOptions & { role?: string };

type Palette = { main: number; core: number; dark: number };
const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff744d, core: 0xffefbd, dark: 0x742816 }, lava: { main: 0xff512f, core: 0xffd36a, dark: 0x671d12 },
  water: { main: 0x45baff, core: 0xe9fbff, dark: 0x145c89 }, ice: { main: 0x8bdeff, core: 0xffffff, dark: 0x32778f },
  lightning: { main: 0xf3dd62, core: 0xffffff, dark: 0x846613 }, storm: { main: 0x7c9fff, core: 0xf5f6ff, dark: 0x3a4e8b },
  wind: { main: 0x6fe4d3, core: 0xf4fffd, dark: 0x25776c }, leaf: { main: 0x72d981, core: 0xf1ffe9, dark: 0x326b3a },
  poison: { main: 0xa4df63, core: 0xf7ffd6, dark: 0x466d25 }, earth: { main: 0xbb8e5e, core: 0xffe9c5, dark: 0x614832 },
  steel: { main: 0xc5d7e2, core: 0xffffff, dark: 0x566b77 }, light: { main: 0xffeca0, core: 0xffffff, dark: 0x9e873e },
  dark: { main: 0xa68aef, core: 0xf5efff, dark: 0x49306c }, neutral: { main: 0x9bd9e8, core: 0xffffff, dark: 0x3d6e79 }
});

export function isCombat2165MageRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('phap su') || value.includes('mage');
}

function duration(options: Options, tier: Combat2165MageTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 430 : tier === 'skill' ? 360 : 300;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.035, base, base + 85));
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

function makeNormal(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 6);
  const halo = options.scene.add.circle(0, 0, 23, p.main, 0.13).setBlendMode(Phaser.BlendModes.ADD);
  const shell = options.scene.add.circle(0, 0, 15, p.dark, 0.92).setStrokeStyle(2, p.main, 0.92);
  const core = options.scene.add.circle(0, 0, 8, p.core, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  const rune = options.scene.add.ellipse(0, 0, 40, 15, 0x000000, 0).setStrokeStyle(2, p.main, 0.72).setRotation(-0.38);
  root.add([halo, rune, shell, core]);
  return root;
}

function makeSkill(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 7);
  const aura = options.scene.add.circle(0, 0, 32, p.main, 0.12).setBlendMode(Phaser.BlendModes.ADD);
  const outer = options.scene.add.circle(0, 0, 22, p.dark, 0.94).setStrokeStyle(3, p.main, 0.95);
  const core = options.scene.add.circle(0, 0, 10, p.core, 1).setBlendMode(Phaser.BlendModes.ADD);
  const orbit = options.scene.add.container(0, 0);
  orbit.add([
    options.scene.add.circle(-28, 0, 6, p.main, 0.95).setBlendMode(Phaser.BlendModes.ADD),
    options.scene.add.circle(28, 0, 6, p.core, 0.9).setBlendMode(Phaser.BlendModes.ADD),
    options.scene.add.ellipse(0, 0, 68, 24, 0x000000, 0).setStrokeStyle(2, p.main, 0.7)
  ]);
  const forward = options.scene.add.triangle(30, 0, -10, -9, -10, 9, 14, 0, p.main, 0.75).setRotation(Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x));
  root.add([aura, orbit, outer, core, forward]);
  (root as any).__mageOrbit = orbit;
  return root;
}

function makeUltimate(options: Options, p: Palette): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 9).setRotation(angle);
  const aura = options.scene.add.ellipse(-18, 0, 150, 74, p.main, 0.13).setBlendMode(Phaser.BlendModes.ADD);
  const comet = options.scene.add.graphics();
  comet.fillStyle(p.dark, 0.96); comet.fillTriangle(-58, -22, 62, 0, -58, 22);
  comet.fillStyle(p.main, 0.96); comet.fillTriangle(-46, -14, 58, 0, -46, 14);
  const core = options.scene.add.circle(35, 0, 13, p.core, 1).setBlendMode(Phaser.BlendModes.ADD);
  const rings = options.scene.add.container(-28, 0);
  [-24, 0, 24].forEach((x, i) => rings.add(options.scene.add.ellipse(x, 0, 12 + i * 3, 56 + i * 8, 0x000000, 0).setStrokeStyle(2.5, i % 2 ? p.core : p.main, 0.72).setBlendMode(Phaser.BlendModes.ADD)));
  const wake = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  wake.lineStyle(4, p.main, 0.45); wake.lineBetween(-92, -16, -44, -7); wake.lineBetween(-92, 16, -44, 7);
  root.add([aura, rings, wake, comet, core]);
  (root as any).__mageRings = rings;
  return root;
}

async function impact(options: Options, tier: Combat2165MageTier, p: Palette): Promise<void> {
  const radius = tier === 'ultimate' ? 54 : tier === 'skill' ? 38 : 27;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 8);
  const disk = options.scene.add.circle(0, 0, radius * 0.55, p.main, tier === 'ultimate' ? 0.28 : 0.2).setBlendMode(Phaser.BlendModes.ADD);
  const ring1 = options.scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 4 : 3, p.main, 0.9);
  const ring2 = options.scene.add.circle(0, 0, radius * 0.62, 0x000000, 0).setStrokeStyle(2, p.core, 0.82);
  root.add([disk, ring1, ring2]);
  try { await tween(options.scene, root, { scaleX: 1.55, scaleY: 1.55, alpha: 0, duration: tier === 'ultimate' ? 220 : 160, ease: 'Quad.easeOut' }, 420); }
  finally { root.destroy(true); }
}

export async function playCombat2165MageDistinctTierVfx(options: Options, tier: Combat2165MageTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const root = tier === 'ultimate' ? makeUltimate(options, p) : tier === 'skill' ? makeSkill(options, p) : makeNormal(options, p);
  const travel = duration(options, tier);
  const spinTarget = (root as any).__mageOrbit ?? (root as any).__mageRings;
  try {
    const tasks: Promise<void>[] = [tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: travel, ease: tier === 'ultimate' ? 'Quad.easeIn' : 'Sine.easeInOut' }, travel + 280)];
    if (spinTarget && !options.reducedMotion) tasks.push(tween(options.scene, spinTarget, { angle: tier === 'ultimate' ? 150 : 220, duration: travel, ease: 'Linear' }, travel + 280));
    await Promise.all(tasks);
  } finally { root.destroy(true); }
  await impact(options, tier, p);
}

(globalThis as any).POWDER_COMBAT2_MAGE_DISTINCT_TIERS = {
  version: COMBAT2165_MAGE_VERSION,
  role: 'mage',
  realCombatReady: true,
  tiers: { normal: 'arcane-orb', skill: 'twin-orbit-orb', ultimate: 'arcane-comet' },
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
