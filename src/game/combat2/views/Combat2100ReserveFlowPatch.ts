import Phaser from 'phaser';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  startCombatFlow?: () => void;
}

const PATCH_FLAG = '__powderCombat2100ReserveFlowInstalled';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const duration = typeof config.duration === 'number' ? config.duration : 180;
    const delay = typeof config.delay === 'number' ? config.delay : 0;
    const hold = typeof config.hold === 'number' ? config.hold : 0;
    const finish = (): void => { if (done) return; done = true; window.clearTimeout(timer); resolve(); };
    const timer = window.setTimeout(finish, Math.max(320, delay + duration * (config.yoyo ? 2 : 1) + hold + 260));
    try { scene.tweens.add({ ...config, onComplete: finish }); } catch { finish(); }
  });
}

async function entryGate(scene: Phaser.Scene, x: number, y: number, side: 'player' | 'enemy'): Promise<void> {
  const color = side === 'player' ? 0x75e7ff : 0xffa47b;
  const gate = scene.add.container(x, y).setDepth(67).setScale(0.55).setAlpha(0.2);
  gate.add([
    scene.add.ellipse(0, 54, 150, 36, color, 0.08).setStrokeStyle(4, color, 0.78),
    scene.add.circle(0, 0, 72, 0x000000, 0).setStrokeStyle(4, color, 0.72),
    scene.add.circle(0, 0, 48, 0x000000, 0).setStrokeStyle(2, 0xffffff, 0.36)
  ]);
  if (!reducedMotion()) {
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI * 2 * i / 6;
      gate.add(scene.add.rectangle(Math.cos(a) * 72, Math.sin(a) * 72, 30, 4, color, 0.62).setRotation(a));
    }
  }
  await tween(scene, { targets: gate, scaleX: 1.15, scaleY: 1.15, alpha: 0.88, duration: reducedMotion() ? 100 : 180, yoyo: true, hold: reducedMotion() ? 20 : 70, ease: 'Back.easeOut' });
  gate.destroy(true);
}

function label(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const t = scene.add.text(x, y, text, {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '24px', color, fontStyle: 'bold',
    stroke: '#041018', strokeThickness: 6, backgroundColor: '#06111ccc', padding: { x: 12, y: 7 }
  }).setOrigin(0.5).setDepth(80).setScale(0.88);
  scene.tweens.add({ targets: t, y: y - 30, scaleX: 1, scaleY: 1, alpha: 0, delay: 260, duration: reducedMotion() ? 420 : 720, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
}

export function installCombat2100ReserveFlowPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const powProto = PowViewClass.prototype as any;
  const originalEnter = powProto.enterField;
  const originalRetire = powProto.retireFromField;

  powProto.enterField = async function combat2100EnterField(this: any, x: number, y: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const side = (this.side || 'player') as 'player' | 'enemy';
    label(scene, x, side === 'enemy' ? y + 118 : y - 118, 'TIẾP VIỆN', side === 'player' ? '#8eeaff' : '#ffb18d');
    await Promise.all([
      entryGate(scene, x, y, side),
      Promise.resolve(originalEnter.call(this, x, y))
    ]);
    if (!reducedMotion()) scene.cameras.main.flash(80, side === 'player' ? 110 : 255, side === 'player' ? 220 : 170, side === 'player' ? 255 : 120, false);
  };

  powProto.retireFromField = async function combat2100RetireField(this: any, x: number, y: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const side = (this.side || 'player') as 'player' | 'enemy';
    const color = side === 'player' ? 0x78ddf0 : 0xff9270;
    label(scene, p.x, p.y - 100, 'HẠ GỤC', '#ff7385');
    const slash = scene.add.container(p.x, p.y).setDepth(70).setAlpha(0.85);
    slash.add([
      scene.add.rectangle(0, 0, 180, 7, 0xff6478, 0.74).setRotation(0.66),
      scene.add.rectangle(0, 0, 180, 5, color, 0.54).setRotation(-0.66),
      scene.add.circle(0, 0, 70, 0x000000, 0).setStrokeStyle(4, 0xff6478, 0.58)
    ]);
    const collapse = tween(scene, { targets: slash, scaleX: 1.42, scaleY: 1.42, alpha: 0, duration: reducedMotion() ? 120 : 220, ease: 'Quad.easeOut' });
    if (!reducedMotion()) scene.cameras.main.shake(90, 0.0015);
    await Promise.all([collapse, Promise.resolve(originalRetire.call(this, x, y))]);
    slash.destroy(true);
  };

  const sceneProto = BattleSceneClass.prototype as any;
  sceneProto.showPreBattleIntro = function combat2100Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.43);
    const plateWidth = Math.min(760, width * 0.81);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 138, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
    const title = this.add.text(width / 2, height / 2 - 21, 'POWDER COMBAT 2.10.0', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 23, 'NEW TEST ROSTER · KO / RESERVE FLOW · STATUS FX', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#8eeaff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(102);
    this.tweens.add({ targets: intro, alpha: 0, delay: 800, duration: 280, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
  };

  root.POWDER_COMBAT2_RESERVE_FX = { version: '2.10.0', reducedMotion: reducedMotion() };
}
