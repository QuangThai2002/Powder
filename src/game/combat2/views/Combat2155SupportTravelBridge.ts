import type { CombatAbility } from '../data/CombatPow';
import { CombatPresentationDirector } from './CombatPresentationDirector';

const FLAG = '__powderCombat2155SupportTravelInstalled';

function normalize(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isSupportProjectileRole(view: any): boolean {
  const role = normalize(view?.pow?.role);
  return role.includes('tri lieu') || role.includes('healer') || role.includes('do don') || role.includes('tank');
}

export function installCombat2155SupportTravelBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const proto = CombatPresentationDirector.prototype as any;
  const original = proto.playSkillIntro;
  if (typeof original !== 'function') return;

  proto.playSkillIntro = async function combat2155SupportTravelIntro(
    this: any,
    actorView: any,
    targetView: any,
    ability: CombatAbility,
    slot: 0 | 1,
    elementKey: string,
    selfTargeted: boolean
  ): Promise<void> {
    await original.call(this, actorView, targetView, ability, slot, elementKey, selfTargeted);

    const support = normalize(ability?.type) === 'support';
    if (!support || selfTargeted || !actorView || !targetView || !isSupportProjectileRole(actorView)) return;
    if (!targetView?.container?.visible) return;
    const travel = actorView?.playElementTravel;
    const target = typeof targetView?.getWorldPosition === 'function' ? targetView.getWorldPosition() : null;
    if (typeof travel !== 'function' || !target) return;

    await travel.call(actorView, target.x, target.y);
  };

  root.POWDER_COMBAT2_SUPPORT_TRAVEL_VFX = {
    version: '2.15.5',
    family: 'Combat2',
    roles: ['healer', 'tank'],
    supportAbilities: true,
    nonSelfTargetsOnly: true,
    usesElementTravelNotLunge: true,
    timing: 'after-skill-intro-before-resolution',
    damageChanged: false,
    healingChanged: false,
    shieldChanged: false,
    turnFlowChanged: false,
    combatLogicChanged: false
  };
}

installCombat2155SupportTravelBridge();
