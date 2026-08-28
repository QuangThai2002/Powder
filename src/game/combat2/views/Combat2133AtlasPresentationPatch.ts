import Phaser from 'phaser';
import type { CombatAbility, CombatSide } from '../data/CombatPow';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2133AtlasPresentationInstalled';
const ATLAS_KEY = 'combat-vfx-atlas-a';

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

function frameForElement(value: unknown): number {
  const key = norm(value);
  if (key.includes('lua') || key.includes('fire') || key.includes('dung nham') || key.includes('lava')) return 0;
  if (key.includes('thep') || key.includes('steel') || key.includes('set') || key.includes('lightning') || key.includes('electric') || key.includes('anh sang') || key.includes('light')) return 1;
  if (key.includes('nuoc') || key.includes('water') || key.includes('bang') || key.includes('ice') || key.includes('bao') || key.includes('storm')) return 2;
  if (key.includes('la') || key.includes('leaf') || key.includes('nature') || key.includes('doc') || key.includes('poison') || key.includes('gio') || key.includes('wind')) return 3;
  return 4;
}

function atlasImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frame: number,
  depth: number,
  baseScale = 1,
  alpha = 0.9
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(ATLAS_KEY)) return null;
  const quality = tier();
  const qualityScale = quality === 'lite' ? 0.72 : quality === 'balanced' ? 0.86 : 1;
  const qualityAlpha = quality === 'lite' ? 0.72 : quality === 'balanced' ? 0.86 : 1;
  return scene.add.image(x, y, ATLAS_KEY, frame)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(baseScale * qualityScale)
    .setAlpha(alpha * qualityAlpha);
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

function shortName(value: unknown, maxLength: number): string {
  const clean = String(value || '').trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

export function installCombat2133AtlasPresentationPatch(CombatPresentationDirectorClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = CombatPresentationDirectorClass.prototype as any;

  proto.playSkillIntro = async function combat2133SkillIntro(
    actorView: any,
    targetView: any,
    _ability: CombatAbility,
    slot: 0 | 1,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!actorView) return;
    const scene = this.scene as Phaser.Scene;
    const actor = actorView.getWorldPosition() as Phaser.Math.Vector2;
    const targetVisible = Boolean(targetView?.container?.visible);
    const target = targetVisible && targetView ? targetView.getWorldPosition() as Phaser.Math.Vector2 : actor;
    const frame = frameForElement(elementKey);
    const cast = atlasImage(scene, actor.x, actor.y - 10, frame, 58, slot === 0 ? 0.48 : 0.58, slot === 0 ? 0.72 : 0.82);
    if (!cast) return;

    const jobs: Promise<void>[] = [tween(scene, {
      targets: cast,
      scaleX: cast.scaleX * (reducedMotion() ? 1.18 : 1.72),
      scaleY: cast.scaleY * (reducedMotion() ? 1.18 : 1.72),
      alpha: 0,
      duration: reducedMotion() ? 130 : slot === 0 ? 205 : 250,
      ease: 'Quad.easeOut'
    })];

    // Source -> target is represented by the actual elemental artwork travelling across the arena.
    // No procedural line/ring is used as the primary skill telegraph.
    if (!selfTargeted && targetVisible && tier() !== 'lite') {
      const echo = atlasImage(scene, actor.x, actor.y - 6, frame, 57, tier() === 'full' ? 0.31 : 0.27, 0.46);
      if (echo) {
        const dx = target.x - actor.x;
        const dy = target.y - actor.y;
        echo.setRotation(Math.atan2(dy, dx));
        jobs.push(tween(scene, {
          targets: echo,
          x: target.x,
          y: target.y - 6,
          scaleX: echo.scaleX * 1.14,
          scaleY: echo.scaleY * 1.14,
          alpha: 0,
          duration: reducedMotion() ? 125 : slot === 0 ? 170 : 205,
          ease: 'Quad.easeIn'
        }).finally(() => { if (echo.scene) echo.destroy(); }));
      }
    }

    await Promise.all(jobs);
    if (cast.scene) cast.destroy();
  };

  proto.playUltimateIntro = async function combat2133UltimateIntro(
    actorView: any,
    ability: CombatAbility,
    side: CombatSide,
    elementKey: string
  ): Promise<void> {
    if (!actorView) return;
    const scene = this.scene as Phaser.Scene;
    const width = scene.scale.width;
    const height = scene.scale.height;
    const actor = actorView.getWorldPosition() as Phaser.Math.Vector2;
    const portraitLayout = height > width;
    const frame = frameForElement(elementKey);

    // Rectangles below are presentation UI plates only. The magical focus itself is real VFX artwork.
    const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x02070d, 0.54).setDepth(70).setAlpha(0);
    const focus = atlasImage(scene, actor.x, actor.y - 6, frame, 72, tier() === 'lite' ? 0.88 : 1.06, 0.9);
    if (focus) focus.setScale(focus.scaleX * 0.72);

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
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: portraitLayout ? '20px' : '19px',
      color: '#ffd36a',
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0, 0.5);
    const name = scene.add.text(textX, 4, shortName(ability.name, portraitLayout ? 30 : 36).toUpperCase(), {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: portraitLayout ? '29px' : '30px',
      color: '#fff8e7',
      fontStyle: 'bold',
      fixedWidth: textWidth,
      wordWrap: { width: textWidth }
    }).setOrigin(0, 0.5);
    const sub = scene.add.text(textX, 45, side === 'player' ? 'POW CỦA BẠN' : 'POW ĐỐI THỦ', {
      fontFamily: COMBAT_BODY_FONT,
      fontSize: '15px',
      color: side === 'player' ? '#8eeaff' : '#ffb18d',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    banner.add([plate, rail, iconPlate, icon, label, name, sub]);

    if (!reducedMotion()) scene.cameras.main.flash(105, 255, 232, 178, false);
    const hold = reducedMotion() ? 620 : 1500;
    const jobs: Promise<void>[] = [
      tween(scene, { targets: overlay, alpha: 1, duration: 220, yoyo: true, hold, ease: 'Sine.easeOut' }),
      tween(scene, { targets: banner, alpha: 1, scaleX: 1, scaleY: 1, duration: 260, yoyo: true, hold, ease: 'Quad.easeOut' })
    ];
    if (focus) {
      jobs.push(tween(scene, {
        targets: focus,
        scaleX: focus.scaleX * (reducedMotion() ? 1.22 : 1.72),
        scaleY: focus.scaleY * (reducedMotion() ? 1.22 : 1.72),
        alpha: 0,
        angle: reducedMotion() ? 0 : 5,
        duration: reducedMotion() ? 760 : 1820,
        ease: 'Quad.easeOut'
      }));
    }
    await Promise.all(jobs);
    overlay.destroy();
    banner.destroy(true);
    if (focus?.scene) focus.destroy();
  };

  proto.playUltimateImpact = async function combat2133UltimateImpact(
    targetView: any,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!targetView) return;
    const scene = this.scene as Phaser.Scene;
    const p = targetView.getWorldPosition() as Phaser.Math.Vector2;
    const frame = selfTargeted ? 3 : frameForElement(elementKey);
    const primary = atlasImage(scene, p.x, p.y - 8, frame, 72, tier() === 'full' ? 1.12 : 0.94, selfTargeted ? 0.72 : 0.96);
    if (!primary) return;
    if (!reducedMotion() && !selfTargeted) scene.cameras.main.shake(105, 0.0018);

    const secondary = tier() === 'full'
      ? atlasImage(scene, p.x, p.y - 8, frame, 71, 0.7, selfTargeted ? 0.28 : 0.4)
      : null;
    if (secondary) secondary.setRotation(0.24);

    await Promise.all([
      tween(scene, {
        targets: primary,
        scaleX: primary.scaleX * (reducedMotion() ? 1.22 : 1.72),
        scaleY: primary.scaleY * (reducedMotion() ? 1.22 : 1.72),
        alpha: 0,
        duration: reducedMotion() ? 155 : 285,
        ease: 'Quad.easeOut'
      }),
      secondary ? tween(scene, {
        targets: secondary,
        scaleX: secondary.scaleX * 1.64,
        scaleY: secondary.scaleY * 1.64,
        rotation: secondary.rotation - 0.34,
        alpha: 0,
        duration: 320,
        ease: 'Sine.easeOut'
      }) : Promise.resolve()
    ]);
    if (primary.scene) primary.destroy();
    if (secondary?.scene) secondary.destroy();
  };

  root.POWDER_COMBAT2_PRESENTATION_VFX = {
    version: '2.13.3',
    mode: 'bundled-atlas-presentation-only',
    rules: [
      'no-procedural-skill-rings',
      'no-procedural-source-target-line',
      'no-procedural-ultimate-spotlight',
      'no-procedural-impact-rays',
      'ui-plates-only-may-use-geometry',
      'adaptive-full-balanced-lite'
    ]
  };
}
