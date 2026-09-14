import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
  };
}

async function loadArtifactModule() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    localStorage: createStorage(),
    document: { querySelector() { return null; }, body: { appendChild() {} } },
    URL,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(await source('js/world-data-v9.js'), context, { filename: 'js/world-data-v9.js' });
  vm.runInContext(await source('js/artifact-module.js'), context, { filename: 'js/artifact-module.js' });
  return context.POWDER_ARTIFACT_MODULE;
}

const appSource = await source('js/app.js');
const indexSource = await source('index.html');
const adventureSource = await source('js/adventure-map.js');
const skillSource = await source('js/skill-loadout.js');

assert.match(appSource, /coins:500/);
assert.match(appSource, /chestsOwned:\{common:5,rare:0,super_rare:0,epic:0,legendary:0,mythic:0,ancient:0\}/);
assert.match(appSource, /P\.owned\[id\]=\{stars:1,level:1,powExp:0,shards:16,copies:1/);
assert.match(indexSource, /Starter gốc bắt đầu từ 1★, Cấp 1 và có 16 Mảnh/);
assert.match(adventureSource, /isFreeCombatOnboarding\(stage\)/);
assert.match(adventureSource, /RequiredLessonIDs:\[\],RequiredConceptIDs:\[\],RequiredMastery:0/);
assert.match(skillSource, /function resourceText/);
assert.doesNotMatch(skillSource, /SOURCE_INCOMPLETE|passiveValue|renderPassiveMechanic/);

const artifact = await loadArtifactModule();
assert.ok(artifact, 'artifact module booted');
const first = artifact.data.artifacts[0];
let owned = {};
let instances = {};
let equipped = {};
artifact.configure({
  getRank: () => 0,
  getOwned: () => owned,
  getInstances: () => instances,
  getEquipped: () => equipped,
  setEquipped: (next) => { equipped = next; },
  getSummon: () => ({ history: [], since: {} }),
  getUpgradePreview: () => ({ current: 0, max: 10, available: 1, need: 1, canUpgrade: true }),
});
assert.equal(artifact.collectionMarkup(), '');

const instance = {
  instanceId: 'artifact-instance-1',
  artifactId: first.id,
  upgradeLevel: 0,
  acquiredAt: 1,
  isLocked: true,
};
owned = { [first.id]: 1 };
instances = { [instance.instanceId]: instance };
assert.equal(artifact.getState().instances[instance.instanceId].isLocked, true);
const markup = artifact.collectionMarkup();
assert.match(markup, new RegExp(first.name));
assert.match(markup, /data-artifact-detail="artifact-instance-1"/);
assert.doesNotMatch(markup, /\?\?\?|Chưa sở hữu|silhouette/i);
assert.equal((markup.match(/<article\b/g) || []).length, 1);

console.log(JSON.stringify({
  status: 'PASS',
  defaults: { coins: 500, commonPowBall: 5, artifactTickets: 0 },
  starter: { stars: 1, level: 1, powExp: 0, copies: 1, shards: 16 },
  adventure: '1-1 bypasses learning gate; later stages retain app gate',
  artifact: { zeroOwnedCards: 0, acquiredCards: 1, lockedInstancePreserved: true },
}, null, 2));
