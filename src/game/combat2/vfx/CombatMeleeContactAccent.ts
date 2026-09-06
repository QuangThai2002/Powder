import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2192_MELEE_CONTACT_ACCENT_VERSION = '2.19.2';

export type CombatMeleeContactRole = 'tank' | 'fighter' | 'knight' | 'assassin';
export type CombatMeleeContactTier = 'normal' | 'skill' | 'ultimate';

type Options = DirectionalProjectileOptions & { role?: string };
type Palette = { main: number; core: number; dark: number };

const ELEMENT: Readonly<Record<CombatProjectileElement, Palette>> = Object.freeze({
  fire: { main: 0xff7048, core: 0xffe2b5, dark: 0x6b281d },
  lava: { main: 0xf25635, core: 0xffcf62, dark: 0x612118 },
  water: { main: 0x48b9e8, core: 0xe9fbff, dark: 0x18566f },
  ice: { main: 0x86dcef, core: 0xffffff, dark: 0x327283 },
  lightning: { main: 0xe9d25b, core: 0xfffee0, dark: 0x756215 },
  storm: { main: 0x7794d0, core: 0xf0f4ff, dark: 0x3a4b70 },
  wind: { main: 0x66d5c1, core: 0xf0fffb, dark: 0x27665e },
  leaf: { main: 0x6acb7b, core: 0xf0ffe9, dark: 0x315e39 },
  poison: { main: 0x9bca61, core: 0xf5ffd8, dark: 0x4a6429 },
  earth: { main: 0xb98959, core: 0xffe5c1, dark: 0x5d452f },
  steel: { main: 0xbfced6, core: 0xffffff, dark: 0x53636b },
  light: { main: 0xe9d798, core: 0xfffff2, dark: 0x7d7041 },
  dark: { main: 0x9879cd, core: 0xf3ecff, dark: 0x49365f },
  neutral: { main: 0x93c6d0, core: 0xfbffff, dark: 0x3f5b62 }
});

function durationFor(tier: CombatMeleeContactTier, reducedMotion: boolean): number {
  if (reducedMotion) return tier === 'ultimate' ? 122 : tier === 'skill' ? 94 : 70;
  if (tier === 'ultimate') return 210;
  if (tier === 'skill') return 156;
  return 112;
}

function sizeFor(tier: CombatMeleeContactTier): number {
  if (tier === 'ultimate') return 76;
  if (tier === 'skill') return 57;
  return 42;
}

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: CombatTweenConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let activeTween: Phaser.Tweens.Tween | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (): void => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      try { activeTween?.stop(); } catch { /* scene cleanup */ }
      finish();
    };

    timer = setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      activeTween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

function drawTankStamp(graphics: Phaser.GameObjects.Graphics, p: Palette, size: number): void {
  graphics.lineStyle(3.4, p.main, 0.94);
  graphics.strokeRect(-size * 0.5, -size * 0.38, size, size * 0.76);
  graphics.lineStyle(2.1, p.core, 0.76);
  graphics.lineBetween(-size * 0.26, 0, size * 0.34, 0);
  graphics.lineBetween(size * 0.05, -size * 0.28, size * 0.05, size * 0.28);
  graphics.lineStyle(2.6, p.main, 0.72);
  graphics.lineBetween(size * 0.36, -size * 0.44, size * 0.72, -size * 0.58);
  graphics.lineBetween(size * 0.36, 0, size * 0.82, 0);
  graphics.lineBetween(size * 0.36, size * 0.44, size * 0.72, size * 0.58);
}

function drawFighterStamp(graphics: Phaser.GameObjects.Graphics, p: Palette, size: number): void {
  graphics.lineStyle(3.8, p.main, 0.9);
  graphics.strokeCircle(size * 0.16, 0, size * 0.42);
  graphics.lineStyle(2.4, p.core, 0.82);
  [-0.5, -0.2, 0, 0.2, 0.5].forEach((offset) => {
    graphics.lineBetween(-size * 0.6, size * offset, size * 0.52, size * offset * 0.42);
  });
  graphics.lineStyle(2.1, p.main, 0.74);
  graphics.lineBetween(size * 0.4, -size * 0.58, size * 0.74, -size * 0.74);
  graphics.lineBetween(size * 0.4, size * 0.58, size * 0.74, size * 0.74);
}

function drawKnightStamp(graphics: Phaser.GameObjects.Graphics, p: Palette, size: number): void {
  graphics.lineStyle(4.4, p.main, 0.92);
  graphics.lineBetween(-size * 0.68, size * 0.44, size * 0.72, -size * 0.5);
  graphics.lineStyle(2.2, p.core, 0.88);
  graphics.lineBetween(-size * 0.72, size * 0.18, size * 0.64, -size * 0.7);
  graphics.lineStyle(1.6, p.core, 0.7);
  graphics.lineBetween(-size * 0.52, size * 0.66, size * 0.88, -size * 0.24);
}

function drawAssassinStamp(graphics: Phaser.GameObjects.Graphics, p: Palette, size: number): void {
  graphics.lineStyle(3.6, p.main, 0.9);
  graphics.lineBetween(-size * 0.7, -size * 0.52, size * 0.72, size * 0.5);
  graphics.lineBetween(-size * 0.7, size * 0.52, size * 0.72, -size * 0.5);
  graphics.lineStyle(1.8, p.core, 0.82);
  graphics.lineBetween(-size * 0.58, -size * 0.74, size * 0.42, size * 0.08);
  graphics.lineBetween(-size * 0.58, size * 0.74, size * 0.42, -size * 0.08);
}

function addRoleStamp(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  role: CombatMeleeContactRole,
  p: Palette,
  size: number
): void {
  const graphics = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  if (role === 'tank') drawTankStamp(graphics, p, size);
  else if (role === 'fighter') drawFighterStamp(graphics, p, size);
  else if (role === 'knight') drawKnightStamp(graphics, p, size);
  else drawAssassinStamp(graphics, p, size);
  root.add(graphics);
}

/** A compact target stamp preserves decisive contact while melee actors stay in their own slot. */
export async function playCombatMeleeContactAccent(
  options: Options,
  role: CombatMeleeContactRole,
  tier: CombatMeleeContactTier
): Promise<void> {
  const { scene, source, target } = options;
  if (!scene.sys?.isActive?.() || !Number.isFinite(source.x + source.y + target.x + target.y)) return;

  const p = ELEMENT[options.element] ?? ELEMENT.neutral;
  const size = sizeFor(tier);
  const duration = durationFor(tier, Boolean(options.reducedMotion));
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const root = scene.add.container(target.x, target.y)
    .setDepth(powVfxDepth('foreground') + 22)
    .setRotation(angle)
    .setScale(tier === 'ultimate' ? 0.68 : tier === 'skill' ? 0.76 : 0.86);
  const halo = scene.add.ellipse(0, 0, size * 2.2, size * 1.2, 0x000000, 0)
    .setStrokeStyle(tier === 'ultimate' ? 4.4 : 2.8, p.main, tier === 'normal' ? 0.65 : 0.9);
  const core = scene.add.circle(size * 0.18, 0, size * 0.18, p.core, tier === 'ultimate' ? 0.25 : 0.18)
    .setBlendMode(Phaser.BlendModes.ADD);
  const sparks = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const sparkCount = tier === 'ultimate' ? 6 : tier === 'skill' ? 4 : 2;
  sparks.fillStyle(p.core, 0.88);
  for (let index = 0; index < sparkCount; index += 1) {
    const a = ((Math.PI * 2 * index) / sparkCount) + 0.42;
    const x = Math.cos(a) * size * 0.78;
    const y = Math.sin(a) * size * 0.54;
    sparks.fillTriangle(x + 4, y, x - 2.5, y - 3, x - 2.5, y + 3);
  }
  root.add([halo, core, sparks]);
  addRoleStamp(scene, root, role, p, size);

  try {
    await tween(scene, root, {
      x: target.x + Math.cos(angle) * (tier === 'ultimate' ? 18 : 11),
      y: target.y + Math.sin(angle) * (tier === 'ultimate' ? 18 : 11),
      scaleX: tier === 'ultimate' ? 1.42 : tier === 'skill' ? 1.28 : 1.16,
      scaleY: tier === 'ultimate' ? 1.42 : tier === 'skill' ? 1.28 : 1.16,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut'
    }, duration + 240);
  } finally {
    root.destroy(true);
  }
}
