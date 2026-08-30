const VERSION = '2.15.0';
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
  if (role) next.searchParams.set('profession', role);
  else next.searchParams.delete('profession');
  window.location.assign(next.toString());
}

function installSwitcher(): void {
  if (!isLocalDev() || document.getElementById('combat2-profession-test-switcher')) return;

  const focus = new URLSearchParams(window.location.search).get('profession') || '';
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
  toggle.textContent = focus ? `TEST NGHỀ · ${ROLE_BUTTONS.find(([key]) => key === focus)?.[1] ?? focus}` : 'TEST NGHỀ';
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
    'width:150px',
    'padding:6px',
    'border:1px solid rgba(151,218,255,.35)',
    'border-radius:9px',
    'background:rgba(4,20,32,.94)',
    'box-shadow:0 8px 24px rgba(0,0,0,.34)'
  ].join(';');

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
    button.addEventListener('click', () => focusProfession(role));
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
    combatLogicChanged: false
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installSwitcher, { once: true });
} else {
  installSwitcher();
}
