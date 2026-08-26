import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { runCombat2SmokeRegression } from './systems/CombatRegression';

const portrait = window.innerHeight > window.innerWidth;
const logicalWidth = portrait ? 900 : 1600;
const logicalHeight = portrait ? 1600 : 900;
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
  render: {
    antialias: true,
    pixelArt: false
  },
  scene: [BattleScene]
};

// Battle rendering must never depend on a DEV-only smoke regression passing.
// Start Phaser first so a regression failure cannot leave combat2.html as a
// blank background. The regression still runs locally and reports failures in
// DevTools without interrupting the playable scene.
new Phaser.Game(config);

if (isLocalDev) {
  queueMicrotask(() => {
    try {
      const report = runCombat2SmokeRegression();
      console.info('[Combat2 Regression PASS]', report);
    } catch (error) {
      console.error('[Combat2 Regression FAIL - NON BLOCKING]', error);
    }
  });
}
