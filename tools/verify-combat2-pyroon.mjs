import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPowderCanonicalRuntime } from './lib/load-powder-canonical-runtime.mjs';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const compilerPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));

async function loadCombatRuntime(catalogWindow) {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'powder-combat2-pyroon-'));
  const sourcePaths = [
    'src/game/combat2/data/PowderDataAdapter.ts',
    'src/game/combat2/systems/CombatState.ts',
    'src/game/combat2/systems/CombatIdentityRules.ts',
    'src/game/combat2/systems/CombatControlEngine.ts',
    'src/game/combat2/systems/CombatHealingReduction.ts',
    'src/game/combat2/systems/CombatLegacyStatEngine.ts',
    'src/game/combat2/systems/CombatPassiveEngine.ts',
    'src/game/combat2/systems/CombatRageEngine.ts',
    'src/game/combat2/systems/CombatPyroonEngine.ts',
    'src/game/combat2/systems/BasicAttackResolver.ts',
    'src/game/combat2/systems/SkillActionResolver.ts'
  ].map((path) => fileURLToPath(new URL(path, root)));

  try {
    execFileSync(process.execPath, [
      compilerPath,
      '--ignoreConfig',
      '--target', 'ES2022',
      '--module', 'commonjs',
      '--skipLibCheck',
      '--allowJs',
      '--rootDir', rootPath,
      '--outDir', outputDirectory,
      ...sourcePaths
    ], { stdio: 'pipe' });

    const require = createRequire(join(outputDirectory, 'loader.cjs'));
    const previousWindow = globalThis.window;
    globalThis.window = catalogWindow;
    try {
      const combatRoot = join(outputDirectory, 'src', 'game', 'combat2');
      return {
        ...require(join(combatRoot, 'data', 'PowderDataAdapter.js')),
        ...require(join(combatRoot, 'systems', 'CombatState.js')),
        ...require(join(combatRoot, 'systems', 'BasicAttackResolver.js')),
        ...require(join(combatRoot, 'systems', 'SkillActionResolver.js'))
      };
    } finally {
      globalThis.window = previousWindow;
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

function neutralPow(base, id, options = {}) {
  const maxHp = options.maxHp ?? 100000;
  return {
    ...base,
    id,
    name: id,
    element: 'Neutral',
    elementKey: 'neutral',
    role: 'neutral',
    attack: options.attack ?? base.attack,
    abilityPower: options.abilityPower ?? base.abilityPower,
    defense: options.defense ?? 0,
    speed: options.speed ?? 50,
    hp: options.hp ?? maxHp,
    maxHp,
    critRate: options.critRate ?? 0,
    critDamage: options.critDamage ?? 200,
    damageReduction: options.damageReduction ?? 0,
    evasion: options.evasion ?? 0,
    critResist: options.critResist ?? 0
  };
}

function assertAdapterContract(runtime) {
  const pyroon = runtime.combatPowById('pyroon');
  assert.ok(pyroon, 'Pyroon must resolve through PowderDataAdapter');
  assert.deepEqual(
    [pyroon.abilities.basic, pyroon.abilities.skills[0], pyroon.abilities.skills[1], pyroon.abilities.ultimate]
      .map((ability) => [ability.id, ability.name]),
    [
      ['pyroon.basic', 'Hỏa Tiễn Thăm Dò'],
      ['pyroon.skill1', 'Xuyên Tâm Hỏa Tuyến'],
      ['pyroon.skill2', 'Mồi Lửa Tập Kích'],
      ['pyroon.ultimate', 'Vũ Điệu Bảy Tia']
    ],
    'Pyroon ability mapping must be canonical'
  );
  assert.equal(pyroon.abilities.basic.power, 82);
  assert.equal(pyroon.abilities.skills[0].power, 118);
  assert.equal(pyroon.abilities.skills[0].manaCost, 22);
  assert.equal(pyroon.abilities.skills[1].manaCost, 30);
  assert.equal(pyroon.abilities.ultimate.power, 48);
  assert.equal(pyroon.abilities.ultimate.hits, 5);
  assert.equal(pyroon.abilities.ultimate.rageCost, 4);
  assert.deepEqual(pyroon.abilities.skills[1].coefficients, {});
  assert.equal(pyroon.abilities.skills[1].pyroonMechanic.kind, 'fire-bait');
  assert.equal(pyroon.abilities.ultimate.pyroonMechanic.kind, 'seven-rays');
  return pyroon;
}

async function main() {
  const canonical = await loadPowderCanonicalRuntime(root);
  const runtime = await loadCombatRuntime(canonical.window);
  const previousWindow = globalThis.window;
  globalThis.window = canonical.window;
  try {
    const pyroon = assertAdapterContract(runtime);
    const allyTemplate = runtime.combatPowById('terrapup');
    assert.ok(allyTemplate, 'A non-Pyroon ally fixture must resolve through the adapter');

  {
    const actorPow = neutralPow(pyroon, 'pyroon-basic-test', { attack: 58 });
    const targetPow = neutralPow(pyroon, 'basic-target');
    const state = new runtime.CombatState([actorPow], [targetPow]);
    const actor = state.activeLiving('player')[0];
    const target = state.activeLiving('enemy')[0];
    const resolver = new runtime.BasicAttackResolver(() => 0.99);
    const first = resolver.resolve(actor, target, {}, 1, {}, state.units);
    const second = resolver.resolve(actor, target, {}, 1, {}, state.units);
    assert.equal(first.damage, 48, 'Pyroon Basic must use the canonical 82% ATK coefficient');
    assert.equal(second.focusAfter, 1, 'same-target Basic must create one Focus');
    assert.equal(second.focusGained, 1);
  }

  {
    const actorPow = neutralPow(pyroon, 'pyroon-skill1-test', { attack: 58 });
    const targetPow = neutralPow(pyroon, 'skill1-target');
    const state = new runtime.CombatState([actorPow], [targetPow]);
    const actor = state.activeLiving('player')[0];
    const target = state.activeLiving('enemy')[0];
    actor.coreState.counters['pyroon:focus'] = 1;
    const result = new runtime.SkillActionResolver(() => 0.99).resolve(
      actor, target, actor.pow.abilities.skills[0], 0, 1, {}, {}, state.units
    );
    assert.equal(result.damage, 78, 'S1 must apply 118% ATK plus 14% for one Focus');
    assert.equal(result.manaSpent, 22);
    assert.equal(result.manaAfter, 78);
    assert.equal(result.focusSpent, 1);
    assert.equal(result.focusAfter, 0);
  }

  {
    const actorPow = neutralPow(pyroon, 'pyroon-skill1-crit-test', { attack: 58 });
    const targetPow = neutralPow(pyroon, 'skill1-crit-target');
    const state = new runtime.CombatState([actorPow], [targetPow]);
    const actor = state.activeLiving('player')[0];
    const target = state.activeLiving('enemy')[0];
    actor.coreState.counters['pyroon:focus'] = 3;
    const result = new runtime.SkillActionResolver(() => 0.99).resolve(
      actor, target, actor.pow.abilities.skills[0], 0, 1, {}, {}, state.units
    );
    assert.equal(result.crit, true, 'three Focus must force S1 Crit');
    assert.equal(result.focusAfter, 0);
  }

  {
    const actorPow = neutralPow(pyroon, 'pyroon-fire-bait-source', { attack: 58 });
    const allyPow = neutralPow(allyTemplate, 'pyroon-fire-bait-ally', { attack: 50 });
    const targetPow = neutralPow(pyroon, 'fire-bait-target');
    const state = new runtime.CombatState([actorPow, allyPow], [targetPow]);
    const actor = state.activeLiving('player')[0];
    const ally = state.activeLiving('player')[1];
    const target = state.activeLiving('enemy')[0];
    const skillResolver = new runtime.SkillActionResolver(() => 0.99);
    const markResult = skillResolver.resolve(
      actor, target, actor.pow.abilities.skills[1], 1, 1, {}, {}, state.units
    );
    assert.equal(markResult.damage, 0, 'Mồi Lửa is a mark-only action');
    assert.equal(skillResolver.currentMana(actor), 70);
    assert.equal(Object.values(target.coreState.marks).length, 1);

    const allyResolver = new runtime.BasicAttackResolver(() => 0.99);
    const firstProc = allyResolver.resolve(ally, target, {}, 1, {}, state.units);
    const secondProc = allyResolver.resolve(ally, target, {}, 1, {}, state.units);
    assert.equal(firstProc.mechanicEvents.length, 1);
    assert.equal(secondProc.mechanicEvents.length, 1);
    assert.ok(target.burnActionsRemaining > 0, 'Mồi Lửa must apply Burn on direct ally hits');
    assert.equal(actor.coreState.counters['pyroon:focus'], 1, 'second Mồi Lửa proc must grant one Focus');
    assert.equal(Object.values(target.coreState.marks).length, 0, 'Mồi Lửa must end after two triggers');
  }

  {
    const actorPow = neutralPow(pyroon, 'pyroon-ultimate-test', { attack: 58 });
    const firstTargetPow = neutralPow(pyroon, 'ultimate-first-target', { hp: 30, maxHp: 30 });
    const secondTargetPow = neutralPow(pyroon, 'ultimate-second-target', { hp: 100, maxHp: 100 });
    const state = new runtime.CombatState([actorPow], [firstTargetPow, secondTargetPow], {
      initialRageByPowId: { 'pyroon-ultimate-test': 4 }
    });
    const actor = state.activeLiving('player')[0];
    const firstTarget = state.activeLiving('enemy')[0];
    actor.coreState.counters['pyroon:focus'] = 3;
    const result = new runtime.SkillActionResolver(() => 0.99).resolveUltimate(
      actor, firstTarget, actor.pow.abilities.ultimate, 1, {}, {}, state.units
    );
    assert.equal(result.rageSpent, 4);
    assert.equal(result.rageAfter, 0);
    assert.equal(result.manaSpent, 32);
    assert.equal(result.hitResults.length, 5, 'Vũ Điệu Bảy Tia must resolve five real hits');
    assert.deepEqual(result.hitResults.slice(0, 2).map((hit) => hit.targetId), [
      'enemy-0-ultimate-first-target',
      'enemy-0-ultimate-first-target'
    ]);
    assert.equal(result.hitResults[2].targetId, 'enemy-1-ultimate-second-target', 'dead primary must retarget lowest HP enemy');
    assert.equal(result.hitResults[4].crit, true, 'three Focus must guarantee the final ray Crit');
    assert.equal(actor.coreState.counters['pyroon:focus'], 3, 'Ultimate does not silently consume Focus');
  }

    console.log(JSON.stringify({
      status: 'PASS',
      pyroon: {
        basic: '82% ATK + Focus lifecycle',
        skill1: '118% ATK, Mana 22, Focus consumption and guaranteed Crit',
        skill2: 'Mana 30, two direct ally procs, Burn and Focus gain',
        ultimate: 'five hits, retarget, next-crit multiplier, final guaranteed Crit'
      }
    }, null, 2));
  } finally {
    globalThis.window = previousWindow;
  }
}

await main();
