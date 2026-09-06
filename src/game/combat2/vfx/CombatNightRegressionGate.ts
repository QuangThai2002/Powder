import { LEGACY_EXPANSION_DOMAINS } from '../systems/CombatLegacyDomainEngine';
import { PowView } from '../views/PowView';
import { resolveCombat2172MeleeRole } from './Combat2172ProfessionImpactFeedback';
import { runCombatVfxRegistryRegression } from './CombatVfxRegistry';
import './CombatNightTeardownBridge';
import './CombatNightSupportAssetBridge';
import { installCombatNightAffectedPowEnvelopeBridge } from './CombatNightAffectedPowEnvelopeBridge';
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

function rangeMatches(value: unknown, start: number, end: number): boolean {
  return Array.isArray(value)
    && Number(value[0]) === start
    && Number(value[1]) === end;
}

installCombatNightAffectedPowEnvelopeBridge();

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
  const tooltip = root.POWDER_COMBAT2_NIGHT_STATUS_TOOLTIPS;
  const domain = root.POWDER_COMBAT2_NIGHT_DOMAIN;
  const support = root.POWDER_COMBAT2_NIGHT_SUPPORT_ASSETS;
  const statusAssets = root.POWDER_COMBAT2_NIGHT_STATUS_ASSETS;
  const persistentStatus = root.POWDER_COMBAT2_NIGHT_PERSISTENT_STATUS;
  const envelope = root.POWDER_COMBAT2_NIGHT_AFFECTED_POW_ENVELOPE;
  const budget = root.POWDER_COMBAT2_NIGHT_FX_BUDGET;
  const projectileBridge = root.POWDER_COMBAT2_NIGHT_PROJECTILE;
  const roleAttacks = root.POWDER_COMBAT2_NIGHT_ROLE_ATTACKS;
  const professionQa = root.POWDER_COMBAT2_PROFESSION_RUNTIME_TEST;
  const powSignature = root.POWDER_COMBAT2_POW_SIGNATURE;
  const arenaPresentation = root.POWDER_COMBAT2_ARENA_PRESENTATION;
  const fairyPresentation = root.POWDER_COMBAT2_FAIRY_ANIME_PRESENTATION;
  const highFantasyVfx = root.POWDER_COMBAT2_HIGH_FANTASY_VFX;
  const ultimateVfx = root.POWDER_COMBAT2_ULTIMATE_FX;
  const vfxRegistryRegression = runCombatVfxRegistryRegression();
  const teardown = root.POWDER_COMBAT2_NIGHT_TEARDOWN;
  const leakAudit = typeof teardown?.getSceneLeakAuditSnapshot === 'function'
    ? teardown.getSceneLeakAuditSnapshot()
    : null;
  const coreTooltipCoverage = [
    'burn', 'poison', 'freeze', 'stun', 'regeneration', 'shield', 'dual-dot'
  ] as const;
  const allEnvelopeCoverage = [
    'control-immunity', 'freeze', 'stun', 'silence', 'paralysis', 'frostbite', 'chill',
    'anti-heal', 'attack-down', 'ap-down', 'defense-down', 'accuracy-down', 'slow',
    'burn', 'poison', 'regeneration', 'guard', 'tenacity-up', 'crit-up', 'evasion-up',
    'attack-up', 'ap-up', 'defense-up', 'speed-up', 'shield', 'revive-marker'
  ] as const;

  const checks: NightRegressionCheck[] = [
    check(
      'sprite-frame-order',
      frames.length === 12 && frames.every((frame, index) => frame === index),
      `frames=${frames.join(',')}`
    ),
    check(
      'real-status-atlas-contract',
      Boolean(statusAssets)
        && statusAssets?.version === 'night-38'
        && statusAssets?.mode === 'real-spritesheet-ordered-frames'
        && Number(statusAssets?.totalFrames) === 52
        && Number(statusAssets?.frameWidth) === 80
        && Number(statusAssets?.frameHeight) === 80
        && statusAssets?.oneSpritePerPow === true
        && statusAssets?.orderedFrames === true
        && statusAssets?.realArtworkFrames === true
        && statusAssets?.proceduralStatusAnimation === false
        && statusAssets?.particleEmitters === false
        && statusAssets?.tweenLoops === false,
      `version=${statusAssets?.version ?? 'missing'};mode=${statusAssets?.mode ?? 'missing'};frames=${statusAssets?.totalFrames ?? 'missing'};real=${String(statusAssets?.realArtworkFrames)};procedural=${String(statusAssets?.proceduralStatusAnimation)}`
    ),
    check(
      'real-status-frame-ranges',
      rangeMatches(statusAssets?.ranges?.burn, 0, 11)
        && rangeMatches(statusAssets?.ranges?.poison, 12, 23)
        && rangeMatches(statusAssets?.ranges?.stun, 24, 35)
        && rangeMatches(statusAssets?.ranges?.freeze, 36, 51),
      `burn=${statusAssets?.ranges?.burn ?? 'missing'};poison=${statusAssets?.ranges?.poison ?? 'missing'};stun=${statusAssets?.ranges?.stun ?? 'missing'};freeze=${statusAssets?.ranges?.freeze ?? 'missing'}`
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
      NIGHT_STATUS_VFX_DEFAULTS.freeze.anchor === 'body'
        && NIGHT_STATUS_VFX_DEFAULTS.stun.anchor === 'head',
      `freeze=${NIGHT_STATUS_VFX_DEFAULTS.freeze.anchor};stun=${NIGHT_STATUS_VFX_DEFAULTS.stun.anchor}`
    ),
    check(
      'all-affected-pow-status-envelope',
      Boolean(envelope)
        && envelope?.version === 'night-41'
        && envelope?.simultaneousStatusesVisible === true
        && envelope?.oneGraphicsPerAffectedPow === true
        && envelope?.cardWideStatusFrameRetired === true
        && envelope?.dedicatedStatusSpriteSheetsPreserved === true
        && envelope?.supportAssetsExpandedAroundPow === true
        && envelope?.particleEmitters === false
        && envelope?.tweenLoops === false
        && includesAll(envelope?.covered, allEnvelopeCoverage)
        && envelope?.combatLogicChanged === false,
      `version=${envelope?.version ?? 'missing'};covered=${Array.isArray(envelope?.covered) ? envelope.covered.length : 'missing'};simultaneous=${String(envelope?.simultaneousStatusesVisible)};graphics=${String(envelope?.oneGraphicsPerAffectedPow)}`
    ),
    check(
      'nine-expansion-domains',
      Object.keys(LEGACY_EXPANSION_DOMAINS).length === 9,
      `count=${Object.keys(LEGACY_EXPANSION_DOMAINS).length}`
    ),
    check(
      'vietnamese-melee-role-normalization',
      resolveCombat2172MeleeRole('Đỡ đòn') === 'tank'
        && resolveCombat2172MeleeRole('Đấu sĩ') === 'fighter'
        && resolveCombat2172MeleeRole('Hiệp sĩ') === 'knight'
        && resolveCombat2172MeleeRole('Sát thủ') === 'assassin',
      `tank=${resolveCombat2172MeleeRole('Đỡ đòn')};fighter=${resolveCombat2172MeleeRole('Đấu sĩ')};knight=${resolveCombat2172MeleeRole('Hiệp sĩ')};assassin=${resolveCombat2172MeleeRole('Sát thủ')}`
    ),
    check(
      'projectile-final-owner',
      prototype.__nightProjectileBridgeInstalled === true
        && prototype.playAttackLunge?.__powderCombat2FinalAttackOwner === true
        && typeof projectileBridge?.version === 'string'
        && projectileBridge?.runtimeEntryPoint === 'PowView.playAttackLunge'
        && projectileBridge?.finalAttackOwnerGuard === true
        && projectileBridge?.roleForwarding === true
        && projectileBridge?.elementForwarding === true
        && projectileBridge?.meleeSourceCommitCue === true
        && projectileBridge?.meleeActorApproachDisabled === true
        && projectileBridge?.meleeContactAccent === true
        && Array.isArray(projectileBridge?.meleeRolesUseLocalHop)
        && ['tank', 'fighter', 'knight', 'assassin'].every((role) => projectileBridge.meleeRolesUseLocalHop.includes(role))
        && projectileBridge?.allDedicatedOwners === true,
      `installed=${String(prototype.__nightProjectileBridgeInstalled === true)};ownerGuard=${String(prototype.playAttackLunge?.__powderCombat2FinalAttackOwner === true)};version=${projectileBridge?.version ?? 'missing'};entry=${projectileBridge?.runtimeEntryPoint ?? 'missing'};role=${String(projectileBridge?.roleForwarding)};meleeCue=${String(projectileBridge?.meleeSourceCommitCue)};localHop=${String(projectileBridge?.meleeActorApproachDisabled)};contactAccent=${String(projectileBridge?.meleeContactAccent)}`
    ),
    check(
      'profession-attack-routing',
      Boolean(roleAttacks)
        && roleAttacks?.version === '2.20.1'
        && roleAttacks?.routes?.marksman === 'anime-arrow-trail-source-to-target'
        && roleAttacks?.routes?.mage === 'anime-elemental-nucleus-source-to-target'
        && roleAttacks?.routes?.enchanter === 'anime-hex-nucleus-source-to-target'
        && roleAttacks?.routes?.healer === 'anime-restoration-ribbon-source-to-target'
        && roleAttacks?.routes?.musician === 'anime-chord-note-source-to-target'
        && roleAttacks?.routes?.tank === 'anime-shield-bash-contact-no-projectile'
        && roleAttacks?.routes?.fighter === 'anime-fist-impact-contact-no-projectile'
        && roleAttacks?.routes?.knight === 'anime-heavy-slash-contact-no-projectile'
        && roleAttacks?.routes?.assassin === 'anime-dual-critical-slash-contact-no-projectile'
        && includesAll(roleAttacks?.rangedRoles, ['marksman', 'mage', 'enchanter', 'healer', 'musician'])
        && includesAll(roleAttacks?.noProjectileRoles, ['tank', 'fighter', 'knight', 'assassin'])
        && Number(roleAttacks?.healerScaleVsMage) === 1
        && Number(roleAttacks?.assassinSlashScaleVsKnight) === 1
        && roleAttacks?.elementColorPreserved === true
        && roleAttacks?.oneAttackObjectFamilyPerAction === true
        && roleAttacks?.particleEmitters === false
        && roleAttacks?.tweenLoops === false
        && roleAttacks?.combatLogicChanged === false,
      `version=${roleAttacks?.version ?? 'missing'};healer=${roleAttacks?.healerScaleVsMage ?? 'missing'};assassin=${roleAttacks?.assassinSlashScaleVsKnight ?? 'missing'};noProjectile=${Array.isArray(roleAttacks?.noProjectileRoles) ? roleAttacks.noProjectileRoles.join(',') : 'missing'}`
    ),
    check(
      'retired-qa-vfx-lab-not-in-live-runtime',
      !professionQa
        && !root.POWDER_COMBAT2_PROFESSION_TEST_UI
        && !root.POWDER_COMBAT2_VFX_LAB,
      `professionQa=${String(Boolean(professionQa))};testUi=${String(Boolean(root.POWDER_COMBAT2_PROFESSION_TEST_UI))};vfxLab=${String(Boolean(root.POWDER_COMBAT2_VFX_LAB))}`
    ),
    check(
      'profession-element-action-signature',
      Boolean(powSignature)
        && powSignature?.version === '2.19.4'
        && powSignature?.mode === 'nine-profession-element-skill-signature'
        && includesAll(powSignature?.roles, ['marksman', 'mage', 'tank', 'fighter', 'knight', 'assassin', 'enchanter', 'healer', 'musician'])
        && includesAll(powSignature?.slots, ['basic', 'skill-a', 'skill-b', 'ultimate'])
        && powSignature?.note === 'role glyph + elemental motif + ability traits; presentation only',
      `version=${powSignature?.version ?? 'missing'};mode=${powSignature?.mode ?? 'missing'};roles=${Array.isArray(powSignature?.roles) ? powSignature.roles.length : 'missing'};slots=${Array.isArray(powSignature?.slots) ? powSignature.slots.join(',') : 'missing'}`
    ),
    check(
      'arcane-arena-presentation-contract',
      Boolean(arenaPresentation)
        && arenaPresentation?.version === '2.19.6'
        && arenaPresentation?.direction === 'arcane-arena-command-deck'
        && arenaPresentation?.hud === 'center-round-console'
        && arenaPresentation?.actionMenu === 'element-accented-responsive-deck'
        && arenaPresentation?.skillCast === 'profession-element-trait-frame'
        && arenaPresentation?.ultimate === 'role-crest-over-cinematic'
        && arenaPresentation?.oneShotOnly === true
        && arenaPresentation?.combatLogicChanged === false,
      `version=${arenaPresentation?.version ?? 'missing'};hud=${arenaPresentation?.hud ?? 'missing'};deck=${arenaPresentation?.actionMenu ?? 'missing'};skill=${arenaPresentation?.skillCast ?? 'missing'};ultimate=${arenaPresentation?.ultimate ?? 'missing'}`
    ),
    check(
      'fairy-anime-presentation-contract',
      Boolean(fairyPresentation)
        && fairyPresentation?.version === '2.20.0'
        && fairyPresentation?.textureKey === 'combat-fairy-anime-sigil-v1'
        && fairyPresentation?.sigil === '/assets/combat/vfx/fairy-anime/fairy-sigil-v1.png'
        && includesAll(fairyPresentation?.coverage, [
          'basic-release',
          'skill-cast',
          'skill-release',
          'ultimate-cast',
          'ultimate-release',
        ])
        && fairyPresentation?.elementTinted === true
        && fairyPresentation?.combatLogicChanged === false,
      `version=${fairyPresentation?.version ?? 'missing'};texture=${fairyPresentation?.textureKey ?? 'missing'};coverage=${Array.isArray(fairyPresentation?.coverage) ? fairyPresentation.coverage.join(',') : 'missing'};tinted=${String(fairyPresentation?.elementTinted)}`
    ),
    check(
      'high-fantasy-anime-vfx-contract',
      Boolean(highFantasyVfx)
        && highFantasyVfx?.version === '2.20.1'
        && includesAll(highFantasyVfx?.groups, ['projectile', 'slash', 'impact', 'magic-circle', 'ultimate', 'support'])
        && includesAll(highFantasyVfx?.elementIdentity, ['ember', 'ripple', 'crystal', 'lightning', 'wind', 'stone', 'venom', 'radiant', 'void', 'leaf', 'steel'])
        && highFantasyVfx?.finiteMagicCircle === true
        && highFantasyVfx?.sourceToTarget === true
        && highFantasyVfx?.meleeLocalHopPreserved === true
        && highFantasyVfx?.particleEmitters === false
        && highFantasyVfx?.tweenLoops === false
        && highFantasyVfx?.adaptiveQuality === true
        && includesAll(highFantasyVfx?.magicCircleLifecycle, ['create', 'appear', 'build', 'charge', 'release', 'fade', 'destroy'])
        && Number(highFantasyVfx?.qualityLayers?.low) === 2
        && Number(highFantasyVfx?.qualityLayers?.medium) === 3
        && Number(highFantasyVfx?.qualityLayers?.high) === 5
        && highFantasyVfx?.missingAssetFallback === 'procedural-owner-with-dev-warning-only-for-enabled-assets'
        && highFantasyVfx?.multiHitCadence === true
        && highFantasyVfx?.registry?.version === '2.20.2'
        && highFantasyVfx?.combatLogicChanged === false,
      `version=${highFantasyVfx?.version ?? 'missing'};registry=${highFantasyVfx?.registry?.version ?? 'missing'};groups=${Array.isArray(highFantasyVfx?.groups) ? highFantasyVfx.groups.join(',') : 'missing'};circle=${String(highFantasyVfx?.finiteMagicCircle)};layers=${highFantasyVfx?.qualityLayers?.low ?? 'missing'}/${highFantasyVfx?.qualityLayers?.medium ?? 'missing'}/${highFantasyVfx?.qualityLayers?.high ?? 'missing'}`
    ),
    check(
      'combat-vfx-registry-fallback-contract',
      vfxRegistryRegression.pass
        && highFantasyVfx?.assetPreload === 'enabled-common-only-with-lazy-ultimate'
        && Array.isArray(vfxRegistryRegression.checks)
        && vfxRegistryRegression.checks.length >= 6,
      `version=${vfxRegistryRegression.version};pass=${String(vfxRegistryRegression.pass)};checks=${vfxRegistryRegression.checks.map((entry) => `${entry.name}:${entry.pass}`).join(',')}`
    ),
    check(
      'ultimate-presentation-timeline-contract',
      Boolean(ultimateVfx)
        && ultimateVfx?.presentationTimeline === true
        && includesAll(ultimateVfx?.phases, ['activate', 'pow-emphasis', 'magic-circle', 'charge', 'release', 'impact', 'hit-reaction', 'finish'])
        && ultimateVfx?.skipIntroHook === 'POWDER_COMBAT2_ULTIMATE_VFX_MODE=skip-intro'
        && ultimateVfx?.gameplayIndependent === true,
      `version=${ultimateVfx?.version ?? 'missing'};timeline=${String(ultimateVfx?.presentationTimeline)};phases=${Array.isArray(ultimateVfx?.phases) ? ultimateVfx.phases.join(',') : 'missing'};skip=${ultimateVfx?.skipIntroHook ?? 'missing'}`
    ),
    check(
      'persistent-status-dedup',
      statusAssets?.duplicateLegacyPersistentHidden === true,
      `hidden=${String(statusAssets?.duplicateLegacyPersistentHidden)}`
    ),
    check(
      'persistent-status-owner-lifecycle',
      Boolean(persistentStatus)
        && Number(persistentStatus?.ownerPerPowMax) <= 1
        && persistentStatus?.sceneShutdownCleanup === true
        && persistentStatus?.poisonBadgeGlyph === 'hazard-no-skull'
        && persistentStatus?.fullSheetPriority === true
        && persistentStatus?.realSpriteSheetPlayback === true
        && Number(persistentStatus?.atlasFrames) === 52
        && persistentStatus?.oneSpritePerPow === true
        && persistentStatus?.orderedFrames === true
        && persistentStatus?.proceduralStatusAnimation === false
        && persistentStatus?.combatLogicChanged === false,
      `version=${persistentStatus?.version ?? 'missing'};max=${persistentStatus?.ownerPerPowMax ?? 'missing'};cleanup=${String(persistentStatus?.sceneShutdownCleanup)};sheet=${String(persistentStatus?.realSpriteSheetPlayback)};frames=${persistentStatus?.atlasFrames ?? 'missing'}`
    ),
    check(
      'core-status-tooltips',
      Boolean(tooltip)
        && includesAll(tooltip.covered, coreTooltipCoverage)
        && tooltip.refreshStable === true
        && tooltip.hoverStatePreserved === true
        && tooltip.recreateOnStatusChangeOnly === true
        && Number(tooltip.sceneObjectPerHoveredPowMax) <= 1
        && tooltip.sceneShutdownCleanup === true
        && tooltip.combatLogicChanged === false,
      `version=${tooltip?.version ?? 'missing'};covered=${Array.isArray(tooltip?.covered) ? tooltip.covered.join(',') : 'missing'};stable=${String(tooltip?.refreshStable)};cleanup=${String(tooltip?.sceneShutdownCleanup)}`
    ),
    check(
      'persistent-heal-shield-lifecycle',
      Boolean(support?.persistentShield)
        && Boolean(support?.persistentRegeneration)
        && Number(support?.maxPersistentImagesPerPow) <= 2
        && support?.persistentLoopTweens === false
        && support?.sceneShutdownCleanup === true
        && support?.pulseTweenShutdownSafe === true
        && support?.pulseImageGuaranteedDestroy === true
        && support?.combatLogicChanged === false,
      `version=${support?.version ?? 'missing'};max=${support?.maxPersistentImagesPerPow ?? 'missing'};loops=${String(support?.persistentLoopTweens)};pulseSafe=${String(support?.pulseTweenShutdownSafe)}`
    ),
    check(
      'domain-ground-ownership-safety',
      Boolean(domain?.ownerBoundary)
        && Boolean(domain?.clashSeam)
        && domain?.particles === false
        && domain?.tweenLoops === false
        && domain?.depth === -11
        && domain?.sceneShutdownCleanup === true
        && domain?.emptyFieldAvoided === true
        && Number(domain?.maxFieldContainersPerScene) <= 1
        && domain?.combatLogicChanged === false,
      `version=${domain?.version ?? 'missing'};depth=${domain?.depth ?? 'missing'};cleanup=${String(domain?.sceneShutdownCleanup)};emptyAvoided=${String(domain?.emptyFieldAvoided)}`
    ),
    check(
      'adaptive-fps-burst-guard',
      Boolean(root.POWDER_COMBAT2_PERFORMANCE)
        && Boolean(budget)
        && budget?.version === 'night-46'
        && budget?.source === 'POWDER_COMBAT2_FX_TIER'
        && budget?.burstGuard === true
        && Number(budget?.balancedBurstThreshold) === 2
        && budget?.singleProjectileOwner === true
        && budget?.particleEmitters === false
        && budget?.tweenLoops === false
        && budget?.fullTierPreserved === true
        && budget?.counterFinallySafe === true
        && budget?.combatLogicChanged === false,
      `performance=${root.POWDER_COMBAT2_PERFORMANCE?.version ?? 'missing'};night=${budget?.version ?? 'missing'};burst=${String(budget?.burstGuard)};threshold=${budget?.balancedBurstThreshold ?? 'missing'}`
    ),
    check(
      'scene-teardown-cleanup',
      Boolean(teardown?.sceneShutdownSafe)
        && teardown?.lifecycleCounters === true
        && teardown?.sceneScopedLeakAudit === true
        && typeof teardown?.getLifecycleSnapshot === 'function'
        && typeof teardown?.getSceneLeakAuditSnapshot === 'function'
        && Number(teardown?.expectedActiveAfterShutdown) === 0
        && teardown?.perFramePolling === false
        && teardown?.combatLogicChanged === false,
      `version=${teardown?.version ?? 'missing'};sceneAudit=${String(teardown?.sceneScopedLeakAudit)};polling=${String(teardown?.perFramePolling)}`
    ),
    check(
      'scene-leak-last-audit',
      Boolean(leakAudit)
        && (Number(leakAudit?.runs || 0) === 0
          || Number(leakAudit?.lastActiveAfterShutdown || 0) === 0),
      `runs=${leakAudit?.runs ?? 'missing'};failures=${leakAudit?.failures ?? 'missing'};lastActive=${leakAudit?.lastActiveAfterShutdown ?? 'missing'};scene=${leakAudit?.lastSceneKey ?? 'missing'}`
    ),
    check(
      'heal-shield-img2-assets',
      Boolean(support?.hudSafeScale && support?.ragePulsePreserved),
      `version=${support?.version ?? 'missing'}`
    )
  ];

  const report: CombatNightRegressionReport = {
    version: 'night-46',
    pass: checks.every((entry) => entry.pass),
    checks
  };
  root.POWDER_COMBAT2_NIGHT_REGRESSION = report;
  root.POWDER_COMBAT2_NIGHT_COMPLETION = {
    version: 'night-46',
    scope: 'profession-routed-attack-vfx-all-affected-pow-status-envelope-real-status-spritesheet-frame-anchor-layer-tooltip-domain-fps-lifecycle-regression',
    staticGatePass: report.pass,
    branchOnly: true,
    combatLogicChanged: false
  };

  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    if (report.pass) console.info('[Combat2 Night Regression PASS]', report);
    else console.error('[Combat2 Night Regression FAIL - branch only]', report);
  }
  return report;
}

runCombatNightRegressionGate();
