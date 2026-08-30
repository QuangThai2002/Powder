import Phaser from 'phaser';
import type { CombatUnitState } from '../systems/CombatState';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene { startCombatFlow?: () => void; }
const PATCH_FLAG = '__powderCombat2102ArenaFocusInstalled';
const ACTIVE_SCALE = 0.86;
const BENCH_SCALE = 0.44;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function installCombat2102ArenaFocusPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const sceneProto = BattleSceneClass.prototype as any;
  sceneProto.activePosition = function combat2102ActivePosition(this: Phaser.Scene, side: 'player' | 'enemy', fieldSlot: number): Phaser.Math.Vector2 {
    const width = Number(this.scale.width || 1600);
    const height = Number(this.scale.height || 900);
    const portrait = height > width;
    const slot = Phaser.Math.Clamp(Math.floor(Number(fieldSlot) || 0), 0, 2);

    // Keep the three active cards in one readable centre cluster. Percentage columns
    // pushed the outer cards too close to the screen edges on 1600x900 displays.
    const spacing = portrait
      ? Phaser.Math.Clamp(width * 0.235, 205, 265)
      : Phaser.Math.Clamp(width * 0.205, 300, 345);
    const x = width / 2 + (slot - 1) * spacing;
    const edgeY = portrait
      ? Phaser.Math.Clamp(height * 0.195, 174, 210)
      : Phaser.Math.Clamp(height * 0.185, 158, 172);
    const y = side === 'enemy' ? edgeY : height - edgeY;
    return new Phaser.Math.Vector2(x, y);
  };

  sceneProto.reservePosition = function combat2102ReservePosition(this: Phaser.Scene, side: 'player' | 'enemy', reserveIndex: number): Phaser.Math.Vector2 {
    const width = Number(this.scale.width || 1600);
    const height = Number(this.scale.height || 900);
    const portrait = height > width;
    const index = Phaser.Math.Clamp(Math.floor(Number(reserveIndex) || 0), 0, 1);
    const inset = portrait
      ? Phaser.Math.Clamp(width * 0.15, 82, 122)
      : Phaser.Math.Clamp(width * 0.105, 138, 180);
    const edgeY = portrait
      ? Phaser.Math.Clamp(height * 0.12, 108, 132)
      : Phaser.Math.Clamp(height * 0.112, 96, 108);
    const x = index === 0 ? inset : width - inset;
    const y = side === 'enemy' ? edgeY : height - edgeY;
    return new Phaser.Math.Vector2(x, y);
  };

  const powProto = PowViewClass.prototype as any;
  const originalUpdate = powProto.updateRuntime;
  const originalBench = powProto.setBenchScale;
  const originalEnter = powProto.enterField;

  powProto.updateRuntime = function combat2102UpdateRuntime(this: any, unit: CombatUnitState): void {
    originalUpdate.call(this, unit);
    if (!this.container?.active) return;
    const portrait = this.scene?.scale?.height > this.scene?.scale?.width;
    const activeScale = portrait ? 0.72 : ACTIVE_SCALE;
    const benchScale = portrait ? 0.39 : BENCH_SCALE;
    if (unit.fieldSlot === null) this.container.setScale(benchScale);
    else if (!this.scene?.tweens?.isTweening?.(this.container)) this.container.setScale(activeScale);
  };

  powProto.setBenchScale = function combat2102BenchScale(this: any, _scale: number): void {
    const portrait = this.scene?.scale?.height > this.scene?.scale?.width;
    originalBench.call(this, portrait ? 0.39 : BENCH_SCALE);
  };

  powProto.enterField = async function combat2102EnterField(this: any, x: number, y: number): Promise<void> {
    await Promise.resolve(originalEnter.call(this, x, y));
    const portrait = this.scene?.scale?.height > this.scene?.scale?.width;
    const scale = portrait ? 0.72 : ACTIVE_SCALE;
    if (this.container?.active) {
      if (reducedMotion()) this.container.setScale(scale);
      else {
        await new Promise<void>((resolve) => {
          this.scene.tweens.add({ targets: this.container, scaleX: scale, scaleY: scale, duration: 120, ease: 'Sine.easeOut', onComplete: () => resolve() });
        });
      }
    }
  };

  const originalCreate = sceneProto.create;
  sceneProto.create = function combat2102Create(this: PatchableScene): void {
    originalCreate.call(this);
    const { width, height } = this.scale;
    const center = this.add.container(width / 2, height / 2).setDepth(-16).setAlpha(0.68);
    center.add([
      this.add.ellipse(0, 0, Math.min(790, width * 0.52), Math.min(250, height * 0.3), 0x061c28, 0.18).setStrokeStyle(2, 0x8edfff, 0.16),
      this.add.circle(0, 0, Math.min(104, height * 0.12), 0x000000, 0).setStrokeStyle(2, 0xd7b86c, 0.18),
      this.add.rectangle(0, 0, Math.min(640, width * 0.42), 2, 0xd7b86c, 0.13)
    ]);
  };

  sceneProto.showPreBattleIntro = function combat2102Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.42);
    const plate = this.add.rectangle(width / 2, height / 2, Math.min(770, width * 0.82), 140, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
    const title = this.add.text(width / 2, height / 2 - 22, 'POWDER COMBAT 2.10.2', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 24, 'ARENA FOCUS · COMPACT CARDS · FULL ACTION SPACE', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#8eeaff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(105);
    this.tweens.add({ targets: intro, alpha: 0, delay: 760, duration: 265, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      this.add.text(width - 18, height - 18, '2.10.2 · ARENA FOCUS', {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#bfefff', fontStyle: 'bold', backgroundColor: '#04101899', padding: { x: 7, y: 4 }
      }).setOrigin(1, 1).setDepth(98).setAlpha(0.72);
    }
  };

  root.POWDER_COMBAT2_ARENA_FOCUS = {
    version: 'night-40-centered-cluster',
    activeScale: ACTIVE_SCALE,
    benchScale: BENCH_SCALE,
    landscapeSpacing: '20.5%-clamped-300-345',
    symmetricRows: true,
    reserveInsetsSafe: true
  };
}
