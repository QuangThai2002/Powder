import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPowderCanonicalRuntime } from './lib/load-powder-canonical-runtime.mjs';

const root = new URL('../', import.meta.url);
const outputDirectory = await mkdtemp(join(tmpdir(), 'powder-combat2-damage-math-'));
const sourcePath = fileURLToPath(new URL('src/game/combat2/systems/CombatDamageMathRegression.ts', root));
const compilerPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));

try {
  execFileSync(process.execPath, [
    compilerPath,
    '--ignoreConfig',
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--skipLibCheck',
    '--allowJs',
    '--rootDir', fileURLToPath(root),
    '--outDir', outputDirectory,
    sourcePath
  ], { stdio: 'pipe' });

  const require = createRequire(join(outputDirectory, 'loader.cjs'));
  const canonical = await loadPowderCanonicalRuntime(root);
  const previousWindow = globalThis.window;
  globalThis.window = canonical.window;
  try {
    const modulePath = join(
      outputDirectory,
      'src', 'game', 'combat2', 'systems', 'CombatDamageMathRegression.js'
    );
    const { runCombatDamageMathRegression } = require(modulePath);
    const report = runCombatDamageMathRegression();
    console.log(JSON.stringify({ status: 'PASS', ...report }));
  } finally {
    globalThis.window = previousWindow;
  }
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
