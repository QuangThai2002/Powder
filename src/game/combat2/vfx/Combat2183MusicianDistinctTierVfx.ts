import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2183_MUSICIAN_VERSION = '2.18.3';
export type Combat2183MusicianTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; accent: number; dark: number };

const PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff8a67, core: 0xfff4d7, accent: 0xffc088, dark: 0x6c3027 },
  lava: { main: 0xee6b47, core: 0xffdf80, accent: 0xffaa64, dark: 0x60261c },
  water: { main: 0x68c8ed, core: 0xf4fdff, accent: 0xa8e9ff, dark: 0x245d74 },
  ice: { main: 0x99e7fa, core: 0xffffff, accent: 0xd0f7ff, dark: 0x39798a },
  lightning: { main: 0xeadb76, core: 0xffffee, accent: 0xffef9e, dark: 0x776b24 },
  storm: { main: 0x90a8e0, core: 0xf8f9ff, accent: 0xc0cdf4, dark: 0x48567c },
  wind: { main: 0x79d9c9, core: 0xf5fffc, accent: 0xaef1e5, dark: 0x306d64 },
  leaf: { main: 0x87d991, core: 0xf6ffef, accent: 0xb8efbd, dark: 0x396840 },
  poison: { main: 0xaad875, core: 0xfbffe7, accent: 0xd7ef9f, dark: 0x556d34 },
  earth: { main: 0xc29a72, core: 0xffeed5, accent: 0xe3bd91, dark: 0x644d38 },
  steel: { main: 0xcbdbe3, core: 0xffffff, accent: 0xedf5f8, dark: 0x5b6c75 },
  light: { main: 0xf2dfa0, core: 0xfffff9, accent: 0xfff2bd, dark: 0x80754c },
  dark: { main: 0xaa8ddd, core: 0xfaf4ff, accent: 0xcfb6ef, dark: 0x503c6c },
  neutral: { main: 0xa7d5dc, core: 0xffffff, accent: 0xd5f0f4, dark: 0x46656c }
});

export function isCombat2183MusicianRole(role?: string): boolean {
  const value = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('nhac cong') || value.includes('musician') || value.includes('bard');
}

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: CombatTweenConfig,
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
    try { tw = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish }); }
    catch { finish(); }
  });
}

function travelMs(options: Options, tier: Combat2183MusicianTier): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 455 : tier === 'skill' ? 360 : 285;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.028, base, base + 82));
}

function angle(options: Options): number {
  return Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x);
}

function addNote(scene: Phaser.Scene, p: Palette, scale = 1): Phaser.GameObjects.Container {
  const note = scene.add.container(0, 0).setScale(scale);
  const head = scene.add.ellipse(-6, 8, 18, 12, p.main, 0.94).setRotation(-0.25);
  const stem = scene.add.rectangle(2, -6, 4, 28, p.main, 0.92);
  const flag = scene.add.triangle(11, -18, -7, -6, 11, -2, 11, 8, p.accent, 0.84);
  const core = scene.add.ellipse(-5, 7, 7, 4, p.core, 0.8).setRotation(-0.25).setBlendMode(Phaser.BlendModes.ADD);
  note.add([head, stem, flag, core]);
  return note;
}

async function playPulseNote(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 8)
    .setRotation(angle(options) * 0.08 - 0.08);
  const note = addNote(options.scene, p, 1);
  const echo = options.scene.add.ellipse(-25, 0, 48, 28, 0x000000, 0).setStrokeStyle(2.5, p.main, 0.4).setBlendMode(Phaser.BlendModes.ADD);
  root.add([echo, note]);
  const ms = travelMs(options, 'normal');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Sine.easeInOut' }, ms + 260); }
  finally { root.destroy(true); }

  const hit = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 15);
  const ring = options.scene.add.ellipse(0, 0, 62, 34, 0x000000, 0).setStrokeStyle(3, p.main, 0.72);
  const center = options.scene.add.circle(0, 0, 8, p.core, 0.28).setBlendMode(Phaser.BlendModes.ADD);
  hit.add([ring, center]);
  try { await tween(options.scene, hit, { scaleX: 1.38, scaleY: 1.38, alpha: 0, duration: 145, ease: 'Sine.easeOut' }, 330); }
  finally { hit.destroy(true); }
}

async function playChordWave(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 9)
    .setRotation(angle(options) * 0.05);
  const noteA = addNote(options.scene, p, 0.82).setPosition(-13, -17);
  const noteB = addNote(options.scene, p, 1).setPosition(9, 0);
  const noteC = addNote(options.scene, p, 0.72).setPosition(-3, 19);
  const waves = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  [34, 51, 68].forEach((r, i) => {
    waves.lineStyle(3.5 - i * 0.45, i % 2 ? p.accent : p.main, 0.62 - i * 0.1);
    waves.strokeEllipse(-8, 0, r * 1.6, r * 0.72);
  });
  root.add([waves, noteA, noteB, noteC]);
  const ms = travelMs(options, 'skill');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Sine.easeInOut' }, ms + 280); }
  finally { root.destroy(true); }

  const chord = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 16);
  const wavesHit = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  [40, 62, 84].forEach((r, i) => {
    wavesHit.lineStyle(4 - i * 0.5, i === 1 ? p.core : p.main, 0.7 - i * 0.1);
    wavesHit.strokeEllipse(0, 0, r * 1.65, r * 0.72);
  });
  const center = options.scene.add.circle(0, 0, 13, p.core, 0.26).setBlendMode(Phaser.BlendModes.ADD);
  chord.add([wavesHit, center]);
  try { await tween(options.scene, chord, { scaleX: 1.35, scaleY: 1.35, alpha: 0, duration: 205, ease: 'Cubic.easeOut' }, 420); }
  finally { chord.destroy(true); }
}

async function playSymphonyCrescendo(options: Options, p: Palette): Promise<void> {
  const root = options.scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 11)
    .setRotation(angle(options) * 0.03);
  const note = addNote(options.scene, p, 1.25);
  const staff = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let i = -2; i <= 2; i += 1) {
    staff.lineStyle(i === 0 ? 4 : 2.5, i === 0 ? p.core : p.main, i === 0 ? 0.66 : 0.42);
    staff.lineBetween(-82, i * 14, 94, i * 14);
  }
  const halo = options.scene.add.ellipse(0, 0, 164, 104, 0x000000, 0).setStrokeStyle(5, p.accent, 0.62).setBlendMode(Phaser.BlendModes.ADD);
  root.add([halo, staff, note]);
  const ms = travelMs(options, 'ultimate');
  try { await tween(options.scene, root, { x: options.target.x, y: options.target.y, duration: ms, ease: 'Cubic.easeInOut' }, ms + 300); }
  finally { root.destroy(true); }

  const impact = options.scene.add.container(options.target.x, options.target.y).setDepth(powVfxDepth('foreground') + 19).setScale(0.58);
  const sound = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  [62, 92, 124].forEach((r, i) => {
    sound.lineStyle(7 - i * 1.3, i === 1 ? p.core : p.main, 0.76 - i * 0.12);
    sound.strokeEllipse(0, 0, r * 1.7, r * 0.72);
  });
  const star = options.scene.add.polygon(0, 0, [0,-39,12,-13,38,-12,18,7,25,34,0,20,-25,34,-18,7,-38,-12,-12,-13], p.accent, 0.16).setStrokeStyle(4, p.core, 0.7);
  const flash = options.scene.add.circle(0, 0, 28, p.core, 0.28).setBlendMode(Phaser.BlendModes.ADD);
  impact.add([sound, star, flash]);
  if (options.scene.cameras?.main) {
    options.scene.cameras.main.shake(options.reducedMotion ? 66 : 110, options.reducedMotion ? 0.001 : 0.0028, false);
  }
  try { await tween(options.scene, impact, { scaleX: 1.52, scaleY: 1.52, alpha: 0, duration: options.reducedMotion ? 150 : 275, ease: 'Cubic.easeOut' }, 550); }
  finally { impact.destroy(true); }
}

export async function playCombat2183MusicianDistinctTierVfx(options: Options, tier: Combat2183MusicianTier): Promise<void> {
  const p = PALETTE[options.element] ?? PALETTE.neutral;
  if (tier === 'ultimate') return playSymphonyCrescendo(options, p);
  if (tier === 'skill') return playChordWave(options, p);
  return playPulseNote(options, p);
}

(globalThis as any).POWDER_COMBAT2_MUSICIAN_DISTINCT_TIERS = {
  version: COMBAT2183_MUSICIAN_VERSION,
  role: 'musician',
  owner: 'dedicated-manual',
  realCombatReady: true,
  tiers: {
    normal: 'pulse-note',
    skill: 'chord-wave',
    ultimate: 'symphony-crescendo'
  },
  normalCameraShake: false,
  skillCameraShake: false,
  ultimateCameraShake: true,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
