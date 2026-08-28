import Phaser from 'phaser';
import { LEGACY_EXPANSION_DOMAINS } from '../systems/CombatLegacyDomainEngine';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2123CleanDomainCinematicInstalled';

type Side = 'player' | 'enemy';

type DomainInfo = {
  id: string;
  name: string;
  short: string;
  branch: 'fire' | 'water' | 'leaf';
  actions: number;
};

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function expansion(side: Side): DomainInfo | null {
  const api = (globalThis as any).POWDER_COMBAT2_DOMAIN;
  if (!api || typeof api.snapshot !== 'function') return null;
  try {
    const state = api.snapshot(side);
    if (!state?.expansion) return null;
    const cfg = (LEGACY_EXPANSION_DOMAINS as any)[state.expansion.id];
    if (!cfg) return null;
    return {
      id: String(state.expansion.id),
      name: String(cfg.name || cfg.short || state.expansion.id),
      short: String(cfg.short || cfg.name || state.expansion.id),
      branch: cfg.branch,
      actions: Math.max(0, Number(state.expansion.actionsRemaining) || 0)
    };
  } catch {
    return null;
  }
}

function branchTint(branch: DomainInfo['branch']): number {
  if (branch === 'fire') return 0x7a1f13;
  if (branch === 'leaf') return 0x173f28;
  return 0x123a58;
}

function branchText(branch: DomainInfo['branch']): string {
  if (branch === 'fire') return '#ffd1a6';
  if (branch === 'leaf') return '#c9ffd4';
  return '#c9efff';
}

function cleanLegacyStage(scene: any): void {
  // The 2.10.3 field motif was made from procedural ellipses/lines. Keep its HUD logic,
  // but never use that geometric elemental artwork as the visible domain presentation.
  if (scene.__domain2103Stage) scene.__domain2103Stage.setVisible(false);
}

function markLegacyOpeningSeen(scene: any): void {
  scene.__domain2103ExpansionSeen ??= { player: '', enemy: '' };
  for (const side of ['player', 'enemy'] as const) {
    const row = expansion(side);
    if (row) scene.__domain2103ExpansionSeen[side] = row.id;
  }
}

function playCleanOpening(scene: Phaser.Scene & any, side: Side, row: DomainInfo): void {
  const fast = reducedMotion();
  const { width, height } = scene.scale;
  const tint = branchTint(row.branch);
  const textColor = branchText(row.branch);

  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x010407, fast ? 0.34 : 0.55).setDepth(116);
  const atmosphere = scene.add.rectangle(width / 2, height / 2, width, height, tint, fast ? 0.08 : 0.14).setDepth(117);
  const owner = scene.add.text(width / 2, height / 2 - 54, side === 'player' ? 'TAMER · BÀNH TRƯỚNG LÃNH ĐỊA' : 'ĐỐI THỦ · BÀNH TRƯỚNG LÃNH ĐỊA', {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: '14px',
    color: textColor,
    fontStyle: 'bold',
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(118).setAlpha(fast ? 1 : 0);
  const title = scene.add.text(width / 2, height / 2, row.name.toUpperCase(), {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: width < 1000 ? '30px' : '42px',
    color: '#fff8ea',
    fontStyle: 'bold',
    stroke: '#02070c',
    strokeThickness: 8,
    align: 'center'
  }).setOrigin(0.5).setDepth(118).setScale(fast ? 1 : 0.94).setAlpha(fast ? 1 : 0);
  const detail = scene.add.text(width / 2, height / 2 + 55, `${row.actions} HÀNH ĐỘNG`, {
    fontFamily: COMBAT_BODY_FONT,
    fontSize: '13px',
    color: textColor,
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(118).setAlpha(fast ? 1 : 0);

  const camera = scene.cameras.main;
  if (!fast) {
    camera.zoomTo(1.018, 150, 'Sine.easeOut');
    scene.tweens.add({ targets: [owner, title, detail], alpha: 1, duration: 130, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: title, scaleX: 1, scaleY: 1, duration: 170, ease: 'Back.easeOut' });
  }

  scene.time.delayedCall(fast ? 220 : 560, () => {
    if (!fast) camera.zoomTo(1, 180, 'Sine.easeInOut');
    scene.tweens.add({
      targets: [shade, atmosphere, owner, title, detail],
      alpha: 0,
      duration: fast ? 100 : 190,
      ease: 'Quad.easeOut',
      onComplete: () => {
        shade.destroy(); atmosphere.destroy(); owner.destroy(); title.destroy(); detail.destroy();
      }
    });
  });
}

export function installCombat2123CleanDomainCinematicPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.create;
  const originalRefresh = proto.refreshViews;
  const seen = new WeakMap<object, Record<Side, string>>();

  proto.create = function combat2123Create(this: Phaser.Scene & any, ...args: any[]): void {
    // Prevent the older procedural opening from appearing during initial sync.
    markLegacyOpeningSeen(this);
    originalCreate.apply(this, args);
    cleanLegacyStage(this);
    seen.set(this, { player: expansion('player')?.id || '', enemy: expansion('enemy')?.id || '' });
  };

  proto.refreshViews = function combat2123Refresh(this: Phaser.Scene & any, ...args: any[]): void {
    const previous = seen.get(this) || { player: '', enemy: '' };
    // Suppress old geometric expansion rings before the legacy sync executes.
    markLegacyOpeningSeen(this);
    originalRefresh.apply(this, args);
    cleanLegacyStage(this);

    const next = { player: expansion('player')?.id || '', enemy: expansion('enemy')?.id || '' };
    seen.set(this, next);
    for (const side of ['enemy', 'player'] as const) {
      if (!next[side] || next[side] === previous[side]) continue;
      const row = expansion(side);
      if (row) playCleanOpening(this, side, row);
    }
  };

  root.POWDER_COMBAT2_DOMAIN_CINEMATIC = {
    version: '2.12.3',
    mode: 'asset-ready-clean-domain-stage',
    rules: [
      'legacy-domain-logic-preserved',
      'procedural-element-motif-hidden',
      'procedural-expansion-rings-suppressed',
      'camera-and-atmosphere-only-until-real-assets',
      'no-particle-loop',
      '60fps-oriented'
    ]
  };
}
