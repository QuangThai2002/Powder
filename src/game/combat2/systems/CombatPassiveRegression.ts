import type { CombatPassiveMechanic, CombatPow } from '../data/CombatPow';
import { CombatState, type CombatUnitState } from './CombatState';
import { CombatMultiTargetEngine } from './CombatMultiTargetEngine';
import { BasicAttackResolver } from './BasicAttackResolver';
import {
  CombatPassiveEngine,
  createCombatActionProvenance,
  isMainDirectDamageAction,
  type CombatPassiveLifecycleEvent
} from './CombatPassiveEngine';
import { chargeRageTo } from './CombatRageEngine';
import { SkillActionResolver } from './SkillActionResolver';

type Definition = CombatPassiveMechanic & { description?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Passive Regression] ${message}`);
}

function pow(id: string, definition: Definition, side = 'player'): CombatPow {
  return {
    id: `${side}-${id}`, name: id, assetKey: id, assetUrl: '/fixture.png', element: 'Fire', elementKey: 'fire', role: 'fixture', rarity: 'common', level: 1,
    attack: 100, abilityPower: 100, defense: 100, speed: 100, hp: 1000, maxHp: 1000, critRate: 0, critDamage: 200,
    evasion: 0, accuracy: 100, critResist: 0, defPen: 0, healPower: 0, shieldPower: 0, tenacity: 0, damageReduction: 0,
    abilities: { basic: { name: 'Basic', power: 100, type: 'physical' }, skills: [{ name: 'S1', power: 100, type: 'physical' }, { name: 'S2', power: 100, type: 'support' }], ultimate: { name: 'Ult', power: 100, type: 'ultimate' } },
    passive: { id, name: id, mechanic: definition }, display: { heightRatio: 1 }
  };
}

function unit(id: string, definition: Definition, side: 'player' | 'enemy' = 'player'): CombatUnitState {
  return new CombatState([pow(id, definition)], [pow('enemy-fixture', { trigger: 'BEFORE_HIT', effect: {} }, 'enemy')]).activeLiving(side)[0];
}

function multiTargetComboDamage(combo: number, definition: Definition): number[] {
  const actorPow = pow('combo-burst', definition);
  actorPow.abilities.skills[0] = { name: 'Combo Burst', power: 100, type: 'physical', target: 'all-enemies' };
  const state = new CombatState(
    [actorPow],
    [pow('target-a', { trigger: 'BEFORE_HIT', effect: {} }, 'enemy'), pow('target-b', { trigger: 'BEFORE_HIT', effect: {} }, 'enemy')]
  );
  const actor = state.activeLiving('player')[0];
  const enemies = state.activeLiving('enemy');
  const cast = new CombatMultiTargetEngine().resolveCast(
    new SkillActionResolver(() => 0.99), actor, enemies[0], actor.pow.abilities.skills[0], 0, state.units, 1, { combo }
  );
  assert(cast.hits.length === 2, 'multi-target Passive context must resolve every target');
  return cast.hits.map((hit) => hit.result.damage);
}

export function runCombatPassiveRegression(definitions: Record<string, Definition>) {
  const engine = new CombatPassiveEngine();
  const checks: string[] = [];
  const foundationChecks: string[] = [];
  const requireDefinition = (id: string) => { const value = definitions[id]; assert(value, `${id} definition missing`); return value; };

  {
    const main = createCombatActionProvenance('actor-a', ['target-a'], 'skill', true, 'Main Hit');
    const followUp = createCombatActionProvenance(
      'actor-a', ['target-a'], 'skill', true, 'Follow-up', { origin: 'follow-up' }
    );
    const dot = createCombatActionProvenance(
      'actor-a', ['target-a'], 'status-tick', false, 'Burn', { origin: 'dot' }
    );
    const counter = createCombatActionProvenance(
      'actor-a', ['target-a'], 'basic', true, 'Counter', { origin: 'counter' }
    );
    const secondary = createCombatActionProvenance(
      'actor-a', ['target-b'], 'skill', true, 'Secondary hit', { origin: 'secondary-hit' }
    );
    assert(isMainDirectDamageAction(main), 'main direct action provenance must be eligible');
    assert(!isMainDirectDamageAction(followUp), 'follow-up provenance must not count as a main action');
    assert(!isMainDirectDamageAction(dot), 'DOT/status tick provenance must not count as direct damage');
    assert(!isMainDirectDamageAction(counter), 'counter provenance must not count as a main action');
    assert(!isMainDirectDamageAction(secondary), 'secondary-hit provenance must not count as a main action');
    assert(main.actorId === 'actor-a' && main.targetIds[0] === 'target-a', 'provenance must preserve actor and target identity');
    foundationChecks.push('action provenance: main direct / follow-up / counter / DOT / secondary hit');
  }

  {
    const fixture = { trigger: 'BEFORE_HIT', effect: {} } as Definition;
    const state = new CombatState(
      [pow('ledger-a', fixture), pow('ledger-b', fixture)],
      [pow('ledger-target', fixture, 'enemy')]
    );
    const [first, second] = state.activeLiving('player');
    engine.setFlag(first, 'mach-khoi');
    engine.incrementBattleCounter(first, 'main-actions');
    engine.incrementBattleCounter(first, 'main-actions');
    engine.incrementRoundCounter(first, 'round-triggers', 1);
    engine.incrementRoundCounter(first, 'round-triggers', 1);
    engine.setOwnedCounter(first, 'dien-nhip', 9, 4);
    engine.setDesignatedCarry(first, second.instanceId);

    assert(engine.hasFlag(first, 'mach-khoi') && !engine.hasFlag(second, 'mach-khoi'), 'per-unit Passive flags must be isolated');
    assert(engine.battleCounter(first, 'main-actions') === 2 && engine.battleCounter(second, 'main-actions') === 0, 'per-battle counters must be isolated');
    assert(engine.roundCounter(first, 'round-triggers', 1) === 2, 'per-round counter must persist inside its round');
    assert(engine.incrementRoundCounter(first, 'round-triggers', 2) === 1, 'per-round counter must reset on a new round');
    assert(engine.battleCounter(first, 'main-actions') === 2, 'round rollover must not reset per-battle counters');
    assert(engine.ownedCounter(first, 'dien-nhip') === 4 && engine.ownedCounter(second, 'dien-nhip') === 0, 'Passive-owned counters must be capped and isolated');
    assert(first.passiveState.designatedCarryInstanceId === second.instanceId, 'designated carry identity must be stored in Passive state');
    assert(second.passiveState.designatedCarryInstanceId === null, 'designated carry state must not leak to another unit');
    foundationChecks.push('Passive ledger: flags / battle / round / owned counter / carry');
  }

  {
    const toFour = chargeRageTo(1, 4);
    const alreadyFour = chargeRageTo(4, 4);
    const toEight = chargeRageTo(6, 8);
    assert(toFour.next === 4 && toFour.effectiveGain === 3 && toFour.events.length === 1, 'Rage 1 chargeTo4 must be one logical event');
    assert(alreadyFour.next === 4 && alreadyFour.effectiveGain === 0 && alreadyFour.events.length === 0, 'Rage 4 chargeTo4 must be a no-op');
    assert(toEight.next === 8 && toEight.effectiveGain === 2 && toEight.events.length === 1, 'Rage 6 chargeTo8 must be one logical event');
    assert(chargeRageTo(7, 99).next === 8, 'charge-to helper must respect canonical Rage max 8');
    foundationChecks.push('Rage charge-to: atomic event and max 8');
  }

  {
    const fixture = { trigger: 'BEFORE_HIT', effect: {} } as Definition;
    const state = new CombatState([pow('lifecycle-actor', fixture)], [pow('lifecycle-target', fixture, 'enemy')]);
    const actor = state.activeLiving('player')[0];
    const target = state.activeLiving('enemy')[0];
    const lifecycleEvents: CombatPassiveLifecycleEvent[] = [];
    const hook = (event: CombatPassiveLifecycleEvent) => lifecycleEvents.push(event);

    new BasicAttackResolver(() => 0.99, hook).resolve(actor, target, {}, 2);
    assert(lifecycleEvents.length === 1 && lifecycleEvents[0].stage === 'after-main-action', 'Basic must emit one after-main-action hook');
    assert(lifecycleEvents[0].provenance.actionType === 'basic' && isMainDirectDamageAction(lifecycleEvents[0].provenance), 'Basic hook must carry main direct provenance');

    lifecycleEvents.length = 0;
    actor.ragePoints = 4;
    new SkillActionResolver(() => 0.99, hook).resolveUltimate(
      actor,
      target,
      { name: 'Lifecycle Ultimate', power: 100, type: 'ultimate', damageType: 'magic', critMode: 'never' },
      3
    );
    assert(
      lifecycleEvents.map((event) => event.stage).join(',') === 'after-rage-cost,after-ultimate-cast,after-main-action',
      'Ultimate lifecycle hooks must preserve Rage-cost/cast/main-action order'
    );
    assert(lifecycleEvents[0].rageAfter === 0 && lifecycleEvents.every((event) => event.round === 3), 'lifecycle events must expose post-cost Rage and current round');
    const ledgerBefore = JSON.stringify(actor.passiveState);
    const emitted = lifecycleEvents.flatMap((event) => engine.applyLifecycle(event));
    assert(emitted.length === 0 && JSON.stringify(actor.passiveState) === ledgerBefore, 'foundation lifecycle must not activate Pow-specific mechanics');
    foundationChecks.push('lifecycle hooks: Basic + Ultimate order, default no-op');
  }

  {
    const fixture = { trigger: 'BEFORE_HIT', effect: {} } as Definition;
    const emitsMainAction = (origin: 'main' | 'follow-up' | 'counter' | 'dot' | 'secondary-hit'): boolean => {
      const state = new CombatState([pow(`origin-${origin}`, fixture)], [pow(`target-${origin}`, fixture, 'enemy')]);
      const actor = state.activeLiving('player')[0];
      const target = state.activeLiving('enemy')[0];
      const events: CombatPassiveLifecycleEvent[] = [];
      new BasicAttackResolver(() => 0.99, (event) => events.push(event)).resolve(
        actor,
        target,
        {},
        1,
        {
          origin,
          actionType: origin === 'dot' ? 'status-tick' : 'basic',
          directDamage: origin !== 'dot'
        }
      );
      return events.some((event) => event.stage === 'after-main-action');
    };
    const skillEmitsMainAction = (origin: 'main' | 'follow-up' | 'counter' | 'dot' | 'secondary-hit'): boolean => {
      const state = new CombatState([pow(`skill-origin-${origin}`, fixture)], [pow(`skill-target-${origin}`, fixture, 'enemy')]);
      const actor = state.activeLiving('player')[0];
      const target = state.activeLiving('enemy')[0];
      const events: CombatPassiveLifecycleEvent[] = [];
      new SkillActionResolver(() => 0.99, (event) => events.push(event)).resolve(
        actor,
        target,
        actor.pow.abilities.skills[0],
        0,
        1,
        {},
        {
          origin,
          actionType: origin === 'dot' ? 'status-tick' : 'skill',
          directDamage: origin !== 'dot'
        }
      );
      return events.some((event) => event.stage === 'after-main-action');
    };
    assert(emitsMainAction('main'), 'main direct action must emit after-main-action');
    assert(!emitsMainAction('follow-up'), 'follow-up must not emit after-main-action');
    assert(!emitsMainAction('counter'), 'counter must not emit after-main-action');
    assert(!emitsMainAction('dot'), 'DOT/status tick must not emit after-main-action');
    assert(!emitsMainAction('secondary-hit'), 'secondary hit must not emit after-main-action');
    assert(skillEmitsMainAction('main'), 'main Skill action must emit after-main-action');
    assert(!skillEmitsMainAction('follow-up'), 'follow-up Skill must not emit after-main-action');
    assert(!skillEmitsMainAction('counter'), 'counter Skill must not emit after-main-action');
    assert(!skillEmitsMainAction('dot'), 'DOT Skill provenance must not emit after-main-action');
    assert(!skillEmitsMainAction('secondary-hit'), 'secondary Skill hit must not emit after-main-action');
    foundationChecks.push('lifecycle emission: main only, non-main origins suppressed');
  }

  {
    const fixture = { trigger: 'BEFORE_HIT', effect: {} } as Definition;
    const actorPow = pow('multi-provenance', fixture);
    actorPow.abilities.skills[0] = {
      name: 'Multi Provenance', power: 50, type: 'physical', damageType: 'physical', target: 'all-enemies', area: true
    };
    const state = new CombatState(
      [actorPow],
      [pow('multi-target-a', fixture, 'enemy'), pow('multi-target-b', fixture, 'enemy')]
    );
    const actor = state.activeLiving('player')[0];
    const targets = state.activeLiving('enemy');
    const lifecycleEvents: CombatPassiveLifecycleEvent[] = [];
    const cast = new CombatMultiTargetEngine().resolveCast(
      new SkillActionResolver(() => 0.99, (event) => lifecycleEvents.push(event)),
      actor,
      targets[0],
      actor.pow.abilities.skills[0],
      0,
      state.units,
      1
    );
    const actionEvents = lifecycleEvents.filter((event) => event.stage === 'after-main-action');
    assert(actionEvents.length === 1, 'multi-target cast must emit after-main-action exactly once');
    assert(actionEvents[0].provenance.origin === 'main', 'first multi-target hit must represent the main action');
    assert(actionEvents[0].provenance.targetIds.length === 2, 'main multi-target provenance must retain all cast targets');
    assert(cast.hits[1].result.provenance.origin === 'secondary-hit', 'later multi-target hits must retain secondary provenance');
    assert(!lifecycleEvents.some((event) => event.provenance.origin === 'secondary-hit'), 'secondary hits must not emit main-action lifecycle');
    foundationChecks.push('multi-target provenance: one main action plus secondary hits');
  }

  {
    const actor = unit('missing_hp_atk', requireDefinition('missing_hp_atk')); actor.hp = 500;
    assert(engine.attackMultiplier(actor) === 1.2, 'missing_hp_atk positive trigger'); actor.hp = 1000;
    assert(engine.attackMultiplier(actor) === 1, 'missing_hp_atk negative trigger'); checks.push('missing_hp_atk +/-');
  }
  {
    const target = unit('missing_hp_def', requireDefinition('missing_hp_def')); target.hp = 500;
    assert(engine.defenseMultiplier(target) === 1.2, 'missing_hp_def positive trigger'); target.hp = 1000;
    assert(engine.defenseMultiplier(target) === 1, 'missing_hp_def negative trigger'); checks.push('missing_hp_def +/-');
  }
  {
    const actor = unit('combo_bonus_damage', requireDefinition('combo_bonus_damage'));
    assert(engine.outgoingDamageMultiplier(actor, { combo: 4 }) === 1.32, 'combo damage positive/cap');
    assert(engine.outgoingDamageMultiplier(actor, { combo: 0 }) === 1, 'combo damage negative');
    const baseline = multiTargetComboDamage(0, requireDefinition('combo_bonus_damage'));
    const boosted = multiTargetComboDamage(4, requireDefinition('combo_bonus_damage'));
    assert(boosted.every((damage, index) => damage > baseline[index]), 'multi-target cast must preserve Passive context on every hit');
    checks.push('combo_bonus_damage +/- and multi-target context');
  }
  {
    const actor = unit('element_team_boost', requireDefinition('element_team_boost'));
    assert(engine.outgoingDamageMultiplier(actor, { sameElementAllies: 1 }) === 1.1, 'element team positive');
    assert(engine.outgoingDamageMultiplier(actor, { sameElementAllies: 0 }) === 1, 'element team negative'); checks.push('element_team_boost +/-');
  }
  {
    const actor = unit('combo_stun', requireDefinition('combo_stun')); const target = unit('target', { trigger: 'BEFORE_HIT', effect: {} }, 'enemy');
    assert(engine.applyAfterAction(actor, target, [actor], { combo: 3 }, () => 0).some((event) => event.type === 'status'), 'combo stun positive');
    target.controlActionsRemaining = 0; assert(engine.applyAfterAction(actor, target, [actor], { combo: 2 }, () => 0).length === 0, 'combo stun negative'); checks.push('combo_stun +/-');
  }
  {
    const actor = unit('combo_heal', requireDefinition('combo_heal')); actor.hp = 500;
    assert(engine.applyAfterAction(actor, actor, [actor], { combo: 3 }).some((event) => event.amount === 80), 'combo heal positive');
    actor.hp = 500; assert(engine.applyAfterAction(actor, actor, [actor], { combo: 2 }).length === 0, 'combo heal negative'); checks.push('combo_heal +/-');
  }
  {
    const actor = unit('combo_team_buff', requireDefinition('combo_team_buff'));
    assert(engine.applyAfterAction(actor, actor, [actor], { combo: 3 })[0]?.status === 'attack', 'combo team buff positive');
    actor.attackMultiplier = 1; assert(engine.applyAfterAction(actor, actor, [actor], { combo: 2 }).length === 0, 'combo team buff negative'); checks.push('combo_team_buff +/-');
  }
  {
    const actor = unit('low_hp_heal', requireDefinition('low_hp_heal')); actor.hp = 350;
    assert(engine.applyAfterAction(actor, actor, [actor])[0]?.amount === 200 && actor.passiveUsed, 'low HP heal positive');
    actor.hp = 350; assert(engine.applyAfterAction(actor, actor, [actor]).length === 0, 'low HP heal once-per-battle negative'); checks.push('low_hp_heal +/-');
  }
  {
    const actor = unit('combo_extra_turn', requireDefinition('combo_extra_turn')); const target = unit('target', { trigger: 'BEFORE_HIT', effect: {} }, 'enemy');
    actor.speed = 120; target.speed = 100; assert(engine.extraTurnChance(actor, target, 0.1) === 0.22, 'extra turn positive');
    actor.speed = 110; assert(engine.extraTurnChance(actor, target, 0.1) === 0.1, 'extra turn negative'); checks.push('combo_extra_turn +/-');
  }
  {
    assert(engine.advanceCombo(2, true) === 3, 'correct academic action advances combo');
    assert(engine.advanceCombo(5, true) === 5, 'combo caps at five');
    assert(engine.advanceCombo(4, false) === 0, 'wrong academic action resets combo');
    const actor = unit('combo_extra_turn', requireDefinition('combo_extra_turn')); const target = unit('target', { trigger: 'BEFORE_HIT', effect: {} }, 'enemy');
    actor.speed = 120; target.speed = 100;
    assert(Math.abs(engine.speedExtraTurnChance(actor, target) - 0.141) < 0.000001, 'legacy SPEED chance plus passive bonus');
    actor.speed = 110;
    assert(engine.speedExtraTurnChance(actor, target) === 0, 'SPEED threshold negative trigger');
    checks.push('live combo/speed context');
  }
  {
    const revive = requireDefinition('revive_ally_once'); const reviver = pow('revive_ally_once', revive); const fallen = pow('fallen', { trigger: 'BEFORE_HIT', effect: {} });
    const state = new CombatState([reviver, fallen], [pow('enemy', { trigger: 'BEFORE_HIT', effect: {} }, 'enemy')]); const fallenUnit = state.units[1]; fallenUnit.hp = 0; fallenUnit.alive = false;
    state.promoteReserves(); assert(fallenUnit.alive && fallenUnit.hp === 300, 'revive positive'); fallenUnit.hp = 0; fallenUnit.alive = false;
    state.promoteReserves(); assert(!fallenUnit.alive, 'revive once-per-battle negative'); checks.push('revive_ally_once +/-');
  }

  return { checks, foundationChecks, definitionCount: Object.keys(definitions).length };
}
