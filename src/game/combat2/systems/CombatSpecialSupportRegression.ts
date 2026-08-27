import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { abilityHasLegalTarget, abilityTargetMode } from './CombatAbilityTargeting';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';

export interface CombatSpecialSupportRegressionReport {
  cleanseChecked: boolean;
  reviveChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Special Regression] ${message}`);
}

export function runCombatSpecialSupportRegression(): CombatSpecialSupportRegressionReport {
  const state = new CombatState(COMBAT2_STARTER_ROSTER.player, COMBAT2_STARTER_ROSTER.enemy);
  const resolver = new SkillActionResolver(() => 0);
  const support = state.units.find((unit) => unit.pow.id === 'mosshorn');
  assert(support, 'Mosshorn test support is missing');

  const cleanse = support.pow.abilities.skills.find((ability) => String(ability.status || '').toLowerCase() === 'cleanse');
  const revive = support.pow.abilities.skills.find((ability) => String(ability.status || '').toLowerCase() === 'revive');
  assert(cleanse && revive, 'Cleanse/Revive fixtures are missing');
  assert(abilityTargetMode(cleanse) === 'ally', 'Cleanse must target ally');
  assert(abilityTargetMode(revive) === 'deadAlly', 'Revive must target fallen ally');

  const ally = state.activeLiving('player').find((unit) => unit.instanceId !== support.instanceId);
  assert(ally, 'Cleanse fixture requires ally');
  ally.controlStatus = 'freeze';
  ally.controlActionsRemaining = 1;
  ally.burnDamage = 18;
  ally.burnActionsRemaining = 2;
  ally.poisonStacks = 3;
  ally.poisonActionsRemaining = 2;
  ally.dotStatus = 'poison';
  ally.dotDamage = 12;
  ally.dotActionsRemaining = 2;
  ally.speedDebuffActionsRemaining = 2;
  ally.antiHeal = 0.25;
  ally.antiHealActionsRemaining = 2;
  ally.attackMultiplier = 0.8;
  ally.attackBuffActionsRemaining = 2;
  ally.accuracyBonus = -20;
  ally.accuracyDebuffActionsRemaining = 2;
  ally.speed = Math.max(1, ally.pow.speed * 0.8);
  assert(abilityHasLegalTarget(cleanse, support, state.units), 'Cleanse target not detected');
  const cleanseResult = resolver.resolve(support, ally, cleanse, 0);
  assert(cleanseResult.cleansed, 'Cleanse flag missing');
  assert(
    ally.controlActionsRemaining === 0 &&
    ally.burnActionsRemaining === 0 &&
    ally.poisonActionsRemaining === 0 &&
    ally.speedDebuffActionsRemaining === 0 &&
    ally.antiHealActionsRemaining === 0 &&
    ally.attackMultiplier === 1 &&
    ally.accuracyBonus === 0,
    'Cleanse did not clear restored negative states'
  );

  const fallen = state.activeLiving('player').find((unit) => unit.instanceId !== support.instanceId && unit.instanceId !== ally.instanceId) ?? ally;
  fallen.hp = 0;
  fallen.alive = false;
  fallen.fieldSlot = null;
  fallen.controlStatus = 'stun';
  fallen.controlActionsRemaining = 1;
  fallen.burnDamage = 9;
  fallen.burnActionsRemaining = 2;
  fallen.poisonStacks = 2;
  fallen.poisonActionsRemaining = 2;
  fallen.antiHeal = 0.25;
  fallen.antiHealActionsRemaining = 2;
  assert(abilityHasLegalTarget(revive, support, state.units), 'Revive target not detected');
  const reviveResult = resolver.resolve(support, fallen, revive, 1);
  assert(reviveResult.revived && fallen.alive, 'Revive failed');
  assert(fallen.hp === Math.max(1, Math.round(fallen.pow.maxHp * 0.35)), 'Revive HP must be 35%');
  assert(fallen.fieldSlot === null, 'Revived unit must remain reserve when field is full');
  assert(
    fallen.controlActionsRemaining === 0 &&
    fallen.burnActionsRemaining === 0 &&
    fallen.poisonActionsRemaining === 0 &&
    fallen.antiHealActionsRemaining === 0,
    'Revive must reset restored negative states'
  );

  return { cleanseChecked: true, reviveChecked: true };
}
