import Phaser from 'phaser';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.cameras.main.setBackgroundColor('#08131f');

    this.add
      .text(width / 2, 45, 'POWDER COMBAT 2.0', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 85, 'PHASER + TYPESCRIPT', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#7ddff5'
      })
      .setOrigin(0.5);

    this.createTeam(width, 180, 'enemy');

    this.add
      .text(width / 2, height / 2, 'ROUND 1', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    this.createTeam(width, height - 310, 'player');
  }

  private createTeam(
    width: number,
    y: number,
    side: 'player' | 'enemy'
  ): void {
    const spacing = 330;
    const center = width / 2;

    for (let i = 0; i < 3; i += 1) {
      const x = center + (i - 1) * spacing;

      this.createPowCard(
        x,
        y,
        side === 'player'
          ? `Pow ${i + 1}`
          : `Enemy ${i + 1}`
      );
    }
  }

  private createPowCard(
    x: number,
    y: number,
    name: string
  ): void {
    const cardWidth = 250;
    const cardHeight = 220;

    const card = this.add.rectangle(
      x,
      y,
      cardWidth,
      cardHeight,
      0x102838,
      0.95
    );

    card.setStrokeStyle(2, 0x4ecde6);

    const powArea = this.add.rectangle(
      x,
      y - 25,
      190,
      130,
      0x183e55
    );

    powArea.setStrokeStyle(1, 0x7adff0);

    this.add
      .text(x, y - 25, 'POW', {
        fontSize: '36px',
        color: '#9cecff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add
      .text(
        x - cardWidth / 2 + 15,
        y + 65,
        name,
        {
          fontSize: '18px',
          color: '#ffffff',
          fontStyle: 'bold'
        }
      );

    this.add.rectangle(
      x,
      y + 92,
      210,
      12,
      0x173040
    );

    this.add.rectangle(
      x - 15,
      y + 92,
      180,
      8,
      0x44d58a
    );
  }
}