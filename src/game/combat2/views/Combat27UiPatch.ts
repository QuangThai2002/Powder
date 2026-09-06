import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import { abilityHasLegalTarget } from '../systems/CombatAbilityTargeting';
import type { CombatUnitState } from '../systems/CombatState';
import { ACTION_BASE_RAW_GAIN, ULTIMATE_RAGE_COST, canUseUltimate } from '../systems/CombatRageEngine';
import { createCombat2201UltimateReadyCircle } from '../vfx/Combat2201HighFantasyAnimeVfx';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  combatState: any;
  skillActions: any;
  actionMenu: Phaser.GameObjects.Container | null;
  pendingPlayerAction: unknown;
  flowStarted: boolean;
  roundText: Phaser.GameObjects.Text;
  turnText: Phaser.GameObjects.Text;
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
  portrait: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  statusFrame: Phaser.GameObjects.Rectangle;
  combat27StatusIcons?: Phaser.GameObjects.Container;
  combat27ShieldBar?: Phaser.GameObjects.Rectangle;
  combat27ShieldFrame?: Phaser.GameObjects.Rectangle;
  combat271UltimateReadyFx?: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
}

const PATCH_FLAG = '__powderCombat27UiInstalled';
const STATUS_ICON_SIZE = 18;
const STATUS_ICON_GAP = 5;
const ULTIMATE_READY_CIRCLE_Y_OFFSET = 20;
const ULTIMATE_READY_RAGE = ULTIMATE_RAGE_COST;

function normalize(value: unknown): string {
  return String(value || '').replace(/^self:/i, '').trim().toLowerCase();
}

function normalizedElement(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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

interface ElementVisual {
  key: 'fire' | 'lava' | 'water' | 'ice' | 'lightning' | 'storm' | 'leaf' | 'poison' | 'earth' | 'wind' | 'steel' | 'light' | 'dark' | 'generic';
  color: number;
  secondary: number;
}

function elementVisual(pow: any): ElementVisual {
  const key = normalizedElement(`${pow?.elementKey || ''} ${pow?.element || ''}`);
  if (key.includes('dung nham') || key.includes('lava')) return { key: 'lava', color: 0xff4f2e, secondary: 0xffb05f };
  if (key.includes('lua') || key.includes('fire')) return { key: 'fire', color: 0xff7043, secondary: 0xffc16f };
  if (key.includes('nuoc') || key.includes('water')) return { key: 'water', color: 0x4db9ff, secondary: 0xa0e6ff };
  if (key.includes('bang') || key.includes('ice')) return { key: 'ice', color: 0x8adfff, secondary: 0xe6fbff };
  if (key.includes('set') || key.includes('lightning') || key.includes('electric')) return { key: 'lightning', color: 0xf5dd62, secondary: 0xfff6a8 };
  if (key.includes('bao') || key.includes('storm')) return { key: 'storm', color: 0x78a9ff, secondary: 0xc9d8ff };
  if (key.includes('la') || key.includes('leaf') || key.includes('nature')) return { key: 'leaf', color: 0x72d67f, secondary: 0xc8f6aa };
  if (key.includes('doc') || key.includes('poison')) return { key: 'poison', color: 0xa5df66, secondary: 0xd9ff9b };
  if (key.includes('dat') || key.includes('earth')) return { key: 'earth', color: 0xb78c5d, secondary: 0xe0bb86 };
  if (key.includes('gio') || key.includes('wind')) return { key: 'wind', color: 0x76e4d2, secondary: 0xc9fff5 };
  if (key.includes('thep') || key.includes('steel')) return { key: 'steel', color: 0xc3d3dc, secondary: 0xf2f7fa };
  if (key.includes('anh sang') || key.includes('light')) return { key: 'light', color: 0xffefad, secondary: 0xffffff };
  if (key.includes('bong toi') || key.includes('dark')) return { key: 'dark', color: 0xa88cf2, secondary: 0xdbc9ff };
  return { key: 'generic', color: 0xd8a857, secondary: 0xffe3a0 };
}

function addUltimateReadyFx(view: PatchablePowView): Phaser.GameObjects.Container {
  const worldAnchor = view.getVfxAnchor?.('body');
  const x = worldAnchor?.x ?? view.container.x;
  const y = (worldAnchor?.y ?? view.container.y - 42) + ULTIMATE_READY_CIRCLE_Y_OFFSET;
  // This is a world-space halo, deliberately wider than the card rather than
  // an in-card portrait decoration. It sits below every PowView at depth -1.
  const visualDiameter = Math.min(view.cardWidth * 1.18, view.cardHeight * 1.08);
  const fx = createCombat2201UltimateReadyCircle({
    scene: view.scene,
    x,
    y,
    rarity: String(view.pow?.rarity || ''),
    element: view.pow?.elementKey || view.pow?.element,
    visualDiameter,
    reducedMotion: Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  });
  // Scene-level display list prevents card/container clipping and ensures the
  // halo remains entirely behind the card foreground and its HUD.
  fx.setDepth(-1);
  view.container.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (fx.active) fx.destroy(true);
  });
  return fx;
}

function syncUltimateReadyFxPosition(view: PatchablePowView): void {
  const fx = view.combat271UltimateReadyFx;
  if (!fx?.active) return;
  const anchor = view.getVfxAnchor?.('body');
  fx.setPosition(anchor?.x ?? view.container.x, (anchor?.y ?? view.container.y - 42) + ULTIMATE_READY_CIRCLE_Y_OFFSET);
}

interface ActionAvailability {
  enabled: boolean;
  resource: string;
}

function lockedAction(reason: string): ActionAvailability {
  return { enabled: false, resource: `KHÓA · ${reason}` };
}

function basicAvailability(scene: PatchableScene): ActionAvailability {
  return scene.combatState.activeLiving('enemy').length > 0
    ? { enabled: true, resource: `+${ACTION_BASE_RAW_GAIN} NỘ · CHỌN ĐỊCH` }
    : lockedAction('KHÔNG CÓ POW ĐỊCH');
}

function actionAvailability(
  scene: PatchableScene,
  actor: CombatUnitState,
  ability: CombatAbility,
  slot: 0 | 1 | 'ultimate'
): ActionAvailability {
  if (!actor.alive) return lockedAction('POW ĐÃ HẠ GỤC');
  if (scene.skillActions.isSilenced(actor)) return lockedAction('CÂM LẶNG · ĐÁNH THƯỜNG');

  const cooldown = scene.skillActions.cooldownRemaining(actor, slot);
  if (cooldown > 0) return lockedAction(`HỒI CHIÊU · ${cooldown} LƯỢT`);

  if (slot === 'ultimate' && actor.ragePoints < ULTIMATE_RAGE_COST) {
    const rage = Math.max(0, Math.floor(actor.ragePoints));
    return lockedAction(`CẦN ${ULTIMATE_RAGE_COST} NỘ · ${rage}/${ULTIMATE_RAGE_COST}`);
  }

  if (!abilityHasLegalTarget(ability, actor, scene.combatState.units)) return lockedAction('KHÔNG CÓ MỤC TIÊU');

  const ready = slot === 'ultimate'
    ? scene.skillActions.canUseUltimate(actor)
    : scene.skillActions.canUse(actor, slot);
  if (!ready) return lockedAction('CHƯA SẴN SÀNG');
  return { enabled: true, resource: scene.abilityResourceText(actor, ability, slot) };
}

function createSharedSkillOverlay(this: PatchableScene, actor: CombatUnitState): void {
  this.destroyActionMenu();
  this.destroyUndoMenu();
  this.clearTargeting();
  this.pendingPlayerAction = null;
  this.roundText.setVisible(false);
  this.turnText.setVisible(false);

  const basic = actor.pow.abilities.basic;
  const skill1 = actor.pow.abilities.skills[0];
  const skill2 = actor.pow.abilities.skills[1];
  const ultimate = actor.pow.abilities.ultimate;
  const basicState = basicAvailability(this);
  const skill1State = actionAvailability(this, actor, skill1, 0);
  const skill2State = actionAvailability(this, actor, skill2, 1);
  const ultimateState = actionAvailability(this, actor, ultimate, 'ultimate');
  const actions = [
    { label: 'ĐÒN CƠ BẢN', ability: basic, slot: 'basic' as const, ...basicState },
    { label: 'KỸ NĂNG I', ability: skill1, slot: 0 as const, ...skill1State },
    { label: 'KỸ NĂNG II', ability: skill2, slot: 1 as const, ...skill2State },
    { label: 'TUYỆT KỸ', ability: ultimate, slot: 'ultimate' as const, ...ultimateState }
  ];

  const width = this.scale.width;
  const height = this.scale.height;
  const compact = height > width || width < 920 || height < 640;
  const columns = compact ? 2 : 4;
  const rows = Math.ceil(actions.length / columns);
  const overlayTop = Math.round(height * (compact ? 0.36 : 0.625));
  const overlayBottom = height - (compact ? 12 : 8);
  const overlayHeight = overlayBottom - overlayTop;
  const centerY = overlayTop + overlayHeight / 2;
  const menu = this.add.container(0, 0).setDepth(72);

  const dim = this.add.rectangle(width / 2, centerY, width, overlayHeight, 0x02080e, 0.68);
  const topFade = this.add.rectangle(width / 2, overlayTop + 8, width, 16, 0x08131d, 0.34);
  const title = this.add.text(width / 2, overlayTop + 18, `${String(actor.pow.name || '').toUpperCase()} · CHỌN HÀNH ĐỘNG`, {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: compact ? '16px' : '19px', color: '#f8e9bd', fontStyle: 'bold', stroke: '#06111c', strokeThickness: 3,
    fixedWidth: Math.max(220, width - 40), align: 'center'
  }).setOrigin(0.5);
  const subtitle = this.add.text(width / 2, overlayTop + 39, `${actor.pow.role} · ${actor.pow.element} · NỘ ${Math.max(0, Math.floor(actor.ragePoints))}/${ULTIMATE_RAGE_COST}`, {
    fontFamily: COMBAT_BODY_FONT, fontSize: compact ? '10px' : '12px', color: '#a9cbd3', fontStyle: 'bold',
    fixedWidth: Math.max(220, width - 40), align: 'center'
  }).setOrigin(0.5);
  const ornamentOffset = compact ? 94 : 128;
  const ornamentLength = compact ? 42 : 76;
  const ornamentLeft = this.add.rectangle(width / 2 - ornamentOffset, overlayTop + 18, ornamentLength, 1, 0xd7b86c, 0.35);
  const ornamentRight = this.add.rectangle(width / 2 + ornamentOffset, overlayTop + 18, ornamentLength, 1, 0xd7b86c, 0.35);
  menu.add([dim, topFade, title, subtitle, ornamentLeft, ornamentRight]);

  const margin = compact ? 18 : 62;
  const gap = compact ? 10 : 12;
  const cardWidth = Math.min(compact ? 280 : 322, (width - margin * 2 - gap * (columns - 1)) / columns);
  const headerHeight = compact ? 62 : 58;
  const availableCardHeight = overlayHeight - headerHeight - gap * (rows - 1) - 8;
  const cardHeight = Math.max(compact ? 132 : 124, Math.min(compact ? 224 : 236, availableCardHeight / rows));
  const cardStartY = overlayTop + headerHeight + cardHeight / 2;
  const ultimateReady = ultimateState.enabled && actor.ragePoints >= ULTIMATE_READY_RAGE;
  const ultimateElement = elementVisual(actor.pow);

  actions.forEach((action, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const rowCount = Math.min(columns, actions.length - row * columns);
    const rowWidth = cardWidth * rowCount + gap * (rowCount - 1);
    const ability = action.ability;
    const tag = action.slot === 'basic' ? 'ATK' : action.slot === 'ultimate' ? 'ULT' : this.abilityTag(ability);
    const isUltimate = action.slot === 'ultimate';
    const ready = isUltimate && ultimateReady;
    const accent = ready ? ultimateElement.color : abilityAccent(ability, tag);
    const x = width / 2 - rowWidth / 2 + cardWidth / 2 + col * (cardWidth + gap);
    const cardY = cardStartY + row * (cardHeight + gap);
    const tight = cardHeight < 180;

    const bg = this.add.rectangle(x, cardY, cardWidth, cardHeight, 0x07131f, action.enabled ? 0.9 : 0.68)
      .setStrokeStyle(action.enabled ? (ready ? 2.2 : 1.4) : 1, action.enabled ? accent : 0x59636a, action.enabled ? (ready ? 0.96 : 0.68) : 0.36);
    const inner = this.add.rectangle(x, cardY, cardWidth - 8, cardHeight - 8, 0x0b1823, 0.11)
      .setStrokeStyle(1, action.enabled ? accent : 0x4c5960, action.enabled ? 0.14 : 0.08);
    const accentLine = this.add.rectangle(x, cardY - cardHeight / 2 + 4, cardWidth - 24, 2, accent, action.enabled ? 0.44 : 0.16);

    const iconY = cardY - cardHeight / 2 + (tight ? 28 : compact ? 34 : 40);
    const iconPlate = this.add.circle(x, iconY, tight ? 20 : compact ? 25 : 33, 0x06111a, 0.9).setStrokeStyle(1.5, accent, action.enabled ? 0.74 : 0.28);

    let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (ability.iconKey && this.textures.exists(ability.iconKey)) {
      icon = this.add.image(x, iconY, ability.iconKey).setDisplaySize(tight ? 34 : compact ? 44 : 56, tight ? 34 : compact ? 44 : 56).setAlpha(action.enabled ? 1 : 0.38);
      if (!action.enabled && icon instanceof Phaser.GameObjects.Image) icon.setTint(0x69777f);
    } else {
      icon = this.add.text(x, iconY, isUltimate ? '✦' : action.slot === 'basic' ? '◆' : String(Number(action.slot) + 1), {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: '26px', color: action.enabled ? '#ffffff' : '#7c878c', fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    const headerY = cardY - cardHeight / 2 + (tight ? 53 : compact ? 66 : 81);
    const header = this.add.text(x, headerY, `${action.label} · ${tag}`, {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: tight ? '10px' : compact ? '11px' : '14px', color: action.enabled ? '#fff0cf' : '#929da2', fontStyle: 'bold', fixedWidth: cardWidth - 22, align: 'center'
    }).setOrigin(0.5, 0);
    const name = this.add.text(x, headerY + (tight ? 17 : compact ? 19 : 22), String(ability.name || ''), {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: tight ? '11px' : compact ? '13px' : '16px', color: action.enabled ? '#d8eff5' : '#7d898e', fontStyle: 'bold', fixedWidth: cardWidth - 22, align: 'center', wordWrap: { width: cardWidth - 26 }
    }).setOrigin(0.5, 0);

    const desc = abilityDescription(ability);
    const bodyY = headerY + (tight ? 33 : compact ? 42 : 50);
    const primary = this.add.text(x - cardWidth / 2 + 13, bodyY, desc.primary, {
      fontFamily: COMBAT_BODY_FONT, fontSize: tight ? '10px' : compact ? '11px' : '14px', color: action.enabled ? '#edf6f7' : '#78858b', fixedWidth: cardWidth - 26, wordWrap: { width: cardWidth - 26 }, lineSpacing: 2
    });
    const secondary = this.add.text(x - cardWidth / 2 + 13, bodyY + (tight ? 22 : compact ? 28 : 35), desc.secondary, {
      fontFamily: COMBAT_BODY_FONT, fontSize: compact ? '10px' : '12px', color: action.enabled ? '#afcbd3' : '#6f7b80', fixedWidth: cardWidth - 26, wordWrap: { width: cardWidth - 26 }, lineSpacing: 1
    }).setVisible(!tight);
    const resource = this.add.text(x, cardY + cardHeight / 2 - 17, ready ? `✦ SẴN SÀNG · ${action.resource}` : action.resource, {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: compact ? '10px' : '12px', color: action.enabled ? (ready ? '#fff1a7' : '#7de6ff') : '#ffb0ae', fontStyle: 'bold', fixedWidth: cardWidth - 22, align: 'center', wordWrap: { width: cardWidth - 22 }
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, cardY, cardWidth, cardHeight, 0xffffff, 0.001);
    if (action.enabled) {
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => bg.setScale(1.009).setStrokeStyle(ready ? 2.5 : 2, accent, 1));
      hit.on('pointerout', () => bg.setScale(1).setStrokeStyle(ready ? 2.2 : 1.4, accent, ready ? 0.96 : 0.68));
      hit.once('pointerup', () => this.beginPlayerActionSelection(actor, action.slot));
    }
    menu.add([bg, inner, accentLine, iconPlate, icon, header, name, primary, secondary, resource, hit]);
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

    const ultimateReady = unit.alive && unit.fieldSlot !== null && canUseUltimate(unit.ragePoints);
    if (ultimateReady && !this.combat271UltimateReadyFx) {
      this.combat271UltimateReadyFx = addUltimateReadyFx(this);
    } else if (ultimateReady) {
      syncUltimateReadyFxPosition(this);
    } else if (!ultimateReady && this.combat271UltimateReadyFx) {
      this.combat271UltimateReadyFx.destroy(true);
      this.combat271UltimateReadyFx = undefined;
    }

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

function showPreBattleIntro271(this: PatchableScene): void {
  const { width, height } = this.scale;
  const portrait = height > width;
  const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.42);
  const plateWidth = Math.min(portrait ? 620 : 690, width * 0.77);
  const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 108, 0x081d2a, 0.94).setStrokeStyle(1.5, 0xd7b86c, 0.68);
  const title = this.add.text(width / 2, height / 2, 'POWDER COMBAT 2.7.1', {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: portrait ? '32px' : '34px', color: '#fff6df', fontStyle: 'bold'
  }).setOrigin(0.5);
  const intro = this.add.container(0, 0, [shade, plate, title]).setDepth(100);
  this.tweens.add({ targets: intro, alpha: 0, delay: 950, duration: 320, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow(); } });
}

export function installCombat27UiPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const battleProto = BattleSceneClass.prototype as any;
  battleProto.createActionMenu = createSharedSkillOverlay;
  battleProto.showPreBattleIntro = showPreBattleIntro271;
  installPowHudPatch(PowViewClass);
}
