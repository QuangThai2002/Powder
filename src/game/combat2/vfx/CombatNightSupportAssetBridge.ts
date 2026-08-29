import Phaser from 'phaser';
import { PowView } from '../views/PowView';
import { EXACT_STATUS_VFX, type ExactCombatVfxSpec } from './Combat2140ExactVfxRegistry';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombatNightSupportAssetBridgeInstalled';

function pulseAsset(view: any, spec: ExactCombatVfxSpec, kind: 'heal' | 'shield'): void {
  const scene = view.scene as Phaser.Scene | undefined;
  if (!scene?.add || !scene.textures.exists(spec.textureKey)) return;
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
  scene.tweens.add({
    targets: image,
    y: kind === 'heal' ? p.y - 10 : p.y,
    scaleX: kind === 'shield' ? 1.08 : 1.12,
    scaleY: kind === 'shield' ? 1.08 : 1.12,
    alpha: 0,
    duration: reducedMotion ? 150 : kind === 'shield' ? 260 : 240,
    ease: 'Quad.easeOut',
    onComplete: () => image.destroy()
  });
}

export function installCombatNightSupportAssetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const proto = PowView.prototype as any;
  if (proto.__nightSupportAssetInstalled) return;
  const previousPulse = proto.playResourcePulse;
  if (typeof previousPulse !== 'function') return;

  proto.playResourcePulse = function combatNightSupportAssetPulse(
    this: any,
    color: number,
    anchor?: unknown,
    layer?: unknown
  ): void {
    if (color === 0x73f0aa) {
      pulseAsset(this, EXACT_STATUS_VFX.heal, 'heal');
      return;
    }
    if (color === 0x8edfff) {
      pulseAsset(this, EXACT_STATUS_VFX.shield, 'shield');
      return;
    }
    previousPulse.call(this, color, anchor, layer);
  };

  proto.__nightSupportAssetInstalled = true;
  root.POWDER_COMBAT2_NIGHT_SUPPORT_ASSETS = {
    version: 'night-16',
    source: 'img2',
    heal: EXACT_STATUS_VFX.heal.textureKey,
    shield: EXACT_STATUS_VFX.shield.textureKey,
    anchor: 'body',
    hudSafeScale: true,
    ragePulsePreserved: true,
    combatLogicChanged: false
  };
}

installCombatNightSupportAssetBridge();
