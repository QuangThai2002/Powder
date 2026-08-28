import Phaser from 'phaser';

const PATCH_FLAG = '__powderCombat2120VisualActionSystemInstalled';

type FxTier = 'full' | 'balanced' | 'lite';

type FxBudget = {
  rays: number;
  sparks: number;
  screenAccent: boolean;
};

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

function budget(): FxBudget {
  if (reducedMotion() || tier() === 'lite') return { rays: 3, sparks: 2, screenAccent: false };
  if (tier() === 'balanced') return { rays: 5, sparks: 4, screenAccent: true };
  return { rays: 8, sparks: 6, screenAccent: true };
}

function powElement(view: any): string {
  return String(view?.pow?.elementKey ?? view?.pow?.element ?? '');
}

function elementColor(value: unknown): number {
  const key = norm(value);
  if (key.includes('dung nham') || key.includes('lava')) return 0xff4d27;
  if (key.includes('lua') || key.includes('fire')) return 0xff7548;
  if (key.includes('nuoc') || key.includes('water')) return 0x52c5ff;
  if (key.includes('bang') || key.includes('ice')) return 0xa5edff;
  if (key.includes('set') || key.includes('electric') || key.includes('lightning')) return 0xffe66d;
  if (key.includes('bao') || key.includes('storm')) return 0x8ea6ff;
  if (key.includes('la') || key.includes('leaf') || key.includes('nature')) return 0x80e58e;
  if (key.includes('doc') || key.includes('poison')) return 0xb0e86d;
  if (key.includes('dat') || key.includes('earth')) return 0xc59a67;
  if (key.includes('thep') || key.includes('steel')) return 0xd5e5ed;
  if (key.includes('gio') || key.includes('wind')) return 0x80ead8;
  if (key.includes('anh sang') || key.includes('light')) return 0xffefad;
  if (key.includes('bong toi') || key.includes('dark')) return 0xb29aff;
  return 0x83e7ff;
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const duration = typeof config.duration === 'number' ? config.duration : 160;
    const delay = typeof config.delay === 'number' ? config.delay : 0;
    const hold = typeof config.hold === 'number' ? config.hold : 0;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, Math.max(260, delay + duration * (config.yoyo ? 2 : 1) + hold + 180));
    try { scene.tweens.add({ ...config, onComplete: finish }); } catch { finish(); }
  });
}

function world(view: any): Phaser.Math.Vector2 {
  try { return view.getWorldPosition(); } catch { return new Phaser.Math.Vector2(view?.container?.x || 0, view?.container?.y || 0); }
}

async function castFocus(view: any, targetX: number, targetY: number): Promise<Phaser.GameObjects.Container | null> {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return null;
  const p = world(view);
  const color = elementColor(powElement(view));
  const fx = budget();
  const root = scene.add.container(p.x, p.y).setDepth(64).setAlpha(0.15).setScale(0.7);
  const ring = scene.add.ellipse(0, 42, 118, 34, 0x000000, 0).setStrokeStyle(3, color, 0.82);
  const core = scene.add.circle(0, 0, 42, color, 0.055).setStrokeStyle(2, 0xffffff, 0.18);
  root.add([ring, core]);
  for (let i = 0; i < fx.rays; i += 1) {
    const angle = Math.PI * 2 * i / fx.rays;
    root.add(scene.add.rectangle(Math.cos(angle) * 50, Math.sin(angle) * 50, 25, 3, i % 2 ? color : 0xffffff, 0.54).setRotation(angle));
  }

  const dx = targetX - p.x;
  const dy = targetY - p.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const trail = scene.add.graphics().setDepth(60);
  trail.lineStyle(tier() === 'full' ? 5 : 3, color, 0.34);
  trail.beginPath();
  trail.moveTo(p.x, p.y);
  const segments = fx.rays > 5 ? 5 : 3;
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const wobble = (i % 2 ? 1 : -1) * Math.min(18, len * 0.025);
    trail.lineTo(p.x + dx * t + nx * wobble, p.y + dy * t + ny * wobble);
  }
  trail.lineTo(targetX, targetY);
  trail.strokePath();

  await tween(scene, { targets: root, alpha: 0.92, scaleX: 1, scaleY: 1, duration: reducedMotion() ? 60 : 115, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: trail, alpha: 0, duration: reducedMotion() ? 90 : 220, ease: 'Quad.easeOut', onComplete: () => trail.destroy() });
  return root;
}

async function impactFx(view: any): Promise<void> {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const p = world(view);
  const color = elementColor(powElement(view));
  const fx = budget();
  const root = scene.add.container(p.x, p.y).setDepth(78).setScale(0.55);
  const core = scene.add.circle(0, 0, 22, 0xffffff, fx.screenAccent ? 0.32 : 0.2);
  const ring = scene.add.circle(0, 0, 34, 0x000000, 0).setStrokeStyle(4, color, 0.95);
  const outer = scene.add.circle(0, 0, 54, 0x000000, 0).setStrokeStyle(2, 0xffffff, 0.32);
  root.add([core, ring, outer]);
  for (let i = 0; i < fx.rays; i += 1) {
    const a = Math.PI * 2 * i / fx.rays;
    root.add(scene.add.rectangle(Math.cos(a) * 39, Math.sin(a) * 39, i % 2 ? 40 : 28, i % 2 ? 5 : 3, color, 0.82).setRotation(a));
  }
  if (fx.screenAccent) {
    const vignette = scene.add.rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, color, 0.035).setDepth(76);
    scene.tweens.add({ targets: vignette, alpha: 0, duration: 90, onComplete: () => vignette.destroy() });
  }
  await tween(scene, { targets: root, scaleX: 1.42, scaleY: 1.42, alpha: 0, duration: reducedMotion() ? 90 : 160, ease: 'Quad.easeOut' });
  root.destroy(true);
}

async function statusAura(view: any): Promise<void> {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const p = world(view);
  const color = elementColor(powElement(view));
  const fx = budget();
  const root = scene.add.container(p.x, p.y).setDepth(69);
  const lower = scene.add.ellipse(0, 62, 132, 36, color, 0.06).setStrokeStyle(3, color, 0.72);
  const upper = scene.add.ellipse(0, -14, 86, 26, 0x000000, 0).setStrokeStyle(2, 0xffffff, 0.36);
  root.add([lower, upper]);
  for (let i = 0; i < fx.sparks; i += 1) {
    const x = (i - (fx.sparks - 1) / 2) * 22;
    const spark = scene.add.rectangle(x, 42 + (i % 2) * 8, 4, 24, i % 2 ? color : 0xffffff, 0.62);
    root.add(spark);
    scene.tweens.add({ targets: spark, y: spark.y - 78, alpha: 0, duration: reducedMotion() ? 140 : 320 + i * 28, ease: 'Quad.easeOut' });
  }
  await tween(scene, { targets: [lower, upper], scaleX: 1.28, scaleY: 1.28, alpha: 0, duration: reducedMotion() ? 120 : 300, ease: 'Quad.easeOut' });
  root.destroy(true);
}

async function reservePortal(view: any, x: number, y: number): Promise<void> {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const color = elementColor(powElement(view));
  const root = scene.add.container(x, y).setDepth(73).setScale(0.52).setAlpha(0.3);
  root.add([
    scene.add.ellipse(0, 70, 164, 42, color, 0.08).setStrokeStyle(4, color, 0.84),
    scene.add.ellipse(0, 20, 110, 170, 0x000000, 0).setStrokeStyle(3, color, 0.56),
    scene.add.rectangle(0, 10, 16, 180, color, 0.08)
  ]);
  await tween(scene, { targets: root, scaleX: 1.05, scaleY: 1.05, alpha: 0.88, duration: reducedMotion() ? 90 : 180, yoyo: true, hold: 30, ease: 'Back.easeOut' });
  root.destroy(true);
}

async function defeatFx(view: any): Promise<void> {
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const p = world(view);
  const color = elementColor(powElement(view));
  const fx = budget();
  const root = scene.add.container(p.x, p.y).setDepth(74);
  const ring = scene.add.circle(0, 0, 58, 0x000000, 0).setStrokeStyle(4, 0xff6578, 0.8);
  root.add(ring);
  for (let i = 0; i < fx.rays; i += 1) {
    const a = Math.PI * 2 * i / fx.rays;
    const shard = scene.add.triangle(Math.cos(a) * 34, Math.sin(a) * 34, -8, 7, 11, 0, -8, -7, i % 2 ? color : 0xff6578, 0.75).setRotation(a);
    root.add(shard);
    scene.tweens.add({ targets: shard, x: Math.cos(a) * 105, y: Math.sin(a) * 105, alpha: 0, duration: reducedMotion() ? 110 : 240, ease: 'Quad.easeOut' });
  }
  await tween(scene, { targets: ring, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: reducedMotion() ? 100 : 210, ease: 'Quad.easeOut' });
  root.destroy(true);
}

function installPowViewVisuals(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const originalAttack = proto.playAttackLunge;
  const originalHit = proto.playHit;
  const originalStatus = proto.playStatusPulse;
  const originalEnter = proto.enterField;
  const originalRetire = proto.retireFromField;

  if (typeof originalAttack === 'function') {
    proto.playAttackLunge = async function combat2120Attack(this: any, targetX: number, targetY: number): Promise<void> {
      const focus = await castFocus(this, targetX, targetY);
      try { await originalAttack.call(this, targetX, targetY); }
      finally {
        if (focus) {
          const scene = this.scene as Phaser.Scene;
          scene.tweens.add({ targets: focus, alpha: 0, scaleX: 1.28, scaleY: 1.28, duration: 120, onComplete: () => focus.destroy(true) });
        }
      }
    };
  }

  if (typeof originalHit === 'function') {
    proto.playHit = async function combat2120Hit(this: any): Promise<void> {
      const burst = impactFx(this);
      await Promise.all([Promise.resolve(originalHit.call(this)), burst]);
    };
  }

  if (typeof originalStatus === 'function') {
    proto.playStatusPulse = async function combat2120Status(this: any): Promise<void> {
      const aura = statusAura(this);
      await Promise.all([Promise.resolve(originalStatus.call(this)), aura]);
    };
  }

  if (typeof originalEnter === 'function') {
    proto.enterField = async function combat2120Enter(this: any, x: number, y: number): Promise<void> {
      const portal = reservePortal(this, x, y);
      await Promise.all([Promise.resolve(originalEnter.call(this, x, y)), portal]);
    };
  }

  if (typeof originalRetire === 'function') {
    proto.retireFromField = async function combat2120Retire(this: any, x: number, y: number): Promise<void> {
      const burst = defeatFx(this);
      await Promise.all([Promise.resolve(originalRetire.call(this, x, y)), burst]);
    };
  }
}

function installActionBannerAccent(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const original = proto.showActionBanner;
  if (typeof original !== 'function') return;
  proto.showActionBanner = function combat2120ActionBanner(this: Phaser.Scene & any, view: any, name: string, color: string): void {
    original.call(this, view, name, color);
    if (!view) return;
    const p = world(view);
    const top = p.y < this.scale.height / 2;
    const y = top ? Math.min(this.scale.height / 2 - 105, p.y + 146) : Math.max(this.scale.height / 2 + 105, p.y - 146);
    const accent = elementColor(powElement(view));
    const width = Math.min(330, 155 + String(name || '').length * 6.2);
    const line = this.add.rectangle(p.x, y + (top ? 24 : -24), width, 3, accent, 0.75).setDepth(45).setScale(0.25, 1);
    this.tweens.add({ targets: line, scaleX: 1, alpha: 0, hold: 260, duration: reducedMotion() ? 120 : 340, ease: 'Quad.easeOut', onComplete: () => line.destroy() });
  };
}

export function installCombat2120VisualActionSystemPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installPowViewVisuals(PowViewClass);
  installActionBannerAccent(BattleSceneClass);

  root.POWDER_COMBAT2_VISUAL_ACTION_SYSTEM = {
    version: '2.12.0',
    mode: 'cinematic-action-language',
    get tier(): FxTier { return tier(); },
    coverage: ['cast', 'travel', 'impact', 'support-control', 'reserve-entry', 'defeat', 'skill-banner'],
    rules: ['presentation-only', 'adaptive-fx', 'no-particles', 'no-combat-logic-change', '60fps-priority']
  };
}
