import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataPath = path.join(root, 'js', 'data.js');
const legacyToken = ['pow', 'combat', '512'].join('-');
const canonicalPrefix = 'assets/pow-beta12/';
const sourceExtensions = new Set(['.js', '.mjs', '.ts', '.html', '.css', '.json']);
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  '.vite',
  'assets'
]);

function readCatalog() {
  const source = fs.readFileSync(dataPath, 'utf8').replace(/^\uFEFF/, '');
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(source, { filename: dataPath }).runInContext(context, {
    timeout: 5000
  });

  const catalog = context.window.POWDER_DATA;
  if (!catalog || !Array.isArray(catalog.pows)) {
    throw new Error('js/data.js did not expose window.POWDER_DATA.pows');
  }

  return catalog;
}

function walkTextFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(absolute, output);
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) {
      output.push(absolute);
    }
  }

  return output;
}

function findLegacyReferences() {
  const references = [];

  for (const file of walkTextFiles(root)) {
    if (path.resolve(file) === path.resolve(fileURLToPath(import.meta.url))) {
      continue;
    }

    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes(legacyToken)) {
      continue;
    }

    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes(legacyToken)) {
        references.push({
          file: path.relative(root, file).replaceAll(path.sep, '/'),
          line: index + 1
        });
      }
    });
  }

  return references;
}

function countLegacyImages() {
  const directory = path.join(root, 'assets', legacyToken);
  if (!fs.existsSync(directory)) {
    return 0;
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(webp|png|jpe?g)$/i.test(entry.name))
    .length;
}

function main() {
  const catalog = readCatalog();
  const pows = catalog.pows;
  const missing = [];
  const malformed = [];
  const nonCanonical = [];
  const assetOwners = new Map();

  for (const pow of pows) {
    const id = String(pow?.id || '').trim();
    const asset = String(pow?.asset || '').replace(/^\/+/, '');

    if (!id || !asset) {
      malformed.push({ id: id || '(missing id)', asset: asset || '(missing asset)' });
      continue;
    }

    if (!asset.startsWith(canonicalPrefix)) {
      nonCanonical.push({ id, asset });
    }

    const absolute = path.resolve(root, asset);
    if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute)) {
      missing.push({ id, asset });
    }

    const owners = assetOwners.get(asset) ?? [];
    owners.push(id);
    assetOwners.set(asset, owners);
  }

  const duplicates = [...assetOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([asset, owners]) => ({ asset, owners }));
  const legacyReferences = findLegacyReferences();
  const legacyImageCount = countLegacyImages();

  console.log('\nPowder canonical asset audit');
  console.log('===========================');
  console.log(`Catalog Pow:          ${pows.length}`);
  console.log(`Missing assets:       ${missing.length}`);
  console.log(`Malformed entries:    ${malformed.length}`);
  console.log(`Non-canonical paths:  ${nonCanonical.length}`);
  console.log(`Duplicate assets:     ${duplicates.length}`);
  console.log(`Legacy image files:   ${legacyImageCount}`);
  console.log(`Legacy source refs:   ${legacyReferences.length}`);

  if (missing.length) {
    console.error('\nMissing canonical assets:');
    for (const item of missing) {
      console.error(`- ${item.id}: ${item.asset}`);
    }
  }

  if (malformed.length) {
    console.error('\nMalformed catalog entries:');
    for (const item of malformed) {
      console.error(`- ${item.id}: ${item.asset}`);
    }
  }

  if (nonCanonical.length) {
    console.warn('\nCatalog paths outside assets/pow-beta12:');
    for (const item of nonCanonical) {
      console.warn(`- ${item.id}: ${item.asset}`);
    }
  }

  if (duplicates.length) {
    console.warn('\nShared Pow portrait paths:');
    for (const item of duplicates) {
      console.warn(`- ${item.asset}: ${item.owners.join(', ')}`);
    }
  }

  if (legacyReferences.length) {
    console.warn(`\nSource files still referencing assets/${legacyToken}:`);
    for (const item of legacyReferences) {
      console.warn(`- ${item.file}:${item.line}`);
    }
    console.warn('\nLegacy assets are NOT safe to delete yet.');
  } else {
    console.log('\nNo legacy source references remain; legacy deletion can be reviewed safely.');
  }

  if (missing.length || malformed.length) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error('[Powder asset audit] fatal:', error);
  process.exitCode = 1;
}
