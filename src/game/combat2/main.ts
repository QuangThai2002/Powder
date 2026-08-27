import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { runCombat2SmokeRegression } from './systems/CombatRegression';
import { CombatGuardEngine } from './systems/CombatGuardEngine';
import { runCombatGuardRegression } from './systems/CombatGuardRegression';
import { runCombatLegacyRoleCompletionRegression } from './systems/CombatLegacyRoleCompletionRegression';
import { runCombatLegacyRoleRegression } from './systems/CombatLegacyRoleRegression';
import { runCombatMultiTargetRegression } from './systems/CombatMultiTargetRegression';
import { runCombatRageRegression } from './systems/CombatRageRegression';
import { CombatState } from './systems/CombatState';
import { runCombatSpecialSupportRegression } from './systems/CombatSpecialSupportRegression';
import { SkillActionResolver } from './systems/SkillActionResolver';
import { TurnManager } from './systems/TurnManager';
import { installCombat27UiPatch } from './views/Combat27UiPatch';
import { installCombat28MultiTargetPatch } from './views/Combat28MultiTargetPatch';
import { installCombat281LegacyRolePatch } from './views/Combat281LegacyRolePatch';
import { installCombat282LegacyRoleCompletionPatch } from './views/Combat282LegacyRoleCompletionPatch';
import { PowView } from './views/PowView';

const logicalWidth = 1600;
const logicalHeight = 900;
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Presentation first, then gameplay compatibility overlays. 2.8.2 wraps the
// 2.8.1 role layer so restored healer/haste/marks/execute can reuse the current
// Guard, multi-target, Rage and CC pipelines instead of duplicating them.
installCombat27UiPatch(BattleScene, PowView);
installCombat28MultiTargetPatch(BattleScene);
installCombat281LegacyRolePatch(BattleScene, CombatGuardEngine);
installCombat282LegacyRoleCompletionPatch(
  BattleScene,
  SkillActionResolver,
  TurnManager,
  CombatState,
  PowView
);

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
      const legacyRoleCompletion = runCombatLegacyRoleCompletionRegression();
      console.info('[Combat2 Regression PASS]', {
        ...report,
        specialSupport,
        rage,
        guard,
        multiTarget,
        legacyRole,
        legacyRoleCompletion
      });
    } catch (error) {
      console.error('[Combat2 Regression FAIL - NON BLOCKING]', error);
    }
  });
}
