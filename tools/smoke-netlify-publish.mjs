import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = resolve(fileURLToPath(new URL('../', import.meta.url)));
const publishPath = resolve(rootPath, 'dist');
const redirects = (await readFile(resolve(publishPath, '_redirects'), 'utf8'))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [from, to, rawStatus = '301'] = line.split(/\s+/);
    return { from, to, status: Number.parseInt(rawStatus, 10), force: rawStatus.endsWith('!') };
  });

function matches(pattern, pathname) {
  return pattern.endsWith('*') ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern;
}

function safePublishFile(pathname) {
  const candidate = resolve(publishPath, `.${pathname}`);
  return candidate === publishPath || candidate.startsWith(`${publishPath}${sep}`) ? candidate : null;
}

async function regularFile(pathname) {
  const file = safePublishFile(pathname);
  if (!file) return null;
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webp': 'image/webp'
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const matchingRules = redirects.filter((rule) => matches(rule.from, pathname));
    const forced = matchingRules.find((rule) => rule.force);
    const originalFile = await regularFile(pathname === '/' ? '/index.html' : pathname);
    const rule = forced || (!originalFile ? matchingRules[0] : null);
    const file = rule ? await regularFile(rule.to) : originalFile;
    const status = rule?.status || (file ? 200 : 404);
    response.writeHead(status, { 'content-type': contentTypes[extname(file || '')] || 'text/plain' });
    if (file) createReadStream(file).pipe(response);
    else response.end('Not found');
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain' });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const expectedStatuses = new Map([
  ['/js/data.js', 200],
  ['/assets/ui/powder-logo-project.webp', 200],
  ['/data/private.json', 404],
  ['/reports/private.json', 404],
  ['/docs/private.md', 404],
  ['/tools/private.mjs', 404],
  ['/data/pow-canonical-design.json', 404],
  ['/reports/pow-canonical-design-master.json', 404],
  ['/docs/pow-canonical-design-master.md', 404],
  ['/tools/recover-pow-canonical-design-master.mjs', 404],
  ['/tools/extract-pow-canonical-workbook.py', 404]
]);

try {
  await access(resolve(publishPath, 'index.html'));
  for (const [pathname, expected] of expectedStatuses) {
    const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
    if (response.status !== expected) {
      throw new Error(`${pathname}: expected ${expected}, received ${response.status}`);
    }
    console.log(`${response.status} ${pathname}`);
  }
  console.log('Netlify-compatible HTTP smoke PASS');
} finally {
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}
