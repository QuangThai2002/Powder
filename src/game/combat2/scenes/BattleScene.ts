import Phaser from 'phaser';
import type { CombatAbility, CombatPow, CombatSide } from '../data/CombatPow';
import { ACTIVE_TEAM_SIZE, ALL_COMBAT2_STARTER_POWS, COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { ActionPipeline } from '../systems/ActionPipeline';
import { abilityHasLegalTarget, abilityTargetMode, hasNegativeStatus, type CombatAbilityTargetMode } from '../systems/CombatAbilityTargeting';
import { BasicAttackResolver } from '../systems/BasicAttackResolver';
import { CombatState, type CombatUnitState } from '../systems/CombatState';
import { ACTION_BASE_RAW_GAIN, ULTIMATE_RAGE_COST } from '../systems/CombatRageEngine';
import { SkillActionResolver, type CombatAbilitySlot, type CombatSkillSlot } from '../systems/SkillActionResolver';
import { TurnManager } from '../systems/TurnManager';
import { CombatPresentationDirector } from '../views/CombatPresentationDirector';
import { COMBAT_BODY_FONT, COMBAT_COLORS, COMBAT_DISPLAY_FONT } from '../views/CombatTheme';
import { PowView } from '../views/PowView';

interface ActionMenuItem {
  label: string;
  detail: string;
  resource: string;
  glyph: string;
  tag: string;
  iconKey?: string;
  color: number;
  enabled: boolean;
  run: () => void;
}
interface PendingPlayerAction {
  actorId: string;
  action: 'basic' | CombatAbilitySlot;
  targetMode: CombatAbilityTargetMode;
}

export class BattleScene extends Phaser.Scene {
  private combatState!: CombatState;
  private turnManager!: TurnManager;
  private actionPipeline!: ActionPipeline;
  private basicAttack!: BasicAttackResolver;
  private skillActions!: SkillActionResolver;
  private presentation!: CombatPresentationDirector;
  private readonly powViews = new Map<string, PowView>();
  private roundText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private actionMenu: Phaser.GameObjects.Container | null = null;
  private undoMenu: Phaser.GameObjects.Container | null = null;
  private pendingPlayerAction: PendingPlayerAction | null = null;
  private flowStarted = false;
  private lineupSettling = false;

  constructor() { super('BattleScene'); }

  preload(): void {
    for (const pow of ALL_COMBAT2_STARTER_POWS) {
      if (!this.textures.exists(pow.assetKey)) this.load.image(pow.assetKey, pow.assetUrl);
      for (const ability of [pow.abilities.basic, ...pow.abilities.skills, pow.abilities.ultimate]) {
        if (ability.iconKey && ability.iconUrl && !this.textures.exists(ability.iconKey)) this.load.image(ability.iconKey, ability.iconUrl);
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;
    this.combatState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
    this.turnManager = new TurnManager(this.combatState);
    this.actionPipeline = new ActionPipeline(this.turnManager);
    this.basicAttack = new BasicAttackResolver();
    this.skillActions = new SkillActionResolver();
    this.presentation = new CombatPresentationDirector(this);
    this.cameras.main.setBackgroundColor('#06111c');
    this.createBattlefield(width, height);
    this.createTeam('enemy', COMBAT2_STARTER_ROSTER.enemy);
    this.createTeam('player', COMBAT2_STARTER_ROSTER.player);

    this.roundText = this.add.text(width / 2, height / 2 - 66, 'VÒNG 1', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '20px', color: COMBAT_COLORS.text, fontStyle: 'bold', backgroundColor: '#0a2433', padding: { x: 17, y: 8 }
    }).setOrigin(0.5).setAlpha(0.92);
    this.turnText = this.add.text(width / 2, height / 2 - 27, '', {
      fontFamily: COMBAT_BODY_FONT, fontSize: '17px', color: COMBAT_COLORS.muted, fontStyle: 'bold'
    }).setOrigin(0.5);
    this.showPreBattleIntro();
  }

  private showPreBattleIntro(): void {
    const { width, height } = this.scale;
    const portrait = height > width;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.54);
    const plateWidth = Math.min(portrait ? 760 : 820, width * 0.86);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 210, 0x081d2a, 0.98).setStrokeStyle(2, 0xd7b86c, 0.76);
    const title = this.add.text(width / 2, height / 2 - 66, 'POWDER COMBAT 2.4.0', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: portrait ? '34px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const subtitle = this.add.text(width / 2, height / 2 - 14, '4 CHẤM NỘ · XANH = 1 · ĐỎ = 2', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '18px', color: '#7de6ff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const hint = this.add.text(width / 2, height / 2 + 42, 'Đòn thường / Skill: +2 Nộ cơ bản · Skill Hồi Nộ có thể cộng thêm\nTuyệt Kỹ tốn 4 Nộ · phần vượt mốc 4 chỉ nhận 50%', {
      fontFamily: COMBAT_BODY_FONT, fontSize: '16px', color: '#c4d9df', align: 'center', lineSpacing: 8
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, subtitle, hint]).setDepth(100);
    this.tweens.add({ targets: intro, alpha: 0, delay: 2250, duration: 420, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow(); } });
  }

  private startCombatFlow(): void {
    if (this.flowStarted) return;
    this.flowStarted = true;
    this.beginNextTurn();
  }

  private beginNextTurn(): void {
    if (this.lineupSettling) return;
    this.pendingPlayerAction = null;
    this.destroyActionMenu();
    this.destroyUndoMenu();
    this.clearTargeting();
    this.clearTurnHighlights();
    this.refreshViews();
    if (this.combatState.isBattleOver()) { this.finishBattle(); return; }

    const actor = this.turnManager.beginNextTurn();
    if (!actor) { this.turnText.setText('Không tìm được lượt hợp lệ'); return; }
    this.roundText.setText(`VÒNG ${this.combatState.round}`);
    this.turnText.setText(`LƯỢT · ${actor.pow.name}`).setColor(actor.side === 'player' ? COMBAT_COLORS.player : COMBAT_COLORS.enemy);
    this.powViews.get(actor.instanceId)?.setActiveTurn(true);
    void this.continueTurn(actor);
  }

  private async continueTurn(actor: CombatUnitState): Promise<void> {
    await this.applyStartOfTurnDot(actor);
    if (!actor.alive) {
      this.turnManager.completeAction(actor.instanceId);
      this.afterAction();
      return;
    }
    if (actor.controlActionsRemaining > 0) {
      const control = actor.controlStatus === 'freeze' ? 'ĐÓNG BĂNG' : 'CHOÁNG';
      this.turnText.setText(`${actor.pow.name} · ${control} · MẤT LƯỢT`).setColor('#ffce7a');
      const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
        this.powViews.get(actor.instanceId)?.setActiveTurn(false);
        await this.powViews.get(actor.instanceId)?.playStatusPulse();
        await this.wait(420);
        return true;
      });
      if (completed === null) this.recoverTurnFlow(); else this.afterAction();
      return;
    }
    if (actor.side === 'enemy') {
      this.time.delayedCall(620, () => void this.performEnemyAction(actor));
      return;
    }
    this.createActionMenu(actor);
  }

  private async performEnemyAction(actor: CombatUnitState): Promise<void> {
    if (this.skillActions.canUseUltimate(actor)) {
      const ability = actor.pow.abilities.ultimate;
      if (abilityHasLegalTarget(ability, actor, this.combatState.units)) {
        const target = this.pickAbilityTarget(actor, ability);
        if (target) { await this.performAbility(actor, target, 'ultimate'); return; }
      }
    }
    const slot: CombatSkillSlot = actor.slot % 2 === 0 ? 0 : 1;
    const ability = actor.pow.abilities.skills[slot];
    if (this.skillActions.canUse(actor, slot) && abilityHasLegalTarget(ability, actor, this.combatState.units)) {
      const target = this.pickAbilityTarget(actor, ability);
      if (target) { await this.performAbility(actor, target, slot); return; }
    }
    const target = this.pickTarget('player');
    if (target) await this.performBasicAttack(actor, target); else this.afterAction();
  }

  private createActionMenu(actor: CombatUnitState): void {
    this.destroyActionMenu();
    this.destroyUndoMenu();
    this.clearTargeting();
    this.pendingPlayerAction = null;
    const basic = actor.pow.abilities.basic;
    const skill1 = actor.pow.abilities.skills[0];
    const skill2 = actor.pow.abilities.skills[1];
    const ultimate = actor.pow.abilities.ultimate;
    const actions: ActionMenuItem[] = [
      { label: 'ĐÒN CƠ BẢN', detail: this.shortName(basic.name, 26), resource: `+${ACTION_BASE_RAW_GAIN} NỘ`, glyph: '◆', tag: 'ATK', iconKey: basic.iconKey, color: 0x0b5268, enabled: this.combatState.activeLiving('enemy').length > 0, run: () => this.beginPlayerActionSelection(actor, 'basic') },
      { label: 'KỸ NĂNG I', detail: this.shortName(skill1.name, 26), resource: `+${this.skillActions.previewRawRageGain(skill1, 0)} NỘ · ${this.actionTargetLabel(skill1)}`, glyph: 'I', tag: this.abilityTag(skill1), iconKey: skill1.iconKey, color: 0x315d78, enabled: this.skillActions.canUse(actor, 0) && abilityHasLegalTarget(skill1, actor, this.combatState.units), run: () => this.beginPlayerActionSelection(actor, 0) },
      { label: 'KỸ NĂNG II', detail: this.shortName(skill2.name, 26), resource: `+${this.skillActions.previewRawRageGain(skill2, 1)} NỘ · ${this.actionTargetLabel(skill2)}`, glyph: 'II', tag: this.abilityTag(skill2), iconKey: skill2.iconKey, color: 0x493b78, enabled: this.skillActions.canUse(actor, 1) && abilityHasLegalTarget(skill2, actor, this.combatState.units), run: () => this.beginPlayerActionSelection(actor, 1) },
      { label: 'TUYỆT KỸ', detail: this.shortName(ultimate.name, 26), resource: `TỐN ${ULTIMATE_RAGE_COST} NỘ · ${this.actionTargetLabel(ultimate)}`, glyph: '✦', tag: 'ULT', iconKey: ultimate.iconKey, color: 0x70472b, enabled: this.skillActions.canUseUltimate(actor) && abilityHasLegalTarget(ultimate, actor, this.combatState.units), run: () => this.beginPlayerActionSelection(actor, 'ultimate') }
    ];

    const portrait = this.scale.height > this.scale.width;
    const compact = portrait || this.scale.width < 1180;
    const columns = compact ? 2 : 4;
    const gap = compact ? 16 : 14;
    const horizontalPadding = compact ? 72 : 88;
    const availableWidth = Math.max(520, this.scale.width - horizontalPadding);
    const buttonWidth = compact
      ? Math.min(340, (availableWidth - gap) / 2)
      : Math.min(252, (availableWidth - gap * 3) / 4);
    const buttonHeight = compact ? 116 : 112;
    const rows = Math.ceil(actions.length / columns);
    const totalHeight = rows * buttonHeight + (rows - 1) * gap;
    const menuY = Math.round(this.scale.height * (portrait ? 0.575 : 0.575));
    const menu = this.add.container(this.scale.width / 2, menuY).setDepth(30);

    actions.forEach((action, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rowCount = Math.min(columns, actions.length - row * columns);
      const rowWidth = rowCount * buttonWidth + (rowCount - 1) * gap;
      const x = -rowWidth / 2 + buttonWidth / 2 + col * (buttonWidth + gap);
      const y = -totalHeight / 2 + buttonHeight / 2 + row * (buttonHeight + gap);
      const left = x - buttonWidth / 2;
      const bg = this.add.rectangle(x, y, buttonWidth, buttonHeight, action.enabled ? action.color : 0x26333b, action.enabled ? 0.97 : 0.66).setStrokeStyle(2, action.enabled ? 0xd7b86c : 0x56636b, action.enabled ? 0.72 : 0.4);
      const iconX = left + 46;
      const plate = this.add.rectangle(iconX, y, 76, 76, 0x05121c, 0.72).setStrokeStyle(2, action.enabled ? 0x77d9eb : 0x4d5c64, 0.6);
      let visual: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
      if (action.iconKey && this.textures.exists(action.iconKey)) {
        visual = this.add.image(iconX, y, action.iconKey).setDisplaySize(68, 68).setAlpha(action.enabled ? 1 : 0.45);
        if (!action.enabled && visual instanceof Phaser.GameObjects.Image) visual.setTint(0x718087);
      } else {
        visual = this.add.text(iconX, y, action.glyph, { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '30px', color: action.enabled ? '#fff8e7' : '#75858d', fontStyle: 'bold' }).setOrigin(0.5);
      }
      const textLeft = left + 94;
      const textWidth = buttonWidth - 104;
      const header = this.add.text(textLeft, y - 37, `${action.label} · ${action.tag}`, { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '14px', color: action.enabled ? '#fff8e7' : '#89979d', fontStyle: 'bold', fixedWidth: textWidth }).setOrigin(0, 0.5);
      const detail = this.add.text(textLeft, y - 5, action.detail, { fontFamily: COMBAT_BODY_FONT, fontSize: '13px', color: action.enabled ? '#d6e7e9' : '#71818a', fontStyle: 'bold', fixedWidth: textWidth, wordWrap: { width: textWidth } }).setOrigin(0, 0.5);
      const resource = this.add.text(textLeft, y + 35, action.resource, { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '12px', color: action.enabled ? '#7de6ff' : '#66767e', fontStyle: 'bold', fixedWidth: textWidth, wordWrap: { width: textWidth } }).setOrigin(0, 0.5);
      const hit = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0xffffff, 0.001);
      if (action.enabled) {
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => bg.setAlpha(1).setScale(1.012));
        hit.on('pointerout', () => bg.setAlpha(0.97).setScale(1));
        hit.once('pointerup', action.run);
      }
      menu.add([bg, plate, visual, header, detail, resource, hit]);
    });
    this.actionMenu = menu;
  }

  private beginPlayerActionSelection(actor: CombatUnitState, action: 'basic' | CombatAbilitySlot): void {
    this.destroyActionMenu();
    this.clearTargeting();
    if (action === 'basic') {
      this.pendingPlayerAction = { actorId: actor.instanceId, action, targetMode: 'enemy' };
      this.prepareTargeting(actor, 'enemy');
      this.createUndoMenu(actor);
      return;
    }
    const ability = action === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[action];
    if (!abilityHasLegalTarget(ability, actor, this.combatState.units)) { this.createActionMenu(actor); return; }
    const mode = abilityTargetMode(ability);
    if (mode === 'self') { void this.performAbility(actor, actor, action); return; }
    if (mode === 'deadAlly') {
      const fallen = this.combatState.units.filter((unit) => unit.side === actor.side && !unit.alive).sort((a, b) => a.slot - b.slot)[0];
      if (fallen) void this.performAbility(actor, fallen, action); else this.createActionMenu(actor);
      return;
    }
    this.pendingPlayerAction = { actorId: actor.instanceId, action, targetMode: mode };
    this.prepareTargeting(actor, mode as 'enemy' | 'ally');
    this.createUndoMenu(actor);
  }

  private prepareTargeting(actor: CombatUnitState, mode: 'enemy' | 'ally'): void {
    const targets = mode === 'enemy'
      ? this.combatState.activeLiving(actor.side === 'player' ? 'enemy' : 'player')
      : this.combatState.activeLiving(actor.side).filter(hasNegativeStatus);
    targets.forEach((target) => this.powViews.get(target.instanceId)?.setTargetable(true));
    this.turnText.setText(mode === 'enemy' ? 'CHỌN POW ĐỊCH' : 'CHỌN ĐỒNG MINH CẦN THANH TẨY').setColor(mode === 'enemy' ? '#8eeaff' : '#73f0aa');
  }

  private createUndoMenu(actor: CombatUnitState): void {
    this.destroyUndoMenu();
    const x = this.scale.width - 112;
    const y = this.scale.height / 2;
    const bg = this.add.rectangle(x, y, 168, 52, 0x172d3b, 0.97).setStrokeStyle(2, 0xd7b86c, 0.65);
    const label = this.add.text(x, y, '↩ HOÀN TÁC', { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '15px', color: '#fff8e7', fontStyle: 'bold' }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, 168, 52, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.once('pointerup', () => { this.pendingPlayerAction = null; this.destroyUndoMenu(); this.clearTargeting(); this.turnText.setText(`LƯỢT · ${actor.pow.name}`).setColor(COMBAT_COLORS.player); this.createActionMenu(actor); });
    this.undoMenu = this.add.container(0, 0, [bg, label, hit]).setDepth(48);
  }

  private selectTarget(instanceId: string): void {
    const pending = this.pendingPlayerAction;
    if (!pending || this.combatState.phase !== 'selecting') return;
    const actor = this.combatState.getUnit(pending.actorId);
    const target = this.combatState.getUnit(instanceId);
    if (!actor || !target || this.combatState.currentUnitId !== actor.instanceId) return;
    const valid = pending.targetMode === 'enemy'
      ? target.side !== actor.side && target.alive && target.fieldSlot !== null
      : target.side === actor.side && target.alive && target.fieldSlot !== null && hasNegativeStatus(target);
    if (!valid) return;
    const action = pending.action;
    this.pendingPlayerAction = null;
    this.destroyUndoMenu();
    this.clearTargeting();
    if (action === 'basic') void this.performBasicAttack(actor, target);
    else void this.performAbility(actor, target, action);
  }

  private async performBasicAttack(actor: CombatUnitState, target: CombatUnitState): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);
    const targetView = this.powViews.get(target.instanceId);
    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);
      this.showActionBanner(actorView, actor.pow.abilities.basic.name, '#8eeaff');
      if (actorView && targetView) { const p = targetView.getWorldPosition(); await actorView.playAttackLunge(p.x, p.y); }
      const result = this.basicAttack.resolve(actor, target);
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();
      if (targetView) { await targetView.playHit(); this.showDamageNumber(targetView, result.hpDamage, result.shieldDamage, result.defeated); }
      this.showRageGain(actorView, result.rageGained, result.rawRageGain);
      await this.wait(300);
      return true;
    });
    if (completed === null) this.recoverTurnFlow(); else this.afterAction();
  }

  private async performAbility(actor: CombatUnitState, target: CombatUnitState, slot: CombatAbilitySlot): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);
    const targetView = this.powViews.get(target.instanceId);
    const ability = slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
    const selfTargeted = actor.instanceId === target.instanceId;
    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);
      if (slot === 'ultimate') {
        this.roundText.setVisible(false); this.turnText.setVisible(false);
        try { await this.presentation.playUltimateIntro(actorView, ability, actor.side, actor.pow.elementKey); }
        finally { this.roundText.setVisible(true); this.turnText.setVisible(true); }
      } else {
        await this.presentation.playSkillIntro(actorView, targetView, ability, slot, actor.pow.elementKey, selfTargeted);
      }
      this.showActionBanner(actorView, ability.name, slot === 'ultimate' ? '#ffd36a' : '#c9eaff');
      if (!selfTargeted && ability.type.toLowerCase() !== 'support' && actorView && targetView) {
        const p = targetView.getWorldPosition(); await actorView.playAttackLunge(p.x, p.y);
      } else if (actorView) await actorView.playStatusPulse();

      const result = slot === 'ultimate' ? this.skillActions.resolveUltimate(actor, target, ability) : this.skillActions.resolve(actor, target, ability, slot);
      if (result.targetSpeedChanged && target.instanceId !== actor.instanceId) this.turnManager.rescheduleUnit(target.instanceId);
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();
      if (result.revived) { this.restoreRevivedReserve(target); this.showFloatingLabel(this.powViews.get(target.instanceId), 'HỒI SINH · 35% HP', '#73f0aa'); }
      this.presentation.showElementOutcome(targetView, result.elementOutcome);
      if (slot === 'ultimate') await this.presentation.playUltimateImpact(targetView, actor.pow.elementKey, selfTargeted);
      if (result.damage > 0 && targetView && !selfTargeted) { await targetView.playHit(); this.showDamageNumber(targetView, result.hpDamage, result.shieldDamage, result.defeated); }
      if (result.healed > 0) this.showFloatingLabel(actorView, `HỒI +${result.healed}`, '#73f0aa');
      if (result.shieldGranted > 0) this.showFloatingLabel(actorView, `KHIÊN +${result.shieldGranted}`, '#8edfff');
      if (result.cleansed) this.showFloatingLabel(targetView, 'THANH TẨY', '#a8ffd8');
      if (result.statusLabel && !result.cleansed && !result.revived) this.showFloatingLabel(this.isSelfStatus(result.statusLabel) ? actorView : targetView, this.statusDisplayName(result.statusLabel), '#c9b0ff');
      if (result.rageSpent > 0) this.showFloatingLabel(actorView, `NỘ -${result.rageSpent} · CÒN ${result.rageAfter}`, '#ffcc8a');
      else this.showRageGain(actorView, result.rageGained, result.rawRageGain);
      await this.wait(slot === 'ultimate' ? 760 : 360);
      return true;
    });
    if (completed === null) this.recoverTurnFlow(); else this.afterAction();
  }

  private async applyStartOfTurnDot(actor: CombatUnitState): Promise<void> {
    if (actor.dotActionsRemaining <= 0 || actor.dotDamage <= 0 || !actor.dotStatus) return;
    const damage = Math.min(actor.hp, Math.max(1, Math.round(actor.dotDamage)));
    const status = actor.dotStatus;
    actor.hp = Math.max(0, actor.hp - damage);
    actor.dotActionsRemaining = Math.max(0, actor.dotActionsRemaining - 1);
    if (actor.dotActionsRemaining <= 0) { actor.dotStatus = null; actor.dotDamage = 0; }
    this.combatState.sanitizeRuntimeNumbers(); this.refreshViews();
    const view = this.powViews.get(actor.instanceId);
    if (view) { await view.playHit(); this.showFloatingLabel(view, `${status === 'poison' ? 'ĐỘC' : 'THIÊU ĐỐT'} -${damage}`, status === 'poison' ? '#a6e66f' : '#ff9b68'); }
    await this.wait(360);
  }

  private afterAction(): void { void this.settleAfterAction(); }

  private async settleAfterAction(): Promise<void> {
    if (this.lineupSettling) return;
    this.lineupSettling = true;
    this.pendingPlayerAction = null;
    this.destroyActionMenu(); this.destroyUndoMenu(); this.clearTargeting(); this.refreshViews();
    try {
      await this.handleReservePromotions();
      this.refreshViews();
      if (this.combatState.isBattleOver()) { this.finishBattle(); return; }
    } finally { this.lineupSettling = false; }
    this.time.delayedCall(420, () => this.beginNextTurn());
  }

  private async handleReservePromotions(): Promise<void> {
    for (const dead of this.combatState.units.filter((unit) => !unit.alive)) this.turnManager.retireUnit(dead.instanceId);
    for (const promotion of this.combatState.promoteReserves()) {
      const defeatedView = this.powViews.get(promotion.defeatedUnitId);
      const promotedView = this.powViews.get(promotion.promotedUnitId);
      const promoted = this.combatState.getUnit(promotion.promotedUnitId);
      const field = this.activePosition(promotion.side, promotion.fieldSlot);
      if (defeatedView) { await defeatedView.retireFromField(defeatedView.getWorldPosition().x, promotion.side === 'enemy' ? -120 : this.scale.height + 120); defeatedView.container.setVisible(false); }
      if (promotedView && promoted) { await promotedView.enterField(field.x, field.y); promotedView.updateRuntime(promoted); this.turnManager.registerPromoted(promoted.instanceId); this.showFloatingLabel(promotedView, 'DỰ BỊ VÀO SÂN', '#7ce8ff'); }
      this.layoutReserveViews(promotion.side);
    }
  }

  private restoreRevivedReserve(unit: CombatUnitState): void {
    unit.fieldSlot = null;
    const view = this.powViews.get(unit.instanceId);
    if (view) { view.container.setVisible(true); view.updateRuntime(unit); }
    this.layoutReserveViews(unit.side);
  }

  private layoutReserveViews(side: CombatSide): void {
    this.combatState.reserveLiving(side).slice(0, 2).forEach((unit, index) => {
      const view = this.powViews.get(unit.instanceId); if (!view) return;
      const p = this.reservePosition(side, index); view.container.setVisible(true).setPosition(p.x, p.y); view.setBenchScale(0.5); view.updateRuntime(unit);
    });
  }

  private recoverTurnFlow(): void {
    this.pendingPlayerAction = null; this.destroyActionMenu(); this.destroyUndoMenu(); this.clearTargeting(); this.turnManager.recoverActionLock(); this.afterAction();
  }

  private pickAbilityTarget(actor: CombatUnitState, ability: CombatAbility): CombatUnitState | null {
    const mode = abilityTargetMode(ability);
    if (mode === 'self') return actor;
    if (mode === 'enemy') return this.pickTarget(actor.side === 'player' ? 'enemy' : 'player');
    if (mode === 'ally') return this.combatState.activeLiving(actor.side).filter(hasNegativeStatus).sort((a, b) => a.hp / a.pow.maxHp - b.hp / b.pow.maxHp)[0] ?? null;
    return this.combatState.units.filter((unit) => unit.side === actor.side && !unit.alive).sort((a, b) => a.slot - b.slot)[0] ?? null;
  }

  private clearTargeting(): void { for (const view of this.powViews.values()) { view.setSelectedTarget(false); view.setTargetable(false); } }

  private showActionBanner(view: PowView | undefined, name: string, color: string): void {
    if (!view) return;
    const p = view.getWorldPosition();
    const top = p.y < this.scale.height / 2;
    const y = top ? Math.min(this.scale.height / 2 - 115, p.y + 160) : Math.max(this.scale.height / 2 + 115, p.y - 160);
    const text = this.add.text(p.x, y, this.shortName(name, 32).toUpperCase(), { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '21px', color, fontStyle: 'bold', backgroundColor: '#07131ddd', padding: { x: 13, y: 8 }, stroke: '#06111c', strokeThickness: 3 }).setOrigin(0.5).setDepth(46);
    this.tweens.add({ targets: text, y: y + (top ? 12 : -12), alpha: 0, delay: 480, duration: 1000, ease: 'Quad.easeOut', onComplete: () => text.destroy() });
  }

  private showDamageNumber(view: PowView, hpDamage: number, shieldDamage: number, defeated: boolean): void {
    const p = view.getWorldPosition();
    const label = shieldDamage > 0 && hpDamage <= 0 ? `KHIÊN -${shieldDamage}` : shieldDamage > 0 ? `-${hpDamage}  ·  KHIÊN -${shieldDamage}` : `-${hpDamage}`;
    const text = this.add.text(p.x, p.y - 96, label, { fontFamily: COMBAT_DISPLAY_FONT, fontSize: defeated ? '38px' : '34px', color: defeated ? '#ff6478' : shieldDamage > 0 ? '#8edfff' : '#ffd36a', fontStyle: 'bold', stroke: '#06111c', strokeThickness: 6 }).setOrigin(0.5).setDepth(50);
    this.floatAndDestroy(text, 1250);
  }

  private showFloatingLabel(view: PowView | undefined, label: string, color: string): void {
    if (!view) return;
    const p = view.getWorldPosition();
    const text = this.add.text(p.x, p.y - 98, label, { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '24px', color, fontStyle: 'bold', stroke: '#06111c', strokeThickness: 5 }).setOrigin(0.5).setDepth(49);
    this.floatAndDestroy(text, 1250);
  }

  private showRageGain(view: PowView | undefined, gained: number, raw: number): void {
    if (!view || gained <= 0) return;
    this.showFloatingLabel(view, gained < raw ? `NỘ +${gained} · DƯ ×50%` : `NỘ +${gained}`, '#6ed9ff');
  }

  private floatAndDestroy(text: Phaser.GameObjects.Text, duration: number): void {
    this.tweens.add({ targets: text, y: text.y - 42, alpha: 0, delay: 300, duration, ease: 'Quad.easeOut', onComplete: () => text.destroy() });
  }

  private pickTarget(side: CombatSide): CombatUnitState | null { return this.combatState.activeLiving(side).sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99))[0] ?? null; }

  private finishBattle(): void {
    this.destroyActionMenu(); this.destroyUndoMenu(); this.clearTargeting(); this.clearTurnHighlights(); this.refreshViews();
    const win = this.combatState.living('player').length > 0 && this.combatState.living('enemy').length === 0;
    this.turnText.setText('');
    this.roundText.setText(win ? 'CHIẾN THẮNG' : 'THẤT BẠI').setFontSize(34).setColor(win ? '#73f0aa' : '#ff7282');
  }

  private refreshViews(): void { for (const unit of this.combatState.units) this.powViews.get(unit.instanceId)?.updateRuntime(unit); }
  private clearTurnHighlights(): void { for (const view of this.powViews.values()) view.setActiveTurn(false); }
  private destroyActionMenu(): void { this.actionMenu?.destroy(true); this.actionMenu = null; }
  private destroyUndoMenu(): void { this.undoMenu?.destroy(true); this.undoMenu = null; }
  private wait(ms: number): Promise<void> { return new Promise((resolve) => this.time.delayedCall(ms, resolve)); }

  private abilityTag(ability: CombatAbility): string {
    const status = String(ability.status || '').replace(/^self:/i, '').trim().toLowerCase();
    const type = String(ability.type || '').trim().toLowerCase();
    if (status === 'cleanse' || status === 'purify') return 'CLEAN';
    if (status === 'revive' || status === 'resurrection') return 'REVIVE';
    if (status === 'rage gain') return 'NỘ';
    if (status === 'ap up') return 'AP+';
    if (status === 'attack up') return 'ATK+';
    if (type === 'support') return 'SUP';
    if (type === 'debuff') return 'CTRL';
    if (type === 'physical') return 'ATK';
    return 'AP';
  }

  private actionTargetLabel(ability: CombatAbility): string {
    const mode = abilityTargetMode(ability);
    if (mode === 'self') return 'BẢN THÂN';
    if (mode === 'ally') return 'CHỌN ĐỒNG MINH';
    if (mode === 'deadAlly') return 'POW ĐÃ GỤC';
    return 'CHỌN ĐỊCH';
  }

  private isSelfStatus(status: string): boolean {
    return ['shield', 'regeneration', 'attack up', 'ap up', 'defense up', 'rage gain'].includes(status.replace(/^self:/i, '').trim().toLowerCase());
  }

  private statusDisplayName(status: string): string {
    const normalized = status.replace(/^self:/i, '').trim().toLowerCase();
    const names: Record<string, string> = { shield: 'KHIÊN', regeneration: 'HỒI PHỤC', 'attack up': 'TĂNG CÔNG', 'ap up': 'TĂNG AP', 'defense up': 'TĂNG THỦ', 'rage gain': 'HỒI NỘ', stun: 'CHOÁNG', freeze: 'ĐÓNG BĂNG', slow: 'CHẬM', burn: 'THIÊU ĐỐT', poison: 'NHIỄM ĐỘC' };
    return names[normalized] ?? status.toUpperCase();
  }

  private shortName(name: string, maxLength: number): string { const clean = String(name || '').trim(); return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean; }

  private createBattlefield(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x071827, 1).fillRect(0, 0, width, height);
    g.fillStyle(0x0a2031, 0.74).fillEllipse(width / 2, height / 2, Math.min(1220, width * 0.86), Math.min(430, height * 0.5));
    g.lineStyle(1, 0x21475c, 0.45).strokeEllipse(width / 2, height / 2, Math.min(1220, width * 0.86), Math.min(430, height * 0.5));
    g.lineStyle(1, 0x15394e, 0.55).lineBetween(width * 0.07, height / 2, width * 0.93, height / 2);
  }

  private createTeam(side: CombatSide, team: CombatPow[]): void {
    team.forEach((pow, index) => {
      const instanceId = `${side}-${index}-${pow.id}`;
      const unit = this.combatState.getUnit(instanceId); if (!unit) return;
      const p = unit.fieldSlot !== null ? this.activePosition(side, unit.fieldSlot) : this.reservePosition(side, index - ACTIVE_TEAM_SIZE);
      const view = new PowView(this, p.x, p.y, pow, { side, width: 276, height: 312 });
      if (unit.fieldSlot === null) view.setBenchScale(0.5);
      view.onTargetSelected(() => this.selectTarget(instanceId));
      this.powViews.set(instanceId, view);
      view.updateRuntime(unit);
    });
  }

  private activePosition(side: CombatSide, fieldSlot: number): Phaser.Math.Vector2 {
    const spacing = Math.min(350, this.scale.width * 0.23);
    const portrait = this.scale.height > this.scale.width;
    const edgeY = portrait ? 210 : 170;
    return new Phaser.Math.Vector2(this.scale.width / 2 + (fieldSlot - 1) * spacing, side === 'enemy' ? edgeY : this.scale.height - edgeY);
  }
  private reservePosition(side: CombatSide, reserveIndex: number): Phaser.Math.Vector2 {
    const inset = Math.max(86, this.scale.width * 0.075);
    const portrait = this.scale.height > this.scale.width;
    const edgeY = portrait ? 118 : 96;
    return new Phaser.Math.Vector2(reserveIndex <= 0 ? inset : this.scale.width - inset, side === 'enemy' ? edgeY : this.scale.height - edgeY);
  }
}
