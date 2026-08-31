import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from '../vfx/DirectionalElementProjectileVfx';
import {
  COMBAT2160_MARKSMAN_VERSION,
  playCombat2160MarksmanSpiralRailBoltVfx
} from '../vfx/Combat2160MarksmanSpiralRailBoltVfx';

const FLAG = '__powderCombat2160MarksmanLabBridgeInstalled';
const TIER_UI_VERSION = '2.16.1';

type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };
type MarksmanPreviewTier = 'normal' | 'skill' | 'ultimate';
type PreviewFxTier = 'lite' | 'balanced' | 'full';
type RuntimeRow = {
  instanceId: string;
  side: 'player' | 'enemy';
  view: any;
};

const PREVIEW_FX_TIER: Readonly<Record<MarksmanPreviewTier, PreviewFxTier>> = Object.freeze({
  normal: 'lite',
  skill: 'balanced',
  ultimate: 'full'
});

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

function isPreviewTier(value: unknown): value is MarksmanPreviewTier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function installCombat2160MarksmanLabBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;
  if (!isLocalDev()) return;

  const api = root.POWDER_COMBAT2_VFX_LAB ?? root.POWDER_COMBAT2_PROFESSION_LIVE_TEST;
  if (!api || typeof api.play !== 'function') {
    root.POWDER_COMBAT2_2160_MARKSMAN_LAB = {
      version: COMBAT2160_MARKSMAN_VERSION,
      ready: false,
      reason: 'base-vfx-lab-missing'
    };
    root.POWDER_COMBAT2_2161_MARKSMAN_TIER_UI = {
      version: TIER_UI_VERSION,
      ready: false,
      reason: 'base-vfx-lab-missing'
    };
    return;
  }

  const previousPlay = api.play.bind(api);
  let marksmanPlaying = false;

  const playDirectMarksman = async (
    requestedElement?: CombatProjectileElement | null,
    previewTier?: MarksmanPreviewTier
  ) => {
    if (marksmanPlaying) {
      return { ok: false, reason: 'marksman-preview-busy', role: 'marksman', marksmanAttackTier: previewTier ?? null };
    }

    const scene = findScene();
    if (!scene) return { ok: false, reason: 'battle-scene-not-ready', role: 'marksman' };
    const rows = visibleRows(scene);
    const sourceRow = pickActive(rows, 'player');
    const targetRow = pickActive(rows, 'enemy');
    if (!sourceRow || !targetRow) {
      return { ok: false, reason: 'active-source-or-target-missing', role: 'marksman' };
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

    const forcedFxTier = previewTier ? PREVIEW_FX_TIER[previewTier] : null;
    const hadFxTier = Object.prototype.hasOwnProperty.call(root, 'POWDER_COMBAT2_FX_TIER');
    const previousFxTier = root.POWDER_COMBAT2_FX_TIER;

    marksmanPlaying = true;
    if (forcedFxTier) root.POWDER_COMBAT2_FX_TIER = forcedFxTier;

    try {
      await playCombat2160MarksmanSpiralRailBoltVfx(options);
      const result = {
        ok: true,
        role: 'marksman',
        element,
        source: sourceRow.instanceId,
        target: targetRow.instanceId,
        directMarksmanRuntime: true,
        directVersion: COMBAT2160_MARKSMAN_VERSION,
        tierUiVersion: TIER_UI_VERSION,
        marksmanAttackTier: previewTier ?? null,
        previewFxTier: forcedFxTier,
        marksmanForm: 'spiral-rail-bolt',
        usesSameFunctionAsRealCombat: true,
        bypassesGenericOwnerStack: true,
        presentationOnly: true,
        damageApplied: false,
        turnAdvanced: false
      };
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      return result;
    } catch (error) {
      console.error('[Combat2 2.16.1 Marksman 3-Tier Lab]', error);
      return {
        ok: false,
        reason: 'spiral-rail-bolt-threw',
        role: 'marksman',
        element,
        directVersion: COMBAT2160_MARKSMAN_VERSION,
        tierUiVersion: TIER_UI_VERSION,
        marksmanAttackTier: previewTier ?? null,
        previewFxTier: forcedFxTier
      };
    } finally {
      if (forcedFxTier) {
        if (hadFxTier) root.POWDER_COMBAT2_FX_TIER = previousFxTier;
        else delete root.POWDER_COMBAT2_FX_TIER;
      }
      marksmanPlaying = false;
    }
  };

  api.play = async (requestedRole?: string | null, requestedElement?: CombatProjectileElement | null) => {
    if (String(requestedRole || '').toLowerCase() !== 'marksman') {
      return previousPlay(requestedRole, requestedElement);
    }
    return playDirectMarksman(requestedElement);
  };

  api.playMarksmanTier = async (
    requestedTier?: MarksmanPreviewTier | string | null,
    requestedElement?: CombatProjectileElement | null
  ) => {
    if (!isPreviewTier(requestedTier)) {
      return { ok: false, reason: 'invalid-marksman-preview-tier', role: 'marksman', requestedTier };
    }
    return playDirectMarksman(requestedElement, requestedTier);
  };

  root.POWDER_COMBAT2_VFX_LAB = api;
  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = api;
  root.POWDER_COMBAT2_2160_MARKSMAN_LAB = {
    version: COMBAT2160_MARKSMAN_VERSION,
    ready: true,
    marksmanButtonDirect: true,
    marksmanForm: 'spiral-rail-bolt',
    usesSameFunctionAsRealCombat: true,
    bypassesGenericOwnerStack: true,
    everyOtherRoleDelegated: true,
    tierPreviewApi: true,
    combatLogicChanged: false
  };
  root.POWDER_COMBAT2_2161_MARKSMAN_TIER_UI = {
    version: TIER_UI_VERSION,
    ready: true,
    api: 'playMarksmanTier',
    tiers: ['normal', 'skill', 'ultimate'],
    mapping: { ...PREVIEW_FX_TIER },
    restoresPreviousFxTier: true,
    blocksConcurrentMarksmanPreview: true,
    sameSpiralRailFunction: true,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

installCombat2160MarksmanLabBridge();
