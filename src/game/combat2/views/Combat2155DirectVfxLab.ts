import Phaser from 'phaser';
import type { CombatProjectileElement } from '../vfx/DirectionalElementProjectileVfx';

const VERSION = '2.15.5';
const FLAG = '__powderCombat2155DirectVfxLabInstalled';
const ROLES = ['marksman', 'mage', 'fighter', 'knight', 'enchanter', 'healer', 'musician', 'assassin', 'tank'] as const;
const MELEE = ['tank', 'fighter', 'knight', 'assassin'] as const;
const RANGED = ['marksman', 'mage', 'enchanter', 'healer', 'musician'] as const;

type RoleKey = typeof ROLES[number];
type TestGroup = 'all' | 'melee' | 'ranged';

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function choose<T>(values: readonly T[], avoid?: T | null): T {
  const pool = values.length > 1 && avoid !== undefined && avoid !== null
    ? values.filter((value) => value !== avoid)
    : [...values];
  return pool[Math.floor(Math.random() * pool.length)] ?? values[0];
}

function rolesFor(group: TestGroup): readonly RoleKey[] {
  if (group === 'melee') return MELEE;
  if (group === 'ranged') return RANGED;
  return ROLES;
}

function installCombat2155DirectVfxLab(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  if (!isLocalDev()) {
    root.POWDER_COMBAT2_VFX_LAB = { version: VERSION, ready: false, devOnly: true, reason: 'non-localhost' };
    return;
  }

  let playing = false;
  let seriesToken = 0;
  let lastRole: RoleKey | null = null;

  const play = async (requestedRole?: string | null, requestedElement?: CombatProjectileElement | null) => {
    if (playing) return { ok: false, reason: 'busy' };
    const runtime = root.POWDER_COMBAT2_PROFESSION_RUNTIME_TEST;
    if (!runtime?.ready || typeof runtime.playProfessionTier !== 'function') {
      return { ok: false, reason: 'live-profession-runtime-not-ready' };
    }

    const normalizedRole = ROLES.includes(requestedRole as RoleKey) ? requestedRole as RoleKey : choose(ROLES, lastRole);
    if (requestedElement) {
      return {
        ok: false,
        reason: 'element-preview-retired-use-source-pow',
        role: normalizedRole,
        requestedElement
      };
    }

    playing = true;
    lastRole = normalizedRole;
    try {
      const runtimeResult = await runtime.playProfessionTier(normalizedRole, 'normal');
      if (!runtimeResult?.ok) return runtimeResult;
      const result = {
        ...runtimeResult,
        requestedRole: normalizedRole,
        directFinalVfxOwner: false,
        liveRuntimeRoute: 'PowView.playAttackLunge + PowView.playHit',
        rosterIndependent: false,
        presentationOnly: true,
        damageApplied: false,
        turnAdvanced: false
      };
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      return result;
    } catch (error) {
      console.error('[Combat2 2.15.5 VFX Lab]', error);
      return { ok: false, reason: 'live-profession-runtime-threw', role: normalizedRole };
    } finally {
      playing = false;
    }
  };

  const playRandom = async (group: TestGroup = 'all') => {
    const role = choose(rolesFor(group), lastRole);
    return play(role, null);
  };

  const stopRandomSeries = () => {
    seriesToken += 1;
    return { ok: true, stopped: true, presentationOnly: true };
  };

  const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const playRandomSeries = async (group: TestGroup = 'all', requestedCount = 9) => {
    const count = Phaser.Math.Clamp(Math.floor(Number(requestedCount) || 1), 1, 24);
    const token = ++seriesToken;
    const results: any[] = [];
    for (let index = 0; index < count; index += 1) {
      if (token !== seriesToken) break;
      const result = await playRandom(group);
      results.push(result);
      root.POWDER_COMBAT2_RANDOM_VFX_PROGRESS = {
        version: VERSION,
        group,
        current: index + 1,
        total: count,
        lastRole: result?.role ?? null,
        lastElement: result?.element ?? null,
        lastOk: result?.ok === true
      };
      if (token !== seriesToken) break;
      await wait(group === 'melee' ? 260 : 330);
    }
    const final = {
      ok: results.some((item) => item?.ok),
      group,
      requestedCount: count,
      completedCount: results.length,
      cancelled: token !== seriesToken,
      results,
      directFinalVfxOwner: false,
      qaUsesLivePowViewAttack: true,
      qaUsesTargetHitFeedback: true,
      requiresMatchingPow: true,
      rosterIndependent: false,
      presentationOnly: true,
      damageApplied: false,
      turnAdvanced: false
    };
    root.POWDER_COMBAT2_RANDOM_VFX_LAST_SERIES = final;
    return final;
  };

  const api = {
    version: VERSION,
    ready: true,
    devOnly: true,
    roles: [...ROLES],
    meleeRoles: [...MELEE],
    rangedRoles: [...RANGED],
    play,
    playRandom,
    playRandomSeries,
    stopRandomSeries,
    maxRandomSeriesCount: 24,
    directFinalVfxOwner: false,
    qaUsesLivePowViewAttack: true,
    qaUsesTargetHitFeedback: true,
    requiresMatchingPow: true,
    rosterIndependent: false,
    activeFieldCoordinatesOnly: true,
    randomRoleAndElement: false,
    presentationOnly: true,
    damageApplied: false,
    turnAdvanced: false,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_VFX_LAB = api;
  // Preserve the existing UI contract: the switcher resolves this global at click time.
  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = api;
  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE = {
    version: VERSION,
    installed: true,
    directFinalVfxOwner: false,
    qaUsesLivePowViewAttack: true,
    qaUsesTargetHitFeedback: true,
    requiresMatchingPow: true,
    rosterIndependent: false,
    randomSingle: true,
    randomSeries: true,
    stoppableRandomSeries: true,
    randomGroups: ['all', 'melee', 'ranged'],
    maxRandomSeriesCount: 24,
    livePlayAttackLunge: true,
    presentationOnly: true,
    damageApplied: false,
    turnAdvanced: false,
    combatLogicChanged: false
  };
}

installCombat2155DirectVfxLab();
