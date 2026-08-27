import Phaser from 'phaser';
import type { CombatUnitState } from '../systems/CombatState';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';
import type { PowView } from './PowView';

interface PatchableScene extends Phaser.Scene {
  startCombatFlow?: () => void;
}

interface StatusLayerState {
  signature: string;
  layer: Phaser.GameObjects.Container | null;
}

const PATCH_FLAG = '__powderCombat299StatusVisualInstalled';
const stateByView = new WeakMap<object, StatusLayerState>();

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function lowFx(): boolean {
  if (reducedMotion()) return true;
  const memory = Number((navigator as any)?.deviceMemory || 0);
  const cores = Number(navigator?.hardwareConcurrency || 0);
  return (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
}

function statusSignature(unit: CombatUnitState): string {
  if (!unit.alive || unit.fieldSlot === null) return '';
  return [
    unit.controlStatus || '', unit.controlActionsRemaining,
    unit.silenceActionsRemaining, unit.paralysisActionsRemaining,
    unit.freezeStage, unit.freezeStageActionsRemaining,
    unit.controlImmunityActionsRemaining,
    unit.burnActionsRemaining, unit.poisonStacks, unit.poisonActionsRemaining,
    unit.shield > 0 ? 1 : 0,
    unit.regenerationActionsRemaining,
    unit.antiHealActionsRemaining,
    unit.guardActionsRemaining,
    unit.attackBuffActionsRemaining, unit.abilityPowerBuffActionsRemaining,
    unit.defenseBuffActionsRemaining, unit.speedBuffActionsRemaining,
    unit.speedDebuffActionsRemaining
  ].join('|');
}

function addBurn(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const count = lowFx() ? 2 : 4;
  for (let i = 0; i < count; i += 1) {
    const x = -70 + i * (140 / Math.max(1, count - 1));
    const y = 50 - (i % 2) * 18;
    layer.add([
      scene.add.triangle(x, y, -8, 11, 0, -13, 8, 11, 0xff7043, 0.72),
      scene.add.triangle(x, y + 4, -4, 7, 0, -7, 4, 7, 0xffd06a, 0.78)
    ]);
  }
}

function addPoison(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, stacks: number): void {
  const count = lowFx() ? 2 : Math.max(2, Math.min(4, stacks + 1));
  for (let i = 0; i < count; i += 1) {
    const x = -64 + i * (128 / Math.max(1, count - 1));
    const y = -54 + (i % 2) * 24;
    layer.add(scene.add.circle(x, y, 8 + (i % 2) * 3, 0xa5df66, 0.3).setStrokeStyle(2, 0xdfff9c, 0.72));
  }
}

function addFreeze(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, hard: boolean): void {
  const alpha = hard ? 0.24 : 0.13;
  layer.add(scene.add.rectangle(0, -4, 190, 178, 0x8adfff, alpha).setStrokeStyle(hard ? 4 : 2, 0xcdf7ff, hard ? 0.72 : 0.42));
  const count = lowFx() ? 3 : 6;
  for (let i = 0; i < count; i += 1) {
    const x = -76 + i * (152 / Math.max(1, count - 1));
    const top = i % 2 === 0 ? -82 : 58;
    layer.add(scene.add.triangle(x, top, -8, 10, 0, -12, 8, 10, 0xbcefff, hard ? 0.72 : 0.46).setRotation(i % 2 ? Math.PI : 0));
  }
  if (hard) {
    layer.add([
      scene.add.rectangle(-28, -10, 5, 126, 0xe6fbff, 0.55).setRotation(0.52),
      scene.add.rectangle(34, 8, 4, 105, 0xe6fbff, 0.5).setRotation(-0.48)
    ]);
  }
}

function addStun(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, paralysis: boolean): void {
  const color = paralysis ? 0xffed76 : 0xffd95f;
  const topY = -77;
  layer.add(scene.add.ellipse(0, topY, 132, 28, 0x000000, 0).setStrokeStyle(3, color, 0.76));
  const bolts = lowFx() ? 2 : 4;
  for (let i = 0; i < bolts; i += 1) {
    const x = -56 + i * (112 / Math.max(1, bolts - 1));
    layer.add([
      scene.add.rectangle(x - 4, topY + 14, 22, 4, color, 0.82).setRotation(-0.72),
      scene.add.rectangle(x + 5, topY + 25, 20, 4, color, 0.82).setRotation(0.76)
    ]);
  }
}

function addSilence(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  layer.add([
    scene.add.circle(0, -18, 55, 0x5c367d, 0.1).setStrokeStyle(3, 0xc9a0ff, 0.72),
    scene.add.rectangle(0, -18, 112, 7, 0xc9a0ff, 0.62).setRotation(-0.72)
  ]);
}

function addShield(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, guard: boolean): void {
  const color = guard ? 0x9aeaff : 0x8edfff;
  layer.add([
    scene.add.ellipse(0, -5, 206, 188, 0x3b9fd0, guard ? 0.045 : 0.035).setStrokeStyle(guard ? 4 : 3, color, guard ? 0.72 : 0.5),
    scene.add.arc(0, -4, 86, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(335), false, 0x000000, 0).setStrokeStyle(3, 0xe7fbff, guard ? 0.56 : 0.38)
  ]);
}

function addRegen(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const count = lowFx() ? 3 : 5;
  for (let i = 0; i < count; i += 1) {
    const a = Math.PI * 2 * i / count;
    layer.add(scene.add.circle(Math.cos(a) * 76, -12 + Math.sin(a) * 66, 5, 0x73f0aa, 0.7).setStrokeStyle(1, 0xc8ffe0, 0.55));
  }
}

function addAntiHeal(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  layer.add([
    scene.add.circle(72, 54, 22, 0x4d1720, 0.72).setStrokeStyle(2, 0xff8496, 0.85),
    scene.add.rectangle(72, 54, 26, 6, 0xff8496, 0.86),
    scene.add.rectangle(72, 54, 6, 26, 0xff8496, 0.86),
    scene.add.rectangle(72, 54, 48, 5, 0xffd2d8, 0.82).setRotation(-0.72)
  ]);
}

function addImmunity(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  layer.add(scene.add.ellipse(0, -2, 218, 198, 0x000000, 0).setStrokeStyle(4, 0x8ef7ff, 0.72));
}

function addBuffMark(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, unit: CombatUnitState): void {
  const buffs = unit.attackBuffActionsRemaining + unit.abilityPowerBuffActionsRemaining + unit.defenseBuffActionsRemaining + unit.speedBuffActionsRemaining;
  if (buffs <= 0) return;
  const text = scene.add.text(-88, 62, '▲', {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '20px', color: '#ffd77b', fontStyle: 'bold', stroke: '#041018', strokeThickness: 3
  }).setOrigin(0.5);
  layer.add(text);
}

function rebuildStatusLayer(view: any, unit: CombatUnitState): void {
  const scene = view.scene as Phaser.Scene;
  const previous = stateByView.get(view);
  const signature = statusSignature(unit);
  if (previous?.signature === signature) return;
  previous?.layer?.destroy(true);

  if (!signature) {
    stateByView.set(view, { signature, layer: null });
    return;
  }

  const layer = scene.add.container(0, -48).setDepth(22);
  view.container.add(layer);
  const hardFreeze = unit.controlStatus === 'freeze' && unit.controlActionsRemaining > 0;
  const chilled = unit.freezeStage > 0 && unit.freezeStageActionsRemaining > 0;
  if (unit.burnActionsRemaining > 0) addBurn(scene, layer);
  if (unit.poisonActionsRemaining > 0 && unit.poisonStacks > 0) addPoison(scene, layer, unit.poisonStacks);
  if (hardFreeze || chilled) addFreeze(scene, layer, hardFreeze);
  if (unit.controlStatus === 'stun' && unit.controlActionsRemaining > 0) addStun(scene, layer, false);
  if (unit.paralysisActionsRemaining > 0) addStun(scene, layer, true);
  if (unit.silenceActionsRemaining > 0) addSilence(scene, layer);
  if (unit.shield > 0 || unit.guardActionsRemaining > 0) addShield(scene, layer, unit.guardActionsRemaining > 0);
  if (unit.regenerationActionsRemaining > 0) addRegen(scene, layer);
  if (unit.antiHealActionsRemaining > 0) addAntiHeal(scene, layer);
  if (unit.controlImmunityActionsRemaining > 0) addImmunity(scene, layer);
  addBuffMark(scene, layer, unit);

  layer.setScale(0.88).setAlpha(0.72);
  if (reducedMotion()) layer.setScale(1).setAlpha(0.84);
  else scene.tweens.add({ targets: layer, scaleX: 1, scaleY: 1, alpha: 0.84, duration: 150, ease: 'Back.easeOut' });
  stateByView.set(view, { signature, layer });
}

function localBadge(scene: Phaser.Scene): void {
  if (typeof location === 'undefined' || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  scene.add.text(18, scene.scale.height - 38, '2.9.9 · STATUS VISUALS', {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#bfffd5', fontStyle: 'bold', backgroundColor: '#04101899', padding: { x: 7, y: 4 }
  }).setOrigin(0, 1).setDepth(96).setAlpha(0.72);
}

export function installCombat299StatusVisualPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const powProto = PowViewClass.prototype as any;
  const originalUpdateRuntime = powProto.updateRuntime;
  powProto.updateRuntime = function combat299UpdateRuntime(this: PowView, unit: CombatUnitState): void {
    originalUpdateRuntime.call(this, unit);
    rebuildStatusLayer(this as any, unit);
  };

  const sceneProto = BattleSceneClass.prototype as any;
  const originalCreate = sceneProto.create;
  sceneProto.create = function combat299Create(this: PatchableScene): void {
    originalCreate.call(this);
    localBadge(this);
  };

  sceneProto.showPreBattleIntro = function combat299Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.42);
    const plateWidth = Math.min(740, width * 0.8);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 132, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.76);
    const title = this.add.text(width / 2, height / 2 - 18, 'POWDER COMBAT 2.9.9', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '35px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 25, 'ACTION FX · STATUS READABILITY · ADAPTIVE 60 FPS', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#9ff0c2', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(101);
    this.tweens.add({ targets: intro, alpha: 0, delay: 820, duration: 290, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
  };

  root.POWDER_COMBAT2_STATUS_FX = {
    version: '2.9.9',
    lowFx: lowFx(),
    reducedMotion: reducedMotion()
  };
}
