import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from '../vfx/DirectionalElementProjectileVfx';
import {
  COMBAT2162_MARKSMAN_TIER_VERSION,
  playCombat2162MarksmanTieredQaVfx,
  type Combat2162MarksmanTier
} from '../vfx/Combat2162MarksmanTieredQaVfx';

const FLAG = '__powderCombat2160MarksmanLabBridgeInstalled';
const TIER_UI_VERSION = COMBAT2162_MARKSMAN_TIER_VERSION;

type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };
type RuntimeRow = {
  instanceId: string;
  side: 'player' | 'enemy';
  view: any;
};

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function findScene(): any | null {
  const games = ((Phaser as any).GAMES ?? []) as Phaser.Game[];
  for (const game of games) {
    try {
      const scene = game.scene.getScene('BattleScene') as any;
      if (scene?.powViews instanceof Map) return scene;
    } catch { /* game may still be booting */ }
  }
  return null;
}

function visibleRows(scene: any): RuntimeRow[] {
  const map = scene?.powViews as Map<string, any> | undefined;
  if (!(map instanceof Map)) return [];
  return Array.from(map.entries())
    .filter(([, view]) => Boolean(view?.container?.visible) && Number(view?.container?.alpha ?? 0) > 0.45)
    .map(([instanceId, view]) => ({
      instanceId,
      side: instanceId.startsWith('enemy-') ? 'enemy' : 'player',
      view
    }));
}

function pickActive(rows: RuntimeRow[], side: 'player' | 'enemy'): RuntimeRow | null {
  const same = rows.filter((row) => row.side === side);
  return same.find((row) => Number(row.view?.container?.scaleX ?? 0) >= 0.7) ?? same[0] ?? null;
}

function pointOf(view: any): Phaser.Math.Vector2 {
  try {
    if (typeof view?.getVfxAnchor === 'function') return view.getVfxAnchor('body');
    if (typeof view?.getWorldPosition === 'function') return view.getWorldPosition();
  } catch { /* use container fallback */ }
  return new Phaser.Math.Vector2(Number(view?.container?.x ?? 0), Number(view?.container?.y ?? 0));
}

function randomElement(api: any): CombatProjectileElement {
  const values = Array.isArray(api?.elements) && api.elements.length > 0
    ? api.elements as CombatProjectileElement[]
    : ['fire', 'water', 'ice', 'lightning'] as CombatProjectileElement[];
  return values[Math.floor(Math.random() * values.length)] ?? 'fire';
}

function isPreviewTier(value: unknown): value is Combat2162MarksmanTier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function installCombat2160MarksmanLabBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;
  if (!isLocalDev()) return;

  const api = root.POWDER_COMBAT2_VFX_LAB ?? root.POWDER_COMBAT2_PROFESSION_LIVE_TEST;
  if (!api || typeof api.play !== 'function') {
    root.POWDER_COMBAT2_2162_MARKSMAN_TIER_UI = {
      version: TIER_UI_VERSION,
      ready: false,
      reason: 'base-vfx-lab-missing'
    };
    return;
  }

  const previousPlay = api.play.bind(api);
  let marksmanPlaying = false;

  const playTier = async (
    previewTier: Combat2162MarksmanTier,
    requestedElement?: CombatProjectileElement | null
  ) => {
    if (marksmanPlaying) {
      return { ok: false, reason: 'marksman-preview-busy', role: 'marksman', marksmanAttackTier: previewTier };
    }

    const scene = findScene();
    if (!scene) return { ok: false, reason: 'battle-scene-not-ready', role: 'marksman', marksmanAttackTier: previewTier };
    const rows = visibleRows(scene);
    const sourceRow = pickActive(rows, 'player');
    const targetRow = pickActive(rows, 'enemy');
    if (!sourceRow || !targetRow) {
      return { ok: false, reason: 'active-source-or-target-missing', role: 'marksman', marksmanAttackTier: previewTier };
    }

    const source = pointOf(sourceRow.view);
    const target = pointOf(targetRow.view);
    const element = requestedElement ?? randomElement(api);
    const options: RoleAwareOptions = {
      scene,
      source,
      target,
      element,
      reducedMotion: false,
      role: 'marksman'
    };

    marksmanPlaying = true;
    try {
      await playCombat2162MarksmanTieredQaVfx(options, previewTier);
      const result = {
        ok: true,
        role: 'marksman',
        element,
        source: sourceRow.instanceId,
        target: targetRow.instanceId,
        directMarksmanRuntime: true,
        directVersion: TIER_UI_VERSION,
        marksmanAttackTier: previewTier,
        marksmanForm: previewTier === 'normal'
          ? 'compact-spiral-rail'
          : previewTier === 'skill'
            ? 'piercing-spiral-shot'
            : 'rail-breaker',
        realDistinctTierVfx: true,
        qualityTierProxy: false,
        presentationOnly: true,
        damageApplied: false,
        turnAdvanced: false
      };
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      return result;
    } catch (error) {
      console.error('[Combat2 2.16.2 Marksman Real 3-Tier Lab]', error);
      return {
        ok: false,
        reason: 'marksman-tier-vfx-threw',
        role: 'marksman',
        element,
        directVersion: TIER_UI_VERSION,
        marksmanAttackTier: previewTier
      };
    } finally {
      marksmanPlaying = false;
    }
  };

  api.play = async (requestedRole?: string | null, requestedElement?: CombatProjectileElement | null) => {
    if (String(requestedRole || '').toLowerCase() !== 'marksman') {
      return previousPlay(requestedRole, requestedElement);
    }
    return playTier('normal', requestedElement);
  };

  api.playMarksmanTier = async (
    requestedTier?: Combat2162MarksmanTier | string | null,
    requestedElement?: CombatProjectileElement | null
  ) => {
    if (!isPreviewTier(requestedTier)) {
      return { ok: false, reason: 'invalid-marksman-preview-tier', role: 'marksman', requestedTier };
    }
    return playTier(requestedTier, requestedElement);
  };

  root.POWDER_COMBAT2_VFX_LAB = api;
  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = api;
  root.POWDER_COMBAT2_2160_MARKSMAN_LAB = {
    version: '2.16.0',
    ready: true,
    supersededForTierQaBy: TIER_UI_VERSION,
    everyOtherRoleDelegated: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2162_MARKSMAN_TIER_UI = {
    version: TIER_UI_VERSION,
    ready: true,
    api: 'playMarksmanTier',
    tiers: ['normal', 'skill', 'ultimate'],
    realDistinctTierVfx: true,
    qualityTierProxy: false,
    normalForm: 'compact-spiral-rail',
    skillForm: 'piercing-spiral-shot',
    ultimateForm: 'rail-breaker',
    blocksConcurrentMarksmanPreview: true,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

installCombat2160MarksmanLabBridge();
