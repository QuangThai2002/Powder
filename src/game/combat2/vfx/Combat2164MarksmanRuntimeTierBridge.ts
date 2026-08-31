import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import {
  playCombat2163MarksmanDistinctTierVfx,
  type Combat2163MarksmanTier
} from './Combat2163MarksmanDistinctTierVfx';

export const COMBAT2164_MARKSMAN_RUNTIME_VERSION = '2.16.4';

type RuntimePowView = {
  side?: 'player' | 'enemy';
  pow?: { elementKey?: string; element?: string; role?: string };
  container?: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition?: () => Phaser.Math.Vector2;
  __combat2MarksmanAttackTier?: Combat2163MarksmanTier;
};

type RuntimeScene = Phaser.Scene & {
  powViews?: Map<string, RuntimePowView>;
};

type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

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

function formFor(tier: Combat2163MarksmanTier): string {
  if (tier === 'skill') return 'piercing-triple-rail-shot';
  if (tier === 'ultimate') return 'rail-breaker-heavy-slug';
  return 'compact-spiral-rail';
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
  } catch { /* fall through to container position */ }
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

function updateVisibleWitness(): void {
  if (typeof document === 'undefined') return;
  const apply = (): void => {
    const root = document.getElementById('combat2-profession-test-switcher');
    const toggle = root?.querySelector('button');
    if (toggle) toggle.textContent = `VFX NHANH · ${COMBAT2164_MARKSMAN_RUNTIME_VERSION} RUNTIME`;
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
    proto.create = function combat2164Create(this: RuntimeScene, ...args: any[]) {
      const result = originalCreate.apply(this, args);
      root.POWDER_COMBAT2_ACTIVE_BATTLE_SCENE = this;
      updateVisibleWitness();
      return result;
    };
  }

  const withTier = async (
    scene: any,
    actor: any,
    tier: Combat2163MarksmanTier,
    run: () => Promise<any>
  ): Promise<any> => {
    const view = scene?.powViews instanceof Map ? scene.powViews.get(actor?.instanceId) as RuntimePowView | undefined : undefined;
    const previousViewTier = view?.__combat2MarksmanAttackTier;
    const hadGlobalTier = Object.prototype.hasOwnProperty.call(root, 'POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER');
    const previousGlobalTier = root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER;

    if (view) view.__combat2MarksmanAttackTier = tier;
    root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER = tier;
    root.POWDER_COMBAT2_MARKSMAN_RUNTIME_LAST_ACTION = {
      version: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
      tier,
      actorId: actor?.instanceId ?? null,
      role: actor?.pow?.role ?? null,
      at: Date.now()
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
    proto.performBasicAttack = async function combat2164Basic(this: any, actor: any, target: any, ...rest: any[]) {
      return withTier(this, actor, 'normal', () => originalBasic.call(this, actor, target, ...rest));
    };
  }

  if (typeof originalAbility === 'function') {
    proto.performAbility = async function combat2164Ability(this: any, actor: any, target: any, slot: any, ...rest: any[]) {
      const tier: Combat2163MarksmanTier = slot === 'ultimate' ? 'ultimate' : 'skill';
      return withTier(this, actor, tier, () => originalAbility.call(this, actor, target, slot, ...rest));
    };
  }

  const playMarksmanTier = async (
    requestedTier?: Combat2163MarksmanTier | string | null,
    requestedElement?: CombatProjectileElement | null
  ) => {
    if (requestedTier !== 'normal' && requestedTier !== 'skill' && requestedTier !== 'ultimate') {
      return { ok: false, reason: 'invalid-marksman-tier', requestedTier };
    }
    const scene = runtimeScene(root);
    if (!scene) return { ok: false, reason: 'battle-scene-not-ready', marksmanAttackTier: requestedTier };
    const sourceRow = pickVisible(scene, 'player');
    const targetRow = pickVisible(scene, 'enemy');
    if (!sourceRow || !targetRow) {
      return { ok: false, reason: 'visible-source-or-target-missing', marksmanAttackTier: requestedTier };
    }

    const source = pointOf(sourceRow.view);
    const target = pointOf(targetRow.view);
    const element = requestedElement ?? resolveElement(sourceRow.view.pow);
    const options: RoleAwareOptions = {
      scene,
      source,
      target,
      element,
      reducedMotion: false,
      role: 'marksman'
    };

    try {
      await playCombat2163MarksmanDistinctTierVfx(options, requestedTier);
      const result = {
        ok: true,
        role: 'marksman',
        element,
        source: sourceRow.key,
        target: targetRow.key,
        directMarksmanRuntime: true,
        directVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
        marksmanAttackTier: requestedTier,
        marksmanForm: formFor(requestedTier),
        runtimeDirectQa: true,
        damageApplied: false,
        turnAdvanced: false
      };
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      root.POWDER_COMBAT2_MARKSMAN_RUNTIME_TEST_LAST = result;
      return result;
    } catch (error) {
      console.error('[Combat2 2.16.4 Marksman Runtime QA]', error);
      return {
        ok: false,
        reason: 'runtime-tier-vfx-threw',
        directVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
        marksmanAttackTier: requestedTier
      };
    }
  };

  root.POWDER_COMBAT2_MARKSMAN_RUNTIME_TEST = {
    version: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
    ready: true,
    playMarksmanTier,
    realCombatHooks: {
      basic: 'normal',
      skill1: 'skill',
      skill2: 'skill',
      ultimate: 'ultimate'
    },
    activeSceneRegistration: true,
    combatLogicChanged: false
  };

  proto.__combat2164MarksmanRuntimeInstalled = true;
  updateVisibleWitness();
}

installRuntimeTierBridge();
