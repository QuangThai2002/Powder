import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const outputDirectory = await mkdtemp(join(tmpdir(), 'powder-combat2-feature-freeze-'));
const sourcePath = fileURLToPath(new URL('src/game/combat2/systems/CombatFeatureFreezeRegression.ts', root));
const compilerPath = fileURLToPath(new URL('../node_modules/typescript/lib/tsc.js', import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(`[Combat2 Feature Freeze Harness] ${message}`);
}

async function source(relativePath) {
  return readFile(fileURLToPath(new URL(relativePath, root)), 'utf8');
}

async function verifyLegacyPvpFreeze() {
  const timers = [];
  const listeners = [];
  const requests = [];
  const sandbox = {
    console,
    setTimeout: (...args) => { timers.push(args); return 1; },
    clearTimeout: () => {},
    setInterval: (...args) => { timers.push(args); return 1; },
    clearInterval: () => {},
    window: {
      POWDER_COMBAT_FEATURE_FLAGS_V1: {
        PVP_ENABLED: false,
        DOMAIN_EXPANSION_ENABLED: false,
        SIMPLE_DOMAIN_ENABLED: true
      },
      addEventListener: (...args) => listeners.push(args),
      POWDER_ONLINE_V150: { request: (...args) => requests.push(args) }
    }
  };
  vm.runInNewContext(await source('js/pvp-online-v1881.js'), sandbox, { filename: 'pvp-online-v1881.js' });
  const api = sandbox.window.POWDER_PVP_V1881;
  assert(api?.frozen === true && api?.enabled === false, 'legacy PvP must expose a frozen facade');
  assert(api === sandbox.window.POWDER_PVP_V155, 'legacy PvP compatibility aliases must remain intact');
  assert(timers.length === 0, 'frozen PvP must not arm poll, heartbeat, clock, or deferred boot timers');
  assert(listeners.length === 0, 'frozen PvP must not register runtime listeners');
  assert(requests.length === 0, 'frozen PvP must not issue network requests');
  assert(await api.load() === null && await api.challenge() === false, 'frozen PvP entry methods must fail closed');
  return { facade: true, timers: 0, listeners: 0, networkRequests: 0 };
}

async function verifyDynamicDomainFreeze() {
  const scripts = [];
  const document = {
    getElementById: () => null,
    createElement: () => ({ addEventListener: () => {} }),
    head: { appendChild: (node) => scripts.push(String(node.src || '')) }
  };
  const window = {
    POWDER_COMBAT_FEATURE_FLAGS_V1: {
      PVP_ENABLED: false,
      DOMAIN_EXPANSION_ENABLED: false,
      SIMPLE_DOMAIN_ENABLED: true
    }
  };
  vm.runInNewContext(await source('js/combat-arcane-polish-v2160.js'), { console, document, window }, { filename: 'combat-arcane-polish-v2160.js' });
  const forbidden = scripts.filter((path) => /domain-(?:turn-economy|clash|learning|supremacy|server-authority|charge)|pvp-domain-charge/i.test(path));
  assert(forbidden.length === 0, `Expansion-only dynamic modules loaded: ${forbidden.join(', ')}`);
  assert(scripts.some((path) => path.includes('combat-tactical-ai-v2179.js')), 'non-Domain PvE/Boss modules must remain loadable');
  return { expansionModulesLoaded: 0, retainedCombatModulesLoaded: scripts.length };
}

async function verifyLegacyDomainFreeze() {
  class BattleCore {
    constructor(mode = 'pve') {
      this.mode = mode;
      const player = { id: 'p1', powId: 1, name: 'Player', side: 'player', combatRole: 'mage', hp: 100, maxHp: 100, mana: 0, shield: 0, defeated: false, turnsTaken: 0, statuses: {}, customStatuses: {}, buffs: [] };
      const enemy = { id: 'e1', powId: 2, name: 'Enemy', side: 'enemy', combatRole: 'fighter', hp: 100, maxHp: 100, mana: 0, shield: 0, defeated: false, turnsTaken: 0, statuses: {}, customStatuses: {}, buffs: [] };
      this.state = { team: [player], reserves: [], enemies: [enemy], enemyReserves: [], current: player, phase: 'running', finished: false };
      this.allUnits = [player, enemy];
      this.allRosterUnits = this.allUnits;
      this.events = [];
      this.logs = [];
    }
    start() { return true; }
    beginTurn() { return { type: 'turn', unit: this.state.current }; }
    finishCurrent() { return true; }
    effective() { return { def: 100, critRate: 0, critDamage: 100, shieldPower: 0 }; }
    offensiveEffect() { return { damage: 100, impacts: [], targets: [] }; }
    supportEffect() { return { damage: 0, impacts: [], targets: [] }; }
    executeAction() { return true; }
    resolveGuard(_attacker, original) { return original; }
    living(side) { return this.allUnits.filter((unit) => unit.side === side && !unit.defeated && unit.hp > 0); }
    rng() { return 0.5; }
    pushEvent(type, payload = {}) { this.events.push({ type, ...payload }); }
    pushLog(message, kind) { this.logs.push({ message, kind }); }
  }
  const window = {
    POWDER_COMBAT_FEATURE_FLAGS_V1: {
      PVP_ENABLED: false,
      DOMAIN_EXPANSION_ENABLED: false,
      SIMPLE_DOMAIN_ENABLED: true
    },
    POWDER_COMBAT_CORE_V7: { BattleCore },
    POWDER_ENGINE: {
      damageTarget: (target, amount) => {
        const damage = Math.min(target.hp, Math.max(0, Math.round(amount)));
        target.hp -= damage;
        target.defeated = target.hp <= 0;
        return { damage, absorbed: 0 };
      },
      healTarget: (target, amount) => {
        const heal = Math.min(target.maxHp - target.hp, Math.max(0, Math.round(amount)));
        target.hp += heal;
        return heal;
      },
      addCombatBuff: () => true
    }
  };
  vm.runInNewContext(await source('js/domain-system-v15.js'), { console, Date, Math, Object, Set, window }, { filename: 'domain-system-v15.js' });
  const catalog = window.POWDER_DOMAIN_SYSTEM_V15;
  assert(Object.keys(catalog.EXPANSIONS).length === 9, 'legacy Expansion catalog must remain intact');
  assert(Object.values(catalog.EXPANSIONS).filter((entry) => entry.kind === 'special').length === 3, 'legacy special Expansion catalog must remain intact');
  assert(catalog.features?.simpleEnabled === true && catalog.features?.expansionEnabled === false, 'legacy feature state mismatch');

  for (const mode of ['pve', 'boss']) {
    const core = new BattleCore(mode);
    core.configureDomainLoadout('player', { simpleId: 'crimson', simpleLevel: 1, expansionId: 'limitless_void' });
    assert(core.getDomainLoadout('player').expansion.id === 'limitless_void', `${mode} must preserve equipped Expansion ownership`);
    assert(core.canExpandDomain('player', 'limitless_void') === false, `${mode} Expansion eligibility must fail closed`);
    assert(core.expandDomain('player', 'limitless_void') === false, `${mode} Expansion activation must fail closed`);
    assert(core.useTamerSimple('player', 'crimson', 1) === true, `${mode} Simple Domain must remain active`);
    const effective = core.effective(core.state.current);
    assert(effective.critRate === 10 && effective.critDamage === 150, `${mode} Crit Simple Domain bonuses changed`);
  }

  const stale = new BattleCore('pvp');
  stale.configureDomainLoadout('player', { simpleId: 'verdant', simpleLevel: 1, expansionId: 'draw_swords' });
  stale.state.tamerBySide.player.expansion = { id: 'draw_swords', name: 'Rút Kiếm Ra', swords: [{ id: 'flame', name: 'Sword', status: 'Burn' }], remainingActions: 5 };
  assert(stale.activeDomain('player') === null, 'stale Expansion state must not become active');
  assert(stale.setPendingDomainActionScale('player', 0) === 1, 'frozen question scale must remain neutral');
  assert(stale.addLimitlessCorrect('player', 10) === false, 'Infinite Void answer flow must remain disabled');
  stale.finishCurrent(false);
  assert(!stale.events.some((event) => event.type === 'domain-sword'), 'Rút Kiếm must not generate swords while frozen');
  assert(stale.useTamerSimple('player', 'verdant', 1) === true, 'stale frozen Expansion must not block Simple Domain');
  return { catalog: '9/3', pveSimple: true, bossSimple: true, staleExpansionBlocked: true };
}

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
  const dataSandbox = { window: {} };
  vm.runInNewContext(await source('js/data.js'), dataSandbox, { filename: 'data.js' });
  const previousWindow = globalThis.window;
  globalThis.window = dataSandbox.window;
  try {
    const modulePath = join(outputDirectory, 'src', 'game', 'combat2', 'systems', 'CombatFeatureFreezeRegression.js');
    const { runCombatFeatureFreezeRegression } = require(modulePath);
    const combat2 = runCombatFeatureFreezeRegression();
    const [pvp, dynamicDomains, legacyDomains] = await Promise.all([
      verifyLegacyPvpFreeze(),
      verifyDynamicDomainFreeze(),
      verifyLegacyDomainFreeze()
    ]);
    console.log(JSON.stringify({ status: 'PASS', combat2, pvp, dynamicDomains, legacyDomains }));
  } finally {
    globalThis.window = previousWindow;
  }
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
