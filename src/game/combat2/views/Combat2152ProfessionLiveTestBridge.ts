import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';

const FLAG = '__powderCombat2152ProfessionLiveTestInstalled';
const SCENE_FLAG = '__powderCombat2152ProfessionLiveTestAttached';
const ROLE_ORDER = [
  'marksman', 'mage', 'fighter', 'knight', 'enchanter',
  'healer', 'musician', 'assassin', 'tank'
] as const;

type RoleKey = typeof ROLE_ORDER[number];
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
    const rows = runtimeRows(scene);
    const wanted = role ?? requestedRole();
    if (wanted) {
      const player = rows.find((row) => row.role === wanted && row.side === 'player');
      if (player) return player;
      const anySide = rows.find((row) => row.role === wanted);
      if (anySide) return anySide;
    }
    return rows.find((row) => row.side === 'player') ?? rows[0] ?? null;
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
      await attack.call(source.view, target.view.container.x, target.view.container.y);
      return {
        ok: true,
        role: source.role,
        source: source.instanceId,
        target: target.instanceId,
        presentationOnly: true,
        damageApplied: false,
        turnAdvanced: false
      };
    } finally {
      playing = false;
    }
  };

  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = {
    version: '2.15.2',
    ready: true,
    devOnly: true,
    roles: [...ROLE_ORDER],
    focusRole: requestedRole(),
    play,
    snapshot,
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
    if (root.POWDER_COMBAT2_PROFESSION_LIVE_TEST?.play === play) {
      root.POWDER_COMBAT2_PROFESSION_LIVE_TEST = {
        version: '2.15.2',
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

function installCombat2152ProfessionLiveTestBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  if (!isLocalDev()) {
    root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE = {
      version: '2.15.2', devOnly: true, installed: false,
      reason: 'non-localhost', combatLogicChanged: false
    };
    return;
  }

  const proto = BattleScene.prototype as any;
  const originalCreate = proto.create;
  if (typeof originalCreate === 'function') {
    proto.create = function combat2152ProfessionLiveTestCreate(this: RuntimeScene, ...args: any[]): void {
      originalCreate.apply(this, args);
      attachScene(this);
    };
  }

  const attachedImmediately = attachRunningBattleScene();
  if (!attachedImmediately && typeof window !== 'undefined') {
    [80, 240, 600].forEach((delay) => window.setTimeout(attachRunningBattleScene, delay));
  }

  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE = {
    version: '2.15.2',
    devOnly: true,
    installed: true,
    patchesFutureBattleSceneCreate: true,
    attachesAlreadyRunningBattleScene: true,
    boundedBootRetries: [80, 240, 600],
    livePowViewLookup: true,
    livePlayAttackLunge: true,
    autoDemoQuery: 'professionDemo=1',
    presentationOnly: true,
    damageApplied: false,
    turnAdvanced: false,
    combatLogicChanged: false
  };
}

installCombat2152ProfessionLiveTestBridge();
