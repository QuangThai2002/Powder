import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';
import { PowView } from './PowView';

const FLAG = '__powderCombat2152ProfessionLiveTestInstalled';
const ROLE_ORDER = [
  'marksman', 'mage', 'fighter', 'knight', 'enchanter',
  'healer', 'musician', 'assassin', 'tank'
] as const;

type RoleKey = typeof ROLE_ORDER[number];

type RuntimePowView = PowView & {
  pow?: { id?: string; name?: string; role?: string; element?: string; elementKey?: string };
  side?: 'player' | 'enemy';
  playAttackLunge?: (targetX: number, targetY: number) => Promise<void>;
};

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
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('professionDemo') === '1';
}

function clearAutoDemoQuery(): void {
  if (typeof window === 'undefined' || !requestedAutoDemo()) return;
  const next = new URL(window.location.href);
  next.searchParams.delete('professionDemo');
  window.history.replaceState({}, '', next.toString());
}

function installCombat2152ProfessionLiveTestBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  if (!isLocalDev()) {
    root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE = {
      version: '2.15.2',
      devOnly: true,
      installed: false,
      reason: 'non-localhost',
      combatLogicChanged: false
    };
    return;
  }

  const proto = BattleScene.prototype as any;
  const originalCreate = proto.create;
  if (typeof originalCreate !== 'function') return;

  proto.create = function combat2152ProfessionLiveTestCreate(this: BattleScene & any, ...args: any[]): void {
    originalCreate.apply(this, args);

    const scene = this;
    const views = (): Array<{ instanceId: string; view: RuntimePowView; role: RoleKey | null; side: 'player' | 'enemy' | null }> => {
      const map = scene.powViews as Map<string, RuntimePowView> | undefined;
      if (!(map instanceof Map)) return [];
      return Array.from(map.entries()).map(([instanceId, view]) => {
        const runtime = view as any;
        return {
          instanceId,
          view,
          role: resolveRole(runtime.pow?.role),
          side: instanceId.startsWith('player-') ? 'player' : instanceId.startsWith('enemy-') ? 'enemy' : null
        };
      });
    };

    const snapshot = () => views().map(({ instanceId, view, role, side }) => {
      const runtime = view as any;
      return {
        instanceId,
        side,
        role,
        powId: runtime.pow?.id ?? null,
        powName: runtime.pow?.name ?? null,
        roleLabel: runtime.pow?.role ?? null,
        element: runtime.pow?.elementKey ?? runtime.pow?.element ?? null,
        x: Math.round(view.container.x),
        y: Math.round(view.container.y),
        scaleX: Number(view.container.scaleX.toFixed(3)),
        visible: view.container.visible,
        alpha: Number(view.container.alpha.toFixed(2))
      };
    });

    const pickSource = (role?: RoleKey | null) => {
      const rows = views();
      const wanted = role ?? requestedRole();
      if (wanted) {
        const player = rows.find((row) => row.role === wanted && row.side === 'player');
        if (player) return player;
        const any = rows.find((row) => row.role === wanted);
        if (any) return any;
      }
      return rows.find((row) => row.side === 'player') ?? rows[0] ?? null;
    };

    const pickTarget = (sourceSide: 'player' | 'enemy' | null) => {
      const targetSide = sourceSide === 'enemy' ? 'player' : 'enemy';
      const rows = views().filter((row) => row.side === targetSide && row.view.container.alpha > 0.45 && row.view.container.visible);
      const activeLooking = rows.find((row) => row.view.container.scaleX >= 0.7);
      return activeLooking ?? rows[0] ?? null;
    };

    let playing = false;
    const play = async (requested?: string | null) => {
      if (playing) return { ok: false, reason: 'busy', snapshot: snapshot() };
      const role = resolveRole(requested) ?? requestedRole();
      const source = pickSource(role);
      if (!source) return { ok: false, reason: 'source-not-found', role, snapshot: snapshot() };
      const target = pickTarget(source.side);
      if (!target) return { ok: false, reason: 'target-not-found', role, source: source.instanceId, snapshot: snapshot() };
      const attack = (source.view as any).playAttackLunge;
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
      scene.time.delayedCall(1850, () => {
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
  };

  root.POWDER_COMBAT2_PROFESSION_LIVE_TEST_BRIDGE = {
    version: '2.15.2',
    devOnly: true,
    installed: true,
    patchesBattleSceneCreate: true,
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
