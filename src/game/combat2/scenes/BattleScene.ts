import Phaser from 'phaser';
import type { CombatPow, CombatSide } from '../data/CombatPow';
import {
  ALL_COMBAT2_STARTER_POWS,
  COMBAT2_STARTER_ROSTER
} from '../data/PowderDataAdapter';
import { PowView } from '../views/PowView';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  preload(): void {
    for (const pow of ALL_COMBAT2_STARTER_POWS) {
      if (!this.textures.exists(pow.assetKey)) {
        this.load.image(pow.assetKey, pow.assetUrl);
      }
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.cameras.main.setBackgroundColor('#06111c');
    this.createBattlefield(width, height);

    this.add
      .text(width / 2, 34, 'POWDER COMBAT 2.0.1', {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 64, 'REAL POW RENDERER · CANONICAL PORTRAIT ART', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#72d8ed'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 92, 'POW ĐỊCH', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#9bb8c7',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.createTeam(width, 240, 'enemy', COMBAT2_STARTER_ROSTER.enemy);

    this.add
      .text(width / 2, height / 2, 'ROUND 1', {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#0a2433',
        padding: { x: 14, y: 7 }
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 500, 'ĐỘI POW CỦA BẠN', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#9bb8c7',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.createTeam(width, 680, 'player', COMBAT2_STARTER_ROSTER.player);
  }

  private createBattlefield(width: number, height: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x071827, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(0x0a2031, 0.74);
    graphics.fillEllipse(width / 2, height / 2, 1160, 400);

    graphics.lineStyle(1, 0x21475c, 0.45);
    graphics.strokeEllipse(width / 2, height / 2, 1160, 400);
    graphics.strokeEllipse(width / 2, height / 2, 850, 285);

    graphics.lineStyle(1, 0x15394e, 0.55);
    graphics.lineBetween(110, height / 2, width - 110, height / 2);
  }

  private createTeam(
    width: number,
    y: number,
    side: CombatSide,
    team: CombatPow[]
  ): void {
    const spacing = 365;
    const center = width / 2;

    team.forEach((pow, index) => {
      const x = center + (index - 1) * spacing;

      new PowView(this, x, y, pow, {
        side,
        width: 286,
        height: 300
      });
    });
  }
}
