export {};

const VERSION = '2.20.3';

const TIERED_ROLES = [
  ['marksman', 'Xạ thủ'],
  ['mage', 'Pháp sư'],
  ['tank', 'Đỡ đòn'],
  ['fighter', 'Đấu sĩ'],
  ['knight', 'Hiệp sĩ'],
  ['assassin', 'Sát thủ'],
  ['enchanter', 'Thuật sư'],
  ['healer', 'Trị liệu'],
  ['musician', 'Nhạc công']
] as const;

const TIERS = [
  ['normal', 'THƯỜNG'],
  ['skill', 'SKILL'],
  ['ultimate', 'ULT']
] as const;

type TieredRole = typeof TIERED_ROLES[number][0];
type ProfessionTier = typeof TIERS[number][0];
type VfxLabEffect = 'cast' | 'release' | 'projectile' | 'slash' | 'impact' | 'magic-circle' | 'ultimate';

const VFX_LAB_EFFECTS: ReadonlyArray<readonly [VfxLabEffect, string]> = [
  ['cast', 'CAST'],
  ['release', 'RELEASE'],
  ['projectile', 'PROJECTILE'],
  ['slash', 'SLASH'],
  ['impact', 'IMPACT'],
  ['magic-circle', 'MAGIC CIRCLE'],
  ['ultimate', 'ULTIMATE']
];

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function runtimeTierApi(): any {
  return (globalThis as any).POWDER_COMBAT2_PROFESSION_RUNTIME_TEST;
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
  status.textContent = 'QA dùng đúng Pow đang có trên sân: cùng route tấn công và phản lực target như combat thật, không damage/không chuyển lượt. 4 nghề cận chiến nhún tại chỗ rồi kích impact, không projectile. Nếu một nghề thiếu trong catalog, QA sẽ báo rõ thay vì mô phỏng Pow giả.';
  status.style.cssText = [
    'margin:2px 2px 8px', 'padding:7px', 'border-radius:6px',
    'background:rgba(95,201,255,.09)', 'color:#bdeeff', 'line-height:1.4',
    'border:1px solid rgba(95,201,255,.16)'
  ].join(';');
  panel.appendChild(status);

  const lab = document.createElement('section');
  lab.style.cssText = [
    'margin:2px 2px 10px', 'padding:8px', 'border:1px solid rgba(255,211,126,.28)',
    'border-radius:8px', 'background:rgba(255,204,114,.055)'
  ].join(';');
  const labTitle = document.createElement('div');
  labTitle.textContent = 'VFX TEST LAB · PRESENTATION ONLY';
  labTitle.style.cssText = 'margin:0 0 5px;color:#ffe4a5;font-size:11px;font-weight:900;letter-spacing:.4px';
  const labHelp = document.createElement('div');
  labHelp.textContent = 'Chọn Pow nguồn/đích đang có trên sân. PLAY không đổi damage, mana hay lượt; PLAY mới hoặc CLEANUP sẽ hủy object/tween của lần test trước.';
  labHelp.style.cssText = 'margin-bottom:7px;color:#f8e9c6;line-height:1.35;font-size:11px';
  const labGrid = document.createElement('div');
  labGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:5px';
  const effectSelect = document.createElement('select');
  const sourceSelect = document.createElement('select');
  const targetSelect = document.createElement('select');
  const selectStyle = 'width:100%;border:1px solid rgba(255,224,151,.32);border-radius:6px;background:#102536;color:#fff6df;padding:6px;font-size:10px;font-weight:700';
  for (const [effect, label] of VFX_LAB_EFFECTS) {
    const option = document.createElement('option');
    option.value = effect;
    option.textContent = label;
    effectSelect.appendChild(option);
  }
  for (const select of [effectSelect, sourceSelect, targetSelect]) select.style.cssText = selectStyle;
  effectSelect.title = 'Loại VFX';
  sourceSelect.title = 'Pow nguồn';
  targetSelect.title = 'Pow đích';
  labGrid.append(effectSelect, sourceSelect, targetSelect);
  const labActions = document.createElement('div');
  labActions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px';
  const refreshLabButton = document.createElement('button');
  const playLabButton = document.createElement('button');
  const cleanupLabButton = document.createElement('button');
  const styleLabButton = (button: HTMLButtonElement, background: string): void => {
    button.type = 'button';
    button.style.cssText = `border:1px solid rgba(255,225,162,.35);border-radius:6px;${background};color:#fff9eb;padding:7px 4px;cursor:pointer;font-size:10px;font-weight:900`;
  };
  refreshLabButton.textContent = 'LÀM MỚI';
  playLabButton.textContent = 'PLAY';
  cleanupLabButton.textContent = 'CLEANUP';
  styleLabButton(refreshLabButton, 'background:rgba(111,187,233,.16)');
  styleLabButton(playLabButton, 'background:rgba(94,196,135,.2)');
  styleLabButton(cleanupLabButton, 'background:rgba(238,125,107,.18)');
  labActions.append(refreshLabButton, playLabButton, cleanupLabButton);
  lab.append(labTitle, labHelp, labGrid, labActions);
  panel.appendChild(lab);

  type LabRow = { instanceId: string; side: 'player' | 'enemy' | null; name: string; role: string | null; element: string | null };
  const selectedValue = (select: HTMLSelectElement): string => select.value;
  const rowLabel = (row: LabRow): string => `${row.side === 'enemy' ? 'ĐỊCH' : 'BẠN'} · ${row.name} · ${row.role ?? row.element ?? 'Pow'}`;
  const refreshLab = (): LabRow[] => {
    const api = runtimeTierApi();
    if (!api?.ready || typeof api.getVfxLabRoster !== 'function') {
      sourceSelect.replaceChildren();
      targetSelect.replaceChildren();
      status.textContent = 'VFX LAB chờ BattleScene khởi tạo.';
      return [];
    }
    const rows = api.getVfxLabRoster() as LabRow[];
    const previousSource = selectedValue(sourceSelect);
    const previousTarget = selectedValue(targetSelect);
    const fill = (select: HTMLSelectElement, preferred: string): void => {
      select.replaceChildren();
      for (const row of rows) {
        const option = document.createElement('option');
        option.value = row.instanceId;
        option.textContent = rowLabel(row);
        select.appendChild(option);
      }
      if (rows.some((row) => row.instanceId === preferred)) select.value = preferred;
    };
    fill(sourceSelect, previousSource);
    fill(targetSelect, previousTarget);
    if (rows.length > 1 && sourceSelect.value === targetSelect.value) {
      const source = rows.find((row) => row.instanceId === sourceSelect.value);
      const target = rows.find((row) => row.instanceId !== source?.instanceId && row.side !== source?.side)
        ?? rows.find((row) => row.instanceId !== source?.instanceId);
      if (target) targetSelect.value = target.instanceId;
    }
    return rows;
  };
  const chooseTargetForSource = (): void => {
    const rows = refreshLab();
    const source = rows.find((row) => row.instanceId === sourceSelect.value);
    const target = rows.find((row) => row.instanceId !== source?.instanceId && row.side !== source?.side)
      ?? rows.find((row) => row.instanceId !== source?.instanceId);
    if (target) targetSelect.value = target.instanceId;
  };
  let labUiRun = 0;
  const playLab = async (): Promise<void> => {
    const api = runtimeTierApi();
    if (!api?.ready || typeof api.playVfxLab !== 'function') {
      status.textContent = 'VFX LAB runtime chưa sẵn sàng.';
      return;
    }
    if (!sourceSelect.value || !targetSelect.value) {
      status.textContent = 'VFX LAB cần chọn Pow nguồn và Pow đích.';
      return;
    }
    const effect = effectSelect.value as VfxLabEffect;
    const requestId = ++labUiRun;
    status.textContent = `Đang phát ${effect.toUpperCase()}...`;
    try {
      const result = await api.playVfxLab(effect, sourceSelect.value, targetSelect.value);
      if (requestId !== labUiRun) return;
      if (result?.cancelled) status.textContent = `${effect.toUpperCase()}: đã hủy bởi PLAY/CLEANUP mới.`;
      else if (result?.ok) {
        const phases = Array.isArray(result.phases) ? ` · ${result.phases.join(' → ')}` : '';
        status.textContent = `ĐÃ PHÁT · ${effect.toUpperCase()} · ${result.direction ?? 'local'}${phases} · CLEANUP=${result.activeRootsAfterPlay ?? 0}`;
      } else status.textContent = `${effect.toUpperCase()}: ${result?.reason ?? 'không phát được'}`;
    } catch (error) {
      console.error('[Combat2 VFX Test Lab]', error);
      status.textContent = `${effect.toUpperCase()}: lỗi runtime`;
    }
  };
  refreshLabButton.addEventListener('click', () => { refreshLab(); });
  sourceSelect.addEventListener('change', chooseTargetForSource);
  playLabButton.addEventListener('click', () => { void playLab(); });
  cleanupLabButton.addEventListener('click', () => {
    labUiRun += 1;
    const api = runtimeTierApi();
    const result = typeof api?.cleanupVfxLab === 'function' ? api.cleanupVfxLab('manual-ui') : null;
    status.textContent = result?.ok ? `VFX LAB CLEANUP · roots=${result.activeRootsAfterCleanup}` : 'VFX LAB cleanup chưa sẵn sàng.';
  });

  const allTierButtons: HTMLButtonElement[] = [];
  const setTierButtonsBusy = (busy: boolean): void => {
    for (const button of allTierButtons) button.disabled = busy;
  };

  const playTier = async (role: TieredRole, roleLabel: string, tier: ProfessionTier, tierLabel: string): Promise<void> => {
    const api = runtimeTierApi();
    if (!api?.ready || typeof api.playProfessionTier !== 'function') {
      status.textContent = `${roleLabel} · ${tierLabel}: API runtime ${VERSION} chưa sẵn sàng`;
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
      const visibleRoles = Array.isArray(result?.visibleRoles) ? ` · Có: ${result.visibleRoles.join(', ')}` : '';
      const unavailable = result?.reason === 'matching-profession-pow-not-visible'
        ? `${roleLabel} · ${tierLabel}: chưa có Pow nghề này trên sân; QA không mô phỏng thay thế${visibleRoles}`
        : null;
      status.textContent = result?.ok
        ? `ĐÃ PHÁT · ${roleLabel} · ${tierLabel} · ${element} · ${form}${hitSuffix} · QA KHÔNG DAMAGE/KHÔNG CHUYỂN LƯỢT`
        : unavailable ?? `${roleLabel} · ${tierLabel}: ${result?.reason ?? 'không phát được'}${visibleRoles}`;
    } catch (error) {
      console.error('[Combat2 2.18.3 Profession Tier UI]', error);
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

  toggle.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') refreshLab();
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
    compatibilityRoles: [],
    runtimeTierApi: 'POWDER_COMBAT2_PROFESSION_RUNTIME_TEST.playProfessionTier',
    vfxLabApi: 'POWDER_COMBAT2_PROFESSION_RUNTIME_TEST.playVfxLab',
    vfxLabEffects: VFX_LAB_EFFECTS.map(([effect]) => effect),
    vfxLabSourceTargetSelection: true,
    vfxLabCleanupButton: true,
    allNineProfessionsTiered: true,
    meleeContactOnlyRoles: ['tank', 'fighter', 'knight', 'assassin'],
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
