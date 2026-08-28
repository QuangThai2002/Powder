import Phaser from 'phaser';

const PATCH_FLAG = '__powderCombat2122CinematicMotionInstalled';

type FxTier = 'full' | 'balanced' | 'lite';

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function world(view: any): Phaser.Math.Vector2 {
  try { return view.getWorldPosition(); }
  catch { return new Phaser.Math.Vector2(view?.container?.x || 0, view?.container?.y || 0); }
}

function portraitSnapshot(view: any, alpha: number, depth: number): Phaser.GameObjects.Image | null {
  const scene = view?.scene as Phaser.Scene | undefined;
  const portrait = view?.portrait as Phaser.GameObjects.Image | undefined;
  const container = view?.container as Phaser.GameObjects.Container | undefined;
  if (!scene || !portrait || !container || !portrait.texture?.key) return null;
  const p = world(view);
  const ghost = scene.add.image(
    p.x + Number(portrait.x || 0) * Number(container.scaleX || 1),
    p.y + Number(portrait.y || 0) * Number(container.scaleY || 1),
    portrait.texture.key,
    portrait.frame?.name
  );
  ghost.setDepth(depth).setAlpha(alpha).setRotation(Number(container.rotation || 0) + Number(portrait.rotation || 0));
  ghost.setScale(
    Number(portrait.scaleX || 1) * Number(container.scaleX || 1),
    Number(portrait.scaleY || 1) * Number(container.scaleY || 1)
  );
  if (portrait.flipX) ghost.setFlipX(true);
  if (portrait.flipY) ghost.setFlipY(true);
  return ghost;
}

function fadeGhost(scene: Phaser.Scene, ghost: Phaser.GameObjects.Image | null, dx: number, dy: number, duration: number): void {
  if (!ghost) return;
  scene.tweens.add({
    targets: ghost,
    x: ghost.x + dx,
    y: ghost.y + dy,
    alpha: 0,
    scaleX: ghost.scaleX * 1.035,
    scaleY: ghost.scaleY * 1.035,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => ghost.destroy()
  });
}

function spawnMotionEchoes(view: any, targetX: number, targetY: number): void {
  if (reducedMotion() || tier() === 'lite') return;
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const p = world(view);
  const dx = targetX - p.x;
  const dy = targetY - p.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const count = tier() === 'full' ? 3 : 2;
  for (let i = 0; i < count; i += 1) {
    const ghost = portraitSnapshot(view, 0.18 - i * 0.035, 54 - i);
    if (!ghost) continue;
    ghost.x -= ux * (14 + i * 12);
    ghost.y -= uy * (14 + i * 12);
    fadeGhost(scene, ghost, -ux * (10 + i * 6), -uy * (10 + i * 6), 150 + i * 35);
  }
}

function focusCamera(scene: Phaser.Scene, view: any, strength = 1): void {
  if (reducedMotion()) return;
  const p = world(view);
  const camera = scene.cameras.main;
  const baseZoom = camera.zoom;
  const zoomDelta = tier() === 'full' ? 0.018 * strength : 0.01 * strength;
  camera.pan(p.x, p.y, 80, 'Quad.easeOut', false);
  scene.tweens.add({
    targets: camera,
    zoom: baseZoom + zoomDelta,
    duration: 80,
    yoyo: true,
    hold: 25,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      camera.setZoom(baseZoom);
      camera.centerOn(scene.scale.width / 2, scene.scale.height / 2);
    }
  });
}

function installPowMotion(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const originalAttack = proto.playAttackLunge;
  const originalHit = proto.playHit;
  const originalStatus = proto.playStatusPulse;
  const originalEnter = proto.enterField;
  const originalRetire = proto.retireFromField;

  if (typeof originalAttack === 'function') {
    proto.playAttackLunge = async function combat2122Attack(this: any, targetX: number, targetY: number): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      focusCamera(scene, this, 0.9);
      spawnMotionEchoes(this, targetX, targetY);
      await originalAttack.call(this, targetX, targetY);
    };
  }

  if (typeof originalHit === 'function') {
    proto.playHit = async function combat2122Hit(this: any): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const before = portraitSnapshot(this, tier() === 'lite' ? 0.1 : 0.2, 76);
      if (before) fadeGhost(scene, before, this.side === 'player' ? -9 : 9, -2, reducedMotion() ? 80 : 145);
      await originalHit.call(this);
    };
  }

  if (typeof originalStatus === 'function') {
    proto.playStatusPulse = async function combat2122Status(this: any): Promise<void> {
      focusCamera(this.scene as Phaser.Scene, this, 0.45);
      await originalStatus.call(this);
    };
  }

  if (typeof originalEnter === 'function') {
    proto.enterField = async function combat2122Enter(this: any, x: number, y: number): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const result = Promise.resolve(originalEnter.call(this, x, y));
      if (!reducedMotion()) {
        scene.time.delayedCall(45, () => {
          const count = tier() === 'full' ? 3 : 2;
          for (let i = 0; i < count; i += 1) {
            const ghost = portraitSnapshot(this, 0.14 - i * 0.025, 53 - i);
            if (ghost) fadeGhost(scene, ghost, 0, 18 + i * 8, 170 + i * 40);
          }
        });
      }
      await result;
    };
  }

  if (typeof originalRetire === 'function') {
    proto.retireFromField = async function combat2122Retire(this: any, x: number, y: number): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      if (!reducedMotion()) {
        const count = tier() === 'full' ? 4 : 2;
        for (let i = 0; i < count; i += 1) {
          const ghost = portraitSnapshot(this, 0.16 - i * 0.025, 55 - i);
          if (ghost) fadeGhost(scene, ghost, (i % 2 ? 1 : -1) * (8 + i * 5), -16 - i * 7, 180 + i * 38);
        }
      }
      await originalRetire.call(this, x, y);
    };
  }
}

function installTargetPolish(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const original = proto.setTargetable;
  if (typeof original !== 'function') return;
  proto.setTargetable = function combat2122Targetable(this: any, active: boolean): void {
    original.call(this, active);
    const portrait = this.portrait as Phaser.GameObjects.Image | undefined;
    if (!portrait) return;
    if (active) {
      portrait.setAlpha(1);
      if (!reducedMotion()) {
        this.scene.tweens.killTweensOf(portrait);
        this.scene.tweens.add({ targets: portrait, alpha: { from: 0.82, to: 1 }, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } else {
      this.scene.tweens.killTweensOf(portrait);
      portrait.setAlpha(1);
    }
  };
}

export function installCombat2122CinematicMotionPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installPowMotion(PowViewClass);
  installTargetPolish(PowViewClass);
  root.POWDER_COMBAT2_CINEMATIC_MOTION = {
    version: '2.12.2',
    mode: 'asset-led-pow-motion',
    proceduralElementIcons: false,
    rules: ['reuse-pow-art', 'camera-micro-focus', 'motion-echoes', 'adaptive-fx', 'no-combat-logic-change']
  };
}
