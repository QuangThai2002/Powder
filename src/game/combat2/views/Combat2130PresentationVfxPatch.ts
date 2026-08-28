import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import {
  COMBAT_VFX_ASSETS,
  elementImpactAsset,
  type CombatVfxAssetSpec
} from '../vfx/CombatVfxAssetRegistry';

const PATCH_FLAG = '__powderCombat2130PresentationVfxInstalled';

type FxTier = 'full' | 'balanced' | 'lite';

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function abilitySpec(ability: CombatAbility, elementKey: string): CombatVfxAssetSpec {
  const text = norm(`${ability.type || ''} ${ability.status || ''} ${ability.mechanic || ''} ${ability.description || ''}`);
  if (text.includes('heal') || text.includes('hoi mau') || text.includes('regeneration') || text.includes('hoi phuc')) return COMBAT_VFX_ASSETS['status.heal'];
  if (text.includes('shield') || text.includes('barrier') || text.includes('guard') || text.includes('khien') || text.includes('bao ho')) return COMBAT_VFX_ASSETS['status.shield'];
  if (text.includes('freeze') || text.includes('dong bang') || text.includes('frost')) return COMBAT_VFX_ASSETS['status.freeze'];
  if (text.includes('stun') || text.includes('choang') || text.includes('paralysis') || text.includes('te liet')) return COMBAT_VFX_ASSETS['status.stun'];
  if (text.includes('burn') || text.includes('thieu dot')) return COMBAT_VFX_ASSETS['status.burn'];
  if (text.includes('poison') || text.includes('nhiem doc')) return COMBAT_VFX_ASSETS['poison.impact'];
  return elementImpactAsset(elementKey);
}

function blend(image: Phaser.GameObjects.Image, spec: CombatVfxAssetSpec): void {
  image.setBlendMode(spec.blend === 'normal' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
}

function pulse(
  scene: Phaser.Scene,
  spec: CombatVfxAssetSpec,
  x: number,
  y: number,
  size: number,
  duration: number,
  depth: number
): Promise<void> {
  if (!scene.textures.exists(spec.textureKey)) return Promise.resolve();
  const image = scene.add.image(x, y, spec.textureKey)
    .setDepth(depth)
    .setDisplaySize(size, size)
    .setAlpha((spec.alpha ?? 0.94) * (tier() === 'lite' ? 0.7 : 0.94))
    .setScale(reducedMotion() ? 0.92 : 0.68);
  blend(image, spec);
  return new Promise((resolve) => {
    const finish = (): void => { if (image.scene) image.destroy(); resolve(); };
    try {
      scene.tweens.add({
        targets: image,
        scaleX: reducedMotion() ? 1 : 1.16,
        scaleY: reducedMotion() ? 1 : 1.16,
        alpha: 0,
        angle: reducedMotion() ? 0 : 3,
        duration: reducedMotion() ? Math.min(150, duration) : duration,
        ease: 'Quad.easeOut',
        onComplete: finish
      });
    } catch { finish(); }
  });
}

export function installCombat2130PresentationVfxPatch(CombatPresentationDirectorClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = CombatPresentationDirectorClass.prototype as any;

  proto.playSkillIntro = async function combat2130SkillIntro(
    actorView: any,
    targetView: any,
    ability: CombatAbility,
    slot: 0 | 1,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!actorView) return;
    const scene = this.scene as Phaser.Scene;
    const actor = actorView.getWorldPosition() as Phaser.Math.Vector2;
    const target = targetView?.getWorldPosition?.() as Phaser.Math.Vector2 | undefined;
    const spec = abilitySpec(ability, elementKey);
    await pulse(scene, spec, actor.x, actor.y - 18, slot === 0 ? 150 : 174, slot === 0 ? 155 : 195, 58);
    if (!selfTargeted && target && tier() === 'full' && scene.textures.exists(spec.textureKey)) {
      const echo = scene.add.image(actor.x, actor.y - 8, spec.textureKey)
        .setDepth(57)
        .setDisplaySize(88, 88)
        .setAlpha(0.34);
      blend(echo, spec);
      await new Promise<void>((resolve) => {
        scene.tweens.add({
          targets: echo,
          x: target.x,
          y: target.y - 8,
          alpha: 0,
          duration: 145,
          ease: 'Quad.easeIn',
          onComplete: () => { echo.destroy(); resolve(); }
        });
      });
    }
  };

  proto.playUltimateImpact = async function combat2130UltimateImpact(
    targetView: any,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!targetView) return;
    const scene = this.scene as Phaser.Scene;
    const p = targetView.getWorldPosition() as Phaser.Math.Vector2;
    const spec = selfTargeted ? COMBAT_VFX_ASSETS['status.heal'] : elementImpactAsset(elementKey);
    if (!reducedMotion() && !selfTargeted) scene.cameras.main.shake(120, 0.002);
    await pulse(scene, spec, p.x, p.y - 12, tier() === 'full' ? 310 : 265, tier() === 'lite' ? 190 : 300, 72);
  };

  root.POWDER_COMBAT2_PRESENTATION_VFX = {
    version: '2.13.0',
    mode: 'asset-first-skill-intro-and-ultimate-impact',
    rules: ['no-procedural-skill-rings', 'no-procedural-impact-rays', 'ui-cinematic-plates-preserved']
  };
}
