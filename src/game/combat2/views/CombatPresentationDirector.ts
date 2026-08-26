import Phaser from 'phaser';
import type { CombatAbility, CombatSide } from '../data/CombatPow';
import type { ElementOutcome } from '../systems/CombatIdentityRules';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';
import { PowView } from './PowView';

export class CombatPresentationDirector {
  private readonly reducedMotion: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    this.reducedMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  async playSkillIntro(
    actorView: PowView | undefined,
    targetView: PowView | undefined,
    _ability: CombatAbility,
    slot: 0 | 1,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!actorView) return;
    const actor = actorView.getWorldPosition();
    const targetVisible = Boolean(targetView?.container.visible);
    const target = targetVisible && targetView ? targetView.getWorldPosition() : actor;
    const element = this.elementColor(elementKey);
    const accent = slot === 0 ? 0x70dced : 0xb69cff;
    const fx = this.scene.add.container(actor.x, actor.y).setDepth(45).setScale(0.72);
    fx.add([
      this.scene.add.circle(0, 0, slot === 0 ? 52 : 60, 0x000000, 0).setStrokeStyle(slot === 0 ? 3 : 4, element, 0.86),
      this.scene.add.circle(0, 0, slot === 0 ? 32 : 38, accent, 0.05).setStrokeStyle(2, accent, 0.68)
    ]);
    const path = this.scene.add.graphics().setDepth(43);
    if (!selfTargeted && targetVisible) path.lineStyle(slot === 0 ? 2 : 3, accent, 0.32).lineBetween(actor.x, actor.y, target.x, target.y);
    await Promise.all([
      this.tween({ targets: fx, scaleX: 1.22, scaleY: 1.22, alpha: 0, duration: this.reducedMotion ? 150 : slot === 0 ? 260 : 320, ease: 'Quad.easeOut' }),
      this.tween({ targets: path, alpha: 0, duration: this.reducedMotion ? 160 : 340, ease: 'Quad.easeOut' })
    ]);
    fx.destroy(true);
    path.destroy();
  }

  async playUltimateIntro(actorView: PowView | undefined, ability: CombatAbility, side: CombatSide, elementKey: string): Promise<void> {
    if (!actorView) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const actor = actorView.getWorldPosition();
    const element = this.elementColor(elementKey);
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x02070d, 0.5).setDepth(70).setAlpha(0);
    const spot = this.scene.add.circle(actor.x, actor.y, 88, element, 0.07).setStrokeStyle(5, element, 0.92).setDepth(72).setScale(0.7);

    const portrait = height > width;
    const bannerY = Math.round(height * (portrait ? 0.47 : 0.43));
    const bannerWidth = Math.min(portrait ? 720 : 760, width * (portrait ? 0.8 : 0.52));
    const bannerHeight = portrait ? 136 : 128;
    const banner = this.scene.add.container(width / 2, bannerY).setDepth(76).setAlpha(0).setScale(0.95);
    const plate = this.scene.add.rectangle(0, 0, bannerWidth, bannerHeight, 0x07131d, 0.985).setStrokeStyle(3, 0xffd36a, 0.92);
    const rail = this.scene.add.rectangle(side === 'player' ? -bannerWidth / 2 + 6 : bannerWidth / 2 - 6, 0, 9, bannerHeight - 12, element, 0.95);
    const iconX = -bannerWidth / 2 + 76;
    const iconPlate = this.scene.add.rectangle(iconX, 0, 94, 94, 0x030a10, 0.95).setStrokeStyle(2, element, 0.8);
    const icon = ability.iconKey && this.scene.textures.exists(ability.iconKey)
      ? this.scene.add.image(iconX, 0, ability.iconKey).setDisplaySize(84, 84)
      : this.scene.add.text(iconX, 0, '✦', { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '48px', color: '#ffd36a' }).setOrigin(0.5);
    const textX = -bannerWidth / 2 + 142;
    const textWidth = Math.max(300, bannerWidth - 168);
    const label = this.scene.add.text(textX, -40, 'TUYỆT KỸ', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: portrait ? '20px' : '19px', color: '#ffd36a', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0, 0.5);
    const name = this.scene.add.text(textX, 4, this.shortName(ability.name, portrait ? 30 : 36).toUpperCase(), {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: portrait ? '29px' : '30px',
      color: '#fff8e7',
      fontStyle: 'bold',
      fixedWidth: textWidth,
      wordWrap: { width: textWidth }
    }).setOrigin(0, 0.5);
    const sub = this.scene.add.text(textX, 45, side === 'player' ? 'POW CỦA BẠN' : 'POW ĐỐI THỦ', {
      fontFamily: COMBAT_BODY_FONT, fontSize: '15px', color: side === 'player' ? '#8eeaff' : '#ffb18d', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    banner.add([plate, rail, iconPlate, icon, label, name, sub]);

    if (!this.reducedMotion) this.scene.cameras.main.flash(130, 255, 224, 145, false);

    // Readability contract: readable reveal, about 1.9s hold, then a gentle exit.
    const hold = this.reducedMotion ? 700 : 1900;
    await Promise.all([
      this.tween({ targets: overlay, alpha: 1, duration: 280, yoyo: true, hold, ease: 'Sine.easeOut' }),
      this.tween({ targets: spot, scaleX: 1.34, scaleY: 1.34, alpha: 0, duration: this.reducedMotion ? 900 : 2200, ease: 'Quad.easeOut' }),
      this.tween({ targets: banner, alpha: 1, scaleX: 1, scaleY: 1, duration: 300, yoyo: true, hold, ease: 'Quad.easeOut' })
    ]);

    overlay.destroy();
    spot.destroy();
    banner.destroy(true);
  }

  async playUltimateImpact(targetView: PowView | undefined, elementKey: string, selfTargeted: boolean): Promise<void> {
    if (!targetView) return;
    const p = targetView.getWorldPosition();
    const element = this.elementColor(elementKey);
    const accent = selfTargeted ? 0x73f0aa : 0xffd36a;
    const burst = this.scene.add.container(p.x, p.y).setDepth(58).setScale(0.68);
    burst.add([
      this.scene.add.circle(0, 0, 36, accent, 0.15),
      this.scene.add.circle(0, 0, 70, 0x000000, 0).setStrokeStyle(5, element, 0.94),
      this.scene.add.circle(0, 0, 48, 0x000000, 0).setStrokeStyle(3, accent, 0.8)
    ]);
    if (!this.reducedMotion) {
      for (let i = 0; i < 10; i += 1) {
        const a = Math.PI * 2 * i / 10;
        burst.add(this.scene.add.rectangle(Math.cos(a) * 55, Math.sin(a) * 55, 28, 4, i % 2 ? accent : element, 0.78).setRotation(a));
      }
      this.scene.cameras.main.shake(120, 0.0022);
    }
    await this.tween({ targets: burst, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: this.reducedMotion ? 180 : 320, ease: 'Quad.easeOut' });
    burst.destroy(true);
  }

  showElementOutcome(view: PowView | undefined, outcome: ElementOutcome): void {
    if (!view || outcome === 'neutral') return;
    const map: Record<Exclude<ElementOutcome, 'neutral'>, { label: string; color: string }> = {
      strong: { label: 'KHẮC HỆ', color: '#ffd36a' },
      resisted: { label: 'KHÁNG HỆ', color: '#8edfff' },
      weak: { label: 'BẤT LỢI', color: '#c9b0ff' },
      immune: { label: 'MIỄN NHIỄM', color: '#eafcff' }
    };
    const item = map[outcome];
    const p = view.getWorldPosition();
    const y = p.y < this.scene.scale.height / 2 ? Math.min(this.scene.scale.height / 2 - 105, p.y + 160) : Math.max(this.scene.scale.height / 2 + 105, p.y - 160);
    const text = this.scene.add.text(p.x, y, item.label, {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: '20px',
      color: item.color,
      fontStyle: 'bold',
      backgroundColor: '#06111cdd',
      padding: { x: 12, y: 7 },
      stroke: '#02070d',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(55);
    this.scene.tweens.add({ targets: text, y: y + (p.y < this.scene.scale.height / 2 ? 10 : -10), alpha: 0, delay: 250, duration: this.reducedMotion ? 600 : 1000, ease: 'Quad.easeOut', onComplete: () => text.destroy() });
  }

  private elementColor(elementKey: string): number {
    const key = String(elementKey || '').trim().toLowerCase();
    const colors: Record<string, number> = {
      fire: 0xff7043, lava: 0xff4f2e, water: 0x4db9ff, ice: 0x8adfff,
      lightning: 0xf5dd62, storm: 0x78a9ff, leaf: 0x72d67f, poison: 0xa5df66,
      earth: 0xb78c5d, wind: 0x76e4d2, steel: 0xc3d3dc, light: 0xffefad, dark: 0xa88cf2
    };
    return colors[key] ?? 0x70dced;
  }

  private shortName(name: string, maxLength: number): string {
    const clean = String(name || '').trim();
    return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const duration = typeof config.duration === 'number' ? config.duration : 180;
      const delay = typeof config.delay === 'number' ? config.delay : 0;
      const hold = typeof config.hold === 'number' ? config.hold : 0;
      const finish = (): void => { if (settled) return; settled = true; window.clearTimeout(timer); resolve(); };
      const timer = window.setTimeout(finish, Math.max(320, delay + duration * (config.yoyo ? 2 : 1) + hold + 300));
      try { this.scene.tweens.add({ ...config, onComplete: finish }); }
      catch (error) { console.warn('[Combat2 Presentation Director]', error); finish(); }
    });
  }
}
