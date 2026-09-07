export type CombatSide = 'player' | 'enemy';
export type CombatRarity =
  | 'common'
  | 'rare'
  | 'super_rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'ancient';

export type CombatDamageType = 'physical' | 'magic';
export type CombatScalingStat = 'attack' | 'ability-power';
export type CritMode = 'natural-ad' | 'magic' | 'never';
export type GrievousTier = 'grievous-40' | 'grievous-60';

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
  /** Canonical damage identity. Crit behavior follows this, not the scaling stat. */
  damageType?: CombatDamageType;
  /** Kept separate so future hybrid skills can scale independently from damage identity. */
  scalingStat?: CombatScalingStat;
  critMode?: CritMode;
  /** Total Magic Crit multiplier; only read when critMode is explicitly "magic". */
  magicCritMultiplier?: number;
  /** Only an explicit Shatter hit may consume a full Freeze. */
  shatterFrozen?: boolean;
  grievousTier?: GrievousTier;
  status?: string;
  target?: string;
  area?: boolean;
  /** Canonical nominal hit count from the legacy catalog when present. */
  hits?: number;
  /** Legacy named mechanic hook (role/domain/special skill semantics). */
  mechanic?: string;
  description?: string;
  sureHit?: boolean;
  unavoidable?: boolean;
  bypassGuard?: boolean;
  pierceGuard?: boolean;
  bypassFront?: boolean;
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
  /** Flat DEF removal applied before percentage Armor Penetration. */
  lethality?: number;
  defPen: number;
  healPower: number;
  shieldPower: number;
  tenacity: number;
  damageReduction: number;
  abilities: CombatAbilitySet;
  passive?: CombatPassive;
  display: PowDisplayProfile;
}
