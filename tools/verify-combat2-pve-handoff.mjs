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
  assert.equal(legacy.restoreBattleRecovery(snapshot).allRosterUnits[0].ragePoints, 7, 'canonical surplus wins over lossy legacy alias');
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
    POWDER_DATA: { pows: [{ id: 'hero-1' }, { id: 'enemy-1' }] },
    POWDER_APP: {
      getSave: () => ({ team: ['hero-1'], lessonsDone: ['lesson-1'] }),
      getDungeonLearningGate: () => ({ requirement }),
      getCombatQuestionPool: () => [question, { ...question, id: 'academic-q-invalid', lessonId: 'lesson-x' }],
      grantLearningProgress: (entry) => { learning.push(entry); return { ok: true }; },
      grantBattleRewards: (entry) => { rewards.push(entry); return { ok: true }; },
      onBossCombatFinished: (entry) => { bossSettlements.push(entry); return { ok: true, reward: entry.win ? { coins: 5 } : null }; },
      showView: (view) => { shownViews.push(view); }
    },
    POWDER_ADVENTURE: {
      onBattleFinished: (entry) => { adventureResults.push(entry); },
      restoreCombatContext: (entry) => { restoredContexts.push(entry); }
    }
  };
  window.POWDER_BOSS_ENCOUNTER_V1860 = { encounter: (type) => type === 'daily' ? dailyBossConfig : null };
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
  return { sandbox: vm.createContext(sandbox), window, sessionStorage, localStorage, navigation, learning, rewards, bossSettlements, adventureResults, restoredContexts, shownViews, question, dailyBossConfig };
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

function bossStage() {
  return {
    id: 'challenge-boss-daily', kind: 'boss', bossChallengeId: 'daily',
    enemyIds: ['enemy-1'], enemyCount: 1, scale: 2.15, initiative: 14,
    manaStart: 0.8, rageStart: 35, difficultyLabel: 'BOSS'
  };
}

async function main() {
  const [transactionSafety, handoffEntry, contract, bossRuntime] = await Promise.all([
    text('js/transaction-safety-v2090.js'),
    text('js/combat-entry-v177.js'),
    loadContract(),
    loadBossRuntime()
  ]);
  await verifyRageContract(bossRuntime);
  const runtime = createRuntime();
  vm.runInContext(transactionSafety, runtime.sandbox, { filename: 'transaction-safety-v2090.js' });
  vm.runInContext(handoffEntry, runtime.sandbox, { filename: 'combat-entry-v177.js' });


  const entry = runtime.window.POWDER_COMBAT_ENTRY_V177;
  const handoff = runtime.window.POWDER_COMBAT2_HANDOFF;
  const { CombatState, TurnManager, BossModeController } = bossRuntime;
  const pow = (id, hp, speed = 100) => ({ id, name: id, hp, maxHp: hp, speed, passive: null });
  const bossController = (type, config) => {
    const state = new CombatState([pow('hero-mechanic', 100)], [pow(`boss-${type}`, 1000)], {
      battleMode: 'boss', bossContext: { bossChallengeId: type, bossType: type, phaseConfig: config }
    });
    const turns = new TurnManager(state);
    const controller = BossModeController.from(state, turns);
    assert.ok(controller, `${type} must create a live Boss controller from BattleRequest context`);
    return { state, controller, player: state.activeLiving('player')[0], boss: state.activeLiving('enemy')[0] };
  };
  const dailyMechanic = bossController('daily', runtime.dailyBossConfig);
  dailyMechanic.boss.hp = 490;
  const phase = dailyMechanic.controller.afterAction(dailyMechanic.player);
  assert.equal(phase.phaseChanged, true, 'Boss must transition phase from real HP threshold');
  assert.equal(dailyMechanic.controller.snapshot().phase, 2);
  dailyMechanic.controller.afterAction(dailyMechanic.boss);
  assert.equal(dailyMechanic.controller.snapshot().pending, 'cleanse', 'Daily Boss must arm Blood Hunt before its next action');
  dailyMechanic.controller.beforeEnemyAction(dailyMechanic.boss);
  assert.ok(dailyMechanic.player.hp < dailyMechanic.player.pow.maxHp, 'Uncleansed Blood Hunt must resolve as max-HP damage');

  const promotionConfig = { id: 'promotion', thresholds: [0.5], phasePower: 1.14, phaseSpeed: 1.06, phaseShield: 0.10, signature: { id: 'formation_break', name: 'Phá Trận', cadence: [3, 2], effect: { kind: 'shield-break-antiheal' } } };
  const promotionMechanic = bossController('promotion', promotionConfig);
  promotionMechanic.controller.afterAction(promotionMechanic.boss);
  promotionMechanic.controller.afterAction(promotionMechanic.boss);
  assert.equal(promotionMechanic.controller.snapshot().pending, 'shield-break', 'Promotion Boss must arm its shield-break response window');
  promotionMechanic.boss.shield = 0;
  promotionMechanic.controller.beforeEnemyAction(promotionMechanic.boss);
  assert.equal(promotionMechanic.player.antiHealActionsRemaining, 0, 'Broken promotion shield must interrupt anti-heal punishment');

  const weeklyConfig = { id: 'weekly', thresholds: [0.7, 0.35], phasePower: 1.16, phaseSpeed: 1.08, phaseShield: 0.12, signature: { id: 'cataclysm', name: 'Đại Nạn', cadence: [3, 3, 2], effect: { kind: 'max-hp-aoe' } } };
  const weeklyMechanic = bossController('weekly', weeklyConfig);
  weeklyMechanic.controller.afterAction(weeklyMechanic.boss);
  weeklyMechanic.controller.afterAction(weeklyMechanic.boss);
  assert.equal(weeklyMechanic.controller.snapshot().pending, 'shield-break', 'Weekly Boss must arm Cataclysm shield window');
  weeklyMechanic.controller.beforeEnemyAction(weeklyMechanic.boss);
  assert.ok(weeklyMechanic.player.hp < weeklyMechanic.player.pow.maxHp, 'Unbroken weekly shield must resolve Cataclysm');
  const launched = entry.startMap(stage());
  assert.equal(launched, true, 'canRunPvePilot must launch Combat2 for an eligible offline PvE request');
  assert.equal(runtime.window.location.pathname, '/combat2.html', 'Main entry must navigate to Combat2');

  const request = handoff.readBattleRequest();
  assert.equal(request.ok, true, 'BattleRequest must be stored before Combat2 navigation');
  assert.equal(request.value.battleMode, 'pve');
  assert.equal(request.value.academicContext.requiresActionQuestions, true);
  assert.equal(request.value.academicContext.authority, 'main-learning');
  assert.equal(request.value.academicContext.allowedQuestionPool.length, 1, 'snapshot must exclude ineligible questions');

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

  const settled = await handoff.settleReturnedResult();
  assert.equal(settled.ok, true);
  assert.equal(settled.duplicate, false);
  assert.equal(runtime.learning.length, 2, 'every academic response must settle once');
  assert.equal(runtime.rewards.length, 1, 'victory reward must settle once');
  assert.deepEqual(plain(runtime.rewards[0]), { coins: 25, exp: 15, wins: 1 });
  assert.equal(runtime.adventureResults.length, 1, 'Adventure must receive the battle result once');
  assert.deepEqual(plain(runtime.adventureResults[0].summary.players), [{ knowledgeActions: 2, knowledgeSum: 1 }]);
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

  const bossRequest = entry.createBossPilotRequest(bossStage());
  assert.equal(bossRequest.ok, true, 'Boss BattleRequest must be valid');
  assert.equal(bossRequest.value.battleMode, 'boss');
  assert.equal(bossRequest.value.bossContext.bossChallengeId, 'daily');
  assert.deepEqual(plain(bossRequest.value.bossContext.phaseConfig), runtime.dailyBossConfig, 'Boss phase config must be snapshotted from legacy');
  assert.equal(bossRequest.value.academicContext.requiresActionQuestions, false, 'pre-qualified Boss must not bypass or duplicate the Main gate');
  assert.equal(entry.canRunBossPilot(bossRequest), true, 'eligible offline Boss must be migratable');
  assert.equal(entry.startBoss(bossStage()), false, 'Boss live route must remain on legacy until adaptive bootstrap parity is complete');
  assert.equal(runtime.window.location.pathname, '/', 'Boss migration gate must not navigate before parity');
  assert.equal(handoff.storeBattleRequest(bossRequest.value).ok, true, 'Boss contract can be verified without enabling live migration');
  assert.equal(runtime.window.location.pathname, '/', 'harness-only Boss request must not change Main navigation');

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
    ]
  }));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
