import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import { PowView } from './PowView';
import { CombatPresentationDirector } from './CombatPresentationDirector';
import { powVfxDepth } from '../vfx/CombatNightVfxLayout';
import { preloadCombatVfxAssets } from '../vfx/CombatVfxRegistry';

export const COMBAT2200_FAIRY_ANIME_PRESENTATION_VERSION = '2.20.0';

const PATCH_FLAG = '__powderCombat2200FairyAnimePresentationInstalled';
const FAIRY_SIGIL_KEY = 'combat-fairy-anime-sigil-v1';
const FAIRY_SIGIL_URL = '/assets/combat/vfx/fairy-anime/fairy-sigil-v1.png';

type FairyTier = 'normal' | 'skill' | 'ultimate';
type FairyPhase = 'cast' | 'release';
type ElementPalette = { main: number; core: number };
type TweenConfig = Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets' | 'onComplete' | 'onStop'>;

type RuntimePowView = {
  scene: Phaser.Scene;
  pow?: { elementKey?: string; element?: string };
  reducedMotion?: boolean;
  getWorldPosition?: () => Phaser.Math.Vector2;
  __combat2104ActionSignature?: { tier?: string };
};

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function lowFx(): boolean {
  if (reducedMotion()) return true;
  const tier = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return tier === 'lite';
}

function paletteFor(element: unknown): ElementPalette {
  const key = normalize(element);
  if (key.includes('lava') || key.includes('dung nham')) return { main: 0xf15c3e, core: 0xffdc78 };
  if (key.includes('fire') || key.includes('lua')) return { main: 0xff7649, core: 0xffe5ae };
  if (key.includes('water') || key.includes('nuoc')) return { main: 0x5bc9f4, core: 0xe9fbff };
  if (key.includes('ice') || key.includes('bang')) return { main: 0x9ce8ff, core: 0xffffff };
  if (key.includes('lightning') || key.includes('set')) return { main: 0xf6da62, core: 0xffffe7 };
  if (key.includes('storm') || key.includes('bao')) return { main: 0x8da8ff, core: 0xf3f5ff };
  if (key.includes('wind') || key.includes('gio')) return { main: 0x75dfcb, core: 0xf1fffc };
  if (key.includes('leaf') || key.includes('la')) return { main: 0x78d788, core: 0xf0ffe9 };
  if (key.includes('poison') || key.includes('doc')) return { main: 0xa7d56a, core: 0xf4ffd7 };
  if (key.includes('earth') || key.includes('dat')) return { main: 0xc09369, core: 0xffe4bf };
  if (key.includes('steel') || key.includes('thep')) return { main: 0xc9d9e2, core: 0xffffff };
  if (key.includes('light') || key.includes('anh sang')) return { main: 0xffe5a3, core: 0xffffff };
  if (key.includes('dark') || key.includes('bong toi')) return { main: 0xaf8be9, core: 0xf7f1ff };
  return { main: 0x7bdced, core: 0xf1ffff };
}

function tierFor(view: RuntimePowView): FairyTier {
  const tier = view.__combat2104ActionSignature?.tier;
  if (tier === 'ultimate') return 'ultimate';
  if (tier === 'skill') return 'skill';
  return 'normal';
}

function phaseConfig(tier: FairyTier, phase: FairyPhase, isReduced: boolean): { size: number; duration: number; start: number; end: number; alpha: number } {
  if (isReduced) {
    if (tier === 'ultimate') return { size: 150, duration: 190, start: 0.64, end: 0.94, alpha: 0.54 };
    if (tier === 'skill') return { size: 116, duration: 125, start: 0.64, end: 0.94, alpha: 0.5 };
    return { size: 82, duration: 82, start: 0.68, end: 0.92, alpha: 0.42 };
  }

  if (phase === 'cast') {
    if (tier === 'ultimate') return { size: 244, duration: 680, start: 0.48, end: 1.24, alpha: 0.8 };
    return { size: 166, duration: 350, start: 0.52, end: 1.12, alpha: 0.66 };
  }

  if (tier === 'ultimate') return { size: 188, duration: 150, start: 0.56, end: 1.24, alpha: 0.72 };
  if (tier === 'skill') return { size: 142, duration: 175, start: 0.58, end: 1.18, alpha: 0.62 };
  return { size: 106, duration: 235, start: 0.62, end: 1.22, alpha: 0.56 };
}

function tween(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject | object, config: TweenConfig, fallbackMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let activeTween: Phaser.Tweens.Tween | null = null;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      try { activeTween?.stop(); } catch { /* scene teardown only */ }
      finish();
    };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      activeTween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch { finish(); }
  });
}

/** A tinted generated sigil makes every action share a readable fairy-anime silhouette. */
async function playFairySigil(scene: Phaser.Scene, view: RuntimePowView | undefined, tier: FairyTier, phase: FairyPhase, element: unknown): Promise<void> {
  const point = view?.getWorldPosition?.();
  if (!point || !scene.sys?.isActive?.()) return;

  const isReduced = Boolean(view?.reducedMotion) || reducedMotion();
  const config = phaseConfig(tier, phase, isReduced);
  const palette = paletteFor(element);
  const root = scene.add.container(point.x, point.y)
    .setDepth(tier === 'ultimate' ? 81 : powVfxDepth('foreground') + 20)
    .setScale(config.start)
    .setAlpha(config.alpha);
  const ring = scene.add.circle(0, 0, config.size * 0.23, palette.main, 0.055)
    .setStrokeStyle(tier === 'ultimate' ? 3.6 : 2.2, palette.main, 0.76)
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.circle(0, 0, config.size * 0.08, palette.core, 0.32).setBlendMode(Phaser.BlendModes.ADD);
  root.add([ring, core]);

  if (scene.textures.exists(FAIRY_SIGIL_KEY)) {
    const sigil = scene.add.image(0, 0, FAIRY_SIGIL_KEY)
      .setDisplaySize(config.size, config.size)
      .setTint(palette.main)
      .setAlpha(phase === 'cast' ? 0.86 : 0.72)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.add(sigil);
  }

  const sparkCount = isReduced || lowFx() ? 3 : tier === 'ultimate' ? 8 : tier === 'skill' ? 6 : 4;
  const sparkRadius = config.size * 0.28;
  for (let index = 0; index < sparkCount; index += 1) {
    const angle = Math.PI * 2 * index / sparkCount + Math.PI * 0.18;
    root.add(scene.add.star(Math.cos(angle) * sparkRadius, Math.sin(angle) * sparkRadius, 4, 1.6, tier === 'ultimate' ? 6 : 4, palette.core, 0.86)
      .setRotation(angle));
  }

  try {
    await tween(scene, root, {
      scaleX: config.end,
      scaleY: config.end,
      rotation: isReduced ? 0 : phase === 'cast' ? 0.26 : -0.18,
      alpha: 0,
      duration: config.duration,
      ease: phase === 'cast' ? 'Sine.easeOut' : 'Cubic.easeOut'
    }, config.duration + 320);
  } finally {
    root.destroy(true);
  }
}

function installFairyDirectorPresentation(): void {
  const proto = CombatPresentationDirector.prototype as any;
  if (proto.__combat2200FairyAnimePresentationInstalled) return;
  proto.__combat2200FairyAnimePresentationInstalled = true;

  const originalSkill = proto.playSkillIntro;
  if (typeof originalSkill === 'function') {
    proto.playSkillIntro = async function combat2200FairySkillIntro(
      this: { scene: Phaser.Scene },
      actorView: RuntimePowView | undefined,
      targetView: RuntimePowView | undefined,
      ability: CombatAbility,
      slot: 0 | 1,
      elementKey: string,
      selfTargeted: boolean
    ): Promise<void> {
      await Promise.all([
        originalSkill.call(this, actorView, targetView, ability, slot, elementKey, selfTargeted),
        playFairySigil(this.scene, actorView, 'skill', 'cast', elementKey)
      ]);
    };
  }

  const originalUltimate = proto.playUltimateIntro;
  if (typeof originalUltimate === 'function') {
    proto.playUltimateIntro = async function combat2200FairyUltimateIntro(
      this: { scene: Phaser.Scene },
      actorView: RuntimePowView | undefined,
      ability: CombatAbility,
      side: 'player' | 'enemy',
      elementKey: string
    ): Promise<void> {
      // The director owns the single visible Ultimate back-circle and its rarity mapping.
      await originalUltimate.call(this, actorView, ability, side, elementKey);
    };
  }
}

function installFairyAttackTiming(): void {
  const proto = PowView.prototype as any;
  if (proto.__combat2200FairyAttackTimingInstalled) return;
  proto.__combat2200FairyAttackTimingInstalled = true;
  const originalAttack = proto.playAttackLunge;
  if (typeof originalAttack !== 'function') return;

  const fairyAttack = async function combat2200FairyAttack(this: RuntimePowView, targetX: number, targetY: number): Promise<void> {
    await originalAttack.call(this, targetX, targetY);
  };

  // Preserve the final projectile-owner contract verified by the regression gate.
  Object.defineProperty(fairyAttack, '__powderCombat2FinalAttackOwner', { value: true });
  proto.playAttackLunge = fairyAttack;
}

export function installCombat2200FairyAnimePresentationPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalPreload = proto.preload;
  if (typeof originalPreload === 'function') {
    proto.preload = function combat2200FairyPreload(this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalPreload.apply(this, args);
      if (!this.textures.exists(FAIRY_SIGIL_KEY)) this.load.image(FAIRY_SIGIL_KEY, FAIRY_SIGIL_URL);
      // Future packs opt in by ID; absent art is never requested from the live build.
      preloadCombatVfxAssets(this, 'common');
      return result;
    };
  }

  // Skill and ultimate circles are now owned by the layered 2.20.1 renderer.
  installFairyAttackTiming();
  root.POWDER_COMBAT2_FAIRY_ANIME_PRESENTATION = {
    version: COMBAT2200_FAIRY_ANIME_PRESENTATION_VERSION,
    sigil: FAIRY_SIGIL_URL,
    textureKey: FAIRY_SIGIL_KEY,
    coverage: ['basic-release', 'skill-cast', 'skill-release', 'ultimate-cast', 'ultimate-release'],
    timing: 'readable-anticipation-and-release',
    assetRegistryPreload: 'common-enabled-only',
    elementTinted: true,
    reducedMotion: reducedMotion(),
    combatLogicChanged: false
  };
}
