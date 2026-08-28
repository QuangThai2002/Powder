import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import {
  EXACT_STATUS_VFX,
  exactElementVfx,
  exactStatusVfx,
  type ExactCombatVfxSpec
} from '../vfx/Combat2140ExactVfxRegistry';

const PATCH_FLAG = '__powderCombat2141SemanticVfxInstalled';

type FxTier = 'full' | 'balanced' | 'lite';
type AbilitySlot = 0 | 1 | 'ultimate';
type SemanticAction = {
  actorId: string;
  ability: CombatAbility;
  elementKey: string;
  slot: AbilitySlot;
};

const activeAction = new WeakMap<Phaser.Scene, SemanticAction>();

function plain(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function ownElement(view: any): string {
  return `${view?.pow?.elementKey || ''} ${view?.pow?.element || ''}`;
}

function abilityText(ability: CombatAbility | undefined): string {
  if (!ability) return '';
  return plain(`${ability.name || ''} ${ability.type || ''} ${ability.status || ''} ${ability.mechanic || ''} ${ability.description || ''} ${ability.target || ''}`);
}

function pushUnique(list: ExactCombatVfxSpec[], spec: ExactCombatVfxSpec | null | undefined): void {
  if (!spec || list.some((entry) => entry.textureKey === spec.textureKey)) return;
  list.push(spec);
}

/**
 * Returns only semantics that are actually represented by a dedicated asset.
 * Generic buffs deliberately return an empty list so they fall back to the Pow's
 * elemental cast artwork instead of pretending to be healing.
 */
function dedicatedAbilitySpecs(ability: CombatAbility | undefined): ExactCombatVfxSpec[] {
  const text = abilityText(ability);
  if (!text) return [];
  const specs: ExactCombatVfxSpec[] = [];

  // Defensive semantics are checked before recovery because some hybrid descriptions
  // mention both. Full FX may show both layers; lower tiers keep only the first layer.
  if (text.includes('shield') || text.includes('khien') || text.includes('barrier') || text.includes('bao ho')) {
    pushUnique(specs, EXACT_STATUS_VFX.shield);
  }
  if (
    text.includes('heal') || text.includes('hoi mau') || text.includes('hoi phuc') ||
    text.includes('regeneration') || text.includes('revive') || text.includes('hoi sinh')
  ) {
    pushUnique(specs, EXACT_STATUS_VFX.heal);
  }
  if (text.includes('freeze') || text.includes('dong bang') || text.includes('lam lanh') || text.includes('frost')) {
    pushUnique(specs, EXACT_STATUS_VFX.freeze);
  }
  if (
    text.includes('stun') || text.includes('choang') || text.includes('paralysis') ||
    text.includes('te liet')
  ) {
    pushUnique(specs, EXACT_STATUS_VFX.stun);
  }
  if (text.includes('burn') || text.includes('thieu dot')) pushUnique(specs, EXACT_STATUS_VFX.burn);
  if (text.includes('poison') || text.includes('nhiem doc') || text.includes('doc')) pushUnique(specs, exactElementVfx('poison'));

  return specs.slice(0, 2);
}

function runtimeDedicatedSpec(status: unknown): ExactCombatVfxSpec | null {
  const direct = exactStatusVfx(status);
  if (direct) return direct;
  const text = plain(status);
  if (text.includes('poison') || text.includes('nhiem doc') || text === 'doc') return exactElementVfx('poison');
  return null;
}

function addImage(
  scene: Phaser.Scene,
  spec: ExactCombatVfxSpec,
  x: number,
  y: number,
  depth: number,
  sizeMultiplier = 1,
  alphaMultiplier = 1
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(spec.textureKey)) return null;
  const quality = tier();
  const scale = quality === 'lite' ? 0.72 : quality === 'balanced' ? 0.86 : 1;
  const alpha = quality === 'lite' ? 0.68 : quality === 'balanced' ? 0.84 : 1;
  const size = spec.displaySize * sizeMultiplier * scale;
  return scene.add.image(x, y, spec.textureKey)
    .setDepth(depth)
    .setDisplaySize(size, size)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(spec.alpha * alphaMultiplier * alpha);
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try { scene.tweens.add({ ...config, onComplete: finish }); }
    catch { finish(); }
  });
}

async function playDedicatedBurst(
  scene: Phaser.Scene,
  specs: ExactCombatVfxSpec[],
  x: number,
  y: number,
  depth: number,
  ultimate = false
): Promise<boolean> {
  const available = specs.filter((spec) => scene.textures.exists(spec.textureKey));
  if (available.length <= 0) return false;

  const visibleSpecs = tier() === 'full' ? available.slice(0, 2) : available.slice(0, 1);
  const jobs: Promise<void>[] = [];
  visibleSpecs.forEach((spec, index) => {
    const fx = addImage(
      scene,
      spec,
      x,
      y,
      depth - index,
      ultimate ? (index === 0 ? 1.12 : 0.82) : (index === 0 ? 0.74 : 0.58),
      index === 0 ? 0.94 : 0.54
    );
    if (!fx) return;
    if (index > 0) fx.setRotation(0.18);
    jobs.push(tween(scene, {
      targets: fx,
      y: y - (ultimate ? 8 : 12),
      scaleX: fx.scaleX * (reducedMotion() ? 1.18 : ultimate ? 1.62 : 1.42),
      scaleY: fx.scaleY * (reducedMotion() ? 1.18 : ultimate ? 1.62 : 1.42),
      rotation: index > 0 && !reducedMotion() ? fx.rotation - 0.24 : fx.rotation,
      alpha: 0,
      duration: reducedMotion() ? 145 : ultimate ? 300 : 245,
      ease: 'Quad.easeOut'
    }).finally(() => { if (fx.scene) fx.destroy(); }));
  });
  await Promise.all(jobs);
  return jobs.length > 0;
}

export function installCombat2141SemanticVfxPatch(
  BattleSceneClass: any,
  PowViewClass: any,
  CombatPresentationDirectorClass: any
): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const sceneProto = BattleSceneClass.prototype as any;
  const previousAbility = sceneProto.performAbility;
  if (typeof previousAbility === 'function') {
    sceneProto.performAbility = async function combat2141SemanticAbility(
      this: Phaser.Scene,
      actor: any,
      target: any,
      slot: AbilitySlot
    ): Promise<void> {
      const previous = activeAction.get(this);
      const ability: CombatAbility = slot === 'ultimate'
        ? actor.pow.abilities.ultimate
        : actor.pow.abilities.skills[slot];
      activeAction.set(this, {
        actorId: String(actor?.instanceId || ''),
        ability,
        elementKey: String(actor?.pow?.elementKey || actor?.pow?.element || ''),
        slot
      });
      try { await previousAbility.call(this, actor, target, slot); }
      finally {
        if (previous) activeAction.set(this, previous);
        else activeAction.delete(this);
      }
    };
  }

  const powProto = PowViewClass.prototype as any;
  const previousStatusPulse = powProto.playStatusPulse;
  powProto.playStatusPulse = async function combat2141StatusPulse(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const runtime = plain(this.runtimeVisualStatus);

    if (
      runtime.includes('dong bang') || runtime.includes('choang') ||
      runtime.includes('te liet') || runtime.includes('cam lang')
    ) {
      if (typeof this.playControlLock === 'function') {
        await this.playControlLock(this.runtimeVisualStatus);
        return;
      }
    }

    const action = activeAction.get(scene);
    const dedicated = action ? dedicatedAbilitySpecs(action.ability) : [];
    if (dedicated.length > 0) {
      const p = this.getWorldPosition() as Phaser.Math.Vector2;
      if (await playDedicatedBurst(scene, dedicated, p.x, p.y + 4, 42, false)) return;
    }

    const runtimeSpec = runtimeDedicatedSpec(this.runtimeVisualStatus);
    if (runtimeSpec) {
      const p = this.getWorldPosition() as Phaser.Math.Vector2;
      if (await playDedicatedBurst(scene, [runtimeSpec], p.x, p.y + 4, 42, false)) return;
    }

    // Generic buff/support: use the Pow's own elemental artwork. Never impersonate healing.
    if (typeof this.playCastSignature === 'function') {
      await this.playCastSignature(false);
      return;
    }
    if (typeof previousStatusPulse === 'function') await previousStatusPulse.call(this);
  };

  const previousSupportAura = powProto.playSupportAura;
  powProto.playSupportAura = async function combat2141SupportAura(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const action = activeAction.get(scene);
    const specs = action ? dedicatedAbilitySpecs(action.ability) : [];
    if (specs.length > 0) {
      const p = this.getWorldPosition() as Phaser.Math.Vector2;
      if (await playDedicatedBurst(scene, specs, p.x, p.y + 10, 36, false)) return;
    }
    // Do not call the old always-Heal support aura for generic buffs.
    if (!action && runtimeDedicatedSpec(this.runtimeVisualStatus) && typeof previousSupportAura === 'function') {
      await previousSupportAura.call(this);
    }
  };

  const presentationProto = CombatPresentationDirectorClass.prototype as any;
  const previousUltimateImpact = presentationProto.playUltimateImpact;
  presentationProto.playUltimateImpact = async function combat2141UltimateImpact(
    targetView: any,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!selfTargeted || !targetView) {
      if (typeof previousUltimateImpact === 'function') {
        await previousUltimateImpact.call(this, targetView, elementKey, selfTargeted);
      }
      return;
    }

    const scene = this.scene as Phaser.Scene;
    const action = activeAction.get(scene);
    const specs = action ? dedicatedAbilitySpecs(action.ability) : [];
    const p = targetView.getWorldPosition() as Phaser.Math.Vector2;

    if (specs.length > 0 && await playDedicatedBurst(scene, specs, p.x, p.y - 6, 74, true)) {
      return;
    }

    // Generic self-Ultimate/buff: show the caster's element rather than the old hard-coded Heal.
    if (typeof targetView.playCastSignature === 'function') {
      await targetView.playCastSignature(false);
      return;
    }

    if (typeof previousUltimateImpact === 'function') {
      await previousUltimateImpact.call(this, targetView, elementKey, false);
    }
  };

  root.POWDER_COMBAT2_SEMANTIC_VFX = {
    version: '2.14.1',
    mode: 'ability-metadata-owned-support-vfx',
    rules: [
      'shield-is-not-heal',
      'generic-buff-uses-caster-element',
      'self-ultimate-uses-ability-semantics',
      'hybrid-heal-shield-can-layer-on-full-tier',
      'no-combat-logic-change'
    ]
  };
}
