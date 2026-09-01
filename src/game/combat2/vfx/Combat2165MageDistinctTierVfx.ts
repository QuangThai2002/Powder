import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2165_MAGE_VERSION = '2.17.5';
export type Combat2165MageTier = 'normal' | 'skill' | 'ultimate';
type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number; accent: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff744d, core: 0xffefbd, dark: 0x742816, accent: 0xffb26f },
  lava: { main: 0xff512f, core: 0xffd36a, dark: 0x671d12, accent: 0xff8d4f },
  water: { main: 0x45baff, core: 0xe9fbff, dark: 0x145c89, accent: 0x8ddeff },
  ice: { main: 0x8bdeff, core: 0xffffff, dark: 0x32778f, accent: 0xc6f2ff },
  lightning: { main: 0xf3dd62, core: 0xffffff, dark: 0x846613, accent: 0xffed8f },
  storm: { main: 0x7c9fff, core: 0xf5f6ff, dark: 0x3a4e8b, accent: 0xaebfff },
  wind: { main: 0x6fe4d3, core: 0xf4fffd, dark: 0x25776c, accent: 0xa4f5e9 },
  leaf: { main: 0x72d981, core: 0xf1ffe9, dark: 0x326b3a, accent: 0xa8efb0 },
  poison: { main: 0xa4df63, core: 0xf7ffd6, dark: 0x466d25, accent: 0xc9ef91 },
  earth: { main: 0xbb8e5e, core: 0xffe9c5, dark: 0x614832, accent: 0xdcb07a },
  steel: { main: 0xc5d7e2, core: 0xffffff, dark: 0x566b77, accent: 0xe2edf3 },
  light: { main: 0xffeca0, core: 0xffffff, dark: 0x9e873e, accent: 0xfff4c2 },
  dark: { main: 0xa68aef, core: 0xf5efff, dark: 0x49306c, accent: 0xcbb7ff },
  neutral: { main: 0x9bd9e8, core: 0xffffff, dark: 0x3d6e79, accent: 0xc5eef5 }
});

export function isCombat2165MageRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('phap su') || value.includes('mage');
}

function travelMs(options: Options, tier: Combat2165MageTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 430 : tier === 'skill' ? 360 : 300;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.035, base, base + 85));
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

function direction(options: Options): number {
  return Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
}

function makeNormal(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 6)
    .setRotation(direction(options));

  const trail = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  trail.lineStyle(3, p.main, 0.34);
  trail.lineBetween(-42, -4, -12, -2);
  trail.lineBetween(-42, 4, -12, 2);

  const shell = options.scene.add.circle(4, 0, 13, p.dark, 0.96).setStrokeStyle(2.5, p.main, 0.94);
  const core = options.scene.add.circle(4, 0, 6.5, p.core, 1).setBlendMode(Phaser.BlendModes.ADD);
  const rune = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  rune.lineStyle(2, p.accent, 0.78);
  rune.lineBetween(-5, -15, -5, 15);
  rune.lineBetween(-15, 0, 5, 0);

  root.add([trail, rune, shell, core]);
  return root;
}

function makeSkill(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 7)
    .setRotation(direction(options));

  const aura = options.scene.add.ellipse(-8, 0, 120, 52, p.main, 0.07)
    .setBlendMode(Phaser.BlendModes.ADD);

  const lance = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  lance.fillStyle(p.dark, 0.96);
  lance.fillTriangle(-30, -15, 58, 0, -30, 15);
  lance.fillStyle(p.main, 0.94);
  lance.fillTriangle(-18, -9, 54, 0, -18, 9);
  lance.lineStyle(2.5, p.core, 0.88);
  lance.lineBetween(-20, 0, 61, 0);

  const orbit = options.scene.add.container(-20, 0);
  const left = options.scene.add.circle(0, -22, 6.5, p.main, 0.95).setBlendMode(Phaser.BlendModes.ADD);
  const right = options.scene.add.circle(0, 22, 6.5, p.accent, 0.92).setBlendMode(Phaser.BlendModes.ADD);
  const orbitRing = options.scene.add.ellipse(0, 0, 42, 58, 0x000000, 0)
    .setStrokeStyle(2, p.main, 0.56)
    .setBlendMode(Phaser.BlendModes.ADD);
  orbit.add([orbitRing, left, right]);

  const tip = options.scene.add.circle(56, 0, 7, p.core, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, orbit, lance, tip]);
  (root as any).__mageSkillOrbit = orbit;
  return root;
}

function makeUltimate(options: Options, p: Palette): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 9)
    .setRotation(direction(options));

  const wake = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  wake.lineStyle(6, p.main, 0.24);
  wake.lineBetween(-118, -28, -42, -11);
  wake.lineBetween(-118, 28, -42, 11);
  wake.lineStyle(3, p.core, 0.32);
  wake.lineBetween(-100, -12, -30, -5);
  wake.lineBetween(-100, 12, -30, 5);

  const body = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  body.fillStyle(p.dark, 0.98);
  body.fillTriangle(-52, -28, 72, 0, -52, 28);
  body.fillStyle(p.main, 0.94);
  body.fillTriangle(-36, -18, 68, 0, -36, 18);

  const heart = options.scene.add.circle(43, 0, 14, p.core, 1).setBlendMode(Phaser.BlendModes.ADD);
  const halo = options.scene.add.ellipse(16, 0, 112, 68, p.main, 0.08)
    .setStrokeStyle(3, p.accent, 0.58)
    .setBlendMode(Phaser.BlendModes.ADD);

  const rings = options.scene.add.container(-25, 0);
  [-26, 0, 26].forEach((x, index) => {
    rings.add(
      options.scene.add.ellipse(x, 0, 15 + index * 4, 62 + index * 10, 0x000000, 0)
        .setStrokeStyle(3 - index * 0.35, index === 1 ? p.core : p.main, 0.72)
        .setBlendMode(Phaser.BlendModes.ADD)
    );
  });

  root.add([halo, wake, rings, body, heart]);
  (root as any).__mageUltimateRings = rings;
  return root;
}

async function normalImpact(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 11);
  const ring = options.scene.add.circle(0, 0, 24, 0x000000, 0)
    .setStrokeStyle(2.5, p.main, 0.82);
  const star = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  star.lineStyle(3, p.core, 0.72);
  star.lineBetween(-18, 0, 18, 0);
  star.lineBetween(0, -18, 0, 18);
  star.lineStyle(2, p.accent, 0.52);
  star.lineBetween(-12, -12, 12, 12);
  star.lineBetween(-12, 12, 12, -12);
  root.add([ring, star]);
  try {
    await tween(options.scene, root, { scaleX: 1.28, scaleY: 1.28, alpha: 0, duration: 115, ease: 'Quad.easeOut' }, 300);
  } finally {
    root.destroy(true);
  }
}

async function skillImpact(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 12);
  const outer = options.scene.add.ellipse(0, 0, 86, 54, 0x000000, 0)
    .setStrokeStyle(3, p.main, 0.88)
    .setBlendMode(Phaser.BlendModes.ADD);
  const inner = options.scene.add.ellipse(0, 0, 48, 76, 0x000000, 0)
    .setStrokeStyle(2.5, p.accent, 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);
  const rune = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  rune.lineStyle(4, p.core, 0.78);
  rune.lineBetween(-36, 0, 36, 0);
  rune.lineBetween(0, -30, 0, 30);
  rune.lineStyle(2.5, p.main, 0.68);
  rune.lineBetween(-25, -20, 25, 20);
  rune.lineBetween(-25, 20, 25, -20);
  const flash = options.scene.add.circle(0, 0, 12, p.core, 0.34).setBlendMode(Phaser.BlendModes.ADD);
  root.add([outer, inner, rune, flash]);
  try {
    await tween(options.scene, root, { scaleX: 1.48, scaleY: 1.48, alpha: 0, duration: 175, ease: 'Quad.easeOut' }, 380);
  } finally {
    root.destroy(true);
  }
}

async function ultimateImpact(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 13);

  const outer = options.scene.add.circle(0, 0, 76, 0x000000, 0)
    .setStrokeStyle(5, p.main, 0.88)
    .setBlendMode(Phaser.BlendModes.ADD);
  const middle = options.scene.add.circle(0, 0, 52, 0x000000, 0)
    .setStrokeStyle(3, p.accent, 0.8)
    .setBlendMode(Phaser.BlendModes.ADD);
  const inner = options.scene.add.circle(0, 0, 28, p.main, 0.12)
    .setStrokeStyle(3, p.core, 0.9)
    .setBlendMode(Phaser.BlendModes.ADD);

  const seal = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    seal.lineStyle(index % 2 === 0 ? 5 : 3, index % 2 === 0 ? p.core : p.main, 0.72);
    seal.lineBetween(
      Math.cos(angle) * 24,
      Math.sin(angle) * 24,
      Math.cos(angle) * 94,
      Math.sin(angle) * 94
    );
  }

  const core = options.scene.add.circle(0, 0, 14, p.core, 0.52).setBlendMode(Phaser.BlendModes.ADD);
  root.add([outer, middle, inner, seal, core]);
  try {
    await tween(options.scene, root, { scaleX: 1.72, scaleY: 1.72, alpha: 0, duration: 245, ease: 'Cubic.easeOut' }, 480);
  } finally {
    root.destroy(true);
  }
}

async function playImpact(options: Options, tier: Combat2165MageTier, p: Palette): Promise<void> {
  if (tier === 'ultimate') return ultimateImpact(options, p);
  if (tier === 'skill') return skillImpact(options, p);
  return normalImpact(options, p);
}

export async function playCombat2165MageDistinctTierVfx(options: Options, tier: Combat2165MageTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  const root = tier === 'ultimate'
    ? makeUltimate(options, p)
    : tier === 'skill'
      ? makeSkill(options, p)
      : makeNormal(options, p);
  const travel = travelMs(options, tier);
  const spinTarget = (root as any).__mageSkillOrbit ?? (root as any).__mageUltimateRings;

  try {
    const tasks: Promise<void>[] = [
      tween(options.scene, root, {
        x: options.target.x,
        y: options.target.y,
        duration: travel,
        ease: tier === 'ultimate' ? 'Cubic.easeIn' : tier === 'skill' ? 'Quad.easeInOut' : 'Sine.easeInOut'
      }, travel + 280)
    ];

    if (spinTarget && !options.reducedMotion) {
      tasks.push(
        tween(options.scene, spinTarget, {
          angle: tier === 'ultimate' ? 165 : 240,
          duration: travel,
          ease: 'Linear'
        }, travel + 280)
      );
    }

    await Promise.all(tasks);
  } finally {
    root.destroy(true);
  }

  await playImpact(options, tier, p);
}

(globalThis as any).POWDER_COMBAT2_MAGE_DISTINCT_TIERS = {
  version: COMBAT2165_MAGE_VERSION,
  role: 'mage',
  handcrafted: true,
  genericTemplate: false,
  realCombatReady: true,
  sourceToTarget: true,
  tiers: {
    normal: 'arcane-bolt',
    skill: 'twin-rune-lance',
    ultimate: 'astral-comet-grand-seal'
  },
  tierIdentityRule: 'normal-skill-ultimate-have-distinct-silhouette-travel-and-impact',
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
