import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatIdentityRules } from './CombatIdentityRules';
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
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Regression] ${message}`);
}

const HOSTILE_STATUSES = new Set(['stun', 'freeze', 'slow', 'burn', 'poison']);

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
    identityRulesChecked: true
  };
}
