import Phaser from 'phaser';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

const FLAG = '__powderCombat2145ReadableProjectileInstalled';
const VERSION = '2.14.5';

function worldPosition(view: any): Phaser.Math.Vector2 {
  try { return view.getWorldPosition() as Phaser.Math.Vector2; }
  catch { return new Phaser.Math.Vector2(view?.container?.x || 0, view?.container?.y || 0); }
}

function projectileColor(view: any): number {
  try {
    const color = Number(view.elementColor?.());
    if (Number.isFinite(color)) return color;
  } catch { /* presentation fallback */ }
  return 0x79e7ff;
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });
}

async function readableImpact(scene: Phaser.Scene, x: number, y: number, color: number, reducedMotion: boolean): Promise<void> {
  const burst = scene.add.container(x, y - 4).setDepth(122).setScale(0.56);
  const glow = scene.add.circle(0, 0, 64, color, 0.12);
  const outer = scene.add.circle(0, 0, 48, 0x000000, 0).setStrokeStyle(7, color, 0.86);
  const middle = scene.add.circle(0, 0, 32, color, 0.35).setStrokeStyle(4, 0xffffff, 0.78);
  const core = scene.add.circle(0, 0, 18, 0xffffff, 0.98).setStrokeStyle(4, color, 1);
  const shardA = scene.add.rectangle(0, -58, 9, 42, color, 0.82);
  const shardB = scene.add.rectangle(0, 58, 9, 42, color, 0.82);
  const shardC = scene.add.rectangle(-58, 0, 42, 9, color, 0.82);
  const shardD = scene.add.rectangle(58, 0, 42, 9, color, 0.82);
  burst.add([glow, outer, middle, core, shardA, shardB, shardC, shardD]);

  if (!reducedMotion) scene.cameras.main.shake(145, 0.0018);
  await tween(scene, {
    targets: burst,
    scaleX: reducedMotion ? 1.25 : 1.72,
    scaleY: reducedMotion ? 1.25 : 1.72,
    alpha: 0,
    duration: reducedMotion ? 230 : 420,
    ease: 'Cubic.easeOut'
  });
  burst.destroy(true);
}

export function installCombat2145ReadableProjectilePatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const battle = BattleSceneClass.prototype as any;
  const previousCreate = battle.create;
  battle.create = function combat2145ProjectileCreate(this: Phaser.Scene & any, ...args: any[]): any {
    const result = previousCreate?.apply(this, args);
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      this.add.text(this.scale.width - 18, this.scale.height - 18, `${VERSION} · LARGE PROJECTILE TEST`, {
        fontFamily: COMBAT_DISPLAY_FONT,
        fontSize: '12px',
        color: '#bff7ff',
        fontStyle: 'bold',
        backgroundColor: '#041018dd',
        padding: { x: 7, y: 4 }
      }).setOrigin(1, 1).setDepth(160);
    }
    return result;
  };

  const proto = PowViewClass.prototype as any;
  proto.playElementTravel = async function combat2145ReadableTravel(this: any, targetX: number, targetY: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const reducedMotion = Boolean(this.reducedMotion);
    const color = projectileColor(this);
    const start = worldPosition(this);
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const angle = Math.atan2(dy, dx);

    // A subtle path guide makes source -> target readable without becoming the main VFX.
    const guide = scene.add.graphics().setDepth(108).setAlpha(0.55);
    guide.lineStyle(5, color, 0.18).lineBetween(start.x, start.y - 4, targetX, targetY - 4);

    const projectile = scene.add.container(start.x, start.y - 4).setDepth(118).setRotation(angle).setScale(0.3);
    const tailFar = scene.add.ellipse(-68, 0, 112, 20, color, 0.16);
    const tailNear = scene.add.ellipse(-42, 0, 82, 27, color, 0.32);
    const halo = scene.add.circle(0, 0, 46, color, 0.14).setStrokeStyle(4, color, 0.48);
    const body = scene.add.circle(0, 0, 29, color, 0.62).setStrokeStyle(5, color, 0.96);
    const core = scene.add.circle(0, 0, 17, 0xffffff, 1).setStrokeStyle(4, color, 1);
    const sparkTop = scene.add.circle(-15, -22, 7, 0xffffff, 0.76);
    const sparkBottom = scene.add.circle(-18, 22, 6, color, 0.7);
    projectile.add([tailFar, tailNear, halo, body, core, sparkTop, sparkBottom]);

    // Charge at the attacker long enough for the player to notice who is firing.
    await tween(scene, {
      targets: projectile,
      scaleX: 1,
      scaleY: 1,
      duration: reducedMotion ? 120 : 240,
      ease: 'Back.easeOut'
    });

    const pulse = scene.tweens.add({
      targets: halo,
      scaleX: 1.28,
      scaleY: 1.28,
      alpha: 0.04,
      duration: reducedMotion ? 150 : 240,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    await Promise.all([
      tween(scene, {
        targets: projectile,
        x: targetX,
        y: targetY - 4,
        duration: reducedMotion ? 420 : 720,
        ease: 'Sine.easeInOut'
      }),
      tween(scene, {
        targets: guide,
        alpha: 0,
        duration: reducedMotion ? 430 : 760,
        ease: 'Quad.easeOut'
      })
    ]);

    pulse.stop();
    projectile.destroy(true);
    guide.destroy();
    await readableImpact(scene, targetX, targetY, color, reducedMotion);
  };

  // Keep impact readable even when another code path calls it directly.
  proto.playElementImpact = async function combat2145ReadableImpact(this: any, x: number, y: number, color?: number): Promise<void> {
    await readableImpact(this.scene as Phaser.Scene, x, y, Number.isFinite(color) ? Number(color) : projectileColor(this), Boolean(this.reducedMotion));
  };

  root.POWDER_COMBAT2_RUNTIME_VERSION = VERSION;
  root.POWDER_COMBAT2_PROJECTILE_TEST = {
    version: VERSION,
    mode: 'large-readable-projectile',
    chargeMs: 240,
    travelMs: 720,
    impactMs: 420,
    realSpriteVfxEnabled: false
  };
}
