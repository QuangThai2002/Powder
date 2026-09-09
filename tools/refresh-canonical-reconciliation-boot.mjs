import crypto from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';

const bootUrl = new URL('../js/boot-loader-v21004.js', import.meta.url);
const rootUrl = new URL('../', import.meta.url);
const targets = [
  'js/passive-canonical.js',
  'js/role-system-v9.js',
  'js/skill-details.js',
  'js/skill-loadout.js',
  'js/starter-evolution-runtime.js',
  'js/world-systems-v9.js'
];

const source = await readFile(bootUrl, 'utf8');
const manifestMatch = source.match(/const MANIFEST=(\[[\s\S]*?\]);\r?\nconst SCRIPT_ORDER=/);
const orderMatch = source.match(/const SCRIPT_ORDER=(\[[\s\S]*?\]);\r?\nconst TOTAL_BYTES=/);
if (!manifestMatch || !orderMatch) throw new Error('Boot manifest structure is not recognized.');

const manifest = JSON.parse(manifestMatch[1]);
const scriptOrder = JSON.parse(orderMatch[1]);
for (const path of targets) {
  const bytes = await readFile(new URL(path, rootUrl));
  const fileStat = await stat(new URL(path, rootUrl));
  const entry = { u: path, s: fileStat.size, r: crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12), k: 'script' };
  const index = manifest.findIndex((item) => item.u === path);
  if (index >= 0) manifest[index] = entry;
  else {
    const roleIndex = manifest.findIndex((item) => item.u === 'js/role-system-v9.js');
    manifest.splice(roleIndex >= 0 ? roleIndex : manifest.length, 0, entry);
  }
}

for (let index = 0; index < manifest.length; index += 1) {
  const item = manifest[index];
  const bytes = await readFile(new URL(item.u, rootUrl));
  const fileStat = await stat(new URL(item.u, rootUrl));
  manifest[index] = {
    ...item,
    s: fileStat.size,
    r: crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12)
  };
}

if (!scriptOrder.includes('js/passive-canonical.js')) {
  const roleIndex = scriptOrder.indexOf('js/role-system-v9.js');
  scriptOrder.splice(roleIndex >= 0 ? roleIndex : scriptOrder.length, 0, 'js/passive-canonical.js');
}

const duplicateManifestPaths = manifest
  .map((item) => item.u)
  .filter((path, index, paths) => paths.indexOf(path) !== index);
const duplicateScriptPaths = scriptOrder.filter((path, index, paths) => paths.indexOf(path) !== index);
const passiveOrderIndex = scriptOrder.indexOf('js/passive-canonical.js');
const roleOrderIndex = scriptOrder.indexOf('js/role-system-v9.js');
if (duplicateManifestPaths.length || duplicateScriptPaths.length) {
  throw new Error(`Duplicate boot entries: ${[...duplicateManifestPaths, ...duplicateScriptPaths].join(', ')}`);
}
if (passiveOrderIndex < 0 || roleOrderIndex < 0 || passiveOrderIndex >= roleOrderIndex) {
  throw new Error('passive-canonical.js must load before role-system-v9.js.');
}

const manifestJson = JSON.stringify(manifest);
const orderJson = JSON.stringify(scriptOrder);
const manifestHash = crypto.createHash('sha256').update(manifestJson).digest('hex').slice(0, 16);
let next = source.replace(manifestMatch[1], manifestJson).replace(orderMatch[1], orderJson);
next = next.replace(/MANIFEST_HASH=(['"])[0-9a-f]+\1/, `MANIFEST_HASH="${manifestHash}"`);
if (!next.includes(`MANIFEST_HASH="${manifestHash}"`)) {
  throw new Error('Boot manifest hash declaration was not updated.');
}
await writeFile(bootUrl, next);
console.log(JSON.stringify({
  status: 'PASS',
  entries: manifest.length,
  reconciliationEntries: targets.length,
  manifestHash,
  passiveOrderIndex,
  roleOrderIndex,
  duplicateManifestPaths,
  duplicateScriptPaths
}));
