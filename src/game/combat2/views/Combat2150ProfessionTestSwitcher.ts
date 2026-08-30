const VERSION = '2.15.2';
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

async function playLiveProfession(role: string | null): Promise<any> {
  const api = (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST;
  if (!api?.ready || typeof api.play !== 'function') {
    return { ok: false, reason: 'live-test-not-ready' };
  }
  return api.play(role);
}

function installSwitcher(): void {
  if (!isLocalDev() || document.getElementById('combat2-profession-test-switcher')) return;

  const focus = new URLSearchParams(window.location.search).get('profession') || '';
  const focusLabel = ROLE_BUTTONS.find(([key]) => key === focus)?.[1] ?? focus;
  const root = document.createElement('div');
  root.id = 'combat2-profession-test-switcher';
  root.style.cssText = [
    'position:fixed',
    'right:12px',
    'top:12px',
    'z-index:99999',
    'font-family:Arial,sans-serif',
    'font-size:12px',
    'color:#eef8ff',
    'user-select:none'
  ].join(';');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = focus ? `TEST NGHỀ · ${focusLabel}` : 'TEST NGHỀ';
  toggle.style.cssText = [
    'border:1px solid rgba(151,218,255,.55)',
    'border-radius:8px',
    'background:rgba(4,20,32,.90)',
    'color:#eef8ff',
    'padding:7px 10px',
    'font-weight:700',
    'cursor:pointer',
    'box-shadow:0 4px 16px rgba(0,0,0,.28)'
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'display:none',
    'margin-top:6px',
    'width:176px',
    'padding:7px',
    'border:1px solid rgba(151,218,255,.35)',
    'border-radius:9px',
    'background:rgba(4,20,32,.94)',
    'box-shadow:0 8px 24px rgba(0,0,0,.34)'
  ].join(';');

  const status = document.createElement('div');
  status.textContent = focus ? `Đang chọn: ${focusLabel}` : 'Chọn nghề để test';
  status.style.cssText = [
    'margin:2px 2px 7px',
    'padding:5px 6px',
    'border-radius:6px',
    'background:rgba(95,201,255,.08)',
    'color:#bdeeff',
    'line-height:1.35'
  ].join(';');
  panel.appendChild(status);

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = focus ? `PHÁT VFX · ${focusLabel}` : 'PHÁT VFX NGHỀ';
  playButton.style.cssText = [
    'display:block',
    'width:100%',
    'margin:0 0 6px',
    'border:1px solid rgba(255,214,118,.55)',
    'border-radius:7px',
    'background:rgba(133,91,21,.28)',
    'color:#fff1c6',
    'padding:7px 8px',
    'font-weight:800',
    'text-align:center',
    'cursor:pointer'
  ].join(';');
  playButton.addEventListener('click', async () => {
    if (!focus) {
      status.textContent = 'Hãy chọn một nghề trước';
      return;
    }
    playButton.disabled = true;
    status.textContent = `Đang phát VFX ${focusLabel}...`;
    try {
      const result = await playLiveProfession(focus);
      if (result?.ok) {
        status.textContent = `${focusLabel}: VFX đã phát · không trừ máu`;
      } else {
        status.textContent = `${focusLabel}: chưa sẵn sàng (${result?.reason ?? 'unknown'})`;
      }
      (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
    } catch (error) {
      status.textContent = `${focusLabel}: lỗi phát VFX`;
      console.error('[Combat2 2.15.2 Profession Test]', error);
    } finally {
      playButton.disabled = false;
    }
  });
  panel.appendChild(playButton);

  const addButton = (role: string | null, label: string): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    const active = Boolean(role && role === focus);
    button.style.cssText = [
      'display:block',
      'width:100%',
      'margin:2px 0',
      'border:1px solid rgba(255,255,255,.10)',
      'border-radius:6px',
      `background:${active ? 'rgba(92,190,255,.25)' : 'rgba(255,255,255,.04)'}`,
      'color:#eef8ff',
      'padding:6px 8px',
      'text-align:left',
      'cursor:pointer'
    ].join(';');
    button.addEventListener('click', async () => {
      if (role && role === focus) {
        status.textContent = `Đang phát VFX ${label}...`;
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
    selectRoleTriggersAutoDemo: true,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installSwitcher, { once: true });
} else {
  installSwitcher();
}
