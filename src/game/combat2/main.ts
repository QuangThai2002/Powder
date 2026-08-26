import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  parent: 'powder-combat2',

  width: 1600,
  height: 900,

  backgroundColor: '#08131f',

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1600,
    height: 900
  },

  render: {
    antialias: true,
    pixelArt: false
  },

  scene: [BattleScene]
};

new Phaser.Game(config);