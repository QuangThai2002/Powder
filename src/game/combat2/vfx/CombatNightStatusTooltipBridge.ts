import Phaser from 'phaser';
import { PowView } from '../views/PowView';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombatNightStatusTooltipBridgeInstalled';
const TOOLTIP_KEY = '__nightStatusHoverTooltip';
const TOOLTIP_STATUS_KEY = '__nightStatusHoverTooltipStatus';
const HOVER_KEY = '__nightStatusHoverActive';
const CLEANUP_KEY = '__nightStatusTooltipCleanupInstalled';

type TooltipInfo = { glyph: string; title: string; description: string };

function plain(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function infoFor(status: unknown): TooltipInfo | null {
  const text = plain(status);
  if (!text) return null;

  if (text.includes('song dot')) return {
    glyph: '✹',
    title: 'Thiêu đốt + Nhiễm độc',
    description: 'Hai hiệu ứng sát thương duy trì đang cùng tồn tại trên Pow.'
  };
  if (text.includes('nhiem doc')) return {
    glyph: '☣',
    title: 'Nhiễm độc',
    description: 'Nhận sát thương Độc duy trì; số × cho biết số cộng dồn hiện tại.'
  };
  if (text.includes('thieu dot')) return {
    glyph: '🔥',
    title: 'Thiêu đốt',
    description: 'Mất HP theo thời gian khi Thiêu đốt còn hiệu lực.'
  };
  if (text.includes('dong bang')) return {
    glyph: '❄',
    title: 'Đóng băng',
    description: 'Không thể hành động khi trạng thái Đóng băng còn hiệu lực.'
  };
  if (text.includes('choang')) return {
    glyph: '✦',
    title: 'Choáng',
    description: 'Không thể hành động trong lượt đang bị Choáng.'
  };
  if (text.includes('hoi phuc')) return {
    glyph: '✚',
    title: 'Hồi phục',
    description: 'Tự hồi HP trong các lượt còn hiệu lực.'
  };
  if (text.startsWith('khien')) return {
    glyph: '◇',
    title: 'Khiên',
    description: 'Hấp thụ sát thương trước HP; số hiển thị là lượng Khiên còn lại.'
  };

  if (text.includes('cam lang')) return { glyph: '⛔', title: 'Câm lặng', description: 'Không thể dùng kỹ năng bị giới hạn bởi Câm lặng.' };
  if (text.includes('te liet')) return { glyph: '⚡', title: 'Tê liệt', description: 'Bị khống chế và có thể mất quyền hành động.' };
  if (text.includes('lam lanh')) return { glyph: '❄', title: 'Làm lạnh', description: 'Tích tụ hiệu ứng Băng và tiến gần trạng thái Đóng băng.' };
  if (text.includes('te cong')) return { glyph: '❄', title: 'Tê cóng', description: 'Khống chế Băng mạnh; khả năng hành động bị hạn chế.' };
  if (text.includes('giam hoi mau')) return { glyph: '↓', title: 'Giảm hồi máu', description: 'Lượng HP nhận từ hồi phục bị giảm khi hiệu ứng còn tồn tại.' };
  if (text.includes('giam cong')) return { glyph: '↓', title: 'Giảm Công', description: 'Sát thương dựa trên Công bị giảm tạm thời.' };
  if (text.includes('giam ap')) return { glyph: '↓', title: 'Giảm AP', description: 'Sức mạnh kỹ năng/AP bị giảm tạm thời.' };
  if (text.includes('giam thu')) return { glyph: '↓', title: 'Giảm Thủ', description: 'Khả năng phòng thủ bị giảm và dễ nhận sát thương hơn.' };
  if (text.includes('giam chinh xac')) return { glyph: '◎', title: 'Giảm chính xác', description: 'Độ chính xác giảm, tăng nguy cơ đòn đánh không trúng.' };
  if (text === 'cham' || text.includes('cham')) return { glyph: '⌛', title: 'Chậm', description: 'Tốc độ bị giảm trong thời gian hiệu lực.' };
  return null;
}

function clearTooltip(view: any, resetHover = false): void {
  const tooltip = view[TOOLTIP_KEY] as Phaser.GameObjects.Text | undefined;
  if (tooltip?.scene) tooltip.destroy();
  view[TOOLTIP_KEY] = null;
  view[TOOLTIP_STATUS_KEY] = '';
  if (resetHover) view[HOVER_KEY] = false;
}

function ensureTooltipCleanup(view: any): void {
  if (view[CLEANUP_KEY]) return;
  const scene = view.scene as Phaser.Scene | undefined;
  if (!scene?.events) return;
  let cleaned = false;

  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
    clearTooltip(view, true);
    view[CLEANUP_KEY] = false;
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  view[CLEANUP_KEY] = true;
}

function showTooltip(view: any): void {
  const info = infoFor(view.runtimeVisualStatus);
  if (!info || !view.scene?.add) {
    clearTooltip(view, false);
    return;
  }

  const scene = view.scene as Phaser.Scene;
  const statusKey = plain(view.runtimeVisualStatus);
  const p = typeof view.getVfxAnchor === 'function'
    ? view.getVfxAnchor('head') as Phaser.Math.Vector2
    : view.getWorldPosition() as Phaser.Math.Vector2;
  const existing = view[TOOLTIP_KEY] as Phaser.GameObjects.Text | undefined;

  if (existing?.active && view[TOOLTIP_STATUS_KEY] === statusKey) {
    existing.setPosition(p.x, p.y - 42);
    return;
  }

  clearTooltip(view, false);
  const tooltip = scene.add.text(p.x, p.y - 42, `${info.title}\n${info.description}`, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    color: '#eefaff',
    fontStyle: 'bold',
    backgroundColor: '#071723ee',
    padding: { x: 10, y: 8 },
    stroke: '#041018',
    strokeThickness: 2,
    wordWrap: { width: 245, useAdvancedWrap: true },
    align: 'left'
  }).setOrigin(0.5, 1).setDepth(powVfxDepth('foreground') + 7);
  view[TOOLTIP_KEY] = tooltip;
  view[TOOLTIP_STATUS_KEY] = statusKey;
}

export function installCombatNightStatusTooltipBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const proto = PowView.prototype as any;
  const previousUpdate = proto.updateRuntime;
  if (typeof previousUpdate !== 'function') return;

  proto.updateRuntime = function combatNightStatusTooltipUpdate(this: any, unit: any): void {
    previousUpdate.call(this, unit);
    const statusText = this.statusText as Phaser.GameObjects.Text | undefined;
    const info = infoFor(this.runtimeVisualStatus);
    if (!statusText?.active || !info || !unit?.alive || unit?.fieldSlot === null) {
      statusText?.disableInteractive?.();
      clearTooltip(this, true);
      return;
    }

    ensureTooltipCleanup(this);
    statusText.setText(`${info.glyph} ${this.runtimeVisualStatus}`);
    if (!(statusText as any).__nightTooltipInteractive) {
      statusText.setInteractive({ useHandCursor: true });
      statusText.on('pointerover', () => {
        this[HOVER_KEY] = true;
        showTooltip(this);
      });
      statusText.on('pointerout', () => {
        this[HOVER_KEY] = false;
        clearTooltip(this, false);
      });
      (statusText as any).__nightTooltipInteractive = true;
    } else {
      statusText.setInteractive({ useHandCursor: true });
    }

    // Runtime refresh can happen while the pointer remains over the same status label.
    // Keep one tooltip alive and only recreate it when the semantic status changes.
    if (this[HOVER_KEY]) showTooltip(this);
    else if (this[TOOLTIP_KEY]) clearTooltip(this, false);
  };

  root.POWDER_COMBAT2_NIGHT_STATUS_TOOLTIPS = {
    version: 'night-31',
    covered: [
      'burn', 'poison', 'freeze', 'stun', 'regeneration', 'shield', 'dual-dot',
      'silence', 'paralysis', 'chill', 'frostbite', 'anti-heal', 'attack-down',
      'ap-down', 'defense-down', 'accuracy-down', 'slow'
    ],
    hoverOnly: true,
    refreshStable: true,
    hoverStatePreserved: true,
    recreateOnStatusChangeOnly: true,
    sceneObjectPerHoveredPowMax: 1,
    sceneShutdownCleanup: true,
    combatLogicChanged: false
  };
}

installCombatNightStatusTooltipBridge();
