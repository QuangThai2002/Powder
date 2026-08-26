import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { CombatIdentityRules } from './CombatIdentityRules';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';
import { TurnManager } from './TurnManager';

export interface CombatRegressionReport {
  turnsSimulated: number;
  promotedReserveSeen: boolean;
  playerActive: number;
  playerReserve: number;
  identityRulesChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[Combat2 Regression] ${message}`);
  }
}

const HOSTILE_STATUSES = new Set([
  'stun',
  'freeze',
  'slow',
  'burn',
  'poison'
]);

function validateIdentityRules(): void {
  const state = new CombatState(
    COMBAT2_STARTER_ROSTER.player,
    COMBAT2_STARTER_ROSTER.enemy
  );
  const identity = new CombatIdentityRules();
  const skills = new SkillActionResolver();

  for (const unit of state.units) {
    for (const ability of unit.pow.abilities.skills) {
      const status = String(ability.status || '').trim().toLowerCase();
      assert(
        !(ability.type === 'support' && HOSTILE_STATUSES.has(status)),
        `${unit.pow.name} still exposes hostile ${status} as self-support`
      );
    }
  }

  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'identity fixture requires active player and enemy units');

  const evaluation = identity.evaluateDamage(actor, target, 'skill', 'elemental');
  assert(
    Number.isFinite(evaluation.totalMultiplier) && evaluation.totalMultiplier >= 0,
    'element/role multiplier must stay finite and non-negative'
  );

  const debuffFixture = state.units
    .flatMap((unit) =>
      unit.pow.abilities.skills.map((ability, slot) => ({
        unit,
        ability,
        slot: slot as 0 | 1
      }))
    )
    .find(({ ability }) => ability.type === 'debuff');

  if (debuffFixture) {
    const debuffTarget = state
      .activeLiving(debuffFixture.unit.side === 'player' ? 'enemy' : 'player')[0];
    assert(debuffTarget, 'debuff fixture requires an active opposing target');

    debuffFixture.unit.mana = debuffFixture.unit.pow.maxMana;
    const hpBefore = debuffTarget.hp;
    const result = skills.resolve(
      debuffFixture.unit,
      debuffTarget,
      debuffFixture.ability,
      debuffFixture.slot
    );

    assert(result.damage === 0, 'pure debuff must not create direct damage');
    assert(debuffTarget.hp === hpBefore, 'pure debuff changed HP directly');
  }

  const selfEffectFixture = state.units
    .flatMap((unit) =>
      unit.pow.abilities.skills.map((ability, slot) => ({
        unit,
        ability,
        slot: slot as 0 | 1
      }))
    )
    .find(({ ability }) =>
      String(ability.status || '').toLowerCase().startsWith('self:')
    );

  if (selfEffectFixture) {
    const attackTarget = state
      .activeLiving(selfEffectFixture.unit.side === 'player' ? 'enemy' : 'player')[0];
    assert(attackTarget, 'self-effect attack fixture requires an active opposing target');

    selfEffectFixture.unit.mana = selfEffectFixture.unit.pow.maxMana;
    const hpBefore = attackTarget.hp;
    const result = skills.resolve(
      selfEffectFixture.unit,
      attackTarget,
      selfEffectFixture.ability,
      selfEffectFixture.slot
    );

    assert(result.damage > 0, 'attack with caster side-effect lost its direct damage');
    assert(attackTarget.hp < hpBefore, 'attack with caster side-effect did not damage enemy');
    assert(
      !String(result.statusLabel || '').toLowerCase().startsWith('self:'),
      'presentation label leaked internal self-effect prefix'
    );
  }
}

/**
 * Lightweight deterministic smoke regression. It never renders and never
 * mutates the real battle scene. DEV bootstrap can run it before Phaser starts
 * so reserve/timeline/identity regressions surface immediately in the console.
 */
export function runCombat2SmokeRegression(): CombatRegressionReport {
  validateIdentityRules();

  const state = new CombatState(
    COMBAT2_STARTER_ROSTER.player,
    COMBAT2_STARTER_ROSTER.enemy
  );
  const turns = new TurnManager(state);

  assert(
    state.activeLiving('player').length === 3,
    'player must start with exactly three active Pow'
  );
  assert(
    state.reserveLiving('player').length === 2,
    'player must start with exactly two reserve Pow'
  );
  assert(
    state.activeLiving('enemy').length === 3,
    'enemy must start with exactly three active Pow'
  );
  assert(
    state.reserveLiving('enemy').length === 2,
    'enemy must start with exactly two reserve Pow'
  );

  const initialReserveIds = new Set(
    [...state.reserveLiving('player'), ...state.reserveLiving('enemy')].map(
      (unit) => unit.instanceId
    )
  );

  let turnsSimulated = 0;
  for (let index = 0; index < 180; index += 1) {
    const actor = turns.beginNextTurn();
    assert(actor, `scheduler returned null at warm-up turn ${index}`);
    assert(actor.fieldSlot !== null, 'reserve Pow entered the timeline before promotion');
    assert(
      !initialReserveIds.has(actor.instanceId),
      `reserve ${actor.pow.name} acted while still on the bench`
    );
    assert(Number.isFinite(actor.speed) && actor.speed > 0, 'active speed must stay finite');
    turns.completeAction(actor.instanceId);
    turnsSimulated += 1;
  }

  const defeated = state.activeLiving('player')[0];
  const expectedReserve = state.reserveLiving('player')[0];
  assert(defeated && expectedReserve, 'promotion fixture is incomplete');

  defeated.hp = 0;
  defeated.alive = false;
  turns.retireUnit(defeated.instanceId);

  const promotions = state.promoteReserves();
  const promotion = promotions.find(
    (entry) => entry.promotedUnitId === expectedReserve.instanceId
  );

  assert(promotion, 'first living reserve was not promoted after an active KO');
  turns.registerPromoted(expectedReserve.instanceId);

  assert(
    state.activeLiving('player').length === 3,
    'promotion must restore three active player slots while a reserve is available'
  );
  assert(
    state.reserveLiving('player').length === 1,
    'promotion must consume exactly one reserve slot'
  );

  expectedReserve.speed = Number.NaN;
  state.sanitizeRuntimeNumbers();
  assert(
    Number.isFinite(expectedReserve.speed) && expectedReserve.speed > 0,
    'runtime sanitizer failed to recover a non-finite speed value'
  );
  turns.rescheduleUnit(expectedReserve.instanceId);

  let promotedReserveSeen = false;
  for (let index = 0; index < 320; index += 1) {
    const actor = turns.beginNextTurn();
    assert(actor, `scheduler returned null after promotion at turn ${index}`);
    assert(actor.fieldSlot !== null, 'bench unit leaked into timeline after promotion cycle');

    if (actor.instanceId === expectedReserve.instanceId) {
      promotedReserveSeen = true;
    }

    turns.completeAction(actor.instanceId);
    turnsSimulated += 1;
  }

  assert(promotedReserveSeen, 'promoted reserve never received a legal turn');

  return {
    turnsSimulated,
    promotedReserveSeen,
    playerActive: state.activeLiving('player').length,
    playerReserve: state.reserveLiving('player').length,
    identityRulesChecked: true
  };
}
