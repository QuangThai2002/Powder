import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2159_MARKSMAN_VERSION = '2.15.9';

type ElementProfile = { color: number; core: number; dark: number };
type MarksmanOptions = DirectionalProjectileOptions & { role?: string };

const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff6840, core: 0xfff1b5, dark: 0x7b2418 },
  lava: { color: 0xff4b27, core: 0xffcf55, dark: 0x692013 },
  water: { color: 0x44b7ff, core: 0xe8fbff, dark: 0x155a86 },
  ice: { color: 0x83dcff, core: 0xffffff, dark: 0x317891 },
  lightning: { color: 0xf5dd57, core: 0xffffff, dark: 0x8e6810 },
  storm: { color: 0x739fff, core: 0xf2f5ff, dark: 0x394d91 },
  wind: { color: 0x68e2d1, core: 0xf5fffd, dark: 0x24776d },
  leaf: { color: 0x68d775, core: 0xf0ffe8, dark: 0x326d39 },
  poison: { color: 0xa0df5d, core: 0xf6ffd5, dark: 0x466c22 },
  earth: { color: 0xb98a58, core: 0xffe7c0, dark: 0x624932 },
  steel: { color: 0xc6d8e2, core: 0xffffff, dark: 0x566a76 },
  light: { color: 0xffed9e, core: 0xffffff, dark: 0xa88d3e },
  dark: { color: 0xa37ff2, core: 0xf4edff, dark: 0x482d6d },
  neutral: { color: 0x97d9e9, core: 0xffffff, dark: 0x3f6e79 }
});

function tier(): 'full' | 'balanced' | 'lite' {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function durationFor(options: MarksmanOptions): number {
  const requested = Number(options.durationMs || 0);
  if (requested > 0) return Phaser.Math.Clamp(Math.round(requested * 2.05), 420, 760);
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  return Phaser.Math.Clamp(Math.round(500 + distance * 0.075), 500, 670);
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
      try { tw?.stop(); } catch { /* scene teardown */ }
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

class DirectTrail {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly points: Array<{ x: number; y: number }> = [];
  private readonly maxPoints: number;

  constructor(scene: Phaser.Scene, private readonly profile: ElementProfile, quality: 'full' | 'balanced' | 'lite') {
    this.graphics = scene.add.graphics()
      .setDepth(powVfxDepth('foreground') + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.maxPoints = quality === 'full' ? 20 : quality === 'balanced' ? 16 : 10;
  }

  push(x: number, y: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Phaser.Math.Distance.Between(last.x, last.y, x, y) < 3.5) return;
    this.points.push({ x, y });
    while (this.points.length > this.maxPoints) this.points.shift();
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
      const life = Math.pow(fresh, 3.2);
      g.lineStyle(26, this.profile.color, 0.12 * life);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(12, this.profile.color, 0.48 * life);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(4, this.profile.core, 0.98 * life);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  async fade(scene: Phaser.Scene): Promise<void> {
    try {
      await tween(scene, this.graphics, { alpha: 0, duration: 125, ease: 'Quad.easeOut' }, 280);
    } finally {
      this.graphics.destroy();
    }
  }
}

type DirectBolt = {
  root: Phaser.GameObjects.Container;
  helixBack: Phaser.GameObjects.Graphics;
  helixFront: Phaser.GameObjects.Graphics;
  helixCore: Phaser.GameObjects.Graphics;
  profile: ElementProfile;
  length: number;
  radius: number;
};

function drawRifling(bolt: DirectBolt, phase: number, reduced: boolean): void {
  const { helixBack, helixFront, helixCore, length, radius, profile } = bolt;
  helixBack.clear();
  helixFront.clear();
  helixCore.clear();
  const samples = reduced ? 22 : 34;
  const turns = reduced ? 2.8 : 3.6;
  const startX = -length * 0.38;
  const endX = length * 0.34;
  const amp = radius * (reduced ? 0.5 : 0.62);

  for (const phaseOffset of [0, Math.PI]) {
    let previous: { x: number; y: number } | null = null;
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const x = Phaser.Math.Linear(startX, endX, t);
      const envelope = Math.sin(Math.PI * t);
      const y = Math.sin(Math.PI * 2 * turns * t + phase + phaseOffset) * amp * envelope;
      if (previous) {
        const front = (previous.y + y) >= 0;
        if (front) {
          helixFront.lineStyle(reduced ? 4 : 7, profile.color, reduced ? 0.52 : 0.82);
          helixFront.lineBetween(previous.x, previous.y, x, y);
          helixCore.lineStyle(reduced ? 1.5 : 2.4, profile.core, reduced ? 0.7 : 0.98);
          helixCore.lineBetween(previous.x, previous.y, x, y);
        } else {
          helixBack.lineStyle(reduced ? 2 : 3, profile.dark, reduced ? 0.42 : 0.7);
          helixBack.lineBetween(previous.x, previous.y, x, y);
        }
      }
      previous = { x, y };
    }
  }
}

function buildBolt(options: MarksmanOptions, reduced: boolean): DirectBolt {
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const length = reduced ? 142 : 188;
  const radius = reduced ? 22 : 30;
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 6)
    .setRotation(angle);

  const auraOuter = options.scene.add.ellipse(-8, 0, length * 1.2, radius * 2.4, profile.color, reduced ? 0.045 : 0.075)
    .setBlendMode(Phaser.BlendModes.ADD);
  const auraInner = options.scene.add.ellipse(0, 0, length * 1.03, radius * 1.65, profile.color, reduced ? 0.08 : 0.14)
    .setBlendMode(Phaser.BlendModes.ADD);
  const shadow = options.scene.add.ellipse(-6, 0, length * 0.9, radius * 1.34, profile.dark, 0.78);
  const shell = options.scene.add.ellipse(0, 0, length * 0.84, radius * 1.08, profile.color, 0.93);
  const inner = options.scene.add.ellipse(8, 0, length * 0.68, radius * 0.64, profile.core, 0.78)
    .setBlendMode(Phaser.BlendModes.ADD);
  const spineGlow = options.scene.add.rectangle(9, 0, length * 0.63, reduced ? 9 : 12, profile.core, reduced ? 0.12 : 0.2)
    .setBlendMode(Phaser.BlendModes.ADD);
  const spine = options.scene.add.rectangle(10, 0, length * 0.59, reduced ? 3 : 4, 0xffffff, 1)
    .setBlendMode(Phaser.BlendModes.ADD);

  // Blunt, compressed energy nose: intentionally bullet-like, never arrow-like.
  const noseAura = options.scene.add.ellipse(length * 0.39, 0, radius * 1.45, radius * 1.55, profile.color, 0.24)
    .setBlendMode(Phaser.BlendModes.ADD);
  const nose = options.scene.add.ellipse(length * 0.385, 0, radius * 1.08, radius * 1.0, profile.core, 0.94)
    .setBlendMode(Phaser.BlendModes.ADD);
  const noseHot = options.scene.add.circle(length * 0.41, 0, reduced ? 5 : 7, 0xffffff, 1)
    .setBlendMode(Phaser.BlendModes.ADD);

  const rearAura = options.scene.add.ellipse(-length * 0.48, 0, length * 0.48, radius * 1.0, profile.color, 0.12)
    .setBlendMode(Phaser.BlendModes.ADD);
  const rearCore = options.scene.add.rectangle(-length * 0.47, 0, length * 0.31, reduced ? 3 : 4, profile.core, 0.72)
    .setBlendMode(Phaser.BlendModes.ADD);

  const helixBack = options.scene.add.graphics();
  const helixFront = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const helixCore = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const ribs = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (const x of [-0.24, -0.08, 0.08, 0.23].map((v) => v * length)) {
    ribs.lineStyle(reduced ? 1.5 : 2.2, profile.core, reduced ? 0.24 : 0.42);
    ribs.lineBetween(x, -radius * 0.35, x, radius * 0.35);
  }

  root.add([rearAura, rearCore, auraOuter, helixBack, shadow, shell, inner, spineGlow, spine, ribs, helixFront, helixCore, auraInner, noseAura, nose, noseHot]);
  const built = { root, helixBack, helixFront, helixCore, profile, length, radius };
  drawRifling(built, 0, reduced);
  return built;
}

async function chargeFlash(options: MarksmanOptions, reduced: boolean): Promise<void> {
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const ring = options.scene.add.circle(options.source.x, options.source.y, reduced ? 30 : 42, 0x000000, 0)
    .setDepth(powVfxDepth('foreground') + 5)
    .setStrokeStyle(reduced ? 3 : 5, profile.color, 0.88)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(1.5);
  try {
    await tween(options.scene, ring, { scale: 0.65, alpha: 0, duration: reduced ? 90 : 125, ease: 'Quad.easeIn' }, 260);
  } finally {
    ring.destroy();
  }
}

async function impact(options: MarksmanOptions, reduced: boolean): Promise<void> {
  const profile = ELEMENT[options.element] ?? ELEMENT.neutral;
  const angle = Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
  const r = reduced ? 35 : 48;
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 8)
    .setRotation(angle)
    .setScale(0.5);
  const flash = options.scene.add.ellipse(0, 0, r * 3.0, r * 1.0, profile.color, 0.25).setBlendMode(Phaser.BlendModes.ADD);
  const pierce = options.scene.add.rectangle(0, 0, r * 3.0, reduced ? 8 : 12, profile.color, 0.85).setBlendMode(Phaser.BlendModes.ADD);
  const core = options.scene.add.rectangle(0, 0, r * 2.4, reduced ? 3 : 4, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);
  const ring = options.scene.add.circle(0, 0, r, 0x000000, 0).setStrokeStyle(reduced ? 3 : 5, profile.color, 0.94).setBlendMode(Phaser.BlendModes.ADD);
  root.add([flash, pierce, core, ring]);
  try {
    await tween(options.scene, root, { scaleX: 1.22, scaleY: 1.08, alpha: 0, duration: reduced ? 150 : 205, ease: 'Quad.easeOut' }, 390);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2159MarksmanDirectVfx(options: MarksmanOptions): Promise<void> {
  const quality = tier();
  const reduced = Boolean(options.reducedMotion) || quality === 'lite';
  const duration = durationFor(options);
  const bolt = buildBolt(options, reduced);
  const trail = new DirectTrail(options.scene, bolt.profile, quality);
  const phase = { value: 0 };
  trail.push(bolt.root.x, bolt.root.y);

  const charge = chargeFlash(options, reduced);
  const move = tween(options.scene, bolt.root, {
    x: options.target.x,
    y: options.target.y,
    duration,
    ease: 'Sine.easeInOut',
    onUpdate: () => trail.push(bolt.root.x, bolt.root.y)
  }, duration + 320);
  const rifling = tween(options.scene, phase, {
    value: Math.PI * (reduced ? 6 : 10),
    duration,
    ease: 'Linear',
    onUpdate: () => drawRifling(bolt, phase.value, reduced)
  }, duration + 320);

  try {
    await Promise.all([charge, move, rifling]);
  } finally {
    bolt.root.destroy(true);
  }
  await trail.fade(options.scene);
  await impact(options, reduced);

  const root = globalThis as any;
  root.POWDER_COMBAT2_MARKSMAN_DIRECT_LAST = {
    version: COMBAT2159_MARKSMAN_VERSION,
    at: Date.now(),
    element: options.element,
    source: { x: options.source.x, y: options.source.y },
    target: { x: options.target.x, y: options.target.y },
    directRuntimePath: true
  };
}

export function isCombat2159MarksmanRole(raw: string | undefined): boolean {
  const value = String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return value.includes('xa thu') || value.includes('marksman') || value.includes('archer');
}
