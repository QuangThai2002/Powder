import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2183_PROFESSION_IMPACT_VERSION = '2.18.3';
export const COMBAT2178_PROFESSION_IMPACT_VERSION = COMBAT2183_PROFESSION_IMPACT_VERSION;
export const COMBAT2174_PROFESSION_IMPACT_VERSION = COMBAT2183_PROFESSION_IMPACT_VERSION;
export const COMBAT2173_PROFESSION_IMPACT_VERSION = COMBAT2183_PROFESSION_IMPACT_VERSION;
export const COMBAT2172_PROFESSION_IMPACT_VERSION = COMBAT2183_PROFESSION_IMPACT_VERSION;

export type Combat2172ProfessionTier = 'normal' | 'skill' | 'ultimate';
export type Combat2172ProfessionRole = 'mage' | 'tank' | 'fighter' | 'knight' | 'assassin' | 'enchanter' | 'healer';
export type Combat2172MeleeRole = 'tank' | 'fighter' | 'knight' | 'assassin';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number };

const ELEMENT_PALETTE: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff7048, core: 0xffefd0 },
  lava: { main: 0xf45735, core: 0xffd46d },
  water: { main: 0x50bde7, core: 0xf0fcff },
  ice: { main: 0x8ee4f7, core: 0xffffff },
  lightning: { main: 0xead45f, core: 0xffffec },
  storm: { main: 0x7f99d8, core: 0xf5f7ff },
  wind: { main: 0x68d5c4, core: 0xf3fffc },
  leaf: { main: 0x72cf80, core: 0xf2ffeb },
  poison: { main: 0xa0cf66, core: 0xf8ffdd },
  earth: { main: 0xb98b5b, core: 0xffe8c5 },
  steel: { main: 0xc2d2da, core: 0xffffff },
  light: { main: 0xf1da90, core: 0xfffff4 },
  dark: { main: 0x9e82d6, core: 0xf8f1ff },
  neutral: { main: 0x9bcbd4, core: 0xffffff }
});

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function resolveCombat2172MeleeRole(role?: string): Combat2172MeleeRole | null {
  const value = normalize(role ?? '');
  if (value.includes('do don') || value.includes('tank')) return 'tank';
  if (value.includes('dau si') || value.includes('fighter') || value.includes('brawler')) return 'fighter';
  if (value.includes('hiep si') || value.includes('knight') || value.includes('paladin')) return 'knight';
  if (value.includes('sat thu') || value.includes('assassin')) return 'assassin';
  return null;
}

function isMeleeRole(role: Combat2172ProfessionRole): role is Combat2172MeleeRole {
  return role === 'tank' || role === 'fighter' || role === 'knight' || role === 'assassin';
}

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
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

function shake(
  scene: Phaser.Scene,
  role: Combat2172ProfessionRole,
  tier: Combat2172ProfessionTier,
  reducedMotion: boolean
): void {
  const camera = scene.cameras?.main;
  if (!camera) return;

  if (tier === 'ultimate') {
    const heavy = role === 'tank' || role === 'fighter' || role === 'knight';
    camera.shake(
      reducedMotion ? 72 : heavy ? 170 : role === 'assassin' ? 105 : 145,
      reducedMotion ? 0.0015 : heavy ? 0.0062 : role === 'assassin' ? 0.0038 : 0.0048,
      false
    );
    return;
  }

  if (isMeleeRole(role)) return;
  if (tier === 'skill' && !reducedMotion) camera.shake(76, 0.0012, false);
}

function makeImpactBurst(
  options: Options,
  tier: Combat2172ProfessionTier
): Phaser.GameObjects.Container {
  const p = ELEMENT_PALETTE[options.element] ?? ELEMENT_PALETTE.neutral;
  const radius = tier === 'ultimate' ? 58 : tier === 'skill' ? 40 : 24;
  const root = options.scene.add.container(options.target.x, options.target.y)
    .setDepth(powVfxDepth('foreground') + 16);
  const flash = options.scene.add.circle(
    0,
    0,
    radius * 0.56,
    p.core,
    tier === 'ultimate' ? 0.34 : tier === 'skill' ? 0.22 : 0.14
  ).setBlendMode(Phaser.BlendModes.ADD);
  const ring = options.scene.add.circle(0, 0, radius, 0x000000, 0)
    .setStrokeStyle(
      tier === 'ultimate' ? 5 : tier === 'skill' ? 3.5 : 2,
      p.main,
      tier === 'normal' ? 0.66 : 0.94
    )
    .setBlendMode(Phaser.BlendModes.ADD);
  const rays = options.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const rayCount = tier === 'ultimate' ? 8 : tier === 'skill' ? 5 : 3;
  for (let i = 0; i < rayCount; i += 1) {
    const rayAngle = (Math.PI * 2 * i) / rayCount;
    const innerR = radius * 0.32;
    const outerR = radius * (tier === 'ultimate' ? 1.48 : tier === 'skill' ? 1.18 : 0.96);
    rays.lineStyle(
      tier === 'ultimate' ? 4 : tier === 'skill' ? 3 : 2,
      i % 2 ? p.core : p.main,
      tier === 'ultimate' ? 0.76 : tier === 'skill' ? 0.54 : 0.36
    );
    rays.lineBetween(
      Math.cos(rayAngle) * innerR,
      Math.sin(rayAngle) * innerR,
      Math.cos(rayAngle) * outerR,
      Math.sin(rayAngle) * outerR
    );
  }
  root.add([flash, rays, ring]);
  return root;
}

export async function playCombat2172ImpactFeedback(
  options: Options,
  role: Combat2172ProfessionRole,
  tier: Combat2172ProfessionTier
): Promise<void> {
  shake(options.scene, role, tier, options.reducedMotion);
  const root = makeImpactBurst(options, tier);
  const duration = tier === 'ultimate' ? 230 : tier === 'skill' ? 165 : 105;
  root.setScale(tier === 'ultimate' ? 0.56 : tier === 'skill' ? 0.68 : 0.78);
  try {
    await tween(options.scene, root, {
      scaleX: tier === 'ultimate' ? 1.95 : tier === 'skill' ? 1.58 : 1.24,
      scaleY: tier === 'ultimate' ? 1.95 : tier === 'skill' ? 1.58 : 1.24,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut'
    }, duration + 220);
  } finally {
    root.destroy(true);
  }
}

export async function playCombat2172MeleeProfessionImpact(
  _options: Options,
  _role: Combat2172MeleeRole,
  _tier: Combat2172ProfessionTier
): Promise<void> {
  // Retired in 2.18.3. Tank/Fighter/Knight/Assassin must use dedicated owners.
}

export function rangedImpactDelayMs(
  options: Options,
  role: Extract<Combat2172ProfessionRole, 'mage' | 'enchanter' | 'healer'>,
  tier: Combat2172ProfessionTier
): number {
  const distance = Phaser.Math.Distance.Between(options.source.x, options.source.y, options.target.x, options.target.y);
  if (role === 'mage') {
    const base = tier === 'ultimate' ? 430 : tier === 'skill' ? 360 : 300;
    return Math.round(Phaser.Math.Clamp(base + distance * 0.035, base, base + 85));
  }
  if (role === 'enchanter') {
    const base = tier === 'ultimate' ? 440 : tier === 'skill' ? 350 : 275;
    return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 85));
  }
  const base = tier === 'ultimate' ? 445 : tier === 'skill' ? 355 : 280;
  return Math.round(Phaser.Math.Clamp(base + distance * 0.03, base, base + 85));
}

export function scheduleCombat2172RangedImpactFeedback(
  options: Options,
  role: Extract<Combat2172ProfessionRole, 'mage' | 'enchanter' | 'healer'>,
  tier: Combat2172ProfessionTier
): void {
  const delay = rangedImpactDelayMs(options, role, tier);
  options.scene.time.delayedCall(delay, () => {
    if (!options.scene.sys?.isActive?.()) return;
    void playCombat2172ImpactFeedback(options, role, tier);
  });
}

(globalThis as any).POWDER_COMBAT2_PROFESSION_IMPACT_2172 = {
  version: COMBAT2183_PROFESSION_IMPACT_VERSION,
  mageImpactPresentationPreservedFrom2175: true,
  meleeRoles: ['tank', 'fighter', 'knight', 'assassin'],
  meleeGenericRenderersRetired: true,
  dedicatedMeleeOwnersRequired: true,
  rangedGenericImpactRetainedForMageCompatibility: true,
  enchanterOwnsImpact: true,
  healerOwnsImpact: true,
  meleeProjectileTravel: false,
  meleeNormalCameraShake: false,
  meleeSkillCameraShake: false,
  particleEmitters: false,
  repeatingTweenLoops: false,
  cleanupOwned: true,
  combatLogicChanged: false
};
