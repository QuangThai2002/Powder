import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { runCombat2SmokeRegression } from './systems/CombatRegression';
import { runCombatSpecialSupportRegression } from './systems/CombatSpecialSupportRegression';

// Combat 2 is designed as a landscape battle surface on every device.
// Keeping one logical resolution prevents a phone opened in portrait from
// staying stuck with a portrait battlefield after the player rotates it.
const logicalWidth = 1600;
const logicalHeight = 900;
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

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
  fps: {
    target: 60,
    min: 30,
    smoothStep: true
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
  },
  scene: [BattleScene]
};

// Battle rendering must never depend on a DEV-only smoke regression passing.
// Start Phaser first so a regression failure cannot leave combat2.html as a
// blank background. The regression still runs locally and reports failures in
// DevTools without interrupting the playable scene.
const game = new Phaser.Game(config);

const refreshScale = (): void => {
  // FIT mode normally handles resize itself. The explicit refresh covers
  // mobile browsers that delay viewport updates during orientation changes.
  window.setTimeout(() => game.scale.refresh(), 80);
  window.setTimeout(() => game.scale.refresh(), 260);
};

window.addEventListener('orientationchange', refreshScale, { passive: true });
window.addEventListener('resize', refreshScale, { passive: true });

if (isLocalDev) {
  queueMicrotask(() => {
    try {
      const report = runCombat2SmokeRegression();
      const specialSupport = runCombatSpecialSupportRegression();
      console.info('[Combat2 Regression PASS]', { ...report, specialSupport });
    } catch (error) {
      console.error('[Combat2 Regression FAIL - NON BLOCKING]', error);
    }
  });
}
