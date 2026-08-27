export type CombatSide = 'player' | 'enemy';
export type CombatRarity =
  | 'common'
  | 'rare'
  | 'super_rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'ancient';

export interface PowDisplayProfile {
  heightRatio: number;
  scaleAdjust?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface CombatAbility {
  name: string;
  power: number;
  type: string;
  status?: string;
  iconKey?: string;
  iconUrl?: string;
}

export interface CombatAbilitySet {
  basic: CombatAbility;
  skills: CombatAbility[];
  ultimate: CombatAbility;
}

export interface CombatPassive {
  id: string;
  name: string;
  element?: string;
}

export interface CombatPow {
  id: string;
  name: string;
  assetKey: string;
  assetUrl: string;
  element: string;
  elementKey: string;
  role: string;
  rarity: CombatRarity;
  level: number;
  attack: number;
  abilityPower: number;
  defense: number;
  speed: number;
  hp: number;
  maxHp: number;
  abilities: CombatAbilitySet;
  passive?: CombatPassive;
  display: PowDisplayProfile;
}
