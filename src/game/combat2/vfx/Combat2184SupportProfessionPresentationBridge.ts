import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';
import { PowView } from '../views/PowView';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import {
  isCombat2169EnchanterRole,
  playCombat2169EnchanterDistinctTierVfx
} from './Combat2169EnchanterDistinctTierVfx';
import {
  isCombat2170HealerRole,
  playCombat2170HealerDistinctTierVfx
} from './Combat2170HealerDistinctTierVfx';
import {
  isCombat2183MusicianRole,
  playCombat2183MusicianDistinctTierVfx
} from './Combat2183MusicianDistinctTierVfx';

export const COMBAT2184_SUPPORT_PRESENTATION_VERSION = '2.18.4';

type Tier = 'normal' | 'skill' | 'ultimate';
type SupportRole = 'enchanter' | 'healer' | 'musician';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

type RuntimePowView = {
  pow?: { elementKey?: string; element?: string; role?: string };
  reducedMotion?: boolean;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition?: () => Phaser.Math.Vector2;
};

type SupportContext = {
  role: SupportRole;
  tier: Tier;
  target: Phaser.Math.Vector2;
};

const contexts = new WeakMap<object, SupportContext>();
const BATTLE_FLAG = '__combat2184SupportPresentationInstalled';
const POW_FLAG = '__combat2184SupportStatusPulseInstalled';

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveElement(pow?: RuntimePowView['pow']): CombatProjectileElement {
  const key = normalize(`${pow?.elementKey ?? ''} ${pow?.element ?? ''}`);
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

function supportRole(role?: string): SupportRole | null {
  if (isCombat2169EnchanterRole(role)) return 'enchanter';
  if (isCombat2170HealerRole(role)) return 'healer';
  if (isCombat2183MusicianRole(role)) return 'musician';
  return null;
}

function abilityTier(slot: unknown): Tier {
  return slot === 'ultimate' ? 'ultimate' : 'skill';
}

function playSupportRenderer(
  role: SupportRole,
  options: RoleAwareOptions,
  tier: Tier
): Promise<void> {
  if (role === 'enchanter') return playCombat2169EnchanterDistinctTierVfx(options, tier);
  if (role === 'healer') return playCombat2170HealerDistinctTierVfx(options, tier);
  return playCombat2183MusicianDistinctTierVfx(options, tier);
}

function installBattleContextOwner(): void {
  const prototype = BattleScene.prototype as any;
  if (prototype[BATTLE_FLAG]) return;
  const previousAbility = prototype.performAbility;
  if (typeof previousAbility !== 'function') return;

  prototype.performAbility = async function combat2184SupportAbility(
    this: any,
    actor: any,
    target: any,
    slot: any,
    ...rest: any[]
  ): Promise<any> {
    const actorView = this?.powViews instanceof Map ? this.powViews.get(actor?.instanceId) as object | undefined : undefined;
    const targetView = this?.powViews instanceof Map ? this.powViews.get(target?.instanceId) as RuntimePowView | undefined : undefined;
    const ability = slot === 'ultimate' ? actor?.pow?.abilities?.ultimate : actor?.pow?.abilities?.skills?.[slot];
    const role = supportRole(actor?.pow?.role);
    const isSupport = String(ability?.type || '').toLowerCase() === 'support';

    if (actorView && targetView && role && isSupport) {
      const point = typeof targetView.getWorldPosition === 'function'
        ? targetView.getWorldPosition()
        : new Phaser.Math.Vector2(0, 0);
      contexts.set(actorView, {
        role,
        tier: abilityTier(slot),
        target: new Phaser.Math.Vector2(point.x, point.y)
      });
    }

    try {
      return await previousAbility.call(this, actor, target, slot, ...rest);
    } finally {
      if (actorView) contexts.delete(actorView);
    }
  };

  prototype[BATTLE_FLAG] = true;
}

function installSupportStatusPulseOwner(): void {
  const prototype = PowView.prototype as any;
  if (prototype[POW_FLAG]) return;
  const previousStatusPulse = prototype.playStatusPulse;
  if (typeof previousStatusPulse !== 'function') return;

  prototype.playStatusPulse = async function combat2184SupportStatusPulse(this: RuntimePowView, ...args: any[]): Promise<void> {
    const context = contexts.get(this as object);
    if (!context) {
      await previousStatusPulse.apply(this, args);
      return;
    }

    const source = typeof this.getVfxAnchor === 'function'
      ? this.getVfxAnchor('body')
      : typeof this.getWorldPosition === 'function'
        ? this.getWorldPosition()
        : new Phaser.Math.Vector2(context.target.x, context.target.y);

    const scene = (this as any).scene as Phaser.Scene | undefined;
    if (!scene?.sys?.isActive?.()) {
      await previousStatusPulse.apply(this, args);
      return;
    }

    const options: RoleAwareOptions = {
      scene,
      source: new Phaser.Math.Vector2(source.x, source.y),
      target: new Phaser.Math.Vector2(context.target.x, context.target.y),
      element: resolveElement(this.pow),
      reducedMotion: Boolean(this.reducedMotion),
      role: this.pow?.role
    };

    await playSupportRenderer(context.role, options, context.tier);
  };

  prototype[POW_FLAG] = true;
}

installBattleContextOwner();
installSupportStatusPulseOwner();

(globalThis as any).POWDER_COMBAT2_SUPPORT_PROFESSION_PRESENTATION = {
  version: COMBAT2184_SUPPORT_PRESENTATION_VERSION,
  roles: ['enchanter', 'healer', 'musician'],
  supportSkillUsesDedicatedOwner: true,
  supportUltimateUsesDedicatedOwner: true,
  oldGenericStatusPulseBypassedOnlyDuringSupportedAbility: true,
  damageResolverChanged: false,
  healResolverChanged: false,
  turnFlowChanged: false,
  combatLogicChanged: false
};
