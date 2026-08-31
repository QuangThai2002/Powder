import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2167_FIGHTER_VERSION = '2.16.7';
export type Combat2167FighterTier = 'normal' | 'skill' | 'ultimate';
type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff7048, core: 0xffe1b8, dark: 0x6b281d }, lava: { main: 0xf25635, core: 0xffcf62, dark: 0x612118 },
  water: { main: 0x47b7dc, core: 0xe8fbff, dark: 0x18566f }, ice: { main: 0x83d9ef, core: 0xffffff, dark: 0x327283 },
  lightning: { main: 0xe8cf58, core: 0xfffee0, dark: 0x756215 }, storm: { main: 0x728fce, core: 0xf0f4ff, dark: 0x3a4b70 },
  wind: { main: 0x61cfbd, core: 0xf0fffb, dark: 0x27665e }, leaf: { main: 0x6ac77a, core: 0xf0ffe9, dark: 0x315e39 },
  poison: { main: 0x99c95f, core: 0xf5ffd8, dark: 0x4a6429 }, earth: { main: 0xb68555, core: 0xffe5c1, dark: 0x5d452f },
  steel: { main: 0xbccbd3, core: 0xffffff, dark: 0x53636b }, light: { main: 0xe8d392, core: 0xfffff2, dark: 0x7d7041 },
  dark: { main: 0x9477c6, core: 0xf3ecff, dark: 0x49365f }, neutral: { main: 0x91c2cc, core: 0xfbffff, dark: 0x3f5b62 }
});

export function isCombat2167FighterRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('dau si') || value.includes('fighter') || value.includes('brawler');
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

function travelMs(options: Options, tier: Combat2167FighterTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 360 : tier === 'skill' ? 310 : 250;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.035, base, base + 75));
}

function makeRoot(options: Options, depth: number): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  return options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + depth).setRotation(angle);
}

function normal(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 6);
  const wake = options.scene.add.triangle(-24, 0, -42, -14, -42, 14, 12, 0, p.main, 0.12).setBlendMode(Phaser.BlendModes.ADD);
  const fist = options.scene.add.polygon(7, 0, [-24,-11,-10,-19,9,-16,27,-6,34,0,27,6,9,16,-10,19,-24,11,-31,0], p.dark, 0.98).setStrokeStyle(2.5, p.main, 0.95);
  const knuckle = options.scene.add.rectangle(13, 0, 34, 8, p.main, 0.9);
  const core = options.scene.add.rectangle(-1, 0, 25, 3, p.core, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  root.add([wake, fist, knuckle, core]);
  return root;
}

function skill(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 7);
  const aura = options.scene.add.ellipse(-8, 0, 128, 58, p.main, 0.08).setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.polygon(8, 0, [-38,-14,-18,-25,14,-20,46,-7,57,0,46,7,14,20,-18,25,-38,14,-48,0], p.dark, 0.98).setStrokeStyle(3, p.main, 0.98);
  const strikeA = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  strikeA.lineStyle(5, p.main, 0.78); strikeA.lineBetween(-44, -27, 39, 16);
  const strikeB = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  strikeB.lineStyle(4, p.core, 0.72); strikeB.lineBetween(-32, 29, 48, -13);
  const hot = options.scene.add.circle(48, 0, 7, p.core, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, strikeA, strikeB, core, hot]);
  return root;
}

function ultimate(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = makeRoot(options, 9);
  const aura = options.scene.add.ellipse(-18, 0, 220, 92, p.main, 0.12).setBlendMode(Phaser.BlendModes.ADD);
  const breaker = options.scene.add.polygon(5, 0, [-76,-23,-45,-36,10,-30,62,-13,91,-4,104,0,91,4,62,13,10,30,-45,36,-76,23,-92,0], p.dark, 0.99).setStrokeStyle(4, p.main, 1);
  const core = options.scene.add.rectangle(6, 0, 142, 8, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  const upper = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  upper.lineStyle(6, p.main, 0.68); upper.lineBetween(-73, -42, 74, -17);
  const lower = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  lower.lineStyle(5, p.core, 0.62); lower.lineBetween(-73, 42, 78, 17);
  const shock = options.scene.add.triangle(119, 0, -24, -38, -24, 38, 34, 0, p.main, 0.2).setBlendMode(Phaser.BlendModes.ADD);
  const bands = options.scene.add.container(-62, 0);
  [-32, -6, 20].forEach((x, i) => bands.add(options.scene.add.ellipse(x, 0, 11 + i * 3, 56 + i * 12, 0x000000, 0).setStrokeStyle(3 - i * 0.4, i % 2 ? p.core : p.main, 0.68).setBlendMode(Phaser.BlendModes.ADD)));
  root.add([aura, bands, breaker, upper, lower, core, shock]);
  (root as any).__fighterBands = bands;
  return root;
}

async function impact(options: Options, tier: Combat2167FighterTier, p: Palette): Promise<void> {
  const size = tier === 'ultimate' ? 78 : tier === 'skill' ? 54 : 38;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 11);
  const ring = options.scene.add.circle(0, 0, size, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.9);
  const slashA = options.scene.add.graphics(); slashA.lineStyle(tier === 'ultimate' ? 7 : 4, p.core, 0.86); slashA.lineBetween(-size * 0.75, -size * 0.45, size * 0.7, size * 0.38);
  const slashB = options.scene.add.graphics(); slashB.lineStyle(tier === 'ultimate' ? 6 : 3, p.main, 0.78); slashB.lineBetween(-size * 0.65, size * 0.48, size * 0.72, -size * 0.36);
  const flash = options.scene.add.circle(0, 0, size * 0.3, p.core, 0.22).setBlendMode(Phaser.BlendModes.ADD);
  root.add([flash, ring, slashA, slashB]);
  try { await tween(options.scene, root, { scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: tier === 'ultimate' ? 230 : 165, ease: 'Quad.easeOut' }, 430); }
  finally { root.destroy(true); }
}

export async function playCombat2167FighterDistinctTierVfx(options: Options, tier: Combat2167FighterTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const root = tier === 'ultimate' ? ultimate(options, p) : tier === 'skill' ? skill(options, p) : normal(options, p);
  const ms = travelMs(options, tier);
  const bands = (root as any).__fighterBands as Phaser.GameObjects.Container | undefined;
  try {
    const jobs: Promise<void>[] = [tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: tier === 'ultimate' ? 'Cubic.easeIn' : 'Quad.easeInOut' }, ms + 260)];
    if (bands && !options.reducedMotion) jobs.push(tween(options.scene, bands, { angle: 90, duration: ms, ease: 'Linear' }, ms + 260));
    await Promise.all(jobs);
  } finally { root.destroy(true); }
  await impact(options, tier, p);
}

(globalThis as any).POWDER_COMBAT2_FIGHTER_DISTINCT_TIERS = {
  version: COMBAT2167_FIGHTER_VERSION,
  role: 'fighter',
  realCombatReady: true,
  tiers: { normal: 'impact-fist', skill: 'cross-break-rush', ultimate: 'meteor-breaker-drive' },
  sourceToTarget: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
