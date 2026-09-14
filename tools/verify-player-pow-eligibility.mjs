import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = {
  console,
  crypto: globalThis.crypto,
  setTimeout,
  clearTimeout,
  URL,
  location: { pathname: '/', href: 'http://localhost/' },
  document: {
    addEventListener() {},
    querySelector() { return null; },
    documentElement: { classList: { toggle() {} } },
  },
};
context.window = context;
vm.createContext(context);

async function load(path) {
  const source = await readFile(new URL(path, root), 'utf8');
  vm.runInContext(source, context, { filename: path });
}

await load('js/data.js');
await load('js/player-pow-eligibility-v1.js');

const D = context.POWDER_DATA;
const policy = context.POWDER_PLAYER_POW_ELIGIBILITY_V1;
assert.equal(policy.diagnostics().canonicalTotal, 99);
assert.equal(policy.diagnostics().playerVisible, 90);
assert.equal(policy.diagnostics().hidden, 9);
assert.equal(policy.diagnostics().valid, true);

const hiddenIds = [
  'noxabyss',
  'frostmaw',
  'magmorax',
  'venomarch',
  'luxarion',
  'tempestrix',
  'starter_fire_flarion',
  'starter_water_aquelion',
  'starter_leaf_sylvion',
];
assert.equal(hiddenIds.filter((id) => !policy.isPlayerEligible(id)).length, 9);

const roleMutationIds = [
  'voltfang', 'ignivar', 'volcarnos', 'stoneback', 'tidecrest', 'blazetalon',
  'venomtail', 'frostpelt', 'ironmane', 'bramblet', 'coralyn', 'sunfeather',
  'thorncrest', 'galehowl', 'stormcoil', 'nightclaw', 'thunderos', 'umbrael',
  'calderion', 'terrakor', 'pyrion', 'aquarion', 'ferronyx', 'glacior',
  'vilexis', 'solarion', 'verdantis', 'stormeon', 'zephyrion',
];
for (const id of roleMutationIds) {
  const pow = D.pows.find((item) => item.id === id);
  assert.ok(pow, `missing role mutation sentinel ${id}`);
  pow.maxStars = 7;
}
assert.equal(D.pows.filter((pow) => Number(pow.maxStars) >= 7 || pow.specialStarter === true).length, 38);
assert.equal(policy.diagnostics().canonicalTotal, 99);
assert.equal(policy.diagnostics().playerVisible, 90);
assert.equal(policy.diagnostics().hidden, 9);
assert.equal(policy.diagnostics().valid, true);
assert.equal(policy.isPlayerEligible('voltfang'), true);

await load('js/adventure-data.js');
const stages = context.POWDER_ADVENTURE_DATA.islands.flatMap((island) => island.stages);
const rawHiddenStageCount = stages.filter((stage) => policy.containsHiddenPow(stage.enemyIds)).length;
assert.equal(stages.length, 230);
assert.equal(rawHiddenStageCount, 51);
const sanitizedStages = stages.map((stage) => policy.sanitizeStage(stage));
assert.equal(sanitizedStages.filter((stage) => policy.containsHiddenPow(stage.enemyIds)).length, 0);
assert.equal(stages.filter((stage) => policy.containsHiddenPow(stage.enemyIds)).length, 51, 'raw stage data must remain unchanged');
assert.equal(policy.resolvePlayerPowId('noxabyss'), 'umbrael');
assert.equal(policy.resolvePlayerPowId('tempestrix'), 'zephyrion');

await load('js/powball-system.js');
const powball = context.POWBALL_SYSTEM;
assert.equal(powball.validateRates().length, 0);
for (const rarity of powball.RARITY_ORDER) {
  assert.equal(powball.getPool(rarity).some((pow) => !policy.isPlayerEligible(pow)), false);
  const rates = powball.getRates(rarity);
  assert.ok(rates.length > 0, `empty effective rates for ${rarity}`);
  assert.ok(Math.abs(rates.reduce((sum, row) => sum + row.chance, 0) - 100) < 0.0001);
  for (let index = 0; index < 1000; index += 1) {
    const random = () => (index + 0.5) / 1000;
    const rolledRarity = powball.rollRarity(rarity, random);
    const result = powball.pickPow(powball.getPool(rolledRarity), random);
    assert.ok(result && policy.isPlayerEligible(result), `${rarity} produced hidden Pow`);
  }
}
assert.equal(powball.getPool('ancient').length, 0);
assert.equal(powball.getConfiguredRates('ancient').some((row) => row.rarity === 'ancient'), true);
assert.equal(powball.getRates('ancient').some((row) => row.rarity === 'ancient'), false);
assert.equal(powball.play({ pow: D.pows.find((pow) => pow.id === 'noxabyss') }), false);

const history = [
  { powId: 'pyroon', time: 1 },
  { powId: 'noxabyss', time: 2 },
  { powId: 'starter_fire_flarion', time: 3 },
];
assert.equal(JSON.stringify(policy.filterPlayerHistory(history).map((entry) => entry.powId)), JSON.stringify(['pyroon']));
assert.equal(history.length, 3, 'old history must be preserved, not deleted');

context.addEventListener = () => {};
context.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
context.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
context.POWDER_APP = {
  getSave: () => ({ team: ['pyroon', 'noxabyss'], starterId: 'pyroon', lessonsDone: [] }),
  getDungeonLearningGate: () => ({ requirement: {} }),
  getCombatQuestionPool: () => [{
    id: 'q1', lessonId: 'lesson-1', conceptId: 'concept-1', language: 'ZH',
    prompt: 'Q?', answer: 'A', options: ['A', 'B'],
  }],
  onBossCombatFinished() {},
};
context.POWDER_COMBAT2_BOSS_BOOTSTRAP = {
  buildPve: (_stage, input) => ({ playerRoster: input.playerIds, enemyRoster: input.enemyIds }),
  build: (_stage, input) => ({ playerRoster: input.playerIds, enemyRoster: input.enemyIds }),
};
context.POWDER_BOSS_ENCOUNTER_V1860 = { encounter: () => ({ phases: [] }) };
await load('js/combat-entry-v177.js');
const entry = context.POWDER_COMBAT_ENTRY_V177;
const pve = entry.createPvePilotRequest({
  id: 'audit-stage', islandId: 1, number: 1, enemyIds: ['noxabyss', 'pyroon'],
  enemyCount: 2, rewards: {},
});
assert.equal(pve.ok, true);
assert.equal(JSON.stringify([...pve.value.enemyTeam]), JSON.stringify(['umbrael', 'pyroon']));
assert.equal(JSON.stringify([...pve.value.playerTeam]), JSON.stringify(['pyroon']));

const localBoss = entry.createBossPilotRequest({
  id: 'challenge-boss-weekly', kind: 'boss', bossChallengeId: 'weekly',
  enemyIds: ['noxabyss'], enemyCount: 1,
});
assert.equal(localBoss.ok, true);
assert.equal(JSON.stringify([...localBoss.value.enemyTeam]), JSON.stringify(['umbrael']));

const serverBoss = entry.createBossPilotRequest({
  id: 'challenge-boss-weekly', kind: 'boss', bossChallengeId: 'weekly',
  enemyIds: ['noxabyss'], enemyCount: 1, serverCombatSessionId: 'server-1',
});
assert.equal(serverBoss.ok, false);

assert.equal(D.pows.length, 99, 'player eligibility must not remove data needed by authenticated admin tools');
assert.ok(D.pows.some((pow) => pow.id === 'noxabyss'));

const bootSource = await readFile(new URL('js/boot-loader-v21004.js', root), 'utf8');
const order = JSON.parse(bootSource.match(/const SCRIPT_ORDER=(\[[\s\S]*?\]);\r?\nconst TOTAL_BYTES=/)?.[1] || '[]');
const dataIndex = order.indexOf('js/data.js');
assert.equal(order[dataIndex + 1], 'js/player-pow-eligibility-v1.js');
assert.equal(order.filter((path) => path === 'js/player-pow-eligibility-v1.js').length, 1);

const adminSource = await readFile(new URL('admin.html', root), 'utf8');
assert.equal(adminSource.includes('js/player-pow-eligibility-v1.js'), false, 'authenticated admin keeps its separate raw catalog');
assert.equal(adminSource.includes('js/data.js'), true);
const eligibilitySource = await readFile(new URL('js/player-pow-eligibility-v1.js', root), 'utf8');
assert.equal(/combatTest|location\.search|URLSearchParams/.test(eligibilitySource), false, 'player gate must not expose query-based bypass');

console.log(JSON.stringify({
  status: 'PASS',
  canonicalTotal: policy.diagnostics().canonicalTotal,
  playerVisible: policy.diagnostics().playerVisible,
  hidden: policy.diagnostics().hidden,
  literalHiddenAfterRoleMutation: 38,
  rawStages: stages.length,
  rawHiddenStages: rawHiddenStageCount,
  sanitizedHiddenStages: 0,
  ancientPlayerPool: powball.getPool('ancient').length,
  oldHistoryPreserved: history.length,
  playerHistoryVisible: policy.filterPlayerHistory(history).length,
  serverHiddenBossRejected: true,
  playerQueryBypass: false,
  adminCatalogSeparate: true,
}));
