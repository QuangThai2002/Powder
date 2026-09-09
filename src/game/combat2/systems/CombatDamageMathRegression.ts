import type { CombatAbility, CombatPow, CombatRarity, GrievousTier } from '../data/CombatPow';
import { BasicAttackResolver } from './BasicAttackResolver';
import {
  GRIEVOUS_40,
  GRIEVOUS_60,
  effectiveHealingReduction,
  strongestGrievousTier
} from './CombatHealingReduction';
import { CombatLegacyStatEngine } from './CombatLegacyStatEngine';
import type { CombatUnitState } from './CombatState';
import { SkillActionResolver } from './SkillActionResolver';

export interface CombatDamageMathRegressionReport {
  checks: readonly string[];
  critChecked: boolean;
  defenseChecked: boolean;
  shatterChecked: boolean;
  grievousChecked: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Combat2 Damage Math Regression] ${message}`);
}

function approx(actual: number, expected: number, tolerance = 0.000001): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function makePow(overrides: Partial<CombatPow> = {}): CombatPow {
  const basic: CombatAbility = { name: 'Basic Fixture', power: 100, type: 'physical', damageType: 'physical' };
  return {
    id: 'fixture', name: 'Fixture', assetKey: 'fixture', assetUrl: '/fixture.png',
    element: 'Neutral', elementKey: 'neutral', role: 'neutral', rarity: 'common', level: 1,
    attack: 100, abilityPower: 100, defense: 0, speed: 100, hp: 1000, maxHp: 1000,
    critRate: 0, critDamage: 150, evasion: 0, accuracy: 100, critResist: 0,
    lethality: 0, defPen: 0, healPower: 0, shieldPower: 0, tenacity: 0, damageReduction: 0,
    abilities: {
      basic,
      skills: [
        { name: 'Skill I Fixture', power: 100, type: 'physical', damageType: 'physical' },
        { name: 'Skill II Fixture', power: 100, type: 'elemental', damageType: 'magic' }
      ],
      ultimate: { name: 'Ultimate Fixture', power: 100, type: 'ultimate', damageType: 'magic' }
    },
    display: { heightRatio: 1 },
    ...overrides
  };
}

function makeUnit(side: 'player' | 'enemy', powOverrides: Partial<CombatPow> = {}): CombatUnitState {
  const pow = makePow(powOverrides);
  return {
    instanceId: `${side}-${pow.id}`, pow, side, slot: 0, fieldSlot: 0,
    hp: pow.hp, ragePoints: 0, combo: 0, shield: 0, speed: pow.speed,
    speedBuffActionsRemaining: 0, speedDebuffActionsRemaining: 0,
    attackMultiplier: 1, abilityPowerMultiplier: 1, defenseMultiplier: 1,
    attackBuffActionsRemaining: 0, abilityPowerBuffActionsRemaining: 0, defenseBuffActionsRemaining: 0,
    critRateBonus: 0, critBuffActionsRemaining: 0, evasionBonus: 0, evasionBuffActionsRemaining: 0,
    accuracyBonus: 0, accuracyDebuffActionsRemaining: 0, tenacityBonus: 0, tenacityBuffActionsRemaining: 0,
    damageReductionBonus: 0, guardActionsRemaining: 0,
    antiHeal: 0, grievousTier: null, antiHealActionsRemaining: 0, regenerationActionsRemaining: 0,
    skillCooldownActionsRemaining: [0, 0], ultimateCooldownActionsRemaining: 0,
    effectAccuracyBonus: 0, controlStatus: null, controlActionsRemaining: 0,
    silenceActionsRemaining: 0, paralysisActionsRemaining: 0,
    freezeStage: 0, freezeStageActionsRemaining: 0,
    controlImmunityActionsRemaining: 0, controlHistory: [],
    dotStatus: null, dotDamage: 0, dotActionsRemaining: 0,
    burnDamage: 0, burnActionsRemaining: 0, poisonStacks: 0, poisonActionsRemaining: 0,
    passiveUsed: false, reviveMarkerActionsRemaining: 0, alive: true, actionLocked: false,
    initialInitiative: 42
  };
}

function directCrit(rarity: CombatRarity, critDamage: number) {
  const actor = makeUnit('player', { rarity, critRate: 100, critDamage });
  const target = makeUnit('enemy');
  return new CombatLegacyStatEngine(() => 0).resolveHit(actor, target, {
    offenseStat: 'attack', critMode: 'natural-ad', unavoidable: true
  });
}

function magicCrit(multiplier?: number, permission = false) {
  const actor = makeUnit('player', { critRate: 100, critDamage: 999 });
  const target = makeUnit('enemy');
  const ability: CombatAbility = {
    name: 'Magic Crit Fixture', power: 100, type: 'elemental', damageType: 'magic',
    ...(permission ? { critMode: 'magic' as const, magicCritMultiplier: multiplier } : {})
  };
  return new SkillActionResolver(() => 0).resolve(actor, target, ability, 0);
}

function applyGrievousSequence(tiers: readonly GrievousTier[]): CombatUnitState {
  const actor = makeUnit('player');
  const target = makeUnit('enemy');
  const resolver = new SkillActionResolver(() => 0);
  for (const tier of tiers) {
    actor.skillCooldownActionsRemaining[0] = 0;
    resolver.resolve(actor, target, {
      name: `Apply ${tier}`, power: 1, type: 'debuff', status: 'anti heal', grievousTier: tier
    }, 0);
  }
  return target;
}

export function runCombatDamageMathRegression(): CombatDamageMathRegressionReport {
  const basicActor = makeUnit('player', { critRate: 100, critDamage: 150 });
  const basicTarget = makeUnit('enemy');
  const basic = new BasicAttackResolver(() => 0).resolve(basicActor, basicTarget);
  assert(basic.crit, 'Basic AD must natural Crit');
  assert(approx(basic.critMultiplier, 2), 'AD Crit default total multiplier must be 2.00');

  const apWithoutPermission = magicCrit(undefined, false);
  assert(!apWithoutPermission.crit && apWithoutPermission.critChance === 0, 'AP must not natural Crit at 100% Crit Rate');
  const magic160 = magicCrit(1.6, true);
  const magic180 = magicCrit(1.8, true);
  const magic200 = magicCrit(2, true);
  const magicOverCap = magicCrit(3.5, true);
  assert(magic160.crit && approx(magic160.critMultiplier, 1.6), 'Magic Crit permission must allow 1.60');
  assert(magic180.crit && approx(magic180.critMultiplier, 1.8), 'Magic Crit permission must allow 1.80');
  assert(magic200.crit && approx(magic200.critMultiplier, 2), 'Magic Crit permission must allow 2.00');
  assert(magicOverCap.crit && approx(magicOverCap.critMultiplier, 2), 'Magic Crit must clamp above 2.00');

  assert(approx(directCrit('legendary', 999).critMultiplier, 2.5), 'Legendary AD Crit must clamp to 2.50');
  assert(approx(directCrit('mythic', 280).critMultiplier, 2.8), 'Mythic AD Crit must allow 2.80');
  assert(approx(directCrit('mythic', 999).critMultiplier, 2.8), 'Mythic AD Crit must clamp above 2.80');

  const stats = new CombatLegacyStatEngine(() => 0);
  const offense = makeUnit('player', { critRate: 0, lethality: 20, defPen: 0.25 });
  const zeroDefense = stats.resolveHit(offense, makeUnit('enemy', { defense: 0 }), {
    offenseStat: 'attack', critMode: 'never', unavoidable: true
  });
  assert(zeroDefense.mitigation === 0, 'DEF 0 must produce mitigation 0');
  const cappedDefense = stats.resolveHit(offense, makeUnit('enemy', { defense: 1_000_000 }), {
    offenseStat: 'attack', critMode: 'never', unavoidable: true
  });
  assert(cappedDefense.mitigation <= 0.7, 'DEF mitigation must never exceed 70%');
  const orderedPen = stats.resolveHit(offense, makeUnit('enemy', { defense: 100 }), {
    offenseStat: 'attack', critMode: 'never', unavoidable: true
  });
  assert(orderedPen.defenseAfterLethality === 80 && orderedPen.effectiveDefense === 60, 'Lethality must apply before Armor Pen');
  const nonNegativeDefense = stats.resolveHit(makeUnit('player', { lethality: 500 }), makeUnit('enemy', { defense: 100 }), {
    offenseStat: 'attack', critMode: 'never', unavoidable: true
  });
  assert(nonNegativeDefense.defenseAfterLethality === 0 && nonNegativeDefense.effectiveDefense === 0, 'Lethality must not create negative DEF');
  const drAfterPen = stats.resolveHit(makeUnit('player', { defPen: 0.6 }), makeUnit('enemy', { damageReduction: 0.4 }), {
    offenseStat: 'attack', critMode: 'never', unavoidable: true, ultimate: true
  });
  assert(approx(drAfterPen.damageReduction, 0.4), 'penetration must not bypass Damage Reduction');

  const normalActor = makeUnit('player', { critRate: 0 });
  const normalFrozenTarget = makeUnit('enemy');
  normalFrozenTarget.controlStatus = 'freeze';
  normalFrozenTarget.controlActionsRemaining = 1;
  const normalFrozen = new SkillActionResolver(() => 0).resolve(normalActor, normalFrozenTarget, {
    name: 'Normal Frozen Hit', power: 100, type: 'physical', damageType: 'physical'
  }, 0);
  assert(!normalFrozen.freezeShattered && normalFrozenTarget.controlStatus === 'freeze', 'normal hit must not break Freeze');

  const shatterActor = makeUnit('player', { critRate: 0 });
  const shatterTarget = makeUnit('enemy');
  shatterTarget.controlStatus = 'freeze';
  shatterTarget.controlActionsRemaining = 1;
  shatterTarget.controlHistory = [{ status: 'freeze', round: 1, sourceKey: 'freeze-source' }];
  const scheduledInitiative = shatterTarget.initialInitiative;
  const shatter = new SkillActionResolver(() => 0).resolve(shatterActor, shatterTarget, {
    name: 'Explicit Shatter', power: 100, type: 'physical', damageType: 'physical',
    shatterFrozen: true, status: 'freeze'
  }, 0, 2);
  assert(shatter.freezeShattered && shatterTarget.controlStatus === null, 'explicit Shatter must break Freeze');
  assert(shatter.damage === Math.round(normalFrozen.damage * 1.3), 'explicit Shatter must add 30% total damage');
  assert(shatterTarget.freezeStage === 0, 'Shatter hit must not reapply Chill');
  assert(shatterTarget.controlHistory.length === 1, 'Shatter must retain the successful Freeze CC history');
  assert(shatterTarget.initialInitiative === scheduledInitiative && !shatterTarget.actionLocked, 'Shatter must not remove the scheduled turn');

  assert(strongestGrievousTier(GRIEVOUS_40, GRIEVOUS_40) === GRIEVOUS_40, '40 + 40 must remain 40');
  assert(strongestGrievousTier(GRIEVOUS_40, GRIEVOUS_60) === GRIEVOUS_60, '40 + 60 must resolve to 60');
  assert(strongestGrievousTier(GRIEVOUS_60, GRIEVOUS_60) === GRIEVOUS_60, '60 + 60 must remain 60');
  assert(applyGrievousSequence([GRIEVOUS_40, GRIEVOUS_40]).grievousTier === GRIEVOUS_40, 'runtime 40 + 40 mismatch');
  assert(applyGrievousSequence([GRIEVOUS_40, GRIEVOUS_60]).grievousTier === GRIEVOUS_60, 'runtime 40 + 60 mismatch');
  assert(applyGrievousSequence([GRIEVOUS_60, GRIEVOUS_60]).grievousTier === GRIEVOUS_60, 'runtime 60 + 60 mismatch');
  assert(effectiveHealingReduction(GRIEVOUS_60, [0.4, 0.4]) === 0.6, 'Grievous sources must not add to 100%');

  const healActor = makeUnit('player');
  const healTarget = makeUnit('player', { id: 'heal-target' });
  healTarget.hp = 500;
  healTarget.grievousTier = GRIEVOUS_60;
  healTarget.antiHeal = 0.6;
  const healed = new SkillActionResolver(() => 0).resolve(healActor, healTarget, {
    name: 'Canonical Heal', power: 1, type: 'support', status: 'regeneration', target: 'ally'
  }, 0).healed;
  assert(healed > 0, 'Grievous canonical tiers must never reduce healing by 100%');

  return {
    checks: [
      'basic-ad-natural-crit', 'ad-default-200', 'ap-no-natural-crit', 'magic-crit-permission',
      'magic-crit-160', 'magic-crit-180', 'magic-crit-200', 'magic-crit-cap-200',
      'legendary-ad-cap-250', 'mythic-ad-280', 'mythic-ad-cap-280',
      'def-zero', 'def-cap-70', 'lethality-before-armor-pen', 'non-negative-defense',
      'penetration-preserves-dr', 'normal-hit-preserves-freeze', 'explicit-shatter',
      'shatter-total-damage-130', 'shatter-no-chill', 'grievous-40-40',
      'grievous-40-60', 'grievous-60-60', 'grievous-never-100'
    ],
    critChecked: true,
    defenseChecked: true,
    shatterChecked: true,
    grievousChecked: true
  };
}
