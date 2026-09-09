import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPowderCanonicalRuntime } from './lib/load-powder-canonical-runtime.mjs';

const rootUrl = new URL('../', import.meta.url);
const rootPath = fileURLToPath(rootUrl);
const slots = ['basic', 'skill1', 'skill2', 'ultimate'];
const mechanicKinds = [
  'coefficients', 'masterEffects', 'multiHit', 'multiTarget', 'mana', 'cooldown',
  'buff', 'debuff', 'status', 'chance', 'heal', 'shield', 'lifesteal',
  'multiStatScaling', 'specialMechanic', 'perTurnLimit', 'perBattleLimit'
];
const placeholder = (value) => /v8_pending|tạm thời|placeholder|demo/i.test(String(value || ''));
const assetPath = (value) => join(rootPath, String(value || '').replace(/^\/+/, ''));
const assetExists = (value) => Boolean(value) && existsSync(assetPath(value));

function sourceSlots(pow) {
  return { basic: pow.abilities?.basic, skill1: pow.abilities?.skills?.[0], skill2: pow.abilities?.skills?.[1], ultimate: pow.abilities?.ultimate };
}

function runtimeSlot(pow, slot) {
  if (slot === 'basic') return pow?.abilities?.basic;
  if (slot === 'ultimate') return pow?.abilities?.ultimate;
  return pow?.abilities?.skills?.[slot === 'skill1' ? 0 : 1];
}

function abilitySourceComplete(source) {
  return Boolean(
    source?.id && source?.name && source?.description && source?.target &&
    Number.isFinite(source?.manaCost) && Number.isFinite(source?.cooldown) &&
    (Number.isFinite(source?.power) || source?.specialMechanic)
  );
}

function abilityEngineGaps(source) {
  const gaps = [];
  const coefficients = Object.keys(source?.coefficients || {});
  const effects = source?.masterEffects || {};
  const effectKeys = Object.keys(effects);
  const add = (kind, detail) => gaps.push({ kind, detail });
  if (coefficients.length) add('coefficients', `coefficients:${coefficients.join('+')}`);
  if (effectKeys.length) add('masterEffects', `masterEffects:${effectKeys.join(',')}`);
  if (Number(source?.hits) > 1) add('multiHit', `hits:${source.hits}`);
  if (Number(source?.manaCost) > 0) add('mana', `manaCost:${source.manaCost}`);
  if (effects.buffs) add('buff', 'masterEffects:buffs');
  if (effects.debuffs) add('debuff', 'masterEffects:debuffs');
  if (['curse'].includes(String(source?.status || '').trim().toLowerCase())) add('status', `status:${source.status}`);
  if (Number.isFinite(Number(source?.chance ?? source?.statusChance))) add('chance', `chance:${source.chance ?? source.statusChance}`);
  if (effects.healHpPct !== undefined || effects.healApPct !== undefined) add('heal', 'masterEffects:heal');
  if (effects.shieldHpPct !== undefined || effects.shieldDefPct !== undefined) add('shield', 'masterEffects:shield');
  if (effects.lifesteal !== undefined || source?.lifesteal !== undefined) add('lifesteal', 'lifesteal');
  if (coefficients.length > 1) add('multiStatScaling', `multiStat:${coefficients.join('+')}`);
  if (source?.specialMechanic) add('specialMechanic', `specialMechanic:${source.specialMechanic}`);
  if (effects.perTurnLimit !== undefined || source?.perTurnLimit !== undefined) add('perTurnLimit', 'perTurnLimit');
  if (effects.perBattleLimit !== undefined || source?.perBattleLimit !== undefined) add('perBattleLimit', 'perBattleLimit');
  return gaps;
}

function independentDesignEvidence(_pow, _category) {
  // No independent design registry is present in this worktree. Runtime catalogs
  // may align with each other, but they cannot certify their own design authority.
  return null;
}

function lastChange(...paths) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%H %cs %s', '--', ...paths], { cwd: rootPath, encoding: 'utf8' }).trim();
  } catch { return 'UNKNOWN'; }
}

async function loadAdapter(window) {
  const out = await mkdtemp(join(tmpdir(), 'powder-reconcile-'));
  const compiler = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));
  const source = fileURLToPath(new URL('src/game/combat2/data/PowderDataAdapter.ts', rootUrl));
  try {
    execFileSync(process.execPath, [compiler, '--ignoreConfig', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--rootDir', rootPath, '--outDir', out, source], { stdio: 'pipe' });
    const require = createRequire(join(out, 'loader.cjs'));
    const previous = globalThis.window;
    globalThis.window = window;
    try { return require(join(out, 'src', 'game', 'combat2', 'data', 'PowderDataAdapter.js')); }
    finally { globalThis.window = previous; }
  } finally { await rm(out, { recursive: true, force: true }); }
}

function issue(pow, category, field, currentValue, evidence, requiredAction) {
  return { powId: pow.id, powName: pow.name, category, field, currentValue, expectedCanonicalEvidence: evidence, requiredAction };
}

function markdown(report) {
  const lines = [
    '# Powder Canonical Reconciliation', '',
    `Generated at ${report.generatedAt}. Strict status: **${report.status}**.`, '',
    `- Total Pow: **${report.summary.totalPow}**`,
    `- Fully canonical: **${report.summary.fullyCanonicalPow}**`,
    `- Pow with issues: **${report.summary.powWithIssues}**`,
    `- Canonical sync: **${report.summary.syncPercent}%**`,
    `- Passive full runtime: **${report.summary.passiveFullRuntime}/${report.summary.totalPow}**`,
    `- Passive design canonical: **${report.summary.passiveCanonicalPass}/${report.summary.totalPow}**`,
    `- Star execution: **${report.summary.starExecutionPass}/${report.summary.totalPow}**`,
    `- Star design canonical: **${report.summary.starCanonicalPass}/${report.summary.totalPow}**`, '',
    '## Source Decision', '',
    '- Runtime rows are loaded in the same data boot order as the player: `data.js` -> master/V8.1 -> role system -> starter evolution.',
    '- `data.js`, master/V8.1, Combat2 and UI are current runtime layers, not independent design authority.',
    '- No independent design registry is available in this worktree, so Passive and Star design status remains `SOURCE_INCOMPLETE` even when runtime layers agree.',
    '- The ten generic Passive mechanics use `passive-canonical.js`, transcribed from explicit legacy runtime numbers.',
    '- V8.1 Core remains separate identity metadata and is never a fallback for Passive.',
    '- Skill identity/prose comes from V8.1 and numeric action fields come from `master-data-v9.js`; unconsumed fields remain explicit engine blockers.', '',
    '## Pow Matrix', '',
    '| PowId | Pow | Stats | Star execution | Star canonical | Basic | S1 | S2 | Ultimate | Passive data | Passive canonical | Image | Runtime | Overall |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'
  ];
  for (const row of report.pows) lines.push(`| ${row.powId} | ${row.powName} | ${row.statsStatus} | ${row.starExecutionStatus} | ${row.starStatus} | ${row.basicStatus} | ${row.skill1Status} | ${row.skill2Status} | ${row.ultimateStatus} | ${row.passiveDataStatus} | ${row.passiveStatus} | ${row.passiveImageStatus} | ${row.passiveRuntimeStatus} | ${row.overallStatus} |`);
  lines.push('', '## Silently Ignored Skill Mechanics', '', '| Mechanic | Action count | Actions |', '|---|---:|---|');
  for (const kind of mechanicKinds) {
    const entry = report.skillMechanics.silentlyIgnored[kind];
    lines.push(`| ${kind} | ${entry.count} | ${entry.actions.join(', ')} |`);
  }
  lines.push('', '## Pyroon Sentinel', '', '```json', JSON.stringify(report.sentinels.pyroon, null, 2), '```');
  lines.push('', '## Individual Blockers', '', '| PowId | Pow | Category | Field | Current value | Canonical evidence | Required action |', '|---|---|---|---|---|---|---|');
  for (const row of report.issues) lines.push(`| ${row.powId} | ${row.powName} | ${row.category} | ${row.field} | ${String(row.currentValue).replace(/\|/g, '\\|')} | ${String(row.expectedCanonicalEvidence).replace(/\|/g, '\\|')} | ${String(row.requiredAction).replace(/\|/g, '\\|')} |`);
  lines.push('', '## Source History', '', '```json', JSON.stringify(report.sourceHistory, null, 2), '```', '');
  return lines.join('\n');
}

async function main() {
  const canonical = await loadPowderCanonicalRuntime(rootUrl);
  const data = canonical.runtimeData;
  const skillCatalog = canonical.window.POWDER_SKILL_V81;
  const kits = skillCatalog?.pows || {};
  const passiveCatalog = canonical.window.POWDER_PASSIVE_CATALOG;
  const skillArt = canonical.window.POWDER_SKILL_ART;
  const pows = Array.isArray(data?.pows) ? data.pows : [];
  const rawPows = Array.isArray(canonical.rawData?.pows) ? canonical.rawData.pows : [];
  const rawById = new Map(rawPows.map((pow) => [pow.id, pow]));
  const adapter = await loadAdapter(canonical.window);
  const imageOwners = new Map();
  for (const pow of pows) {
    if (!assetExists(pow.passiveArt)) continue;
    const hash = createHash('sha256').update(readFileSync(assetPath(pow.passiveArt))).digest('hex');
    const owners = imageOwners.get(hash) || [];
    owners.push(pow.id);
    imageOwners.set(hash, owners);
  }

  const issues = [];
  const rows = [];
  const silentlyIgnored = Object.fromEntries(mechanicKinds.map((kind) => [kind, new Set()]));
  const previous = globalThis.window;
  globalThis.window = canonical.window;
  try {
    for (const pow of pows) {
      const kit = kits[pow.id];
      const runtime = adapter.combatPowById(pow.id);
      const sourceAbilities = sourceSlots(pow);
      const statsValid = runtime && ['hp', 'attack', 'abilityPower', 'defense', 'speed', 'critRate', 'critDamage'].every((key) => Number.isFinite(Number(runtime[key])));
      if (!statsValid) issues.push(issue(pow, 'STATS', 'combatSnapshot', runtime ? 'non-finite field' : 'unresolved', 'data.js structured stats -> PowderDataAdapter', 'Repair the canonical stat snapshot mapping.'));

      const actionStatus = {};
      for (const slot of slots) {
        const source = sourceAbilities[slot];
        const metadata = kit?.skills?.[slot];
        const mapped = runtimeSlot(runtime, slot);
        const identityMapped = Boolean(mapped && metadata && mapped.id === metadata.id && mapped.name === metadata.name && mapped.description === metadata.description && assetExists(skillArt?.get?.(metadata.id)));
        const sourceComplete = abilitySourceComplete(source);
        const engineGaps = abilityEngineGaps(source);
        for (const gap of engineGaps) silentlyIgnored[gap.kind].add(`${pow.id}.${slot}`);
        actionStatus[slot] = !identityMapped
          ? 'MISMATCH'
          : !sourceComplete
            ? 'SOURCE_INCOMPLETE'
            : engineGaps.length
              ? 'ENGINE_SUPPORT_REQUIRED'
              : 'PASS';
        if (!identityMapped) issues.push(issue(pow, slot.toUpperCase(), 'identity/art', mapped?.id || 'missing', metadata ? `${metadata.id} / ${metadata.name}` : 'V8.1 metadata missing', 'Repair ID/name/description/art mapping.'));
        if (!sourceComplete) issues.push(issue(pow, slot.toUpperCase(), 'structuredMechanic', `${source?.id || '(no id)'} / power=${source?.power ?? '(missing)'} / target=${source?.target || '(missing)'}`, `${metadata?.id}: ${metadata?.description || '(missing prose)'}`, 'Supply the missing structured field from approved design evidence; do not infer balance.'));
        if (engineGaps.length) issues.push(issue(pow, slot.toUpperCase(), 'runtimeHandler', engineGaps.map((gap) => gap.detail).join('; '), `${source?.id} has structured current-runtime fields preserved by the adapter.`, 'Implement generic runtime consumption only after approved design evidence exists, then prove positive/negative behavior.'));
      }

      const passive = pow.abilities?.passive;
      const definition = passiveCatalog?.get?.(passive?.id);
      const expectedDescription = passive?.description || definition?.description || '';
      const passiveIdentityOk = Boolean(runtime?.passive && runtime.passive.id === passive?.id && runtime.passive.name === passive?.name);
      const passiveCurrentDataComplete = Boolean(expectedDescription && !placeholder(passive?.id) && !placeholder(expectedDescription));
      const passiveDescriptionOk = Boolean(passiveCurrentDataComplete && runtime?.passive?.description === expectedDescription);
      const passiveDesignEvidence = independentDesignEvidence(pow, 'PASSIVE');
      const passiveDesignStatus = passiveDesignEvidence ? 'PASS' : 'SOURCE_INCOMPLETE';
      const expectedArt = `assets/passives/passive-${String(pow.rosterOrder).padStart(3, '0')}.webp`;
      const imageHashOwners = assetExists(pow.passiveArt) ? imageOwners.get(createHash('sha256').update(readFileSync(assetPath(pow.passiveArt))).digest('hex')) || [] : [];
      const passiveImageOk = pow.passiveArt === expectedArt && passive?.art === expectedArt && assetExists(expectedArt) && imageHashOwners.length === 1;
      const runtimeLive = definition?.runtime === 'LIVE';
      if (!passiveIdentityOk) issues.push(issue(pow, 'PASSIVE', 'id/name', `${runtime?.passive?.id || 'missing'} / ${runtime?.passive?.name || 'missing'}`, `${passive?.id || 'missing'} / ${passive?.name || 'missing'} from data.js`, 'Keep Passive identity separate from V8.1 Core.'));
      if (!passiveDescriptionOk) issues.push(issue(pow, 'PASSIVE', 'description', expectedDescription || '(missing)', definition ? 'Explicit legacy mechanic definition' : 'No complete structured Passive source exists', placeholder(expectedDescription) ? 'Replace placeholder with approved canonical Passive data.' : 'Supply canonical Passive description and structured trigger/effect data.'));
      if (!passiveImageOk) issues.push(issue(pow, 'PASSIVE', 'art', `${passive?.art || 'missing'} / ${pow.passiveArt || 'missing'} / owners=${imageHashOwners.join(',')}`, expectedArt, 'Restore the owner-specific Passive image; do not mask with fallback art.'));
      if (!runtimeLive) issues.push(issue(pow, 'PASSIVE', 'runtimeHandler', definition?.runtime || 'NONE', definition ? `${definition.trigger} -> ${definition.effect.kind}` : 'No structured mechanic evidence', definition ? 'Wire the required context/event into live Combat2 and add positive/negative tests.' : 'Add an approved structured mechanic before implementing runtime behavior.'));
      if (!passiveDesignEvidence) issues.push(issue(pow, 'PASSIVE', 'designCanonicalEvidence', passive?.id || '(missing)', 'No independent design source is registered; current runtime data cannot certify itself.', 'Provide an approved design source that independently assigns this Passive to this Pow.'));

      const dataMax = Number(pow.maxStars);
      const v81Max = Number(skillCatalog?.starCapOverride?.[pow.id] ?? kit?.maxStarWorkbook);
      const starCapOk = Number.isFinite(dataMax) && dataMax === v81Max;
      const starMechanicStatus = !starCapOk
        ? 'DESIGN_CONFLICT'
        : dataMax <= Number(pow.startStars) || Boolean(pow.specialStarter)
          ? 'PASS'
          : 'ENGINE_SUPPORT_REQUIRED';
      const stageStars = Array.from(new Set([
        Number(pow.startStars),
        dataMax,
        ...(kit?.starProgression || []).map((stage) => Number(stage.star))
      ].filter((star) => Number.isFinite(star) && star >= Number(pow.startStars) && star <= dataMax)));
      const starExecutionOk = stageStars.every((star) => {
        const stagePow = adapter.combatPowById(pow.id, star);
        return Boolean(stagePow && slots.every((slot) => {
          const ability = runtimeSlot(stagePow, slot);
          return ability?.id && ability?.name && Number.isFinite(Number(ability.power));
        }));
      });
      const starDesignEvidence = independentDesignEvidence(pow, 'STARS');
      const starStatus = starDesignEvidence
        ? starMechanicStatus
        : 'SOURCE_INCOMPLETE';
      if (!starCapOk) issues.push(issue(pow, 'STARS', 'maxStars', `runtime=${dataMax}; canonical=${v81Max}`, `V8.1 starCapOverride/maxStarWorkbook; rarity=${pow.rarity}; native=${kit?.nativeStar}`, 'Reconcile this cap across progression, UI, saves and Combat2.'));
      if (starMechanicStatus === 'ENGINE_SUPPORT_REQUIRED') issues.push(issue(pow, 'STARS', 'starModification', 'metadata preserved; action coefficients unchanged by star', `${kit?.starProgression?.length || 0} current V8.1 progression stages`, 'Apply each independently approved numeric star modifier in the shared ability resolver; keep prose-only upgrades blocked.'));
      if (!starExecutionOk) issues.push(issue(pow, 'STARS', 'execution', stageStars.join(','), 'Every valid current-runtime star stage must resolve four finite actions.', 'Repair the stage resolver without inventing star balance.'));
      if (!starDesignEvidence) issues.push(issue(pow, 'STARS', 'designCanonicalEvidence', `data.js=${rawById.get(pow.id)?.maxStars}; V8.1=${v81Max}; runtime=${dataMax}`, 'No independent design source is registered; current runtime catalogs cannot certify themselves.', 'Provide approved independent star-cap and star-effect evidence.'));

      const passiveDataStatus = !passiveIdentityOk ? 'MISMATCH' : passiveDescriptionOk ? 'PASS' : 'SOURCE_INCOMPLETE';
      const passiveRuntimeStatus = runtimeLive ? 'PASS' : passiveCurrentDataComplete ? 'ENGINE_SUPPORT_REQUIRED' : 'SOURCE_INCOMPLETE';
      const statuses = [statsValid ? 'PASS' : 'MISMATCH', starStatus, ...slots.map((slot) => actionStatus[slot]), passiveDesignStatus, passiveImageOk ? 'PASS' : 'MISMATCH', passiveRuntimeStatus];
      const rawPow = rawById.get(pow.id);
      rows.push({
        powId: pow.id, powName: pow.name, rarity: pow.rarity, element: pow.element, role: pow.combatRole,
        startStars: pow.startStars, maxStars: pow.maxStars,
        statsStatus: statuses[0], starStatus, starExecutionStatus: starExecutionOk ? 'PASS' : 'FAIL', starMechanicStatus, basicStatus: actionStatus.basic,
        skill1Status: actionStatus.skill1, skill2Status: actionStatus.skill2, ultimateStatus: actionStatus.ultimate,
        passiveId: passive?.id || null, passiveName: passive?.name || null, passiveDescription: expectedDescription || null,
        passiveArt: pow.passiveArt || null, passiveDataStatus, passiveStatus: statuses[6], passiveImageStatus: statuses[7], passiveRuntimeStatus: statuses[8],
        core: kit?.core || null, coreDescription: kit?.coreDescription || null,
        sourceConflictMatrix: {
          stats: { source: 'js/data.js', runtimeConsumer: 'PowderDataAdapter', conflict: false, chosenCanonicalSource: 'POWDER_DATA.stats' },
          stars: { designCanonical: null, currentRuntimeData: `data.js=${rawPow?.maxStars}; V8.1=${v81Max}; runtime=${dataMax}`, combat2: { execution: starExecutionOk, mechanic: starMechanicStatus }, ui: 'V8.1 progression metadata', runtimeConsumer: 'progression + PowderDataAdapter', conflict: !starCapOk, chosenCanonicalSource: null },
          passive: { designCanonical: null, currentRuntimeData: { id: passive?.id, name: passive?.name, description: expectedDescription }, combat2: runtime?.passive || null, ui: 'skill-loadout.js -> POWDER_DATA.abilities.passive', runtimeHandler: passiveRuntimeStatus, conflict: !passiveCurrentDataComplete, chosenCanonicalSource: null },
          actions: Object.fromEntries(slots.map((slot) => {
            const current = sourceAbilities[slot];
            const mapped = runtimeSlot(runtime, slot);
            const ui = kit?.skills?.[slot];
            return [slot, {
              designCanonical: null,
              designStatus: 'SOURCE_INCOMPLETE',
              currentRuntimeData: current ? { id: current.id, power: current.power, target: current.target, manaCost: current.manaCost, cooldown: current.cooldown, coefficients: current.coefficients, masterEffects: current.masterEffects, specialMechanic: current.specialMechanic } : null,
              combat2: mapped ? { id: mapped.id, power: mapped.power, target: mapped.target, manaCost: mapped.manaCost, cooldown: mapped.cooldown, coefficients: mapped.coefficients, masterEffects: mapped.masterEffects, mechanic: mapped.mechanic } : null,
              ui: ui ? { id: ui.id, name: ui.name, description: ui.description } : null,
              runtimeConsumer: 'PowderDataAdapter + SkillActionResolver',
              conflict: actionStatus[slot] !== 'PASS',
              runtimeStatus: actionStatus[slot]
            }];
          }))
        },
        overallStatus: statuses.every((status) => status === 'PASS') ? 'PASS' : 'BLOCKED'
      });
    }
  } finally { globalThis.window = previous; }

  const fullyCanonicalPow = rows.filter((row) => row.overallStatus === 'PASS').length;
  const categories = (category, field) => new Set(issues.filter((row) => row.category === category && (!field || row.field === field)).map((row) => row.powId)).size;
  const starConflictBefore = rawPows.filter((pow) => {
    const kit = kits[pow.id];
    const expected = Number(skillCatalog?.starCapOverride?.[pow.id] ?? kit?.maxStarWorkbook);
    return Number(pow.maxStars) !== expected;
  }).length;
  const ignoredMechanicReport = Object.fromEntries(mechanicKinds.map((kind) => {
    const actions = [...silentlyIgnored[kind]].sort();
    return [kind, { count: actions.length, actions }];
  }));
  const specialStarters = pows.filter((pow) => pow.specialStarter).map((pow) => ({
    powId: pow.id,
    powName: pow.name,
    actions: Object.entries(sourceSlots(pow)).map(([slot, ability]) => ({
      slot,
      mechanic: ability?.specialMechanic || null,
      dataPresent: Boolean(ability?.specialMechanic),
      handlerPresent: false,
      runtimeTestPass: false
    }))
  }));
  const pyroon = rows.find((row) => row.powId === 'pyroon');
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: issues.length ? 'FAIL' : 'PASS',
    sourceHistory: {
      designCanonical: 'SOURCE_INCOMPLETE: no independent design registry is present in this worktree.',
      roster: lastChange('js/data.js'), masterSkills: lastChange('js/master-data-v9.js'), skills: lastChange('js/skill-v81-data.js'), passiveRuntime: lastChange('js/game-engine.js'), combat2Adapter: lastChange('src/game/combat2/data/PowderDataAdapter.ts')
    },
    summary: {
      totalPow: rows.length, fullyCanonicalPow, powWithIssues: rows.length - fullyCanonicalPow,
      syncPercent: rows.length ? Number((fullyCanonicalPow / rows.length * 100).toFixed(2)) : 0,
      passivePass: rows.filter((row) => row.passiveStatus === 'PASS' && row.passiveRuntimeStatus === 'PASS').length,
      passiveFullRuntime: rows.filter((row) => row.passiveRuntimeStatus === 'PASS').length,
      passiveCanonicalPass: rows.filter((row) => row.passiveStatus === 'PASS').length,
      passiveEngineSupportRequired: rows.filter((row) => row.passiveRuntimeStatus === 'ENGINE_SUPPORT_REQUIRED').length,
      passiveRuntimeSourceIncomplete: rows.filter((row) => row.passiveRuntimeStatus === 'SOURCE_INCOMPLETE').length,
      passiveIdMismatch: categories('PASSIVE', 'id/name'), passiveImageMismatch: categories('PASSIVE', 'art'),
      passiveDescriptionMismatch: categories('PASSIVE', 'description'), passiveMissingRuntimeHandler: categories('PASSIVE', 'runtimeHandler'),
      passiveSourceIncomplete: rows.filter((row) => row.passiveStatus === 'SOURCE_INCOMPLETE').length,
      passiveCurrentDataIncomplete: rows.filter((row) => row.passiveDataStatus === 'SOURCE_INCOMPLETE').length,
      starConflictBefore,
      starConflict: rows.filter((row) => row.starMechanicStatus === 'DESIGN_CONFLICT').length,
      starExecutionPass: rows.filter((row) => row.starExecutionStatus === 'PASS').length,
      starCanonicalPass: rows.filter((row) => row.starStatus === 'PASS').length,
      starSourceIncomplete: rows.filter((row) => row.starStatus === 'SOURCE_INCOMPLETE').length,
      starEngineSupportRequired: rows.filter((row) => row.starMechanicStatus === 'ENGINE_SUPPORT_REQUIRED').length,
      basicMismatch: rows.filter((row) => row.basicStatus !== 'PASS').length,
      skill1Mismatch: rows.filter((row) => row.skill1Status !== 'PASS').length, skill2Mismatch: rows.filter((row) => row.skill2Status !== 'PASS').length,
      ultimateMismatch: rows.filter((row) => row.ultimateStatus !== 'PASS').length,
      structuredMechanicMissing: issues.filter((row) => row.field === 'structuredMechanic').length,
      specialMechanicUnsupported: issues.filter((row) => row.field === 'runtimeHandler' && String(row.currentValue).includes('specialMechanic:')).length
    },
    skillMechanics: { silentlyIgnored: ignoredMechanicReport },
    specialStarters,
    sentinels: {
      pyroon: {
        status: 'SOURCE_INCOMPLETE',
        designCanonicalPassive: null,
        currentRuntimeDataPassive: pyroon?.sourceConflictMatrix?.passive?.currentRuntimeData || null,
        combat2Passive: pyroon?.sourceConflictMatrix?.passive?.combat2 || null,
        uiPassive: pyroon?.sourceConflictMatrix?.passive?.ui || null,
        evidence: 'Current runtime layers agree, but no independent design source proves the assignment.'
      }
    },
    pows: rows,
    issues
  };
  await mkdir(new URL('reports/', rootUrl), { recursive: true });
  await mkdir(new URL('docs/', rootUrl), { recursive: true });
  await writeFile(new URL('reports/pow-canonical-reconciliation.json', rootUrl), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(new URL('docs/pow-canonical-reconciliation.md', rootUrl), markdown(report));
  console.log(JSON.stringify({ status: report.status, ...report.summary }));
  if (report.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
