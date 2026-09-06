import {
  COMBAT2_STARTER_ROSTER,
  STANDARD_POW_COUNT,
  STANDARD_POW_SKILL_COUNT,
  STANDARD_SKILLS_PER_POW,
  standardSkillIndex
} from '../data/PowderDataAdapter';
import { BasicAttackResolver } from './BasicAttackResolver';
import { runCombatControlRegression } from './CombatControlRegression';
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
  controlSystemChecked: boolean;
  legacyStatsChecked: boolean;
  legacyEffectsChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Regression] ${message}`);
}

const HOSTILE_STATUSES = new Set([
  'silence', 'stun', 'paralysis', 'freeze', 'slow', 'burn', 'poison',
  'anti heal', 'attack down', 'ap down', 'defense down', 'accuracy down'
]);

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
  assert(rawEight.next === 8, 'an event starting below 4 must receive the full gain, capped at 8');
  assert(rageMarkerStates(rawEight.next).join(',') === 'red,red,red,red', '8 Rage must display 4 red markers');
  const rawNine = applyRawRageGain(0, 9);
  assert(rawNine.next === 8, 'raw 9 Rage starting from 0 must clamp to 8');
  const rawTwelve = applyRawRageGain(0, 12);
  assert(rawTwelve.next === 8, 'raw 12 Rage must reach the 8-point effective cap');
  assert(rageMarkerStates(rawTwelve.next).every((marker) => marker === 'red'), '8 Rage must display 4 red markers');
  assert(spendUltimate(6) === 2, 'Ultimate from 6 Rage must leave 2');
  assert(spendUltimate(8) === 4, 'Ultimate from 8 Rage must leave 4 and remain ready');
}

function validateOffenseChannels(): void {
  const skills = new SkillActionResolver(() => 0);
  const basic = new BasicAttackResolver(() => 0);

  const apState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const apBaselineState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const apActor = apState.activeLiving('player')[0];
  const apTarget = apState.activeLiving('enemy')[0];
  const apBaselineActor = apBaselineState.activeLiving('player')[0];
  const apBaselineTarget = apBaselineState.activeLiving('enemy')[0];
  assert(apActor && apTarget && apBaselineActor && apBaselineTarget, 'AP fixture requires active units');
  assert(apActor.pow.abilityPower > 0, 'canonical AP stat was not mapped into Combat2');

  apActor.ragePoints = 0;
  const apBuff = skills.resolve(apActor, apActor, { name: 'AP Regression Fixture', power: 1, type: 'support', status: 'ap up' }, 0);
  assert(apBuff.rawRageGain === 2, 'AP Up must not add resource bonus Rage');
  assert(apBuff.rageGained === 2 && apActor.ragePoints === 2, 'AP Up action should receive only normal +2 Rage');
  assert(apActor.attackMultiplier === 1, 'AP Up must not modify physical ATK');
  assert(apActor.abilityPowerMultiplier >= 1.3, 'AP Up must strengthen AP');

  const baselineElemental = skills.resolve(apBaselineActor, apBaselineTarget, { name: 'Elemental AP Baseline', power: 140, type: 'elemental' }, 0);
  apActor.skillCooldownActionsRemaining[0] = 0;
  const boostedElemental = skills.resolve(apActor, apTarget, { name: 'Elemental AP Boosted', power: 140, type: 'elemental' }, 0);
  assert(boostedElemental.damage > baselineElemental.damage, 'AP Up must increase elemental damage');

  const physicalState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const physicalBaselineState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const physicalActor = physicalState.activeLiving('player')[0];
  const physicalTarget = physicalState.activeLiving('enemy')[0];
  const physicalBaselineActor = physicalBaselineState.activeLiving('player')[0];
  const physicalBaselineTarget = physicalBaselineState.activeLiving('enemy')[0];
  assert(physicalActor && physicalTarget && physicalBaselineActor && physicalBaselineTarget, 'physical fixture missing');
  skills.resolve(physicalActor, physicalActor, { name: 'AP Isolation', power: 1, type: 'support', status: 'ap up' }, 0);
  assert(basic.resolve(physicalActor, physicalTarget).damage === basic.resolve(physicalBaselineActor, physicalBaselineTarget).damage, 'AP Up must not increase Basic damage');

  const atkState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const atkBaselineState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const atkActor = atkState.activeLiving('player')[0];
  const atkTarget = atkState.activeLiving('enemy')[0];
  const atkBaselineActor = atkBaselineState.activeLiving('player')[0];
  const atkBaselineTarget = atkBaselineState.activeLiving('enemy')[0];
  assert(atkActor && atkTarget && atkBaselineActor && atkBaselineTarget, 'ATK fixture requires active units');
  skills.resolve(atkActor, atkActor, { name: 'ATK Regression Fixture', power: 1, type: 'support', status: 'attack up' }, 0);
  assert(atkActor.attackMultiplier >= 1.3 && atkActor.abilityPowerMultiplier === 1, 'Attack Up channel mismatch');
  assert(basic.resolve(atkActor, atkTarget).damage > basic.resolve(atkBaselineActor, atkBaselineTarget).damage, 'Attack Up must increase Basic damage');
}

function validateLegacyStatsAndEffects(): void {
  for (const pow of [...COMBAT2_STARTER_ROSTER.player, ...COMBAT2_STARTER_ROSTER.enemy]) {
    for (const value of [pow.critRate, pow.critDamage, pow.evasion, pow.accuracy, pow.critResist, pow.defPen, pow.healPower, pow.shieldPower, pow.tenacity, pow.damageReduction]) {
      assert(Number.isFinite(value), `${pow.name} has a non-finite restored secondary stat`);
    }
  }

  const evadeState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const evadeActor = evadeState.activeLiving('player')[0];
  const evadeTarget = evadeState.activeLiving('enemy')[0];
  assert(evadeActor && evadeTarget, 'evade fixture missing');
  evadeTarget.evasionBonus = 75;
  const missed = new BasicAttackResolver(() => 0.99).resolve(evadeActor, evadeTarget);
  assert(missed.evaded && missed.damage === 0, 'Evasion must be able to avoid a Basic Attack');

  const sureState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const sureActor = sureState.activeLiving('player')[0];
  const sureTarget = sureState.activeLiving('enemy')[0];
  assert(sureActor && sureTarget, 'sure-hit fixture missing');
  sureTarget.evasionBonus = 75;
  const sure = new SkillActionResolver(() => 0.99).resolve(sureActor, sureTarget, {
    name: 'Sure Hit Fixture', power: 120, type: 'physical', sureHit: true
  }, 0);
  assert(!sure.evaded && sure.damage > 0, 'Sure Hit must bypass Evasion');

  const critState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const critActor = critState.activeLiving('player')[0];
  const critTarget = critState.activeLiving('enemy')[0];
  assert(critActor && critTarget, 'crit fixture missing');
  critActor.critRateBonus = 100;
  const crit = new BasicAttackResolver(() => 0).resolve(critActor, critTarget);
  assert(crit.crit && crit.damage > 0, '100 bonus Crit Rate must produce a critical hit with roll 0');

  const effectState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const source = effectState.activeLiving('player')[0];
  const target = effectState.activeLiving('enemy')[0];
  assert(source && target, 'legacy effect fixture missing');
  const effects = new SkillActionResolver(() => 0);
  effects.resolve(source, target, { name: 'Burn Fixture', power: 100, type: 'elemental', status: 'burn' }, 0);
  source.skillCooldownActionsRemaining[0] = 0;
  effects.resolve(source, target, { name: 'Poison Fixture 1', power: 1, type: 'debuff', status: 'poison' }, 0);
  source.skillCooldownActionsRemaining[0] = 0;
  effects.resolve(source, target, { name: 'Poison Fixture 2', power: 1, type: 'debuff', status: 'poison' }, 0);
  source.skillCooldownActionsRemaining[0] = 0;
  effects.resolve(source, target, { name: 'Poison Fixture 3', power: 1, type: 'debuff', status: 'poison' }, 0);
  assert(target.burnActionsRemaining > 0 && target.poisonActionsRemaining > 0, 'Burn and Poison must coexist');
  assert(target.poisonStacks === 3, 'Poison must stack to three');

  const shieldState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const shielder = shieldState.activeLiving('player')[0];
  assert(shielder, 'shield fixture missing');
  const shieldResolver = new SkillActionResolver(() => 0);
  for (let index = 0; index < 10; index += 1) {
    shielder.skillCooldownActionsRemaining[0] = 0;
    shieldResolver.resolve(shielder, shielder, { name: 'Shield Fixture', power: 1, type: 'support', status: 'shield' }, 0);
  }
  assert(shielder.shield <= shielder.pow.maxHp * 0.8, 'Shield must never exceed the legacy absolute 80% Max HP cap');

  const allyState = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const caster = allyState.activeLiving('player')[0];
  const ally = allyState.activeLiving('player')[1];
  assert(caster && ally && caster.instanceId !== ally.instanceId, 'ally support fixture requires two active allies');
  const allyResolver = new SkillActionResolver(() => 0);
  const casterShieldBefore = caster.shield;
  allyResolver.resolve(caster, ally, { name: 'Ally Shield Fixture', power: 1, type: 'support', status: 'shield', target: 'ally' }, 0);
  assert(ally.shield > 0, 'ally-target Shield must apply to the selected ally');
  assert(caster.shield === casterShieldBefore, 'ally-target Shield must not apply to the caster');

  caster.skillCooldownActionsRemaining[0] = 0;
  ally.hp = Math.max(1, Math.floor(ally.pow.maxHp * 0.5));
  const allyHpBefore = ally.hp;
  const casterHpBefore = caster.hp;
  allyResolver.resolve(caster, ally, { name: 'Ally Heal Fixture', power: 1, type: 'support', status: 'regeneration', target: 'ally' }, 0);
  assert(ally.hp > allyHpBefore, 'ally-target Regeneration must heal the selected ally');
  assert(caster.hp === casterHpBefore, 'ally-target Regeneration must not heal the caster');

  caster.skillCooldownActionsRemaining[0] = 0;
  allyResolver.resolve(caster, ally, { name: 'Ally ATK Fixture', power: 1, type: 'support', status: 'attack up', target: 'ally' }, 0);
  assert(ally.attackMultiplier >= 1.3, 'ally-target Attack Up must buff the selected ally');
  assert(caster.attackMultiplier === 1, 'ally-target Attack Up must not buff the caster');
}

function validateIdentityRules(): void {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const identity = new CombatIdentityRules();
  const skills = new SkillActionResolver(() => 0);
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
  validateLegacyStatsAndEffects();
  validateIdentityRules();
  validateRevivePassive();
  runCombatControlRegression();

  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const turns = new TurnManager(state);
  for (const unit of state.units) if (String(unit.pow.passive?.id || '').toLowerCase() === 'revive_ally_once') unit.passiveUsed = true;
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
    skillArtCoverageChecked: true,
    controlSystemChecked: true,
    legacyStatsChecked: true,
    legacyEffectsChecked: true
  };
}
