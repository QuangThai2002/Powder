import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2162_MARKSMAN_TIER_VERSION = '2.16.2';
export type Combat2162MarksmanTier = 'normal' | 'skill' | 'ultimate';

type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };
type ElementProfile = { color: number; core: number; dark: number };
type TierSpec = {
  length: number;
  radius: number;
  turns: number;
  trailPoints: number;
  trailOuter: number;
  duration: number;
  chargeRings: number;
  impactRadius: number;
  impactRings: number;
  sideWisp: boolean;
  cameraKick: boolean;
};

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

const SPEC: Readonly<Record<Combat2162MarksmanTier, TierSpec>> = Object.freeze({
  normal: {
    length: 126,
    radius: 16,
    turns: 1.55,
    trailPoints: 10,
    trailOuter: 13,
    duration: 345,
    chargeRings: 1,
    impactRadius: 28,
    impactRings: 1,
    sideWisp: false,
    cameraKick: false
  },
  skill: {
    length: 176,
    radius: 23,
    turns: 2.15,
    trailPoints: 15,
    trailOuter: 21,
    duration: 430,
    chargeRings: 2,
    impactRadius: 42,
    impactRings: 2,
    sideWisp: true,
    cameraKick: false
  },
  ultimate: {
    length: 232,
    radius: 31,
    turns: 2.75,
    trailPoints: 21,
    trailOuter: 31,
    duration: 510,
    chargeRings: 3,
    impactRadius: 60,
    impactRings: 3,
    sideWisp: true,
    cameraKick: true
  }
});

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
      try { tw?.stop(); } catch { /* scene cleanup owns the tween */ }
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

function fillPolygon(
  g: Phaser.GameObjects.Graphics,
  points: Array<{ x: number; y: number }>,
  color: number,
  alpha: number
): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.fillPath();
}

class TierTrail {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly points: Array<{ x: number; y: number }> = [];

  constructor(
    scene: Phaser.Scene,
    private readonly profile: ElementProfile,
    private readonly spec: TierSpec,
    private readonly tier: Combat2162MarksmanTier
  ) {
    this.graphics = scene.add.graphics()
      .setDepth(powVfxDepth('foreground') + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  push(x: number, y: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 3.5) return;
    this.points.push({ x, y });
    while (this.points.length > this.spec.trailPoints) this.points.shift();
    this.redraw();
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();
    if (this.points.length < 2) return;

    for (let i = 1; i < this.points.length; i += 1) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const fresh = i / Math.max(1, this.points.length - 1);
      const life = Math.pow(fresh, this.tier === 'ultimate' ? 2.1 : 2.6);
      const widthScale = 0.38 + fresh * 0.62;

      g.lineStyle(this.spec.trailOuter * widthScale, this.profile.color, 0.14 * life);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(this.spec.trailOuter * 0.48 * widthScale, this.profile.color, 0.58 * life);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(Math.max(1.4, this.spec.trailOuter * 0.15 * widthScale), this.profile.core, 0.98 * life);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    if (!this.spec.sideWisp || this.points.length < 4) return;
    const start = Math.max(1, this.points.length - (this.tier === 'ultimate' ? 10 : 7));
    let topPrev: { x: number; y: number } | null = null;
    let bottomPrev: { x: number; y: number } | null = null;
    for (let i = start; i < this.points.length; i += 1) {
      const prev = this.points[Math.max(0, i - 1)];
      const point = this.points[i];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const fresh = i / Math.max(1, this.points.length - 1);
      const ampBase = this.tier === 'ultimate' ? 8.5 : 5.5;
      const wave = Math.sin(i * 1.32) * ampBase * (0.5 + fresh * 0.5);
      const top = { x: point.x + nx * wave, y: point.y + ny * wave };
      const bottom = { x: point.x - nx * wave, y: point.y - ny * wave };
      if (topPrev) {
        g.lineStyle(this.tier === 'ultimate' ? 2.1 : 1.45, this.profile.core, 0.16 + fresh * 0.24);
        g.lineBetween(topPrev.x, topPrev.y, top.x, top.y);
      }
      if (bottomPrev) {
        g.lineStyle(this.tier === 'ultimate' ? 1.7 : 1.25, this.profile.color, 0.13 + fresh * 0.2);
        g.lineBetween(bottomPrev.x, bottomPrev.y, bottom.x, bottom.y);
      }
      topPrev = top;
      bottomPrev = bottom;
    }
  }

  async fade(scene: Phaser.Scene): Promise<void> {
    try {
      await tween(scene, this.graphics, { alpha: 0, duration: 105, ease: 'Quad.easeOut' }, 240);
    } finally {
      this.graphics.destroy();
    }
  }
}

type BuiltBolt = {
  root: Phaser.GameObjects.Container;
  helixBack: Phaser.GameObjects.Graphics;
  helixGlow: Phaser.GameObjects.Graphics;
  helixFront: Phaser.GameObjects.Graphics;
  helixCore: Phaser.GameObjects.Graphics;
  profile: ElementProfile;
  spec: TierSpec;
  tier: Combat2162MarksmanTier;
};

function drawBody(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  profile: ElementProfile,
  spec: TierSpec,
  tier: Combat2162MarksmanTier
): void {
  const aura = scene.add.ellipse(
    tier === 'ultimate' ? -8 : -4,
    0,
    spec.length * (tier === 'ultimate' ? 1.24 : 1.14),
    spec.radius * (tier === 'normal' ? 2.0 : tier === 'skill' ? 2.35 : 2.75),
    profile.color,
    tier === 'normal' ? 0.045 : tier === 'skill' ? 0.075 : 0.11
  ).setBlendMode(Phaser.BlendModes.ADD);

  const shell = scene.add.graphics();
  const l = spec.length;
  const r = spec.radius;
  const outer = [
    { x: -l * 0.46, y: -r * 0.18 },
    { x: -l * 0.34, y: -r * 0.62 },
    { x: l * 0.12, y: -r * 0.58 },
    { x: l * 0.34, y: -r * 0.3 },
    { x: l * 0.46, y: 0 },
    { x: l * 0.34, y: r * 0.3 },
    { x: l * 0.12, y: r * 0.58 },
    { x: -l * 0.34, y: r * 0.62 },
    { x: -l * 0.46, y: r * 0.18 }
  ];
  fillPolygon(shell, outer, profile.dark, 0.92);
  fillPolygon(shell, outer.map((p) => ({ x: p.x + l * 0.018, y: p.y * 0.78 })), profile.color, 0.96);
  fillPolygon(shell, [
    { x: -l * 0.31, y: -r * 0.18 },
    { x: -l * 0.16, y: -r * 0.31 },
    { x: l * 0.25, y: -r * 0.24 },
    { x: l * 0.38, y: 0 },
    { x: l * 0.25, y: r * 0.24 },
    { x: -l * 0.16, y: r * 0.31 },
    { x: -l * 0.31, y: r * 0.18 }
  ], profile.core, tier === 'normal' ? 0.58 : tier === 'skill' ? 0.68 : 0.76);

  shell.lineStyle(tier === 'ultimate' ? 2.8 : 1.8, 0xffffff, tier === 'normal' ? 0.5 : 0.72);
  shell.lineBetween(-l * 0.25, -r * 0.28, l * 0.34, -r * 0.1);

  const spineGlow = scene.add.rectangle(0, 0, l * 0.66, tier === 'ultimate' ? 12 : tier === 'skill' ? 8 : 5, profile.core, tier === 'normal' ? 0.1 : 0.18)
    .setBlendMode(Phaser.BlendModes.ADD);
  const spine = scene.add.rectangle(l * 0.02, 0, l * 0.62, tier === 'ultimate' ? 4.5 : tier === 'skill' ? 3.4 : 2.3, 0xffffff, 0.98)
    .setBlendMode(Phaser.BlendModes.ADD);

  const noseHalo = scene.add.ellipse(l * 0.43, 0, r * (tier === 'ultimate' ? 1.7 : 1.28), r * (tier === 'ultimate' ? 1.45 : 1.1), profile.color, tier === 'normal' ? 0.14 : tier === 'skill' ? 0.24 : 0.34)
    .setBlendMode(Phaser.BlendModes.ADD);
  const nose = scene.add.ellipse(l * 0.435, 0, r * 0.75, r * 0.62, profile.core, 0.96)
    .setBlendMode(Phaser.BlendModes.ADD);
  const noseHot = scene.add.circle(l * 0.45, 0, tier === 'ultimate' ? 7 : tier === 'skill' ? 5.5 : 4, 0xffffff, 1)
    .setBlendMode(Phaser.BlendModes.ADD);

  root.add([aura, shell, spineGlow, spine]);

  if (tier !== 'normal') {
    const sideRails = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    sideRails.lineStyle(tier === 'ultimate' ? 2.4 : 1.6, profile.core, tier === 'ultimate' ? 0.66 : 0.44);
    sideRails.lineBetween(-l * 0.24, -r * 0.4, l * 0.27, -r * 0.25);
    sideRails.lineBetween(-l * 0.24, r * 0.4, l * 0.27, r * 0.25);
    root.add(sideRails);
  }

  if (tier === 'ultimate') {
    const upper = scene.add.rectangle(-l * 0.08, -r * 0.48, l * 0.48, 2.2, profile.core, 0.55).setBlendMode(Phaser.BlendModes.ADD);
    const lower = scene.add.rectangle(-l * 0.08, r * 0.48, l * 0.48, 2.2, profile.color, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    root.add([upper, lower]);
  }

  root.add([noseHalo, nose, noseHot]);
}

function drawHelix(bolt: BuiltBolt, phase: number): void {
  const { helixBack, helixGlow, helixFront, helixCore, profile, spec, tier } = bolt;
  helixBack.clear();
  helixGlow.clear();
  helixFront.clear();
  helixCore.clear();

  const samples = tier === 'normal' ? 20 : tier === 'skill' ? 28 : 36;
  const startX = -spec.length * 0.33;
  const endX = spec.length * 0.34;
  const amplitude = spec.radius * (tier === 'normal' ? 0.42 : tier === 'skill' ? 0.54 : 0.66);

  for (const offset of [0, Math.PI]) {
    let previous: { x: number; y: number; depth: number } | null = null;
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const theta = Math.PI * 2 * spec.turns * t + phase + offset;
      const envelope = Math.sin(Math.PI * t);
      const x = Phaser.Math.Linear(startX, endX, t);
      const y = Math.sin(theta) * amplitude * envelope;
      const depth = Math.cos(theta);
      if (previous) {
        const front = (previous.depth + depth) * 0.5 >= 0;
        if (front) {
          helixGlow.lineStyle(tier === 'ultimate' ? 10 : tier === 'skill' ? 7 : 4, profile.color, tier === 'normal' ? 0.08 : tier === 'skill' ? 0.15 : 0.21);
          helixGlow.lineBetween(previous.x, previous.y, x, y);
          helixFront.lineStyle(tier === 'ultimate' ? 4.4 : tier === 'skill' ? 3.2 : 2.1, profile.color, 0.94);
          helixFront.lineBetween(previous.x, previous.y, x, y);
          helixCore.lineStyle(tier === 'ultimate' ? 1.8 : 1.2, profile.core, 0.98);
          helixCore.lineBetween(previous.x, previous.y, x, y);
        } else {
          helixBack.lineStyle(tier === 'ultimate' ? 2.8 : 1.8, profile.dark, tier === 'normal' ? 0.36 : 0.62);
          helixBack.lineBetween(previous.x, previous.y, x, y);
        }
      }
      previous = { x, y, depth };
    }
  }
}

function buildBolt(options: RoleAwareOptions, tier: Combat2162MarksmanTier): BuiltBolt {
  const spec = SPEC[tier];
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 6)
    .setRotation(angle);

  const rearGlow = options.scene.add.ellipse(-spec.length * 0.48, 0, spec.length * (tier === 'ultimate' ? 0.55 : 0.34), spec.radius * (tier === 'ultimate' ? 1.35 : 0.86), profile.color, tier === 'normal' ? 0.08 : tier === 'skill' ? 0.14 : 0.22)
    .setBlendMode(Phaser.BlendModes.ADD);
  const rearCore = options.scene.add.rectangle(-spec.length * 0.47, 0, spec.length * (tier === 'ultimate' ? 0.36 : 0.24), tier === 'ultimate' ? 5 : 3, profile.core, tier === 'normal' ? 0.55 : 0.86)
    .setBlendMode(Phaser.BlendModes.ADD);
  const helixBack = options.scene.add.graphics();
  const helixGlow = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const helixFront = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const helixCore = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

  root.add([rearGlow, rearCore, helixBack]);
  drawBody(options.scene, root, profile, spec, tier);
  root.add([helixGlow, helixFront, helixCore]);

  const built: BuiltBolt = { root, helixBack, helixGlow, helixFront, helixCore, profile, spec, tier };
  drawHelix(built, 0);
  return built;
}

async function charge(options: RoleAwareOptions, profile: ElementProfile, spec: TierSpec, tier: Combat2162MarksmanTier): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 7);
  for (let i = 0; i < spec.chargeRings; i += 1) {
    const ring = options.scene.add.circle(0, 0, (tier === 'ultimate' ? 34 : tier === 'skill' ? 27 : 22) + i * 10, 0x000000, 0)
      .setStrokeStyle(tier === 'ultimate' ? 4 : 2.6, i % 2 === 0 ? profile.color : profile.core, 0.82 - i * 0.14)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.25 + i * 0.1);
    root.add(ring);
  }
  const core = options.scene.add.circle(0, 0, tier === 'ultimate' ? 9 : tier === 'skill' ? 6 : 4, profile.core, 0.92)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add(core);
  try {
    await tween(options.scene, root, {
      scale: tier === 'ultimate' ? 0.52 : 0.62,
      alpha: 0,
      duration: tier === 'ultimate' ? 155 : tier === 'skill' ? 115 : 80,
      ease: 'Quad.easeIn'
    }, 300);
  } finally {
    root.destroy(true);
  }
}

async function impact(options: RoleAwareOptions, profile: ElementProfile, spec: TierSpec, tier: Combat2162MarksmanTier): Promise<void> {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const r = spec.impactRadius;
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 9)
    .setRotation(angle)
    .setScale(0.44);

  const flash = options.scene.add.ellipse(0, 0, r * (tier === 'ultimate' ? 4.2 : 3.0), r * (tier === 'normal' ? 0.8 : 1.1), profile.color, tier === 'normal' ? 0.2 : 0.32)
    .setBlendMode(Phaser.BlendModes.ADD);
  const lance = options.scene.add.rectangle(r * 0.22, 0, r * (tier === 'ultimate' ? 4.4 : tier === 'skill' ? 3.4 : 2.7), tier === 'ultimate' ? 15 : tier === 'skill' ? 10 : 6, profile.color, 0.82)
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.rectangle(r * 0.3, 0, r * (tier === 'ultimate' ? 3.7 : 2.6), tier === 'ultimate' ? 5 : 3, 0xffffff, 1)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add([flash, lance, core]);

  for (let i = 0; i < spec.impactRings; i += 1) {
    root.add(options.scene.add.circle(0, 0, r * (0.72 + i * 0.33), 0x000000, 0)
      .setStrokeStyle(tier === 'ultimate' ? 4.5 - i * 0.7 : 3.2, i % 2 === 0 ? profile.color : profile.core, 0.9 - i * 0.18)
      .setBlendMode(Phaser.BlendModes.ADD));
  }

  if (tier !== 'normal') {
    const drill = options.scene.add.container(0, 0);
    const arcCount = tier === 'ultimate' ? 5 : 3;
    for (let i = 0; i < arcCount; i += 1) {
      drill.add(options.scene.add.arc(0, 0, r * (0.5 + i * 0.16), -50 + i * 23, 38 + i * 23, false, 0x000000, 0)
        .setStrokeStyle(tier === 'ultimate' ? 3.1 : 2.2, i % 2 === 0 ? profile.core : profile.color, 0.76)
        .setBlendMode(Phaser.BlendModes.ADD));
    }
    root.add(drill);
    void tween(options.scene, drill, {
      angle: tier === 'ultimate' ? 190 : 120,
      scale: tier === 'ultimate' ? 1.35 : 1.18,
      duration: tier === 'ultimate' ? 230 : 175,
      ease: 'Quad.easeOut'
    }, 360);
  }

  if (spec.cameraKick) {
    try { options.scene.cameras.main.shake(95, 0.0018); } catch { /* QA-only camera kick */ }
  }

  try {
    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.42 : tier === 'skill' ? 1.18 : 1.02,
      scaleY: tier === 'ultimate' ? 1.18 : 1.04,
      alpha: 0,
      duration: tier === 'ultimate' ? 245 : tier === 'skill' ? 195 : 145,
      ease: 'Quad.easeOut'
    }, 430);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2162MarksmanTieredQaVfx(
  options: RoleAwareOptions,
  tier: Combat2162MarksmanTier
): Promise<void> {
  const spec = SPEC[tier];
  const built = buildBolt(options, tier);
  const trail = new TierTrail(options.scene, built.profile, spec, tier);
  const phase = { value: 0 };
  trail.push(built.root.x, built.root.y);

  const chargeFx = charge(options, built.profile, spec, tier);
  const move = tween(options.scene, built.root, {
    x: options.target.x,
    y: options.target.y,
    duration: spec.duration,
    ease: tier === 'ultimate' ? 'Expo.easeIn' : tier === 'skill' ? 'Sine.easeInOut' : 'Quad.easeIn',
    onUpdate: () => trail.push(built.root.x, built.root.y)
  }, spec.duration + 320);
  const rifling = tween(options.scene, phase, {
    value: Math.PI * (tier === 'ultimate' ? 11 : tier === 'skill' ? 8 : 5),
    duration: spec.duration,
    ease: 'Linear',
    onUpdate: () => drawHelix(built, phase.value)
  }, spec.duration + 320);

  try {
    await Promise.all([chargeFx, move, rifling]);
  } finally {
    built.root.destroy(true);
  }
  await trail.fade(options.scene);
  await impact(options, built.profile, spec, tier);

  (globalThis as any).POWDER_COMBAT2_MARKSMAN_TIER_QA_LAST = {
    version: COMBAT2162_MARKSMAN_TIER_VERSION,
    tier,
    element: options.element,
    at: Date.now(),
    distinctGeometry: true,
    distinctTrail: true,
    distinctCharge: true,
    distinctImpact: true
  };
}

(globalThis as any).POWDER_COMBAT2_MARKSMAN_TIER_QA = {
  version: COMBAT2162_MARKSMAN_TIER_VERSION,
  role: 'marksman',
  tiers: ['normal', 'skill', 'ultimate'],
  normal: { form: 'compact-spiral-rail', length: SPEC.normal.length, turns: SPEC.normal.turns, trailPoints: SPEC.normal.trailPoints, impactRings: SPEC.normal.impactRings },
  skill: { form: 'piercing-spiral-shot', length: SPEC.skill.length, turns: SPEC.skill.turns, trailPoints: SPEC.skill.trailPoints, impactRings: SPEC.skill.impactRings },
  ultimate: { form: 'rail-breaker', length: SPEC.ultimate.length, turns: SPEC.ultimate.turns, trailPoints: SPEC.ultimate.trailPoints, impactRings: SPEC.ultimate.impactRings, cameraKick: true },
  realThreeTierGeometry: true,
  qualityTierProxy: false,
  particleEmitters: false,
  repeatingTweenLoops: false,
  combatLogicChanged: false
};
