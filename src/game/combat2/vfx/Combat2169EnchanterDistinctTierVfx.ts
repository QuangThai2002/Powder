import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2181_ENCHANTER_VERSION = '2.18.1';
export const COMBAT2169_ENCHANTER_VERSION = COMBAT2181_ENCHANTER_VERSION;
export type Combat2169EnchanterTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xf08364, core: 0xfff0d2, dark: 0x6c3028, accent: 0xffba78 },
  lava: { main: 0xe86642, core: 0xffd86f, dark: 0x61281d, accent: 0xffa05a },
  water: { main: 0x59b9dd, core: 0xecfbff, dark: 0x1d5870, accent: 0x8eddf3 },
  ice: { main: 0x8cdef2, core: 0xffffff, dark: 0x337383, accent: 0xc2f2ff },
  lightning: { main: 0xe4d064, core: 0xffffe6, dark: 0x75651a, accent: 0xffeb8a },
  storm: { main: 0x7a90cb, core: 0xf5f7ff, dark: 0x3d4d72, accent: 0xa5b8eb },
  wind: { main: 0x68cdbd, core: 0xf1fffb, dark: 0x2b685f, accent: 0x98e9dc },
  leaf: { main: 0x76c982, core: 0xf1ffe9, dark: 0x345f3b, accent: 0xa7e8ad },
  poison: { main: 0x9fc769, core: 0xf8ffde, dark: 0x4f652f, accent: 0xcce993 },
  earth: { main: 0xb58b60, core: 0xffe8c9, dark: 0x5d4732, accent: 0xdbb17e },
  steel: { main: 0xc0ced6, core: 0xffffff, dark: 0x53646c, accent: 0xe6f0f4 },
  light: { main: 0xe9d79a, core: 0xfffff6, dark: 0x7b7149, accent: 0xffefb3 },
  dark: { main: 0x9a7dcb, core: 0xf6efff, dark: 0x4a3864, accent: 0xc0a5e8 },
  neutral: { main: 0x98c7cf, core: 0xfcffff, dark: 0x405d64, accent: 0xc6e9ee }
});

export function isCombat2169EnchanterRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('thuat si') || value.includes('thuat su') || value.includes('enchanter') || value.includes('warlock');
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
    try { tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish }); }
    catch { finish(); }
  });
}

function travelMs(options: Options, tier: Combat2169EnchanterTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 440 : tier === 'skill' ? 350 : 275;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 85));
}

function angle(options: Options): number {
  return Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
}

async function playHexNeedle(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 8)
    .setRotation(angle(options));
  const needle = options.scene.add.polygon(14, 0, [-24,-5,12,-7,40,-2,52,0,40,2,12,7,-24,5,-35,0], p.dark, 0.98)
    .setStrokeStyle(2.5, p.main, 0.96);
  const core = options.scene.add.rectangle(6, 0, 54, 3.5, p.core, 0.94).setBlendMode(Phaser.BlendModes.ADD);
  const sigil = options.scene.add.polygon(-24, 0, [0,-13,11,-6,13,7,0,14,-13,7,-11,-6], p.main, 0.12)
    .setStrokeStyle(2, p.accent, 0.75);
  root.add([sigil, needle, core]);
  const ms = travelMs(options, 'normal');
  try {
    await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Quad.easeInOut' }, ms + 260);
  } finally { root.destroy(true); }

  const hit = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 15);
  const mark = options.scene.add.polygon(0, 0, [0,-30,25,-14,29,16,0,32,-29,16,-25,-14], p.dark, 0.08).setStrokeStyle(3, p.main, 0.78);
  const flash = options.scene.add.circle(0, 0, 10, p.core, 0.3).setBlendMode(Phaser.BlendModes.ADD);
  hit.add([mark, flash]);
  try { await tween(options.scene, hit, { scaleX: 1.25, scaleY: 1.25, alpha: 0, duration: 135, ease: 'Quad.easeOut' }, 320); }
  finally { hit.destroy(true); }
}

async function playBindingSigilChain(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 9)
    .setRotation(angle(options));
  const front = options.scene.add.polygon(25, -15, [0,-18,15,-9,18,9,0,19,-18,9,-15,-9], p.dark, 0.96).setStrokeStyle(3, p.main, 0.96);
  const rear = options.scene.add.polygon(-2, 15, [0,-18,15,-9,18,9,0,19,-18,9,-15,-9], p.dark, 0.9).setStrokeStyle(3, p.accent, 0.88);
  const links = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  links.lineStyle(4, p.core, 0.72);
  links.lineBetween(-18, -8, 38, 8);
  links.lineStyle(3, p.main, 0.6);
  links.lineBetween(-17, 9, 39, -9);
  root.add([rear, links, front]);
  const ms = travelMs(options, 'skill');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Sine.easeInOut' }, ms + 270); }
  finally { root.destroy(true); }

  const cage = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 16);
  const ringA = options.scene.add.ellipse(0, 0, 104, 62, 0x000000, 0).setStrokeStyle(4, p.main, 0.82).setRotation(0.35);
  const ringB = options.scene.add.ellipse(0, 0, 104, 62, 0x000000, 0).setStrokeStyle(3, p.accent, 0.7).setRotation(-0.35);
  const seal = options.scene.add.polygon(0, 0, [0,-34,29,-17,33,18,0,36,-33,18,-29,-17], p.dark, 0.08).setStrokeStyle(3, p.core, 0.7);
  cage.add([ringA, ringB, seal]);
  try { await tween(options.scene, cage, { scaleX: 1.34, scaleY: 1.34, alpha: 0, duration: 185, ease: 'Cubic.easeOut' }, 390); }
  finally { cage.destroy(true); }
}

async function playAbyssalGrandSeal(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 11)
    .setRotation(angle(options));
  const eye = options.scene.add.ellipse(0, 0, 58, 27, p.dark, 0.98).setStrokeStyle(4, p.main, 1);
  const pupil = options.scene.add.circle(0, 0, 9, p.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  const outer = options.scene.add.ellipse(0, 0, 118, 78, 0x000000, 0).setStrokeStyle(4, p.accent, 0.72).setBlendMode(Phaser.BlendModes.ADD);
  const lance = options.scene.add.polygon(92, 0, [-38,-10,18,-12,62,-4,82,0,62,4,18,12,-38,10,-51,0], p.dark, 0.98).setStrokeStyle(4, p.main, 0.96);
  const ray = options.scene.add.rectangle(95, 0, 105, 6, p.core, 0.9).setBlendMode(Phaser.BlendModes.ADD);
  root.add([outer, eye, pupil, lance, ray]);
  const ms = travelMs(options, 'ultimate');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Cubic.easeIn' }, ms + 300); }
  finally { root.destroy(true); }

  const impact = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 18).setScale(0.58);
  const grand = options.scene.add.polygon(0, 0, [0,-76,66,-38,76,42,0,82,-76,42,-66,-38], p.dark, 0.08).setStrokeStyle(6, p.main, 0.9);
  const inner = options.scene.add.polygon(0, 0, [0,-46,40,-23,46,25,0,50,-46,25,-40,-23], p.dark, 0.1).setStrokeStyle(4, p.accent, 0.78);
  const flash = options.scene.add.circle(0, 0, 28, p.core, 0.35).setBlendMode(Phaser.BlendModes.ADD);
  impact.add([grand, inner, flash]);
  if (options.scene.cameras?.main) {
    options.scene.cameras.main.shake(options.reducedMotion ? 82 : 145, options.reducedMotion ? 0.0014 : 0.0044, false);
  }
  try { await tween(options.scene, impact, { scaleX: 1.55, scaleY: 1.55, alpha: 0, duration: options.reducedMotion ? 150 : 265, ease: 'Cubic.easeOut' }, 540); }
  finally { impact.destroy(true); }
}

export async function playCombat2169EnchanterDistinctTierVfx(options: Options, tier: Combat2169EnchanterTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  if (tier === 'ultimate') return playAbyssalGrandSeal(options, p);
  if (tier === 'skill') return playBindingSigilChain(options, p);
  return playHexNeedle(options, p);
}

(globalThis as any).POWDER_COMBAT2_ENCHANTER_DISTINCT_TIERS = {
  version: COMBAT2181_ENCHANTER_VERSION,
  role: 'enchanter',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'hex-needle',
    skill: 'binding-sigil-chain',
    ultimate: 'abyssal-grand-seal'
  },
  normalCameraShake: false,
  skillCameraShake: false,
  ultimateCameraShake: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
