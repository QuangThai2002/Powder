import type { CombatProjectileElement } from '../vfx/DirectionalElementProjectileVfx';
import type { Combat2163MarksmanTier } from '../vfx/Combat2163MarksmanDistinctTierVfx';
import { COMBAT2164_MARKSMAN_RUNTIME_VERSION } from '../vfx/Combat2164MarksmanRuntimeTierBridge';

const FLAG = '__powderCombat2160MarksmanLabBridgeInstalled';

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function isPreviewTier(value: unknown): value is Combat2163MarksmanTier {
  return value === 'normal' || value === 'skill' || value === 'ultimate';
}

function installCombat2160MarksmanLabBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;
  if (!isLocalDev()) return;

  const runtime = root.POWDER_COMBAT2_MARKSMAN_RUNTIME_TEST;
  const api = root.POWDER_COMBAT2_VFX_LAB ?? root.POWDER_COMBAT2_PROFESSION_LIVE_TEST;

  if (!runtime || typeof runtime.playMarksmanTier !== 'function') {
    root.POWDER_COMBAT2_2163_MARKSMAN_TIER_UI = {
      version: '2.16.3',
      ready: false,
      runtimeVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
      reason: 'runtime-marksman-api-missing'
    };
    return;
  }

  if (!api || typeof api.play !== 'function') {
    // The Marksman buttons still get a working direct API even if the older generic lab is absent.
    const directOnlyApi = {
      ready: true,
      playMarksmanTier: runtime.playMarksmanTier,
      play: async (requestedRole?: string | null, requestedElement?: CombatProjectileElement | null) => {
        if (String(requestedRole || '').toLowerCase() !== 'marksman') {
          return { ok: false, reason: 'generic-vfx-lab-missing', role: requestedRole ?? null };
        }
        return runtime.playMarksmanTier('normal', requestedElement);
      }
    };
    root.POWDER_COMBAT2_VFX_LAB = directOnlyApi;
    root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = directOnlyApi;
  } else {
    const previousPlay = api.play.bind(api);
    api.ready = true;
    api.playMarksmanTier = async (
      requestedTier?: Combat2163MarksmanTier | string | null,
      requestedElement?: CombatProjectileElement | null
    ) => {
      if (!isPreviewTier(requestedTier)) {
        return { ok: false, reason: 'invalid-marksman-preview-tier', role: 'marksman', requestedTier };
      }
      return runtime.playMarksmanTier(requestedTier, requestedElement);
    };
    api.play = async (requestedRole?: string | null, requestedElement?: CombatProjectileElement | null) => {
      if (String(requestedRole || '').toLowerCase() === 'marksman') {
        return runtime.playMarksmanTier('normal', requestedElement);
      }
      return previousPlay(requestedRole, requestedElement);
    };
    root.POWDER_COMBAT2_VFX_LAB = api;
    root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = api;
  }

  root.POWDER_COMBAT2_2160_MARKSMAN_LAB = {
    version: '2.16.0',
    ready: true,
    supersededForTierQaBy: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
    everyOtherRoleDelegated: true,
    runtimeDirectQa: true,
    combatLogicChanged: false
  };

  // Keep the 2.16.3 QA metadata shape for the existing UI/regression, but route execution
  // through the 2.16.4 runtime bridge that also owns real combat tier selection.
  root.POWDER_COMBAT2_2163_MARKSMAN_TIER_UI = {
    version: '2.16.3',
    runtimeVersion: COMBAT2164_MARKSMAN_RUNTIME_VERSION,
    ready: true,
    api: 'playMarksmanTier',
    tiers: ['normal', 'skill', 'ultimate'],
    realDistinctTierVfx: true,
    sharedTopology: false,
    sharedBodyRenderer: false,
    qualityTierProxy: false,
    normalForm: 'compact-spiral-rail',
    normalSilhouette: 'single-compact-bolt',
    skillForm: 'piercing-triple-rail-shot',
    skillSilhouette: 'center-bolt-plus-two-side-rail-blades',
    ultimateForm: 'rail-breaker-heavy-slug',
    ultimateSilhouette: 'heavy-rail-slug-plus-shock-cone-plus-three-compression-rings',
    runtimeDirectQa: true,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

installCombat2160MarksmanLabBridge();
