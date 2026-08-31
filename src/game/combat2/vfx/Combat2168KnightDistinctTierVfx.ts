import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2168_KNIGHT_VERSION = '2.16.8';
export type Combat2168KnightTier = 'normal' | 'skill' | 'ultimate';
type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xf27b4f, core: 0xfff1c7, dark: 0x6d2f22, accent: 0xffb86b }, lava: { main: 0xe95d38, core: 0xffda72, dark: 0x61261b, accent: 0xff9b54 },
  water: { main: 0x55b9dc, core: 0xecfbff, dark: 0x1d5870, accent: 0x87d8ef }, ice: { main: 0x8bdcf0, core: 0xffffff, dark: 0x337383, accent: 0xbcefff },
  lightning: { main: 0xe5cf62, core: 0xffffe4, dark: 0x756418, accent: 0xffe986 }, storm: { main: 0x758fc9, core: 0xf3f5ff, dark: 0x3d4c70, accent: 0x9cb2e8 },
  wind: { main: 0x68cdbd, core: 0xf0fffb, dark: 0x2b685f, accent: 0x96e5d8 }, leaf: { main: 0x73c67e, core: 0xf1ffe9, dark: 0x345f3b, accent: 0xa2e3a7 },
  poison: { main: 0x9ac463, core: 0xf7ffdc, dark: 0x4d632c, accent: 0xc7e58e }, earth: { main: 0xb58a5c, core: 0xffe8c7, dark: 0x5d4732, accent: 0xd7ad79 },
  steel: { main: 0xbecdd4, core: 0xffffff, dark: 0x53646c, accent: 0xe4eef2 }, light: { main: 0xe8d695, core: 0xfffff4, dark: 0x7a7047, accent: 0xffecad },
  dark: { main: 0x947ac5, core: 0xf5efff, dark: 0x493861, accent: 0xb9a0e4 }, neutral: { main: 0x94c4cc, core: 0xfbffff, dark: 0x405c63, accent: 0xc0e4e9 }
});

export function isCombat2168KnightRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('hiep si') || value.includes('knight') || value.includes('paladin');
}

function tween(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject | object, config: Phaser.Types.Tweens.TweenBuilderConfig, fallbackMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let tw: Phaser.Tweens.Tween | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = () => { try { tw?.stop(); } catch { /* cleanup */ } finish(); };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try { tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish }); } catch { finish(); }
  });
}

function travelMs(options: Options, tier: Combat2168KnightTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 390 : tier === 'skill' ? 320 : 255;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 72));
}

function makeRoot(options: Options, depth: number): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  return options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + depth).setRotation(angle);
}

function normal(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 6);
  const wake = options.scene.add.triangle(-30, 0, -54, -11, -54, 11, 9, 0, p.main, 0.1).setBlendMode(Phaser.BlendModes.ADD);
  const blade = options.scene.add.polygon(9, 0, [-39,-5,15,-7,39,-3,52,0,39,3,15,7,-39,5,-50,0], p.dark, 0.98).setStrokeStyle(2.2, p.main, 0.94);
  const edge = options.scene.add.rectangle(5, -1, 72, 2.6, p.core, 0.94).setBlendMode(Phaser.BlendModes.ADD);
  const guard = options.scene.add.rectangle(-37, 0, 7, 25, p.accent, 0.9);
  const pommel = options.scene.add.circle(-48, 0, 4.5, p.core, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  root.add([wake, blade, edge, guard, pommel]);
  return root;
}

function skill(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 7);
  const aura = options.scene.add.ellipse(-6, 0, 154, 68, p.main, 0.075).setBlendMode(Phaser.BlendModes.ADD);
  const bladeA = options.scene.add.polygon(6, -10, [-49,-4,19,-6,53,-2,66,0,53,2,19,6,-49,4,-59,0], p.dark, 0.98).setStrokeStyle(2.8, p.main, 0.96);
  const bladeB = options.scene.add.polygon(1, 11, [-42,-4,22,-6,49,-2,61,0,49,2,22,6,-42,4,-52,0], p.dark, 0.93).setStrokeStyle(2.2, p.accent, 0.9);
  const cross = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  cross.lineStyle(4.2, p.core, 0.8); cross.lineBetween(-30, -29, 47, 27);
  cross.lineStyle(3.3, p.main, 0.72); cross.lineBetween(-31, 29, 50, -27);
  const crest = options.scene.add.circle(57, 0, 7, p.core, 0.9).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, bladeB, bladeA, cross, crest]);
  return root;
}

function ultimate(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 9);
  const aura = options.scene.add.ellipse(-18, 0, 250, 108, p.main, 0.115).setBlendMode(Phaser.BlendModes.ADD);
  const royal = options.scene.add.polygon(8, 0, [-92,-12,-60,-25,28,-20,86,-9,116,-3,132,0,116,3,86,9,28,20,-60,25,-92,12,-106,0], p.dark, 0.99).setStrokeStyle(3.8, p.main, 1);
  const core = options.scene.add.rectangle(12, 0, 177, 5.5, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  const fuller = options.scene.add.rectangle(-2, 0, 139, 13, p.main, 0.18).setBlendMode(Phaser.BlendModes.ADD);
  const guard = options.scene.add.polygon(-70, 0, [-10,-34,1,-25,11,-9,25,0,11,9,1,25,-10,34,-2,8,-19,0,-2,-8], p.accent, 0.85).setStrokeStyle(2.3, p.core, 0.72);
  const crown = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  crown.lineStyle(3, p.core, 0.66);
  crown.lineBetween(-48, -36, -23, -51); crown.lineBetween(-23, -51, 1, -35); crown.lineBetween(1, -35, 23, -50); crown.lineBetween(23, -50, 48, -34);
  const rings = options.scene.add.container(-75, 0);
  [-25, 0, 25].forEach((x, i) => rings.add(options.scene.add.ellipse(x, 0, 11 + i * 2, 62 + i * 10, 0x000000, 0).setStrokeStyle(2.8 - i * 0.35, i === 1 ? p.core : p.main, 0.68 - i * 0.08).setBlendMode(Phaser.BlendModes.ADD)));
  const tip = options.scene.add.circle(127, 0, 7, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, rings, crown, royal, fuller, guard, core, tip]);
  (root as any).__knightRings = rings;
  return root;
}

async function impact(options: Options, tier: Combat2168KnightTier, p: Palette): Promise<void> {
  const size = tier === 'ultimate' ? 84 : tier === 'skill' ? 58 : 40;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 11);
  const ring = options.scene.add.circle(0, 0, size, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.88);
  const vertical = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  vertical.lineStyle(tier === 'ultimate' ? 7 : 4, p.core, 0.82); vertical.lineBetween(0, -size * 0.82, 0, size * 0.82);
  const horizontal = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  horizontal.lineStyle(tier === 'ultimate' ? 5 : 3, p.accent, 0.74); horizontal.lineBetween(-size * 0.74, 0, size * 0.74, 0);
  const flash = options.scene.add.circle(0, 0, size * 0.3, p.core, 0.2).setBlendMode(Phaser.BlendModes.ADD);
  root.add([flash, ring, vertical, horizontal]);
  try { await tween(options.scene, root, { scaleX: 1.48, scaleY: 1.48, alpha: 0, duration: tier === 'ultimate' ? 235 : 170, ease: 'Quad.easeOut' }, 440); }
  finally { root.destroy(true); }
}

export async function playCombat2168KnightDistinctTierVfx(options: Options, tier: Combat2168KnightTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const root = tier === 'ultimate' ? ultimate(options, p) : tier === 'skill' ? skill(options, p) : normal(options, p);
  const ms = travelMs(options, tier);
  const rings = (root as any).__knightRings as Phaser.GameObjects.Container | undefined;
  try {
    const jobs: Promise<void>[] = [tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: tier === 'ultimate' ? 'Cubic.easeIn' : 'Quad.easeInOut' }, ms + 270)];
    if (rings && !options.reducedMotion) jobs.push(tween(options.scene, rings, { angle: 80, duration: ms, ease: 'Linear' }, ms + 270));
    await Promise.all(jobs);
  } finally { root.destroy(true); }
  await impact(options, tier, p);
}

(globalThis as any).POWDER_COMBAT2_KNIGHT_DISTINCT_TIERS = {
  version: COMBAT2168_KNIGHT_VERSION,
  role: 'knight',
  realCombatReady: true,
  tiers: { normal: 'valor-blade-thrust', skill: 'crossguard-double-cleave', ultimate: 'royal-judgment-greatblade' },
  sourceToTarget: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
