import Phaser from 'phaser';
import { PowView } from '../views/PowView';
import {
  resolveCombat2172MeleeRole,
  type Combat2172MeleeRole
} from './Combat2172ProfessionImpactFeedback';
import { playCombat2166TankDistinctTierVfx } from './Combat2166TankDistinctTierVfx';
import {
  playCombat2167FighterDistinctTierVfx,
  type Combat2167FighterTier
} from './Combat2167FighterDistinctTierVfx';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import type { Combat2163MarksmanTier } from './Combat2163MarksmanDistinctTierVfx';

export const COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION = '2.18.10';

const PATCH_FLAG = '__combat21810AllMeleeLocalHopInstalled';
type Tier = Combat2163MarksmanTier;
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

type RuntimeView = {
  scene: Phaser.Scene;
  pow?: { role?: string; elementKey?: string; element?: string };
  container: Phaser.GameObjects.Container;
  reducedMotion?: boolean;
  playElementTravel?: (targetX: number, targetY: number) => Promise<void>;
  tweenPromise?: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Promise<void>;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition?: () => Phaser.Math.Vector2;
  __combat2MarksmanAttackTier?: Tier;
};

type QaRow = { key: string; view: any };

function normalize(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function validTier(value: unknown): value is Tier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function resolveTier(view: RuntimeView): Tier {
  if (validTier(view.__combat2MarksmanAttackTier)) return view.__combat2MarksmanAttackTier;
  const globalTier = (globalThis as any).POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER;
  return validTier(globalTier) ? globalTier : 'normal';
}

function localHopMotion(
  role: Combat2172MeleeRole,
  tier: Tier,
  reducedMotion: boolean
): { height: number; duration: number } {
  if (reducedMotion) {
    const height = role === 'tank' ? 6 : role === 'fighter' ? 8 : role === 'knight' ? 7 : 8;
    return { height, duration: 62 };
  }

  const height = role === 'tank'
    ? (tier === 'ultimate' ? 16 : tier === 'skill' ? 13 : 10)
    : role === 'fighter'
      ? (tier === 'ultimate' ? 21 : tier === 'skill' ? 17 : 13)
      : role === 'knight'
        ? (tier === 'ultimate' ? 20 : tier === 'skill' ? 16 : 13)
        : (tier === 'ultimate' ? 22 : tier === 'skill' ? 18 : 14);

  return {
    height,
    duration: tier === 'ultimate' ? 120 : tier === 'skill' ? 108 : 96
  };
}

function updateMeleeWitness(role: Combat2172MeleeRole): void {
  const root = globalThis as any;
  const key = `POWDER_COMBAT2_${role.toUpperCase()}_MELEE_LAST`;
  if (root[key] && typeof root[key] === 'object') {
    root[key] = {
      ...root[key],
      contactOnly: false,
      targetLocalImpact: true,
      actorMotion: 'local-hop',
      projectileTravel: false,
      motionVersion: COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION
    };
  }
}

function installRealCombatLocalHop(): void {
  const proto = PowView.prototype as any;
  if (proto[PATCH_FLAG] === COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION) return;

  const previousAttack = proto.playAttackLunge;
  if (typeof previousAttack !== 'function') return;

  proto.playAttackLunge = async function combat21810AllMeleeLocalHop(
    this: RuntimeView,
    targetX: number,
    targetY: number
  ): Promise<void> {
    const role = resolveCombat2172MeleeRole(this.pow?.role);
    if (!role || typeof this.playElementTravel !== 'function') {
      await previousAttack.call(this, targetX, targetY);
      return;
    }

    const startX = this.container.x;
    const startY = this.container.y;
    const tier = resolveTier(this);
    const hop = localHopMotion(role, tier, Boolean(this.reducedMotion));
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
      await Promise.all([
        this.playElementTravel(targetX, targetY),
        hopTween
      ]);
      updateMeleeWitness(role);
    } finally {
      this.container.setPosition(startX, startY);
    }
  };

  proto[PATCH_FLAG] = COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION;
}

function resolveElement(pow: any): CombatProjectileElement {
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

function pointOf(view: any): Phaser.Math.Vector2 {
  try {
    if (typeof view?.getVfxAnchor === 'function') return view.getVfxAnchor('body');
    if (typeof view?.getWorldPosition === 'function') return view.getWorldPosition();
  } catch { /* QA fallback below */ }
  return new Phaser.Math.Vector2(Number(view?.container?.x ?? 0), Number(view?.container?.y ?? 0));
}

function sideOf(key: string, view: any): 'player' | 'enemy' | null {
  if (view?.side === 'player' || view?.side === 'enemy') return view.side;
  const value = normalize(key);
  if (value.includes('player')) return 'player';
  if (value.includes('enemy')) return 'enemy';
  return null;
}

function pickVisible(scene: any, side: 'player' | 'enemy'): QaRow | null {
  if (!(scene?.powViews instanceof Map)) return null;
  const rows = Array.from(scene.powViews.entries() as IterableIterator<[string, any]>)
    .filter(([key, view]) => {
      if (sideOf(key, view) !== side) return false;
      const container = view?.container;
      return Boolean(container?.visible) && Number(container?.alpha ?? 0) > 0.3;
    })
    .sort((a, b) => Number(b[1]?.container?.scaleX ?? 0) - Number(a[1]?.container?.scaleX ?? 0));
  return rows[0] ? { key: rows[0][0], view: rows[0][1] } : null;
}

function tweenQa(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = () => {
      try { tween?.stop(); } catch { /* cleanup only */ }
      finish();
    };
    timer = setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      tween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

function qaForm(role: 'tank' | 'fighter', tier: Tier): string {
  if (role === 'tank') {
    if (tier === 'ultimate') return 'fortress-breaker-contact';
    if (tier === 'skill') return 'bulwark-slam-contact';
    return 'shield-bash-contact';
  }
  if (tier === 'ultimate') return 'meteor-fist-finisher-contact';
  if (tier === 'skill') return 'rising-breaker-punch-contact';
  return 'heavy-straight-punch-contact';
}

async function playTankFighterQaLocalHop(
  role: 'tank' | 'fighter',
  tier: Tier,
  requestedElement?: CombatProjectileElement | null
): Promise<any> {
  const root = globalThis as any;
  const scene = root.POWDER_COMBAT2_ACTIVE_BATTLE_SCENE as any;
  if (!scene?.sys?.isActive?.()) return null;

  const sourceRow = pickVisible(scene, 'player');
  const targetRow = pickVisible(scene, 'enemy');
  if (!sourceRow || !targetRow) return null;

  const source = pointOf(sourceRow.view);
  const target = pointOf(targetRow.view);
  const element = requestedElement ?? resolveElement(sourceRow.view?.pow);
  const options: RoleAwareOptions = {
    scene,
    source,
    target,
    element,
    reducedMotion: false,
    role
  };
  const container = sourceRow.view?.container as Phaser.GameObjects.Container | undefined;

  if (!container) return null;
  const startX = container.x;
  const startY = container.y;
  const hop = localHopMotion(role, tier, false);
  const renderer = role === 'tank'
    ? playCombat2166TankDistinctTierVfx(options, tier)
    : playCombat2167FighterDistinctTierVfx(options, tier as Combat2167FighterTier);

  try {
    await Promise.all([
      renderer,
      tweenQa(scene, container, {
        y: startY - hop.height,
        duration: hop.duration,
        ease: 'Quad.easeOut',
        yoyo: true
      }, hop.duration * 2 + 220)
    ]);
  } finally {
    container.setPosition(startX, startY);
  }

  const result = {
    ok: true,
    role,
    tier,
    element,
    source: sourceRow.key,
    target: targetRow.key,
    directProfessionRuntime: true,
    directVersion: COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION,
    form: qaForm(role, tier),
    runtimeDirectQa: true,
    dedicatedOwner: true,
    targetLocalImpact: true,
    projectileTravel: false,
    dedicatedActorMotionQa: true,
    actorMotion: 'local-hop',
    meleeCastSignature: false,
    damageApplied: false,
    turnAdvanced: false
  };
  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
  root.POWDER_COMBAT2_PROFESSION_RUNTIME_TEST_LAST = result;
  return result;
}

function installQaLocalHop(): void {
  const root = globalThis as any;
  const api = root.POWDER_COMBAT2_PROFESSION_RUNTIME_TEST;
  if (!api || typeof api.playProfessionTier !== 'function') return;
  if (api.__allMeleeLocalHop21810) return;

  const previousPlay = api.playProfessionTier.bind(api);
  api.playProfessionTier = async (
    requestedRole?: string | null,
    requestedTier?: string | null,
    requestedElement?: CombatProjectileElement | null
  ) => {
    if ((requestedRole === 'tank' || requestedRole === 'fighter') && validTier(requestedTier)) {
      const result = await playTankFighterQaLocalHop(requestedRole, requestedTier, requestedElement);
      if (result) return result;
    }
    return previousPlay(requestedRole, requestedTier, requestedElement);
  };

  api.__allMeleeLocalHop21810 = true;
  api.version = COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION;
  api.meleeQaUsesActorMotion = true;
  api.meleeQaUsesLocalHop = true;
  api.meleeQaRolesUseLocalHop = ['tank', 'fighter', 'knight', 'assassin'];
  api.meleeQaUsesActorApproach = false;
}

function normalizeRuntimeMetadata(): void {
  const root = globalThis as any;
  const runtime = root.POWDER_COMBAT2_NIGHT_PROJECTILE;
  if (runtime && typeof runtime === 'object') {
    runtime.motionPatchVersion = COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION;
    runtime.tankActorMotion = 'local-hop';
    runtime.fighterActorMotion = 'local-hop';
    runtime.knightActorMotion = 'local-hop';
    runtime.assassinActorMotion = 'local-hop';
    runtime.meleeRolesUseActorApproach = [];
    runtime.meleeRolesUseLocalHop = ['tank', 'fighter', 'knight', 'assassin'];
    runtime.meleeProjectileTravelDisabled = true;
    runtime.meleeCastSignatureDisabled = true;
  }

  root.POWDER_COMBAT2_ALL_MELEE_LOCAL_HOP = {
    version: COMBAT21810_ALL_MELEE_LOCAL_HOP_VERSION,
    roles: ['tank', 'fighter', 'knight', 'assassin'],
    actorMotion: 'local-hop',
    targetApproach: false,
    targetLocalImpact: true,
    projectileTravel: false,
    castSignature: false,
    damageResolverChanged: false,
    turnFlowChanged: false,
    combatLogicChanged: false
  };
}

export function installCombat21810AllMeleeLocalHopPatch(): void {
  installRealCombatLocalHop();
  installQaLocalHop();
  normalizeRuntimeMetadata();
}

installCombat21810AllMeleeLocalHopPatch();
