import Phaser from 'phaser';

const PATCH_FLAG = '__powderCombat2121ElementalMagicStageInstalled';

type FxTier = 'full' | 'balanced' | 'lite';
type ElementStyle = {
  key: string;
  primary: number;
  secondary: number;
  accent: number;
  motif: 'flame' | 'wave' | 'ice' | 'bolt' | 'leaf' | 'poison' | 'rock' | 'steel' | 'wind' | 'light' | 'void' | 'arcane';
};

interface PatchableScene extends Phaser.Scene {
  __combat2121Element?: string;
  __combat2121Side?: 'player' | 'enemy';
  __combat2121ActionDepth?: number;
  performBasicAttack?: (...args: any[]) => Promise<void>;
  performAbility?: (...args: any[]) => Promise<void>;
  showFloatingLabel?: (view: any, label: string, color: string) => void;
}

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

function styleFor(value: unknown): ElementStyle {
  const key = norm(value);
  if (key.includes('dung nham') || key.includes('lava')) return { key: 'lava', primary: 0xff4b25, secondary: 0xffb347, accent: 0x6d160d, motif: 'flame' };
  if (key.includes('lua') || key.includes('fire')) return { key: 'fire', primary: 0xff7548, secondary: 0xffd36a, accent: 0x8c251b, motif: 'flame' };
  if (key.includes('nuoc') || key.includes('water')) return { key: 'water', primary: 0x52c5ff, secondary: 0xbcefff, accent: 0x145f95, motif: 'wave' };
  if (key.includes('bang') || key.includes('ice')) return { key: 'ice', primary: 0xa5edff, secondary: 0xf2fdff, accent: 0x4d8fb7, motif: 'ice' };
  if (key.includes('set') || key.includes('electric') || key.includes('lightning')) return { key: 'lightning', primary: 0xffe66d, secondary: 0xffffff, accent: 0x8e7d18, motif: 'bolt' };
  if (key.includes('bao') || key.includes('storm')) return { key: 'storm', primary: 0x8ea6ff, secondary: 0xdfe6ff, accent: 0x4e5ca3, motif: 'bolt' };
  if (key.includes('la') || key.includes('leaf') || key.includes('nature')) return { key: 'leaf', primary: 0x80e58e, secondary: 0xdbffc9, accent: 0x2e7946, motif: 'leaf' };
  if (key.includes('doc') || key.includes('poison')) return { key: 'poison', primary: 0xb0e86d, secondary: 0xe8ff9b, accent: 0x557825, motif: 'poison' };
  if (key.includes('dat') || key.includes('earth')) return { key: 'earth', primary: 0xc59a67, secondary: 0xf1d19d, accent: 0x705038, motif: 'rock' };
  if (key.includes('thep') || key.includes('steel')) return { key: 'steel', primary: 0xd5e5ed, secondary: 0xffffff, accent: 0x607987, motif: 'steel' };
  if (key.includes('gio') || key.includes('wind')) return { key: 'wind', primary: 0x80ead8, secondary: 0xe7fff9, accent: 0x318d83, motif: 'wind' };
  if (key.includes('anh sang') || key.includes('light')) return { key: 'light', primary: 0xffefad, secondary: 0xffffff, accent: 0xc89c37, motif: 'light' };
  if (key.includes('bong toi') || key.includes('dark')) return { key: 'dark', primary: 0xb29aff, secondary: 0xe1d7ff, accent: 0x503d81, motif: 'void' };
  return { key: 'arcane', primary: 0x83e7ff, secondary: 0xe6fbff, accent: 0x385f86, motif: 'arcane' };
}

function viewElement(view: any): string {
  return String(view?.pow?.elementKey ?? view?.pow?.element ?? '');
}

function world(view: any): Phaser.Math.Vector2 {
  try { return view.getWorldPosition(); } catch { return new Phaser.Math.Vector2(view?.container?.x || 0, view?.container?.y || 0); }
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const duration = typeof config.duration === 'number' ? config.duration : 160;
    const delay = typeof config.delay === 'number' ? config.delay : 0;
    const hold = typeof config.hold === 'number' ? config.hold : 0;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, Math.max(260, delay + duration * (config.yoyo ? 2 : 1) + hold + 180));
    try { scene.tweens.add({ ...config, onComplete: finish }); } catch { finish(); }
  });
}

function actionBudget(): { motes: number; rings: number; screen: boolean } {
  if (reducedMotion() || tier() === 'lite') return { motes: 3, rings: 1, screen: false };
  if (tier() === 'balanced') return { motes: 5, rings: 2, screen: true };
  return { motes: 8, rings: 3, screen: true };
}

function addMotif(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, motif: ElementStyle['motif'], x: number, y: number, size: number, style: ElementStyle, rotation: number): Phaser.GameObjects.GameObject {
  if (motif === 'ice') return scene.add.triangle(x, y, -size, size * 0.55, size, 0, -size, -size * 0.55, style.primary, 0.78).setRotation(rotation);
  if (motif === 'leaf') return scene.add.ellipse(x, y, size * 1.8, size * 0.8, style.primary, 0.76).setRotation(rotation);
  if (motif === 'rock' || motif === 'steel') return scene.add.rectangle(x, y, size * 1.15, size * 1.15, style.primary, 0.72).setStrokeStyle(1.5, style.secondary, 0.55).setRotation(rotation);
  if (motif === 'bolt') return scene.add.rectangle(x, y, size * 2.2, Math.max(2, size * 0.24), style.primary, 0.82).setRotation(rotation);
  if (motif === 'wind' || motif === 'wave') return scene.add.arc(x, y, size, 195, 345, false, style.primary, 0).setStrokeStyle(Math.max(2, size * 0.18), style.primary, 0.72).setRotation(rotation);
  if (motif === 'light') return scene.add.star(x, y, 4, size * 0.28, size, style.primary, 0.82).setRotation(rotation);
  if (motif === 'void') return scene.add.circle(x, y, size * 0.62, style.accent, 0.68).setStrokeStyle(2, style.primary, 0.74);
  if (motif === 'poison') return scene.add.circle(x, y, size * 0.52, style.primary, 0.66).setStrokeStyle(1, style.secondary, 0.45);
  if (motif === 'flame') return scene.add.triangle(x, y, -size * 0.55, size, 0, -size, size * 0.55, size, style.primary, 0.78).setRotation(rotation);
  return scene.add.circle(x, y, size * 0.55, style.primary, 0.7).setStrokeStyle(1, style.secondary, 0.5);
}

async function elementalInvocation(view: any, targetX: number, targetY: number): Promise<void> {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const p = world(view);
  const style = styleFor(viewElement(view));
  const fx = actionBudget();

  const wash = fx.screen
    ? scene.add.rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, style.accent, 0.035).setDepth(51)
    : null;
  if (wash) scene.tweens.add({ targets: wash, alpha: 0, duration: 210, onComplete: () => wash.destroy() });

  const sigil = scene.add.container(p.x, p.y).setDepth(72).setScale(0.45).setAlpha(0.2);
  for (let ring = 0; ring < fx.rings; ring += 1) {
    const radius = 44 + ring * 17;
    const circle = scene.add.circle(0, 18, radius, 0x000000, 0).setStrokeStyle(ring === 0 ? 3 : 2, ring % 2 ? style.secondary : style.primary, 0.68 - ring * 0.12);
    sigil.add(circle);
    if (!reducedMotion()) scene.tweens.add({ targets: circle, rotation: (ring % 2 ? -1 : 1) * Math.PI * 0.35, duration: 360 + ring * 90, ease: 'Sine.easeInOut' });
  }

  for (let i = 0; i < fx.motes; i += 1) {
    const a = Math.PI * 2 * i / fx.motes;
    const radius = 58 + (i % 2) * 14;
    const mote = addMotif(scene, sigil, style.motif, Math.cos(a) * radius, 18 + Math.sin(a) * radius * 0.55, 9 + (i % 3) * 2, style, a);
    sigil.add(mote);
    scene.tweens.add({ targets: mote, alpha: 0, scaleX: 0.35, scaleY: 0.35, duration: reducedMotion() ? 120 : 240 + i * 16, ease: 'Quad.easeIn' });
  }

  const direction = Math.atan2(targetY - p.y, targetX - p.x);
  const focus = scene.add.rectangle(Math.cos(direction) * 74, 18 + Math.sin(direction) * 42, 70, 3, style.secondary, 0.72).setRotation(direction);
  sigil.add(focus);
  await tween(scene, { targets: sigil, scaleX: 1.05, scaleY: 1.05, alpha: 0.94, duration: reducedMotion() ? 70 : 125, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: sigil, alpha: 0, scaleX: 1.25, scaleY: 1.25, duration: reducedMotion() ? 80 : 170, onComplete: () => sigil.destroy(true) });
}

async function elementalImpact(view: any, element: unknown): Promise<void> {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const p = world(view);
  const style = styleFor(element || viewElement(view));
  const fx = actionBudget();
  const root = scene.add.container(p.x, p.y).setDepth(82).setScale(0.45);
  const halo = scene.add.circle(0, 0, 50, style.primary, 0.045).setStrokeStyle(4, style.primary, 0.9);
  const inner = scene.add.circle(0, 0, 27, style.secondary, 0.13).setStrokeStyle(2, style.secondary, 0.72);
  root.add([halo, inner]);

  for (let i = 0; i < fx.motes; i += 1) {
    const a = Math.PI * 2 * i / fx.motes;
    const motif = addMotif(scene, root, style.motif, Math.cos(a) * 34, Math.sin(a) * 34, 11 + (i % 2) * 3, style, a);
    root.add(motif);
    scene.tweens.add({ targets: motif, x: Math.cos(a) * (88 + (i % 2) * 22), y: Math.sin(a) * (88 + (i % 2) * 22), alpha: 0, duration: reducedMotion() ? 110 : 210 + i * 12, ease: 'Quad.easeOut' });
  }

  if (style.motif === 'bolt' && tier() !== 'lite') {
    const flash = scene.add.rectangle(0, -62, 7, 120, style.secondary, 0.72).setRotation(-0.12);
    root.add(flash);
    scene.tweens.add({ targets: flash, alpha: 0, scaleY: 1.55, duration: 130, onComplete: () => flash.destroy() });
  }
  if ((style.motif === 'wave' || style.motif === 'wind') && tier() !== 'lite') {
    const sweep = scene.add.ellipse(0, 14, 150, 44, 0x000000, 0).setStrokeStyle(4, style.primary, 0.62);
    root.add(sweep);
    scene.tweens.add({ targets: sweep, scaleX: 1.45, alpha: 0, duration: 190 });
  }

  await tween(scene, { targets: [halo, inner], scaleX: 1.55, scaleY: 1.55, alpha: 0, duration: reducedMotion() ? 100 : 185, ease: 'Quad.easeOut' });
  root.destroy(true);
}

function sustainFx(view: any, kind: 'heal' | 'shield'): void {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const p = world(view);
  const fx = actionBudget();
  const color = kind === 'heal' ? 0x79f2ad : 0x82dfff;
  const secondary = kind === 'heal' ? 0xd7ffe7 : 0xe2f8ff;
  const root = scene.add.container(p.x, p.y).setDepth(79);
  const ring = scene.add.ellipse(0, 54, 132, 36, color, 0.05).setStrokeStyle(3, color, 0.82);
  root.add(ring);
  for (let i = 0; i < Math.max(3, fx.motes - 1); i += 1) {
    const a = Math.PI * 2 * i / Math.max(3, fx.motes - 1);
    const x = Math.cos(a) * 48;
    const y = 28 + Math.sin(a) * 18;
    const mote = kind === 'heal'
      ? scene.add.star(x, y, 4, 2, 8, secondary, 0.82)
      : scene.add.rectangle(x, y, 8, 15, secondary, 0.72).setRotation(a);
    root.add(mote);
    scene.tweens.add({ targets: mote, y: y - 88, alpha: 0, duration: reducedMotion() ? 150 : 330 + i * 24, ease: 'Quad.easeOut' });
  }
  scene.tweens.add({ targets: ring, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: reducedMotion() ? 150 : 330, ease: 'Quad.easeOut', onComplete: () => root.destroy(true) });
}

function installPowViewMagic(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const originalAttack = proto.playAttackLunge;
  const originalHit = proto.playHit;

  if (typeof originalAttack === 'function') {
    proto.playAttackLunge = async function combat2121MagicAttack(this: any, targetX: number, targetY: number): Promise<void> {
      const invoke = elementalInvocation(this, targetX, targetY);
      await Promise.all([Promise.resolve(originalAttack.call(this, targetX, targetY)), invoke]);
    };
  }

  if (typeof originalHit === 'function') {
    proto.playHit = async function combat2121MagicHit(this: any): Promise<void> {
      const scene = this.scene as PatchableScene;
      const burst = elementalImpact(this, scene.__combat2121Element || viewElement(this));
      await Promise.all([Promise.resolve(originalHit.call(this)), burst]);
    };
  }
}

function installActionContext(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const wrap = (name: 'performBasicAttack' | 'performAbility') => {
    const original = proto[name];
    if (typeof original !== 'function') return;
    proto[name] = async function combat2121ActionContext(this: PatchableScene, actor: any, ...args: any[]): Promise<void> {
      const previousElement = this.__combat2121Element;
      const previousSide = this.__combat2121Side;
      this.__combat2121Element = String(actor?.pow?.elementKey ?? actor?.pow?.element ?? '');
      this.__combat2121Side = actor?.side === 'enemy' ? 'enemy' : 'player';
      this.__combat2121ActionDepth = (this.__combat2121ActionDepth || 0) + 1;
      try { await original.call(this, actor, ...args); }
      finally {
        this.__combat2121ActionDepth = Math.max(0, (this.__combat2121ActionDepth || 1) - 1);
        if (this.__combat2121ActionDepth === 0) {
          this.__combat2121Element = previousElement;
          this.__combat2121Side = previousSide;
        }
      }
    };
  };
  wrap('performBasicAttack');
  wrap('performAbility');

  const originalFloating = proto.showFloatingLabel;
  if (typeof originalFloating === 'function') {
    proto.showFloatingLabel = function combat2121FloatingMagic(this: PatchableScene, view: any, label: string, color: string): void {
      originalFloating.call(this, view, label, color);
      const normalized = norm(label);
      if (normalized.includes('hoi +') || normalized.includes('hoi phuc')) sustainFx(view, 'heal');
      else if (normalized.includes('khien +') || normalized === 'khien') sustainFx(view, 'shield');
    };
  }
}

export function installCombat2121ElementalMagicStagePatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installActionContext(BattleSceneClass);
  installPowViewMagic(PowViewClass);
  root.POWDER_COMBAT2_ELEMENTAL_MAGIC_STAGE = {
    version: '2.12.1',
    mode: 'elemental-invocation-impact-sustain',
    elements: ['fire', 'lava', 'water', 'ice', 'lightning', 'storm', 'leaf', 'poison', 'earth', 'steel', 'wind', 'light', 'dark'],
    adaptive: true,
    rules: ['presentation-only', 'source-element-context', 'adaptive-budget', 'reduced-motion-safe', 'no-combat-logic-change']
  };
}
