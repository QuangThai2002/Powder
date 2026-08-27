import type Phaser from 'phaser';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2109BattleEndInstalled';
const finishedScenes = new WeakSet<object>();

function countLiving(scene: any, side: 'player' | 'enemy'): number {
  try { return Number(scene?.combatState?.living?.(side)?.length || 0); }
  catch { return 0; }
}

export function installCombat2109BattleEndPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalFinish = proto.finishBattle;
  if (typeof originalFinish !== 'function') return;

  proto.finishBattle = function combat2109FinishBattle(this: Phaser.Scene & any): void {
    if (finishedScenes.has(this)) return;
    finishedScenes.add(this);

    originalFinish.call(this);

    const playerLiving = countLiving(this, 'player');
    const enemyLiving = countLiving(this, 'enemy');
    const win = playerLiving > 0 && enemyLiving === 0;
    const { width, height } = this.scale;

    try { this.input?.setDefaultCursor?.('default'); } catch { /* noop */ }
    try { this.stopBattleMusic?.(); } catch { /* noop */ }

    const overlay = this.add.container(0, 0).setDepth(140);
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.58);
    const panelWidth = Math.min(620, width * 0.74);
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, 238, 0x071a27, 0.97)
      .setStrokeStyle(2, win ? 0x79e9ad : 0xff7a8c, 0.86);
    const title = this.add.text(width / 2, height / 2 - 70, win ? 'CHIẾN THẮNG' : 'THẤT BẠI', {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: '38px',
      color: win ? '#8ff0b9' : '#ff8b9a',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const summary = this.add.text(width / 2, height / 2 - 18,
      win ? `Còn ${playerLiving} Pow có thể chiến đấu` : `Đội hình đã bị hạ hoàn toàn`, {
        fontFamily: COMBAT_BODY_FONT,
        fontSize: '18px',
        color: '#d9edf5',
        fontStyle: 'bold'
      }).setOrigin(0.5);

    const button = this.add.rectangle(width / 2, height / 2 + 58, 210, 52, 0x0d5169, 0.98)
      .setStrokeStyle(2, 0xd7b86c, 0.78)
      .setInteractive({ useHandCursor: true });
    const buttonText = this.add.text(width / 2, height / 2 + 58, 'ĐẤU LẠI', {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: '18px',
      color: '#fff4d6',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const restart = (): void => {
      if (!button.input?.enabled) return;
      button.disableInteractive();
      try { this.tweens.killAll(); } catch { /* noop */ }
      try { this.sound?.stopAll?.(); } catch { /* noop */ }
      this.scene.restart();
    };

    button.on('pointerover', () => button.setFillStyle(0x126984, 1));
    button.on('pointerout', () => button.setFillStyle(0x0d5169, 0.98));
    button.once('pointerup', restart);
    overlay.add([shade, panel, title, summary, button, buttonText]);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 220, ease: 'Quad.easeOut' });

    this.events.once('shutdown', () => finishedScenes.delete(this));
    this.events.once('destroy', () => finishedScenes.delete(this));
  };

  root.POWDER_COMBAT2_BATTLE_END = {
    version: '2.10.9',
    mode: 'result-overlay-clean-restart',
    restart: 'scene.restart',
    cleanup: ['tweens', 'audio', 'scene-lifecycle']
  };
}
