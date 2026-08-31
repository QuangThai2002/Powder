import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2156MarksmanHealerTankFixInstalled';

type RoleKey = 'marksman' | 'healer' | 'tank' | 'other';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };
type FxTier = 'full' | 'balanced' | 'lite';
type ElementProfile = { color: number; core: number; shadow: number };

const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff7043, core: 0xfff3bd, shadow: 0x8f2816 },
  lava: { color: 0xff4f2e, core: 0xffd05b, shadow: 0x762012 },
  water: { color: 0x4db9ff, core: 0xe8fbff, shadow: 0x155d8c },
  ice: { color: 0x8adfff, core: 0xffffff, shadow: 0x377e9d },
  lightning: { color: 0xf5dd62, core: 0xffffff, shadow: 0x9a7010 },
  storm: { color: 0x78a9ff, core: 0xeaf0ff, shadow: 0x3a5298 },
  wind: { color: 0x76e4d2, core: 0xf2fffd, shadow: 0x277f75 },
  leaf: { color: 0x72d67f, core: 0xecffe5, shadow: 0x33743b },
  poison: { color: 0xa5df66, core: 0xf2ffce, shadow: 0x4b7325 },
  earth: { color: 0xb78c5d, core: 0xffe5c0, shadow: 0x684b34 },
  steel: { color: 0xc3d3dc, core: 0xffffff, shadow: 0x5d707d },
  light: { color: 0xffefad, core: 0xffffff, shadow: 0xb99b4a },
  dark: { color: 0xa88cf2, core: 0xf3edff, shadow: 0x4d3073 },
  neutral: { color: 0x9ed8e8, core: 0xffffff, shadow: 0x466f7d }
});

function normalize(value: string | undefined): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveRole(raw: string | undefined): RoleKey {
  const role = normalize(raw);
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  return 'other';
}

function tier(): FxTier {
  const raw = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return raw === 'lite' || raw === 'balanced' ? raw : 'full';
}

function duration(options: DirectionalProjectileOptions, current: FxTier): number {
  const distance = Math.max(1, Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y));
  const requested = Number(options.durationMs || 0);
  const natural = current === 'lite' ? 410 : current === 'balanced'
    ? Math.round(500 + Math.min(90, distance * 0.07))
    : Math.round(560 + Math.min(120, distance * 0.09));
  return Phaser.Math.Clamp(requested > 0 ? Math.round(requested * 1.35) : natural, 390, current === 'full' ? 760 : 660);
}

class StrongTrail {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly points: Array<{ x: number; y: number }> = [];
  private readonly maxPoints: number;
  private readonly profile: ElementProfile;
  private readonly reduced: boolean;
  private readonly heavy: boolean;

  constructor(scene: Phaser.Scene, element: CombatProjectileElement, current: FxTier, reduced: boolean, heavy = false) {
    this.g = scene.add.graphics().setDepth(powVfxDepth('foreground') + 2);
    this.maxPoints = reduced ? 10 : current === 'balanced' ? 15 : 19;
    this.profile = ELEMENT[element] ?? ELEMENT.neutral;
    this.reduced = reduced;
    this.heavy = heavy;
  }

  push(x: number, y: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 4) return;
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
      const age = i / Math.max(1, this.points.length - 1);
      const fade = Math.max(0.08, age * age);
      const heavyMul = this.heavy ? 1.28 : 1;
      this.g.lineStyle((this.reduced ? 15 : 25) * heavyMul, this.profile.color, (this.reduced ? 0.18 : 0.3) * fade);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
      this.g.lineStyle((this.reduced ? 8 : 13) * heavyMul, this.profile.color, (this.reduced ? 0.54 : 0.88) * fade);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
      this.g.lineStyle((this.reduced ? 3 : 5) * heavyMul, this.profile.core, (this.reduced ? 0.78 : 1) * fade);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  fade(scene: Phaser.Scene): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => { if (this.g.active) this.g.destroy(); resolve(); };
      try { scene.tweens.add({ targets: this.g, alpha: 0, duration: this.reduced ? 95 : 150, ease: 'Quad.easeOut', onComplete: finish, onStop: finish }); }
      catch { finish(); }
    });
  }
}

function makeArrow(options: DirectionalProjectileOptions, reduced: boolean): {
  projectile: Phaser.GameObjects.Container;
  rings: Phaser.GameObjects.Ellipse[];
} {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = reduced ? 34 : 46;
  const length = reduced ? 166 : 226;
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 4)
    .setRotation(angle);

  // Every body point is centered on local Y=0. Only the projectile root is rotated to target.
  projectile.add([
    scene.add.triangle(-length * 0.47, 0, -radius * 0.8, -radius * 0.3, radius * 0.05, 0, -radius * 0.8, radius * 0.3, profile.color, reduced ? 0.2 : 0.38),
    scene.add.rectangle(-length * 0.06, 0, length * 0.82, reduced ? 14 : 18, profile.shadow, 0.52),
    scene.add.rectangle(-length * 0.03, 0, length * 0.8, reduced ? 9 : 12, profile.color, 1),
    scene.add.rectangle(0, 0, length * 0.74, reduced ? 3 : 4, profile.core, 1),
    scene.add.triangle(
      length * 0.43, 0,
      -radius * 0.78, -radius * 0.64,
      -radius * 0.78, radius * 0.64,
      radius * 0.92, 0,
      profile.color, 1
    ),
    scene.add.triangle(
      length * 0.46, 0,
      -radius * 0.46, -radius * 0.34,
      -radius * 0.46, radius * 0.34,
      radius * 0.66, 0,
      profile.core, 1
    ),
    scene.add.rectangle(length * 0.31, 0, radius * 1.2, reduced ? 2 : 3, 0xffffff, 1)
  ]);

  const rings: Phaser.GameObjects.Ellipse[] = [];
  [-0.26, -0.04, 0.18, 0.34].forEach((ratio, index) => {
    const ring = scene.add.ellipse(
      length * ratio, 0,
      radius * (index % 2 === 0 ? 0.46 : 0.38),
      radius * (index % 2 === 0 ? 1.08 : 0.9),
      0x000000, 0
    ).setStrokeStyle(reduced ? 2 : 3, index % 2 === 0 ? profile.core : profile.color, reduced ? 0.58 : 0.9)
      .setRotation(index % 2 === 0 ? 0.22 : -0.22);
    rings.push(ring);
    projectile.add(ring);
  });

  return { projectile, rings };
}

function makeHealerOrb(options: DirectionalProjectileOptions, reduced: boolean): Phaser.GameObjects.Container {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = (reduced ? 34 : 48) * 0.8;
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 4)
    .setRotation(angle);

  projectile.add([
    scene.add.triangle(-radius * 1.75, 0, -radius * 0.9, -radius * 0.2, radius * 0.12, 0, -radius * 0.9, radius * 0.2, profile.color, reduced ? 0.25 : 0.48),
    scene.add.triangle(-radius * 1.25, 0, -radius * 0.68, -radius * 0.1, radius * 0.08, 0, -radius * 0.68, radius * 0.1, profile.core, reduced ? 0.46 : 0.78),
    scene.add.circle(0, 0, radius * 1.15, profile.color, 0.22),
    scene.add.circle(0, 0, radius * 0.88, profile.shadow, 0.36),
    scene.add.circle(0, 0, radius * 0.76, profile.color, 0.98),
    scene.add.circle(radius * 0.08, -radius * 0.06, radius * 0.4, profile.core, 1),
    scene.add.circle(radius * 0.14, -radius * 0.1, radius * 0.16, 0xffffff, 1),
    scene.add.circle(0, 0, radius * 1.05, 0x000000, 0).setStrokeStyle(reduced ? 2 : 3, profile.core, 0.9)
  ]);
  return projectile;
}

function shieldGraphic(scene: Phaser.Scene, radius: number, profile: ElementProfile, reduced: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const pts: Array<[number, number]> = [
    [-radius * 0.72, -radius * 0.72],
    [radius * 0.18, -radius * 0.72],
    [radius * 0.86, 0],
    [radius * 0.18, radius * 0.72],
    [-radius * 0.72, radius * 0.72],
    [-radius * 0.48, 0]
  ];
  g.fillStyle(profile.shadow, 0.72);
  g.lineStyle(reduced ? 5 : 7, profile.color, 1);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  g.fillPath();
  g.strokePath();

  const inner = pts.map(([x, y]) => [x * 0.68, y * 0.68] as [number, number]);
  g.fillStyle(profile.color, 0.94);
  g.lineStyle(reduced ? 2 : 3, profile.core, 1);
  g.beginPath();
  g.moveTo(inner[0][0], inner[0][1]);
  inner.slice(1).forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.lineStyle(reduced ? 3 : 5, profile.core, 0.95);
  g.lineBetween(-radius * 0.3, 0, radius * 0.42, 0);
  g.lineBetween(radius * 0.06, -radius * 0.38, radius * 0.06, radius * 0.38);
  return g;
}

function makeTankShield(options: DirectionalProjectileOptions, reduced: boolean): Phaser.GameObjects.Container {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = reduced ? 42 : 58;
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 4)
    .setRotation(angle);

  projectile.add([
    scene.add.triangle(-radius * 1.8, 0, -radius * 1.05, -radius * 0.36, radius * 0.08, 0, -radius * 1.05, radius * 0.36, profile.color, reduced ? 0.3 : 0.54),
    scene.add.triangle(-radius * 1.3, 0, -radius * 0.76, -radius * 0.18, radius * 0.05, 0, -radius * 0.76, radius * 0.18, profile.core, reduced ? 0.46 : 0.82),
    scene.add.circle(0, 0, radius * 1.02, profile.color, reduced ? 0.08 : 0.14),
    shieldGraphic(scene, radius, profile, reduced)
  ]);
  return projectile;
}

function moveWithTrail(
  options: DirectionalProjectileOptions,
  projectile: Phaser.GameObjects.Container,
  current: FxTier,
  heavy: boolean,
  rings: Phaser.GameObjects.Ellipse[] = []
): Promise<void> {
  const scene = options.scene;
  const reduced = Boolean(options.reducedMotion) || current === 'lite';
  const ms = duration(options, current);
  const trail = new StrongTrail(scene, options.element, current, reduced, heavy);
  trail.push(projectile.x, projectile.y);

  return new Promise((resolve) => {
    let settled = false;
    const ringTweens: Phaser.Tweens.Tween[] = [];
    const finish = async () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      ringTweens.forEach((tw) => { try { tw.stop(); } catch { /* noop */ } });
      if (projectile.active) projectile.destroy(true);
      await trail.fade(scene);
      resolve();
    };
    const abort = () => { try { move.stop(); } catch { /* noop */ } void finish(); };
    const timer = window.setTimeout(() => void finish(), ms + 450);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);

    rings.forEach((ring, index) => {
      try {
        ringTweens.push(scene.tweens.add({
          targets: ring,
          angle: ring.angle + (index % 2 === 0 ? 160 : -160),
          duration: ms,
          ease: 'Linear'
        }));
      } catch { /* ring animation is decorative */ }
    });

    let move: Phaser.Tweens.Tween;
    try {
      move = scene.tweens.add({
        targets: projectile,
        x: options.target.x,
        y: options.target.y,
        duration: ms,
        ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut',
        onUpdate: () => trail.push(projectile.x, projectile.y),
        onComplete: () => void finish(),
        onStop: () => void finish()
      });
    } catch {
      void finish();
      return;
    }
  });
}

async function impact(options: DirectionalProjectileOptions, role: RoleKey, reduced: boolean): Promise<void> {
  const { scene, target, source, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const r = role === 'tank' ? (reduced ? 54 : 74) : role === 'marksman' ? (reduced ? 36 : 50) : (reduced ? 30 : 42);
  const root = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 6).setScale(0.42).setRotation(angle);

  if (role === 'marksman') {
    root.add([
      scene.add.rectangle(0, 0, r * 3.2, reduced ? 7 : 10, profile.color, 0.82),
      scene.add.rectangle(0, 0, r * 2.5, reduced ? 2 : 4, 0xffffff, 1),
      scene.add.circle(0, 0, r * 0.38, profile.core, 0.9)
    ]);
  } else if (role === 'tank') {
    root.add([
      scene.add.circle(0, 0, r * 0.55, profile.color, 0.3),
      scene.add.circle(0, 0, r, 0x000000, 0).setStrokeStyle(reduced ? 5 : 8, profile.color, 0.95),
      scene.add.circle(0, 0, r * 1.28, 0x000000, 0).setStrokeStyle(reduced ? 2 : 4, profile.core, 0.62),
      shieldGraphic(scene, r * 0.68, profile, reduced)
    ]);
    if (!reduced) scene.cameras.main.shake(95, 0.0014);
  } else {
    root.add([
      scene.add.circle(0, 0, r * 0.45, profile.core, 0.74),
      scene.add.circle(0, 0, r * 0.9, 0x000000, 0).setStrokeStyle(reduced ? 3 : 5, profile.color, 0.9),
      scene.add.circle(0, 0, r * 1.25, 0x000000, 0).setStrokeStyle(reduced ? 2 : 3, profile.core, 0.55)
    ]);
  }

  await new Promise<void>((resolve) => {
    const finish = () => { if (root.active) root.destroy(true); resolve(); };
    try { scene.tweens.add({ targets: root, scaleX: 1.18, scaleY: 1.18, alpha: 0, duration: reduced ? 160 : 230, ease: 'Back.easeOut', onComplete: finish, onStop: finish }); }
    catch { finish(); }
  });
}

export function installCombat2156MarksmanHealerTankFixVfxPatch(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;
  const previous = owner.play.bind(owner) as (options: DirectionalProjectileOptions) => Promise<void>;

  owner.play = async (raw: DirectionalProjectileOptions): Promise<void> => {
    const options = raw as RoleAwareOptions;
    const role = resolveRole(options.role);
    if (role === 'other') {
      await previous(raw);
      return;
    }

    const current = tier();
    const reduced = Boolean(options.reducedMotion) || current === 'lite';
    if (role === 'marksman') {
      const built = makeArrow(options, reduced);
      await moveWithTrail(options, built.projectile, current, false, built.rings);
      await impact(options, role, reduced);
      return;
    }
    if (role === 'healer') {
      const projectile = makeHealerOrb(options, reduced);
      await moveWithTrail(options, projectile, current, false);
      await impact(options, role, reduced);
      return;
    }
    const projectile = makeTankShield(options, reduced);
    await moveWithTrail(options, projectile, current, true);
    await impact(options, role, reduced);
  };

  root.POWDER_COMBAT2_2156_PROJECTILE_FIX = {
    version: '2.15.6',
    finalOwnerFor: ['marksman', 'healer', 'tank'],
    marksman: {
      axisLockedSourceToTarget: true,
      helixContainerRotationRemoved: true,
      ringLocalRotationOnly: true,
      physicalFeathers: false,
      magicArrow: true
    },
    healer: {
      projectileVisible: true,
      mageScale: 0.8,
      strongWorldTrail: true
    },
    tank: {
      projectileVisible: true,
      form: 'aegis-energy-shield-ram',
      heavyWorldTrail: true,
      shieldImpact: true
    },
    trajectoryPoints: { full: 19, balanced: 15, lite: 10 },
    trajectoryLayers: ['pressure-glow', 'element-color', 'bright-core'],
    noFullPathBeam: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    combatLogicChanged: false
  };
}

installCombat2156MarksmanHealerTankFixVfxPatch();
