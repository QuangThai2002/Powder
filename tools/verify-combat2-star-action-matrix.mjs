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
const slots = ['basic', 'skill1', 'skill2', 'ultimate'];

async function loadRuntime(catalogWindow) {
  const output = await mkdtemp(join(tmpdir(), 'powder-combat2-star-matrix-'));
  const compiler = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));
  const sources = [
    'src/game/combat2/data/PowderDataAdapter.ts',
    'src/game/combat2/systems/CombatState.ts',
    'src/game/combat2/systems/BasicAttackResolver.ts',
    'src/game/combat2/systems/SkillActionResolver.ts',
    'src/game/combat2/systems/CombatAbilityTargeting.ts',
    'js/combat-rage-model.js'
  ].map((path) => fileURLToPath(new URL(path, root)));
  try {
    execFileSync(process.execPath, [compiler, '--ignoreConfig', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--allowJs', '--rootDir', rootPath, '--outDir', output, ...sources], { stdio: 'pipe' });
    const require = createRequire(join(output, 'loader.cjs'));
    const base = join(output, 'src', 'game', 'combat2');
    const previous = globalThis.window;
    globalThis.window = catalogWindow;
    try {
      return {
        ...require(join(base, 'data', 'PowderDataAdapter.js')),
        ...require(join(base, 'systems', 'CombatState.js')),
        ...require(join(base, 'systems', 'BasicAttackResolver.js')),
        ...require(join(base, 'systems', 'SkillActionResolver.js')),
        ...require(join(base, 'systems', 'CombatAbilityTargeting.js'))
      };
    } finally { globalThis.window = previous; }
  } finally { await rm(output, { recursive: true, force: true }); }
}

function sourceSlots(pow) {
  return [pow.abilities?.basic, pow.abilities?.skills?.[0], pow.abilities?.skills?.[1], pow.abilities?.ultimate];
}

function runtimeSlots(pow) {
  return [pow.abilities.basic, pow.abilities.skills[0], pow.abilities.skills[1], pow.abilities.ultimate];
}

function targetFor(runtime, state, actor, ability) {
  const mode = runtime.abilityTargetMode(ability);
  if (mode === 'self') return actor;
  if (mode === 'ally') return state.activeLiving(actor.side).find((unit) => unit.instanceId !== actor.instanceId) ?? actor;
  if (mode === 'deadAlly') {
    const ally = state.activeLiving(actor.side).find((unit) => unit.instanceId !== actor.instanceId);
    assert.ok(ally, `${actor.pow.id}: dead ally target has no fixture`);
    ally.hp = 0; ally.alive = false; ally.fieldSlot = null;
    return ally;
  }
  return state.activeLiving(actor.side === 'player' ? 'enemy' : 'player')[0];
}

function verifyAbilityMapping(powId, star, source, mapped, slot) {
  assert.ok(mapped?.id && mapped.name, `${powId}@${star}.${slot}: missing identity`);
  assert.equal(mapped.id, source.id, `${powId}@${star}.${slot}: id mismatch`);
  assert.equal(mapped.name, source.name, `${powId}@${star}.${slot}: name mismatch`);
  assert.equal(mapped.description, source.v81Description || source.description, `${powId}@${star}.${slot}: description mismatch`);
  assert.equal(mapped.target, source.target, `${powId}@${star}.${slot}: target mismatch`);
  assert.equal(mapped.manaCost, source.manaCost, `${powId}@${star}.${slot}: mana cost mismatch`);
  assert.equal(mapped.cooldown, source.cooldown, `${powId}@${star}.${slot}: cooldown mismatch`);
  assert.equal(mapped.rageCost, source.rageCost, `${powId}@${star}.${slot}: rage cost mismatch`);
  if (Number.isFinite(source.power)) assert.equal(mapped.power, source.power, `${powId}@${star}.${slot}: power mismatch`);
  assert.ok(Number.isFinite(mapped.power) && mapped.power >= 0, `${powId}@${star}.${slot}: invalid power`);
  if (mapped.hits !== undefined) assert.ok(Number.isInteger(mapped.hits) && mapped.hits > 0, `${powId}@${star}.${slot}: invalid hit count`);
  if (mapped.critMode !== undefined) assert.ok(['natural-ad', 'magic', 'never'].includes(mapped.critMode), `${powId}@${star}.${slot}: invalid Crit mode`);
}

function executeAction(runtime, pow, ally, enemy, enemyAlly, slotIndex) {
  const state = new runtime.CombatState([pow, ally], [enemy, enemyAlly]);
  const actor = state.activeLiving('player')[0];
  const ability = runtimeSlots(pow)[slotIndex];
  const target = targetFor(runtime, state, actor, ability);
  const resolver = slotIndex === 0 ? new runtime.BasicAttackResolver(() => 0.99) : new runtime.SkillActionResolver(() => 0.99);
  const result = slotIndex === 0
    ? resolver.resolve(actor, target)
    : slotIndex === 3
      ? (actor.ragePoints = 4, resolver.resolveUltimate(actor, target, ability))
      : resolver.resolve(actor, target, ability, slotIndex - 1);
  assert.ok(Number.isFinite(result.damage), `${pow.id}@${pow.stars}.${slots[slotIndex]}: non-finite damage`);
  assert.ok(state.units.every((unit) => Number.isFinite(unit.hp) && Number.isFinite(unit.ragePoints)), `${pow.id}@${pow.stars}.${slots[slotIndex]}: invalid state`);
}

async function main() {
  const canonical = await loadPowderCanonicalRuntime(root);
  const runtime = await loadRuntime(canonical.window);
  const sourcePows = canonical.runtimeData.pows;
  const previous = globalThis.window;
  globalThis.window = canonical.window;
  try {
    let stageCount = 0;
    let actionCount = 0;
    for (let index = 0; index < sourcePows.length; index += 1) {
      const sourcePow = sourcePows[index];
      const start = Math.max(0, Math.floor(Number(sourcePow.startStars) || 0));
      const max = Math.max(start, Math.floor(Number(sourcePow.maxStars) || start));
      for (let star = start; star <= max; star += 1) {
        const pow = runtime.combatPowById(sourcePow.id, star);
        const ally = runtime.combatPowById(sourcePows[(index + 1) % sourcePows.length].id);
        const enemy = runtime.combatPowById(sourcePows[(index + 17) % sourcePows.length].id);
        const enemyAlly = runtime.combatPowById(sourcePows[(index + 18) % sourcePows.length].id);
        assert.ok(pow && ally && enemy && enemyAlly, `${sourcePow.id}@${star}: failed to resolve fixtures`);
        assert.equal(pow.stars, star, `${sourcePow.id}@${star}: star stage mismatch`);
        const expectedSlots = sourceSlots(sourcePow).map((ability) => canonical.window.POWDER_FORM_RESOLVER?.resolveAbility?.(sourcePow, ability, star) ?? ability);
        runtimeSlots(pow).forEach((ability, slotIndex) => {
          verifyAbilityMapping(sourcePow.id, star, expectedSlots[slotIndex], ability, slots[slotIndex]);
          executeAction(runtime, pow, ally, enemy, enemyAlly, slotIndex);
          actionCount += 1;
        });
        stageCount += 1;
      }
    }
    console.log(JSON.stringify({
      status: 'PASS',
      powCount: sourcePows.length,
      stageCount,
      actionCount,
      scope: 'structural/runtime execution at every valid star stage',
      canonicalStarEffectsVerified: false,
      note: 'Non-starter V8.1 prose-only star effect upgrades remain verifier-owned engine-support blockers.'
    }));
  } finally { globalThis.window = previous; }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

