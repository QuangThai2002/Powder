import Phaser from 'phaser';
import {
  EXACT_STATUS_VFX,
  exactElementVfx,
  type ExactCombatVfxSpec
} from './Combat2140ExactVfxRegistry';
import {
  NIGHT_STATUS_VFX_DEFAULTS,
  powVfxDepth,
  powVfxWorldAnchor,
  type PowVfxLayout
} from './CombatNightVfxLayout';
import { PersistentPowStatusVfx, type PersistentPowStatusKind } from './PersistentPowStatusVfx';
import { PowView } from '../views/PowView';

const FLAG = '__powderCombatNightCuratedStatusAssetBridgeInstalled';
const LEGACY_PERSISTENT_KEY = '__powderCombat2140PersistentFx';
const STATUS_PHASES = 12;

type StatusAnimator = {
  update: (time: number) => void;
};

type SceneTickerState = {
  scene: Phaser.Scene;
  animators: Set<StatusAnimator>;
  onUpdate: (time: number, delta: number) => void;
  onSceneExit: () => void;
};

const sceneTickers = new WeakMap<Phaser.Scene, SceneTickerState>();

function specFor(kind: PersistentPowStatusKind): ExactCombatVfxSpec | null {
  if (kind === 'burn') return EXACT_STATUS_VFX.burn;
  if (kind === 'freeze') return EXACT_STATUS_VFX.freeze;
  if (kind === 'stun') return EXACT_STATUS_VFX.stun;
  if (kind === 'poison') return exactElementVfx('poison');
  return null;
}

function assetAlpha(kind: PersistentPowStatusKind): number {
  if (kind === 'poison') return 0.24;
  if (kind === 'freeze') return 0.32;
  if (kind === 'stun') return 0.3;
  return 0.28;
}

function animationIntervalMs(): number {
  const currentTier = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  const reducedMotion = typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  if (reducedMotion) return 150;
  if (currentTier === 'lite') return 125;
  if (currentTier === 'balanced') return 100;
  return 80;
}

function detachTicker(state: SceneTickerState): void {
  state.scene.events.off(Phaser.Scenes.Events.UPDATE, state.onUpdate);
  state.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, state.onSceneExit);
  state.scene.events.off(Phaser.Scenes.Events.DESTROY, state.onSceneExit);
  state.animators.clear();
  sceneTickers.delete(state.scene);
}

function tickerFor(scene: Phaser.Scene): SceneTickerState {
  const existing = sceneTickers.get(scene);
  if (existing) return existing;

  const state = {} as SceneTickerState;
  state.scene = scene;
  state.animators = new Set<StatusAnimator>();
  state.onUpdate = (time: number): void => {
    for (const animator of state.animators) animator.update(time);
  };
  state.onSceneExit = (): void => detachTicker(state);

  scene.events.on(Phaser.Scenes.Events.UPDATE, state.onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, state.onSceneExit);
  scene.events.once(Phaser.Scenes.Events.DESTROY, state.onSceneExit);
  sceneTickers.set(scene, state);
  return state;
}

function registerAnimator(scene: Phaser.Scene, update: (time: number) => void): () => void {
  const state = tickerFor(scene);
  const animator: StatusAnimator = { update };
  state.animators.add(animator);
  let removed = false;

  return (): void => {
    if (removed) return;
    removed = true;
    state.animators.delete(animator);
    if (state.animators.size === 0 && sceneTickers.get(scene) === state) detachTicker(state);
  };
}

function previewImage(
  scene: Phaser.Scene,
  kind: PersistentPowStatusKind,
  size: number
): Phaser.GameObjects.Image | null {
  const spec = specFor(kind);
  if (!spec || !scene.textures.exists(spec.textureKey)) return null;

  const image = scene.add.image(0, 0, spec.textureKey)
    .setDisplaySize(size, size)
    .setAlpha(spec.alpha * assetAlpha(kind));
  if (kind !== 'poison') image.setBlendMode(Phaser.BlendModes.ADD);
  return image;
}

function wave(step: number, offset = 0): number {
  return Math.sin((((step + offset) % STATUS_PHASES) / STATUS_PHASES) * Math.PI * 2);
}

function buildBurnAnimation(
  scene: Phaser.Scene,
  fx: Phaser.GameObjects.Container,
  size: number
): (step: number) => void {
  const glow = scene.add.ellipse(0, size * 0.08, size * 0.58, size * 0.74, 0xff5a32, 0.045)
    .setStrokeStyle(2, 0xff7043, 0.34);
  const flameLeft = scene.add.triangle(
    -size * 0.18, size * 0.14,
    -size * 0.08, size * 0.16,
    size * 0.08, size * 0.16,
    0, -size * 0.22,
    0xff7a32, 0.72
  );
  const flameCenter = scene.add.triangle(
    0, size * 0.1,
    -size * 0.1, size * 0.2,
    size * 0.1, size * 0.2,
    0, -size * 0.3,
    0xffc34a, 0.78
  );
  const flameRight = scene.add.triangle(
    size * 0.18, size * 0.15,
    -size * 0.075, size * 0.15,
    size * 0.075, size * 0.15,
    0, -size * 0.2,
    0xff5a32, 0.68
  );
  fx.add([glow, flameLeft, flameCenter, flameRight]);

  return (step: number): void => {
    const leftWave = wave(step, 0);
    const centerWave = wave(step, 3);
    const rightWave = wave(step, 6);
    glow.setAlpha(0.035 + (wave(step, 2) + 1) * 0.018).setScale(1 + wave(step, 1) * 0.035);
    flameLeft
      .setY(size * 0.14 - leftWave * size * 0.035)
      .setScale(0.92 + (leftWave + 1) * 0.07, 0.9 + (leftWave + 1) * 0.12)
      .setRotation(-0.08 + leftWave * 0.08)
      .setAlpha(0.58 + (leftWave + 1) * 0.11);
    flameCenter
      .setY(size * 0.1 - centerWave * size * 0.045)
      .setScale(0.94 + (centerWave + 1) * 0.06, 0.92 + (centerWave + 1) * 0.14)
      .setRotation(centerWave * 0.05)
      .setAlpha(0.64 + (centerWave + 1) * 0.1);
    flameRight
      .setY(size * 0.15 - rightWave * size * 0.032)
      .setScale(0.92 + (rightWave + 1) * 0.065, 0.9 + (rightWave + 1) * 0.11)
      .setRotation(0.08 + rightWave * 0.08)
      .setAlpha(0.56 + (rightWave + 1) * 0.1);
  };
}

function buildPoisonAnimation(
  scene: Phaser.Scene,
  fx: Phaser.GameObjects.Container,
  size: number
): (step: number) => void {
  const puddle = scene.add.graphics();
  puddle.fillStyle(0x674195, 0.18);
  puddle.fillEllipse(0, size * 0.12, size * 0.86, size * 0.22);
  puddle.fillEllipse(-size * 0.24, size * 0.09, size * 0.34, size * 0.15);
  puddle.fillEllipse(size * 0.27, size * 0.15, size * 0.28, size * 0.13);
  puddle.lineStyle(2, 0x9bdc72, 0.36);
  puddle.strokeEllipse(-size * 0.05, size * 0.11, size * 0.78, size * 0.2);

  const bubbleA = scene.add.circle(-size * 0.23, size * 0.08, Math.max(3, size * 0.045), 0xa5df66, 0.56);
  const bubbleB = scene.add.circle(size * 0.05, size * 0.12, Math.max(2.5, size * 0.036), 0x8e64c5, 0.52);
  const bubbleC = scene.add.circle(size * 0.27, size * 0.1, Math.max(2.5, size * 0.032), 0xc4f58e, 0.48);
  fx.add([puddle, bubbleA, bubbleB, bubbleC]);

  const bubbles = [bubbleA, bubbleB, bubbleC];
  const baseX = [-size * 0.23, size * 0.05, size * 0.27];
  const offsets = [0, 4, 8];

  return (step: number): void => {
    puddle.setScale(1 + wave(step, 1) * 0.018, 1 + wave(step, 5) * 0.025).setAlpha(0.84 + wave(step, 3) * 0.1);
    bubbles.forEach((bubble, index) => {
      const phase = ((step + offsets[index]) % STATUS_PHASES) / (STATUS_PHASES - 1);
      bubble
        .setPosition(
          baseX[index] + wave(step, index * 2) * size * 0.018,
          size * 0.1 - phase * size * 0.28
        )
        .setScale(0.72 + phase * 0.48)
        .setAlpha(Math.max(0.08, 0.64 * (1 - phase)));
    });
  };
}

function redrawElectricArc(
  graphics: Phaser.GameObjects.Graphics,
  side: -1 | 1,
  step: number,
  size: number
): void {
  const jitter = ((step % 3) - 1) * size * 0.025;
  const flash = step % 4 === 0 ? 1 : 0.68;
  graphics.clear();
  graphics.lineStyle(Math.max(2, size * 0.024), 0xffef77, flash);
  graphics.beginPath();
  graphics.moveTo(side * size * 0.08, -size * 0.06);
  graphics.lineTo(side * size * 0.2, -size * 0.16 + jitter);
  graphics.lineTo(side * size * 0.15, -size * 0.27 - jitter);
  graphics.lineTo(side * size * 0.32, -size * 0.34 + jitter);
  graphics.strokePath();
  graphics.lineStyle(Math.max(1, size * 0.012), 0xffffff, 0.82);
  graphics.beginPath();
  graphics.moveTo(side * size * 0.1, -size * 0.08);
  graphics.lineTo(side * size * 0.21, -size * 0.17 + jitter);
  graphics.lineTo(side * size * 0.17, -size * 0.26 - jitter);
  graphics.strokePath();
}

function buildStunAnimation(
  scene: Phaser.Scene,
  fx: Phaser.GameObjects.Container,
  size: number
): (step: number) => void {
  const ring = scene.add.ellipse(0, -size * 0.1, size * 0.62, size * 0.2, 0xf5dd62, 0.025)
    .setStrokeStyle(Math.max(2, size * 0.018), 0xf5dd62, 0.72);
  const arcLeft = scene.add.graphics();
  const arcRight = scene.add.graphics();
  const sparkA = scene.add.circle(-size * 0.3, -size * 0.22, Math.max(2, size * 0.025), 0xffffff, 0.78);
  const sparkB = scene.add.circle(size * 0.28, -size * 0.3, Math.max(2, size * 0.022), 0xffef77, 0.72);
  fx.add([ring, arcLeft, arcRight, sparkA, sparkB]);

  return (step: number): void => {
    redrawElectricArc(arcLeft, -1, step, size);
    redrawElectricArc(arcRight, 1, step + 2, size);
    ring
      .setRotation((step / STATUS_PHASES) * Math.PI * 0.7)
      .setScale(0.96 + wave(step, 1) * 0.045)
      .setAlpha(0.62 + (wave(step, 4) + 1) * 0.12);
    sparkA
      .setPosition(-size * 0.3 + wave(step, 1) * size * 0.035, -size * 0.22 + wave(step, 5) * size * 0.025)
      .setAlpha(step % 3 === 0 ? 0.96 : 0.42);
    sparkB
      .setPosition(size * 0.28 + wave(step, 6) * size * 0.03, -size * 0.3 + wave(step, 2) * size * 0.03)
      .setAlpha(step % 4 === 1 ? 0.96 : 0.38);
  };
}

function buildFreezeAnimation(
  scene: Phaser.Scene,
  fx: Phaser.GameObjects.Container,
  size: number
): (step: number) => void {
  const frost = scene.add.ellipse(0, 0, size * 0.64, size * 0.9, 0x8adfff, 0.025)
    .setStrokeStyle(2, 0x9ee9ff, 0.52);
  const shards = [
    scene.add.triangle(-size * 0.24, size * 0.17, -4, 8, 4, 8, 0, -size * 0.2, 0xc9f5ff, 0.66),
    scene.add.triangle(size * 0.23, size * 0.12, -4, 8, 4, 8, 0, -size * 0.18, 0x8adfff, 0.62),
    scene.add.triangle(-size * 0.12, -size * 0.19, -3, 6, 3, 6, 0, -size * 0.14, 0xe8fcff, 0.56),
    scene.add.triangle(size * 0.14, -size * 0.24, -3, 6, 3, 6, 0, -size * 0.13, 0xb8efff, 0.54)
  ];
  fx.add([frost, ...shards]);

  return (step: number): void => {
    frost.setAlpha(0.42 + (wave(step, 2) + 1) * 0.08).setScale(0.98 + wave(step, 4) * 0.025);
    shards.forEach((shard, index) => {
      const shardWave = wave(step, index * 2);
      shard
        .setRotation((index % 2 === 0 ? -0.14 : 0.14) + shardWave * 0.07)
        .setY(shard.y - shardWave * 0.35)
        .setScale(0.92 + (shardWave + 1) * 0.06)
        .setAlpha(0.46 + (shardWave + 1) * 0.12);
    });
  };
}

function createAnimatedFallback(
  scene: Phaser.Scene,
  kind: PersistentPowStatusKind,
  x: number,
  y: number,
  layout: PowVfxLayout
): Phaser.GameObjects.Container {
  const profile = NIGHT_STATUS_VFX_DEFAULTS[kind];
  const anchor = powVfxWorldAnchor(x, y, layout, profile.anchor);
  const maxWidth = layout.artWidth * layout.fieldScale * profile.widthRatio;
  const maxHeight = layout.artHeight * layout.fieldScale * profile.heightRatio;
  const size = Math.max(32, Math.min(maxWidth, maxHeight));
  const fx = scene.add.container(anchor.x, anchor.y)
    .setDepth(powVfxDepth(kind === 'poison' ? 'ground' : profile.layer));

  const preview = previewImage(scene, kind, size);
  if (preview) fx.add(preview);

  const animatePhase = kind === 'burn'
    ? buildBurnAnimation(scene, fx, size)
    : kind === 'poison'
      ? buildPoisonAnimation(scene, fx, size)
      : kind === 'freeze'
        ? buildFreezeAnimation(scene, fx, size)
        : buildStunAnimation(scene, fx, size);

  let lastStep = -1;
  const unregister = registerAnimator(scene, (time: number): void => {
    const interval = animationIntervalMs();
    const step = Math.floor(time / interval) % STATUS_PHASES;
    if (step === lastStep || !fx.active || !fx.visible) return;
    lastStep = step;
    animatePhase(step);
  });

  animatePhase(0);
  fx.once('destroy', unregister);
  return fx;
}

/**
 * Full sprite-sheet playback inside PersistentPowStatusVfx remains first priority.
 * Current Git assets are representative preview frames, so Night 35 turns the fallback
 * into a live, bounded status animation without pretending those previews are full sheets.
 */
function installCuratedFallback(): void {
  const proto = PersistentPowStatusVfx.prototype as any;
  if (proto.__nightCuratedFallbackInstalled) return;
  const previousFallback = proto.createFallback;
  if (typeof previousFallback !== 'function') return;

  proto.createFallback = function combatNightCuratedStatusFallback(
    this: { scene: Phaser.Scene },
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): Phaser.GameObjects.GameObject {
    try {
      return createAnimatedFallback(this.scene, kind, x, y, layout);
    } catch {
      return previousFallback.call(this, kind, x, y, layout);
    }
  };

  proto.__nightCuratedFallbackInstalled = true;
}

/** Prevent the old 2.14.0 persistent image from drawing on top of the Night owner. */
function installLegacyPersistentDedup(): void {
  const proto = PowView.prototype as any;
  if (proto.__nightPersistentDedupInstalled) return;
  const previousUpdate = proto.updateRuntime;
  if (typeof previousUpdate !== 'function') return;

  proto.updateRuntime = function combatNightPersistentDedup(this: any, unit: any): void {
    previousUpdate.call(this, unit);
    const legacy = this[LEGACY_PERSISTENT_KEY] as Phaser.GameObjects.Image | undefined;
    if (legacy?.scene && this.persistentStatusVfx) legacy.setVisible(false);
  };

  proto.__nightPersistentDedupInstalled = true;
}

export function installCombatNightCuratedStatusAssetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;
  installCuratedFallback();
  installLegacyPersistentDedup();

  root.POWDER_COMBAT2_NIGHT_STATUS_ASSETS = {
    version: 'night-35',
    mode: 'curated-preview-plus-live-status-animation',
    fullSheetPriority: true,
    representativePreviewFrames: true,
    animatedFallback: true,
    animatedBurn: true,
    animatedPoison: true,
    animatedStunElectric: true,
    animatedFreeze: true,
    sharedSceneTicker: true,
    phases: STATUS_PHASES,
    perFrameObjectCreation: false,
    particleEmitters: false,
    tweenLoops: false,
    duplicateLegacyPersistentHidden: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_NIGHT_PERSISTENT_STATUS = {
    ...(root.POWDER_COMBAT2_NIGHT_PERSISTENT_STATUS || {}),
    version: 'night-35',
    ownerPerPowMax: 1,
    sceneShutdownCleanup: true,
    poisonBadgeGlyph: 'hazard-no-skull',
    fullSheetPriority: true,
    animatedFallback: true,
    sharedSceneTicker: true,
    particleEmitters: false,
    tweenLoops: false,
    combatLogicChanged: false
  };
}

installCombatNightCuratedStatusAssetBridge();
