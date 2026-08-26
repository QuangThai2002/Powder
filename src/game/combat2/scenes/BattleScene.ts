import Phaser from 'phaser';
import type {
  CombatAbility,
  CombatPow,
  CombatSide
} from '../data/CombatPow';
import {
  ACTIVE_TEAM_SIZE,
  ALL_COMBAT2_STARTER_POWS,
  COMBAT2_STARTER_ROSTER
} from '../data/PowderDataAdapter';
import { ActionPipeline } from '../systems/ActionPipeline';
import {
  abilityHasLegalTarget,
  abilityTargetMode,
  hasNegativeStatus,
  type CombatAbilityTargetMode
} from '../systems/CombatAbilityTargeting';
import { BasicAttackResolver } from '../systems/BasicAttackResolver';
import { CombatState, type CombatUnitState } from '../systems/CombatState';
import {
  SkillActionResolver,
  type CombatAbilitySlot,
  type CombatSkillSlot
} from '../systems/SkillActionResolver';
import { TurnManager } from '../systems/TurnManager';
import { CombatPresentationDirector } from '../views/CombatPresentationDirector';
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
  private selectedTargetId: string | null = null;
  private flowStarted = false;
  private lineupSettling = false;

  constructor() {
    super('BattleScene');
  }

  preload(): void {
    for (const pow of ALL_COMBAT2_STARTER_POWS) {
      if (!this.textures.exists(pow.assetKey)) {
        this.load.image(pow.assetKey, pow.assetUrl);
      }
    }

    // Load only the abilities used by the ten-Pow test roster. This keeps
    // enemy skill/Ultimate cinematics visually complete without loading the
    // entire 390-skill library into every battle.
    for (const pow of ALL_COMBAT2_STARTER_POWS) {
      const abilities = [
        pow.abilities.basic,
        ...pow.abilities.skills,
        pow.abilities.ultimate
      ];

      for (const ability of abilities) {
        if (
          ability.iconKey &&
          ability.iconUrl &&
          !this.textures.exists(ability.iconKey)
        ) {
          this.load.image(ability.iconKey, ability.iconUrl);
        }
      }
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.combatState = new CombatState(
      COMBAT2_STARTER_ROSTER.player,
      COMBAT2_STARTER_ROSTER.enemy
    );
    this.turnManager = new TurnManager(this.combatState);
    this.actionPipeline = new ActionPipeline(this.turnManager);
    this.basicAttack = new BasicAttackResolver();
    this.skillActions = new SkillActionResolver();
    this.presentation = new CombatPresentationDirector(this);

    this.cameras.main.setBackgroundColor('#06111c');
    this.createBattlefield(width, height);

    this.createTeam('enemy', COMBAT2_STARTER_ROSTER.enemy);
    this.createTeam('player', COMBAT2_STARTER_ROSTER.player);

    this.roundText = this.add
      .text(width / 2, height / 2 - 60, 'ROUND 1', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#0a2433',
        padding: { x: 13, y: 6 }
      })
      .setOrigin(0.5)
      .setAlpha(0.88);

    this.turnText = this.add
      .text(width / 2, height / 2 - 28, '', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#9fc7d7'
      })
      .setOrigin(0.5);

    this.showPreBattleIntro(width, height);
  }

  private showPreBattleIntro(width: number, height: number): void {
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.48);
    const plateWidth = Math.min(660, width - 70);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 148, 0x081d2a, 0.96);
    plate.setStrokeStyle(2, 0x58d8ef, 0.72);

    const title = this.add
      .text(width / 2, height / 2 - 38, 'POWDER COMBAT 2.2.0', {
        fontFamily: 'Arial',
        fontSize: '29px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(
        width / 2,
        height / 2 + 2,
        '3 POW CHÍNH · 2 DỰ BỊ · LARGE SKILL DOCK · TARGET CONFIRM',
        {
          fontFamily: 'Arial',
          fontSize: '13px',
          color: '#72d8ed'
        }
      )
      .setOrigin(0.5);

    const hint = this.add
      .text(
        width / 2,
        height / 2 + 38,
        'Chọn chiêu → dock ẩn → chọn mục tiêu · có Hoàn tác · hỗ trợ Thanh Tẩy/Hồi Sinh',
        {
          fontFamily: 'Arial',
          fontSize: '11px',
          color: '#9bb8c7'
        }
      )
      .setOrigin(0.5);

    const intro = this.add.container(0, 0, [shade, plate, title, subtitle, hint]);
    intro.setDepth(100);

    this.tweens.add({
      targets: intro,
      alpha: 0,
      delay: 900,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => {
        intro.destroy(true);
        this.startCombatFlow();
      }
    });
  }

  private startCombatFlow(): void {
    if (this.flowStarted) {
      return;
    }

    this.flowStarted = true;
    this.beginNextTurn();
  }

  private beginNextTurn(): void {
    if (this.lineupSettling) {
      return;
    }

    this.pendingPlayerAction = null;
    this.destroyActionMenu();
    this.destroyUndoMenu();
    this.clearTargeting();
    this.clearTurnHighlights();
    this.refreshViews();

    if (this.combatState.isBattleOver()) {
      this.finishBattle();
      return;
    }

    const actor = this.turnManager.beginNextTurn();

    if (!actor) {
      this.turnText.setText('Không tìm được lượt hợp lệ');
      return;
    }

    this.roundText.setText(`ROUND ${this.combatState.round}`);
    this.turnText
      .setText(`LƯỢT: ${actor.pow.name}`)
      .setColor(actor.side === 'player' ? '#6fe5ff' : '#ffb18d');

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
      const controlLabel = actor.controlStatus === 'freeze' ? 'ĐÓNG BĂNG' : 'CHOÁNG';
      this.turnText
        .setText(`${actor.pow.name}: ${controlLabel} · MẤT LƯỢT`)
        .setColor('#ffce7a');

      const actorView = this.powViews.get(actor.instanceId);
      const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
        actorView?.setActiveTurn(false);
        await actorView?.playStatusPulse();
        await this.wait(150);
        return true;
      });

      if (completed === null) {
        this.recoverTurnFlow();
        return;
      }

      this.afterAction();
      return;
    }

    if (actor.side === 'enemy') {
      this.time.delayedCall(260, () => void this.performEnemyAction(actor));
      return;
    }

    this.createActionMenu(actor);
  }

  private async performEnemyAction(actor: CombatUnitState): Promise<void> {
    if (this.skillActions.canUseUltimate(actor)) {
      const ability = actor.pow.abilities.ultimate;
      if (abilityHasLegalTarget(ability, actor, this.combatState.units)) {
        const target = this.pickAbilityTarget(actor, ability);
        if (target) {
          await this.performAbility(actor, target, 'ultimate');
          return;
        }
      }
    }

    const preferredSkill: CombatSkillSlot = actor.slot % 2 === 0 ? 0 : 1;
    if (this.skillActions.canUse(actor, preferredSkill)) {
      const ability = actor.pow.abilities.skills[preferredSkill];
      if (abilityHasLegalTarget(ability, actor, this.combatState.units)) {
        const target = this.pickAbilityTarget(actor, ability);
        if (target) {
          await this.performAbility(actor, target, preferredSkill);
          return;
        }
      }
    }

    const enemyTarget = this.pickTarget('player');
    if (enemyTarget) {
      await this.performBasicAttack(actor, enemyTarget);
      return;
    }

    this.afterAction();
  }

  private createActionMenu(actor: CombatUnitState): void {
    this.destroyActionMenu();
    this.destroyUndoMenu();
    this.pendingPlayerAction = null;
    this.clearTargeting();

    const basic = actor.pow.abilities.basic;
    const skill1 = actor.pow.abilities.skills[0];
    const skill2 = actor.pow.abilities.skills[1];
    const ultimate = actor.pow.abilities.ultimate;
    const skill1Cost = this.skillActions.costFor(0);
    const skill2Cost = this.skillActions.costFor(1);
    const rageCost = this.skillActions.ultimateRageCost();
    const skill1HasTarget = abilityHasLegalTarget(skill1, actor, this.combatState.units);
    const skill2HasTarget = abilityHasLegalTarget(skill2, actor, this.combatState.units);
    const ultimateHasTarget = abilityHasLegalTarget(ultimate, actor, this.combatState.units);

    const actions: ActionMenuItem[] = [
      {
        label: 'ĐÒN CƠ BẢN',
        detail: this.shortName(basic.name, 23),
        resource: '+8 MANA · +12 NỘ · CHỌN ĐỊCH',
        glyph: '◆',
        tag: 'ATK',
        iconKey: basic.iconKey,
        color: 0x0b5268,
        enabled: this.combatState.activeLiving('enemy').length > 0,
        run: () => this.beginPlayerActionSelection(actor, 'basic')
      },
      {
        label: 'KỸ NĂNG 1',
        detail: this.shortName(skill1.name, 23),
        resource: `${skill1Cost} MANA · ${this.actionTargetLabel(skill1, skill1HasTarget)}`,
        glyph: 'I',
        tag: this.abilityTag(skill1),
        iconKey: skill1.iconKey,
        color: 0x315d78,
        enabled: this.skillActions.canUse(actor, 0) && skill1HasTarget,
        run: () => this.beginPlayerActionSelection(actor, 0)
      },
      {
        label: 'KỸ NĂNG 2',
        detail: this.shortName(skill2.name, 23),
        resource: `${skill2Cost} MANA · ${this.actionTargetLabel(skill2, skill2HasTarget)}`,
        glyph: 'II',
        tag: this.abilityTag(skill2),
        iconKey: skill2.iconKey,
        color: 0x493b78,
        enabled: this.skillActions.canUse(actor, 1) && skill2HasTarget,
        run: () => this.beginPlayerActionSelection(actor, 1)
      },
      {
        label: 'ULTIMATE',
        detail: this.shortName(ultimate.name, 23),
        resource: `${rageCost} NỘ · ${this.actionTargetLabel(ultimate, ultimateHasTarget)}`,
        glyph: '★',
        tag: 'ULT',
        iconKey: ultimate.iconKey,
        color: 0x70472b,
        enabled: this.skillActions.canUseUltimate(actor) && ultimateHasTarget,
        run: () => this.beginPlayerActionSelection(actor, 'ultimate')
      }
    ];

    const columns = 4;
    const gapX = 12;
    const buttonWidth = 246;
    const buttonHeight = 94;
    const totalWidth = columns * buttonWidth + (columns - 1) * gapX;
    const menuY = Math.round(this.scale.height * 0.584);
    const menu = this.add.container(this.scale.width / 2, menuY);
    menu.setDepth(30);

    actions.forEach((action, index) => {
      const x = -totalWidth / 2 + buttonWidth / 2 + index * (buttonWidth + gapX);
      const y = 0;
      const left = x - buttonWidth / 2;
      const background = this.add.rectangle(
        x,
        y,
        buttonWidth,
        buttonHeight,
        action.enabled ? action.color : 0x26333b,
        action.enabled ? 0.96 : 0.66
      );
      background.setStrokeStyle(
        2,
        action.enabled ? 0x70dced : 0x56636b,
        action.enabled ? 0.74 : 0.42
      );

      const iconX = left + 39;
      const iconSize = 58;
      const iconPlate = this.add
        .rectangle(iconX, y, 66, 66, 0x05121c, 0.68)
        .setStrokeStyle(2, action.enabled ? 0x6ccfe3 : 0x4d5c64, 0.56);

      let visual: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
      if (action.iconKey && this.textures.exists(action.iconKey)) {
        visual = this.add
          .image(iconX, y, action.iconKey)
          .setDisplaySize(iconSize, iconSize)
          .setAlpha(action.enabled ? 1 : 0.48);

        if (!action.enabled) {
          visual.setTint(0x718087);
        }
      } else {
        visual = this.add
          .text(iconX, y, action.glyph, {
            fontFamily: 'Arial',
            fontSize: action.glyph.length > 1 ? '17px' : '25px',
            color: action.enabled ? '#eafcff' : '#75858d',
            fontStyle: 'bold'
          })
          .setOrigin(0.5);
      }

      const textLeft = left + 78;
      const textWidth = buttonWidth - 88;
      const header = this.add
        .text(textLeft, y - 30, `${action.label} · ${action.tag}`, {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: action.enabled ? '#ffffff' : '#85959d',
          fontStyle: 'bold',
          fixedWidth: textWidth
        })
        .setOrigin(0, 0.5);

      const detail = this.add
        .text(textLeft, y - 4, action.detail, {
          fontFamily: 'Arial',
          fontSize: '11px',
          color: action.enabled ? '#d2e8ee' : '#71818a',
          fontStyle: 'bold',
          fixedWidth: textWidth
        })
        .setOrigin(0, 0.5);

      const resource = this.add
        .text(textLeft, y + 25, action.resource, {
          fontFamily: 'Arial',
          fontSize: '9px',
          color: action.enabled ? '#8eeaff' : '#66767e',
          fontStyle: 'bold',
          fixedWidth: textWidth,
          wordWrap: { width: textWidth, useAdvancedWrap: false }
        })
        .setOrigin(0, 0.5);

      const hitArea = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0xffffff, 0.001);

      if (action.enabled) {
        hitArea.setInteractive({ useHandCursor: true });
        hitArea.on('pointerover', () => background.setAlpha(1).setScale(1.012));
        hitArea.on('pointerout', () => background.setAlpha(0.96).setScale(1));
        hitArea.once('pointerup', () => {
          this.destroyActionMenu();
          action.run();
        });
      }

      menu.add([background, iconPlate, visual, header, detail, resource, hitArea]);
    });

    this.actionMenu = menu;
  }

  private beginPlayerActionSelection(
    actor: CombatUnitState,
    action: 'basic' | CombatAbilitySlot
  ): void {
    this.destroyActionMenu();
    this.clearTargeting();

    if (action === 'basic') {
      if (this.combatState.activeLiving('enemy').length === 0) {
        this.createActionMenu(actor);
        return;
      }

      this.pendingPlayerAction = {
        actorId: actor.instanceId,
        action,
        targetMode: 'enemy'
      };
      this.prepareTargeting(actor, 'enemy');
      this.createUndoMenu(actor);
      return;
    }

    const ability = action === 'ultimate'
      ? actor.pow.abilities.ultimate
      : actor.pow.abilities.skills[action];
    const targetMode = abilityTargetMode(ability);

    if (!abilityHasLegalTarget(ability, actor, this.combatState.units)) {
      this.turnText
        .setText(this.noLegalTargetMessage(ability))
        .setColor('#ffb18d');
      this.createActionMenu(actor);
      return;
    }

    if (targetMode === 'self') {
      this.pendingPlayerAction = null;
      void this.performAbility(actor, actor, action);
      return;
    }

    if (targetMode === 'deadAlly') {
      const fallen = this.combatState.units
        .filter((unit) => unit.side === actor.side && !unit.alive)
        .sort((a, b) => a.slot - b.slot)[0];

      if (!fallen) {
        this.createActionMenu(actor);
        return;
      }

      this.turnText
        .setText(`HỒI SINH: ${fallen.pow.name}`)
        .setColor('#73f0aa');
      void this.performAbility(actor, fallen, action);
      return;
    }

    this.pendingPlayerAction = {
      actorId: actor.instanceId,
      action,
      targetMode
    };
    this.prepareTargeting(actor, targetMode);
    this.createUndoMenu(actor);
  }

  private prepareTargeting(
    actor: CombatUnitState,
    targetMode: 'enemy' | 'ally'
  ): void {
    this.clearTargeting();

    const targets = targetMode === 'enemy'
      ? this.combatState.activeLiving(actor.side === 'player' ? 'enemy' : 'player')
      : this.combatState
          .activeLiving(actor.side)
          .filter((unit) => hasNegativeStatus(unit));

    for (const target of targets) {
      const view = this.powViews.get(target.instanceId);
      view?.setTargetable(true);
      view?.setSelectedTarget(false);
    }

    this.turnText
      .setText(
        targetMode === 'enemy'
          ? 'CHỌN MỤC TIÊU · chạm trực tiếp Pow địch'
          : 'CHỌN ĐỒNG MINH ĐANG BỊ HIỆU ỨNG XẤU'
      )
      .setColor(targetMode === 'enemy' ? '#8eeaff' : '#73f0aa');
  }

  private createUndoMenu(actor: CombatUnitState): void {
    this.destroyUndoMenu();

    const x = this.scale.width - 104;
    const y = this.scale.height / 2;
    const width = 142;
    const height = 42;
    const background = this.add
      .rectangle(x, y, width, height, 0x172d3b, 0.96)
      .setStrokeStyle(2, 0x70dced, 0.62);
    const label = this.add
      .text(x, y, '↩ HOÀN TÁC', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#eafcff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const hitArea = this.add
      .rectangle(x, y, width, height, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => background.setAlpha(1).setScale(1.02));
    hitArea.on('pointerout', () => background.setAlpha(0.96).setScale(1));
    hitArea.once('pointerup', () => this.cancelPlayerActionSelection(actor));

    this.undoMenu = this.add.container(0, 0, [background, label, hitArea]).setDepth(48);
  }

  private cancelPlayerActionSelection(actor: CombatUnitState): void {
    if (
      this.combatState.phase !== 'selecting' ||
      this.combatState.currentUnitId !== actor.instanceId
    ) {
      return;
    }

    this.pendingPlayerAction = null;
    this.destroyUndoMenu();
    this.clearTargeting();
    this.turnText
      .setText(`LƯỢT: ${actor.pow.name}`)
      .setColor('#6fe5ff');
    this.createActionMenu(actor);
  }

  private selectTarget(instanceId: string): void {
    const pending = this.pendingPlayerAction;
    if (!pending || this.combatState.phase !== 'selecting') {
      return;
    }

    const actor = this.combatState.getUnit(pending.actorId);
    const target = this.combatState.getUnit(instanceId);
    if (!actor || !target || this.combatState.currentUnitId !== actor.instanceId) {
      return;
    }

    const valid = pending.targetMode === 'enemy'
      ? target.side !== actor.side && target.alive && target.fieldSlot !== null
      : pending.targetMode === 'ally'
        ? target.side === actor.side && target.alive && target.fieldSlot !== null && hasNegativeStatus(target)
        : false;

    if (!valid) {
      return;
    }

    this.selectedTargetId = target.instanceId;
    this.powViews.get(target.instanceId)?.setSelectedTarget(true);

    const action = pending.action;
    this.pendingPlayerAction = null;
    this.destroyUndoMenu();
    this.clearTargeting();

    if (action === 'basic') {
      void this.performBasicAttack(actor, target);
      return;
    }

    void this.performAbility(actor, target, action);
  }

  private async performBasicAttack(
    actor: CombatUnitState,
    target: CombatUnitState
  ): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);
    const targetView = this.powViews.get(target.instanceId);

    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);
      this.showActionBanner(actorView, actor.pow.abilities.basic.name, '#8eeaff');
      this.showTargetCue(targetView, 0x70dced);

      if (actorView && targetView) {
        const targetPosition = targetView.getWorldPosition();
        await actorView.playAttackLunge(targetPosition.x, targetPosition.y);
      }

      const result = this.basicAttack.resolve(actor, target);
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();

      if (targetView) {
        await targetView.playHit();
        this.showDamageNumber(
          targetView,
          result.hpDamage,
          result.shieldDamage,
          result.defeated
        );
      }

      return true;
    });

    if (completed === null) {
      this.recoverTurnFlow();
      return;
    }

    this.afterAction();
  }

  private async performAbility(
    actor: CombatUnitState,
    target: CombatUnitState,
    slot: CombatAbilitySlot
  ): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);
    const targetView = this.powViews.get(target.instanceId);
    const ability = slot === 'ultimate'
      ? actor.pow.abilities.ultimate
      : actor.pow.abilities.skills[slot];
    const selfTargeted = target.instanceId === actor.instanceId;
    const targetMode = abilityTargetMode(ability);
    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);

      if (slot === 'ultimate') {
        this.roundText.setVisible(false);
        this.turnText.setVisible(false);
        try {
          await this.presentation.playUltimateIntro(
            actorView,
            ability,
            actor.side,
            actor.pow.elementKey
          );
        } finally {
          this.roundText.setVisible(true);
          this.turnText.setVisible(true);
        }
      } else {
        await this.presentation.playSkillIntro(
          actorView,
          targetView,
          ability,
          slot,
          actor.pow.elementKey,
          selfTargeted
        );
      }

      this.showActionBanner(
        actorView,
        ability.name,
        slot === 'ultimate' ? '#ffd36a' : slot === 0 ? '#8eeaff' : '#c9b0ff'
      );
      this.showTargetCue(
        targetView,
        targetMode === 'deadAlly'
          ? 0x73f0aa
          : selfTargeted
            ? 0x73f0aa
            : slot === 'ultimate'
              ? 0xffc95f
              : slot === 0
                ? 0x70dced
                : 0xb69cff
      );

      if (!selfTargeted && ability.type.toLowerCase() !== 'support' && actorView && targetView) {
        const targetPosition = targetView.getWorldPosition();
        await actorView.playAttackLunge(targetPosition.x, targetPosition.y);
      } else if (ability.type.toLowerCase() === 'support' && !selfTargeted && target.alive) {
        await actorView?.playStatusPulse();
        await targetView?.playStatusPulse();
      } else {
        await actorView?.playStatusPulse();
      }

      const result = slot === 'ultimate'
        ? this.skillActions.resolveUltimate(actor, target, ability)
        : this.skillActions.resolve(actor, target, ability, slot);

      if (result.targetSpeedChanged && target.instanceId !== actor.instanceId) {
        this.turnManager.rescheduleUnit(target.instanceId);
      }

      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();

      if (result.revived) {
        this.restoreRevivedReserve(target);
        const revivedView = this.powViews.get(target.instanceId);
        this.showReviveReturn(revivedView);
      }

      this.presentation.showElementOutcome(targetView, result.elementOutcome);

      if (slot === 'ultimate') {
        await this.presentation.playUltimateImpact(
          targetView,
          actor.pow.elementKey,
          selfTargeted
        );
      }

      if (result.damage > 0 && targetView && !selfTargeted) {
        await targetView.playHit();
        this.showDamageNumber(
          targetView,
          result.hpDamage,
          result.shieldDamage,
          result.defeated
        );
      }

      if (result.healed > 0) {
        this.showFloatingLabel(actorView, `HỒI +${result.healed}`, '#73f0aa');
      }

      if (result.shieldGranted > 0) {
        this.showFloatingLabel(
          actorView,
          `KHIÊN +${result.shieldGranted}`,
          '#8edfff'
        );
      }

      if (result.cleansed) {
        this.showFloatingLabel(targetView, 'THANH TẨY', '#a8ffd8');
      }

      if (result.revived) {
        this.showFloatingLabel(targetView, 'HỒI SINH · 35% HP', '#73f0aa');
      }

      if (result.statusLabel && !result.cleansed && !result.revived) {
        const statusView = this.isSelfStatus(result.statusLabel) ? actorView : targetView;
        this.showFloatingLabel(
          statusView,
          this.statusDisplayName(result.statusLabel),
          '#c9b0ff'
        );
      }

      await this.wait(slot === 'ultimate' ? 220 : 135);
      return true;
    });

    if (completed === null) {
      this.recoverTurnFlow();
      return;
    }

    this.afterAction();
  }

  private async applyStartOfTurnDot(actor: CombatUnitState): Promise<void> {
    if (
      actor.dotActionsRemaining <= 0 ||
      actor.dotDamage <= 0 ||
      !actor.dotStatus
    ) {
      return;
    }

    const damage = Math.min(actor.hp, Math.max(1, Math.round(actor.dotDamage)));
    const status = actor.dotStatus;

    actor.hp = Math.max(0, actor.hp - damage);
    actor.dotActionsRemaining = Math.max(0, actor.dotActionsRemaining - 1);
    if (actor.dotActionsRemaining <= 0) {
      actor.dotStatus = null;
      actor.dotDamage = 0;
    }

    this.combatState.sanitizeRuntimeNumbers();
    this.refreshViews();

    const view = this.powViews.get(actor.instanceId);
    if (view) {
      await view.playHit();
      this.showFloatingLabel(
        view,
        `${status === 'poison' ? 'ĐỘC' : 'THIÊU ĐỐT'} -${damage}`,
        status === 'poison' ? '#a6e66f' : '#ff9b68'
      );
    }

    await this.wait(120);
  }

  private afterAction(): void {
    void this.settleAfterAction();
  }

  private async settleAfterAction(): Promise<void> {
    if (this.lineupSettling) {
      return;
    }

    this.lineupSettling = true;
    this.pendingPlayerAction = null;
    this.destroyActionMenu();
    this.destroyUndoMenu();
    this.clearTargeting();
    this.refreshViews();

    try {
      await this.handleReservePromotions();
      this.refreshViews();

      if (this.combatState.isBattleOver()) {
        this.finishBattle();
        return;
      }
    } finally {
      this.lineupSettling = false;
    }

    this.time.delayedCall(170, () => this.beginNextTurn());
  }

  private async handleReservePromotions(): Promise<void> {
    for (const dead of this.combatState.units.filter((unit) => !unit.alive)) {
      this.turnManager.retireUnit(dead.instanceId);
    }

    const promotions = this.combatState.promoteReserves();

    for (const promotion of promotions) {
      const defeatedView = this.powViews.get(promotion.defeatedUnitId);
      const promotedView = this.powViews.get(promotion.promotedUnitId);
      const promotedUnit = this.combatState.getUnit(promotion.promotedUnitId);
      const fieldPosition = this.activePosition(promotion.side, promotion.fieldSlot);
      const exitY = promotion.side === 'enemy' ? -120 : this.scale.height + 120;

      if (defeatedView) {
        await defeatedView.retireFromField(
          defeatedView.getWorldPosition().x,
          exitY
        );
        defeatedView.container.setVisible(false);
      }

      if (promotedView && promotedUnit) {
        await promotedView.enterField(fieldPosition.x, fieldPosition.y);
        promotedView.updateRuntime(promotedUnit);
        this.turnManager.registerPromoted(promotedUnit.instanceId);
        this.showFloatingLabel(promotedView, 'DỰ BỊ VÀO SÂN', '#7ce8ff');
      }

      this.layoutReserveViews(promotion.side);
    }
  }

  private restoreRevivedReserve(unit: CombatUnitState): void {
    unit.fieldSlot = null;
    const view = this.powViews.get(unit.instanceId);
    if (view) {
      view.container.setVisible(true);
      view.updateRuntime(unit);
    }
    this.layoutReserveViews(unit.side);
  }

  private layoutReserveViews(side: CombatSide): void {
    const reserves = this.combatState.reserveLiving(side).slice(0, 2);

    reserves.forEach((unit, index) => {
      const view = this.powViews.get(unit.instanceId);
      if (!view) {
        return;
      }

      const position = this.reservePosition(side, index);
      view.container.setVisible(true).setPosition(position.x, position.y);
      view.setBenchScale(0.5);
      view.updateRuntime(unit);
    });
  }

  private showReviveReturn(view: PowView | undefined): void {
    if (!view) {
      return;
    }

    const position = view.getWorldPosition();
    const fx = this.add.container(position.x, position.y).setDepth(50).setScale(0.7);
    const outer = this.add.circle(0, 0, 54, 0x000000, 0).setStrokeStyle(4, 0x73f0aa, 0.9);
    const inner = this.add.circle(0, 0, 34, 0x73f0aa, 0.1).setStrokeStyle(2, 0xe9fff3, 0.76);
    const crossH = this.add.rectangle(0, 0, 38, 7, 0xe9fff3, 0.8);
    const crossV = this.add.rectangle(0, 0, 7, 38, 0xe9fff3, 0.8);
    fx.add([outer, inner, crossH, crossV]);

    this.tweens.add({
      targets: fx,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => fx.destroy(true)
    });
  }

  private recoverTurnFlow(): void {
    this.pendingPlayerAction = null;
    this.destroyActionMenu();
    this.destroyUndoMenu();
    this.clearTargeting();
    this.turnManager.recoverActionLock();
    this.afterAction();
  }

  private pickAbilityTarget(
    actor: CombatUnitState,
    ability: CombatAbility
  ): CombatUnitState | null {
    const mode = abilityTargetMode(ability);

    if (mode === 'self') {
      return actor;
    }

    if (mode === 'enemy') {
      return this.pickTarget(actor.side === 'player' ? 'enemy' : 'player');
    }

    if (mode === 'ally') {
      return this.combatState
        .activeLiving(actor.side)
        .filter((unit) => hasNegativeStatus(unit))
        .sort((a, b) => a.hp / a.pow.maxHp - b.hp / b.pow.maxHp)[0] ?? null;
    }

    return this.combatState.units
      .filter((unit) => unit.side === actor.side && !unit.alive)
      .sort((a, b) => a.slot - b.slot)[0] ?? null;
  }

  private clearTargeting(): void {
    for (const view of this.powViews.values()) {
      view.setSelectedTarget(false);
      view.setTargetable(false);
    }
    this.selectedTargetId = null;
  }

  private showActionBanner(
    view: PowView | undefined,
    abilityName: string,
    color: string
  ): void {
    if (!view) {
      return;
    }

    const position = view.getWorldPosition();
    const topTeam = position.y < this.scale.height / 2;
    const bannerY = topTeam
      ? Math.min(this.scale.height / 2 - 118, position.y + 160)
      : Math.max(this.scale.height / 2 + 118, position.y - 160);
    const text = this.add
      .text(position.x, bannerY, this.shortName(abilityName, 28).toUpperCase(), {
        fontFamily: 'Arial',
        fontSize: '13px',
        color,
        fontStyle: 'bold',
        backgroundColor: '#07131dcc',
        padding: { x: 9, y: 4 },
        stroke: '#06111c',
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(46)
      .setScale(0.94);

    this.tweens.add({
      targets: text,
      y: bannerY + (topTeam ? 10 : -10),
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 560,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private showTargetCue(view: PowView | undefined, color: number): void {
    if (!view) {
      return;
    }

    const position = view.getWorldPosition();
    const cue = this.add
      .circle(position.x, position.y - 2, 38, color, 0.08)
      .setStrokeStyle(2, color, 0.72)
      .setDepth(35);

    this.tweens.add({
      targets: cue,
      scaleX: 1.34,
      scaleY: 1.34,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => cue.destroy()
    });
  }

  private showDamageNumber(
    view: PowView,
    hpDamage: number,
    shieldDamage: number,
    defeated: boolean
  ): void {
    const position = view.getWorldPosition();
    const label = shieldDamage > 0 && hpDamage <= 0
      ? `KHIÊN -${shieldDamage}`
      : shieldDamage > 0
        ? `-${hpDamage} · 🛡${shieldDamage}`
        : `-${hpDamage}`;

    const text = this.add
      .text(position.x, position.y - 88, label, {
        fontFamily: 'Arial',
        fontSize: defeated ? '25px' : '21px',
        color: defeated ? '#ff6478' : shieldDamage > 0 ? '#8edfff' : '#ffd36a',
        fontStyle: 'bold',
        stroke: '#06111c',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(40);

    this.floatAndDestroy(text);
  }

  private showFloatingLabel(
    view: PowView | undefined,
    label: string,
    color: string
  ): void {
    if (!view) {
      return;
    }

    const position = view.getWorldPosition();
    const text = this.add
      .text(position.x, position.y - 92, label, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color,
        fontStyle: 'bold',
        stroke: '#06111c',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(42);

    this.floatAndDestroy(text);
  }

  private floatAndDestroy(text: Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: text,
      y: text.y - 32,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private pickTarget(side: CombatSide): CombatUnitState | null {
    const candidates = this.combatState
      .activeLiving(side)
      .sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));

    return candidates[0] ?? null;
  }

  private finishBattle(): void {
    this.pendingPlayerAction = null;
    this.destroyActionMenu();
    this.destroyUndoMenu();
    this.clearTargeting();
    this.clearTurnHighlights();
    this.refreshViews();

    const playerAlive = this.combatState.living('player').length > 0;
    const enemyAlive = this.combatState.living('enemy').length > 0;
    const result = playerAlive && !enemyAlive ? 'CHIẾN THẮNG' : 'THẤT BẠI';

    this.turnText.setText('');
    this.roundText
      .setText(result)
      .setFontSize(24)
      .setColor(playerAlive && !enemyAlive ? '#73f0aa' : '#ff7282');
  }

  private refreshViews(): void {
    for (const unit of this.combatState.units) {
      this.powViews.get(unit.instanceId)?.updateRuntime(unit);
    }
  }

  private clearTurnHighlights(): void {
    for (const view of this.powViews.values()) {
      view.setActiveTurn(false);
    }
  }

  private destroyActionMenu(): void {
    if (!this.actionMenu) {
      return;
    }

    this.actionMenu.destroy(true);
    this.actionMenu = null;
  }

  private destroyUndoMenu(): void {
    if (!this.undoMenu) {
      return;
    }

    this.undoMenu.destroy(true);
    this.undoMenu = null;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  private abilityTag(ability: CombatAbility): string {
    const type = String(ability.type || '').trim().toLowerCase();
    const status = String(ability.status || '').trim().toLowerCase();
    if (status === 'cleanse' || status === 'purify') {
      return 'CLEAN';
    }
    if (status === 'revive' || status === 'resurrection') {
      return 'REVIVE';
    }
    if (type === 'support') {
      return 'SUP';
    }
    if (type === 'debuff') {
      return 'CTRL';
    }
    return 'ATK';
  }

  private actionTargetLabel(ability: CombatAbility, hasTarget: boolean): string {
    const mode = abilityTargetMode(ability);
    if (!hasTarget) {
      if (mode === 'deadAlly') return 'CẦN POW GỤC';
      if (mode === 'ally') return 'CẦN DEBUFF';
      return 'CHƯA CÓ MỤC TIÊU';
    }
    if (mode === 'self') return 'BẢN THÂN';
    if (mode === 'ally') return 'CHỌN ĐỒNG MINH';
    if (mode === 'deadAlly') return 'HỒI SINH';
    return 'CHỌN ĐỊCH';
  }

  private noLegalTargetMessage(ability: CombatAbility): string {
    const mode = abilityTargetMode(ability);
    if (mode === 'deadAlly') {
      return 'Chưa có Pow đồng minh nào bị hạ gục';
    }
    if (mode === 'ally') {
      return 'Chưa có đồng minh nào cần Thanh Tẩy';
    }
    return `Không có mục tiêu hợp lệ cho ${ability.name}`;
  }

  private isSelfStatus(status: string): boolean {
    const normalized = status.trim().toLowerCase();
    return [
      'shield',
      'regeneration',
      'attack up',
      'defense up',
      'ap up'
    ].includes(normalized);
  }

  private statusDisplayName(status: string): string {
    const normalized = status.trim().toLowerCase();
    const names: Record<string, string> = {
      shield: 'KHIÊN',
      regeneration: 'HỒI PHỤC',
      'attack up': 'TĂNG CÔNG',
      'defense up': 'TĂNG THỦ',
      'ap up': 'HỒI MANA',
      cleanse: 'THANH TẨY',
      purify: 'THANH TẨY',
      revive: 'HỒI SINH',
      resurrection: 'HỒI SINH',
      stun: 'CHOÁNG',
      freeze: 'ĐÓNG BĂNG',
      slow: 'CHẬM',
      burn: 'THIÊU ĐỐT',
      poison: 'NHIỄM ĐỘC'
    };

    return names[normalized] ?? status.toUpperCase();
  }

  private shortName(name: string, maxLength = 18): string {
    const clean = String(name || '').trim();
    return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
  }

  private createBattlefield(width: number, height: number): void {
    const graphics = this.add.graphics();
    const portrait = this.isPortrait();
    const arenaWidth = portrait ? width * 0.88 : Math.min(1220, width * 0.86);
    const arenaHeight = portrait ? height * 0.42 : Math.min(430, height * 0.5);

    graphics.fillStyle(0x071827, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(0x0a2031, 0.74);
    graphics.fillEllipse(width / 2, height / 2, arenaWidth, arenaHeight);

    graphics.lineStyle(1, 0x21475c, 0.45);
    graphics.strokeEllipse(width / 2, height / 2, arenaWidth, arenaHeight);
    graphics.strokeEllipse(
      width / 2,
      height / 2,
      arenaWidth * 0.74,
      arenaHeight * 0.71
    );

    graphics.lineStyle(1, 0x15394e, 0.55);
    graphics.lineBetween(width * 0.07, height / 2, width * 0.93, height / 2);
  }

  private createTeam(side: CombatSide, team: CombatPow[]): void {
    team.forEach((pow, index) => {
      const instanceId = `${side}-${index}-${pow.id}`;
      const unit = this.combatState.getUnit(instanceId);
      if (!unit) {
        return;
      }

      const position = unit.fieldSlot !== null
        ? this.activePosition(side, unit.fieldSlot)
        : this.reservePosition(side, index - ACTIVE_TEAM_SIZE);
      const view = new PowView(this, position.x, position.y, pow, {
        side,
        width: 276,
        height: 290
      });

      if (unit.fieldSlot === null) {
        view.setBenchScale(0.5);
      }

      view.onTargetSelected(() => this.selectTarget(instanceId));
      this.powViews.set(instanceId, view);
      view.updateRuntime(unit);
    });
  }

  private activePosition(side: CombatSide, fieldSlot: number): Phaser.Math.Vector2 {
    const portrait = this.isPortrait();
    const spacing = portrait
      ? this.scale.width * 0.23
      : Math.min(350, this.scale.width * 0.23);
    const x = this.scale.width / 2 + (fieldSlot - 1) * spacing;
    const y = portrait
      ? (side === 'enemy' ? 164 : this.scale.height - 164)
      : (side === 'enemy' ? 164 : this.scale.height - 164);
    return new Phaser.Math.Vector2(x, y);
  }

  private reservePosition(side: CombatSide, reserveIndex: number): Phaser.Math.Vector2 {
    const inset = Math.max(86, this.scale.width * 0.075);
    const x = reserveIndex <= 0 ? inset : this.scale.width - inset;
    const y = side === 'enemy' ? 92 : this.scale.height - 92;
    return new Phaser.Math.Vector2(x, y);
  }

  private isPortrait(): boolean {
    return this.scale.height > this.scale.width;
  }
}
