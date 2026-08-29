import Phaser from 'phaser';
import { PowView } from '../views/PowView';
import { EXACT_STATUS_VFX, type ExactCombatVfxSpec } from './Combat2140ExactVfxRegistry';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombatNightSupportAssetBridgeInstalled';
const SHIELD_IMAGE_KEY = '__nightPersistentShieldImage';
const REGEN_IMAGE_KEY = '__nightPersistentRegenImage';
const CLEANUP_KEY = '__nightPersistentSupportCleanupInstalled';

function pulseAsset(view: any, spec: ExactCombatVfxSpec, kind: 'heal' | 'shield'): boolean {
  const scene = view.scene as Phaser.Scene | undefined;
  if (!scene?.add || !scene.textures.exists(spec.textureKey)) return false;
  const p = typeof view.getVfxAnchor === 'function'
    ? view.getVfxAnchor('body') as Phaser.Math.Vector2
    : view.getWorldPosition() as Phaser.Math.Vector2;
  const layout = typeof view.getVfxLayout === 'function' ? view.getVfxLayout() : null;
  const artWidth = Number(layout?.artWidth || 210) * Number(layout?.fieldScale || 1);
  const artHeight = Number(layout?.artHeight || 190) * Number(layout?.fieldScale || 1);
  const maxSize = Math.max(64, Math.min(artWidth * 0.62, artHeight * 0.72, kind === 'shield' ? 190 : 170));
  const image = scene.add.image(p.x, p.y, spec.textureKey)
    .setDepth(powVfxDepth('status'))
    .setDisplaySize(maxSize, maxSize)
    .setAlpha(spec.alpha * (kind === 'shield' ? 0.72 : 0.68));

  if (kind === 'heal') image.setBlendMode(Phaser.BlendModes.ADD);
  const reducedMotion = Boolean(view.reducedMotion);
  const config: Phaser.Types.Tweens.TweenBuilderConfig = {
    targets: image,
    y: kind === 'heal' ? p.y - 10 : p.y,
    scaleX: kind === 'shield' ? 1.08 : 1.12,
    scaleY: kind === 'shield' ? 1.08 : 1.12,
    alpha: 0,
    duration: reducedMotion ? 150 : kind === 'shield' ? 260 : 240,
    ease: 'Quad.easeOut'
  };

  const destroyImage = (): void => {
    if (image.active) image.destroy();
  };

  // Night teardown replaces PowView.tweenPromise with a scene-shutdown-safe owner.
  // Prefer that path so a Heal/Shield pulse cannot leave a live tween/image behind
  // when the player exits or restarts Combat2 in the middle of the pulse.
  if (typeof view.tweenPromise === 'function') {
    try {
      void Promise.resolve(view.tweenPromise(config)).then(destroyImage, destroyImage);
      return true;
    } catch {
      destroyImage();
      return true;
    }
  }

  let cleaned = false;
  let tween: Phaser.Tweens.Tween | null = null;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
    try { tween?.stop(); } catch { /* scene teardown may already own tween cleanup */ }
    destroyImage();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  try {
    tween = scene.tweens.add({ ...config, onComplete: cleanup, onStop: cleanup });
  } catch {
    cleanup();
  }
  return true;
}

function clearImage(view: any, key: string): void {
  const image = view[key] as Phaser.GameObjects.Image | undefined;
  if (image?.active) image.destroy();
  view[key] = null;
}

function clearPersistentSupport(view: any): void {
  clearImage(view, SHIELD_IMAGE_KEY);
  clearImage(view, REGEN_IMAGE_KEY);
}

function persistentLayout(view: any): {
  p: Phaser.Math.Vector2;
  artWidth: number;
  artHeight: number;
} {
  const p = typeof view.getVfxAnchor === 'function'
    ? view.getVfxAnchor('body') as Phaser.Math.Vector2
    : view.getWorldPosition() as Phaser.Math.Vector2;
  const layout = typeof view.getVfxLayout === 'function' ? view.getVfxLayout() : null;
  const fieldScale = Number(layout?.fieldScale || 1);
  return {
    p,
    artWidth: Number(layout?.artWidth || 210) * fieldScale,
    artHeight: Number(layout?.artHeight || 190) * fieldScale
  };
}

function ensurePersistentCleanup(view: any): void {
  if (view[CLEANUP_KEY]) return;
  const scene = view.scene as Phaser.Scene | undefined;
  if (!scene?.events) return;

  const cleanup = (): void => {
    clearPersistentSupport(view);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
    view[CLEANUP_KEY] = false;
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  view[CLEANUP_KEY] = true;
}

function syncPersistentImage(
  view: any,
  key: string,
  spec: ExactCombatVfxSpec,
  kind: 'shield' | 'regen'
): void {
  const scene = view.scene as Phaser.Scene | undefined;
  if (!scene?.add || !scene.textures.exists(spec.textureKey)) {
    clearImage(view, key);
    return;
  }

  ensurePersistentCleanup(view);
  const { p, artWidth, artHeight } = persistentLayout(view);
  const size = kind === 'shield'
    ? Math.max(72, Math.min(artWidth * 0.72, artHeight * 0.82, 184))
    : Math.max(52, Math.min(artWidth * 0.34, artHeight * 0.38, 92));
  const y = kind === 'regen' ? p.y + artHeight * 0.18 : p.y;
  const alpha = kind === 'shield' ? spec.alpha * 0.18 : spec.alpha * 0.24;

  let image = view[key] as Phaser.GameObjects.Image | undefined;
  if (!image?.active || image.texture.key !== spec.textureKey) {
    if (image?.active) image.destroy();
    image = scene.add.image(p.x, y, spec.textureKey);
    view[key] = image;
  }

  image
    .setPosition(p.x, y)
    .setDisplaySize(size, size)
    .setAlpha(alpha)
    .setDepth(kind === 'shield' ? powVfxDepth('status') - 1 : powVfxDepth('status') + 1)
    .setBlendMode(kind === 'regen' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
    .setVisible(true);
}

function syncPersistentSupport(view: any, unit: any): void {
  if (!unit?.alive || unit?.fieldSlot === null) {
    clearPersistentSupport(view);
    return;
  }

  if (Number(unit.shield || 0) > 0) {
    syncPersistentImage(view, SHIELD_IMAGE_KEY, EXACT_STATUS_VFX.shield, 'shield');
  } else {
    clearImage(view, SHIELD_IMAGE_KEY);
  }

  if (Number(unit.regenerationActionsRemaining || 0) > 0) {
    syncPersistentImage(view, REGEN_IMAGE_KEY, EXACT_STATUS_VFX.heal, 'regen');
  } else {
    clearImage(view, REGEN_IMAGE_KEY);
  }
}

export function installCombatNightSupportAssetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const proto = PowView.prototype as any;
  if (proto.__nightSupportAssetInstalled) return;
  const previousPulse = proto.playResourcePulse;
  const previousUpdate = proto.updateRuntime;
  if (typeof previousPulse !== 'function' || typeof previousUpdate !== 'function') return;

  proto.playResourcePulse = function combatNightSupportAssetPulse(
    this: any,
    color: number,
    anchor?: unknown,
    layer?: unknown
  ): void {
    if (color === 0x73f0aa && pulseAsset(this, EXACT_STATUS_VFX.heal, 'heal')) return;
    if (color === 0x8edfff && pulseAsset(this, EXACT_STATUS_VFX.shield, 'shield')) return;
    previousPulse.call(this, color, anchor, layer);
  };

  proto.updateRuntime = function combatNightPersistentSupportUpdate(this: any, unit: any): void {
    previousUpdate.call(this, unit);
    syncPersistentSupport(this, unit);
  };

  proto.__nightSupportAssetInstalled = true;
  root.POWDER_COMBAT2_NIGHT_SUPPORT_ASSETS = {
    version: 'night-29',
    source: 'img2-curated-preview',
    heal: EXACT_STATUS_VFX.heal.textureKey,
    shield: EXACT_STATUS_VFX.shield.textureKey,
    anchor: 'body',
    frameMode: 'single-curated-frame',
    hudSafeScale: true,
    ragePulsePreserved: true,
    persistentShield: true,
    persistentRegeneration: true,
    maxPersistentImagesPerPow: 2,
    persistentLoopTweens: false,
    sceneShutdownCleanup: true,
    pulseTweenShutdownSafe: true,
    pulseImageGuaranteedDestroy: true,
    fallback: 'procedural-pulse-when-texture-missing',
    combatLogicChanged: false
  };
}

installCombatNightSupportAssetBridge();
