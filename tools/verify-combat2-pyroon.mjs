import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
    'src/game/combat2/systems/CombatPyroonPresentation.ts',
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
        ...require(join(combatRoot, 'systems', 'CombatRageEngine.js')),
        ...require(join(combatRoot, 'systems', 'CombatPyroonEngine.js')),
        ...require(join(combatRoot, 'systems', 'CombatPyroonPresentation.js')),
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

function canonicalNumber(description, pattern, label) {
  const match = String(description || '').match(pattern);
  assert.ok(match, `Canonical V8.1 must state ${label}`);
  return Number(match[1]);
}

function stateSnapshot(source, target) {
  return {
    sourceHp: source.hp,
    sourceFocus: source.coreState?.counters?.['pyroon:focus'] ?? 0,
    targetHp: target.hp,
    targetShield: target.shield,
    targetBurnDamage: target.burnDamage,
    targetBurnActions: target.burnActionsRemaining,
    targetMarks: structuredClone(target.coreState?.marks ?? {})
  };
}

function assertAdapterContract(runtime, canonicalSkills) {
  const pyroon = runtime.combatPowById('pyroon');
  assert.ok(pyroon, 'Pyroon must resolve through PowderDataAdapter');
  assert.deepEqual(
    [pyroon.abilities.basic, pyroon.abilities.skills[0], pyroon.abilities.skills[1], pyroon.abilities.ultimate]
      .map((ability) => [ability.id, ability.name]),
    [canonicalSkills.basic, canonicalSkills.skill1, canonicalSkills.skill2, canonicalSkills.ultimate]
      .map((ability) => [ability.id, ability.name]),
    'Pyroon ability identity must match the independent V8.1 skill authority'
  );

  assert.equal(pyroon.abilities.basic.power, canonicalNumber(canonicalSkills.basic.description, /Gây (\d+)% ATK/, 'Basic 82% ATK'));
  assert.equal(pyroon.abilities.skills[0].power, canonicalNumber(canonicalSkills.skill1.description, /Gây (\d+)% ATK/, 'Skill 1 118% ATK'));
  assert.equal(pyroon.abilities.skills[0].manaCost, canonicalNumber(canonicalSkills.skill1.description, /(\d+) Mana/, 'Skill 1 Mana'));
  assert.equal(pyroon.abilities.skills[1].manaCost, canonicalNumber(canonicalSkills.skill2.description, /(\d+) Mana/, 'Skill 2 Mana'));
  assert.equal(pyroon.abilities.ultimate.power, canonicalNumber(canonicalSkills.ultimate.description, /mỗi phát (\d+)% ATK/, 'Ultimate ray coefficient'));
  assert.equal(pyroon.abilities.ultimate.hits, canonicalNumber(canonicalSkills.ultimate.description, /Bắn (\d+) phát/, 'Ultimate hit count'));
  assert.equal(pyroon.abilities.ultimate.rageCost, runtime.ULTIMATE_RAGE_COST);
  assert.equal(runtime.ULTIMATE_RAGE_COST, 4, 'Internal Ultimate cost remains four Rage points');
  assert.equal(runtime.toPlayerRagePoints(runtime.ULTIMATE_RAGE_COST), canonicalNumber(canonicalSkills.ultimate.description, /(\d+) Nộ/, 'player Rage cost'));
  assert.equal(runtime.formatPlayerRageCost(runtime.ULTIMATE_RAGE_COST), '100 Nộ');
  assert.equal(pyroon.abilities.ultimate.description, canonicalSkills.ultimate.description, 'Player prose must come from V8.1 instead of duplicated adapter text');
  assert.deepEqual(pyroon.abilities.skills[1].coefficients, {});
  assert.equal(pyroon.abilities.skills[1].pyroonMechanic.kind, 'fire-bait');
  assert.equal(pyroon.abilities.ultimate.pyroonMechanic.kind, 'seven-rays');
  return pyroon;
}

function assertBasic(runtime, pyroon) {
  const critState = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-basic-crit', { attack: 58, critRate: 100 })],
    [neutralPow(pyroon, 'basic-crit-target')]
  );
  const critActor = critState.activeLiving('player')[0];
  const critTarget = critState.activeLiving('enemy')[0];
  const crit = new runtime.BasicAttackResolver(() => 0.99).resolve(
    critActor, critTarget, {}, 1, {}, critState.units
  );
  assert.equal(crit.crit, true, 'Basic natural Crit must occur at 100% Crit Rate');
  assert.equal(crit.focusGained, 1, 'Basic Crit grants one Focus without a same-target bonus');
  assert.equal(crit.focusAfter, 1);

  const state = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-basic-chain', { attack: 58 })],
    [neutralPow(pyroon, 'basic-target-a'), neutralPow(pyroon, 'basic-target-b')]
  );
  const actor = state.activeLiving('player')[0];
  const [targetA, targetB] = state.activeLiving('enemy');
  const resolver = new runtime.BasicAttackResolver(() => 0.99);
  const first = resolver.resolve(actor, targetA, {}, 1, {}, state.units);
  const second = resolver.resolve(actor, targetA, {}, 1, {}, state.units);
  const switched = resolver.resolve(actor, targetB, {}, 1, {}, state.units);
  assert.equal(first.damage, 48, 'Basic uses the canonical 82% ATK coefficient');
  assert.equal(first.focusAfter, 0, 'First non-Crit hit does not gain same-target Focus');
  assert.equal(second.focusGained, 1, 'Second consecutive hit on the same target grants Focus');
  assert.equal(second.focusAfter, 1);
  assert.equal(switched.focusAfter, 0, 'Changing target resets accumulated Focus');
}

function assertSkillOne(runtime, pyroon) {
  const blockedState = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-skill1-blocked', { attack: 58 })],
    [neutralPow(pyroon, 'skill1-blocked-target')]
  );
  const blockedActor = blockedState.activeLiving('player')[0];
  const blockedTarget = blockedState.activeLiving('enemy')[0];
  const blockedResolver = new runtime.SkillActionResolver(() => 0.99);
  assert.equal(blockedResolver.canUse(blockedActor, 0), false, 'Skill 1 is unavailable at zero Focus');
  assert.throws(
    () => blockedResolver.resolve(blockedActor, blockedTarget, blockedActor.pow.abilities.skills[0], 0, 1, {}, {}, blockedState.units),
    /cannot use/,
    'Skill 1 execution must be rejected at zero Focus'
  );

  const state = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-skill1', { attack: 58 })],
    [neutralPow(pyroon, 'skill1-target')]
  );
  const actor = state.activeLiving('player')[0];
  const target = state.activeLiving('enemy')[0];
  actor.coreState.counters['pyroon:focus'] = 1;
  const resolver = new runtime.SkillActionResolver(() => 0.99);
  const result = resolver.resolve(actor, target, actor.pow.abilities.skills[0], 0, 1, {}, {}, state.units);
  assert.equal(result.damage, 78, 'Skill 1 applies 118% ATK and +14% total damage for one Focus');
  assert.equal(result.manaSpent, 22);
  assert.equal(result.manaAfter, 78);
  assert.equal(result.focusSpent, 1);
  assert.equal(result.focusAfter, 0);
  assert.equal(result.cooldownApplied, 2);
  assert.equal(resolver.cooldownRemaining(actor, 0), 3, 'Internal cooldown includes the current action boundary');
  assert.equal(resolver.canUse(actor, 0), false, 'Cooldown prevents immediate Skill 1 reuse');

  const critState = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-skill1-forced-crit', { attack: 58 })],
    [neutralPow(pyroon, 'skill1-forced-crit-target')]
  );
  const critActor = critState.activeLiving('player')[0];
  const critTarget = critState.activeLiving('enemy')[0];
  critActor.coreState.counters['pyroon:focus'] = 3;
  const forced = new runtime.SkillActionResolver(() => 0.99).resolve(
    critActor, critTarget, critActor.pow.abilities.skills[0], 0, 1, {}, {}, critState.units
  );
  assert.equal(forced.crit, true, 'Three Focus guarantees Skill 1 Crit');
  assert.equal(forced.focusSpent, 3);
  assert.equal(forced.focusAfter, 0);
}

function placeFireBait(runtime, pyroon, allyTemplate, suffix) {
  const state = new runtime.CombatState(
    [
      neutralPow(pyroon, `pyroon-fire-bait-source-${suffix}`, { attack: 58 }),
      neutralPow(allyTemplate, `pyroon-fire-bait-ally-${suffix}`, { attack: 50 })
    ],
    [neutralPow(pyroon, `fire-bait-target-${suffix}`)]
  );
  const [source, ally] = state.activeLiving('player');
  const target = state.activeLiving('enemy')[0];
  const skillResolver = new runtime.SkillActionResolver(() => 0.99);
  const markResult = skillResolver.resolve(
    source, target, source.pow.abilities.skills[1], 1, 1, {}, {}, state.units
  );
  assert.equal(markResult.damage, 0, 'Mồi Lửa is a mark-only action');
  assert.equal(markResult.manaSpent, 30);
  assert.equal(markResult.manaAfter, 70);
  assert.equal(Object.values(target.coreState.marks).length, 1);
  return { state, source, ally, target };
}

function assertSkillTwo(runtime, pyroon, allyTemplate, canonicalSkill, canonicalPassive) {
  const direct = placeFireBait(runtime, pyroon, allyTemplate, 'direct');
  const resolver = new runtime.BasicAttackResolver(() => 0.99);
  const first = resolver.resolve(direct.ally, direct.target, {}, 1, {}, direct.state.units);
  const second = resolver.resolve(direct.ally, direct.target, {}, 1, {}, direct.state.units);
  const third = resolver.resolve(direct.ally, direct.target, {}, 1, {}, direct.state.units);
  assert.equal(first.mechanicEvents.length, 1, 'First direct allied hit triggers Mồi Lửa');
  assert.equal(second.mechanicEvents.length, 1, 'Second direct allied hit triggers Mồi Lửa');
  assert.equal(third.mechanicEvents.length, 0, 'Third direct hit cannot trigger an exhausted mark');
  const firstEvent = first.mechanicEvents[0];
  const secondEvent = second.mechanicEvents[0];
  const procRatio = canonicalNumber(canonicalSkill.description, /thêm (\d+)% ATK của Pyroon/, 'Mồi Lửa proc ratio') / 100;
  const passiveAttackBonus = canonicalNumber(canonicalPassive.text, /\+(\d+)% ATK/, 'Pyroon Passive ATK bonus') / 100;
  const expectedProcDamage = Math.round(procRatio * 58 * (1 + passiveAttackBonus));
  assert.equal(firstEvent.damage, expectedProcDamage, 'Proc uses Pyroon effective ATK, including canonical Sức Mạnh Lửa, not ally ATK');
  assert.equal(firstEvent.burnApplied, 1);
  assert.equal(firstEvent.burnRefreshed, false);
  assert.equal(secondEvent.damage, expectedProcDamage);
  assert.equal(secondEvent.burnRefreshed, true, 'Second trigger refreshes the existing Burn');
  assert.ok(direct.target.burnActionsRemaining > 0 && direct.target.burnDamage > 0, 'Mồi Lửa applies canonical Burn state');
  assert.equal(firstEvent.focusGained, 0);
  assert.equal(secondEvent.focusGained, 1, 'Only the final valid trigger grants Focus');
  assert.equal(secondEvent.focusAfter, 1);
  assert.equal(direct.source.coreState.counters['pyroon:focus'], 1);
  assert.equal(secondEvent.markEnded, true);
  assert.equal(Object.values(direct.target.coreState.marks).length, 0, 'Mark is removed at the two-trigger limit');

  const beforePresentation = stateSnapshot(direct.source, direct.target);
  const eventBeforePresentation = structuredClone(secondEvent);
  const cues = runtime.buildPyroonMechanicPresentation(secondEvent, 'Pyroon', direct.target.pow.name);
  assert.deepEqual(stateSnapshot(direct.source, direct.target), beforePresentation, 'Presentation mapping cannot mutate HP, Burn, Focus or marks');
  assert.deepEqual(secondEvent, eventBeforePresentation, 'Presentation mapping cannot mutate the resolved event');
  assert.deepEqual(cues.map((cue) => cue.kind), ['source', 'damage', 'status', 'focus', 'end']);
  assert.match(cues[0].label, /PYROON · MỒI LỬA →/);
  assert.equal(cues[1].hpDamage, secondEvent.hpDamage, 'Presentation damage popup consumes the resolved damage value');
  assert.match(cues[2].label, /THIÊU ĐỐT · LÀM MỚI/);
  assert.match(cues[3].label, /TẬP TRUNG \+1 · 1\/3/);
  assert.match(cues[4].label, /MỒI LỬA · KẾT THÚC/);

  const dot = placeFireBait(runtime, pyroon, allyTemplate, 'dot');
  const dotResult = new runtime.BasicAttackResolver(() => 0.99).resolve(
    dot.ally,
    dot.target,
    {},
    1,
    { origin: 'dot', actionType: 'status-tick', directDamage: false },
    dot.state.units
  );
  assert.equal(dotResult.mechanicEvents.length, 0, 'DoT/status ticks never trigger Mồi Lửa');
  assert.equal(Object.values(dot.target.coreState.marks).length, 1, 'Rejected DoT does not consume the mark');

  const hostile = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-hostile-source', { attack: 58 })],
    [
      neutralPow(allyTemplate, 'hostile-attacker', { attack: 50 }),
      neutralPow(pyroon, 'hostile-mark-target')
    ]
  );
  const hostileSource = hostile.activeLiving('player')[0];
  const [hostileActor, hostileTarget] = hostile.activeLiving('enemy');
  new runtime.SkillActionResolver(() => 0.99).resolve(
    hostileSource,
    hostileTarget,
    hostileSource.pow.abilities.skills[1],
    1,
    1,
    {},
    {},
    hostile.units
  );
  const hostileHit = new runtime.BasicAttackResolver(() => 0.99).resolve(
    hostileActor, hostileTarget, {}, 1, {}, hostile.units
  );
  assert.equal(hostileHit.mechanicEvents.length, 0, 'Enemy-side damage cannot trigger an opposing Pyroon mark');
  assert.equal(Object.values(hostileTarget.coreState.marks).length, 1);

  const deadSource = placeFireBait(runtime, pyroon, allyTemplate, 'dead-source');
  deadSource.source.hp = 0;
  deadSource.source.alive = false;
  const deadSourceHit = new runtime.BasicAttackResolver(() => 0.99).resolve(
    deadSource.ally, deadSource.target, {}, 1, {}, deadSource.state.units
  );
  assert.equal(deadSourceHit.mechanicEvents.length, 0, 'A defeated Pyroon cannot trigger Mồi Lửa');
  assert.equal(Object.values(deadSource.target.coreState.marks).length, 1);

  const expiry = placeFireBait(runtime, pyroon, allyTemplate, 'expiry');
  const expiryResolver = new runtime.BasicAttackResolver(() => 0.99);
  expiryResolver.resolve(expiry.target, expiry.source, {}, 1, {}, expiry.state.units);
  assert.equal(Object.values(expiry.target.coreState.marks).length, 1, 'Mark remains after the target first main action');
  expiryResolver.resolve(expiry.target, expiry.source, {}, 2, {}, expiry.state.units);
  assert.equal(Object.values(expiry.target.coreState.marks).length, 0, 'Mark expires after the target second main action');
}

function assertUltimate(runtime, pyroon, canonicalUltimate) {
  const state = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-ultimate', { attack: 58 })],
    [
      neutralPow(pyroon, 'ultimate-first', { hp: 30, maxHp: 30 }),
      neutralPow(pyroon, 'ultimate-low', { hp: 40, maxHp: 100 }),
      neutralPow(pyroon, 'ultimate-high', { hp: 90, maxHp: 100 })
    ],
    { initialRageByPowId: { 'pyroon-ultimate': 4 } }
  );
  const actor = state.activeLiving('player')[0];
  const [firstTarget] = state.activeLiving('enemy');
  actor.coreState.counters['pyroon:focus'] = 3;
  const result = new runtime.SkillActionResolver(() => 0.99).resolveUltimate(
    actor, firstTarget, actor.pow.abilities.ultimate, 1, {}, {}, state.units
  );
  assert.equal(result.hitResults.length, 5, 'Vũ Điệu Bảy Tia resolves exactly five real hit results');
  assert.deepEqual(
    result.hitResults.map((hit) => hit.targetId),
    [
      'enemy-0-ultimate-first',
      'enemy-0-ultimate-first',
      'enemy-1-ultimate-low',
      'enemy-1-ultimate-low',
      'enemy-2-ultimate-high'
    ],
    'Rays stay locked until death then retarget the lowest-HP living enemy'
  );
  assert.equal(result.hitResults[4].crit, true, 'Three Focus guarantees the final ray Crit');
  assert.equal(actor.coreState.counters['pyroon:focus'], 3, 'Ultimate does not consume canonical Focus');
  assert.equal(result.rageSpent, 4);
  assert.equal(runtime.toPlayerRagePoints(result.rageSpent), 100);
  assert.equal(result.rageAfter, 0);
  assert.equal(result.manaSpent, 32);
  assert.equal(result.manaAfter, 68);

  const shotRatio = canonicalNumber(canonicalUltimate.description, /mỗi phát (\d+)% ATK/, 'Ultimate shot coefficient') / 100;
  const nextCritBonus = canonicalNumber(canonicalUltimate.description, /phát kế tiếp tăng (\d+)% sát thương/, 'next-ray Crit bonus') / 100;
  const critState = new runtime.CombatState(
    [neutralPow(pyroon, 'pyroon-ultimate-crit-chain', { attack: 58, critRate: 100 })],
    [neutralPow(pyroon, 'ultimate-crit-chain-target')],
    { initialRageByPowId: { 'pyroon-ultimate-crit-chain': 4 } }
  );
  const critActor = critState.activeLiving('player')[0];
  const critTarget = critState.activeLiving('enemy')[0];
  const critResult = new runtime.SkillActionResolver(() => 0.99).resolveUltimate(
    critActor, critTarget, critActor.pow.abilities.ultimate, 1, {}, {}, critState.units
  );
  const expectedFirst = Math.round(shotRatio * 58 * 2);
  const expectedSecond = Math.round(shotRatio * 58 * 2 * (1 + nextCritBonus));
  assert.equal(critResult.hitResults[0].damage, expectedFirst);
  assert.equal(critResult.hitResults[0].crit, true);
  assert.equal(critResult.hitResults[1].damageMultiplier, 1 + nextCritBonus);
  assert.equal(critResult.hitResults[1].damage, expectedSecond, 'A Crit ray gives exactly canonical +12% to the next ray');
}

async function main() {
  const canonical = await loadPowderCanonicalRuntime(root);
  const canonicalSkills = canonical.window.POWDER_SKILL_V81?.pows?.pyroon?.skills;
  assert.ok(canonicalSkills, 'Independent V8.1 Pyroon skill authority must load');
  const designRegistry = JSON.parse(await readFile(new URL('../data/pow-canonical-design.json', import.meta.url), 'utf8'));
  const canonicalPassive = designRegistry.pows
    ?.find((pow) => pow.powId === 'pyroon')
    ?.fields?.passive?.chosenCanonicalValue;
  assert.ok(canonicalPassive, 'Independent recovered-design Pyroon Passive authority must load');
  const runtime = await loadCombatRuntime(canonical.window);
  const previousWindow = globalThis.window;
  globalThis.window = canonical.window;
  try {
    const pyroon = assertAdapterContract(runtime, canonicalSkills);
    const allyTemplate = runtime.combatPowById('terrapup');
    assert.ok(allyTemplate, 'A non-Pyroon ally fixture must resolve through the adapter');

    assertBasic(runtime, pyroon);
    assertSkillOne(runtime, pyroon);
    assertSkillTwo(runtime, pyroon, allyTemplate, canonicalSkills.skill2, canonicalPassive);
    assertUltimate(runtime, pyroon, canonicalSkills.ultimate);

    const battleSceneSource = await readFile(new URL('../src/game/combat2/scenes/BattleScene.ts', import.meta.url), 'utf8');
    assert.match(battleSceneSource, /buildPyroonMechanicPresentation/);
    assert.match(battleSceneSource, /presentPyroonMechanicEvents\(result\.mechanicEvents\)/);

    console.log(JSON.stringify({
      status: 'PASS',
      canonicalAuthority: [
        'POWDER_SKILL_V81.pows.pyroon.skills',
        'pow-canonical-design.json Pyroon passive (design JSON + workbook corroboration)'
      ],
      assertions: {
        basic: ['Crit grants Focus', 'same-target progression', 'target switch resets Focus'],
        skill1: ['zero Focus rejected', 'Mana 22', 'Focus consumed', 'cooldown enforced', 'three Focus forces Crit'],
        skill2: [
          'two direct allied procs only', 'third hit rejected', 'DoT rejected', 'enemy-side rejected',
          'dead source rejected', '18% Pyroon ATK numeric', 'Burn apply/refresh', 'exact final Focus',
          'mark expiry/removal', 'presentation payload reached without state mutation'
        ],
        ultimate: [
          'five real hits', 'target lock until death', 'lowest-HP retarget', 'next-ray +12% numeric',
          'final Crit at three Focus', 'Focus preserved', 'Mana 32', 'internal Rage 4 projects to player 100 Nộ'
        ]
      }
    }, null, 2));
  } finally {
    globalThis.window = previousWindow;
  }
}

await main();
