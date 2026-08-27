import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import { abilityHasLegalTarget } from '../systems/CombatAbilityTargeting';
import {
  CombatMultiTargetEngine,
  isMultiTargetAbility,
  normalizedAbilityTarget,
  requiresManualPrimaryTarget,
  selectLegacyCastTargets
} from '../systems/CombatMultiTargetEngine';
import type { CombatUnitState } from '../systems/CombatState';
import type { CombatAbilitySlot } from '../systems/SkillActionResolver';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  combatState: any;
  skillActions: any;
  actionPipeline: any;
  turnManager: any;
  presentation: any;
  powViews: Map<string, any>;
  roundText: Phaser.GameObjects.Text;
  turnText: Phaser.GameObjects.Text;
  pendingPlayerAction: any;
  destroyActionMenu: () => void;
  destroyUndoMenu: () => void;
  clearTargeting: () => void;
  createActionMenu: (actor: CombatUnitState) => void;
  prepareTargeting: (actor: CombatUnitState, mode: 'enemy' | 'ally', ability?: CombatAbility) => void;
  createUndoMenu: (actor: CombatUnitState) => void;
  beginPlayerActionSelection: (actor: CombatUnitState, action: 'basic' | CombatAbilitySlot) => void;
  performAbility: (actor: CombatUnitState, target: CombatUnitState, slot: CombatAbilitySlot) => Promise<void>;
  showActionBanner: (view: any, name: string, color: string) => void;
  showFloatingLabel: (view: any, label: string, color: string) => void;
  showDamageNumber: (view: any, hp: number, shield: number, defeated: boolean, crit?: boolean) => void;
  showRageGain: (view: any, gained: number, raw: number) => void;
  restoreRevivedReserve: (unit: CombatUnitState) => void;
  refreshViews: () => void;
  isSelfStatus: (status: string) => boolean;
  statusDisplayName: (status: string) => string;
  statusLabelColor: (status: string) => string;
  wait: (ms: number) => Promise<void>;
  recoverTurnFlow: () => void;
  afterAction: () => void;
  startCombatFlow: () => void;
}

const PATCH_FLAG = '__powderCombat28MultiTargetInstalled';

function abilityFor(actor: CombatUnitState, action: CombatAbilitySlot): CombatAbility {
  return action === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[action];
}

function representativeTarget(scene: PatchableScene, actor: CombatUnitState, ability: CombatAbility): CombatUnitState | null {
  const target = normalizedAbilityTarget(ability);
  const type = String(ability.type || '').trim().toLowerCase();
  const allies = scene.combatState.activeLiving(actor.side) as CombatUnitState[];
  const enemies = scene.combatState.activeLiving(actor.side === 'player' ? 'enemy' : 'player') as CombatUnitState[];
  if (ability.area || target === 'all' || target === 'all-enemies') return type === 'support' ? (allies[0] ?? actor) : (enemies[0] ?? null);
  if (['team', 'allies', 'all-allies', 'three-allies', 'self-and-lowest-ally'].includes(target)) return actor;
  return null;
}

function installPlayerSelectionPatch(proto: any): void {
  const originalBegin = proto.beginPlayerActionSelection;
  proto.beginPlayerActionSelection = function patchedBegin(
    this: PatchableScene,
    actor: CombatUnitState,
    action: 'basic' | CombatAbilitySlot
  ): void {
    if (action === 'basic') { originalBegin.call(this, actor, action); return; }
    const ability = abilityFor(actor, action);
    if (!isMultiTargetAbility(ability)) { originalBegin.call(this, actor, action); return; }

    const usable = action === 'ultimate' ? this.skillActions.canUseUltimate(actor) : this.skillActions.canUse(actor, action);
    if (!usable || !abilityHasLegalTarget(ability, actor, this.combatState.units)) {
      this.createActionMenu(actor);
      return;
    }

    const target = normalizedAbilityTarget(ability);
    if (target === 'self-and-ally') {
      this.destroyActionMenu();
      this.clearTargeting();
      this.pendingPlayerAction = { actorId: actor.instanceId, action, targetMode: 'ally' };
      this.prepareTargeting(actor, 'ally', ability);
      this.createUndoMenu(actor);
      return;
    }

    if (requiresManualPrimaryTarget(ability)) {
      originalBegin.call(this, actor, action);
      return;
    }

    const representative = representativeTarget(this, actor, ability);
    if (representative) {
      this.destroyActionMenu();
      this.destroyUndoMenu();
      this.clearTargeting();
      this.pendingPlayerAction = null;
      void this.performAbility(actor, representative, action);
    } else {
      this.createActionMenu(actor);
    }
  };
}

async function showTargetFeedback(
  scene: PatchableScene,
  actor: CombatUnitState,
  target: CombatUnitState,
  result: any,
  actorView: any,
  allowSelfStatusLabel = true
): Promise<void> {
  const targetView = scene.powViews.get(target.instanceId);
  if (result.targetSpeedChanged && target.instanceId !== actor.instanceId) scene.turnManager.rescheduleUnit(target.instanceId);
  if (result.revived) {
    scene.restoreRevivedReserve(target);
    scene.showFloatingLabel(scene.powViews.get(target.instanceId), 'HỒI SINH · 35% HP', '#73f0aa');
  }
  scene.presentation.showElementOutcome(targetView, result.elementOutcome);
  if (result.evaded && targetView && target.instanceId !== actor.instanceId) {
    scene.showFloatingLabel(targetView, 'NÉ TRÁNH', '#d8f3ff');
  } else if (result.damage > 0 && targetView && target.instanceId !== actor.instanceId) {
    await targetView.playHit();
    scene.showDamageNumber(targetView, result.hpDamage, result.shieldDamage, result.defeated, result.crit);
  }
  if (result.freezeShattered) scene.showFloatingLabel(targetView, 'PHÁ BĂNG · +30%', '#8eeaff');
  const selfStatus = scene.isSelfStatus(result.statusLabel || '');
  if (result.healed > 0 && (!selfStatus || allowSelfStatusLabel)) scene.showFloatingLabel(selfStatus ? actorView : targetView, `HỒI +${result.healed}`, '#73f0aa');
  if (result.shieldGranted > 0 && (!selfStatus || allowSelfStatusLabel)) scene.showFloatingLabel(selfStatus ? actorView : targetView, `KHIÊN +${result.shieldGranted}`, '#8edfff');
  if (result.cleansed) scene.showFloatingLabel(targetView, 'THANH TẨY', '#a8ffd8');
  if (result.statusLabel && result.statusLabel !== 'evade' && !result.cleansed && !result.revived && (!selfStatus || allowSelfStatusLabel)) {
    const statusView = selfStatus ? actorView : targetView;
    scene.showFloatingLabel(statusView, scene.statusDisplayName(result.statusLabel), scene.statusLabelColor(result.statusLabel));
  }
}

function installMultiResolvePatch(proto: any): void {
  const originalPerform = proto.performAbility;
  const engine = new CombatMultiTargetEngine();

  proto.performAbility = async function patchedPerformAbility(
    this: PatchableScene,
    actor: CombatUnitState,
    requestedTarget: CombatUnitState,
    slot: CombatAbilitySlot
  ): Promise<void> {
    const ability = abilityFor(actor, slot);
    if (!isMultiTargetAbility(ability)) {
      await originalPerform.call(this, actor, requestedTarget, slot);
      return;
    }

    const actorView = this.powViews.get(actor.instanceId);
    const previewTargets = selectLegacyCastTargets(actor, requestedTarget, ability, this.combatState.units);
    if (!previewTargets.length) { this.createActionMenu(actor); return; }
    const primaryTarget = previewTargets[0];
    const primaryView = this.powViews.get(primaryTarget.instanceId);
    const completed = await this.actionPipeline.execute(actor.instanceId, async () => {
      actorView?.setActiveTurn(false);
      const selfTargeted = actor.instanceId === primaryTarget.instanceId;

      if (slot === 'ultimate') {
        this.roundText.setVisible(false);
        this.turnText.setVisible(false);
        try { await this.presentation.playUltimateIntro(actorView, ability, actor.side, actor.pow.elementKey); }
        finally { this.roundText.setVisible(true); this.turnText.setVisible(true); }
      } else {
        await this.presentation.playSkillIntro(actorView, primaryView, ability, slot, actor.pow.elementKey, selfTargeted);
      }

      this.showActionBanner(actorView, ability.name, slot === 'ultimate' ? '#ffd36a' : '#c9eaff');
      this.showFloatingLabel(actorView, `ĐA MỤC TIÊU ×${previewTargets.length}`, '#9de8ff');
      if (String(ability.type || '').toLowerCase() !== 'support' && actorView && primaryView && !selfTargeted) {
        const p = primaryView.getWorldPosition();
        await actorView.playAttackLunge(p.x, p.y);
      } else if (actorView) {
        await actorView.playStatusPulse();
      }

      const cast = engine.resolveCast(
        this.skillActions,
        actor,
        requestedTarget,
        ability,
        slot,
        this.combatState.units,
        this.combatState.round
      );
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();

      if (slot === 'ultimate') {
        await this.presentation.playUltimateImpact(primaryView, actor.pow.elementKey, selfTargeted);
      }

      for (let index = 0; index < cast.hits.length; index += 1) {
        const hit = cast.hits[index];
        await showTargetFeedback(this, actor, hit.target, hit.result, actorView, index === 0);
      }

      const resource = cast.primary;
      if (resource.rageSpent > 0) this.showFloatingLabel(actorView, `NỘ -${resource.rageSpent} · CÒN ${resource.rageAfter}`, '#ffcc8a');
      else this.showRageGain(actorView, resource.rageGained, resource.rawRageGain);
      await this.wait(slot === 'ultimate' ? 820 : 430);
      return true;
    });

    if (completed === null) this.recoverTurnFlow(); else this.afterAction();
  };
}

function installIntroPatch(proto: any): void {
  proto.showPreBattleIntro = function showPreBattleIntro280(this: PatchableScene): void {
    const { width, height } = this.scale;
    const portrait = height > width;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.4);
    const plateWidth = Math.min(portrait ? 620 : 690, width * 0.77);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 108, 0x081d2a, 0.94).setStrokeStyle(1.5, 0xd7b86c, 0.68);
    const title = this.add.text(width / 2, height / 2, 'POWDER COMBAT 2.8.0', {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: portrait ? '32px' : '34px',
      color: '#fff6df',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title]).setDepth(100);
    this.tweens.add({ targets: intro, alpha: 0, delay: 950, duration: 320, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow(); } });
  };
}

export function installCombat28MultiTargetPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const proto = BattleSceneClass.prototype as any;
  installPlayerSelectionPatch(proto);
  installMultiResolvePatch(proto);
  installIntroPatch(proto);
}
