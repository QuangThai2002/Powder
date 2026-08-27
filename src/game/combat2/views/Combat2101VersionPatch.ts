import Phaser from 'phaser';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene { startCombatFlow?: () => void; }
const PATCH_FLAG = '__powderCombat2101VersionInstalled';

export function installCombat2101VersionPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const proto = BattleSceneClass.prototype as any;
  proto.showPreBattleIntro = function combat2101Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.43);
    const plate = this.add.rectangle(width / 2, height / 2, Math.min(770, width * 0.82), 140, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
    const title = this.add.text(width / 2, height / 2 - 22, 'POWDER COMBAT 2.10.1', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 24, 'ULTIMATE CINEMATIC · NEW ROSTER · STATUS / RESERVE FX', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#ffd983', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(104);
    this.tweens.add({ targets: intro, alpha: 0, delay: 780, duration: 270, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      this.add.text(18, height - 58, '2.10.1 · ULTIMATE CINEMATIC', {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#ffe49b', fontStyle: 'bold', backgroundColor: '#04101899', padding: { x: 7, y: 4 }
      }).setOrigin(0, 1).setDepth(97).setAlpha(0.72);
    }
  };
}
