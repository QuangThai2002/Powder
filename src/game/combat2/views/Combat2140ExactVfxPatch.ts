import Phaser from 'phaser';
import type { CombatAbility, CombatSide } from '../data/CombatPow';
import {
  EXACT_STATUS_VFX,
  allExactCombatVfxSpecs,
  exactElementVfx,
  exactStatusVfx,
  type ExactCombatVfxSpec
} from '../vfx/Combat2140ExactVfxRegistry';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2140ExactVfxInstalled';
const ACTION_ELEMENT = '__powderCombat2140ActionElement';
const PERSISTENT_FX = '__powderCombat2140PersistentFx';
const PERSISTENT_CLEANUP = '__powderCombat2140PersistentCleanup';

type FxTier = 'full' | 'balanced' | 'lite';

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

function qualityScale(): number {
  return tier() === 'lite' ? 0.72 : tier() === 'balanced' ? 0.86 : 1;
}

function qualityAlpha(): number {
  return tier() === 'lite' ? 0.68 : tier() === 'balanced' ? 0.84 : 1;
}

function ownElement(view: any): string {
  return `${view?.pow?.elementKey || ''} ${view?.pow?.element || ''}`;
}

function addExactImage(
  scene: Phaser.Scene,
  spec: ExactCombatVfxSpec,
  x: number,
  y: number,
  depth: number,
  sizeMultiplier = 1,
  alphaMultiplier = 1
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(spec.textureKey)) return null;
  const size = spec.displaySize * sizeMultiplier * qualityScale();
  return scene.add.image(x, y, spec.textureKey)
    .setDepth(depth)
    .setDisplaySize(size, size)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(spec.alpha * alphaMultiplier * qualityAlpha());
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

function abilitySpec(ability: CombatAbility, elementKey: string): ExactCombatVfxSpec | null {
  const text = norm(`${ability.type || ''} ${ability.status || ''} ${ability.mechanic || ''} ${ability.description || ''}`);
  return exactStatusVfx(text) || (text.includes('poison') || text.includes('nhiem doc') ? exactElementVfx('poison') : null) || exactElementVfx(elementKey);
}

function runtimeStatusSpec(value: unknown): ExactCombatVfxSpec | null {
  const text = norm(value);
  return exactStatusVfx(text) || (text.includes('poison') || text.includes('nhiem doc') ? exactElementVfx('poison') : null);
}

function clearPersistent(view: any): void {
  const fx = view[PERSISTENT_FX] as Phaser.GameObjects.Image | undefined;
  if (fx?.scene) fx.destroy();
  view[PERSISTENT_FX] = null;
}

function shortName(value: unknown, maxLength: number): string {
  const clean = String(value || '').trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

export function installCombat2140ExactVfxPatch(
  BattleSceneClass: any,
  PowViewClass: any,
  CombatPresentationDirectorClass: any
): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const sceneProto = BattleSceneClass.prototype as any;
  const originalPreload = sceneProto.preload;
  sceneProto.preload = function combat2140Preload(this: Phaser.Scene, ...args: any[]): void {
    if (typeof originalPreload === 'function') originalPreload.apply(this, args);
    for (const spec of allExactCombatVfxSpecs()) {
      if (!this.textures.exists(spec.textureKey)) this.load.image(spec.textureKey, spec.url);
    }
  };

  // Keep the exact hit artwork owned by the attacker. This outer context is stack-safe and
  // intentionally wraps the 2.13.5 source-identity patch instead of replacing combat logic.
  const originalBasic = sceneProto.performBasicAttack;
  if (typeof originalBasic === 'function') {
    sceneProto.performBasicAttack = async function combat2140Basic(this: any, actor: any, target: any): Promise<void> {
      const previous = this[ACTION_ELEMENT];
      this[ACTION_ELEMENT] = String(actor?.pow?.elementKey || actor?.pow?.element || '');
      try { await originalBasic.call(this, actor, target); }
      finally {
        if (previous === undefined) delete this[ACTION_ELEMENT];
        else this[ACTION_ELEMENT] = previous;
      }
    };
  }

  const originalAbility = sceneProto.performAbility;
  if (typeof originalAbility === 'function') {
    sceneProto.performAbility = async function combat2140Ability(this: any, actor: any, target: any, slot: 0 | 1 | 'ultimate'): Promise<void> {
      const previous = this[ACTION_ELEMENT];
      this[ACTION_ELEMENT] = String(actor?.pow?.elementKey || actor?.pow?.element || '');
      try { await originalAbility.call(this, actor, target, slot); }
      finally {
        if (previous === undefined) delete this[ACTION_ELEMENT];
        else this[ACTION_ELEMENT] = previous;
      }
    };
  }

  const powProto = PowViewClass.prototype as any;

  const previousCast = powProto.playCastSignature;
  powProto.playCastSignature = async function combat2140Cast(this: any, support: boolean): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const spec = support ? EXACT_STATUS_VFX.heal : exactElementVfx(ownElement(this));
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousCast === 'function') await previousCast.call(this, support);
      return;
    }
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const fx = addExactImage(scene, spec, p.x, p.y - 5, 35, support ? 0.62 : 0.58, support ? 0.86 : 0.9);
    if (!fx) return;
    await tween(scene, {
      targets: fx,
      scaleX: fx.scaleX * (reducedMotion() ? 1.18 : 1.62),
      scaleY: fx.scaleY * (reducedMotion() ? 1.18 : 1.62),
      alpha: 0,
      duration: reducedMotion() ? 120 : tier() === 'lite' ? 145 : 220,
      ease: 'Quad.easeOut'
    });
    fx.destroy();
  };

  const previousImpact = powProto.playElementImpact;
  powProto.playElementImpact = async function combat2140Impact(this: any, x: number, y: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const spec = exactElementVfx(ownElement(this));
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousImpact === 'function') await previousImpact.call(this, x, y);
      return;
    }
    const primary = addExactImage(scene, spec, x, y, 39, 0.78, 1);
    if (!primary) return;
    const secondary = tier() === 'full' ? addExactImage(scene, spec, x, y, 38, 0.52, 0.36) : null;
    if (secondary) secondary.setRotation(0.2);
    await Promise.all([
      tween(scene, {
        targets: primary,
        scaleX: primary.scaleX * (reducedMotion() ? 1.25 : 1.75),
        scaleY: primary.scaleY * (reducedMotion() ? 1.25 : 1.75),
        alpha: 0,
        duration: reducedMotion() ? 115 : tier() === 'lite' ? 145 : 220,
        ease: 'Quad.easeOut'
      }),
      secondary ? tween(scene, {
        targets: secondary,
        scaleX: secondary.scaleX * 1.48,
        scaleY: secondary.scaleY * 1.48,
        rotation: secondary.rotation - 0.28,
        alpha: 0,
        duration: 245,
        ease: 'Sine.easeOut'
      }) : Promise.resolve()
    ]);
    primary.destroy();
    secondary?.destroy();
  };

  const previousTravel = powProto.playElementTravel;
  powProto.playElementTravel = async function combat2140Travel(this: any, targetX: number, targetY: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const spec = exactElementVfx(ownElement(this));
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousTravel === 'function') await previousTravel.call(this, targetX, targetY);
      return;
    }
    const start = this.getWorldPosition() as Phaser.Math.Vector2;
    const fx = addExactImage(scene, spec, start.x, start.y - 2, 37, 0.4, 0.82);
    if (!fx) return;
    fx.setRotation(Math.atan2(targetY - start.y, targetX - start.x));
    await tween(scene, {
      targets: fx,
      x: targetX,
      y: targetY,
      scaleX: fx.scaleX * 1.1,
      scaleY: fx.scaleY * 1.1,
      alpha: 0.94 * qualityAlpha(),
      duration: reducedMotion() ? 120 : tier() === 'lite' ? 145 : 205,
      ease: 'Quad.easeIn'
    });
    fx.destroy();
    await this.playElementImpact(targetX, targetY);
  };

  const previousHitFlash = powProto.playHitFlash;
  powProto.playHitFlash = function combat2140HitFlash(this: any): void {
    const scene = this.scene as any;
    const element = String(scene[ACTION_ELEMENT] || ownElement(this));
    const spec = exactElementVfx(element);
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousHitFlash === 'function') previousHitFlash.call(this);
      return;
    }
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    if (this.portrait?.active) {
      this.portrait.setTintFill(0xffffff);
      scene.time.delayedCall(reducedMotion() ? 48 : 78, () => {
        if (this.portrait?.active) this.portrait.clearTint();
      });
    }
    const fx = addExactImage(scene, spec, p.x, p.y - 5, 40, 0.5, 0.92);
    if (!fx) return;
    scene.tweens.add({
      targets: fx,
      scaleX: fx.scaleX * (reducedMotion() ? 1.28 : 1.72),
      scaleY: fx.scaleY * (reducedMotion() ? 1.28 : 1.72),
      alpha: 0,
      duration: reducedMotion() ? 95 : 165,
      ease: 'Quad.easeOut',
      onComplete: () => fx.destroy()
    });
  };

  const previousSupport = powProto.playSupportAura;
  powProto.playSupportAura = async function combat2140Support(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const spec = EXACT_STATUS_VFX.heal;
    if (!scene.textures.exists(spec.textureKey)) {
      if (typeof previousSupport === 'function') await previousSupport.call(this);
      return;
    }
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const fx = addExactImage(scene, spec, p.x, p.y + 10, 35, 0.72, 0.76);
    if (!fx) return;
    await tween(scene, {
      targets: fx,
      y: p.y - 14,
      scaleX: fx.scaleX * 1.45,
      scaleY: fx.scaleY * 1.45,
      alpha: 0,
      duration: reducedMotion() ? 145 : 270,
      ease: 'Sine.easeOut'
    });
    fx.destroy();
  };

  const previousControl = powProto.playControlLock;
  powProto.playControlLock = async function combat2140Control(this: any, status: string): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const spec = exactStatusVfx(status);
    if (!spec || (spec !== EXACT_STATUS_VFX.freeze && spec !== EXACT_STATUS_VFX.stun) || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousControl === 'function') await previousControl.call(this, status);
      return;
    }
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const fx = addExactImage(scene, spec, p.x, p.y - 7, 42, 0.82, 0.86);
    const startX = this.container.x;
    const jobs: Promise<void>[] = [tween(scene, {
      targets: this.container,
      x: startX + 6,
      duration: 70,
      yoyo: true,
      repeat: reducedMotion() ? 0 : 2,
      ease: 'Sine.easeInOut'
    })];
    if (fx) jobs.push(tween(scene, {
      targets: fx,
      scaleX: fx.scaleX * 1.32,
      scaleY: fx.scaleY * 1.32,
      alpha: 0,
      duration: reducedMotion() ? 175 : 325,
      ease: 'Quad.easeOut'
    }));
    await Promise.all(jobs);
    this.container.setX(startX);
    fx?.destroy();
  };

  const previousResourcePulse = powProto.playResourcePulse;
  powProto.playResourcePulse = function combat2140ResourcePulse(this: any, color: number): void {
    const scene = this.scene as Phaser.Scene;
    const spec = color === 0x73f0aa ? EXACT_STATUS_VFX.heal : color === 0x8edfff ? EXACT_STATUS_VFX.shield : null;
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousResourcePulse === 'function') previousResourcePulse.call(this, color);
      return;
    }
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const fx = addExactImage(scene, spec, p.x, p.y, 41, 0.58, 0.64);
    if (!fx) return;
    scene.tweens.add({
      targets: fx,
      scaleX: fx.scaleX * 1.55,
      scaleY: fx.scaleY * 1.55,
      alpha: 0,
      duration: reducedMotion() ? 120 : 225,
      ease: 'Quad.easeOut',
      onComplete: () => fx.destroy()
    });
  };

  const previousShieldBreak = powProto.playShieldBreak;
  powProto.playShieldBreak = function combat2140ShieldBreak(this: any): void {
    const scene = this.scene as Phaser.Scene;
    const spec = EXACT_STATUS_VFX.shield;
    if (!scene.textures.exists(spec.textureKey)) {
      if (typeof previousShieldBreak === 'function') previousShieldBreak.call(this);
      return;
    }
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const fx = addExactImage(scene, spec, p.x, p.y, 43, 0.76, 0.9);
    if (!fx) return;
    scene.tweens.add({
      targets: fx,
      scaleX: fx.scaleX * 1.7,
      scaleY: fx.scaleY * 1.7,
      angle: reducedMotion() ? 0 : 5,
      alpha: 0,
      duration: reducedMotion() ? 135 : 230,
      ease: 'Quad.easeOut',
      onComplete: () => fx.destroy()
    });
  };

  const previousUpdateRuntime = powProto.updateRuntime;
  if (typeof previousUpdateRuntime === 'function') {
    powProto.updateRuntime = function combat2140Runtime(this: any, unit: any): void {
      previousUpdateRuntime.call(this, unit);
      const scene = this.scene as Phaser.Scene;
      const spec = runtimeStatusSpec(this.runtimeVisualStatus);
      const exactActive = Boolean(spec && unit?.alive && unit?.fieldSlot !== null && scene.textures.exists(spec.textureKey));
      if (!exactActive || !spec) {
        const current = this[PERSISTENT_FX] as Phaser.GameObjects.Image | undefined;
        current?.setVisible(false);
        return;
      }

      const oldAtlas = this.__atlasPersistent2132 as Phaser.GameObjects.Image | undefined;
      oldAtlas?.setVisible(false);

      let fx = this[PERSISTENT_FX] as Phaser.GameObjects.Image | undefined;
      if (!fx || !fx.scene) {
        fx = scene.add.image(0, 0, spec.textureKey)
          .setDepth(33)
          .setBlendMode(Phaser.BlendModes.ADD);
        this[PERSISTENT_FX] = fx;
        if (!this[PERSISTENT_CLEANUP]) {
          this[PERSISTENT_CLEANUP] = true;
          const cleanup = (): void => clearPersistent(this);
          scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
          scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
        }
      }

      const p = this.getWorldPosition() as Phaser.Math.Vector2;
      const sizeFactor = tier() === 'lite' ? 0.68 : tier() === 'balanced' ? 0.78 : 0.86;
      const alphaFactor = tier() === 'lite' ? 0.3 : tier() === 'balanced' ? 0.38 : 0.46;
      fx.setTexture(spec.textureKey)
        .setPosition(p.x, p.y - 4)
        .setDisplaySize(spec.displaySize * sizeFactor, spec.displaySize * sizeFactor)
        .setAlpha(spec.alpha * alphaFactor)
        .setVisible(true);
    };
  }

  const presentationProto = CombatPresentationDirectorClass.prototype as any;
  const previousSkillIntro = presentationProto.playSkillIntro;
  presentationProto.playSkillIntro = async function combat2140SkillIntro(
    actorView: any,
    targetView: any,
    ability: CombatAbility,
    slot: 0 | 1,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!actorView) return;
    const scene = this.scene as Phaser.Scene;
    const spec = abilitySpec(ability, elementKey);
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousSkillIntro === 'function') await previousSkillIntro.call(this, actorView, targetView, ability, slot, elementKey, selfTargeted);
      return;
    }
    const actor = actorView.getWorldPosition() as Phaser.Math.Vector2;
    const targetVisible = Boolean(targetView?.container?.visible);
    const target = targetVisible && targetView ? targetView.getWorldPosition() as Phaser.Math.Vector2 : actor;
    const cast = addExactImage(scene, spec, actor.x, actor.y - 10, 59, slot === 0 ? 0.62 : 0.72, slot === 0 ? 0.82 : 0.92);
    if (!cast) return;
    const jobs: Promise<void>[] = [tween(scene, {
      targets: cast,
      scaleX: cast.scaleX * (reducedMotion() ? 1.16 : 1.58),
      scaleY: cast.scaleY * (reducedMotion() ? 1.16 : 1.58),
      alpha: 0,
      duration: reducedMotion() ? 125 : slot === 0 ? 195 : 235,
      ease: 'Quad.easeOut'
    })];
    if (!selfTargeted && targetVisible && tier() !== 'lite') {
      const echo = addExactImage(scene, spec, actor.x, actor.y - 6, 58, tier() === 'full' ? 0.4 : 0.34, 0.48);
      if (echo) {
        echo.setRotation(Math.atan2(target.y - actor.y, target.x - actor.x));
        jobs.push(tween(scene, {
          targets: echo,
          x: target.x,
          y: target.y - 6,
          alpha: 0,
          duration: reducedMotion() ? 120 : slot === 0 ? 165 : 200,
          ease: 'Quad.easeIn'
        }).finally(() => echo.destroy()));
      }
    }
    await Promise.all(jobs);
    cast.destroy();
  };

  const previousUltimateIntro = presentationProto.playUltimateIntro;
  presentationProto.playUltimateIntro = async function combat2140UltimateIntro(
    actorView: any,
    ability: CombatAbility,
    side: CombatSide,
    elementKey: string
  ): Promise<void> {
    if (!actorView) return;
    const scene = this.scene as Phaser.Scene;
    const spec = exactElementVfx(elementKey);
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousUltimateIntro === 'function') await previousUltimateIntro.call(this, actorView, ability, side, elementKey);
      return;
    }

    const width = scene.scale.width;
    const height = scene.scale.height;
    const actor = actorView.getWorldPosition() as Phaser.Math.Vector2;
    const portraitLayout = height > width;
    const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x02070d, 0.54).setDepth(70).setAlpha(0);
    const focus = addExactImage(scene, spec, actor.x, actor.y - 6, 72, tier() === 'lite' ? 1 : 1.25, 0.94);

    const bannerY = Math.round(height * (portraitLayout ? 0.47 : 0.43));
    const bannerWidth = Math.min(portraitLayout ? 720 : 760, width * (portraitLayout ? 0.8 : 0.52));
    const bannerHeight = portraitLayout ? 136 : 128;
    const banner = scene.add.container(width / 2, bannerY).setDepth(76).setAlpha(0).setScale(0.95);
    const plate = scene.add.rectangle(0, 0, bannerWidth, bannerHeight, 0x07131d, 0.985).setStrokeStyle(3, 0xffd36a, 0.92);
    const rail = scene.add.rectangle(side === 'player' ? -bannerWidth / 2 + 6 : bannerWidth / 2 - 6, 0, 9, bannerHeight - 12, side === 'player' ? 0x6fe7ff : 0xffa47c, 0.95);
    const iconX = -bannerWidth / 2 + 76;
    const iconPlate = scene.add.rectangle(iconX, 0, 94, 94, 0x030a10, 0.95).setStrokeStyle(2, 0xffd36a, 0.78);
    const icon = ability.iconKey && scene.textures.exists(ability.iconKey)
      ? scene.add.image(iconX, 0, ability.iconKey).setDisplaySize(84, 84)
      : scene.add.text(iconX, 0, '✦', { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '48px', color: '#ffd36a' }).setOrigin(0.5);
    const textX = -bannerWidth / 2 + 142;
    const textWidth = Math.max(300, bannerWidth - 168);
    const label = scene.add.text(textX, -40, 'TUYỆT KỸ', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: portraitLayout ? '20px' : '19px', color: '#ffd36a', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0, 0.5);
    const name = scene.add.text(textX, 4, shortName(ability.name, portraitLayout ? 30 : 36).toUpperCase(), {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: portraitLayout ? '29px' : '30px', color: '#fff8e7', fontStyle: 'bold', fixedWidth: textWidth, wordWrap: { width: textWidth }
    }).setOrigin(0, 0.5);
    const sub = scene.add.text(textX, 45, side === 'player' ? 'POW CỦA BẠN' : 'POW ĐỐI THỦ', {
      fontFamily: COMBAT_BODY_FONT, fontSize: '15px', color: side === 'player' ? '#8eeaff' : '#ffb18d', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    banner.add([plate, rail, iconPlate, icon, label, name, sub]);

    if (!reducedMotion()) scene.cameras.main.flash(105, 255, 232, 178, false);
    const hold = reducedMotion() ? 620 : 1500;
    const jobs: Promise<void>[] = [
      tween(scene, { targets: overlay, alpha: 1, duration: 220, yoyo: true, hold, ease: 'Sine.easeOut' }),
      tween(scene, { targets: banner, alpha: 1, scaleX: 1, scaleY: 1, duration: 260, yoyo: true, hold, ease: 'Quad.easeOut' })
    ];
    if (focus) jobs.push(tween(scene, {
      targets: focus,
      scaleX: focus.scaleX * (reducedMotion() ? 1.18 : 1.58),
      scaleY: focus.scaleY * (reducedMotion() ? 1.18 : 1.58),
      alpha: 0,
      angle: reducedMotion() ? 0 : 4,
      duration: reducedMotion() ? 720 : 1760,
      ease: 'Quad.easeOut'
    }));
    await Promise.all(jobs);
    overlay.destroy();
    banner.destroy(true);
    focus?.destroy();
  };

  const previousUltimateImpact = presentationProto.playUltimateImpact;
  presentationProto.playUltimateImpact = async function combat2140UltimateImpact(
    targetView: any,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!targetView) return;
    const scene = this.scene as Phaser.Scene;
    const spec = selfTargeted ? EXACT_STATUS_VFX.heal : exactElementVfx(elementKey);
    if (!spec || !scene.textures.exists(spec.textureKey)) {
      if (typeof previousUltimateImpact === 'function') await previousUltimateImpact.call(this, targetView, elementKey, selfTargeted);
      return;
    }
    const p = targetView.getWorldPosition() as Phaser.Math.Vector2;
    const primary = addExactImage(scene, spec, p.x, p.y - 8, 73, tier() === 'full' ? 1.24 : 1.02, selfTargeted ? 0.8 : 1);
    if (!primary) return;
    if (!reducedMotion() && !selfTargeted) scene.cameras.main.shake(105, 0.0018);
    const secondary = tier() === 'full' ? addExactImage(scene, spec, p.x, p.y - 8, 72, 0.78, selfTargeted ? 0.3 : 0.42) : null;
    if (secondary) secondary.setRotation(0.2);
    await Promise.all([
      tween(scene, {
        targets: primary,
        scaleX: primary.scaleX * (reducedMotion() ? 1.2 : 1.65),
        scaleY: primary.scaleY * (reducedMotion() ? 1.2 : 1.65),
        alpha: 0,
        duration: reducedMotion() ? 150 : 280,
        ease: 'Quad.easeOut'
      }),
      secondary ? tween(scene, {
        targets: secondary,
        scaleX: secondary.scaleX * 1.55,
        scaleY: secondary.scaleY * 1.55,
        rotation: secondary.rotation - 0.3,
        alpha: 0,
        duration: 310,
        ease: 'Sine.easeOut'
      }) : Promise.resolve()
    ]);
    primary.destroy();
    secondary?.destroy();
  };

  root.POWDER_COMBAT2_EXACT_VFX = {
    version: '2.14.0',
    mode: 'img-img2-exact-element-and-status-replacement',
    exactElements: ['wind', 'lightning', 'lava', 'storm', 'ice', 'poison', 'light', 'dark'],
    baseAtlasExactElements: ['fire', 'steel', 'water', 'leaf', 'earth'],
    exactStatuses: ['burn', 'freeze', 'stun', 'heal', 'shield'],
    temporaryFamilyElementFallbacks: [],
    sourceLibraries: ['img', 'img2'],
    rules: ['asset-first', 'source-owned-impact', 'no-primary-geometric-vfx', 'adaptive-full-balanced-lite', 'no-combat-logic-change']
  };
}
