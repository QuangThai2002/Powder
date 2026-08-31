const VERSION = '2.16.2';
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

const MARKSMAN_TIERS = [
  ['normal', 'XẠ THỦ · THƯỜNG'],
  ['skill', 'XẠ THỦ · SKILL'],
  ['ultimate', 'XẠ THỦ · ULT']
] as const;

type MarksmanTier = typeof MARKSMAN_TIERS[number][0];

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function liveApi(): any {
  const root = globalThis as any;
  return root.POWDER_COMBAT2_VFX_LAB ?? root.POWDER_COMBAT2_PROFESSION_LIVE_TEST;
}

function roleLabel(role: unknown): string {
  return ROLE_BUTTONS.find(([key]) => key === String(role))?.[1] ?? String(role || 'không rõ');
}

function tierLabel(tier: unknown): string {
  if (tier === 'normal') return 'THƯỜNG';
  if (tier === 'skill') return 'SKILL';
  if (tier === 'ultimate') return 'ULT';
  return String(tier || '').toUpperCase();
}

function formLabel(form: unknown): string {
  if (form === 'compact-spiral-rail') return 'COMPACT SPIRAL';
  if (form === 'piercing-spiral-shot') return 'PIERCING SPIRAL';
  if (form === 'rail-breaker') return 'RAIL BREAKER';
  return String(form || 'SPIRAL RAIL').toUpperCase();
}

function installSwitcher(): void {
  if (!isLocalDev() || document.getElementById('combat2-profession-test-switcher')) return;

  const root = document.createElement('div');
  root.id = 'combat2-profession-test-switcher';
  root.style.cssText = [
    'position:fixed', 'right:12px', 'top:12px', 'z-index:99999',
    'font-family:Arial,sans-serif', 'font-size:12px', 'color:#eef8ff', 'user-select:none'
  ].join(';');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = `VFX NHANH · ${VERSION}`;
  toggle.style.cssText = [
    'border:1px solid rgba(151,218,255,.68)', 'border-radius:8px',
    'background:rgba(4,20,32,.94)', 'color:#eef8ff', 'padding:8px 11px',
    'font-weight:800', 'cursor:pointer', 'box-shadow:0 4px 16px rgba(0,0,0,.34)'
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'display:none', 'margin-top:6px', 'width:248px', 'max-height:80vh', 'overflow:auto',
    'padding:8px', 'border:1px solid rgba(151,218,255,.4)', 'border-radius:9px',
    'background:rgba(4,20,32,.97)', 'box-shadow:0 8px 24px rgba(0,0,0,.4)'
  ].join(';');

  const status = document.createElement('div');
  status.textContent = '2.16.2: Xạ thủ THƯỜNG / SKILL / ULT là 3 VFX khác nhau thật sự, không còn dùng lite / balanced / full để giả tier.';
  status.style.cssText = [
    'margin:2px 2px 8px', 'padding:7px', 'border-radius:6px',
    'background:rgba(95,201,255,.09)', 'color:#bdeeff', 'line-height:1.4',
    'border:1px solid rgba(95,201,255,.16)'
  ].join(';');
  panel.appendChild(status);

  const marksmanTitle = document.createElement('div');
  marksmanTitle.textContent = 'XẠ THỦ · REAL 3-TIER SPIRAL RAIL';
  marksmanTitle.style.cssText = [
    'margin:4px 2px 5px', 'font-size:11px', 'font-weight:900', 'letter-spacing:.5px',
    'color:#dff7ff', 'opacity:.92'
  ].join(';');
  panel.appendChild(marksmanTitle);

  const marksmanButtons: HTMLButtonElement[] = [];
  const setMarksmanBusy = (busy: boolean): void => {
    for (const button of marksmanButtons) button.disabled = busy;
  };

  for (const [tier, label] of MARKSMAN_TIERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.marksmanTier = tier;
    button.style.cssText = [
      'display:block', 'width:100%', 'margin:4px 0',
      'border:1px solid rgba(128,223,255,.28)', 'border-radius:7px',
      tier === 'ultimate'
        ? 'background:linear-gradient(90deg,rgba(255,190,76,.16),rgba(116,103,255,.22))'
        : tier === 'skill'
          ? 'background:rgba(93,177,255,.14)'
          : 'background:rgba(255,255,255,.055)',
      'color:#f2fbff', 'padding:8px 9px', 'text-align:left',
      'cursor:pointer', 'font-weight:900', 'letter-spacing:.2px'
    ].join(';');

    button.addEventListener('click', async () => {
      const api = liveApi();
      if (!api?.ready || typeof api.playMarksmanTier !== 'function') {
        status.textContent = `${label}: API 3 tier Xạ thủ chưa sẵn sàng`;
        return;
      }

      setMarksmanBusy(true);
      status.textContent = `Đang phát Xạ thủ · ${tierLabel(tier)}...`;
      try {
        const result = await api.playMarksmanTier(tier as MarksmanTier);
        (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
        const element = result?.element ? String(result.element).toUpperCase() : 'HỆ HIỆN TẠI';
        status.textContent = result?.ok
          ? `ĐÃ PHÁT · Xạ thủ · ${tierLabel(result?.marksmanAttackTier ?? tier)} · ${element} · DIRECT ${result?.directVersion ?? VERSION} · ${formLabel(result?.marksmanForm)}`
          : `${label}: ${result?.reason ?? 'không phát được'}`;
      } catch (error) {
        console.error('[Combat2 2.16.2 Marksman Tier UI]', error);
        status.textContent = `${label}: lỗi runtime`;
      } finally {
        setMarksmanBusy(false);
      }
    });

    marksmanButtons.push(button);
    panel.appendChild(button);
  }

  const separator = document.createElement('div');
  separator.style.cssText = [
    'height:1px', 'margin:9px 2px 7px', 'background:rgba(255,255,255,.1)'
  ].join(';');
  panel.appendChild(separator);

  for (const [role, label] of ROLE_BUTTONS) {
    if (role === 'marksman') continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'display:block', 'width:100%', 'margin:3px 0',
      'border:1px solid rgba(255,255,255,.13)', 'border-radius:6px',
      'background:rgba(255,255,255,.05)', 'color:#eef8ff',
      'padding:7px 8px', 'text-align:left', 'cursor:pointer', 'font-weight:700'
    ].join(';');
    button.addEventListener('click', async () => {
      const api = liveApi();
      if (!api?.ready || typeof api.play !== 'function') {
        status.textContent = `${label}: VFX Lab chưa sẵn sàng`;
        return;
      }
      button.disabled = true;
      status.textContent = `Đang phát ${label}...`;
      try {
        const result = await api.play(role);
        (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
        const element = result?.element ? String(result.element).toUpperCase() : 'HỆ HIỆN TẠI';
        status.textContent = result?.ok
          ? `ĐÃ PHÁT · ${roleLabel(result.role ?? role)} · ${element}`
          : `${label}: ${result?.reason ?? 'không phát được'}`;
      } catch (error) {
        console.error('[Combat2 2.16.2 Quick VFX]', error);
        status.textContent = `${label}: lỗi runtime`;
      } finally {
        button.disabled = false;
      }
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
    marksmanTierButtons: 3,
    marksmanTiers: ['normal', 'skill', 'ultimate'],
    marksmanTierApi: 'playMarksmanTier',
    marksmanRealDistinctTierVfx: true,
    marksmanQualityTierProxy: false,
    singleMarksmanButtonRemoved: true,
    randomButtonsRemoved: true,
    preBattleRandomizerOwnsRandom: true,
    reloadOnRoleSelect: false,
    presentationOnly: true,
    combatLogicChanged: false
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSwitcher, { once: true });
else installSwitcher();
