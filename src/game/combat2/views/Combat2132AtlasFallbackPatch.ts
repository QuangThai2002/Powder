import Phaser from 'phaser';

const PATCH_FLAG = '__powderCombat2132AtlasFallbackInstalled';
const ATLAS_KEY = 'combat-vfx-atlas-a';
const ATLAS_URL = '/assets/combat/vfx/preview/vfx-elements-a.webp';

type FxTier = 'full' | 'balanced' | 'lite';

const actionFrameByScene = new WeakMap<Phaser.Scene, number>();

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

function frameForStatus(value: unknown): number | null {
  const key = norm(value);
  if (!key || key.includes('du bi') || key.includes('ha guc')) return null;
  if (key.includes('thieu dot') || key.includes('burn')) return 0;
  if (key.includes('dong bang') || key.includes('lam lanh') || key.includes('te cong') || key.includes('freeze')) return 2;
  if (key.includes('choang') || key.includes('te liet') || key.includes('mien khong') || key.includes('khang hieu ung') || key.includes('bao ho') || key.includes('khien')) return 1;
  if (key.includes('nhiem doc') || key.includes('poison') || key.includes('hoi phuc') || key.includes('tang ')) return 3;
  if (key.includes('cam lang') || key.includes('giam ') || key.includes('cham')) return 4;
  return null;
}

function atlasImage(scene: Phaser.Scene, x: number, y: number, frame: number, depth = 37): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(ATLAS_KEY)) return null;
  const quality = tier();
  const image = scene.add.image(x, y, ATLAS_KEY, frame)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(quality === 'lite' ? 0.58 : quality === 'balanced' ? 0.72 : 0.86)
    .setScale(quality === 'lite' ? 0.58 : quality === 'balanced' ? 0.68 : 0.78);
  return image;
}

function elementFrame(view: any): number {
  return frameForElement(`${view?.pow?.elementKey || ''} ${view?.pow?.element || ''}`);
}

function actorElementFrame(actor: any): number {
  return frameForElement(`${actor?.pow?.elementKey || ''} ${actor?.pow?.element || ''}`);
}

function duration(normal: number, lite: number): number {
  if (reducedMotion()) return Math.min(120, lite);
  return tier() === 'lite' ? lite : normal;
}

function tweenPromise(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));
}

function cleanupPersistent(view: any): void {
  const fx = view.__atlasPersistent2132 as Phaser.GameObjects.Image | undefined;
  if (fx?.scene) fx.destroy();
  view.__atlasPersistent2132 = null;
}

export function installCombat2132AtlasFallbackPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  root.POWDER_COMBAT2_BUNDLED_ATLAS_ONLY = true;

  const sceneProto = BattleSceneClass.prototype as any;
  const originalPreload = sceneProto.preload;
  sceneProto.preload = function combat2132Preload(this: Phaser.Scene, ...args: any[]): void {
    if (typeof originalPreload === 'function') originalPreload.apply(this, args);
    if (!this.textures.exists(ATLAS_KEY)) this.load.spritesheet(ATLAS_KEY, ATLAS_URL, { frameWidth: 224, frameHeight: 224 });
  };

  // Presentation-only action context. The target's Pow element must never recolor an incoming
  // hit: impact feedback belongs to the attacker/skill source. Wrapping the already-installed
  // action methods preserves every existing resolver rule and only exposes the source frame
  // while that action is presenting.
  const originalBasic = sceneProto.performBasicAttack;
  if (typeof originalBasic === 'function') {
    sceneProto.performBasicAttack = async function combat2133BasicImpactIdentity(this: Phaser.Scene, ...args: any[]): Promise<any> {
      actionFrameByScene.set(this, actorElementFrame(args[0]));
      try { return await originalBasic.apply(this, args); }
      finally { actionFrameByScene.delete(this); }
    };
  }

  const originalAbility = sceneProto.performAbility;
  if (typeof originalAbility === 'function') {
    sceneProto.performAbility = async function combat2133AbilityImpactIdentity(this: Phaser.Scene, ...args: any[]): Promise<any> {
      actionFrameByScene.set(this, actorElementFrame(args[0]));
      try { return await originalAbility.apply(this, args); }
      finally { actionFrameByScene.delete(this); }
    };
  }

  const proto = PowViewClass.prototype as any;

  proto.playCastSignature = async function combat2132Cast(this: any, support: boolean): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition();
    const frame = support ? 3 : elementFrame(this);
    const fx = atlasImage(scene, p.x, p.y - 4, frame, 35);
    if (!fx) return;
    fx.setScale(fx.scaleX * 0.62).setAlpha(fx.alpha * 0.82);
    await tweenPromise(scene, { targets: fx, scaleX: fx.scaleX * 1.75, scaleY: fx.scaleY * 1.75, alpha: 0, duration: duration(230, 150), ease: 'Quad.easeOut' });
    fx.destroy();
  };

  proto.playElementTravel = async function combat2132Travel(this: any, targetX: number, targetY: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const start = this.getWorldPosition();
    const frame = elementFrame(this);
    const fx = atlasImage(scene, start.x, start.y, frame, 36);
    if (!fx) return;
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    fx.setRotation(Math.atan2(dy, dx)).setScale(fx.scaleX * 0.46).setAlpha(Math.min(0.86, fx.alpha));
    await tweenPromise(scene, { targets: fx, x: targetX, y: targetY, scaleX: fx.scaleX * 1.12, scaleY: fx.scaleY * 1.12, duration: duration(220, 145), ease: 'Quad.easeIn' });
    fx.destroy();
    await proto.playElementImpact.call(this, targetX, targetY);
  };

  proto.playElementImpact = async function combat2132Impact(this: any, x: number, y: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const fx = atlasImage(scene, x, y, elementFrame(this), 38);
    if (!fx) return;
    fx.setScale(fx.scaleX * 0.68).setAlpha(Math.min(0.96, fx.alpha + 0.08));
    const second = tier() === 'full' ? atlasImage(scene, x, y, elementFrame(this), 37) : null;
    if (second) second.setScale(fx.scaleX * 0.76).setRotation(0.22).setAlpha(0.34);
    await Promise.all([
      tweenPromise(scene, { targets: fx, scaleX: fx.scaleX * 1.85, scaleY: fx.scaleY * 1.85, alpha: 0, duration: duration(220, 140), ease: 'Quad.easeOut' }),
      second ? tweenPromise(scene, { targets: second, scaleX: second.scaleX * 1.48, scaleY: second.scaleY * 1.48, rotation: second.rotation - 0.35, alpha: 0, duration: 245, ease: 'Sine.easeOut' }) : Promise.resolve()
    ]);
    fx.destroy();
    second?.destroy();
  };

  proto.playSupportAura = async function combat2132Support(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition();
    const fx = atlasImage(scene, p.x, p.y + 12, 3, 34);
    if (!fx) return;
    fx.setAlpha(fx.alpha * 0.68).setScale(fx.scaleX * 0.72);
    await tweenPromise(scene, { targets: fx, y: p.y - 12, scaleX: fx.scaleX * 1.55, scaleY: fx.scaleY * 1.55, alpha: 0, duration: duration(275, 175), ease: 'Sine.easeOut' });
    fx.destroy();
  };

  proto.playHitFlash = function combat2133HitFlash(this: any): void {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition();
    const impactFrame = actionFrameByScene.get(scene) ?? elementFrame(this);
    const fx = atlasImage(scene, p.x, p.y - 5, impactFrame, 39);
    if (this.portrait?.active) {
      this.portrait.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      scene.time.delayedCall(reducedMotion() ? 50 : 82, () => { if (this.portrait?.active) this.portrait.clearTint(); });
    }
    if (!fx) return;
    fx.setScale(fx.scaleX * 0.52).setAlpha(Math.min(0.92, fx.alpha));
    scene.tweens.add({ targets: fx, scaleX: fx.scaleX * 1.75, scaleY: fx.scaleY * 1.75, alpha: 0, duration: duration(175, 105), ease: 'Quad.easeOut', onComplete: () => fx.destroy() });
  };

  proto.playControlLock = async function combat2132Control(this: any, status: string): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition();
    const frame = frameForStatus(status) ?? 1;
    const fx = atlasImage(scene, p.x, p.y - 8, frame, 40);
    const startX = this.container.x;
    const motions: Promise<void>[] = [tweenPromise(scene, { targets: this.container, x: startX + 6, duration: 70, yoyo: true, repeat: reducedMotion() ? 0 : 2 })];
    if (fx) {
      fx.setAlpha(fx.alpha * 0.78).setScale(fx.scaleX * 0.72);
      motions.push(tweenPromise(scene, { targets: fx, scaleX: fx.scaleX * 1.35, scaleY: fx.scaleY * 1.35, alpha: 0, duration: duration(330, 185), ease: 'Quad.easeOut' }));
    }
    await Promise.all(motions);
    this.container.setX(startX);
    fx?.destroy();
  };

  proto.playResourcePulse = function combat2132Resource(this: any, color: number): void {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition();
    const frame = color === 0x73f0aa ? 3 : color === 0x8edfff ? 2 : 1;
    const fx = atlasImage(scene, p.x, p.y, frame, 40);
    if (!fx) return;
    fx.setScale(fx.scaleX * 0.48).setAlpha(fx.alpha * 0.58);
    scene.tweens.add({ targets: fx, scaleX: fx.scaleX * 1.7, scaleY: fx.scaleY * 1.7, alpha: 0, duration: duration(235, 135), ease: 'Quad.easeOut', onComplete: () => fx.destroy() });
  };

  proto.playShieldBreak = function combat2132ShieldBreak(this: any): void {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition();
    const fx = atlasImage(scene, p.x, p.y, 1, 41);
    if (!fx) return;
    fx.setScale(fx.scaleX * 0.62).setAlpha(0.88);
    scene.tweens.add({ targets: fx, scaleX: fx.scaleX * 1.9, scaleY: fx.scaleY * 1.9, rotation: 0.18, alpha: 0, duration: duration(225, 140), ease: 'Quad.easeOut', onComplete: () => fx.destroy() });
  };

  proto.playDefeatBurst = async function combat2132Defeat(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition();
    const fx = atlasImage(scene, p.x, p.y, 4, 44);
    if (!fx) return;
    fx.setAlpha(0.68).setScale(fx.scaleX * 0.7);
    if (!reducedMotion()) scene.cameras.main.shake(90, 0.0012);
    await tweenPromise(scene, { targets: fx, y: p.y + 14, scaleX: fx.scaleX * 1.55, scaleY: fx.scaleY * 1.55, alpha: 0, duration: duration(235, 145), ease: 'Quad.easeOut' });
    fx.destroy();
  };

  const originalUpdateRuntime = proto.updateRuntime;
  if (typeof originalUpdateRuntime === 'function') {
    proto.updateRuntime = function combat2132Runtime(this: any, unit: any): void {
      originalUpdateRuntime.call(this, unit);
      const scene = this.scene as Phaser.Scene;
      const frame = frameForStatus(this.runtimeVisualStatus);
      if (frame === null || !unit?.alive || unit?.fieldSlot === null || !scene.textures.exists(ATLAS_KEY)) {
        const existing = this.__atlasPersistent2132 as Phaser.GameObjects.Image | undefined;
        existing?.setVisible(false);
        return;
      }
      let fx = this.__atlasPersistent2132 as Phaser.GameObjects.Image | undefined;
      if (!fx || !fx.scene) {
        fx = scene.add.image(0, 0, ATLAS_KEY, frame).setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
        this.__atlasPersistent2132 = fx;
        if (!this.__atlasPersistentCleanupBound2132) {
          this.__atlasPersistentCleanupBound2132 = true;
          const cleanup = () => cleanupPersistent(this);
          scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
          scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
        }
      }
      const p = this.getWorldPosition();
      fx.setFrame(frame).setPosition(p.x, p.y - 5).setVisible(true)
        .setScale(tier() === 'lite' ? 0.42 : tier() === 'balanced' ? 0.5 : 0.56)
        .setAlpha(tier() === 'lite' ? 0.24 : tier() === 'balanced' ? 0.3 : 0.36);
    };
  }

  root.POWDER_COMBAT2_ATLAS_FALLBACK = {
    version: '2.13.3',
    mode: 'bundled-atlas-replacement+attacker-impact-identity',
    atlas: ATLAS_URL,
    frames: { fire: 0, steel: 1, water: 2, leaf: 3, earth: 4 },
    temporaryElementFallbacks: {
      lava: 'fire', lightning: 'steel', light: 'steel', ice: 'water', storm: 'water', poison: 'leaf', wind: 'leaf', dark: 'earth'
    },
    rules: ['asset-first', 'no-primary-geometric-fx', 'attacker-owned-hit-impact', 'adaptive-full-balanced-lite', 'persistent-status-single-overlay', 'no-combat-logic-change']
  };
}
