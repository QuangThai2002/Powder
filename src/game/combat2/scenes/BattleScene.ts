import Phaser from 'phaser';
import type { CombatPow, CombatSide } from '../data/CombatPow';
import {
  ALL_COMBAT2_STARTER_POWS,
  COMBAT2_STARTER_ROSTER
} from '../data/PowderDataAdapter';
import { CombatState } from '../systems/CombatState';
import { TurnManager } from '../systems/TurnManager';
import { PowView } from '../views/PowView';

export class BattleScene extends Phaser.Scene {
  private combatState!: CombatState;
  private turnManager!: TurnManager;

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

    this.combatState = new CombatState(
      COMBAT2_STARTER_ROSTER.player,
      COMBAT2_STARTER_ROSTER.enemy
    );
    this.turnManager = new TurnManager(this.combatState);
    const firstActor = this.turnManager.beginNextTurn();

    this.cameras.main.setBackgroundColor('#06111c');
    this.createBattlefield(width, height);

    this.add
      .text(width / 2, 32, 'POWDER COMBAT 2.0.3', {
        fontFamily: 'Arial',
        fontSize: '27px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 61, 'REAL POW RENDERER · SAFE TURN STATE', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#72d8ed'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 88, 'POW ĐỊCH', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#9bb8c7',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.createTeam(width, 240, 'enemy', COMBAT2_STARTER_ROSTER.enemy);

    this.add
      .text(width / 2, height / 2 - 18, `ROUND ${this.combatState.round}`, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#0a2433',
        padding: { x: 14, y: 7 }
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height / 2 + 22,
        firstActor ? `LƯỢT ĐẦU: ${firstActor.pow.name}` : 'KHÔNG CÓ LƯỢT HỢP LỆ',
        {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: firstActor?.side === 'player' ? '#6fe5ff' : '#ffb18d'
        }
      )
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
        height: 318
      });
    });
  }
}
