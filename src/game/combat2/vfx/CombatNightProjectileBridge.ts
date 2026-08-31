import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { isCombat2160MarksmanRole } from './Combat2160MarksmanSpiralRailBoltVfx';
import {
  playCombat2163MarksmanDistinctTierVfx,
  type Combat2163MarksmanTier
} from './Combat2163MarksmanDistinctTierVfx';
import { COMBAT2164_MARKSMAN_RUNTIME_VERSION } from './Combat2164MarksmanRuntimeTierBridge';
import {
  COMBAT2165_MAGE_VERSION,
  isCombat2165MageRole,
  playCombat2165MageDistinctTierVfx,
  type Combat2165MageTier
} from './Combat2165MageDistinctTierVfx';
import {
  COMBAT2166_TANK_VERSION,
  isCombat2166TankRole,
  playCombat2166TankDistinctTierVfx,
  type Combat2166TankTier
} from './Combat2166TankDistinctTierVfx';
import {
  COMBAT2167_FIGHTER_VERSION,
  isCombat2167FighterRole,
  playCombat2167FighterDistinctTierVfx,
  type Combat2167FighterTier
} from './Combat2167FighterDistinctTierVfx';
import {
  COMBAT2168_KNIGHT_VERSION,
  isCombat2168KnightRole,
  playCombat2168KnightDistinctTierVfx,
  type Combat2168KnightTier
} from './Combat2168KnightDistinctTierVfx';
import { PowView } from '../views/PowView';

interface PowViewProjectileRuntime {
  scene: Phaser.Scene;
  pow: { elementKey?: string; element?: string; role?: string };
  reducedMotion: boolean;
  container: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition: () => Phaser.Math.Vector2;
  playCastSignature?: (support: boolean) => Promise<void>;
  tweenPromise?: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Promise<void>;
  __combat2MarksmanAttackTier?: Combat2163MarksmanTier;
}

type RoleAwareProjectileOptions = DirectionalProjectileOptions & { role?: string };

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveElement(pow: PowViewProjectileRuntime['pow']): CombatProjectileElement {
  const key = normalize(`${pow.elementKey ?? ''} ${pow.element ?? ''}`);
  if (key.includes('dung nham') || key.includes('lava')) return 'lava';
  if (key.includes('lua') || key.includes('fire')) return 'fire';
  if (key.includes('nuoc') || key.includes('water')) return 'water';
  if (key.includes('bang') || key.includes('ice')) return 'ice';
  if (key.includes('bao') || key.includes('storm')) return 'storm';
  if (key.includes('set') || key.includes('lightning') || key.includes('electric')) return 'lightning';
  if (key.includes('gio') || key.includes('wind')) return 'wind';
  if (key.includes('la') || key.includes('leaf') || key.includes('nature')) return 'leaf';
  if (key.includes('doc') || key.includes('poison')) return 'poison';
  if (key.includes('dat') || key.includes('earth')) return 'earth';
  if (key.includes('thep') || key.includes('steel')) return 'steel';
  if (key.includes('anh sang') || key.includes('light')) return 'light';
  if (key.includes('bong toi') || key.includes('dark')) return 'dark';
  return 'neutral';
}

function validTier(value: unknown): value is Combat2163MarksmanTier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function resolveActionTier(view: PowViewProjectileRuntime): Combat2163MarksmanTier {
  if (validTier(view.__combat2MarksmanAttackTier)) return view.__combat2MarksmanAttackTier;
  const globalTier = (globalThis as any).POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER;
  return validTier(globalTier) ? globalTier : 'normal';
}

async function playNightProjectile(view: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
  const source = typeof view.getVfxAnchor === 'function' ? view.getVfxAnchor('body') : view.getWorldPosition();
  const target = new Phaser.Math.Vector2(targetX, targetY);
  const options: RoleAwareProjectileOptions = {
    scene: view.scene,
    source,
    target,
    element: resolveElement(view.pow),
    reducedMotion: view.reducedMotion,
    role: view.pow.role
  };

  if (isCombat2160MarksmanRole(view.pow.role)) {
    const tier = resolveActionTier(view);
    await playCombat2163MarksmanDistinctTierVfx(options, tier);
    (globalThis as any).POWDER_COMBAT2_MARKSMAN_PROJECTILE_LAST = {
      version: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true
    };
    return;
  }

  if (isCombat2165MageRole(view.pow.role)) {
    const tier = resolveActionTier(view) as Combat2165MageTier;
    await playCombat2165MageDistinctTierVfx(options, tier);
    (globalThis as any).POWDER_COMBAT2_MAGE_PROJECTILE_LAST = {
      version: COMBAT2165_MAGE_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true
    };
    return;
  }

  if (isCombat2166TankRole(view.pow.role)) {
    const tier = resolveActionTier(view) as Combat2166TankTier;
    await playCombat2166TankDistinctTierVfx(options, tier);
    (globalThis as any).POWDER_COMBAT2_TANK_PROJECTILE_LAST = {
      version: COMBAT2166_TANK_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true
    };
    return;
  }

  if (isCombat2167FighterRole(view.pow.role)) {
    const tier = resolveActionTier(view) as Combat2167FighterTier;
    await playCombat2167FighterDistinctTierVfx(options, tier);
    (globalThis as any).POWDER_COMBAT2_FIGHTER_PROJECTILE_LAST = {
      version: COMBAT2167_FIGHTER_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true
    };
    return;
  }

  if (isCombat2168KnightRole(view.pow.role)) {
    const tier = resolveActionTier(view) as Combat2168KnightTier;
    await playCombat2168KnightDistinctTierVfx(options, tier);
    (globalThis as any).POWDER_COMBAT2_KNIGHT_PROJECTILE_LAST = {
      version: COMBAT2168_KNIGHT_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true
    };
    return;
  }

  const roleAwarePlay = DirectionalElementProjectileVfx.play as unknown as
    (runtimeOptions: RoleAwareProjectileOptions) => Promise<void>;
  await roleAwarePlay(options);
}

export function installCombatNightProjectileBridge(): void {
  const prototype = PowView.prototype as unknown as {
    playElementTravel?: (targetX: number, targetY: number) => Promise<void>;
    playAttackLunge?: (targetX: number, targetY: number) => Promise<void>;
    __nightProjectileBridgeInstalled?: boolean;
    __nightProjectileAttackOwnerInstalled?: boolean;
  };

  prototype.playElementTravel = async function (this: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
    await playNightProjectile(this, targetX, targetY);
  };

  prototype.playAttackLunge = async function (this: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
    const startX = this.container.x;
    const startY = this.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const attackX = startX + (dx / distance) * 34;
    const attackY = startY + (dy / distance) * 34;

    if (typeof this.playCastSignature === 'function') await this.playCastSignature(false);

    const lunge = typeof this.tweenPromise === 'function'
      ? this.tweenPromise({ targets: this.container, x: attackX, y: attackY, duration: this.reducedMotion ? 80 : 140, ease: 'Quad.easeOut', yoyo: true })
      : Promise.resolve();

    try {
      await Promise.all([playNightProjectile(this, targetX, targetY), lunge]);
    } finally {
      this.container.setPosition(startX, startY);
    }
  };

  prototype.__nightProjectileBridgeInstalled = true;
  prototype.__nightProjectileAttackOwnerInstalled = true;

  const root = globalThis as any;
  root.POWDER_COMBAT2_NIGHT_PROJECTILE = {
    version: `combat2-${COMBAT2168_KNIGHT_VERSION}`,
    runtimeEntryPoint: 'PowView.playAttackLunge',
    directTravelOwner: true,
    attackLungeOwner: true,
    roleForwarding: true,
    elementForwarding: true,
    sourceToTarget: true,
    marksmanDirectRuntime: true,
    marksmanDirectVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
    marksmanTierContext: true,
    marksmanForms: { normal: 'compact-spiral-rail', skill: 'piercing-triple-rail-shot', ultimate: 'rail-breaker-heavy-slug' },
    mageDirectRuntime: true,
    mageDirectVersion: COMBAT2165_MAGE_VERSION,
    mageTierContext: true,
    mageForms: { normal: 'arcane-orb', skill: 'twin-orbit-orb', ultimate: 'arcane-comet' },
    tankDirectRuntime: true,
    tankDirectVersion: COMBAT2166_TANK_VERSION,
    tankTierContext: true,
    tankForms: { normal: 'guard-plate-ram', skill: 'tri-plate-bulwark-charge', ultimate: 'fortress-breaker-ram' },
    fighterDirectRuntime: true,
    fighterDirectVersion: COMBAT2167_FIGHTER_VERSION,
    fighterTierContext: true,
    fighterForms: { normal: 'impact-fist', skill: 'cross-break-rush', ultimate: 'meteor-breaker-drive' },
    knightDirectRuntime: true,
    knightDirectVersion: COMBAT2168_KNIGHT_VERSION,
    knightTierContext: true,
    knightForms: { normal: 'valor-blade-thrust', skill: 'crossguard-double-cleave', ultimate: 'royal-judgment-greatblade' },
    otherRolesCompatibilityOwnerStack: true,
    combatLogicChanged: false
  };
}

installCombatNightProjectileBridge();
