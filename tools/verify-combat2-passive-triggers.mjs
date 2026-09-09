import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const out = await mkdtemp(join(tmpdir(), 'powder-passive-regression-'));
try {
  const context = vm.createContext({ window: {}, console });
  vm.runInContext(await readFile(new URL('js/data.js', root), 'utf8'), context);
  vm.runInContext(await readFile(new URL('js/passive-canonical.js', root), 'utf8'), context);
  const compiler = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));
  const source = fileURLToPath(new URL('src/game/combat2/systems/CombatPassiveRegression.ts', root));
  const rageSource = fileURLToPath(new URL('js/combat-rage-model.js', root));
  execFileSync(process.execPath, [compiler, '--ignoreConfig', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--allowJs', '--rootDir', rootPath, '--outDir', out, source, rageSource], { stdio: 'pipe' });
  const require = createRequire(join(out, 'loader.cjs'));
  const previousWindow = globalThis.window;
  globalThis.window = context.window;
  try {
    const regression = require(join(out, 'src', 'game', 'combat2', 'systems', 'CombatPassiveRegression.js'));
    const report = regression.runCombatPassiveRegression(context.window.POWDER_PASSIVE_CATALOG.definitions);
    console.log(JSON.stringify({ status: 'PASS', ...report }));
  } finally { globalThis.window = previousWindow; }
} finally { await rm(out, { recursive: true, force: true }); }
