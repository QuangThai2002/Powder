import Phaser from 'phaser';

export type PowVfxAnchor = 'ground' | 'body' | 'head';
export type PowVfxLayer = 'ground' | 'behind' | 'body' | 'status' | 'foreground';

export interface PowVfxLayout {
  cardWidth: number;
  cardHeight: number;
  artWidth: number;
  artHeight: number;
  artCenterY: number;
  fieldScale: number;
}

export interface SpriteSheetPlaybackSpec {
  frameWidth: number;
  frameHeight: number;
  startFrame: number;
  endFrame: number;
  frameRate: number;
  repeat: number;
}

/**
 * Night Upgrade VFX layout contract.
 *
 * Combat cards reserve their lower area for name / HP / rage. VFX must therefore
 * anchor to the portrait region instead of the card centre. This prevents status
 * art from drifting into HP / rage while still scaling with compact field cards.
 */
export function createPowVfxLayout(cardWidth: number, cardHeight: number, fieldScale: number): PowVfxLayout {
  const footerHeight = 108;
  const artHeight = Math.max(1, cardHeight - footerHeight - 14);
  const artWidth = Math.max(1, cardWidth - 20);
  const top = -cardHeight / 2;
  const artCenterY = top + 9 + artHeight / 2;
  return {
    cardWidth,
    cardHeight,
    artWidth,
    artHeight,
    artCenterY,
    fieldScale: Phaser.Math.Clamp(Number.isFinite(fieldScale) ? fieldScale : 1, 0.35, 1)
  };
}

/** Returns a world-space anchor that stays inside the Pow portrait area. */
export function powVfxWorldAnchor(
  containerX: number,
  containerY: number,
  layout: PowVfxLayout,
  anchor: PowVfxAnchor = 'body'
): Phaser.Math.Vector2 {
  const halfArt = layout.artHeight / 2;
  const localY = anchor === 'head'
    ? layout.artCenterY - halfArt * 0.42
    : anchor === 'ground'
      ? layout.artCenterY + halfArt * 0.74
      : layout.artCenterY;
  return new Phaser.Math.Vector2(containerX, containerY + localY * layout.fieldScale);
}

/** Stable depth bands: ground below Pow, status above portrait, HUD remains outside VFX bands. */
export function powVfxDepth(layer: PowVfxLayer): number {
  if (layer === 'ground') return 27;
  if (layer === 'behind') return 31;
  if (layer === 'body') return 38;
  if (layer === 'status') return 42;
  return 46;
}

/**
 * Fit one animation frame to a Pow portrait. This intentionally sizes ONE frame,
 * not a whole sprite sheet. Callers should animate frame indices on one Sprite.
 */
export function fitVfxFrameToPow(
  frameWidth: number,
  frameHeight: number,
  layout: PowVfxLayout,
  maxWidthRatio = 0.72,
  maxHeightRatio = 0.72
): number {
  const safeW = Math.max(1, frameWidth);
  const safeH = Math.max(1, frameHeight);
  const widthScale = (layout.artWidth * Phaser.Math.Clamp(maxWidthRatio, 0.15, 1.1)) / safeW;
  const heightScale = (layout.artHeight * Phaser.Math.Clamp(maxHeightRatio, 0.15, 1.1)) / safeH;
  return Phaser.Math.Clamp(Math.min(widthScale, heightScale) * layout.fieldScale, 0.12, 2.4);
}

/**
 * Frame sequence guard used by sprite-sheet adapters. It produces ordered frame
 * numbers only; it must never be interpreted as a request to draw all frames.
 */
export function orderedFrameNumbers(spec: Pick<SpriteSheetPlaybackSpec, 'startFrame' | 'endFrame'>): number[] {
  const start = Math.max(0, Math.floor(spec.startFrame));
  const end = Math.max(start, Math.floor(spec.endFrame));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export const NIGHT_STATUS_VFX_DEFAULTS = Object.freeze({
  // Burn is intentionally larger so the flame silhouette wraps the Pow body.
  burn: { anchor: 'body' as PowVfxAnchor, layer: 'status' as PowVfxLayer, widthRatio: 0.74, heightRatio: 0.80 },
  // Poison remains a ground-owned status. PersistentPowStatusVfx lifts the artwork
  // slightly upward while preserving this semantic anchor, so gas surrounds the
  // lower body without becoming a green body overlay or covering the HUD.
  poison: { anchor: 'ground' as PowVfxAnchor, layer: 'status' as PowVfxLayer, widthRatio: 0.82, heightRatio: 0.68 },
  freeze: { anchor: 'body' as PowVfxAnchor, layer: 'status' as PowVfxLayer, widthRatio: 0.78, heightRatio: 0.78 },
  stun: { anchor: 'head' as PowVfxAnchor, layer: 'status' as PowVfxLayer, widthRatio: 0.54, heightRatio: 0.42 },
  heal: { anchor: 'body' as PowVfxAnchor, layer: 'foreground' as PowVfxLayer, widthRatio: 0.68, heightRatio: 0.72 },
  shield: { anchor: 'body' as PowVfxAnchor, layer: 'status' as PowVfxLayer, widthRatio: 0.82, heightRatio: 0.82 }
});
