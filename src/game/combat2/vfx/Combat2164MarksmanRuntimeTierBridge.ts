import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import {
  playCombat2163MarksmanDistinctTierVfx,
  type Combat2163MarksmanTier
} from './Combat2163MarksmanDistinctTierVfx';
import { playCombat2165MageDistinctTierVfx } from './Combat2165MageDistinctTierVfx';
import { playCombat2166TankDistinctTierVfx } from './Combat2166TankDistinctTierVfx';
import { playCombat2169EnchanterDistinctTierVfx } from './Combat2169EnchanterDistinctTierVfx';
import { playCombat2170HealerDistinctTierVfx } from './Combat2170HealerDistinctTierVfx';
import {
  playCombat2172MeleeProfessionImpact,
  scheduleCombat2172RangedImpactFeedback,
  type Combat2172MeleeRole
} from './Combat2172ProfessionImpactFeedback';

export const COMBAT2164_MARKSMAN_RUNTIME_VERSION = '2.16.4';
export const COMBAT2171_PROFESSION_RUNTIME_VERSION = '2.17.1';
export const COMBAT2172_PROFESSION_RUNTIME_VERSION = '2.17.2';
export const COMBAT2177_PROFESSION_RUNTIME_VERSION = '2.17.7';
export const COMBAT2173_PROFESSION_RUNTIME_VERSION = COMBAT2177_PROFESSION_RUNTIME_VERSION;

type RuntimeProfessionRole = 'marksman' | 'mage' | 'tank' | 'fighter' | 'knight' | 'assassin' | 'enchanter' | 'healer';

type RuntimePowView = {
  side?: 'player' | 'enemy';
  pow?: { elementKey?: string; element?: string; role?: string };
  container?: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition?: () => Phaser.Math.Vector2;
  __combat2MarksmanAttackTier?: Combat2163MarksmanTier;
};

type RuntimeScene = Phaser.Scene & { powViews?: Map<string, RuntimePowView> };
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

const TEST_ROLES: readonly RuntimeProfessionRole[] = Object.freeze([
  'marksman', 'mage', 'tank', 'fighter', 'knight', 'assassin', 'enchanter', 'healer'
]);

const PROFESSION_FORMS: Readonly<Record<RuntimeProfessionRole, Readonly<Record<Combat2163MarksmanTier, string>>>> = Object.freeze({
  marksman: Object.freeze({ normal: 'compact-spiral-rail', skill: 'piercing-triple-rail-shot', ultimate: 'rail-breaker-heavy-slug' }),
  mage: Object.freeze({ normal: 'arcane-bolt', skill: 'twin-rune-lance', ultimate: 'astral-comet' }),
  tank: Object.freeze({ normal: 'shield-bash-contact', skill: 'bulwark-slam-contact', ultimate: 'fortress-breaker-contact' }),
  fighter: Object.freeze({ normal: 'single-heavy-punch', skill: 'single-heavy-punch-break', ultimate: 'single-heavy-punch-finisher' }),
  knight: Object.freeze({ normal: 'single-heavy-slash', skill: 'single-heavy-slash-cleave', ultimate: 'single-heavy-slash-judgment' }),
  assassin: Object.freeze({ normal: 'double-critical-slash', skill: 'double-critical-slash-rush', ultimate: 'double-critical-execution' }),
  enchanter: Object.freeze({ normal: 'hex-needle', skill: 'binding-twin-sigil', ultimate: 'abyssal-seal-lance' }),
  healer: Object.freeze({ normal: 'life-seed', skill: 'restoration-ribbon', ultimate: 'sanctuary-heart-ray' })
});

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveElement(pow: RuntimePowView['pow']): CombatProjectileElement {
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

function runtimeScene(root: any): RuntimeScene | null {
  const registered = root.POWDER_COMBAT2_ACTIVE_BATTLE_SCENE as RuntimeScene | undefined;
  if (registered?.sys?.isActive?.()) return registered;
  const games = ((Phaser as any).GAMES ?? []) as Phaser.Game[];
  for (const game of games) {
    try {
      const scenes = game.scene.getScenes(true) as RuntimeScene[];
      const found = scenes.find((scene) => scene?.powViews instanceof Map);
      if (found) {
        root.POWDER_COMBAT2_ACTIVE_BATTLE_SCENE = found;
        return found;
      }
    } catch { /* game may still be starting */ }
  }
  return null;
}

function sideOf(key: string, view: RuntimePowView): 'player' | 'enemy' | null {
  if (view.side === 'player' || view.side === 'enemy') return view.side;
  const normalized = normalize(key);
  if (normalized.includes('enemy')) return 'enemy';
  if (normalized.includes('player')) return 'player';
  return null;
}

function pointOf(view: RuntimePowView): Phaser.Math.Vector2 {
  try {
    if (typeof view.getVfxAnchor === 'function') return view.getVfxAnchor('body');
    if (typeof view.getWorldPosition === 'function') return view.getWorldPosition();
  } catch { /* fall through */ }
  return new Phaser.Math.Vector2(Number(view.container?.x ?? 0), Number(view.container?.y ?? 0));
}

function pickVisible(scene: RuntimeScene, side: 'player' | 'enemy'): { key: string; view: RuntimePowView } | null {
  const map = scene.powViews;
  if (!(map instanceof Map)) return null;
  const rows = Array.from(map.entries())
    .filter(([key, view]) => {
      if (sideOf(key, view) !== side) return false;
      const container = view.container;
      return Boolean(container?.visible) && Number(container?.alpha ?? 0) > 0.3;
    })
    .sort((a, b) => Number(b[1].container?.scaleX ?? 0) - Number(a[1].container?.scaleX ?? 0));
  return rows[0] ? { key: rows[0][0], view: rows[0][1] } : null;
}

function isTier(value: unknown): value is Combat2163MarksmanTier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function isRole(value: unknown): value is RuntimeProfessionRole {
  return TEST_ROLES.includes(value as RuntimeProfessionRole);
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

async function playTankQaContact(
  view: RuntimePowView,
  options: RoleAwareOptions,
  tier: Combat2163MarksmanTier
): Promise<void> {
  const container = view.container;
  if (!container) {
    await playCombat2166TankDistinctTierVfx(options, tier);
    return;
  }

  const startX = container.x;
  const startY = container.y;
  const dx = options.target.x - startX;
  const dy = options.target.y - startY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const contactGap = 210;
  const advance = Math.min(Math.max(0, distance - contactGap), distance * 0.72);
  const attackX = startX + (dx / distance) * advance;
  const attackY = startY + (dy / distance) * advance;
  const dashMs = tier === 'ultimate' ? 215 : tier === 'skill' ? 175 : 140;

  try {
    await tweenQa(options.scene, container, {
      x: attackX,
      y: attackY,
      duration: dashMs,
      ease: tier === 'ultimate' ? 'Cubic.easeIn' : 'Quad.easeOut'
    }, dashMs + 260);

    await playCombat2166TankDistinctTierVfx({
      ...options,
      source: new Phaser.Math.Vector2(container.x, container.y)
    }, tier);

    await tweenQa(options.scene, container, {
      x: startX,
      y: startY,
      duration: tier === 'ultimate' ? 155 : 120,
      ease: 'Quad.easeOut'
    }, 420);
  } finally {
    container.setPosition(startX, startY);
  }
}

async function playProfessionRenderer(role: RuntimeProfessionRole, options: RoleAwareOptions, tier: Combat2163MarksmanTier): Promise<void> {
  if (role === 'marksman') return playCombat2163MarksmanDistinctTierVfx(options, tier);
  if (role === 'mage') {
    scheduleCombat2172RangedImpactFeedback(options, 'mage', tier);
    return playCombat2165MageDistinctTierVfx(options, tier);
  }
  if (role === 'fighter' || role === 'knight' || role === 'assassin') {
    return playCombat2172MeleeProfessionImpact(options, role as Combat2172MeleeRole, tier);
  }
  if (role === 'enchanter') {
    scheduleCombat2172RangedImpactFeedback(options, 'enchanter', tier);
    return playCombat2169EnchanterDistinctTierVfx(options, tier);
  }
  if (role === 'healer') {
    scheduleCombat2172RangedImpactFeedback(options, 'healer', tier);
    return playCombat2170HealerDistinctTierVfx(options, tier);
  }
  return playCombat2166TankDistinctTierVfx(options, tier);
}

function updateVisibleWitness(): void {
  if (typeof document === 'undefined') return;
  const apply = (): void => {
    const root = document.getElementById('combat2-profession-test-switcher');
    const toggle = root?.querySelector('button');
    if (toggle) toggle.textContent = `VFX NHANH · ${COMBAT2177_PROFESSION_RUNTIME_VERSION} RUNTIME`;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else queueMicrotask(apply);
}

function installRuntimeTierBridge(): void {
  const root = globalThis as any;
  const proto = BattleScene.prototype as any;
  if (proto.__combat2164MarksmanRuntimeInstalled) return;

  const originalCreate = proto.create;
  const originalBasic = proto.performBasicAttack;
  const originalAbility = proto.performAbility;

  if (typeof originalCreate === 'function') {
    proto.create = function combat2177Create(this: RuntimeScene, ...args: any[]) {
      const result = originalCreate.apply(this, args);
      root.POWDER_COMBAT2_ACTIVE_BATTLE_SCENE = this;
      updateVisibleWitness();
      return result;
    };
  }

  const withTier = async (scene: any, actor: any, tier: Combat2163MarksmanTier, run: () => Promise<any>): Promise<any> => {
    const view = scene?.powViews instanceof Map ? scene.powViews.get(actor?.instanceId) as RuntimePowView | undefined : undefined;
    const previousViewTier = view?.__combat2MarksmanAttackTier;
    const hadGlobalTier = Object.prototype.hasOwnProperty.call(root, 'POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER');
    const previousGlobalTier = root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER;

    if (view) view.__combat2MarksmanAttackTier = tier;
    root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER = tier;
    root.POWDER_COMBAT2_MARKSMAN_RUNTIME_LAST_ACTION = {
      version: COMBAT2177_PROFESSION_RUNTIME_VERSION,
      tier,
      actorId: actor?.instanceId ?? null,
      role: actor?.pow?.role ?? null,
      at: Date.now(),
      sharedProfessionTierContext: true
    };

    try {
      return await run();
    } finally {
      if (view) {
        if (previousViewTier) view.__combat2MarksmanAttackTier = previousViewTier;
        else delete view.__combat2MarksmanAttackTier;
      }
      if (hadGlobalTier) root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER = previousGlobalTier;
      else delete root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER;
    }
  };

  if (typeof originalBasic === 'function') {
    proto.performBasicAttack = async function combat2177Basic(this: any, actor: any, target: any, ...rest: any[]) {
      return withTier(this, actor, 'normal', () => originalBasic.call(this, actor, target, ...rest));
    };
  }

  if (typeof originalAbility === 'function') {
    proto.performAbility = async function combat2177Ability(this: any, actor: any, target: any, slot: any, ...rest: any[]) {
      const tier: Combat2163MarksmanTier = slot === 'ultimate' ? 'ultimate' : 'skill';
      return withTier(this, actor, tier, () => originalAbility.call(this, actor, target, slot, ...rest));
    };
  }

  const playProfessionTier = async (
    requestedRole?: RuntimeProfessionRole | string | null,
    requestedTier?: Combat2163MarksmanTier | string | null,
    requestedElement?: CombatProjectileElement | null
  ) => {
    if (!isRole(requestedRole)) return { ok: false, reason: 'invalid-profession-role', requestedRole };
    if (!isTier(requestedTier)) return { ok: false, reason: 'invalid-profession-tier', requestedTier };

    const scene = runtimeScene(root);
    if (!scene) return { ok: false, reason: 'battle-scene-not-ready', role: requestedRole, tier: requestedTier };
    const sourceRow = pickVisible(scene, 'player');
    const targetRow = pickVisible(scene, 'enemy');
    if (!sourceRow || !targetRow) return { ok: false, reason: 'visible-source-or-target-missing', role: requestedRole, tier: requestedTier };

    const source = pointOf(sourceRow.view);
    const target = pointOf(targetRow.view);
    const element = requestedElement ?? resolveElement(sourceRow.view.pow);
    const options: RoleAwareOptions = { scene, source, target, element, reducedMotion: false, role: requestedRole };

    try {
      if (requestedRole === 'tank') await playTankQaContact(sourceRow.view, options, requestedTier);
      else await playProfessionRenderer(requestedRole, options, requestedTier);

      const melee = requestedRole === 'tank' || requestedRole === 'fighter' || requestedRole === 'knight' || requestedRole === 'assassin';
      const result = {
        ok: true,
        role: requestedRole,
        tier: requestedTier,
        element,
        source: sourceRow.key,
        target: targetRow.key,
        directProfessionRuntime: true,
        directVersion: COMBAT2177_PROFESSION_RUNTIME_VERSION,
        form: PROFESSION_FORMS[requestedRole][requestedTier],
        runtimeDirectQa: true,
        meleeContactOnly: melee,
        projectileTravel: melee ? false : true,
        tankActorMotionQa: requestedRole === 'tank',
        tankCastSignature: requestedRole === 'tank' ? false : undefined,
        assassinVisualHits: requestedRole === 'assassin' ? 2 : undefined,
        assassinGuaranteedCritChanged: false,
        ultimateImpactShake: requestedTier === 'ultimate' && requestedRole !== 'marksman',
        damageApplied: false,
        turnAdvanced: false
      };
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      root.POWDER_COMBAT2_PROFESSION_RUNTIME_TEST_LAST = result;
      return result;
    } catch (error) {
      console.error('[Combat2 2.17.7 Profession Runtime QA]', error);
      return { ok: false, reason: 'runtime-tier-vfx-threw', role: requestedRole, tier: requestedTier, directVersion: COMBAT2177_PROFESSION_RUNTIME_VERSION };
    }
  };

  const playMarksmanTier = async (requestedTier?: Combat2163MarksmanTier | string | null, requestedElement?: CombatProjectileElement | null) => {
    const result = await playProfessionTier('marksman', requestedTier, requestedElement);
    if (result?.ok) {
      const legacyResult = {
        ...result,
        directMarksmanRuntime: true,
        marksmanAttackTier: result.tier,
        marksmanForm: result.form,
        directVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION
      };
      root.POWDER_COMBAT2_MARKSMAN_RUNTIME_TEST_LAST = legacyResult;
      return legacyResult;
    }
    return result;
  };

  root.POWDER_COMBAT2_PROFESSION_RUNTIME_TEST = {
    version: COMBAT2177_PROFESSION_RUNTIME_VERSION,
    ready: true,
    roles: [...TEST_ROLES],
    tiers: ['normal', 'skill', 'ultimate'],
    forms: PROFESSION_FORMS,
    playProfessionTier,
    visualQaOnly: true,
    meleeContactOnlyRoles: ['tank', 'fighter', 'knight', 'assassin'],
    meleeProjectileTravel: false,
    meleeCastSignature: false,
    tankDedicatedManualOwner: true,
    tankQaUsesActorMotion: true,
    fighterIdentity: 'single-heavy-punch',
    knightIdentity: 'single-heavy-slash',
    assassinIdentity: 'two-consecutive-critical-style-slashes',
    assassinVisualHits: 2,
    assassinGuaranteedCritChanged: false,
    allNewProfessionUltimateImpactShake: true,
    damageApplied: false,
    turnAdvanced: false,
    realCombatTierHookShared: true,
    realCombatHooks: { basic: 'normal', skill1: 'skill', skill2: 'skill', ultimate: 'ultimate' },
    activeSceneRegistration: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_MARKSMAN_RUNTIME_TEST = {
    version: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
    ready: true,
    playMarksmanTier,
    realCombatHooks: { basic: 'normal', skill1: 'skill', skill2: 'skill', ultimate: 'ultimate' },
    activeSceneRegistration: true,
    combatLogicChanged: false
  };

  proto.__combat2164MarksmanRuntimeInstalled = true;
  updateVisibleWitness();
}

installRuntimeTierBridge();