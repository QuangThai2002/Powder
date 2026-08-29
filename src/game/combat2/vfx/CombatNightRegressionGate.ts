import { LEGACY_EXPANSION_DOMAINS } from '../systems/CombatLegacyDomainEngine';
import { PowView } from '../views/PowView';
import './CombatNightTeardownBridge';
import './CombatNightSupportAssetBridge';
import { PersistentPowStatusVfx } from './PersistentPowStatusVfx';
import {
  NIGHT_STATUS_VFX_DEFAULTS,
  orderedFrameNumbers,
  powVfxDepth
} from './CombatNightVfxLayout';

type NightRegressionCheck = {
  name: string;
  pass: boolean;
  detail: string;
};

export type CombatNightRegressionReport = {
  version: string;
  pass: boolean;
  checks: NightRegressionCheck[];
};

function check(name: string, pass: boolean, detail: string): NightRegressionCheck {
  return { name, pass, detail };
}

function includesAll(values: unknown, required: readonly string[]): boolean {
  if (!Array.isArray(values)) return false;
  const normalized = new Set(values.map((value) => String(value)));
  return required.every((value) => normalized.has(value));
}

export function runCombatNightRegressionGate(): CombatNightRegressionReport {
  const root = globalThis as any;
  const frames = orderedFrameNumbers({ startFrame: 0, endFrame: 11 });
  const depths = [
    powVfxDepth('ground'),
    powVfxDepth('behind'),
    powVfxDepth('body'),
    powVfxDepth('status'),
    powVfxDepth('foreground')
  ];
  const prototype = PowView.prototype as any;
  const persistentPrototype = PersistentPowStatusVfx.prototype as any;
  const tooltip = root.POWDER_COMBAT2_NIGHT_STATUS_TOOLTIPS;
  const domain = root.POWDER_COMBAT2_NIGHT_DOMAIN;
  const support = root.POWDER_COMBAT2_NIGHT_SUPPORT_ASSETS;
  const budget = root.POWDER_COMBAT2_NIGHT_FX_BUDGET;
  const coreTooltipCoverage = [
    'burn', 'poison', 'freeze', 'stun', 'regeneration', 'shield', 'dual-dot'
  ] as const;

  const checks: NightRegressionCheck[] = [
    check(
      'sprite-frame-order',
      frames.length === 12 && frames.every((frame, index) => frame === index),
      `frames=${frames.join(',')}`
    ),
    check(
      'vfx-depth-order',
      depths.every((value, index) => index === 0 || value > depths[index - 1]),
      `depths=${depths.join('<')}`
    ),
    check(
      'poison-ground-anchor',
      NIGHT_STATUS_VFX_DEFAULTS.poison.anchor === 'ground',
      `anchor=${NIGHT_STATUS_VFX_DEFAULTS.poison.anchor}`
    ),
    check(
      'freeze-body-stun-head',
      NIGHT_STATUS_VFX_DEFAULTS.freeze.anchor === 'body' && NIGHT_STATUS_VFX_DEFAULTS.stun.anchor === 'head',
      `freeze=${NIGHT_STATUS_VFX_DEFAULTS.freeze.anchor};stun=${NIGHT_STATUS_VFX_DEFAULTS.stun.anchor}`
    ),
    check(
      'nine-expansion-domains',
      Object.keys(LEGACY_EXPANSION_DOMAINS).length === 9,
      `count=${Object.keys(LEGACY_EXPANSION_DOMAINS).length}`
    ),
    check(
      'projectile-final-owner',
      prototype.__nightProjectileBridgeInstalled === true,
      `installed=${String(prototype.__nightProjectileBridgeInstalled === true)}`
    ),
    check(
      'curated-status-fallback',
      persistentPrototype.__nightCuratedFallbackInstalled === true,
      `installed=${String(persistentPrototype.__nightCuratedFallbackInstalled === true)}`
    ),
    check(
      'persistent-status-dedup',
      prototype.__nightPersistentDedupInstalled === true,
      `installed=${String(prototype.__nightPersistentDedupInstalled === true)}`
    ),
    check(
      'core-status-tooltips',
      Boolean(tooltip)
        && includesAll(tooltip.covered, coreTooltipCoverage)
        && tooltip.combatLogicChanged === false,
      `version=${tooltip?.version ?? 'missing'};covered=${Array.isArray(tooltip?.covered) ? tooltip.covered.join(',') : 'missing'}`
    ),
    check(
      'persistent-heal-shield-lifecycle',
      Boolean(support?.persistentShield)
        && Boolean(support?.persistentRegeneration)
        && Number(support?.maxPersistentImagesPerPow) <= 2
        && support?.persistentLoopTweens === false
        && Boolean(support?.sceneShutdownCleanup)
        && support?.combatLogicChanged === false,
      `version=${support?.version ?? 'missing'};max=${support?.maxPersistentImagesPerPow ?? 'missing'};loops=${String(support?.persistentLoopTweens)}`
    ),
    check(
      'domain-ground-ownership-safety',
      Boolean(domain?.ownerBoundary)
        && Boolean(domain?.clashSeam)
        && domain?.particles === false
        && domain?.tweenLoops === false
        && domain?.depth === -11
        && domain?.combatLogicChanged === false,
      `version=${domain?.version ?? 'missing'};depth=${domain?.depth ?? 'missing'};particles=${String(domain?.particles)};loops=${String(domain?.tweenLoops)}`
    ),
    check(
      'adaptive-fps-source',
      Boolean(root.POWDER_COMBAT2_PERFORMANCE)
        && Boolean(budget)
        && budget?.source === 'POWDER_COMBAT2_FX_TIER',
      `performance=${root.POWDER_COMBAT2_PERFORMANCE?.version ?? 'missing'};night=${budget?.version ?? 'missing'};source=${budget?.source ?? 'missing'}`
    ),
    check(
      'scene-teardown-cleanup',
      Boolean(root.POWDER_COMBAT2_NIGHT_TEARDOWN?.sceneShutdownSafe),
      `version=${root.POWDER_COMBAT2_NIGHT_TEARDOWN?.version ?? 'missing'}`
    ),
    check(
      'heal-shield-img2-assets',
      Boolean(support?.hudSafeScale && support?.ragePulsePreserved),
      `version=${support?.version ?? 'missing'}`
    )
  ];

  const report: CombatNightRegressionReport = {
    version: 'night-22',
    pass: checks.every((entry) => entry.pass),
    checks
  };
  root.POWDER_COMBAT2_NIGHT_REGRESSION = report;

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (report.pass) console.info('[Combat2 Night Regression PASS]', report);
    else console.error('[Combat2 Night Regression FAIL - branch only]', report);
  }
  return report;
}

runCombatNightRegressionGate();
