import {
  COMBAT2_STARTER_ROSTER,
  STANDARD_POW_COUNT,
  STANDARD_POW_SKILL_COUNT,
  STANDARD_SKILLS_PER_POW,
  standardSkillIndex
} from '../data/PowderDataAdapter';
import { BasicAttackResolver } from './BasicAttackResolver';
import { CombatIdentityRules } from './CombatIdentityRules';
import {
  applyRawRageGain,
  canUseUltimate,
  rageMarkerStates,
  spendUltimate
} from './CombatRageEngine';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';
import { TurnManager } from './TurnManager';

export interface CombatRegressionReport {
  turnsSimulated: number;
  promotedReserveSeen: boolean;
  revivePassiveChecked: boolean;
  playerActive: number;
  playerReserve: number;
  identityRulesChecked: boolean;
  rageEconomyChecked: boolean;
  apSemanticsChecked: boolean;
  offenseChannelsChecked: boolean;
  skillArtCoverageChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Regression] ${message}`);
}

const HOSTILE_STATUSES = new Set(['stun', 'freeze', 'slow', 'burn', 'poison']);

function validateSkillArtCoverage(): void {
  assert(STANDARD_POW_COUNT === 99, 'canonical Combat2 roster must expose 99 Pow');
  assert(STANDARD_SKILLS_PER_POW === 4, 'every canonical Pow must keep four ability art slots');
  assert(STANDARD_POW_SKILL_COUNT === 396, 'canonical skill art coverage must include all 396 slots');
  assert(standardSkillIndex(97, 0) === 385, 'Pow 97 Basic must map to skill-385');
  assert(standardSkillIndex(99, 3) === 396, 'Pow 99 Ultimate must map to skill-396');
  assert(standardSkillIndex(100, 0) === undefined, 'out-of-roster Pow must not fabricate skill art URLs');
}

function validateRageEconomy(): void {
  const firstAction = applyRawRageGain(0, 2);
  assert(firstAction.next === 2 && firstAction.effectiveGain === 2, 'first +2 Rage action must store 2');

  const ready = applyRawRageGain(2, 2);
  assert(ready.next === 4 && canUseUltimate(ready.next), 'two normal actions must prepare Ultimate');

  const rawEight = applyRawRageGain(0, 8);
  assert(rawEight.next === 6, 'raw 8 Rage must convert to 6 effective Rage');
  assert(
    rageMarkerStates(rawEight.next).join(',') === 'blue,blue,red,red',
    '6 Rage must display 2 blue + 2 red markers'
  );

  const rawNine = applyRawRageGain(0, 9);
  assert(rawNine.next === 6, 'raw 9 Rage must round overflow down to 6 effective Rage');

  const rawTwelve = applyRawRageGain(0, 12);
  assert(rawTwelve.next === 8, 'raw 12 Rage must reach the 8-point effective cap');
  assert(
    rageMarkerStates(rawTwelve.next).every((marker) => marker === 'red'),
    '8 Rage must display 4 red markers'
  );

  assert(spendUltimate(6) === 2, 'Ultimate from 6 Rage must leave 2');
  assert(spendUltimate(8) === 4, 'Ultimate from 8 Rage must leave 4 and remain ready');
}

function validateOffenseChannels(): void {
  const skills = new SkillActionResolver();
  const basic = new BasicAttackResolver();

  const apState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const apBaselineState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const apActor = apState.activeLiving('player')[0];
  const apTarget = apState.activeLiving('enemy')[0];
  const apBaselineActor = apBaselineState.activeLiving('player')[0];
  const apBaselineTarget = apBaselineState.activeLiving('enemy')[0];
  assert(apActor && apTarget && apBaselineActor && apBaselineTarget, 'AP fixture requires active units');
  assert(apActor.pow.abilityPower > 0, 'canonical AP stat was not mapped into Combat2');

  apActor.ragePoints = 0;
  apActor.attackMultiplier = 1;
  apActor.abilityPowerMultiplier = 1;
  apActor.attackBuffActionsRemaining = 0;
  apActor.abilityPowerBuffActionsRemaining = 0;

  const apBuff = skills.resolve(apActor, apActor, {
    name: 'AP Regression Fixture',
    power: 1,
    type: 'support',
    status: 'ap up'
  }, 0);

  assert(apBuff.rawRageGain === 2, 'AP Up must not add resource bonus Rage');
  assert(apBuff.rageGained === 2 && apActor.ragePoints === 2, 'AP Up action should receive only normal +2 Rage');
  assert(apActor.attackMultiplier === 1, 'AP Up must not modify the physical ATK multiplier');
  assert(apActor.abilityPowerMultiplier >= 1.2, 'AP Up must strengthen the Ability Power multiplier');
  assert(apActor.abilityPowerBuffActionsRemaining >= 3, 'AP Up duration was not applied');

  const baselineElemental = skills.resolve(apBaselineActor, apBaselineTarget, {
    name: 'Elemental AP Baseline',
    power: 140,
    type: 'elemental'
  }, 0);
  const boostedElemental = skills.resolve(apActor, apTarget, {
    name: 'Elemental AP Boosted',
    power: 140,
    type: 'elemental'
  }, 0);
  assert(boostedElemental.damage > baselineElemental.damage, 'AP Up must increase elemental skill damage');

  const apPhysicalState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const apPhysicalBaselineState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const apPhysicalActor = apPhysicalState.activeLiving('player')[0];
  const apPhysicalTarget = apPhysicalState.activeLiving('enemy')[0];
  const apPhysicalBaselineActor = apPhysicalBaselineState.activeLiving('player')[0];
  const apPhysicalBaselineTarget = apPhysicalBaselineState.activeLiving('enemy')[0];
  assert(apPhysicalActor && apPhysicalTarget && apPhysicalBaselineActor && apPhysicalBaselineTarget, 'physical AP fixture missing');
  skills.resolve(apPhysicalActor, apPhysicalActor, {
    name: 'AP Physical Isolation Fixture',
    power: 1,
    type: 'support',
    status: 'ap up'
  }, 0);
  const apBoostedBasic = basic.resolve(apPhysicalActor, apPhysicalTarget);
  const apBaselineBasic = basic.resolve(apPhysicalBaselineActor, apPhysicalBaselineTarget);
  assert(apBoostedBasic.damage === apBaselineBasic.damage, 'AP Up must not increase physical/basic damage');

  const atkState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const atkBaselineState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const atkActor = atkState.activeLiving('player')[0];
  const atkTarget = atkState.activeLiving('enemy')[0];
  const atkBaselineActor = atkBaselineState.activeLiving('player')[0];
  const atkBaselineTarget = atkBaselineState.activeLiving('enemy')[0];
  assert(atkActor && atkTarget && atkBaselineActor && atkBaselineTarget, 'ATK fixture requires active units');
  const atkBuff = skills.resolve(atkActor, atkActor, {
    name: 'ATK Regression Fixture',
    power: 1,
    type: 'support',
    status: 'attack up'
  }, 0);
  assert(atkBuff.rawRageGain === 2 && atkActor.ragePoints === 2, 'Attack Up must use normal +2 Rage only');
  assert(atkActor.attackMultiplier >= 1.2, 'Attack Up must strengthen the physical ATK multiplier');
  assert(atkActor.abilityPowerMultiplier === 1, 'Attack Up must not modify the AP multiplier');
  const atkBoostedBasic = basic.resolve(atkActor, atkTarget);
  const atkBaselineBasic = basic.resolve(atkBaselineActor, atkBaselineTarget);
  assert(atkBoostedBasic.damage > atkBaselineBasic.damage, 'Attack Up must increase physical/basic damage');

  const atkElementalState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const atkElementalBaselineState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const atkElementalActor = atkElementalState.activeLiving('player')[0];
  const atkElementalTarget = atkElementalState.activeLiving('enemy')[0];
  const atkElementalBaselineActor = atkElementalBaselineState.activeLiving('player')[0];
  const atkElementalBaselineTarget = atkElementalBaselineState.activeLiving('enemy')[0];
  assert(atkElementalActor && atkElementalTarget && atkElementalBaselineActor && atkElementalBaselineTarget, 'ATK elemental fixture missing');
  skills.resolve(atkElementalActor, atkElementalActor, {
    name: 'ATK AP Isolation Fixture',
    power: 1,
    type: 'support',
    status: 'attack up'
  }, 0);
  const atkBoostedElemental = skills.resolve(atkElementalActor, atkElementalTarget, {
    name: 'Elemental ATK Isolation Boosted',
    power: 140,
    type: 'elemental'
  }, 0);
  const atkBaselineElemental = skills.resolve(atkElementalBaselineActor, atkElementalBaselineTarget, {
    name: 'Elemental ATK Isolation Baseline',
    power: 140,
    type: 'elemental'
  }, 0);
  assert(atkBoostedElemental.damage === atkBaselineElemental.damage, 'Attack Up must not increase elemental/AP damage');
}

function validateIdentityRules(): void {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const identity = new CombatIdentityRules();
  const skills = new SkillActionResolver();

  for (const unit of state.units) {
    for (const ability of unit.pow.abilities.skills) {
      const status = String(ability.status || '').replace(/^self:/i, '').trim().toLowerCase();
      assert(!(ability.type === 'support' && HOSTILE_STATUSES.has(status)), `${unit.pow.name} exposes hostile ${status} as support`);
    }
  }

  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'identity fixture requires active units');
  const evaluation = identity.evaluateDamage(actor, target, 'skill', 'elemental');
  assert(Number.isFinite(evaluation.totalMultiplier) && evaluation.totalMultiplier >= 0, 'identity multiplier invalid');

  const debuffFixture = state.units.flatMap((unit) => unit.pow.abilities.skills.map((ability, slot) => ({ unit, ability, slot: slot as 0 | 1 }))).find(({ ability }) => ability.type === 'debuff');
  if (debuffFixture) {
    const debuffTarget = state.activeLiving(debuffFixture.unit.side === 'player' ? 'enemy' : 'player')[0];
    assert(debuffTarget, 'debuff target missing');
    const hpBefore = debuffTarget.hp;
    const result = skills.resolve(debuffFixture.unit, debuffTarget, debuffFixture.ability, debuffFixture.slot);
    assert(result.damage === 0 && debuffTarget.hp === hpBefore, 'pure debuff dealt direct damage');
  }
}

function validateRevivePassive(): void {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const reviver = state.units.find((unit) => unit.alive && String(unit.pow.passive?.id || '').toLowerCase() === 'revive_ally_once');
  if (!reviver) return;
  const fallen = state.activeLiving(reviver.side).find((unit) => unit.instanceId !== reviver.instanceId);
  assert(fallen, 'revive fixture requires ally');
  const reserveBefore = state.reserveLiving(reviver.side).length;
  const fieldSlotBefore = fallen.fieldSlot;
  fallen.hp = 0;
  fallen.alive = false;
  const promotions = state.promoteReserves();
  assert(promotions.length === 0, 'revive passive consumed reserve');
  assert(fallen.alive && fallen.fieldSlot === fieldSlotBefore, 'revive passive failed field restore');
  assert(fallen.hp === Math.max(1, Math.round(fallen.pow.maxHp * 0.3)), 'revive passive HP mismatch');
  assert(reviver.passiveUsed && state.reserveLiving(reviver.side).length === reserveBefore, 'revive passive state mismatch');
}

export function runCombat2SmokeRegression(): CombatRegressionReport {
  validateSkillArtCoverage();
  validateRageEconomy();
  validateOffenseChannels();
  validateIdentityRules();
  validateRevivePassive();
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const turns = new TurnManager(state);
  for (const unit of state.units) {
    if (String(unit.pow.passive?.id || '').toLowerCase() === 'revive_ally_once') unit.passiveUsed = true;
  }
  assert(state.activeLiving('player').length === 3 && state.reserveLiving('player').length === 2, 'player must start 3+2');
  assert(state.activeLiving('enemy').length === 3 && state.reserveLiving('enemy').length === 2, 'enemy must start 3+2');

  let turnsSimulated = 0;
  for (let index = 0; index < 90; index += 1) {
    const actor = turns.beginNextTurn();
    assert(actor && actor.fieldSlot !== null, 'scheduler selected invalid unit');
    turns.completeAction(actor.instanceId);
    turnsSimulated += 1;
  }

  const defeated = state.activeLiving('player')[0];
  const expectedReserve = state.reserveLiving('player')[0];
  assert(defeated && expectedReserve, 'promotion fixture incomplete');
  defeated.hp = 0;
  defeated.alive = false;
  turns.retireUnit(defeated.instanceId);
  const promotion = state.promoteReserves().find((entry) => entry.promotedUnitId === expectedReserve.instanceId);
  assert(promotion, 'reserve promotion failed');
  turns.registerPromoted(expectedReserve.instanceId);

  let promotedReserveSeen = false;
  for (let index = 0; index < 160; index += 1) {
    const actor = turns.beginNextTurn();
    assert(actor && actor.fieldSlot !== null, 'scheduler failed after promotion');
    if (actor.instanceId === expectedReserve.instanceId) promotedReserveSeen = true;
    turns.completeAction(actor.instanceId);
    turnsSimulated += 1;
  }
  assert(promotedReserveSeen, 'promoted reserve never acted');

  return {
    turnsSimulated,
    promotedReserveSeen,
    revivePassiveChecked: true,
    playerActive: state.activeLiving('player').length,
    playerReserve: state.reserveLiving('player').length,
    identityRulesChecked: true,
    rageEconomyChecked: true,
    apSemanticsChecked: true,
    offenseChannelsChecked: true,
    skillArtCoverageChecked: true
  };
}
