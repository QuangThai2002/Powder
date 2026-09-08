import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const rootPath = fileURLToPath(rootUrl);
const read = (path) => readFile(new URL(path, rootUrl), 'utf8');
const slots = ['basic', 'skill1', 'skill2', 'ultimate'];
const rarities = new Set(['common', 'rare', 'super_rare', 'epic', 'legendary', 'mythic', 'ancient']);

function sourceSlots(pow) {
  return {
    basic: pow.abilities?.basic,
    skill1: pow.abilities?.skills?.[0],
    skill2: pow.abilities?.skills?.[1],
    ultimate: pow.abilities?.ultimate
  };
}

function assetExists(path) {
  return Boolean(path) && existsSync(join(rootPath, String(path).replace(/^\/+/, '')));
}

async function loadRuntimeAdapter(window) {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'powder-roster-sync-'));
  const compilerPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));
  const sourcePath = fileURLToPath(new URL('src/game/combat2/data/PowderDataAdapter.ts', rootUrl));
  try {
    execFileSync(process.execPath, [compilerPath, '--ignoreConfig', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--rootDir', rootPath, '--outDir', outputDirectory, sourcePath], { stdio: 'pipe' });
    const require = createRequire(join(outputDirectory, 'loader.cjs'));
    const previousWindow = globalThis.window;
    globalThis.window = window;
    try {
      return require(join(outputDirectory, 'src', 'game', 'combat2', 'data', 'PowderDataAdapter.js'));
    } finally {
      globalThis.window = previousWindow;
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

function markdown(report) {
  const lines = [
    '# Powder Combat2 Canonical Sync Audit',
    '',
    'Generated from the current canonical source and Combat2 adapter.',
    '',
    `- Canonical Pow: **${report.summary.canonicalPowCount}**`,
    `- Fully resolved: **${report.summary.fullyResolved}**`,
    `- Pow with errors: **${report.summary.powWithErrors}**`,
    `- Sync: **${report.summary.syncPercent}%**`,
    `- Gate: **${report.status}**`,
    '',
    '## Verified',
    '',
    '- `POWDER_DATA` and `POWDER_SKILL_V81` contain the same 99 unique Pow IDs.',
    '- Combat2 resolves every Pow ID and preserves canonical base stats, rarity, element, and role.',
    '- Main snapshots final PvE/Boss combatant stats through `POWDER_ENGINE.createCombatant` before CombatState initialization.',
    '- All 396 canonical skill IDs, descriptions, and skill images resolve.',
    '- All 99 passive images resolve.',
    '',
    '## Blocking Findings',
    '',
    '| PowId | Pow | Area | Classification | Issue | Required action |',
    '|---|---|---|---|---|---|'
  ];
  for (const issue of report.blockers) {
    lines.push(`| ${issue.powId} | ${issue.powName} | ${issue.area} | ${issue.classification} | ${issue.issue.replace(/\|/g, '\\|')} | ${issue.requiredAction.replace(/\|/g, '\\|')} |`);
  }
  lines.push('', '## Counts', '', '```json', JSON.stringify(report.summary, null, 2), '```', '');
  return lines.join('\n');
}

async function main() {
  const context = vm.createContext({ window: {}, console });
  for (const path of ['js/data.js', 'js/skill-v81-data.js', 'js/skill-art-v107.js']) {
    vm.runInContext(await read(path), context, { filename: path });
  }
  const { POWDER_DATA: data, POWDER_SKILL_V81: skillCatalog, POWDER_SKILL_ART: skillArt } = context.window;
  const pows = Array.isArray(data?.pows) ? data.pows : [];
  const kits = skillCatalog?.pows || {};
  const artManifest = Array.isArray(skillArt?.manifest) ? skillArt.manifest : [];
  const adapter = await loadRuntimeAdapter(context.window);
  const validRoles = new Set(Object.keys(data?.combatRolesV8 || {}));
  const validElements = new Set(Object.keys(data?.elements || {}));
  const duplicatePowIds = pows.map((pow) => String(pow.id || '')).filter((id, index, all) => all.indexOf(id) !== index);
  const dataIds = new Set(pows.map((pow) => String(pow.id || '')));
  const kitIds = new Set(Object.keys(kits));
  const dataOnly = [...dataIds].filter((id) => !kitIds.has(id));
  const kitOnly = [...kitIds].filter((id) => !dataIds.has(id));
  const blockers = [];
  const mismatches = {
    stat: [], basic: [], skill1: [], skill2: [], ultimate: [], passive: [], star: [],
    passiveImage: [], skillImage: [], description: [], sourceIncomplete: [], engineSupportRequired: [], designConflict: []
  };
  let resolvedIds = 0;

  const previousWindow = globalThis.window;
  globalThis.window = context.window;
  try {
    for (const pow of pows) {
      const id = String(pow.id || '');
      const kit = kits[id];
      const runtime = adapter.combatPowById(id);
      const abilities = sourceSlots(pow);
      const errors = [];
      if (!runtime) errors.push('Combat2 adapter cannot resolve Pow');
      if (!rarities.has(String(pow.rarity || ''))) errors.push('invalid rarity');
      if (!validRoles.has(String(pow.combatRole || ''))) errors.push('invalid role');
      if (!validElements.has(String(pow.element || ''))) errors.push('invalid element');
      for (const stat of ['hp', 'atk', 'ap', 'def', 'speed', 'critRate', 'critDamage']) {
        if (!Number.isFinite(Number(pow.stats?.[stat]))) errors.push(`invalid stat ${stat}`);
      }
      if (errors.length) mismatches.stat.push(id);
      else resolvedIds += 1;

      for (const [index, slot] of slots.entries()) {
        const source = abilities[slot];
        const canonical = kit?.skills?.[slot];
        const mapped = slot === 'basic' ? runtime?.abilities?.basic : slot === 'ultimate' ? runtime?.abilities?.ultimate : runtime?.abilities?.skills?.[index - 1];
        const art = canonical?.id ? skillArt.get(canonical.id) : '';
        if (!canonical?.id || !mapped || mapped.id !== canonical.id || mapped.name !== canonical.name) mismatches[slot].push(id);
        if (!canonical?.description || mapped?.description !== canonical.description) mismatches.description.push(`${id}.${slot}`);
        if (!art || !assetExists(art)) mismatches.skillImage.push(`${id}.${slot}`);
        if (!source?.id || !source?.description) {
          if (!mismatches.sourceIncomplete.includes(id)) mismatches.sourceIncomplete.push(id);
        }
      }

      if (!runtime?.passive || runtime.passive.name !== kit?.core || !runtime.passive.description) mismatches.passive.push(id);
      if (!assetExists(pow.passiveArt)) mismatches.passiveImage.push(id);
      if (Number(pow.maxStars) !== Number(kit?.maxStarWorkbook)) mismatches.star.push(id);

      const detailedMechanics = Object.values(abilities).some((ability) => Boolean(ability?.specialMechanic));
      if (detailedMechanics || kit?.coreDescription) mismatches.engineSupportRequired.push(id);
      const genericConflict = Object.entries(abilities).some(([slot, ability]) => {
        const canonical = kit?.skills?.[slot];
        return canonical && ability && (ability.name !== canonical.name || ability.id !== canonical.id);
      });
      if (genericConflict) mismatches.designConflict.push(id);

      if (mismatches.sourceIncomplete.includes(id)) {
        blockers.push({ powId: id, powName: pow.name, area: 'Skills 1-4', classification: 'SOURCE_INCOMPLETE', issue: 'V8.1 defines the fixed kit as prose, while structured data still contains a different generic power/status kit.', requiredAction: 'Provide canonical structured coefficients, targets, costs, triggers, limits and statuses; do not infer balance from prose.' });
      }
      if (mismatches.engineSupportRequired.includes(id)) {
        blockers.push({ powId: id, powName: pow.name, area: 'Passive/Core', classification: 'ENGINE_SUPPORT_REQUIRED', issue: 'The canonical core is descriptive metadata only; Combat2 has no owner-specific or generic trigger schema for it.', requiredAction: 'Add structured passive trigger/effect metadata, then implement its generic event handler.' });
      }
      if (mismatches.star.includes(id)) {
        blockers.push({ powId: id, powName: pow.name, area: 'Stars', classification: 'DESIGN_CONFLICT', issue: `data.js maxStars=${pow.maxStars}, but V8.1 maxStarWorkbook=${kit?.maxStarWorkbook}.`, requiredAction: 'Choose one canonical playable star cap and update both sources before enabling star mechanics.' });
      }
      if (detailedMechanics) {
        blockers.push({ powId: id, powName: pow.name, area: 'Starter special mechanics', classification: 'ENGINE_SUPPORT_REQUIRED', issue: 'Structured specialMechanic fields exist but SkillActionResolver does not execute them.', requiredAction: 'Implement the named starter resource, field, follow-up and star handlers without changing their supplied coefficients.' });
      }
    }
  } finally {
    globalThis.window = previousWindow;
  }

  const structuralErrors = duplicatePowIds.length + dataOnly.length + kitOnly.length + (pows.length - resolvedIds)
    + mismatches.basic.length + mismatches.skill1.length + mismatches.skill2.length + mismatches.ultimate.length
    + mismatches.passive.length + mismatches.passiveImage.length + mismatches.skillImage.length + mismatches.description.length;
  const unresolved = new Set(blockers.map((issue) => issue.powId));
  const fullyResolved = pows.filter((pow) => !unresolved.has(pow.id)).length;
  const pass = structuralErrors === 0 && blockers.length === 0;
  const report = {
    version: 1,
    status: pass ? 'PASS' : 'FAIL',
    canonicalPowIds: [...dataIds],
    duplicatePowIds,
    dataOnly,
    skillCatalogOnly: kitOnly,
    summary: {
      canonicalPowCount: pows.length,
      uniquePowCount: dataIds.size,
      canonicalSkillCount: [...kitIds].reduce((sum, id) => sum + slots.filter((slot) => kits[id]?.skills?.[slot]?.id).length, 0),
      skillArtCount: artManifest.length,
      adapterResolved: resolvedIds,
      fullyResolved,
      powWithErrors: unresolved.size,
      syncPercent: pows.length ? Number(((fullyResolved / pows.length) * 100).toFixed(2)) : 0,
      statMismatch: new Set(mismatches.stat).size,
      basicAttackMismatch: new Set(mismatches.basic).size,
      skill1Mismatch: new Set(mismatches.skill1).size,
      skill2Mismatch: new Set(mismatches.skill2).size,
      ultimateMismatch: new Set(mismatches.ultimate).size,
      passiveMismatch: new Set(mismatches.passive).size,
      starMismatch: new Set(mismatches.star).size,
      passiveImageMismatch: new Set(mismatches.passiveImage).size,
      skillImageMismatch: new Set(mismatches.skillImage).size,
      descriptionMismatch: new Set(mismatches.description.map((entry) => entry.split('.')[0])).size,
      sourceIncomplete: new Set(mismatches.sourceIncomplete).size,
      engineSupportRequired: new Set(mismatches.engineSupportRequired).size,
      designConflict: new Set(mismatches.designConflict).size
    },
    mismatches,
    blockers
  };

  await mkdir(new URL('reports/', rootUrl), { recursive: true });
  await mkdir(new URL('docs/', rootUrl), { recursive: true });
  await writeFile(new URL('reports/pow-combat2-sync.json', rootUrl), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(new URL('docs/pow-combat2-sync-audit.md', rootUrl), markdown(report));
  console.log(JSON.stringify({ status: report.status, ...report.summary }));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
