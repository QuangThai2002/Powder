import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2157MarksmanSpiralBoltInstalled';

type FxTier = 'full' | 'balanced' | 'lite';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };
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

function isMarksman(raw: string | undefined): boolean {
  const role = normalize(raw);
  return role.includes('xa thu') || role.includes('marksman') || role.includes('archer');
}

function fxTier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function travelDuration(options: DirectionalProjectileOptions, tier: FxTier): number {
  const requested = Number(options.durationMs || 0);
  const distance = Math.max(1, Phaser.Math.Distance.Between(
    options.source.x,
    options.source.y,
    options.target.x,
    options.target.y
  ));
  const natural = tier === 'lite'
    ? 420
    : tier === 'balanced'
      ? Math.round(500 + Math.min(70, distance * 0.06))
      : Math.round(540 + Math.min(90, distance * 0.07));
  return Phaser.Math.Clamp(requested > 0 ? Math.round(requested * 2.05) : natural, 400, 760);
}

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: CombatTweenConfig,
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
      try { tw?.stop(); } catch { /* scene teardown owns tween cleanup */ }
      finish();
    };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

class RecentTrail {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly points: Array<{ x: number; y: number }> = [];
  private readonly maxPoints: number;

  constructor(
    scene: Phaser.Scene,
    private readonly profile: ElementProfile,
    tier: FxTier,
    private readonly reduced: boolean
  ) {
    this.graphics = scene.add.graphics().setDepth(powVfxDepth('foreground') + 1);
    this.maxPoints = reduced ? 10 : tier === 'balanced' ? 14 : 17;
  }

  push(x: number, y: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 4) return;
    this.points.push({ x, y });
    while (this.points.length > this.maxPoints) this.points.shift();
    this.redraw();
  }

  private redraw(): void {
    this.graphics.clear();
    if (this.points.length < 2) return;
    for (let index = 1; index < this.points.length; index += 1) {
      const from = this.points[index - 1];
      const to = this.points[index];
      const freshness = index / Math.max(1, this.points.length - 1);
      const fade = Math.max(0.06, freshness * freshness);
      this.graphics.lineStyle(this.reduced ? 15 : 24, this.profile.color, (this.reduced ? 0.15 : 0.24) * fade);
      this.graphics.lineBetween(from.x, from.y, to.x, to.y);
      this.graphics.lineStyle(this.reduced ? 7 : 11, this.profile.color, (this.reduced ? 0.44 : 0.72) * fade);
      this.graphics.lineBetween(from.x, from.y, to.x, to.y);
      this.graphics.lineStyle(this.reduced ? 2 : 4, this.profile.core, (this.reduced ? 0.7 : 0.98) * fade);
      this.graphics.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  async fade(scene: Phaser.Scene): Promise<void> {
    try {
      await tween(scene, this.graphics, { alpha: 0, duration: this.reduced ? 85 : 125, ease: 'Quad.easeOut' }, 260);
    } finally {
      this.graphics.destroy();
    }
  }
}

type SpiralBolt = {
  projectile: Phaser.GameObjects.Container;
  helix: Phaser.GameObjects.Graphics;
  length: number;
  radius: number;
  profile: ElementProfile;
};

function drawHelix(
  graphics: Phaser.GameObjects.Graphics,
  length: number,
  radius: number,
  profile: ElementProfile,
  phase: number,
  reduced: boolean
): void {
  graphics.clear();
  const startX = -length * 0.37;
  const endX = length * 0.34;
  const samples = reduced ? 18 : 28;
  const turns = reduced ? 2.15 : 2.65;
  const amplitude = radius * (reduced ? 0.52 : 0.62);

  const drawWave = (phaseOffset: number, color: number, alpha: number, width: number): void => {
    graphics.lineStyle(width, color, alpha);
    graphics.beginPath();
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      const x = Phaser.Math.Linear(startX, endX, t);
      const envelope = Math.sin(Math.PI * t);
      const y = Math.sin((Math.PI * 2 * turns * t) + phase + phaseOffset) * amplitude * envelope;
      if (index === 0) graphics.moveTo(x, y);
      else graphics.lineTo(x, y);
    }
    graphics.strokePath();
  };

  drawWave(0, profile.color, reduced ? 0.72 : 0.92, reduced ? 3 : 5);
  drawWave(Math.PI, profile.core, reduced ? 0.6 : 0.82, reduced ? 2 : 3);
}

function buildSpiralBolt(options: DirectionalProjectileOptions, reduced: boolean): SpiralBolt {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const length = reduced ? 138 : 174;
  const radius = reduced ? 21 : 28;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 4)
    .setRotation(angle);

  // Every structural part is centered on local Y=0. This keeps the bolt exactly on the source->target axis.
  const aura = scene.add.ellipse(-length * 0.05, 0, length * 1.12, radius * 2.1, profile.color, reduced ? 0.08 : 0.13);
  const shellShadow = scene.add.ellipse(-length * 0.04, 0, length * 0.92, radius * 1.35, profile.shadow, 0.5);
  const shell = scene.add.ellipse(-length * 0.01, 0, length * 0.86, radius * 1.12, profile.color, 0.96);
  const innerBody = scene.add.ellipse(length * 0.03, 0, length * 0.68, radius * 0.64, profile.core, 0.9);
  const coreSpine = scene.add.rectangle(length * 0.02, 0, length * 0.66, reduced ? 4 : 6, 0xffffff, 0.98);

  // Rounded/tapered energy nose: deliberately not an arrow head.
  const noseOuter = scene.add.ellipse(length * 0.39, 0, radius * 1.32, radius * 1.15, profile.color, 1);
  const noseCore = scene.add.ellipse(length * 0.42, 0, radius * 0.72, radius * 0.68, profile.core, 1);
  const nosePoint = scene.add.circle(length * 0.46, 0, reduced ? 5 : 7, 0xffffff, 1);

  // Short pressure wake attached to the bolt itself. World-space trajectory is drawn separately.
  const wakeOuter = scene.add.ellipse(-length * 0.5, 0, length * 0.5, radius * 1.1, profile.color, reduced ? 0.08 : 0.14);
  const wakeColor = scene.add.ellipse(-length * 0.48, 0, length * 0.42, radius * 0.55, profile.color, reduced ? 0.22 : 0.38);
  const wakeCore = scene.add.rectangle(-length * 0.46, 0, length * 0.32, reduced ? 3 : 4, profile.core, reduced ? 0.55 : 0.82);

  const helix = scene.add.graphics();
  drawHelix(helix, length, radius, profile, 0, reduced);

  projectile.add([
    aura,
    wakeOuter,
    wakeColor,
    wakeCore,
    shellShadow,
    shell,
    innerBody,
    coreSpine,
    helix,
    noseOuter,
    noseCore,
    nosePoint
  ]);

  return { projectile, helix, length, radius, profile };
}

async function flySpiralBolt(
  options: DirectionalProjectileOptions,
  built: SpiralBolt,
  tier: FxTier,
  reduced: boolean
): Promise<void> {
  const duration = travelDuration(options, tier);
  const trail = new RecentTrail(options.scene, built.profile, tier, reduced);
  const phase = { value: 0 };
  trail.push(built.projectile.x, built.projectile.y);

  const move = tween(options.scene, built.projectile, {
    x: options.target.x,
    y: options.target.y,
    duration,
    ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut',
    onUpdate: () => trail.push(built.projectile.x, built.projectile.y)
  }, duration + 300);

  const spiral = tween(options.scene, phase, {
    value: Math.PI * (reduced ? 5 : 7),
    duration,
    ease: 'Linear',
    onUpdate: () => drawHelix(built.helix, built.length, built.radius, built.profile, phase.value, reduced)
  }, duration + 300);

  try {
    await Promise.all([move, spiral]);
  } finally {
    built.projectile.destroy(true);
  }
  await trail.fade(options.scene);
}

async function playDrillImpact(options: DirectionalProjectileOptions, reduced: boolean): Promise<void> {
  const { scene, target, source, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const r = reduced ? 34 : 46;
  const impact = scene.add.container(target.x, target.y)
    .setDepth(powVfxDepth('foreground') + 6)
    .setRotation(angle)
    .setScale(0.45);

  impact.add([
    scene.add.ellipse(0, 0, r * 2.8, r * 0.9, profile.color, reduced ? 0.16 : 0.24),
    scene.add.rectangle(0, 0, r * 3.0, reduced ? 8 : 11, profile.color, 0.82),
    scene.add.rectangle(0, 0, r * 2.25, reduced ? 3 : 4, 0xffffff, 1),
    scene.add.circle(0, 0, r * 0.45, profile.core, 0.92),
    scene.add.circle(0, 0, r * 0.95, 0x000000, 0).setStrokeStyle(reduced ? 3 : 5, profile.color, 0.9),
    scene.add.circle(0, 0, r * 1.28, 0x000000, 0).setStrokeStyle(reduced ? 2 : 3, profile.core, 0.58)
  ]);

  try {
    await tween(scene, impact, {
      scaleX: reduced ? 1.05 : 1.18,
      scaleY: reduced ? 0.9 : 1.05,
      alpha: 0,
      duration: reduced ? 145 : 205,
      ease: 'Quad.easeOut'
    }, 390);
  } finally {
    impact.destroy(true);
  }
}

export function installCombat2157MarksmanSpiralBoltVfxPatch(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;
  const previous = owner.play.bind(owner) as (options: DirectionalProjectileOptions) => Promise<void>;

  owner.play = async (raw: DirectionalProjectileOptions): Promise<void> => {
    const options = raw as RoleAwareOptions;
    if (!isMarksman(options.role)) {
      await previous(raw);
      return;
    }

    const tier = fxTier();
    const reduced = Boolean(options.reducedMotion) || tier === 'lite';
    const built = buildSpiralBolt(options, reduced);
    await flySpiralBolt(options, built, tier, reduced);
    await playDrillImpact(options, reduced);
  };

  root.POWDER_COMBAT2_MARKSMAN_VFX = {
    version: '2.15.7',
    family: 'Combat2',
    finalOwner: true,
    role: 'marksman',
    form: 'axis-locked-spiral-magic-bolt',
    arrowShapeRemoved: true,
    physicalArrowHead: false,
    physicalShaft: false,
    physicalFletching: false,
    capsuleEnergyBody: true,
    roundedTaperedEnergyNose: true,
    coreSpineCenteredY0: true,
    allStructuralPartsCenteredY0: true,
    singleSourceTargetRotation: true,
    rotatingHelixContainer: false,
    helixMethod: 'dual-sine-lines-redrawn-by-phase',
    helixRunsAlongBodyAxis: true,
    worldTrailUsesActualProjectilePosition: true,
    recentTrailPoints: { full: 17, balanced: 14, lite: 10 },
    trailLayers: ['pressure-glow', 'element-line', 'white-core'],
    impact: 'drill-pierce-streak+concentric-burst',
    noFullPathBeam: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    finiteTweensOnly: true,
    delegatesEveryOtherRole: true,
    combatLogicChanged: false
  };
}

installCombat2157MarksmanSpiralBoltVfxPatch();
