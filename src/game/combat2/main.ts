import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { installCombat2100TestRoster } from './data/Combat2100TestRoster';
import { runCombat2SmokeRegression } from './systems/CombatRegression';
import { CombatGuardEngine } from './systems/CombatGuardEngine';
import { runCombatGuardRegression } from './systems/CombatGuardRegression';
import { runCombatLegacyDomainParityRegression } from './systems/CombatLegacyDomainParityRegression';
import { runCombatLegacyDomainRegression } from './systems/CombatLegacyDomainRegression';
import { runCombatLegacyDomainSpecialRegression } from './systems/CombatLegacyDomainSpecialRegression';
import { runCombatLegacyRoleRegression } from './systems/CombatLegacyRoleRegression';
import { runCombatMultiTargetRegression } from './systems/CombatMultiTargetRegression';
import { runCombatRageRegression } from './systems/CombatRageRegression';
import { runCombatSpecialSupportRegression } from './systems/CombatSpecialSupportRegression';
import { installCombat27UiPatch } from './views/Combat27UiPatch';
import { installCombat28MultiTargetPatch } from './views/Combat28MultiTargetPatch';
import { installCombat281LegacyRolePatch } from './views/Combat281LegacyRolePatch';
import { installCombat29LegacyDomainPatch } from './views/Combat29LegacyDomainPatch';
import { installCombat291LegacyDomainHardeningPatch } from './views/Combat291LegacyDomainHardeningPatch';
import { installCombat292LegacyAbilityMetadataPatch } from './views/Combat292LegacyAbilityMetadataPatch';
import { installCombat293LegacyDomainTickPatch } from './views/Combat293LegacyDomainTickPatch';
import { installCombat294DomainControlsPatch } from './views/Combat294DomainControlsPatch';
import { installCombat295LegacyDomainParityPatch } from './views/Combat295LegacyDomainParityPatch';
import { installCombat296VersionPatch } from './views/Combat296VersionPatch';
import { installCombat298ActionChoreographyPatch } from './views/Combat298ActionChoreographyPatch';
import { installCombat299StatusVisualPatch } from './views/Combat299StatusVisualPatch';
import { installCombat2100ReserveFlowPatch } from './views/Combat2100ReserveFlowPatch';
import { CombatPresentationDirector } from './views/CombatPresentationDirector';
import { installCombat2101UltimateCinematicPatch } from './views/Combat2101UltimateCinematicPatch';
import { installCombat2101VersionPatch } from './views/Combat2101VersionPatch';
import { installCombat2102ArenaFocusPatch } from './views/Combat2102ArenaFocusPatch';
import { PowView } from './views/PowView';

const logicalWidth = 1600;
const logicalHeight = 900;
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Swap only the standalone Combat2 test roster. This does not touch the main
// Powder save/formation and falls back safely if a requested catalog Pow is absent.
const testRosterReport = installCombat2100TestRoster();

// Presentation first, then compatibility overlays. Each legacy layer wraps the
// already-restored behavior instead of replacing the current Combat2 core.
installCombat27UiPatch(BattleScene, PowView);
installCombat28MultiTargetPatch(BattleScene);
installCombat281LegacyRolePatch(BattleScene, CombatGuardEngine);
installCombat29LegacyDomainPatch(BattleScene);
installCombat291LegacyDomainHardeningPatch();
installCombat292LegacyAbilityMetadataPatch(BattleScene);
installCombat293LegacyDomainTickPatch(BattleScene);
installCombat294DomainControlsPatch(BattleScene);
installCombat295LegacyDomainParityPatch();
installCombat296VersionPatch(BattleScene);
// Visible Combat2 layers are intentionally installed last so they wrap the
// fully-hardened battle/domain stack rather than being overwritten by it.
installCombat298ActionChoreographyPatch(BattleScene, PowView);
installCombat299StatusVisualPatch(BattleScene, PowView);
installCombat2100ReserveFlowPatch(BattleScene, PowView);
installCombat2101UltimateCinematicPatch(CombatPresentationDirector);
installCombat2101VersionPatch(BattleScene);
installCombat2102ArenaFocusPatch(BattleScene, PowView);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'powder-combat2',
  width: logicalWidth,
  height: logicalHeight,
  backgroundColor: '#08131f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: logicalWidth,
    height: logicalHeight
  },
  fps: { target: 60, min: 30, smoothStep: true },
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scene: [BattleScene]
};

// Rendering is never blocked by DEV regressions.
const game = new Phaser.Game(config);
let earlyRefreshTimer = 0;
let lateRefreshTimer = 0;
const refreshScale = (): void => {
  window.clearTimeout(earlyRefreshTimer);
  window.clearTimeout(lateRefreshTimer);
  earlyRefreshTimer = window.setTimeout(() => game.scale.refresh(), 80);
  lateRefreshTimer = window.setTimeout(() => game.scale.refresh(), 260);
};
window.addEventListener('orientationchange', refreshScale, { passive: true });
window.addEventListener('resize', refreshScale, { passive: true });

if (isLocalDev) {
  queueMicrotask(() => {
    try {
      const report = runCombat2SmokeRegression();
      const specialSupport = runCombatSpecialSupportRegression();
      const rage = runCombatRageRegression();
      const guard = runCombatGuardRegression();
      const multiTarget = runCombatMultiTargetRegression();
      const legacyRole = runCombatLegacyRoleRegression();
      const legacyDomain = runCombatLegacyDomainRegression();
      const legacyDomainSpecial = runCombatLegacyDomainSpecialRegression();
      const legacyDomainParity = runCombatLegacyDomainParityRegression();
      console.info('[Combat2 Regression PASS]', {
        ...report,
        specialSupport,
        rage,
        guard,
        multiTarget,
        legacyRole,
        legacyDomain,
        legacyDomainSpecial,
        legacyDomainParity,
        roster: testRosterReport,
        actionFx: (globalThis as any).POWDER_COMBAT2_ACTION_FX?.version ?? 'missing',
        statusFx: (globalThis as any).POWDER_COMBAT2_STATUS_FX?.version ?? 'missing',
        reserveFx: (globalThis as any).POWDER_COMBAT2_RESERVE_FX?.version ?? 'missing',
        ultimateFx: (globalThis as any).POWDER_COMBAT2_ULTIMATE_FX?.version ?? 'missing',
        arenaFocus: (globalThis as any).POWDER_COMBAT2_ARENA_FOCUS?.version ?? 'missing'
      });
    } catch (error) {
      console.error('[Combat2 Regression FAIL - NON BLOCKING]', error);
    }
  });
}
