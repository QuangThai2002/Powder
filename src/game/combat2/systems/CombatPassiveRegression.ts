import type { CombatPassiveMechanic, CombatPow } from '../data/CombatPow';
import { CombatState, type CombatUnitState } from './CombatState';
import { CombatMultiTargetEngine } from './CombatMultiTargetEngine';
import { BasicAttackResolver } from './BasicAttackResolver';
import {
  CombatPassiveEngine,
  createCombatActionProvenance,
  isMainDirectDamageAction,
  type CombatPassiveLifecycleEvent,
  type PassiveRuntimeEvent
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
    const khaiMach = {
      trigger: 'ON_BATTLE_START',
      effect: {
        kind: 'brambletKhaiMach', mainActionsRequired: 2, chargeTarget: 4, shieldMaxHpRatio: 0.03
      },
      runtime: 'LIVE'
    } as Definition;
    const fixture = { trigger: 'BEFORE_HIT', effect: {} } as Definition;
    const bramblet = pow('bramblet', khaiMach);
    bramblet.passive = { id: 'bramblet_khai_mach', name: 'Khai Mạch', mechanic: khaiMach };
    const state = new CombatState(
      [bramblet, pow('khai-mach-ally-a', fixture), pow('khai-mach-ally-b', fixture)],
      [pow('khai-mach-target', fixture, 'enemy')]
    );
    const [source, ally, highRageAlly] = state.activeLiving('player');
    const initEvents = engine.initializeBattle(state.units);
    assert(!engine.hasKhaiMach(source), 'Bramblet must not grant Mạch Khởi to itself');
    assert(engine.hasKhaiMach(ally) && engine.hasKhaiMach(highRageAlly), 'each other ally must receive Mạch Khởi');
    assert(initEvents[0]?.type === 'passive-mark' && initEvents[0].targetIds.length === 2, 'battle init must report exactly the other allies');
    assert(engine.initializeBattle(state.units).length === 0, 'Khai Mạch battle initialization must be idempotent');

    const lifecycle = (
      actor: CombatUnitState,
      stage: 'after-main-action' | 'after-ultimate-cast',
      origin: 'main' | 'follow-up' | 'counter' | 'dot' | 'secondary-hit' = 'main'
    ): PassiveRuntimeEvent[] => engine.applyLifecycle({
      stage,
      actor,
      provenance: createCombatActionProvenance(
        actor.instanceId,
        [state.activeLiving('enemy')[0].instanceId],
        stage === 'after-ultimate-cast' ? 'ultimate' : origin === 'dot' ? 'status-tick' : 'basic',
        origin !== 'dot',
        stage === 'after-ultimate-cast' ? 'Ultimate' : 'Action',
        { origin }
      ),
      round: 1,
      rageSpent: stage === 'after-ultimate-cast' ? 4 : 0,
      rageAfter: actor.ragePoints
    });

    ally.ragePoints = 1;
    assert(lifecycle(ally, 'after-main-action').length === 0 && ally.ragePoints === 1, 'first main action must not charge Rage');
    const chargeEvents = lifecycle(ally, 'after-main-action');
    assert(Number(ally.ragePoints) === 4, 'second main action must charge Rage directly to 4');
    assert(chargeEvents.length === 1 && chargeEvents[0].type === 'rage-charge', 'second main action must emit one Rage charge event');
    assert(chargeEvents[0].rageEvents?.length === 1, 'Khai Mạch charge must remain one logical Rage event');
    assert(!engine.hasKhaiMach(ally), 'Mạch Khởi must be consumed after the second main action');
    assert(lifecycle(ally, 'after-main-action').length === 0 && Number(ally.ragePoints) === 4, 'consumed Mạch Khởi must not trigger again');

    highRageAlly.ragePoints = 5;
    lifecycle(highRageAlly, 'after-main-action');
    lifecycle(highRageAlly, 'after-main-action');
    assert(highRageAlly.ragePoints === 5 && !engine.hasKhaiMach(highRageAlly), 'Rage at least 4 must not increase, but Mạch Khởi must still be consumed');

    const nonMainState = new CombatState(
      [bramblet, pow('khai-mach-non-main', fixture)],
      [pow('khai-mach-non-main-target', fixture, 'enemy')]
    );
    const nonMainSource = nonMainState.activeLiving('player')[0];
    const nonMainAlly = nonMainState.activeLiving('player')[1];
    engine.initializeBattle(nonMainState.units);
    nonMainAlly.ragePoints = 1;
    for (const origin of ['follow-up', 'counter', 'dot', 'secondary-hit'] as const) {
      engine.applyLifecycle({
        stage: 'after-main-action', actor: nonMainAlly,
        provenance: createCombatActionProvenance(nonMainAlly.instanceId, [], origin === 'dot' ? 'status-tick' : 'basic', origin !== 'dot', 'Non-main', { origin }),
        round: 1, rageSpent: 0, rageAfter: nonMainAlly.ragePoints
      });
    }
    assert(engine.battleCounter(nonMainAlly, 'khai-mach:main-actions') === 0, 'non-main provenance must not increase Khai Mạch action count');
    assert(engine.hasKhaiMach(nonMainAlly) && !engine.hasKhaiMach(nonMainSource), 'non-main actions must preserve only the ally mark');

    const shieldState = new CombatState(
      [bramblet, pow('khai-mach-ultimate-ally', fixture)],
      [pow('khai-mach-ultimate-target', fixture, 'enemy')]
    );
    const shieldSource = shieldState.activeLiving('player')[0];
    const shieldAlly = shieldState.activeLiving('player')[1];
    const shieldTarget = shieldState.activeLiving('enemy')[0];
    engine.initializeBattle(shieldState.units);
    const shieldEvents: PassiveRuntimeEvent[] = [];
    shieldAlly.ragePoints = 4;
    new SkillActionResolver(() => 0.99, (event) => shieldEvents.push(...engine.applyLifecycle(event))).resolveUltimate(
      shieldAlly, shieldTarget, shieldAlly.pow.abilities.ultimate, 1
    );
    assert(shieldAlly.shield === 30, 'first ally Ultimate must grant 3% of that ally Max HP as Shield');
    assert(shieldEvents.filter((event) => event.type === 'shield').length === 1, 'first Ultimate shield must emit once');
    shieldAlly.ragePoints = 4;
    shieldAlly.ultimateCooldownActionsRemaining = 0;
    new SkillActionResolver(() => 0.99, (event) => shieldEvents.push(...engine.applyLifecycle(event))).resolveUltimate(
      shieldAlly, shieldTarget, shieldAlly.pow.abilities.ultimate, 1
    );
    assert(shieldAlly.shield === 30, 'later Ultimates must not grant another Khai Mạch Shield');
    const sourceShieldBefore = shieldSource.shield;
    lifecycle(shieldSource, 'after-ultimate-cast');
    assert(shieldSource.shield === sourceShieldBefore, 'Bramblet must not receive its own Khai Mạch Shield');
    foundationChecks.push('Bramblet Khai Mạch: init / second main action / atomic charge / first-Ult shield');
  }

  {
    const energyChorus = {
      trigger: 'ON_BATTLE_START',
      effect: {
        kind: 'coralynEnergyChorus', checkpointActions: [3, 6], chargeTarget: 8, maxCheckpoints: 2
      },
      runtime: 'LIVE'
    } as Definition;
    const fixture = { trigger: 'BEFORE_HIT', effect: {} } as Definition;
    const coralyn = pow('coralyn', energyChorus);
    coralyn.passive = {
      id: 'coralyn_diep_khuc_nang_luong', name: 'Điệp Khúc Năng Lượng', mechanic: energyChorus
    };
    const lifecycle = (
      actor: CombatUnitState,
      origin: 'main' | 'follow-up' | 'counter' | 'dot' | 'secondary-hit' = 'main'
    ): PassiveRuntimeEvent[] => engine.applyLifecycle({
      stage: 'after-main-action',
      actor,
      provenance: createCombatActionProvenance(
        actor.instanceId,
        [],
        origin === 'dot' ? 'status-tick' : 'basic',
        origin !== 'dot',
        'Action',
        { origin }
      ),
      round: 1,
      rageSpent: 0,
      rageAfter: actor.ragePoints
    });

    const state = new CombatState(
      [coralyn, pow('chorus-carry-first', fixture), pow('chorus-ally-second', fixture)],
      [pow('chorus-target', fixture, 'enemy')]
    );
    const [source, carry, otherAlly] = state.activeLiving('player');
    const initEvents = engine.initializeBattle(state.units);
    assert(source.passiveState.designatedCarryInstanceId === carry.instanceId, 'Coralyn must deterministically select the first other ally as carry');
    assert(source.passiveState.designatedCarryInstanceId !== source.instanceId, 'Coralyn must never select itself as carry');
    assert(source.passiveState.designatedCarryInstanceId !== otherAlly.instanceId, 'designated carry selection must preserve roster order');
    assert(initEvents.length === 1 && initEvents[0].targetIds[0] === carry.instanceId, 'battle init must report the designated carry once');
    assert(engine.initializeBattle(state.units).length === 0, 'Energy Chorus battle initialization must be idempotent');

    carry.ragePoints = 1;
    assert(lifecycle(source).length === 0 && carry.ragePoints === 1, 'Coralyn action 1 must not charge the carry');
    assert(lifecycle(source).length === 0 && carry.ragePoints === 1, 'Coralyn action 2 must not charge the carry');
    const firstCharge = lifecycle(source);
    assert(Number(carry.ragePoints) === 8, 'Coralyn action 3 must charge an eligible carry directly to 8');
    assert(firstCharge.length === 1 && firstCharge[0].type === 'rage-charge', 'action 3 must emit one Rage charge event');
    assert(firstCharge[0].rageEvents?.length === 1, 'Energy Chorus charge must remain one logical Rage event');
    assert(lifecycle(source).length === 0, 'Coralyn action 4 must not trigger a checkpoint');
    assert(lifecycle(source).length === 0, 'Coralyn action 5 must not trigger a checkpoint');
    carry.ragePoints = 1;
    const secondCharge = lifecycle(source);
    assert(Number(carry.ragePoints) === 8, 'Coralyn action 6 must charge an eligible carry directly to 8');
    assert(secondCharge.length === 1 && secondCharge[0].rageEvents?.length === 1, 'action 6 must emit one logical Rage event');
    carry.ragePoints = 1;
    assert(lifecycle(source).length === 0 && carry.ragePoints === 1, 'actions after 6 must not create additional checkpoints');
    assert(engine.battleCounter(source, 'diep-khuc:checkpoints-used') === 2, 'Energy Chorus must use at most two checkpoints');

    const skippedState = new CombatState(
      [coralyn, pow('chorus-high-rage-carry', fixture)],
      [pow('chorus-skip-target', fixture, 'enemy')]
    );
    const [skippedSource, highRageCarry] = skippedState.activeLiving('player');
    engine.initializeBattle(skippedState.units);
    highRageCarry.ragePoints = 4;
    lifecycle(skippedSource);
    lifecycle(skippedSource);
    assert(lifecycle(skippedSource).length === 0 && highRageCarry.ragePoints === 4, 'Rage at least 4 must skip checkpoint 3');
    highRageCarry.ragePoints = 1;
    assert(lifecycle(skippedSource).length === 0 && highRageCarry.ragePoints === 1, 'a skipped checkpoint must not defer to action 4');
    assert(engine.battleCounter(skippedSource, 'diep-khuc:checkpoints-used') === 1, 'an ineligible checkpoint must still be consumed');

    const defeatedState = new CombatState(
      [coralyn, pow('chorus-defeated-carry', fixture)],
      [pow('chorus-defeated-target', fixture, 'enemy')]
    );
    const [defeatedSource, defeatedCarry] = defeatedState.activeLiving('player');
    engine.initializeBattle(defeatedState.units);
    defeatedCarry.ragePoints = 1;
    defeatedCarry.hp = 0;
    defeatedCarry.alive = false;
    lifecycle(defeatedSource);
    lifecycle(defeatedSource);
    assert(lifecycle(defeatedSource).length === 0 && defeatedCarry.ragePoints === 1, 'a defeated carry must skip checkpoint 3');
    defeatedCarry.hp = defeatedCarry.pow.maxHp;
    defeatedCarry.alive = true;
    assert(lifecycle(defeatedSource).length === 0 && defeatedCarry.ragePoints === 1, 'a defeated-carry checkpoint must not defer after revival');

    const nonMainState = new CombatState(
      [coralyn, pow('chorus-non-main-carry', fixture)],
      [pow('chorus-non-main-target', fixture, 'enemy')]
    );
    const [nonMainSource, nonMainCarry] = nonMainState.activeLiving('player');
    engine.initializeBattle(nonMainState.units);
    nonMainCarry.ragePoints = 1;
    for (const origin of ['follow-up', 'counter', 'dot', 'secondary-hit'] as const) lifecycle(nonMainSource, origin);
    assert(engine.battleCounter(nonMainSource, 'diep-khuc:main-actions') === 0, 'non-main provenance must not increase Coralyn main-action count');
    lifecycle(nonMainSource);
    lifecycle(nonMainSource);
    const nonMainCharge = lifecycle(nonMainSource);
    assert(nonMainCarry.ragePoints === 8 && nonMainCharge.length === 1, 'only three real main actions may reach checkpoint 3');

    const soloState = new CombatState([coralyn], [pow('chorus-solo-target', fixture, 'enemy')]);
    const soloSource = soloState.activeLiving('player')[0];
    assert(engine.initializeBattle(soloState.units).length === 0, 'Coralyn without another ally must initialize without an event');
    assert(soloSource.passiveState.designatedCarryInstanceId === null, 'Coralyn without an eligible ally must leave carry unset');
    lifecycle(soloSource);
    lifecycle(soloSource);
    assert(lifecycle(soloSource).length === 0, 'Coralyn without a carry must no-op at checkpoint 3');
    foundationChecks.push('Coralyn Energy Chorus: deterministic carry / checkpoints 3 and 6 / atomic charge / skip without defer');
  }

  {
    const conduction = {
      trigger: 'ON_BATTLE_START',
      effect: { kind: 'stormcoilConduction', counterId: 'DIEN_NHIP', counterMin: 0, counterMax: 4 },
      runtime: 'LIVE'
    } as Definition;
    const fixture = { trigger: 'BEFORE_HIT', effect: {} } as Definition;
    const createStormcoil = (): CombatPow => {
      const stormcoil = pow('stormcoil', conduction);
      stormcoil.passive = { id: 'stormcoil_dan_dien', name: 'Dẫn Điện', mechanic: conduction };
      stormcoil.abilities.skills[0] = {
        id: 'stormcoil.skill1', name: 'Nhịp Sấm Truyền Lực', power: 105, type: 'magic',
        damageType: 'magic', scalingStat: 'ability-power', critMode: 'never', cooldown: 1,
        rageGainMode: 'none',
        passiveCounterGain: {
          counterId: 'DIEN_NHIP', amount: 1, max: 4,
          target: 'designatedCarry', timing: 'afterMainAction'
        }
      };
      stormcoil.abilities.ultimate = {
        id: 'stormcoil.ultimate', name: 'Đại Khúc Lôi Nộ', power: 110, type: 'magic',
        damageType: 'magic', scalingStat: 'ability-power', critMode: 'never', target: 'all-enemies', area: true,
        rageCost: 4,
        passiveCounterGain: {
          counterId: 'DIEN_NHIP', amount: 2, max: 4,
          target: 'designatedCarry', timing: 'afterUltimateActionConfirmed'
        }
      };
      return stormcoil;
    };

    const state = new CombatState(
      [createStormcoil(), pow('conduction-carry-first', fixture), pow('conduction-ally-second', fixture)],
      [pow('conduction-target', fixture, 'enemy')]
    );
    const [source, carry, otherAlly] = state.activeLiving('player');
    const target = state.activeLiving('enemy')[0];
    const initEvents = engine.initializeBattle(state.units);
    assert(source.passiveState.designatedCarryInstanceId === carry.instanceId, 'Stormcoil must deterministically select the first other ally as carry');
    assert(source.passiveState.designatedCarryInstanceId !== source.instanceId, 'Stormcoil must never select itself as carry');
    assert(source.passiveState.designatedCarryInstanceId !== otherAlly.instanceId, 'Stormcoil carry selection must preserve roster order');
    assert(initEvents.length === 1 && initEvents[0].targetIds[0] === carry.instanceId, 'Dẫn Điện init must report its carry once');
    assert(engine.ownedCounter(carry, 'dien-nhip') === 0 && engine.ownedCounter(source, 'dien-nhip') === 0, 'Điện Nhịp must initialize in the carry Passive ledger');

    const counterEvents: PassiveRuntimeEvent[] = [];
    const resolver = new SkillActionResolver(() => 0.99, (event) => counterEvents.push(...engine.applyLifecycle(event)));
    const carryRage = carry.ragePoints = 2;
    const sourceRage = source.ragePoints = 3;
    const firstSkill = resolver.resolve(source, target, source.pow.abilities.skills[0], 0, 1);
    assert(engine.ownedCounter(carry, 'dien-nhip') === 1, 'Stormcoil Skill1 must increase Điện Nhịp from 0 to 1');
    assert(carry.ragePoints === carryRage, 'Stormcoil Skill1 counter gain must not increase carry Rage');
    assert(firstSkill.rawRageGain === 0 && firstSkill.rageGained === 0 && source.ragePoints === sourceRage, 'Stormcoil Skill1 must not increase Stormcoil Rage');
    assert(counterEvents.filter((event) => event.type === 'passive-counter').length === 1, 'Skill1 must emit one Passive counter event');

    engine.setOwnedCounter(carry, 'dien-nhip', 3, 4);
    source.skillCooldownActionsRemaining[0] = 0;
    const secondSourceRage = source.ragePoints;
    const secondCarryRage = carry.ragePoints;
    resolver.resolve(source, target, source.pow.abilities.skills[0], 0, 1);
    assert(engine.ownedCounter(carry, 'dien-nhip') === 4, 'Stormcoil Skill1 must cap Điện Nhịp at 4');
    assert(source.ragePoints === secondSourceRage && carry.ragePoints === secondCarryRage, 'Stormcoil Skill1 counter cap must not alter Stormcoil or carry Rage');
    carry.ragePoints = 1;
    engine.applyLifecycle({
      stage: 'after-main-action', actor: carry,
      provenance: createCombatActionProvenance(carry.instanceId, [target.instanceId], 'basic', true, 'Carry Action'),
      round: 1, rageSpent: 0, rageAfter: carry.ragePoints
    });
    assert(carry.ragePoints === 1 && engine.ownedCounter(carry, 'dien-nhip') === 4, 'counter foundation must not enable full Dẫn Điện Rage charge');

    const ultimateState = new CombatState(
      [createStormcoil(), pow('conduction-ultimate-carry', fixture)],
      [pow('conduction-ultimate-target-a', fixture, 'enemy'), pow('conduction-ultimate-target-b', fixture, 'enemy')]
    );
    const [ultimateSource, ultimateCarry] = ultimateState.activeLiving('player');
    const ultimateTargets = ultimateState.activeLiving('enemy');
    engine.initializeBattle(ultimateState.units);
    engine.setOwnedCounter(ultimateCarry, 'dien-nhip', 3, 4);
    ultimateCarry.ragePoints = 2;
    ultimateSource.ragePoints = 4;
    const ultimateEvents: PassiveRuntimeEvent[] = [];
    const ultimateCast = new CombatMultiTargetEngine().resolveCast(
      new SkillActionResolver(() => 0.99, (event) => ultimateEvents.push(...engine.applyLifecycle(event))),
      ultimateSource,
      ultimateTargets[0],
      ultimateSource.pow.abilities.ultimate,
      'ultimate',
      ultimateState.units,
      1
    );
    assert(ultimateCast.hits.length === 2, 'Stormcoil Ultimate must resolve all enemies');
    assert(engine.ownedCounter(ultimateCarry, 'dien-nhip') === 4, 'Stormcoil Ultimate must add 2 Điện Nhịp with cap 4');
    assert(ultimateEvents.filter((event) => event.type === 'passive-counter').length === 1, 'AOE Ultimate must add its counter exactly once');
    assert(ultimateSource.ragePoints === 0, 'Stormcoil Ultimate must consume exactly 4 Rage without direct refund');
    assert(ultimateCarry.ragePoints === 2, 'Stormcoil Ultimate counter gain must not increase carry Rage');

    const deadState = new CombatState(
      [createStormcoil(), pow('conduction-dead-carry', fixture)],
      [pow('conduction-dead-target', fixture, 'enemy')]
    );
    const [deadSource, deadCarry] = deadState.activeLiving('player');
    const deadTarget = deadState.activeLiving('enemy')[0];
    engine.initializeBattle(deadState.units);
    engine.setOwnedCounter(deadCarry, 'dien-nhip', 1, 4);
    deadCarry.hp = 0;
    deadCarry.alive = false;
    deadSource.ragePoints = 4;
    new SkillActionResolver(() => 0.99, (event) => engine.applyLifecycle(event)).resolveUltimate(
      deadSource, deadTarget, deadSource.pow.abilities.ultimate, 1
    );
    assert(engine.ownedCounter(deadCarry, 'dien-nhip') === 1, 'Stormcoil Ultimate must not add counter to a defeated carry');
    assert(deadCarry.ragePoints === 0, 'defeated carry must not receive Rage from Stormcoil Ultimate');

    const soloState = new CombatState([createStormcoil()], [pow('conduction-solo-target', fixture, 'enemy')]);
    const soloSource = soloState.activeLiving('player')[0];
    const soloTarget = soloState.activeLiving('enemy')[0];
    assert(engine.initializeBattle(soloState.units).length === 0, 'solo Stormcoil must initialize without a carry event');
    assert(soloSource.passiveState.designatedCarryInstanceId === null, 'solo Stormcoil must leave designated carry unset');
    new SkillActionResolver(() => 0.99, (event) => engine.applyLifecycle(event)).resolve(
      soloSource, soloTarget, soloSource.pow.abilities.skills[0], 0, 1
    );
    foundationChecks.push('Stormcoil Dẫn Điện: carry / Skill1 +1 / Ultimate +2 once / cap 4 / no Rage charge');
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
