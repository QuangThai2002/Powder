import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import { abilityHasLegalTarget, abilityTargetMode } from './CombatAbilityTargeting';
import { CombatState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';

export interface CombatSpecialSupportRegressionReport {
  cleanseChecked: boolean;
  reviveChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[Combat2 Special Regression] ${message}`);
  }
}

export function runCombatSpecialSupportRegression(): CombatSpecialSupportRegressionReport {
  const state = new CombatState(
    COMBAT2_STARTER_ROSTER.player,
    COMBAT2_STARTER_ROSTER.enemy
  );
  const resolver = new SkillActionResolver();
  const support = state.units.find((unit) => unit.pow.id === 'mosshorn');

  assert(support, 'Mosshorn test support is missing from the player roster');
  const cleanse = support.pow.abilities.skills.find(
    (ability) => String(ability.status || '').toLowerCase() === 'cleanse'
  );
  const revive = support.pow.abilities.skills.find(
    (ability) => String(ability.status || '').toLowerCase() === 'revive'
  );

  assert(cleanse, 'Cleanse test ability is missing');
  assert(revive, 'Revive test ability is missing');
  assert(abilityTargetMode(cleanse) === 'ally', 'Cleanse must target an ally');
  assert(abilityTargetMode(revive) === 'deadAlly', 'Revive must target a fallen ally');

  const ally = state
    .activeLiving('player')
    .find((unit) => unit.instanceId !== support.instanceId);
  assert(ally, 'Cleanse fixture requires another active ally');

  ally.controlStatus = 'freeze';
  ally.controlActionsRemaining = 1;
  ally.dotStatus = 'poison';
  ally.dotDamage = 12;
  ally.dotActionsRemaining = 2;
  ally.speedDebuffActionsRemaining = 2;
  ally.speed = Math.max(1, ally.pow.speed * 0.8);

  assert(
    abilityHasLegalTarget(cleanse, support, state.units),
    'Cleanse did not detect a debuffed active ally'
  );

  support.mana = support.pow.maxMana;
  const cleanseResult = resolver.resolve(support, ally, cleanse, 0);
  assert(cleanseResult.cleansed, 'Cleanse result flag was not set');
  assert(ally.controlActionsRemaining === 0, 'Cleanse did not clear control');
  assert(ally.dotActionsRemaining === 0, 'Cleanse did not clear DOT');
  assert(ally.speedDebuffActionsRemaining === 0, 'Cleanse did not clear slow');

  const fallen = state
    .activeLiving('player')
    .find((unit) => unit.instanceId !== support.instanceId && unit.instanceId !== ally.instanceId)
    ?? ally;
  fallen.hp = 0;
  fallen.alive = false;
  fallen.fieldSlot = null;
  fallen.controlStatus = 'stun';
  fallen.controlActionsRemaining = 1;
  fallen.dotStatus = 'burn';
  fallen.dotDamage = 9;
  fallen.dotActionsRemaining = 2;

  assert(
    abilityHasLegalTarget(revive, support, state.units),
    'Revive did not detect a fallen ally'
  );

  support.mana = support.pow.maxMana;
  const reviveResult = resolver.resolve(support, fallen, revive, 1);
  assert(reviveResult.revived, 'Revive result flag was not set');
  assert(fallen.alive, 'Revive did not restore the fallen ally');
  assert(
    fallen.hp === Math.max(1, Math.round(fallen.pow.maxHp * 0.35)),
    'Revive restored an unexpected HP amount'
  );
  assert(fallen.fieldSlot === null, 'Revive must return the unit as reserve when the field is full');
  assert(fallen.controlActionsRemaining === 0, 'Revive did not clear control');
  assert(fallen.dotActionsRemaining === 0, 'Revive did not clear DOT');

  return {
    cleanseChecked: true,
    reviveChecked: true
  };
}
