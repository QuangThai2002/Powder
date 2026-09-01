const VERSION = '2.17.3';

const TIERED_ROLES = [
  ['marksman', 'Xạ thủ'],
  ['mage', 'Pháp sư'],
  ['tank', 'Đỡ đòn'],
  ['fighter', 'Đấu sĩ'],
  ['knight', 'Hiệp sĩ'],
  ['assassin', 'Sát thủ'],
  ['enchanter', 'Thuật sư'],
  ['healer', 'Trị liệu']
] as const;

const COMPAT_ROLES = [
  ['musician', 'Nhạc công']
] as const;

const TIERS = [
  ['normal', 'THƯỜNG'],
  ['skill', 'SKILL'],
  ['ultimate', 'ULT']
] as const;

type TieredRole = typeof TIERED_ROLES[number][0];
type ProfessionTier = typeof TIERS[number][0];

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function runtimeTierApi(): any {
  return (globalThis as any).POWDER_COMBAT2_PROFESSION_RUNTIME_TEST;
}

function compatibilityApi(): any {
  const root = globalThis as any;
  return root.POWDER_COMBAT2_VFX_LAB ?? root.POWDER_COMBAT2_PROFESSION_LIVE_TEST;
}

function tierStyle(tier: ProfessionTier): string {
  if (tier === 'ultimate') return 'background:linear-gradient(90deg,rgba(255,190,76,.18),rgba(116,103,255,.24))';
  if (tier === 'skill') return 'background:rgba(93,177,255,.16)';
  return 'background:rgba(255,255,255,.055)';
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
    'display:none', 'margin-top:6px', 'width:314px', 'max-height:82vh', 'overflow:auto',
    'padding:8px', 'border:1px solid rgba(151,218,255,.4)', 'border-radius:9px',
    'background:rgba(4,20,32,.97)', 'box-shadow:0 8px 24px rgba(0,0,0,.4)'
  ].join(';');

  const status = document.createElement('div');
  status.textContent = '2.17.3: test trực tiếp 3 cấp VFX của 8 nghề. Tank giữ nguyên; Fighter = đấm nặng; Knight = một phát chém mạnh; Assassin = 2 nhát chém liên tiếp. QA không gây damage và không chuyển lượt.';
  status.style.cssText = [
    'margin:2px 2px 8px', 'padding:7px', 'border-radius:6px',
    'background:rgba(95,201,255,.09)', 'color:#bdeeff', 'line-height:1.4',
    'border:1px solid rgba(95,201,255,.16)'
  ].join(';');
  panel.appendChild(status);

  const allTierButtons: HTMLButtonElement[] = [];
  const setTierButtonsBusy = (busy: boolean): void => {
    for (const button of allTierButtons) button.disabled = busy;
  };

  const playTier = async (role: TieredRole, roleLabel: string, tier: ProfessionTier, tierLabel: string): Promise<void> => {
    const api = runtimeTierApi();
    if (!api?.ready || typeof api.playProfessionTier !== 'function') {
      status.textContent = `${roleLabel} · ${tierLabel}: API runtime 2.17.3 chưa sẵn sàng`;
      return;
    }

    setTierButtonsBusy(true);
    status.textContent = `Đang phát ${roleLabel} · ${tierLabel}...`;
    try {
      const result = await api.playProfessionTier(role, tier);
      (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
      const element = result?.element ? String(result.element).toUpperCase() : 'HỆ HIỆN TẠI';
      const form = result?.form ? String(result.form).toUpperCase() : 'VFX';
      const hitSuffix = role === 'assassin' ? ' · 2 NHÁT LIÊN TIẾP' : '';
      status.textContent = result?.ok
        ? `ĐÃ PHÁT · ${roleLabel} · ${tierLabel} · ${element} · ${form}${hitSuffix} · QA KHÔNG DAMAGE/KHÔNG CHUYỂN LƯỢT`
        : `${roleLabel} · ${tierLabel}: ${result?.reason ?? 'không phát được'}`;
    } catch (error) {
      console.error('[Combat2 2.17.3 Profession Tier UI]', error);
      status.textContent = `${roleLabel} · ${tierLabel}: lỗi runtime`;
    } finally {
      setTierButtonsBusy(false);
    }
  };

  for (const [role, roleLabel] of TIERED_ROLES) {
    const section = document.createElement('div');
    section.style.cssText = 'margin:7px 2px 9px';

    const title = document.createElement('div');
    title.textContent = `${roleLabel.toUpperCase()} · 3 TIER`;
    title.style.cssText = [
      'margin:0 0 5px', 'font-size:11px', 'font-weight:900', 'letter-spacing:.45px',
      'color:#dff7ff', 'opacity:.94'
    ].join(';');
    section.appendChild(title);

    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px';

    for (const [tier, tierLabel] of TIERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = tierLabel;
      button.dataset.professionRole = role;
      button.dataset.professionTier = tier;
      button.style.cssText = [
        'border:1px solid rgba(128,223,255,.28)', 'border-radius:7px', tierStyle(tier),
        'color:#f2fbff', 'padding:7px 5px', 'cursor:pointer', 'font-weight:900',
        'font-size:10px', 'letter-spacing:.15px'
      ].join(';');
      button.addEventListener('click', () => { void playTier(role, roleLabel, tier, tierLabel); });
      allTierButtons.push(button);
      row.appendChild(button);
    }

    section.appendChild(row);
    panel.appendChild(section);
  }

  const separator = document.createElement('div');
  separator.style.cssText = 'height:1px;margin:9px 2px 8px;background:rgba(255,255,255,.1)';
  panel.appendChild(separator);

  const compatTitle = document.createElement('div');
  compatTitle.textContent = 'NGHỀ CHƯA NÂNG 3 TIER · TEST TƯƠNG THÍCH';
  compatTitle.style.cssText = 'margin:4px 2px 5px;font-size:10px;font-weight:900;color:#b9cbd4;letter-spacing:.35px';
  panel.appendChild(compatTitle);

  for (const [role, label] of COMPAT_ROLES) {
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
      const api = compatibilityApi();
      if (!api?.ready || typeof api.play !== 'function') {
        status.textContent = `${label}: VFX Lab tương thích chưa sẵn sàng`;
        return;
      }
      button.disabled = true;
      status.textContent = `Đang phát ${label}...`;
      try {
        const result = await api.play(role);
        (globalThis as any).POWDER_COMBAT2_PROFESSION_LIVE_TEST_LAST = result;
        status.textContent = result?.ok ? `ĐÃ PHÁT · ${label} · VFX TƯƠNG THÍCH` : `${label}: ${result?.reason ?? 'không phát được'}`;
      } catch (error) {
        console.error('[Combat2 2.17.3 Compatibility VFX UI]', error);
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
    tieredRoles: TIERED_ROLES.map(([role]) => role),
    tieredRoleCount: TIERED_ROLES.length,
    tierButtonsPerRole: TIERS.length,
    totalTierButtons: TIERED_ROLES.length * TIERS.length,
    compatibilityRoles: COMPAT_ROLES.map(([role]) => role),
    runtimeTierApi: 'POWDER_COMBAT2_PROFESSION_RUNTIME_TEST.playProfessionTier',
    fighterIdentity: 'single-heavy-punch',
    knightIdentity: 'single-heavy-slash',
    assassinIdentity: 'two-consecutive-critical-style-slashes',
    assassinVisualHits: 2,
    assassinGuaranteedCritChanged: false,
    qaDamageApplied: false,
    qaTurnAdvanced: false,
    realCombatRouteStillOwnedByNightProjectileBridge: true,
    randomButtonsRemoved: true,
    preBattleRandomizerOwnsRandom: true,
    reloadOnRoleSelect: false,
    combatLogicChanged: false
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSwitcher, { once: true });
else installSwitcher();