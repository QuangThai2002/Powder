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
  private readonly reducedMotion: boolean;

  private portrait!: Phaser.GameObjects.Image;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private manaBar!: Phaser.GameObjects.Rectangle;
  private rageBar!: Phaser.GameObjects.Rectangle;
  private turnGlow!: Phaser.GameObjects.Rectangle;
  private targetGlow!: Phaser.GameObjects.Rectangle;
  private statusFrame!: Phaser.GameObjects.Rectangle;
  private targetHitArea!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private readonly barWidth: number;
  private runtimeVisualStatus = '';
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
    this.reducedMotion =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    this.container = scene.add.container(x, y);

    this.build();
    this.container.setScale(this.fieldScale);
  }

  updateRuntime(unit: CombatUnitState): void {
    this.setBarWidth(this.hpBar, this.ratio(unit.hp, unit.pow.maxHp));
    this.setBarWidth(this.manaBar, this.ratio(unit.mana, unit.pow.maxMana));
    this.setBarWidth(this.rageBar, this.ratio(unit.rage, unit.pow.maxRage));

    if (!unit.alive) {
      this.runtimeVisualStatus = 'HẠ GỤC';
      this.container.setAlpha(0.28);
      this.statusText
        .setText('HẠ GỤC')
        .setBackgroundColor('#4f2029')
        .setVisible(true);
      this.refreshStatusFrame(this.runtimeVisualStatus);
      this.setActiveTurn(false);
      this.setTargetable(false);
      this.setSelectedTarget(false);
      return;
    }

    this.container.setAlpha(unit.fieldSlot === null ? 0.78 : 1);
    const runtimeStatus = this.getRuntimeStatus(unit);
    this.runtimeVisualStatus = runtimeStatus;
    this.statusText
      .setText(runtimeStatus)
      .setBackgroundColor(this.statusBackground(runtimeStatus))
      .setVisible(Boolean(runtimeStatus));
    this.refreshStatusFrame(runtimeStatus);
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
    await this.playCastSignature(false);
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
    const travel = this.scene.scale.height > this.scene.scale.width ? 22 : 32;
    const attackX = startX + (dx / distance) * travel;
    const attackY = startY + (dy / distance) * travel;

    await this.playCastSignature(false);

    const projectile = this.playElementTravel(targetX, targetY);
    const lunge = this.tweenPromise({
      targets: this.container,
      x: attackX,
      y: attackY,
      duration: this.reducedMotion ? 55 : 92,
      ease: 'Quad.easeOut',
      yoyo: true
    });

    await Promise.all([projectile, lunge]);
    this.container.setPosition(startX, startY);
  }

  async playHit(): Promise<void> {
    this.playHitFlash();

    if (!this.reducedMotion) {
      this.scene.cameras.main.shake(70, 0.00115);
    }

    await this.tweenPromise({
      targets: this.container,
      x: this.container.x + (this.side === 'player' ? -9 : 9),
      duration: this.reducedMotion ? 38 : 52,
      yoyo: true,
      repeat: this.reducedMotion ? 0 : 1,
      ease: 'Sine.easeInOut'
    });
  }

  async playStatusPulse(): Promise<void> {
    if (
      this.runtimeVisualStatus === 'ĐÓNG BĂNG' ||
      this.runtimeVisualStatus === 'CHOÁNG'
    ) {
      await this.playControlLock(this.runtimeVisualStatus);
      return;
    }

    await this.playCastSignature(true);
    await Promise.all([
      this.playSupportAura(),
      this.tweenPromise({
        targets: this.container,
        scaleX: this.fieldScale * 1.025,
        scaleY: this.fieldScale * 1.025,
        duration: this.reducedMotion ? 55 : 90,
        yoyo: true,
        ease: 'Sine.easeInOut'
      })
    ]);
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
    const elementColor = this.elementColor();

    this.statusFrame = this.scene.add.rectangle(0, 0, w + 20, h + 20, 0x000000, 0);
    this.statusFrame.setVisible(false);

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
    artBack.setStrokeStyle(2, elementColor, 0.58);

    this.portrait = this.scene.add.image(
      this.pow.display.offsetX ?? 0,
      artY + (this.pow.display.offsetY ?? 0),
      this.pow.assetKey
    );
    this.portrait.setOrigin(0.5, 0.5);

    const source = this.portrait.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = Math.max(1, source.width);
    const sourceHeight = Math.max(1, source.height);
    const desiredHeight = artHeight * this.pow.display.heightRatio;
    const baseScale = Math.min(
      desiredHeight / sourceHeight,
      (artWidth * 0.96) / sourceWidth
    );
    this.portrait.setScale(baseScale * (this.pow.display.scaleAdjust ?? 1));

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
      this.statusFrame,
      this.targetGlow,
      this.turnGlow,
      card,
      artBack,
      this.portrait,
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

  private playHitFlash(): void {
    const position = this.getWorldPosition();
    const color = this.elementColor();
    const flash = this.scene.add
      .circle(position.x, position.y - 4, 44, 0xffffff, 0.16)
      .setStrokeStyle(3, color, 0.78)
      .setDepth(38)
      .setScale(0.82);

    this.portrait.setTintFill(0xffffff);
    this.scene.time.delayedCall(this.reducedMotion ? 35 : 55, () => {
      if (this.portrait.active) {
        this.portrait.clearTint();
      }
    });

    this.scene.tweens.add({
      targets: flash,
      scaleX: 1.34,
      scaleY: 1.34,
      alpha: 0,
      duration: this.reducedMotion ? 70 : 115,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy()
    });
  }

  private async playControlLock(status: string): Promise<void> {
    const freeze = status === 'ĐÓNG BĂNG';
    const color = freeze ? 0x8adfff : 0xf5dd62;
    const position = this.getWorldPosition();
    const fx = this.scene.add.container(position.x, position.y).setDepth(39).setScale(0.78);

    const outer = this.scene.add.circle(0, 0, 55, 0x000000, 0);
    outer.setStrokeStyle(4, color, 0.9);
    const inner = this.scene.add.circle(0, 0, 38, color, 0.07);
    inner.setStrokeStyle(2, color, 0.55);

    const bars = freeze
      ? [
          this.scene.add.rectangle(-28, 0, 8, 82, color, 0.64).setRotation(-0.18),
          this.scene.add.rectangle(0, 0, 8, 92, color, 0.72),
          this.scene.add.rectangle(28, 0, 8, 82, color, 0.64).setRotation(0.18)
        ]
      : [
          this.scene.add.rectangle(-15, -8, 9, 58, color, 0.82).setRotation(0.58),
          this.scene.add.rectangle(12, 4, 9, 58, color, 0.72).setRotation(-0.56),
          this.scene.add.rectangle(0, 0, 50, 7, color, 0.5).setRotation(-0.14)
        ];

    fx.add([inner, outer, ...bars]);

    const startX = this.container.x;
    const shake = this.tweenPromise({
      targets: this.container,
      x: startX + (this.side === 'player' ? -6 : 6),
      duration: this.reducedMotion ? 42 : 52,
      yoyo: true,
      repeat: this.reducedMotion ? 0 : 2,
      ease: 'Sine.easeInOut'
    });

    const lock = this.tweenPromise({
      targets: fx,
      scaleX: 1.12,
      scaleY: 1.12,
      alpha: 0,
      duration: this.reducedMotion ? 110 : 230,
      ease: 'Quad.easeOut'
    });

    await Promise.all([shake, lock]);
    this.container.setX(startX);
    fx.destroy(true);
  }

  private async playCastSignature(support: boolean): Promise<void> {
    const color = this.elementColor();
    const position = this.getWorldPosition();
    const ring = this.scene.add.circle(position.x, position.y, support ? 54 : 42, 0x000000, 0);
    ring.setStrokeStyle(support ? 4 : 3, color, 0.86).setDepth(34).setScale(0.62);
    const innerRing = this.scene.add.circle(position.x, position.y, support ? 34 : 28, color, 0.05);
    innerRing.setStrokeStyle(2, color, 0.46).setDepth(34).setScale(0.72);
    const roleCue = this.createRoleCue(position.x, position.y, color);

    await Promise.all([
      this.tweenPromise({
        targets: ring,
        scaleX: support ? 1.42 : 1.24,
        scaleY: support ? 1.42 : 1.24,
        alpha: 0,
        duration: this.reducedMotion ? 90 : 150,
        ease: 'Quad.easeOut'
      }),
      this.tweenPromise({
        targets: innerRing,
        scaleX: support ? 1.24 : 1.12,
        scaleY: support ? 1.24 : 1.12,
        alpha: 0,
        duration: this.reducedMotion ? 90 : 145,
        ease: 'Quad.easeOut'
      }),
      this.tweenPromise({
        targets: roleCue,
        scaleX: support ? 1.34 : 1.18,
        scaleY: support ? 1.34 : 1.18,
        alpha: 0,
        duration: this.reducedMotion ? 90 : 160,
        ease: 'Quad.easeOut'
      })
    ]);

    ring.destroy();
    innerRing.destroy();
    roleCue.destroy(true);
  }

  private async playElementTravel(targetX: number, targetY: number): Promise<void> {
    const color = this.elementColor();
    const start = this.getWorldPosition();
    const angle = Math.atan2(targetY - start.y, targetX - start.x);

    const beam = this.scene.add.graphics().setDepth(34);
    beam.lineStyle(this.reducedMotion ? 2 : 3, color, this.reducedMotion ? 0.2 : 0.34);
    beam.lineBetween(start.x, start.y, targetX, targetY);

    const projectile = this.scene.add.container(start.x, start.y).setDepth(36).setRotation(angle);
    const core = this.scene.add.circle(0, 0, this.reducedMotion ? 6 : 8, color, 0.98);
    const halo = this.scene.add.circle(0, 0, this.reducedMotion ? 10 : 14, 0x000000, 0);
    halo.setStrokeStyle(2, color, 0.62);
    projectile.add([halo, core]);

    if (!this.reducedMotion) {
      const tail = this.scene.add.rectangle(-15, 0, 24, 5, color, 0.46);
      const moteA = this.scene.add.circle(-24, -5, 3, color, 0.48);
      const moteB = this.scene.add.circle(-30, 5, 2, color, 0.36);
      projectile.add([tail, moteA, moteB]);
    }

    await Promise.all([
      this.tweenPromise({
        targets: projectile,
        x: targetX,
        y: targetY,
        duration: this.reducedMotion ? 85 : 138,
        ease: 'Quad.easeIn'
      }),
      this.tweenPromise({
        targets: beam,
        alpha: 0,
        duration: this.reducedMotion ? 90 : 150,
        ease: 'Quad.easeOut'
      })
    ]);

    projectile.destroy(true);
    beam.destroy();
    await this.playElementImpact(targetX, targetY, color);
  }

  private async playElementImpact(x: number, y: number, color: number): Promise<void> {
    const burst = this.scene.add.container(x, y).setDepth(37);
    const core = this.scene.add.circle(0, 0, 14, color, 0.2);
    const ring = this.scene.add.circle(0, 0, 18, 0x000000, 0);
    ring.setStrokeStyle(3, color, 0.92);
    burst.add([core, ring]);

    if (!this.reducedMotion) {
      const shardCount = this.scene.scale.height > this.scene.scale.width ? 3 : 5;
      for (let index = 0; index < shardCount; index += 1) {
        const angle = (Math.PI * 2 * index) / shardCount;
        const shard = this.scene.add.rectangle(
          Math.cos(angle) * 16,
          Math.sin(angle) * 16,
          18,
          4,
          color,
          0.8
        );
        shard.setRotation(angle);
        burst.add(shard);
      }
    }

    await this.tweenPromise({
      targets: burst,
      scaleX: this.reducedMotion ? 1.48 : 1.82,
      scaleY: this.reducedMotion ? 1.48 : 1.82,
      alpha: 0,
      duration: this.reducedMotion ? 80 : 145,
      ease: 'Quad.easeOut'
    });
    burst.destroy(true);
  }

  private async playSupportAura(): Promise<void> {
    const color = this.elementColor();
    const position = this.getWorldPosition();
    const aura = this.scene.add.container(position.x, position.y).setDepth(33).setScale(0.72);
    const ring = this.scene.add.circle(0, 0, 44, color, 0.08);
    ring.setStrokeStyle(4, color, 0.64);
    aura.add(ring);

    if (!this.reducedMotion) {
      aura.add([
        this.scene.add.circle(-28, 12, 5, color, 0.5),
        this.scene.add.circle(25, -8, 4, color, 0.42),
        this.scene.add.circle(8, -31, 3, color, 0.38)
      ]);
    }

    await this.tweenPromise({
      targets: aura,
      y: position.y - (this.reducedMotion ? 4 : 10),
      scaleX: 1.55,
      scaleY: 1.55,
      alpha: 0,
      duration: this.reducedMotion ? 95 : 180,
      ease: 'Sine.easeOut'
    });
    aura.destroy(true);
  }

  private createRoleCue(
    x: number,
    y: number,
    color: number
  ): Phaser.GameObjects.Container {
    const cue = this.scene.add.container(x, y).setDepth(35).setScale(0.72);
    const role = this.normalizeText(this.pow.role);

    if (role.includes('tri lieu') || role.includes('healer')) {
      cue.add([
        this.scene.add.rectangle(0, 0, 34, 8, color, 0.9),
        this.scene.add.rectangle(0, 0, 8, 34, color, 0.9)
      ]);
      return cue;
    }

    if (role.includes('do don') || role.includes('tank')) {
      const shield = this.scene.add.rectangle(0, 0, 34, 40, 0x000000, 0);
      shield.setStrokeStyle(4, color, 0.9);
      cue.add(shield);
      return cue;
    }

    if (role.includes('sat thu') || role.includes('assassin')) {
      const slashA = this.scene.add.rectangle(-5, 0, 38, 5, color, 0.92).setRotation(-0.72);
      const slashB = this.scene.add.rectangle(5, 0, 38, 5, color, 0.72).setRotation(0.72);
      cue.add([slashA, slashB]);
      return cue;
    }

    if (role.includes('phap su') || role.includes('mage') || role.includes('thuat su')) {
      cue.add([
        this.scene.add.circle(-18, 0, 6, color, 0.88),
        this.scene.add.circle(9, -15, 6, color, 0.72),
        this.scene.add.circle(9, 15, 6, color, 0.72)
      ]);
      return cue;
    }

    if (role.includes('nhac cong') || role.includes('musician')) {
      cue.add([
        this.scene.add.circle(-8, 9, 8, color, 0.9),
        this.scene.add.circle(12, 3, 8, color, 0.76),
        this.scene.add.rectangle(5, -9, 4, 28, color, 0.84).setRotation(-0.18)
      ]);
      return cue;
    }

    if (role.includes('xa thu') || role.includes('archer')) {
      cue.add([
        this.scene.add.rectangle(0, 0, 42, 4, color, 0.88),
        this.scene.add.rectangle(15, -7, 18, 4, color, 0.72).setRotation(0.72),
        this.scene.add.rectangle(15, 7, 18, 4, color, 0.72).setRotation(-0.72)
      ]);
      return cue;
    }

    const ring = this.scene.add.circle(0, 0, 22, 0x000000, 0);
    ring.setStrokeStyle(4, color, 0.86);
    cue.add(ring);
    return cue;
  }

  private elementColor(): number {
    const key = this.normalizeText(`${this.pow.elementKey} ${this.pow.element}`);

    if (key.includes('lua') || key.includes('fire')) return 0xff7043;
    if (key.includes('dung nham') || key.includes('lava')) return 0xff4f2e;
    if (key.includes('nuoc') || key.includes('water')) return 0x4db9ff;
    if (key.includes('bang') || key.includes('ice')) return 0x8adfff;
    if (key.includes('set') || key.includes('lightning') || key.includes('electric')) return 0xf5dd62;
    if (key.includes('bao') || key.includes('storm')) return 0x78a9ff;
    if (key.includes('la') || key.includes('leaf') || key.includes('nature')) return 0x72d67f;
    if (key.includes('doc') || key.includes('poison')) return 0xa5df66;
    if (key.includes('dat') || key.includes('earth')) return 0xb78c5d;
    if (key.includes('gio') || key.includes('wind')) return 0x76e4d2;
    if (key.includes('thep') || key.includes('steel')) return 0xc3d3dc;
    if (key.includes('anh sang') || key.includes('light')) return 0xffefad;
    if (key.includes('bong toi') || key.includes('dark')) return 0xa88cf2;

    return this.side === 'player' ? 0x63dff3 : 0xffa06e;
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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

  private refreshStatusFrame(status: string): void {
    const color = this.statusColor(status);
    if (!color) {
      this.statusFrame.setVisible(false);
      return;
    }

    const strong = status === 'ĐÓNG BĂNG' || status === 'CHOÁNG';
    this.statusFrame
      .setStrokeStyle(strong ? 5 : 3, color, strong ? 0.92 : 0.64)
      .setVisible(true);
  }

  private statusColor(status: string): number | null {
    if (status === 'ĐÓNG BĂNG') return 0x8adfff;
    if (status === 'CHOÁNG') return 0xf5dd62;
    if (status === 'NHIỄM ĐỘC') return 0xa5df66;
    if (status === 'THIÊU ĐỐT') return 0xff7043;
    if (status === 'CHẬM') return 0x78a9ff;
    if (status === 'TĂNG CÔNG') return 0xffc46b;
    if (status === 'TĂNG THỦ') return 0x7ed4ff;
    if (status === 'TĂNG TỐC') return 0x76e4d2;
    if (status.startsWith('KHIÊN')) return 0x8edfff;
    if (status === 'DỰ BỊ') return 0x617f8d;
    if (status === 'HẠ GỤC') return 0xff6478;
    return null;
  }

  private statusBackground(status: string): string {
    if (status === 'ĐÓNG BĂNG') return '#1d4658';
    if (status === 'CHOÁNG') return '#554a1d';
    if (status === 'NHIỄM ĐỘC') return '#31491f';
    if (status === 'THIÊU ĐỐT') return '#552c20';
    if (status === 'CHẬM') return '#283b63';
    if (status.startsWith('KHIÊN')) return '#21475a';
    if (status === 'DỰ BỊ') return '#263944';
    if (!status) return '#4a2535';
    return '#3d3152';
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
      let settled = false;
      const duration = typeof config.duration === 'number' ? config.duration : 120;
      const delay = typeof config.delay === 'number' ? config.delay : 0;
      const repeat = typeof config.repeat === 'number' && config.repeat > 0 ? config.repeat : 0;
      const cycles = (repeat + 1) * (config.yoyo ? 2 : 1);
      const fallbackMs = Math.max(180, delay + duration * cycles + 180);

      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(fallbackTimer);
        resolve();
      };

      const fallbackTimer = window.setTimeout(finish, fallbackMs);

      try {
        this.scene.tweens.add({
          ...config,
          onComplete: finish
        });
      } catch (error) {
        console.warn('[Combat2 Presentation]', error);
        finish();
      }
    });
  }
}
