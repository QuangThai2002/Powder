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
}

/**
 * Owns at most ONE persistent visual per Pow.
 *
 * Sprite sheets are optional on purpose: Night Upgrade must never crash Combat2
 * when an art file has not been copied/preloaded yet. When a valid texture exists,
 * one Sprite plays ordered frame indices. Otherwise a lightweight vector fallback
 * communicates the state without covering the portrait or HUD.
 */
export class PersistentPowStatusVfx {
  private readonly scene: Phaser.Scene;
  private readonly sheetSpecs: PersistentStatusSheetMap;
  private active: ActivePersistentStatus | null = null;

  constructor(scene: Phaser.Scene, sheetSpecs: PersistentStatusSheetMap = {}) {
    this.scene = scene;
    this.sheetSpecs = sheetSpecs;
  }

  setStatus(kind: PersistentPowStatusKind | null, x: number, y: number, layout: PowVfxLayout): void {
    if (!kind) {
      this.clear();
      return;
    }

    if (this.active?.kind === kind) {
      this.reposition(this.active.object, kind, x, y, layout);
      return;
    }

    this.clear();
    const object = this.createSheetSprite(kind, x, y, layout) ?? this.createFallback(kind, x, y, layout);
    this.active = { kind, object };
  }

  clear(): void {
    if (!this.active) return;
    this.active.object.destroy();
    this.active = null;
  }

  destroy(): void {
    this.clear();
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
    const anchor = powVfxWorldAnchor(x, y, layout, profile.anchor);
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
    const anchor = powVfxWorldAnchor(x, y, layout, profile.anchor);
    const depth = powVfxDepth(kind === 'poison' ? 'ground' : profile.layer);
    const fx = this.scene.add.container(anchor.x, anchor.y).setDepth(depth);

    if (kind === 'burn') {
      fx.add([
        this.scene.add.ellipse(0, 12, 50, 76, 0xff5a32, 0.08).setStrokeStyle(3, 0xff7043, 0.72),
        this.scene.add.ellipse(-18, 22, 15, 42, 0xffb13b, 0.12).setRotation(-0.25),
        this.scene.add.ellipse(17, 18, 13, 36, 0xff7043, 0.12).setRotation(0.28)
      ]);
    } else if (kind === 'poison') {
      // Poison must read as ground contamination, not a green overlay on the Pow.
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
    object: Phaser.GameObjects.GameObject,
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): void {
    const profile = NIGHT_STATUS_VFX_DEFAULTS[kind];
    const anchor = powVfxWorldAnchor(x, y, layout, profile.anchor);
    const positioned = object as Phaser.GameObjects.Components.Transform;
    if (typeof positioned.setPosition === 'function') positioned.setPosition(anchor.x, anchor.y);
  }
}
