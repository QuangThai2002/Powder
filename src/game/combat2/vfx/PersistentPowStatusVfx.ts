import Phaser from 'phaser';
import {
  NIGHT_STATUS_VFX_DEFAULTS,
  fitVfxFrameToPow,
  orderedFrameNumbers,
  powVfxDepth,
  powVfxWorldAnchor,
  type PowVfxLayout,
  type SpriteSheetPlaybackSpec
} from './CombatNightVfxLayout';

export type PersistentPowStatusKind = 'burn' | 'poison' | 'freeze' | 'stun';

export interface PersistentStatusSheetSpec extends SpriteSheetPlaybackSpec {
  textureKey: string;
}

export type PersistentStatusSheetMap = Partial<Record<PersistentPowStatusKind, PersistentStatusSheetSpec>>;

interface ActivePersistentStatus {
  kind: PersistentPowStatusKind;
  object: Phaser.GameObjects.GameObject;
  badge: Phaser.GameObjects.Container;
  tooltip: Phaser.GameObjects.Text;
}

interface StatusTooltipCopy {
  glyph: string;
  title: string;
  description: string;
  color: number;
}

const STATUS_TOOLTIP_COPY: Record<PersistentPowStatusKind, StatusTooltipCopy> = Object.freeze({
  burn: {
    glyph: '🔥',
    title: 'Thiêu đốt',
    description: 'Mất HP theo thời gian khi hiệu ứng còn hiệu lực.',
    color: 0xff7043
  },
  poison: {
    glyph: '☣',
    title: 'Nhiễm độc',
    description: 'Nhận sát thương độc duy trì và có thể cộng dồn.',
    color: 0xa5df66
  },
  freeze: {
    glyph: '❄',
    title: 'Đóng băng',
    description: 'Bị khóa hành động khi trạng thái đóng băng còn hiệu lực.',
    color: 0x8adfff
  },
  stun: {
    glyph: '✦',
    title: 'Choáng',
    description: 'Không thể hành động trong lượt bị khống chế.',
    color: 0xf5dd62
  }
});

/**
 * Owns at most ONE persistent visual per Pow.
 *
 * Sprite sheets are optional on purpose: Night Upgrade must never crash Combat2
 * when an art file has not been copied/preloaded yet. When a valid texture exists,
 * one Sprite plays ordered frame indices. Otherwise a lightweight vector fallback
 * communicates the state without covering the portrait or HUD.
 *
 * The same owner also provides one compact interactive badge for the active bad
 * status. Hovering the badge reveals a short Tamer-facing explanation without
 * adding permanent text over the battle field.
 */
export class PersistentPowStatusVfx {
  private readonly scene: Phaser.Scene;
  private readonly sheetSpecs: PersistentStatusSheetMap;
  private active: ActivePersistentStatus | null = null;
  private cleanupRegistered = false;

  constructor(scene: Phaser.Scene, sheetSpecs: PersistentStatusSheetMap = {}) {
    this.scene = scene;
    this.sheetSpecs = sheetSpecs;
  }

  setStatus(kind: PersistentPowStatusKind | null, x: number, y: number, layout: PowVfxLayout): void {
    if (!kind) {
      this.clear();
      return;
    }

    this.ensureSceneCleanup();
    if (this.active?.kind === kind) {
      this.reposition(this.active, kind, x, y, layout);
      return;
    }

    this.clear();
    const object = this.createSheetSprite(kind, x, y, layout) ?? this.createFallback(kind, x, y, layout);
    const { badge, tooltip } = this.createStatusBadge(kind, x, y, layout);
    this.active = { kind, object, badge, tooltip };
  }

  clear(): void {
    if (!this.active) return;
    this.active.tooltip.destroy();
    this.active.badge.destroy(true);
    this.active.object.destroy();
    this.active = null;
  }

  destroy(): void {
    this.clear();
  }

  private ensureSceneCleanup(): void {
    if (this.cleanupRegistered || !this.scene?.events) return;
    this.cleanupRegistered = true;
    let cleaned = false;

    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.scene.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
      this.cleanupRegistered = false;
      this.clear();
    };

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  private createStatusBadge(
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): { badge: Phaser.GameObjects.Container; tooltip: Phaser.GameObjects.Text } {
    const copy = STATUS_TOOLTIP_COPY[kind];
    const position = this.statusBadgePosition(x, y, layout);
    const radius = Phaser.Math.Clamp(15 * layout.fieldScale, 10, 15);
    const badge = this.scene.add.container(position.x, position.y).setDepth(powVfxDepth('foreground') + 3);
    const hit = this.scene.add.circle(0, 0, radius + 4, 0x071723, 0.92)
      .setStrokeStyle(2, copy.color, 0.96)
      .setInteractive({ useHandCursor: true });
    const glyph = this.scene.add.text(0, 0, copy.glyph, {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${Math.max(12, Math.round(15 * layout.fieldScale))}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#041018',
      strokeThickness: 2
    }).setOrigin(0.5);
    badge.add([hit, glyph]);

    const tooltip = this.scene.add.text(position.x, position.y - radius - 10, `${copy.title}\n${copy.description}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#eefaff',
      fontStyle: 'bold',
      backgroundColor: '#071723ee',
      padding: { x: 10, y: 8 },
      stroke: '#041018',
      strokeThickness: 2,
      wordWrap: { width: 230, useAdvancedWrap: true },
      align: 'left'
    })
      .setOrigin(0.5, 1)
      .setDepth(powVfxDepth('foreground') + 5)
      .setVisible(false);

    hit.on('pointerover', () => {
      if (tooltip.active) tooltip.setVisible(true);
    });
    hit.on('pointerout', () => {
      if (tooltip.active) tooltip.setVisible(false);
    });

    return { badge, tooltip };
  }

  private statusBadgePosition(x: number, y: number, layout: PowVfxLayout): Phaser.Math.Vector2 {
    const head = powVfxWorldAnchor(x, y, layout, 'head');
    const offsetX = layout.artWidth * layout.fieldScale * 0.35;
    const offsetY = 9 * layout.fieldScale;
    return new Phaser.Math.Vector2(head.x + offsetX, head.y - offsetY);
  }

  private statusVisualAnchor(
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): Phaser.Math.Vector2 {
    const profile = NIGHT_STATUS_VFX_DEFAULTS[kind];
    const anchor = powVfxWorldAnchor(x, y, layout, profile.anchor);
    if (kind === 'poison') {
      // Keep semantic ownership at the feet/ground, but let the gas rise around
      // roughly the lower half of the Pow instead of sitting as a tiny puddle.
      anchor.y -= layout.artHeight * layout.fieldScale * 0.18;
    }
    return anchor;
  }

  private createSheetSprite(
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): Phaser.GameObjects.Sprite | null {
    const spec = this.sheetSpecs[kind];
    if (!spec || !spec.textureKey || !this.scene.textures.exists(spec.textureKey)) return null;

    const frames = orderedFrameNumbers(spec);
    if (frames.length === 0) return null;

    const animationKey = `combat2-night-status-${kind}-${spec.textureKey}`;
    if (!this.scene.anims.exists(animationKey)) {
      this.scene.anims.create({
        key: animationKey,
        frames: frames.map((frame) => ({ key: spec.textureKey, frame })),
        frameRate: Phaser.Math.Clamp(spec.frameRate || 12, 4, 30),
        repeat: spec.repeat < 0 ? -1 : Math.max(0, Math.floor(spec.repeat))
      });
    }

    const profile = NIGHT_STATUS_VFX_DEFAULTS[kind];
    const anchor = this.statusVisualAnchor(kind, x, y, layout);
    const sprite = this.scene.add.sprite(anchor.x, anchor.y, spec.textureKey, frames[0]);
    sprite
      .setDepth(powVfxDepth(kind === 'poison' ? 'ground' : profile.layer))
      .setScale(fitVfxFrameToPow(
        spec.frameWidth,
        spec.frameHeight,
        layout,
        profile.widthRatio,
        profile.heightRatio
      ));

    // Important: one Sprite advances through frame numbers. Never draw a 12-frame
    // strip as one image and never create one display object per frame.
    sprite.play(animationKey);
    return sprite;
  }

  private createFallback(
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): Phaser.GameObjects.Container {
    const profile = NIGHT_STATUS_VFX_DEFAULTS[kind];
    const anchor = this.statusVisualAnchor(kind, x, y, layout);
    const depth = powVfxDepth(kind === 'poison' ? 'ground' : profile.layer);
    const fx = this.scene.add.container(anchor.x, anchor.y).setDepth(depth);

    if (kind === 'burn') {
      fx.add([
        this.scene.add.ellipse(0, 12, 50, 76, 0xff5a32, 0.08).setStrokeStyle(3, 0xff7043, 0.72),
        this.scene.add.ellipse(-18, 22, 15, 42, 0xffb13b, 0.12).setRotation(-0.25),
        this.scene.add.ellipse(17, 18, 13, 36, 0xff7043, 0.12).setRotation(0.28)
      ]);
    } else if (kind === 'poison') {
      // Poison must read as low ground contamination with rising gas, not a green body tint.
      fx.add([
        this.scene.add.ellipse(0, 8, 92, 28, 0x6f42a8, 0.10).setStrokeStyle(2, 0x91d66a, 0.46),
        this.scene.add.circle(-27, 1, 6, 0xa5df66, 0.16),
        this.scene.add.circle(23, 5, 5, 0x8f63c8, 0.18)
      ]);
    } else if (kind === 'freeze') {
      fx.add([
        this.scene.add.ellipse(0, 0, 86, 118, 0x8adfff, 0.035).setStrokeStyle(3, 0x8adfff, 0.75),
        this.scene.add.rectangle(-31, 28, 7, 48, 0xb8efff, 0.45).setRotation(-0.32),
        this.scene.add.rectangle(31, 22, 7, 44, 0xb8efff, 0.45).setRotation(0.32)
      ]);
    } else {
      fx.add([
        this.scene.add.ellipse(0, 0, 74, 25, 0xf5dd62, 0.03).setStrokeStyle(3, 0xf5dd62, 0.74),
        this.scene.add.rectangle(-18, -2, 22, 4, 0xf5dd62, 0.65).setRotation(-0.45),
        this.scene.add.rectangle(18, 2, 22, 4, 0xf5dd62, 0.65).setRotation(0.45)
      ]);
    }

    // Persistent fallback is intentionally static. It avoids permanent tween and
    // particle loops while still making the state readable on low-end devices.
    return fx;
  }

  private reposition(
    active: ActivePersistentStatus,
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): void {
    const anchor = this.statusVisualAnchor(kind, x, y, layout);
    const positioned = active.object as Phaser.GameObjects.Components.Transform;
    if (typeof positioned.setPosition === 'function') positioned.setPosition(anchor.x, anchor.y);

    const badgePosition = this.statusBadgePosition(x, y, layout);
    active.badge.setPosition(badgePosition.x, badgePosition.y);
    active.tooltip.setPosition(
      badgePosition.x,
      badgePosition.y - Phaser.Math.Clamp(15 * layout.fieldScale, 10, 15) - 10
    );
  }
}

(globalThis as any).POWDER_COMBAT2_NIGHT_PERSISTENT_STATUS = {
  version: 'night-30',
  ownerPerPowMax: 1,
  sceneShutdownCleanup: true,
  poisonBadgeGlyph: 'hazard-no-skull',
  fullSheetPriority: true,
  combatLogicChanged: false
};
