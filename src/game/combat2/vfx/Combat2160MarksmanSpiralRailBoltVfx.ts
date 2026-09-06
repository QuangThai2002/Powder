import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2160_MARKSMAN_VERSION = '2.16.0';

type FxTier = 'full' | 'balanced' | 'lite';
type MarksmanOptions = DirectionalProjectileOptions & { role?: string };
type ElementProfile = { color: number; core: number; dark: number };

const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff6b3d, core: 0xfff0b4, dark: 0x7b2619 },
  lava: { color: 0xff4c28, core: 0xffcf58, dark: 0x691f13 },
  water: { color: 0x43b6ff, core: 0xeafbff, dark: 0x155a86 },
  ice: { color: 0x82ddff, core: 0xffffff, dark: 0x307991 },
  lightning: { color: 0xf5df5d, core: 0xffffff, dark: 0x8d6710 },
  storm: { color: 0x739fff, core: 0xf2f5ff, dark: 0x394d91 },
  wind: { color: 0x69e3d3, core: 0xf5fffd, dark: 0x24776d },
  leaf: { color: 0x6bd779, core: 0xf0ffe8, dark: 0x326d39 },
  poison: { color: 0xa1df60, core: 0xf6ffd5, dark: 0x466c22 },
  earth: { color: 0xba8c5a, core: 0xffe8c2, dark: 0x624932 },
  steel: { color: 0xc6d8e2, core: 0xffffff, dark: 0x566a76 },
  light: { color: 0xffed9f, core: 0xffffff, dark: 0xa88d3e },
  dark: { color: 0xa482f3, core: 0xf4edff, dark: 0x482d6d },
  neutral: { color: 0x97d9e9, core: 0xffffff, dark: 0x3f6e79 }
});

function fxTier(): FxTier {
  const raw = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return raw === 'lite' || raw === 'balanced' ? raw : 'full';
}

function travelDuration(options: MarksmanOptions, tier: FxTier): number {
  const requested = Number(options.durationMs || 0);
  if (requested > 0) return Phaser.Math.Clamp(Math.round(requested * 1.82), 390, 650);
  const distance = Phaser.Math.Distance.Between(
    options.source.x,
    options.source.y,
    options.target.x,
    options.target.y
  );
  const base = tier === 'lite' ? 400 : tier === 'balanced' ? 445 : 480;
  const distanceAdd = Math.min(tier === 'full' ? 80 : 60, distance * 0.055);
  return Phaser.Math.Clamp(Math.round(base + distanceAdd), 390, 590);
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
      try { tw?.stop(); } catch { /* scene teardown owns the tween */ }
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

class RailTrail {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly points: Array<{ x: number; y: number }> = [];
  private readonly maxPoints: number;
  private readonly sideWispCount: number;

  constructor(
    scene: Phaser.Scene,
    private readonly profile: ElementProfile,
    tier: FxTier,
    private readonly reduced: boolean
  ) {
    this.graphics = scene.add.graphics()
      .setDepth(powVfxDepth('foreground') + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.maxPoints = reduced ? 9 : tier === 'balanced' ? 13 : 16;
    this.sideWispCount = reduced ? 0 : tier === 'balanced' ? 5 : 7;
  }

  push(x: number, y: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 3.8) return;
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
      const life = Math.max(0.025, Math.pow(freshness, 2.7));
      const outerWidth = (this.reduced ? 12 : 18) * (0.45 + freshness * 0.55);
      const colorWidth = (this.reduced ? 6 : 9) * (0.45 + freshness * 0.55);
      const coreWidth = (this.reduced ? 2 : 3.2) * (0.5 + freshness * 0.5);

      g.lineStyle(outerWidth, this.profile.color, (this.reduced ? 0.08 : 0.14) * life);
      g.lineBetween(from.x, from.y, to.x, to.y);
      g.lineStyle(colorWidth, this.profile.color, (this.reduced ? 0.34 : 0.58) * life);
      g.lineBetween(from.x, from.y, to.x, to.y);
      g.lineStyle(coreWidth, this.profile.core, (this.reduced ? 0.7 : 0.98) * life);
      g.lineBetween(from.x, from.y, to.x, to.y);
    }

    if (this.sideWispCount <= 0) return;
    const start = Math.max(1, this.points.length - this.sideWispCount);
    for (let index = start; index < this.points.length; index += 1) {
      const from = this.points[index - 1];
      const to = this.points[index];
      const freshness = index / Math.max(1, this.points.length - 1);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      const wave = Math.sin(index * 1.45) * (2.2 + freshness * 2.8);
      const alpha = 0.11 + freshness * 0.23;

      g.lineStyle(1.35, this.profile.core, alpha);
      g.lineBetween(
        from.x + nx * wave,
        from.y + ny * wave,
        to.x - nx * wave,
        to.y - ny * wave
      );
      g.lineBetween(
        from.x - nx * wave,
        from.y - ny * wave,
        to.x + nx * wave,
        to.y + ny * wave
      );
    }
  }

  async fade(scene: Phaser.Scene): Promise<void> {
    try {
      await tween(scene, this.graphics, {
        alpha: 0,
        duration: this.reduced ? 80 : 115,
        ease: 'Quad.easeOut'
      }, 250);
    } finally {
      this.graphics.destroy();
    }
  }
}

type RailBolt = {
  root: Phaser.GameObjects.Container;
  helixBack: Phaser.GameObjects.Graphics;
  helixGlow: Phaser.GameObjects.Graphics;
  helixFront: Phaser.GameObjects.Graphics;
  helixCore: Phaser.GameObjects.Graphics;
  profile: ElementProfile;
  length: number;
  radius: number;
};

function drawTaperedPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: Array<{ x: number; y: number }>,
  color: number,
  alpha: number
): void {
  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.closePath();
  graphics.fillPath();
}

function drawRailBody(
  graphics: Phaser.GameObjects.Graphics,
  length: number,
  radius: number,
  profile: ElementProfile,
  reduced: boolean
): void {
  graphics.clear();

  const outer = [
    { x: -length * 0.45, y: -radius * 0.24 },
    { x: -length * 0.32, y: -radius * 0.66 },
    { x: length * 0.14, y: -radius * 0.58 },
    { x: length * 0.35, y: -radius * 0.31 },
    { x: length * 0.445, y: 0 },
    { x: length * 0.35, y: radius * 0.31 },
    { x: length * 0.14, y: radius * 0.58 },
    { x: -length * 0.32, y: radius * 0.66 },
    { x: -length * 0.45, y: radius * 0.24 }
  ];
  drawTaperedPolygon(graphics, outer, profile.dark, 0.9);

  const shell = outer.map((point) => ({
    x: point.x + length * 0.015,
    y: point.y * 0.8
  }));
  drawTaperedPolygon(graphics, shell, profile.color, 0.96);

  const inner = [
    { x: -length * 0.32, y: -radius * 0.2 },
    { x: -length * 0.18, y: -radius * 0.34 },
    { x: length * 0.23, y: -radius * 0.27 },
    { x: length * 0.365, y: 0 },
    { x: length * 0.23, y: radius * 0.27 },
    { x: -length * 0.18, y: radius * 0.34 },
    { x: -length * 0.32, y: radius * 0.2 }
  ];
  drawTaperedPolygon(graphics, inner, profile.core, reduced ? 0.58 : 0.72);

  graphics.lineStyle(reduced ? 1.4 : 2.1, 0xffffff, reduced ? 0.42 : 0.68);
  graphics.beginPath();
  graphics.moveTo(-length * 0.25, -radius * 0.29);
  graphics.lineTo(length * 0.19, -radius * 0.22);
  graphics.lineTo(length * 0.35, -radius * 0.08);
  graphics.strokePath();

  graphics.lineStyle(reduced ? 1 : 1.5, profile.dark, 0.6);
  graphics.beginPath();
  graphics.moveTo(-length * 0.24, radius * 0.34);
  graphics.lineTo(length * 0.2, radius * 0.27);
  graphics.strokePath();
}

function drawRifling(bolt: RailBolt, phase: number, reduced: boolean, tier: FxTier): void {
  const { helixBack, helixGlow, helixFront, helixCore, length, radius, profile } = bolt;
  helixBack.clear();
  helixGlow.clear();
  helixFront.clear();
  helixCore.clear();

  const samples = reduced ? 18 : tier === 'balanced' ? 26 : 32;
  const turns = reduced ? 1.75 : tier === 'balanced' ? 2.05 : 2.25;
  const startX = -length * 0.34;
  const endX = length * 0.335;
  const amplitude = radius * (reduced ? 0.44 : 0.52);

  for (const phaseOffset of [0, Math.PI]) {
    let previous: { x: number; y: number; depth: number } | null = null;
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      const theta = Math.PI * 2 * turns * t + phase + phaseOffset;
      const envelope = Math.sin(Math.PI * t);
      const x = Phaser.Math.Linear(startX, endX, t);
      const y = Math.sin(theta) * amplitude * envelope;
      const depth = Math.cos(theta);

      if (previous) {
        const front = (previous.depth + depth) * 0.5 >= 0;
        if (front) {
          helixGlow.lineStyle(reduced ? 4 : 7, profile.color, reduced ? 0.08 : 0.16);
          helixGlow.lineBetween(previous.x, previous.y, x, y);
          helixFront.lineStyle(reduced ? 2.2 : 3.4, profile.color, reduced ? 0.62 : 0.94);
          helixFront.lineBetween(previous.x, previous.y, x, y);
          helixCore.lineStyle(reduced ? 0.9 : 1.35, profile.core, reduced ? 0.66 : 0.96);
          helixCore.lineBetween(previous.x, previous.y, x, y);
        } else {
          helixBack.lineStyle(reduced ? 1.5 : 2.2, profile.dark, reduced ? 0.38 : 0.6);
          helixBack.lineBetween(previous.x, previous.y, x, y);
        }
      }
      previous = { x, y, depth };
    }
  }
}

function buildRailBolt(options: MarksmanOptions, reduced: boolean, tier: FxTier): RailBolt {
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const length = reduced ? 138 : tier === 'balanced' ? 162 : 176;
  const radius = reduced ? 19 : tier === 'balanced' ? 22 : 24;
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 6)
    .setRotation(angle);

  const auraOuter = options.scene.add.ellipse(
    -length * 0.03,
    0,
    length * 1.16,
    radius * 2.1,
    profile.color,
    reduced ? 0.035 : 0.065
  ).setBlendMode(Phaser.BlendModes.ADD);
  const auraInner = options.scene.add.ellipse(
    length * 0.015,
    0,
    length * 0.94,
    radius * 1.35,
    profile.color,
    reduced ? 0.07 : 0.12
  ).setBlendMode(Phaser.BlendModes.ADD);

  const rearGlow = options.scene.add.ellipse(
    -length * 0.49,
    0,
    length * 0.36,
    radius * 0.84,
    profile.color,
    reduced ? 0.08 : 0.15
  ).setBlendMode(Phaser.BlendModes.ADD);
  const rearCore = options.scene.add.rectangle(
    -length * 0.47,
    0,
    length * 0.25,
    reduced ? 2.5 : 3.5,
    profile.core,
    reduced ? 0.54 : 0.82
  ).setBlendMode(Phaser.BlendModes.ADD);

  const pressure1 = options.scene.add.ellipse(-length * 0.39, 0, reduced ? 8 : 11, radius * 1.34, 0x000000, 0)
    .setStrokeStyle(reduced ? 1.4 : 2.1, profile.color, reduced ? 0.3 : 0.52)
    .setBlendMode(Phaser.BlendModes.ADD);
  const pressure2 = options.scene.add.ellipse(-length * 0.45, 0, reduced ? 7 : 9, radius * 1.06, 0x000000, 0)
    .setStrokeStyle(reduced ? 1 : 1.5, profile.core, reduced ? 0.28 : 0.42)
    .setBlendMode(Phaser.BlendModes.ADD);

  const helixBack = options.scene.add.graphics();
  const body = options.scene.add.graphics();
  drawRailBody(body, length, radius, profile, reduced);

  const railGlow = options.scene.add.rectangle(
    length * 0.02,
    0,
    length * 0.62,
    reduced ? 6 : 8,
    profile.core,
    reduced ? 0.1 : 0.16
  ).setBlendMode(Phaser.BlendModes.ADD);
  const railCore = options.scene.add.rectangle(
    length * 0.035,
    0,
    length * 0.59,
    reduced ? 2 : 3,
    0xffffff,
    0.98
  ).setBlendMode(Phaser.BlendModes.ADD);

  const sideRails = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  sideRails.lineStyle(reduced ? 1 : 1.6, profile.core, reduced ? 0.28 : 0.46);
  sideRails.lineBetween(-length * 0.24, -radius * 0.38, length * 0.25, -radius * 0.25);
  sideRails.lineBetween(-length * 0.24, radius * 0.38, length * 0.25, radius * 0.25);

  const helixGlow = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const helixFront = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const helixCore = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

  const noseHalo = options.scene.add.ellipse(
    length * 0.405,
    0,
    radius * 1.35,
    radius * 1.18,
    profile.color,
    reduced ? 0.12 : 0.22
  ).setBlendMode(Phaser.BlendModes.ADD);
  const noseCore = options.scene.add.ellipse(
    length * 0.414,
    0,
    radius * 0.72,
    radius * 0.6,
    profile.core,
    0.94
  ).setBlendMode(Phaser.BlendModes.ADD);
  const noseHot = options.scene.add.circle(
    length * 0.425,
    0,
    reduced ? 3.8 : 5.2,
    0xffffff,
    1
  ).setBlendMode(Phaser.BlendModes.ADD);

  root.add([
    rearGlow,
    rearCore,
    pressure2,
    pressure1,
    auraOuter,
    helixBack,
    body,
    railGlow,
    railCore,
    sideRails,
    helixGlow,
    helixFront,
    helixCore,
    auraInner,
    noseHalo,
    noseCore,
    noseHot
  ]);

  const bolt: RailBolt = { root, helixBack, helixGlow, helixFront, helixCore, profile, length, radius };
  drawRifling(bolt, 0, reduced, tier);
  return bolt;
}

async function playCharge(options: MarksmanOptions, reduced: boolean): Promise<void> {
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const ring = options.scene.add.circle(options.source.x, options.source.y, reduced ? 25 : 34, 0x000000, 0)
    .setDepth(powVfxDepth('foreground') + 5)
    .setStrokeStyle(reduced ? 2 : 3.5, profile.color, reduced ? 0.62 : 0.86)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(1.35);
  const core = options.scene.add.circle(options.source.x, options.source.y, reduced ? 5 : 7, profile.core, 0.86)
    .setDepth(powVfxDepth('foreground') + 6)
    .setBlendMode(Phaser.BlendModes.ADD);
  try {
    await Promise.all([
      tween(options.scene, ring, {
        scale: 0.58,
        alpha: 0,
        duration: reduced ? 75 : 105,
        ease: 'Quad.easeIn'
      }, 230),
      tween(options.scene, core, {
        scale: 1.5,
        alpha: 0,
        duration: reduced ? 70 : 100,
        ease: 'Quad.easeOut'
      }, 220)
    ]);
  } finally {
    ring.destroy();
    core.destroy();
  }
}

async function playPierceImpact(options: MarksmanOptions, reduced: boolean): Promise<void> {
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const radius = reduced ? 31 : 42;
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 8)
    .setRotation(angle)
    .setScale(0.46);

  const flash = options.scene.add.ellipse(0, 0, radius * 2.8, radius * 0.88, profile.color, reduced ? 0.18 : 0.28)
    .setBlendMode(Phaser.BlendModes.ADD);
  const pierceGlow = options.scene.add.rectangle(radius * 0.2, 0, radius * 3.2, reduced ? 7 : 10, profile.color, 0.78)
    .setBlendMode(Phaser.BlendModes.ADD);
  const pierceCore = options.scene.add.rectangle(radius * 0.28, 0, radius * 2.7, reduced ? 2.4 : 3.4, 0xffffff, 1)
    .setBlendMode(Phaser.BlendModes.ADD);
  const ring = options.scene.add.circle(0, 0, radius * 0.82, 0x000000, 0)
    .setStrokeStyle(reduced ? 2.5 : 4, profile.color, 0.9)
    .setBlendMode(Phaser.BlendModes.ADD);

  const drill = options.scene.add.container(0, 0);
  const arcCount = reduced ? 2 : 3;
  for (let index = 0; index < arcCount; index += 1) {
    drill.add(options.scene.add.arc(
      0,
      0,
      radius * (0.58 + index * 0.16),
      -46 + index * 28,
      42 + index * 28,
      false,
      0x000000,
      0
    ).setStrokeStyle(
      reduced ? 1.8 : 2.6,
      index % 2 === 0 ? profile.core : profile.color,
      reduced ? 0.5 : 0.78
    ).setBlendMode(Phaser.BlendModes.ADD));
  }

  root.add([flash, pierceGlow, pierceCore, ring, drill]);
  try {
    await Promise.all([
      tween(options.scene, root, {
        scaleX: reduced ? 1.02 : 1.2,
        scaleY: reduced ? 0.9 : 1.05,
        alpha: 0,
        duration: reduced ? 135 : 185,
        ease: 'Quad.easeOut'
      }, 360),
      tween(options.scene, drill, {
        angle: reduced ? 70 : 125,
        scale: reduced ? 1.04 : 1.18,
        duration: reduced ? 125 : 175,
        ease: 'Quad.easeOut'
      }, 350)
    ]);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2160MarksmanSpiralRailBoltVfx(options: MarksmanOptions): Promise<void> {
  const tier = fxTier();
  const reduced = Boolean(options.reducedMotion) || tier === 'lite';
  const duration = travelDuration(options, tier);
  const bolt = buildRailBolt(options, reduced, tier);
  const trail = new RailTrail(options.scene, bolt.profile, tier, reduced);
  const phase = { value: 0 };
  trail.push(bolt.root.x, bolt.root.y);

  const charge = playCharge(options, reduced);
  const move = tween(options.scene, bolt.root, {
    x: options.target.x,
    y: options.target.y,
    duration,
    ease: 'Sine.easeInOut',
    onUpdate: () => trail.push(bolt.root.x, bolt.root.y)
  }, duration + 300);
  const rifling = tween(options.scene, phase, {
    value: Math.PI * (reduced ? 5 : 8),
    duration,
    ease: 'Linear',
    onUpdate: () => drawRifling(bolt, phase.value, reduced, tier)
  }, duration + 300);

  try {
    await Promise.all([charge, move, rifling]);
  } finally {
    bolt.root.destroy(true);
  }
  await trail.fade(options.scene);
  await playPierceImpact(options, reduced);

  (globalThis as any).POWDER_COMBAT2_MARKSMAN_DIRECT_LAST = {
    version: COMBAT2160_MARKSMAN_VERSION,
    at: Date.now(),
    element: options.element,
    source: { x: options.source.x, y: options.source.y },
    target: { x: options.target.x, y: options.target.y },
    directRuntimePath: true,
    form: 'spiral-rail-bolt'
  };
}

export function isCombat2160MarksmanRole(raw: string | undefined): boolean {
  const value = String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return value.includes('xa thu') || value.includes('marksman') || value.includes('archer');
}

(globalThis as any).POWDER_COMBAT2_MARKSMAN_SPIRAL_RAIL = {
  version: COMBAT2160_MARKSMAN_VERSION,
  role: 'marksman',
  directRuntimeOnly: true,
  form: 'spiral-rail-bolt',
  body: {
    taperedEnergyDart: true,
    physicalArrowHead: false,
    physicalShaft: false,
    physicalFletching: false,
    darkOuterDepthShell: true,
    brightInnerCore: true,
    whiteRailSpine: true,
    pairedSideRails: true,
    integratedRoundedNose: true
  },
  rifling: {
    strands: 2,
    fullTurns: 2.25,
    depthUsesCosine: true,
    frontBackSeparated: true,
    containerRotation: false,
    phaseRedrawOnly: true,
    finiteTween: true
  },
  trail: {
    actualProjectilePosition: true,
    points: { full: 16, balanced: 13, lite: 9 },
    threeLayerTaper: true,
    shortRifledSideWisps: true,
    noFullPathBeam: true
  },
  impact: 'pierce-lance+finite-rifled-arcs',
  particleEmitters: false,
  repeatingTweenLoops: false,
  combatLogicChanged: false
};
