import Phaser from 'phaser';
import { powVfxDepth } from './CombatNightVfxLayout';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import {
  combatVfxAssetState,
  combatVfxLayerBudget,
  ensureCombatVfxTexture,
  resolveCombatVfxAction,
  resolveCombatVfxHitSequence,
  resolveCombatVfxQualityPreset,
  resolveCombatVfxUltimate,
  runCombatVfxRegistryRegression,
  type CombatVfxAssetSpec,
  type CombatVfxQualityPreset
} from './CombatVfxRegistry';
import { CombatVfxTimeline } from './CombatVfxTimeline';

export const COMBAT2201_HIGH_FANTASY_VFX_VERSION = '2.20.1';

export type Combat2201ActionTier = 'normal' | 'skill' | 'ultimate';
type Combat2201Role = 'marksman' | 'mage' | 'enchanter' | 'healer' | 'musician' | 'tank' | 'fighter' | 'knight' | 'assassin' | 'fallback';
type FxQuality = 'full' | 'balanced' | 'lite';
type UltimateCircleRarity = 'common' | 'rare' | 'super_rare' | 'epic' | 'legendary' | 'mythic' | 'ancient';

export type Combat2201ActionOptions = DirectionalProjectileOptions & {
  role?: string;
  scope?: Combat2201VfxScope;
  signature?: { tier?: Combat2201ActionTier; role?: string; traits?: readonly string[]; visualHitCount?: number; rarity?: string };
  presentation?: {
    scale?: number;
    speed?: number;
    travelDurationMs?: number;
    multiHitCadenceMs?: number;
    suppressSourceRelease?: boolean;
    onProjectileArrival?: () => void;
    onImpact?: (event: { hitIndex: number; hitCount: number; point: Phaser.Math.Vector2 }) => void;
  };
};

export type Combat2201MagicCircleOptions = {
  scene: Phaser.Scene;
  point: Phaser.Math.Vector2;
  element: unknown;
  tier: Combat2201ActionTier;
  role?: string;
  traits?: readonly string[];
  reducedMotion?: boolean;
  depth?: number;
  holdMs?: number;
  scope?: Combat2201VfxScope;
};

type Combat2201UltimateReadyCircleOptions = {
  scene: Phaser.Scene;
  rarity?: string;
  element: unknown;
  x: number;
  y: number;
  /** Diameter in the owning Pow view's local coordinates, never native sheet pixels. */
  visualDiameter?: number;
  reducedMotion?: boolean;
};

export type Combat2201VfxScope = Readonly<{
  cleanup: () => void;
  activeCount: () => number;
  isCleanedUp: () => boolean;
}>;

export type Combat2201VfxPreviewOptions = Readonly<{
  scene: Phaser.Scene;
  source: Phaser.Math.Vector2;
  target: Phaser.Math.Vector2;
  element: unknown;
  role?: string;
  tier?: Combat2201ActionTier;
  reducedMotion?: boolean;
  scope?: Combat2201VfxScope;
}>;

type ElementProfile = {
  primary: number;
  secondary: number;
  shadow: number;
  language: 'ember' | 'ripple' | 'crystal' | 'lightning' | 'wind' | 'stone' | 'venom' | 'radiant' | 'void' | 'leaf' | 'steel';
};

const FAIRY_SIGIL_KEY = 'combat-fairy-anime-sigil-v1';
const MAX_ACTIVE_ACTIONS = 5;
let activeActions = 0;

const ULTIMATE_CIRCLE_RARITY: Readonly<Record<UltimateCircleRarity, Readonly<{
  rings: number; runes: number; arcs: number; halo: number; radius: number;
}>>> = Object.freeze({
  common: Object.freeze({ rings: 1, runes: 4, arcs: 4, halo: 0.08, radius: 82 }),
  rare: Object.freeze({ rings: 2, runes: 6, arcs: 5, halo: 0.1, radius: 88 }),
  super_rare: Object.freeze({ rings: 2, runes: 8, arcs: 6, halo: 0.12, radius: 94 }),
  epic: Object.freeze({ rings: 3, runes: 10, arcs: 7, halo: 0.14, radius: 102 }),
  legendary: Object.freeze({ rings: 3, runes: 12, arcs: 8, halo: 0.17, radius: 110 }),
  mythic: Object.freeze({ rings: 4, runes: 14, arcs: 9, halo: 0.2, radius: 120 }),
  ancient: Object.freeze({ rings: 4, runes: 16, arcs: 10, halo: 0.24, radius: 132 })
});

const ULTIMATE_BACK_ASSET_BY_RARITY: Readonly<Partial<Record<UltimateCircleRarity, string>>> = Object.freeze({
  common: 'ultimate_ready_common',
  rare: 'ultimate_ready_rare',
  super_rare: 'ultimate_ready_super_rare',
  epic: 'ultimate_ready_epic',
  legendary: 'ultimate_ready_legendary',
  mythic: 'ultimate_ready_mythic',
  ancient: 'ultimate_ready_ancient'
});

type Combat2201VfxScopeState = {
  roots: Set<Phaser.GameObjects.GameObject>;
  cleanedUp: boolean;
};

type Combat2201VfxScopeInternal = Combat2201VfxScope & {
  state: Combat2201VfxScopeState;
};

const PROFILES: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { primary: 0xff7043, secondary: 0xffe3a2, shadow: 0x5a1420, language: 'ember' },
  lava: { primary: 0xf35b37, secondary: 0xffc86b, shadow: 0x46101a, language: 'ember' },
  water: { primary: 0x4db9ff, secondary: 0xd9f8ff, shadow: 0x0c315d, language: 'ripple' },
  ice: { primary: 0x8adfff, secondary: 0xffffff, shadow: 0x1a4d74, language: 'crystal' },
  lightning: { primary: 0xf5dd62, secondary: 0xffffff, shadow: 0x6b4f10, language: 'lightning' },
  storm: { primary: 0x8099ff, secondary: 0xe0e6ff, shadow: 0x242e73, language: 'lightning' },
  wind: { primary: 0x76e4d2, secondary: 0xf0fffb, shadow: 0x135a55, language: 'wind' },
  leaf: { primary: 0x72d67f, secondary: 0xe3ffbd, shadow: 0x1e6338, language: 'leaf' },
  poison: { primary: 0xa5df66, secondary: 0xeeffb8, shadow: 0x395d22, language: 'venom' },
  earth: { primary: 0xb78c5d, secondary: 0xffddb4, shadow: 0x51331f, language: 'stone' },
  steel: { primary: 0xc3d3dc, secondary: 0xffffff, shadow: 0x435765, language: 'steel' },
  light: { primary: 0xffefad, secondary: 0xffffff, shadow: 0x6a5420, language: 'radiant' },
  dark: { primary: 0xa88cf2, secondary: 0xf0e5ff, shadow: 0x1e113d, language: 'void' },
  neutral: { primary: 0x9ed8e8, secondary: 0xf4ffff, shadow: 0x28505d, language: 'wind' }
});

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function profileFor(value: unknown): ElementProfile {
  const key = normalize(value);
  if (key.includes('dung nham') || key.includes('lava')) return PROFILES.lava;
  if (key.includes('fire') || key.includes('lua')) return PROFILES.fire;
  if (key.includes('water') || key.includes('nuoc')) return PROFILES.water;
  if (key.includes('ice') || key.includes('bang')) return PROFILES.ice;
  if (key.includes('storm') || key.includes('bao')) return PROFILES.storm;
  if (key.includes('lightning') || key.includes('set') || key.includes('electric')) return PROFILES.lightning;
  if (key.includes('wind') || key.includes('gio')) return PROFILES.wind;
  if (key.includes('leaf') || key.includes('la') || key.includes('nature')) return PROFILES.leaf;
  if (key.includes('poison') || key.includes('doc')) return PROFILES.poison;
  if (key.includes('earth') || key.includes('dat')) return PROFILES.earth;
  if (key.includes('steel') || key.includes('thep')) return PROFILES.steel;
  if (key.includes('light') || key.includes('anh sang')) return PROFILES.light;
  if (key.includes('dark') || key.includes('bong toi')) return PROFILES.dark;
  return PROFILES.neutral;
}

function roleFor(value: unknown): Combat2201Role {
  const role = normalize(value);
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('enchanter') || role.includes('warlock')) return 'enchanter';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  if (role.includes('dau si') || role.includes('fighter')) return 'fighter';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  if (role.includes('sat thu') || role.includes('assassin')) return 'assassin';
  return 'fallback';
}

function qualityFor(reducedMotion: boolean): FxQuality {
  const preset = resolveCombatVfxQualityPreset(reducedMotion);
  if (preset === 'low') return 'lite';
  if (preset === 'medium' || activeActions >= MAX_ACTIVE_ACTIONS) return 'balanced';
  return 'full';
}

function active(scene: Phaser.Scene): boolean {
  return Boolean(scene?.sys?.isActive?.());
}

/** A small owner used only by the admin lab so cleanup cannot touch live combat VFX. */
export function createCombat2201VfxScope(): Combat2201VfxScope {
  const state: Combat2201VfxScopeState = { roots: new Set(), cleanedUp: false };
  const scope: Combat2201VfxScopeInternal = {
    state,
    cleanup: () => {
      if (state.cleanedUp) return;
      state.cleanedUp = true;
      for (const root of state.roots) {
        try { root.destroy(true); } catch { /* Phaser scene teardown may already own this root. */ }
      }
      state.roots.clear();
    },
    activeCount: () => state.roots.size,
    isCleanedUp: () => state.cleanedUp
  };
  return scope;
}

function trackVfxRoot<T extends Phaser.GameObjects.GameObject>(scope: Combat2201VfxScope | undefined, root: T): T {
  const state = (scope as Combat2201VfxScopeInternal | undefined)?.state;
  if (!state) return root;
  if (state.cleanedUp) {
    try { root.destroy(true); } catch { /* cleanup has already removed the scene object. */ }
    return root;
  }
  state.roots.add(root);
  return root;
}

function disposeVfxRoot(scope: Combat2201VfxScope | undefined, root: Phaser.GameObjects.GameObject): void {
  const state = (scope as Combat2201VfxScopeInternal | undefined)?.state;
  state?.roots.delete(root);
  try { root.destroy(true); } catch { /* already disposed by explicit cleanup or scene teardown */ }
}

function safeTween(scene: Phaser.Scene, target: object, config: any, fallbackMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let tween: Phaser.Tweens.Tween | null = null;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      try { tween?.stop(); } catch { /* scene teardown owns tween cleanup */ }
      finish();
    };
    const timer = window.setTimeout(finish, Math.max(160, fallbackMs));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      tween = scene.tweens.add({ targets: target, ...config, onComplete: finish, onStop: finish });
    } catch { finish(); }
  });
}

function registryQuality(quality: FxQuality): CombatVfxQualityPreset {
  return quality === 'lite' ? 'low' : quality === 'balanced' ? 'medium' : 'high';
}

function spriteAnimationKey(spec: CombatVfxAssetSpec): string {
  return `combat-vfx-sheet-${spec.textureKey}`;
}

function createMappedSprite(
  scene: Phaser.Scene,
  assetId: string | undefined,
  context: string,
  maxFrameSize: number,
  alpha = 1
): Phaser.GameObjects.Sprite | null {
  const spec = ensureCombatVfxTexture(scene, assetId, context);
  if (!spec) return null;
  const key = spriteAnimationKey(spec);
  try {
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(spec.textureKey, { start: 0, end: spec.frames - 1 }),
        frameRate: spec.fps,
        repeat: 0,
        skipMissedFrames: true
      });
    }
    const sprite = scene.add.sprite(0, 0, spec.textureKey, 0)
      .setOrigin(0.5)
      .setAlpha(alpha)
      .setVisible(true)
      .setBlendMode(spec.blend)
      .setScale(maxFrameSize / Math.max(spec.frameWidth, spec.frameHeight));
    sprite.play(key);
    return sprite;
  } catch {
    return null;
  }
}

function createUltimateBackCircleSprite(
  scene: Phaser.Scene,
  rarity: UltimateCircleRarity,
  profile: ElementProfile,
  displayDiameter: number,
  alpha: number,
  y = 0
): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | null {
  const assetId = ULTIMATE_BACK_ASSET_BY_RARITY[rarity];
  const spec = ensureCombatVfxTexture(scene, assetId, 'ultimate-back-circle');
  if (!spec) return null;
  try {
    if (spec.staticImage) {
      return scene.add.image(0, y, spec.textureKey)
        .setOrigin(0.5)
        .setAlpha(Math.min(1, alpha))
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setDisplaySize(displayDiameter, displayDiameter);
    }
    const key = spriteAnimationKey(spec);
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(spec.textureKey, { start: 0, end: spec.frames - 1 }),
        frameRate: spec.fps,
        repeat: 0,
        skipMissedFrames: true
      });
    }
    const sprite = scene.add.sprite(0, y, spec.textureKey, 0)
      .setOrigin(0.5)
      .setAlpha(Math.min(1, alpha))
      .setTint(profile.primary)
      // Additive blending was washing the full portrait in bright authored sheets.
      // Normal alpha keeps the sigil readable while it remains behind the Pow.
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setScale(displayDiameter / spec.frameWidth);
    sprite.play(key);
    return sprite;
  } catch {
    return null;
  }
}

function runPresentationCallback(callback: (() => void) | undefined, key: string): void {
  if (!callback) return;
  try { callback(); }
  catch { /* VFX callbacks must never interrupt the combat action pipeline. */ }
  void key;
}

function waitForVfxCadence(scene: Phaser.Scene, duration: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let event: Phaser.Time.TimerEvent | undefined;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, finish);
      scene.events.off(Phaser.Scenes.Events.DESTROY, finish);
      try { event?.remove(false); } catch { /* scene cleanup owns the event */ }
      resolve();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);
    scene.events.once(Phaser.Scenes.Events.DESTROY, finish);
    try { event = scene.time.delayedCall(duration, finish); }
    catch { finish(); }
  });
}

function addArcBand(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  radius: number,
  segments: number,
  color: number,
  width: number,
  alpha: number,
  phase: number,
  anticlockwise = false
): Phaser.GameObjects.Graphics {
  const art = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const span = (Math.PI * 2 / segments) * 0.56;
  art.lineStyle(width, color, alpha);
  for (let index = 0; index < segments; index += 1) {
    const start = phase + Math.PI * 2 * index / segments;
    art.beginPath();
    art.arc(0, 0, radius, start, start + span, anticlockwise);
    art.strokePath();
  }
  root.add(art);
  return art;
}

function addRuneNodes(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  radius: number,
  count: number,
  profile: ElementProfile,
  phase: number,
  quality: FxQuality
): Phaser.GameObjects.Container {
  const band = scene.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);
  const nodes = quality === 'lite' ? Math.max(5, Math.ceil(count * 0.55)) : count;
  for (let index = 0; index < nodes; index += 1) {
    const angle = phase + Math.PI * 2 * index / nodes;
    const size = index % 3 === 0 ? 9 : 6;
    const rune = scene.add.rectangle(Math.cos(angle) * radius, Math.sin(angle) * radius, size, size * 1.62, profile.secondary, 0.82)
      .setRotation(angle + Math.PI * 0.5);
    band.add(rune);
  }
  root.add(band);
  return band;
}

function addElementCircleLanguage(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  profile: ElementProfile,
  radius: number,
  quality: FxQuality
): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);
  const detail = quality === 'full' ? 1 : quality === 'balanced' ? 0.74 : 0.5;
  const art = scene.add.graphics();

  if (profile.language === 'ember') {
    art.lineStyle(3, profile.primary, 0.86);
    const count = Math.max(5, Math.round(9 * detail));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count;
      const inner = radius * (0.48 + (i % 2) * 0.08);
      const outer = radius * (0.82 + (i % 3) * 0.08);
      art.lineBetween(Math.cos(angle - 0.08) * inner, Math.sin(angle - 0.08) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
      art.lineBetween(Math.cos(angle) * outer, Math.sin(angle) * outer, Math.cos(angle + 0.11) * inner, Math.sin(angle + 0.11) * inner);
    }
  } else if (profile.language === 'ripple') {
    art.lineStyle(2.4, profile.primary, 0.76);
    art.strokeEllipse(0, 0, radius * 1.58, radius * 0.5);
    art.lineStyle(1.8, profile.secondary, 0.62);
    art.strokeEllipse(0, 0, radius * 1.12, radius * 0.34);
  } else if (profile.language === 'crystal') {
    art.lineStyle(2.6, profile.primary, 0.86);
    const count = Math.max(4, Math.round(6 * detail));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count;
      art.lineBetween(0, 0, Math.cos(angle) * radius * 0.78, Math.sin(angle) * radius * 0.78);
    }
  } else if (profile.language === 'lightning') {
    art.lineStyle(2.8, profile.primary, 0.9);
    const count = Math.max(3, Math.round(5 * detail));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count;
      const x = Math.cos(angle) * radius * 0.74;
      const y = Math.sin(angle) * radius * 0.74;
      art.lineBetween(0, 0, x * 0.45, y * 0.45);
      art.lineBetween(x * 0.45, y * 0.45, x, y);
    }
  } else if (profile.language === 'wind') {
    art.lineStyle(3, profile.primary, 0.78);
    art.beginPath(); art.arc(0, 0, radius * 0.72, Math.PI * 0.12, Math.PI * 1.34, false); art.strokePath();
    art.lineStyle(2, profile.secondary, 0.68);
    art.beginPath(); art.arc(0, 0, radius * 0.47, Math.PI * 1.12, Math.PI * 2.44, false); art.strokePath();
  } else if (profile.language === 'stone' || profile.language === 'steel') {
    art.lineStyle(3, profile.primary, 0.82);
    const sides = profile.language === 'steel' ? 6 : 5;
    for (let i = 0; i < sides; i += 1) {
      const a = -Math.PI * 0.5 + Math.PI * 2 * i / sides;
      const b = -Math.PI * 0.5 + Math.PI * 2 * (i + 1) / sides;
      art.lineBetween(Math.cos(a) * radius * 0.72, Math.sin(a) * radius * 0.72, Math.cos(b) * radius * 0.72, Math.sin(b) * radius * 0.72);
    }
  } else if (profile.language === 'venom') {
    art.fillStyle(profile.primary, 0.62);
    const count = Math.max(3, Math.round(5 * detail));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count;
      art.fillCircle(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62, i % 2 ? 5 : 8);
    }
  } else if (profile.language === 'radiant') {
    art.lineStyle(2.5, profile.secondary, 0.82);
    const count = Math.max(6, Math.round(10 * detail));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count;
      art.lineBetween(Math.cos(angle) * radius * 0.34, Math.sin(angle) * radius * 0.34, Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.82);
    }
  } else if (profile.language === 'void') {
    art.lineStyle(3, profile.primary, 0.72);
    const count = Math.max(4, Math.round(7 * detail));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count + 0.12;
      art.beginPath(); art.arc(0, 0, radius * (i % 2 ? 0.72 : 0.58), angle, angle + 0.34, false); art.strokePath();
    }
  } else {
    art.fillStyle(profile.primary, 0.62);
    const count = Math.max(4, Math.round(7 * detail));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count;
      art.fillEllipse(Math.cos(angle) * radius * 0.64, Math.sin(angle) * radius * 0.64, 16, 8);
    }
  }

  layer.add(art);
  root.add(layer);
  return layer;
}

function tierRadius(tier: Combat2201ActionTier): number {
  return tier === 'ultimate' ? 112 : tier === 'skill' ? 78 : 54;
}

function tierDuration(tier: Combat2201ActionTier, quality: FxQuality): number {
  const base = tier === 'ultimate' ? 850 : tier === 'skill' ? 560 : 300;
  return quality === 'lite' ? Math.round(base * 0.58) : quality === 'balanced' ? Math.round(base * 0.8) : base;
}

function ultimateCircleRarity(value: unknown): UltimateCircleRarity {
  const rarity = normalize(value);
  if (rarity.includes('ancient') || rarity.includes('co dai')) return 'ancient';
  if (rarity.includes('mythic') || rarity.includes('than thoai')) return 'mythic';
  if (rarity.includes('legendary') || rarity.includes('huyen thoai')) return 'legendary';
  if (rarity.includes('epic') || rarity.includes('su thi')) return 'epic';
  if (rarity.includes('super') || rarity.includes('sieu hiem')) return 'super_rare';
  if (rarity.includes('rare') || rarity.includes('hiem')) return 'rare';
  return 'common';
}

/**
 * Lightweight persistent state indicator. It is intentionally separate from the
 * Ultimate cinematic: the owner creates it once when the resolver says READY and
 * destroys it when that state becomes false.
 */
export function createCombat2201UltimateReadyCircle(options: Combat2201UltimateReadyCircleOptions): Phaser.GameObjects.Container {
  const { scene } = options;
  const point = new Phaser.Math.Vector2(options.x, options.y);
  const quality = qualityFor(Boolean(options.reducedMotion));
  const rarity = ultimateCircleRarity(options.rarity);
  const base = ULTIMATE_CIRCLE_RARITY[rarity];
  const profile = profileFor(options.element);
  const baseDiameter = Phaser.Math.Clamp(Number(options.visualDiameter) || 184, 112, 380);
  // The delivered art already communicates rarity. Keep one consistent halo
  // footprint so high-rarity PNGs do not grow into neighboring combat cards.
  const displayDiameter = baseDiameter;
  const radius = displayDiameter / 2;
  const rarityIntensity: Record<UltimateCircleRarity, number> = {
    common: 0.68,
    rare: 0.72,
    super_rare: 0.76,
    epic: 0.8,
    legendary: 0.84,
    mythic: 0.88,
    ancient: 0.94
  };
  const intensity = rarityIntensity[rarity];
  const root = scene.add.container(point.x, point.y).setScale(1).setAlpha(intensity);
  const outer = scene.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);
  const inner = scene.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);
  root.add([outer, inner]);

  // Raise the authored ring opacity by ~11% without widening its footprint.
  const mappedBase = createUltimateBackCircleSprite(scene, rarity, profile, displayDiameter, quality === 'lite' ? 0.58 : 0.78);
  if (mappedBase) {
    outer.add(mappedBase);
    // Two persistent, texture-reused accents make a static rarity PNG breathe
    // without particles, emitters, or a per-frame allocation.
    const shimmer = createUltimateBackCircleSprite(scene, rarity, profile, displayDiameter * 0.88, quality === 'lite' ? 0.06 : intensity * 0.18);
    if (shimmer) {
      shimmer.setBlendMode(Phaser.BlendModes.ADD);
      inner.add(shimmer);
    }
    inner.add(scene.add.circle(0, 0, radius * 0.96, 0xffffff, 0)
      .setStrokeStyle(1.25, 0xffffff, quality === 'lite' ? 0.06 : intensity * 0.14)
      .setBlendMode(Phaser.BlendModes.ADD));
  } else {
    const ringCount = quality === 'lite' ? Math.min(2, base.rings) : base.rings;
    for (let ring = 0; ring < ringCount; ring += 1) {
      const ringRadius = radius * (1 - ring * 0.19);
      addArcBand(scene, ring % 2 ? inner : outer, ringRadius, Math.max(4, base.arcs - ring), ring % 2 ? profile.secondary : profile.primary, Math.max(1.8, 4 - ring * 0.55), 0.9 - ring * 0.1, 0.12 + ring * 0.22, ring % 2 === 1);
    }
    addRuneNodes(scene, outer, radius * 0.9, quality === 'lite' ? Math.max(5, Math.ceil(base.runes * 0.55)) : base.runes, profile, 0.16, quality);
    addElementCircleLanguage(scene, inner, profile, radius * 0.66, quality === 'full' ? 'balanced' : quality);
    inner.add(scene.add.circle(0, 0, radius * 0.42, profile.primary, base.halo * 0.7).setBlendMode(Phaser.BlendModes.ADD));
    if (rarity === 'legendary' || rarity === 'mythic' || rarity === 'ancient') {
      inner.add(scene.add.star(0, 0, rarity === 'ancient' ? 8 : 6, radius * 0.14, radius * 0.44, profile.secondary, 0.22).setBlendMode(Phaser.BlendModes.ADD));
    }
  }
  if (!options.reducedMotion) {
    scene.tweens.add({ targets: root, scaleX: 1.03, scaleY: 1.03, alpha: Math.min(1, intensity + 0.1), duration: 1350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: outer, rotation: 0.16, duration: 5600, repeat: -1, ease: 'Linear' });
    scene.tweens.add({ targets: inner, rotation: -0.12, duration: 4300, repeat: -1, ease: 'Linear' });
  }
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.tweens.killTweensOf(root);
    scene.tweens.killTweensOf(outer);
    scene.tweens.killTweensOf(inner);
  });
  return root;
}

/** A finite layered circle: form, charge, release, then dissolve. */
export async function playCombat2201MagicCircle(options: Combat2201MagicCircleOptions): Promise<void> {
  const { scene, point, tier } = options;
  if (!active(scene) || !Number.isFinite(point.x + point.y)) return;
  const quality = qualityFor(Boolean(options.reducedMotion));
  const profile = profileFor(options.element);
  const mapping = resolveCombatVfxAction({ role: options.role, element: options.element, tier, traits: options.traits });
  const layerBudget = combatVfxLayerBudget(registryQuality(quality));
  const radius = tierRadius(tier);
  const duration = tierDuration(tier, quality);
  const holdMs = Math.max(0, Math.min(1800, Math.round(Number(options.holdMs) || 0)));
  const root = trackVfxRoot(options.scope, scene.add.container(point.x, point.y)
    .setDepth(options.depth ?? powVfxDepth('foreground') + 5)
    .setScale(0.24)
    .setAlpha(0));
  if (options.scope?.isCleanedUp()) return;
  const outer = scene.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);
  const inner = scene.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);
  root.add([outer, inner]);

  // A loaded sheet owns the base circle. The procedural construction is fallback-only
  // so Combat2 never renders both bases for one cast.
  const mappedCircle = createMappedSprite(scene, mapping.magicCircle, 'magic-circle', radius * 2.1, quality === 'lite' ? 0.58 : 0.8);
  let runeBand: Phaser.GameObjects.Container | null = null;
  let languageLayer: Phaser.GameObjects.Container | null = null;
  if (mappedCircle) {
    inner.add(mappedCircle);
    // Keep a single lightweight elemental accent on shared authored art.
    languageLayer = addElementCircleLanguage(scene, inner, profile, radius * 0.68, quality);
  } else {
    if (layerBudget >= 1) addArcBand(scene, outer, radius, tier === 'ultimate' ? 9 : 7, profile.primary, tier === 'ultimate' ? 3.6 : 2.4, 0.88, 0.1);
    if (layerBudget >= 2) addArcBand(scene, inner, radius * 0.57, tier === 'ultimate' ? 7 : 5, profile.secondary, 1.7, 0.72, 0.38, true);
    runeBand = layerBudget >= 2
      ? addRuneNodes(scene, outer, radius * 0.92, tier === 'ultimate' ? 14 : tier === 'skill' ? 10 : 7, profile, 0.18, quality)
      : null;
    languageLayer = layerBudget >= 3 ? addElementCircleLanguage(scene, inner, profile, radius, quality) : null;
    if (layerBudget >= 4) inner.add(scene.add.circle(0, 0, radius * 0.22, profile.primary, 0.09).setBlendMode(Phaser.BlendModes.ADD));
  }

  if (layerBudget >= 5 && scene.textures.exists(FAIRY_SIGIL_KEY)) {
    const sigil = scene.add.image(0, 0, FAIRY_SIGIL_KEY)
      .setDisplaySize(radius * 1.46, radius * 1.46)
      .setTint(profile.primary)
      .setAlpha(quality === 'lite' ? 0.18 : 0.28)
      .setBlendMode(Phaser.BlendModes.ADD);
    inner.add(sigil);
  }

  const lifecycle = new CombatVfxTimeline(scene, 'magic-circle', quality === 'lite' ? 'reduced' : 'normal');
  try {
    const form = Math.max(80, Math.round(duration * 0.42));
    await lifecycle.run('create', () => undefined);
    await lifecycle.runParallel([
      { phase: 'appear', run: () => safeTween(scene, root, { scaleX: 1, scaleY: 1, alpha: tier === 'ultimate' ? 0.94 : 0.88, duration: form, ease: 'Back.easeOut' }, form + 180) },
      { phase: 'build', run: () => safeTween(scene, outer, { rotation: tier === 'ultimate' ? 0.42 : 0.25, duration: form, ease: 'Sine.easeOut' }, form + 180) },
      { phase: 'charge', run: () => safeTween(scene, inner, { rotation: tier === 'ultimate' ? -0.54 : -0.3, duration: form, ease: 'Sine.easeOut' }, form + 180) }
    ]);
    if (holdMs > 0) {
      // Test Lab can hold the strongest rendered frame without changing live combat timing.
      mappedCircle?.anims.pause();
      await waitForVfxCadence(scene, holdMs);
    }
    await lifecycle.runParallel([
      { phase: 'release', run: () => safeTween(scene, root, { scaleX: tier === 'ultimate' ? 1.22 : 1.14, scaleY: tier === 'ultimate' ? 1.22 : 1.14, alpha: 0, duration: duration - form, ease: 'Cubic.easeOut' }, duration + 180) },
      {
        phase: 'fade',
        run: () => Promise.all([
          runeBand ? safeTween(scene, runeBand, { rotation: 0.32, duration: duration - form, ease: 'Quad.easeOut' }, duration + 180) : Promise.resolve(),
          languageLayer ? safeTween(scene, languageLayer, { rotation: -0.24, duration: duration - form, ease: 'Quad.easeOut' }, duration + 180) : Promise.resolve()
        ]).then(() => undefined)
      }
    ]);
    await lifecycle.run('destroy', () => undefined);
  } finally {
    lifecycle.destroy();
    disposeVfxRoot(options.scope, root);
  }
}

export async function playCombat2201SourceRelease(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  element: unknown,
  tier: Combat2201ActionTier,
  reducedMotion = false,
  context?: Pick<Combat2201ActionOptions, 'role' | 'signature' | 'scope'>
): Promise<void> {
  if (!active(scene) || !Number.isFinite(point.x + point.y)) return;
  const quality = qualityFor(reducedMotion);
  const profile = profileFor(element);
  const mapping = resolveCombatVfxAction({ role: context?.role || context?.signature?.role, element, tier, traits: context?.signature?.traits });
  const role = roleFor(context?.role || context?.signature?.role);
  const size = tier === 'ultimate' ? 58 : tier === 'skill' ? 42 : 30;
  const root = trackVfxRoot(context?.scope, scene.add.container(point.x, point.y).setDepth(powVfxDepth('foreground') + 12).setScale(0.42).setAlpha(0.96));
  if (context?.scope?.isCleanedUp()) return;
  if (tier !== 'ultimate' && mapping.magicCircle === 'circle_dark' && (role === 'mage' || role === 'enchanter')) {
    // Parallel presentation only: it cannot delay a turn, damage, or targeting resolution.
    void playCombat2201MagicCircle({
      scene,
      point,
      element,
      tier,
      role: context?.role || context?.signature?.role,
      traits: context?.signature?.traits,
      reducedMotion,
      scope: context?.scope
    }).catch(() => undefined);
  }
  const mappedCast = createMappedSprite(scene, mapping.cast, 'cast-release', size * 2.1, quality === 'lite' ? 0.62 : 0.9);
  if (mappedCast) {
    root.add(mappedCast);
  } else {
    root.add([
      scene.add.circle(0, 0, size * 0.42, profile.primary, 0.14).setBlendMode(Phaser.BlendModes.ADD),
      scene.add.star(0, 0, 4, size * 0.14, size * 0.46, profile.secondary, 0.88).setBlendMode(Phaser.BlendModes.ADD)
    ]);
    const rays = quality === 'lite' ? 3 : tier === 'ultimate' ? 8 : 5;
    for (let index = 0; index < rays; index += 1) {
      const angle = Math.PI * 2 * index / rays + 0.16;
      root.add(scene.add.rectangle(Math.cos(angle) * size * 0.48, Math.sin(angle) * size * 0.48, size * 0.42, 3, profile.primary, 0.7)
        .setRotation(angle));
    }
  }
  try {
    await safeTween(scene, root, {
      scaleX: tier === 'ultimate' ? 1.34 : 1.18,
      scaleY: tier === 'ultimate' ? 1.34 : 1.18,
      rotation: tier === 'ultimate' ? 0.2 : -0.12,
      alpha: 0,
      duration: quality === 'lite' ? 145 : tier === 'ultimate' ? 440 : tier === 'skill' ? 340 : 260,
      ease: 'Cubic.easeOut'
    }, 680);
  } finally {
    disposeVfxRoot(context?.scope, root);
  }
}

function projectileDuration(options: Combat2201ActionOptions, tier: Combat2201ActionTier, quality: FxQuality): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  const base = tier === 'ultimate' ? 780 : tier === 'skill' ? 650 : 520;
  const requestedDuration = Number(options.presentation?.travelDurationMs);
  const speed = Phaser.Math.Clamp(Number(options.presentation?.speed) || 1, 0.55, 1.8);
  const natural = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? requestedDuration
    : Math.round((base + Math.min(75, distance * 0.05)) / speed);
  return quality === 'lite' ? Math.round(natural * 0.65) : quality === 'balanced' ? Math.round(natural * 0.84) : natural;
}

function createProjectile(
  scene: Phaser.Scene,
  options: Combat2201ActionOptions,
  role: Combat2201Role,
  profile: ElementProfile,
  tier: Combat2201ActionTier,
  quality: FxQuality
): Phaser.GameObjects.Container {
  const dx = options.target.x - options.source.x;
  const dy = options.target.y - options.source.y;
  const root = trackVfxRoot(options.scope, scene.add.container(options.source.x, options.source.y)
    .setDepth(powVfxDepth('foreground') + 12)
    .setRotation(Math.atan2(dy, dx)));
  const mapping = resolveCombatVfxAction({ role, element: options.element, tier, traits: options.signature?.traits });
  const scale = Phaser.Math.Clamp(Number(options.presentation?.scale) || mapping.scale, 0.45, 2.2);
  root.setScale(scale);
  const mappedProjectile = createMappedSprite(
    scene,
    mapping.projectile,
    `projectile:${role}`,
    tier === 'ultimate' ? 126 : tier === 'skill' ? 106 : 88,
    quality === 'lite' ? 0.78 : 1
  );
  if (mappedProjectile) {
    root.add(mappedProjectile);
    return root;
  }

  // The current vector path is retained until a matching optional sheet is ready.
  const tail = tier === 'ultimate' ? 86 : tier === 'skill' ? 67 : 50;
  root.add([
    scene.add.rectangle(-tail * 0.42, 0, tail, tier === 'ultimate' ? 15 : 10, profile.primary, 0.17).setBlendMode(Phaser.BlendModes.ADD),
    scene.add.rectangle(-tail * 0.34, 0, tail * 0.78, 3, profile.secondary, 0.72).setBlendMode(Phaser.BlendModes.ADD)
  ]);

  if (role === 'marksman') {
    root.add([
      scene.add.rectangle(6, 0, 48, 5, profile.primary, 0.98),
      scene.add.triangle(34, 0, -12, -10, -12, 10, 15, 0, profile.secondary, 0.96),
      scene.add.triangle(-14, -4, -12, -8, 10, 0, -12, 8, profile.primary, 0.76),
      scene.add.triangle(-14, 4, -12, -8, 10, 0, -12, 8, profile.primary, 0.76).setScale(1, -1)
    ]);
  } else if (role === 'mage' || role === 'enchanter') {
    root.add([
      scene.add.circle(8, 0, 19, profile.primary, 0.22).setBlendMode(Phaser.BlendModes.ADD),
      scene.add.circle(8, 0, 11, profile.primary, 0.96),
      scene.add.circle(11, -3, 4, profile.secondary, 0.96),
      scene.add.rectangle(8, 0, 27, 27, 0x000000, 0).setStrokeStyle(2, profile.secondary, 0.75).setRotation(Math.PI * 0.25)
    ]);
  } else if (role === 'healer') {
    root.add([
      scene.add.ellipse(10, 0, 26, 38, profile.primary, 0.92).setRotation(-0.24),
      scene.add.ellipse(13, -5, 9, 16, profile.secondary, 0.9).setRotation(-0.24),
      scene.add.arc(-4, 0, 21, 215, 335, false, 0x000000, 0).setStrokeStyle(2, profile.secondary, 0.74)
    ]);
  } else if (role === 'musician') {
    root.add([
      scene.add.ellipse(2, 10, 20, 14, profile.primary, 0.96).setRotation(-0.3),
      scene.add.rectangle(10, -7, 4, 32, profile.primary, 0.94),
      scene.add.triangle(22, -21, -10, -7, 10, 0, -10, 7, profile.secondary, 0.88)
    ]);
  } else {
    root.add([
      scene.add.triangle(11, 0, -16, -13, -16, 13, 22, 0, profile.primary, 0.98),
      scene.add.triangle(13, 0, -9, -6, -9, 6, 13, 0, profile.secondary, 0.88),
      scene.add.circle(-3, 0, 19, profile.primary, 0.14).setBlendMode(Phaser.BlendModes.ADD)
    ]);
  }

  const motes = quality === 'full' ? 4 : quality === 'balanced' ? 2 : 0;
  for (let index = 0; index < motes; index += 1) {
    root.add(scene.add.star(-18 - index * 13, (index % 2 ? 1 : -1) * (5 + index * 2), 4, 1.4, 4, profile.secondary, 0.66));
  }
  return root;
}

async function playImpact(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  profile: ElementProfile,
  tier: Combat2201ActionTier,
  quality: FxQuality,
  critical: boolean,
  hitIndex = 0,
  hitCount = 1,
  assetId?: string,
  scope?: Combat2201VfxScope
): Promise<void> {
  if (!active(scene)) return;
  const size = (tier === 'ultimate' ? 70 : tier === 'skill' ? 52 : 38) * (critical ? 1.12 : 1);
  const root = trackVfxRoot(scope, scene.add.container(point.x, point.y).setDepth(powVfxDepth('foreground') + 16).setScale(0.38));
  if (scope?.isCleanedUp()) return;
  const mappedImpact = createMappedSprite(scene, assetId, 'impact', size * 2.25, quality === 'lite' ? 0.72 : 1);
  if (mappedImpact) {
    root.add(mappedImpact);
  } else {
    const arcs = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    addArcBand(scene, root, size, tier === 'ultimate' ? 8 : 6, profile.primary, tier === 'ultimate' ? 4.5 : 3.1, 0.9, hitIndex * 0.32);
    arcs.lineStyle(critical ? 4 : 2.5, profile.secondary, 0.86);
    const rays = quality === 'lite' ? 4 : tier === 'ultimate' ? 10 : 7;
    for (let index = 0; index < rays; index += 1) {
      const angle = Math.PI * 2 * index / rays + hitIndex * 0.22;
      const inner = size * 0.1;
      const outer = size * (0.62 + (index % 2) * 0.18);
      arcs.lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    root.add([
      scene.add.circle(0, 0, size * 0.34, profile.primary, tier === 'ultimate' ? 0.26 : 0.18).setBlendMode(Phaser.BlendModes.ADD),
      scene.add.star(0, 0, critical ? 6 : 4, size * 0.12, size * 0.48, profile.secondary, 0.94).setBlendMode(Phaser.BlendModes.ADD),
      arcs
    ]);
  }
  if (tier === 'ultimate' && !quality.includes('lite')) scene.cameras.main.shake(75, critical ? 0.0022 : 0.0015);
  try {
    await safeTween(scene, root, {
      scaleX: tier === 'ultimate' ? 1.45 : 1.24,
      scaleY: tier === 'ultimate' ? 1.45 : 1.24,
      alpha: 0,
      rotation: critical ? 0.18 : -0.1,
      duration: quality === 'lite' ? 155 : tier === 'ultimate' ? 390 : tier === 'skill' ? 320 : 260,
      ease: 'Cubic.easeOut'
    }, 680);
  } finally {
    disposeVfxRoot(scope, root);
  }
  void hitCount;
}

function createMeleeGlyph(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  profile: ElementProfile,
  role: Combat2201Role,
  tier: Combat2201ActionTier,
  hitIndex: number,
  assetId?: string,
  quality: FxQuality = 'full',
  scope?: Combat2201VfxScope
): Phaser.GameObjects.Container {
  const root = trackVfxRoot(scope, scene.add.container(point.x, point.y).setDepth(powVfxDepth('foreground') + 14).setScale(0.42));
  const size = tier === 'ultimate' ? 68 : tier === 'skill' ? 51 : 39;
  const mappedSlash = createMappedSprite(scene, assetId, `slash:${role}`, size * 2.3, quality === 'lite' ? 0.72 : 1);
  if (mappedSlash) {
    root.add(mappedSlash);
    root.setRotation(role === 'assassin' ? (hitIndex ? 0.66 : -0.66) : -0.2);
    return root;
  }
  if (role === 'tank') {
    root.add([
      scene.add.rectangle(0, 0, size, size, profile.shadow, 0.74).setRotation(Math.PI * 0.25),
      scene.add.rectangle(0, 0, size * 0.7, size * 0.7, profile.primary, 0.88).setRotation(Math.PI * 0.25),
      scene.add.rectangle(size * 0.3, 0, size * 1.2, 6, profile.secondary, 0.86)
    ]);
  } else if (role === 'fighter') {
    root.add([
      scene.add.circle(0, 0, size * 0.58, profile.primary, 0.18).setBlendMode(Phaser.BlendModes.ADD),
      scene.add.rectangle(0, size * 0.12, size * 0.86, size * 0.52, profile.primary, 0.96),
      scene.add.circle(-size * 0.28, -size * 0.18, size * 0.17, profile.secondary, 0.92),
      scene.add.circle(-size * 0.08, -size * 0.22, size * 0.18, profile.secondary, 0.92),
      scene.add.circle(size * 0.14, -size * 0.19, size * 0.16, profile.secondary, 0.92)
    ]);
  } else {
    const slash = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    slash.lineStyle(tier === 'ultimate' ? 9 : 6, profile.primary, 0.94);
    slash.beginPath(); slash.arc(0, 0, size * 0.68, Math.PI * 1.1, Math.PI * 1.86, false); slash.strokePath();
    slash.lineStyle(2.5, profile.secondary, 0.92);
    slash.beginPath(); slash.arc(0, 0, size * 0.54, Math.PI * 1.1, Math.PI * 1.86, false); slash.strokePath();
    root.add([slash, scene.add.star(size * 0.25, -size * 0.18, 4, 3, 11, profile.secondary, 0.9)]);
    root.setRotation((role === 'assassin' ? (hitIndex ? 0.66 : -0.66) : -0.2));
  }
  return root;
}

async function playMeleeAction(
  options: Combat2201ActionOptions,
  tier: Combat2201ActionTier,
  role: Combat2201Role,
  profile: ElementProfile,
  quality: FxQuality
): Promise<void> {
  if (!options.presentation?.suppressSourceRelease) {
    await playCombat2201SourceRelease(options.scene, options.source, options.element, tier, quality === 'lite', options);
  }
  const mapping = resolveCombatVfxAction({ role, element: options.element, tier, traits: options.signature?.traits });
  const sequence = resolveCombatVfxHitSequence({
    role,
    element: options.element as CombatProjectileElement,
    tier,
    traits: options.signature?.traits,
    visualHitCount: options.signature?.visualHitCount,
    multiHitCadenceMs: options.presentation?.multiHitCadenceMs
  });
  const { hitCount, cadenceMs: cadence } = sequence;
  const effects: Promise<void>[] = [];
  for (let hit = 0; hit < hitCount; hit += 1) {
    const offset = role === 'assassin' ? (hit ? 13 : -13) : 0;
    const point = new Phaser.Math.Vector2(options.target.x + offset, options.target.y - offset * 0.26);
    const glyph = createMeleeGlyph(options.scene, point, profile, role, tier, hit, mapping.slash, quality, options.scope);
    try {
      options.presentation?.onImpact?.({ hitIndex: hit, hitCount, point });
    } catch { /* Optional presentation observers cannot affect combat. */ }
    effects.push((async () => {
      try {
        await Promise.all([
          safeTween(options.scene, glyph, {
            scaleX: tier === 'ultimate' ? 1.4 : 1.18,
            scaleY: tier === 'ultimate' ? 1.4 : 1.18,
            alpha: 0,
            duration: quality === 'lite' ? 135 : tier === 'ultimate' ? 370 : tier === 'skill' ? 290 : 230,
            ease: 'Cubic.easeOut'
          }, 420),
          playImpact(options.scene, point, profile, tier, quality, role === 'assassin', hit, hitCount, mapping.impact, options.scope)
        ]);
      } finally {
        disposeVfxRoot(options.scope, glyph);
      }
    })());
    if (hit < hitCount - 1) await waitForVfxCadence(options.scene, cadence);
  }
  await Promise.all(effects);
}

async function playRangedAction(
  options: Combat2201ActionOptions,
  tier: Combat2201ActionTier,
  role: Combat2201Role,
  profile: ElementProfile,
  quality: FxQuality
): Promise<void> {
  const projectile = createProjectile(options.scene, options, role, profile, tier, quality);
  const duration = projectileDuration(options, tier, quality);
  try {
    await safeTween(options.scene, projectile, {
      x: options.target.x,
      y: options.target.y,
      duration,
      ease: profile.language === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut'
    }, duration + 280);
  } finally {
    disposeVfxRoot(options.scope, projectile);
  }
  runPresentationCallback(options.presentation?.onProjectileArrival, 'projectile-arrival');
  const mapping = resolveCombatVfxAction({ role, element: options.element, tier, traits: options.signature?.traits });
  const sequence = resolveCombatVfxHitSequence({
    role,
    element: options.element as CombatProjectileElement,
    tier,
    traits: options.signature?.traits,
    visualHitCount: options.signature?.visualHitCount,
    multiHitCadenceMs: options.presentation?.multiHitCadenceMs
  });
  const { hitCount: hits, cadenceMs: cadence } = sequence;
  const effects: Promise<void>[] = [];
  for (let hit = 0; hit < hits; hit += 1) {
    const point = new Phaser.Math.Vector2(options.target.x + (hit ? 10 : 0), options.target.y - (hit ? 7 : 0));
    try {
      options.presentation?.onImpact?.({ hitIndex: hit, hitCount: hits, point });
    } catch { /* Optional presentation observers cannot affect combat. */ }
    effects.push(playImpact(options.scene, point, profile, tier, quality, false, hit, hits, mapping.impact, options.scope));
    if (hit < hits - 1) await waitForVfxCadence(options.scene, cadence);
  }
  await Promise.all(effects);
}

/** Shared action route for every combat role. It owns visual objects only. */
export async function playCombat2201ActionVfx(options: Combat2201ActionOptions, tier: Combat2201ActionTier): Promise<void> {
  if (!active(options.scene) || !Number.isFinite(options.source.x + options.source.y + options.target.x + options.target.y)) return;
  activeActions += 1;
  try {
    const quality = qualityFor(Boolean(options.reducedMotion));
    const profile = profileFor(options.element);
    const role = roleFor(options.role || options.signature?.role);
    if (role === 'tank' || role === 'fighter' || role === 'knight' || role === 'assassin') {
      await playMeleeAction(options, tier, role, profile, quality);
      return;
    }
    const rangedAction = playRangedAction(options, tier, role, profile, quality);
    if (options.presentation?.suppressSourceRelease) await rangedAction;
    else await Promise.all([
      playCombat2201SourceRelease(options.scene, options.source, options.element, tier, quality === 'lite', options),
      rangedAction
    ]);
  } finally {
    activeActions = Math.max(0, activeActions - 1);
  }
}

/** Admin-only preview entrypoints reuse the live VFX owner without combat state. */
export async function playCombat2201ProjectilePreview(options: Combat2201VfxPreviewOptions): Promise<void> {
  if (!active(options.scene) || options.scope?.isCleanedUp()) return;
  const tier = options.tier ?? 'skill';
  const role = roleFor(options.role);
  const quality = qualityFor(Boolean(options.reducedMotion));
  const action: Combat2201ActionOptions = {
    scene: options.scene,
    source: options.source,
    target: options.target,
    element: options.element as CombatProjectileElement,
    role: options.role,
    reducedMotion: options.reducedMotion,
    scope: options.scope
  };
  const projectile = createProjectile(options.scene, action, role, profileFor(options.element), tier, quality);
  const duration = projectileDuration(action, tier, quality);
  try {
    await safeTween(options.scene, projectile, {
      x: options.target.x,
      y: options.target.y,
      duration,
      ease: 'Sine.easeInOut'
    }, duration + 280);
  } finally {
    disposeVfxRoot(options.scope, projectile);
  }
}

export async function playCombat2201SlashPreview(options: Combat2201VfxPreviewOptions): Promise<void> {
  if (!active(options.scene) || options.scope?.isCleanedUp()) return;
  const tier = options.tier ?? 'skill';
  const role = roleFor(options.role);
  const quality = qualityFor(Boolean(options.reducedMotion));
  const mapping = resolveCombatVfxAction({ role, element: options.element, tier });
  const glyph = createMeleeGlyph(options.scene, options.target, profileFor(options.element), role, tier, 0, mapping.slash, quality, options.scope);
  const mappedSlash = glyph.list.find((child): child is Phaser.GameObjects.Sprite => child instanceof Phaser.GameObjects.Sprite);
  glyph
    .setDepth(powVfxDepth('foreground') + 30)
    .setScale(1.12)
    .setAlpha(1)
    .setVisible(true)
    .setRotation(Math.atan2(options.target.y - options.source.y, options.target.x - options.source.x) + Math.PI * 0.5);
  try {
    await waitForVfxCadence(options.scene, 210);
    if (options.scope?.isCleanedUp()) return;
    // Hold the peak slash frame long enough for visual QA, then use the normal cleanup path.
    mappedSlash?.anims.pause();
    await waitForVfxCadence(options.scene, 540);
    if (options.scope?.isCleanedUp()) return;
    await safeTween(options.scene, glyph, {
      scaleX: tier === 'ultimate' ? 1.58 : 1.4,
      scaleY: tier === 'ultimate' ? 1.58 : 1.4,
      alpha: 0,
      duration: quality === 'lite' ? 170 : tier === 'ultimate' ? 420 : 360,
      ease: 'Cubic.easeOut'
    }, 620);
  } finally {
    disposeVfxRoot(options.scope, glyph);
  }
}

export async function playCombat2201ImpactPreview(options: Combat2201VfxPreviewOptions): Promise<void> {
  await playCombat2201ImpactVfx(
    options.scene,
    options.target,
    options.element,
    options.tier ?? 'skill',
    options.role,
    undefined,
    Boolean(options.reducedMotion),
    options.scope
  );
}

export async function playCombat2201UltimatePreview(options: Combat2201VfxPreviewOptions): Promise<readonly string[]> {
  if (!active(options.scene) || options.scope?.isCleanedUp()) return [];
  const timeline = new CombatVfxTimeline(options.scene, 'admin-vfx-ultimate', options.reducedMotion ? 'reduced' : 'normal');
  const action: Combat2201ActionOptions = {
    scene: options.scene,
    source: options.source,
    target: options.target,
    element: options.element as CombatProjectileElement,
    role: options.role,
    reducedMotion: options.reducedMotion,
    scope: options.scope,
    signature: { tier: 'ultimate', role: options.role },
    presentation: { suppressSourceRelease: true }
  };
  try {
    await timeline.run('intro', () => playCombat2201UltimatePhaseVfx(options.scene, options.source, 'intro', 'standard', Boolean(options.reducedMotion), options.scope));
    await timeline.run('activate', () => playCombat2201SourceRelease(options.scene, options.source, options.element, 'ultimate', Boolean(options.reducedMotion), action));
    await timeline.run('magic-circle', () => playCombat2201MagicCircle({
      scene: options.scene,
      point: options.source,
      element: options.element,
      tier: 'ultimate',
      role: options.role,
      reducedMotion: options.reducedMotion,
      scope: options.scope
    }));
    await timeline.run('charge', () => playCombat2201UltimatePhaseVfx(options.scene, options.source, 'charge', 'standard', Boolean(options.reducedMotion), options.scope));
    await timeline.run('release', () => playCombat2201UltimatePhaseVfx(options.scene, options.source, 'release', 'standard', Boolean(options.reducedMotion), options.scope));
    await timeline.run('travel-or-slash', () => playCombat2201ActionVfx(action, 'ultimate'));
    await timeline.run('impact', async () => {
      await playCombat2201UltimatePhaseVfx(options.scene, options.target, 'impact', 'standard', Boolean(options.reducedMotion), options.scope);
      await playCombat2201UltimateAftershock(options.scene, options.target, options.element, false, Boolean(options.reducedMotion), options.scope);
    });
    await timeline.run('finish', () => playCombat2201UltimatePhaseVfx(options.scene, options.target, 'finish', 'standard', Boolean(options.reducedMotion), options.scope));
    await timeline.finish();
    return ['intro', 'cast', 'magic-circle', 'charge', 'release', 'attack', 'impact', 'finish', 'cleanup'];
  } finally {
    timeline.destroy();
  }
}

/** Compatibility entry for impact callers that used the retired signature accent. */
export async function playCombat2201ImpactVfx(
  scene: Phaser.Scene,
  target: Phaser.Math.Vector2,
  element: unknown,
  tier: Combat2201ActionTier,
  role?: string,
  traits?: readonly string[],
  reducedMotion = false,
  scope?: Combat2201VfxScope
): Promise<void> {
  const quality = qualityFor(reducedMotion);
  const profile = profileFor(element);
  const resolvedRole = roleFor(role);
  const mapping = resolveCombatVfxAction({ role: resolvedRole, element, tier, traits });
  const hitCount = resolvedRole === 'assassin' || traits?.includes('multi-hit') ? 2 : 1;
  for (let hit = 0; hit < hitCount; hit += 1) {
    await playImpact(scene, new Phaser.Math.Vector2(target.x + (hit ? 9 : 0), target.y - (hit ? 6 : 0)), profile, tier, quality, resolvedRole === 'assassin', hit, hitCount, mapping.impact, scope);
  }
}

export type Combat2201UltimatePresentationTier = 'standard' | 'high' | 'ancient';
export type Combat2201UltimatePhase = 'intro' | 'charge' | 'release' | 'impact' | 'finish';

/** Optional sheet-backed Ultimate phase. It safely no-ops until that art pack is enabled. */
export async function playCombat2201UltimatePhaseVfx(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  phase: Combat2201UltimatePhase,
  presentationTier: Combat2201UltimatePresentationTier = 'standard',
  reducedMotion = false,
  scope?: Combat2201VfxScope
): Promise<void> {
  if (!active(scene)) return;
  const assetId = resolveCombatVfxUltimate(presentationTier)[phase];
  const root = trackVfxRoot(scope, scene.add.container(point.x, point.y).setDepth(powVfxDepth('foreground') + 10).setScale(reducedMotion ? 0.62 : 0.78));
  if (scope?.isCleanedUp()) return;
  const sprite = createMappedSprite(scene, assetId, `ultimate:${phase}`, presentationTier === 'ancient' ? 470 : presentationTier === 'high' ? 390 : 320, reducedMotion ? 0.72 : 1);
  if (!sprite) {
    disposeVfxRoot(scope, root);
    return;
  }
  root.add(sprite);
  try {
    await safeTween(scene, root, {
      scaleX: reducedMotion ? 0.9 : 1.2,
      scaleY: reducedMotion ? 0.9 : 1.2,
      alpha: 0,
      duration: reducedMotion ? 160 : 300,
      ease: 'Cubic.easeOut'
    }, 520);
  } finally {
    disposeVfxRoot(scope, root);
  }
}

export async function playCombat2201UltimateAftershock(
  scene: Phaser.Scene,
  point: Phaser.Math.Vector2,
  element: unknown,
  selfTargeted: boolean,
  reducedMotion = false,
  scope?: Combat2201VfxScope
): Promise<void> {
  if (!active(scene)) return;
  const quality = qualityFor(reducedMotion);
  const profile = profileFor(element);
  const root = trackVfxRoot(scope, scene.add.container(point.x, point.y).setDepth(powVfxDepth('foreground') + 8).setScale(0.58));
  if (scope?.isCleanedUp()) return;
  const mappedImpact = createMappedSprite(scene, resolveCombatVfxUltimate('standard').impact, 'ultimate-aftershock', 190, quality === 'lite' ? 0.68 : 1);
  if (mappedImpact) {
    root.add(mappedImpact);
  } else {
    addArcBand(scene, root, 86, 9, selfTargeted ? 0x73f0aa : profile.primary, 4, 0.88, 0.22);
    root.add([
      scene.add.star(0, 0, 6, 10, 42, selfTargeted ? 0xbfffd7 : profile.secondary, 0.76).setBlendMode(Phaser.BlendModes.ADD),
      scene.add.circle(0, 0, 28, selfTargeted ? 0x73f0aa : profile.primary, 0.14).setBlendMode(Phaser.BlendModes.ADD)
    ]);
  }
  if (quality !== 'lite' && !selfTargeted) scene.cameras.main.shake(90, 0.0018);
  try {
    await safeTween(scene, root, {
      scaleX: 1.55,
      scaleY: 1.55,
      rotation: -0.2,
      alpha: 0,
      duration: quality === 'lite' ? 180 : 340,
      ease: 'Cubic.easeOut'
    }, 500);
  } finally {
    disposeVfxRoot(scope, root);
  }
}

export function installCombat2201HighFantasyAnimeVfx(PowViewClass: any): void {
  const root = globalThis as any;
  if (root.__powderCombat2201HighFantasyAnimeVfxInstalled) return;
  root.__powderCombat2201HighFantasyAnimeVfxInstalled = true;

  const proto = PowViewClass?.prototype as any;
  const originalStatusPulse = proto?.playStatusPulse;
  if (typeof originalStatusPulse === 'function') {
    proto.playStatusPulse = async function combat2201SupportPulse(this: any): Promise<void> {
      const controlStatus = String(this.runtimeVisualStatus || '');
      if (['ĐÓNG BĂNG', 'CHOÁNG', 'TÊ LIỆT', 'CÂM LẶNG'].includes(controlStatus)) {
        await originalStatusPulse.call(this);
        return;
      }
      const point = this.getWorldPosition?.();
      if (!point) return;
      const tier = this.__combat2104ActionSignature?.tier === 'ultimate'
        ? 'ultimate'
        : this.__combat2104ActionSignature?.tier === 'skill'
          ? 'skill'
          : 'normal';
      await playCombat2201MagicCircle({
        scene: this.scene,
        point,
        element: this.pow?.elementKey || this.pow?.element,
        tier,
        role: this.pow?.role,
        traits: this.__combat2104ActionSignature?.traits,
        reducedMotion: Boolean(this.reducedMotion),
        depth: powVfxDepth('foreground') + 5
      });
    };
  }

  root.POWDER_COMBAT2_HIGH_FANTASY_VFX = {
    version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    groups: ['projectile', 'slash', 'impact', 'magic-circle', 'ultimate', 'support'],
    elementIdentity: ['ember', 'ripple', 'crystal', 'lightning', 'wind', 'stone', 'venom', 'radiant', 'void', 'leaf', 'steel'],
    finiteMagicCircle: true,
    magicCircleLifecycle: ['create', 'appear', 'build', 'charge', 'release', 'fade', 'destroy'],
    qualityLayers: { low: 2, medium: 3, high: 5 },
    sourceToTarget: true,
    meleeLocalHopPreserved: true,
    particleEmitters: false,
    tweenLoops: false,
    maxActiveActions: MAX_ACTIVE_ACTIONS,
    adaptiveQuality: true,
    registry: combatVfxAssetState(),
    assetPreload: 'enabled-common-only-with-lazy-ultimate',
    missingAssetFallback: 'procedural-owner-with-dev-warning-only-for-enabled-assets',
    multiHitCadence: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_NIGHT_ROLE_ATTACKS = {
    version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    routes: {
      marksman: 'anime-arrow-trail-source-to-target',
      mage: 'anime-elemental-nucleus-source-to-target',
      enchanter: 'anime-hex-nucleus-source-to-target',
      healer: 'anime-restoration-ribbon-source-to-target',
      musician: 'anime-chord-note-source-to-target',
      tank: 'anime-shield-bash-contact-no-projectile',
      fighter: 'anime-fist-impact-contact-no-projectile',
      knight: 'anime-heavy-slash-contact-no-projectile',
      assassin: 'anime-dual-critical-slash-contact-no-projectile'
    },
    rangedRoles: ['marksman', 'mage', 'enchanter', 'healer', 'musician'],
    noProjectileRoles: ['tank', 'fighter', 'knight', 'assassin'],
    healerScaleVsMage: 1,
    assassinSlashScaleVsKnight: 1,
    elementColorPreserved: true,
    oneAttackObjectFamilyPerAction: true,
    particleEmitters: false,
    tweenLoops: false,
    multiHitCadence: true,
    combatLogicChanged: false
  };

  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    root.POWDER_COMBAT2_VFX_DEBUG = {
      version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
      registry: combatVfxAssetState,
      regression: runCombatVfxRegistryRegression,
      resolveAction: resolveCombatVfxAction,
      playAction: playCombat2201ActionVfx,
      playMagicCircle: playCombat2201MagicCircle,
      playUltimatePhase: playCombat2201UltimatePhaseVfx
    };
  }
}
