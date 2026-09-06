import Phaser from 'phaser';
import type { CombatSide } from '../data/CombatPow';
import {
  LEGACY_EXPANSION_DOMAINS,
  LEGACY_SIMPLE_DOMAINS,
  type LegacyExpansionDomainId,
  type LegacySimpleDomainId,
  type LegacySimpleLevel
} from '../systems/CombatLegacyDomainEngine';
import type { CombatUnitState } from '../systems/CombatState';
import { ULTIMATE_RAGE_COST } from '../systems/CombatRageEngine';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

interface DomainApi {
  mode: 'pve' | 'pvp';
  configure: (side: CombatSide, loadout: { simpleId: LegacySimpleDomainId; simpleLevel: LegacySimpleLevel; expansionId: LegacyExpansionDomainId }) => boolean;
  activateSimple: (side?: CombatSide) => boolean;
  activateExpansion: (side?: CombatSide) => boolean;
  snapshot: (side?: CombatSide) => any;
}

interface PatchableScene extends Phaser.Scene {
  combatState: {
    round: number;
    currentUnitId: string | null;
    units: CombatUnitState[];
  };
  create: () => void;
  beginNextTurn: () => void;
  createActionMenu: (actor: CombatUnitState) => void;
  refreshViews: () => void;
  turnText: Phaser.GameObjects.Text;
  __legacyTurnHud2112?: Phaser.GameObjects.Container | null;
  __legacyTurnHudTitle2112?: Phaser.GameObjects.Text | null;
  __legacyTurnHudDetail2112?: Phaser.GameObjects.Text | null;
  __domainTest2112?: Phaser.GameObjects.Container | null;
  __domainTestBody2112?: Phaser.GameObjects.Container | null;
  __domainTestExpanded2112?: boolean;
  __domainTestSimple2112?: LegacySimpleDomainId;
  __domainTestExpansion2112?: LegacyExpansionDomainId;
  __domainTestLevel2112?: LegacySimpleLevel;
}

const PATCH_FLAG = '__powderCombat2112LegacyHudBridgeInstalled';
const SIMPLE_IDS = Object.keys(LEGACY_SIMPLE_DOMAINS) as LegacySimpleDomainId[];
const EXPANSION_IDS = Object.keys(LEGACY_EXPANSION_DOMAINS) as LegacyExpansionDomainId[];

function domainApi(): DomainApi | null {
  return ((globalThis as any).POWDER_COMBAT2_DOMAIN || null) as DomainApi | null;
}

function currentActor(scene: PatchableScene): CombatUnitState | null {
  const id = scene.combatState.currentUnitId;
  return id ? scene.combatState.units.find((unit) => unit.instanceId === id) ?? null : null;
}

function createTurnHud(scene: PatchableScene): void {
  scene.__legacyTurnHud2112?.destroy(true);
  const { width } = scene.scale;
  const root = scene.add.container(width / 2, 54).setDepth(26);
  const plate = scene.add.rectangle(0, 0, 430, 64, 0x061722, 0.92)
    .setStrokeStyle(1.5, 0xd7b86c, 0.62);
  const title = scene.add.text(0, -12, 'LƯỢT CHIẾN ĐẤU', {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: '13px',
    color: '#ffe8a8',
    fontStyle: 'bold',
    letterSpacing: 1
  }).setOrigin(0.5);
  const detail = scene.add.text(0, 13, 'ĐANG CHUẨN BỊ...', {
    fontFamily: COMBAT_BODY_FONT,
    fontSize: '15px',
    color: '#c6dce4',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  root.add([plate, title, detail]);
  scene.__legacyTurnHud2112 = root;
  scene.__legacyTurnHudTitle2112 = title;
  scene.__legacyTurnHudDetail2112 = detail;
}

function refreshTurnHud(scene: PatchableScene): void {
  const actor = currentActor(scene);
  if (!scene.__legacyTurnHudTitle2112 || !scene.__legacyTurnHudDetail2112) return;
  scene.__legacyTurnHudTitle2112.setText(`VÒNG ${Math.max(1, Number(scene.combatState.round) || 1)} · LƯỢT HIỆN TẠI`);
  if (!actor) {
    scene.__legacyTurnHudDetail2112.setText('ĐANG CHUYỂN LƯỢT').setColor('#b6cbd3');
    return;
  }
  const side = actor.side === 'player' ? 'TAMER' : 'ĐỐI THỦ';
  const rage = Math.max(0, Math.floor(Number(actor.ragePoints) || 0));
  scene.__legacyTurnHudTitle2112.setText(`VÒNG ${Math.max(1, Number(scene.combatState.round) || 1)} · ${side}`);
  scene.__legacyTurnHudDetail2112
    .setText(`${actor.pow.name} · NỘ ${rage}/${ULTIMATE_RAGE_COST}`)
    .setColor(actor.side === 'player' ? '#83e9ff' : '#ff9eab');
}

function addButton(
  scene: PatchableScene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  label: string,
  onClick: () => void,
  accent = 0x77d9eb
): void {
  const bg = scene.add.rectangle(x, y, width, 36, 0x0b2431, 0.96)
    .setStrokeStyle(1, accent, 0.58);
  const text = scene.add.text(x, y, label, {
    fontFamily: COMBAT_BODY_FONT,
    fontSize: '11px',
    color: '#edfaff',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(x, y, width, 36, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerover', () => bg.setScale(1.02));
  hit.on('pointerout', () => bg.setScale(1));
  hit.on('pointerup', onClick);
  parent.add([bg, text, hit]);
}

function ensureBranchMatch(scene: PatchableScene): void {
  const expansion = LEGACY_EXPANSION_DOMAINS[scene.__domainTestExpansion2112!];
  const simple = LEGACY_SIMPLE_DOMAINS[scene.__domainTestSimple2112!];
  if (simple.branch === expansion.branch) return;
  const match = SIMPLE_IDS.find((id) => LEGACY_SIMPLE_DOMAINS[id].branch === expansion.branch);
  if (match) scene.__domainTestSimple2112 = match;
}

function statusLine(scene: PatchableScene): string {
  const api = domainApi();
  const snap = api?.snapshot('player');
  if (!snap) return 'Chưa có trạng thái Lãnh Địa';
  if (snap.expansion) {
    const cfg = LEGACY_EXPANSION_DOMAINS[snap.expansion.id as LegacyExpansionDomainId];
    return `${cfg?.short || 'BÀNH TRƯỚNG'} · còn ${snap.expansion.actionsRemaining} hành động`;
  }
  if (snap.simpleActive) {
    const cfg = LEGACY_SIMPLE_DOMAINS[snap.simpleActive.id as LegacySimpleDomainId];
    return `${cfg?.short || 'GIẢN DỊ'} · đang hiệu lực`;
  }
  return `Giản Dị còn ${snap.simpleCharges ?? 3}/3`;
}

function rebuildDomainBody(scene: PatchableScene): void {
  scene.__domainTestBody2112?.destroy(true);
  scene.__domainTestBody2112 = null;
  if (!scene.__domainTestExpanded2112 || !scene.__domainTest2112) return;

  ensureBranchMatch(scene);
  const simpleId = scene.__domainTestSimple2112!;
  const expansionId = scene.__domainTestExpansion2112!;
  const level = scene.__domainTestLevel2112!;
  const simple = LEGACY_SIMPLE_DOMAINS[simpleId];
  const expansion = LEGACY_EXPANSION_DOMAINS[expansionId];
  const body = scene.add.container(0, 58);
  scene.__domainTestBody2112 = body;
  scene.__domainTest2112.add(body);

  const plate = scene.add.rectangle(0, 74, 310, 260, 0x06141e, 0.96)
    .setStrokeStyle(1.5, 0xd7b86c, 0.58);
  body.add(plate);

  const simpleLabel = scene.add.text(0, -28, `GIẢN DỊ · ${simple.short} · CẤP ${level}`, {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#ffe7a6', fontStyle: 'bold', fixedWidth: 284, align: 'center'
  }).setOrigin(0.5);
  const expansionLabel = scene.add.text(0, 18, `BÀNH TRƯỚNG · ${expansion.short}`, {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#bcefff', fontStyle: 'bold', fixedWidth: 284, align: 'center'
  }).setOrigin(0.5);
  const state = scene.add.text(0, 178, statusLine(scene), {
    fontFamily: COMBAT_BODY_FONT, fontSize: '10px', color: '#91b6c1', fixedWidth: 284, align: 'center'
  }).setOrigin(0.5);
  body.add([simpleLabel, expansionLabel, state]);

  addButton(scene, body, -105, -2, 54, '◀', () => {
    const idx = SIMPLE_IDS.indexOf(scene.__domainTestSimple2112!);
    scene.__domainTestSimple2112 = SIMPLE_IDS[(idx - 1 + SIMPLE_IDS.length) % SIMPLE_IDS.length];
    const branch = LEGACY_SIMPLE_DOMAINS[scene.__domainTestSimple2112].branch;
    scene.__domainTestExpansion2112 = EXPANSION_IDS.find((id) => LEGACY_EXPANSION_DOMAINS[id].branch === branch) || expansionId;
    rebuildDomainBody(scene);
  });
  addButton(scene, body, 105, -2, 54, '▶', () => {
    const idx = SIMPLE_IDS.indexOf(scene.__domainTestSimple2112!);
    scene.__domainTestSimple2112 = SIMPLE_IDS[(idx + 1) % SIMPLE_IDS.length];
    const branch = LEGACY_SIMPLE_DOMAINS[scene.__domainTestSimple2112].branch;
    scene.__domainTestExpansion2112 = EXPANSION_IDS.find((id) => LEGACY_EXPANSION_DOMAINS[id].branch === branch) || expansionId;
    rebuildDomainBody(scene);
  });
  addButton(scene, body, 0, 54, 170, `ĐỔI CẤP ${level}`, () => {
    scene.__domainTestLevel2112 = (level >= 3 ? 1 : level + 1) as LegacySimpleLevel;
    rebuildDomainBody(scene);
  });
  addButton(scene, body, -105, 100, 54, '◀', () => {
    const sameBranch = EXPANSION_IDS.filter((id) => LEGACY_EXPANSION_DOMAINS[id].branch === simple.branch);
    const idx = sameBranch.indexOf(scene.__domainTestExpansion2112!);
    scene.__domainTestExpansion2112 = sameBranch[(idx - 1 + sameBranch.length) % sameBranch.length];
    rebuildDomainBody(scene);
  });
  addButton(scene, body, 105, 100, 54, '▶', () => {
    const sameBranch = EXPANSION_IDS.filter((id) => LEGACY_EXPANSION_DOMAINS[id].branch === simple.branch);
    const idx = sameBranch.indexOf(scene.__domainTestExpansion2112!);
    scene.__domainTestExpansion2112 = sameBranch[(idx + 1) % sameBranch.length];
    rebuildDomainBody(scene);
  });

  addButton(scene, body, -78, 142, 138, 'TRANG BỊ TEST', () => {
    const api = domainApi();
    const ok = api?.configure('player', {
      simpleId: scene.__domainTestSimple2112!,
      simpleLevel: scene.__domainTestLevel2112!,
      expansionId: scene.__domainTestExpansion2112!
    });
    scene.turnText.setText(ok ? 'ĐÃ TRANG BỊ BỘ TEST LÃNH ĐỊA' : 'KHÔNG THỂ TRANG BỊ BỘ TEST').setColor(ok ? '#9dffbf' : '#ff9aa9');
    scene.refreshViews();
    const actor = currentActor(scene);
    if (actor?.side === 'player') scene.createActionMenu(actor);
    rebuildDomainBody(scene);
  }, 0xd7b86c);
  addButton(scene, body, 78, 142, 138, 'MỞ GIẢN DỊ', () => {
    const ok = domainApi()?.activateSimple('player') ?? false;
    scene.turnText.setText(ok ? 'GIẢN DỊ LÃNH ĐỊA ĐÃ KÍCH HOẠT' : 'KHÔNG THỂ MỞ GIẢN DỊ').setColor(ok ? '#ffe08a' : '#ff9aa9');
    scene.refreshViews();
    rebuildDomainBody(scene);
  }, 0x9dd8ff);
  addButton(scene, body, 0, 218, 286, 'BÀNH TRƯỚNG LÃNH ĐỊA · TEST', () => {
    const api = domainApi();
    if (api) api.mode = 'pvp';
    const ok = api?.activateExpansion('player') ?? false;
    scene.turnText.setText(ok ? 'BÀNH TRƯỚNG LÃNH ĐỊA ĐÃ KÍCH HOẠT' : 'KHÔNG THỂ MỞ BÀNH TRƯỚNG').setColor(ok ? '#ffd36a' : '#ff9aa9');
    scene.refreshViews();
    rebuildDomainBody(scene);
  }, 0xffd36a);
}

function createDomainTestDock(scene: PatchableScene): void {
  scene.__domainTest2112?.destroy(true);
  scene.__domainTestSimple2112 = scene.__domainTestSimple2112 || 'crimson';
  scene.__domainTestExpansion2112 = scene.__domainTestExpansion2112 || 'nine_suns';
  scene.__domainTestLevel2112 = scene.__domainTestLevel2112 || 3;
  scene.__domainTestExpanded2112 = false;

  const root = scene.add.container(174, 46).setDepth(70);
  scene.__domainTest2112 = root;
  const bg = scene.add.rectangle(0, 0, 304, 44, 0x071a25, 0.96).setStrokeStyle(1.5, 0xd7b86c, 0.62);
  const label = scene.add.text(0, 0, 'TEST LÃNH ĐỊA', {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '12px', color: '#ffe7a6', fontStyle: 'bold'
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, 304, 44, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerup', () => {
    scene.__domainTestExpanded2112 = !scene.__domainTestExpanded2112;
    rebuildDomainBody(scene);
  });
  root.add([bg, label, hit]);
}

export function installCombat2112LegacyHudBridgePatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.create;
  const originalBeginNextTurn = proto.beginNextTurn;

  proto.create = function combat2112Create(this: PatchableScene): void {
    originalCreate.call(this);
    createTurnHud(this);
    createDomainTestDock(this);
    refreshTurnHud(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.__legacyTurnHud2112 = null;
      this.__domainTest2112 = null;
      this.__domainTestBody2112 = null;
    });
  };

  proto.beginNextTurn = function combat2112BeginNextTurn(this: PatchableScene): void {
    originalBeginNextTurn.call(this);
    refreshTurnHud(this);
  };

  root.POWDER_COMBAT2_LEGACY_UI_BRIDGE = {
    version: '2.11.2',
    mode: 'turn-hud-domain-test-dock',
    restored: ['turn-hud', 'domain-test-controls'],
    standaloneOnly: true
  };
}
