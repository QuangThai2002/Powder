import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import {
  CombatLegacyRoleCompletionEngine,
  legacyRoleMark,
  normalizedCombatRole
} from '../systems/CombatLegacyRoleCompletionEngine';
import { selectLegacyCastTargets } from '../systems/CombatMultiTargetEngine';
import type { CombatUnitState } from '../systems/CombatState';
import type { CombatAbilitySlot } from '../systems/SkillActionResolver';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface CatalogAbilityRow { name?: string; mechanic?: string; }
interface CatalogPowRow {
  id?: string;
  abilities?: {
    basic?: CatalogAbilityRow;
    skills?: CatalogAbilityRow[];
    ultimate?: CatalogAbilityRow;
  };
}
interface PowderCatalogLike { pows?: CatalogPowRow[]; }

interface PatchableScene extends Phaser.Scene {
  combatState: {
    units: CombatUnitState[];
    activeLiving: (side?: string) => CombatUnitState[];
    refreshSpeed: (unit: CombatUnitState) => void;
    sanitizeRuntimeNumbers: () => void;
  };
  turnManager: {
    rescheduleUnit: (unitId: string) => void;
    advanceUnit: (unitId: string, progress?: number) => number;
  };
  powViews: Map<string, any>;
  performAbility: (actor: CombatUnitState, target: CombatUnitState, slot: CombatAbilitySlot) => Promise<void>;
  pickAbilityTarget: (actor: CombatUnitState, ability: CombatAbility) => CombatUnitState | null;
  refreshViews: () => void;
  showFloatingLabel: (view: any, label: string, color: string) => void;
  startCombatFlow: () => void;
}

const PATCH_FLAG = '__powderCombat282LegacyRoleCompletionInstalled';
const engine = new CombatLegacyRoleCompletionEngine();

function abilityFor(actor: CombatUnitState, slot: CombatAbilitySlot): CombatAbility {
  return slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
}

function catalogPow(actor: CombatUnitState): CatalogPowRow | undefined {
  const catalog = (globalThis as any).POWDER_DATA as PowderCatalogLike | undefined;
  return catalog?.pows?.find((row) => String(row.id || '') === actor.pow.id);
}

function catalogMechanic(actor: CombatUnitState, slot: CombatAbilitySlot): string {
  const pow = catalogPow(actor);
  if (!pow?.abilities) return '';
  const row = slot === 'ultimate'
    ? pow.abilities.ultimate
    : Array.isArray(pow.abilities.skills)
      ? pow.abilities.skills[slot]
      : undefined;
  return String(row?.mechanic || '').trim().toLowerCase();
}

function catalogMechanicByAbility(actor: CombatUnitState, ability: CombatAbility): string {
  const pow = catalogPow(actor);
  if (!pow?.abilities) return '';
  const rows = [
    pow.abilities.basic,
    ...(Array.isArray(pow.abilities.skills) ? pow.abilities.skills : []),
    pow.abilities.ultimate
  ].filter(Boolean) as CatalogAbilityRow[];
  const byName = rows.find((row) => String(row.name || '').trim() === String(ability.name || '').trim());
  return String(byName?.mechanic || '').trim().toLowerCase();
}

function installExecutePatch(SkillActionResolverClass: any): void {
  const proto = SkillActionResolverClass.prototype as any;
  const originalApplyDamage = proto.applyDamage;
  if (typeof originalApplyDamage !== 'function') return;

  proto.applyDamage = function patchedLegacyExecute(
    actor: CombatUnitState,
    target: CombatUnitState,
    ability: CombatAbility,
    kind: 'skill' | 'ultimate'
  ): any {
    const mechanic = catalogMechanicByAbility(actor, ability);
    const multiplier = engine.executeMultiplier(target, mechanic);
    const result = originalApplyDamage.call(this, actor, target, ability, kind);
    if (multiplier <= 1 || result?.evaded || Number(result?.damage) <= 0 || target.hp <= 0) return result;

    let extra = Math.max(0, Math.round(Number(result.damage) * (multiplier - 1)));
    if (extra <= 0) return result;
    const extraShield = Math.min(Math.max(0, target.shield), extra);
    target.shield = Math.max(0, target.shield - extraShield);
    extra -= extraShield;
    const extraHp = Math.min(Math.max(0, target.hp), extra);
    target.hp = Math.max(0, target.hp - extraHp);
    const applied = extraShield + extraHp;
    if (applied <= 0) return result;

    result.damage += applied;
    result.shieldDamage += extraShield;
    result.hpDamage += extraHp;
    result.legacyExecute = true;
    return result;
  };
}

function installRoleCastPatch(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const originalPerform = proto.performAbility;

  proto.performAbility = async function patchedRoleCompletion(
    this: PatchableScene,
    actor: CombatUnitState,
    requestedTarget: CombatUnitState,
    slot: CombatAbilitySlot
  ): Promise<void> {
    const ability = abilityFor(actor, slot);
    const mechanic = catalogMechanic(actor, slot);
    const previewTargets = selectLegacyCastTargets(actor, requestedTarget, ability, this.combatState.units);
    const before = new Map(previewTargets.map((unit) => [
      unit.instanceId,
      { hp: unit.hp, shield: unit.shield }
    ]));

    await originalPerform.call(this, actor, requestedTarget, slot);
    if (!actor.alive) return;

    const actorRole = normalizedCombatRole(actor);
    const supportCast = String(ability.type || '').trim().toLowerCase() === 'support';
    const recipients = previewTargets.filter((unit) => unit.alive && unit.side === actor.side);
    let changed = false;

    if (supportCast && (actorRole === 'healer' || mechanic === 'role_healer_single' || mechanic === 'role_healer_team')) {
      const teamMode = mechanic === 'role_healer_team';
      const healTargets = recipients.length ? recipients : [actor];
      for (const target of healTargets) {
        const result = engine.healTarget(actor, target, ability, slot, teamMode);
        if (result.healed <= 0) continue;
        changed = true;
        this.showFloatingLabel(this.powViews.get(target.instanceId), `TRỊ LIỆU +${result.healed}`, '#73f0aa');
      }
    }

    if (mechanic === 'role_enchanter_haste') {
      const hasteTargets = recipients.length ? recipients : [actor];
      for (const target of hasteTargets) {
        const haste = engine.applyHaste(target);
        this.combatState.refreshSpeed(target);
        this.turnManager.rescheduleUnit(target.instanceId);
        const advanced = this.turnManager.advanceUnit(target.instanceId, haste.timelineProgress);
        changed = true;
        this.showFloatingLabel(
          this.powViews.get(target.instanceId),
          advanced > 0 ? 'THÚC ĐẨY · +12% LƯỢT' : 'THÚC ĐẨY · TĂNG TỐC',
          '#8ef7ff'
        );
      }
    }

    if (mechanic === 'role_marksman_focus' || mechanic === 'role_assassin_mark') {
      for (const target of previewTargets) {
        const snapshot = before.get(target.instanceId);
        if (!snapshot || !target.alive) continue;
        const impacted = target.hp < snapshot.hp || target.shield < snapshot.shield;
        if (!impacted) continue;
        const mark = engine.applyMark(target, mechanic);
        if (!mark) continue;
        changed = true;
        this.showFloatingLabel(
          this.powViews.get(target.instanceId),
          mark === 'aim' ? 'NHẮM BẮN · 2 LƯỢT' : 'SĂN ĐUỔI · 2 LƯỢT',
          mark === 'aim' ? '#8eeaff' : '#ffb36d'
        );
      }
    }

    for (const unit of this.combatState.units) {
      if (!unit.alive) engine.clearMarks(unit);
    }

    if (changed) {
      this.combatState.sanitizeRuntimeNumbers();
      this.refreshViews();
    }
  };
}

function installRoleAiPatch(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const originalPick = proto.pickAbilityTarget;
  if (typeof originalPick !== 'function') return;

  proto.pickAbilityTarget = function patchedRoleTarget(
    this: PatchableScene,
    actor: CombatUnitState,
    ability: CombatAbility
  ): CombatUnitState | null {
    if (String(ability.type || '').trim().toLowerCase() !== 'support') {
      const candidates = this.combatState.activeLiving(actor.side === 'player' ? 'enemy' : 'player');
      const roleTarget = engine.chooseRoleTarget(actor, candidates, ability);
      if (roleTarget) return roleTarget;
    }
    return originalPick.call(this, actor, ability);
  };
}

function installMarkTickPatch(TurnManagerClass: any): void {
  const proto = TurnManagerClass.prototype as any;
  const originalComplete = proto.completeAction;
  if (typeof originalComplete !== 'function') return;

  proto.completeAction = function patchedMarkDuration(unitId: string): void {
    const unit = (this as any).state?.getUnit?.(unitId) as CombatUnitState | undefined;
    originalComplete.call(this, unitId);
    if (unit) engine.tickMarks(unit);
  };
}

function installMarkPresentationPatch(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const originalStatus = proto.getRuntimeStatus;
  const originalColor = proto.statusColor;
  const originalBackground = proto.statusBackground;

  proto.getRuntimeStatus = function patchedMarkStatus(unit: CombatUnitState): string {
    const base = String(originalStatus.call(this, unit) || '');
    const mark = legacyRoleMark(unit);
    if (!mark) return base;
    const positiveOrEmpty = !base || base.startsWith('TĂNG ') || base.startsWith('KHIÊN') ||
      base.startsWith('HỒI PHỤC') || base === 'BẢO HỘ' || base === 'KHÁNG HIỆU ỨNG';
    if (!positiveOrEmpty) return base;
    const marked = unit as any;
    const turns = mark === 'aim'
      ? Math.max(0, Number(marked.legacyAimMarkActionsRemaining) || 0)
      : Math.max(0, Number(marked.legacyHuntMarkActionsRemaining) || 0);
    return mark === 'aim' ? `NHẮM BẮN · ${turns}` : `SĂN ĐUỔI · ${turns}`;
  };

  proto.statusColor = function patchedMarkColor(status: string): number | null {
    if (String(status).startsWith('NHẮM BẮN')) return 0x8eeaff;
    if (String(status).startsWith('SĂN ĐUỔI')) return 0xffa45f;
    return originalColor.call(this, status);
  };

  proto.statusBackground = function patchedMarkBackground(status: string): string {
    if (String(status).startsWith('NHẮM BẮN')) return '#1b4856';
    if (String(status).startsWith('SĂN ĐUỔI')) return '#57351f';
    return originalBackground.call(this, status);
  };
}

function installIntroPatch(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  proto.showPreBattleIntro = function showPreBattleIntro282(this: PatchableScene): void {
    const { width, height } = this.scale;
    const portrait = height > width;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.4);
    const plateWidth = Math.min(portrait ? 620 : 690, width * 0.77);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 108, 0x081d2a, 0.94).setStrokeStyle(1.5, 0xd7b86c, 0.68);
    const title = this.add.text(width / 2, height / 2, 'POWDER COMBAT 2.8.2', {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: portrait ? '32px' : '34px',
      color: '#fff6df',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title]).setDepth(100);
    this.tweens.add({ targets: intro, alpha: 0, delay: 950, duration: 320, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow(); } });
  };
}

export function installCombat282LegacyRoleCompletionPatch(
  BattleSceneClass: any,
  SkillActionResolverClass: any,
  TurnManagerClass: any,
  PowViewClass: any
): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  installExecutePatch(SkillActionResolverClass);
  installRoleCastPatch(BattleSceneClass);
  installRoleAiPatch(BattleSceneClass);
  installMarkTickPatch(TurnManagerClass);
  installMarkPresentationPatch(PowViewClass);
  installIntroPatch(BattleSceneClass);
}
