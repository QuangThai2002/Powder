import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';
import {
  COMBAT_VFX_ASSETS,
  allCombatVfxAssets,
  elementImpactAsset,
  type CombatVfxAssetId,
  type CombatVfxAssetSpec
} from '../vfx/CombatVfxAssetRegistry';

const PATCH_FLAG = '__powderCombat2130AssetVfxInstalled';

type FxTier = 'full' | 'balanced' | 'lite';
type Slot = 'basic' | 0 | 1 | 'ultimate';

type ActionContext = {
  actorId: string;
  elementKey: string;
  ability: CombatAbility;
  slot: Slot;
};

type PersistentState = {
  ids: CombatVfxAssetId[];
  images: Phaser.GameObjects.Image[];
};

interface PatchableScene extends Phaser.Scene {
  powViews?: Map<string, any>;
  performBasicAttack?: (actor: CombatUnitState, target: CombatUnitState) => Promise<void>;
  performAbility?: (actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate') => Promise<void>;
}

const actionByScene = new WeakMap<Phaser.Scene, ActionContext>();
const persistentByView = new WeakMap<object, PersistentState>();

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

function combineAbility(ability?: CombatAbility): string {
  return norm(`${ability?.type || ''} ${ability?.status || ''} ${ability?.mechanic || ''} ${ability?.description || ''}`);
}

function statusAssetForAbility(ability?: CombatAbility): CombatVfxAssetSpec | null {
  const text = combineAbility(ability);
  if (!text) return null;
  if (text.includes('heal') || text.includes('hoi mau') || text.includes('regeneration') || text.includes('hoi phuc')) return COMBAT_VFX_ASSETS['status.heal'];
  if (text.includes('shield') || text.includes('barrier') || text.includes('guard') || text.includes('khien') || text.includes('bao ho')) return COMBAT_VFX_ASSETS['status.shield'];
  if (text.includes('freeze') || text.includes('dong bang') || text.includes('frost')) return COMBAT_VFX_ASSETS['status.freeze'];
  if (text.includes('stun') || text.includes('choang') || text.includes('paralysis') || text.includes('te liet')) return COMBAT_VFX_ASSETS['status.stun'];
  if (text.includes('burn') || text.includes('thieu dot')) return COMBAT_VFX_ASSETS['status.burn'];
  if (text.includes('poison') || text.includes('nhiem doc') || text.includes(' doc')) return COMBAT_VFX_ASSETS['poison.impact'];
  return null;
}

function actionSpec(scene: Phaser.Scene, view?: any): CombatVfxAssetSpec {
  const context = actionByScene.get(scene);
  const status = statusAssetForAbility(context?.ability);
  if (status) return status;
  if (context?.elementKey) return elementImpactAsset(context.elementKey);
  return elementImpactAsset(`${view?.pow?.elementKey || ''} ${view?.pow?.element || ''}`);
}

function statusSpec(status: string): CombatVfxAssetSpec {
  const key = norm(status);
  if (key.includes('dong bang') || key.includes('freeze') || key.includes('lanh') || key.includes('cong')) return COMBAT_VFX_ASSETS['status.freeze'];
  if (key.includes('choang') || key.includes('stun') || key.includes('te liet') || key.includes('paralysis')) return COMBAT_VFX_ASSETS['status.stun'];
  if (key.includes('thieu dot') || key.includes('burn')) return COMBAT_VFX_ASSETS['status.burn'];
  if (key.includes('khien') || key.includes('bao ho')) return COMBAT_VFX_ASSETS['status.shield'];
  if (key.includes('hoi')) return COMBAT_VFX_ASSETS['status.heal'];
  if (key.includes('doc') || key.includes('poison')) return COMBAT_VFX_ASSETS['poison.impact'];
  return COMBAT_VFX_ASSETS['dark.impact'];
}

function texturesReady(scene: Phaser.Scene, spec: CombatVfxAssetSpec): boolean {
  return Boolean(scene.textures?.exists(spec.textureKey));
}

function applyBlend(image: Phaser.GameObjects.Image, spec: CombatVfxAssetSpec): void {
  image.setBlendMode(spec.blend === 'normal' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => { if (done) return; done = true; resolve(); };
    try { scene.tweens.add({ ...config, onComplete: finish }); }
    catch { finish(); }
  });
}

async function burst(
  scene: Phaser.Scene,
  spec: CombatVfxAssetSpec,
  x: number,
  y: number,
  sizeScale = 1,
  duration = 210,
  startScale = 0.72
): Promise<void> {
  if (!texturesReady(scene, spec)) return;
  const motionScale = reducedMotion() ? 0.9 : sizeScale;
  const image = scene.add.image(x, y, spec.textureKey)
    .setDepth(68)
    .setAlpha((spec.alpha ?? 0.94) * (tier() === 'lite' ? 0.72 : 1))
    .setDisplaySize(spec.displaySize * motionScale, spec.displaySize * motionScale)
    .setScale(startScale);
  applyBlend(image, spec);
  const targetScale = reducedMotion() ? 0.96 : tier() === 'full' ? 1.18 : 1.08;
  await tween(scene, {
    targets: image,
    scaleX: targetScale,
    scaleY: targetScale,
    alpha: 0,
    angle: reducedMotion() ? 0 : (Math.random() - 0.5) * 5,
    duration: reducedMotion() ? Math.min(140, duration) : duration,
    ease: 'Quad.easeOut'
  });
  image.destroy();
}

async function travel(
  scene: Phaser.Scene,
  spec: CombatVfxAssetSpec,
  start: Phaser.Math.Vector2,
  target: Phaser.Math.Vector2
): Promise<void> {
  if (!texturesReady(scene, spec)) return;
  if (tier() === 'lite' || reducedMotion()) {
    await burst(scene, spec, target.x, target.y, 0.78, 155, 0.7);
    return;
  }
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
  const scale = tier() === 'full' ? 0.54 : 0.45;
  const projectile = scene.add.image(start.x, start.y, spec.textureKey)
    .setDepth(65)
    .setAlpha((spec.alpha ?? 0.94) * 0.84)
    .setDisplaySize(spec.displaySize * scale, spec.displaySize * scale)
    .setAngle(angle);
  applyBlend(projectile, spec);
  await tween(scene, {
    targets: projectile,
    x: target.x,
    y: target.y,
    alpha: 0.92,
    duration: tier() === 'full' ? 205 : 170,
    ease: 'Quad.easeIn'
  });
  projectile.destroy();
  await burst(scene, spec, target.x, target.y, tier() === 'full' ? 1 : 0.9, 210, 0.64);
}

function preloadAssets(scene: Phaser.Scene): void {
  for (const spec of allCombatVfxAssets()) {
    if (!scene.textures.exists(spec.textureKey)) scene.load.image(spec.textureKey, spec.url);
  }
}

function cleanupPersistent(view: any): void {
  const state = persistentByView.get(view);
  if (!state) return;
  const scene = view?.scene as Phaser.Scene | undefined;
  for (const image of state.images) {
    try { scene?.tweens.killTweensOf(image); } catch { /* presentation cleanup only */ }
    if (image.scene) image.destroy();
  }
  persistentByView.delete(view);
}

function desiredPersistent(unit: CombatUnitState): CombatVfxAssetId[] {
  if (!unit.alive || unit.fieldSlot === null) return [];
  const desired: CombatVfxAssetId[] = [];
  if (unit.controlStatus === 'freeze' && unit.controlActionsRemaining > 0) desired.push('status.freeze');
  else if (unit.controlStatus === 'stun' && unit.controlActionsRemaining > 0) desired.push('status.stun');
  else if (unit.paralysisActionsRemaining > 0) desired.push('status.stun');
  if (unit.burnActionsRemaining > 0 && unit.burnDamage > 0) desired.push('status.burn');
  if (unit.poisonActionsRemaining > 0 && unit.poisonStacks > 0) desired.push('poison.impact');
  if (unit.silenceActionsRemaining > 0) desired.push('dark.impact');
  if (unit.shield > 0 || unit.guardActionsRemaining > 0) desired.push('status.shield');
  if (unit.regenerationActionsRemaining > 0) desired.push('status.heal');
  if (unit.controlImmunityActionsRemaining > 0) desired.push('light.impact');
  const cap = tier() === 'full' ? 2 : 1;
  return [...new Set(desired)].slice(0, cap) as CombatVfxAssetId[];
}

function syncPersistent(view: any, unit: CombatUnitState): void {
  const scene = view?.scene as Phaser.Scene | undefined;
  const container = view?.container as Phaser.GameObjects.Container | undefined;
  if (!scene || !container) return;
  const wanted = desiredPersistent(unit).filter((id) => texturesReady(scene, COMBAT_VFX_ASSETS[id]));
  const previous = persistentByView.get(view);
  if (previous && previous.ids.join('|') === wanted.join('|')) return;
  cleanupPersistent(view);
  if (!wanted.length) return;

  const images: Phaser.GameObjects.Image[] = [];
  wanted.forEach((id, index) => {
    const spec = COMBAT_VFX_ASSETS[id];
    const size = Math.min(196, spec.displaySize * (index === 0 ? 0.84 : 0.72));
    const image = scene.add.image(index ? 18 : 0, -50 + index * 7, spec.textureKey)
      .setAlpha((spec.alpha ?? 0.9) * (index === 0 ? 0.54 : 0.38))
      .setDisplaySize(size, size)
      .setScale(0.94);
    applyBlend(image, spec);
    try { container.addAt(image, Math.min(6, container.length)); }
    catch { container.add(image); }
    if (!reducedMotion() && tier() !== 'lite') {
      scene.tweens.add({
        targets: image,
        scaleX: index === 0 ? 1.04 : 1,
        scaleY: index === 0 ? 1.04 : 1,
        alpha: image.alpha * 0.78,
        angle: index === 0 ? 2 : -2,
        duration: 720 + index * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    images.push(image);
  });
  persistentByView.set(view, { ids: wanted, images });
}

export function installCombat2130AssetVfxPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const sceneProto = BattleSceneClass.prototype as any;
  const originalPreload = sceneProto.preload;
  sceneProto.preload = function combat2130Preload(this: PatchableScene): void {
    if (typeof originalPreload === 'function') originalPreload.call(this);
    preloadAssets(this);
  };

  const originalBasic = sceneProto.performBasicAttack;
  if (typeof originalBasic === 'function') {
    sceneProto.performBasicAttack = async function combat2130Basic(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState): Promise<void> {
      actionByScene.set(this, { actorId: actor.instanceId, elementKey: actor.pow.elementKey, ability: actor.pow.abilities.basic, slot: 'basic' });
      try { await originalBasic.call(this, actor, target); }
      finally { actionByScene.delete(this); }
    };
  }

  const originalAbility = sceneProto.performAbility;
  if (typeof originalAbility === 'function') {
    sceneProto.performAbility = async function combat2130Ability(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate'): Promise<void> {
      const ability = slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
      actionByScene.set(this, { actorId: actor.instanceId, elementKey: actor.pow.elementKey, ability, slot });
      try { await originalAbility.call(this, actor, target, slot); }
      finally { actionByScene.delete(this); }
    };
  }

  const powProto = PowViewClass.prototype as any;
  const originalUpdateRuntime = powProto.updateRuntime;
  if (typeof originalUpdateRuntime === 'function') {
    powProto.updateRuntime = function combat2130UpdateRuntime(this: any, unit: CombatUnitState): void {
      originalUpdateRuntime.call(this, unit);
      syncPersistent(this, unit);
    };
  }

  powProto.playCastSignature = async function combat2130Cast(this: any, support: boolean): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const context = actionByScene.get(scene);
    const spec = support ? (statusAssetForAbility(context?.ability) || actionSpec(scene, this)) : actionSpec(scene, this);
    if (tier() === 'lite' && !support) return;
    await burst(scene, spec, p.x, p.y - 12, support ? 0.78 : 0.62, support ? 185 : 150, 0.58);
  };

  powProto.playElementTravel = async function combat2130Travel(this: any, targetX: number, targetY: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const start = this.getWorldPosition() as Phaser.Math.Vector2;
    await travel(scene, actionSpec(scene, this), start, new Phaser.Math.Vector2(targetX, targetY));
  };

  powProto.playElementImpact = async function combat2130Impact(this: any, x: number, y: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    await burst(scene, actionSpec(scene, this), x, y, 0.9, 205, 0.66);
  };

  powProto.playSupportAura = async function combat2130Support(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const context = actionByScene.get(scene);
    const spec = statusAssetForAbility(context?.ability) || COMBAT_VFX_ASSETS['status.heal'];
    await burst(scene, spec, p.x, p.y - 28, 0.9, 230, 0.68);
  };

  powProto.playControlLock = async function combat2130Control(this: any, status: string): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const spec = statusSpec(status);
    const startX = this.container.x;
    await Promise.all([
      burst(scene, spec, p.x, p.y - 30, 0.94, reducedMotion() ? 160 : 300, 0.8),
      tween(scene, { targets: this.container, x: startX + 5, duration: 68, yoyo: true, repeat: reducedMotion() ? 0 : 2, ease: 'Sine.easeInOut' })
    ]);
    if (this.container.scene) this.container.setX(startX);
  };

  powProto.playHitFlash = function combat2130HitFlash(this: any): void {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const context = actionByScene.get(scene);
    let spec = context ? actionSpec(scene, this) : null;
    if (!spec) {
      const runtimeStatus = String(this.runtimeVisualStatus || '');
      spec = runtimeStatus ? statusSpec(runtimeStatus) : elementImpactAsset(`${this.pow?.elementKey || ''} ${this.pow?.element || ''}`);
    }
    void burst(scene, spec, p.x, p.y - 8, tier() === 'full' ? 0.92 : 0.78, 185, 0.62);
    if (this.portrait?.active) {
      this.portrait.setTintFill(0xffffff);
      scene.time.delayedCall(reducedMotion() ? 50 : 78, () => { if (this.portrait?.active) this.portrait.clearTint(); });
    }
  };

  powProto.playResourcePulse = function combat2130Resource(this: any, color: number): void {
    if (tier() === 'lite') return;
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const spec = color === 0x73f0aa
      ? COMBAT_VFX_ASSETS['status.heal']
      : color === 0x8edfff
        ? COMBAT_VFX_ASSETS['status.shield']
        : COMBAT_VFX_ASSETS['light.impact'];
    void burst(scene, spec, p.x, p.y - 18, 0.5, 155, 0.72);
  };

  powProto.playShieldBreak = function combat2130ShieldBreak(this: any): void {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    void burst(scene, COMBAT_VFX_ASSETS['status.shield'], p.x, p.y - 12, 1.02, 230, 0.72);
  };

  powProto.playDefeatBurst = async function combat2130Defeat(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const ownElement = elementImpactAsset(`${this.pow?.elementKey || ''} ${this.pow?.element || ''}`);
    if (!reducedMotion()) scene.cameras.main.shake(90, 0.0012);
    await burst(scene, ownElement, p.x, p.y - 8, 1.08, 245, 0.66);
  };

  root.POWDER_COMBAT2_ACTION_FX = {
    version: '2.13.0',
    mode: 'asset-first-preview',
    proceduralPrimaryFx: false
  };
  root.POWDER_COMBAT2_STATUS_FX = {
    version: '2.13.0',
    mode: 'asset-first-persistent-status',
    proceduralPrimaryFx: false
  };
  root.POWDER_COMBAT2_ASSET_VFX = {
    version: '2.13.0',
    mode: 'img+img2-preview-registry',
    tier: tier(),
    assetCount: allCombatVfxAssets().length,
    sources: ['img', 'img2'],
    rules: [
      'real-transparent-vfx-assets-primary',
      'source-to-target-travel',
      'persistent-status-attached-to-pow',
      'no-circle-triangle-rectangle-primary-fx',
      'adaptive-full-balanced-lite',
      'missing-asset-safe-noop',
      'no-combat-logic-change'
    ]
  };
}
