import Phaser from 'phaser';
import type { CombatPow, CombatSide } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';
import {
  CONTROL_IMMUNITY_TRIGGER_HITS,
  controlWindowSnapshot
} from '../systems/CombatControlEngine';
import { rageMarkerStates } from '../systems/CombatRageEngine';
import { COMBAT_BODY_FONT, COMBAT_COLORS, COMBAT_DISPLAY_FONT } from './CombatTheme';

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
  private readonly barWidth: number;

  private portrait!: Phaser.GameObjects.Image;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private readonly rageMarkers: Phaser.GameObjects.Arc[] = [];
  private controlImmunityRing!: Phaser.GameObjects.Ellipse;
  private controlHistoryText!: Phaser.GameObjects.Text;
  private turnGlow!: Phaser.GameObjects.Rectangle;
  private targetGlow!: Phaser.GameObjects.Rectangle;
  private statusFrame!: Phaser.GameObjects.Rectangle;
  private targetHitArea!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private runtimeVisualStatus = '';
  private targetable = false;
  private selectedTarget = false;
  private targetSelectedHandler: (() => void) | null = null;
  private hasRuntimeSnapshot = false;
  private previousHp = 0;
  private previousShield = 0;
  private previousRage = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, pow: CombatPow, options: PowViewOptions) {
    this.scene = scene;
    this.pow = pow;
    this.side = options.side;
    this.cardWidth = options.width ?? 286;
    this.cardHeight = options.height ?? 312;
    this.barWidth = this.cardWidth - 24;
    this.fieldScale = scene.scale.height > scene.scale.width ? 0.74 : 1;
    this.reducedMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    this.container = scene.add.container(x, y);
    this.build();
    this.container.setScale(this.fieldScale);
  }

  updateRuntime(unit: CombatUnitState): void {
    const hpRatio = this.ratio(unit.hp, unit.pow.maxHp);
    this.setBarWidth(this.hpBar, hpRatio);
    this.hpBar.setFillStyle(hpRatio <= 0.25 ? 0xff6678 : hpRatio <= 0.5 ? 0xffb55f : 0x47dc90, 1);
    this.hpText.setText(`HP  ${Math.round(unit.hp)} / ${Math.round(unit.pow.maxHp)}`);

    const markerStates = rageMarkerStates(unit.ragePoints);
    markerStates.forEach((state, index) => {
      const marker = this.rageMarkers[index];
      const color = state === 'red' ? COMBAT_COLORS.rageRed : state === 'blue' ? COMBAT_COLORS.rageBlue : COMBAT_COLORS.rageEmpty;
      marker.setFillStyle(color, state === 'empty' ? 0.38 : 1);
      marker.setStrokeStyle(
        state === 'empty' ? 1 : 2,
        state === 'red' ? 0xffa0a6 : state === 'blue' ? 0xa4eaff : 0x496675,
        state === 'empty' ? 0.4 : 0.96
      );
    });

    this.controlImmunityRing.setVisible(
      unit.alive && unit.fieldSlot !== null && unit.controlImmunityActionsRemaining > 0
    );
    this.updateControlHistoryBadge(unit);

    if (this.hasRuntimeSnapshot && unit.alive) {
      if (unit.hp > this.previousHp + 0.5) this.playResourcePulse(0x73f0aa);
      if (unit.shield > this.previousShield + 0.5) this.playResourcePulse(0x8edfff);
      else if (this.previousShield > 0 && unit.shield <= 0) this.playShieldBreak();
      if (unit.ragePoints > this.previousRage) this.playResourcePulse(0x4fc8ff);
    }
    this.previousHp = unit.hp;
    this.previousShield = unit.shield;
    this.previousRage = unit.ragePoints;
    this.hasRuntimeSnapshot = true;

    if (!unit.alive) {
      this.runtimeVisualStatus = 'HẠ GỤC';
      this.container.setAlpha(0.28);
      this.controlHistoryText.setVisible(false);
      this.statusText.setText('HẠ GỤC').setBackgroundColor('#4f2029').setVisible(true);
      this.refreshStatusFrame(this.runtimeVisualStatus);
      this.setActiveTurn(false);
      this.setTargetable(false);
      this.setSelectedTarget(false);
      return;
    }

    this.container.setAlpha(unit.fieldSlot === null ? 0.78 : 1);
    const runtimeStatus = this.getRuntimeStatus(unit);
    this.runtimeVisualStatus = runtimeStatus;
    this.statusText.setText(runtimeStatus).setBackgroundColor(this.statusBackground(runtimeStatus)).setVisible(Boolean(runtimeStatus));
    this.refreshStatusFrame(runtimeStatus);
  }

  setActiveTurn(active: boolean): void { this.turnGlow.setVisible(active); }

  setTargetable(active: boolean): void {
    this.targetable = active;
    if (active) this.targetHitArea.setInteractive({ useHandCursor: true });
    else {
      this.targetHitArea.disableInteractive();
      this.selectedTarget = false;
    }
    this.refreshTargetGlow();
  }

  setSelectedTarget(selected: boolean): void {
    this.selectedTarget = selected && this.targetable;
    this.refreshTargetGlow();
  }

  onTargetSelected(handler: () => void): void { this.targetSelectedHandler = handler; }

  setBenchScale(scale: number): void {
    const safe = Phaser.Math.Clamp(Number.isFinite(scale) ? scale : 0.5, 0.35, 1);
    this.container.setScale(this.scene.scale.height > this.scene.scale.width ? Math.min(safe, 0.42) : safe);
  }

  async enterField(x: number, y: number): Promise<void> {
    this.container.setAlpha(1).setVisible(true);
    await this.tweenPromise({ targets: this.container, x, y, scaleX: this.fieldScale, scaleY: this.fieldScale, duration: 380, ease: 'Back.easeOut' });
    this.container.setPosition(x, y).setScale(this.fieldScale);
    await this.playCastSignature(false);
  }

  async retireFromField(x: number, y: number): Promise<void> {
    await this.playDefeatBurst();
    await this.tweenPromise({ targets: this.container, x, y, scaleX: 0.42, scaleY: 0.42, alpha: 0.18, duration: 290, ease: 'Quad.easeIn' });
  }

  async playAttackLunge(targetX: number, targetY: number): Promise<void> {
    const startX = this.container.x;
    const startY = this.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const attackX = startX + (dx / distance) * 34;
    const attackY = startY + (dy / distance) * 34;
    await this.playCastSignature(false);
    await Promise.all([
      this.playElementTravel(targetX, targetY),
      this.tweenPromise({ targets: this.container, x: attackX, y: attackY, duration: this.reducedMotion ? 80 : 140, ease: 'Quad.easeOut', yoyo: true })
    ]);
    this.container.setPosition(startX, startY);
  }

  async playHit(): Promise<void> {
    this.playHitFlash();
    if (!this.reducedMotion) this.scene.cameras.main.shake(100, 0.0012);
    const startX = this.container.x;
    await this.tweenPromise({ targets: this.container, x: startX + (this.side === 'player' ? -10 : 10), duration: this.reducedMotion ? 58 : 82, yoyo: true, repeat: this.reducedMotion ? 0 : 1, ease: 'Sine.easeInOut' });
    this.container.setX(startX);
  }

  async playStatusPulse(): Promise<void> {
    if (
      this.runtimeVisualStatus === 'ĐÓNG BĂNG' ||
      this.runtimeVisualStatus === 'CHOÁNG' ||
      this.runtimeVisualStatus === 'TÊ LIỆT' ||
      this.runtimeVisualStatus === 'CÂM LẶNG'
    ) {
      await this.playControlLock(this.runtimeVisualStatus);
      return;
    }
    await this.playCastSignature(true);
    await this.playSupportAura();
  }

  getWorldPosition(): Phaser.Math.Vector2 { return new Phaser.Math.Vector2(this.container.x, this.container.y); }

  private build(): void {
    const w = this.cardWidth;
    const h = this.cardHeight;
    const top = -h / 2;
    const left = -w / 2;
    const borderColor = this.side === 'player' ? 0x54d8f2 : 0xf49b6a;
    const elementColor = this.elementColor();

    this.statusFrame = this.scene.add.rectangle(0, 0, w + 20, h + 20, 0x000000, 0).setVisible(false);
    this.targetGlow = this.scene.add.rectangle(0, 0, w + 16, h + 16, 0x000000, 0).setVisible(false);
    this.turnGlow = this.scene.add.rectangle(0, 0, w + 10, h + 10, 0x000000, 0).setStrokeStyle(3, 0xffdc6d, 0.95).setVisible(false);
    const card = this.scene.add.rectangle(0, 0, w, h, 0x071723, 0.96).setStrokeStyle(2, borderColor, 0.92);

    const footerHeight = 108;
    const artHeight = h - footerHeight - 14;
    const artWidth = w - 20;
    const artY = top + 9 + artHeight / 2;
    const artBack = this.scene.add.rectangle(0, artY, artWidth, artHeight, 0x0c2636, 1).setStrokeStyle(2, elementColor, 0.58);

    this.portrait = this.scene.add.image(this.pow.display.offsetX ?? 0, artY + (this.pow.display.offsetY ?? 0), this.pow.assetKey).setOrigin(0.5);
    const source = this.portrait.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const baseScale = Math.min((artHeight * this.pow.display.heightRatio) / Math.max(1, source.height), (artWidth * 0.96) / Math.max(1, source.width));
    this.portrait.setScale(baseScale * (this.pow.display.scaleAdjust ?? 1));
    this.controlImmunityRing = this.scene.add.ellipse(0, artY, artWidth * 0.86, artHeight * 0.82, 0x000000, 0).setStrokeStyle(4, 0x8ef7ff, 0.92).setVisible(false);
    this.controlHistoryText = this.scene.add.text(w / 2 - 11, top + 11, '', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#bff6ff', fontStyle: 'bold', backgroundColor: '#102f3bdd', padding: { x: 7, y: 4 }, stroke: '#041018', strokeThickness: 2
    }).setOrigin(1, 0).setVisible(false);

    const infoY = top + artHeight + 15;
    const name = this.scene.add.text(left + 12, infoY, this.pow.name, {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '20px', color: COMBAT_COLORS.text, fontStyle: 'bold'
    });
    const meta = this.scene.add.text(left + 12, infoY + 25, `Lv.${this.pow.level} · ${this.pow.element} · ${this.pow.role}`, {
      fontFamily: COMBAT_BODY_FONT, fontSize: '13px', color: '#b7d4dd', fontStyle: 'bold'
    });

    const hpY = infoY + 53;
    const hpBack = this.scene.add.rectangle(left + 12, hpY, this.barWidth, 17, 0x163342, 1).setOrigin(0, 0.5);
    this.hpBar = this.scene.add.rectangle(left + 12, hpY, this.barWidth, 17, 0x47dc90, 1).setOrigin(0, 0.5);
    this.hpText = this.scene.add.text(0, hpY, '', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '15px', color: '#ffffff', fontStyle: 'bold', stroke: '#041018', strokeThickness: 4
    }).setOrigin(0.5);

    const rageY = hpY + 29;
    const markerStartX = -36;
    for (let index = 0; index < 4; index += 1) {
      const marker = this.scene.add.circle(markerStartX + index * 24, rageY, 8.4, COMBAT_COLORS.rageEmpty, 0.38).setStrokeStyle(1, 0x496675, 0.4);
      this.rageMarkers.push(marker);
    }

    this.statusText = this.scene.add.text(0, artY, '', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#4a2535', padding: { x: 12, y: 8 }, stroke: '#041018', strokeThickness: 2
    }).setOrigin(0.5).setVisible(false);

    this.targetHitArea = this.scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001);
    this.targetHitArea.on('pointerover', () => { if (this.targetable && !this.selectedTarget) this.targetGlow.setStrokeStyle(3, 0x78e8ff, 0.82).setVisible(true); });
    this.targetHitArea.on('pointerout', () => this.refreshTargetGlow());
    this.targetHitArea.on('pointerup', () => { if (this.targetable) this.targetSelectedHandler?.(); });

    this.container.add([
      this.statusFrame, this.targetGlow, this.turnGlow, card, artBack, this.portrait, this.controlImmunityRing,
      this.controlHistoryText, name, meta, hpBack, this.hpBar, this.hpText, ...this.rageMarkers, this.statusText,
      this.targetHitArea
    ]);
  }

  private updateControlHistoryBadge(unit: CombatUnitState): void {
    if (!unit.alive || unit.fieldSlot === null || unit.controlImmunityActionsRemaining > 0 || unit.controlHistory.length <= 0) {
      this.controlHistoryText.setVisible(false);
      return;
    }
    const snapshot = controlWindowSnapshot(unit);
    if (snapshot.count <= 0 || snapshot.firstRound === null || snapshot.expiresRound === null) {
      this.controlHistoryText.setVisible(false);
      return;
    }
    const count = Math.min(CONTROL_IMMUNITY_TRIGGER_HITS - 1, snapshot.count);
    this.controlHistoryText.setText(`CC ${count}/${CONTROL_IMMUNITY_TRIGGER_HITS} · V${snapshot.firstRound}→${snapshot.expiresRound}`).setVisible(true);
  }

  private playResourcePulse(color: number): void {
    const p = this.getWorldPosition();
    const ring = this.scene.add.circle(p.x, p.y, 48, color, 0.055).setStrokeStyle(3, color, 0.68).setDepth(40).setScale(0.78);
    this.scene.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: this.reducedMotion ? 140 : 240, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  private playShieldBreak(): void {
    const p = this.getWorldPosition();
    const burst = this.scene.add.container(p.x, p.y).setDepth(41).setScale(0.76);
    const ring = this.scene.add.circle(0, 0, 50, 0x000000, 0).setStrokeStyle(4, 0x8edfff, 0.82);
    burst.add(ring);
    const count = this.reducedMotion ? 4 : 7;
    for (let i = 0; i < count; i += 1) {
      const a = Math.PI * 2 * i / count;
      burst.add(this.scene.add.rectangle(Math.cos(a) * 48, Math.sin(a) * 48, 18, 4, 0x8edfff, 0.72).setRotation(a + 0.45));
    }
    this.scene.tweens.add({ targets: burst, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: this.reducedMotion ? 140 : 230, ease: 'Quad.easeOut', onComplete: () => burst.destroy(true) });
  }

  private async playDefeatBurst(): Promise<void> {
    const p = this.getWorldPosition();
    const color = this.side === 'player' ? 0x70dced : 0xff9b68;
    const burst = this.scene.add.container(p.x, p.y).setDepth(44).setScale(0.72);
    burst.add([
      this.scene.add.circle(0, 0, 55, 0x000000, 0).setStrokeStyle(4, color, 0.76),
      this.scene.add.rectangle(0, 0, 92, 5, color, 0.62).setRotation(0.72),
      this.scene.add.rectangle(0, 0, 92, 5, color, 0.62).setRotation(-0.72)
    ]);
    if (!this.reducedMotion) this.scene.cameras.main.shake(90, 0.0013);
    await this.tweenPromise({ targets: burst, scaleX: 1.42, scaleY: 1.42, alpha: 0, duration: this.reducedMotion ? 140 : 230, ease: 'Quad.easeOut' });
    burst.destroy(true);
  }

  private playHitFlash(): void {
    const p = this.getWorldPosition();
    const color = this.elementColor();
    const flash = this.scene.add.circle(p.x, p.y - 4, 46, 0xffffff, 0.16).setStrokeStyle(3, color, 0.8).setDepth(38).setScale(0.82);
    this.portrait.setTintFill(0xffffff);
    this.scene.time.delayedCall(this.reducedMotion ? 55 : 85, () => { if (this.portrait.active) this.portrait.clearTint(); });
    this.scene.tweens.add({ targets: flash, scaleX: 1.38, scaleY: 1.38, alpha: 0, duration: this.reducedMotion ? 110 : 180, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
  }

  private async playControlLock(status: string): Promise<void> {
    const freeze = status === 'ĐÓNG BĂNG';
    const silence = status === 'CÂM LẶNG';
    const color = freeze ? 0x8adfff : silence ? 0xc9a0ff : 0xf5dd62;
    const p = this.getWorldPosition();
    const fx = this.scene.add.container(p.x, p.y).setDepth(39).setScale(0.78);
    fx.add([
      this.scene.add.circle(0, 0, 56, 0x000000, 0).setStrokeStyle(4, color, 0.9),
      this.scene.add.circle(0, 0, 38, color, 0.07).setStrokeStyle(2, color, 0.55),
      this.scene.add.rectangle(-22, 0, 8, 84, color, 0.7).setRotation(freeze ? -0.15 : 0.55),
      this.scene.add.rectangle(22, 0, 8, 84, color, 0.7).setRotation(freeze ? 0.15 : -0.55)
    ]);
    const startX = this.container.x;
    await Promise.all([
      this.tweenPromise({ targets: this.container, x: startX + 6, duration: 70, yoyo: true, repeat: this.reducedMotion ? 0 : 2 }),
      this.tweenPromise({ targets: fx, scaleX: 1.15, scaleY: 1.15, alpha: 0, duration: this.reducedMotion ? 190 : 340, ease: 'Quad.easeOut' })
    ]);
    this.container.setX(startX);
    fx.destroy(true);
  }

  private async playCastSignature(support: boolean): Promise<void> {
    const p = this.getWorldPosition();
    const color = this.elementColor();
    const ring = this.scene.add.circle(p.x, p.y, support ? 54 : 43, 0x000000, 0).setStrokeStyle(support ? 4 : 3, color, 0.86).setDepth(34).setScale(0.62);
    await this.tweenPromise({ targets: ring, scaleX: support ? 1.45 : 1.28, scaleY: support ? 1.45 : 1.28, alpha: 0, duration: this.reducedMotion ? 140 : 230, ease: 'Quad.easeOut' });
    ring.destroy();
  }

  private async playElementTravel(targetX: number, targetY: number): Promise<void> {
    const color = this.elementColor();
    const start = this.getWorldPosition();
    const beam = this.scene.add.graphics().setDepth(34);
    beam.lineStyle(3, color, this.reducedMotion ? 0.22 : 0.38).lineBetween(start.x, start.y, targetX, targetY);
    const projectile = this.scene.add.container(start.x, start.y).setDepth(36);
    projectile.add([
      this.scene.add.circle(0, 0, 9, color, 0.98),
      this.scene.add.circle(0, 0, 15, 0x000000, 0).setStrokeStyle(2, color, 0.64)
    ]);
    if (!this.reducedMotion) projectile.add(this.scene.add.rectangle(-16, 0, 26, 5, color, 0.48));
    await Promise.all([
      this.tweenPromise({ targets: projectile, x: targetX, y: targetY, duration: this.reducedMotion ? 140 : 220, ease: 'Quad.easeIn' }),
      this.tweenPromise({ targets: beam, alpha: 0, duration: this.reducedMotion ? 150 : 230 })
    ]);
    projectile.destroy(true);
    beam.destroy();
    await this.playElementImpact(targetX, targetY, color);
  }

  private async playElementImpact(x: number, y: number, color: number): Promise<void> {
    const burst = this.scene.add.container(x, y).setDepth(37);
    burst.add([
      this.scene.add.circle(0, 0, 16, color, 0.2),
      this.scene.add.circle(0, 0, 21, 0x000000, 0).setStrokeStyle(3, color, 0.92)
    ]);
    if (!this.reducedMotion) {
      for (let i = 0; i < 6; i += 1) {
        const a = Math.PI * 2 * i / 6;
        burst.add(this.scene.add.rectangle(Math.cos(a) * 19, Math.sin(a) * 19, 20, 4, color, 0.8).setRotation(a));
      }
    }
    await this.tweenPromise({ targets: burst, scaleX: 1.9, scaleY: 1.9, alpha: 0, duration: this.reducedMotion ? 140 : 220, ease: 'Quad.easeOut' });
    burst.destroy(true);
  }

  private async playSupportAura(): Promise<void> {
    const p = this.getWorldPosition();
    const color = this.elementColor();
    const aura = this.scene.add.container(p.x, p.y).setDepth(33).setScale(0.72);
    aura.add(this.scene.add.circle(0, 0, 45, color, 0.08).setStrokeStyle(4, color, 0.66));
    await this.tweenPromise({ targets: aura, y: p.y - 10, scaleX: 1.58, scaleY: 1.58, alpha: 0, duration: this.reducedMotion ? 170 : 270, ease: 'Sine.easeOut' });
    aura.destroy(true);
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
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private refreshTargetGlow(): void {
    if (!this.targetable) { this.targetGlow.setVisible(false); return; }
    if (this.selectedTarget) this.targetGlow.setStrokeStyle(4, 0xffdc6d, 1).setVisible(true);
    else this.targetGlow.setStrokeStyle(2, 0x78e8ff, 0.58).setVisible(true);
  }

  private refreshStatusFrame(status: string): void {
    const color = this.statusColor(status);
    if (!color) { this.statusFrame.setVisible(false); return; }
    const strong = status === 'ĐÓNG BĂNG' || status === 'CHOÁNG' || status.startsWith('MIỄN KHỐNG');
    this.statusFrame.setStrokeStyle(strong ? 5 : 3, color, strong ? 0.92 : 0.64).setVisible(true);
  }

  private statusColor(status: string): number | null {
    if (status.startsWith('MIỄN KHỐNG')) return 0x8ef7ff;
    if (status === 'ĐÓNG BĂNG') return 0x8adfff;
    if (status === 'CHOÁNG' || status === 'TÊ LIỆT') return 0xf5dd62;
    if (status === 'CÂM LẶNG') return 0xc9a0ff;
    if (status === 'LÀM LẠNH' || status === 'TÊ CÓNG') return 0x8adfff;
    if (status.startsWith('NHIỄM ĐỘC') || status.startsWith('SONG DOT')) return 0xa5df66;
    if (status === 'THIÊU ĐỐT') return 0xff7043;
    if (status === 'CHẬM') return 0x78a9ff;
    if (status.startsWith('GIẢM ')) return 0xff8da0;
    if (status === 'KHÁNG HIỆU ỨNG') return 0x8ef7ff;
    if (status === 'BẢO HỘ') return 0x90d8ff;
    if (status.startsWith('HỒI PHỤC')) return 0x73f0aa;
    if (status.startsWith('TĂNG ')) return 0xffc46b;
    if (status.startsWith('KHIÊN')) return 0x8edfff;
    if (status === 'DỰ BỊ') return 0x617f8d;
    if (status === 'HẠ GỤC') return 0xff6478;
    return null;
  }

  private statusBackground(status: string): string {
    if (status.startsWith('MIỄN KHỐNG')) return '#164650';
    if (status === 'ĐÓNG BĂNG' || status === 'LÀM LẠNH' || status === 'TÊ CÓNG') return '#1d4658';
    if (status === 'CHOÁNG' || status === 'TÊ LIỆT') return '#554a1d';
    if (status === 'CÂM LẶNG') return '#462d59';
    if (status.startsWith('NHIỄM ĐỘC') || status.startsWith('SONG DOT')) return '#31491f';
    if (status === 'THIÊU ĐỐT') return '#552c20';
    if (status === 'CHẬM') return '#283b63';
    if (status.startsWith('GIẢM ')) return '#572631';
    if (status === 'KHÁNG HIỆU ỨNG') return '#17454c';
    if (status === 'BẢO HỘ' || status.startsWith('KHIÊN')) return '#21475a';
    if (status.startsWith('HỒI PHỤC')) return '#1f4f3c';
    if (status.startsWith('TĂNG ')) return '#4c3b25';
    if (status === 'DỰ BỊ') return '#263944';
    return status ? '#3d3152' : '#4a2535';
  }

  private getRuntimeStatus(unit: CombatUnitState): string {
    if (unit.fieldSlot === null && unit.alive) return 'DỰ BỊ';
    if (unit.controlImmunityActionsRemaining > 0) return `MIỄN KHỐNG · ${unit.controlImmunityActionsRemaining}`;
    if (unit.controlActionsRemaining > 0) return unit.controlStatus === 'freeze' ? 'ĐÓNG BĂNG' : 'CHOÁNG';
    if (unit.silenceActionsRemaining > 0) return 'CÂM LẶNG';
    if (unit.paralysisActionsRemaining > 0) return 'TÊ LIỆT';
    if (unit.freezeStage === 2 && unit.freezeStageActionsRemaining > 0) return 'TÊ CÓNG';
    if (unit.freezeStage === 1 && unit.freezeStageActionsRemaining > 0) return 'LÀM LẠNH';

    if (unit.antiHealActionsRemaining > 0 && unit.antiHeal > 0) return 'GIẢM HỒI MÁU';
    if (unit.attackBuffActionsRemaining > 0 && unit.attackMultiplier < 1) return 'GIẢM CÔNG';
    if (unit.abilityPowerBuffActionsRemaining > 0 && unit.abilityPowerMultiplier < 1) return 'GIẢM AP';
    if (unit.defenseBuffActionsRemaining > 0 && unit.defenseMultiplier < 1) return 'GIẢM THỦ';
    if (unit.accuracyDebuffActionsRemaining > 0 && unit.accuracyBonus < 0) return 'GIẢM CHÍNH XÁC';
    if (unit.burnActionsRemaining > 0 && unit.poisonActionsRemaining > 0) return `SONG DOT · ĐỘC ×${unit.poisonStacks}`;
    if (unit.poisonActionsRemaining > 0) return `NHIỄM ĐỘC ×${unit.poisonStacks}`;
    if (unit.burnActionsRemaining > 0) return 'THIÊU ĐỐT';
    if (unit.speedDebuffActionsRemaining > 0) return 'CHẬM';

    if (unit.regenerationActionsRemaining > 0) return `HỒI PHỤC · ${unit.regenerationActionsRemaining}`;
    if (unit.guardActionsRemaining > 0 && unit.damageReductionBonus > 0) return 'BẢO HỘ';
    if (unit.tenacityBuffActionsRemaining > 0 && unit.tenacityBonus > 0) return 'KHÁNG HIỆU ỨNG';
    if (unit.critBuffActionsRemaining > 0 && unit.critRateBonus > 0) return 'TĂNG CHÍ MẠNG';
    if (unit.evasionBuffActionsRemaining > 0 && unit.evasionBonus > 0) return 'TĂNG NÉ';
    if (unit.attackBuffActionsRemaining > 0 && unit.attackMultiplier > 1) return 'TĂNG CÔNG';
    if (unit.abilityPowerBuffActionsRemaining > 0 && unit.abilityPowerMultiplier > 1) return 'TĂNG AP';
    if (unit.defenseBuffActionsRemaining > 0 && unit.defenseMultiplier > 1) return 'TĂNG THỦ';
    if (unit.speedBuffActionsRemaining > 0) return 'TĂNG TỐC';
    if (unit.shield > 0) return `KHIÊN ${Math.round(unit.shield)}`;
    return '';
  }

  private setBarWidth(bar: Phaser.GameObjects.Rectangle, ratio: number): void {
    bar.displayWidth = Math.max(0.01, this.barWidth * ratio);
  }

  private ratio(value: number, max: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
    return Phaser.Math.Clamp(value / max, 0, 1);
  }

  private tweenPromise(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const duration = typeof config.duration === 'number' ? config.duration : 160;
      const delay = typeof config.delay === 'number' ? config.delay : 0;
      const repeat = typeof config.repeat === 'number' && config.repeat > 0 ? config.repeat : 0;
      const cycles = (repeat + 1) * (config.yoyo ? 2 : 1);
      const finish = (): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, Math.max(240, delay + duration * cycles + 240));
      try { this.scene.tweens.add({ ...config, onComplete: finish }); }
      catch (error) { console.warn('[Combat2 Presentation]', error); finish(); }
    });
  }
}
