import Phaser from 'phaser';
import type { CombatPow, CombatSide } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';

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

  private hpBar!: Phaser.GameObjects.Rectangle;
  private manaBar!: Phaser.GameObjects.Rectangle;
  private rageBar!: Phaser.GameObjects.Rectangle;
  private turnGlow!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private readonly barWidth: number;

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
    this.barWidth = this.cardWidth - 24;
    this.container = scene.add.container(x, y);

    this.build();
  }

  updateRuntime(unit: CombatUnitState): void {
    this.setBarWidth(this.hpBar, this.ratio(unit.hp, unit.pow.maxHp));
    this.setBarWidth(this.manaBar, this.ratio(unit.mana, unit.pow.maxMana));
    this.setBarWidth(this.rageBar, this.ratio(unit.rage, unit.pow.maxRage));

    if (!unit.alive) {
      this.container.setAlpha(0.38);
      this.statusText.setText('HẠ GỤC').setVisible(true);
      this.setActiveTurn(false);
      return;
    }

    this.container.setAlpha(1);
    this.statusText.setVisible(false);
  }

  setActiveTurn(active: boolean): void {
    this.turnGlow.setVisible(active);
  }

  async playAttackLunge(targetX: number, targetY: number): Promise<void> {
    const startX = this.container.x;
    const startY = this.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const travel = 28;
    const attackX = startX + (dx / distance) * travel;
    const attackY = startY + (dy / distance) * travel;

    await this.tweenPromise({
      targets: this.container,
      x: attackX,
      y: attackY,
      duration: 90,
      ease: 'Quad.easeOut',
      yoyo: true
    });

    this.container.setPosition(startX, startY);
  }

  async playHit(): Promise<void> {
    await this.tweenPromise({
      targets: this.container,
      x: this.container.x + (this.side === 'player' ? -8 : 8),
      duration: 55,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut'
    });
  }

  getWorldPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.container.x, this.container.y);
  }

  private build(): void {
    const w = this.cardWidth;
    const h = this.cardHeight;
    const top = -h / 2;
    const left = -w / 2;

    const borderColor = this.side === 'player' ? 0x54d8f2 : 0xf49b6a;

    this.turnGlow = this.scene.add.rectangle(0, 0, w + 10, h + 10, 0x000000, 0);
    this.turnGlow.setStrokeStyle(3, 0xffdc6d, 0.95).setVisible(false);

    const card = this.scene.add.rectangle(0, 0, w, h, 0x071723, 0.94);
    card.setStrokeStyle(2, borderColor, 0.92);

    // Combat-focused card: almost all vertical room belongs to the canonical
    // Pow art. Metadata and resource bars are compressed into the footer.
    const footerHeight = 78;
    const artHeight = h - footerHeight - 14;
    const artWidth = w - 20;
    const artY = top + 9 + artHeight / 2;

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
      (artWidth * 0.96) / sourceWidth
    );
    portrait.setScale(baseScale * (this.pow.display.scaleAdjust ?? 1));

    const infoY = top + artHeight + 16;

    const name = this.scene.add.text(left + 12, infoY, this.pow.name, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const meta = this.scene.add.text(
      left + 12,
      infoY + 22,
      `Lv.${this.pow.level} · ${this.pow.element} · ${this.pow.role}`,
      {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#9cc7d7'
      }
    );

    const hpY = infoY + 43;
    const manaY = hpY + 11;
    const rageY = manaY + 11;

    const hpBack = this.makeBarBack(left + 12, hpY, this.barWidth);
    this.hpBar = this.makeBar(left + 12, hpY, this.barWidth, 0x47dc90);

    const manaBack = this.makeBarBack(left + 12, manaY, this.barWidth);
    this.manaBar = this.makeBar(
      left + 12,
      manaY,
      this.barWidth * this.ratio(this.pow.mana, this.pow.maxMana),
      0x4dc7f2
    );

    const rageBack = this.makeBarBack(left + 12, rageY, this.barWidth);
    this.rageBar = this.makeBar(
      left + 12,
      rageY,
      this.barWidth * this.ratio(this.pow.rage, this.pow.maxRage),
      0xb771f5
    );

    this.statusText = this.scene.add
      .text(0, artY, 'HẠ GỤC', {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#721f2a',
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.container.add([
      this.turnGlow,
      card,
      artBack,
      portrait,
      name,
      meta,
      hpBack,
      this.hpBar,
      manaBack,
      this.manaBar,
      rageBack,
      this.rageBar,
      this.statusText
    ]);
  }

  private makeBarBack(
    x: number,
    y: number,
    width: number
  ): Phaser.GameObjects.Rectangle {
    return this.scene.add
      .rectangle(x, y, width, 6, 0x163342, 1)
      .setOrigin(0, 0.5);
  }

  private makeBar(
    x: number,
    y: number,
    width: number,
    color: number
  ): Phaser.GameObjects.Rectangle {
    return this.scene.add
      .rectangle(x, y, Math.max(0, width), 6, color, 1)
      .setOrigin(0, 0.5);
  }

  private setBarWidth(bar: Phaser.GameObjects.Rectangle, ratio: number): void {
    bar.displayWidth = Math.max(0.01, this.barWidth * ratio);
  }

  private ratio(value: number, max: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
      return 0;
    }

    return Phaser.Math.Clamp(value / max, 0, 1);
  }

  private tweenPromise(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        ...config,
        onComplete: () => resolve()
      });
    });
  }
}
