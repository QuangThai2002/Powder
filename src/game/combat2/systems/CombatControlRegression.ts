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
  PARALYSIS_SKIP_CHANCE,
  baseControlChance,
  controlChanceFor,
  cooldownForAbility
} from './CombatControlEngine';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';
import { TurnManager } from './TurnManager';

export interface CombatControlRegressionReport {
  rarityChanceChecked: boolean;
  cooldownPolicyChecked: boolean;
  hardControlDistributionChecked: boolean;
  silenceChecked: boolean;
  stunChanceChecked: boolean;
  paralysisChecked: boolean;
  freezeStagesChecked: boolean;
  antiChainChecked: boolean;
  ownTurnDurationChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Control Regression] ${message}`);
}

function approx(actual: number, expected: number, tolerance = 0.0001): boolean {
  return Math.abs(actual - expected) <= tolerance;
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
  assert(chill.statusLabel === 'chill' && target.freezeStage === 1, 'first Freeze application must become Chill');
  assert(approx(target.speed, baseSpeed * 0.9, 0.01), 'Chill must reduce Speed by 10%');

  actor.skillCooldownActionsRemaining[0] = 0;
  const frostbite = skills.resolve(actor, target, freeze, 0, 2);
  assert(frostbite.statusLabel === 'frostbite' && target.freezeStage === 2, 'second Freeze application must become Frostbite');
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
  assert(frozen.statusLabel === 'freeze' && target.controlStatus === 'freeze' && target.controlActionsRemaining === 1, 'third Freeze application must fully Freeze for one target own turn');

  const frozenBaselineState = fixture();
  const frozenBaselineActor = frozenBaselineState.activeLiving('player')[0];
  const frozenBaselineTarget = frozenBaselineState.activeLiving('enemy')[0];
  assert(frozenBaselineActor && frozenBaselineTarget, 'Frozen damage baseline missing');
  const shatter = new BasicAttackResolver().resolve(actor, target);
  const frozenNormalDamage = new BasicAttackResolver().resolve(frozenBaselineActor, frozenBaselineTarget);
  assert(shatter.freezeShattered, 'taking damage while Frozen must break Freeze');
  assert(target.controlStatus === null && target.controlActionsRemaining === 0, 'shatter must immediately clear full Freeze');
  assert(shatter.damage > frozenNormalDamage.damage, 'Frozen target must take the +30% shatter damage bonus');
}

function validateAntiChain(): void {
  assert(CONTROL_HISTORY_ROUNDS === 5, 'anti-chain window must remain five rounds');
  assert(CONTROL_IMMUNITY_ACTIONS === 2, 'Control Immunity must remain two target own turns');
  const state = fixture();
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  assert(actor && target, 'anti-chain fixture missing');
  const skills = new SkillActionResolver(() => 0);

  const controls = [
    { name: 'Anti Chain Skill A', status: 'stun' },
    { name: 'Anti Chain Skill B', status: 'silence' },
    { name: 'Anti Chain Skill C', status: 'paralysis' }
  ] as const;

  controls.forEach((control, index) => {
    actor.skillCooldownActionsRemaining[0] = 0;
    const result = skills.resolve(actor, target, {
      name: control.name, power: 1, type: 'debuff', status: control.status
    }, 0, index + 1);
    if (index < 2) assert(!result.controlImmunityTriggered, 'Control Immunity triggered before the third distinct CC skill');
    else assert(result.controlImmunityTriggered, 'third distinct CC skill in five rounds must trigger Control Immunity');
  });

  assert(target.controlImmunityActionsRemaining === 2, 'anti-chain immunity duration mismatch');
  assert(target.controlActionsRemaining === 0 && target.silenceActionsRemaining === 0 && target.paralysisActionsRemaining === 0, 'Control Immunity must clear active hard controls');

  actor.skillCooldownActionsRemaining[0] = 0;
  const blocked = skills.resolve(actor, target, {
    name: 'Anti Chain Skill D', power: 1, type: 'debuff', status: 'freeze'
  }, 0, 4);
  assert(blocked.controlBlocked && !blocked.controlApplied, 'new CC must be blocked while Control Immunity is active');
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
  validateDistribution();
  validateSilence();
  validateStunChance();
  validateParalysis();
  validateFreezeStages();
  validateAntiChain();
  validateOwnTurnDurations();

  return {
    rarityChanceChecked: true,
    cooldownPolicyChecked: true,
    hardControlDistributionChecked: true,
    silenceChecked: true,
    stunChanceChecked: true,
    paralysisChecked: true,
    freezeStagesChecked: true,
    antiChainChecked: true,
    ownTurnDurationChecked: true
  };
}
