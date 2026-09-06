import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';
import { playCombat2201ActionVfx, type Combat2201ActionTier } from './Combat2201HighFantasyAnimeVfx';

const FLAG = '__powderCombatNightFxBudgetInstalled';
const BALANCED_BURST_THRESHOLD = 2;
const NIGHT43_PROJECTILE_SCALE = 1.5;
const NIGHT44_HEAD_SCALE_VS_NIGHT43 = 10;
const PROJECTILE_SIZE_VS_NIGHT44 = 0.4;
const PROJECTILE_HEAD_SCALE_VS_NIGHT43 = NIGHT44_HEAD_SCALE_VS_NIGHT43 * PROJECTILE_SIZE_VS_NIGHT44;
const PROJECTILE_DURATION_SCALE = 2.25;
const HEALER_ORB_SCALE_VS_MAGE = 0.8;
const ASSASSIN_SLASH_SCALE_VS_KNIGHT = 0.8;

const PROJECTILE_COLOR: Readonly<Record<CombatProjectileElement, number>> = Object.freeze({
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
type RoleAttackKind =
  | 'marksman'
  | 'mage'
  | 'enchanter'
  | 'healer'
  | 'musician'
  | 'fighter'
  | 'knight'
  | 'assassin'
  | 'tank'
  | 'fallback';
type RoleAwareProjectileOptions = DirectionalProjectileOptions & {
  role?: string;
  signature?: { tier?: Combat2201ActionTier; role?: string; traits?: readonly string[] };
};

let activeProjectiles = 0;

function normalize(value: string | undefined): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
}

function resolveRole(rawRole: string | undefined): RoleAttackKind {
  const role = normalize(rawRole);
  if (role.includes('sat thu') || role.includes('assassin')) return 'assassin';
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('enchanter')) return 'enchanter';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('dau si') || role.includes('fighter')) return 'fighter';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  return 'fallback';
}

function tier(): FxTier {
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

  // Night46 preserves the user-approved Night45/Night44 travel speed.
  return Math.round(baseDuration * PROJECTILE_DURATION_SCALE);
}

function night45Radius(reducedDetail: boolean): number {
  const night43HeadRadius = (reducedDetail ? 6 : 8) * NIGHT43_PROJECTILE_SCALE;
  return night43HeadRadius * PROJECTILE_HEAD_SCALE_VS_NIGHT43;
}

function tweenObject(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  config: CombatTweenConfig,
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
      try { tween?.stop(); } catch { /* scene teardown owns the tween manager */ }
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

function waitScene(scene: Phaser.Scene, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let delayed: Phaser.Time.TimerEvent | null = null;
    let safetyTimer = 0;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (safetyTimer) window.clearTimeout(safetyTimer);
      try { delayed?.remove(false); } catch { /* scene may already be tearing down */ }
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, finish);
      scene.events.off(Phaser.Scenes.Events.DESTROY, finish);
      resolve();
    };

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);
    scene.events.once(Phaser.Scenes.Events.DESTROY, finish);
    safetyTimer = window.setTimeout(finish, Math.max(120, durationMs + 100));
    try { delayed = scene.time.delayedCall(Math.max(0, durationMs), finish); }
    catch { finish(); }
  });
}

async function playRangedImpact(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean,
  sizeScale = 1
): Promise<void> {
  const { scene, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const radius = (reducedDetail ? 18 : 24) * sizeScale;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 1);

  impact.add([
    scene.add.circle(0, 0, radius * 0.5, color, 0.34),
    scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, color, 0.88),
    scene.add.circle(0, 0, radius * 0.2, 0xffffff, 0.72)
  ]);

  try {
    await tweenObject(scene, impact, {
      scaleX: reducedDetail ? 1.28 : 1.5,
      scaleY: reducedDetail ? 1.28 : 1.5,
      alpha: 0,
      duration: reducedDetail ? 125 : 170,
      ease: 'Quad.easeOut'
    }, reducedDetail ? 315 : 385);
  } finally {
    impact.destroy(true);
  }
}

async function flyContainer(
  options: DirectionalProjectileOptions,
  projectile: Phaser.GameObjects.Container,
  durationMs: number,
  reducedDetail: boolean,
  impactScale = 1
): Promise<void> {
  try {
    await tweenObject(options.scene, projectile, {
      x: options.target.x,
      y: options.target.y,
      duration: durationMs,
      ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut'
    }, durationMs + 320);
  } finally {
    projectile.destroy(true);
  }

  await playRangedImpact(options, reducedDetail, impactScale);
}

async function playEnergyOrb(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean,
  sizeScale = 1
): Promise<void> {
  const { scene, source, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const radius = night45Radius(reducedDetail) * sizeScale;
  const orb = scene.add.container(source.x, source.y).setDepth(powVfxDepth('foreground') + 2);

  orb.add([
    scene.add.circle(0, 0, radius * 1.08, color, reducedDetail ? 0.07 : 0.11),
    scene.add.circle(0, 0, radius * 0.86, color, 0.22).setStrokeStyle(reducedDetail ? 2 : 3, color, 0.62),
    scene.add.circle(0, 0, radius * 0.58, color, 0.9),
    scene.add.circle(radius * 0.08, -radius * 0.06, radius * 0.24, 0xffffff, 0.92),
    scene.add.ellipse(0, 0, radius * 1.95, radius * 0.72, 0x000000, 0)
      .setStrokeStyle(reducedDetail ? 1 : 2, 0xffffff, reducedDetail ? 0.24 : 0.42)
      .setRotation(0.28)
  ]);

  if (!reducedDetail) {
    orb.add(
      scene.add.ellipse(0, 0, radius * 1.72, radius * 0.58, 0x000000, 0)
        .setStrokeStyle(2, color, 0.48)
        .setRotation(-0.42)
    );
  }

  await flyContainer(options, orb, durationMs, reducedDetail, sizeScale);
}

async function playElementArrow(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, source, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const radius = night45Radius(reducedDetail);
  const length = radius * (reducedDetail ? 2.35 : 2.7);
  const shaftThickness = Math.max(5, radius * 0.16);
  const headSize = radius * 0.7;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const arrow = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  arrow.add([
    scene.add.rectangle(-length * 0.05, 0, length * 0.72, shaftThickness * 1.9, color, reducedDetail ? 0.08 : 0.12),
    scene.add.rectangle(-length * 0.06, 0, length * 0.74, shaftThickness, color, 0.94),
    scene.add.rectangle(-length * 0.05, 0, length * 0.62, Math.max(2.5, shaftThickness * 0.32), 0xffffff, 0.72),
    scene.add.triangle(
      length * 0.4,
      0,
      -headSize * 0.48,
      -headSize * 0.5,
      -headSize * 0.48,
      headSize * 0.5,
      headSize * 0.56,
      0,
      color,
      0.98
    ),
    scene.add.triangle(
      length * 0.42,
      0,
      -headSize * 0.26,
      -headSize * 0.24,
      -headSize * 0.26,
      headSize * 0.24,
      headSize * 0.34,
      0,
      0xffffff,
      0.86
    ),
    scene.add.triangle(-length * 0.44, -shaftThickness * 0.56, -13, -10, 11, 0, -13, 10, color, 0.78),
    scene.add.triangle(-length * 0.44, shaftThickness * 0.56, -13, -10, 11, 0, -13, 10, color, 0.78)
      .setScale(1, -1)
  ]);

  await flyContainer(options, arrow, durationMs, reducedDetail, 0.9);
}

async function playMusicNote(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, source, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const size = night45Radius(reducedDetail) * (reducedDetail ? 0.88 : 0.96);
  const note = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(-0.12);

  note.add([
    scene.add.circle(0, 0, size * 0.95, color, reducedDetail ? 0.05 : 0.09),
    scene.add.ellipse(-size * 0.18, size * 0.28, size * 0.78, size * 0.5, color, 0.95).setRotation(-0.28),
    scene.add.ellipse(-size * 0.12, size * 0.24, size * 0.3, size * 0.18, 0xffffff, 0.82).setRotation(-0.28),
    scene.add.rectangle(size * 0.17, -size * 0.18, Math.max(5, size * 0.12), size * 1.12, color, 0.95),
    scene.add.triangle(
      size * 0.52,
      -size * 0.58,
      -size * 0.34,
      -size * 0.2,
      size * 0.34,
      0,
      -size * 0.34,
      size * 0.2,
      color,
      0.92
    )
  ]);

  await flyContainer(options, note, durationMs, reducedDetail, 0.9);
}

async function playEnergyCometFallback(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, source, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const headRadius = night45Radius(reducedDetail);
  const auraRadius = headRadius * 1.16;
  const tailLength = (reducedDetail ? 92 : 126) * PROJECTILE_SIZE_VS_NIGHT44;
  const tailThickness = (reducedDetail ? 18 : 24) * PROJECTILE_SIZE_VS_NIGHT44;
  const noseLength = (reducedDetail ? 32 : 42) * PROJECTILE_SIZE_VS_NIGHT44;
  const comet = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  comet.add([
    scene.add.rectangle(-tailLength * 0.58, 0, tailLength, tailThickness, color, reducedDetail ? 0.22 : 0.3),
    scene.add.rectangle(-tailLength * 0.4, 0, tailLength * 0.72, Math.max(2.5, tailThickness * 0.38), 0xffffff, reducedDetail ? 0.18 : 0.28),
    scene.add.circle(0, 0, auraRadius, color, reducedDetail ? 0.08 : 0.12),
    scene.add.circle(0, 0, headRadius, color, 0.76),
    scene.add.circle(headRadius * 0.08, 0, headRadius * 0.58, color, 0.96),
    scene.add.circle(headRadius * 0.16, 0, headRadius * 0.28, 0xffffff, 0.92),
    scene.add.triangle(
      headRadius * 0.9,
      0,
      -noseLength * 0.46,
      -noseLength * 0.36,
      -noseLength * 0.46,
      noseLength * 0.36,
      noseLength * 0.54,
      0,
      0xffffff,
      reducedDetail ? 0.68 : 0.82
    )
  ]);

  await flyContainer(options, comet, durationMs, reducedDetail);
}

async function playFistStrike(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  const { scene, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  await waitScene(scene, Math.min(reducedDetail ? 95 : 145, Math.round(durationMs * 0.26)));

  const size = night45Radius(reducedDetail) * 1.7;
  const fist = scene.add.container(target.x, target.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setScale(0.72)
    .setRotation(-0.16);

  fist.add([
    scene.add.circle(0, 0, size * 0.62, color, reducedDetail ? 0.06 : 0.1),
    scene.add.rectangle(0, size * 0.1, size * 0.74, size * 0.56, color, 0.9),
    scene.add.circle(-size * 0.28, -size * 0.22, size * 0.16, color, 0.98),
    scene.add.circle(-size * 0.09, -size * 0.28, size * 0.17, color, 0.98),
    scene.add.circle(size * 0.11, -size * 0.27, size * 0.17, color, 0.98),
    scene.add.circle(size * 0.3, -size * 0.2, size * 0.15, color, 0.98),
    scene.add.rectangle(size * 0.02, size * 0.38, size * 0.3, size * 0.38, color, 0.9),
    scene.add.circle(size * 0.04, size * 0.02, size * 0.17, 0xffffff, 0.68)
  ]);

  try {
    await tweenObject(scene, fist, {
      scaleX: reducedDetail ? 1.02 : 1.16,
      scaleY: reducedDetail ? 1.02 : 1.16,
      alpha: 0,
      duration: reducedDetail ? 145 : 205,
      ease: 'Back.easeOut'
    }, reducedDetail ? 330 : 410);
  } finally {
    fist.destroy(true);
  }
}

async function playSlashStrike(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean,
  sizeScale: number,
  rotation: number
): Promise<void> {
  const { scene, target, element } = options;
  const color = PROJECTILE_COLOR[element] ?? PROJECTILE_COLOR.neutral;
  const length = night45Radius(reducedDetail) * 3.1 * sizeScale;
  const slash = scene.add.container(target.x, target.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(rotation)
    .setScale(0.7);

  slash.add([
    scene.add.arc(0, 0, length * 0.5, 198, 342, false, 0x000000, 0)
      .setStrokeStyle(Math.max(6, length * 0.085), color, 0.9),
    scene.add.arc(0, 0, length * 0.43, 202, 338, false, 0x000000, 0)
      .setStrokeStyle(Math.max(2.5, length * 0.032), 0xffffff, 0.88),
    scene.add.circle(length * 0.2, -length * 0.08, Math.max(5, length * 0.055), 0xffffff, 0.56)
  ]);

  try {
    await tweenObject(scene, slash, {
      scaleX: reducedDetail ? 1.03 : 1.16,
      scaleY: reducedDetail ? 1.03 : 1.16,
      alpha: 0,
      duration: reducedDetail ? 135 : 185,
      ease: 'Quad.easeOut'
    }, reducedDetail ? 310 : 390);
  } finally {
    slash.destroy(true);
  }
}

async function playKnightSlash(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  await waitScene(options.scene, Math.min(reducedDetail ? 90 : 135, Math.round(durationMs * 0.24)));
  await playSlashStrike(options, reducedDetail, 1, -0.2);
}

async function playAssassinCriticalSlashes(
  options: DirectionalProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  await waitScene(options.scene, Math.min(reducedDetail ? 80 : 120, Math.round(durationMs * 0.22)));
  const first = playSlashStrike(options, reducedDetail, ASSASSIN_SLASH_SCALE_VS_KNIGHT, -0.48);
  await waitScene(options.scene, reducedDetail ? 38 : 55);
  const second = playSlashStrike(options, reducedDetail, ASSASSIN_SLASH_SCALE_VS_KNIGHT, 0.48);
  await Promise.all([first, second]);
}

async function playRoleAttack(
  options: RoleAwareProjectileOptions,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  switch (resolveRole(options.role)) {
    case 'marksman':
      await playElementArrow(options, durationMs, reducedDetail);
      return;
    case 'mage':
    case 'enchanter':
      await playEnergyOrb(options, durationMs, reducedDetail, 1);
      return;
    case 'healer':
      await playEnergyOrb(options, durationMs, reducedDetail, HEALER_ORB_SCALE_VS_MAGE);
      return;
    case 'musician':
      await playMusicNote(options, durationMs, reducedDetail);
      return;
    case 'fighter':
      await playFistStrike(options, durationMs, reducedDetail);
      return;
    case 'knight':
      await playKnightSlash(options, durationMs, reducedDetail);
      return;
    case 'assassin':
      await playAssassinCriticalSlashes(options, durationMs, reducedDetail);
      return;
    case 'tank':
    case 'fallback':
    default:
      await playEnergyCometFallback(options, durationMs, reducedDetail);
  }
}

export function installCombatNightFxBudgetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;

  owner.play = async (rawOptions: DirectionalProjectileOptions): Promise<void> => {
    const options = rawOptions as RoleAwareProjectileOptions;
    const actionTier = options.signature?.tier === 'ultimate'
      ? 'ultimate'
      : options.signature?.tier === 'skill'
        ? 'skill'
        : 'normal';
    await playCombat2201ActionVfx(options, actionTier);
  };

  root.POWDER_COMBAT2_NIGHT_FX_BUDGET = {
    version: 'night-46',
    source: 'POWDER_COMBAT2_FX_TIER',
    full: 'profession-routed-single-owner',
    balanced: 'profession-routed-single-owner-reduced-burst-detail',
    lite: 'profession-routed-single-owner-minimal-detail',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    burstGuard: true,
    singleProjectileOwner: true,
    projectileSizeVsNight44: PROJECTILE_SIZE_VS_NIGHT44,
    projectileTravelDurationScaleVsNight42: PROJECTILE_DURATION_SCALE,
    projectileTravelSpeedUnchangedVsNight45: true,
    legacyFullPathLineDisabled: true,
    duplicateMovingGuideDisabled: true,
    particleEmitters: false,
    tweenLoops: false,
    sceneShutdownSafeGuide: true,
    fullTierPreserved: true,
    counterFinallySafe: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_NIGHT_ROLE_ATTACKS = {
    version: 'night-46',
    routes: {
      marksman: 'element-arrow',
      mage: 'energy-orb',
      enchanter: 'energy-orb',
      healer: 'energy-orb-80pct-mage',
      musician: 'music-note',
      fighter: 'fist-no-projectile',
      knight: 'single-heavy-slash-no-projectile',
      assassin: 'dual-critical-slash-80pct-knight-no-projectile',
      tank: 'shield-bash-contact-no-projectile'
    },
    rangedRoles: ['marksman', 'mage', 'enchanter', 'healer', 'musician'],
    noProjectileRoles: ['tank', 'fighter', 'knight', 'assassin'],
    healerScaleVsMage: HEALER_ORB_SCALE_VS_MAGE,
    assassinSlashScaleVsKnight: ASSASSIN_SLASH_SCALE_VS_KNIGHT,
    elementColorPreserved: true,
    oneAttackObjectFamilyPerAction: true,
    particleEmitters: false,
    tweenLoops: false,
    combatLogicChanged: false
  };
}

installCombatNightFxBudgetBridge();
