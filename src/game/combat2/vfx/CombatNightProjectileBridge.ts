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
  COMBAT2173_PROFESSION_RUNTIME_VERSION
} from './Combat2164MarksmanRuntimeTierBridge';
import {
  COMBAT2165_MAGE_VERSION,
  isCombat2165MageRole,
  playCombat2165MageDistinctTierVfx,
  type Combat2165MageTier
} from './Combat2165MageDistinctTierVfx';
import {
  COMBAT2166_TANK_VERSION,
  playCombat2166TankDistinctTierVfx
} from './Combat2166TankDistinctTierVfx';
import {
  COMBAT2167_FIGHTER_VERSION,
  playCombat2167FighterDistinctTierVfx,
  type Combat2167FighterTier
} from './Combat2167FighterDistinctTierVfx';
import {
  COMBAT2168_KNIGHT_VERSION,
  playCombat2168KnightDistinctTierVfx,
  type Combat2168KnightTier
} from './Combat2168KnightDistinctTierVfx';
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
  COMBAT2180_ASSASSIN_VERSION,
  playCombat2180AssassinDistinctTierVfx,
  type Combat2180AssassinTier
} from './Combat2180AssassinDistinctTierVfx';
import {
  COMBAT2183_MUSICIAN_VERSION,
  isCombat2183MusicianRole,
  playCombat2183MusicianDistinctTierVfx,
  type Combat2183MusicianTier
} from './Combat2183MusicianDistinctTierVfx';
import {
  COMBAT2173_PROFESSION_IMPACT_VERSION,
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

function meleeIdentity(role: Combat2172MeleeRole): string {
  if (role === 'tank') return 'shield-bash-contact';
  if (role === 'fighter') return 'heavy-punch-contact';
  if (role === 'knight') return 'heavy-sword-contact';
  return 'double-critical-style-slash';
}

function recordMeleeImpact(
  view: PowViewProjectileRuntime,
  role: Combat2172MeleeRole,
  tier: Combat2163MarksmanTier,
  options: RoleAwareProjectileOptions
): void {
  const root = globalThis as any;
  const version = role === 'tank'
    ? COMBAT2166_TANK_VERSION
    : role === 'fighter'
      ? COMBAT2167_FIGHTER_VERSION
      : role === 'knight'
        ? COMBAT2168_KNIGHT_VERSION
        : COMBAT2180_ASSASSIN_VERSION;
  root[`POWDER_COMBAT2_${role.toUpperCase()}_MELEE_LAST`] = {
    version,
    impactVersion: COMBAT2173_PROFESSION_IMPACT_VERSION,
    tier,
    role: view.pow.role,
    element: options.element,
    at: Date.now(),
    realCombatRoute: true,
    projectileTravel: false,
    contactOnly: true,
    identity: meleeIdentity(role),
    visualHits: role === 'assassin' ? 2 : 1,
    guaranteedCritChanged: false
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
      impactVersion: COMBAT2173_PROFESSION_IMPACT_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true,
      ultimateImpactShake: tier === 'ultimate'
    };
    return;
  }

  if (meleeRole === 'tank') {
    await playCombat2166TankDistinctTierVfx(options, tier);
    recordMeleeImpact(view, 'tank', tier, options);
    return;
  }

  if (meleeRole === 'fighter') {
    await playCombat2167FighterDistinctTierVfx(options, tier as Combat2167FighterTier);
    recordMeleeImpact(view, 'fighter', tier, options);
    return;
  }

  if (meleeRole === 'knight') {
    await playCombat2168KnightDistinctTierVfx(options, tier as Combat2168KnightTier);
    recordMeleeImpact(view, 'knight', tier, options);
    return;
  }

  if (meleeRole === 'assassin') {
    await playCombat2180AssassinDistinctTierVfx(options, tier as Combat2180AssassinTier);
    recordMeleeImpact(view, 'assassin', tier, options);
    return;
  }

  if (isCombat2169EnchanterRole(view.pow.role) || roleKey.includes('thuat su')) {
    await playCombat2169EnchanterDistinctTierVfx(options, tier as Combat2169EnchanterTier);
    (globalThis as any).POWDER_COMBAT2_ENCHANTER_PROJECTILE_LAST = {
      version: COMBAT2169_ENCHANTER_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true,
      canonicalRoleAlias: roleKey.includes('thuat su'),
      ownImpact: true,
      ultimateImpactShake: tier === 'ultimate'
    };
    return;
  }

  if (isCombat2170HealerRole(view.pow.role)) {
    await playCombat2170HealerDistinctTierVfx(options, tier as Combat2170HealerTier);
    (globalThis as any).POWDER_COMBAT2_HEALER_PROJECTILE_LAST = {
      version: COMBAT2170_HEALER_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true,
      ownImpact: true,
      ultimateImpactShake: tier === 'ultimate'
    };
    return;
  }

  if (isCombat2183MusicianRole(view.pow.role)) {
    await playCombat2183MusicianDistinctTierVfx(options, tier as Combat2183MusicianTier);
    (globalThis as any).POWDER_COMBAT2_MUSICIAN_PROJECTILE_LAST = {
      version: COMBAT2183_MUSICIAN_VERSION,
      tier,
      role: view.pow.role,
      element: options.element,
      at: Date.now(),
      realCombatRoute: true,
      ownImpact: true,
      ultimateImpactShake: tier === 'ultimate'
    };
    return;
  }

  const roleAwarePlay = DirectionalElementProjectileVfx.play as unknown as (runtimeOptions: RoleAwareProjectileOptions) => Promise<void>;
  await roleAwarePlay(options);
}

function meleeContactGap(role: Combat2172MeleeRole): number {
  if (role === 'tank') return 210;
  if (role === 'fighter') return 168;
  if (role === 'knight') return 178;
  return 145;
}

function meleeApproach(distance: number, role: Combat2172MeleeRole): number {
  if (distance <= 1) return 0;
  const contactGap = meleeContactGap(role);
  const gapLimited = Math.max(0, distance - contactGap);
  const proportional = distance * (role === 'assassin' ? 0.84 : role === 'fighter' ? 0.79 : role === 'knight' ? 0.77 : 0.72);
  const advance = Math.min(gapLimited, proportional);
  return advance >= 32 ? advance : distance * (role === 'assassin' ? 0.54 : role === 'fighter' ? 0.46 : role === 'knight' ? 0.44 : 0.4);
}

function meleeDashMs(role: Combat2172MeleeRole, tier: Combat2163MarksmanTier, reducedMotion: boolean): number {
  if (role === 'tank') {
    if (reducedMotion) return tier === 'ultimate' ? 115 : 90;
    if (tier === 'ultimate') return 215;
    if (tier === 'skill') return 175;
    return 140;
  }
  if (role === 'fighter') {
    if (reducedMotion) return tier === 'ultimate' ? 110 : 84;
    if (tier === 'ultimate') return 205;
    if (tier === 'skill') return 168;
    return 132;
  }
  if (role === 'knight') {
    if (reducedMotion) return tier === 'ultimate' ? 108 : 84;
    if (tier === 'ultimate') return 202;
    if (tier === 'skill') return 164;
    return 130;
  }
  if (reducedMotion) return tier === 'ultimate' ? 78 : 58;
  if (tier === 'ultimate') return 128;
  if (tier === 'skill') return 104;
  return 84;
}

function meleeReturnMs(role: Combat2172MeleeRole, tier: Combat2163MarksmanTier, reducedMotion: boolean): number {
  if (reducedMotion) return role === 'assassin' ? 58 : 80;
  if (role === 'assassin') return tier === 'ultimate' ? 92 : tier === 'skill' ? 78 : 72;
  if (role === 'fighter') return tier === 'ultimate' ? 170 : tier === 'skill' ? 132 : 118;
  if (role === 'knight') return tier === 'ultimate' ? 160 : tier === 'skill' ? 126 : 116;
  return tier === 'ultimate' ? 155 : 120;
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
    const tier = resolveActionTier(this);
    const meleeRole = resolveCombat2172MeleeRole(this.pow.role);

    if (meleeRole) {
      const advance = meleeApproach(distance, meleeRole);
      const attackX = startX + (dx / distance) * advance;
      const attackY = startY + (dy / distance) * advance;
      const dashMs = meleeDashMs(meleeRole, tier, this.reducedMotion);
      try {
        if (typeof this.tweenPromise === 'function') {
          await this.tweenPromise({
            targets: this.container,
            x: attackX,
            y: attackY,
            duration: dashMs,
            ease: meleeRole === 'assassin'
              ? 'Cubic.easeOut'
              : tier === 'ultimate'
                ? 'Cubic.easeIn'
                : 'Quad.easeOut'
          });
        }
        await playNightProjectile(this, targetX, targetY);
        if (typeof this.tweenPromise === 'function') {
          await this.tweenPromise({
            targets: this.container,
            x: startX,
            y: startY,
            duration: meleeReturnMs(meleeRole, tier, this.reducedMotion),
            ease: meleeRole === 'assassin' ? 'Cubic.easeOut' : 'Quad.easeOut'
          });
        }
      } finally {
        this.container.setPosition(startX, startY);
      }
      return;
    }

    if (typeof this.playCastSignature === 'function') await this.playCastSignature(false);

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
    version: COMBAT2173_PROFESSION_RUNTIME_VERSION,
    runtimeEntryPoint: 'PowView.playAttackLunge',
    directTravelOwner: true,
    attackLungeOwner: true,
    roleForwarding: true,
    elementForwarding: true,
    sourceToTarget: true,
    professionTierRuntimeVersion: COMBAT2173_PROFESSION_RUNTIME_VERSION,
    impactFeedbackVersion: COMBAT2173_PROFESSION_IMPACT_VERSION,
    marksmanDirectRuntime: true,
    marksmanDirectVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
    marksmanTierContext: true,
    marksmanForms: { normal: 'compact-spiral-rail', skill: 'piercing-triple-rail-shot', ultimate: 'rail-breaker-heavy-slug' },
    mageDirectRuntime: true,
    mageDirectVersion: COMBAT2165_MAGE_VERSION,
    mageTierContext: true,
    mageForms: { normal: 'arcane-bolt', skill: 'twin-rune-lance', ultimate: 'astral-comet' },
    tankDirectRuntime: true,
    tankDirectVersion: COMBAT2166_TANK_VERSION,
    tankProjectileTravel: false,
    tankCastSignature: false,
    tankGenericRenderer: false,
    tankForms: { normal: 'shield-bash-contact', skill: 'bulwark-slam-contact', ultimate: 'fortress-breaker-contact' },
    fighterDirectRuntime: true,
    fighterDirectVersion: COMBAT2167_FIGHTER_VERSION,
    fighterProjectileTravel: false,
    fighterCastSignature: false,
    fighterGenericRenderer: false,
    fighterForms: { normal: 'heavy-straight-punch-contact', skill: 'rising-breaker-punch-contact', ultimate: 'meteor-fist-finisher-contact' },
    knightDirectRuntime: true,
    knightDirectVersion: COMBAT2168_KNIGHT_VERSION,
    knightProjectileTravel: false,
    knightCastSignature: false,
    knightGenericRenderer: false,
    knightForms: { normal: 'heavy-cut-contact', skill: 'guard-break-cleave-contact', ultimate: 'royal-judgment-slash-contact' },
    assassinDirectRuntime: true,
    assassinDirectVersion: COMBAT2180_ASSASSIN_VERSION,
    assassinProjectileTravel: false,
    assassinCastSignature: false,
    assassinGenericRenderer: false,
    assassinForms: { normal: 'two-quick-contact-cuts', skill: 'two-shadow-afterimage-cuts', ultimate: 'two-execution-critical-style-cuts' },
    assassinVisualHits: 2,
    assassinGuaranteedCritChanged: false,
    enchanterDirectRuntime: true,
    enchanterDirectVersion: COMBAT2169_ENCHANTER_VERSION,
    enchanterCanonicalRoleAliases: ['thuat si', 'thuat su', 'enchanter', 'warlock'],
    enchanterForms: { normal: 'hex-needle', skill: 'binding-sigil-chain', ultimate: 'abyssal-grand-seal' },
    healerDirectRuntime: true,
    healerDirectVersion: COMBAT2170_HEALER_VERSION,
    healerForms: { normal: 'mend-spark', skill: 'restoration-stream', ultimate: 'sanctuary-crown' },
    musicianDirectRuntime: true,
    musicianDirectVersion: COMBAT2183_MUSICIAN_VERSION,
    musicianForms: { normal: 'pulse-note', skill: 'chord-wave', ultimate: 'symphony-crescendo' },
    meleeRolesUseActorApproach: ['tank', 'fighter', 'knight', 'assassin'],
    meleeCastSignatureDisabled: true,
    meleeProjectileTravelDisabled: true,
    allDedicatedOwners: true,
    combatLogicChanged: false
  };
}

installCombatNightProjectileBridge();
