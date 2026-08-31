const VERSION = '2.15.4';
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
  return typeof window !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function focusProfession(role: string | null): void {
  const next = new URL(window.location.href);
  if (role) {
    next.searchParams.set('profession', role);
    next.searchParams.set('professionDemo', '1');
  } else {
    next.searchParams.delete('profession');
    next.searchParams.delete('professionDemo');
  }
  window.location.assign(next.toString());
}

function liveApi(): any {
  return (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST;
}

async function playLiveProfession(role: string | null): Promise<any> {
  const api = liveApi();
  if (!api?.ready || typeof api.play !== 'function') {
    return { ok: false, reason: 'live-test-not-ready' };
  }
  return api.play(role);
}

async function playRandom(group: TestGroup, count: number): Promise<any> {
  const api = liveApi();
  if (!api?.ready) return { ok: false, reason: 'live-test-not-ready' };
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

function installSwitcher(): void {
  if (!isLocalDev() || document.getElementById('combat2-profession-test-switcher')) return;

  const focus = new URLSearchParams(window.location.search).get('profession') || '';
  const focusLabel = ROLE_BUTTONS.find(([key]) => key === focus)?.[1] ?? focus;
  const root = document.createElement('div');
  root.id = 'combat2-profession-test-switcher';
  root.style.cssText = [
    'position:fixed', 'right:12px', 'top:12px', 'z-index:99999',
    'font-family:Arial,sans-serif', 'font-size:12px', 'color:#eef8ff', 'user-select:none'
  ].join(';');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = focus ? `VFX LAB · ${focusLabel}` : 'VFX LAB · TEST NGHỀ';
  toggle.style.cssText = [
    'border:1px solid rgba(151,218,255,.62)', 'border-radius:8px',
    'background:rgba(4,20,32,.92)', 'color:#eef8ff', 'padding:7px 10px',
    'font-weight:800', 'cursor:pointer', 'box-shadow:0 4px 16px rgba(0,0,0,.32)'
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'display:none', 'margin-top:6px', 'width:216px', 'max-height:78vh', 'overflow:auto',
    'padding:8px', 'border:1px solid rgba(151,218,255,.38)', 'border-radius:9px',
    'background:rgba(4,20,32,.96)', 'box-shadow:0 8px 24px rgba(0,0,0,.38)'
  ].join(';');

  const status = document.createElement('div');
  status.textContent = focus ? `Đang chọn: ${focusLabel}` : 'Có thể test từng nghề hoặc random';
  status.style.cssText = [
    'margin:2px 2px 8px', 'padding:6px 7px', 'border-radius:6px',
    'background:rgba(95,201,255,.08)', 'color:#bdeeff', 'line-height:1.4'
  ].join(';');
  panel.appendChild(status);

  const makeAction = (label: string, accent: string, handler: () => Promise<void> | void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'display:block', 'width:100%', 'margin:0 0 5px',
      `border:1px solid ${accent}`, 'border-radius:7px',
      'background:rgba(255,255,255,.045)', 'color:#eef8ff',
      'padding:7px 8px', 'font-weight:800', 'text-align:center', 'cursor:pointer'
    ].join(';');
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await handler(); } finally { button.disabled = false; }
    });
    panel.appendChild(button);
    return button;
  };

  makeAction(focus ? `PHÁT VFX · ${focusLabel}` : 'PHÁT VFX NGHỀ ĐANG CHỌN', 'rgba(255,214,118,.58)', async () => {
    if (!focus) {
      status.textContent = 'Hãy chọn một nghề trước';
      return;
    }
    status.textContent = `Đang phát ${focusLabel}...`;
    const result = await playLiveProfession(focus);
    (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
    status.textContent = result?.ok
      ? `${focusLabel}: VFX đã phát · không trừ máu`
      : `${focusLabel}: ${result?.reason ?? 'chưa sẵn sàng'}`;
  });

  makeAction('RANDOM 1 LẦN', 'rgba(139,220,255,.55)', async () => {
    status.textContent = 'Đang random 1 nghề...';
    const result = await playRandom('all', 1);
    (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
    status.textContent = result?.ok
      ? `Random: ${roleLabel(result.role ?? result.requestedRole)} · không trừ máu`
      : `Random lỗi: ${result?.reason ?? 'unknown'}`;
  });

  makeAction('RANDOM CẬN CHIẾN ×9', 'rgba(255,157,120,.62)', async () => {
    status.textContent = 'Đang random Đấu sĩ / Hiệp sĩ / Sát thủ ×9...';
    const result = await playRandom('melee', 9);
    (globalThis as any).POWDER_COMBAT2_RANDOM_VFX_LAST_SERIES = result;
    status.textContent = result?.cancelled
      ? `Đã dừng · ${result.completedCount}/${result.requestedCount}`
      : `Cận chiến xong · ${result.completedCount}/${result.requestedCount}`;
  });

  makeAction('RANDOM ĐÁNH XA ×9', 'rgba(129,194,255,.62)', async () => {
    status.textContent = 'Đang random 5 nghề đánh xa ×9...';
    const result = await playRandom('ranged', 9);
    (globalThis as any).POWDER_COMBAT2_RANDOM_VFX_LAST_SERIES = result;
    status.textContent = result?.cancelled
      ? `Đã dừng · ${result.completedCount}/${result.requestedCount}`
      : `Đánh xa xong · ${result.completedCount}/${result.requestedCount}`;
  });

  makeAction('RANDOM TẤT CẢ ×12', 'rgba(190,155,255,.62)', async () => {
    status.textContent = 'Đang random toàn bộ nghề ×12...';
    const result = await playRandom('all', 12);
    (globalThis as any).POWDER_COMBAT2_RANDOM_VFX_LAST_SERIES = result;
    status.textContent = result?.cancelled
      ? `Đã dừng · ${result.completedCount}/${result.requestedCount}`
      : `Toàn bộ xong · ${result.completedCount}/${result.requestedCount}`;
  });

  makeAction('DỪNG RANDOM', 'rgba(255,110,130,.62)', () => {
    const result = stopRandom();
    status.textContent = result?.ok ? 'Đã gửi lệnh dừng random' : 'Random chưa chạy';
  });

  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:rgba(255,255,255,.10);margin:7px 0';
  panel.appendChild(divider);

  const addButton = (role: string | null, label: string): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    const active = Boolean(role && role === focus);
    button.style.cssText = [
      'display:block', 'width:100%', 'margin:2px 0',
      'border:1px solid rgba(255,255,255,.10)', 'border-radius:6px',
      `background:${active ? 'rgba(92,190,255,.25)' : 'rgba(255,255,255,.04)'}`,
      'color:#eef8ff', 'padding:6px 8px', 'text-align:left', 'cursor:pointer'
    ].join(';');
    button.addEventListener('click', async () => {
      if (role && role === focus) {
        status.textContent = `Đang phát ${label}...`;
        const result = await playLiveProfession(role);
        (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
        status.textContent = result?.ok
          ? `${label}: VFX đã phát · không trừ máu`
          : `${label}: ${result?.reason ?? 'chưa sẵn sàng'}`;
        return;
      }
      focusProfession(role);
    });
    panel.appendChild(button);
  };

  addButton(null, 'Tất cả 9 nghề');
  for (const [role, label] of ROLE_BUTTONS) addButton(role, label);

  toggle.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  root.append(toggle, panel);
  document.body.appendChild(root);

  (globalThis as any).POWDER_COMBAT2_PROFESSION_TEST_UI = {
    version: VERSION,
    devOnly: true,
    roleCount: ROLE_BUTTONS.length,
    focusRole: focus || null,
    queryParam: 'profession',
    autoDemoParam: 'professionDemo',
    liveVfxReplayButton: true,
    randomSingleButton: true,
    randomMeleeSeries: 9,
    randomRangedSeries: 9,
    randomAllSeries: 12,
    stopRandomButton: true,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installSwitcher, { once: true });
} else {
  installSwitcher();
}
