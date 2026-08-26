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
  SupportActionResolver,
  type SupportActionKind
} from '../systems/SupportActionResolver';
import { TurnManager } from '../systems/TurnManager';
import { PowView } from '../views/PowView';

export class BattleScene extends Phaser.Scene {
  private combatState!: CombatState;
  private turnManager!: TurnManager;
  private actionPipeline!: ActionPipeline;
  private basicAttack!: BasicAttackResolver;
  private supportActions!: SupportActionResolver;

  private readonly powViews = new Map<string, PowView>();
  private roundText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private actionMenu: Phaser.GameObjects.Container | null = null;
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
    this.supportActions = new SupportActionResolver();

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
    const plate = this.add.rectangle(width / 2, height / 2, 510, 138, 0x081d2a, 0.96);
    plate.setStrokeStyle(2, 0x58d8ef, 0.72);

    const title = this.add
      .text(width / 2, height / 2 - 34, 'POWDER COMBAT 2.0.6', {
        fontFamily: 'Arial',
        fontSize: '29px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(width / 2, height / 2 + 4, 'BASIC · SPEED · HEAL · SHIELD', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#72d8ed'
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(width / 2, height / 2 + 34, 'Thông tin mở trận tự ẩn · sân giữa dành cho Combat', {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#9bb8c7'
      })
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

    if (actor.side === 'enemy') {
      this.time.delayedCall(300, () => {
        const target = this.pickTarget('player');
        if (target) {
          void this.performBasicAttack(actor, target);
        }
      });
      return;
    }

    this.createActionMenu(actor);
  }

  private createActionMenu(actor: CombatUnitState): void {
    const actions: Array<{
      label: string;
      detail: string;
      color: number;
      run: () => void;
    }> = [
      {
        label: 'ĐÒN CƠ BẢN',
        detail: '+8 Mana · +12 Nộ',
        color: 0x0b5268,
        run: () => {
          const target = this.pickTarget('enemy');
          if (target) {
            void this.performBasicAttack(actor, target);
          }
        }
      },
      {
        label: 'BUFF TỐC',
        detail: '+25% · 2 lượt sau',
        color: 0x493b78,
        run: () => void this.performSupportAction(actor, 'speed')
      },
      {
        label: 'HỒI MÁU',
        detail: '20% HP tối đa',
        color: 0x1d664d,
        run: () => void this.performSupportAction(actor, 'heal')
      },
      {
        label: 'KHIÊN',
        detail: '18% HP tối đa',
        color: 0x31526f,
        run: () => void this.performSupportAction(actor, 'shield')
      }
    ];

    const buttonWidth = 158;
    const gap = 10;
    const totalWidth = actions.length * buttonWidth + (actions.length - 1) * gap;
    const menu = this.add.container(this.scale.width / 2, this.scale.height / 2 + 80);
    menu.setDepth(30);

    actions.forEach((action, index) => {
      const x = -totalWidth / 2 + buttonWidth / 2 + index * (buttonWidth + gap);
      const background = this.add.rectangle(x, 0, buttonWidth, 54, action.color, 0.96);
      background.setStrokeStyle(1, 0x70dced, 0.72);

      const label = this.add
        .text(x, -8, action.label, {
          fontFamily: 'Arial',
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);

      const detail = this.add
        .text(x, 12, action.detail, {
          fontFamily: 'Arial',
          fontSize: '9px',
          color: '#b4d4df'
        })
        .setOrigin(0.5);

      const hitArea = this.add.rectangle(x, 0, buttonWidth, 54, 0xffffff, 0.001);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => background.setAlpha(1).setScale(1.025));
      hitArea.on('pointerout', () => background.setAlpha(0.96).setScale(1));
      hitArea.once('pointerup', () => {
        this.destroyActionMenu();
        action.run();
      });

      menu.add([background, label, detail, hitArea]);
    });

    this.actionMenu = menu;
  }

  private async performBasicAttack(
    actor: CombatUnitState,
    target: CombatUnitState
  ): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);
    const targetView = this.powViews.get(target.instanceId);

    await this.actionPipeline.execute(actor.instanceId, async () => {
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
    });

    this.afterAction();
  }

  private async performSupportAction(
    actor: CombatUnitState,
    kind: SupportActionKind
  ): Promise<void> {
    const actorView = this.powViews.get(actor.instanceId);

    await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);
      const result = this.supportActions.resolve(kind, actor);
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();
      this.showSupportNumber(actorView, result.label, result.value, kind);

      // Finite presentation beat only. Gameplay has already resolved; the
      // ActionPipeline finally block owns turn completion regardless of FX.
      await this.wait(220);
    });

    this.afterAction();
  }

  private afterAction(): void {
    this.refreshViews();

    if (this.combatState.isBattleOver()) {
      this.finishBattle();
      return;
    }

    this.time.delayedCall(170, () => this.beginNextTurn());
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

  private showSupportNumber(
    view: PowView | undefined,
    label: string,
    value: number,
    kind: SupportActionKind
  ): void {
    if (!view) {
      return;
    }

    const position = view.getWorldPosition();
    const prefix = kind === 'speed' ? '+' : '+';
    const suffix = kind === 'speed' ? '%' : '';
    const color = kind === 'heal' ? '#73f0aa' : kind === 'shield' ? '#8edfff' : '#c5a7ff';

    const text = this.add
      .text(position.x, position.y - 88, `${label} ${prefix}${value}${suffix}`, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color,
        fontStyle: 'bold',
        stroke: '#06111c',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(40);

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

      this.powViews.set(instanceId, view);
    });

    this.refreshViews();
  }
}
