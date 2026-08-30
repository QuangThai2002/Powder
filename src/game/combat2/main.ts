import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { COMBAT2_STARTER_ROSTER } from './data/PowderDataAdapter';
import { runCombat2SmokeRegression } from './systems/CombatRegression';
import { runCombatFinalRegression } from './systems/CombatFinalRegression';
import { runCombatPresentationRegression } from './systems/CombatPresentationRegression';
import { CombatGuardEngine } from './systems/CombatGuardEngine';
import { runCombatGuardRegression } from './systems/CombatGuardRegression';
import { runCombatLegacyDomainParityRegression } from './systems/CombatLegacyDomainParityRegression';
import { runCombatLegacyDomainRegression } from './systems/CombatLegacyDomainRegression';
import { runCombatLegacyDomainSpecialRegression } from './systems/CombatLegacyDomainSpecialRegression';
import { LEGACY_EXPANSION_DOMAINS, LEGACY_SIMPLE_DOMAINS } from './systems/CombatLegacyDomainEngine';
import { runCombatLegacyRoleRegression } from './systems/CombatLegacyRoleRegression';
import { runCombatMultiTargetRegression } from './systems/CombatMultiTargetRegression';
import { runCombatRageRegression } from './systems/CombatRageRegression';
import { runCombatSpecialSupportRegression } from './systems/CombatSpecialSupportRegression';
import { installCombat27UiPatch } from './views/Combat27UiPatch';
import { installCombat28MultiTargetPatch } from './views/Combat28MultiTargetPatch';
import { installCombat281LegacyRolePatch } from './views/Combat281LegacyRolePatch';
import { installCombat29LegacyDomainPatch } from './views/Combat29LegacyDomainPatch';
import { installCombat291LegacyDomainHardeningPatch } from './views/Combat291LegacyDomainHardeningPatch';
import { installCombat292LegacyAbilityMetadataPatch } from './views/Combat292LegacyAbilityMetadataPatch';
import { installCombat293LegacyDomainTickPatch } from './views/Combat293LegacyDomainTickPatch';
import { installCombat294DomainControlsPatch } from './views/Combat294DomainControlsPatch';
import { installCombat295LegacyDomainParityPatch } from './views/Combat295LegacyDomainParityPatch';
import { installCombat296VersionPatch } from './views/Combat296VersionPatch';
import { installCombat2100ReserveFlowPatch } from './views/Combat2100ReserveFlowPatch';
import { CombatPresentationDirector } from './views/CombatPresentationDirector';
import { installCombat2101UltimateCinematicPatch } from './views/Combat2101UltimateCinematicPatch';
import { installCombat2101VersionPatch } from './views/Combat2101VersionPatch';
import { installCombat2102ArenaFocusPatch } from './views/Combat2102ArenaFocusPatch';
import { installCombat2103DomainStagePatch } from './views/Combat2103DomainStagePatch';
import { installCombat2105AudioImpactPatch } from './views/Combat2105AudioImpactPatch';
import { installCombat2106AdaptiveFxPatch } from './views/Combat2106AdaptiveFxPatch';
import { installCombat2109BattleEndPatch } from './views/Combat2109BattleEndPatch';
import { installCombat2112LegacyHudBridgePatch } from './views/Combat2112LegacyHudBridgePatch';
import { installCombat2115ReserveUiPatch } from './views/Combat2115ReserveUiPatch';
import { installCombat2122CinematicMotionPatch } from './views/Combat2122CinematicMotionPatch';
import { installCombat2123CleanDomainCinematicPatch } from './views/Combat2123CleanDomainCinematicPatch';
import { installCombat2124PowSkillMotionIdentityPatch } from './views/Combat2124PowSkillMotionIdentityPatch';
import { installCombat2132AtlasFallbackPatch } from './views/Combat2132AtlasFallbackPatch';
import { installCombat2133AtlasPresentationPatch } from './views/Combat2133AtlasPresentationPatch';
import { installCombat2133PrimitiveGuardPatch } from './views/Combat2133PrimitiveGuardPatch';
import { installCombat2134SourceImpactIdentityPatch } from './views/Combat2134SourceImpactIdentityPatch';
import { installCombat2140ExactVfxPatch } from './views/Combat2140ExactVfxPatch';
import { installCombat2141SemanticVfxPatch } from './views/Combat2141SemanticVfxPatch';
import { installCombat2142AssetVfxLivePatch } from './views/Combat2142AssetVfxLivePatch';
import { PowView } from './views/PowView';

const logicalWidth = 1600;
const logicalHeight = 900;
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const testRosterReport = {
  player: COMBAT2_STARTER_ROSTER.player.map((pow) => pow.id),
  enemy: COMBAT2_STARTER_ROSTER.enemy.map((pow) => pow.id),
  requested: [...COMBAT2_STARTER_ROSTER.player, ...COMBAT2_STARTER_ROSTER.enemy].map((pow) => pow.id)
};
(globalThis as any).POWDER_COMBAT2_TEST_ROSTER = { version: '2.14.2', mode: 'canonical-coverage-rotation+asset-first-vfx-live', ...testRosterReport };

function installCombat2114DomainOwnershipPatch(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  const originalRefresh = proto.refreshViews;
  if (typeof originalRefresh !== 'function') return;

  const palette = {
    fire: { line: 0xff8b54, text: '#ffd8b0' },
    water: { line: 0x62c8ff, text: '#c7efff' },
    leaf: { line: 0x78df91, text: '#d2ffd6' }
  } as const;

  proto.refreshViews = function combat2114DomainOwnershipRefresh(this: Phaser.Scene & any, ...args: any[]): void {
    originalRefresh.apply(this, args);
    const api = (globalThis as any).POWDER_COMBAT2_DOMAIN;
    if (!api || typeof api.snapshot !== 'function') return;

    const describe = (side: 'player' | 'enemy') => {
      try {
        const state = api.snapshot(side);
        if (state?.expansion) {
          const cfg = (LEGACY_EXPANSION_DOMAINS as any)[state.expansion.id];
          return cfg ? { key: `e:${state.expansion.id}`, name: cfg.short, branch: cfg.branch, expansion: true } : null;
        }
        if (state?.simpleActive) {
          const cfg = (LEGACY_SIMPLE_DOMAINS as any)[state.simpleActive.id];
          return cfg ? { key: `s:${state.simpleActive.id}:${state.simpleActive.level}`, name: cfg.short, branch: cfg.branch, expansion: false } : null;
        }
      } catch { /* presentation must never block combat */ }
      return null;
    };

    const enemy = describe('enemy');
    const player = describe('player');
    const nextSignature = `${enemy?.key ?? 'none'}|${player?.key ?? 'none'}`;
    if (this.__domainOwnership2114Signature === nextSignature) return;
    this.__domainOwnership2114Signature = nextSignature;
    this.__domainOwnership2114?.destroy(true);
    this.__domainOwnership2114 = this.add.container(0, 0).setDepth(27);

    const addOwnerMark = (side: 'player' | 'enemy', row: NonNullable<ReturnType<typeof describe>>) => {
      const colors = palette[row.branch as keyof typeof palette] ?? palette.water;
      const y = side === 'enemy' ? 8 : this.scale.height - 8;
      const bar = this.add.rectangle(this.scale.width / 2, y, Math.min(this.scale.width * 0.72, 1080), row.expansion ? 4 : 2, colors.line, row.expansion ? 0.76 : 0.42);
      const owner = side === 'enemy' ? 'ĐỐI THỦ' : 'TAMER';
      const textY = side === 'enemy' ? 15 : this.scale.height - 15;
      const label = this.add.text(18, textY, `${owner} · ${row.name}`, {
        fontFamily: 'Arial, sans-serif', fontSize: row.expansion ? '11px' : '10px', color: colors.text,
        fontStyle: 'bold', backgroundColor: '#031019cc', padding: { x: 7, y: 4 }
      }).setOrigin(0, side === 'enemy' ? 0 : 1);
      this.__domainOwnership2114.add([bar, label]);
    };

    if (enemy) addOwnerMark('enemy', enemy);
    if (player) addOwnerMark('player', player);
  };

  (globalThis as any).POWDER_COMBAT2_DOMAIN_OWNERSHIP = {
    version: '2.11.4',
    mode: 'static-edge-ownership',
    rules: ['identity-change-only', 'no-particles', 'no-combat-logic-change', 'field-readable']
  };
}

installCombat27UiPatch(BattleScene, PowView);
installCombat28MultiTargetPatch(BattleScene);
installCombat281LegacyRolePatch(BattleScene, CombatGuardEngine);
installCombat29LegacyDomainPatch(BattleScene);
installCombat291LegacyDomainHardeningPatch();
installCombat292LegacyAbilityMetadataPatch(BattleScene);
installCombat293LegacyDomainTickPatch(BattleScene);
installCombat294DomainControlsPatch(BattleScene);
installCombat295LegacyDomainParityPatch();
installCombat296VersionPatch(BattleScene);
// Combat 2.9.8/2.9.9 and 2.10.4 procedural action/status/role-glyph FX are intentionally retired.
// All presentation patches are installed before Phaser.Game is created so the very first
// BattleScene.preload() includes the bundled img + img2 VFX textures.
installCombat2100ReserveFlowPatch(BattleScene, PowView);
installCombat2101UltimateCinematicPatch(CombatPresentationDirector);
installCombat2101VersionPatch(BattleScene);
installCombat2102ArenaFocusPatch(BattleScene, PowView);
installCombat2103DomainStagePatch(BattleScene);
installCombat2114DomainOwnershipPatch(BattleScene);
installCombat2105AudioImpactPatch(BattleScene, PowView);
installCombat2106AdaptiveFxPatch(BattleScene);
installCombat2109BattleEndPatch(BattleScene);
installCombat2112LegacyHudBridgePatch(BattleScene);
installCombat2115ReserveUiPatch(BattleScene);
installCombat2122CinematicMotionPatch(BattleScene, PowView);
installCombat2123CleanDomainCinematicPatch(BattleScene);
installCombat2124PowSkillMotionIdentityPatch(BattleScene);
installCombat2132AtlasFallbackPatch(BattleScene, PowView);
installCombat2133PrimitiveGuardPatch(PowView);
installCombat2133AtlasPresentationPatch(CombatPresentationDirector);
installCombat2134SourceImpactIdentityPatch(BattleScene, PowView);
installCombat2140ExactVfxPatch(BattleScene, PowView, CombatPresentationDirector);
installCombat2141SemanticVfxPatch(BattleScene, PowView, CombatPresentationDirector);
installCombat2142AssetVfxLivePatch(BattleScene);

// Legacy compatibility owners install first. Combat2 release-specific final owners install
// afterwards and before Phaser.Game so the first battle action uses the current release VFX.
await import('./vfx/CombatNightProjectileBridge');
await import('./vfx/CombatNightCuratedStatusAssetBridge');
await import('./vfx/CombatNightStatusTooltipBridge');
await import('./vfx/CombatNightFxBudgetBridge');
await import('./vfx/CombatNightRegressionGate');
await import('./vfx/Combat2151RangedRoleVfxPatch');

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, parent: 'powder-combat2', width: logicalWidth, height: logicalHeight, backgroundColor: '#08131f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: logicalWidth, height: logicalHeight },
  fps: { target: 60, min: 30, smoothStep: true }, render: { antialias: true, pixelArt: false, roundPixels: false }, scene: [BattleScene]
};

const game = new Phaser.Game(config);
let earlyRefreshTimer = 0; let lateRefreshTimer = 0;
const refreshScale = (): void => {
  window.clearTimeout(earlyRefreshTimer); window.clearTimeout(lateRefreshTimer);
  earlyRefreshTimer = window.setTimeout(() => game.scale.refresh(), 80);
  lateRefreshTimer = window.setTimeout(() => game.scale.refresh(), 260);
};
window.addEventListener('orientationchange', refreshScale, { passive: true });
window.addEventListener('resize', refreshScale, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) window.setTimeout(() => game.scale.refresh(), 80);
}, { passive: true });

if (isLocalDev) {
  queueMicrotask(() => {
    try {
      const report = runCombat2SmokeRegression();
      const finalGate = runCombatFinalRegression();
      const presentationGate = runCombatPresentationRegression(testRosterReport);
      const specialSupport = runCombatSpecialSupportRegression();
      const rage = runCombatRageRegression();
      const guard = runCombatGuardRegression();
      const multiTarget = runCombatMultiTargetRegression();
      const legacyRole = runCombatLegacyRoleRegression();
      const legacyDomain = runCombatLegacyDomainRegression();
      const legacyDomainSpecial = runCombatLegacyDomainSpecialRegression();
      const legacyDomainParity = runCombatLegacyDomainParityRegression();
      console.info('[Combat2 Regression PASS]', {
        ...report, finalGate, presentationGate, specialSupport, rage, guard, multiTarget, legacyRole, legacyDomain, legacyDomainSpecial, legacyDomainParity,
        roster: testRosterReport,
        actionFx: (globalThis as any).POWDER_COMBAT2_ACTION_FX?.version ?? 'missing',
        statusFx: (globalThis as any).POWDER_COMBAT2_STATUS_FX?.version ?? 'missing',
        assetVfx: (globalThis as any).POWDER_COMBAT2_EXACT_VFX?.version ?? 'missing',
        assetVfxLive: (globalThis as any).POWDER_COMBAT2_ASSET_VFX_LIVE ?? 'missing',
        reserveFx: (globalThis as any).POWDER_COMBAT2_RESERVE_FX?.version ?? 'missing',
        reserveUi: (globalThis as any).POWDER_COMBAT2_RESERVE_UI?.version ?? 'missing',
        ultimateFx: (globalThis as any).POWDER_COMBAT2_ULTIMATE_FX?.version ?? 'missing',
        arenaFocus: (globalThis as any).POWDER_COMBAT2_ARENA_FOCUS?.version ?? 'missing',
        domainStage: (globalThis as any).POWDER_COMBAT2_DOMAIN_STAGE?.version ?? 'missing',
        domainOwnership: (globalThis as any).POWDER_COMBAT2_DOMAIN_OWNERSHIP?.version ?? 'missing',
        powSignature: (globalThis as any).POWDER_COMBAT2_POW_SIGNATURE?.version ?? 'retired-2.13.0',
        audioImpact: (globalThis as any).POWDER_COMBAT2_AUDIO_IMPACT?.version ?? 'missing',
        performance: (globalThis as any).POWDER_COMBAT2_PERFORMANCE?.version ?? 'missing',
        battleEnd: (globalThis as any).POWDER_COMBAT2_BATTLE_END?.version ?? 'missing',
        legacyUiBridge: (globalThis as any).POWDER_COMBAT2_LEGACY_UI_BRIDGE?.version ?? 'missing'
      });
    } catch (error) { console.error('[Combat2 Regression FAIL - NON BLOCKING]', error); }
  });
}
