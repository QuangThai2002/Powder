import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from '../vfx/DirectionalElementProjectileVfx';

const VERSION = '2.15.5';
const FLAG = '__powderCombat2155DirectVfxLabInstalled';
const ROLES = ['marksman', 'mage', 'fighter', 'knight', 'enchanter', 'healer', 'musician', 'assassin', 'tank'] as const;
const MELEE = ['fighter', 'knight', 'assassin'] as const;
const RANGED = ['marksman', 'mage', 'enchanter', 'healer', 'musician', 'tank'] as const;
const ELEMENTS: readonly CombatProjectileElement[] = [
  'fire', 'water', 'ice', 'lightning', 'wind', 'leaf', 'poison',
  'earth', 'steel', 'light', 'dark', 'lava', 'storm'
];

type RoleKey = typeof ROLES[number];
type TestGroup = 'all' | 'melee' | 'ranged';
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
      if (scene?.sys?.isActive?.() !== false && scene?.powViews instanceof Map) return scene;
    } catch { /* game may still be booting */ }
  }
  return null;
}

function rows(scene: any): RuntimeRow[] {
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

function activeRow(list: RuntimeRow[], side: 'player' | 'enemy'): RuntimeRow | null {
  const same = list.filter((row) => row.side === side);
  return same.find((row) => Number(row.view?.container?.scaleX ?? 0) >= 0.7) ?? same[0] ?? null;
}

function pointOf(view: any): Phaser.Math.Vector2 {
  try {
    if (typeof view?.getVfxAnchor === 'function') return view.getVfxAnchor('body');
    if (typeof view?.getWorldPosition === 'function') return view.getWorldPosition();
  } catch { /* fallback to container coordinates */ }
  return new Phaser.Math.Vector2(Number(view?.container?.x ?? 0), Number(view?.container?.y ?? 0));
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
  let lastElement: CombatProjectileElement | null = null;

  const play = async (requestedRole?: string | null, requestedElement?: CombatProjectileElement | null) => {
    if (playing) return { ok: false, reason: 'busy' };
    const scene = findScene();
    if (!scene) return { ok: false, reason: 'battle-scene-not-ready' };
    const visible = rows(scene);
    const sourceRow = activeRow(visible, 'player');
    const targetRow = activeRow(visible, 'enemy');
    if (!sourceRow || !targetRow) return { ok: false, reason: 'active-source-or-target-missing' };

    const normalizedRole = ROLES.includes(requestedRole as RoleKey) ? requestedRole as RoleKey : choose(ROLES, lastRole);
    const element = requestedElement && ELEMENTS.includes(requestedElement)
      ? requestedElement
      : choose(ELEMENTS, lastElement);
    const source = pointOf(sourceRow.view);
    const target = pointOf(targetRow.view);
    const options: RoleAwareOptions = {
      scene,
      source,
      target,
      element,
      reducedMotion: false,
      role: normalizedRole
    };

    playing = true;
    lastRole = normalizedRole;
    lastElement = element;
    try {
      const finalPlay = DirectionalElementProjectileVfx.play as unknown as (runtime: RoleAwareOptions) => Promise<void>;
      await finalPlay(options);
      const result = {
        ok: true,
        role: normalizedRole,
        requestedRole: normalizedRole,
        element,
        source: sourceRow.instanceId,
        target: targetRow.instanceId,
        directFinalVfxOwner: true,
        rosterIndependent: true,
        presentationOnly: true,
        damageApplied: false,
        turnAdvanced: false
      };
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      return result;
    } catch (error) {
      console.error('[Combat2 2.15.5 VFX Lab]', error);
      return { ok: false, reason: 'vfx-owner-threw', role: normalizedRole, element };
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
      directFinalVfxOwner: true,
      rosterIndependent: true,
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
    elements: [...ELEMENTS],
    play,
    playRandom,
    playRandomSeries,
    stopRandomSeries,
    maxRandomSeriesCount: 24,
    directFinalVfxOwner: true,
    rosterIndependent: true,
    activeFieldCoordinatesOnly: true,
    randomRoleAndElement: true,
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
    directFinalVfxOwner: true,
    rosterIndependent: true,
    randomSingle: true,
    randomSeries: true,
    stoppableRandomSeries: true,
    randomGroups: ['all', 'melee', 'ranged'],
    maxRandomSeriesCount: 24,
    livePlayAttackLunge: false,
    presentationOnly: true,
    damageApplied: false,
    turnAdvanced: false,
    combatLogicChanged: false
  };
}

installCombat2155DirectVfxLab();
