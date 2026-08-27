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
  target?: string;
  area?: boolean;
  sureHit?: boolean;
  unavoidable?: boolean;
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

/**
 * Combat 2.6+ keeps the complete stat surface used by the legacy Core V2.
 * Percent-like secondary stats are stored in their canonical legacy units:
 * crit/evasion/accuracy/critResist/healPower/shieldPower/tenacity are 0..100,
 * while defPen and damageReduction are decimal ratios (0..1).
 */
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
  critRate: number;
  critDamage: number;
  evasion: number;
  accuracy: number;
  critResist: number;
  defPen: number;
  healPower: number;
  shieldPower: number;
  tenacity: number;
  damageReduction: number;
  abilities: CombatAbilitySet;
  passive?: CombatPassive;
  display: PowDisplayProfile;
}
