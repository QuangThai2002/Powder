import Phaser from 'phaser';

const PATCH_FLAG = '__powderCombat2134SourceImpactIdentityInstalled';
const ATLAS_KEY = 'combat-vfx-atlas-a';

type FxTier = 'full' | 'balanced' | 'lite';

type ActionContext = {
  actorId: string;
  elementKey: string;
};

const actionContext = new WeakMap<Phaser.Scene, ActionContext>();

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function frameForElement(value: unknown): number {
  const key = norm(value);
  if (key.includes('lua') || key.includes('fire') || key.includes('dung nham') || key.includes('lava')) return 0;
  if (key.includes('thep') || key.includes('steel') || key.includes('set') || key.includes('lightning') || key.includes('electric') || key.includes('anh sang') || key.includes('light')) return 1;
  if (key.includes('nuoc') || key.includes('water') || key.includes('bang') || key.includes('ice') || key.includes('bao') || key.includes('storm')) return 2;
  if (key.includes('la') || key.includes('leaf') || key.includes('nature') || key.includes('doc') || key.includes('poison') || key.includes('gio') || key.includes('wind')) return 3;
  return 4;
}

export function installCombat2134SourceImpactIdentityPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const sceneProto = BattleSceneClass.prototype as any;
  const originalBasic = sceneProto.performBasicAttack;
  if (typeof originalBasic === 'function') {
    sceneProto.performBasicAttack = async function combat2134Basic(this: Phaser.Scene, actor: any, target: any): Promise<void> {
      actionContext.set(this, { actorId: String(actor?.instanceId || ''), elementKey: String(actor?.pow?.elementKey || actor?.pow?.element || '') });
      try { await originalBasic.call(this, actor, target); }
      finally { actionContext.delete(this); }
    };
  }

  const originalAbility = sceneProto.performAbility;
  if (typeof originalAbility === 'function') {
    sceneProto.performAbility = async function combat2134Ability(this: Phaser.Scene, actor: any, target: any, slot: 0 | 1 | 'ultimate'): Promise<void> {
      actionContext.set(this, { actorId: String(actor?.instanceId || ''), elementKey: String(actor?.pow?.elementKey || actor?.pow?.element || '') });
      try { await originalAbility.call(this, actor, target, slot); }
      finally { actionContext.delete(this); }
    };
  }

  const powProto = PowViewClass.prototype as any;
  powProto.playHitFlash = function combat2134SourceHitFlash(this: any): void {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const context = actionContext.get(scene);
    const ownElement = `${this?.pow?.elementKey || ''} ${this?.pow?.element || ''}`;
    const frame = frameForElement(context?.elementKey || ownElement);

    if (this.portrait?.active) {
      this.portrait.setTintFill(0xffffff);
      scene.time.delayedCall(reducedMotion() ? 48 : 78, () => {
        if (this.portrait?.active) this.portrait.clearTint();
      });
    }

    if (!scene.textures.exists(ATLAS_KEY)) return;
    const quality = tier();
    const fx = scene.add.image(p.x, p.y - 5, ATLAS_KEY, frame)
      .setDepth(39)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(quality === 'lite' ? 0.56 : quality === 'balanced' ? 0.72 : 0.9)
      .setScale(quality === 'lite' ? 0.3 : quality === 'balanced' ? 0.36 : 0.41);

    scene.tweens.add({
      targets: fx,
      scaleX: fx.scaleX * (reducedMotion() ? 1.35 : 1.8),
      scaleY: fx.scaleY * (reducedMotion() ? 1.35 : 1.8),
      alpha: 0,
      duration: reducedMotion() ? 100 : 172,
      ease: 'Quad.easeOut',
      onComplete: () => fx.destroy()
    });
  };

  root.POWDER_COMBAT2_SOURCE_IMPACT_IDENTITY = {
    version: '2.13.4',
    mode: 'attacker-element-owned-impact',
    rule: 'target hit VFX inherits the acting Pow element, never the target element',
    combatLogicChanged: false
  };
}
