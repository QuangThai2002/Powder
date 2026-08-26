import Phaser from 'phaser';
import type { CombatAbility, CombatSide } from '../data/CombatPow';
import type { ElementOutcome } from '../systems/CombatIdentityRules';
import { PowView } from './PowView';

export class CombatPresentationDirector {
  private readonly reducedMotion: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  async playSkillIntro(
    actorView: PowView | undefined,
    targetView: PowView | undefined,
    ability: CombatAbility,
    slot: 0 | 1,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!actorView) {
      return;
    }

    const actor = actorView.getWorldPosition();
    const targetVisible = Boolean(targetView?.container.visible);
    const target = targetVisible && targetView
      ? targetView.getWorldPosition()
      : actor;
    const element = this.elementColor(elementKey);
    const slotAccent = slot === 0 ? 0x70dced : 0xb69cff;
    const fx = this.scene.add.container(actor.x, actor.y).setDepth(45);

    const outer = this.scene.add.circle(0, 0, slot === 0 ? 50 : 57, 0x000000, 0);
    outer.setStrokeStyle(slot === 0 ? 3 : 4, element, 0.82).setScale(0.72);
    const inner = this.scene.add.circle(0, 0, slot === 0 ? 31 : 36, slotAccent, 0.045);
    inner.setStrokeStyle(2, slotAccent, 0.62).setScale(0.78);
    fx.add([outer, inner]);

    if (!this.reducedMotion) {
      const spokeCount = slot === 0 ? 4 : 6;
      for (let index = 0; index < spokeCount; index += 1) {
        const angle = (Math.PI * 2 * index) / spokeCount;
        const spoke = this.scene.add.rectangle(
          Math.cos(angle) * 44,
          Math.sin(angle) * 44,
          slot === 0 ? 18 : 22,
          3,
          index % 2 === 0 ? element : slotAccent,
          0.54
        );
        spoke.setRotation(angle);
        fx.add(spoke);
      }
    }

    const path = this.scene.add.graphics().setDepth(43);
    if (!selfTargeted && targetVisible) {
      path.lineStyle(slot === 0 ? 2 : 3, slotAccent, slot === 0 ? 0.26 : 0.31);
      path.lineBetween(actor.x, actor.y, target.x, target.y);
    }

    const duration = this.reducedMotion ? 80 : slot === 0 ? 125 : 155;
    await Promise.all([
      this.tween({
        targets: fx,
        scaleX: slot === 0 ? 1.12 : 1.22,
        scaleY: slot === 0 ? 1.12 : 1.22,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut'
      }),
      this.tween({
        targets: path,
        alpha: 0,
        duration: duration + 20,
        ease: 'Quad.easeOut'
      })
    ]);

    fx.destroy(true);
    path.destroy();

    // Ability is intentionally referenced here so future per-skill visual keys
    // can be added without changing BattleScene's orchestration contract.
    void ability;
  }

  async playUltimateIntro(
    actorView: PowView | undefined,
    ability: CombatAbility,
    side: CombatSide,
    elementKey: string
  ): Promise<void> {
    if (!actorView) {
      return;
    }

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const actor = actorView.getWorldPosition();
    const element = this.elementColor(elementKey);
    const accent = 0xffcf66;
    const duration = this.reducedMotion ? 150 : 330;

    const overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x02070d, 0.28)
      .setDepth(70)
      .setAlpha(0);

    const actorSpot = this.scene.add
      .circle(actor.x, actor.y, 74, element, 0.055)
      .setStrokeStyle(5, element, 0.9)
      .setDepth(72)
      .setScale(0.72);

    const bannerY = Math.round(height * 0.445);
    const bannerWidth = Math.min(570, width * 0.42);
    const banner = this.scene.add.container(width / 2, bannerY).setDepth(76).setAlpha(0);
    const plate = this.scene.add
      .rectangle(0, 0, bannerWidth, 92, 0x07131d, 0.97)
      .setStrokeStyle(2, accent, 0.88);
    const elementRail = this.scene.add.rectangle(
      side === 'player' ? -bannerWidth / 2 + 4 : bannerWidth / 2 - 4,
      0,
      6,
      84,
      element,
      0.92
    );

    const iconX = -bannerWidth / 2 + 58;
    const iconPlate = this.scene.add
      .rectangle(iconX, 0, 68, 68, 0x030a10, 0.92)
      .setStrokeStyle(2, element, 0.72);

    let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (ability.iconKey && this.scene.textures.exists(ability.iconKey)) {
      icon = this.scene.add.image(iconX, 0, ability.iconKey).setDisplaySize(62, 62);
    } else {
      icon = this.scene.add
        .text(iconX, 0, '★', {
          fontFamily: 'Arial',
          fontSize: '34px',
          color: '#ffd36a',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);
    }

    const textX = -bannerWidth / 2 + 106;
    const label = this.scene.add
      .text(textX, -22, 'ULTIMATE', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffd36a',
        fontStyle: 'bold',
        letterSpacing: 2
      })
      .setOrigin(0, 0.5);

    const name = this.scene.add
      .text(textX, 8, this.shortName(ability.name, 31).toUpperCase(), {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
        fixedWidth: Math.max(240, bannerWidth - 126)
      })
      .setOrigin(0, 0.5);

    const sub = this.scene.add
      .text(textX, 31, side === 'player' ? 'POW CỦA BẠN' : 'POW ĐỐI THỦ', {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: side === 'player' ? '#8eeaff' : '#ffb18d',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);

    banner.add([plate, elementRail, iconPlate, icon, label, name, sub]);

    const railTop = this.scene.add
      .rectangle(width / 2, bannerY - 67, width * 0.48, 2, element, 0.42)
      .setDepth(74)
      .setScale(0.15, 1);
    const railBottom = this.scene.add
      .rectangle(width / 2, bannerY + 67, width * 0.48, 2, accent, 0.36)
      .setDepth(74)
      .setScale(0.15, 1);

    if (!this.reducedMotion) {
      this.scene.cameras.main.flash(85, 255, 220, 132, false, undefined, undefined);
    }

    await Promise.all([
      this.tween({
        targets: overlay,
        alpha: 1,
        duration: Math.min(120, duration),
        yoyo: true,
        hold: this.reducedMotion ? 20 : 85,
        ease: 'Sine.easeOut'
      }),
      this.tween({
        targets: actorSpot,
        scaleX: 1.22,
        scaleY: 1.22,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut'
      }),
      this.tween({
        targets: banner,
        alpha: 1,
        scaleX: 1.025,
        scaleY: 1.025,
        duration: Math.min(120, duration),
        yoyo: true,
        hold: this.reducedMotion ? 15 : 95,
        ease: 'Quad.easeOut'
      }),
      this.tween({
        targets: [railTop, railBottom],
        scaleX: 1,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut'
      })
    ]);

    overlay.destroy();
    actorSpot.destroy();
    banner.destroy(true);
    railTop.destroy();
    railBottom.destroy();
  }

  async playUltimateImpact(
    targetView: PowView | undefined,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!targetView) {
      return;
    }

    const target = targetView.getWorldPosition();
    const element = this.elementColor(elementKey);
    const accent = selfTargeted ? 0x73f0aa : 0xffd36a;
    const burst = this.scene.add.container(target.x, target.y).setDepth(58).setScale(0.72);
    const core = this.scene.add.circle(0, 0, selfTargeted ? 38 : 30, accent, 0.14);
    const outer = this.scene.add.circle(0, 0, selfTargeted ? 70 : 64, 0x000000, 0);
    outer.setStrokeStyle(5, element, 0.92);
    const inner = this.scene.add.circle(0, 0, selfTargeted ? 48 : 43, 0x000000, 0);
    inner.setStrokeStyle(3, accent, 0.78);
    burst.add([core, outer, inner]);

    if (!this.reducedMotion) {
      const shardCount = selfTargeted ? 8 : 10;
      for (let index = 0; index < shardCount; index += 1) {
        const angle = (Math.PI * 2 * index) / shardCount;
        const distance = index % 2 === 0 ? 52 : 44;
        const shard = this.scene.add.rectangle(
          Math.cos(angle) * distance,
          Math.sin(angle) * distance,
          index % 2 === 0 ? 30 : 22,
          4,
          index % 2 === 0 ? element : accent,
          0.76
        );
        shard.setRotation(angle);
        burst.add(shard);
      }

      this.scene.cameras.main.shake(selfTargeted ? 75 : 105, selfTargeted ? 0.001 : 0.0022);
    }

    await this.tween({
      targets: burst,
      scaleX: this.reducedMotion ? 1.32 : 1.72,
      scaleY: this.reducedMotion ? 1.32 : 1.72,
      alpha: 0,
      duration: this.reducedMotion ? 105 : 190,
      ease: 'Quad.easeOut'
    });

    burst.destroy(true);
  }

  showElementOutcome(view: PowView | undefined, outcome: ElementOutcome): void {
    if (!view || outcome === 'neutral') {
      return;
    }

    const presentation: Record<Exclude<ElementOutcome, 'neutral'>, { label: string; color: string }> = {
      strong: { label: 'KHẮC HỆ', color: '#ffd36a' },
      resisted: { label: 'KHÁNG HỆ', color: '#8edfff' },
      weak: { label: 'BẤT LỢI', color: '#c9b0ff' },
      immune: { label: 'MIỄN NHIỄM', color: '#eafcff' }
    };
    const item = presentation[outcome];
    const position = view.getWorldPosition();
    const centerGapY = position.y < this.scene.scale.height / 2
      ? Math.min(this.scene.scale.height / 2 - 102, position.y + 158)
      : Math.max(this.scene.scale.height / 2 + 102, position.y - 158);

    const text = this.scene.add
      .text(position.x, centerGapY, item.label, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: item.color,
        fontStyle: 'bold',
        backgroundColor: '#06111cdd',
        padding: { x: 9, y: 4 },
        stroke: '#02070d',
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(55)
      .setScale(0.92);

    this.scene.tweens.add({
      targets: text,
      y: centerGapY + (position.y < this.scene.scale.height / 2 ? 9 : -9),
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: this.reducedMotion ? 330 : 520,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private elementColor(elementKey: string): number {
    const key = String(elementKey || '').trim().toLowerCase();
    const colors: Record<string, number> = {
      fire: 0xff7043,
      lava: 0xff4f2e,
      water: 0x4db9ff,
      ice: 0x8adfff,
      lightning: 0xf5dd62,
      storm: 0x78a9ff,
      leaf: 0x72d67f,
      poison: 0xa5df66,
      earth: 0xb78c5d,
      wind: 0x76e4d2,
      steel: 0xc3d3dc,
      light: 0xffefad,
      dark: 0xa88cf2
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
      const duration = typeof config.duration === 'number' ? config.duration : 160;
      const delay = typeof config.delay === 'number' ? config.delay : 0;
      const hold = typeof config.hold === 'number' ? config.hold : 0;
      const fallbackMs = Math.max(240, delay + duration * (config.yoyo ? 2 : 1) + hold + 220);

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
        console.warn('[Combat2 Presentation Director]', error);
        finish();
      }
    });
  }
}
