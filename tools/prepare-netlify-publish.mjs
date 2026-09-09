import { access, copyFile, cp, readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = resolve(fileURLToPath(new URL('../', import.meta.url)));
const publishPath = resolve(rootPath, 'dist');
const runtimeDirectories = ['assets', 'css', 'js'];
const runtimeFiles = [
  'admin.html',
  'offline.html',
  'privacy.html',
  'terms.html',
  'manifest.webmanifest',
  'robots.txt',
  'service-worker.js',
  'RELEASE-FREEZE-BASELINE-19.9.0.json'
];
const protectedArtifacts = [
  'data/pow-canonical-design.json',
  'reports/pow-canonical-design-master.json',
  'docs/pow-canonical-design-master.md',
  'tools/recover-pow-canonical-design-master.mjs',
  'tools/extract-pow-canonical-workbook.py'
];
const protectedSentinels = [
  'powder-canonical-design-master-recovery-v1',
  'powder-canonical-design-draft-v1',
  'CODEX_HANDOFF_POWDER_COMBAT90',
  'Powder_Combat_Design_Master_01-90.xlsx'
];
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.md', '.mjs', '.py', '.txt', '.webmanifest']);

function extension(path) {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index).toLowerCase();
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

await access(publishPath);
for (const directory of runtimeDirectories) {
  await cp(resolve(rootPath, directory), resolve(publishPath, directory), { recursive: true, force: true });
}
for (const file of runtimeFiles) {
  await copyFile(resolve(rootPath, file), resolve(publishPath, file));
}
for (const ruleFile of ['_headers', '_redirects']) {
  await copyFile(resolve(rootPath, ruleFile), resolve(publishPath, ruleFile));
}

for (const artifact of protectedArtifacts) {
  const candidate = resolve(publishPath, artifact);
  try {
    await access(candidate);
    throw new Error(`Protected recovery artifact entered the publish directory: ${artifact}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

for (const file of await listFiles(publishPath)) {
  if (!textExtensions.has(extension(file)) || (await stat(file)).size > 20_000_000) continue;
  const content = await readFile(file, 'utf8');
  const leakedSentinel = protectedSentinels.find((sentinel) => content.includes(sentinel));
  if (leakedSentinel) {
    throw new Error(`Protected recovery content entered ${file}: ${leakedSentinel}`);
  }
}

console.log(`Netlify publish safety PASS: ${publishPath}`);
