import { BattleScene } from '../scenes/BattleScene';
import { COMBAT2_STARTER_ROSTER, ALL_COMBAT2_STARTER_POWS } from '../data/PowderDataAdapter';
import type { CombatPow } from '../data/CombatPow';

const VERSION = '2.15.6';
const STORAGE_KEY = 'powder.combat2.test-roster.v2156';
const START_KEY = 'powder.combat2.test-roster.start.v2156';
const FLAG = '__powderCombat2156PreBattleRandomizerInstalled';
const SCENE_FLAG = '__powderCombat2156PausedForPreBattleSetup';

type SavedSetup = { version: string; order: string[] };

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function hasHandoffRequest(): boolean {
  return Boolean((window as any).POWDER_COMBAT2_HANDOFF?.readBattleRequest?.()?.ok);
}

function isHandoffLaunch(): boolean {
  return typeof window !== 'undefined' && Boolean(new URLSearchParams(window.location.search).get('battle'));
}

function uniquePool(): CombatPow[] {
  const map = new Map<string, CombatPow>();
  [...COMBAT2_STARTER_ROSTER.player, ...COMBAT2_STARTER_ROSTER.enemy].forEach((pow) => {
    if (pow?.id && !map.has(pow.id)) map.set(pow.id, pow);
  });
  return Array.from(map.values());
}

function readSavedOrder(pool: CombatPow[]): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSetup;
    const ids = Array.isArray(parsed?.order) ? parsed.order.map(String) : [];
    const allowed = new Set(pool.map((pow) => pow.id));
    if (ids.length !== 10 || new Set(ids).size !== 10 || ids.some((id) => !allowed.has(id))) return null;
    return ids;
  } catch {
    return null;
  }
}

function applyOrder(order: string[], pool: CombatPow[]): boolean {
  const byId = new Map(pool.map((pow) => [pow.id, pow] as const));
  const pows = order.map((id) => byId.get(id)).filter((pow): pow is CombatPow => Boolean(pow));
  if (pows.length !== 10 || new Set(pows.map((pow) => pow.id)).size !== 10) return false;

  const player = pows.slice(0, 5);
  const enemy = pows.slice(5, 10);
  COMBAT2_STARTER_ROSTER.player.splice(0, COMBAT2_STARTER_ROSTER.player.length, ...player);
  COMBAT2_STARTER_ROSTER.enemy.splice(0, COMBAT2_STARTER_ROSTER.enemy.length, ...enemy);
  ALL_COMBAT2_STARTER_POWS.splice(0, ALL_COMBAT2_STARTER_POWS.length, ...enemy, ...player);
  return true;
}

function shouldStartImmediately(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(START_KEY) === '1';
}

function persistOrder(order: string[]): void {
  const payload: SavedSetup = { version: VERSION, order: [...order] };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function installPauseBridge(): void {
  const proto = BattleScene.prototype as any;
  const originalCreate = proto.create;
  if (typeof originalCreate !== 'function' || proto.__combat2156PreBattleCreateWrapped) return;
  proto.__combat2156PreBattleCreateWrapped = true;

  proto.create = function combat2156PreBattleCreate(this: any, ...args: any[]): void {
    originalCreate.apply(this, args);
    if (!isLocalDev() || shouldStartImmediately() || hasHandoffRequest() || isHandoffLaunch()) return;
    this[SCENE_FLAG] = true;
    try { this.scene.pause(); } catch { /* setup overlay still blocks interaction */ }
    (globalThis as any).POWDER_COMBAT2_PREBATTLE_PAUSED_SCENE = this;
  };
}

function installSetupUi(pool: CombatPow[], defaultOrder: string[]): void {
  if (!isLocalDev() || hasHandoffRequest() || isHandoffLaunch() || typeof document === 'undefined') return;
  if (document.getElementById('combat2-prebattle-randomizer')) return;

  if (shouldStartImmediately()) {
    const reopen = document.createElement('button');
    reopen.id = 'combat2-prebattle-reopen';
    reopen.type = 'button';
    reopen.textContent = 'CẤU HÌNH TEST';
    reopen.style.cssText = [
      'position:fixed', 'left:12px', 'top:12px', 'z-index:100000',
      'border:1px solid rgba(255,214,118,.6)', 'border-radius:8px',
      'background:rgba(5,18,29,.92)', 'color:#fff1c6', 'padding:8px 11px',
      'font:bold 12px Arial,sans-serif', 'cursor:pointer'
    ].join(';');
    reopen.addEventListener('click', () => {
      window.sessionStorage.removeItem(START_KEY);
      window.location.reload();
    });
    document.body.appendChild(reopen);
    return;
  }

  const byId = new Map(pool.map((pow) => [pow.id, pow] as const));
  let draft = [...defaultOrder];

  const overlay = document.createElement('div');
  overlay.id = 'combat2-prebattle-randomizer';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:100000', 'overflow:auto',
    'background:rgba(2,8,14,.96)', 'backdrop-filter:blur(6px)',
    'font-family:Arial,sans-serif', 'color:#eef8ff', 'padding:22px'
  ].join(';');

  const shell = document.createElement('div');
  shell.style.cssText = [
    'max-width:1180px', 'margin:0 auto', 'padding:18px',
    'border:1px solid rgba(132,210,255,.38)', 'border-radius:14px',
    'background:rgba(7,21,34,.96)', 'box-shadow:0 18px 60px rgba(0,0,0,.45)'
  ].join(';');

  const title = document.createElement('div');
  title.innerHTML = '<div style="font-size:22px;font-weight:900;color:#fff4c8">COMBAT2 · CẤU HÌNH TEST TRƯỚC TRẬN</div><div style="margin-top:6px;color:#abdff8;line-height:1.5">Random chỉ đổi đội hình. Bạn có thể đổi từng Pow sau khi random. Trận đấu chỉ bắt đầu khi bấm <b>BẮT ĐẦU TRẬN</b>.</div>';
  shell.appendChild(title);

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:14px 0';
  const makeButton = (label: string, accent: string, onClick: () => void) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      `border:1px solid ${accent}`, 'border-radius:8px', 'background:rgba(255,255,255,.05)',
      'color:#eef8ff', 'padding:9px 13px', 'font-weight:800', 'cursor:pointer'
    ].join(';');
    button.addEventListener('click', onClick);
    toolbar.appendChild(button);
    return button;
  };
  shell.appendChild(toolbar);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:10px';
  shell.appendChild(grid);

  const render = (): void => {
    grid.replaceChildren();
    draft.forEach((id, index) => {
      const pow = byId.get(id);
      if (!pow) return;
      const card = document.createElement('div');
      card.style.cssText = [
        'min-width:0', 'padding:9px', 'border-radius:10px',
        `border:1px solid ${index < 5 ? 'rgba(84,198,255,.34)' : 'rgba(255,140,112,.34)'}`,
        'background:rgba(255,255,255,.035)'
      ].join(';');

      const side = document.createElement('div');
      side.textContent = `${index < 5 ? 'ĐỘI BẠN' : 'ĐỘI ĐỊCH'} · SLOT ${(index % 5) + 1}${index % 5 >= 3 ? ' · DỰ BỊ' : ' · CHÍNH'}`;
      side.style.cssText = 'font-size:10px;font-weight:800;color:#9ddbf8;margin-bottom:6px';

      const img = document.createElement('img');
      img.src = pow.assetUrl;
      img.alt = pow.name;
      img.style.cssText = 'display:block;width:100%;height:112px;object-fit:contain;border-radius:7px;background:rgba(0,0,0,.18)';

      const name = document.createElement('div');
      name.textContent = pow.name;
      name.style.cssText = 'font-weight:900;margin:7px 0 3px;color:#fff';

      const meta = document.createElement('div');
      meta.textContent = `${pow.role} · ${pow.element}`;
      meta.style.cssText = 'font-size:11px;color:#b8dbea;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

      const select = document.createElement('select');
      select.style.cssText = 'width:100%;background:#0b2030;color:#eef8ff;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:6px';
      pool.forEach((candidate) => {
        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = `${candidate.name} · ${candidate.role} · ${candidate.element}`;
        option.selected = candidate.id === id;
        select.appendChild(option);
      });
      select.addEventListener('change', () => {
        const nextId = select.value;
        const existing = draft.indexOf(nextId);
        if (existing >= 0 && existing !== index) {
          [draft[index], draft[existing]] = [draft[existing], draft[index]];
        } else {
          draft[index] = nextId;
        }
        render();
      });

      card.append(side, img, name, meta, select);
      grid.appendChild(card);
    });
  };

  makeButton('🎲 RANDOM 10 POW', 'rgba(142,215,255,.68)', () => {
    draft = shuffle(draft);
    render();
  });
  makeButton('↺ ĐẶT LẠI', 'rgba(205,205,205,.4)', () => {
    draft = [...defaultOrder];
    render();
  });
  const startButton = makeButton('▶ BẮT ĐẦU TRẬN VỚI CẤU HÌNH NÀY', 'rgba(255,211,106,.78)', () => {
    persistOrder(draft);
    window.sessionStorage.setItem(START_KEY, '1');
    const next = new URL(window.location.href);
    next.searchParams.delete('profession');
    next.searchParams.delete('professionDemo');
    window.location.assign(next.toString());
  });
  startButton.style.background = 'rgba(130,91,14,.32)';
  startButton.style.color = '#fff2b6';

  render();
  overlay.appendChild(shell);
  document.body.appendChild(overlay);
}

function install(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;
  if (!isLocalDev()) return;

  const pool = uniquePool();
  const defaultOrder = pool.map((pow) => pow.id);
  const saved = readSavedOrder(pool);
  const applied = saved ? applyOrder(saved, pool) : false;
  const activeOrder = applied ? saved! : defaultOrder;

  installPauseBridge();
  const setupUi = () => installSetupUi(pool, activeOrder);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUi, { once: true });
  else setupUi();

  root.POWDER_COMBAT2_PREBATTLE_RANDOMIZER = {
    version: VERSION,
    devOnly: true,
    mode: 'random-edit-then-start',
    poolSize: pool.length,
    slotCount: 10,
    randomDoesNotAutoPlay: true,
    editableAfterRandom: true,
    realPowImages: true,
    uniqueSlots: true,
    savedRosterApplied: applied,
    startsOnlyAfterExplicitButton: true,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

install();
