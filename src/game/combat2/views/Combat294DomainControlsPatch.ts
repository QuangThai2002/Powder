import Phaser from 'phaser';
import type { CombatSide } from '../data/CombatPow';
import {
  LEGACY_EXPANSION_DOMAINS,
  LEGACY_SIMPLE_DOMAINS,
  combatLegacyDomainForUnit,
  type LegacyExpansionDomainId,
  type LegacySimpleDomainId
} from '../systems/CombatLegacyDomainEngine';
import type { CombatUnitState } from '../systems/CombatState';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  combatState: { sanitizeRuntimeNumbers: () => void };
  powViews: Map<string, any>;
  createActionMenu: (actor: CombatUnitState) => void;
  destroyActionMenu: () => void;
  refreshViews: () => void;
  showFloatingLabel: (view: any, label: string, color: string) => void;
  turnText: Phaser.GameObjects.Text;
  __domain294Controls?: Phaser.GameObjects.Container | null;
}

const PATCH_FLAG = '__powderCombat294DomainControlsInstalled';

function mode(): 'pve' | 'pvp' {
  return (globalThis as any).POWDER_COMBAT2_DOMAIN?.mode === 'pve' ? 'pve' : 'pvp';
}

function sideLabel(side: CombatSide): string { return side === 'player' ? 'TAMER' : 'ĐỐI THỦ'; }

function destroyControls(scene: PatchableScene): void {
  scene.__domain294Controls?.destroy(true);
  scene.__domain294Controls = null;
}

function statusText(actor: CombatUnitState): string {
  const engine = combatLegacyDomainForUnit(actor);
  if (!engine) return '';
  const snapshot = engine.snapshot(actor.side);
  if (snapshot.expansion) {
    const cfg = LEGACY_EXPANSION_DOMAINS[snapshot.expansion.id];
    return `${cfg.short} · ${snapshot.expansion.actionsRemaining} HĐ`;
  }
  if (snapshot.simpleActive) {
    const cfg = LEGACY_SIMPLE_DOMAINS[snapshot.simpleActive.id];
    return `${cfg.short} · ĐANG HIỆU LỰC`;
  }
  return `GIẢN DỊ ×${snapshot.simpleCharges}`;
}

function createButton(
  scene: PatchableScene,
  parent: Phaser.GameObjects.Container,
  y: number,
  title: string,
  detail: string,
  enabled: boolean,
  onClick: () => void
): void {
  const width = 210;
  const height = 68;
  const bg = scene.add.rectangle(0, y, width, height, enabled ? 0x102f3f : 0x1e2a31, enabled ? 0.96 : 0.72)
    .setStrokeStyle(1.5, enabled ? 0xd7b86c : 0x52616a, enabled ? 0.72 : 0.35);
  const titleText = scene.add.text(-width / 2 + 13, y - 15, title, {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: '13px',
    color: enabled ? '#fff3d1' : '#87969d',
    fontStyle: 'bold',
    fixedWidth: width - 26
  }).setOrigin(0, 0.5);
  const detailText = scene.add.text(-width / 2 + 13, y + 13, detail, {
    fontFamily: COMBAT_BODY_FONT,
    fontSize: '10px',
    color: enabled ? '#a9d5df' : '#718087',
    fixedWidth: width - 26
  }).setOrigin(0, 0.5);
  const hit = scene.add.rectangle(0, y, width, height, 0xffffff, 0.001);
  if (enabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => bg.setScale(1.018));
    hit.on('pointerout', () => bg.setScale(1));
    hit.on('pointerup', onClick);
  }
  parent.add([bg, titleText, detailText, hit]);
}

function createControls(scene: PatchableScene, actor: CombatUnitState): void {
  destroyControls(scene);
  if (actor.side !== 'player') return;
  const engine = combatLegacyDomainForUnit(actor);
  if (!engine) return;
  const snapshot = engine.snapshot(actor.side);
  if (!snapshot.equippedSimple && !snapshot.equippedExpansion) return;

  const x = Math.max(116, scene.scale.width - 118);
  const y = Math.round(scene.scale.height * 0.49);
  const panel = scene.add.container(x, y).setDepth(34);
  scene.__domain294Controls = panel;

  const plate = scene.add.rectangle(0, -91, 210, 32, 0x071a25, 0.94).setStrokeStyle(1, 0x77d9eb, 0.36);
  const header = scene.add.text(0, -91, `${sideLabel(actor.side)} · LÃNH ĐỊA`, {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#bcefff', fontStyle: 'bold'
  }).setOrigin(0.5);
  panel.add([plate, header]);

  if (snapshot.equippedSimple) {
    const id = snapshot.equippedSimple as LegacySimpleDomainId;
    const cfg = LEGACY_SIMPLE_DOMAINS[id];
    const enabled = !snapshot.simpleActive && !snapshot.expansion && snapshot.simpleCharges > 0;
    createButton(scene, panel, -48, cfg.short, `GIẢN DỊ · CÒN ${snapshot.simpleCharges}/3`, enabled, () => {
      const result = engine.activateSimple(actor.side);
      if (!result.ok) {
        scene.turnText.setText(`KHÔNG THỂ MỞ ${cfg.short} · ${result.reason}`).setColor('#ff9aa9');
        return;
      }
      scene.combatState.sanitizeRuntimeNumbers();
      scene.refreshViews();
      scene.showFloatingLabel(scene.powViews.get(actor.instanceId), `${cfg.short} · KHAI GIỚI`, '#ffe08a');
      scene.createActionMenu(actor);
    });
  }

  if (snapshot.equippedExpansion) {
    const id = snapshot.equippedExpansion as LegacyExpansionDomainId;
    const cfg = LEGACY_EXPANSION_DOMAINS[id];
    const jackpot = id === 'jackpot_bagua';
    const enabled = mode() === 'pvp' && !snapshot.expansion && (jackpot || !snapshot.expansionUsed);
    createButton(scene, panel, 27, cfg.short, cfg.kind === 'special' ? 'BÀNH TRƯỚNG · ĐẶC BIỆT' : 'BÀNH TRƯỚNG · PvP', enabled, () => {
      const result = engine.activateExpansion(actor.side, mode());
      if (!result.ok) {
        const reason = result.reason.startsWith('jackpot-miss-')
          ? `JACKPOT TRƯỢT · ${result.reason.replace('jackpot-miss-', '')}%`
          : result.reason;
        scene.turnText.setText(`${cfg.short} · ${reason}`).setColor('#ffcc8a');
        scene.createActionMenu(actor);
        return;
      }
      scene.combatState.sanitizeRuntimeNumbers();
      scene.refreshViews();
      scene.showFloatingLabel(scene.powViews.get(actor.instanceId), `BÀNH TRƯỚNG · ${cfg.short}`, '#ffd36a');
      scene.createActionMenu(actor);
    });
  }

  const status = scene.add.text(0, 78, statusText(actor), {
    fontFamily: COMBAT_BODY_FONT, fontSize: '10px', color: '#93b7c1', fixedWidth: 210, align: 'center'
  }).setOrigin(0.5);
  panel.add(status);
}

export function installCombat294DomainControlsPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const proto = BattleSceneClass.prototype as any;
  const originalCreateMenu = proto.createActionMenu;
  const originalDestroyMenu = proto.destroyActionMenu;

  proto.destroyActionMenu = function combat294DestroyMenu(this: PatchableScene): void {
    destroyControls(this);
    originalDestroyMenu.call(this);
  };

  proto.createActionMenu = function combat294CreateMenu(this: PatchableScene, actor: CombatUnitState): void {
    originalCreateMenu.call(this, actor);
    createControls(this, actor);
  };
}
