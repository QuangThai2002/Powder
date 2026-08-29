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
      'debuff-tooltips',
      Boolean(root.POWDER_COMBAT2_NIGHT_STATUS_TOOLTIPS),
      `version=${root.POWDER_COMBAT2_NIGHT_STATUS_TOOLTIPS?.version ?? 'missing'}`
    ),
    check(
      'domain-ground-identity',
      Boolean(root.POWDER_COMBAT2_NIGHT_DOMAIN),
      `version=${root.POWDER_COMBAT2_NIGHT_DOMAIN?.version ?? 'missing'}`
    ),
    check(
      'adaptive-fps-source',
      Boolean(root.POWDER_COMBAT2_PERFORMANCE && root.POWDER_COMBAT2_NIGHT_FX_BUDGET),
      `performance=${root.POWDER_COMBAT2_PERFORMANCE?.version ?? 'missing'};night=${root.POWDER_COMBAT2_NIGHT_FX_BUDGET?.version ?? 'missing'}`
    ),
    check(
      'scene-teardown-cleanup',
      Boolean(root.POWDER_COMBAT2_NIGHT_TEARDOWN?.sceneShutdownSafe),
      `version=${root.POWDER_COMBAT2_NIGHT_TEARDOWN?.version ?? 'missing'}`
    ),
    check(
      'heal-shield-img2-assets',
      Boolean(root.POWDER_COMBAT2_NIGHT_SUPPORT_ASSETS?.hudSafeScale && root.POWDER_COMBAT2_NIGHT_SUPPORT_ASSETS?.ragePulsePreserved),
      `version=${root.POWDER_COMBAT2_NIGHT_SUPPORT_ASSETS?.version ?? 'missing'}`
    )
  ];

  const report: CombatNightRegressionReport = {
    version: 'night-16',
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
