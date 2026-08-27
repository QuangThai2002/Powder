import Phaser from 'phaser';
import {
  LEGACY_EXPANSION_DOMAINS,
  LEGACY_SIMPLE_DOMAINS,
  type LegacyExpansionDomainId,
  type LegacySimpleDomainId
} from '../systems/CombatLegacyDomainEngine';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

interface DomainSnapshot {
  simpleActive?: { id: LegacySimpleDomainId; level: number; actionsRemaining: number } | null;
  expansion?: { id: LegacyExpansionDomainId; actionsRemaining: number } | null;
}

interface DomainApi {
  snapshot: (side?: 'player' | 'enemy') => DomainSnapshot | null;
}

interface PatchableScene extends Phaser.Scene {
  createActionMenu?: (...args: any[]) => void;
  refreshViews?: (...args: any[]) => void;
  showPreBattleIntro?: () => void;
  startCombatFlow?: () => void;
  __domain2103Stage?: Phaser.GameObjects.Container | null;
  __domain2103Hud?: Phaser.GameObjects.Container | null;
  __domain2103Signature?: string;
  __domain2103ExpansionSeen?: Record<'player' | 'enemy', string>;
}

const PATCH_FLAG = '__powderCombat2103DomainStageInstalled';

type Branch = 'fire' | 'water' | 'leaf';

const PALETTE: Record<Branch, { core: number; accent: number; text: string }> = {
  fire: { core: 0xff5c35, accent: 0xffc45c, text: '#ffd39a' },
  water: { core: 0x4ea9ff, accent: 0x9eeeff, text: '#bfefff' },
  leaf: { core: 0x55c878, accent: 0xc5f48c, text: '#caffb4' }
};

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function domainApi(): DomainApi | null {
  const api = (globalThis as any).POWDER_COMBAT2_DOMAIN as DomainApi | undefined;
  return api && typeof api.snapshot === 'function' ? api : null;
}

function stateFor(side: 'player' | 'enemy'): DomainSnapshot | null {
  try { return domainApi()?.snapshot(side) ?? null; } catch { return null; }
}

function descriptor(side: 'player' | 'enemy'): {
  side: 'player' | 'enemy';
  kind: 'simple' | 'expansion';
  id: LegacySimpleDomainId | LegacyExpansionDomainId;
  branch: Branch;
  name: string;
  short: string;
  actions: number;
  level?: number;
} | null {
  const snapshot = stateFor(side);
  if (snapshot?.expansion) {
    const cfg = LEGACY_EXPANSION_DOMAINS[snapshot.expansion.id];
    return {
      side,
      kind: 'expansion',
      id: snapshot.expansion.id,
      branch: cfg.branch,
      name: cfg.name,
      short: cfg.short,
      actions: Math.max(0, Number(snapshot.expansion.actionsRemaining) || 0)
    };
  }
  if (snapshot?.simpleActive) {
    const cfg = LEGACY_SIMPLE_DOMAINS[snapshot.simpleActive.id];
    return {
      side,
      kind: 'simple',
      id: snapshot.simpleActive.id,
      branch: cfg.branch,
      name: cfg.name,
      short: cfg.short,
      actions: Math.max(0, Number(snapshot.simpleActive.actionsRemaining) || 0),
      level: Math.max(1, Math.min(3, Number(snapshot.simpleActive.level) || 1))
    };
  }
  return null;
}

function signature(): string {
  return (['enemy', 'player'] as const).map((side) => {
    const row = descriptor(side);
    return row ? `${side}:${row.kind}:${row.id}:${row.actions}:${row.level ?? 0}` : `${side}:none`;
  }).join('|');
}

function drawBranchMotif(scene: Phaser.Scene, branch: Branch, side: 'player' | 'enemy', expansion: boolean): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const palette = PALETTE[branch];
  const y = side === 'enemy' ? height * 0.36 : height * 0.64;
  const container = scene.add.container(width / 2, y);
  const g = scene.add.graphics();
  const zoneW = Math.min(width * 0.84, 1280);
  const zoneH = Math.min(height * (expansion ? 0.34 : 0.27), expansion ? 300 : 230);

  g.fillStyle(palette.core, expansion ? 0.115 : 0.07);
  g.fillEllipse(0, 0, zoneW, zoneH);
  g.lineStyle(expansion ? 3 : 2, palette.accent, expansion ? 0.54 : 0.3);
  g.strokeEllipse(0, 0, zoneW, zoneH);
  g.lineStyle(1, palette.core, expansion ? 0.34 : 0.19);
  g.strokeEllipse(0, 0, zoneW * 0.76, zoneH * 0.63);

  if (branch === 'fire') {
    g.lineStyle(3, palette.accent, expansion ? 0.5 : 0.25);
    for (let i = -2; i <= 2; i += 1) {
      const x = i * Math.min(120, width * 0.075);
      g.lineBetween(x - 34, 26, x, -34);
      g.lineBetween(x, -34, x + 34, 26);
    }
  } else if (branch === 'water') {
    g.lineStyle(3, palette.accent, expansion ? 0.45 : 0.24);
    for (let i = -2; i <= 2; i += 1) {
      const yy = i * 21;
      g.beginPath();
      g.moveTo(-zoneW * 0.26, yy);
      g.quadraticBezierTo(-zoneW * 0.09, yy - 18, zoneW * 0.02, yy);
      g.quadraticBezierTo(zoneW * 0.15, yy + 18, zoneW * 0.28, yy);
      g.strokePath();
    }
  } else {
    g.lineStyle(2.5, palette.accent, expansion ? 0.45 : 0.24);
    const r = Math.min(84, height * 0.095);
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = Math.cos(angle) * r;
      const yy = Math.sin(angle) * r * 0.55;
      g.strokeEllipse(x, yy, 52, 24);
    }
    g.strokeCircle(0, 0, r * 0.34);
  }

  container.add(g);
  return container;
}

function makeBadge(scene: Phaser.Scene, row: NonNullable<ReturnType<typeof descriptor>>): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const palette = PALETTE[row.branch];
  const y = row.side === 'enemy' ? 34 : height - 34;
  const badgeW = Math.min(470, width * 0.39);
  const plate = scene.add.rectangle(0, 0, badgeW, 38, 0x041018, 0.88)
    .setStrokeStyle(row.kind === 'expansion' ? 2 : 1.2, palette.accent, row.kind === 'expansion' ? 0.72 : 0.44);
  const label = row.kind === 'expansion'
    ? `${row.short} · ${row.actions} HÀNH ĐỘNG`
    : `${row.short} · GIẢN DỊ CẤP ${row.level ?? 1}`;
  const text = scene.add.text(0, 0, label, {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: row.kind === 'expansion' ? '12px' : '11px',
    color: palette.text,
    fontStyle: 'bold'
  }).setOrigin(0.5);
  return scene.add.container(width / 2, y, [plate, text]).setDepth(29);
}

function playOpening(scene: PatchableScene, row: NonNullable<ReturnType<typeof descriptor>>): void {
  if (row.kind !== 'expansion') return;
  scene.__domain2103ExpansionSeen ??= { player: '', enemy: '' };
  const activationKey = `${row.id}`;
  if (scene.__domain2103ExpansionSeen[row.side] === activationKey) return;
  scene.__domain2103ExpansionSeen[row.side] = activationKey;

  const { width, height } = scene.scale;
  const palette = PALETTE[row.branch];
  const fast = reducedMotion();
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x010408, fast ? 0.36 : 0.58);
  const ring = scene.add.ellipse(width / 2, height / 2, Math.min(980, width * 0.68), Math.min(440, height * 0.5), palette.core, 0.045)
    .setStrokeStyle(4, palette.accent, 0.82);
  const inner = scene.add.ellipse(width / 2, height / 2, Math.min(710, width * 0.5), Math.min(300, height * 0.34), 0x000000, 0)
    .setStrokeStyle(2, palette.core, 0.68);
  const kicker = scene.add.text(width / 2, height / 2 - 48, 'BÀNH TRƯỚNG LÃNH ĐỊA', {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: '15px',
    color: palette.text,
    fontStyle: 'bold',
    letterSpacing: 2
  }).setOrigin(0.5);
  const title = scene.add.text(width / 2, height / 2 + 2, row.name.toUpperCase(), {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: width < 1000 ? '30px' : '40px',
    color: '#fff7e6',
    fontStyle: 'bold',
    stroke: '#02080d',
    strokeThickness: 7,
    align: 'center'
  }).setOrigin(0.5);
  const sub = scene.add.text(width / 2, height / 2 + 55, `${row.actions} HÀNH ĐỘNG · ${row.side === 'player' ? 'TAMER' : 'ĐỐI THỦ'}`, {
    fontFamily: COMBAT_BODY_FONT,
    fontSize: '13px',
    color: palette.text,
    fontStyle: 'bold'
  }).setOrigin(0.5);
  const intro = scene.add.container(0, 0, [shade, ring, inner, kicker, title, sub]).setDepth(112);

  if (!fast) {
    ring.setScale(0.72).setAlpha(0.18);
    inner.setScale(1.3).setAlpha(0.1);
    title.setScale(0.92);
    scene.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, alpha: 1, duration: 210, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: inner, scaleX: 1, scaleY: 1, alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: title, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeOut' });
  }
  scene.tweens.add({ targets: intro, alpha: 0, delay: fast ? 180 : 520, duration: fast ? 120 : 230, ease: 'Quad.easeOut', onComplete: () => intro.destroy(true) });
}

function playSimplePulse(scene: PatchableScene, row: NonNullable<ReturnType<typeof descriptor>>): void {
  if (row.kind !== 'simple' || reducedMotion()) return;
  const palette = PALETTE[row.branch];
  const y = row.side === 'enemy' ? scene.scale.height * 0.36 : scene.scale.height * 0.64;
  const ring = scene.add.ellipse(scene.scale.width / 2, y, 220, 72, 0x000000, 0)
    .setStrokeStyle(3, palette.accent, 0.7)
    .setDepth(23)
    .setScale(0.55)
    .setAlpha(0.7);
  scene.tweens.add({ targets: ring, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 330, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
}

function rebuild(scene: PatchableScene, previousSignature: string): void {
  scene.__domain2103Stage?.destroy(true);
  scene.__domain2103Hud?.destroy(true);
  scene.__domain2103Stage = scene.add.container(0, 0).setDepth(-12);
  scene.__domain2103Hud = scene.add.container(0, 0).setDepth(29);

  for (const side of ['enemy', 'player'] as const) {
    const row = descriptor(side);
    if (!row) continue;
    scene.__domain2103Stage.add(drawBranchMotif(scene, row.branch, side, row.kind === 'expansion'));
    scene.__domain2103Hud.add(makeBadge(scene, row));

    const oldPart = previousSignature.split('|').find((part) => part.startsWith(`${side}:`)) || `${side}:none`;
    const newPart = `${side}:${row.kind}:${row.id}:${row.actions}:${row.level ?? 0}`;
    const changedIdentity = !oldPart.includes(`:${row.kind}:${row.id}:`);
    if (changedIdentity) {
      if (row.kind === 'expansion') playOpening(scene, row);
      else playSimplePulse(scene, row);
    }
    void newPart;
  }
}

function sync(scene: PatchableScene): void {
  const next = signature();
  const previous = scene.__domain2103Signature ?? 'enemy:none|player:none';
  if (next === previous) return;
  scene.__domain2103Signature = next;
  rebuild(scene, previous);
}

function installIntro(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  proto.showPreBattleIntro = function combat2103Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.42);
    const plate = this.add.rectangle(width / 2, height / 2, Math.min(790, width * 0.82), 144, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
    const title = this.add.text(width / 2, height / 2 - 22, 'POWDER COMBAT 2.10.3', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 24, 'DOMAIN STAGE · FIELD IDENTITY · EXPANSION OPENING', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#8eeaff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(105);
    this.tweens.add({ targets: intro, alpha: 0, delay: 720, duration: 250, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      this.add.text(width - 18, height - 18, '2.10.3 · DOMAIN STAGE', {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#bfefff', fontStyle: 'bold', backgroundColor: '#04101899', padding: { x: 7, y: 4 }
      }).setOrigin(1, 1).setDepth(98).setAlpha(0.72);
    }
  };
}

export function installCombat2103DomainStagePatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.create;
  const originalCreateMenu = proto.createActionMenu;
  const originalRefresh = proto.refreshViews;

  proto.create = function combat2103Create(this: PatchableScene): void {
    originalCreate.call(this);
    this.__domain2103Signature = 'enemy:none|player:none';
    this.__domain2103ExpansionSeen = { player: '', enemy: '' };
    sync(this);
  };

  proto.createActionMenu = function combat2103CreateActionMenu(this: PatchableScene, ...args: any[]): void {
    originalCreateMenu.apply(this, args);
    sync(this);
  };

  proto.refreshViews = function combat2103RefreshViews(this: PatchableScene, ...args: any[]): void {
    originalRefresh.apply(this, args);
    sync(this);
  };

  installIntro(BattleSceneClass);

  root.POWDER_COMBAT2_DOMAIN_STAGE = {
    version: '2.10.3',
    sync: () => {
      const scene = (root.POWDER_COMBAT2_DOMAIN_STAGE as any)?.scene as PatchableScene | undefined;
      if (scene) sync(scene);
    },
    palette: { fire: '#ff5c35', water: '#4ea9ff', leaf: '#55c878' },
    performance: 'persistent-static-field + one-shot opening; no particle loop'
  };

  const originalCreateWithScene = proto.create;
  proto.create = function combat2103CreateSceneRef(this: PatchableScene): void {
    originalCreateWithScene.call(this);
    root.POWDER_COMBAT2_DOMAIN_STAGE.scene = this;
  };
}
