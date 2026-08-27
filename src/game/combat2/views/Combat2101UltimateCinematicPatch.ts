import Phaser from 'phaser';
import type { CombatAbility, CombatSide } from '../data/CombatPow';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';
import type { PowView } from './PowView';

const PATCH_FLAG = '__powderCombat2101UltimateCinematicInstalled';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function lowFx(): boolean {
  if (reducedMotion()) return true;
  const memory = Number((navigator as any)?.deviceMemory || 0);
  const cores = Number(navigator?.hardwareConcurrency || 0);
  return (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
}

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function colorFor(elementKey: string): number {
  const key = norm(elementKey);
  if (key.includes('fire') || key.includes('lua')) return 0xff7043;
  if (key.includes('lava') || key.includes('dung nham')) return 0xff4f2e;
  if (key.includes('water') || key.includes('nuoc')) return 0x4db9ff;
  if (key.includes('ice') || key.includes('bang')) return 0x8adfff;
  if (key.includes('lightning') || key.includes('set')) return 0xf5dd62;
  if (key.includes('storm') || key.includes('bao')) return 0x78a9ff;
  if (key.includes('leaf') || key.includes('la')) return 0x72d67f;
  if (key.includes('poison') || key.includes('doc')) return 0xa5df66;
  if (key.includes('earth') || key.includes('dat')) return 0xb78c5d;
  if (key.includes('steel') || key.includes('thep')) return 0xc3d3dc;
  if (key.includes('wind') || key.includes('gio')) return 0x76e4d2;
  if (key.includes('light') || key.includes('anh sang')) return 0xffefad;
  if (key.includes('dark') || key.includes('bong toi')) return 0xa88cf2;
  return 0x8eeaff;
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const duration = typeof config.duration === 'number' ? config.duration : 180;
    const delay = typeof config.delay === 'number' ? config.delay : 0;
    const hold = typeof config.hold === 'number' ? config.hold : 0;
    const finish = (): void => { if (settled) return; settled = true; window.clearTimeout(timer); resolve(); };
    const timer = window.setTimeout(finish, Math.max(320, delay + duration * (config.yoyo ? 2 : 1) + hold + 280));
    try { scene.tweens.add({ ...config, onComplete: finish }); } catch { finish(); }
  });
}

function motif(scene: Phaser.Scene, x: number, y: number, elementKey: string, color: number): Phaser.GameObjects.Container {
  const key = norm(elementKey);
  const m = scene.add.container(x, y).setDepth(78).setScale(0.55);
  m.add(scene.add.circle(0, 0, 68, 0x000000, 0).setStrokeStyle(4, color, 0.88));

  if (key.includes('fire') || key.includes('lava') || key.includes('lua')) {
    for (let i = 0; i < 7; i += 1) {
      const a = Math.PI * 2 * i / 7;
      m.add(scene.add.triangle(Math.cos(a) * 72, Math.sin(a) * 72, -8, 11, 0, -17, 8, 11, i % 2 ? color : 0xffd36a, 0.8).setRotation(a + Math.PI / 2));
    }
  } else if (key.includes('water') || key.includes('nuoc')) {
    m.add([scene.add.ellipse(0, 0, 118, 42, 0x000000, 0).setStrokeStyle(4, color, 0.72), scene.add.ellipse(0, 0, 88, 30, 0x000000, 0).setStrokeStyle(2, 0xd7fbff, 0.55)]);
  } else if (key.includes('ice') || key.includes('bang')) {
    for (let i = 0; i < 6; i += 1) m.add(scene.add.rectangle(0, 0, 120, i % 2 ? 3 : 5, i % 2 ? 0xe8fdff : color, 0.72).setRotation(Math.PI * i / 6));
  } else if (key.includes('lightning') || key.includes('storm') || key.includes('set') || key.includes('bao')) {
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI * 2 * i / 4;
      m.add(scene.add.rectangle(Math.cos(a) * 62, Math.sin(a) * 62, 48, 5, color, 0.82).setRotation(a - 0.48));
    }
  } else if (key.includes('leaf') || key.includes('la') || key.includes('poison') || key.includes('doc')) {
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI * 2 * i / 6;
      m.add(scene.add.ellipse(Math.cos(a) * 62, Math.sin(a) * 62, 30, 15, i % 2 ? color : 0xbfff8f, 0.66).setRotation(a + 0.45));
    }
  } else if (key.includes('light') || key.includes('anh sang')) {
    for (let i = 0; i < 8; i += 1) m.add(scene.add.rectangle(0, 0, 142, i % 2 ? 3 : 5, i % 2 ? 0xffffff : color, 0.7).setRotation(Math.PI * i / 8));
  } else if (key.includes('dark') || key.includes('bong toi')) {
    m.add([scene.add.circle(0, 0, 48, 0x190b29, 0.86).setStrokeStyle(3, color, 0.8), scene.add.circle(20, -12, 42, 0x06111c, 0.96)]);
  } else if (key.includes('wind') || key.includes('gio')) {
    m.add([scene.add.arc(0, 0, 56, 190, 345, false, 0x000000, 0).setStrokeStyle(5, color, 0.76), scene.add.arc(0, 0, 42, 10, 165, false, 0x000000, 0).setStrokeStyle(3, 0xeafffa, 0.55)]);
  } else {
    for (let i = 0; i < 4; i += 1) m.add(scene.add.rectangle(0, 0, 116, 4, color, 0.65).setRotation(Math.PI * i / 4));
  }
  return m;
}

function finisher(scene: Phaser.Scene, x: number, y: number, elementKey: string): Phaser.GameObjects.Container {
  const color = colorFor(elementKey);
  const f = scene.add.container(x, y).setDepth(83).setScale(0.55);
  f.add([
    scene.add.circle(0, 0, 28, color, 0.16),
    scene.add.circle(0, 0, 72, 0x000000, 0).setStrokeStyle(6, color, 0.9),
    scene.add.circle(0, 0, 48, 0x000000, 0).setStrokeStyle(3, 0xffffff, 0.56)
  ]);
  const rays = lowFx() ? 4 : 10;
  for (let i = 0; i < rays; i += 1) {
    const a = Math.PI * 2 * i / rays;
    f.add(scene.add.rectangle(Math.cos(a) * 61, Math.sin(a) * 61, 45, i % 2 ? 3 : 5, i % 2 ? color : 0xffe59a, 0.76).setRotation(a));
  }
  return f;
}

export function installCombat2101UltimateCinematicPatch(DirectorClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const proto = DirectorClass.prototype as any;

  proto.playUltimateIntro = async function combat2101UltimateIntro(
    this: { scene: Phaser.Scene },
    actorView: PowView | undefined,
    ability: CombatAbility,
    side: CombatSide,
    elementKey: string
  ): Promise<void> {
    if (!actorView) return;
    const scene = this.scene;
    const { width, height } = scene.scale;
    const p = actorView.getWorldPosition();
    const color = colorFor(elementKey);
    const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x01050a, 0.64).setDepth(72).setAlpha(0);
    const flare = scene.add.rectangle(width / 2, p.y, width * 0.82, 7, color, 0.5).setDepth(73).setScale(0, 1);
    const sigil = motif(scene, p.x, p.y, elementKey, color);
    const bannerY = height * 0.5;
    const bannerWidth = Math.min(720, width * 0.5);
    const banner = scene.add.container(width / 2, bannerY).setDepth(84).setAlpha(0).setScale(0.94);
    const plate = scene.add.rectangle(0, 0, bannerWidth, 112, 0x06111c, 0.96).setStrokeStyle(2, color, 0.84);
    const accent = scene.add.rectangle(side === 'player' ? -bannerWidth / 2 + 5 : bannerWidth / 2 - 5, 0, 8, 98, color, 0.94);
    const iconX = -bannerWidth / 2 + 66;
    const icon = ability.iconKey && scene.textures.exists(ability.iconKey)
      ? scene.add.image(iconX, 0, ability.iconKey).setDisplaySize(82, 82)
      : scene.add.text(iconX, 0, '✦', { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '46px', color: '#ffe08a' }).setOrigin(0.5);
    const name = scene.add.text(-bannerWidth / 2 + 124, -13, String(ability.name || 'Ultimate').toUpperCase(), {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '27px', color: '#fff8e7', fontStyle: 'bold', fixedWidth: bannerWidth - 145, wordWrap: { width: bannerWidth - 145 }
    }).setOrigin(0, 0.5);
    const sub = scene.add.text(-bannerWidth / 2 + 124, 28, side === 'player' ? 'TUYỆT KỸ · POW CỦA BẠN' : 'TUYỆT KỸ · POW ĐỐI THỦ', {
      fontFamily: COMBAT_BODY_FONT, fontSize: '14px', color: side === 'player' ? '#8eeaff' : '#ffb18d', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    banner.add([plate, accent, icon, name, sub]);

    if (!reducedMotion()) scene.cameras.main.flash(85, 255, 232, 166, false);
    const hold = reducedMotion() ? 120 : 360;
    await Promise.all([
      tween(scene, { targets: overlay, alpha: 1, duration: reducedMotion() ? 70 : 120, yoyo: true, hold, ease: 'Sine.easeOut' }),
      tween(scene, { targets: flare, scaleX: 1, duration: reducedMotion() ? 100 : 190, yoyo: true, hold: reducedMotion() ? 20 : 110, ease: 'Cubic.easeOut' }),
      tween(scene, { targets: sigil, scaleX: 1.18, scaleY: 1.18, rotation: reducedMotion() ? 0 : 0.35, alpha: 0, duration: reducedMotion() ? 250 : 620, ease: 'Quad.easeOut' }),
      tween(scene, { targets: banner, alpha: 1, scaleX: 1, scaleY: 1, duration: reducedMotion() ? 100 : 160, yoyo: true, hold, ease: 'Back.easeOut' })
    ]);
    overlay.destroy(); flare.destroy(); sigil.destroy(true); banner.destroy(true);
  };

  proto.playUltimateImpact = async function combat2101UltimateImpact(
    this: { scene: Phaser.Scene },
    targetView: PowView | undefined,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    if (!targetView) return;
    const scene = this.scene;
    const p = targetView.getWorldPosition();
    const fx = finisher(scene, p.x, p.y, elementKey);
    const field = scene.add.rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, selfTargeted ? 0x73f0aa : colorFor(elementKey), 0.08).setDepth(75).setAlpha(0.58);
    if (!reducedMotion() && !selfTargeted) scene.cameras.main.shake(135, 0.0024);
    await Promise.all([
      tween(scene, { targets: fx, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: reducedMotion() ? 150 : 280, ease: 'Quad.easeOut' }),
      tween(scene, { targets: field, alpha: 0, duration: reducedMotion() ? 130 : 240, ease: 'Quad.easeOut' })
    ]);
    fx.destroy(true); field.destroy();
  };

  root.POWDER_COMBAT2_ULTIMATE_FX = { version: '2.10.1', lowFx: lowFx(), reducedMotion: reducedMotion() };
}
