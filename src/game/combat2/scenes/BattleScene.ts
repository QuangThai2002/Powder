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
      .text(width / 2, height / 2 - 18, 'ROUND 1', {
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
      .text(width / 2, height / 2 + 18, '', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#9fc7d7'
      })
      .setOrigin(0.5);

    this.showPreBattleIntro(width, height);
  }

  private showPreBattleIntro(width: number, height: number): void {
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.48);
    const plateWidth = Math.min(600, width - 70);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 142, 0x081d2a, 0.96);
    plate.setStrokeStyle(2, 0x58d8ef, 0.72);

    const title = this.add
      .text(width / 2, height / 2 - 34, 'POWDER COMBAT 2.1.9', {
        fontFamily: 'Arial',
        fontSize: '29px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(
        width / 2,
        height / 2 + 4,
        '3 POW CHÍNH · 2 DỰ BỊ · SKILL IDENTITY · ULTIMATE',
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
        height / 2 + 35,
        'Chọn mục tiêu · kỹ năng có nhịp riêng · Ultimate có cinematic ngắn',
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
      delay: 850,
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

    this.destroyActionMenu();
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

    this.preparePlayerTargeting();
    this.createActionMenu(actor);
  }

  private async performEnemyAction(actor: CombatUnitState): Promise<void> {
    const enemyTarget = this.pickTarget('player');

    if (this.skillActions.canUseUltimate(actor)) {
      const ability = actor.pow.abilities.ultimate;
      const target = this.abilityTargetsSelf(ability) ? actor : enemyTarget;
      if (target) {
        await this.performAbility(actor, target, 'ultimate');
        return;
      }
    }

    const preferredSkill: CombatSkillSlot = actor.slot % 2 === 0 ? 0 : 1;
    if (this.skillActions.canUse(actor, preferredSkill)) {
      const ability = actor.pow.abilities.skills[preferredSkill];
      const target = this.abilityTargetsSelf(ability) ? actor : enemyTarget;
      if (target) {
        await this.performAbility(actor, target, preferredSkill);
        return;
      }
    }

    if (enemyTarget) {
      await this.performBasicAttack(actor, enemyTarget);
      return;
    }

    this.afterAction();
  }

  private createActionMenu(actor: CombatUnitState): void {
    const basic = actor.pow.abilities.basic;
    const skill1 = actor.pow.abilities.skills[0];
    const skill2 = actor.pow.abilities.skills[1];
    const ultimate = actor.pow.abilities.ultimate;
    const skill1Cost = this.skillActions.costFor(0);
    const skill2Cost = this.skillActions.costFor(1);
    const rageCost = this.skillActions.ultimateRageCost();

    const actions: ActionMenuItem[] = [
      {
        label: 'ĐÒN CƠ BẢN',
        detail: this.shortName(basic.name, 20),
        resource: '+8 MANA · +12 NỘ',
        glyph: '◆',
        tag: 'ATK',
        iconKey: basic.iconKey,
        color: 0x0b5268,
        enabled: true,
        run: () => this.runPlayerTargetAction(actor, 'basic')
      },
      {
        label: 'KỸ NĂNG 1',
        detail: `${this.shortName(skill1.name, 18)}${this.abilityTargetsSelf(skill1) ? ' · Bản thân' : ''}`,
        resource: `${skill1Cost} MANA`,
        glyph: 'I',
        tag: this.abilityTag(skill1),
        iconKey: skill1.iconKey,
        color: 0x315d78,
        enabled: this.skillActions.canUse(actor, 0),
        run: () => this.runPlayerTargetAction(actor, 0)
      },
      {
        label: 'KỸ NĂNG 2',
        detail: `${this.shortName(skill2.name, 18)}${this.abilityTargetsSelf(skill2) ? ' · Bản thân' : ''}`,
        resource: `${skill2Cost} MANA`,
        glyph: 'II',
        tag: this.abilityTag(skill2),
        iconKey: skill2.iconKey,
        color: 0x493b78,
        enabled: this.skillActions.canUse(actor, 1),
        run: () => this.runPlayerTargetAction(actor, 1)
      },
      {
        label: 'ULTIMATE',
        detail: `${this.shortName(ultimate.name, 18)}${this.abilityTargetsSelf(ultimate) ? ' · Bản thân' : ''}`,
        resource: `${rageCost} NỘ`,
        glyph: '★',
        tag: 'ULT',
        iconKey: ultimate.iconKey,
        color: 0x70472b,
        enabled: this.skillActions.canUseUltimate(actor),
        run: () => this.runPlayerTargetAction(actor, 'ultimate')
      }
    ];

    const portrait = this.isPortrait();
    const fourColumns = !portrait && this.scale.width >= 760;
    const columns = fourColumns ? 4 : 2;
    const rows = Math.ceil(actions.length / columns);
    const gapX = fourColumns ? 8 : 10;
    const gapY = 8;
    const horizontalPadding = portrait ? 28 : 48;
    const availableWidth = Math.max(320, this.scale.width - horizontalPadding * 2);
    const buttonWidth = fourColumns
      ? Math.min(182, (availableWidth - gapX * 3) / 4)
      : Math.min(242, (availableWidth - gapX) / 2);
    const buttonHeight = 72;
    const totalWidth = columns * buttonWidth + (columns - 1) * gapX;
    const totalHeight = rows * buttonHeight + (rows - 1) * gapY;
    const desiredY = this.scale.height / 2 + (portrait ? 112 : 92);
    const menuY = Math.min(
      this.scale.height - totalHeight / 2 - 18,
      desiredY
    );
    const menu = this.add.container(this.scale.width / 2, menuY);
    menu.setDepth(30);

    actions.forEach((action, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = -totalWidth / 2 + buttonWidth / 2 + column * (buttonWidth + gapX);
      const y = -totalHeight / 2 + buttonHeight / 2 + row * (buttonHeight + gapY);
      const left = x - buttonWidth / 2;
      const background = this.add.rectangle(
        x,
        y,
        buttonWidth,
        buttonHeight,
        action.enabled ? action.color : 0x26333b,
        action.enabled ? 0.95 : 0.64
      );
      background.setStrokeStyle(
        1,
        action.enabled ? 0x70dced : 0x56636b,
        action.enabled ? 0.72 : 0.42
      );

      const iconX = left + (fourColumns ? 28 : 30);
      const iconSize = fourColumns ? 42 : 46;
      const iconPlate = this.add
        .rectangle(iconX, y, iconSize + 4, iconSize + 4, 0x05121c, 0.62)
        .setStrokeStyle(1, action.enabled ? 0x6ccfe3 : 0x4d5c64, 0.55);

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
            fontSize: action.glyph.length > 1 ? '12px' : '18px',
            color: action.enabled ? '#eafcff' : '#75858d',
            fontStyle: 'bold'
          })
          .setOrigin(0.5);
      }

      const textLeft = left + (fourColumns ? 55 : 60);
      const textWidth = Math.max(72, buttonWidth - (textLeft - left) - 9);
      const header = this.add
        .text(textLeft, y - 21, `${action.label} · ${action.tag}`, {
          fontFamily: 'Arial',
          fontSize: fourColumns ? '9px' : '10px',
          color: action.enabled ? '#ffffff' : '#85959d',
          fontStyle: 'bold',
          fixedWidth: textWidth
        })
        .setOrigin(0, 0.5);

      const detail = this.add
        .text(textLeft, y - 1, action.detail, {
          fontFamily: 'Arial',
          fontSize: fourColumns ? '8px' : '9px',
          color: action.enabled ? '#c6e0e8' : '#71818a',
          fixedWidth: textWidth
        })
        .setOrigin(0, 0.5);

      const resource = this.add
        .text(textLeft, y + 20, action.resource, {
          fontFamily: 'Arial',
          fontSize: fourColumns ? '8px' : '9px',
          color: action.enabled ? '#8eeaff' : '#66767e',
          fontStyle: 'bold',
          fixedWidth: textWidth
        })
        .setOrigin(0, 0.5);

      const hitArea = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0xffffff, 0.001);

      if (action.enabled) {
        hitArea.setInteractive({ useHandCursor: true });
        hitArea.on('pointerover', () => background.setAlpha(1).setScale(1.015));
        hitArea.on('pointerout', () => background.setAlpha(0.95).setScale(1));
        hitArea.once('pointerup', () => {
          this.destroyActionMenu();
          action.run();
        });
      }

      menu.add([background, iconPlate, visual, header, detail, resource, hitArea]);
    });

    this.actionMenu = menu;
  }

  private runPlayerTargetAction(
    actor: CombatUnitState,
    action: 'basic' | CombatAbilitySlot
  ): void {
    if (action === 'basic') {
      const target = this.getSelectedEnemyTarget();
      if (!target) {
        this.preparePlayerTargeting();
        this.createActionMenu(actor);
        return;
      }

      this.clearTargeting();
      void this.performBasicAttack(actor, target);
      return;
    }

    const ability = action === 'ultimate'
      ? actor.pow.abilities.ultimate
      : actor.pow.abilities.skills[action];
    const target = this.abilityTargetsSelf(ability)
      ? actor
      : this.getSelectedEnemyTarget();

    if (!target) {
      this.preparePlayerTargeting();
      this.createActionMenu(actor);
      return;
    }

    this.clearTargeting();
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
        selfTargeted ? 0x73f0aa : slot === 'ultimate' ? 0xffc95f : slot === 0 ? 0x70dced : 0xb69cff
      );

      if (!selfTargeted && ability.type.toLowerCase() !== 'support' && actorView && targetView) {
        const targetPosition = targetView.getWorldPosition();
        await actorView.playAttackLunge(targetPosition.x, targetPosition.y);
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

      if (result.statusLabel) {
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
    this.destroyActionMenu();
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
    }
  }

  private recoverTurnFlow(): void {
    this.destroyActionMenu();
    this.clearTargeting();
    this.turnManager.recoverActionLock();
    this.afterAction();
  }

  private preparePlayerTargeting(): void {
    const enemies = this.combatState
      .activeLiving('enemy')
      .sort((a, b) => (a.fieldSlot ?? 99) - (b.fieldSlot ?? 99));

    const selectedStillAlive = enemies.some(
      (unit) => unit.instanceId === this.selectedTargetId
    );

    if (!selectedStillAlive) {
      this.selectedTargetId = enemies[0]?.instanceId ?? null;
    }

    for (const enemy of enemies) {
      const view = this.powViews.get(enemy.instanceId);
      view?.setTargetable(true);
      view?.setSelectedTarget(enemy.instanceId === this.selectedTargetId);
    }

    const target = this.selectedTargetId
      ? this.combatState.getUnit(this.selectedTargetId)
      : undefined;

    if (target) {
      this.turnText
        .setText(`MỤC TIÊU: ${target.pow.name} · nhấn Pow khác để đổi`)
        .setColor('#8eeaff');
    }
  }

  private selectTarget(instanceId: string): void {
    const currentActor = this.combatState.currentUnitId
      ? this.combatState.getUnit(this.combatState.currentUnitId)
      : undefined;
    const target = this.combatState.getUnit(instanceId);

    if (
      this.combatState.phase !== 'selecting' ||
      currentActor?.side !== 'player' ||
      !target?.alive ||
      target.fieldSlot === null ||
      target.side !== 'enemy'
    ) {
      return;
    }

    this.selectedTargetId = instanceId;

    for (const enemy of this.combatState.activeLiving('enemy')) {
      this.powViews
        .get(enemy.instanceId)
        ?.setSelectedTarget(enemy.instanceId === instanceId);
    }

    this.turnText
      .setText(`MỤC TIÊU: ${target.pow.name}`)
      .setColor('#ffdc6d');
  }

  private getSelectedEnemyTarget(): CombatUnitState | null {
    const selected = this.selectedTargetId
      ? this.combatState.getUnit(this.selectedTargetId)
      : undefined;

    if (
      selected?.alive &&
      selected.side === 'enemy' &&
      selected.fieldSlot !== null
    ) {
      return selected;
    }

    return this.pickTarget('enemy');
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
    this.destroyActionMenu();
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

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  private abilityTag(ability: CombatAbility): string {
    const type = String(ability.type || '').trim().toLowerCase();
    if (type === 'support') {
      return 'SUP';
    }
    if (type === 'debuff') {
      return 'CTRL';
    }
    return 'ATK';
  }

  private abilityTargetsSelf(ability: CombatAbility): boolean {
    const type = String(ability.type || '').trim().toLowerCase();
    const status = String(ability.status || '').trim().toLowerCase();
    return type === 'support' || [
      'shield',
      'regeneration',
      'attack up',
      'defense up',
      'ap up'
    ].includes(status);
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
