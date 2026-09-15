import Phaser from 'phaser';
import type { CombatUnitState } from '../systems/CombatState';
import { RAGE_READY_POINTS, formatPlayerRageBalance } from '../systems/CombatRageEngine';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  actionMenu: Phaser.GameObjects.Container | null;
  createActionMenu: (actor: CombatUnitState) => void;
  destroyActionMenu: () => void;
  __skillPanel2113?: Phaser.GameObjects.Container | null;
}

const PATCH_FLAG = '__powderCombat2113SkillCommandPanelInstalled';

function decorate(scene: PatchableScene, actor: CombatUnitState): void {
  scene.__skillPanel2113?.destroy(true);
  scene.__skillPanel2113 = null;
  const menu = scene.actionMenu;
  if (!menu || actor.side !== 'player') return;

  // Keep the battle field readable: the skill menu becomes a single bottom command deck,
  // while the actor identity/resource summary sits above it instead of competing with Pow art.
  const portrait = scene.scale.height > scene.scale.width;
  const compact = portrait || scene.scale.width < 1180;
  const deckWidth = Math.min(scene.scale.width - (compact ? 54 : 110), compact ? 760 : 1120);
  const deckHeight = compact ? 286 : 158;
  const deckY = menu.y;
  const root = scene.add.container(scene.scale.width / 2, deckY).setDepth(29);
  const shadow = scene.add.rectangle(0, 5, deckWidth + 18, deckHeight + 18, 0x02070c, 0.46).setOrigin(0.5);
  const plate = scene.add.rectangle(0, 0, deckWidth, deckHeight, 0x061722, 0.84)
    .setStrokeStyle(1.5, 0xd7b86c, 0.5);
  const topLine = scene.add.rectangle(0, -deckHeight / 2 + 3, deckWidth - 12, 3, 0x77d9eb, 0.5);
  root.add([shadow, plate, topLine]);

  const name = scene.add.text(-deckWidth / 2 + 20, -deckHeight / 2 + 17, actor.pow.name.toUpperCase(), {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: compact ? '12px' : '13px', color: '#fff0bd', fontStyle: 'bold'
  }).setOrigin(0, 0);
  const role = scene.add.text(-deckWidth / 2 + 20, -deckHeight / 2 + 39, `${actor.pow.role} · CHỌN KỸ NĂNG`, {
    fontFamily: COMBAT_BODY_FONT, fontSize: '10px', color: '#9fc6d2', fontStyle: 'bold'
  }).setOrigin(0, 0);
  const rage = Math.max(0, Math.round(Number(actor.ragePoints) || 0));
  const mana = Math.max(0, Math.round(Number(actor.manaPoints ?? 100) || 0));
  const maxMana = Math.max(1, Math.round(Number(actor.maxManaPoints ?? 100) || 100));
  const usesMana = actor.pow.abilities.skills.some((ability) => ability?.usesMana === true) || actor.pow.abilities.ultimate.usesMana === true;
  const resourceLabel = usesMana ? `${formatPlayerRageBalance(rage)} · MANA ${mana}/${maxMana}` : formatPlayerRageBalance(rage);
  const resource = scene.add.text(deckWidth / 2 - 20, -deckHeight / 2 + 25, resourceLabel, {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: rage >= RAGE_READY_POINTS ? '#ffe07a' : '#8fe8ff', fontStyle: 'bold'
  }).setOrigin(1, 0.5);
  root.add([name, role, resource]);

  // The original menu remains the single interactive source of truth; only reposition it
  // inside the new deck. This avoids duplicating handlers or touching combat calculations.
  menu.setPosition(scene.scale.width / 2, deckY + (compact ? 34 : 22));
  menu.setDepth(30);
  scene.__skillPanel2113 = root;
}

function cleanup(scene: PatchableScene): void {
  scene.__skillPanel2113?.destroy(true);
  scene.__skillPanel2113 = null;
}

export function installCombat2113SkillCommandPanelPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;
  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.createActionMenu;
  const originalDestroy = proto.destroyActionMenu;

  proto.createActionMenu = function combat2113CreateActionMenu(this: PatchableScene, actor: CombatUnitState): void {
    originalCreate.call(this, actor);
    decorate(this, actor);
  };
  proto.destroyActionMenu = function combat2113DestroyActionMenu(this: PatchableScene): void {
    cleanup(this);
    originalDestroy.call(this);
  };

  root.POWDER_COMBAT2_SKILL_PANEL = {
    version: '2.11.3',
    mode: 'bottom-command-deck',
    rules: ['single-action-source', 'actor-context', 'resource-summary', 'no-combat-logic-change']
  };
}
