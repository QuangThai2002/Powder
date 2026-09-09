import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const PLAYER_DATA_BOOT_ORDER = Object.freeze([
  'js/master-data-v9.js',
  'js/skill-v81-data.js',
  'js/world-data-v9.js',
  'js/passive-canonical.js',
  'js/role-system-v9.js',
  'js/starter-evolution-runtime.js',
  'js/skill-art-v107.js',
  'js/skill-details.js'
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

export async function loadPowderCanonicalRuntime(rootUrl) {
  const read = (path) => readFile(new URL(path, rootUrl), 'utf8');
  const context = vm.createContext({
    window: {},
    console,
    structuredClone,
    setTimeout,
    clearTimeout
  });

  vm.runInContext(await read('js/data.js'), context, { filename: 'js/data.js' });
  const rawData = clone(context.window.POWDER_DATA);

  for (const path of PLAYER_DATA_BOOT_ORDER) {
    vm.runInContext(await read(path), context, { filename: path });
  }

  return {
    context,
    window: context.window,
    rawData,
    runtimeData: context.window.POWDER_DATA,
    bootOrder: ['js/data.js', ...PLAYER_DATA_BOOT_ORDER]
  };
}

