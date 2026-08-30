import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2151RangedRoleVfxInstalled';
const BALANCED_BURST_THRESHOLD = 2;
const PROJECTILE_DURATION_SCALE = 2.25;
const HEALER_SCALE_VS_MAGE = 0.8;

const ELEMENT_COLOR: Readonly<Record<CombatProjectileElement, number>> = Object.freeze({
  fire: 0xff7043,
  lava: 0xff4f2e,
  water: 0x4db9ff,
  ice: 0x8adfff,
  lightning: 0xf5dd62,
  storm: 0x78a9ff,
  wind: 0x76e4d2,
  leaf: 0x72d67f,
  poison: 0xa5df66,
  earth: 0xb78c5d,
  steel: 0xc3d3dc,
  light: 0xffefad,
  dark: 0xa88cf2,
  neutral: 0x9ed8e8
});

type FxTier = 'full' | 'balanced' | 'lite';
type RangedRole = 'marksman' | 'mage' | 'enchanter' | 'healer' | 'musician';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

let activeRangedShots = 0;

function normalize(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveRangedRole(rawRole: string | undefined): RangedRole | null {
  const role = normalize(rawRole);
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('enchanter')) return 'enchanter';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  return null;
}

function fxTier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function readableDuration(
  options: DirectionalProjectileOptions,
  current: FxTier,
  burstReducedMotion: boolean
): number {
  const requested = Number(options.durationMs || 0);
  const distance = Math.max(1, Phaser.Math.Distance.Between(
    options.source.x,
    options.source.y,
    options.target.x,
    options.target.y
  ));

  let baseDuration: number;
  if (current === 'lite') {
    baseDuration = Phaser.Math.Clamp(requested > 0 ? requested : 195, 175, 215);
  } else if (current === 'balanced') {
    const natural = burstReducedMotion ? 215 : Math.round(225 + Math.min(35, distance * 0.035));
    baseDuration = Phaser.Math.Clamp(
      requested > 0 ? requested : natural,
      burstReducedMotion ? 195 : 215,
      burstReducedMotion ? 235 : 275
    );
  } else {
    const natural = Math.round(240 + Math.min(55, distance * 0.05));
    baseDuration = Phaser.Math.Clamp(requested > 0 ? requested : natural, 230, 310);
  }

  return Math.round(baseDuration * PROJECTILE_DURATION_SCALE);
}

function baseRadius(reducedDetail: boolean): number {
  // Matches the user-approved Combat2 projectile size from 2.15.0 / former Night45.
  return reducedDetail ? 36 : 48;
}

function tweenObject(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      if (settled) return;
      try { tween?.stop(); } catch { /* scene teardown owns tween cleanup */ }
      finish();
    };

    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      tween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

async function fly(
  options: DirectionalProjectileOptions,
  object: Phaser.GameObjects.Container,
  durationMs: number
): Promise<void> {
  try {
    await tweenObject(options.scene, object, {
      x: options.target.x,
      y: options.target.y,
      duration: durationMs,
      ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut'
    }, durationMs + 320);
  } finally {
    object.destroy(true);
  }
}

async function impactMarksman(options: DirectionalProjectileOptions, reducedDetail: boolean): Promise<void> {
  const { scene, target, element } = options;
  const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.neutral;
  const size = reducedDetail ? 22 : 29;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 1);
  impact.add([
    scene.add.rectangle(0, 0, size * 2.2, Math.max(3, size * 0.13), color, 0.9).setRotation(-0.18),
    scene.add.rectangle(0, 0, size * 1.25, Math.max(2, size * 0.07), 0xffffff, 0.88).setRotation(-0.18),
    scene.add.circle(0, 0, size * 0.28, color, 0.52)
  ]);
  try {
    await tweenObject(scene, impact, {
      scaleX: 1.34,
      scaleY: 1.34,
      alpha: 0,
      duration: reducedDetail ? 120 : 155,
      ease: 'Quad.easeOut'
    }, reducedDetail ? 300 : 350);
  } finally {
    impact.destroy(true);
  }
}

async function impactOrb(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean,
  scale: number,
  soft: boolean
): Promise<void> {
  const { scene, target, element } = options;
  const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.neutral;
  const radius = (reducedDetail ? 18 : 24) * scale;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 1);
  impact.add([
    scene.add.circle(0, 0, radius * 0.58, color, soft ? 0.2 : 0.34),
    scene.add.circle(0, 0, radius, 0x000000, 0)
      .setStrokeStyle(reducedDetail ? 2 : 3, color, soft ? 0.58 : 0.88),
    scene.add.circle(0, 0, radius * 0.46, 0x000000, 0)
      .setStrokeStyle(reducedDetail ? 1 : 2, 0xffffff, soft ? 0.48 : 0.72)
  ]);
  try {
    await tweenObject(scene, impact, {
      scaleX: soft ? 1.38 : 1.52,
      scaleY: soft ? 1.38 : 1.52,
      alpha: 0,
      duration: reducedDetail ? 135 : 175,
      ease: 'Quad.easeOut'
    }, reducedDetail ? 320 : 390);
  } finally {
    impact.destroy(true);
  }
}

async function impactMusic(options: DirectionalProjectileOptions, reducedDetail: boolean): Promise<void> {
  const { scene, target, element } = options;
  const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.neutral;
  const size = reducedDetail ? 19 : 25;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 1);
  impact.add([
    scene.add.ellipse(0, 0, size * 2.1, size * 0.7, 0x000000, 0).setStrokeStyle(2, color, 0.82),
    scene.add.ellipse(0, 0, size * 1.2, size * 0.42, 0x000000, 0).setStrokeStyle(1, 0xffffff, 0.62),
    scene.add.circle(size * 0.13, -size * 0.08, size * 0.16, color, 0.7)
  ]);
  try {
    await tweenObject(scene, impact, {
      scaleX: 1.48,
      scaleY: 1.48,
      alpha: 0,
      duration: reducedDetail ? 130 : 170,
      ease: 'Sine.easeOut'
    }, reducedDetail ? 310 : 380);
  } finally {
    impact.destroy(true);
  }
}

async function playMarksman(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, source, target, element } = options;
  const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.neutral;
  const radius = baseRadius(reducedDetail);
  const length = radius * (reducedDetail ? 2.55 : 2.9);
  const shaft = Math.max(5, radius * 0.14);
  const head = radius * 0.72;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const arrow = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  arrow.add([
    // A short elemental aura keeps the arrow readable without recreating a screen-wide beam.
    scene.add.triangle(-length * 0.28, 0, -length * 0.36, -shaft * 1.45, length * 0.2, 0, -length * 0.36, shaft * 1.45, color, reducedDetail ? 0.07 : 0.11),
    scene.add.rectangle(-length * 0.04, 0, length * 0.78, shaft * 1.8, color, reducedDetail ? 0.07 : 0.1),
    scene.add.rectangle(-length * 0.04, 0, length * 0.8, shaft, color, 0.96),
    scene.add.rectangle(-length * 0.03, 0, length * 0.67, Math.max(2.5, shaft * 0.3), 0xffffff, 0.72),
    scene.add.triangle(length * 0.43, 0, -head * 0.5, -head * 0.52, -head * 0.5, head * 0.52, head * 0.58, 0, color, 1),
    scene.add.triangle(length * 0.45, 0, -head * 0.28, -head * 0.25, -head * 0.28, head * 0.25, head * 0.36, 0, 0xffffff, 0.9),
    scene.add.triangle(-length * 0.43, -shaft * 0.52, -14, -10, 12, 0, -14, 10, color, 0.82),
    scene.add.triangle(-length * 0.43, shaft * 0.52, -14, -10, 12, 0, -14, 10, color, 0.82).setScale(1, -1)
  ]);

  await fly(options, arrow, durationMs);
  await impactMarksman(options, reducedDetail);
}

function makeMageOrb(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean,
  scale: number,
  enchanter: boolean,
  healer: boolean
): Phaser.GameObjects.Container {
  const { scene, source, element } = options;
  const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.neutral;
  const radius = baseRadius(reducedDetail) * scale;
  const orb = scene.add.container(source.x, source.y).setDepth(powVfxDepth('foreground') + 2);

  orb.add([
    scene.add.circle(0, 0, radius * 1.08, color, healer ? 0.055 : reducedDetail ? 0.07 : 0.11),
    scene.add.circle(0, 0, radius * 0.86, color, healer ? 0.16 : 0.23)
      .setStrokeStyle(reducedDetail ? 2 : 3, color, healer ? 0.48 : 0.68),
    scene.add.circle(0, 0, radius * 0.58, color, healer ? 0.76 : 0.92),
    scene.add.circle(radius * 0.08, -radius * 0.07, radius * 0.23, 0xffffff, healer ? 0.78 : 0.94),
    scene.add.ellipse(0, 0, radius * 1.96, radius * 0.7, 0x000000, 0)
      .setStrokeStyle(reducedDetail ? 1 : 2, 0xffffff, healer ? 0.24 : 0.42)
      .setRotation(0.28)
  ]);

  if (!reducedDetail) {
    orb.add(
      scene.add.ellipse(0, 0, radius * 1.72, radius * 0.56, 0x000000, 0)
        .setStrokeStyle(2, color, healer ? 0.3 : 0.52)
        .setRotation(-0.42)
    );
  }

  if (enchanter) {
    // Same energy-orb language as Mage, with one restrained arcane diamond for recognition.
    const rune = radius * 0.88;
    orb.add(
      scene.add.rectangle(0, 0, rune, rune, 0x000000, 0)
        .setStrokeStyle(reducedDetail ? 1 : 2, 0xffffff, reducedDetail ? 0.22 : 0.36)
        .setRotation(Math.PI / 4)
    );
  }

  return orb;
}

async function playMageLike(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean,
  role: 'mage' | 'enchanter' | 'healer'
): Promise<void> {
  const healer = role === 'healer';
  const scale = healer ? HEALER_SCALE_VS_MAGE : 1;
  const orb = makeMageOrb(options, reducedDetail, scale, role === 'enchanter', healer);
  await fly(options, orb, durationMs);
  await impactOrb(options, reducedDetail, scale, healer);
}

async function playMusician(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, source, target, element } = options;
  const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.neutral;
  const size = baseRadius(reducedDetail) * (reducedDetail ? 0.88 : 0.96);
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const note = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle * 0.08 - 0.12);

  note.add([
    scene.add.circle(0, 0, size * 0.98, color, reducedDetail ? 0.045 : 0.08),
    // Main eighth-note silhouette.
    scene.add.ellipse(-size * 0.2, size * 0.28, size * 0.82, size * 0.52, color, 0.98).setRotation(-0.28),
    scene.add.ellipse(-size * 0.14, size * 0.24, size * 0.31, size * 0.18, 0xffffff, 0.82).setRotation(-0.28),
    scene.add.rectangle(size * 0.18, -size * 0.18, Math.max(5, size * 0.115), size * 1.16, color, 0.98),
    scene.add.triangle(size * 0.53, -size * 0.6, -size * 0.34, -size * 0.2, size * 0.34, 0, -size * 0.34, size * 0.2, color, 0.94),
    // Two tiny harmonic echoes remain children of the same projectile container.
    scene.add.ellipse(-size * 0.73, -size * 0.2, size * 0.28, size * 0.18, color, reducedDetail ? 0.34 : 0.5),
    scene.add.ellipse(-size * 0.98, size * 0.14, size * 0.19, size * 0.12, 0xffffff, reducedDetail ? 0.26 : 0.42)
  ]);

  await fly(options, note, durationMs);
  await impactMusic(options, reducedDetail);
}

async function playRangedRole(
  options: RoleAwareOptions,
  role: RangedRole,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  if (role === 'marksman') {
    await playMarksman(options, durationMs, reducedDetail);
    return;
  }
  if (role === 'musician') {
    await playMusician(options, durationMs, reducedDetail);
    return;
  }
  await playMageLike(options, durationMs, reducedDetail, role);
}

export function installCombat2151RangedRoleVfxPatch(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;
  const previousPlay = owner.play.bind(owner) as (options: DirectionalProjectileOptions) => Promise<void>;

  owner.play = async (rawOptions: DirectionalProjectileOptions): Promise<void> => {
    const options = rawOptions as RoleAwareOptions;
    const role = resolveRangedRole(options.role);
    if (!role) {
      await previousPlay(rawOptions);
      return;
    }

    const current = fxTier();
    const concurrency = activeRangedShots + 1;
    const burstReducedMotion = current === 'balanced' && concurrency >= BALANCED_BURST_THRESHOLD;
    const reducedDetail = Boolean(options.reducedMotion) || current === 'lite' || burstReducedMotion;
    const durationMs = readableDuration(options, current, burstReducedMotion);

    activeRangedShots += 1;
    try {
      await playRangedRole(options, role, durationMs, reducedDetail);
    } finally {
      activeRangedShots = Math.max(0, activeRangedShots - 1);
    }
  };

  root.POWDER_COMBAT2_RANGED_ROLE_VFX = {
    version: '2.15.1',
    family: 'Combat2',
    owner: 'final-five-ranged-profession-owner',
    roles: {
      marksman: 'element-arrow-refined',
      mage: 'layered-energy-orb',
      enchanter: 'layered-energy-orb-arcane-diamond',
      healer: 'soft-energy-orb-80pct-mage',
      musician: 'single-note-with-contained-harmonic-echoes'
    },
    impacts: {
      marksman: 'piercing-line-impact',
      mage: 'energy-ring-impact',
      enchanter: 'energy-ring-impact',
      healer: 'soft-energy-ring-impact',
      musician: 'harmonic-ring-impact'
    },
    healerScaleVsMage: HEALER_SCALE_VS_MAGE,
    travelDurationScaleVsCombat2Baseline: PROJECTILE_DURATION_SCALE,
    travelSpeedPreservedFrom2150: true,
    elementColorPreserved: true,
    singleProjectilePerRangedAction: true,
    noFullPathBeam: true,
    noDuplicateGuideProjectile: true,
    particleEmitters: false,
    tweenLoops: false,
    delegatesNonRangedToPreviousOwner: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_FX_BUDGET = {
    version: '2.15.1',
    family: 'Combat2',
    source: 'POWDER_COMBAT2_FX_TIER',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    rangedOwner: 'Combat2151RangedRoleVfxPatch',
    rangedSingleProjectile: true,
    meleeDelegated: true,
    particleEmitters: false,
    tweenLoops: false,
    combatLogicChanged: false
  };
}

installCombat2151RangedRoleVfxPatch();
