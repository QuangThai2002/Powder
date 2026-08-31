const VERSION = '2.15.5';
const ROLE_BUTTONS = [
  ['marksman', 'Xạ thủ'],
  ['mage', 'Pháp sư'],
  ['fighter', 'Đấu sĩ'],
  ['knight', 'Hiệp sĩ'],
  ['enchanter', 'Thuật sư'],
  ['healer', 'Trị liệu'],
  ['musician', 'Nhạc công'],
  ['assassin', 'Sát thủ'],
  ['tank', 'Đỡ đòn']
] as const;

type TestGroup = 'all' | 'melee' | 'ranged';

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function liveApi(): any {
  const root = globalThis as any;
  return root.POWDER_COMBAT2_VFX_LAB ?? root.POWDER_COMBAT2_PROFESSION_LIVE_TEST;
}

async function playRole(role: string): Promise<any> {
  const api = liveApi();
  if (!api?.ready || typeof api.play !== 'function') return { ok: false, reason: 'vfx-lab-not-ready' };
  return api.play(role);
}

async function playRandom(group: TestGroup, count: number): Promise<any> {
  const api = liveApi();
  if (!api?.ready) return { ok: false, reason: 'vfx-lab-not-ready' };
  if (count <= 1 && typeof api.playRandom === 'function') return api.playRandom(group);
  if (typeof api.playRandomSeries === 'function') return api.playRandomSeries(group, count);
  return { ok: false, reason: 'random-series-not-ready' };
}

function stopRandom(): any {
  const api = liveApi();
  if (typeof api?.stopRandomSeries !== 'function') return { ok: false, reason: 'stop-not-ready' };
  return api.stopRandomSeries();
}

function roleLabel(role: unknown): string {
  return ROLE_BUTTONS.find(([key]) => key === String(role))?.[1] ?? String(role || 'không rõ');
}

function effectLabel(result: any): string {
  const role = roleLabel(result?.role ?? result?.requestedRole);
  const element = result?.element ? String(result.element).toUpperCase() : 'HỆ HIỆN TẠI';
  return `${role} · ${element}`;
}

function installSwitcher(): void {
  if (!isLocalDev() || document.getElementById('combat2-profession-test-switcher')) return;

  const queryRole = new URLSearchParams(window.location.search).get('profession');
  let selectedRole = ROLE_BUTTONS.some(([key]) => key === queryRole) ? String(queryRole) : 'marksman';

  const root = document.createElement('div');
  root.id = 'combat2-profession-test-switcher';
  root.style.cssText = [
    'position:fixed', 'right:12px', 'top:12px', 'z-index:99999',
    'font-family:Arial,sans-serif', 'font-size:12px', 'color:#eef8ff', 'user-select:none'
  ].join(';');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'VFX LAB · 2.15.5';
  toggle.style.cssText = [
    'border:1px solid rgba(151,218,255,.68)', 'border-radius:8px',
    'background:rgba(4,20,32,.94)', 'color:#eef8ff', 'padding:8px 11px',
    'font-weight:800', 'cursor:pointer', 'box-shadow:0 4px 16px rgba(0,0,0,.34)'
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'display:none', 'margin-top:6px', 'width:230px', 'max-height:80vh', 'overflow:auto',
    'padding:8px', 'border:1px solid rgba(151,218,255,.4)', 'border-radius:9px',
    'background:rgba(4,20,32,.97)', 'box-shadow:0 8px 24px rgba(0,0,0,.4)'
  ].join(';');

  const status = document.createElement('div');
  status.textContent = `Sẵn sàng · chọn ${roleLabel(selectedRole)} hoặc Random`;
  status.style.cssText = [
    'margin:2px 2px 8px', 'padding:7px', 'border-radius:6px',
    'background:rgba(95,201,255,.09)', 'color:#bdeeff', 'line-height:1.4',
    'border:1px solid rgba(95,201,255,.16)'
  ].join(';');
  panel.appendChild(status);

  const makeAction = (label: string, accent: string, handler: () => Promise<void> | void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'display:block', 'width:100%', 'margin:0 0 5px',
      `border:1px solid ${accent}`, 'border-radius:7px',
      'background:rgba(255,255,255,.05)', 'color:#eef8ff',
      'padding:7px 8px', 'font-weight:800', 'text-align:center', 'cursor:pointer'
    ].join(';');
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await handler(); } finally { button.disabled = false; }
    });
    panel.appendChild(button);
    return button;
  };

  makeAction('PHÁT NGHỀ ĐANG CHỌN', 'rgba(255,214,118,.62)', async () => {
    status.textContent = `Đang phát ${roleLabel(selectedRole)}...`;
    const result = await playRole(selectedRole);
    (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
    status.textContent = result?.ok ? `ĐÃ PHÁT · ${effectLabel(result)}` : `LỖI · ${result?.reason ?? 'unknown'}`;
  });

  makeAction('RANDOM 1 LẦN', 'rgba(139,220,255,.62)', async () => {
    status.textContent = 'Đang random nghề + hệ...';
    const result = await playRandom('all', 1);
    status.textContent = result?.ok ? `RANDOM · ${effectLabel(result)}` : `RANDOM LỖI · ${result?.reason ?? 'unknown'}`;
  });

  makeAction('RANDOM CẬN CHIẾN ×9', 'rgba(255,157,120,.68)', async () => {
    status.textContent = 'Đang chạy Đấu sĩ / Hiệp sĩ / Sát thủ ×9...';
    const result = await playRandom('melee', 9);
    status.textContent = result?.cancelled
      ? `ĐÃ DỪNG · ${result.completedCount}/${result.requestedCount}`
      : result?.ok ? `CẬN CHIẾN XONG · ${result.completedCount}/${result.requestedCount}` : `CẬN CHIẾN LỖI · ${result?.results?.[0]?.reason ?? 'unknown'}`;
  });

  makeAction('RANDOM PROJECTILE ×9', 'rgba(129,194,255,.68)', async () => {
    status.textContent = 'Đang chạy 6 nghề có projectile ×9...';
    const result = await playRandom('ranged', 9);
    status.textContent = result?.cancelled
      ? `ĐÃ DỪNG · ${result.completedCount}/${result.requestedCount}`
      : result?.ok ? `PROJECTILE XONG · ${result.completedCount}/${result.requestedCount}` : `PROJECTILE LỖI · ${result?.results?.[0]?.reason ?? 'unknown'}`;
  });

  makeAction('RANDOM TẤT CẢ ×12', 'rgba(190,155,255,.68)', async () => {
    status.textContent = 'Đang random toàn bộ ×12...';
    const result = await playRandom('all', 12);
    status.textContent = result?.cancelled
      ? `ĐÃ DỪNG · ${result.completedCount}/${result.requestedCount}`
      : result?.ok ? `TẤT CẢ XONG · ${result.completedCount}/${result.requestedCount}` : `RANDOM LỖI · ${result?.results?.[0]?.reason ?? 'unknown'}`;
  });

  makeAction('DỪNG RANDOM', 'rgba(255,110,130,.68)', () => {
    const result = stopRandom();
    status.textContent = result?.ok ? 'Đã gửi lệnh dừng Random' : `Không dừng được · ${result?.reason ?? 'unknown'}`;
  });

  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:rgba(255,255,255,.11);margin:8px 0';
  panel.appendChild(divider);

  for (const [role, label] of ROLE_BUTTONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'display:block', 'width:100%', 'margin:2px 0',
      'border:1px solid rgba(255,255,255,.12)', 'border-radius:6px',
      'background:rgba(255,255,255,.045)', 'color:#eef8ff',
      'padding:6px 8px', 'text-align:left', 'cursor:pointer'
    ].join(';');
    button.addEventListener('click', async () => {
      selectedRole = role;
      status.textContent = `Đang phát trực tiếp ${label}...`;
      const result = await playRole(role);
      (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      status.textContent = result?.ok ? `ĐÃ PHÁT · ${effectLabel(result)}` : `${label} LỖI · ${result?.reason ?? 'unknown'}`;
    });
    panel.appendChild(button);
  }

  toggle.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  root.append(toggle, panel);
  document.body.appendChild(root);

  (globalThis as any).POWDER_COMBAT2_PROFESSION_TEST_UI = {
    version: VERSION,
    devOnly: true,
    roleCount: ROLE_BUTTONS.length,
    directRoleButtons: true,
    reloadOnRoleSelect: false,
    directVfxLabPreferred: true,
    randomSingleButton: true,
    randomMeleeSeries: 9,
    randomProjectileSeries: 9,
    randomAllSeries: 12,
    stopRandomButton: true,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSwitcher, { once: true });
else installSwitcher();
