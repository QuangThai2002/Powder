import type { CombatPassiveMechanic, CombatPow } from '../data/CombatPow';
import { CombatState, type CombatUnitState } from './CombatState';
import { CombatMultiTargetEngine } from './CombatMultiTargetEngine';
import { CombatPassiveEngine } from './CombatPassiveEngine';
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
  const requireDefinition = (id: string) => { const value = definitions[id]; assert(value, `${id} definition missing`); return value; };

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

  return { checks, definitionCount: Object.keys(definitions).length };
}
