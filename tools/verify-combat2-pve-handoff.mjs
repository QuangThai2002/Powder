import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

class MemoryStorage {
  #data = new Map();

  getItem(key) { return this.#data.get(String(key)) ?? null; }
  setItem(key, value) { this.#data.set(String(key), String(value)); }
  removeItem(key) { this.#data.delete(String(key)); }
  clear() { this.#data.clear(); }
}

async function loadContract() {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'powder-combat2-handoff-'));
  const sourcePath = fileURLToPath(new URL('src/game/combat2/Combat2BattleHandoff.ts', root));
  const compilerPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));
  try {
    execFileSync(process.execPath, [compilerPath, '--ignoreConfig', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--outDir', outputDirectory, sourcePath], { stdio: 'pipe' });
    const output = await readFile(join(outputDirectory, 'Combat2BattleHandoff.js'), 'utf8');
    const module = { exports: {} };
    new Function('exports', 'module', output)(module.exports, module);
    return module.exports;
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

async function loadBossRuntime() {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'powder-combat2-boss-'));
  const sourcePath = fileURLToPath(new URL('src/game/combat2/systems/BossModeController.ts', root));
  const compilerPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));
  try {
    const resourceSources = ['CombatRageRegression', 'CombatMultiTargetRegression', 'BasicAttackResolver', 'SupportActionResolver']
      .map((name) => fileURLToPath(new URL(`src/game/combat2/systems/${name}.ts`, root)));
    execFileSync(process.execPath, [compilerPath, '--ignoreConfig', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--allowJs', '--rootDir', fileURLToPath(root), '--outDir', outputDirectory, sourcePath, ...resourceSources], { stdio: 'pipe' });
    const require = createRequire(join(outputDirectory, 'loader.cjs'));
    const combatDirectory = join(outputDirectory, 'src', 'game', 'combat2');
    const previousWindow = globalThis.window;
    const dataContext = vm.createContext({ window: {} });
    for (const path of ['js/data.js', 'js/master-data-v9.js']) {
      vm.runInContext(await text(path), dataContext, { filename: path });
    }
    globalThis.window = dataContext.window;
    try {
      return {
        catalogWindow: dataContext.window,
        ...require(join(combatDirectory, 'systems', 'BossModeController.js')),
        ...require(join(combatDirectory, 'systems', 'CombatState.js')),
        ...require(join(combatDirectory, 'systems', 'TurnManager.js')),
        ...require(join(combatDirectory, 'systems', 'CombatRageEngine.js')),
        ...require(join(combatDirectory, 'systems', 'CombatRageRegression.js')),
        ...require(join(combatDirectory, 'systems', 'CombatMultiTargetRegression.js')),
        ...require(join(combatDirectory, 'systems', 'BasicAttackResolver.js')),
        ...require(join(combatDirectory, 'systems', 'SkillActionResolver.js')),
        ...require(join(combatDirectory, 'systems', 'SupportActionResolver.js')),
        ...require(join(combatDirectory, 'data', 'PowderDataAdapter.js'))
      };
    } finally { globalThis.window = previousWindow; }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

async function verifyRageContract(combat) {
  globalThis.window = combat.catalogWindow;
  assert.equal(combat.runCombatRageRegression().rageEconomyChecked, true);
  assert.equal(combat.runCombatMultiTargetRegression().singleResourceCommitChecked, true);
  const makeState = () => new combat.CombatState(combat.COMBAT2_STARTER_ROSTER.player, combat.COMBAT2_STARTER_ROSTER.enemy);
  const initial = makeState();
  assert.ok(initial.units.every((unit) => unit.ragePoints === 0), 'default start is zero for the real catalog roster');
  assert.ok(initial.units.every((unit) => !combat.canUseUltimate(unit.ragePoints)), 'no default full Rage');

  const legacyContext = vm.createContext({ window: {}, console });
  for (const path of ['js/data.js', 'js/game-engine.js', 'js/combat-mechanics-v17.js', 'js/combat-rage-model.js', 'js/combat-runtime-v21.js', 'js/combat-core-v7.js']) {
    vm.runInContext(await text(path), legacyContext, { filename: path });
  }
  const legacy = legacyContext.window.POWDER_COMBAT_CORE_V7;
  const roster = legacyContext.window.POWDER_DATA.pows.slice(0, 3).map((pow) => ({ pow, owned: { level: 1, stars: 0 } }));
  const makeLegacy = (mode = 'pve') => new legacy.BattleCore({ mode, playerEntries: roster, enemyEntries: roster, seed: 12 });
  for (const mode of ['pve', 'pvp', 'boss']) {
    assert.ok(makeLegacy(mode).allRosterUnits.every((unit) => unit.ragePoints === 0), `${mode} legacy default is also zero`);
  }

  const rageRuntime = legacyContext.window.POWDER_COMBAT_RUNTIME_V21;
  const contributionUnit = { v9: { sets: [{ name: 'Điều Nhịp', tier: 2 }], artifact: { effect: { code: 'mana_refund_50' } }, battleFlags: {} } };
  const firstSkill = rageRuntime.collectActionRageContributions(contributionUnit, 'skill1');
  const secondSkill = rageRuntime.collectActionRageContributions(contributionUnit, 'skill2');
  assert.deepEqual(plain(firstSkill.contributions.map((entry) => entry.amount)), [2, 1], 'Điều Nhịp contributes to the same Skill event');
  assert.deepEqual(plain(secondSkill.contributions.map((entry) => entry.amount)), [2, 1, 1], 'mana_refund_50 procs on every second Skill 1/2');
  const secondAmounts = secondSkill.contributions.map((entry) => entry.amount);
  assert.equal(legacy.applyRageEvent(3, secondAmounts).next, 7, 'resource contributions aggregate before normal gain');
  assert.equal(legacy.applyRageEvent(4, secondAmounts).next, 6, 'resource contributions aggregate before overflow halving');

  const makeSemanticUnit = (rules, specials = []) => ({
    id: 'semantic-owner', side: 'player', resources: new Map([['core', { current: 0, max: 8, visible: true }]]),
    coreMechanic: { gainRules: rules, specialRules: specials }, coreRuntime: {}
  });
  const selfSkillUnit = makeSemanticUnit(['SELF_ACTION'], ['SELF_SKILL_USED']);
  const selfTrigger = legacyContext.window.POWDER_MECHANICS_V2.gainForEvent(selfSkillUnit, 'SELF_SKILL_USED', { actorId: selfSkillUnit.id, side: 'player', key: 'skill1', logicalActionId: 'self-1' });
  const selfDuplicate = legacyContext.window.POWDER_MECHANICS_V2.gainForEvent(selfSkillUnit, 'SELF_SKILL_USED', { actorId: selfSkillUnit.id, side: 'player', key: 'skill1', logicalActionId: 'self-1' });
  assert.equal(selfTrigger.delta, 1, 'SELF_SKILL_USED triggers once');
  assert.equal(selfDuplicate, null, 'SELF_SKILL_USED duplicate is ignored');
  const allySkillUnit = makeSemanticUnit(['ALLY_SKILL'], ['ALLY_SKILL_USED']);
  assert.equal(legacyContext.window.POWDER_MECHANICS_V2.gainForEvent(allySkillUnit, 'ALLY_SKILL_USED', { actorId: 'other', side: 'player', key: 'skill2', logicalActionId: 'ally-1' }).delta, 1, 'ALLY_SKILL_USED triggers without Mana cost');
  assert.equal(legacyContext.window.POWDER_MECHANICS_V2.gainForEvent(allySkillUnit, 'ALLY_SKILL_USED', { actorId: 'other', side: 'player', key: 'skill2', logicalActionId: 'ally-1' }), null, 'ALLY_SKILL_USED duplicate is ignored');
  const rageChangeUnit = makeSemanticUnit(['RAGE_CHANGE']);
  assert.equal(legacyContext.window.POWDER_MECHANICS_V2.gainForEvent(rageChangeUnit, 'RAGE_CHANGE', { actorId: rageChangeUnit.id, preEventRage: 3, finalRage: 4, logicalActionId: 'rage-1' }).delta, 1, 'RAGE_CHANGE triggers once per logical resource event');
  const allyRageUnit = makeSemanticUnit(['ALLY_RAGE_GAIN']);
  assert.equal(legacyContext.window.POWDER_MECHANICS_V2.gainForEvent(allyRageUnit, 'ALLY_RAGE_GAIN', { actorId: 'other', side: 'player', effectiveGain: 0, logicalActionId: 'gain-0' }), null, 'ALLY_RAGE_GAIN ignores zero effective gain');
  assert.equal(legacyContext.window.POWDER_MECHANICS_V2.gainForEvent(allyRageUnit, 'ALLY_RAGE_GAIN', { actorId: 'other', side: 'player', effectiveGain: 1, logicalActionId: 'gain-1' }).delta, 1, 'ALLY_RAGE_GAIN accepts effective gain');

  for (let start = 0; start <= 8; start += 1) {
    for (let action = 0; action <= 8; action += 1) {
      for (let passive = 0; passive <= 4; passive += 1) {
        const sources = [action, passive, 1];
        const total = action + passive + 1;
        const expected = Math.min(8, start + (start < 4 ? total : Math.floor(total * 0.5)));
        assert.equal(combat.applyRawRageGain(start, sources).next, expected);
        assert.equal(legacy.applyRawRageGain(start, sources).next, expected, 'legacy and Combat2 share event gain semantics');
      }
    }
    for (const key of ['basic', 'skill1', 'skill2', 'ultimate']) {
      if (key === 'ultimate' && start < 4) continue;
      const state = makeState();
      const actor = state.activeLiving('player')[0];
      const target = state.activeLiving('enemy')[0];
      actor.ragePoints = start;
      const skills = new combat.SkillActionResolver(() => 0);
      const skill = { name: 'Resource contract', type: 'support', power: 1 };
      if (key === 'basic') new combat.BasicAttackResolver(() => 0).resolve(actor, target);
      else if (key === 'ultimate') skills.resolveUltimate(actor, actor, skill);
      else skills.resolve(actor, actor, skill, key === 'skill1' ? 0 : 1);
      const expected = key === 'ultimate' ? start - 4 : Math.min(8, start + (start < 4 ? 2 : 1));
      assert.equal(actor.ragePoints, expected, `real Combat2 ${key} from ${start}`);

      const core = makeLegacy();
      const unit = core.allRosterUnits[0];
      unit.ragePoints = start;
      legacy.syncLegacyRageUnit(unit);
      // Direct resolver fixture: no rendering, AI or academic bypass path is installed.
      core.state.current = unit;
      core.executeAction(unit, key, core.state.enemies[0].id);
      assert.equal(unit.ragePoints, expected, `real legacy ${key} from ${start}`);
    }

    const state = makeState();
    const actor = state.activeLiving('player')[0];
    actor.ragePoints = start;
    new combat.SkillActionResolver(() => 0).resolve(actor, actor, { name: 'Rage gain', type: 'support', power: 1, status: 'rage gain' }, 0);
    assert.equal(actor.ragePoints, Math.min(8, start + (start < 4 ? 3 : 1)), 'action + skill gain aggregated once');
    actor.ragePoints = start;
    new combat.SupportActionResolver().resolve('shield', actor);
    assert.equal(actor.ragePoints, Math.min(8, start + (start < 4 ? 2 : 1)), 'support uses canonical gain');
    if (start >= 4) {
      actor.ragePoints = start;
      new combat.SkillActionResolver(() => 0).resolveUltimate(actor, actor, { name: 'Ultimate Rage gain', type: 'support', power: 1, status: 'rage gain' });
      assert.equal(actor.ragePoints, start - 4, 'single Ultimate refund is halved from the pre-spend snapshot');
    }
  }

  const core = makeLegacy();
  const snapshot = core.integrationRecoverySnapshot();
  const actorRow = snapshot.runtime.units[0];
  delete actorRow.ragePoints;
  actorRow.rage = 99;
  assert.equal(legacy.restoreBattleRecovery(snapshot).allRosterUnits[0].ragePoints, 3, 'legacy recovery below 100 must not become READY');
  actorRow.rage = 100;
  assert.equal(legacy.restoreBattleRecovery(snapshot).allRosterUnits[0].ragePoints, 4, 'legacy 100 restores to 4');
  actorRow.ragePoints = 7;
  actorRow.energy = 100;
  assert.equal(legacy.restoreBattleRecovery(snapshot).allRosterUnits[0].ragePoints, 7, 'canonical surplus wins over lossy legacy alias');
  delete actorRow.ragePoints;
  assert.equal(legacy.restoreBattleRecovery(snapshot).allRosterUnits[0].ragePoints, 4, 'PvP energy fallback maps legacy FULL_READY only when canonical Rage is absent');
  console.log(JSON.stringify({ status: 'PASS', checks: ['rage-official-rule', 'aggregate-before-halving', 'default-zero', 'ultimate-surplus', 'four-markers-red-overflow', 'real-resolver-resource-parity', 'multi-target-no-duplicate-gain', 'legacy-recovery-threshold'] }));
}

function createRuntime() {
  const sessionStorage = new MemoryStorage();
  const localStorage = new MemoryStorage();
  const navigation = [];
  const location = {
    href: 'http://powder.test/',
    pathname: '/',
    assign(value) {
      const url = new URL(String(value), this.href);
      this.href = url.href;
      this.pathname = url.pathname;
      navigation.push(url.href);
    }
  };
  const learning = [];
  const rewards = [];
  const bossSettlements = [];
  const adventureResults = [];
  const restoredContexts = [];
  const shownViews = [];
  const legacyStarts = [];
  const saveState = { starterId: 'hero-1', team: ['hero-1'], lessonsDone: ['lesson-1'], rank: 3, coins: 100, exp: 10, wins: 0, owned: {
    'hero-1': { level: 42, stars: 2, shiny: false },
    'hero-2': { level: 38, stars: 1, shiny: true },
    'hero-3': { level: 55, stars: 4, shiny: false }
  } };
  const requirement = {
    Rank: 1,
    Curriculum: { language: 'ZH', level: 'HSK1' },
    RequiredLessonIDs: ['lesson-1'],
    RequiredConceptIDs: ['concept-1'],
    RequiredMastery: 1
  };
  const question = {
    id: 'academic-q-1',
    lessonId: 'lesson-1',
    conceptId: 'concept-1',
    language: 'zh',
    prompt: 'Nǐ hǎo nghĩa là gì?',
    answer: 'Xin chào',
    options: ['Xin chào', 'Cảm ơn', 'Tạm biệt'],
    explain: 'Lời chào cơ bản.'
  };
  const dailyBossConfig = {
    id: 'daily', thresholds: [0.5], phasePower: 1.12, phaseSpeed: 1.06, phaseShield: 0.08,
    signature: { id: 'blood_hunt', name: 'Huyết Liệp', cadence: [3, 2], effect: { kind: 'mark-lowest-hp', status: 'Boss Mark', turns: 2 } }
  };
  const window = {
    sessionStorage,
    localStorage,
    location,
    addEventListener() {},
    dispatchEvent() {},
    setTimeout() { return 0; },
    clearTimeout() {},
    POWDER_DATA: { pows: [
      { id: 'hero-1', maxStars: 7, stats: { hp: 100, atk: 24, ap: 28, def: 16, speed: 42 } },
      { id: 'hero-2', maxStars: 7, stats: { hp: 110, atk: 22, ap: 25, def: 18, speed: 38 } },
      { id: 'hero-3', maxStars: 7, stats: { hp: 125, atk: 27, ap: 30, def: 20, speed: 35 } },
      { id: 'enemy-1', maxStars: 7, stats: { hp: 150, atk: 30, ap: 32, def: 22, speed: 33 } },
      { id: 'enemy-2', maxStars: 7, stats: { hp: 160, atk: 28, ap: 35, def: 24, speed: 31 } },
      { id: 'enemy-3', maxStars: 7, stats: { hp: 175, atk: 34, ap: 29, def: 26, speed: 29 } }
    ] },
    POWDER_PLAYER_POW_ELIGIBILITY_V1: {
      isPlayerEligible: (pow) => Boolean(pow?.id),
      sanitizeStage: (stage) => plain(stage),
      containsHiddenPow: () => false,
    },
    POWDER_POWER_CURVE_V8: { enemyGradeBase: 1.35 },
    POWDER_ENGINE: { createCombatant: (pow, owned = {}, options = {}) => {
      const scale = Math.max(0.1, Number(options.scale) || 1);
      const stats = pow.stats || {};
      return { stats: Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, Math.max(1, Math.round(Number(value) * scale))])) };
    } },
    POWDER_APP: {
      getSave: () => plain(saveState),
      getDungeonLearningGate: () => ({ requirement }),
      getCombatQuestionPool: () => [question, { ...question, id: 'academic-q-invalid', lessonId: 'lesson-x' }],
      grantLearningProgress: (entry) => { learning.push(entry); return window.POWDER_SECURE_ECONOMY_V152?.hasAccount?.() ? { serverProtected: true } : { ok: true }; },
      grantBattleRewards: (entry) => { rewards.push(entry); if(window.POWDER_SECURE_ECONOMY_V152?.hasAccount?.())return { ok: false, serverProtected: true, rewardLocked: true };saveState.coins+=entry.coins;saveState.exp+=entry.exp;saveState.wins+=entry.wins;return { ok: true, coins: saveState.coins, exp: saveState.exp, wins: saveState.wins }; },
      onBossCombatFinished: (entry) => { bossSettlements.push(entry); return { ok: true, reward: entry.win ? { coins: 5 } : null }; },
      showView: (view) => { shownViews.push(view); }
    },
    POWDER_ADVENTURE: {
      onBattleFinished: (entry) => { adventureResults.push(entry); },
      restoreCombatContext: (entry) => { restoredContexts.push(entry); },
      learningGate: (stage) => String(stage?.id || '') === '1-1' ? {
        ready: true,
        onboardingCombat: true,
        requirement: { RequiredLessonIDs: [], RequiredConceptIDs: [], RequiredMastery: 0, Rank: 0, Curriculum: {} }
      } : { requirement }
    },
    POWDER_BATTLE_PLAYER_V177: {
      startEncounter: (...args) => { legacyStarts.push(args); return true; }
    }
  };
  const bossConfigs = {
    daily: dailyBossConfig,
    weekly: { id: 'weekly', thresholds: [0.7, 0.35], phasePower: 1.16, phaseSpeed: 1.08, phaseShield: 0.12, signature: { id: 'cataclysm', name: 'Đại Nạn', cadence: [3, 3, 2], effect: { kind: 'max-hp-aoe' } } },
    promotion: { id: 'promotion', thresholds: [0.5], phasePower: 1.14, phaseSpeed: 1.06, phaseShield: 0.10, signature: { id: 'formation_break', name: 'Phá Trận', cadence: [3, 2], effect: { kind: 'shield-break-antiheal' } } },
    story: { id: 'story', thresholds: [0.5], phasePower: 1.10, phaseSpeed: 1.04, phaseShield: 0.06, signature: { id: 'suppression', name: 'Trấn Áp', cadence: [3, 2], effect: { kind: 'mark-lowest-hp' } } }
  };
  window.POWDER_BOSS_ENCOUNTER_V1860 = { encounter: (type) => bossConfigs[type] || null };
  const sandbox = {
    window,
    document: { readyState: 'complete', addEventListener() {} },
    localStorage,
    sessionStorage,
    URL,
    JSON,
    Date,
    Promise,
    Map,
    Set,
    Math,
    console,
    crypto: { randomUUID: (() => { let id = 0; return () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`; })() },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    setTimeout() { return 0; },
    clearTimeout() {}
  };
  return { sandbox: vm.createContext(sandbox), window, sessionStorage, localStorage, navigation, learning, rewards, bossSettlements, adventureResults, restoredContexts, shownViews, legacyStarts, question, dailyBossConfig, bossConfigs, saveState };
}

function stage() {
  return {
    id: 'island-1-stage-1',
    islandId: 1,
    kind: 'normal',
    enemyIds: ['enemy-1'],
    enemyCount: 1,
    scale: 1,
    initiative: 0,
    rewards: { coins: 25, exp: 15 }
  };
}

function onboardingStage() {
  return {
    id: '1-1', islandId: 1, number: 1, kind: 'normal', enemyIds: ['enemy-1'], enemyCount: 1,
    scale: 1, initiative: 0, rewards: { coins: 25, exp: 15 }
  };
}

function bossStage() {
  return {
    id: 'challenge-boss-daily', islandId: 1, kind: 'boss', bossChallengeId: 'daily',
    enemyIds: ['enemy-1'], enemyCount: 1, recommendedLevel: 45, adaptive: 1.04,
    recommendedStars: 3, scale: 2.15, initiative: 14,
    manaStart: 0.8, rageStart: 35, difficultyLabel: 'BOSS'
  };
}

async function main() {
  const [transactionSafety, handoffEntry, bossBootstrap, contract, bossRuntime] = await Promise.all([
    text('js/transaction-safety-v2090.js'),
    text('js/combat-entry-v177.js'),
    text('js/combat-boss-bootstrap-v1.js'),
    loadContract(),
    loadBossRuntime()
  ]);
  await verifyRageContract(bossRuntime);
  const runtime = createRuntime();
  vm.runInContext(bossBootstrap, runtime.sandbox, { filename: 'combat-boss-bootstrap-v1.js' });
  vm.runInContext(transactionSafety, runtime.sandbox, { filename: 'transaction-safety-v2090.js' });
  vm.runInContext(handoffEntry, runtime.sandbox, { filename: 'combat-entry-v177.js' });


  const entry = runtime.window.POWDER_COMBAT_ENTRY_V177;
  const handoff = runtime.window.POWDER_COMBAT2_HANDOFF;
  const { CombatState, TurnManager, BossModeController } = bossRuntime;
  assert.deepEqual(plain(entry.combat2Cutover), { pve: true, boss: true, legacyFallback: false }, 'PvE and Boss entry must be cut over to Combat2');
  const onboarding = entry.createPvePilotRequest(onboardingStage());
  assert.equal(onboarding.ok, true, 'fresh 1-1 must create a PvE request');
  assert.equal(onboarding.value.academicContext.onboardingCombat, true, '1-1 must use the onboarding gate');
  assert.deepEqual(plain({
    lessons: onboarding.value.academicContext.requiredLessonIds,
    concepts: onboarding.value.academicContext.requiredConceptIds,
    mastery: onboarding.value.academicContext.requiredMastery,
    rank: onboarding.value.academicContext.rank
  }), { lessons: [], concepts: [], mastery: 0, rank: 0 }, '1-1 must be free of academic prerequisites');
  const savedTeam = [...runtime.saveState.team];
  runtime.saveState.team = [];
  const starterOnly = entry.createPvePilotRequest(onboardingStage());
  assert.deepEqual(plain(starterOnly.value.playerTeam), ['hero-1'], 'starter-only formation must be valid');
  runtime.saveState.team = savedTeam;
  const pow = (id, hp, speed = 100) => ({ id, name: id, hp, maxHp: hp, speed, passive: null });
  const bossController = (type, config) => {
    const state = new CombatState([pow('hero-mechanic', 100)], [pow(`boss-${type}`, 1000)], {
      battleMode: 'boss', bossContext: { bossChallengeId: type, bossType: type, phaseConfig: config }
    });
    const turns = new TurnManager(state);
    const controller = BossModeController.from(state, turns);
    assert.ok(controller, `${type} must create a live Boss controller from BattleRequest context`);
    return { state, turns, controller, player: state.activeLiving('player')[0], boss: state.activeLiving('enemy')[0] };
  };
  const dailyMechanic = bossController('daily', runtime.dailyBossConfig);
  dailyMechanic.boss.hp = 490;
  const phase = dailyMechanic.controller.afterAction(dailyMechanic.player);
  assert.equal(phase.phaseChanged, true, 'Boss must transition phase from real HP threshold');
  assert.equal(dailyMechanic.controller.snapshot().phase, 2);
  assert.equal(dailyMechanic.controller.snapshot().ragePoints, 4, 'Boss phase FULL_READY uses canonical Rage 4');
  assert.equal(dailyMechanic.turns.peekNext().instanceId, dailyMechanic.boss.instanceId, 'Boss phase meter lead advances the live timeline');
  dailyMechanic.controller.afterAction(dailyMechanic.boss);
  assert.equal(dailyMechanic.controller.snapshot().pending, 'cleanse', 'Daily Boss must arm Blood Hunt before its next action');
  dailyMechanic.controller.beforeEnemyAction(dailyMechanic.boss);
  assert.ok(dailyMechanic.player.hp < dailyMechanic.player.pow.maxHp, 'Uncleansed Blood Hunt must resolve as max-HP damage');
  assert.equal(dailyMechanic.player.ragePoints, 1, 'Boss mechanic hit maps to one canonical Rage gain event');

  const promotionConfig = { id: 'promotion', thresholds: [0.5], phasePower: 1.14, phaseSpeed: 1.06, phaseShield: 0.10, signature: { id: 'formation_break', name: 'Phá Trận', cadence: [3, 2], effect: { kind: 'shield-break-antiheal' } } };
  const promotionMechanic = bossController('promotion', promotionConfig);
  promotionMechanic.controller.afterAction(promotionMechanic.boss);
  promotionMechanic.controller.afterAction(promotionMechanic.boss);
  assert.equal(promotionMechanic.controller.snapshot().pending, 'shield-break', 'Promotion Boss must arm its shield-break response window');
  promotionMechanic.boss.shield = 0;
  promotionMechanic.boss.ragePoints = 4;
  promotionMechanic.controller.beforeEnemyAction(promotionMechanic.boss);
  assert.equal(promotionMechanic.player.antiHealActionsRemaining, 0, 'Broken promotion shield must interrupt anti-heal punishment');
  assert.equal(promotionMechanic.boss.ragePoints, 3, 'Promotion interruption maps legacy -25 to one semantic Rage penalty');

  const weeklyConfig = { id: 'weekly', thresholds: [0.7, 0.35], phasePower: 1.16, phaseSpeed: 1.08, phaseShield: 0.12, signature: { id: 'cataclysm', name: 'Đại Nạn', cadence: [3, 3, 2], effect: { kind: 'max-hp-aoe' } } };
  const weeklyMechanic = bossController('weekly', weeklyConfig);
  weeklyMechanic.controller.afterAction(weeklyMechanic.boss);
  weeklyMechanic.controller.afterAction(weeklyMechanic.boss);
  assert.equal(weeklyMechanic.controller.snapshot().pending, 'shield-break', 'Weekly Boss must arm Cataclysm shield window');
  weeklyMechanic.boss.ragePoints = 4;
  weeklyMechanic.controller.beforeEnemyAction(weeklyMechanic.boss);
  assert.ok(weeklyMechanic.player.hp < weeklyMechanic.player.pow.maxHp, 'Unbroken weekly shield must resolve Cataclysm');
  assert.equal(weeklyMechanic.player.ragePoints, 1, 'Weekly mechanic hit maps to one canonical Rage gain event');
  const weeklyInterrupted = bossController('weekly', weeklyConfig);
  weeklyInterrupted.controller.afterAction(weeklyInterrupted.boss);
  weeklyInterrupted.controller.afterAction(weeklyInterrupted.boss);
  weeklyInterrupted.boss.ragePoints = 4;
  weeklyInterrupted.boss.shield = 0;
  weeklyInterrupted.controller.beforeEnemyAction(weeklyInterrupted.boss);
  assert.equal(weeklyInterrupted.boss.ragePoints, 3, 'Weekly interruption maps legacy -30 to one semantic Rage penalty');
  const storyMechanic = bossController('story', runtime.bossConfigs.story);
  storyMechanic.controller.afterAction(storyMechanic.boss);
  storyMechanic.controller.afterAction(storyMechanic.boss);
  assert.equal(storyMechanic.controller.snapshot().pending, 'cleanse', 'Story Boss must arm its cleanse response window');
  storyMechanic.controller.beforeEnemyAction(storyMechanic.boss);
  assert.equal(storyMechanic.player.speedDebuffActionsRemaining, 2, 'Story Boss suppression preserves slow timing without a Rage gain');
  const launched = entry.startMap(stage());
  assert.equal(launched, true, 'canRunPvePilot must launch Combat2 for an eligible offline PvE request');
  assert.equal(runtime.window.location.pathname, '/combat2.html', 'Main entry must navigate to Combat2');
  assert.equal(runtime.legacyStarts.length, 0, 'eligible PvE must not invoke the legacy renderer');

  runtime.window.POWDER_ONLINE_V150 = { hasSession: () => true };
  const onlineLaunch = entry.startMap(stage(), { structured: true });
  assert.equal(onlineLaunch.ok, true, 'logged-in Online PvE must launch Combat2');
  assert.equal(entry.getLastEntryResult().ok, true, 'online launch must expose a structured success result');
  assert.equal(entry.startBoss(bossStage()), false, 'ineligible online Boss must fail closed instead of launching legacy Combat');
  assert.equal(runtime.legacyStarts.length, 0, 'rejected Combat2 entries must not invoke the legacy renderer');
  delete runtime.window.POWDER_ONLINE_V150;

  const invalidEntry = entry.startMap({ id: '', islandId: 0 }, { structured: true });
  assert.equal(invalidEntry.ok, false, 'invalid map entry must return a structured failure');
  assert.equal(invalidEntry.reason, 'invalid-stage');
  assert.ok(invalidEntry.errors.length > 0, 'invalid map entry must explain the failure');

  const request = handoff.readBattleRequest();
  assert.equal(request.ok, true, 'BattleRequest must be stored before Combat2 navigation');
  assert.equal(request.value.battleMode, 'pve');
  assert.equal(request.value.academicContext.requiresActionQuestions, true);
  assert.equal(request.value.academicContext.authority, 'main-learning');
  assert.equal(request.value.academicContext.allowedQuestionPool.length, 1, 'snapshot must exclude ineligible questions');
  assert.equal(request.value.rosterContext.source, 'legacy-pve-boundary', 'PvE must snapshot final stats before Combat2 boot');
  assert.equal(request.value.rosterContext.playerRoster.length, 1, 'PvE player snapshot must match the selected team');
  assert.equal(request.value.rosterContext.enemyRoster.length, 1, 'PvE enemy snapshot must match the stage roster');
  const pvePlayerRow = request.value.rosterContext.playerRoster[0];
  const pveEnemyRow = request.value.rosterContext.enemyRoster[0];
  const pveBasePlayer = request.value.playerTeam.map(id => pow(id, 100, 100));
  const pveBaseEnemy = request.value.enemyTeam.map(id => pow(id, 100, 100));
  const pveHydratedPlayer = bossRuntime.applyBossBootstrapToTeam(pveBasePlayer, request.value.rosterContext.playerRoster);
  const pveHydratedEnemy = bossRuntime.applyBossBootstrapToTeam(pveBaseEnemy, request.value.rosterContext.enemyRoster);
  assert.ok(pveHydratedPlayer && pveHydratedEnemy, 'PvE snapshot must hydrate the requested roster');
  assert.equal(pveHydratedPlayer[0].level, runtime.saveState.owned['hero-1'].level, 'PvE level must come from the final Main-owned snapshot');
  assert.equal(pveHydratedPlayer[0].stars, runtime.saveState.owned['hero-1'].stars, 'PvE stars must come from the final Main-owned snapshot');
  assert.equal(pveHydratedPlayer[0].attack, pvePlayerRow.stats.atk, 'PvE final player ATK must survive handoff');
  assert.equal(pveHydratedEnemy[0].attack, pveEnemyRow.stats.atk, 'PvE adaptive enemy ATK must survive handoff');
  const pveBootstrapOptions = bossRuntime.bossBootstrapRuntimeOptions(request.value.rosterContext);
  const pveState = new CombatState(pveHydratedPlayer, pveHydratedEnemy, { battleMode: 'pve', ...pveBootstrapOptions });
  assert.equal(pveState.units.find(unit => unit.pow.id === pveEnemyRow.powId)?.initialInitiative,
    request.value.rosterContext.initialInitiativeByPowId[pveEnemyRow.powId] || 0,
    'PvE initiative snapshot must be applied before the first turn');

  const eligibleQuestions = contract.academicQuestionsFromContext(request.value.academicContext);
  assert.equal(eligibleQuestions.length, 1, 'Combat2 must accept Main snapshot questions only when lesson/concept match');
  assert.equal(eligibleQuestions[0].id, runtime.question.id);
  assert.equal(contract.academicQuestionsFromContext({
    ...request.value.academicContext,
    allowedQuestionPool: [{ ...eligibleQuestions[0], conceptId: 'concept-x' }]
  }).length, 0, 'Combat2 must reject out-of-gate questions');

  const result = contract.createCombat2BattleResult(request.value, {
    result: 'victory',
    survivingState: { player: [{ id: 'hero-1', hp: 100 }], enemy: [], round: 2 },
    academicResponses: [
      { question: eligibleQuestions[0], correct: true, powId: 'hero-1' },
      { question: eligibleQuestions[0], correct: false, powId: 'hero-1' }
    ]
  });
  assert.equal(result.academicOutcome.summary.answered, 2);
  assert.equal(result.academicOutcome.summary.correct, 1);
  assert.deepEqual(plain(result.academicOutcome.summary.players), [{ knowledgeActions: 2, knowledgeSum: 1 }]);
  assert.equal(handoff.returnToMain(result).ok, true, 'Combat2 must publish BattleResult before return');
  assert.equal(runtime.window.location.pathname, '/', 'Combat2 return must target Main');

  runtime.window.POWDER_SECURE_ECONOMY_V152 = { hasAccount: () => true };
  const onlineBlocked = await handoff.settleReturnedResult();
  assert.equal(onlineBlocked.ok, false, 'Online reward without server authority must not settle');
  assert.equal(onlineBlocked.reason, 'online-reward-authority-unavailable');
  assert.equal(runtime.learning.length, 0, 'Online academic result must not be locally settled');
  assert.equal(runtime.rewards.length, 0, 'Online protected reward must not be journaled as success');
  assert.equal(handoff.readBattleResult().ok, true, 'failed Online settlement must keep BattleResult');
  runtime.window.POWDER_SECURE_ECONOMY_V152 = { hasAccount: () => false };
  const settled = await handoff.settleReturnedResult();
  assert.equal(settled.ok, true);
  assert.equal(settled.duplicate, false);
  assert.equal(runtime.learning.length, 2, 'every academic response must settle once');
  assert.equal(runtime.rewards.length, 1, 'victory reward must settle once');
  assert.deepEqual(plain(runtime.rewards[0]), { coins: 25, exp: 15, wins: 1 }, 'offline reward must preserve the request payload');
  assert.deepEqual(plain(settled.rewardOutcome), { coins: 25, exp: 15, wins: 1 }, 'receipt amounts must equal the actual save delta');
  assert.equal(runtime.saveState.coins, 125);
  assert.equal(runtime.saveState.exp, 25);
  assert.equal(runtime.adventureResults.length, 1, 'Adventure must receive the battle result once');
  assert.deepEqual(plain(runtime.adventureResults[0].summary.players), [{ knowledgeActions: 2, knowledgeSum: 1 }]);
  assert.deepEqual(runtime.shownViews, [], 'result screen must precede Adventure return');
  handoff.continueBattleResult(result);
  assert.deepEqual(runtime.shownViews, ['adventure']);
  assert.equal(runtime.restoredContexts[0].stageId, 'island-1-stage-1');
  assert.equal(handoff.readBattleRequest().ok, false, 'settled request must be consumed');
  assert.equal(handoff.readBattleResult().ok, false, 'settled result must be consumed');

  assert.equal(handoff.storeBattleRequest(request.value).ok, true);
  assert.equal(handoff.publishBattleResult(result).ok, true);
  const duplicate = await handoff.settleReturnedResult();
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(runtime.learning.length, 2, 'duplicate result must not re-settle academics');
  assert.equal(runtime.rewards.length, 1, 'duplicate result must not re-grant rewards');
  handoff.continueBattleResult(result);
  assert.equal(handoff.readBattleRequest().ok, false, 'duplicate result must still be consumed');
  assert.equal(handoff.readBattleResult().ok, false, 'duplicate result must still be consumed');

  const invalidRequest = entry.createPvePilotRequest(stage());
  assert.equal(invalidRequest.ok, true);
  assert.equal(handoff.storeBattleRequest(invalidRequest.value).ok, true);
  const invalidResult = contract.createCombat2BattleResult(invalidRequest.value, {
    result: 'victory',
    survivingState: {},
    academicResponses: [{
      question: { ...eligibleQuestions[0], id: 'academic-q-foreign' },
      correct: true,
      powId: 'hero-1'
    }]
  });
  assert.equal(handoff.publishBattleResult(invalidResult).ok, true);
  const rejected = await handoff.settleReturnedResult();
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'academic-question-not-allowed');
  assert.equal(runtime.learning.length, 2, 'foreign academic questions must not grant learning progress');
  assert.equal(runtime.rewards.length, 1, 'foreign academic questions must not grant rewards');

  runtime.saveState.team = ['hero-1', 'hero-2', 'hero-3'];
  const bossFixtures = [
    bossStage(),
    { ...bossStage(), id: 'challenge-boss-weekly', bossChallengeId: 'weekly', enemyIds: ['enemy-2'], recommendedLevel: 20, adaptive: 1.18, recommendedStars: 5, scale: 3.4, initiative: 22, rageStart: 80 },
    { ...bossStage(), id: 'challenge-boss-promotion', bossChallengeId: 'promotion', enemyIds: ['enemy-3'], recommendedLevel: 60, adaptive: 1.02, recommendedStars: 1, scale: 2.65, initiative: 31, rageStart: 50, manaStart: 0.92 }
  ];
  const fixtureRequests = bossFixtures.map((fixture) => entry.createBossPilotRequest(fixture));
  const expectedLegacyRage = old => Math.min(4, Math.max(0, Math.floor(Math.max(0, Number(old) || 0) / 25)));
  for (let index = 0; index < fixtureRequests.length; index += 1) {
    const fixture = bossFixtures[index];
    const current = fixtureRequests[index];
    assert.equal(current.ok, true, `${fixture.bossChallengeId} Boss request must be valid`);
    const bootstrap = current.value.bossContext.bootstrap;
    assert.equal(bootstrap.version, 'boss-bootstrap-v1');
    assert.equal(bootstrap.legacyManaStart, Math.max(0.5, Math.min(1, Number(fixture.manaStart) || 0.74)), 'manaStart is preserved outside canonical Rage');
    assert.equal(current.value.battleRules.manaStart, undefined, 'manaStart must not become a Combat2 resource rule');
    assert.equal(bootstrap.playerRoster.length, 3, `${fixture.bossChallengeId} player roster is preserved`);
    assert.equal(bootstrap.enemyRoster.length, 1, `${fixture.bossChallengeId} enemy roster is preserved`);
    const enemyRow = bootstrap.enemyRoster[0];
    assert.equal(enemyRow.level, bootstrap.targetLevel, `${fixture.bossChallengeId} adaptive target level is preserved`);
    assert.equal(enemyRow.stars, Math.min(7, Number(enemyRow.stars)), `${fixture.bossChallengeId} target stars are bounded`);
    assert.equal(bootstrap.initialRageByPowId[enemyRow.powId], expectedLegacyRage(fixture.rageStart), `${fixture.bossChallengeId} legacy Rage adapter is exact`);
    assert.equal(bootstrap.initialInitiativeByPowId[enemyRow.powId], Math.max(0, Math.min(92, Number(fixture.initiative) || 0)), `${fixture.bossChallengeId} initiative is preserved`);
    const basePlayer = current.value.playerTeam.map(id => pow(id, 100, 100));
    const baseEnemy = current.value.enemyTeam.map(id => pow(id, 100, 100));
    const hydratedPlayer = bossRuntime.applyBossBootstrapToTeam(basePlayer, bootstrap.playerRoster);
    const hydratedEnemy = bossRuntime.applyBossBootstrapToTeam(baseEnemy, bootstrap.enemyRoster);
    assert.ok(hydratedPlayer && hydratedEnemy, `${fixture.bossChallengeId} Combat2 roster hydration must pass`);
    const bootstrapOptions = bossRuntime.bossBootstrapRuntimeOptions(bootstrap);
    const state = new CombatState(hydratedPlayer, hydratedEnemy, { battleMode: 'boss', bossContext: current.value.bossContext, ...bootstrapOptions });
    for (const row of [...bootstrap.playerRoster, ...bootstrap.enemyRoster]) {
      const unit = state.units.find(item => item.pow.id === row.powId);
      assert.ok(unit, `${fixture.bossChallengeId} CombatState receives ${row.powId}`);
      assert.equal(unit.pow.level, row.level, `${fixture.bossChallengeId} level parity`);
      assert.equal(unit.pow.attack, row.stats.atk, `${fixture.bossChallengeId} ATK parity`);
      assert.equal(unit.pow.abilityPower, row.stats.ap, `${fixture.bossChallengeId} AP parity`);
      assert.equal(unit.pow.defense, row.stats.def, `${fixture.bossChallengeId} DEF parity`);
      assert.equal(unit.pow.speed, row.stats.speed, `${fixture.bossChallengeId} Speed parity`);
      assert.equal(unit.pow.maxHp, row.stats.maxHp, `${fixture.bossChallengeId} HP parity`);
      assert.equal(unit.ragePoints, bootstrap.initialRageByPowId[row.powId] || 0, `${fixture.bossChallengeId} Rage parity`);
      assert.equal(unit.initialInitiative, bootstrap.initialInitiativeByPowId[row.powId] || 0, `${fixture.bossChallengeId} initiative parity`);
    }
    const bossMode = BossModeController.from(state, new TurnManager(state));
    assert.ok(bossMode, `${fixture.bossChallengeId} BossModeController receives Boss context`);
    assert.equal(bossMode.snapshot().ragePoints, expectedLegacyRage(fixture.rageStart));
  }

  const bossRequest = fixtureRequests[0];
  assert.equal(bossRequest.ok, true, 'Boss BattleRequest must be valid');
  assert.equal(bossRequest.value.battleMode, 'boss');
  assert.equal(bossRequest.value.bossContext.bossChallengeId, 'daily');
  assert.deepEqual(plain(bossRequest.value.bossContext.phaseConfig), runtime.dailyBossConfig, 'Boss phase config must be snapshotted from legacy');
  assert.equal(bossRequest.value.academicContext.requiresActionQuestions, false, 'pre-qualified Boss must not bypass or duplicate the Main gate');
  assert.equal(entry.canRunBossPilot(bossRequest), true, 'eligible offline Boss must be migratable');
  assert.equal(entry.startBoss(bossStage()), true, 'Boss live route must launch Combat2 after bootstrap parity');
  assert.equal(runtime.window.location.pathname, '/combat2.html', 'Boss live route must navigate to Combat2');
  assert.equal(runtime.legacyStarts.length, 0, 'eligible Boss must not invoke the legacy renderer');
  assert.equal(handoff.storeBattleRequest(bossRequest.value).ok, true, 'Boss contract can be verified without enabling live migration');
  assert.equal(runtime.window.location.pathname, '/combat2.html', 'Boss request storage must not leave Combat2');

  const liveBossRequest = handoff.readBattleRequest();
  assert.equal(liveBossRequest.ok, true);
  const bossResult = contract.createCombat2BattleResult(liveBossRequest.value, {
    result: 'victory', survivingState: { player: [{ id: 'hero-1', hp: 100 }], enemy: [] }, academicResponses: [],
    bossOutcome: { phase: 2, pending: null }
  });
  assert.equal(bossResult.bossOutcome.phase, 2);
  assert.equal(handoff.returnToMain(bossResult).ok, true);
  const bossSettled = await handoff.settleReturnedResult();
  assert.equal(bossSettled.ok, true);
  assert.equal(runtime.bossSettlements.length, 1, 'Boss victory must settle through onBossCombatFinished once');
  assert.equal(runtime.bossSettlements[0].id, 'daily');
  assert.equal(runtime.bossSettlements[0].win, true);
  assert.equal(runtime.rewards.length, 1, 'Boss must not use PvE reward settlement');
  handoff.continueBattleResult(bossResult);
  assert.equal(runtime.shownViews.at(-1), 'boss');

  assert.equal(handoff.storeBattleRequest(liveBossRequest.value).ok, true);
  assert.equal(handoff.publishBattleResult(bossResult).ok, true);
  const duplicateBoss = await handoff.settleReturnedResult();
  assert.equal(duplicateBoss.ok, true);
  assert.equal(duplicateBoss.duplicate, true);
  assert.equal(runtime.bossSettlements.length, 1, 'duplicate Boss result must not re-settle reward or cooldown');

  const defeatRequest = entry.createBossPilotRequest(bossStage());
  assert.equal(defeatRequest.ok, true);
  assert.equal(handoff.storeBattleRequest(defeatRequest.value).ok, true);
  const defeatResult = contract.createCombat2BattleResult(defeatRequest.value, { result: 'defeat', survivingState: { player: [], enemy: [{ id: 'enemy-1', hp: 100 }] }, academicResponses: [] });
  assert.equal(handoff.publishBattleResult(defeatResult).ok, true);
  const defeatSettled = await handoff.settleReturnedResult();
  assert.equal(defeatSettled.ok, true);
  assert.equal(runtime.bossSettlements.length, 2, 'Boss defeat must also settle cooldown path exactly once');
  assert.equal(runtime.bossSettlements[1].win, false);

  console.log(JSON.stringify({
    status: 'PASS',
    checks: [
      'pve-request-contract',
      'academic-question-eligibility',
      'battle-result',
      'academic-settlement',
      'reward-idempotency',
      'return-context',
      'result-consume-once'
      ,'boss-request-contract'
      ,'boss-victory-settlement'
      ,'boss-defeat-settlement'
      ,'boss-reward-cooldown-idempotency'
      ,'boss-phase-signature-mechanics'
      ,'boss-phase-timeline'
    ]
  }));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
