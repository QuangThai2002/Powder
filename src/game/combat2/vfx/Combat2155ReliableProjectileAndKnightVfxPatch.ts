import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2155ReliableProjectileAndKnightInstalled';
const HEALER_SCALE_VS_MAGE = 0.8;

type RoleKey = 'marksman' | 'mage' | 'enchanter' | 'healer' | 'musician' | 'tank' | 'knight' | 'other';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };
type FxTier = 'full' | 'balanced' | 'lite';
type ElementProfile = { color: number; core: number; shadow: number };

const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff7043, core: 0xfff3bd, shadow: 0x9c2f1a },
  lava: { color: 0xff4f2e, core: 0xffd05b, shadow: 0x7f2414 },
  water: { color: 0x4db9ff, core: 0xe4f9ff, shadow: 0x176695 },
  ice: { color: 0x8adfff, core: 0xffffff, shadow: 0x3c8ead },
  lightning: { color: 0xf5dd62, core: 0xffffff, shadow: 0xa87812 },
  storm: { color: 0x78a9ff, core: 0xe8efff, shadow: 0x405caa },
  wind: { color: 0x76e4d2, core: 0xf0fffc, shadow: 0x2a8f82 },
  leaf: { color: 0x72d67f, core: 0xeaffdf, shadow: 0x397d42 },
  poison: { color: 0xa5df66, core: 0xf0ffc8, shadow: 0x517e28 },
  earth: { color: 0xb78c5d, core: 0xffe4bd, shadow: 0x715239 },
  steel: { color: 0xc3d3dc, core: 0xffffff, shadow: 0x647885 },
  light: { color: 0xffefad, core: 0xffffff, shadow: 0xc5a552 },
  dark: { color: 0xa88cf2, core: 0xf0e9ff, shadow: 0x56367e },
  neutral: { color: 0x9ed8e8, core: 0xffffff, shadow: 0x4a7d8b }
});

function normalize(value: string | undefined): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveRole(raw: string | undefined): RoleKey {
  const role = normalize(raw);
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('thuat si') || role.includes('enchanter')) return 'enchanter';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  return 'other';
}

function fxTier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function durationMs(options: DirectionalProjectileOptions, tier: FxTier): number {
  const requested = Number(options.durationMs || 0);
  const distance = Math.max(1, Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y));
  const natural = tier === 'lite'
    ? 210
    : tier === 'balanced'
      ? Math.round(245 + Math.min(45, distance * 0.04))
      : Math.round(270 + Math.min(70, distance * 0.055));
  const base = requested > 0 ? requested : natural;
  return Phaser.Math.Clamp(Math.round(base * 2.1), tier === 'lite' ? 360 : 430, tier === 'full' ? 760 : 650);
}

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let tw: Phaser.Tweens.Tween | null = null;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      try { tw?.stop(); } catch { /* teardown owns tween manager */ }
      finish();
    };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try { tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish }); }
    catch { finish(); }
  });
}

class RecentTrajectory {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly points: Array<{ x: number; y: number }> = [];
  private readonly maxPoints: number;
  private readonly profile: ElementProfile;
  private readonly reduced: boolean;

  constructor(scene: Phaser.Scene, element: CombatProjectileElement, tier: FxTier, reduced: boolean) {
    this.g = scene.add.graphics().setDepth(powVfxDepth('foreground') + 1);
    this.profile = ELEMENT[element] ?? ELEMENT.neutral;
    this.reduced = reduced;
    this.maxPoints = reduced ? 8 : tier === 'balanced' ? 11 : 14;
  }

  push(x: number, y: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 5) return;
    this.points.push({ x, y });
    while (this.points.length > this.maxPoints) this.points.shift();
    this.redraw();
  }

  private redraw(): void {
    this.g.clear();
    if (this.points.length < 2) return;
    for (let i = 1; i < this.points.length; i += 1) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const freshness = i / (this.points.length - 1);
      const fade = Math.max(0.12, freshness * freshness);
      const outerWidth = this.reduced ? 14 : 23;
      const colorWidth = this.reduced ? 7 : 12;
      const coreWidth = this.reduced ? 2 : 4;
      this.g.lineStyle(outerWidth, this.profile.color, (this.reduced ? 0.18 : 0.3) * fade);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
      this.g.lineStyle(colorWidth, this.profile.color, (this.reduced ? 0.48 : 0.78) * fade);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
      this.g.lineStyle(coreWidth, this.profile.core, (this.reduced ? 0.7 : 0.98) * fade);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  async fadeAndDestroy(scene: Phaser.Scene): Promise<void> {
    try { await tween(scene, this.g, { alpha: 0, duration: this.reduced ? 85 : 135, ease: 'Quad.easeOut' }, 280); }
    finally { this.g.destroy(); }
  }
}

function addCompactWake(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  profile: ElementProfile,
  radius: number,
  reduced: boolean
): void {
  projectile.add([
    scene.add.triangle(-radius * 1.35, 0, -radius * 0.92, -radius * 0.26, radius * 0.15, 0, -radius * 0.92, radius * 0.26, profile.color, reduced ? 0.18 : 0.34),
    scene.add.triangle(-radius * 0.95, 0, -radius * 0.66, -radius * 0.13, radius * 0.08, 0, -radius * 0.66, radius * 0.13, profile.core, reduced ? 0.34 : 0.62)
  ]);
}

function buildMarksman(
  options: DirectionalProjectileOptions,
  tier: FxTier,
  reduced: boolean
): { projectile: Phaser.GameObjects.Container; spin: Phaser.GameObjects.Container } {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const radius = reduced ? 36 : 48;
  const length = reduced ? 150 : 205;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y).setDepth(powVfxDepth('foreground') + 3).setRotation(angle);
  addCompactWake(scene, projectile, profile, radius, reduced);

  const outerHead = scene.add.triangle(length * 0.43, 0, -radius * 0.72, -radius * 0.64, -radius * 0.72, radius * 0.64, radius * 0.86, 0, profile.color, 1);
  const innerHead = scene.add.triangle(length * 0.46, 0, -radius * 0.43, -radius * 0.35, -radius * 0.43, radius * 0.35, radius * 0.62, 0, profile.core, 1);
  projectile.add([
    scene.add.rectangle(-length * 0.06, 0, length * 0.78, reduced ? 15 : 20, profile.shadow, 0.52),
    scene.add.rectangle(-length * 0.03, 0, length * 0.78, reduced ? 10 : 13, profile.color, 0.98),
    scene.add.rectangle(0, 0, length * 0.7, reduced ? 3 : 4, profile.core, 1),
    outerHead,
    innerHead,
    scene.add.rectangle(length * 0.28, 0, radius * 0.9, reduced ? 2 : 3, 0xffffff, 0.92)
  ]);

  const helix = scene.add.container(-length * 0.02, 0);
  [-0.28, 0.02, 0.28].forEach((ratio, index) => {
    helix.add(scene.add.ellipse(length * ratio, 0, radius * 0.52, radius * (index === 1 ? 1.08 : 0.9), 0x000000, 0)
      .setStrokeStyle(reduced ? 2 : 3, index === 1 ? profile.core : profile.color, reduced ? 0.58 : 0.88)
      .setRotation(index % 2 === 0 ? 0.25 : -0.25));
  });
  helix.add([
    scene.add.circle(0, -radius * 0.62, reduced ? 3 : 5, profile.core, 0.95),
    scene.add.circle(0, radius * 0.62, reduced ? 3 : 5, profile.color, 0.9)
  ]);
  projectile.add(helix);
  return { projectile, spin: helix };
}

function buildOrb(
  options: DirectionalProjectileOptions,
  role: 'mage' | 'enchanter' | 'healer',
  reduced: boolean
): Phaser.GameObjects.Container {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const mageRadius = reduced ? 34 : 48;
  const scale = role === 'healer' ? HEALER_SCALE_VS_MAGE : 1;
  const radius = mageRadius * scale;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y).setDepth(powVfxDepth('foreground') + 3).setRotation(angle);
  addCompactWake(scene, projectile, profile, radius, reduced);
  projectile.add([
    scene.add.circle(0, 0, radius * 1.12, profile.color, role === 'healer' ? 0.18 : 0.22),
    scene.add.circle(0, 0, radius * 0.9, profile.shadow, 0.4),
    scene.add.circle(0, 0, radius * 0.78, profile.color, role === 'healer' ? 0.92 : 0.98),
    scene.add.circle(radius * 0.08, -radius * 0.06, radius * 0.4, profile.core, 1),
    scene.add.circle(radius * 0.15, -radius * 0.1, radius * 0.16, 0xffffff, 1),
    scene.add.circle(0, 0, radius * 1.03, 0x000000, 0).setStrokeStyle(reduced ? 2 : 3, profile.core, role === 'healer' ? 0.8 : 0.92)
  ]);
  if (role === 'enchanter') {
    projectile.add(scene.add.rectangle(0, 0, radius * 1.45, radius * 1.45, 0x000000, 0)
      .setStrokeStyle(reduced ? 2 : 3, profile.core, 0.78).setRotation(Math.PI / 4));
  }
  return projectile;
}

function buildMusicNote(options: DirectionalProjectileOptions, reduced: boolean): Phaser.GameObjects.Container {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const radius = reduced ? 31 : 43;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y).setDepth(powVfxDepth('foreground') + 3).setRotation(angle);
  addCompactWake(scene, projectile, profile, radius, reduced);
  const note = scene.add.container(0, 0).setRotation(-angle - 0.1);
  note.add([
    scene.add.circle(0, 0, radius * 0.95, profile.color, 0.13),
    scene.add.ellipse(-radius * 0.2, radius * 0.28, radius * 0.82, radius * 0.5, profile.color, 1).setRotation(-0.28),
    scene.add.ellipse(-radius * 0.15, radius * 0.23, radius * 0.3, radius * 0.17, profile.core, 0.95).setRotation(-0.28),
    scene.add.rectangle(radius * 0.18, -radius * 0.18, reduced ? 5 : 7, radius * 1.18, profile.color, 1),
    scene.add.triangle(radius * 0.53, -radius * 0.6, -radius * 0.34, -radius * 0.2, radius * 0.34, 0, -radius * 0.34, radius * 0.2, profile.core, 0.96)
  ]);
  projectile.add(note);
  return projectile;
}

function buildTankBolt(options: DirectionalProjectileOptions, reduced: boolean): Phaser.GameObjects.Container {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const radius = reduced ? 36 : 50;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y).setDepth(powVfxDepth('foreground') + 3).setRotation(angle);
  addCompactWake(scene, projectile, profile, radius, reduced);
  projectile.add([
    scene.add.rectangle(0, 0, radius * 1.55, radius * 1.55, profile.shadow, 0.42).setRotation(Math.PI / 4),
    scene.add.rectangle(0, 0, radius * 1.25, radius * 1.25, profile.color, 0.95).setRotation(Math.PI / 4),
    scene.add.rectangle(0, 0, radius * 0.82, radius * 0.82, profile.core, 0.92).setRotation(Math.PI / 4),
    scene.add.circle(radius * 0.1, -radius * 0.08, radius * 0.25, 0xffffff, 0.94),
    scene.add.rectangle(-radius * 0.95, 0, radius * 0.72, reduced ? 5 : 7, profile.color, 0.76),
    scene.add.rectangle(-radius * 1.18, 0, radius * 0.5, reduced ? 2 : 3, profile.core, 0.8)
  ]);
  return projectile;
}

async function playProjectileImpact(options: DirectionalProjectileOptions, role: RoleKey, reduced: boolean): Promise<void> {
  const { scene, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const base = reduced ? 28 : 40;
  const scale = role === 'healer' ? HEALER_SCALE_VS_MAGE : role === 'tank' ? 1.2 : 1;
  const r = base * scale;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 4).setScale(0.45);
  impact.add([
    scene.add.circle(0, 0, r * 0.42, profile.core, 0.86),
    scene.add.circle(0, 0, r * 0.9, 0x000000, 0).setStrokeStyle(reduced ? 3 : 5, profile.color, 0.94),
    scene.add.circle(0, 0, r * 1.25, 0x000000, 0).setStrokeStyle(reduced ? 2 : 3, profile.core, 0.58)
  ]);
  if (role === 'marksman') {
    impact.add([
      scene.add.rectangle(0, 0, r * 2.8, reduced ? 5 : 7, profile.color, 0.7),
      scene.add.rectangle(0, 0, r * 2.1, reduced ? 2 : 3, 0xffffff, 0.96)
    ]);
  } else if (role === 'tank') {
    impact.add(scene.add.rectangle(0, 0, r * 1.25, r * 1.25, 0x000000, 0).setStrokeStyle(4, profile.core, 0.82).setRotation(Math.PI / 4));
  }
  try { await tween(scene, impact, { scaleX: 1.25, scaleY: 1.25, alpha: 0, duration: reduced ? 145 : 205, ease: 'Quad.easeOut' }, 390); }
  finally { impact.destroy(true); }
}

async function flyProjectile(
  options: DirectionalProjectileOptions,
  projectile: Phaser.GameObjects.Container,
  tier: FxTier,
  spin?: Phaser.GameObjects.Container
): Promise<void> {
  const reduced = Boolean(options.reducedMotion) || tier === 'lite';
  const duration = durationMs(options, tier);
  const trail = new RecentTrajectory(options.scene, options.element, tier, reduced);
  trail.push(projectile.x, projectile.y);
  const move = tween(options.scene, projectile, {
    x: options.target.x,
    y: options.target.y,
    duration,
    ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut',
    onUpdate: () => trail.push(projectile.x, projectile.y)
  }, duration + 280);
  const spinTween = spin
    ? tween(options.scene, spin, { angle: 540, duration, ease: 'Linear' }, duration + 280)
    : Promise.resolve();
  try { await Promise.all([move, spinTween]); }
  finally { projectile.destroy(true); }
  await trail.fadeAndDestroy(options.scene);
}

async function playHeavyKnightSlash(options: DirectionalProjectileOptions, reduced: boolean): Promise<void> {
  const { scene, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const length = reduced ? 220 : 300;
  const root = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 5).setRotation(-0.28).setScale(0.42);
  const shock = scene.add.graphics();
  shock.lineStyle(reduced ? 3 : 5, profile.core, 0.82);
  shock.lineBetween(-length * 0.46, length * 0.2, length * 0.52, -length * 0.23);
  root.add([
    scene.add.arc(-length * 0.05, 0, length * 0.56, 196, 344, false, 0x000000, 0).setStrokeStyle(reduced ? 24 : 34, profile.shadow, 0.45),
    scene.add.arc(-length * 0.03, 0, length * 0.53, 197, 343, false, 0x000000, 0).setStrokeStyle(reduced ? 17 : 24, profile.color, 0.98),
    scene.add.arc(0, 0, length * 0.49, 200, 340, false, 0x000000, 0).setStrokeStyle(reduced ? 7 : 10, profile.core, 1),
    scene.add.arc(length * 0.02, 0, length * 0.45, 202, 338, false, 0x000000, 0).setStrokeStyle(reduced ? 2 : 4, 0xffffff, 1),
    scene.add.arc(-length * 0.09, 0, length * 0.61, 197, 343, false, 0x000000, 0).setStrokeStyle(reduced ? 4 : 6, profile.color, 0.32),
    shock,
    scene.add.circle(length * 0.16, -length * 0.06, reduced ? 12 : 17, profile.core, 0.88)
  ]);
  try {
    await tween(scene, root, { scaleX: 1.12, scaleY: 1.12, alpha: 0, duration: reduced ? 180 : 245, ease: 'Back.easeOut' }, 460);
  } finally { root.destroy(true); }

  const burst = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 6).setScale(0.35);
  const r = reduced ? 42 : 58;
  burst.add([
    scene.add.circle(0, 0, r * 0.35, profile.core, 0.78),
    scene.add.circle(0, 0, r, 0x000000, 0).setStrokeStyle(reduced ? 4 : 6, profile.color, 0.84),
    scene.add.rectangle(0, 0, r * 2.6, reduced ? 4 : 6, 0xffffff, 0.78).setRotation(-0.28)
  ]);
  try { await tween(scene, burst, { scaleX: 1.15, scaleY: 1.15, alpha: 0, duration: reduced ? 100 : 145, ease: 'Quad.easeOut' }, 300); }
  finally { burst.destroy(true); }
}

export function installCombat2155ReliableProjectileAndKnightVfxPatch(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;
  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;
  const previous = owner.play.bind(owner) as (options: DirectionalProjectileOptions) => Promise<void>;

  owner.play = async (raw: DirectionalProjectileOptions): Promise<void> => {
    const options = raw as RoleAwareOptions;
    const role = resolveRole(options.role);
    const tier = fxTier();
    const reduced = Boolean(options.reducedMotion) || tier === 'lite';

    if (role === 'marksman') {
      const built = buildMarksman(options, tier, reduced);
      await flyProjectile(options, built.projectile, tier, built.spin);
      await playProjectileImpact(options, role, reduced);
      return;
    }
    if (role === 'mage' || role === 'enchanter' || role === 'healer') {
      const projectile = buildOrb(options, role, reduced);
      await flyProjectile(options, projectile, tier);
      await playProjectileImpact(options, role, reduced);
      return;
    }
    if (role === 'musician') {
      const projectile = buildMusicNote(options, reduced);
      await flyProjectile(options, projectile, tier);
      await playProjectileImpact(options, role, reduced);
      return;
    }
    if (role === 'tank') {
      const projectile = buildTankBolt(options, reduced);
      await flyProjectile(options, projectile, tier);
      await playProjectileImpact(options, role, reduced);
      return;
    }
    if (role === 'knight') {
      await playHeavyKnightSlash(options, reduced);
      return;
    }
    await previous(raw);
  };

  root.POWDER_COMBAT2_2155_PROJECTILE = {
    version: '2.15.5',
    family: 'Combat2',
    finalOwner: true,
    projectileRoles: ['marksman', 'mage', 'enchanter', 'healer', 'musician', 'tank'],
    trajectoryPoints: { full: 14, balanced: 11, lite: 8 },
    trajectoryLayers: ['pressure-glow', 'element-line', 'white-core'],
    trajectoryUsesActualProjectilePosition: true,
    healerScaleVsMage: HEALER_SCALE_VS_MAGE,
    tankProjectile: 'heavy-guard-diamond-bolt',
    marksmanProjectile: 'large-sharp-magic-arrow-no-feathers+tight-helix',
    noFullPathBeam: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_MELEE_VFX = {
    ...(root.POWDER_COMBAT2_MELEE_VFX || {}),
    version: '2.15.5',
    knightProjectile: false,
    knight: 'oversized-heavy-quad-edge-slash+shock-line+impact-burst',
    knightLengthFull: 300,
    knightLengthLite: 220,
    combatLogicChanged: false
  };
}

installCombat2155ReliableProjectileAndKnightVfxPatch();
