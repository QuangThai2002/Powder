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
import {
  COMBAT2164_MARKSMAN_RUNTIME_VERSION,
  COMBAT2172_PROFESSION_RUNTIME_VERSION
} from './Combat2164MarksmanRuntimeTierBridge';
import {
  COMBAT2165_MAGE_VERSION,
  isCombat2165MageRole,
  playCombat2165MageDistinctTierVfx,
  type Combat2165MageTier
} from './Combat2165MageDistinctTierVfx';
import { COMBAT2166_TANK_VERSION } from './Combat2166TankDistinctTierVfx';
import { COMBAT2167_FIGHTER_VERSION } from './Combat2167FighterDistinctTierVfx';
import { COMBAT2168_KNIGHT_VERSION } from './Combat2168KnightDistinctTierVfx';
import {
  COMBAT2169_ENCHANTER_VERSION,
  isCombat2169EnchanterRole,
  playCombat2169EnchanterDistinctTierVfx,
  type Combat2169EnchanterTier
} from './Combat2169EnchanterDistinctTierVfx';
import {
  COMBAT2170_HEALER_VERSION,
  isCombat2170HealerRole,
  playCombat2170HealerDistinctTierVfx,
  type Combat2170HealerTier
} from './Combat2170HealerDistinctTierVfx';
import {
  COMBAT2172_PROFESSION_IMPACT_VERSION,
  playCombat2172MeleeProfessionImpact,
  resolveCombat2172MeleeRole,
  scheduleCombat2172RangedImpactFeedback,
  type Combat2172MeleeRole
} from './Combat2172ProfessionImpactFeedback';
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

function makeOptions(view: PowViewProjectileRuntime, targetX: number, targetY: number): RoleAwareProjectileOptions {
  const source = typeof view.getVfxAnchor === 'function' ? view.getVfxAnchor('body') : view.getWorldPosition();
  return {
    scene: view.scene,
    source,
    target: new Phaser.Math.Vector2(targetX, targetY),
    element: resolveElement(view.pow),
    reducedMotion: view.reducedMotion,
    role: view.pow.role
  };
}

function recordMeleeImpact(view: PowViewProjectileRuntime, role: Combat2172MeleeRole, tier: Combat2163MarksmanTier, options: RoleAwareProjectileOptions): void {
  const root = globalThis as any;
  const version = role === 'tank' ? COMBAT2166_TANK_VERSION : role === 'fighter' ? COMBAT2167_FIGHTER_VERSION : COMBAT2168_KNIGHT_VERSION;
  root[`POWDER_COMBAT2_${role.toUpperCase()}_MELEE_LAST`] = {
    version,
    impactVersion: COMBAT2172_PROFESSION_IMPACT_VERSION,
    tier,
    role: view.pow.role,
    element: options.element,
    at: Date.now(),
    realCombatRoute: true,
    projectileTravel: false,
    contactOnly: true
  };
}

async function playNightProjectile(view: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
  const options = makeOptions(view, targetX, targetY);
  const roleKey = normalize(view.pow.role ?? '');
  const tier = resolveActionTier(view);
  const meleeRole = resolveCombat2172MeleeRole(view.pow.role);

  if (isCombat2160MarksmanRole(view.pow.role)) {
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
    scheduleCombat2172RangedImpactFeedback(options, 'mage', tier);
    await playCombat2165MageDistinctTierVfx(options, tier as Combat2165MageTier);
    (globalThis as any).POWDER_COMBAT2_MAGE_PROJECTILE_LAST = {
      version: COMBAT2165_MAGE_VERSION,
      impactVersion: COMBAT2172_PROFESSION_IMPACT_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true,
      ultimateImpactShake: tier === 'ultimate'
    };
    return;
  }

  if (meleeRole) {
    await playCombat2172MeleeProfessionImpact(options, meleeRole, tier);
    recordMeleeImpact(view, meleeRole, tier, options);
    return;
  }

  if (isCombat2169EnchanterRole(view.pow.role) || roleKey.includes('thuat su')) {
    scheduleCombat2172RangedImpactFeedback(options, 'enchanter', tier);
    await playCombat2169EnchanterDistinctTierVfx(options, tier as Combat2169EnchanterTier);
    (globalThis as any).POWDER_COMBAT2_ENCHANTER_PROJECTILE_LAST = {
      version: COMBAT2169_ENCHANTER_VERSION,
      impactVersion: COMBAT2172_PROFESSION_IMPACT_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true,
      canonicalRoleAlias: roleKey.includes('thuat su'),
      ultimateImpactShake: tier === 'ultimate'
    };
    return;
  }

  if (isCombat2170HealerRole(view.pow.role)) {
    scheduleCombat2172RangedImpactFeedback(options, 'healer', tier);
    await playCombat2170HealerDistinctTierVfx(options, tier as Combat2170HealerTier);
    (globalThis as any).POWDER_COMBAT2_HEALER_PROJECTILE_LAST = {
      version: COMBAT2170_HEALER_VERSION,
      impactVersion: COMBAT2172_PROFESSION_IMPACT_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true,
      ultimateImpactShake: tier === 'ultimate'
    };
    return;
  }

  const roleAwarePlay = DirectionalElementProjectileVfx.play as unknown as (runtimeOptions: RoleAwareProjectileOptions) => Promise<void>;
  await roleAwarePlay(options);
}

function meleeApproach(distance: number): number {
  if (distance <= 1) return 0;
  const contactGap = 210;
  const gapLimited = Math.max(0, distance - contactGap);
  const proportional = distance * 0.72;
  const advance = Math.min(gapLimited, proportional);
  return advance >= 32 ? advance : distance * 0.4;
}

function meleeDashMs(tier: Combat2163MarksmanTier, reducedMotion: boolean): number {
  if (reducedMotion) return tier === 'ultimate' ? 115 : 90;
  if (tier === 'ultimate') return 215;
  if (tier === 'skill') return 175;
  return 140;
}

export function installCombatNightProjectileBridge(): void {
  const prototype = PowView.prototype as unknown as {
    playElementTravel?: (targetX: number, targetY: number) => Promise<void>;
    playAttackLunge?: (targetX: number, targetY: number) => Promise<void>;
    __nightProjectileBridgeInstalled?: boolean;
    __nightProjectileAttackOwnerInstalled?: boolean;
  };

  prototype.playElementTravel = async function (this: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
    // Support travel for melee roles is target-local only. No source -> target projectile is created.
    await playNightProjectile(this, targetX, targetY);
  };

  prototype.playAttackLunge = async function (this: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
    const startX = this.container.x;
    const startY = this.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const tier = resolveActionTier(this);
    const meleeRole = resolveCombat2172MeleeRole(this.pow.role);

    if (typeof this.playCastSignature === 'function') await this.playCastSignature(false);

    if (meleeRole) {
      const advance = meleeApproach(distance);
      const attackX = startX + (dx / distance) * advance;
      const attackY = startY + (dy / distance) * advance;
      const dashMs = meleeDashMs(tier, this.reducedMotion);
      try {
        if (typeof this.tweenPromise === 'function') {
          await this.tweenPromise({
            targets: this.container,
            x: attackX,
            y: attackY,
            duration: dashMs,
            ease: tier === 'ultimate' ? 'Cubic.easeIn' : 'Quad.easeOut'
          });
        }
        await playNightProjectile(this, targetX, targetY);
        if (typeof this.tweenPromise === 'function') {
          await this.tweenPromise({
            targets: this.container,
            x: startX,
            y: startY,
            duration: this.reducedMotion ? 80 : tier === 'ultimate' ? 155 : 120,
            ease: 'Quad.easeOut'
          });
        }
      } finally {
        this.container.setPosition(startX, startY);
      }
      return;
    }

    const attackX = startX + (dx / distance) * 34;
    const attackY = startY + (dy / distance) * 34;
    const lunge = typeof this.tweenPromise === 'function'
      ? this.tweenPromise({
        targets: this.container,
        x: attackX,
        y: attackY,
        duration: this.reducedMotion ? 80 : 140,
        ease: 'Quad.easeOut',
        yoyo: true
      })
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
    version: COMBAT2172_PROFESSION_RUNTIME_VERSION,
    runtimeEntryPoint: 'PowView.playAttackLunge',
    directTravelOwner: true,
    attackLungeOwner: true,
    roleForwarding: true,
    elementForwarding: true,
    sourceToTarget: true,
    professionTierRuntimeVersion: COMBAT2172_PROFESSION_RUNTIME_VERSION,
    impactFeedbackVersion: COMBAT2172_PROFESSION_IMPACT_VERSION,
    marksmanDirectRuntime: true,
    marksmanDirectVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
    marksmanUntouchedBy2172: true,
    marksmanTierContext: true,
    marksmanForms: { normal: 'compact-spiral-rail', skill: 'piercing-triple-rail-shot', ultimate: 'rail-breaker-heavy-slug' },
    mageDirectRuntime: true,
    mageDirectVersion: COMBAT2165_MAGE_VERSION,
    mageTierContext: true,
    mageForms: { normal: 'arcane-orb', skill: 'twin-orbit-orb', ultimate: 'arcane-comet' },
    tankDirectRuntime: true,
    tankDirectVersion: COMBAT2166_TANK_VERSION,
    tankTierContext: true,
    tankProjectileTravel: false,
    tankForms: { normal: 'shield-bash-contact', skill: 'bulwark-crash-contact', ultimate: 'fortress-quake-contact' },
    fighterDirectRuntime: true,
    fighterDirectVersion: COMBAT2167_FIGHTER_VERSION,
    fighterTierContext: true,
    fighterProjectileTravel: false,
    fighterForms: { normal: 'heavy-punch-contact', skill: 'cross-break-combo', ultimate: 'meteor-smash-contact' },
    knightDirectRuntime: true,
    knightDirectVersion: COMBAT2168_KNIGHT_VERSION,
    knightTierContext: true,
    knightProjectileTravel: false,
    knightForms: { normal: 'valor-slash-contact', skill: 'crossguard-cleave-contact', ultimate: 'royal-judgment-contact' },
    enchanterDirectRuntime: true,
    enchanterDirectVersion: COMBAT2169_ENCHANTER_VERSION,
    enchanterTierContext: true,
    enchanterCanonicalRoleAliases: ['thuat si', 'thuat su', 'enchanter', 'warlock'],
    enchanterForms: { normal: 'hex-needle', skill: 'binding-twin-sigil', ultimate: 'abyssal-seal-lance' },
    healerDirectRuntime: true,
    healerDirectVersion: COMBAT2170_HEALER_VERSION,
    healerTierContext: true,
    healerForms: { normal: 'life-seed', skill: 'restoration-ribbon', ultimate: 'sanctuary-heart-ray' },
    allNewProfessionUltimateImpactShake: true,
    meleeRolesUseActorApproach: ['tank', 'fighter', 'knight'],
    meleeProjectileTravelDisabled: true,
    otherRolesCompatibilityOwnerStack: true,
    combatLogicChanged: false
  };
}

installCombatNightProjectileBridge();
