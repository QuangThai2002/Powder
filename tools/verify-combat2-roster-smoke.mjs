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
    const zephyroo = runtime.combatPowById('zephyroo');
    assert.ok(zephyroo, 'Zephyroo must resolve through the Combat2 adapter');
    assert.equal(zephyroo.abilities.basic.name, 'Đánh Gió', 'Zephyroo Basic must use the approved canonical name');
    assert.equal(zephyroo.abilities.basic.power, 70, 'Zephyroo Basic must preserve the approved 70% coefficient');
    assert.equal(zephyroo.abilities.basic.scalingStat, 'ability-power', 'Zephyroo Basic must scale from AP');
    assert.equal(zephyroo.abilities.basic.damageType, 'magic', 'Zephyroo Basic must preserve magic damage identity');
    assert.equal(zephyroo.abilities.basic.critMode, 'never', 'Zephyroo Basic must not gain natural Crit');
    assert.deepEqual(zephyroo.abilities.basic.masterEffects, {}, 'Zephyroo Basic must not retain legacy turn-meter effects');

    const pyroon = runtime.combatPowById('pyroon');
    assert.ok(pyroon, 'AD Basic compatibility fixture must resolve');
    assert.equal(pyroon.abilities.basic.scalingStat, 'attack', 'Basic without AP metadata must keep ATK scaling');
    assert.equal(pyroon.abilities.basic.damageType, 'physical', 'Basic without magic metadata must keep physical damage');

    const bramblet = runtime.combatPowById('bramblet');
    assert.ok(bramblet, 'Bramblet must resolve through the Combat2 adapter');
    assert.equal(bramblet.passive?.id, 'bramblet_khai_mach', 'Bramblet must not retain the legacy combo passive ID');
    assert.equal(bramblet.passive?.name, 'Khai Mạch', 'Bramblet must use the approved canonical Passive name');
    assert.equal(bramblet.passive?.mechanic?.trigger, 'ON_BATTLE_START', 'Khai Mạch must initialize at battle start');
    assert.equal(bramblet.passive?.mechanic?.effect?.kind, 'brambletKhaiMach', 'Khai Mạch must expose its dedicated Passive mechanic');
    assert.notEqual(bramblet.passive?.id, 'combo_bonus_damage', 'legacy Bramblet Passive must not leak through the adapter');

    const voltkit = runtime.combatPowById('voltkit');
    assert.ok(voltkit, 'Voltkit must resolve through the Combat2 adapter');
    assert.equal(voltkit.abilities.ultimate.name, 'Lôi Kích', 'Voltkit Ultimate must use the approved canonical name');
    assert.equal(voltkit.abilities.ultimate.power, 200, 'Voltkit Ultimate must preserve 200% AP');
    assert.equal(voltkit.abilities.ultimate.scalingStat, 'ability-power', 'Voltkit Ultimate must scale from AP');
    assert.equal(voltkit.abilities.ultimate.rageCost, 4, 'Voltkit Ultimate metadata must use canonical Rage cost 4');
    assert.equal(voltkit.abilities.ultimate.target, 'enemy', 'Voltkit Ultimate must target one enemy');
    assert.equal(voltkit.abilities.ultimate.area, undefined, 'Voltkit Ultimate must not retain legacy AOE targeting');
    assert.equal(voltkit.abilities.ultimate.status, undefined, 'Voltkit Ultimate must not retain legacy Slow status');
    assert.equal(voltkit.abilities.ultimate.statusChance, undefined, 'Voltkit Ultimate must not retain legacy status chance');
    assert.equal(voltkit.abilities.ultimate.statusDuration, undefined, 'Voltkit Ultimate must not retain legacy status duration');
    assert.ok(!voltkit.abilities.ultimate.masterEffects?.debuffs, 'Voltkit Ultimate must not retain legacy speed debuffs');
    assert.deepEqual(voltkit.abilities.ultimate.conditionalDamageModifier, {
      condition: { targetStatus: 'paralysis' },
      multiplier: 1.35,
      consumeStatus: false,
      removeStatus: false,
      reduceStatusDuration: false
    }, 'Voltkit Ultimate conditional damage metadata mismatch');

    const resolveVoltkitUltimate = (paralysisActionsRemaining) => {
      const actorPow = {
        ...voltkit,
        element: 'Neutral', elementKey: 'neutral', role: 'neutral', abilityPower: 100, critRate: 100
      };
      const targetPow = {
        ...pyroon,
        id: `voltkit-target-${paralysisActionsRemaining}`,
        element: 'Neutral', elementKey: 'neutral', role: 'neutral', hp: 1000, maxHp: 1000,
        defense: 0, damageReduction: 0, evasion: 0, critResist: 0
      };
      const state = new runtime.CombatState([actorPow], [targetPow]);
      const actor = state.activeLiving('player')[0];
      const target = state.activeLiving('enemy')[0];
      actor.ragePoints = 4;
      target.paralysisActionsRemaining = paralysisActionsRemaining;
      const before = {
        speedDebuffActionsRemaining: target.speedDebuffActionsRemaining,
        controlStatus: target.controlStatus,
        controlActionsRemaining: target.controlActionsRemaining,
        paralysisActionsRemaining: target.paralysisActionsRemaining,
        controlHistory: structuredClone(target.controlHistory)
      };
      const result = new runtime.SkillActionResolver(() => 0).resolveUltimate(
        actor, target, actor.pow.abilities.ultimate
      );
      assert.equal(target.speedDebuffActionsRemaining, before.speedDebuffActionsRemaining, 'Lôi Kích must not apply legacy Slow');
      assert.equal(target.controlStatus, before.controlStatus, 'Lôi Kích must not replace control status');
      assert.equal(target.controlActionsRemaining, before.controlActionsRemaining, 'Lôi Kích must not alter control duration');
      assert.equal(target.paralysisActionsRemaining, before.paralysisActionsRemaining, 'Lôi Kích must not consume Paralysis');
      assert.deepEqual(target.controlHistory, before.controlHistory, 'Lôi Kích must not mutate control history');
      return result;
    };
    assert.equal(resolveVoltkitUltimate(0).damage, 200, 'adapter-generated Lôi Kích must deal 200% AP normally');
    assert.equal(resolveVoltkitUltimate(2).damage, 270, 'adapter-generated Lôi Kích must deal 200% AP x 1.35 to Paralysis');
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
