import Phaser from 'phaser';
import type { CombatAbility, CombatPow, CombatSide } from '../data/CombatPow';
import { ACTIVE_TEAM_SIZE, ALL_COMBAT2_STARTER_POWS, COMBAT2_STARTER_ROSTER, combatTeamByIds } from '../data/PowderDataAdapter';
import {
  academicQuestionsFromContext,
  createCombat2BattleResult,
  loadCombat2BattleRequest,
  publishCombat2BattleResult,
  returnCombat2ResultToMain,
  type Combat2AcademicQuestion as AcademicCombatQuestion,
  type Combat2BattleRequest,
  type Combat2BattleResult
} from '../Combat2BattleHandoff';
import { ActionPipeline } from '../systems/ActionPipeline';
import {
  abilityHasLegalTarget,
  abilityRequiresDebuffedAlly,
  abilityTargetMode,
  hasNegativeStatus,
  type CombatAbilityTargetMode
} from '../systems/CombatAbilityTargeting';
import { BasicAttackResolver } from '../systems/BasicAttackResolver';
import {
  FROSTBITE_DAMAGE_MULTIPLIER,
  FREEZE_SHATTER_MULTIPLIER
} from '../systems/CombatControlEngine';
import { CombatGuardEngine } from '../systems/CombatGuardEngine';
import { BossModeController } from '../systems/BossModeController';
import { CombatState, type CombatUnitState } from '../systems/CombatState';
import { ACTION_BASE_RAW_GAIN, ULTIMATE_RAGE_COST } from '../systems/CombatRageEngine';
import { SkillActionResolver, type CombatAbilitySlot, type CombatSkillSlot } from '../systems/SkillActionResolver';
import { TurnManager } from '../systems/TurnManager';
import { CombatPresentationDirector } from '../views/CombatPresentationDirector';
import { COMBAT_BODY_FONT, COMBAT_COLORS, COMBAT_DISPLAY_FONT } from '../views/CombatTheme';
import { PowView } from '../views/PowView';
import { preloadCombatVfxAssets } from '../vfx/CombatVfxRegistry';

const BATTLE_BG_KEY = 'combat2-battle-bg';
const BATTLE_BG_URL = '/assets/backgrounds/bg-battle-legend-cloud-arena.webp';
const BATTLE_BGM_KEY = 'combat2-bgm';
const BATTLE_BGM_URL = '/assets/audio/combat/user-combat-bgm.mp3';

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

interface PendingAcademicAction {
  actor: CombatUnitState;
  target: CombatUnitState;
  action: 'basic' | CombatAbilitySlot;
}

export class BattleScene extends Phaser.Scene {
  private combatState!: CombatState;
  private turnManager!: TurnManager;
  private actionPipeline!: ActionPipeline;
  private basicAttack!: BasicAttackResolver;
  private skillActions!: SkillActionResolver;
  private guard!: CombatGuardEngine;
  private bossMode: BossModeController | null = null;
  private presentation!: CombatPresentationDirector;
  private readonly powViews = new Map<string, PowView>();
  private roundText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private actionMenu: Phaser.GameObjects.Container | null = null;
  private undoMenu: Phaser.GameObjects.Container | null = null;
  private pendingPlayerAction: PendingPlayerAction | null = null;
  private battleMusic: Phaser.Sound.BaseSound | null = null;
  private flowStarted = false;
  private lineupSettling = false;
  private handoffRequest: Combat2BattleRequest | null = null;
  private handoffError: string | null = null;
  private playerTeam: CombatPow[] = COMBAT2_STARTER_ROSTER.player;
  private enemyTeam: CombatPow[] = COMBAT2_STARTER_ROSTER.enemy;
  private resultOverlay: Phaser.GameObjects.Container | null = null;
  private actionBanner: Phaser.GameObjects.Text | null = null;
  private academicQuestions: AcademicCombatQuestion[] = [];
  private academicQuestionIndex = 0;
  private academicQuestionModal: Phaser.GameObjects.Container | null = null;
  private pendingAcademicAction: PendingAcademicAction | null = null;
  private academicResponses: Array<{ question: AcademicCombatQuestion; correct: boolean; powId: string }> = [];

  constructor() { super('BattleScene'); }

  init(): void {
    const requestedBattleId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('battle');
    const request = loadCombat2BattleRequest();
    if (!request.ok) {
      if (requestedBattleId) this.handoffError = request.errors?.join('; ') || 'BattleRequest khong hop le';
      return;
    }
    const academicQuestions = academicQuestionsFromContext(request.value.academicContext);
    if (request.value.academicContext.requiresActionQuestions === true && academicQuestions.length === 0) {
      this.handoffError = 'Du lieu cau hoi hoc thuat cho tran nay khong hop le';
      return;
    }
    const playerTeam = combatTeamByIds(request.value.playerTeam);
    const enemyTeam = combatTeamByIds(request.value.enemyTeam);
    if (!playerTeam || !enemyTeam) {
      this.handoffError = 'BattleRequest chua Pow khong ton tai trong catalog';
      return;
    }
    this.handoffRequest = request.value;
    this.playerTeam = playerTeam;
    this.enemyTeam = enemyTeam;
    this.academicQuestions = academicQuestions;
  }

  preload(): void {
    if (!this.textures.exists(BATTLE_BG_KEY)) this.load.image(BATTLE_BG_KEY, BATTLE_BG_URL);
    if (!this.cache.audio.exists(BATTLE_BGM_KEY)) this.load.audio(BATTLE_BGM_KEY, BATTLE_BGM_URL);
    // Live Ultimate back-circle sheets must finish with the Combat2 preload, not after create().
    preloadCombatVfxAssets(this, 'all');
    const roster = this.handoffRequest ? [...this.enemyTeam, ...this.playerTeam] : ALL_COMBAT2_STARTER_POWS;
    for (const pow of roster) {
      if (!this.textures.exists(pow.assetKey)) this.load.image(pow.assetKey, pow.assetUrl);
      for (const ability of [pow.abilities.basic, ...pow.abilities.skills, pow.abilities.ultimate]) {
        if (ability.iconKey && ability.iconUrl && !this.textures.exists(ability.iconKey)) this.load.image(ability.iconKey, ability.iconUrl);
      }
    }
  }

  create(): void {
    // Keep visual QA and VFX bridges attached to the live scene even after a hot reload.
    (globalThis as any).POWDER_COMBAT2_ACTIVE_BATTLE_SCENE = this;
    const { width, height } = this.scale;
    if (this.handoffError) {
      this.showHandoffError(width, height, this.handoffError);
      return;
    }
    this.combatState = new CombatState(this.playerTeam, this.enemyTeam, {
      battleMode: this.handoffRequest?.battleMode,
      bossContext: this.handoffRequest?.bossContext
    });
    this.turnManager = new TurnManager(this.combatState);
    this.bossMode = BossModeController.from(this.combatState, this.turnManager);
    if (this.handoffRequest?.battleMode === 'boss' && !this.bossMode) {
      this.showHandoffError(width, height, 'Boss context hoac phase configuration khong hop le');
      return;
    }
    this.actionPipeline = new ActionPipeline(this.turnManager);
    this.basicAttack = new BasicAttackResolver(Math.random);
    this.skillActions = new SkillActionResolver(Math.random);
    this.guard = new CombatGuardEngine(Math.random);
    this.presentation = new CombatPresentationDirector(this);
    this.cameras.main.setBackgroundColor('#06111c');
    this.createBattlefield(width, height);
    this.createTeam('enemy', this.enemyTeam);
    this.createTeam('player', this.playerTeam);

    this.roundText = this.add.text(width / 2, height / 2 - 66, 'VÒNG 1', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '20px', color: COMBAT_COLORS.text, fontStyle: 'bold', backgroundColor: '#0a2433', padding: { x: 17, y: 8 }
    }).setOrigin(0.5).setAlpha(0.92);
    this.turnText = this.add.text(width / 2, height / 2 - 27, '', {
      fontFamily: COMBAT_BODY_FONT, fontSize: '17px', color: COMBAT_COLORS.muted, fontStyle: 'bold'
    }).setOrigin(0.5);

    this.startBattleMusic();
    this.input.once('pointerdown', () => this.startBattleMusic());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.stopBattleMusic(); this.clearActionBanner(); this.clearAcademicQuestion(); });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopBattleMusic());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      const root = globalThis as any;
      if (root.POWDER_COMBAT2_ACTIVE_BATTLE_SCENE === this) delete root.POWDER_COMBAT2_ACTIVE_BATTLE_SCENE;
    });
    this.showPreBattleIntro();
  }

  private showPreBattleIntro(): void {
    const { width, height } = this.scale;
    const portrait = height > width;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.46);
    const plateWidth = Math.min(portrait ? 650 : 720, width * 0.8);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 118, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
    const title = this.add.text(width / 2, height / 2, 'POWDER COMBAT 2.6.1', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: portrait ? '34px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title]).setDepth(100);
    this.tweens.add({ targets: intro, alpha: 0, delay: 1200, duration: 380, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow(); } });
  }

  private startBattleMusic(): void {
    if (this.battleMusic?.isPlaying || !this.cache.audio.exists(BATTLE_BGM_KEY)) return;
    try {
      if (!this.battleMusic) this.battleMusic = this.sound.add(BATTLE_BGM_KEY, { loop: true, volume: 0.32 });
      this.battleMusic.play();
    } catch (error) {
      console.warn('[Combat2 Audio] BGM will retry after player interaction.', error);
    }
  }

  private stopBattleMusic(): void {
    if (!this.battleMusic) return;
    try { this.battleMusic.stop(); this.battleMusic.destroy(); } catch { /* noop */ }
    this.battleMusic = null;
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

    this.roundText.setVisible(true);
    this.turnText.setVisible(true);
    const actor = this.turnManager.beginNextTurn();
    if (!actor) { this.turnText.setText('Không tìm được lượt hợp lệ'); return; }
    this.roundText.setText(`VÒNG ${this.combatState.round}`);
    this.turnText.setText(`LƯỢT · ${actor.pow.name}`).setColor(actor.side === 'player' ? COMBAT_COLORS.player : COMBAT_COLORS.enemy);
    this.powViews.get(actor.instanceId)?.setActiveTurn(true);
    void this.continueTurn(actor);
  }

  private async continueTurn(actor: CombatUnitState): Promise<void> {
    await this.applyStartOfTurnEffects(actor);
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

    if (this.skillActions.shouldParalysisSkip(actor)) {
      this.turnText.setText(`${actor.pow.name} · TÊ LIỆT · MẤT LƯỢT`).setColor('#ffe66f');
      const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
        this.powViews.get(actor.instanceId)?.setActiveTurn(false);
        await this.powViews.get(actor.instanceId)?.playStatusPulse();
        await this.wait(380);
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
    const bossEvent = this.bossMode?.beforeEnemyAction(actor);
    if (bossEvent) {
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();
      for (const targetId of bossEvent.targetIds) this.showFloatingLabel(this.powViews.get(targetId), bossEvent.label, '#ffcf7a');
      if (this.combatState.isBattleOver()) {
        this.turnManager.completeAction(actor.instanceId);
        this.afterAction();
        return;
      }
      await this.wait(340);
    }
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
      { label: 'KỸ NĂNG I', detail: this.shortName(skill1.name, 26), resource: this.abilityResourceText(actor, skill1, 0), glyph: 'I', tag: this.abilityTag(skill1), iconKey: skill1.iconKey, color: 0x315d78, enabled: this.skillActions.canUse(actor, 0) && abilityHasLegalTarget(skill1, actor, this.combatState.units), run: () => this.beginPlayerActionSelection(actor, 0) },
      { label: 'KỸ NĂNG II', detail: this.shortName(skill2.name, 26), resource: this.abilityResourceText(actor, skill2, 1), glyph: 'II', tag: this.abilityTag(skill2), iconKey: skill2.iconKey, color: 0x493b78, enabled: this.skillActions.canUse(actor, 1) && abilityHasLegalTarget(skill2, actor, this.combatState.units), run: () => this.beginPlayerActionSelection(actor, 1) },
      { label: 'TUYỆT KỸ', detail: this.shortName(ultimate.name, 26), resource: this.abilityResourceText(actor, ultimate, 'ultimate'), glyph: '✦', tag: 'ULT', iconKey: ultimate.iconKey, color: 0x70472b, enabled: this.skillActions.canUseUltimate(actor) && abilityHasLegalTarget(ultimate, actor, this.combatState.units), run: () => this.beginPlayerActionSelection(actor, 'ultimate') }
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
    const menuY = Math.round(this.scale.height * 0.575);
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
      const resource = this.add.text(textLeft, y + 35, action.resource, { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '12px', color: action.enabled ? '#7de6ff' : '#d0a1a1', fontStyle: 'bold', fixedWidth: textWidth, wordWrap: { width: textWidth } }).setOrigin(0, 0.5);
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

    const usable = action === 'ultimate'
      ? this.skillActions.canUseUltimate(actor)
      : this.skillActions.canUse(actor, action);
    if (!usable) { this.createActionMenu(actor); return; }

    const ability = action === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[action];
    if (!abilityHasLegalTarget(ability, actor, this.combatState.units)) { this.createActionMenu(actor); return; }
    const mode = abilityTargetMode(ability);
    if (mode === 'self') { this.beginAcademicAction(actor, actor, action); return; }
    if (mode === 'deadAlly') {
      const fallen = this.combatState.units.filter((unit) => unit.side === actor.side && !unit.alive).sort((a, b) => a.slot - b.slot)[0];
      if (fallen) this.beginAcademicAction(actor, fallen, action); else this.createActionMenu(actor);
      return;
    }
    this.pendingPlayerAction = { actorId: actor.instanceId, action, targetMode: mode };
    this.prepareTargeting(actor, mode as 'enemy' | 'ally', ability);
    this.createUndoMenu(actor);
  }

  private prepareTargeting(actor: CombatUnitState, mode: 'enemy' | 'ally', ability?: CombatAbility): void {
    const requireDebuff = ability ? abilityRequiresDebuffedAlly(ability) : false;
    const targets = mode === 'enemy'
      ? this.combatState.activeLiving(actor.side === 'player' ? 'enemy' : 'player')
      : this.combatState.activeLiving(actor.side).filter((unit) => !requireDebuff || hasNegativeStatus(unit));
    targets.forEach((target) => this.powViews.get(target.instanceId)?.setTargetable(true, mode));
    const prompt = mode === 'enemy'
      ? 'CHỌN POW ĐỊCH'
      : requireDebuff
        ? 'CHỌN ĐỒNG MINH CẦN THANH TẨY'
        : 'CHỌN ĐỒNG MINH';
    const actionName = ability?.name || actor.pow.abilities.basic.name || 'ĐÒN CƠ BẢN';
    const actionCue = `${this.shortName(actor.pow.name, 16)} · ${this.shortName(actionName, 22)}`.toUpperCase();
    const cueColor = mode === 'enemy' ? '#8eeaff' : '#73f0aa';
    this.roundText.setText(actionCue).setColor(cueColor).setVisible(true);
    this.turnText.setText(`${prompt} · ${targets.length} HỢP LỆ`).setColor(cueColor).setVisible(true);
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
    const selectedAbility = pending.action === 'basic'
      ? null
      : pending.action === 'ultimate'
        ? actor.pow.abilities.ultimate
        : actor.pow.abilities.skills[pending.action];
    const requireDebuff = selectedAbility ? abilityRequiresDebuffedAlly(selectedAbility) : false;
    const valid = pending.targetMode === 'enemy'
      ? target.side !== actor.side && target.alive && target.fieldSlot !== null
      : target.side === actor.side && target.alive && target.fieldSlot !== null && (!requireDebuff || hasNegativeStatus(target));
    if (!valid) return;
    const action = pending.action;
    this.pendingPlayerAction = null;
    this.destroyUndoMenu();
    this.clearTargeting();
    this.beginAcademicAction(actor, target, action);
  }

  private beginAcademicAction(actor: CombatUnitState, target: CombatUnitState, action: 'basic' | CombatAbilitySlot): void {
    if (!this.handoffRequest?.academicContext.requiresActionQuestions) {
      this.executePlayerAction(actor, target, action);
      return;
    }
    if (this.academicQuestionModal || !actor.alive || this.combatState.currentUnitId !== actor.instanceId) return;
    const question = this.nextAcademicQuestion();
    if (!question) {
      this.turnText.setText('Khong co cau hoi hop le cho hanh dong nay').setColor('#ffb29f');
      this.createActionMenu(actor);
      return;
    }
    this.pendingAcademicAction = { actor, target, action };
    this.showAcademicQuestion(question);
  }

  private executePlayerAction(actor: CombatUnitState, target: CombatUnitState, action: 'basic' | CombatAbilitySlot): void {
    if (action === 'basic') void this.performBasicAttack(actor, target);
    else void this.performAbility(actor, target, action);
  }

  private nextAcademicQuestion(): AcademicCombatQuestion | null {
    if (!this.academicQuestions.length) return null;
    const question = this.academicQuestions[this.academicQuestionIndex % this.academicQuestions.length];
    this.academicQuestionIndex += 1;
    return question;
  }

  private showAcademicQuestion(question: AcademicCombatQuestion): void {
    const compact = this.scale.width < 600 || this.scale.height > this.scale.width;
    const width = Math.min(compact ? this.scale.width - 28 : 720, this.scale.width - 44);
    const optionColumns = compact ? 1 : 2;
    const optionGap = 10;
    const optionWidth = (width - 44 - optionGap * (optionColumns - 1)) / optionColumns;
    const optionHeight = compact ? 56 : 60;
    const optionRows = Math.ceil(question.options.length / optionColumns);
    const height = Math.min(this.scale.height - 28, 176 + optionRows * (optionHeight + optionGap) + 62);
    const root = this.add.container(this.scale.width / 2, this.scale.height / 2).setDepth(90);
    const panel = this.add.rectangle(0, 0, width, height, 0x071827, 0.985).setStrokeStyle(2, 0x91dff3, 0.8);
    const title = this.add.text(-width / 2 + 22, -height / 2 + 20, `${question.language === 'ZH' ? 'TIENG TRUNG' : 'TIENG ANH'} · CAU HOI KICH HOAT`, {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: compact ? '13px' : '15px', color: '#9de8ff', fontStyle: 'bold'
    });
    const prompt = this.add.text(0, -height / 2 + 66, question.prompt, {
      fontFamily: COMBAT_BODY_FONT, fontSize: compact ? '18px' : '21px', color: '#fff6df', fontStyle: 'bold', align: 'center', wordWrap: { width: width - 50 }
    }).setOrigin(0.5, 0);
    const feedback = this.add.text(0, height / 2 - 28, '', {
      fontFamily: COMBAT_BODY_FONT, fontSize: compact ? '13px' : '14px', color: '#cfe8ee', align: 'center', wordWrap: { width: width - 48 }
    }).setOrigin(0.5);
    root.add([panel, title, prompt, feedback]);

    const optionTop = -height / 2 + 126;
    question.options.forEach((option, index) => {
      const row = Math.floor(index / optionColumns);
      const column = index % optionColumns;
      const x = -width / 2 + 22 + optionWidth / 2 + column * (optionWidth + optionGap);
      const y = optionTop + row * (optionHeight + optionGap);
      const card = this.add.rectangle(x, y, optionWidth, optionHeight, 0x12354a, 0.96).setStrokeStyle(1.5, 0x71c6df, 0.7);
      const label = this.add.text(x - optionWidth / 2 + 13, y, `${String.fromCharCode(65 + index)}. ${option}`, {
        fontFamily: COMBAT_BODY_FONT, fontSize: compact ? '14px' : '15px', color: '#f2fbff', fontStyle: 'bold', wordWrap: { width: optionWidth - 24 }
      }).setOrigin(0, 0.5);
      const hit = this.add.rectangle(x, y, optionWidth, optionHeight, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.once('pointerup', () => this.answerAcademicQuestion(question, option, root, card, feedback));
      root.add([card, label, hit]);
    });
    this.academicQuestionModal = root;
  }

  private answerAcademicQuestion(
    question: AcademicCombatQuestion,
    choice: string,
    root: Phaser.GameObjects.Container,
    selectedCard: Phaser.GameObjects.Rectangle,
    feedback: Phaser.GameObjects.Text
  ): void {
    if (this.academicQuestionModal !== root || !this.pendingAcademicAction) return;
    const correct = choice === question.answer;
    root.getAll().forEach((child) => {
      if (child instanceof Phaser.GameObjects.Rectangle && child.input) child.disableInteractive();
    });
    selectedCard.setFillStyle(correct ? 0x197653 : 0x863b48, 1).setStrokeStyle(2, correct ? 0x8ff3ba : 0xffadb7, 1);
    feedback.setColor(correct ? '#9affc4' : '#ffb1ba').setText(correct
      ? `CHINH XAC${question.explain ? ` · ${question.explain}` : ''}`
      : `CHUA DUNG · Dap an: ${question.answer}${question.explain ? ` · ${question.explain}` : ''}`);
    const pending = this.pendingAcademicAction;
    this.academicResponses.push({ question, correct, powId: pending.actor.pow.id });
    this.time.delayedCall(correct ? 480 : 680, () => {
      if (this.academicQuestionModal !== root) return;
      this.clearAcademicQuestion();
      this.executePlayerAction(pending.actor, pending.target, pending.action);
    });
  }

  private clearAcademicQuestion(): void {
    this.academicQuestionModal?.destroy(true);
    this.academicQuestionModal = null;
    this.pendingAcademicAction = null;
  }

  private async performBasicAttack(actor: CombatUnitState, requestedTarget: CombatUnitState): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);
    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);
      const guard = this.guard.resolve(actor, requestedTarget, actor.pow.abilities.basic, this.combatState.activeLiving(requestedTarget.side));
      const target = guard.target;
      const targetView = this.powViews.get(target.instanceId);
      if (guard.guarded && targetView) {
        this.showFloatingLabel(targetView, `BẢO HỘ CHO ${requestedTarget.pow.name.toUpperCase()}`, '#90d8ff');
        await this.wait(150);
      }
      this.showActionBanner(actorView, actor.pow.abilities.basic.name, '#8eeaff');
      if (actorView && targetView) { const p = targetView.getWorldPosition(); await actorView.playAttackLunge(p.x, p.y); }
      const result = this.basicAttack.resolve(actor, target);
      this.handleBossAction(actor, { targetId: target.instanceId });
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();
      if (targetView) {
        if (result.evaded) this.showFloatingLabel(targetView, 'NÉ TRÁNH', '#d8f3ff');
        else {
          await targetView.playHit();
          this.showDamageNumber(targetView, result.hpDamage, result.shieldDamage, result.defeated, result.crit);
          if (result.freezeShattered) this.showFloatingLabel(targetView, 'PHÁ BĂNG · +30%', '#8eeaff');
        }
      }
      this.showRageGain(actorView, result.rageGained, result.rawRageGain);
      await this.wait(300);
      return true;
    });
    if (completed === null) this.recoverTurnFlow(); else this.afterAction();
  }

  private async performAbility(actor: CombatUnitState, requestedTarget: CombatUnitState, slot: CombatAbilitySlot): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);
    const ability = slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);
      const guard = requestedTarget.side !== actor.side
        ? this.guard.resolve(actor, requestedTarget, ability, this.combatState.activeLiving(requestedTarget.side))
        : { target: requestedTarget, guarded: false };
      const target = guard.target;
      const targetView = this.powViews.get(target.instanceId);
      const selfTargeted = actor.instanceId === target.instanceId;
      if (guard.guarded && targetView) {
        this.showFloatingLabel(targetView, `BẢO HỘ CHO ${requestedTarget.pow.name.toUpperCase()}`, '#90d8ff');
        await this.wait(150);
      }
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

      const result = slot === 'ultimate'
        ? this.skillActions.resolveUltimate(actor, target, ability, this.combatState.round)
        : this.skillActions.resolve(actor, target, ability, slot, this.combatState.round);
      this.handleBossAction(actor, { cleansed: result.cleansed, targetId: target.instanceId });
      if (result.targetSpeedChanged && target.instanceId !== actor.instanceId) this.turnManager.rescheduleUnit(target.instanceId);
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();
      if (result.revived) { this.restoreRevivedReserve(target); this.showFloatingLabel(this.powViews.get(target.instanceId), 'HỒI SINH · 35% HP', '#73f0aa'); }
      this.presentation.showElementOutcome(targetView, result.elementOutcome);
      if (slot === 'ultimate') await this.presentation.playUltimateImpact(targetView, actor.pow.elementKey, selfTargeted);
      if (result.evaded && targetView && !selfTargeted) this.showFloatingLabel(targetView, 'NÉ TRÁNH', '#d8f3ff');
      else if (result.damage > 0 && targetView && !selfTargeted) {
        await targetView.playHit();
        this.showDamageNumber(targetView, result.hpDamage, result.shieldDamage, result.defeated, result.crit);
      }
      if (result.freezeShattered) this.showFloatingLabel(targetView, 'PHÁ BĂNG · +30%', '#8eeaff');
      if (result.healed > 0) this.showFloatingLabel(this.isSelfStatus(result.statusLabel || '') ? actorView : targetView, `HỒI +${result.healed}`, '#73f0aa');
      if (result.shieldGranted > 0) this.showFloatingLabel(this.isSelfStatus(result.statusLabel || '') ? actorView : targetView, `KHIÊN +${result.shieldGranted}`, '#8edfff');
      if (result.cleansed) this.showFloatingLabel(targetView, 'THANH TẨY', '#a8ffd8');
      if (result.statusLabel && result.statusLabel !== 'evade' && !result.cleansed && !result.revived) {
        const statusView = this.isSelfStatus(result.statusLabel) ? actorView : targetView;
        this.showFloatingLabel(statusView, this.statusDisplayName(result.statusLabel), this.statusLabelColor(result.statusLabel));
      }
      if (result.rageSpent > 0) this.showFloatingLabel(actorView, `NỘ -${result.rageSpent} · CÒN ${result.rageAfter}`, '#ffcc8a');
      else this.showRageGain(actorView, result.rageGained, result.rawRageGain);
      await this.wait(slot === 'ultimate' ? 760 : 360);
      return true;
    });
    if (completed === null) this.recoverTurnFlow(); else this.afterAction();
  }

  private async applyStartOfTurnEffects(actor: CombatUnitState): Promise<void> {
    const view = this.powViews.get(actor.instanceId);

    if (actor.burnActionsRemaining > 0 && actor.burnDamage > 0 && actor.alive) {
      const frozen = actor.controlStatus === 'freeze' && actor.controlActionsRemaining > 0;
      const frostbitten = actor.freezeStage === 2 && actor.freezeStageActionsRemaining > 0;
      const vulnerability = frozen ? FREEZE_SHATTER_MULTIPLIER : frostbitten ? FROSTBITE_DAMAGE_MULTIPLIER : 1;
      const damage = Math.max(1, Math.round(actor.burnDamage * vulnerability));
      const dealt = this.applyEffectDamage(actor, damage);
      actor.burnActionsRemaining = Math.max(0, actor.burnActionsRemaining - 1);
      if (actor.burnActionsRemaining <= 0) actor.burnDamage = 0;
      if (frozen && dealt.total > 0) { actor.controlStatus = null; actor.controlActionsRemaining = 0; }
      this.combatState.sanitizeRuntimeNumbers(); this.refreshViews();
      if (view) {
        await view.playHit();
        this.showFloatingLabel(view, `THIÊU ĐỐT -${dealt.total}`, '#ff9b68');
        if (frozen && dealt.total > 0) this.showFloatingLabel(view, 'PHÁ BĂNG · +30%', '#8eeaff');
      }
      await this.wait(260);
    }

    if (actor.poisonActionsRemaining > 0 && actor.poisonStacks > 0 && actor.alive) {
      const frozen = actor.controlStatus === 'freeze' && actor.controlActionsRemaining > 0;
      const frostbitten = actor.freezeStage === 2 && actor.freezeStageActionsRemaining > 0;
      const vulnerability = frozen ? FREEZE_SHATTER_MULTIPLIER : frostbitten ? FROSTBITE_DAMAGE_MULTIPLIER : 1;
      const base = Math.max(1, Math.round(actor.pow.maxHp * 0.02 * actor.poisonStacks));
      const damage = Math.max(1, Math.round(base * vulnerability));
      const dealt = this.applyEffectDamage(actor, damage);
      actor.poisonActionsRemaining = Math.max(0, actor.poisonActionsRemaining - 1);
      if (actor.poisonActionsRemaining <= 0) actor.poisonStacks = 0;
      if (frozen && dealt.total > 0) { actor.controlStatus = null; actor.controlActionsRemaining = 0; }
      this.combatState.sanitizeRuntimeNumbers(); this.refreshViews();
      if (view) {
        await view.playHit();
        this.showFloatingLabel(view, `ĐỘC ×${Math.max(1, actor.poisonStacks || 1)} · -${dealt.total}`, '#a6e66f');
        if (frozen && dealt.total > 0) this.showFloatingLabel(view, 'PHÁ BĂNG · +30%', '#8eeaff');
      }
      await this.wait(260);
    }

    if (actor.regenerationActionsRemaining > 0 && actor.alive) {
      const poisonAnti = Math.min(0.4, actor.poisonStacks * 0.06);
      const antiHeal = Math.min(0.4, Math.max(0, actor.antiHeal) + poisonAnti);
      const healPower = Math.min(60, Math.max(0, actor.pow.healPower)) / 100;
      const raw = Math.round(actor.pow.maxHp * 0.06 * (1 + healPower) * (1 - antiHeal));
      const healed = Math.min(Math.max(0, actor.pow.maxHp - actor.hp), Math.max(0, raw));
      actor.hp += healed;
      actor.regenerationActionsRemaining = Math.max(0, actor.regenerationActionsRemaining - 1);
      this.combatState.sanitizeRuntimeNumbers(); this.refreshViews();
      if (healed > 0 && view) this.showFloatingLabel(view, `HỒI PHỤC +${healed}`, '#73f0aa');
      if (healed > 0) await this.wait(220);
    }
  }

  private applyEffectDamage(target: CombatUnitState, amount: number): { total: number; shield: number; hp: number } {
    const safe = Math.max(0, Math.round(amount));
    const shieldDamage = Math.min(Math.max(0, target.shield), safe);
    const hpDamage = Math.min(Math.max(0, target.hp), Math.max(0, safe - shieldDamage));
    target.shield = Math.max(0, target.shield - shieldDamage);
    target.hp = Math.max(0, target.hp - hpDamage);
    target.alive = target.hp > 0;
    return { total: shieldDamage + hpDamage, shield: shieldDamage, hp: hpDamage };
  }

  private afterAction(): void { void this.settleAfterAction(); }

  private handleBossAction(actor: CombatUnitState, result: { cleansed?: boolean; targetId?: string } = {}): void {
    const event = this.bossMode?.afterAction(actor, result);
    if (!event) return;
    this.combatState.sanitizeRuntimeNumbers();
    this.refreshViews();
    for (const targetId of event.targetIds) this.showFloatingLabel(this.powViews.get(targetId), event.label, event.phaseChanged ? '#ffd36a' : '#ffcf7a');
  }

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
    if (mode === 'ally') {
      const allies = this.combatState.activeLiving(actor.side);
      const eligible = abilityRequiresDebuffedAlly(ability) ? allies.filter(hasNegativeStatus) : allies;
      return eligible.sort((a, b) => a.hp / a.pow.maxHp - b.hp / b.pow.maxHp)[0] ?? null;
    }
    return this.combatState.units.filter((unit) => unit.side === actor.side && !unit.alive).sort((a, b) => a.slot - b.slot)[0] ?? null;
  }

  private clearTargeting(): void { for (const view of this.powViews.values()) { view.setSelectedTarget(false); view.setTargetable(false); } }

  private showActionBanner(view: PowView | undefined, name: string, color: string): void {
    if (!view) return;
    this.clearActionBanner();
    const p = view.getWorldPosition();
    const top = p.y < this.scale.height / 2;
    const y = top ? Math.min(this.scale.height / 2 - 115, p.y + 160) : Math.max(this.scale.height / 2 + 115, p.y - 160);
    const direction = top ? 1 : -1;
    const text = this.add.text(p.x, y - direction * 8, this.shortName(name, 32).toUpperCase(), { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '21px', color, fontStyle: 'bold', backgroundColor: '#07131ddd', padding: { x: 13, y: 8 }, stroke: '#06111c', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(46)
      .setAlpha(0);
    this.actionBanner = text;
    // Presentation-only lifecycle: 220ms appear, 1650ms readable hold, 300ms fade.
    this.tweens.add({
      targets: text,
      y,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.actionBanner !== text || !text.active) return;
        this.tweens.add({
          targets: text,
          y: y + direction * 10,
          alpha: 0,
          delay: 1650,
          duration: 300,
          ease: 'Quad.easeOut',
          onComplete: () => {
            if (this.actionBanner === text) this.actionBanner = null;
            text.destroy();
          }
        });
      }
    });
  }

  private clearActionBanner(): void {
    if (!this.actionBanner) return;
    this.tweens.killTweensOf(this.actionBanner);
    this.actionBanner.destroy();
    this.actionBanner = null;
  }

  private showDamageNumber(view: PowView, hpDamage: number, shieldDamage: number, defeated: boolean, crit = false): void {
    const p = view.getWorldPosition();
    const core = shieldDamage > 0 && hpDamage <= 0 ? `KHIÊN -${shieldDamage}` : shieldDamage > 0 ? `-${hpDamage} · KHIÊN -${shieldDamage}` : `-${hpDamage}`;
    const label = crit ? `CHÍ MẠNG · ${core}` : core;
    const text = this.add.text(p.x, p.y - 96, label, {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: defeated ? '38px' : crit ? '37px' : '34px',
      color: defeated ? '#ff6478' : crit ? '#fff09a' : shieldDamage > 0 ? '#8edfff' : '#ffd36a',
      fontStyle: 'bold', stroke: '#06111c', strokeThickness: 6
    }).setOrigin(0.5).setDepth(50);
    this.floatAndDestroy(text, crit ? 1450 : 1250);
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
    if (this.handoffRequest) this.showHandoffResult(win ? 'victory' : 'defeat');
  }

  private showHandoffError(width: number, height: number, message: string): void {
    const root = this.add.container(width / 2, height / 2).setDepth(200);
    const plate = this.add.rectangle(0, 0, Math.min(width * 0.78, 720), 260, 0x081723, 0.98).setStrokeStyle(2, 0xffb578, 0.85);
    const title = this.add.text(0, -72, 'KHONG THE KHOI TAO TRAN', { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '29px', color: '#ffe0c1', fontStyle: 'bold' }).setOrigin(0.5);
    const detail = this.add.text(0, -14, message, { fontFamily: COMBAT_BODY_FONT, fontSize: '17px', color: '#d2e3ea', align: 'center', wordWrap: { width: Math.min(width * 0.62, 570) } }).setOrigin(0.5);
    const button = this.add.rectangle(0, 80, 230, 48, 0x1d7d9c, 0.9).setStrokeStyle(1, 0xa9edff, 0.9).setInteractive({ useHandCursor: true });
    const label = this.add.text(0, 80, 'VE MAIN', { fontFamily: COMBAT_BODY_FONT, fontSize: '18px', color: '#f5fdff', fontStyle: 'bold' }).setOrigin(0.5);
    button.on('pointerup', () => { window.location.assign(new URL('./', window.location.href).toString()); });
    root.add([plate, title, detail, button, label]);
  }

  private handoffResult(kind: Combat2BattleResult['result']): Partial<Combat2BattleResult> {
    const request = this.handoffRequest!;
    const survivors = (side: CombatSide) => this.combatState.living(side).map((unit) => ({
      id: unit.pow.id,
      hp: Math.round(unit.hp),
      maxHp: Math.round(unit.pow.maxHp),
      rage: Math.round(unit.ragePoints)
    }));
    return createCombat2BattleResult(request, {
      result: kind,
      survivingState: { player: survivors('player'), enemy: survivors('enemy'), round: this.combatState.round },
      academicResponses: this.academicResponses,
      bossOutcome: this.bossMode?.snapshot()
    });
  }

  private showHandoffResult(kind: Combat2BattleResult['result']): void {
    if (this.resultOverlay || !this.handoffRequest) return;
    const result = this.handoffResult(kind);
    const published = publishCombat2BattleResult(result);
    if (!published.ok) {
      this.showHandoffError(this.scale.width, this.scale.height, published.errors?.join('; ') || 'Khong the luu ket qua tran');
      return;
    }
    const win = kind === 'victory';
    const root = this.add.container(this.scale.width / 2, this.scale.height / 2).setDepth(200);
    const plate = this.add.rectangle(0, 0, Math.min(this.scale.width * 0.78, 720), 276, 0x071621, 0.985).setStrokeStyle(3, win ? 0x73f0aa : 0xff7282, 0.9);
    const title = this.add.text(0, -78, win ? 'CHIEN THANG' : 'THAT BAI', { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '38px', color: win ? '#9affc4' : '#ffacb6', fontStyle: 'bold' }).setOrigin(0.5);
    const mode = this.add.text(0, -28, `KET QUA ${this.handoffRequest.battleMode.toUpperCase()} · VONG ${this.combatState.round}`, { fontFamily: COMBAT_BODY_FONT, fontSize: '17px', color: '#d7e8ee', fontStyle: 'bold' }).setOrigin(0.5);
    const note = this.add.text(0, 14, win ? 'Ket qua da san sang de Main xu ly phan thuong mot lan.' : 'Khong co phan thuong khi that bai.', { fontFamily: COMBAT_BODY_FONT, fontSize: '16px', color: '#b8ced8', align: 'center', wordWrap: { width: 540 } }).setOrigin(0.5);
    const button = this.add.rectangle(0, 90, 250, 50, win ? 0x287a58 : 0x8a3444, 0.95).setStrokeStyle(1, 0xf1f7f5, 0.85).setInteractive({ useHandCursor: true });
    const buttonLabel = this.add.text(0, 90, 'VE PHIEU LUU', { fontFamily: COMBAT_BODY_FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    button.on('pointerup', () => {
      this.stopBattleMusic();
      this.tweens.killAll();
      this.input.removeAllListeners();
      returnCombat2ResultToMain(result);
    });
    root.add([plate, title, mode, note, button, buttonLabel]);
    this.resultOverlay = root;
  }

  private refreshViews(): void { for (const unit of this.combatState.units) this.powViews.get(unit.instanceId)?.updateRuntime(unit); }
  private clearTurnHighlights(): void { for (const view of this.powViews.values()) view.setActiveTurn(false); }
  private destroyActionMenu(): void { this.actionMenu?.destroy(true); this.actionMenu = null; }
  private destroyUndoMenu(): void { this.undoMenu?.destroy(true); this.undoMenu = null; }
  private wait(ms: number): Promise<void> { return new Promise((resolve) => this.time.delayedCall(ms, resolve)); }

  private abilityResourceText(actor: CombatUnitState, ability: CombatAbility, slot: CombatAbilitySlot): string {
    if (this.skillActions.isSilenced(actor)) return 'CÂM LẶNG · CHỈ ĐÁNH THƯỜNG';
    const cooldown = this.skillActions.cooldownRemaining(actor, slot);
    if (cooldown > 0) return `CD ${cooldown} LƯỢT`;
    if (slot === 'ultimate') {
      if (actor.ragePoints < ULTIMATE_RAGE_COST) return `CẦN ${ULTIMATE_RAGE_COST} NỘ`;
      return `TỐN ${ULTIMATE_RAGE_COST} NỘ · ${this.actionTargetLabel(ability)}`;
    }
    return `+${this.skillActions.previewRawRageGain(ability, slot)} NỘ · ${this.actionTargetLabel(ability)}`;
  }

  private abilityTag(ability: CombatAbility): string {
    const status = String(ability.status || '').replace(/^self:/i, '').trim().toLowerCase();
    const type = String(ability.type || '').trim().toLowerCase();
    if (status === 'silence') return 'SIL';
    if (status === 'stun') return 'STUN';
    if (status === 'paralysis') return 'PARA';
    if (status === 'freeze') return 'ICE';
    if (status === 'slow') return 'SLOW';
    if (status === 'cleanse' || status === 'purify') return 'CLEAN';
    if (status === 'revive' || status === 'resurrection') return 'REVIVE';
    if (status === 'rage gain') return 'NỘ';
    if (status === 'ap up') return 'AP+';
    if (status === 'attack up') return 'ATK+';
    if (status === 'defense up') return 'DEF+';
    if (status === 'speed up') return 'SPD+';
    if (status === 'effect resist') return 'RES';
    if (status === 'guard') return 'GUARD';
    if (status === 'crit up') return 'CRIT+';
    if (status === 'evasion up') return 'EVA+';
    if (status === 'attack down') return 'ATK-';
    if (status === 'ap down') return 'AP-';
    if (status === 'defense down') return 'DEF-';
    if (status === 'accuracy down') return 'ACC-';
    if (status === 'anti heal') return 'HEAL-';
    if (status === 'burn') return 'BURN';
    if (status === 'poison') return 'POISON';
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
    return [
      'shield', 'regeneration', 'attack up', 'ap up', 'defense up', 'rage gain',
      'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
    ].includes(status.replace(/^self:/i, '').trim().toLowerCase());
  }

  private statusDisplayName(status: string): string {
    const normalized = status.replace(/^self:/i, '').trim().toLowerCase();
    const names: Record<string, string> = {
      shield: 'KHIÊN', regeneration: 'HỒI PHỤC', 'attack up': 'TĂNG CÔNG', 'ap up': 'TĂNG AP',
      'defense up': 'TĂNG THỦ', 'speed up': 'TĂNG TỐC', 'effect resist': 'KHÁNG HIỆU ỨNG',
      guard: 'BẢO HỘ', 'crit up': 'TĂNG CHÍ MẠNG', 'evasion up': 'TĂNG NÉ', 'rage gain': 'HỒI NỘ',
      'attack down': 'GIẢM CÔNG', 'ap down': 'GIẢM AP', 'defense down': 'GIẢM THỦ',
      'accuracy down': 'GIẢM CHÍNH XÁC', 'anti heal': 'GIẢM HỒI MÁU',
      silence: 'CÂM LẶNG', stun: 'CHOÁNG', paralysis: 'TÊ LIỆT',
      chill: 'LÀM LẠNH · -10% TỐC', frostbite: 'TÊ CÓNG · -20% TỐC · +10% ST',
      freeze: 'ĐÓNG BĂNG', slow: 'CHẬM', burn: 'THIÊU ĐỐT', poison: 'NHIỄM ĐỘC',
      evade: 'NÉ TRÁNH', 'control miss': 'KHỐNG CHẾ TRƯỢT', 'control immune': 'MIỄN KHỐNG',
      'control immunity': 'MIỄN KHỐNG · 2 LƯỢT'
    };
    return names[normalized] ?? status.toUpperCase();
  }

  private statusLabelColor(status: string): string {
    const normalized = status.replace(/^self:/i, '').trim().toLowerCase();
    if (normalized === 'control immunity' || normalized === 'control immune') return '#8ef7ff';
    if (normalized === 'control miss' || normalized === 'evade') return '#d8f3ff';
    if (normalized === 'freeze' || normalized === 'chill' || normalized === 'frostbite') return '#8edfff';
    if (normalized === 'stun' || normalized === 'paralysis') return '#ffe66f';
    if (normalized === 'silence') return '#d6a7ff';
    if (normalized === 'burn') return '#ff9b68';
    if (normalized === 'poison') return '#a6e66f';
    if (normalized.includes('down') || normalized === 'anti heal') return '#ff9aa9';
    if (this.isSelfStatus(normalized)) return '#89f0c0';
    return '#c9b0ff';
  }

  private shortName(name: string, maxLength: number): string { const clean = String(name || '').trim(); return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean; }

  private createBattlefield(width: number, height: number): void {
    if (this.textures.exists(BATTLE_BG_KEY)) {
      const image = this.add.image(width / 2, height / 2, BATTLE_BG_KEY).setDepth(-20);
      const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const coverScale = Math.max(width / Math.max(1, source.width), height / Math.max(1, source.height));
      image.setScale(coverScale);
      this.add.rectangle(width / 2, height / 2, width, height, 0x03101b, 0.38).setDepth(-19);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x071827, 1).setDepth(-20);
    }
    const g = this.add.graphics().setDepth(-18);
    g.fillStyle(0x071827, 0.34).fillEllipse(width / 2, height / 2, Math.min(1260, width * 0.88), Math.min(450, height * 0.52));
    g.lineStyle(2, 0xd7b86c, 0.22).strokeEllipse(width / 2, height / 2, Math.min(1260, width * 0.88), Math.min(450, height * 0.52));
    g.lineStyle(1, 0xb9e8ff, 0.18).lineBetween(width * 0.08, height / 2, width * 0.92, height / 2);
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
