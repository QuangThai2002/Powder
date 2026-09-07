import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}

const economy = {
  staminaCost: 5,
  firstAttemptStaminaCost: 0,
  defeatStaminaRatio: 0.5,
  firstClearRewards: { coins: 100, exp: 50 },
  repeatRewards: { coins: 35, exp: 18, powCandy: { common: 1 } }
};
const stage1 = { id: '1-1', islandId: 1, number: 1, kind: 'normal', academicMode: 'free-combat', enemyIds: ['enemy-1'], enemyCount: 1, rewards: { coins: 100, exp: 50 }, economy };
const stage2 = { ...stage1, id: '1-2', number: 2, academicMode: 'learning-gated', economy: { ...economy, firstAttemptStaminaCost: undefined } };

function runtimeSandbox() {
  const localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage(), navigation = [];
  const location = { href: 'http://powder.test/', pathname: '/', assign(value) { const url = new URL(String(value), this.href); this.href = url.href; this.pathname = url.pathname; navigation.push(url.href); } };
  const window = { localStorage, sessionStorage, location, addEventListener() {}, setTimeout() { return 0; }, clearTimeout() {}, dispatchEvent() {}, POWDER_DATA: { pows: [{ id: 'hero-1' }, { id: 'enemy-1' }] } };
  const sandbox = vm.createContext({ window, document: { readyState: 'complete', addEventListener() {} }, localStorage, sessionStorage, location, URL, JSON, Date, Promise, Map, Set, Math, console, crypto: { randomUUID: (() => { let value = 0; return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`; })() }, CustomEvent: class {} });
  return { sandbox, window, localStorage, sessionStorage, navigation };
}

async function createRuntime() {
  const runtime = runtimeSandbox();
  vm.runInContext(await source('js/dungeon-economy-v1.js'), runtime.sandbox, { filename: 'dungeon-economy-v1.js' });
  const dungeon = runtime.window.POWDER_DUNGEON_ECONOMY_V1;
  const state = { adventure: dungeon.normalizeAdventure({}), coins: 0, exp: 0, wins: 0, powCandies: { common: 0, rare: 0, legendary: 0 }, knowledge: 17, dailyBossCredits: 3, lessonsDone: [], team: ['hero-1'], owned: { 'hero-1': { level: 10 } } };
  const academic = [], adventureResults = [];
  let gateReady = false;
  const question = { id: 'learned-q', lessonId: 'lesson-1', conceptId: 'concept-1', language: 'ZH', prompt: 'Nǐ hǎo?', answer: 'Xin chào', options: ['Xin chào', 'Tạm biệt'] };
  runtime.window.POWDER_APP = {
    getSave: () => plain(state),
    getDungeonLearningGate: () => ({ ready: gateReady, requirement: { Rank: 0, Curriculum: { name: 'HSK1' }, RequiredLessonIDs: ['lesson-1'], RequiredConceptIDs: ['concept-1'], RequiredMastery: 60 } }),
    getCombatQuestionPool: () => [question, { ...question, id: 'unseen-q', lessonId: 'lesson-unseen' }],
    grantLearningProgress: (entry) => { academic.push(entry); return { ok: true }; },
    getDungeonAttemptPreview: (stage) => dungeon.attemptPreview(stage, state.adventure),
    beginDungeonAttempt: ({ battleId, stage }) => { const out = dungeon.beginAttempt(stage, state.adventure, battleId); if (out.ok) state.adventure = out.adventure; return out; },
    cancelDungeonAttempt: (battleId) => { const out = dungeon.cancelAttempt(state.adventure, battleId); if (out.ok) state.adventure = out.adventure; return out; },
    settleDungeonBattle: ({ battleId, result }) => {
      const out = dungeon.settleAttempt(state.adventure, battleId, result);
      if (!out.ok || out.duplicate) return out;
      state.adventure = out.adventure;
      state.coins += out.reward.coins;
      state.exp += out.reward.exp;
      state.powCandies.common += out.reward.powCandy.common;
      if (result === 'victory') state.wins += 1;
      return { ...out, balances: plain(state) };
    },
    showView() {}
  };
  runtime.window.POWDER_ADVENTURE = { onBattleFinished: (entry) => adventureResults.push(entry), restoreCombatContext() {} };
  vm.runInContext(await source('js/transaction-safety-v2090.js'), runtime.sandbox, { filename: 'transaction-safety-v2090.js' });
  vm.runInContext(await source('js/combat-entry-v177.js'), runtime.sandbox, { filename: 'combat-entry-v177.js' });
  return { ...runtime, dungeon, state, academic, adventureResults, question, setGateReady(value) { gateReady = value; } };
}

function battleResult(request, result, responses = []) {
  return { version: 1, battleId: request.battleId, battleMode: 'pve', result, survivingState: {}, rewardOutcome: {}, academicOutcome: { responses, summary: { players: [] } }, progressionOutcome: {}, bossOutcome: {}, returnContext: request.returnContext, finishedAt: Date.now() };
}

async function finish(runtime, request, result, responses = []) {
  runtime.window.location.pathname = '/combat2.html';
  runtime.window.location.href = `http://powder.test/combat2.html?battle=${request.battleId}`;
  const value = battleResult(request, result, responses);
  assert.equal(runtime.window.POWDER_COMBAT2_HANDOFF.returnToMain(value).ok, true);
  return { value, settled: await runtime.window.POWDER_COMBAT2_HANDOFF.settleReturnedResult() };
}

async function main() {
  const runtime = await createRuntime(), entry = runtime.window.POWDER_COMBAT_ENTRY_V177, handoff = runtime.window.POWDER_COMBAT2_HANDOFF;
  const knowledgeBefore = runtime.state.knowledge, bossCreditsBefore = runtime.state.dailyBossCredits;

  const first = entry.createPvePilotRequest(stage1);
  assert.equal(first.ok, true);
  assert.equal(first.value.academicContext.requiresActionQuestions, false, 'Stage 1 bypasses the academic gate');
  assert.deepEqual(plain(first.value.academicContext.allowedQuestionPool), [], 'Stage 1 creates zero questions');
  assert.equal(first.value.rewardContext.attempt.staminaCost, 0, 'Stage 1 first attempt is free');
  assert.equal(entry.canRunPvePilot(first), true, 'Stage 1 is eligible without learned content');
  assert.equal(entry.startMap(stage1), true, 'Stage 1 enters Combat2');
  const firstRequest = handoff.readBattleRequest().value;
  assert.equal(runtime.state.adventure.dungeonStamina.current, 100);
  const firstFinish = await finish(runtime, firstRequest, 'victory');
  assert.equal(firstFinish.settled.ok, true);
  assert.equal(runtime.state.coins, 100);
  assert.equal(runtime.state.exp, 50);
  assert.equal(runtime.state.adventure.dungeonProgress['1-1'].firstClearClaimed, true);
  assert.equal(runtime.state.adventure.dungeonProgress['1-1'].clearCount, 1);
  assert.equal(runtime.state.adventure.dungeonSettlements[firstRequest.battleId].claimId, 'dungeon:first-clear:1-1');

  assert.equal(handoff.storeBattleRequest(firstRequest).ok, true);
  assert.equal(handoff.publishBattleResult(firstFinish.value).ok, true);
  const reopen = await handoff.settleReturnedResult();
  assert.equal(reopen.duplicate, true, 'reopened result is consumed once');
  assert.equal(runtime.state.coins, 100, 'reopened result cannot duplicate first clear');

  runtime.window.location.pathname = '/';
  runtime.window.location.href = 'http://powder.test/';
  assert.equal(entry.startMap(stage1), true, 'Stage 1 replay remains free-combat academically');
  const replayRequest = handoff.readBattleRequest().value;
  assert.equal(replayRequest.academicContext.requiresActionQuestions, false);
  assert.equal(runtime.state.adventure.dungeonStamina.current, 95, 'Stage 1 replay costs stamina');
  await finish(runtime, replayRequest, 'victory');
  assert.deepEqual(plain(runtime.state.powCandies), { common: 1, rare: 0, legendary: 0 });
  assert.equal(runtime.state.coins, 135);
  assert.equal(runtime.state.exp, 68);
  assert.equal(runtime.state.adventure.dungeonProgress['1-1'].clearCount, 2);
  assert.equal(runtime.state.adventure.dungeonSettlements[replayRequest.battleId].claimId, `dungeon:repeat:${replayRequest.battleId}`);
  assert.equal(runtime.state.knowledge, knowledgeBefore, 'repeat never grants Knowledge');
  assert.equal(runtime.state.dailyBossCredits, bossCreditsBefore, 'free combat never grants Daily Boss learning credit');

  runtime.window.location.pathname = '/'; runtime.window.location.href = 'http://powder.test/';
  assert.equal(entry.startMap(stage1), true);
  const defeatRequest = handoff.readBattleRequest().value;
  assert.equal(runtime.state.adventure.dungeonStamina.current, 90);
  await finish(runtime, defeatRequest, 'defeat');
  assert.equal(runtime.state.adventure.dungeonStamina.current, 93, 'defeat spends floor(5 * 0.5) = 2');
  assert.equal(runtime.state.coins, 135, 'defeat grants no reward');
  assert.equal(runtime.state.adventure.dungeonProgress['1-1'].clearCount, 2, 'defeat does not increment clearCount');

  const clean = runtime.dungeon.normalizeAdventure({});
  const freeDefeat = runtime.dungeon.beginAttempt(stage1, clean, 'c2-freefail');
  const freeDefeatResult = runtime.dungeon.settleAttempt(freeDefeat.adventure, 'c2-freefail', 'defeat');
  assert.equal(freeDefeatResult.receipt.staminaSpent, 0, 'failed first free attempt costs zero stamina');

  runtime.window.location.pathname = '/'; runtime.window.location.href = 'http://powder.test/';
  const blocked = entry.createPvePilotRequest(stage2);
  assert.equal(blocked.value.academicContext.gateReady, false);
  assert.equal(entry.canRunPvePilot(blocked), false, 'Stage 2 missing prerequisites is blocked');
  assert.equal(entry.startMap(stage2), false, 'Stage 2 cannot fall back around the academic gate');
  const tamperedStage2 = entry.createPvePilotRequest({ ...stage2, academicMode: 'free-combat' });
  assert.equal(tamperedStage2.value.academicContext.requiresActionQuestions, true, 'Stage number prevents a Stage 2 free-combat bypass');
  runtime.state.lessonsDone = ['lesson-1'];
  runtime.setGateReady(true);
  const eligible = entry.createPvePilotRequest(stage2);
  assert.equal(eligible.value.academicContext.requiresActionQuestions, true);
  assert.equal(eligible.value.academicContext.allowedQuestionPool.length, 1, 'Stage 2 pool contains learned material only');
  assert.equal(eligible.value.academicContext.allowedQuestionPool[0].id, runtime.question.id);
  assert.equal(entry.canRunPvePilot(eligible), true, 'eligible Stage 2 enters Combat2');
  assert.equal(entry.startMap(stage2), true);
  const stage2Request = handoff.readBattleRequest().value;
  assert.equal(runtime.state.adventure.dungeonStamina.current, 88, 'Stage 2 charges every attempt');
  await finish(runtime, stage2Request, 'defeat', [{ powId: 'hero-1', correct: false, question: runtime.question }]);
  assert.equal(runtime.state.adventure.dungeonStamina.current, 91, 'Stage 2 defeat uses configured partial cost');
  assert.equal(runtime.state.knowledge, knowledgeBefore);
  assert.equal(runtime.state.dailyBossCredits, bossCreditsBefore);
  assert.equal(runtime.adventureResults.filter(row => row.win).length, 2, 'only victories progress the Adventure map');

  const dataSource = await source('js/adventure-data.js');
  assert.match(dataSource, /academicMode:n===1\?'free-combat':'learning-gated'/);
  assert.match(dataSource, /repeatRewards:\{coins:/);
  vm.runInContext(dataSource, runtime.sandbox, { filename: 'adventure-data.js' });
  const islands = runtime.window.POWDER_ADVENTURE_DATA.islands;
  assert.equal(islands.length, 12);
  assert.ok(islands.every((island) => island.stages[0].academicMode === 'free-combat'), 'every dungeon starts with free combat');
  assert.ok(islands.every((island) => island.stages.slice(1).every((stage) => stage.academicMode === 'learning-gated')), 'every Stage 2+ remains learning-gated');
  const appSource = await source('js/app.js');
  assert.match(appSource, /settleDungeonBattle/);
  assert.match(appSource, /dungeon-settlement:/);
  assert.doesNotMatch(await source('js/dungeon-economy-v1.js'), /knowledge|dailyBoss/i, 'Dungeon economy is independent of Knowledge and Boss credits');

  console.log(JSON.stringify({ status: 'PASS', checks: [
    'stage1-no-learning-gate', 'stage1-zero-questions', 'stage1-first-attempt-free', 'stage1-first-clear',
    'stage1-replay-stamina', 'repeat-coins-exp-powcandy-only', 'repeat-no-knowledge', 'stage2-prerequisite-block',
    'stage2-eligible', 'learned-question-pool-only', 'first-clear-once', 'defeat-no-reward',
    'configured-partial-defeat-cost', 'result-reopen-dedupe', 'no-daily-boss-credit', 'no-repeat-knowledge',
    'boss-knowledge-independent', 'persistent-attempt-and-settlement-receipts', 'adventure-victory-only-progression', 'combat2-live-entry'
  ] }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
