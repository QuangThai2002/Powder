import Phaser from 'phaser';

const FLAG = '__powderCombat2146DirectionalWindProjectileInstalled';
const VERSION = '2.14.6';

function plain(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isWind(view: any): boolean {
  const text = plain(`${view?.pow?.elementKey || ''} ${view?.pow?.element || ''}`);
  return text.includes('wind') || text.includes('gio');
}

function worldPosition(view: any): Phaser.Math.Vector2 {
  try { return view.getWorldPosition() as Phaser.Math.Vector2; }
  catch { return new Phaser.Math.Vector2(view?.container?.x || 0, view?.container?.y || 0); }
}

function colorOf(view: any): number {
  try {
    const value = Number(view.elementColor?.());
    if (Number.isFinite(value)) return value;
  } catch { /* presentation fallback */ }
  return 0x9cf5d7;
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));
}

export function installCombat2146DirectionalWindProjectilePatch(PowViewClass: any): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const proto = PowViewClass.prototype as any;
  const previousTravel = proto.playElementTravel;
  if (typeof previousTravel !== 'function') return;

  proto.playElementTravel = async function combat2146DirectionalWindTravel(this: any, targetX: number, targetY: number): Promise<void> {
    if (!isWind(this)) {
      await previousTravel.call(this, targetX, targetY);
      return;
    }

    const scene = this.scene as Phaser.Scene;
    const reducedMotion = Boolean(this.reducedMotion);
    const color = colorOf(this);
    const start = worldPosition(this);
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const angle = Math.atan2(dy, dx);

    // Local +X is the projectile nose. Rotating the whole container by atan2
    // makes the wind arrow point toward the real target in every direction.
    const projectile = scene.add.container(start.x, start.y - 4)
      .setDepth(126)
      .setRotation(angle)
      .setScale(0.28)
      .setAlpha(0.98);

    const gust = scene.add.graphics();
    gust.fillStyle(color, 0.22);
    gust.fillTriangle(-115, -30, 48, 0, -115, 30);
    gust.fillStyle(0xffffff, 0.92);
    gust.fillTriangle(-4, -20, 68, 0, -4, 20);
    gust.lineStyle(7, color, 0.86);
    gust.beginPath();
    gust.moveTo(-122, -24);
    gust.lineTo(28, -8);
    gust.lineTo(68, 0);
    gust.lineTo(28, 8);
    gust.lineTo(-122, 24);
    gust.strokePath();

    const trailFar = scene.add.ellipse(-108, 0, 150, 28, color, 0.10);
    const trailMid = scene.add.ellipse(-72, 0, 108, 34, color, 0.20);
    const core = scene.add.ellipse(8, 0, 70, 32, 0xffffff, 0.35).setStrokeStyle(3, color, 0.72);
    const streakA = scene.add.rectangle(-72, -27, 112, 5, 0xffffff, 0.56);
    const streakB = scene.add.rectangle(-92, 28, 92, 4, color, 0.66);
    projectile.add([trailFar, trailMid, gust, core, streakA, streakB]);

    const guide = scene.add.graphics().setDepth(111).setAlpha(0.5);
    guide.lineStyle(4, color, 0.14).lineBetween(start.x, start.y - 4, targetX, targetY - 4);

    // Make the source readable before launch.
    await tween(scene, {
      targets: projectile,
      scaleX: 1,
      scaleY: 1,
      duration: reducedMotion ? 110 : 210,
      ease: 'Back.easeOut'
    });

    const breathe = scene.tweens.add({
      targets: core,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0.16,
      duration: reducedMotion ? 120 : 190,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    await Promise.all([
      tween(scene, {
        targets: projectile,
        x: targetX,
        y: targetY - 4,
        duration: reducedMotion ? 410 : 700,
        ease: 'Sine.easeInOut'
      }),
      tween(scene, {
        targets: guide,
        alpha: 0,
        duration: reducedMotion ? 420 : 730,
        ease: 'Quad.easeOut'
      })
    ]);

    breathe.stop();
    projectile.destroy(true);
    guide.destroy();

    // Reuse the stable 2.14.5 impact instead of introducing another risk surface.
    await this.playElementImpact(targetX, targetY, color);
  };

  root.POWDER_COMBAT2_RUNTIME_VERSION = VERSION;
  root.POWDER_COMBAT2_WIND_DIRECTION = {
    version: VERSION,
    directional: true,
    rotation: 'atan2(source,target)',
    travelMs: 700,
    fallbackTo2145: true
  };
}
