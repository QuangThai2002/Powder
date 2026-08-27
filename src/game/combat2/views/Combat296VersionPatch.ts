import Phaser from 'phaser';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  startCombatFlow: () => void;
}

const PATCH_FLAG = '__powderCombat296VersionInstalled';

export function installCombat296VersionPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const proto = BattleSceneClass.prototype as any;

  proto.showPreBattleIntro = function combat296Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const portrait = height > width;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.4);
    const plateWidth = Math.min(portrait ? 620 : 690, width * 0.77);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 108, 0x081d2a, 0.94)
      .setStrokeStyle(1.5, 0xd7b86c, 0.68);
    const title = this.add.text(width / 2, height / 2, 'POWDER COMBAT 2.9.6', {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: portrait ? '32px' : '34px',
      color: '#fff6df',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title]).setDepth(100);
    this.tweens.add({
      targets: intro,
      alpha: 0,
      delay: 950,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => { intro.destroy(true); this.startCombatFlow(); }
    });
  };

  const api = root.POWDER_COMBAT2_DOMAIN;
  if (api && typeof api === 'object') api.version = '2.9.6';
}
