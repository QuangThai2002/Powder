import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2163_MARKSMAN_VERSION = '2.16.3';
export type Combat2163MarksmanTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Profile = { color: number; core: number; dark: number };

type Built = {
  root: Phaser.GameObjects.Container;
  profile: Profile;
  tier: Combat2163MarksmanTier;
  phaseGraphics: Phaser.GameObjects.Graphics[];
  length: number;
  radius: number;
};

const ELEMENT: Readonly<Record<CombatProjectileElement, Profile>> = Object.freeze({
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

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let tw: Phaser.Tweens.Tween | null = null;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      try { tw?.stop(); } catch { /* scene cleanup */ }
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

function polygon(g: Phaser.GameObjects.Graphics, pts: Array<{ x: number; y: number }>, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
}

function createRoot(options: Options, depthOffset = 6): Phaser.GameObjects.Container {
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  return options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + depthOffset)
    .setRotation(angle);
}

function buildNormal(options: Options, profile: Profile): Built {
  const length = 122;
  const radius = 15;
  const root = createRoot(options);

  const aura = options.scene.add.ellipse(-4, 0, 140, 34, profile.color, 0.055).setBlendMode(Phaser.BlendModes.ADD);
  const shell = options.scene.add.graphics();
  polygon(shell, [
    { x: -58, y: -5 }, { x: -42, y: -13 }, { x: 22, y: -12 },
    { x: 48, y: -7 }, { x: 61, y: 0 }, { x: 48, y: 7 },
    { x: 22, y: 12 }, { x: -42, y: 13 }, { x: -58, y: 5 }
  ], profile.dark, 0.92);
  polygon(shell, [
    { x: -52, y: -3 }, { x: -38, y: -9 }, { x: 24, y: -8 },
    { x: 49, y: -4 }, { x: 58, y: 0 }, { x: 49, y: 4 },
    { x: 24, y: 8 }, { x: -38, y: 9 }, { x: -52, y: 3 }
  ], profile.color, 0.98);
  const coreGlow = options.scene.add.rectangle(2, 0, 78, 7, profile.core, 0.16).setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.rectangle(5, 0, 76, 2.6, 0xffffff, 0.98).setBlendMode(Phaser.BlendModes.ADD);
  const nose = options.scene.add.circle(55, 0, 4.2, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);
  const helix = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, shell, coreGlow, core, helix, nose]);
  return { root, profile, tier: 'normal', phaseGraphics: [helix], length, radius };
}

function buildSkill(options: Options, profile: Profile): Built {
  const length = 182;
  const radius = 25;
  const root = createRoot(options);

  const aura = options.scene.add.ellipse(-5, 0, 216, 62, profile.color, 0.09).setBlendMode(Phaser.BlendModes.ADD);
  const center = options.scene.add.graphics();
  polygon(center, [
    { x: -76, y: -8 }, { x: -52, y: -16 }, { x: 38, y: -13 },
    { x: 76, y: -6 }, { x: 92, y: 0 }, { x: 76, y: 6 },
    { x: 38, y: 13 }, { x: -52, y: 16 }, { x: -76, y: 8 }
  ], profile.dark, 0.94);
  polygon(center, [
    { x: -69, y: -5 }, { x: -47, y: -11 }, { x: 42, y: -9 },
    { x: 78, y: -4 }, { x: 88, y: 0 }, { x: 78, y: 4 },
    { x: 42, y: 9 }, { x: -47, y: 11 }, { x: -69, y: 5 }
  ], profile.color, 0.98);

  const centerGlow = options.scene.add.rectangle(5, 0, 126, 10, profile.core, 0.18).setBlendMode(Phaser.BlendModes.ADD);
  const centerCore = options.scene.add.rectangle(8, 0, 124, 3.5, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);

  // Skill silhouette: two clearly separated side-rail energy blades.
  const upper = options.scene.add.graphics();
  const lower = options.scene.add.graphics();
  const bladePts = [
    { x: -56, y: -4 }, { x: -36, y: -8 }, { x: 50, y: -6 },
    { x: 78, y: 0 }, { x: 50, y: 6 }, { x: -36, y: 8 }, { x: -56, y: 4 }
  ];
  polygon(upper, bladePts.map((p) => ({ x: p.x, y: p.y - 20 })), profile.color, 0.74);
  polygon(lower, bladePts.map((p) => ({ x: p.x, y: p.y + 20 })), profile.color, 0.74);
  upper.lineStyle(1.6, profile.core, 0.9);
  upper.lineBetween(-40, -20, 64, -20);
  lower.lineStyle(1.6, profile.core, 0.9);
  lower.lineBetween(-40, 20, 64, 20);

  const bridges = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  bridges.lineStyle(1.4, profile.core, 0.35);
  for (const x of [-42, -8, 28, 58]) bridges.lineBetween(x, -15, x, 15);

  const phase = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const nose = options.scene.add.ellipse(84, 0, 20, 12, profile.core, 0.96).setBlendMode(Phaser.BlendModes.ADD);
  const noseHot = options.scene.add.circle(89, 0, 5.2, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, upper, lower, center, centerGlow, centerCore, bridges, phase, nose, noseHot]);
  return { root, profile, tier: 'skill', phaseGraphics: [phase], length, radius };
}

function buildUltimate(options: Options, profile: Profile): Built {
  const length = 246;
  const radius = 34;
  const root = createRoot(options, 8);

  const aura = options.scene.add.ellipse(-12, 0, 310, 102, profile.color, 0.13).setBlendMode(Phaser.BlendModes.ADD);
  const slug = options.scene.add.graphics();
  polygon(slug, [
    { x: -108, y: -13 }, { x: -78, y: -26 }, { x: 46, y: -23 },
    { x: 92, y: -15 }, { x: 122, y: -5 }, { x: 130, y: 0 },
    { x: 122, y: 5 }, { x: 92, y: 15 }, { x: 46, y: 23 },
    { x: -78, y: 26 }, { x: -108, y: 13 }
  ], profile.dark, 0.96);
  polygon(slug, [
    { x: -99, y: -9 }, { x: -70, y: -19 }, { x: 50, y: -16 },
    { x: 96, y: -9 }, { x: 120, y: 0 }, { x: 96, y: 9 },
    { x: 50, y: 16 }, { x: -70, y: 19 }, { x: -99, y: 9 }
  ], profile.color, 0.98);

  const coreGlow = options.scene.add.rectangle(10, 0, 170, 18, profile.core, 0.2).setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.rectangle(14, 0, 166, 6, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);

  // Ultimate silhouette: shock cone ahead of the slug.
  const cone = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  polygon(cone, [
    { x: 95, y: -24 }, { x: 162, y: 0 }, { x: 95, y: 24 }, { x: 118, y: 0 }
  ], profile.color, 0.22);
  cone.lineStyle(2.4, profile.core, 0.72);
  cone.lineBetween(112, -18, 158, 0);
  cone.lineBetween(112, 18, 158, 0);

  // Ultimate silhouette: three compression rings behind the slug.
  const rings = options.scene.add.container(0, 0);
  [-94, -117, -140].forEach((x, i) => {
    rings.add(options.scene.add.ellipse(x, 0, 10 + i * 3, 58 + i * 14, 0x000000, 0)
      .setStrokeStyle(3.2 - i * 0.5, i % 2 === 0 ? profile.core : profile.color, 0.78 - i * 0.15)
      .setBlendMode(Phaser.BlendModes.ADD));
  });

  const rails = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  rails.lineStyle(2.2, profile.core, 0.72);
  rails.lineBetween(-76, -22, 72, -16);
  rails.lineBetween(-76, 22, 72, 16);

  const phase = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const noseHot = options.scene.add.circle(126, 0, 8, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);
  root.add([aura, rings, slug, rails, coreGlow, core, phase, cone, noseHot]);
  return { root, profile, tier: 'ultimate', phaseGraphics: [phase], length, radius };
}

function drawPhase(built: Built, phase: number): void {
  const g = built.phaseGraphics[0];
  g.clear();
  const { profile, tier } = built;

  if (tier === 'normal') {
    const samples = 22;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const theta = t * Math.PI * 2 * 1.6 + phase;
      const x = Phaser.Math.Linear(-42, 42, t);
      const y = Math.sin(theta) * 7 * Math.sin(Math.PI * t);
      if (prev) {
        g.lineStyle(2.4, profile.color, 0.9);
        g.lineBetween(prev.x, prev.y, x, y);
      }
      prev = { x, y };
    }
    return;
  }

  if (tier === 'skill') {
    // Skill gets two corkscrew channels around the three-rail silhouette.
    for (const offset of [0, Math.PI]) {
      let prev: { x: number; y: number } | null = null;
      for (let i = 0; i <= 28; i += 1) {
        const t = i / 28;
        const theta = t * Math.PI * 2 * 2.1 + phase + offset;
        const x = Phaser.Math.Linear(-58, 70, t);
        const y = Math.sin(theta) * 15 * Math.sin(Math.PI * t);
        if (prev) {
          g.lineStyle(3.2, offset === 0 ? profile.color : profile.core, offset === 0 ? 0.84 : 0.68);
          g.lineBetween(prev.x, prev.y, x, y);
        }
        prev = { x, y };
      }
    }
    return;
  }

  // Ultimate: broad helical pressure bands, not a thin normal-style helix.
  for (const offset of [0, Math.PI * 0.66, Math.PI * 1.33]) {
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i <= 32; i += 1) {
      const t = i / 32;
      const theta = t * Math.PI * 2 * 1.65 + phase + offset;
      const x = Phaser.Math.Linear(-80, 92, t);
      const y = Math.sin(theta) * 25 * Math.sin(Math.PI * t);
      if (prev) {
        g.lineStyle(7.5, profile.color, 0.12);
        g.lineBetween(prev.x, prev.y, x, y);
        g.lineStyle(2.6, profile.core, 0.78);
        g.lineBetween(prev.x, prev.y, x, y);
      }
      prev = { x, y };
    }
  }
}

class DistinctTrail {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly pts: Array<{ x: number; y: number }> = [];

  constructor(scene: Phaser.Scene, private readonly built: Built) {
    this.g = scene.add.graphics().setDepth(powVfxDepth('foreground') + 3).setBlendMode(Phaser.BlendModes.ADD);
  }

  push(x: number, y: number): void {
    const last = this.pts[this.pts.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 3.5) return;
    this.pts.push({ x, y });
    const max = this.built.tier === 'normal' ? 9 : this.built.tier === 'skill' ? 15 : 20;
    while (this.pts.length > max) this.pts.shift();
    this.redraw();
  }

  private redraw(): void {
    this.g.clear();
    if (this.pts.length < 2) return;
    const tier = this.built.tier;
    const profile = this.built.profile;

    for (let i = 1; i < this.pts.length; i += 1) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const fresh = i / Math.max(1, this.pts.length - 1);
      const life = Math.pow(fresh, tier === 'ultimate' ? 2 : 2.6);
      const outer = tier === 'normal' ? 11 : tier === 'skill' ? 18 : 29;
      const mid = tier === 'normal' ? 5 : tier === 'skill' ? 8 : 13;
      const core = tier === 'normal' ? 2 : tier === 'skill' ? 3 : 4.5;
      this.g.lineStyle(outer, profile.color, 0.12 * life);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
      this.g.lineStyle(mid, profile.color, 0.5 * life);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
      this.g.lineStyle(core, profile.core, 0.96 * life);
      this.g.lineBetween(a.x, a.y, b.x, b.y);
    }

    if (tier === 'skill') this.drawSkillSideTrails(profile);
    if (tier === 'ultimate') this.drawUltimateWake(profile);
  }

  private drawSkillSideTrails(profile: Profile): void {
    for (const sign of [-1, 1]) {
      let prev: { x: number; y: number } | null = null;
      for (let i = Math.max(1, this.pts.length - 8); i < this.pts.length; i += 1) {
        const p0 = this.pts[i - 1];
        const p = this.pts[i];
        const dx = p.x - p0.x;
        const dy = p.y - p0.y;
        const len = Math.max(0.001, Math.hypot(dx, dy));
        const nx = -dy / len;
        const ny = dx / len;
        const pt = { x: p.x + nx * 9 * sign, y: p.y + ny * 9 * sign };
        if (prev) {
          this.g.lineStyle(2, sign > 0 ? profile.core : profile.color, 0.36);
          this.g.lineBetween(prev.x, prev.y, pt.x, pt.y);
        }
        prev = pt;
      }
    }
  }

  private drawUltimateWake(profile: Profile): void {
    const start = Math.max(2, this.pts.length - 10);
    for (let i = start; i < this.pts.length; i += 3) {
      const p0 = this.pts[Math.max(0, i - 1)];
      const p = this.pts[i];
      const dx = p.x - p0.x;
      const dy = p.y - p0.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const r = 10 + (i - start) * 1.2;
      this.g.lineStyle(2.1, profile.color, 0.2);
      this.g.beginPath();
      this.g.moveTo(p.x - nx * r, p.y - ny * r);
      this.g.lineTo(p.x + nx * r, p.y + ny * r);
      this.g.strokePath();
    }
  }

  async fade(scene: Phaser.Scene): Promise<void> {
    try { await tween(scene, this.g, { alpha: 0, duration: 110, ease: 'Quad.easeOut' }, 240); }
    finally { this.g.destroy(); }
  }
}

async function charge(options: Options, built: Built): Promise<void> {
  const { tier, profile } = built;
  const root = options.scene.add.container(options.source.x, options.source.y).setDepth(powVfxDepth('foreground') + 7);
  const count = tier === 'normal' ? 1 : tier === 'skill' ? 2 : 3;
  for (let i = 0; i < count; i += 1) {
    root.add(options.scene.add.circle(0, 0, (tier === 'ultimate' ? 34 : tier === 'skill' ? 26 : 20) + i * 11, 0x000000, 0)
      .setStrokeStyle(tier === 'ultimate' ? 4 : 2.6, i % 2 ? profile.core : profile.color, 0.82 - i * 0.14)
      .setBlendMode(Phaser.BlendModes.ADD));
  }
  if (tier === 'skill') {
    root.add(options.scene.add.rectangle(0, -18, 48, 2, profile.core, 0.56).setBlendMode(Phaser.BlendModes.ADD));
    root.add(options.scene.add.rectangle(0, 18, 48, 2, profile.core, 0.56).setBlendMode(Phaser.BlendModes.ADD));
  }
  if (tier === 'ultimate') {
    root.add(options.scene.add.rectangle(0, 0, 92, 5, 0xffffff, 0.72).setBlendMode(Phaser.BlendModes.ADD));
  }
  try {
    await tween(options.scene, root, {
      scale: tier === 'ultimate' ? 0.48 : 0.62,
      alpha: 0,
      duration: tier === 'ultimate' ? 165 : tier === 'skill' ? 120 : 75,
      ease: 'Quad.easeIn'
    }, 300);
  } finally {
    root.destroy(true);
  }
}

async function impact(options: Options, built: Built): Promise<void> {
  const { tier, profile } = built;
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 9)
    .setRotation(angle)
    .setScale(0.42);

  if (tier === 'normal') {
    root.add(options.scene.add.rectangle(20, 0, 78, 5, profile.color, 0.84).setBlendMode(Phaser.BlendModes.ADD));
    root.add(options.scene.add.rectangle(18, 0, 62, 2.2, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD));
    root.add(options.scene.add.circle(0, 0, 24, 0x000000, 0).setStrokeStyle(3, profile.color, 0.82).setBlendMode(Phaser.BlendModes.ADD));
  } else if (tier === 'skill') {
    [-11, 0, 11].forEach((y, i) => {
      root.add(options.scene.add.rectangle(26, y, 126 - i * 8, i === 1 ? 4 : 3, i === 1 ? 0xffffff : profile.color, 0.92)
        .setBlendMode(Phaser.BlendModes.ADD));
    });
    [34, 52].forEach((r, i) => root.add(options.scene.add.circle(0, 0, r, 0x000000, 0)
      .setStrokeStyle(3.4 - i * 0.6, i === 0 ? profile.color : profile.core, 0.82 - i * 0.16)
      .setBlendMode(Phaser.BlendModes.ADD)));
  } else {
    root.add(options.scene.add.ellipse(22, 0, 230, 76, profile.color, 0.25).setBlendMode(Phaser.BlendModes.ADD));
    root.add(options.scene.add.rectangle(36, 0, 212, 15, profile.color, 0.88).setBlendMode(Phaser.BlendModes.ADD));
    root.add(options.scene.add.rectangle(42, 0, 190, 5, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD));
    [48, 70, 92].forEach((r, i) => root.add(options.scene.add.circle(0, 0, r, 0x000000, 0)
      .setStrokeStyle(5 - i * 0.8, i % 2 === 0 ? profile.color : profile.core, 0.9 - i * 0.17)
      .setBlendMode(Phaser.BlendModes.ADD)));
    try { options.scene.cameras.main.shake(100, 0.0019); } catch { /* QA camera kick */ }
  }

  try {
    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.5 : tier === 'skill' ? 1.22 : 1.04,
      scaleY: tier === 'ultimate' ? 1.2 : 1.04,
      alpha: 0,
      duration: tier === 'ultimate' ? 250 : tier === 'skill' ? 195 : 140,
      ease: 'Quad.easeOut'
    }, 430);
  } finally {
    root.destroy(true);
  }
}

function build(options: Options, tier: Combat2163MarksmanTier): Built {
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  if (tier === 'skill') return buildSkill(options, profile);
  if (tier === 'ultimate') return buildUltimate(options, profile);
  return buildNormal(options, profile);
}

export async function playCombat2163MarksmanDistinctTierVfx(options: Options, tier: Combat2163MarksmanTier): Promise<void> {
  const built = build(options, tier);
  const duration = tier === 'normal' ? 335 : tier === 'skill' ? 425 : 515;
  const phase = { value: 0 };
  const trail = new DistinctTrail(options.scene, built);
  trail.push(built.root.x, built.root.y);

  const move = tween(options.scene, built.root, {
    x: options.target.x,
    y: options.target.y,
    duration,
    ease: tier === 'ultimate' ? 'Expo.easeIn' : tier === 'skill' ? 'Sine.easeInOut' : 'Quad.easeIn',
    onUpdate: () => trail.push(built.root.x, built.root.y)
  }, duration + 320);
  const phaseTween = tween(options.scene, phase, {
    value: Math.PI * (tier === 'normal' ? 5 : tier === 'skill' ? 8 : 7),
    duration,
    ease: 'Linear',
    onUpdate: () => drawPhase(built, phase.value)
  }, duration + 320);

  try {
    await Promise.all([charge(options, built), move, phaseTween]);
  } finally {
    built.root.destroy(true);
  }
  await trail.fade(options.scene);
  await impact(options, built);

  (globalThis as any).POWDER_COMBAT2_MARKSMAN_TIER_QA_LAST = {
    version: COMBAT2163_MARKSMAN_VERSION,
    tier,
    element: options.element,
    silhouette: tier === 'normal'
      ? 'single-compact-bolt'
      : tier === 'skill'
        ? 'center-bolt-plus-two-side-rail-blades'
        : 'heavy-rail-slug-plus-shock-cone-plus-three-compression-rings',
    at: Date.now()
  };
}

(globalThis as any).POWDER_COMBAT2_MARKSMAN_DISTINCT_TIERS = {
  version: COMBAT2163_MARKSMAN_VERSION,
  role: 'marksman',
  normal: { form: 'compact-spiral-rail', silhouette: 'single-compact-bolt' },
  skill: { form: 'piercing-triple-rail-shot', silhouette: 'center-bolt-plus-two-side-rail-blades' },
  ultimate: { form: 'rail-breaker-heavy-slug', silhouette: 'heavy-rail-slug-plus-shock-cone-plus-three-compression-rings' },
  sharedBodyRenderer: false,
  sharedTopology: false,
  qualityTierProxy: false,
  particleEmitters: false,
  repeatingTweenLoops: false,
  presentationOnly: true,
  combatLogicChanged: false
};
