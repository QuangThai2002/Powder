import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';
import {
  createCombat2104QaSignature,
  type Combat2104ActionSignature
} from '../views/Combat2104PowSkillSignaturePatch';
import type { CombatProjectileElement } from './DirectionalElementProjectileVfx';
import type { Combat2163MarksmanTier } from './Combat2163MarksmanDistinctTierVfx';
import { powVfxDepth } from './CombatNightVfxLayout';
import { ensureCombatVfxTexture } from './CombatVfxRegistry';
import {
  createCombat2201VfxScope,
  playCombat2201ImpactPreview,
  playCombat2201MagicCircle,
  playCombat2201ProjectilePreview,
  playCombat2201SlashPreview,
  playCombat2201SourceRelease,
  playCombat2201UltimatePreview,
  type Combat2201VfxScope
} from './Combat2201HighFantasyAnimeVfx';

export const COMBAT2164_MARKSMAN_RUNTIME_VERSION = '2.16.4';
export const COMBAT2188_PROFESSION_RUNTIME_VERSION = '2.18.8';
export const COMBAT2183_PROFESSION_RUNTIME_VERSION = COMBAT2188_PROFESSION_RUNTIME_VERSION;
export const COMBAT2178_PROFESSION_RUNTIME_VERSION = COMBAT2188_PROFESSION_RUNTIME_VERSION;
export const COMBAT2177_PROFESSION_RUNTIME_VERSION = COMBAT2188_PROFESSION_RUNTIME_VERSION;
export const COMBAT2173_PROFESSION_RUNTIME_VERSION = COMBAT2188_PROFESSION_RUNTIME_VERSION;
export const COMBAT2172_PROFESSION_RUNTIME_VERSION = COMBAT2188_PROFESSION_RUNTIME_VERSION;
export const COMBAT2171_PROFESSION_RUNTIME_VERSION = COMBAT2188_PROFESSION_RUNTIME_VERSION;

type RuntimeProfessionRole = 'marksman' | 'mage' | 'tank' | 'fighter' | 'knight' | 'assassin' | 'enchanter' | 'healer' | 'musician';
type RuntimeMeleeRole = 'tank' | 'fighter' | 'knight' | 'assassin';
type VfxLabEffect = 'cast' | 'release' | 'projectile' | 'slash' | 'impact' | 'magic-circle' | 'ultimate';

type RuntimePowView = {
  side?: 'player' | 'enemy';
  scene?: Phaser.Scene;
  pow?: { id?: string; name?: string; elementKey?: string; element?: string; role?: string };
  container?: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition?: () => Phaser.Math.Vector2;
  playAttackLunge?: (targetX: number, targetY: number) => Promise<void>;
  playHit?: () => Promise<void>;
  __combat2MarksmanAttackTier?: Combat2163MarksmanTier;
  __combat2104ActionSignature?: Combat2104ActionSignature;
};

type RuntimeCombatUnit = {
  instanceId: string;
  side: 'player' | 'enemy';
  pow?: RuntimePowView['pow'];
};

type RuntimeScene = Phaser.Scene & {
  powViews?: Map<string, RuntimePowView>;
  combatState?: { units?: RuntimeCombatUnit[] };
};

const TEST_ROLES: readonly RuntimeProfessionRole[] = Object.freeze([
  'marksman', 'mage', 'tank', 'fighter', 'knight', 'assassin', 'enchanter', 'healer', 'musician'
]);

const VFX_LAB_EFFECTS: readonly VfxLabEffect[] = Object.freeze([
  'cast', 'release', 'projectile', 'slash', 'impact', 'magic-circle', 'ultimate'
]);

const VFX_LAB_FIRST_ART_PACK = Object.freeze([
  'cast_core_elemental',
  'dark',
  'slash_heavy',
  'slash_dark',
  'impact_dark',
  'circle_dark',
  'ultimate_intro_standard',
  'ultimate_charge_standard',
  'ultimate_release_standard',
  'ultimate_impact_standard',
  'ultimate_finish_standard'
]);

// Only art files that exist are opt-in for the isolated Lab path; combat routes retain fallbacks.
const VFX_LAB_DELIVERED_ART_ASSETS = Object.freeze([
  'cast_core_elemental',
  'dark',
  'slash_heavy',
  'slash_dark',
  'impact_dark',
  'circle_dark',
  'ultimate_intro_standard',
  'ultimate_charge_standard',
  'ultimate_release_standard',
  'ultimate_impact_standard',
  'ultimate_finish_standard'
]);

function configuredAssetIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => enabled === true)
      .map(([id]) => id);
  }
  return [];
}

function enableVfxLabArtPack(root: any): () => void {
  const previous = root.POWDER_COMBAT2_VFX_ASSET_PACK;
  root.POWDER_COMBAT2_VFX_ASSET_PACK = [...new Set([
    ...configuredAssetIds(previous),
    ...VFX_LAB_DELIVERED_ART_ASSETS
  ])];
  return () => {
    if (previous === undefined) delete root.POWDER_COMBAT2_VFX_ASSET_PACK;
    else root.POWDER_COMBAT2_VFX_ASSET_PACK = previous;
  };
}

async function preloadVfxLabArtPack(scene: Phaser.Scene): Promise<void> {
  const pending = VFX_LAB_DELIVERED_ART_ASSETS.filter((id) => !scene.textures.exists(`combat-vfx-${id}`));
  if (pending.length === 0) return;
  const completed = new Promise<void>((resolve) => scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve()));
  for (const id of pending) ensureCombatVfxTexture(scene, id, 'vfx-lab-art-pack');
  if (pending.every((id) => scene.textures.exists(`combat-vfx-${id}`))) return;
  await completed;
}

const PROFESSION_FORMS: Readonly<Record<RuntimeProfessionRole, Readonly<Record<Combat2163MarksmanTier, string>>>> = Object.freeze({
  marksman: Object.freeze({ normal: 'compact-spiral-rail', skill: 'piercing-triple-rail-shot', ultimate: 'rail-breaker-heavy-slug' }),
  mage: Object.freeze({ normal: 'arcane-bolt', skill: 'twin-rune-lance', ultimate: 'astral-comet' }),
  tank: Object.freeze({ normal: 'shield-bash-contact', skill: 'bulwark-slam-contact', ultimate: 'fortress-breaker-contact' }),
  fighter: Object.freeze({ normal: 'heavy-straight-punch-contact', skill: 'rising-breaker-punch-contact', ultimate: 'meteor-fist-finisher-contact' }),
  knight: Object.freeze({ normal: 'heavy-cut-contact', skill: 'guard-break-cleave-contact', ultimate: 'royal-judgment-slash-contact' }),
  assassin: Object.freeze({ normal: 'two-quick-contact-cuts', skill: 'two-shadow-afterimage-cuts', ultimate: 'two-execution-critical-style-cuts' }),
  enchanter: Object.freeze({ normal: 'hex-needle', skill: 'binding-sigil-chain', ultimate: 'abyssal-grand-seal' }),
  healer: Object.freeze({ normal: 'mend-spark', skill: 'restoration-stream', ultimate: 'sanctuary-crown' }),
  musician: Object.freeze({ normal: 'pulse-note', skill: 'chord-wave', ultimate: 'symphony-crescendo' })
});

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
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

function targetPointOf(view: RuntimePowView): Phaser.Math.Vector2 {
  try {
    if (typeof view.getVfxAnchor === 'function') return view.getVfxAnchor('body');
    if (typeof view.getWorldPosition === 'function') return view.getWorldPosition();
  } catch { /* fall through */ }
  return new Phaser.Math.Vector2(Number(view.container?.x ?? 0), Number(view.container?.y ?? 0));
}

function labTravelDirection(source: Phaser.Math.Vector2, target: Phaser.Math.Vector2): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 4) return dx > 0 ? 'left-to-right' : 'right-to-left';
  if (Math.abs(dy) >= 4) return dy > 0 ? 'top-to-bottom' : 'bottom-to-top';
  return 'stationary';
}

function roleOfPow(pow?: RuntimePowView['pow']): RuntimeProfessionRole | null {
  const role = normalize(pow?.role ?? '');
  if (role.includes('xa thu') || role.includes('marksman')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  if (role.includes('dau si') || role.includes('fighter')) return 'fighter';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  if (role.includes('sat thu') || role.includes('assassin')) return 'assassin';
  if (role.includes('thuat su') || role.includes('enchanter') || role.includes('warlock')) return 'enchanter';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  return null;
}

function roleOf(view: RuntimePowView): RuntimeProfessionRole | null {
  return roleOfPow(view.pow);
}

function pickVisible(
  scene: RuntimeScene,
  side: 'player' | 'enemy',
  preferredRole?: RuntimeProfessionRole
): { key: string; view: RuntimePowView } | null {
  const map = scene.powViews;
  if (!(map instanceof Map)) return null;
  const rows = Array.from(map.entries())
    .filter(([key, view]) => {
      if (sideOf(key, view) !== side) return false;
      const container = view.container;
      return Boolean(container?.visible) && Number(container?.alpha ?? 0) > 0.3;
    })
    .sort((a, b) => Number(b[1].container?.scaleX ?? 0) - Number(a[1].container?.scaleX ?? 0));
  const preferred = preferredRole ? rows.find(([, view]) => roleOf(view) === preferredRole) : null;
  const row = preferred ?? rows[0];
  return row ? { key: row[0], view: row[1] } : null;
}

function pickVisibleRole(
  scene: RuntimeScene,
  role: RuntimeProfessionRole
): { key: string; view: RuntimePowView } | null {
  const map = scene.powViews;
  if (!(map instanceof Map)) return null;
  const units = Array.isArray(scene.combatState?.units) ? scene.combatState.units : [];
  const rows = units
    .map((unit) => ({ key: unit.instanceId, side: unit.side, view: map.get(unit.instanceId), role: roleOfPow(unit.pow) }))
    .filter((row): row is { key: string; side: 'player' | 'enemy'; view: RuntimePowView; role: RuntimeProfessionRole } => {
      const view = row.view;
      if (!view) return false;
      const container = view.container;
      return Boolean(container?.visible)
        && Number(container?.alpha ?? 0) > 0.3
        && row.role === role;
    })
    .sort((a, b) => Number(b.view.container?.scaleX ?? 0) - Number(a.view.container?.scaleX ?? 0));
  const row = rows.find((entry) => entry.side === 'player') ?? rows[0];
  return row ? { key: row.key, view: row.view } : null;
}

function visibleRoleDiagnostics(scene: RuntimeScene): string[] {
  const map = scene.powViews;
  if (!(map instanceof Map)) return ['powViews-missing'];
  return Array.from(map.entries())
    .filter(([, view]) => Boolean(view.container?.visible) && Number(view.container?.alpha ?? 0) > 0.3)
    .map(([key, view]) => `${key}:${String(view.pow?.role ?? 'missing')}`);
}

function isTier(value: unknown): value is Combat2163MarksmanTier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function isRole(value: unknown): value is RuntimeProfessionRole {
  return TEST_ROLES.includes(value as RuntimeProfessionRole);
}

function isVfxLabEffect(value: unknown): value is VfxLabEffect {
  return VFX_LAB_EFFECTS.includes(value as VfxLabEffect);
}

function isMeleeRole(role: RuntimeProfessionRole): role is RuntimeMeleeRole {
  return role === 'tank' || role === 'fighter' || role === 'knight' || role === 'assassin';
}

/** QA invokes the same attack and target-hit route as a player basic action. */
async function playLiveRuntimeQaAction(
  view: RuntimePowView,
  targetView: RuntimePowView,
  tier: Combat2163MarksmanTier
): Promise<CombatProjectileElement> {
  const attack = view.playAttackLunge;
  const pow = view.pow;
  if (typeof attack !== 'function' || !pow) throw new Error('live-powview-attack-missing');

  const hadTier = Object.prototype.hasOwnProperty.call(view, '__combat2MarksmanAttackTier');
  const previousTier = view.__combat2MarksmanAttackTier;
  const hadSignature = Object.prototype.hasOwnProperty.call(view, '__combat2104ActionSignature');
  const previousSignature = view.__combat2104ActionSignature;
  const scene = view.scene as (Phaser.Scene & { __combat2121Element?: string; __combat2121Side?: 'player' | 'enemy' }) | undefined;
  const hadElementContext = Boolean(scene) && Object.prototype.hasOwnProperty.call(scene, '__combat2121Element');
  const previousElementContext = scene?.__combat2121Element;
  const hadSideContext = Boolean(scene) && Object.prototype.hasOwnProperty.call(scene, '__combat2121Side');
  const previousSideContext = scene?.__combat2121Side;
  const target = targetPointOf(targetView);
  const element = resolveElement(pow);

  // Tier is presentation-only; role and element always come from the real Pow.
  view.__combat2MarksmanAttackTier = tier;
  view.__combat2104ActionSignature = createCombat2104QaSignature(pow, tier);
  if (scene) {
    scene.__combat2121Element = String(pow.elementKey ?? pow.element ?? '');
    scene.__combat2121Side = view.side === 'enemy' ? 'enemy' : 'player';
  }

  try {
    await attack.call(view, target.x, target.y);
    if (typeof targetView.playHit === 'function') await targetView.playHit();
    return element;
  } finally {
    if (hadTier) view.__combat2MarksmanAttackTier = previousTier;
    else delete view.__combat2MarksmanAttackTier;
    if (hadSignature) view.__combat2104ActionSignature = previousSignature;
    else delete view.__combat2104ActionSignature;
    if (scene) {
      if (hadElementContext) scene.__combat2121Element = previousElementContext;
      else delete scene.__combat2121Element;
      if (hadSideContext) scene.__combat2121Side = previousSideContext;
      else delete scene.__combat2121Side;
    }
  }
}

function updateVisibleWitness(): void {
  if (typeof document === 'undefined') return;
  const apply = (): void => {
    const root = document.getElementById('combat2-profession-test-switcher');
    const toggle = root?.querySelector('button');
    if (toggle) toggle.textContent = `VFX NHANH · ${COMBAT2188_PROFESSION_RUNTIME_VERSION} RUNTIME`;
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
    proto.create = function combat2188Create(this: RuntimeScene, ...args: any[]) {
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
      version: COMBAT2188_PROFESSION_RUNTIME_VERSION,
      tier,
      actorId: actor?.instanceId ?? null,
      role: actor?.pow?.role ?? null,
      at: Date.now(),
      sharedProfessionTierContext: true
    };

    try { return await run(); }
    finally {
      if (view) {
        if (previousViewTier) view.__combat2MarksmanAttackTier = previousViewTier;
        else delete view.__combat2MarksmanAttackTier;
      }
      if (hadGlobalTier) root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER = previousGlobalTier;
      else delete root.POWDER_COMBAT2_MARKSMAN_ACTIVE_TIER;
    }
  };

  if (typeof originalBasic === 'function') {
    proto.performBasicAttack = async function combat2188Basic(this: any, actor: any, target: any, ...rest: any[]) {
      return withTier(this, actor, 'normal', () => originalBasic.call(this, actor, target, ...rest));
    };
  }

  if (typeof originalAbility === 'function') {
    proto.performAbility = async function combat2188Ability(this: any, actor: any, target: any, slot: any, ...rest: any[]) {
      const tier: Combat2163MarksmanTier = slot === 'ultimate' ? 'ultimate' : 'skill';
      return withTier(this, actor, tier, () => originalAbility.call(this, actor, target, slot, ...rest));
    };
  }

  let activeLabScope: Combat2201VfxScope | null = null;
  let labRun = 0;

  const vfxLabRoster = () => {
    const scene = runtimeScene(root);
    const map = scene?.powViews;
    if (!(map instanceof Map)) return [];
    return Array.from(map.entries())
      .filter(([key, view]) => Boolean(view.container?.visible) && Number(view.container?.alpha ?? 0) > 0.3)
      .map(([instanceId, view]) => ({
        instanceId,
        side: sideOf(instanceId, view),
        powId: view.pow?.id ?? null,
        name: view.pow?.name ?? view.pow?.id ?? instanceId,
        role: view.pow?.role ?? null,
        element: view.pow?.elementKey ?? view.pow?.element ?? null,
        point: targetPointOf(view)
      }));
  };

  const cleanupVfxLab = (reason = 'manual') => {
    labRun += 1;
    const scope = activeLabScope;
    activeLabScope = null;
    scope?.cleanup();
    const result = {
      ok: true,
      reason,
      activeRootsAfterCleanup: scope?.activeCount() ?? 0,
      presentationOnly: true,
      damageApplied: false,
      turnAdvanced: false
    };
    root.POWDER_COMBAT2_VFX_LAB_LAST = result;
    return result;
  };

  const playVfxLab = async (
    requestedEffect?: VfxLabEffect | string | null,
    sourceId?: string | null,
    targetId?: string | null
  ) => {
    if (!isVfxLabEffect(requestedEffect)) return { ok: false, reason: 'invalid-vfx-lab-effect', requestedEffect };
    const scene = runtimeScene(root);
    if (!scene) return { ok: false, reason: 'battle-scene-not-ready', effect: requestedEffect };
    const map = scene.powViews;
    if (!(map instanceof Map)) return { ok: false, reason: 'pow-views-missing', effect: requestedEffect };
    const source = sourceId ? map.get(sourceId) : undefined;
    const target = targetId ? map.get(targetId) : undefined;
    if (!source || !sourceId || !Boolean(source.container?.visible)) return { ok: false, reason: 'lab-source-not-visible', effect: requestedEffect, sourceId };
    if (!target || !targetId || !Boolean(target.container?.visible)) return { ok: false, reason: 'lab-target-not-visible', effect: requestedEffect, targetId };
    if (sourceId === targetId) return { ok: false, reason: 'lab-source-target-must-differ', effect: requestedEffect, sourceId };

    cleanupVfxLab('replaced-by-play');
    const runId = ++labRun;
    const scope = createCombat2201VfxScope();
    activeLabScope = scope;
    const sourcePoint = targetPointOf(source);
    const targetPoint = targetPointOf(target);
    const element = resolveElement(source.pow);
    const role = String(source.pow?.role ?? '');
    const preview = { scene, source: sourcePoint, target: targetPoint, element, role, tier: 'skill' as const, scope };
    const cleanupOnSceneStop = (): void => { if (activeLabScope === scope) cleanupVfxLab('scene-shutdown'); };
    const cleanupOnResize = (): void => { if (activeLabScope === scope) cleanupVfxLab('scene-resize'); };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupOnSceneStop);
    scene.events.once(Phaser.Scenes.Events.DESTROY, cleanupOnSceneStop);
    scene.scale.once(Phaser.Scale.Events.RESIZE, cleanupOnResize);
    const restoreArtPack = enableVfxLabArtPack(root);

    try {
      await preloadVfxLabArtPack(scene);
      if (runId !== labRun || scope.isCleanedUp()) {
        return {
          ok: false,
          cancelled: true,
          effect: requestedEffect,
          source: sourceId,
          target: targetId,
          presentationOnly: true,
          damageApplied: false,
          manaChanged: false,
          turnAdvanced: false
        };
      }
      let phases: readonly string[] | undefined;
      if (requestedEffect === 'cast') {
        await playCombat2201SourceRelease(scene, sourcePoint, element, 'skill', false, { role, scope });
        phases = ['cast', 'charge', 'release', 'fade', 'cleanup'];
      } else if (requestedEffect === 'release') {
        await playCombat2201SourceRelease(scene, sourcePoint, element, 'skill', false, { role, scope });
        phases = ['release', 'fade', 'cleanup'];
      } else if (requestedEffect === 'projectile') await playCombat2201ProjectilePreview(preview);
      else if (requestedEffect === 'slash') await playCombat2201SlashPreview(preview);
      else if (requestedEffect === 'impact') await playCombat2201ImpactPreview(preview);
      else if (requestedEffect === 'magic-circle') {
        await playCombat2201SourceRelease(scene, sourcePoint, element, 'skill', false, { role, scope });
        await playCombat2201MagicCircle({
          scene,
          point: sourcePoint,
          element,
          // Lab-only presentation: keep the sheet large and readable around the source Pow.
          tier: 'ultimate',
          role,
          depth: powVfxDepth('body') - 1,
          holdMs: 900,
          scope
        });
        phases = ['cast', 'magic-circle', 'charge', 'release', 'fade', 'cleanup'];
      } else {
        phases = await playCombat2201UltimatePreview({ ...preview, tier: 'ultimate' });
      }
      const cancelled = runId !== labRun || scope.isCleanedUp();
      const result = {
        ok: !cancelled,
        cancelled,
        effect: requestedEffect,
        source: sourceId,
        target: targetId,
        sourceRole: source.pow?.role ?? null,
        sourceElement: element,
        direction: labTravelDirection(sourcePoint, targetPoint),
        ...(phases ? { phases } : {}),
        activeRootsAfterPlay: scope.activeCount(),
        presentationOnly: true,
        damageApplied: false,
        manaChanged: false,
        turnAdvanced: false
      };
      root.POWDER_COMBAT2_VFX_LAB_LAST = result;
      return result;
    } catch (error) {
      console.error('[Combat2 VFX Lab]', error);
      return { ok: false, reason: 'vfx-lab-threw', effect: requestedEffect, source: sourceId, target: targetId };
    } finally {
      restoreArtPack();
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanupOnSceneStop);
      scene.events.off(Phaser.Scenes.Events.DESTROY, cleanupOnSceneStop);
      scene.scale.off(Phaser.Scale.Events.RESIZE, cleanupOnResize);
      if (activeLabScope === scope) activeLabScope = null;
    }
  };

  const playProfessionTier = async (
    requestedRole?: RuntimeProfessionRole | string | null,
    requestedTier?: Combat2163MarksmanTier | string | null,
    requestedElement?: CombatProjectileElement | null
  ) => {
    if (!isRole(requestedRole)) return { ok: false, reason: 'invalid-profession-role', requestedRole };
    if (!isTier(requestedTier)) return { ok: false, reason: 'invalid-profession-tier', requestedTier };

    const scene = runtimeScene(root);
    if (!scene) return { ok: false, reason: 'battle-scene-not-ready', role: requestedRole, tier: requestedTier };
    const sourceRow = pickVisibleRole(scene, requestedRole);
    if (!sourceRow) {
      return {
        ok: false,
        reason: 'matching-profession-pow-not-visible',
        role: requestedRole,
        tier: requestedTier,
        visibleRoles: visibleRoleDiagnostics(scene)
      };
    }
    const sourceSide = sideOf(sourceRow.key, sourceRow.view);
    const targetRow = pickVisible(scene, sourceSide === 'enemy' ? 'player' : 'enemy');
    if (!targetRow) return { ok: false, reason: 'visible-target-missing', role: requestedRole, tier: requestedTier };
    const sourceElement = resolveElement(sourceRow.view.pow);
    if (requestedElement && requestedElement !== sourceElement) {
      return {
        ok: false,
        reason: 'element-must-match-source-pow',
        role: requestedRole,
        tier: requestedTier,
        requestedElement,
        sourceElement
      };
    }

    try {
      const element = await playLiveRuntimeQaAction(
        sourceRow.view,
        targetRow.view,
        requestedTier
      );

      const melee = isMeleeRole(requestedRole);
      const result = {
        ok: true,
        role: requestedRole,
        tier: requestedTier,
        element,
        source: sourceRow.key,
        sourceRole: sourceRow.view.pow?.role ?? null,
        sourceMatchesRequestedRole: true,
        target: targetRow.key,
        directProfessionRuntime: true,
        directVersion: COMBAT2188_PROFESSION_RUNTIME_VERSION,
        form: PROFESSION_FORMS[requestedRole][requestedTier],
        runtimeDirectQa: true,
        liveRuntimeRoute: 'PowView.playAttackLunge + PowView.playHit',
        directRendererBypassed: true,
        sourceRoleOverride: false,
        sourceElementOverride: false,
        dedicatedOwner: true,
        meleeContactOnly: melee,
        targetLocalImpactQa: melee || undefined,
        projectileTravel: melee ? false : true,
        dedicatedActorMotionQa: melee,
        actorMotionQa: melee ? 'local-hop' : undefined,
        targetHitFeedbackQa: true,
        meleeCastSignature: melee ? false : undefined,
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
      console.error('[Combat2 2.18.8 Profession Runtime QA]', error);
      return { ok: false, reason: 'runtime-tier-vfx-threw', role: requestedRole, tier: requestedTier, directVersion: COMBAT2188_PROFESSION_RUNTIME_VERSION };
    }
  };

  const playMarksmanTier = async (requestedTier?: Combat2163MarksmanTier | string | null, requestedElement?: CombatProjectileElement | null) => {
    const result = await playProfessionTier('marksman', requestedTier, requestedElement);
    if (result?.ok && 'form' in result) {
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
    version: COMBAT2188_PROFESSION_RUNTIME_VERSION,
    ready: true,
    roles: [...TEST_ROLES],
    tiers: ['normal', 'skill', 'ultimate'],
    forms: PROFESSION_FORMS,
    playProfessionTier,
    vfxLabEffects: [...VFX_LAB_EFFECTS],
    vfxLabFirstArtPack: [...VFX_LAB_FIRST_ART_PACK],
    vfxLabDeliveredArtAssets: [...VFX_LAB_DELIVERED_ART_ASSETS],
    getVfxLabRoster: vfxLabRoster,
    playVfxLab,
    cleanupVfxLab,
    vfxLabSourceTargetSelection: true,
    vfxLabCleanupScope: true,
    vfxLabResizeCleanup: true,
    vfxLabPipeline: ['intro', 'cast', 'magic-circle', 'charge', 'release', 'attack', 'impact', 'finish', 'cleanup'],
    visualQaOnly: true,
    allNineProfessionsTiered: true,
    dedicatedOwners: true,
    meleeContactOnlyRoles: ['tank', 'fighter', 'knight', 'assassin'],
    meleeLocalHopRoles: ['tank', 'fighter', 'knight', 'assassin'],
    meleeProjectileTravel: false,
    meleeCastSignature: false,
    meleeQaUsesActorMotion: true,
    qaUsesLivePowViewAttack: true,
    directRendererBypassed: true,
    qaRequiresMatchingPow: true,
    qaSourceRoleOverride: false,
    qaSourceElementOverride: false,
    qaTargetHitFeedback: true,
    assassinVisualHits: 2,
    assassinGuaranteedCritChanged: false,
    normalSkillUltimateDistinct: true,
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
