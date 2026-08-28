import Phaser from 'phaser';
import type { CombatAbility, CombatSide } from '../data/CombatPow';
import {
  allExactCombatVfxSpecs,
  exactElementVfx,
  exactStatusVfx,
  type ExactCombatVfxSpec
} from '../vfx/Combat2140ExactVfxRegistry';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2143ReadableCinematicVfxInstalled';
const VERSION = '2.14.3';
const ATLAS_KEY = 'combat-vfx-atlas-a';
const ATLAS_URL = '/assets/combat/vfx/preview/vfx-elements-a.webp';
const PERSISTENT_FX = '__powderCombat2140PersistentFx';
const READY_SENTINEL = '__powderCombat2143ReadySentinel';

type FxTier = 'full' | 'balanced' | 'lite';
type VisualSource = {
  textureKey: string;
  frame?: number;
  displaySize: number;
  alpha: number;
};

type LiveSnapshot = {
  version: string;
  exactLoaded: number;
  exactExpected: number;
  atlasLoaded: boolean;
  fallbackRoutes: number;
  missingExact: string[];
  tier: FxTier;
};

const persistentPulse = new WeakMap<Phaser.GameObjects.Image, Phaser.Tweens.Tween>();

function plain(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function sceneReady(scene: Phaser.Scene): boolean {
  try { return Boolean(scene.sys?.isActive?.() && scene.add && scene.tweens && scene.textures); }
  catch { return false; }
}

function frameForElement(value: unknown): number {
  const key = plain(value);
  if (key.includes('lua') || key.includes('fire') || key.includes('dung nham') || key.includes('lava')) return 0;
  if (key.includes('thep') || key.includes('steel') || key.includes('set') || key.includes('lightning') || key.includes('electric') || key.includes('anh sang') || key.includes('light')) return 1;
  if (key.includes('nuoc') || key.includes('water') || key.includes('bang') || key.includes('ice') || key.includes('bao') || key.includes('storm')) return 2;
  if (key.includes('la') || key.includes('leaf') || key.includes('nature') || key.includes('doc') || key.includes('poison') || key.includes('gio') || key.includes('wind')) return 3;
  return 4;
}

function frameForStatus(value: unknown): number {
  const key = plain(value);
  if (key.includes('burn') || key.includes('thieu dot')) return 0;
  if (key.includes('freeze') || key.includes('dong bang') || key.includes('frost')) return 2;
  if (key.includes('poison') || key.includes('doc') || key.includes('heal') || key.includes('hoi phuc')) return 3;
  if (key.includes('silence') || key.includes('cam lang') || key.includes('slow') || key.includes('cham')) return 4;
  return 1;
}

function exactSource(scene: Phaser.Scene, spec: ExactCombatVfxSpec | null): VisualSource | null {
  if (!spec || !scene.textures.exists(spec.textureKey)) return null;
  return { textureKey: spec.textureKey, displaySize: spec.displaySize, alpha: spec.alpha };
}

function atlasSource(scene: Phaser.Scene, frame: number): VisualSource | null {
  if (!scene.textures.exists(ATLAS_KEY)) return null;
  return { textureKey: ATLAS_KEY, frame, displaySize: 224, alpha: 0.88 };
}

function sourceForElement(scene: Phaser.Scene, value: unknown): VisualSource | null {
  return exactSource(scene, exactElementVfx(value)) || atlasSource(scene, frameForElement(value));
}

function sourceForStatus(scene: Phaser.Scene, value: unknown): VisualSource | null {
  const text = plain(value);
  return exactSource(scene, exactStatusVfx(text))
    || (text.includes('poison') || text.includes('doc') ? exactSource(scene, exactElementVfx('poison')) : null)
    || atlasSource(scene, frameForStatus(text));
}

function sourceForAbility(scene: Phaser.Scene, ability: CombatAbility | undefined, elementKey: unknown): VisualSource | null {
  const text = plain(`${ability?.name || ''} ${ability?.type || ''} ${ability?.status || ''} ${ability?.mechanic || ''} ${ability?.description || ''}`);
  const dedicated = sourceForStatus(scene, text);
  const isDedicated = [
    'burn', 'thieu dot', 'freeze', 'dong bang', 'stun', 'choang', 'paralysis', 'te liet',
    'heal', 'hoi mau', 'hoi phuc', 'shield', 'khien', 'barrier', 'poison', 'nhiem doc'
  ].some((key) => text.includes(key));
  return isDedicated && dedicated ? dedicated : sourceForElement(scene, elementKey);
}

function sourceForView(scene: Phaser.Scene, view: any, support = false): VisualSource | null {
  if (support) {
    const status = sourceForStatus(scene, view?.runtimeVisualStatus || '');
    if (status) return status;
  }
  return sourceForElement(scene, `${view?.pow?.elementKey || ''} ${view?.pow?.element || ''}`);
}

function addVisual(
  scene: Phaser.Scene,
  source: VisualSource,
  x: number,
  y: number,
  depth: number,
  sizeMultiplier: number,
  alphaMultiplier: number
): Phaser.GameObjects.Image | null {
  if (!sceneReady(scene) || !scene.textures.exists(source.textureKey)) return null;
  const qualityScale = tier() === 'lite' ? 0.75 : tier() === 'balanced' ? 0.9 : 1;
  const qualityAlpha = tier() === 'lite' ? 0.72 : tier() === 'balanced' ? 0.88 : 1;
  const image = scene.add.image(x, y, source.textureKey, source.frame);
  image
    .setDepth(depth)
    .setDisplaySize(source.displaySize * sizeMultiplier * qualityScale, source.displaySize * sizeMultiplier * qualityScale)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(source.alpha * alphaMultiplier * qualityAlpha);
  return image;
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    if (!sceneReady(scene)) { resolve(); return; }
    let settled = false;
    let active: Phaser.Tweens.Tween | null = null;
    const cleanup = (): void => {
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const abort = (): void => {
      try { active?.stop(); } catch { /* teardown owns tween manager */ }
      finish();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try { active = scene.tweens.add({ ...config, onComplete: finish, onStop: finish }); }
    catch { finish(); }
  });
}

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (!sceneReady(scene) || ms <= 0) { resolve(); return; }
    let done = false;
    let timer: Phaser.Time.TimerEvent | null = null;
    const finish = (): void => {
      if (done) return;
      done = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, finish);
      scene.events.off(Phaser.Scenes.Events.DESTROY, finish);
      resolve();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);
    scene.events.once(Phaser.Scenes.Events.DESTROY, finish);
    try { timer = scene.time.delayedCall(ms, finish); }
    catch { finish(); }
    void timer;
  });
}

async function chargeLayers(scene: Phaser.Scene, source: VisualSource, x: number, y: number, depth: number, strong = false): Promise<void> {
  const quality = tier();
  const count = quality === 'full' ? 2 : 1;
  const duration = reducedMotion() ? 120 : quality === 'lite' ? 150 : quality === 'balanced' ? 230 : strong ? 360 : 300;
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    const fx = addVisual(scene, source, x, y + i * 3, depth - i, strong ? 0.82 - i * 0.14 : 0.62 - i * 0.12, i === 0 ? 0.72 : 0.34);
    if (!fx) continue;
    fx.setScale(fx.scaleX * (i === 0 ? 0.78 : 0.68), fx.scaleY * (i === 0 ? 0.78 : 0.68));
    if (i) fx.setRotation(0.18);
    jobs.push(tween(scene, {
      targets: fx,
      y: y - (strong ? 12 : 7) - i * 4,
      scaleX: fx.scaleX * (strong ? 1.72 : 1.55),
      scaleY: fx.scaleY * (strong ? 1.72 : 1.55),
      rotation: i && !reducedMotion() ? fx.rotation - 0.22 : fx.rotation,
      alpha: 0,
      delay: reducedMotion() ? 0 : i * 65,
      duration: duration + i * 70,
      ease: 'Sine.easeOut'
    }).finally(() => { if (fx.scene) fx.destroy(); }));
  }
  await Promise.all(jobs);
}

async function travelTrail(scene: Phaser.Scene, source: VisualSource, start: Phaser.Math.Vector2, targetX: number, targetY: number, depth: number): Promise<void> {
  if (tier() === 'lite' || reducedMotion()) return;
  const count = tier() === 'full' ? 2 : 1;
  const jobs: Promise<void>[] = [];
  const angle = Math.atan2(targetY - start.y, targetX - start.x);
  for (let i = 0; i < count; i += 1) {
    const fx = addVisual(scene, source, start.x, start.y - 2, depth - i, i === 0 ? 0.34 : 0.24, i === 0 ? 0.46 : 0.25);
    if (!fx) continue;
    fx.setRotation(angle).setAlpha(fx.alpha * (i === 0 ? 1 : 0.8));
    jobs.push(tween(scene, {
      targets: fx,
      x: targetX,
      y: targetY - 2,
      scaleX: fx.scaleX * 1.14,
      scaleY: fx.scaleY * 1.14,
      alpha: i === 0 ? 0.58 : 0.28,
      delay: i * 70,
      duration: tier() === 'full' ? 430 + i * 55 : 340,
      ease: 'Sine.easeInOut'
    }).finally(() => { if (fx.scene) fx.destroy(); }));
  }
  await Promise.all(jobs);
}

async function impactLayers(scene: Phaser.Scene, source: VisualSource, x: number, y: number, depth: number, strong = false): Promise<void> {
  const quality = tier();
  const count = quality === 'full' ? 2 : 1;
  const baseDuration = reducedMotion() ? 150 : quality === 'lite' ? 210 : quality === 'balanced' ? 390 : strong ? 680 : 540;
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    const fx = addVisual(scene, source, x, y - 4, depth - i, strong ? 1.18 - i * 0.26 : 0.92 - i * 0.2, i === 0 ? 0.78 : 0.34);
    if (!fx) continue;
    if (i) fx.setRotation(0.24);
    jobs.push(tween(scene, {
      targets: fx,
      y: y - 9 - i * 3,
      scaleX: fx.scaleX * (strong ? 1.72 : 1.56),
      scaleY: fx.scaleY * (strong ? 1.72 : 1.56),
      rotation: i && !reducedMotion() ? fx.rotation - 0.28 : fx.rotation,
      alpha: 0,
      delay: reducedMotion() ? 0 : i * 95,
      duration: baseDuration + i * 90,
      ease: 'Quad.easeOut'
    }).finally(() => { if (fx.scene) fx.destroy(); }));
  }
  await Promise.all(jobs);
}

function installPowVfx(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const previousCast = proto.playCastSignature;
  const previousTravel = proto.playElementTravel;
  const previousImpact = proto.playElementImpact;
  const previousHitFlash = proto.playHitFlash;
  const previousSupport = proto.playSupportAura;
  const previousControl = proto.playControlLock;
  const previousUpdate = proto.updateRuntime;

  if (typeof previousCast === 'function') {
    proto.playCastSignature = async function combat2143Cast(this: any, support: boolean): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const source = sourceForView(scene, this, support);
      if (source) {
        const p = this.getWorldPosition() as Phaser.Math.Vector2;
        await chargeLayers(scene, source, p.x, p.y - 5, 46, support);
      }
      await previousCast.call(this, support);
      if (!reducedMotion() && tier() === 'full') await wait(scene, 55);
    };
  }

  if (typeof previousTravel === 'function') {
    proto.playElementTravel = async function combat2143Travel(this: any, targetX: number, targetY: number): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const source = sourceForView(scene, this, false);
      const start = this.getWorldPosition() as Phaser.Math.Vector2;
      const jobs: Promise<unknown>[] = [Promise.resolve(previousTravel.call(this, targetX, targetY))];
      if (source) jobs.push(travelTrail(scene, source, start, targetX, targetY, 45));
      await Promise.all(jobs);
      if (!reducedMotion() && tier() !== 'lite') await wait(scene, tier() === 'full' ? 85 : 45);
    };
  }

  if (typeof previousImpact === 'function') {
    proto.playElementImpact = async function combat2143Impact(this: any, x: number, y: number): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const source = sourceForView(scene, this, false);
      const jobs: Promise<unknown>[] = [Promise.resolve(previousImpact.call(this, x, y))];
      if (source) jobs.push(impactLayers(scene, source, x, y, 48, false));
      await Promise.all(jobs);
    };
  }

  if (typeof previousHitFlash === 'function') {
    proto.playHitFlash = function combat2143HitFlash(this: any): void {
      previousHitFlash.call(this);
      const scene = this.scene as Phaser.Scene;
      const actionElement = String((scene as any).__powderCombat2140ActionElement || `${this?.pow?.elementKey || ''} ${this?.pow?.element || ''}`);
      const source = sourceForElement(scene, actionElement);
      if (!source) return;
      const p = this.getWorldPosition() as Phaser.Math.Vector2;
      const fx = addVisual(scene, source, p.x, p.y - 5, 50, 0.52, 0.44);
      if (!fx) return;
      scene.tweens.add({
        targets: fx,
        scaleX: fx.scaleX * 1.48,
        scaleY: fx.scaleY * 1.48,
        alpha: 0,
        duration: reducedMotion() ? 120 : tier() === 'lite' ? 180 : 340,
        ease: 'Quad.easeOut',
        onComplete: () => { if (fx.scene) fx.destroy(); }
      });
    };
  }

  if (typeof previousSupport === 'function') {
    proto.playSupportAura = async function combat2143Support(this: any): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const source = sourceForView(scene, this, true);
      const p = this.getWorldPosition() as Phaser.Math.Vector2;
      const jobs: Promise<unknown>[] = [Promise.resolve(previousSupport.call(this))];
      if (source) jobs.push(chargeLayers(scene, source, p.x, p.y + 8, 45, true));
      await Promise.all(jobs);
      if (!reducedMotion() && tier() === 'full') await wait(scene, 110);
    };
  }

  if (typeof previousControl === 'function') {
    proto.playControlLock = async function combat2143Control(this: any, status: string): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const source = sourceForStatus(scene, status);
      const p = this.getWorldPosition() as Phaser.Math.Vector2;
      const jobs: Promise<unknown>[] = [Promise.resolve(previousControl.call(this, status))];
      if (source) jobs.push(impactLayers(scene, source, p.x, p.y - 5, 52, true));
      await Promise.all(jobs);
      if (!reducedMotion() && tier() === 'full') await wait(scene, 120);
    };
  }

  if (typeof previousUpdate === 'function') {
    proto.updateRuntime = function combat2143Runtime(this: any, unit: any): void {
      // Retire the old giant procedural elemental ready ring. A hidden sentinel keeps the
      // 2.7 HUD from recreating it while preserving all rage/ultimate logic.
      if (unit?.alive && unit?.fieldSlot !== null && Number(unit?.ragePoints || 0) >= 4 && !this.combat271UltimateReadyFx) {
        let sentinel = this[READY_SENTINEL] as Phaser.GameObjects.Container | undefined;
        if (!sentinel?.scene) {
          sentinel = this.scene.add.container(-9999, -9999).setVisible(false).setActive(false);
          this[READY_SENTINEL] = sentinel;
        }
        this.combat271UltimateReadyFx = sentinel;
      }

      previousUpdate.call(this, unit);

      const fx = this[PERSISTENT_FX] as Phaser.GameObjects.Image | undefined;
      if (!fx?.scene || !fx.visible || reducedMotion()) return;
      const oldTween = persistentPulse.get(fx);
      if (oldTween?.isPlaying()) return;
      try {
        const baseAlpha = Math.max(0.16, Number(fx.alpha) || 0.35);
        const pulse = this.scene.tweens.add({
          targets: fx,
          alpha: { from: baseAlpha * 0.68, to: baseAlpha },
          duration: tier() === 'lite' ? 900 : tier() === 'balanced' ? 760 : 650,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        persistentPulse.set(fx, pulse);
      } catch { /* presentation must never block combat */ }
    };
  }
}

function installPresentation(CombatPresentationDirectorClass: any): void {
  const proto = CombatPresentationDirectorClass.prototype as any;
  const previousSkillIntro = proto.playSkillIntro;
  const previousUltimateImpact = proto.playUltimateImpact;

  if (typeof previousSkillIntro === 'function') {
    proto.playSkillIntro = async function combat2143SkillIntro(
      actorView: any,
      targetView: any,
      ability: CombatAbility,
      slot: 0 | 1,
      elementKey: string,
      selfTargeted: boolean
    ): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      const source = sourceForAbility(scene, ability, elementKey);
      if (source && actorView) {
        const p = actorView.getWorldPosition() as Phaser.Math.Vector2;
        await chargeLayers(scene, source, p.x, p.y - 10, 64, slot === 1);
      }
      await previousSkillIntro.call(this, actorView, targetView, ability, slot, elementKey, selfTargeted);
      if (!reducedMotion()) await wait(scene, tier() === 'full' ? 95 : tier() === 'balanced' ? 55 : 0);
    };
  }

  if (typeof previousUltimateImpact === 'function') {
    proto.playUltimateImpact = async function combat2143UltimateImpact(
      targetView: any,
      elementKey: string,
      selfTargeted: boolean
    ): Promise<void> {
      const scene = this.scene as Phaser.Scene;
      await previousUltimateImpact.call(this, targetView, elementKey, selfTargeted);
      if (!targetView) return;
      const p = targetView.getWorldPosition() as Phaser.Math.Vector2;
      const source = selfTargeted
        ? sourceForStatus(scene, targetView?.runtimeVisualStatus || 'heal')
        : sourceForElement(scene, elementKey);
      if (source) await impactLayers(scene, source, p.x, p.y - 7, 78, true);
    };
  }
}

function snapshot(scene: Phaser.Scene): LiveSnapshot {
  const specs = allExactCombatVfxSpecs();
  const missing = specs.filter((spec) => !scene.textures.exists(spec.textureKey));
  const atlasLoaded = scene.textures.exists(ATLAS_KEY);
  return {
    version: VERSION,
    exactLoaded: specs.length - missing.length,
    exactExpected: specs.length,
    atlasLoaded,
    fallbackRoutes: atlasLoaded ? missing.length : 0,
    missingExact: missing.map((spec) => spec.textureKey),
    tier: tier()
  };
}

function badgeLabel(state: LiveSnapshot): string {
  const quality = state.tier.toUpperCase();
  if (!state.atlasLoaded) return `${VERSION} · ${quality} · ATLAS MISSING · ${state.exactLoaded}/${state.exactExpected} EXACT`;
  if (state.missingExact.length <= 0) return `${VERSION} · CINEMATIC ${quality} · ${state.exactLoaded}/${state.exactExpected} EXACT`;
  return `${VERSION} · CINEMATIC ${quality} · ${state.exactLoaded}/${state.exactExpected} EXACT + ${state.fallbackRoutes} FALLBACK`;
}

function refreshRuntimeText(scene: Phaser.Scene): void {
  const state = snapshot(scene);
  (globalThis as any).POWDER_COMBAT2_CINEMATIC_VFX_LIVE = state;
  const label = badgeLabel(state);
  let foundBadge = false;
  const list = (scene.children?.list || []) as Phaser.GameObjects.GameObject[];
  for (const child of list) {
    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    const text = String(child.text || '');
    if (text.includes('POWDER COMBAT 2.14.2')) {
      child.setText(`POWDER COMBAT ${VERSION}`);
      continue;
    }
    if (text.includes('ASSET VFX · CAST')) {
      child.setText('CINEMATIC ASSET VFX · CAST → TRAVEL → IMPACT → LINGER');
      continue;
    }
    if (text.includes('2.14.2 ·') || text.includes('VFX MISSING') || text.includes('ASSET VFX LIVE')) {
      child.setText(label).setColor(state.atlasLoaded ? '#aef7d3' : '#ffb38c').setAlpha(0.92);
      foundBadge = true;
    }
  }
  if (!foundBadge && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    scene.add.text(scene.scale.width - 18, scene.scale.height - 58, label, {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: '10px',
      color: state.atlasLoaded ? '#aef7d3' : '#ffb38c',
      fontStyle: 'bold',
      backgroundColor: '#041018cc',
      padding: { x: 7, y: 4 }
    }).setOrigin(1, 1).setDepth(121).setAlpha(0.92);
  }
}

function retryMissingTextures(scene: Phaser.Scene): void {
  if (!sceneReady(scene)) return;
  const specs = allExactCombatVfxSpecs();
  let queued = 0;
  for (const spec of specs) {
    if (scene.textures.exists(spec.textureKey)) continue;
    try { scene.load.image(spec.textureKey, spec.url); queued += 1; } catch { /* keep atlas fallback */ }
  }
  if (!scene.textures.exists(ATLAS_KEY)) {
    try { scene.load.spritesheet(ATLAS_KEY, ATLAS_URL, { frameWidth: 224, frameHeight: 224 }); queued += 1; } catch { /* exact assets can still run */ }
  }
  if (queued <= 0) return;
  try {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => refreshRuntimeText(scene));
    const loading = Boolean((scene.load as any).isLoading?.());
    if (!loading) scene.load.start();
  } catch { /* fallback routing remains active */ }
}

function installLiveProof(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const previousIntro = proto.showPreBattleIntro;
  if (typeof previousIntro !== 'function') return;
  proto.showPreBattleIntro = function combat2143Intro(this: Phaser.Scene & any, ...args: any[]): any {
    const result = previousIntro.apply(this, args);
    refreshRuntimeText(this);
    retryMissingTextures(this);
    return result;
  };
}

export function installCombat2143ReadableCinematicVfxPatch(
  BattleSceneClass: any,
  PowViewClass: any,
  CombatPresentationDirectorClass: any
): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  installPowVfx(PowViewClass);
  installPresentation(CombatPresentationDirectorClass);
  installLiveProof(BattleSceneClass);

  root.POWDER_COMBAT2_RUNTIME_VERSION = VERSION;
  root.POWDER_COMBAT2_READABLE_CINEMATIC_VFX = {
    version: VERSION,
    mode: 'readable-cast-travel-impact-linger',
    timing: {
      cast: 'roughly-0.45-to-0.70s-full',
      travel: 'roughly-0.4-to-0.6s-full',
      impact: 'roughly-0.5-to-0.8s-full',
      persistentStatus: 'slow-breathing-loop'
    },
    rules: [
      'asset-first',
      'exact-asset-then-atlas-fallback',
      'full-first-adaptive-presentation',
      'no-giant-procedural-ultimate-ready-ring',
      'source-to-target-readable',
      'max-two-extra-layer-images-full-tier',
      'no-combat-logic-change'
    ]
  };
}
