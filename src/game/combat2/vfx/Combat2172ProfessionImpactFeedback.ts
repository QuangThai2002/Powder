import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2172_PROFESSION_IMPACT_VERSION = '2.17.2';
export type Combat2172ProfessionTier = 'normal' | 'skill' | 'ultimate';
export type Combat2172ProfessionRole = 'mage' | 'tank' | 'fighter' | 'knight' | 'enchanter' | 'healer';
export type Combat2172MeleeRole = 'tank' | 'fighter' | 'knight';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number };

const ELEMENT_PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff7048, core: 0xffefd0, dark: 0x70291d },
  lava: { main: 0xf45735, core: 0xffd46d, dark: 0x642117 },
  water: { main: 0x50bde7, core: 0xf0fcff, dark: 0x185a73 },
  ice: { main: 0x8ee4f7, core: 0xffffff, dark: 0x347788 },
  lightning: { main: 0xead45f, core: 0xffffec, dark: 0x766317 },
  storm: { main: 0x7f99d8, core: 0xf5f7ff, dark: 0x3d4e76 },
  wind: { main: 0x68d5c4, core: 0xf3fffc, dark: 0x286b62 },
  leaf: { main: 0x72cf80, core: 0xf2ffeb, dark: 0x32623a },
  poison: { main: 0xa0cf66, core: 0xf8ffdd, dark: 0x4c672b },
  earth: { main: 0xb98b5b, core: 0xffe8c5, dark: 0x60462f },
  steel: { main: 0xc2d2da, core: 0xffffff, dark: 0x52646d },
  light: { main: 0xf1da90, core: 0xfffff4, dark: 0x7f7140 },
  dark: { main: 0x9e82d6, core: 0xf8f1ff, dark: 0x4c3866 },
  neutral: { main: 0x9bcbd4, core: 0xffffff, dark: 0x405e65 }
});

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function resolveCombat2172MeleeRole(role?: string): Combat2172MeleeRole | null {
  const value = normalize(role ?? '');
  if (value.includes('do don') || value.includes('tank')) return 'tank';
  if (value.includes('dau si') || value.includes('fighter') || value.includes('brawler')) return 'fighter';
  if (value.includes('hiep si') || value.includes('knight') || value.includes('paladin')) return 'knight';
  return null;
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

function shake(scene: Phaser.Scene, role: Combat2172ProfessionRole, tier: Combat2172ProfessionTier, reducedMotion: boolean): void {
  const camera = scene.cameras?.main;
  if (!camera) return;

  if (tier === 'ultimate') {
    const heavy = role === 'tank' || role === 'fighter' || role === 'knight';
    const duration = reducedMotion ? 72 : heavy ? 170 : 145;
    const intensity = reducedMotion ? 0.0015 : heavy ? 0.0062 : 0.0048;
    camera.shake(duration, intensity, false);
    return;
  }

  if (tier === 'skill' && !reducedMotion) camera.shake(76, role === 'tank' || role === 'fighter' || role === 'knight' ? 0.0018 : 0.0012, false);
}

function makeImpactBurst(options: Options, role: Combat2172ProfessionRole, tier: Combat2172ProfessionTier): Phaser.GameObjects.Container {
  const p = ELEMENT_PALETTE[options.element] ?? ELEMENT_PALETTE.neutral;
  const radius = tier === 'ultimate' ? 58 : tier === 'skill' ? 40 : 26;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 16);
  const flash = options.scene.add.circle(0, 0, radius * 0.58, p.core, tier === 'ultimate' ? 0.34 : 0.22).setBlendMode(Phaser.BlendModes.ADD);
  const ring = options.scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : tier === 'skill' ? 3.5 : 2.5, p.main, 0.94).setBlendMode(Phaser.BlendModes.ADD);
  const inner = options.scene.add.circle(0, 0, radius * 0.42, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 3 : 2, p.core, 0.8).setBlendMode(Phaser.BlendModes.ADD);
  const rays = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const rayCount = tier === 'ultimate' ? 8 : tier === 'skill' ? 6 : 4;
  for (let i = 0; i < rayCount; i += 1) {
    const angle = (Math.PI * 2 * i) / rayCount;
    const innerR = radius * 0.3;
    const outerR = radius * (tier === 'ultimate' ? 1.48 : 1.2);
    rays.lineStyle(tier === 'ultimate' ? 4 : 3, i % 2 ? p.core : p.main, tier === 'ultimate' ? 0.76 : 0.58);
    rays.lineBetween(Math.cos(angle) * innerR, Math.sin(angle) * innerR, Math.cos(angle) * outerR, Math.sin(angle) * outerR);
  }
  root.add([flash, rays, ring, inner]);
  return root;
}

export async function playCombat2172ImpactFeedback(
  options: Options,
  role: Combat2172ProfessionRole,
  tier: Combat2172ProfessionTier
): Promise<void> {
  shake(options.scene, role, tier, options.reducedMotion);
  const root = makeImpactBurst(options, role, tier);
  const duration = tier === 'ultimate' ? 230 : tier === 'skill' ? 165 : 120;
  root.setScale(tier === 'ultimate' ? 0.56 : 0.68);
  try {
    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.95 : tier === 'skill' ? 1.58 : 1.35,
      scaleY: tier === 'ultimate' ? 1.95 : tier === 'skill' ? 1.58 : 1.35,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut'
    }, duration + 240);
  } finally {
    root.destroy(true);
  }
}

function buildTankImpact(options: Options, tier: Combat2172ProfessionTier, p: Palette): Phaser.GameObjects.Container {
  const size = tier === 'ultimate' ? 78 : tier === 'skill' ? 60 : 42;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 14);
  const plate = options.scene.add.polygon(0, 0, [
    -size * 0.58, -size * 0.48,
    size * 0.2, -size * 0.6,
    size * 0.62, 0,
    size * 0.2, size * 0.6,
    -size * 0.58, size * 0.48,
    -size * 0.34, 0
  ], p.dark, 0.9).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.96);
  const core = options.scene.add.rectangle(0, 0, size * 0.85, tier === 'ultimate' ? 8 : 5, p.core, 0.86).setBlendMode(Phaser.BlendModes.ADD);
  const ground = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  ground.lineStyle(tier === 'ultimate' ? 6 : 4, p.main, 0.64);
  const lines = tier === 'ultimate' ? 5 : tier === 'skill' ? 3 : 2;
  for (let i = 0; i < lines; i += 1) {
    const y = (i - (lines - 1) / 2) * 16;
    ground.lineBetween(-size * 1.2, y, size * 1.25, y * 0.55);
  }
  root.add([ground, plate, core]);
  return root;
}

function buildFighterImpact(options: Options, tier: Combat2172ProfessionTier, p: Palette): Phaser.GameObjects.Container {
  const size = tier === 'ultimate' ? 88 : tier === 'skill' ? 62 : 40;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 14);
  const core = options.scene.add.circle(0, 0, tier === 'ultimate' ? 20 : 14, p.dark, 0.94).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.96);
  const burst = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const count = tier === 'ultimate' ? 10 : tier === 'skill' ? 6 : 4;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (i % 2 ? 0.08 : -0.08);
    const start = size * 0.24;
    const end = size * (i % 2 ? 1.05 : 0.82);
    burst.lineStyle(tier === 'ultimate' ? 7 : 4, i % 2 ? p.core : p.main, 0.84);
    burst.lineBetween(Math.cos(angle) * start, Math.sin(angle) * start, Math.cos(angle) * end, Math.sin(angle) * end);
  }
  const crater = options.scene.add.ellipse(0, size * 0.34, size * 1.7, size * 0.52, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.66);
  root.add([crater, burst, core]);
  return root;
}

function buildKnightImpact(options: Options, tier: Combat2172ProfessionTier, p: Palette): Phaser.GameObjects.Container {
  const size = tier === 'ultimate' ? 104 : tier === 'skill' ? 76 : 50;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 14);
  const slashes = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  slashes.lineStyle(tier === 'ultimate' ? 10 : tier === 'skill' ? 7 : 5, p.core, 0.92);
  slashes.lineBetween(-size * 0.68, size * 0.48, size * 0.68, -size * 0.48);
  if (tier !== 'normal') {
    slashes.lineStyle(tier === 'ultimate' ? 8 : 6, p.main, 0.82);
    slashes.lineBetween(-size * 0.58, -size * 0.5, size * 0.58, size * 0.5);
  }
  if (tier === 'ultimate') {
    slashes.lineStyle(6, p.main, 0.72);
    slashes.lineBetween(0, -size * 0.88, 0, size * 0.82);
  }
  const seal = options.scene.add.circle(0, 0, size * 0.4, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : 3, p.main, 0.74);
  const core = options.scene.add.circle(0, 0, tier === 'ultimate' ? 14 : 9, p.core, 0.74).setBlendMode(Phaser.BlendModes.ADD);
  root.add([seal, slashes, core]);
  return root;
}

export async function playCombat2172MeleeProfessionImpact(
  options: Options,
  role: Combat2172MeleeRole,
  tier: Combat2172ProfessionTier
): Promise<void> {
  const p = ELEMENT_PALETTE[options.element] ?? ELEMENT_PALETTE.neutral;
  const root = role === 'tank'
    ? buildTankImpact(options, tier, p)
    : role === 'fighter'
      ? buildFighterImpact(options, tier, p)
      : buildKnightImpact(options, tier, p);

  const duration = tier === 'ultimate' ? 260 : tier === 'skill' ? 190 : 135;
  root.setScale(tier === 'ultimate' ? 0.72 : 0.82);
  try {
    await Promise.all([
      tween(options.scene, root, {
        scaleX: tier === 'ultimate' ? 1.28 : 1.16,
        scaleY: tier === 'ultimate' ? 1.28 : 1.16,
        alpha: 0,
        duration,
        ease: tier === 'ultimate' ? 'Cubic.easeOut' : 'Quad.easeOut'
      }, duration + 260),
      playCombat2172ImpactFeedback(options, role, tier)
    ]);
  } finally {
    root.destroy(true);
  }
}

export function rangedImpactDelayMs(
  options: Options,
  role: Extract<Combat2172ProfessionRole, 'mage' | 'enchanter' | 'healer'>,
  tier: Combat2172ProfessionTier
): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  if (role === 'mage') {
    const base = tier === 'ultimate' ? 430 : tier === 'skill' ? 360 : 300;
    return Math.round(Phaser.Math.Clamp(base + distance * 0.035, base, base + 85));
  }
  if (role === 'enchanter') {
    const base = tier === 'ultimate' ? 420 : tier === 'skill' ? 335 : 260;
    return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 78));
  }
  const base = tier === 'ultimate' ? 430 : tier === 'skill' ? 340 : 265;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 82));
}

export function scheduleCombat2172RangedImpactFeedback(
  options: Options,
  role: Extract<Combat2172ProfessionRole, 'mage' | 'enchanter' | 'healer'>,
  tier: Combat2172ProfessionTier
): void {
  const delay = rangedImpactDelayMs(options, role, tier);
  options.scene.time.delayedCall(delay, () => {
    if (!options.scene.sys?.isActive?.()) return;
    void playCombat2172ImpactFeedback(options, role, tier);
  });
}

(globalThis as any).POWDER_COMBAT2_PROFESSION_IMPACT_2172 = {
  version: COMBAT2172_PROFESSION_IMPACT_VERSION,
  meleeRoles: ['tank', 'fighter', 'knight'],
  rangedRoles: ['mage', 'enchanter', 'healer'],
  meleeProjectileTravel: false,
  ultimateCameraShake: true,
  skillImpactShake: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
