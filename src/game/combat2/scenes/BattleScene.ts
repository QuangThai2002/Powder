import Phaser from 'phaser';
import type { CombatPow, CombatSide } from '../data/CombatPow';
import {
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
import { PowView } from '../views/PowView';

interface ActionMenuItem {
  label: string;
  detail: string;
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

  private readonly powViews = new Map<string, PowView>();
  private roundText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private actionMenu: Phaser.GameObjects.Container | null = null;
  private selectedTargetId: string | null = null;
  private flowStarted = false;

  constructor() {
    super('BattleScene');
  }

  preload(): void {
    for (const pow of ALL_COMBAT2_STARTER_POWS) {
      if (!this.textures.exists(pow.assetKey)) {
        this.load.image(pow.assetKey, pow.assetUrl);
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

    this.cameras.main.setBackgroundColor('#06111c');
    this.createBattlefield(width, height);

    this.createTeam(width, 166, 'enemy', COMBAT2_STARTER_ROSTER.enemy);
    this.createTeam(width, 734, 'player', COMBAT2_STARTER_ROSTER.player);

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
    const plate = this.add.rectangle(width / 2, height / 2, 590, 142, 0x081d2a, 0.96);
    plate.setStrokeStyle(2, 0x58d8ef, 0.72);

    const title = this.add
      .text(width / 2, height / 2 - 34, 'POWDER COMBAT 2.0.7', {
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
        'CANONICAL DATA · TARGET · SKILL 1 · SKILL 2 · ULTIMATE',
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
        'Nhấn Pow đối thủ để đổi mục tiêu · mọi action đều kết thúc hữu hạn',
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
    const target = this.pickTarget('player');
    if (!target) {
      this.afterAction();
      return;
    }

    if (this.skillActions.canUseUltimate(actor)) {
      await this.performAbility(actor, target, 'ultimate');
      return;
    }

    const preferredSkill: CombatSkillSlot = actor.slot % 2 === 0 ? 0 : 1;
    if (this.skillActions.canUse(actor, preferredSkill)) {
      await this.performAbility(actor, target, preferredSkill);
      return;
    }

    await this.performBasicAttack(actor, target);
  }

  private createActionMenu(actor: CombatUnitState): void {
    const skill1 = actor.pow.abilities.skills[0];
    const skill2 = actor.pow.abilities.skills[1];
    const ultimate = actor.pow.abilities.ultimate;
    const skill1Cost = this.skillActions.costFor(0);
    const skill2Cost = this.skillActions.costFor(1);
    const rageCost = this.skillActions.ultimateRageCost();

    const actions: ActionMenuItem[] = [
      {
        label: 'ĐÒN CƠ BẢN',
        detail: `${this.shortName(actor.pow.abilities.basic.name)} · +8 Mana · +12 Nộ`,
        color: 0x0b5268,
        enabled: true,
        run: () => this.runPlayerTargetAction(actor, 'basic')
      },
      {
        label: 'KỸ NĂNG 1',
        detail: `${this.shortName(skill1.name)} · ${skill1Cost} Mana`,
        color: 0x315d78,
        enabled: this.skillActions.canUse(actor, 0),
        run: () => this.runPlayerTargetAction(actor, 0)
      },
      {
        label: 'KỸ NĂNG 2',
        detail: `${this.shortName(skill2.name)} · ${skill2Cost} Mana`,
        color: 0x493b78,
        enabled: this.skillActions.canUse(actor, 1),
        run: () => this.runPlayerTargetAction(actor, 1)
      },
      {
        label: 'ULTIMATE',
        detail: `${this.shortName(ultimate.name)} · ${rageCost} Nộ`,
        color: 0x70472b,
        enabled: this.skillActions.canUseUltimate(actor),
        run: () => this.runPlayerTargetAction(actor, 'ultimate')
      }
    ];

    const buttonWidth = 208;
    const gap = 10;
    const totalWidth = actions.length * buttonWidth + (actions.length - 1) * gap;
    const menu = this.add.container(this.scale.width / 2, this.scale.height / 2 + 88);
    menu.setDepth(30);

    actions.forEach((action, index) => {
      const x = -totalWidth / 2 + buttonWidth / 2 + index * (buttonWidth + gap);
      const background = this.add.rectangle(
        x,
        0,
        buttonWidth,
        58,
        action.enabled ? action.color : 0x26333b,
        action.enabled ? 0.96 : 0.68
      );
      background.setStrokeStyle(
        1,
        action.enabled ? 0x70dced : 0x56636b,
        action.enabled ? 0.72 : 0.45
      );

      const label = this.add
        .text(x, -9, action.label, {
          fontFamily: 'Arial',
          fontSize: '13px',
          color: action.enabled ? '#ffffff' : '#85959d',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);

      const detail = this.add
        .text(x, 13, action.detail, {
          fontFamily: 'Arial',
          fontSize: '9px',
          color: action.enabled ? '#b4d4df' : '#71818a'
        })
        .setOrigin(0.5);

      const hitArea = this.add.rectangle(x, 0, buttonWidth, 58, 0xffffff, 0.001);

      if (action.enabled) {
        hitArea.setInteractive({ useHandCursor: true });
        hitArea.on('pointerover', () => background.setAlpha(1).setScale(1.025));
        hitArea.on('pointerout', () => background.setAlpha(0.96).setScale(1));
        hitArea.once('pointerup', () => {
          this.destroyActionMenu();
          action.run();
        });
      }

      menu.add([background, label, detail, hitArea]);
    });

    this.actionMenu = menu;
  }

  private runPlayerTargetAction(
    actor: CombatUnitState,
    action: 'basic' | CombatAbilitySlot
  ): void {
    const target = this.getSelectedEnemyTarget();

    if (!target) {
      this.preparePlayerTargeting();
      this.createActionMenu(actor);
      return;
    }

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

    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);

      if (ability.type.toLowerCase() !== 'support' && actorView && targetView) {
        const targetPosition = targetView.getWorldPosition();
        await actorView.playAttackLunge(targetPosition.x, targetPosition.y);
      } else {
        await actorView?.playStatusPulse();
      }

      const result = slot === 'ultimate'
        ? this.skillActions.resolveUltimate(actor, target, ability)
        : this.skillActions.resolve(actor, target, ability, slot);

      if (result.targetSpeedChanged) {
        this.turnManager.rescheduleUnit(target.instanceId);
      }

      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();

      if (result.damage > 0 && targetView) {
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

      await this.wait(slot === 'ultimate' ? 260 : 150);
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
    this.destroyActionMenu();
    this.clearTargeting();
    this.refreshViews();

    if (this.combatState.isBattleOver()) {
      this.finishBattle();
      return;
    }

    this.time.delayedCall(170, () => this.beginNextTurn());
  }

  private recoverTurnFlow(): void {
    this.destroyActionMenu();
    this.clearTargeting();
    this.turnManager.recoverActionLock();
    this.time.delayedCall(80, () => this.beginNextTurn());
  }

  private preparePlayerTargeting(): void {
    const enemies = this.combatState
      .living('enemy')
      .sort((a, b) => a.slot - b.slot);

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
      target.side !== 'enemy'
    ) {
      return;
    }

    this.selectedTargetId = instanceId;

    for (const enemy of this.combatState.living('enemy')) {
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

    if (selected?.alive && selected.side === 'enemy') {
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
      .living(side)
      .sort((a, b) => a.slot - b.slot);

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

  private shortName(name: string): string {
    const clean = String(name || '').trim();
    return clean.length > 18 ? `${clean.slice(0, 17)}…` : clean;
  }

  private createBattlefield(width: number, height: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x071827, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(0x0a2031, 0.74);
    graphics.fillEllipse(width / 2, height / 2, 1220, 430);

    graphics.lineStyle(1, 0x21475c, 0.45);
    graphics.strokeEllipse(width / 2, height / 2, 1220, 430);
    graphics.strokeEllipse(width / 2, height / 2, 900, 305);

    graphics.lineStyle(1, 0x15394e, 0.55);
    graphics.lineBetween(105, height / 2, width - 105, height / 2);
  }

  private createTeam(
    width: number,
    y: number,
    side: CombatSide,
    team: CombatPow[]
  ): void {
    const spacing = 365;
    const center = width / 2;

    team.forEach((pow, index) => {
      const x = center + (index - 1) * spacing;
      const instanceId = `${side}-${index}-${pow.id}`;
      const view = new PowView(this, x, y, pow, {
        side,
        width: 286,
        height: 300
      });

      view.onTargetSelected(() => this.selectTarget(instanceId));
      this.powViews.set(instanceId, view);
    });

    this.refreshViews();
  }
}
