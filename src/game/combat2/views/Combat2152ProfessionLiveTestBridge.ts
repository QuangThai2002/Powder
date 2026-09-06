import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';

const VERSION = '2.15.4';
const FLAG = '__powderCombat2154ProfessionLiveTestInstalled';
const SCENE_FLAG = '__powderCombat2154ProfessionLiveTestAttached';
const ROLE_ORDER = [
  'marksman', 'mage', 'fighter', 'knight', 'enchanter',
  'healer', 'musician', 'assassin', 'tank'
] as const;
const MELEE_ROLES = ['tank', 'fighter', 'knight', 'assassin'] as const;
const RANGED_ROLES = ['marksman', 'mage', 'enchanter', 'healer', 'musician'] as const;

type RoleKey = typeof ROLE_ORDER[number];
type TestGroup = 'all' | 'melee' | 'ranged';
type RuntimePowView = any;
type RuntimeScene = any;

function isLocalDev(): boolean {
  return typeof window !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function resolveRole(value: unknown): RoleKey | null {
  const role = normalize(value);
  if (role.includes('sat thu') || role.includes('assassin')) return 'assassin';
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('thuat si') || role.includes('enchanter')) return 'enchanter';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('dau si') || role.includes('fighter')) return 'fighter';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  return null;
}

function requestedRole(): RoleKey | null {
  if (typeof window === 'undefined') return null;
  return resolveRole(new URLSearchParams(window.location.search).get('profession'));
}

function requestedAutoDemo(): boolean {
  return typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('professionDemo') === '1';
}

function clearAutoDemoQuery(): void {
  if (typeof window === 'undefined' || !requestedAutoDemo()) return;
  const next = new URL(window.location.href);
  next.searchParams.delete('professionDemo');
  window.history.replaceState({}, '', next.toString());
}

function waitScene(scene: RuntimeScene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      scene?.events?.off?.(Phaser.Scenes.Events.SHUTDOWN, finish);
      scene?.events?.off?.(Phaser.Scenes.Events.DESTROY, finish);
      resolve();
    };
    scene?.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, finish);
    scene?.events?.once?.(Phaser.Scenes.Events.DESTROY, finish);
    try { scene?.time?.delayedCall?.(Math.max(0, ms), finish); }
    catch { finish(); }
  });
}

function runtimeRows(scene: RuntimeScene): Array<{
  instanceId: string;
  view: RuntimePowView;
  role: RoleKey | null;
  side: 'player' | 'enemy' | null;
}> {
  const map = scene?.powViews as Map<string, RuntimePowView> | undefined;
  if (!(map instanceof Map)) return [];
  return Array.from(map.entries()).map(([instanceId, view]) => ({
    instanceId,
    view,
    role: resolveRole(view?.pow?.role),
    side: instanceId.startsWith('player-') ? 'player' : instanceId.startsWith('enemy-') ? 'enemy' : null
  }));
}

function rolesForGroup(group: TestGroup): readonly RoleKey[] {
  if (group === 'melee') return MELEE_ROLES;
  if (group === 'ranged') return RANGED_ROLES;
  return ROLE_ORDER;
}

function attachScene(scene: RuntimeScene): boolean {
  const root = globalThis as any;
  const rowsNow = runtimeRows(scene);
  if (rowsNow.length === 0) return false;
  if (scene[SCENE_FLAG]) return true;
  scene[SCENE_FLAG] = true;

  const snapshot = () => runtimeRows(scene).map(({ instanceId, view, role, side }) => ({
    instanceId,
    side,
    role,
    powId: view?.pow?.id ?? null,
    powName: view?.pow?.name ?? null,
    roleLabel: view?.pow?.role ?? null,
    element: view?.pow?.elementKey ?? view?.pow?.element ?? null,
    x: Math.round(Number(view?.container?.x || 0)),
    y: Math.round(Number(view?.container?.y || 0)),
    scaleX: Number(Number(view?.container?.scaleX || 0).toFixed(3)),
    visible: Boolean(view?.container?.visible),
    alpha: Number(Number(view?.container?.alpha || 0).toFixed(2))
  }));

  const pickSource = (role?: RoleKey | null) => {
    const rows = runtimeRows(scene).filter((row) =>
      Boolean(row.view?.container?.visible)
      && Number(row.view?.container?.alpha || 0) > 0.35
      && typeof row.view?.playAttackLunge === 'function'
    );
    const wanted = role ?? requestedRole();
    if (wanted) {
      const activePlayer = rows.find((row) => row.role === wanted && row.side === 'player' && Number(row.view?.container?.scaleX || 0) >= 0.7);
      if (activePlayer) return activePlayer;
      const activeAny = rows.find((row) => row.role === wanted && Number(row.view?.container?.scaleX || 0) >= 0.7);
      if (activeAny) return activeAny;
      const anyRole = rows.find((row) => row.role === wanted);
      if (anyRole) return anyRole;
    }
    return rows.find((row) => row.side === 'player' && Number(row.view?.container?.scaleX || 0) >= 0.7)
      ?? rows.find((row) => row.side === 'player')
      ?? rows[0]
      ?? null;
  };

  const pickTarget = (sourceSide: 'player' | 'enemy' | null) => {
    const targetSide = sourceSide === 'enemy' ? 'player' : 'enemy';
    const rows = runtimeRows(scene).filter((row) =>
      row.side === targetSide
      && Number(row.view?.container?.alpha || 0) > 0.45
      && Boolean(row.view?.container?.visible)
    );
    return rows.find((row) => Number(row.view?.container?.scaleX || 0) >= 0.7) ?? rows[0] ?? null;
  };

  let playing = false;
  let seriesToken = 0;
  let lastRandomRole: RoleKey | null = null;

  const play = async (requested?: string | null) => {
    if (playing) return { ok: false, reason: 'busy', snapshot: snapshot() };
    const role = resolveRole(requested) ?? requestedRole();
    const source = pickSource(role);
    if (!source) return { ok: false, reason: 'source-not-found', role, snapshot: snapshot() };
    const target = pickTarget(source.side);
    if (!target) return { ok: false, reason: 'target-not-found', role, source: source.instanceId, snapshot: snapshot() };
    const attack = source.view?.playAttackLunge;
    if (typeof attack !== 'function') {
      return { ok: false, reason: 'playAttackLunge-missing', role, source: source.instanceId, target: target.instanceId };
    }

    playing = true;
    try {
      const point = typeof target.view?.getWorldPosition === 'function'
        ? target.view.getWorldPosition()
        : target.view.container;
      await attack.call(source.view, point.x, point.y);
      if (typeof target.view?.playHit === 'function') await target.view.playHit();
      return {
        ok: true,
        role: source.role,
        source: source.instanceId,
        target: target.instanceId,
        targetHitFeedback: true,
        presentationOnly: true,
        damageApplied: false,
        turnAdvanced: false
      };
    } finally {
      playing = false;
    }
  };

  const availableRandomRoles = (group: TestGroup): RoleKey[] => {
    const allowed = new Set<RoleKey>(rolesForGroup(group));
    const rows = runtimeRows(scene).filter((row) =>
      row.role
      && allowed.has(row.role)
      && Boolean(row.view?.container?.visible)
      && Number(row.view?.container?.alpha || 0) > 0.35
      && typeof row.view?.playAttackLunge === 'function'
    );
    return Array.from(new Set(rows.map((row) => row.role).filter((role): role is RoleKey => Boolean(role))));
  };

  const pickRandomRole = (group: TestGroup): RoleKey | null => {
    let roles = availableRandomRoles(group);
    if (roles.length > 1 && lastRandomRole) roles = roles.filter((role) => role !== lastRandomRole);
    if (roles.length === 0) return null;
    const role = roles[Math.floor(Math.random() * roles.length)] ?? roles[0];
    lastRandomRole = role;
    return role;
  };

  const playRandom = async (group: TestGroup = 'all') => {
    const role = pickRandomRole(group);
    if (!role) return { ok: false, reason: 'no-random-role-available', group };
    const result = await play(role);
    return { ...result, random: true, group, requestedRole: role };
  };

  const stopSeries = () => {
    seriesToken += 1;
    return { ok: true, stopped: true, presentationOnly: true };
  };

  const playRandomSeries = async (group: TestGroup = 'all', requestedCount = 9) => {
    const count = Phaser.Math.Clamp(Math.floor(Number(requestedCount) || 1), 1, 24);
    const token = ++seriesToken;
    const results: any[] = [];
    for (let index = 0; index < count; index += 1) {
      if (token !== seriesToken) break;
      const result = await playRandom(group);
      results.push(result);
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      root.POWDER_COMBAT2_RANDOM_VFX_PROGRESS = {
        version: VERSION,
        group,
        current: index + 1,
        total: count,
        lastRole: ('role' in result ? result.role : null)
          ?? ('requestedRole' in result ? result.requestedRole : null),
        cancelled: token !== seriesToken
      };
      if (token !== seriesToken) break;
      await waitScene(scene, group === 'melee' ? 210 : 260);
    }
    const cancelled = token !== seriesToken;
    return {
      ok: results.some((row) => row?.ok),
      group,
      requestedCount: count,
      completedCount: results.length,
      cancelled,
      results,
      presentationOnly: true,
      damageApplied: false,
      turnAdvanced: false
    };
  };

  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = {
    version: VERSION,
    ready: true,
    devOnly: true,
    roles: [...ROLE_ORDER],
    meleeRoles: [...MELEE_ROLES],
    rangedRoles: [...RANGED_ROLES],
    focusRole: requestedRole(),
    play,
    playRandom,
    playRandomSeries,
    stopRandomSeries: stopSeries,
    snapshot,
    maxRandomSeriesCount: 24,
    usesLivePowViewPlayAttackLunge: true,
    presentationOnly: true,
    damageApplied: false,
    turnAdvanced: false,
    combatLogicChanged: false
  };

  if (requestedAutoDemo()) {
    clearAutoDemoQuery();
    scene.time.delayedCall(1650, () => {
      void play(requestedRole()).then((result: any) => {
        root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      });
    });
  }

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    seriesToken += 1;
    if (root.POWDER_COMBAT2_PROFESSION_LIVE_TEST?.play === play) {
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = {
        version: VERSION,
        ready: false,
        devOnly: true,
        reason: 'scene-shutdown',
        combatLogicChanged: false
      };
    }
  });
  return true;
}

function attachRunningBattleScene(): boolean {
  const games = ((Phaser as any).GAMES ?? []) as Phaser.Game[];
  for (const game of games) {
    try {
      const scene = game.scene.getScene('BattleScene') as RuntimeScene | null;
      if (scene && attachScene(scene)) return true;
    } catch { /* BattleScene may not be registered yet */ }
  }
  return false;
}

function installCombat2154ProfessionLiveTestBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  if (!isLocalDev()) {
    root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE = {
      version: VERSION, devOnly: true, installed: false,
      reason: 'non-localhost', combatLogicChanged: false
    };
    return;
  }

  const proto = BattleScene.prototype as any;
  const originalCreate = proto.create;
  if (typeof originalCreate === 'function') {
    proto.create = function combat2154ProfessionLiveTestCreate(this: RuntimeScene, ...args: any[]): void {
      originalCreate.apply(this, args);
      attachScene(this);
    };
  }

  const attachedImmediately = attachRunningBattleScene();
  if (!attachedImmediately && typeof window !== 'undefined') {
    [80, 240, 600].forEach((delay) => window.setTimeout(attachRunningBattleScene, delay));
  }

  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE = {
    version: VERSION,
    devOnly: true,
    installed: true,
    patchesFutureBattleSceneCreate: true,
    attachesAlreadyRunningBattleScene: true,
    boundedBootRetries: [80, 240, 600],
    livePowViewLookup: true,
    livePlayAttackLunge: true,
    randomSingle: true,
    randomSeries: true,
    randomGroups: ['all', 'melee', 'ranged'],
    maxRandomSeriesCount: 24,
    stoppableRandomSeries: true,
    autoDemoQuery: 'professionDemo=1',
    presentationOnly: true,
    damageApplied: false,
    turnAdvanced: false,
    combatLogicChanged: false
  };
}

installCombat2154ProfessionLiveTestBridge();
