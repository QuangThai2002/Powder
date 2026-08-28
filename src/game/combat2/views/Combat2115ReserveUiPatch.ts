import type { CombatSide } from '../data/CombatPow';

interface RuntimeUnit {
  instanceId: string;
  side: CombatSide;
  alive: boolean;
  fieldSlot: number | null;
}

const PATCH_FLAG = '__powderCombat2115ReserveUiInstalled';

function reserveUnits(scene: any, side: CombatSide): RuntimeUnit[] {
  try {
    const state = scene.combatState;
    if (!state || typeof state.reserveLiving !== 'function') return [];
    return state.reserveLiving(side) as RuntimeUnit[];
  } catch {
    return [];
  }
}

function applyReservePresentation(scene: any, side: CombatSide): void {
  const reserves = reserveUnits(scene, side).slice(0, 2);
  for (const unit of reserves) {
    const view = scene.powViews?.get?.(unit.instanceId);
    if (!view?.container) continue;

    if (side === 'enemy') {
      // Enemy reserves stay fully present in CombatState/TurnManager; only their bench cards are hidden.
      view.setTargetable?.(false);
      view.setSelectedTarget?.(false);
      view.container.setVisible(false);
      continue;
    }

    // Keep the player's own bench readable but less dominant so the battlefield and command UI have more room.
    view.container.setVisible(true).setAlpha(0.88);
    view.setBenchScale?.(0.42);
  }
}

export function installCombat2115ReserveUiPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalCreateTeam = proto.createTeam;
  const originalLayoutReserveViews = proto.layoutReserveViews;
  const originalRestoreRevivedReserve = proto.restoreRevivedReserve;

  if (typeof originalCreateTeam === 'function') {
    proto.createTeam = function combat2115CreateTeam(this: any, side: CombatSide, team: any[]): void {
      originalCreateTeam.call(this, side, team);
      applyReservePresentation(this, side);
    };
  }

  if (typeof originalLayoutReserveViews === 'function') {
    proto.layoutReserveViews = function combat2115LayoutReserveViews(this: any, side: CombatSide): void {
      originalLayoutReserveViews.call(this, side);
      applyReservePresentation(this, side);
    };
  }

  if (typeof originalRestoreRevivedReserve === 'function') {
    proto.restoreRevivedReserve = function combat2115RestoreRevivedReserve(this: any, unit: RuntimeUnit): void {
      originalRestoreRevivedReserve.call(this, unit);
      applyReservePresentation(this, unit.side);
    };
  }

  root.POWDER_COMBAT2_RESERVE_UI = {
    version: '2.11.5',
    mode: 'enemy-bench-hidden-player-bench-compact',
    rules: [
      'presentation-only',
      'enemy-reserve-state-preserved',
      'enemy-promotion-preserved',
      'player-reserve-visible',
      'no-combat-logic-change'
    ]
  };
}
