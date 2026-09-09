import { access, copyFile, cp, readFile, readdir, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
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
const protectedRecoverySignatures = [
  {
    label: 'canonical identity/provenance matrix',
    tokens: ['"designNumber"', '"runtimeNumber"', '"currentRuntimeValue"', '"designSources"']
  },
  {
    label: 'canonical decision/blocker matrix',
    tokens: ['"chosenCanonicalValue"', '"needsDesignDecision"', '"blockers"']
  },
  {
    label: 'canonical recovery coverage report',
    tokens: ['"highConfidenceFullDesign"', '"sourceIncomplete"', '"engineSupportRequired"']
  }
];
const allowedHiddenRuntimePrefixes = ['assets/', 'js/'];
const hiddenPowDetailPatterns = [
  { label: 'maxStars >= 7', pattern: /["']?maxStars["']?\s*[:=]\s*(?:[7-9]|[1-9]\d+)/ },
  { label: 'specialStarter = true', pattern: /["']?specialStarter["']?\s*[:=]\s*true\b/ }
];
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.md', '.mjs', '.py', '.txt', '.webmanifest']);
const requiredProtectedRoutes = ['/data/*', '/reports/*', '/docs/*', '/tools/*'];

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

function normalizedRelativePath(file) {
  return relative(publishPath, file).replaceAll('\\', '/');
}

function parseRedirects(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [from, to, rawStatus = '301'] = line.split(/\s+/);
      return { from, to, status: Number.parseInt(rawStatus, 10), force: rawStatus.endsWith('!') };
    });
}

async function verifyRedirectPrecedence() {
  const redirectPath = resolve(publishPath, '_redirects');
  const routes = parseRedirects(await readFile(redirectPath, 'utf8'));
  const fallbackIndex = routes.findIndex((route) => route.from === '/*');
  if (fallbackIndex < 0) throw new Error('Netlify SPA fallback is missing from dist/_redirects');

  for (const [index, path] of requiredProtectedRoutes.entries()) {
    const route = routes[index];
    if (route?.from !== path || route.status !== 404 || !route.force) {
      throw new Error(`Protected Netlify route must be ordered before all other routes: ${path} -> 404!`);
    }
    if (index >= fallbackIndex) {
      throw new Error(`Protected Netlify route is preempted by the SPA fallback: ${path}`);
    }
  }
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
await verifyRedirectPrecedence();

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
  const publishRelativePath = normalizedRelativePath(file);
  const leakedSentinel = protectedSentinels.find((sentinel) => content.includes(sentinel));
  if (leakedSentinel) {
    throw new Error(`Protected recovery content entered ${file}: ${leakedSentinel}`);
  }
  const leakedSignature = protectedRecoverySignatures.find(({ tokens }) => tokens.every((token) => content.includes(token)));
  if (leakedSignature) {
    throw new Error(`Protected recovery structure entered ${file}: ${leakedSignature.label}`);
  }
  const isAllowedRuntime = allowedHiddenRuntimePrefixes.some((prefix) => publishRelativePath.startsWith(prefix));
  const leakedHiddenDetail = !isAllowedRuntime
    ? hiddenPowDetailPatterns.find(({ pattern }) => pattern.test(content))
    : null;
  if (leakedHiddenDetail) {
    throw new Error(`Hidden Pow detail entered non-runtime publish file ${file}: ${leakedHiddenDetail.label}`);
  }
}

console.log(`Netlify publish safety PASS: ${publishPath}`);
