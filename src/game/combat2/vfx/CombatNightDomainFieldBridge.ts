import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';
import {
  LEGACY_EXPANSION_DOMAINS,
  type LegacyExpansionDomainId
} from '../systems/CombatLegacyDomainEngine';

const FLAG = '__powderCombatNightDomainFieldInstalled';

type DomainSide = 'player' | 'enemy';
interface NightDomainScene extends Phaser.Scene {
  refreshViews?: (...args: any[]) => void;
  __nightDomainField?: Phaser.GameObjects.Container | null;
  __nightDomainSignature?: string;
}

function snapshot(side: DomainSide): { id: LegacyExpansionDomainId } | null {
  try {
    const api = (globalThis as any).POWDER_COMBAT2_DOMAIN;
    const state = api?.snapshot?.(side);
    const id = state?.expansion?.id as LegacyExpansionDomainId | undefined;
    return id && LEGACY_EXPANSION_DOMAINS[id] ? { id } : null;
  } catch {
    return null;
  }
}

function domainSignature(): string {
  return (['enemy', 'player'] as const)
    .map((side) => `${side}:${snapshot(side)?.id ?? 'none'}`)
    .join('|');
}

function palette(id: LegacyExpansionDomainId): { core: number; accent: number } {
  if (id === 'nine_suns') return { core: 0xff6c32, accent: 0xffd35a };
  if (id === 'infinite_strike') return { core: 0xff875c, accent: 0xfff0c6 };
  if (id === 'limitless_void') return { core: 0x6d79ff, accent: 0xd9dcff };
  if (id === 'frozen_silence') return { core: 0x77dfff, accent: 0xe8fdff };
  if (id === 'diamond_guard') return { core: 0x87bfff, accent: 0xd7edff };
  if (id === 'jackpot_bagua') return { core: 0xffd56a, accent: 0xfff0b0 };
  if (id === 'myriad_poison') return { core: 0x7cc65d, accent: 0xb780e8 };
  if (id === 'rebirth_wood') return { core: 0x65d583, accent: 0xc9f59b };
  return { core: 0xd9e6ef, accent: 0xffffff };
}

function drawOwnershipEdge(
  g: Phaser.GameObjects.Graphics,
  side: DomainSide,
  w: number,
  h: number,
  color: number
): void {
  const frontY = side === 'enemy' ? h * 0.35 : -h * 0.35;
  const pointDirection = side === 'enemy' ? 1 : -1;
  const segmentWidth = w * 0.09;
  const gap = w * 0.035;
  const startX = -(segmentWidth * 2.5 + gap * 2);

  g.lineStyle(3, color, 0.24);
  for (let index = 0; index < 5; index += 1) {
    const x = startX + index * (segmentWidth + gap);
    g.lineBetween(x, frontY, x + segmentWidth, frontY);
  }

  g.lineStyle(2, color, 0.22);
  for (let index = -2; index <= 2; index += 1) {
    const x = index * w * 0.11;
    const tipY = frontY + pointDirection * 9;
    const backY = frontY - pointDirection * 4;
    g.lineBetween(x - 7, backY, x, tipY);
    g.lineBetween(x + 7, backY, x, tipY);
  }
}

function drawMotif(scene: Phaser.Scene, id: LegacyExpansionDomainId, side: DomainSide): Phaser.GameObjects.Container {
  const w = Math.min(scene.scale.width * 0.72, 1120);
  const h = Math.min(scene.scale.height * 0.2, 170);
  const y = side === 'enemy' ? scene.scale.height * 0.35 : scene.scale.height * 0.65;
  const c = palette(id);
  const container = scene.add.container(scene.scale.width / 2, y).setDepth(-11);
  const g = scene.add.graphics();

  // Ground-only footprint. Alpha is deliberately low so Pow silhouettes and HUD stay dominant.
  g.fillStyle(c.core, 0.035);
  g.fillEllipse(0, 0, w, h);
  g.lineStyle(2, c.core, 0.18);
  g.strokeEllipse(0, 0, w, h);
  drawOwnershipEdge(g, side, w, h, c.accent);

  if (id === 'nine_suns') {
    for (let i = 0; i < 9; i += 1) {
      const angle = Math.PI * 2 * i / 9;
      const x = Math.cos(angle) * w * 0.29;
      const yy = Math.sin(angle) * h * 0.28;
      g.fillStyle(c.accent, 0.08);
      g.fillCircle(x, yy, 13);
      g.lineStyle(2, c.accent, 0.25);
      g.strokeCircle(x, yy, 19);
    }
  } else if (id === 'infinite_strike') {
    g.lineStyle(4, c.accent, 0.22);
    for (let i = -4; i <= 4; i += 1) {
      const x = i * (w * 0.075);
      g.lineBetween(x - 32, 38, x + 30, -38);
      g.lineBetween(x - 8, 36, x + 48, -18);
    }
  } else if (id === 'limitless_void') {
    g.lineStyle(3, c.accent, 0.24);
    g.strokeEllipse(0, 0, w * 0.55, h * 0.55);
    g.lineStyle(2, c.core, 0.2);
    g.strokeEllipse(0, 0, w * 0.34, h * 0.34);
    g.fillStyle(0x050713, 0.2);
    g.fillEllipse(0, 0, w * 0.12, h * 0.19);
  } else if (id === 'frozen_silence') {
    g.lineStyle(3, c.accent, 0.23);
    for (let i = 0; i < 8; i += 1) {
      const angle = Math.PI * 2 * i / 8;
      g.lineBetween(0, 0, Math.cos(angle) * w * 0.25, Math.sin(angle) * h * 0.36);
    }
    g.lineStyle(2, c.core, 0.18);
    g.strokeEllipse(0, 0, w * 0.48, h * 0.6);
  } else if (id === 'diamond_guard') {
    g.lineStyle(3, c.accent, 0.21);
    for (let i = -3; i <= 3; i += 1) {
      const x = i * w * 0.09;
      g.strokePoints([
        new Phaser.Math.Vector2(x, -34),
        new Phaser.Math.Vector2(x + 42, 0),
        new Phaser.Math.Vector2(x, 34),
        new Phaser.Math.Vector2(x - 42, 0)
      ], true);
    }
  } else if (id === 'jackpot_bagua') {
    g.lineStyle(5, c.accent, 0.22);
    for (let i = 0; i < 8; i += 1) {
      const angle = Math.PI * 2 * i / 8;
      const x1 = Math.cos(angle) * w * 0.16;
      const y1 = Math.sin(angle) * h * 0.2;
      const x2 = Math.cos(angle) * w * 0.28;
      const y2 = Math.sin(angle) * h * 0.34;
      g.lineBetween(x1, y1, x2, y2);
    }
    g.lineStyle(2, c.core, 0.18);
    g.strokeEllipse(0, 0, w * 0.36, h * 0.5);
  } else if (id === 'myriad_poison') {
    // Irregular puddles stay low on the floor; no skull/icon and no perfect AOE circle.
    const blobs = [
      [-w * 0.2, 12, 150, 42], [w * 0.03, -8, 190, 48], [w * 0.24, 15, 125, 35], [-w * 0.03, 30, 120, 30]
    ] as const;
    for (const [x, yy, bw, bh] of blobs) {
      g.fillStyle(c.core, 0.055);
      g.fillEllipse(x, yy, bw, bh);
      g.lineStyle(2, c.accent, 0.16);
      g.strokeEllipse(x, yy, bw, bh);
    }
  } else if (id === 'rebirth_wood') {
    g.lineStyle(3, c.accent, 0.19);
    for (let i = -3; i <= 3; i += 1) {
      const x = i * w * 0.09;
      g.beginPath();
      g.moveTo(x - 40, 34);
      g.quadraticBezierTo(x, -36, x + 46, 20);
      g.strokePath();
      g.strokeEllipse(x + 18, -10, 40, 18);
    }
  } else {
    // Rút Kiếm Ra: five readable sword traces, all on the floor layer.
    g.lineStyle(5, c.accent, 0.23);
    for (let i = -2; i <= 2; i += 1) {
      const x = i * w * 0.105;
      g.lineBetween(x - 18, 38, x + 22, -38);
      g.lineStyle(3, c.core, 0.2);
      g.lineBetween(x - 7, 14, x + 32, 27);
      g.lineStyle(5, c.accent, 0.23);
    }
  }

  container.add(g);
  return container;
}

function drawClashSeam(
  scene: Phaser.Scene,
  enemyId: LegacyExpansionDomainId,
  playerId: LegacyExpansionDomainId
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(-10.8);
  const width = Math.min(scene.scale.width * 0.64, 980);
  const centerX = scene.scale.width / 2;
  const y = scene.scale.height * 0.5;
  const enemy = palette(enemyId);
  const player = palette(playerId);
  const half = width / 2;

  g.lineStyle(2, enemy.accent, 0.2);
  g.lineBetween(centerX - half, y - 3, centerX - 12, y - 3);
  g.lineStyle(2, player.accent, 0.2);
  g.lineBetween(centerX + 12, y + 3, centerX + half, y + 3);

  // Small crossed center marks communicate two active territories without a large UI banner.
  g.lineStyle(3, enemy.core, 0.24);
  g.lineBetween(centerX - 18, y - 10, centerX + 6, y + 10);
  g.lineStyle(3, player.core, 0.24);
  g.lineBetween(centerX - 6, y + 10, centerX + 18, y - 10);
  return g;
}

function sync(scene: NightDomainScene): void {
  const next = domainSignature();
  if (scene.__nightDomainSignature === next) return;
  scene.__nightDomainSignature = next;
  scene.__nightDomainField?.destroy(true);
  scene.__nightDomainField = scene.add.container(0, 0).setDepth(-11);

  const enemy = snapshot('enemy');
  const player = snapshot('player');
  if (enemy) scene.__nightDomainField.add(drawMotif(scene, enemy.id, 'enemy'));
  if (player) scene.__nightDomainField.add(drawMotif(scene, player.id, 'player'));
  if (enemy && player) scene.__nightDomainField.add(drawClashSeam(scene, enemy.id, player.id));
}

export function installCombatNightDomainFieldBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const proto = BattleScene.prototype as any;
  const previousRefresh = proto.refreshViews;
  if (typeof previousRefresh !== 'function') return;
  proto.refreshViews = function combatNightDomainRefresh(this: NightDomainScene, ...args: any[]): void {
    previousRefresh.apply(this, args);
    sync(this);
  };

  root.POWDER_COMBAT2_NIGHT_DOMAIN = {
    version: 'night-21',
    mode: 'nine-expansion-ground-motifs-owner-boundary-clash-seam',
    particles: false,
    tweenLoops: false,
    depth: -11,
    ownerBoundary: true,
    clashSeam: true,
    identityRebuildOnly: true,
    combatLogicChanged: false
  };
}

installCombatNightDomainFieldBridge();
