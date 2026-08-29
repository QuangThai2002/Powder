import Phaser from 'phaser';
import {
  EXACT_STATUS_VFX,
  exactElementVfx,
  type ExactCombatVfxSpec
} from './Combat2140ExactVfxRegistry';
import {
  NIGHT_STATUS_VFX_DEFAULTS,
  powVfxDepth,
  powVfxWorldAnchor,
  type PowVfxLayout
} from './CombatNightVfxLayout';
import { PersistentPowStatusVfx, type PersistentPowStatusKind } from './PersistentPowStatusVfx';
import { PowView } from '../views/PowView';

const FLAG = '__powderCombatNightCuratedStatusAssetBridgeInstalled';
const LEGACY_PERSISTENT_KEY = '__powderCombat2140PersistentFx';

function specFor(kind: PersistentPowStatusKind): ExactCombatVfxSpec | null {
  if (kind === 'burn') return EXACT_STATUS_VFX.burn;
  if (kind === 'freeze') return EXACT_STATUS_VFX.freeze;
  if (kind === 'stun') return EXACT_STATUS_VFX.stun;
  if (kind === 'poison') return exactElementVfx('poison');
  return null;
}

function assetAlpha(kind: PersistentPowStatusKind): number {
  if (kind === 'poison') return 0.34;
  if (kind === 'freeze') return 0.5;
  if (kind === 'stun') return 0.56;
  return 0.46;
}

/**
 * Uses the curated representative frames already copied from the user's img/img2
 * libraries whenever a full sprite sheet is not available. Full sheet playback still
 * has priority inside PersistentPowStatusVfx; this bridge only replaces its vector fallback.
 */
function installCuratedFallback(): void {
  const proto = PersistentPowStatusVfx.prototype as any;
  if (proto.__nightCuratedFallbackInstalled) return;
  const previousFallback = proto.createFallback;
  if (typeof previousFallback !== 'function') return;

  proto.createFallback = function combatNightCuratedStatusFallback(
    this: { scene: Phaser.Scene },
    kind: PersistentPowStatusKind,
    x: number,
    y: number,
    layout: PowVfxLayout
  ): Phaser.GameObjects.GameObject {
    const spec = specFor(kind);
    if (!spec || !this.scene.textures.exists(spec.textureKey)) {
      return previousFallback.call(this, kind, x, y, layout);
    }

    const profile = NIGHT_STATUS_VFX_DEFAULTS[kind];
    const anchor = powVfxWorldAnchor(x, y, layout, profile.anchor);
    const maxWidth = layout.artWidth * layout.fieldScale * profile.widthRatio;
    const maxHeight = layout.artHeight * layout.fieldScale * profile.heightRatio;
    const size = Math.max(24, Math.min(maxWidth, maxHeight));
    const image = this.scene.add.image(anchor.x, anchor.y, spec.textureKey)
      .setDepth(powVfxDepth(kind === 'poison' ? 'ground' : profile.layer))
      .setDisplaySize(size, size)
      .setAlpha(spec.alpha * assetAlpha(kind));

    if (kind !== 'poison') image.setBlendMode(Phaser.BlendModes.ADD);
    return image;
  };

  proto.__nightCuratedFallbackInstalled = true;
}

/** Prevent the old 2.14.0 persistent image from drawing on top of the Night owner. */
function installLegacyPersistentDedup(): void {
  const proto = PowView.prototype as any;
  if (proto.__nightPersistentDedupInstalled) return;
  const previousUpdate = proto.updateRuntime;
  if (typeof previousUpdate !== 'function') return;

  proto.updateRuntime = function combatNightPersistentDedup(this: any, unit: any): void {
    previousUpdate.call(this, unit);
    const legacy = this[LEGACY_PERSISTENT_KEY] as Phaser.GameObjects.Image | undefined;
    if (legacy?.scene && this.persistentStatusVfx) legacy.setVisible(false);
  };

  proto.__nightPersistentDedupInstalled = true;
}

export function installCombatNightCuratedStatusAssetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;
  installCuratedFallback();
  installLegacyPersistentDedup();
  root.POWDER_COMBAT2_NIGHT_STATUS_ASSETS = {
    version: 'night-9',
    mode: 'curated-img-img2-static-fallback',
    fullSheetPriority: true,
    duplicateLegacyPersistentHidden: true
  };
}

installCombatNightCuratedStatusAssetBridge();
