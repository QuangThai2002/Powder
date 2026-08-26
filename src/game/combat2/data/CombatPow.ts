export type CombatSide = 'player' | 'enemy';

export interface PowDisplayProfile {
  /** Desired texture height relative to the art viewport. */
  heightRatio: number;
  /** Fine-tune the texture after the base fit. */
  scaleAdjust?: number;
  /** Display offsets inside the portrait viewport. */
  offsetX?: number;
  offsetY?: number;
}

export interface CombatAbility {
  name: string;
  power: number;
  type: string;
  status?: string;
}

export interface CombatAbilitySet {
  basic: CombatAbility;
  skills: CombatAbility[];
  ultimate: CombatAbility;
}

export interface CombatPow {
  id: string;
  name: string;
  assetKey: string;
  assetUrl: string;
  element: string;
  elementKey: string;
  role: string;
  level: number;
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  rage: number;
  maxRage: number;
  abilities: CombatAbilitySet;
  display: PowDisplayProfile;
}
