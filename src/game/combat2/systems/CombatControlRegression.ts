import {
  CANONICAL_HARD_CONTROL_COUNTS,
  CANONICAL_HARD_CONTROL_TOTAL,
  COMBAT2_STARTER_ROSTER
} from '../data/PowderDataAdapter';
import { BasicAttackResolver } from './BasicAttackResolver';
import {
  CONTROL_EFFECT_CHANCE_CAP,
  CONTROL_HISTORY_ROUNDS,
  CONTROL_IMMUNITY_ACTIONS,
  CONTROL_IMMUNITY_TRIGGER_HITS,
  PARALYSIS_SKIP_CHANCE,
  baseControlChance,
  controlChanceFor,
  controlWindowSnapshot,
  cooldownForAbility
} from './CombatControlEngine';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';
import { TurnManager } from './TurnManager';

export interface CombatControlRegressionReport {
  rarityChanceChecked: boolean;
  cooldownPolicyChecked: boolean;
  cooldownRuntimeChecked: boolean;
  hardControlDistributionChecked: boolean;
  silenceChecked: boolean;
  stunChanceChecked: boolean;
  paralysisChecked: boolean;
  freezeStagesChecked: boolean;
  antiChainChecked: boolean;
  sameStatusAntiChainChecked: boolean;
  controlWindowExpiryChecked: boolean;
  ownTurnDurationChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Control Regression] ${message}`);
}

function approx(actual: number, expected: number, tolerance = 0.0001): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function freezeStageOf(unit: { freezeStage: number }): number {
  return unit.freezeStage;
}

function controlActionsOf(unit: { controlActionsRemaining: number }): number {
  return unit.controlActionsRemaining;
}

function fixture(): CombatState {
  return new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
}

function validateRarityChance(): void {
  assert(approx(baseControlChance('common'), 0.4), 'Common CC chance must be 40%');
  assert(approx(baseControlChance('rare'), 0.45), 'Rare CC chance must be 45%');
  assert(approx(baseControlChance('super_rare'), 0.5), 'Super Rare CC chance must be 50%');
  assert(approx(baseControlChance('epic'), 0.55), 'Epic CC chance must be 55%');
  assert(approx(baseControlChance('legendary'), 0.6), 'Legendary CC chance must be 60%');
  assert(approx(baseControlChance('mythic'), 0.65), 'Mythic CC chance must be 65%');
  assert(approx(baseControlChance('ancient'), 0.7), 'Ancient CC chance must be 70%');
  assert(approx(CONTROL_EFFECT_CHANCE_CAP, 0.8), 'CC chance cap must remain 80%');

  const state = fixture();
  const actor = state.activeLiving('player')[0];
  assert(actor, 'effect-accuracy fixture requires an actor');
  actor.effectAccuracyBonus = 0.5;
  assert(approx(controlChanceFor(actor), 0.8), 'effect accuracy must never push CC above 80%');
}

function validateCooldownPolicy(): void {
  const hard = ['stun', 'silence', 'paralysis', 'freeze'];
  for (const status of hard) {
    assert(
      cooldownForAbility({ name: status, power: 1, type: 'debuff', status }, 0) === 2,
      `${status} must use a two-own-turn cooldown`
    );
  }

  assert(cooldownForAbility({ name: 'Slow', power: 1, type: 'debuff', status: 'slow' }, 0) === 1, 'Slow must use CD1');
  assert(cooldownForAbility({ name: 'Shield', power: 1, type: 'support', status: 'shield' }, 1) === 1, 'Shield must use CD1');
  assert(cooldownForAbility({ name: 'Cleanse', power: 1, type: 'support', status: 'cleanse' }, 1) === 1, 'Cleanse must use CD1');
  assert(cooldownForAbility({ name: 'Revive', power: 1, type: 'support', status: 'revive' }, 1) === 3, 'Revive must use CD3');
  assert(cooldownForAbility({ name: 'Burn', power: 100, type: 'elemental', status: 'burn' }, 0) === 0, 'Burn must remain CD0');
  assert(cooldownForAbility({ name: 'Poison', power: 100, type: 'elemental', status: 'poison' }, 0) === 0, 'Poison must remain CD0');
  assert(cooldownForAbility({ name: 'Damage', power: 100, type: 'elemental' }, 0) === 0, 'pure damage must remain CD0');
}

function validateCooldownRuntime(): void {
  const state = fixture();
  const tracked = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(tracked && target, 'runtime cooldown fixture requires active units');

  const turns = new TurnManager(state);
  const skills = new SkillActionResolver(() => 0);
  const hardCc = { name: 'Runtime CD2 Stun', power: 1, type: 'debuff', status: 'stun' } as const;
  let phase: 'waitingForCast' | 'blockedOne' | 'blockedTwo' | 'readyAgain' = 'waitingForCast';
  let iterations = 0;

  while (phase !== 'readyAgain' && iterations < 120) {
    const actor = turns.beginNextTurn();
    assert(actor, 'scheduler ended during runtime cooldown fixture');

    if (actor.instanceId === tracked.instanceId) {
      if (phase === 'waitingForCast') {
        assert(skills.canUse(tracked, 0), 'hard CC must be available before first cast');
        skills.resolve(tracked, target, hardCc, 0, state.round);
        turns.completeAction(tracked.instanceId);
        assert(skills.cooldownRemaining(tracked, 0) === 2, 'CD2 must display 2 after the casting turn completes');
        phase = 'blockedOne';
      } else if (phase === 'blockedOne') {
        assert(!skills.canUse(tracked, 0), 'CD2 must block the first future own turn');
        assert(skills.cooldownRemaining(tracked, 0) === 2, 'other Pow turns must not consume the first CD2 charge');
        turns.completeAction(tracked.instanceId);
        assert(skills.cooldownRemaining(tracked, 0) === 1, 'first blocked own turn must reduce CD2 to 1');
        phase = 'blockedTwo';
      } else if (phase === 'blockedTwo') {
        assert(!skills.canUse(tracked, 0), 'CD2 must block the second future own turn');
        assert(skills.cooldownRemaining(tracked, 0) === 1, 'CD2 must remain 1 until the second blocked own turn completes');
        turns.completeAction(tracked.instanceId);
        assert(skills.cooldownRemaining(tracked, 0) === 0, 'second blocked own turn must finish CD2');
        phase = 'readyAgain';
      }
    } else {
      const before = skills.cooldownRemaining(tracked, 0);
      turns.completeAction(actor.instanceId);
      assert(skills.cooldownRemaining(tracked, 0) === before, 'other Pow actions must never consume this Pow cooldown');
    }
    iterations += 1;
  }

  assert(phase === 'readyAgain', 'CD2 runtime fixture did not finish two blocked own turns');
  assert(skills.canUse(tracked, 0), 'hard CC must be usable again after two blocked own turns');
}

function validateDistribution(): void {
  const counts = Object.values(CANONICAL_HARD_CONTROL_COUNTS);
  assert(CANONICAL_HARD_CONTROL_TOTAL > 0, 'canonical roster must contain hard-control skills');
  assert(counts.reduce((sum, value) => sum + value, 0) === CANONICAL_HARD_CONTROL_TOTAL, 'hard-control count total mismatch');
  assert(Math.max(...counts) - Math.min(...counts) <= 1, 'four hard-control types must differ by at most one skill');
}

function validateSilence(): void {
  const state = fixture();
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'Silence fixture requires active units');
  const skills = new SkillActionResolver(() => 0);
  const result = skills.resolve(actor, target, {
    name: 'Silence Regression A', power: 1, type: 'debuff', status: 'silence'
  }, 0, 1);
  assert(result.controlApplied && target.silenceActionsRemaining === 1, 'Silence must land for exactly one target own turn');
  assert(!skills.canUse(target, 0) && !skills.canUseUltimate(target), 'Silence must block Skill I/II and Ultimate');

  const basicTarget = state.activeLiving('player')[1];
  assert(basicTarget, 'Silence basic-attack fixture needs a target');
  const basic = new BasicAttackResolver().resolve(target, basicTarget);
  assert(basic.damage > 0, 'Silenced Pow must still be allowed to use Basic Attack');
}

function validateStunChance(): void {
  const hitState = fixture();
  const hitActor = hitState.activeLiving('player')[0];
  const hitTarget = hitState.activeLiving('enemy')[0];
  assert(hitActor && hitTarget, 'Stun hit fixture missing');
  const hit = new SkillActionResolver(() => 0).resolve(hitActor, hitTarget, {
    name: 'Stun Regression Hit', power: 1, type: 'debuff', status: 'stun'
  }, 0, 1);
  assert(hit.controlApplied && !hit.controlMissed && hitTarget.controlStatus === 'stun', 'roll 0 must land Stun');

  const missState = fixture();
  const missActor = missState.activeLiving('player')[0];
  const missTarget = missState.activeLiving('enemy')[0];
  assert(missActor && missTarget, 'Stun miss fixture missing');
  const miss = new SkillActionResolver(() => 0.99).resolve(missActor, missTarget, {
    name: 'Stun Regression Miss', power: 1, type: 'debuff', status: 'stun'
  }, 0, 1);
  assert(!miss.controlApplied && miss.controlMissed && missTarget.controlStatus === null, 'roll 0.99 must miss non-capped Stun');
}

function validateParalysis(): void {
  assert(approx(PARALYSIS_SKIP_CHANCE, 0.3), 'Paralysis skip chance must remain 30%');
  const state = fixture();
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'Paralysis fixture missing');
  const landingResolver = new SkillActionResolver(() => 0);
  const result = landingResolver.resolve(actor, target, {
    name: 'Paralysis Regression', power: 1, type: 'debuff', status: 'paralysis'
  }, 0, 1);
  assert(result.controlApplied && target.paralysisActionsRemaining === 2, 'Paralysis must remain active for two target own turns');
  assert(landingResolver.shouldParalysisSkip(target), 'roll 0 must trigger the 30% Paralysis skip');
  assert(!new SkillActionResolver(() => 0.99).shouldParalysisSkip(target), 'roll 0.99 must not trigger Paralysis skip');
}

function validateFreezeStages(): void {
  const state = fixture();
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'Freeze fixture missing');
  const skills = new SkillActionResolver(() => 0);
  const freeze = { name: 'Freeze Regression Chain', power: 1, type: 'debuff', status: 'freeze' } as const;
  const baseSpeed = target.pow.speed;

  const chill = skills.resolve(actor, target, freeze, 0, 1);
  assert(chill.statusLabel === 'chill' && freezeStageOf(target) === 1, 'first Freeze application must become Chill');
  assert(approx(target.speed, baseSpeed * 0.9, 0.01), 'Chill must reduce Speed by 10%');

  actor.skillCooldownActionsRemaining[0] = 0;
  const frostbite = skills.resolve(actor, target, freeze, 0, 2);
  assert(frostbite.statusLabel === 'frostbite' && freezeStageOf(target) === 2, 'second Freeze application must become Frostbite');
  assert(approx(target.speed, baseSpeed * 0.8, 0.01), 'Frostbite must reduce Speed by 20%');

  const frostBaselineState = fixture();
  const frostBaselineActor = frostBaselineState.activeLiving('player')[0];
  const frostBaselineTarget = frostBaselineState.activeLiving('enemy')[0];
  assert(frostBaselineActor && frostBaselineTarget, 'Frostbite damage baseline missing');
  const frostbiteDamage = new BasicAttackResolver().resolve(actor, target);
  const normalDamage = new BasicAttackResolver().resolve(frostBaselineActor, frostBaselineTarget);
  assert(frostbiteDamage.damage > normalDamage.damage, 'Frostbite must increase incoming damage by 10%');

  actor.skillCooldownActionsRemaining[0] = 0;
  const frozen = skills.resolve(actor, target, freeze, 0, 3);
  assert(frozen.statusLabel === 'freeze' && target.controlStatus === 'freeze' && controlActionsOf(target) === 1, 'third Freeze application must fully Freeze for one target own turn');

  const frozenBaselineState = fixture();
  const frozenBaselineActor = frozenBaselineState.activeLiving('player')[0];
  const frozenBaselineTarget = frozenBaselineState.activeLiving('enemy')[0];
  assert(frozenBaselineActor && frozenBaselineTarget, 'Frozen damage baseline missing');
  const normalFrozenHit = new BasicAttackResolver().resolve(actor, target);
  const frozenNormalDamage = new BasicAttackResolver().resolve(frozenBaselineActor, frozenBaselineTarget);
  assert(!normalFrozenHit.freezeShattered, 'normal damage must not implicitly Shatter Freeze');
  assert(target.controlStatus === 'freeze' && controlActionsOf(target) === 1, 'normal damage must preserve full Freeze');
  assert(normalFrozenHit.damage === frozenNormalDamage.damage, 'normal damage must not receive the explicit Shatter bonus');

  actor.skillCooldownActionsRemaining[0] = 0;
  const controlHistoryBefore = target.controlHistory.length;
  const shatter = skills.resolve(actor, target, {
    name: 'Explicit Shatter Fixture', power: 100, type: 'physical', damageType: 'physical',
    shatterFrozen: true, status: 'freeze'
  }, 0, 4);
  assert(shatter.freezeShattered, 'explicit Shatter must break a full Freeze');
  assert(target.controlStatus === null && controlActionsOf(target) === 0, 'explicit Shatter must clear full Freeze');
  assert(target.freezeStage === 0, 'the Shatter hit must not reapply Chill');
  assert(target.controlHistory.length === controlHistoryBefore, 'Shatter must preserve the successful Freeze CC history');
}

function validateAntiChain(): void {
  assert(CONTROL_HISTORY_ROUNDS === 5, 'each CC must count through its own round plus four following rounds');
  assert(CONTROL_IMMUNITY_TRIGGER_HITS === 4, 'Control Immunity must trigger on the fourth active CC hit');
  assert(CONTROL_IMMUNITY_ACTIONS === 2, 'Control Immunity must remain two target own turns');
  const state = fixture();
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'anti-chain fixture missing');
  const skills = new SkillActionResolver(() => 0);

  const controls = [
    { name: 'Anti Chain Skill A', status: 'stun' },
    { name: 'Anti Chain Skill B', status: 'silence' },
    { name: 'Anti Chain Skill C', status: 'paralysis' },
    { name: 'Anti Chain Skill D', status: 'freeze' }
  ] as const;

  controls.forEach((control, index) => {
    actor.skillCooldownActionsRemaining[0] = 0;
    if (index === 3) {
      target.dotStatus = 'burn';
      target.dotDamage = 11;
      target.dotActionsRemaining = 2;
      target.speedDebuffActionsRemaining = 2;
      target.speed = target.pow.speed * 0.8;
    }
    const result = skills.resolve(actor, target, {
      name: control.name, power: 1, type: 'debuff', status: control.status
    }, 0, index + 1);
    if (index < 3) assert(!result.controlImmunityTriggered, 'Control Immunity must not trigger before the fourth landed CC');
    else assert(result.controlImmunityTriggered, 'the fourth landed CC inside the active window must trigger Control Immunity');
  });

  assert(target.controlImmunityActionsRemaining === 2, 'anti-chain immunity duration mismatch');
  assert(target.controlActionsRemaining === 0 && target.silenceActionsRemaining === 0 && target.paralysisActionsRemaining === 0, 'Control Immunity must clear active hard controls');
  assert(target.freezeStage === 0 && target.freezeStageActionsRemaining === 0, 'Control Immunity must clear Chill/Frostbite/Freeze state');
  assert(target.dotStatus === 'burn' && target.dotActionsRemaining === 2 && target.dotDamage === 11, 'Control Immunity must not cleanse Burn/Poison');
  assert(target.speedDebuffActionsRemaining === 2, 'Control Immunity must not cleanse Slow or other non-CC debuffs');
  assert(approx(target.speed, target.pow.speed * 0.8, 0.01), 'Slow must remain composed after hard CC is cleared');
  assert(target.controlHistory.length === 0, 'history must reset after immunity triggers');

  actor.skillCooldownActionsRemaining[0] = 0;
  const blocked = skills.resolve(actor, target, {
    name: 'Blocked During Immunity', power: 1, type: 'debuff', status: 'stun'
  }, 0, 5);
  assert(blocked.controlBlocked && !blocked.controlApplied, 'new CC must be blocked while Control Immunity is active');
}

function validateSameStatusAntiChain(): void {
  const state = fixture();
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'same-status anti-chain fixture missing');
  const skills = new SkillActionResolver(() => 0);

  for (let index = 0; index < CONTROL_IMMUNITY_TRIGGER_HITS; index += 1) {
    actor.skillCooldownActionsRemaining[0] = 0;
    const result = skills.resolve(actor, target, {
      name: 'Repeated Stun Skill', power: 1, type: 'debuff', status: 'stun'
    }, 0, index + 1);
    if (index < CONTROL_IMMUNITY_TRIGGER_HITS - 1) {
      assert(!result.controlImmunityTriggered, 'repeated Stun must not trigger immunity before hit four');
    } else {
      assert(result.controlImmunityTriggered, 'the fourth landed hard CC must trigger even when it is the same skill/status');
    }
  }

  assert(target.controlImmunityActionsRemaining === 2, 'four same-source hard CC hits must grant two own turns of immunity');
}

function validateControlWindowExpiry(): void {
  const state = fixture();
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'control-window fixture missing');
  const skills = new SkillActionResolver(() => 0);

  for (const round of [1, 2, 3]) {
    actor.skillCooldownActionsRemaining[0] = 0;
    const result = skills.resolve(actor, target, {
      name: `Window Stun ${round}`, power: 1, type: 'debuff', status: 'stun'
    }, 0, round);
    assert(!result.controlImmunityTriggered, `CC at round ${round} must not trigger immunity before hit four`);
  }
  let snapshot = controlWindowSnapshot(target);
  assert(snapshot.count === 3 && snapshot.firstRound === 1 && snapshot.expiresRound === 5, 'round-1/2/3 history must show 3/4 with V1→V5 window');

  actor.skillCooldownActionsRemaining[0] = 0;
  const roundSix = skills.resolve(actor, target, {
    name: 'Window Stun 6', power: 1, type: 'debuff', status: 'stun'
  }, 0, 6);
  assert(!roundSix.controlImmunityTriggered, 'round-1 CC must expire before the round-6 fourth-hit calculation');
  snapshot = controlWindowSnapshot(target);
  assert(snapshot.count === 3, 'round 6 must count only rounds 2, 3 and 6');
  assert(snapshot.firstRound === 2 && snapshot.expiresRound === 6, 'after round 1 expires the tactical window must become V2→V6');
}

function validateOwnTurnDurations(): void {
  const state = fixture();
  const tracked = state.activeLiving('player')[0];
  assert(tracked, 'own-turn duration fixture missing');
  tracked.controlImmunityActionsRemaining = 2;
  const turns = new TurnManager(state);
  let trackedTurns = 0;
  let iterations = 0;

  while (trackedTurns < 2 && iterations < 80) {
    const actor = turns.beginNextTurn();
    assert(actor, 'scheduler ended during own-turn duration fixture');
    const before = tracked.controlImmunityActionsRemaining;
    turns.completeAction(actor.instanceId);
    if (actor.instanceId === tracked.instanceId) {
      trackedTurns += 1;
      assert(tracked.controlImmunityActionsRemaining === Math.max(0, before - 1), 'own action must decrement Control Immunity exactly once');
    } else {
      assert(tracked.controlImmunityActionsRemaining === before, 'other Pow actions must not consume Control Immunity');
    }
    iterations += 1;
  }

  assert(trackedTurns === 2 && tracked.controlImmunityActionsRemaining === 0, 'Control Immunity must expire after exactly two own turns');
}

export function runCombatControlRegression(): CombatControlRegressionReport {
  validateRarityChance();
  validateCooldownPolicy();
  validateCooldownRuntime();
  validateDistribution();
  validateSilence();
  validateStunChance();
  validateParalysis();
  validateFreezeStages();
  validateAntiChain();
  validateSameStatusAntiChain();
  validateControlWindowExpiry();
  validateOwnTurnDurations();

  return {
    rarityChanceChecked: true,
    cooldownPolicyChecked: true,
    cooldownRuntimeChecked: true,
    hardControlDistributionChecked: true,
    silenceChecked: true,
    stunChanceChecked: true,
    paralysisChecked: true,
    freezeStagesChecked: true,
    antiChainChecked: true,
    sameStatusAntiChainChecked: true,
    controlWindowExpiryChecked: true,
    ownTurnDurationChecked: true
  };
}
