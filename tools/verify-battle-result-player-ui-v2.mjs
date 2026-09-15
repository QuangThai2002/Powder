import fs from 'node:fs';
import vm from 'node:vm';

const entryPath = new URL('../js/combat-entry-v177.js', import.meta.url);
const scenePath = new URL('../src/game/combat2/scenes/BattleScene.ts', import.meta.url);
const entry = fs.readFileSync(entryPath, 'utf8');
const scene = fs.readFileSync(scenePath, 'utf8');

new vm.Script(entry, { filename: 'js/combat-entry-v177.js' });

const requiredEntry = [
  "function selectBattleMvp(rows)",
  "mvpContributionScore(row,maxima)",
  "POW NỔI BẬT",
  "THỐNG KÊ ĐỘI",
  "Chịu sát thương",
  "Khiên hấp thụ",
  "PHẦN THƯỞNG",
  "KHÔNG CÓ PHẦN THƯỞNG",
  "Phần thưởng đang chờ đồng bộ.",
  "result.value.battleMode==='pve'&&result.value.result==='victory'",
  "console.warn('[Combat2 settlement]'"
];
for (const needle of requiredEntry) {
  if (!entry.includes(needle)) throw new Error(`BattleResult V2 contract missing: ${needle}`);
}

if (entry.includes("Trận đấu đã hoàn thành nhưng phần thưởng chưa thể đồng bộ. [${errorCode}]")) {
  throw new Error('Internal settlement error code is still rendered player-facing');
}
if (/textContent\s*=\s*[^;\n]*errorCode/.test(entry)) {
  throw new Error('errorCode must stay diagnostics-only');
}

const requiredScene = [
  'battleContributions = new Map',
  'recordBattleDamage(actor, target, result.hpDamage, result.shieldDamage)',
  'healingDone += Math.max(0, Math.round(result.healed))',
  'shieldDone += Math.max(0, Math.round(result.shieldGranted))',
  'shieldAbsorbed += shield',
  "players: this.combatState.units.filter((unit) => unit.side === 'player')",
  'battleSummary: this.battleSummary()'
];
for (const needle of requiredScene) {
  if (!scene.includes(needle)) throw new Error(`Resolved-stat observation contract missing: ${needle}`);
}

const mvpWeights = [
  "value.damage/(maxima.damage||1))*.45",
  "value.healing/(maxima.healing||1))*.25",
  "value.shield/(maxima.shield||1))*.15",
  "value.tank/(maxima.tank||1))*.15"
];
for (const needle of mvpWeights) {
  if (!entry.includes(needle)) throw new Error(`MVP weighting changed or missing: ${needle}`);
}

console.log('PASS BattleResult Player UI V2 verifier');
