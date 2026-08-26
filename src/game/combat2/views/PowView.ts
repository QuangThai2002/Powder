import Phaser from 'phaser';
import type { CombatPow, CombatSide } from '../data/CombatPow';

interface PowViewOptions {
  side: CombatSide;
  width?: number;
  height?: number;
}

export class PowView {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly pow: CombatPow;
  private readonly cardWidth: number;
  private readonly cardHeight: number;
  private readonly side: CombatSide;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pow: CombatPow,
    options: PowViewOptions
  ) {
    this.scene = scene;
    this.pow = pow;
    this.side = options.side;
    this.cardWidth = options.width ?? 282;
    this.cardHeight = options.height ?? 294;
    this.container = scene.add.container(x, y);

    this.build();
  }

  private build(): void {
    const w = this.cardWidth;
    const h = this.cardHeight;
    const top = -h / 2;
    const left = -w / 2;

    const borderColor = this.side === 'player' ? 0x54d8f2 : 0xf49b6a;
    const card = this.scene.add.rectangle(0, 0, w, h, 0x071723, 0.94);
    card.setStrokeStyle(2, borderColor, 0.92);

    const artHeight = 214;
    const artWidth = w - 20;
    const artY = top + 10 + artHeight / 2;

    const artBack = this.scene.add.rectangle(
      0,
      artY,
      artWidth,
      artHeight,
      0x0c2636,
      1
    );
    artBack.setStrokeStyle(1, 0x31586c, 0.9);

    const portrait = this.scene.add.image(
      this.pow.display.offsetX ?? 0,
      artY + (this.pow.display.offsetY ?? 0),
      this.pow.assetKey
    );
    portrait.setOrigin(0.5, 0.5);

    const source = portrait.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = Math.max(1, source.width);
    const sourceHeight = Math.max(1, source.height);
    const desiredHeight = artHeight * this.pow.display.heightRatio;
    const baseScale = Math.min(
      desiredHeight / sourceHeight,
      (artWidth * 0.94) / sourceWidth
    );
    const scale = baseScale * (this.pow.display.scaleAdjust ?? 1);
    portrait.setScale(scale);

    const infoY = top + artHeight + 18;

    const name = this.scene.add.text(left + 12, infoY, this.pow.name, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const meta = this.scene.add.text(
      left + 12,
      infoY + 24,
      `Lv.${this.pow.level}  ·  ${this.pow.element}  ·  ${this.pow.role}`,
      {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#9cc7d7'
      }
    );

    const hpY = infoY + 50;
    const manaY = hpY + 13;
    const rageY = manaY + 13;
    const barWidth = w - 24;

    const hpBack = this.makeBarBack(left + 12, hpY, barWidth);
    const hp = this.makeBar(
      left + 12,
      hpY,
      barWidth * this.ratio(this.pow.hp, this.pow.maxHp),
      0x47dc90
    );

    const manaBack = this.makeBarBack(left + 12, manaY, barWidth);
    const mana = this.makeBar(
      left + 12,
      manaY,
      barWidth * this.ratio(this.pow.mana, this.pow.maxMana),
      0x4dc7f2
    );

    const rageBack = this.makeBarBack(left + 12, rageY, barWidth);
    const rage = this.makeBar(
      left + 12,
      rageY,
      barWidth * this.ratio(this.pow.rage, this.pow.maxRage),
      0xb771f5
    );

    this.container.add([
      card,
      artBack,
      portrait,
      name,
      meta,
      hpBack,
      hp,
      manaBack,
      mana,
      rageBack,
      rage
    ]);
  }

  private makeBarBack(
    x: number,
    y: number,
    width: number
  ): Phaser.GameObjects.Rectangle {
    return this.scene.add
      .rectangle(x, y, width, 7, 0x163342, 1)
      .setOrigin(0, 0.5);
  }

  private makeBar(
    x: number,
    y: number,
    width: number,
    color: number
  ): Phaser.GameObjects.Rectangle {
    return this.scene.add
      .rectangle(x, y, Math.max(0, width), 7, color, 1)
      .setOrigin(0, 0.5);
  }

  private ratio(value: number, max: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
      return 0;
    }

    return Phaser.Math.Clamp(value / max, 0, 1);
  }
}
