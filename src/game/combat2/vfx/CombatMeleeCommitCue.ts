import Phaser from 'phaser';
import type { CombatProjectileElement, DirectionalProjectileOptions } from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

export const COMBAT2190_MELEE_COMMIT_CUE_VERSION = '2.19.1';

export type CombatMeleeCommitRole = 'tank' | 'fighter' | 'knight' | 'assassin';
export type CombatMeleeCommitTier = 'normal' | 'skill' | 'ultimate';

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

function durationFor(tier: CombatMeleeCommitTier, reducedMotion: boolean): number {
  if (reducedMotion) return tier === 'ultimate' ? 72 : 52;
  if (tier === 'ultimate') return 132;
  if (tier === 'skill') return 102;
  return 76;
}

function radiusFor(tier: CombatMeleeCommitTier): number {
  if (tier === 'ultimate') return 52;
  if (tier === 'skill') return 40;
  return 30;
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

function addRoleMark(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  role: CombatMeleeCommitRole,
  palette: Palette,
  radius: number
): void {
  if (role === 'tank') {
    const shield = scene.add.polygon(radius * 0.24, 0, [
      -radius * 0.26, -radius * 0.42,
      radius * 0.2, -radius * 0.36,
      radius * 0.5, 0,
      radius * 0.2, radius * 0.36,
      -radius * 0.26, radius * 0.42,
      -radius * 0.46, 0
    ], palette.dark, 0.94).setStrokeStyle(2.4, palette.main, 0.92);
    const crest = scene.add.graphics();
    crest.lineStyle(1.8, palette.core, 0.78);
    crest.lineBetween(radius * 0.1, -radius * 0.2, radius * 0.1, radius * 0.2);
    crest.lineBetween(radius * -0.04, 0, radius * 0.24, 0);
    root.add([shield, crest]);
    return;
  }

  if (role === 'fighter') {
    const fist = scene.add.circle(radius * 0.28, 0, radius * 0.24, palette.dark, 0.96)
      .setStrokeStyle(2.4, palette.main, 0.94);
    const knuckles = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    knuckles.lineStyle(2.4, palette.core, 0.9);
    [-0.16, 0, 0.16].forEach((offset) => knuckles.lineBetween(radius * 0.2, radius * offset, radius * 0.48, radius * offset));
    root.add([fist, knuckles]);
    return;
  }

  if (role === 'knight') {
    const blade = scene.add.rectangle(radius * 0.3, 0, radius * 1.04, 5, palette.core, 0.9)
      .setStrokeStyle(1.5, palette.main, 0.92);
    const guard = scene.add.rectangle(-radius * 0.08, 0, 5, radius * 0.64, palette.main, 0.86);
    root.add([blade, guard]);
    return;
  }

  const slash = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  slash.lineStyle(3, palette.core, 0.9);
  slash.lineBetween(radius * 0.02, -radius * 0.38, radius * 0.62, -radius * 0.08);
  slash.lineBetween(radius * 0.12, radius * 0.18, radius * 0.74, radius * 0.46);
  slash.lineStyle(1.8, palette.main, 0.82);
  slash.lineBetween(-radius * 0.16, -radius * 0.08, radius * 0.38, radius * 0.24);
  root.add(slash);
}

function addTierAccents(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  palette: Palette,
  radius: number,
  tier: CombatMeleeCommitTier
): void {
  const count = tier === 'ultimate' ? 6 : tier === 'skill' ? 4 : 2;
  const orbit = radius * (tier === 'ultimate' ? 0.92 : 0.78);
  const sparkSize = tier === 'ultimate' ? 5 : tier === 'skill' ? 4 : 3;
  const sparks = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

  sparks.fillStyle(palette.core, tier === 'ultimate' ? 0.92 : 0.74);
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.PI * 0.18;
    const x = Math.cos(angle) * orbit;
    const y = Math.sin(angle) * orbit;
    sparks.fillTriangle(x + sparkSize, y, x - sparkSize * 0.55, y - sparkSize * 0.55, x - sparkSize * 0.55, y + sparkSize * 0.55);
  }

  if (tier !== 'normal') {
    sparks.lineStyle(tier === 'ultimate' ? 2.2 : 1.5, palette.main, tier === 'ultimate' ? 0.9 : 0.66);
    sparks.strokeCircle(0, 0, radius * (tier === 'ultimate' ? 1.12 : 0.9));
  }

  root.add(sparks);
}

/** A short source-side intent cue makes melee actions readable before contact. */
export async function playCombatMeleeCommitCue(
  options: Options,
  role: CombatMeleeCommitRole,
  tier: CombatMeleeCommitTier
): Promise<void> {
  const { scene, source, target } = options;
  if (!scene.sys?.isActive?.() || !Number.isFinite(source.x + source.y + target.x + target.y)) return;

  const palette = ELEMENT[options.element] ?? ELEMENT.neutral;
  const radius = radiusFor(tier);
  const duration = durationFor(tier, Boolean(options.reducedMotion));
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const root = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 14)
    .setRotation(angle)
    .setScale(tier === 'ultimate' ? 0.66 : tier === 'skill' ? 0.72 : 0.8);

  const outer = scene.add.circle(0, 0, radius, 0x000000, 0)
    .setStrokeStyle(tier === 'ultimate' ? 4 : 2.5, palette.main, tier === 'normal' ? 0.72 : 0.94);
  const inner = scene.add.circle(0, 0, radius * 0.56, palette.main, tier === 'ultimate' ? 0.14 : 0.09);
  const core = scene.add.circle(0, 0, radius * 0.18, palette.dark, 0.38)
    .setStrokeStyle(1.4, palette.main, 0.72);
  const direction = scene.add.graphics();
  direction.lineStyle(tier === 'ultimate' ? 4 : 2.5, palette.core, 0.78);
  direction.lineBetween(radius * 0.16, 0, radius * 0.9, 0);
  direction.fillStyle(palette.core, 0.86);
  direction.fillTriangle(radius * 1.08, 0, radius * 0.68, -radius * 0.25, radius * 0.68, radius * 0.25);
  root.add([inner, outer, core, direction]);
  addTierAccents(scene, root, palette, radius, tier);
  addRoleMark(scene, root, role, palette, radius);

  try {
    await tween(scene, root, {
      scaleX: tier === 'ultimate' ? 1.38 : tier === 'skill' ? 1.26 : 1.16,
      scaleY: tier === 'ultimate' ? 1.38 : tier === 'skill' ? 1.26 : 1.16,
      rotation: angle + (tier === 'ultimate' ? 0.18 : 0.1),
      alpha: 0,
      duration,
      ease: 'Quad.easeOut'
    }, duration + 220);
  } finally {
    root.destroy(true);
  }
}
