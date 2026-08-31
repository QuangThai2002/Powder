import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2154TrajectoryAndMeleeVfxInstalled';
const PROJECTILE_DURATION_SCALE = 2.25;
const ASSASSIN_SCALE_VS_KNIGHT = 0.8;

type FxTier = 'full' | 'balanced' | 'lite';
type RoleKey = 'marksman' | 'mage' | 'enchanter' | 'healer' | 'musician' | 'fighter' | 'knight' | 'assassin' | 'tank' | 'fallback';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

type ElementProfile = { color: number; core: number };
const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff7043, core: 0xfff0b0 },
  lava: { color: 0xff4f2e, core: 0xffc04d },
  water: { color: 0x4db9ff, core: 0xd7f5ff },
  ice: { color: 0x8adfff, core: 0xf0fdff },
  lightning: { color: 0xf5dd62, core: 0xffffff },
  storm: { color: 0x78a9ff, core: 0xdce6ff },
  wind: { color: 0x76e4d2, core: 0xe8fffa },
  leaf: { color: 0x72d67f, core: 0xdfffd8 },
  poison: { color: 0xa5df66, core: 0xe5ffb8 },
  earth: { color: 0xb78c5d, core: 0xf2d6ae },
  steel: { color: 0xc3d3dc, core: 0xffffff },
  light: { color: 0xffefad, core: 0xffffff },
  dark: { color: 0xa88cf2, core: 0xeadfff },
  neutral: { color: 0x9ed8e8, core: 0xffffff }
});

const RANGED = new Set<RoleKey>(['marksman', 'mage', 'enchanter', 'healer', 'musician']);
const MELEE = new Set<RoleKey>(['fighter', 'knight', 'assassin']);

function normalize(value: string | undefined): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveRole(raw: string | undefined): RoleKey {
  const role = normalize(raw);
  if (role.includes('sat thu') || role.includes('assassin')) return 'assassin';
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('thuat si') || role.includes('enchanter')) return 'enchanter';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('dau si') || role.includes('fighter')) return 'fighter';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  return 'fallback';
}

function fxTier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function readableDuration(options: DirectionalProjectileOptions, current: FxTier): number {
  const requested = Number(options.durationMs || 0);
  const distance = Math.max(1, Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y));
  let base: number;
  if (current === 'lite') base = Phaser.Math.Clamp(requested > 0 ? requested : 195, 175, 215);
  else if (current === 'balanced') base = Phaser.Math.Clamp(requested > 0 ? requested : Math.round(225 + Math.min(35, distance * 0.035)), 215, 275);
  else base = Phaser.Math.Clamp(requested > 0 ? requested : Math.round(240 + Math.min(55, distance * 0.05)), 230, 310);
  return Math.round(base * PROJECTILE_DURATION_SCALE);
}

function waitScene(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, finish);
      scene.events.off(Phaser.Scenes.Events.DESTROY, finish);
      resolve();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);
    scene.events.once(Phaser.Scenes.Events.DESTROY, finish);
    try { scene.time.delayedCall(Math.max(0, ms), finish); } catch { finish(); }
  });
}

function tweenObject(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = () => {
      if (settled) return;
      try { tween?.stop(); } catch { /* teardown owns tween manager */ }
      finish();
    };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try { tween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish }); }
    catch { finish(); }
  });
}

async function playLuminousTrajectoryTrail(
  options: DirectionalProjectileOptions,
  durationMs: number,
  current: FxTier
): Promise<void> {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const reduced = Boolean(options.reducedMotion) || current === 'lite';
  const maxPoints = reduced ? 5 : current === 'balanced' ? 6 : 7;
  const g = scene.add.graphics().setDepth(powVfxDepth('foreground') + 1);
  const tracker = { p: 0 };
  const points: Array<{ x: number; y: number }> = [];

  const redraw = () => {
    const p = Phaser.Math.Clamp(tracker.p, 0, 1);
    const x = Phaser.Math.Linear(source.x, target.x, p);
    const y = Phaser.Math.Linear(source.y, target.y, p);
    const last = points[points.length - 1];
    if (!last || Phaser.Math.Distance.Between(last.x, last.y, x, y) >= 6) {
      points.push({ x, y });
      while (points.length > maxPoints) points.shift();
    }

    g.clear();
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const age = i / Math.max(1, points.length - 1);
      const outerAlpha = (reduced ? 0.15 : 0.23) * age;
      const colorAlpha = (reduced ? 0.38 : 0.62) * age;
      const coreAlpha = (reduced ? 0.54 : 0.86) * age;
      const outerWidth = reduced ? 12 : 18;
      const colorWidth = reduced ? 6 : 9;
      const coreWidth = reduced ? 2 : 3;
      g.lineStyle(outerWidth, profile.color, outerAlpha).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(colorWidth, profile.color, colorAlpha).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(coreWidth, profile.core, coreAlpha).lineBetween(a.x, a.y, b.x, b.y);
    }
  };

  await new Promise<void>((resolve) => {
    let done = false;
    let tween: Phaser.Tweens.Tween | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = () => {
      try { tween?.stop(); } catch { /* noop */ }
      finish();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      tween = scene.tweens.add({
        targets: tracker,
        p: 1,
        duration: durationMs,
        ease: element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut',
        onUpdate: redraw,
        onComplete: finish,
        onStop: finish
      });
    } catch { finish(); }
  });

  try {
    await tweenObject(scene, g, { alpha: 0, duration: reduced ? 80 : 120, ease: 'Quad.easeOut' }, reduced ? 220 : 260);
  } finally {
    g.destroy();
  }
}

async function playFighterImpact(options: DirectionalProjectileOptions, durationMs: number, reduced: boolean): Promise<void> {
  const { scene, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  await waitScene(scene, Math.min(reduced ? 80 : 120, Math.round(durationMs * 0.2)));
  const size = reduced ? 58 : 78;
  const root = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 3).setScale(0.56);
  const g = scene.add.graphics();
  g.lineStyle(reduced ? 5 : 8, profile.color, 0.72);
  [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.72, -0.72], [0.72, 0.72]].forEach(([x, y]) => {
    g.lineBetween(x * size * 0.42, y * size * 0.42, x * size * 0.9, y * size * 0.9);
  });
  root.add([
    scene.add.circle(0, 0, size * 0.72, profile.color, reduced ? 0.08 : 0.13),
    scene.add.circle(0, 0, size * 0.46, profile.color, 0.34),
    scene.add.rectangle(0, 2, size * 0.72, size * 0.38, profile.color, 0.9).setRotation(-0.12),
    scene.add.rectangle(0, 0, size * 0.48, Math.max(4, size * 0.08), profile.core, 0.96).setRotation(-0.12),
    scene.add.circle(size * 0.16, -size * 0.06, size * 0.13, 0xffffff, 0.78),
    g,
    scene.add.circle(0, 0, size * 0.95, 0x000000, 0).setStrokeStyle(reduced ? 2 : 3, profile.color, 0.58)
  ]);
  try {
    await tweenObject(scene, root, {
      scaleX: reduced ? 0.98 : 1.08,
      scaleY: reduced ? 0.98 : 1.08,
      alpha: 0,
      duration: reduced ? 150 : 205,
      ease: 'Back.easeOut'
    }, reduced ? 330 : 420);
  } finally { root.destroy(true); }
}

async function playSlash(
  options: DirectionalProjectileOptions,
  reduced: boolean,
  scale: number,
  rotation: number,
  critical = false
): Promise<void> {
  const { scene, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const length = (reduced ? 150 : 205) * scale;
  const root = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 3).setRotation(rotation).setScale(0.58);
  root.add([
    scene.add.arc(-length * 0.05, 0, length * 0.54, 198, 342, false, 0x000000, 0)
      .setStrokeStyle(Math.max(8, length * 0.105), profile.color, critical ? 0.94 : 0.88),
    scene.add.arc(0, 0, length * 0.49, 200, 340, false, 0x000000, 0)
      .setStrokeStyle(Math.max(3, length * 0.045), profile.core, 0.98),
    scene.add.arc(length * 0.025, 0, length * 0.44, 203, 337, false, 0x000000, 0)
      .setStrokeStyle(Math.max(1.5, length * 0.018), 0xffffff, 0.96),
    scene.add.arc(-length * 0.09, 0, length * 0.59, 200, 340, false, 0x000000, 0)
      .setStrokeStyle(Math.max(2, length * 0.022), profile.color, 0.3),
    scene.add.circle(length * 0.19, -length * 0.07, Math.max(5, length * 0.04), profile.core, 0.72)
  ]);
  try {
    await tweenObject(scene, root, {
      scaleX: reduced ? 0.98 : 1.08,
      scaleY: reduced ? 0.98 : 1.08,
      alpha: 0,
      duration: reduced ? 135 : 185,
      ease: 'Quad.easeOut'
    }, reduced ? 310 : 390);
  } finally { root.destroy(true); }
}

async function playKnightImpact(options: DirectionalProjectileOptions, durationMs: number, reduced: boolean): Promise<void> {
  await waitScene(options.scene, Math.min(reduced ? 80 : 120, Math.round(durationMs * 0.2)));
  await playSlash(options, reduced, 1, -0.2, false);
}

async function playAssassinImpact(options: DirectionalProjectileOptions, durationMs: number, reduced: boolean): Promise<void> {
  await waitScene(options.scene, Math.min(reduced ? 70 : 105, Math.round(durationMs * 0.18)));
  const first = playSlash(options, reduced, ASSASSIN_SCALE_VS_KNIGHT, -0.52, true);
  await waitScene(options.scene, reduced ? 36 : 52);
  const second = playSlash(options, reduced, ASSASSIN_SCALE_VS_KNIGHT, 0.52, true);
  await Promise.all([first, second]);

  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const burst = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 4).setScale(0.45);
  const r = reduced ? 30 : 42;
  const g = options.scene.add.graphics();
  g.lineStyle(reduced ? 3 : 5, profile.core, 0.92);
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    g.lineBetween(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25, Math.cos(a) * r, Math.sin(a) * r);
  }
  burst.add([sceneCircle(options.scene, 0, 0, r * 0.34, profile.color, 0.66), g]);
  try {
    await tweenObject(options.scene, burst, { scaleX: 1, scaleY: 1, alpha: 0, duration: reduced ? 90 : 125, ease: 'Quad.easeOut' }, 260);
  } finally { burst.destroy(true); }
}

function sceneCircle(scene: Phaser.Scene, x: number, y: number, radius: number, color: number, alpha: number): Phaser.GameObjects.Arc {
  return scene.add.circle(x, y, radius, color, alpha);
}

export function installCombat2154TrajectoryAndMeleeVfxPatch(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;
  const previousPlay = owner.play.bind(owner) as (options: DirectionalProjectileOptions) => Promise<void>;

  owner.play = async (rawOptions: DirectionalProjectileOptions): Promise<void> => {
    const options = rawOptions as RoleAwareOptions;
    const role = resolveRole(options.role);
    const current = fxTier();
    const reduced = Boolean(options.reducedMotion) || current === 'lite';
    const durationMs = readableDuration(options, current);

    if (RANGED.has(role)) {
      await Promise.all([
        previousPlay(rawOptions),
        playLuminousTrajectoryTrail(options, durationMs, current)
      ]);
      return;
    }

    if (role === 'fighter') {
      await playFighterImpact(options, durationMs, reduced);
      return;
    }
    if (role === 'knight') {
      await playKnightImpact(options, durationMs, reduced);
      return;
    }
    if (role === 'assassin') {
      await playAssassinImpact(options, durationMs, reduced);
      return;
    }

    await previousPlay(rawOptions);
  };

  root.POWDER_COMBAT2_TRAJECTORY_TRAIL = {
    version: '2.15.4',
    family: 'Combat2',
    owner: 'world-space-recent-path-trail',
    recentPointsFull: 7,
    recentPointsBalanced: 6,
    recentPointsLite: 5,
    layers: ['outer-pressure-glow', 'element-color-line', 'bright-core-line'],
    followsActualTravelProgress: true,
    shortRecentPathOnly: true,
    fullScreenBeam: false,
    oneGraphicsPerActiveRangedShot: true,
    particleEmitters: false,
    finiteTween: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_MELEE_VFX = {
    version: '2.15.4',
    family: 'Combat2',
    routes: {
      fighter: 'compressed-fist-impact+radial-shock',
      knight: 'single-heavy-triple-edge-slash+afterimage',
      assassin: 'dual-critical-slash-80pct-knight+intersection-burst'
    },
    fighterProjectile: false,
    knightProjectile: false,
    assassinProjectile: false,
    assassinScaleVsKnight: ASSASSIN_SCALE_VS_KNIGHT,
    targetBoundImpact: true,
    elementColorPreserved: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_FX_BUDGET = {
    ...(root.POWDER_COMBAT2_FX_BUDGET || {}),
    version: '2.15.4',
    family: 'Combat2',
    rangedOwner: 'Combat2153ProjectileClarityVfxPatch+2154TrajectoryOverlay',
    meleeOwner: 'Combat2154TrajectoryAndMeleeVfxPatch',
    oneTrajectoryGraphicsPerRangedShot: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    finiteTweensOnly: true,
    combatLogicChanged: false
  };
}

installCombat2154TrajectoryAndMeleeVfxPatch();
