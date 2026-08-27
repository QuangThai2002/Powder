import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import { abilityHasLegalTarget } from '../systems/CombatAbilityTargeting';
import type { CombatUnitState } from '../systems/CombatState';
import { ACTION_BASE_RAW_GAIN } from '../systems/CombatRageEngine';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  combatState: any;
  skillActions: any;
  actionMenu: Phaser.GameObjects.Container | null;
  pendingPlayerAction: unknown;
  flowStarted: boolean;
  destroyActionMenu: () => void;
  destroyUndoMenu: () => void;
  clearTargeting: () => void;
  startCombatFlow: () => void;
  beginPlayerActionSelection: (actor: CombatUnitState, action: 'basic' | 0 | 1 | 'ultimate') => void;
  abilityResourceText: (actor: CombatUnitState, ability: CombatAbility, slot: 0 | 1 | 'ultimate') => string;
  abilityTag: (ability: CombatAbility) => string;
}

interface PatchablePowView {
  scene: Phaser.Scene;
  pow: any;
  side: string;
  cardWidth: number;
  cardHeight: number;
  barWidth: number;
  container: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  statusFrame: Phaser.GameObjects.Rectangle;
  combat27StatusIcons?: Phaser.GameObjects.Container;
  combat27ShieldBar?: Phaser.GameObjects.Rectangle;
  combat27ShieldFrame?: Phaser.GameObjects.Rectangle;
}

const PATCH_FLAG = '__powderCombat27UiInstalled';
const STATUS_ICON_SIZE = 18;
const STATUS_ICON_GAP = 5;

function normalize(value: unknown): string {
  return String(value || '').replace(/^self:/i, '').trim().toLowerCase();
}

function targetLabel(ability: CombatAbility): string {
  const target = normalize(ability.target);
  if (target === 'self') return 'Bản thân';
  if (target.includes('all') || ability.area) return 'Nhiều mục tiêu';
  if (target.includes('ally') || target.includes('team')) return 'Đồng minh';
  return '1 mục tiêu';
}

function statusExplanation(ability: CombatAbility): string {
  const status = normalize(ability.status);
  if (!status) return '';
  const map: Record<string, string> = {
    shield: 'Tạo Khiên ≈20% HP tối đa, chịu ảnh hưởng Shield Power.',
    regeneration: 'Hồi ≈10% HP ngay và duy trì Hồi Phục 2 lượt.',
    'attack up': 'Tăng 30% ATK trong 3 lượt.',
    'ap up': 'Tăng 30% AP trong 3 lượt.',
    'defense up': 'Tăng 30% DEF trong 3 lượt.',
    'speed up': 'Tăng tốc độ trong 2 lượt.',
    'effect resist': 'Tăng 20 Kháng Hiệu Ứng trong 2 lượt.',
    guard: 'Bảo Hộ: giảm 25% sát thương nhận trong thời gian hiệu lực.',
    'crit up': 'Tăng 15% tỉ lệ Chí mạng trong 2 lượt.',
    'evasion up': 'Tăng 15% Né tránh trong 2 lượt.',
    'attack down': 'Giảm 20% ATK mục tiêu trong 2 lượt.',
    'ap down': 'Giảm 20% AP mục tiêu trong 2 lượt.',
    'defense down': 'Giảm 20% DEF mục tiêu trong 2 lượt.',
    'accuracy down': 'Giảm Chính xác mục tiêu trong 2 lượt.',
    'anti heal': 'Giảm hiệu quả hồi máu của mục tiêu.',
    burn: 'Thiêu Đốt gây sát thương theo lượt; có thể tồn tại cùng Độc.',
    poison: 'Độc cộng tối đa 3 tầng, gây sát thương và giảm hồi máu.',
    slow: 'Giảm 20% Tốc độ trong 2 lượt.',
    silence: 'Câm lặng: chỉ được dùng Đòn cơ bản trong lượt bị ảnh hưởng.',
    stun: 'Choáng: có tỉ lệ theo phẩm chất, mất 1 lượt khi trúng.',
    paralysis: 'Tê liệt 2 lượt; mỗi lượt có 30% khả năng mất hành động.',
    freeze: 'Làm lạnh → Tê cóng → Đóng băng; Phá Băng nhận +30% sát thương.',
    cleanse: 'Thanh Tẩy toàn bộ hiệu ứng xấu đang hỗ trợ.',
    purify: 'Thanh Tẩy toàn bộ hiệu ứng xấu đang hỗ trợ.',
    revive: 'Hồi sinh đồng minh đã gục với 35% HP tối đa.',
    resurrection: 'Hồi sinh đồng minh đã gục với 35% HP tối đa.',
    'rage gain': 'Nhận thêm 1 Nộ thô ngoài Nộ cơ bản của hành động.'
  };
  return map[status] ?? status.toUpperCase();
}

function abilityDescription(ability: CombatAbility): { primary: string; secondary: string } {
  const type = normalize(ability.type);
  const coefficient = Math.max(0, Math.round(Number(ability.power) || 0));
  let primary = '';
  if (type === 'physical') primary = `Hệ số ${coefficient}% ATK · ${targetLabel(ability)}.`;
  else if (type === 'support') primary = `Hỗ trợ · ${targetLabel(ability)}.`;
  else if (type === 'debuff') primary = `Hiệu ứng / Khống chế · ${targetLabel(ability)}.`;
  else primary = `Hệ số ${coefficient}% AP · ${targetLabel(ability)}.`;
  return { primary, secondary: statusExplanation(ability) };
}

function abilityAccent(ability: CombatAbility, tag: string): number {
  const status = normalize(ability.status);
  if (tag === 'ULT') return 0xd8a857;
  if (status === 'burn') return 0xd56843;
  if (status === 'poison') return 0x86bb54;
  if (['freeze', 'slow'].includes(status)) return 0x65bfe7;
  if (['stun', 'paralysis'].includes(status)) return 0xd6bd55;
  if (status === 'silence') return 0xaa80d2;
  if (normalize(ability.type) === 'support') return 0x55b883;
  return 0x4f9fca;
}

function actionAvailability(scene: PatchableScene, actor: CombatUnitState, ability: CombatAbility, slot: 0 | 1 | 'ultimate'): boolean {
  const resourceReady = slot === 'ultimate'
    ? scene.skillActions.canUseUltimate(actor)
    : scene.skillActions.canUse(actor, slot);
  return resourceReady && abilityHasLegalTarget(ability, actor, scene.combatState.units);
}

function createSharedSkillOverlay(this: PatchableScene, actor: CombatUnitState): void {
  this.destroyActionMenu();
  this.destroyUndoMenu();
  this.clearTargeting();
  this.pendingPlayerAction = null;

  const basic = actor.pow.abilities.basic;
  const skill1 = actor.pow.abilities.skills[0];
  const skill2 = actor.pow.abilities.skills[1];
  const ultimate = actor.pow.abilities.ultimate;
  const actions = [
    { label: 'ĐÒN CƠ BẢN', ability: basic, slot: 'basic' as const, resource: `+${ACTION_BASE_RAW_GAIN} NỘ`, enabled: this.combatState.activeLiving('enemy').length > 0 },
    { label: 'KỸ NĂNG I', ability: skill1, slot: 0 as const, resource: this.abilityResourceText(actor, skill1, 0), enabled: actionAvailability(this, actor, skill1, 0) },
    { label: 'KỸ NĂNG II', ability: skill2, slot: 1 as const, resource: this.abilityResourceText(actor, skill2, 1), enabled: actionAvailability(this, actor, skill2, 1) },
    { label: 'TUYỆT KỸ', ability: ultimate, slot: 'ultimate' as const, resource: this.abilityResourceText(actor, ultimate, 'ultimate'), enabled: actionAvailability(this, actor, ultimate, 'ultimate') }
  ];

  const width = this.scale.width;
  const height = this.scale.height;
  const overlayTop = Math.round(height * 0.605);
  const overlayBottom = height - 6;
  const overlayHeight = overlayBottom - overlayTop;
  const centerY = overlayTop + overlayHeight / 2;
  const menu = this.add.container(0, 0).setDepth(72);

  // The overlay owns the same screen band as the three player Pow. Nothing is moved.
  const dim = this.add.rectangle(width / 2, centerY, width, overlayHeight, 0x02080e, 0.76);
  const topFade = this.add.rectangle(width / 2, overlayTop + 9, width, 18, 0x08131d, 0.5);
  const title = this.add.text(width / 2, overlayTop + 24, 'CHỌN KỸ NĂNG', {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '25px', color: '#fff1c6', fontStyle: 'bold', stroke: '#06111c', strokeThickness: 4
  }).setOrigin(0.5);
  menu.add([dim, topFade, title]);

  const margin = 36;
  const gap = 14;
  const cardWidth = Math.min(366, (width - margin * 2 - gap * 3) / 4);
  const cardHeight = Math.min(278, overlayHeight - 64);
  const rowWidth = cardWidth * 4 + gap * 3;
  const startX = width / 2 - rowWidth / 2 + cardWidth / 2;
  const cardY = overlayTop + 56 + cardHeight / 2;

  actions.forEach((action, index) => {
    const ability = action.ability;
    const tag = action.slot === 'basic' ? 'ATK' : action.slot === 'ultimate' ? 'ULT' : this.abilityTag(ability);
    const accent = abilityAccent(ability, tag);
    const x = startX + index * (cardWidth + gap);
    const bg = this.add.rectangle(x, cardY, cardWidth, cardHeight, 0x07131f, action.enabled ? 0.96 : 0.78)
      .setStrokeStyle(action.enabled ? 2 : 1, action.enabled ? accent : 0x59636a, action.enabled ? 0.9 : 0.45);
    const iconY = cardY - cardHeight / 2 + 53;
    const iconPlate = this.add.circle(x, iconY, 38, 0x06111a, 0.94).setStrokeStyle(2, accent, action.enabled ? 0.9 : 0.35);
    let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (ability.iconKey && this.textures.exists(ability.iconKey)) {
      icon = this.add.image(x, iconY, ability.iconKey).setDisplaySize(66, 66).setAlpha(action.enabled ? 1 : 0.4);
      if (!action.enabled && icon instanceof Phaser.GameObjects.Image) icon.setTint(0x69777f);
    } else {
      icon = this.add.text(x, iconY, action.slot === 'ultimate' ? '✦' : action.slot === 'basic' ? '◆' : String(Number(action.slot) + 1), {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: '30px', color: action.enabled ? '#ffffff' : '#7c878c', fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    const headerY = cardY - cardHeight / 2 + 96;
    const header = this.add.text(x, headerY, `${action.label} · ${tag}`, {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '16px', color: action.enabled ? '#fff5da' : '#929da2', fontStyle: 'bold', fixedWidth: cardWidth - 24, align: 'center'
    }).setOrigin(0.5, 0);
    const name = this.add.text(x, headerY + 27, String(ability.name || ''), {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '18px', color: action.enabled ? '#d8eff5' : '#7d898e', fontStyle: 'bold', fixedWidth: cardWidth - 24, align: 'center', wordWrap: { width: cardWidth - 28 }
    }).setOrigin(0.5, 0);

    const desc = abilityDescription(ability);
    const bodyY = headerY + 62;
    const primary = this.add.text(x - cardWidth / 2 + 14, bodyY, desc.primary, {
      fontFamily: COMBAT_BODY_FONT, fontSize: '16px', color: action.enabled ? '#eef7f8' : '#78858b', fixedWidth: cardWidth - 28, wordWrap: { width: cardWidth - 28 }, lineSpacing: 3
    });
    const secondary = this.add.text(x - cardWidth / 2 + 14, bodyY + 42, desc.secondary, {
      fontFamily: COMBAT_BODY_FONT, fontSize: '14px', color: action.enabled ? '#b9d5dc' : '#6f7b80', fixedWidth: cardWidth - 28, wordWrap: { width: cardWidth - 28 }, lineSpacing: 2
    });
    const resource = this.add.text(x, cardY + cardHeight / 2 - 20, action.resource, {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '14px', color: action.enabled ? '#7de6ff' : '#d09292', fontStyle: 'bold', fixedWidth: cardWidth - 24, align: 'center'
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, cardY, cardWidth, cardHeight, 0xffffff, 0.001);
    if (action.enabled) {
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => bg.setScale(1.012).setStrokeStyle(3, accent, 1));
      hit.on('pointerout', () => bg.setScale(1).setStrokeStyle(2, accent, 0.9));
      hit.once('pointerup', () => this.beginPlayerActionSelection(actor, action.slot));
    }
    menu.add([bg, iconPlate, icon, header, name, primary, secondary, resource, hit]);
  });

  this.actionMenu = menu;
}

interface StatusToken { glyph: string; color: number; label: string; }

function runtimeStatusTokens(unit: any): StatusToken[] {
  const tokens: StatusToken[] = [];
  const push = (active: boolean, glyph: string, color: number, label: string): void => { if (active) tokens.push({ glyph, color, label }); };

  push(unit.controlImmunityActionsRemaining > 0, '◇', 0x76eaf5, 'Miễn Khống');
  push(unit.controlActionsRemaining > 0 && unit.controlStatus === 'freeze', '❄', 0x75d7ff, 'Đóng Băng');
  push(unit.controlActionsRemaining > 0 && unit.controlStatus !== 'freeze', '!', 0xf0cf58, 'Choáng');
  push(unit.silenceActionsRemaining > 0, '×', 0xb48bdf, 'Câm Lặng');
  push(unit.paralysisActionsRemaining > 0, 'ϟ', 0xf0d25f, 'Tê Liệt');
  push(unit.freezeStage === 2 && unit.freezeStageActionsRemaining > 0, '❄', 0x8bc9ec, 'Tê Cóng');
  push(unit.freezeStage === 1 && unit.freezeStageActionsRemaining > 0, '❄', 0xb7e8ff, 'Làm Lạnh');
  push(unit.burnActionsRemaining > 0, '♨', 0xee7146, 'Thiêu Đốt');
  push(unit.poisonActionsRemaining > 0, '☠', 0x8fcb5c, `Độc ×${Math.max(1, unit.poisonStacks || 1)}`);
  push(unit.speedDebuffActionsRemaining > 0, '↓', 0x6b91db, 'Chậm');
  push(unit.antiHealActionsRemaining > 0 && unit.antiHeal > 0, '✚', 0xe56f83, 'Giảm Hồi Máu');
  push(unit.attackBuffActionsRemaining > 0 && unit.attackMultiplier < 1, 'A↓', 0xe77986, 'Giảm ATK');
  push(unit.abilityPowerBuffActionsRemaining > 0 && unit.abilityPowerMultiplier < 1, 'P↓', 0xe77986, 'Giảm AP');
  push(unit.defenseBuffActionsRemaining > 0 && unit.defenseMultiplier < 1, 'D↓', 0xe77986, 'Giảm DEF');
  push(unit.accuracyDebuffActionsRemaining > 0 && unit.accuracyBonus < 0, '◎↓', 0xe77986, 'Giảm Chính Xác');
  push(unit.regenerationActionsRemaining > 0, '✚', 0x5dd69b, 'Hồi Phục');
  push(unit.guardActionsRemaining > 0 && unit.damageReductionBonus > 0, '◇', 0x70bfe6, 'Bảo Hộ');
  push(unit.tenacityBuffActionsRemaining > 0 && unit.tenacityBonus > 0, '◈', 0x6adbe3, 'Kháng Hiệu Ứng');
  push(unit.critBuffActionsRemaining > 0 && unit.critRateBonus > 0, '✦', 0xe9bb55, 'Tăng Chí Mạng');
  push(unit.evasionBuffActionsRemaining > 0 && unit.evasionBonus > 0, '◌', 0x73d5d4, 'Tăng Né');
  push(unit.attackBuffActionsRemaining > 0 && unit.attackMultiplier > 1, 'A↑', 0xe3aa55, 'Tăng ATK');
  push(unit.abilityPowerBuffActionsRemaining > 0 && unit.abilityPowerMultiplier > 1, 'P↑', 0xc095e7, 'Tăng AP');
  push(unit.defenseBuffActionsRemaining > 0 && unit.defenseMultiplier > 1, 'D↑', 0x6ebfe2, 'Tăng DEF');
  push(unit.speedBuffActionsRemaining > 0, '↑', 0x75d9c7, 'Tăng Tốc');
  return tokens.slice(0, 7);
}

function installPowHudPatch(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const originalBuild = proto.build;
  const originalUpdateRuntime = proto.updateRuntime;
  if (typeof originalBuild !== 'function' || typeof originalUpdateRuntime !== 'function') return;

  proto.build = function patchedBuild(this: PatchablePowView): void {
    originalBuild.call(this);
    const w = this.cardWidth;
    const h = this.cardHeight;
    const top = -h / 2;
    const left = -w / 2;
    const footerHeight = 108;
    const artHeight = h - footerHeight - 14;
    const infoY = top + artHeight + 15;
    const hpY = infoY + 53;

    const statusY = infoY - 16;
    this.combat27StatusIcons = this.scene.add.container(0, statusY);
    this.container.add(this.combat27StatusIcons);

    // Shield is virtual HP around the real HP bar, never a separate status icon.
    this.combat27ShieldBar = this.scene.add.rectangle(left + 9, hpY, this.barWidth + 6, 23, 0x5ed6ff, 0.18).setOrigin(0, 0.5).setVisible(false);
    this.combat27ShieldFrame = this.scene.add.rectangle(0, hpY, this.barWidth + 8, 25, 0x000000, 0).setStrokeStyle(2, 0x7fe6ff, 0.92).setVisible(false);
    this.container.addAt(this.combat27ShieldBar, Math.max(0, this.container.getIndex(this.hpBar)));
    this.container.add(this.combat27ShieldFrame);
  };

  proto.updateRuntime = function patchedUpdateRuntime(this: PatchablePowView, unit: CombatUnitState): void {
    originalUpdateRuntime.call(this, unit);

    if (unit.alive && this.statusText) this.statusText.setVisible(false);
    if (unit.alive && this.statusFrame) {
      const hard = unit.controlImmunityActionsRemaining > 0 || unit.controlActionsRemaining > 0;
      this.statusFrame.setVisible(hard);
    }

    const shield = Math.max(0, Number(unit.shield) || 0);
    const maxHp = Math.max(1, Number(unit.pow.maxHp) || 1);
    const shieldRatio = Phaser.Math.Clamp(shield / maxHp, 0, 0.8);
    const hasShield = unit.alive && shield > 0;
    if (this.combat27ShieldBar) {
      this.combat27ShieldBar.setVisible(hasShield);
      this.combat27ShieldBar.displayWidth = Math.max(0.01, (this.barWidth + 6) * Math.max(0.12, shieldRatio));
      this.combat27ShieldBar.setAlpha(0.22 + shieldRatio * 0.36);
    }
    this.combat27ShieldFrame?.setVisible(hasShield);

    const iconRow = this.combat27StatusIcons;
    if (!iconRow) return;
    iconRow.removeAll(true);
    if (!unit.alive || unit.fieldSlot === null) { iconRow.setVisible(false); return; }
    const tokens = runtimeStatusTokens(unit);
    iconRow.setVisible(tokens.length > 0);
    const total = tokens.length * STATUS_ICON_SIZE * 2 + Math.max(0, tokens.length - 1) * STATUS_ICON_GAP;
    let x = -total / 2 + STATUS_ICON_SIZE;
    tokens.forEach((token) => {
      const circle = this.scene.add.circle(x, 0, STATUS_ICON_SIZE, 0x07131d, 0.96).setStrokeStyle(2, token.color, 0.95);
      const glyph = this.scene.add.text(x, 0, token.glyph, {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: token.glyph.length > 1 ? '10px' : '16px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      circle.setData('statusLabel', token.label);
      iconRow.add([circle, glyph]);
      x += STATUS_ICON_SIZE * 2 + STATUS_ICON_GAP;
    });
  };
}

function showPreBattleIntro270(this: PatchableScene): void {
  const { width, height } = this.scale;
  const portrait = height > width;
  const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.44);
  const plateWidth = Math.min(portrait ? 650 : 720, width * 0.8);
  const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 118, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
  const title = this.add.text(width / 2, height / 2, 'POWDER COMBAT 2.7.0', {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: portrait ? '34px' : '36px', color: '#fff6df', fontStyle: 'bold'
  }).setOrigin(0.5);
  const intro = this.add.container(0, 0, [shade, plate, title]).setDepth(100);
  this.tweens.add({ targets: intro, alpha: 0, delay: 1050, duration: 350, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow(); } });
}

export function installCombat27UiPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const battleProto = BattleSceneClass.prototype as any;
  battleProto.createActionMenu = createSharedSkillOverlay;
  battleProto.showPreBattleIntro = showPreBattleIntro270;
  installPowHudPatch(PowViewClass);
}
