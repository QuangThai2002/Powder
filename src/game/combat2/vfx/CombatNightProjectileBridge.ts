import Phaser from 'phaser';
import {
  resolveCombat2172MeleeRole,
  type Combat2172MeleeRole
} from './Combat2172ProfessionImpactFeedback';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import {
  COMBAT2201_HIGH_FANTASY_VFX_VERSION,
  playCombat2201ActionVfx,
  type Combat2201ActionTier
} from './Combat2201HighFantasyAnimeVfx';
import { playCombat2180AssassinDistinctTierVfx } from './Combat2180AssassinDistinctTierVfx';
import type { Combat2104ActionSignature } from '../views/Combat2104PowSkillSignaturePatch';
import { PowView } from '../views/PowView';

const FINAL_ATTACK_OWNER_FLAG = '__powderCombat2FinalAttackOwner';

interface PowViewProjectileRuntime {
  scene: Phaser.Scene;
  pow: { elementKey?: string; element?: string; role?: string };
  reducedMotion: boolean;
  container: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition: () => Phaser.Math.Vector2;
  tweenPromise?: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Promise<void>;
  __combat2MarksmanAttackTier?: Combat2201ActionTier;
  __combat2104ActionSignature?: Combat2104ActionSignature;
}

type RoleAwareProjectileOptions = DirectionalProjectileOptions & {
  role?: string;
  signature?: Combat2104ActionSignature;
};

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
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

function validTier(value: unknown): value is Combat2201ActionTier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function resolveActionTier(view: PowViewProjectileRuntime): Combat2201ActionTier {
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
    role: view.pow.role,
    signature: view.__combat2104ActionSignature
  };
}

function meleeIdentity(role: Combat2172MeleeRole): string {
  if (role === 'tank') return 'shield-bash-contact';
  if (role === 'fighter') return 'heavy-punch-contact';
  if (role === 'knight') return 'heavy-sword-target-slash';
  return 'double-critical-style-target-slash';
}

function recordMeleeImpact(
  view: PowViewProjectileRuntime,
  role: Combat2172MeleeRole,
  tier: Combat2201ActionTier,
  options: RoleAwareProjectileOptions
): void {
  const root = globalThis as any;
  root[`POWDER_COMBAT2_${role.toUpperCase()}_MELEE_LAST`] = {
    version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    impactVersion: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    tier,
    role: view.pow.role,
    element: options.element,
    at: Date.now(),
    realCombatRoute: true,
    projectileTravel: false,
    sourceCue: true,
    targetLocalImpact: true,
    actorMotion: 'local-hop',
    contactAccentVersion: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    identity: meleeIdentity(role),
    visualHits: role === 'assassin' ? 2 : 1,
    guaranteedCritChanged: false
  };
}

async function playNightProjectile(view: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
  const options = makeOptions(view, targetX, targetY);
  const tier = resolveActionTier(view);
  const meleeRole = resolveCombat2172MeleeRole(view.pow.role);
  if (meleeRole === 'assassin') await playCombat2180AssassinDistinctTierVfx(options, tier);
  else await playCombat2201ActionVfx(options, tier);
  if (meleeRole) recordMeleeImpact(view, meleeRole, tier, options);
  (globalThis as any).POWDER_COMBAT2_HIGH_FANTASY_LAST_ACTION = {
    version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    tier,
    role: view.pow.role,
    element: options.element,
    source: { x: options.source.x, y: options.source.y },
    target: { x: options.target.x, y: options.target.y },
    realCombatRoute: true,
    combatLogicChanged: false
  };
}

function localMeleeHop(
  role: Combat2172MeleeRole,
  tier: Combat2201ActionTier,
  reducedMotion: boolean
): { height: number; duration: number } {
  if (reducedMotion) {
    if (role === 'tank') return { height: 6, duration: 70 };
    if (role === 'fighter') return { height: 8, duration: 66 };
    return { height: role === 'assassin' ? 8 : 7, duration: 62 };
  }
  if (role === 'tank') {
    if (tier === 'ultimate') return { height: 18, duration: 136 };
    if (tier === 'skill') return { height: 14, duration: 116 };
    return { height: 10, duration: 102 };
  }
  if (role === 'fighter') {
    if (tier === 'ultimate') return { height: 25, duration: 122 };
    if (tier === 'skill') return { height: 20, duration: 110 };
    return { height: 15, duration: 98 };
  }
  const height = tier === 'ultimate'
    ? (role === 'assassin' ? 22 : 20)
    : tier === 'skill'
      ? (role === 'assassin' ? 18 : 16)
      : (role === 'assassin' ? 14 : 13);
  return { height, duration: tier === 'ultimate' ? 120 : tier === 'skill' ? 108 : 96 };
}

export function installCombatNightProjectileBridge(): void {
  const prototype = PowView.prototype as unknown as {
    playElementTravel?: (targetX: number, targetY: number) => Promise<void>;
    playAttackLunge?: ((targetX: number, targetY: number) => Promise<void>) & { [FINAL_ATTACK_OWNER_FLAG]?: boolean };
    __nightProjectileBridgeInstalled?: boolean;
    __nightProjectileAttackOwnerInstalled?: boolean;
  };

  prototype.playElementTravel = async function (this: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
    await playNightProjectile(this, targetX, targetY);
  };

  const finalAttackLunge = async function (this: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
    const startX = this.container.x;
    const startY = this.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const tier = resolveActionTier(this);
    const meleeRole = resolveCombat2172MeleeRole(this.pow.role);

    if (meleeRole) {
      const hop = localMeleeHop(meleeRole, tier, this.reducedMotion);
      const hopTween = typeof this.tweenPromise === 'function'
        ? this.tweenPromise({
          targets: this.container,
          y: startY - hop.height,
          duration: hop.duration,
          ease: 'Quad.easeOut',
          yoyo: true
        })
        : Promise.resolve();

      try {
        // All melee stays at its own slot; the dedicated role VFX owns target contact.
        await Promise.all([
          playNightProjectile(this, targetX, targetY),
          hopTween
        ]);
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
  Object.defineProperty(finalAttackLunge, FINAL_ATTACK_OWNER_FLAG, { value: true });
  prototype.playAttackLunge = finalAttackLunge;

  prototype.__nightProjectileBridgeInstalled = true;
  prototype.__nightProjectileAttackOwnerInstalled = true;

  const root = globalThis as any;
  root.POWDER_COMBAT2_NIGHT_PROJECTILE = {
    version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    runtimeEntryPoint: 'PowView.playAttackLunge',
    directTravelOwner: true,
    attackLungeOwner: true,
    finalAttackOwnerGuard: true,
    roleForwarding: true,
    elementForwarding: true,
    sourceToTarget: true,
    renderer: 'Combat2201HighFantasyAnimeVfx',
    forms: {
      marksman: 'anime-arrow-trail', mage: 'anime-elemental-nucleus', enchanter: 'anime-hex-nucleus',
      healer: 'anime-restoration-ribbon', musician: 'anime-chord-note', tank: 'anime-shield-bash-contact',
      fighter: 'anime-fist-impact-contact', knight: 'anime-heavy-slash-contact', assassin: 'anime-dual-critical-slash-contact'
    },
    assassinVisualHits: 2,
    assassinGuaranteedCritChanged: false,
    meleeRolesUseActorApproach: [],
    meleeRolesUseLocalHop: ['tank', 'fighter', 'knight', 'assassin'],
    meleeActorApproachDisabled: true,
    meleeCastSignatureDisabled: true,
    meleeProjectileTravelDisabled: true,
    meleeSourceCommitCue: true,
    meleeCommitCueVersion: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    meleeContactAccent: true,
    meleeContactAccentVersion: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    allDedicatedOwners: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_ACTION_FX = {
    version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    mode: 'high-fantasy-anime-source-target-impact',
    owner: 'Combat2201HighFantasyAnimeVfx',
    runtimeEntryPoint: 'PowView.playAttackLunge',
    sourceToTarget: true,
    meleeSourceCommitCue: true,
    meleeCommitCueVersion: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    meleeContactAccent: true,
    meleeContactAccentVersion: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    allDedicatedOwners: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_POW_SIGNATURE = {
    version: COMBAT2201_HIGH_FANTASY_VFX_VERSION,
    mode: 'layered-magic-circle-plus-dedicated-profession-action',
    owner: 'Combat2201HighFantasyAnimeVfx + CombatNightProjectileBridge',
    sourceVisibleBeforeTravel: true,
    combatLogicChanged: false
  };
}

installCombatNightProjectileBridge();
