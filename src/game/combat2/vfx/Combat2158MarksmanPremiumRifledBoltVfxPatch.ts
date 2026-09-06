import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2158MarksmanPremiumRifledBoltInstalled';

type FxTier = 'full' | 'balanced' | 'lite';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };
type ElementProfile = { color: number; core: number; shadow: number };

const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff7043, core: 0xfff3bd, shadow: 0x8f2919 },
  lava: { color: 0xff4f2e, core: 0xffd05b, shadow: 0x742114 },
  water: { color: 0x4db9ff, core: 0xe8fbff, shadow: 0x145c8c },
  ice: { color: 0x8adfff, core: 0xffffff, shadow: 0x347f9c },
  lightning: { color: 0xf5dd62, core: 0xffffff, shadow: 0x9b7111 },
  storm: { color: 0x78a9ff, core: 0xedf2ff, shadow: 0x3a539c },
  wind: { color: 0x76e4d2, core: 0xf2fffd, shadow: 0x267f75 },
  leaf: { color: 0x72d67f, core: 0xecffe5, shadow: 0x34713c },
  poison: { color: 0xa5df66, core: 0xf2ffcc, shadow: 0x496f25 },
  earth: { color: 0xb78c5d, core: 0xffe8c8, shadow: 0x654a35 },
  steel: { color: 0xc3d3dc, core: 0xffffff, shadow: 0x5b6d78 },
  light: { color: 0xffefad, core: 0xffffff, shadow: 0xb99748 },
  dark: { color: 0xa88cf2, core: 0xf2ecff, shadow: 0x4d3072 },
  neutral: { color: 0x9ed8e8, core: 0xffffff, shadow: 0x426f7c }
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

class PremiumTrajectoryTrail {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly points: Array<{ x: number; y: number }> = [];
  private readonly maxPoints: number;

  constructor(
    scene: Phaser.Scene,
    private readonly profile: ElementProfile,
    tier: FxTier,
    private readonly reduced: boolean
  ) {
    this.graphics = scene.add.graphics()
      .setDepth(powVfxDepth('foreground') + 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.maxPoints = reduced ? 10 : tier === 'balanced' ? 15 : 18;
  }

  push(x: number, y: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 4) return;
    this.points.push({ x, y });
    while (this.points.length > this.maxPoints) this.points.shift();
    this.redraw();
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();
    if (this.points.length < 2) return;

    for (let index = 1; index < this.points.length; index += 1) {
      const from = this.points[index - 1];
      const to = this.points[index];
      const freshness = index / Math.max(1, this.points.length - 1);
      const life = Math.max(0.035, freshness * freshness * freshness);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const sideOffset = (this.reduced ? 2.5 : 4.5) * freshness;

      g.lineStyle(this.reduced ? 15 : 22, this.profile.color, (this.reduced ? 0.12 : 0.2) * life);
      g.lineBetween(from.x, from.y, to.x, to.y);
      g.lineStyle(this.reduced ? 7 : 10, this.profile.color, (this.reduced ? 0.4 : 0.68) * life);
      g.lineBetween(from.x, from.y, to.x, to.y);
      g.lineStyle(this.reduced ? 2 : 3.5, this.profile.core, (this.reduced ? 0.66 : 0.98) * life);
      g.lineBetween(from.x, from.y, to.x, to.y);

      if (!this.reduced && index >= Math.max(1, this.points.length - 8)) {
        const sideAlpha = 0.23 * life;
        g.lineStyle(1.5, this.profile.core, sideAlpha);
        g.lineBetween(
          from.x + nx * sideOffset,
          from.y + ny * sideOffset,
          to.x + nx * sideOffset,
          to.y + ny * sideOffset
        );
        g.lineBetween(
          from.x - nx * sideOffset,
          from.y - ny * sideOffset,
          to.x - nx * sideOffset,
          to.y - ny * sideOffset
        );
      }
    }
  }

  async fade(scene: Phaser.Scene): Promise<void> {
    try {
      await tween(scene, this.graphics, {
        alpha: 0,
        duration: this.reduced ? 90 : 135,
        ease: 'Quad.easeOut'
      }, 280);
    } finally {
      this.graphics.destroy();
    }
  }
}

type PremiumBolt = {
  projectile: Phaser.GameObjects.Container;
  helixBack: Phaser.GameObjects.Graphics;
  helixGlow: Phaser.GameObjects.Graphics;
  helixFront: Phaser.GameObjects.Graphics;
  helixCore: Phaser.GameObjects.Graphics;
  nodes: Phaser.GameObjects.Arc[];
  auraOuter: Phaser.GameObjects.Shape;
  auraMid: Phaser.GameObjects.Shape;
  length: number;
  radius: number;
  profile: ElementProfile;
};

function drawPremiumHelix(
  built: PremiumBolt,
  phase: number,
  reduced: boolean
): void {
  const { helixBack, helixGlow, helixFront, helixCore, length, radius, profile } = built;
  helixBack.clear();
  helixGlow.clear();
  helixFront.clear();
  helixCore.clear();

  helixBack.lineStyle(reduced ? 2 : 3, profile.shadow, reduced ? 0.42 : 0.58);
  helixGlow.lineStyle(reduced ? 5 : 8, profile.color, reduced ? 0.1 : 0.18);
  helixFront.lineStyle(reduced ? 2.5 : 4, profile.color, reduced ? 0.68 : 0.95);
  helixCore.lineStyle(reduced ? 1 : 1.8, profile.core, reduced ? 0.58 : 0.94);

  const startX = -length * 0.39;
  const endX = length * 0.34;
  const samples = reduced ? 18 : 30;
  const turns = reduced ? 2.4 : 3.15;
  const amplitude = radius * (reduced ? 0.52 : 0.67);

  const drawRibbon = (phaseOffset: number): void => {
    let previous: { x: number; y: number } | null = null;
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      const x = Phaser.Math.Linear(startX, endX, t);
      const envelope = Math.sin(Math.PI * t);
      const y = Math.sin((Math.PI * 2 * turns * t) + phase + phaseOffset) * amplitude * envelope;
      if (previous) {
        const front = (previous.y + y) * 0.5 >= 0;
        if (front) {
          helixGlow.lineBetween(previous.x, previous.y, x, y);
          helixFront.lineBetween(previous.x, previous.y, x, y);
          helixCore.lineBetween(previous.x, previous.y, x, y);
        } else {
          helixBack.lineBetween(previous.x, previous.y, x, y);
        }
      }
      previous = { x, y };
    }
  };

  drawRibbon(0);
  drawRibbon(Math.PI);

  const nodeT = reduced ? [0.32, 0.66] : [0.24, 0.5, 0.76];
  built.nodes.forEach((node, index) => {
    const t = nodeT[index] ?? 0.5;
    const x = Phaser.Math.Linear(startX, endX, t);
    const envelope = Math.sin(Math.PI * t);
    const ribbonPhase = index % 2 === 0 ? 0 : Math.PI;
    const y = Math.sin((Math.PI * 2 * turns * t) + phase + ribbonPhase) * amplitude * envelope;
    const frontness = Phaser.Math.Clamp((y / Math.max(1, amplitude) + 1) * 0.5, 0, 1);
    node.setPosition(x, y);
    node.setAlpha((reduced ? 0.52 : 0.66) + frontness * (reduced ? 0.22 : 0.32));
    node.setScale((reduced ? 0.72 : 0.82) + frontness * 0.22);
  });
}

function buildPremiumBolt(options: DirectionalProjectileOptions, reduced: boolean): PremiumBolt {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const length = reduced ? 146 : 184;
  const radius = reduced ? 23 : 31;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 5)
    .setRotation(angle);

  const helixBack = scene.add.graphics();
  const helixGlow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const helixFront = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const helixCore = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

  const auraOuter = scene.add.ellipse(
    -length * 0.04,
    0,
    length * 1.22,
    radius * 2.45,
    profile.color,
    reduced ? 0.045 : 0.075
  ).setBlendMode(Phaser.BlendModes.ADD);
  const auraMid = scene.add.ellipse(
    -length * 0.015,
    0,
    length * 1.04,
    radius * 1.72,
    profile.color,
    reduced ? 0.085 : 0.14
  ).setBlendMode(Phaser.BlendModes.ADD);

  const rearAura = scene.add.ellipse(
    -length * 0.48,
    0,
    length * 0.52,
    radius * 1.2,
    profile.color,
    reduced ? 0.06 : 0.11
  ).setBlendMode(Phaser.BlendModes.ADD);
  const rearColor = scene.add.ellipse(
    -length * 0.455,
    0,
    length * 0.42,
    radius * 0.62,
    profile.color,
    reduced ? 0.22 : 0.38
  ).setBlendMode(Phaser.BlendModes.ADD);
  const rearCore = scene.add.rectangle(
    -length * 0.445,
    0,
    length * 0.31,
    reduced ? 3 : 4,
    profile.core,
    reduced ? 0.55 : 0.84
  ).setBlendMode(Phaser.BlendModes.ADD);

  const rearCap = scene.add.ellipse(-length * 0.38, 0, radius * 0.94, radius * 0.86, profile.shadow, 0.78);
  const bodyShadow = scene.add.ellipse(-length * 0.045, 0, length * 0.92, radius * 1.33, profile.shadow, 0.72);
  const bodyShell = scene.add.ellipse(-length * 0.005, 0, length * 0.86, radius * 1.08, profile.color, 0.92);
  const innerGlow = scene.add.ellipse(
    length * 0.02,
    0,
    length * 0.7,
    radius * 0.69,
    profile.core,
    reduced ? 0.66 : 0.82
  ).setBlendMode(Phaser.BlendModes.ADD);
  const coreHalo = scene.add.rectangle(
    length * 0.025,
    0,
    length * 0.66,
    reduced ? 8 : 11,
    profile.core,
    reduced ? 0.13 : 0.2
  ).setBlendMode(Phaser.BlendModes.ADD);
  const coreSpine = scene.add.rectangle(
    length * 0.035,
    0,
    length * 0.59,
    reduced ? 3 : 4,
    0xffffff,
    0.98
  ).setBlendMode(Phaser.BlendModes.ADD);

  const upperSpec = scene.add.ellipse(
    length * 0.04,
    -radius * 0.2,
    length * 0.47,
    radius * 0.15,
    0xffffff,
    reduced ? 0.24 : 0.38
  ).setBlendMode(Phaser.BlendModes.ADD);
  const lowerShade = scene.add.ellipse(
    length * 0.01,
    radius * 0.22,
    length * 0.42,
    radius * 0.13,
    profile.shadow,
    0.28
  );

  const ribXs = reduced
    ? [-length * 0.16, length * 0.14]
    : [-length * 0.2, length * 0.04, length * 0.27];
  const ribs = ribXs.map((x, index) => scene.add.ellipse(
    x,
    0,
    radius * (index === 1 ? 0.48 : 0.42),
    radius * (index === 1 ? 1.48 : 1.35),
    0x000000,
    0
  ).setStrokeStyle(
    reduced ? 1.5 : 2,
    index === 1 ? profile.core : profile.color,
    reduced ? 0.2 : 0.34
  ).setBlendMode(Phaser.BlendModes.ADD));

  const noseAura = scene.add.ellipse(
    length * 0.39,
    0,
    radius * 1.92,
    radius * 1.56,
    profile.color,
    reduced ? 0.08 : 0.15
  ).setBlendMode(Phaser.BlendModes.ADD);
  const noseShadow = scene.add.ellipse(length * 0.375, 0, radius * 1.56, radius * 1.2, profile.shadow, 0.72);
  const noseShell = scene.add.ellipse(length * 0.397, 0, radius * 1.36, radius * 1.02, profile.color, 1);
  const noseCore = scene.add.ellipse(
    length * 0.425,
    0,
    radius * 0.82,
    radius * 0.62,
    profile.core,
    1
  ).setBlendMode(Phaser.BlendModes.ADD);
  const nosePoint = scene.add.circle(
    length * 0.462,
    0,
    reduced ? 4.5 : 6,
    0xffffff,
    1
  ).setBlendMode(Phaser.BlendModes.ADD);

  const nodeCount = reduced ? 2 : 3;
  const nodes = Array.from({ length: nodeCount }, (_, index) => scene.add.circle(
    0,
    0,
    reduced ? 3 : index === 1 ? 5 : 4,
    index === 1 ? profile.core : 0xffffff,
    0.9
  ).setBlendMode(Phaser.BlendModes.ADD));

  projectile.add([
    auraOuter,
    auraMid,
    rearAura,
    rearColor,
    rearCore,
    helixBack,
    rearCap,
    bodyShadow,
    bodyShell,
    lowerShade,
    innerGlow,
    coreHalo,
    coreSpine,
    upperSpec,
    ...ribs,
    helixGlow,
    helixFront,
    helixCore,
    ...nodes,
    noseAura,
    noseShadow,
    noseShell,
    noseCore,
    nosePoint
  ]);

  const built: PremiumBolt = {
    projectile,
    helixBack,
    helixGlow,
    helixFront,
    helixCore,
    nodes,
    auraOuter,
    auraMid,
    length,
    radius,
    profile
  };
  drawPremiumHelix(built, 0, reduced);
  return built;
}

async function flyPremiumBolt(
  options: DirectionalProjectileOptions,
  built: PremiumBolt,
  tier: FxTier,
  reduced: boolean
): Promise<void> {
  const duration = travelDuration(options, tier);
  const trail = new PremiumTrajectoryTrail(options.scene, built.profile, tier, reduced);
  const phase = { value: 0 };
  trail.push(built.projectile.x, built.projectile.y);

  const move = tween(options.scene, built.projectile, {
    x: options.target.x,
    y: options.target.y,
    duration,
    ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut',
    onUpdate: () => trail.push(built.projectile.x, built.projectile.y)
  }, duration + 320);

  const rifling = tween(options.scene, phase, {
    value: Math.PI * (reduced ? 5.5 : 8.5),
    duration,
    ease: 'Linear',
    onUpdate: () => {
      drawPremiumHelix(built, phase.value, reduced);
      const pulse = 0.5 + 0.5 * Math.sin(phase.value * 0.72);
      built.auraOuter.setAlpha((reduced ? 0.04 : 0.062) + pulse * (reduced ? 0.018 : 0.036));
      built.auraMid.setScale(1, 1 + pulse * (reduced ? 0.025 : 0.05));
    }
  }, duration + 320);

  try {
    await Promise.all([move, rifling]);
  } finally {
    built.projectile.destroy(true);
  }
  await trail.fade(options.scene);
}

async function playPremiumImpact(options: DirectionalProjectileOptions, reduced: boolean): Promise<void> {
  const { scene, target, source, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const r = reduced ? 36 : 50;
  const root = scene.add.container(target.x, target.y)
    .setDepth(powVfxDepth('foreground') + 7)
    .setRotation(angle)
    .setScale(0.38);
  const drill = scene.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);

  const flash = scene.add.ellipse(0, 0, r * 3.2, r * 1.0, profile.color, reduced ? 0.12 : 0.2)
    .setBlendMode(Phaser.BlendModes.ADD);
  const pierceColor = scene.add.rectangle(0, 0, r * 3.5, reduced ? 8 : 11, profile.color, 0.85)
    .setBlendMode(Phaser.BlendModes.ADD);
  const pierceCore = scene.add.rectangle(0, 0, r * 2.55, reduced ? 2.5 : 4, 0xffffff, 1)
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.circle(0, 0, r * 0.4, profile.core, 0.92)
    .setBlendMode(Phaser.BlendModes.ADD);
  const ring1 = scene.add.circle(0, 0, r * 0.92, 0x000000, 0)
    .setStrokeStyle(reduced ? 3 : 5, profile.color, 0.92)
    .setBlendMode(Phaser.BlendModes.ADD);
  const ring2 = scene.add.circle(0, 0, r * 1.26, 0x000000, 0)
    .setStrokeStyle(reduced ? 1.5 : 2.5, profile.core, 0.58)
    .setBlendMode(Phaser.BlendModes.ADD);

  const arcCount = reduced ? 2 : 3;
  for (let index = 0; index < arcCount; index += 1) {
    drill.add(scene.add.arc(
      0,
      0,
      r * (0.64 + index * 0.18),
      -32 + index * 24,
      46 + index * 24,
      false,
      0x000000,
      0
    ).setStrokeStyle(
      reduced ? 2 : 3,
      index % 2 === 0 ? profile.core : profile.color,
      reduced ? 0.58 : 0.82
    ));
  }

  const spokes = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  spokes.lineStyle(reduced ? 1.5 : 2.5, profile.core, reduced ? 0.42 : 0.64);
  const spokeCount = reduced ? 4 : 6;
  for (let index = 0; index < spokeCount; index += 1) {
    const a = (Math.PI * 2 * index) / spokeCount;
    spokes.lineBetween(
      Math.cos(a) * r * 0.32,
      Math.sin(a) * r * 0.32,
      Math.cos(a) * r * 1.15,
      Math.sin(a) * r * 1.15
    );
  }

  root.add([flash, pierceColor, pierceCore, core, ring1, ring2, spokes, drill]);
  if (!reduced) scene.cameras.main.shake(85, 0.0015);

  try {
    await Promise.all([
      tween(scene, root, {
        scaleX: reduced ? 1.02 : 1.18,
        scaleY: reduced ? 0.92 : 1.05,
        alpha: 0,
        duration: reduced ? 150 : 210,
        ease: 'Quad.easeOut'
      }, 400),
      tween(scene, drill, {
        angle: reduced ? 90 : 150,
        scaleX: reduced ? 1.05 : 1.25,
        scaleY: reduced ? 1.05 : 1.25,
        duration: reduced ? 145 : 205,
        ease: 'Quad.easeOut'
      }, 390)
    ]);
  } finally {
    root.destroy(true);
  }
}

export function installCombat2158MarksmanPremiumRifledBoltVfxPatch(): void {
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
    const built = buildPremiumBolt(options, reduced);
    await flyPremiumBolt(options, built, tier, reduced);
    await playPremiumImpact(options, reduced);
  };

  root.POWDER_COMBAT2_MARKSMAN_VFX = {
    version: '2.15.8',
    family: 'Combat2',
    finalOwner: true,
    role: 'marksman',
    delegatesEveryOtherRole: true,
    form: 'premium-rifled-spiral-energy-bolt',
    arrowShapeRemoved: true,
    physicalArrowHead: false,
    physicalShaft: false,
    physicalFletching: false,
    premiumBody: {
      layeredBloom: true,
      outerGlowLayer: true,
      innerGlowLayer: true,
      darkContrastShell: true,
      whiteCoreSpine: true,
      pairedSpecularDepth: true,
      energyCompressionRibs: true,
      roundedEnergyNose: true
    },
    rifling: {
      method: 'front-back-dual-helix-with-local-energy-nodes',
      frontBackDepthSeparation: true,
      helixContainerRotation: false,
      phaseRedrawOnly: true,
      finitePhaseTween: true
    },
    trajectory: {
      usesActualProjectilePosition: true,
      points: { full: 18, balanced: 15, lite: 10 },
      cubicLifetimeFade: true,
      threeLayerCore: true,
      twinRecentSideWispsFullOnly: true,
      noFullPathBeam: true
    },
    impact: 'rifled-pierce-flash+rotating-drill-arcs+finite-rings',
    additiveGlowLayers: true,
    adaptiveDetailTier: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    finiteTweensOnly: true,
    inspirationMethod: 'conceptual-reference-only-no-source-code-copy',
    combatLogicChanged: false
  };
}

installCombat2158MarksmanPremiumRifledBoltVfxPatch();
