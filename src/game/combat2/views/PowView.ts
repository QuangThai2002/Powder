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
  private readonly fieldScale: number;

  private hpBar!: Phaser.GameObjects.Rectangle;
  private manaBar!: Phaser.GameObjects.Rectangle;
  private rageBar!: Phaser.GameObjects.Rectangle;
  private turnGlow!: Phaser.GameObjects.Rectangle;
  private targetGlow!: Phaser.GameObjects.Rectangle;
  private targetHitArea!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private readonly barWidth: number;
  private targetable = false;
  private selectedTarget = false;
  private targetSelectedHandler: (() => void) | null = null;

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
    this.fieldScale = scene.scale.height > scene.scale.width ? 0.72 : 1;
    this.container = scene.add.container(x, y);

    this.build();
    this.container.setScale(this.fieldScale);
  }

  updateRuntime(unit: CombatUnitState): void {
    this.setBarWidth(this.hpBar, this.ratio(unit.hp, unit.pow.maxHp));
    this.setBarWidth(this.manaBar, this.ratio(unit.mana, unit.pow.maxMana));
    this.setBarWidth(this.rageBar, this.ratio(unit.rage, unit.pow.maxRage));

    if (!unit.alive) {
      this.container.setAlpha(0.28);
      this.statusText.setText('HẠ GỤC').setVisible(true);
      this.setActiveTurn(false);
      this.setTargetable(false);
      this.setSelectedTarget(false);
      return;
    }

    this.container.setAlpha(unit.fieldSlot === null ? 0.78 : 1);
    const runtimeStatus = this.getRuntimeStatus(unit);
    this.statusText.setText(runtimeStatus).setVisible(Boolean(runtimeStatus));
  }

  setActiveTurn(active: boolean): void {
    this.turnGlow.setVisible(active);
  }

  setTargetable(active: boolean): void {
    this.targetable = active;

    if (active) {
      this.targetHitArea.setInteractive({ useHandCursor: true });
    } else {
      this.targetHitArea.disableInteractive();
      this.selectedTarget = false;
    }

    this.refreshTargetGlow();
  }

  setSelectedTarget(selected: boolean): void {
    this.selectedTarget = selected && this.targetable;
    this.refreshTargetGlow();
  }

  onTargetSelected(handler: () => void): void {
    this.targetSelectedHandler = handler;
  }

  setBenchScale(scale: number): void {
    let safe = Number.isFinite(scale) ? Phaser.Math.Clamp(scale, 0.35, 1) : 0.55;
    if (this.scene.scale.height > this.scene.scale.width) {
      safe = Math.min(safe, 0.42);
    }
    this.container.setScale(safe);
  }

  async enterField(x: number, y: number): Promise<void> {
    this.container.setAlpha(1);
    await this.tweenPromise({
      targets: this.container,
      x,
      y,
      scaleX: this.fieldScale,
      scaleY: this.fieldScale,
      duration: 320,
      ease: 'Back.easeOut'
    });
    this.container.setPosition(x, y).setScale(this.fieldScale);
  }

  async retireFromField(x: number, y: number): Promise<void> {
    const exitScale = this.scene.scale.height > this.scene.scale.width ? 0.3 : 0.42;
    await this.tweenPromise({
      targets: this.container,
      x,
      y,
      scaleX: exitScale,
      scaleY: exitScale,
      alpha: 0.18,
      duration: 220,
      ease: 'Quad.easeIn'
    });
  }

  async playAttackLunge(targetX: number, targetY: number): Promise<void> {
    const startX = this.container.x;
    const startY = this.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const travel = this.scene.scale.height > this.scene.scale.width ? 22 : 28;
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

  async playStatusPulse(): Promise<void> {
    await this.tweenPromise({
      targets: this.container,
      scaleX: this.fieldScale * 1.025,
      scaleY: this.fieldScale * 1.025,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeInOut'
    });
    this.container.setScale(this.fieldScale);
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

    this.targetGlow = this.scene.add.rectangle(0, 0, w + 16, h + 16, 0x000000, 0);
    this.targetGlow.setVisible(false);

    this.turnGlow = this.scene.add.rectangle(0, 0, w + 10, h + 10, 0x000000, 0);
    this.turnGlow.setStrokeStyle(3, 0xffdc6d, 0.95).setVisible(false);

    const card = this.scene.add.rectangle(0, 0, w, h, 0x071723, 0.94);
    card.setStrokeStyle(2, borderColor, 0.92);

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
      .text(0, artY, '', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#4a2535',
        padding: { x: 9, y: 5 }
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.targetHitArea = this.scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001);
    this.targetHitArea.on('pointerover', () => {
      if (this.targetable && !this.selectedTarget) {
        this.targetGlow
          .setStrokeStyle(2, 0x78e8ff, 0.82)
          .setVisible(true);
      }
    });
    this.targetHitArea.on('pointerout', () => this.refreshTargetGlow());
    this.targetHitArea.on('pointerup', () => {
      if (this.targetable) {
        this.targetSelectedHandler?.();
      }
    });

    this.container.add([
      this.targetGlow,
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
      this.statusText,
      this.targetHitArea
    ]);
  }

  private refreshTargetGlow(): void {
    if (!this.targetable) {
      this.targetGlow.setVisible(false);
      return;
    }

    if (this.selectedTarget) {
      this.targetGlow
        .setStrokeStyle(4, 0xffdc6d, 1)
        .setVisible(true);
      return;
    }

    this.targetGlow
      .setStrokeStyle(1, 0x78e8ff, 0.52)
      .setVisible(true);
  }

  private getRuntimeStatus(unit: CombatUnitState): string {
    if (unit.fieldSlot === null && unit.alive) {
      return 'DỰ BỊ';
    }

    if (unit.controlActionsRemaining > 0) {
      return unit.controlStatus === 'freeze' ? 'ĐÓNG BĂNG' : 'CHOÁNG';
    }

    if (unit.dotActionsRemaining > 0) {
      return unit.dotStatus === 'poison' ? 'NHIỄM ĐỘC' : 'THIÊU ĐỐT';
    }

    if (unit.speedDebuffActionsRemaining > 0) {
      return 'CHẬM';
    }

    if (unit.attackBuffActionsRemaining > 0) {
      return 'TĂNG CÔNG';
    }

    if (unit.defenseBuffActionsRemaining > 0) {
      return 'TĂNG THỦ';
    }

    if (unit.speedBuffActionsRemaining > 0) {
      return 'TĂNG TỐC';
    }

    if (unit.shield > 0) {
      return `KHIÊN ${Math.round(unit.shield)}`;
    }

    return '';
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
