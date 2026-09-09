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

async function loadRuntime(catalogWindow) {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'powder-combat2-roster-smoke-'));
  const compilerPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));
  const sourcePaths = [
    'src/game/combat2/data/PowderDataAdapter.ts',
    'src/game/combat2/systems/CombatState.ts',
    'src/game/combat2/systems/BasicAttackResolver.ts',
    'src/game/combat2/systems/SkillActionResolver.ts',
    'src/game/combat2/systems/CombatAbilityTargeting.ts',
    'js/combat-rage-model.js'
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
    const combatDirectory = join(outputDirectory, 'src', 'game', 'combat2');
    const previousWindow = globalThis.window;
    globalThis.window = catalogWindow;
    try {
      return {
        ...require(join(combatDirectory, 'data', 'PowderDataAdapter.js')),
        ...require(join(combatDirectory, 'systems', 'CombatState.js')),
        ...require(join(combatDirectory, 'systems', 'BasicAttackResolver.js')),
        ...require(join(combatDirectory, 'systems', 'SkillActionResolver.js')),
        ...require(join(combatDirectory, 'systems', 'CombatAbilityTargeting.js'))
      };
    } finally {
      globalThis.window = previousWindow;
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

function assertFiniteState(state, label) {
  const fields = [
    'hp', 'shield', 'speed', 'ragePoints', 'initialInitiative',
    'burnDamage', 'poisonStacks', 'dotDamage', 'antiHeal'
  ];
  for (const unit of state.units) {
    for (const field of fields) {
      assert.ok(Number.isFinite(Number(unit[field])), `${label}: ${unit.pow.id}.${field} is not finite`);
    }
    assert.ok(unit.hp >= 0 && unit.hp <= unit.pow.maxHp, `${label}: ${unit.pow.id} HP escaped bounds`);
    assert.ok(unit.ragePoints >= 0 && unit.ragePoints <= 8, `${label}: ${unit.pow.id} Rage escaped bounds`);
  }
}

function actionTarget(runtime, state, actor, ability) {
  const mode = runtime.abilityTargetMode(ability);
  if (mode === 'self') return actor;
  if (mode === 'ally') return state.activeLiving(actor.side).find((unit) => unit.instanceId !== actor.instanceId) ?? actor;
  if (mode === 'deadAlly') {
    const ally = state.activeLiving(actor.side).find((unit) => unit.instanceId !== actor.instanceId);
    assert.ok(ally, `${actor.pow.id}: dead-ally skill needs a fixture ally`);
    ally.hp = 0;
    ally.alive = false;
    ally.fieldSlot = null;
    return ally;
  }
  return state.activeLiving(actor.side === 'player' ? 'enemy' : 'player')[0];
}

function exercisePow(runtime, pow, allyPow, enemyPow, enemyAllyPow) {
  const makeState = () => new runtime.CombatState([pow, allyPow], [enemyPow, enemyAllyPow]);
  {
    const state = makeState();
    const actor = state.activeLiving('player')[0];
    const target = state.activeLiving('enemy')[0];
    const result = new runtime.BasicAttackResolver(() => 0.99).resolve(actor, target);
    assert.ok(Number.isFinite(result.damage), `${pow.id}: Basic returned non-finite damage`);
    assertFiniteState(state, `${pow.id}.basic`);
  }
  for (const [slot, ability] of pow.abilities.skills.entries()) {
    const state = makeState();
    const actor = state.activeLiving('player')[0];
    const target = actionTarget(runtime, state, actor, ability);
    const result = new runtime.SkillActionResolver(() => 0.99).resolve(actor, target, ability, slot);
    assert.ok(Number.isFinite(result.damage) && Number.isFinite(result.healed), `${pow.id}.skill${slot + 1}: invalid result`);
    assertFiniteState(state, `${pow.id}.skill${slot + 1}`);
  }
  {
    const state = makeState();
    const actor = state.activeLiving('player')[0];
    actor.ragePoints = 4;
    const ability = pow.abilities.ultimate;
    const target = actionTarget(runtime, state, actor, ability);
    const result = new runtime.SkillActionResolver(() => 0.99).resolveUltimate(actor, target, ability);
    assert.equal(result.rageSpent, 4, `${pow.id}: Ultimate did not consume canonical Rage`);
    assertFiniteState(state, `${pow.id}.ultimate`);
  }
}

function runDuel(runtime, playerPow, enemyPow) {
  const state = new runtime.CombatState([playerPow], [enemyPow]);
  const resolver = new runtime.BasicAttackResolver(() => 0.01);
  let actions = 0;
  while (state.activeLiving('player').length && state.activeLiving('enemy').length && actions < 400) {
    const side = actions % 2 === 0 ? 'player' : 'enemy';
    const actor = state.activeLiving(side)[0];
    const target = state.activeLiving(side === 'player' ? 'enemy' : 'player')[0];
    if (actor && target) resolver.resolve(actor, target);
    assertFiniteState(state, `duel:${playerPow.id}:${enemyPow.id}:${actions}`);
    actions += 1;
  }
  assert.ok(actions < 400, `${playerPow.id} vs ${enemyPow.id}: deadlock guard reached`);
  assert.ok(!state.activeLiving('player').length || !state.activeLiving('enemy').length,
    `${playerPow.id} vs ${enemyPow.id}: duel did not settle`);
  return actions;
}

async function main() {
  const canonical = await loadPowderCanonicalRuntime(root);
  const runtime = await loadRuntime(canonical.window);
  const sourcePows = canonical.runtimeData.pows;
  const previousWindow = globalThis.window;
  globalThis.window = canonical.window;
  try {
    const pows = sourcePows.map((pow) => runtime.combatPowById(pow.id));
    assert.ok(pows.every(Boolean), 'Every canonical Pow must resolve before smoke testing');
    for (let index = 0; index < pows.length; index += 1) {
      exercisePow(
        runtime,
        pows[index],
        pows[(index + 1) % pows.length],
        pows[(index + 17) % pows.length],
        pows[(index + 18) % pows.length]
      );
    }

    const roleSamples = new Map();
    const raritySamples = new Map();
    const elementSamples = new Map();
    sourcePows.forEach((pow) => {
      if (!roleSamples.has(pow.combatRole)) roleSamples.set(pow.combatRole, pow.id);
      if (!raritySamples.has(pow.rarity)) raritySamples.set(pow.rarity, pow.id);
      if (!elementSamples.has(pow.element)) elementSamples.set(pow.element, pow.id);
    });
    const sampleIds = [...new Set([...roleSamples.values(), ...raritySamples.values(), ...elementSamples.values()])];
    let duelActions = 0;
    sampleIds.forEach((id, index) => {
      const player = runtime.combatPowById(id);
      const enemy = runtime.combatPowById(sampleIds[(index + 5) % sampleIds.length]);
      assert.ok(player && enemy, `${id}: smoke sample failed to resolve`);
      duelActions += runDuel(runtime, player, enemy);
    });

    console.log(JSON.stringify({
      status: 'PASS',
      powActions: pows.length * 4,
      canonicalPowCount: pows.length,
      roleCount: roleSamples.size,
      rarityCount: raritySamples.size,
      elementCount: elementSamples.size,
      duelCount: sampleIds.length,
      duelActions,
      canonicalMechanicsVerified: false,
      note: 'Generic runtime smoke only; canonical mechanic blockers remain owned by the sync verifier.'
    }));
  } finally {
    globalThis.window = previousWindow;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
