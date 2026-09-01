import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2173_PROFESSION_IMPACT_VERSION = '2.17.3';
export const COMBAT2172_PROFESSION_IMPACT_VERSION = COMBAT2173_PROFESSION_IMPACT_VERSION;
export type Combat2172ProfessionTier = 'normal' | 'skill' | 'ultimate';
export type Combat2172ProfessionRole = 'mage' | 'tank' | 'fighter' | 'knight' | 'assassin' | 'enchanter' | 'healer';
export type Combat2172MeleeRole = 'tank' | 'fighter' | 'knight' | 'assassin';

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
  if (value.includes('sat thu') || value.includes('assassin')) return 'assassin';
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

function wait(scene: Phaser.Scene, duration: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let call: Phaser.Time.TimerEvent | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      try { call?.remove(false); } catch { /* cleanup only */ }
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, finish);
      scene.events.off(Phaser.Scenes.Events.DESTROY, finish);
      resolve();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);
    scene.events.once(Phaser.Scenes.Events.DESTROY, finish);
    call = scene.time.delayedCall(duration, finish);
  });
}

function shake(scene: Phaser.Scene, role: Combat2172ProfessionRole, tier: Combat2172ProfessionTier, reducedMotion: boolean): void {
  const camera = scene.cameras?.main;
  if (!camera) return;
  if (tier === 'ultimate') {
    const heavy = role === 'tank' || role === 'fighter' || role === 'knight';
    camera.shake(reducedMotion ? 72 : heavy ? 170 : role === 'assassin' ? 105 : 145, reducedMotion ? 0.0015 : heavy ? 0.0062 : role === 'assassin' ? 0.0038 : 0.0048, false);
    return;
  }
  if (tier === 'skill' && !reducedMotion) {
    const intensity = role === 'tank' || role === 'fighter' || role === 'knight' ? 0.0018 : role === 'assassin' ? 0.00135 : 0.0012;
    camera.shake(role === 'assassin' ? 58 : 76, intensity, false);
  }
}

function makeImpactBurst(options: Options, role: Combat2172ProfessionRole, tier: Combat2172ProfessionTier): Phaser.GameObjects.Container {
  const p = ELEMENT_PALETTE[options.element] ?? ELEMENT_PALETTE.neutral;
  const radius = tier === 'ultimate' ? 58 : tier === 'skill' ? 40 : 24;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 16);
  const flash = options.scene.add.circle(0, 0, radius * 0.56, p.core, tier === 'ultimate' ? 0.34 : tier === 'skill' ? 0.22 : 0.14).setBlendMode(Phaser.BlendModes.ADD);
  const ring = options.scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(tier === 'ultimate' ? 5 : tier === 'skill' ? 3.5 : 2, p.main, tier === 'normal' ? 0.66 : 0.94).setBlendMode(Phaser.BlendModes.ADD);
  const rays = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const rayCount = tier === 'ultimate' ? 8 : tier === 'skill' ? 5 : 3;
  for (let i = 0; i < rayCount; i += 1) {
    const angle = (Math.PI * 2 * i) / rayCount;
    const innerR = radius * 0.32;
    const outerR = radius * (tier === 'ultimate' ? 1.48 : tier === 'skill' ? 1.18 : 0.96);
    rays.lineStyle(tier === 'ultimate' ? 4 : tier === 'skill' ? 3 : 2, i % 2 ? p.core : p.main, tier === 'ultimate' ? 0.76 : tier === 'skill' ? 0.54 : 0.36);
    rays.lineBetween(Math.cos(angle) * innerR, Math.sin(angle) * innerR, Math.cos(angle) * outerR, Math.sin(angle) * outerR);
  }
  root.add([flash, rays, ring]);
  return root;
}

export async function playCombat2172ImpactFeedback(options: Options, role: Combat2172ProfessionRole, tier: Combat2172ProfessionTier): Promise<void> {
  shake(options.scene, role, tier, options.reducedMotion);
  const root = makeImpactBurst(options, role, tier);
  const duration = tier === 'ultimate' ? 230 : tier === 'skill' ? 165 : 105;
  root.setScale(tier === 'ultimate' ? 0.56 : tier === 'skill' ? 0.68 : 0.78);
  try {
    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.95 : tier === 'skill' ? 1.58 : 1.24,
      scaleY: tier === 'ultimate' ? 1.95 : tier === 'skill' ? 1.58 : 1.24,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut'
    }, duration + 220);
  } finally {
    root.destroy(true);
  }
}

function buildTankImpact(options: Options, tier: Combat2172ProfessionTier, p: Palette): Phaser.GameObjects.Container {
  const size = tier === 'ultimate' ? 78 : tier === 'skill' ? 60 : 42;
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 14);
  const plate = options.scene.add.polygon(0, 0, [
    -size * 0.58, -size * 0.48, size * 0.2, -size * 0.6, size * 0.62, 0,
    size * 0.2, size * 0.6, -size * 0.58, size * 0.48, -size * 0.34, 0
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
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 15).setRotation(angle);

  if (tier === 'normal') {
    const core = options.scene.add.circle(0, 0, 14, p.dark, 0.98).setStrokeStyle(4, p.core, 0.96);
    const knuckles = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    knuckles.lineStyle(5, p.core, 0.78);
    knuckles.lineBetween(3, -11, 13, -11);
    knuckles.lineBetween(3, 0, 15, 0);
    knuckles.lineBetween(3, 11, 13, 11);
    const drive = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    drive.lineStyle(3, p.main, 0.48);
    drive.lineBetween(-54, -7, -18, -3);
    drive.lineBetween(-54, 7, -18, 3);
    root.add([drive, core, knuckles]);
    return root;
  }

  if (tier === 'skill') {
    const compression = options.scene.add.ellipse(-12, 0, 108, 48, p.main, 0.05).setStrokeStyle(4, p.main, 0.62).setBlendMode(Phaser.BlendModes.ADD);
    const core = options.scene.add.circle(0, 0, 19, p.dark, 0.98).setStrokeStyle(5, p.core, 0.98);
    const knuckles = options.scene.add.container(9, 0);
    [-14, 0, 14].forEach((y) => knuckles.add(options.scene.add.circle(0, y, 6, p.core, 0.8).setBlendMode(Phaser.BlendModes.ADD)));
    const hookShock = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    hookShock.lineStyle(5, p.main, 0.62);
    hookShock.lineBetween(20, -24, 64, -10);
    hookShock.lineBetween(20, 24, 64, 10);
    root.add([compression, hookShock, core, knuckles]);
    return root;
  }

  const size = 108;
  const compression = options.scene.add.ellipse(-14, 0, 158, 72, p.main, 0.08).setStrokeStyle(6, p.main, 0.78).setBlendMode(Phaser.BlendModes.ADD);
  const punchCore = options.scene.add.circle(0, 0, 25, p.dark, 0.98).setStrokeStyle(6, p.core, 1);
  const knuckles = options.scene.add.container(10, 0);
  [-15, 0, 15].forEach((y) => knuckles.add(options.scene.add.circle(0, y, 8, p.core, 0.9).setBlendMode(Phaser.BlendModes.ADD)));
  const drive = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 5; i += 1) {
    const offset = (i - 2) * 12;
    drive.lineStyle(7, i % 2 ? p.core : p.main, 0.72);
    drive.lineBetween(-size * 0.92, offset, -size * 0.2, offset * 0.4);
  }
  const forwardShock = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  forwardShock.lineStyle(7, p.main, 0.7);
  forwardShock.lineBetween(24, -32, 88, -52);
  forwardShock.lineBetween(24, 32, 88, 52);
  forwardShock.lineStyle(4, p.core, 0.72);
  forwardShock.lineBetween(28, -16, 76, -24);
  forwardShock.lineBetween(28, 16, 76, 24);
  root.add([compression, drive, forwardShock, punchCore, knuckles]);
  return root;
}

function buildKnightImpact(options: Options, tier: Combat2172ProfessionTier, p: Palette): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 15);
  const slash = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

  if (tier === 'normal') {
    slash.lineStyle(8, p.main, 0.14);
    slash.lineBetween(-42, 32, 42, -32);
    slash.lineStyle(5, p.core, 0.96);
    slash.lineBetween(-42, 32, 42, -32);
    root.add(slash);
    return root;
  }

  if (tier === 'skill') {
    slash.lineStyle(12, p.main, 0.17);
    slash.lineBetween(-66, 46, 66, -46);
    slash.lineStyle(7, p.core, 0.98);
    slash.lineBetween(-66, 46, 66, -46);
    slash.lineStyle(3, p.main, 0.82);
    slash.lineBetween(-72, 54, 60, -38);
    const contact = options.scene.add.circle(0, 0, 11, p.core, 0.34).setBlendMode(Phaser.BlendModes.ADD);
    root.add([slash, contact]);
    return root;
  }

  slash.lineStyle(20, p.main, 0.21);
  slash.lineBetween(-94, 68, 94, -68);
  slash.lineStyle(11, p.core, 1);
  slash.lineBetween(-94, 68, 94, -68);
  slash.lineStyle(4, p.main, 0.98);
  slash.lineBetween(-102, 78, 86, -58);
  const shock = options.scene.add.ellipse(0, 0, 174, 82, 0x000000, 0).setStrokeStyle(5, p.main, 0.58);
  const contact = options.scene.add.circle(0, 0, 18, p.core, 0.46).setBlendMode(Phaser.BlendModes.ADD);
  root.add([shock, slash, contact]);
  return root;
}

function buildAssassinSlash(options: Options, tier: Combat2172ProfessionTier, p: Palette, hitIndex: 1 | 2): Phaser.GameObjects.Container {
  const root = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 17);
  const slash = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const direction = hitIndex === 1 ? 1 : -1;

  if (tier === 'normal') {
    const size = 58;
    slash.lineStyle(6, p.main, 0.12);
    slash.lineBetween(-size, direction * 38, size, -direction * 38);
    slash.lineStyle(3.5, p.core, 0.96);
    slash.lineBetween(-size, direction * 38, size, -direction * 38);
    const flash = options.scene.add.circle(0, 0, hitIndex === 2 ? 8 : 6, p.core, hitIndex === 2 ? 0.42 : 0.28).setBlendMode(Phaser.BlendModes.ADD);
    root.add([slash, flash]);
    return root;
  }

  if (tier === 'skill') {
    const size = 78;
    slash.lineStyle(9, p.main, 0.15);
    slash.lineBetween(-size, direction * 48, size, -direction * 48);
    slash.lineStyle(5, p.core, 1);
    slash.lineBetween(-size, direction * 48, size, -direction * 48);
    slash.lineStyle(2.5, p.main, 0.72);
    slash.lineBetween(-size - 6, direction * 56, size - 6, -direction * 40);
    const flash = options.scene.add.circle(0, 0, hitIndex === 2 ? 12 : 9, p.core, hitIndex === 2 ? 0.56 : 0.36).setBlendMode(Phaser.BlendModes.ADD);
    const edge = options.scene.add.circle(0, 0, 27, 0x000000, 0).setStrokeStyle(2, p.main, hitIndex === 2 ? 0.46 : 0.28);
    root.add([edge, slash, flash]);
    return root;
  }

  const size = 104;
  slash.lineStyle(14, p.main, 0.17);
  slash.lineBetween(-size, direction * 62, size, -direction * 62);
  slash.lineStyle(7, p.core, 1);
  slash.lineBetween(-size, direction * 62, size, -direction * 62);
  slash.lineStyle(3, p.main, 0.86);
  slash.lineBetween(-size - 9, direction * 72, size - 9, -direction * 52);
  const flash = options.scene.add.circle(0, 0, hitIndex === 2 ? 17 : 13, p.core, hitIndex === 2 ? 0.7 : 0.46).setBlendMode(Phaser.BlendModes.ADD);
  const edge = options.scene.add.circle(0, 0, hitIndex === 2 ? 46 : 36, 0x000000, 0).setStrokeStyle(hitIndex === 2 ? 4 : 3, p.main, hitIndex === 2 ? 0.7 : 0.44);
  root.add([edge, slash, flash]);
  return root;
}

async function playAssassinDoubleCriticalSlash(options: Options, tier: Combat2172ProfessionTier, p: Palette): Promise<void> {
  const duration = options.reducedMotion ? 52 : tier === 'ultimate' ? 86 : tier === 'skill' ? 72 : 58;
  const gap = options.reducedMotion ? 10 : tier === 'ultimate' ? 18 : tier === 'skill' ? 24 : 30;
  const camera = options.scene.cameras?.main;
  for (const hitIndex of [1, 2] as const) {
    const root = buildAssassinSlash(options, tier, p, hitIndex);
    root.setScale(tier === 'ultimate' ? (hitIndex === 2 ? 0.88 : 0.82) : tier === 'skill' ? 0.82 : 0.78);
    if (camera && !options.reducedMotion && tier !== 'normal') {
      const intensity = hitIndex === 2
        ? tier === 'ultimate' ? 0.0038 : 0.002
        : tier === 'ultimate' ? 0.0023 : 0.0013;
      camera.shake(hitIndex === 2 ? 72 : 46, intensity, false);
    }
    try {
      await tween(options.scene, root, {
        scaleX: hitIndex === 2 ? 1.3 : 1.18,
        scaleY: hitIndex === 2 ? 1.3 : 1.18,
        alpha: 0,
        duration,
        ease: 'Cubic.easeOut'
      }, duration + 180);
    } finally {
      root.destroy(true);
    }
    if (hitIndex === 1) await wait(options.scene, gap);
  }
}

export async function playCombat2172MeleeProfessionImpact(options: Options, role: Combat2172MeleeRole, tier: Combat2172ProfessionTier): Promise<void> {
  const p = ELEMENT_PALETTE[options.element] ?? ELEMENT_PALETTE.neutral;
  if (role === 'assassin') {
    await playAssassinDoubleCriticalSlash(options, tier, p);
    return;
  }

  const root = role === 'tank'
    ? buildTankImpact(options, tier, p)
    : role === 'fighter'
      ? buildFighterImpact(options, tier, p)
      : buildKnightImpact(options, tier, p);

  const duration = role === 'fighter'
    ? tier === 'ultimate' ? 285 : tier === 'skill' ? 195 : 125
    : role === 'knight'
      ? tier === 'ultimate' ? 250 : tier === 'skill' ? 175 : 115
      : tier === 'ultimate' ? 260 : tier === 'skill' ? 190 : 135;
  root.setScale(tier === 'ultimate' ? 0.72 : tier === 'skill' ? 0.82 : 0.88);
  try {
    await Promise.all([
      tween(options.scene, root, {
        scaleX: role === 'fighter' && tier === 'ultimate' ? 1.42 : tier === 'ultimate' ? 1.28 : tier === 'skill' ? 1.16 : 1.08,
        scaleY: role === 'fighter' && tier === 'ultimate' ? 1.42 : tier === 'ultimate' ? 1.28 : tier === 'skill' ? 1.16 : 1.08,
        alpha: 0,
        duration,
        ease: role === 'fighter' ? 'Cubic.easeOut' : tier === 'ultimate' ? 'Cubic.easeOut' : 'Quad.easeOut'
      }, duration + 250),
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
  version: COMBAT2173_PROFESSION_IMPACT_VERSION,
  meleeRoles: ['tank', 'fighter', 'knight', 'assassin'],
  rangedRoles: ['mage', 'enchanter', 'healer'],
  meleeProjectileTravel: false,
  tankIdentity: 'shield-bash-contact',
  fighterIdentity: { normal: 'compact-straight-punch', skill: 'compressed-power-punch', ultimate: 'full-drive-heavy-punch' },
  knightIdentity: { normal: 'short-heavy-slash', skill: 'extended-cleave-with-afterimage', ultimate: 'royal-execution-slash' },
  assassinIdentity: { normal: 'two-quick-cuts', skill: 'two-accelerated-afterimage-cuts', ultimate: 'two-critical-finisher-cuts' },
  assassinVisualHits: 2,
  assassinDamageHitsChanged: false,
  tierIdentityRule: 'normal-skill-ultimate-use-distinct-choreography-not-scale-only',
  ultimateCameraShake: true,
  skillImpactShake: true,
  normalImpactShake: false,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};