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
    get length() { return values.size; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    key(index) { return [...values.keys()][index] ?? null; }
  };
}

function createDocument() {
  return {
    readyState: 'complete',
    body: {
      dataset: {},
      appendChild() {},
      insertAdjacentHTML() {}
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return { style: {}, dataset: {}, appendChild() {}, click() {} }; }
  };
}

async function loadArtifactModule() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    localStorage: createStorage(),
    document: createDocument(),
    URL
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(await source('js/world-data-v9.js'), context, { filename: 'js/world-data-v9.js' });
  vm.runInContext(await source('js/artifact-module.js'), context, { filename: 'js/artifact-module.js' });
  return context.POWDER_ARTIFACT_MODULE;
}

async function loadSkillPresentationRuntime() {
  const pyroonAbilities = {
    basic: { id: 'pyroon.basic', name: 'Hỏa Tiễn Thăm Dò', power: 82, type: 'physical' },
    skills: [
      { id: 'pyroon.skill1', name: 'Xuyên Tâm Hỏa Tuyến', power: 118, manaCost: 22, cooldown: 2 },
      { id: 'pyroon.skill2', name: 'Mồi Lửa Tập Kích', power: 0, manaCost: 30, cooldown: 3 }
    ],
    ultimate: { id: 'pyroon.ultimate', name: 'Vũ Điệu Bảy Tia', power: 48, manaCost: 32 }
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    structuredClone,
    requestAnimationFrame(callback) { callback(); return 1; },
    localStorage: createStorage(),
    document: createDocument(),
    POWDER_DATA: {
      pows: [{ id: 'pyroon', name: 'Pyroon', startStars: 1, maxStars: 1, abilities: pyroonAbilities }]
    },
    POWDER_ENGINE: {},
    POWDER_CONFIG: { storageKey: 'powder-readiness-test' },
    POWDER_SKILL_V81: {
      pows: {
        pyroon: {
          nativeStar: 1,
          skills: {
            basic: { id: 'pyroon.basic' },
            skill1: { id: 'pyroon.skill1' },
            skill2: { id: 'pyroon.skill2' },
            ultimate: { id: 'pyroon.ultimate' }
          },
          starProgression: []
        }
      }
    },
    POWDER_SKILL_DETAILS: {},
    POWDER_SKILL_ART: {}
  };
  context.window = context;
  context.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext(await source('js/combat-rage-model.js'), context, { filename: 'js/combat-rage-model.js' });
  vm.runInContext(await source('js/skill-loadout.js'), context, { filename: 'js/skill-loadout.js' });
  return context;
}

const sourceContracts = [];
const runtimeContracts = [];
const browserOnlyContracts = [
  'select a starter in the real DOM and persist/reload the resulting save',
  'perform Offline reset snapshot/reset/reload',
  'confirm Online reset remains visibly blocked without deleting local/cloud state',
  'navigate Main -> Adventure -> 1-1 -> Combat2 -> BattleResult -> Main twice',
  'observe Mồi Lửa damage, Burn refresh, Focus gain and mark-end feedback in Phaser',
  'observe five Ultimate ray hits and player-scale Rage text in the rendered combat UI'
];

const appSource = await source('js/app.js');
const indexSource = await source('index.html');
const adventureSource = await source('js/adventure-map.js');
const skillSource = await source('js/skill-loadout.js');
const battleSceneSource = await source('src/game/combat2/scenes/BattleScene.ts');
const presentationSource = await source('src/game/combat2/systems/CombatPyroonPresentation.ts');

assert.match(appSource, /const defaults=\(\)=>\(\{[^\n]*coins:500/);
assert.match(appSource, /chestsOwned:\{common:5,rare:0,super_rare:0,epic:0,legendary:0,mythic:0,ancient:0\}/);
assert.match(appSource, /P\.owned\[id\]=\{stars:1,level:1,powExp:0,shards:16,copies:1/);
assert.match(appSource, /Reset tiến độ Online cần endpoint server-authoritative/);
assert.match(indexSource, /Starter gốc bắt đầu từ 1★, Cấp 1 và có 16 Mảnh/);
sourceContracts.push(
  'fresh defaults declare 500 Coin, 240 Tinh Tệ via canonical world state, five Common PowBall and zero Artifact Tickets',
  'starter assignment source declares 1★, level 1, one copy and 16 shards',
  'Online reset source fails closed pending a server-authoritative endpoint'
);

assert.match(adventureSource, /function isFreeCombatOnboarding\(stage\)/);
assert.match(adventureSource, /RequiredLessonIDs:\[\],RequiredConceptIDs:\[\],RequiredMastery:0/);
assert.match(adventureSource, /if\(!gate\.ready\)\{startStudy\(stage\);return/);
sourceContracts.push(
  'Adventure 1-1 has the explicit no-learning onboarding contract',
  'later Adventure stages retain the learning gate before combat entry'
);

assert.match(skillSource, /function resourceText/);
assert.match(skillSource, /RAGE\.formatPlayerRageCost\(RAGE\.rules\.ultimateCost\)/);
assert.doesNotMatch(skillSource, /SOURCE_INCOMPLETE|passiveValue|renderPassiveMechanic/);
assert.match(battleSceneSource, /presentPyroonMechanicEvents\(result\.mechanicEvents\)/);
assert.match(battleSceneSource, /buildPyroonMechanicPresentation/);
assert.match(presentationSource, /Maps resolved state into display-only cues/);
sourceContracts.push(
  'skill-loadout delegates Ultimate Rage copy to the shared player projection authority',
  'BattleScene forwards resolved Mồi Lửa events into a display-only presentation mapper'
);

const playerRageSurfacePaths = [
  'js/skill-loadout.js',
  'src/game/combat2/data/PowderDataAdapter.ts',
  'src/game/combat2/scenes/BattleScene.ts',
  'src/game/combat2/views/Combat2112LegacyHudBridgePatch.ts',
  'src/game/combat2/views/Combat2113SkillCommandPanelPatch.ts',
  'src/game/combat2/views/Combat2196ArenaPresentationPatch.ts',
  'src/game/combat2/views/Combat27UiPatch.ts',
  'src/game/combat2/views/Combat28MultiTargetPatch.ts'
];
const forbiddenInternalRage = /(?:4 Nộ|NỘ\s*4\/8|NỘ\s*-\s*4\b)/iu;
for (const path of playerRageSurfacePaths) {
  assert.doesNotMatch(await source(path), forbiddenInternalRage, `${path} must not expose internal Rage units`);
}
sourceContracts.push('all active player Rage text surfaces contain no literal 4 Nộ, NỘ 4/8 or NỘ -4 leak');

const skillRuntime = await loadSkillPresentationRuntime();
const rage = skillRuntime.POWDER_COMBAT_RAGE_MODEL;
const skillLoadout = skillRuntime.POWDER_SKILL_LOADOUT;
assert.ok(rage && skillLoadout, 'Rage and skill presentation runtimes boot together');
assert.equal(rage.rules.ready, 4);
assert.equal(rage.rules.ultimateCost, 4);
assert.equal(rage.rules.max, 8);
assert.equal(rage.toPlayerRagePoints(4), 100);
assert.equal(rage.formatPlayerRageBalance(4), 'NỘ 100/200');
assert.equal(rage.formatPlayerRageSpend(4, 0), 'NỘ -100 · CÒN 0');
assert.equal(
  skillLoadout.resourceText({ manaCost: 32 }, 'ultimate'),
  '100 Nộ · 32 Mana · Một kẻ địch'
);
runtimeContracts.push(
  'shared Rage runtime keeps internal ready/cost/max 4/4/8 and projects them to player 100/100/200',
  'skill-loadout runtime renders Pyroon Ultimate as 100 Nộ · 32 Mana'
);

const artifact = await loadArtifactModule();
assert.ok(artifact, 'artifact module booted');
const firstArtifact = artifact.data.artifacts[0];
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
  getUpgradePreview: () => ({ current: 0, max: 10, available: 1, need: 1, canUpgrade: true })
});
assert.equal(artifact.collectionMarkup(), '');

const instance = {
  instanceId: 'artifact-instance-1',
  artifactId: firstArtifact.id,
  upgradeLevel: 0,
  acquiredAt: 1,
  isLocked: true
};
owned = { [firstArtifact.id]: 1 };
instances = { [instance.instanceId]: instance };
assert.equal(artifact.getState().instances[instance.instanceId].isLocked, true);
const artifactMarkup = artifact.collectionMarkup();
assert.match(artifactMarkup, new RegExp(firstArtifact.name));
assert.match(artifactMarkup, /data-artifact-detail="artifact-instance-1"/);
assert.doesNotMatch(artifactMarkup, /\?\?\?|Chưa sở hữu|silhouette/i);
assert.equal((artifactMarkup.match(/<article\b/g) || []).length, 1);
runtimeContracts.push(
  'artifact collection runtime renders zero cards at zero owned',
  'one acquired locked artifact renders exactly one usable discovery card while preserving consume protection'
);

console.log(JSON.stringify({
  status: 'PASS',
  sourceContract: {
    result: 'PASS',
    tested: sourceContracts
  },
  runtimeContract: {
    result: 'PASS',
    tested: runtimeContracts
  },
  browserOnlyContract: {
    result: 'NOT_TESTED_BY_THIS_VERIFIER',
    requiresRealBrowser: browserOnlyContracts
  },
  boundaries: {
    sourceAssertionsAreBrowserProof: false,
    regexIsBrowserProof: false,
    onlineReset: 'BLOCKED_PENDING_SERVER_AUTHORITATIVE_ENDPOINT'
  }
}, null, 2));
