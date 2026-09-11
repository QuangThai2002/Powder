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

export interface CombatConditionalDamageModifier {
  condition: {
    targetStatus: 'paralysis';
  };
  multiplier: number;
  /** Phase 2A conditional damage checks are read-only status predicates. */
  consumeStatus: false;
  removeStatus: false;
  reduceStatusDuration: false;
}

export interface CombatPassiveCounterGain {
  counterId: string;
  amount: number;
  max: number;
  target: 'designatedCarry';
  timing: 'afterMainAction' | 'afterUltimateActionConfirmed';
}

export interface PowDisplayProfile {
  heightRatio: number;
  scaleAdjust?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface CombatAbility {
  id?: string;
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
  targetRule?: string;
  area?: boolean;
  /** Canonical nominal hit count from the legacy catalog when present. */
  hits?: number;
  /** Legacy named mechanic hook (role/domain/special skill semantics). */
  mechanic?: string;
  manaCost?: number;
  cooldown?: number;
  rageCost?: number;
  coefficients?: Readonly<Record<string, number>>;
  masterEffects?: Readonly<Record<string, unknown>>;
  conditionalDamageModifier?: CombatConditionalDamageModifier;
  passiveCounterGain?: CombatPassiveCounterGain;
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
  description?: string;
  artUrl?: string;
  mechanic?: CombatPassiveMechanic;
}

export type CombatPassiveTrigger =
  | 'ON_BATTLE_START' | 'ON_TURN_START' | 'BEFORE_ACTION' | 'AFTER_ACTION'
  | 'BEFORE_HIT' | 'AFTER_HIT' | 'ON_CRIT' | 'ON_RECEIVE_DAMAGE'
  | 'ON_DAMAGE_DEALT' | 'ON_HEAL' | 'ON_SHIELD' | 'ON_STATUS_APPLIED'
  | 'ON_STATUS_RECEIVED' | 'ON_HP_THRESHOLD' | 'ON_ALLY_DEATH'
  | 'ON_ENEMY_DEATH' | 'ON_RESERVE_ENTER' | 'ON_KILL' | 'ON_REVIVE'
  | 'ON_SHIELD_BREAK';

export interface CombatPassiveMechanic {
  trigger: CombatPassiveTrigger;
  condition?: Readonly<Record<string, unknown>>;
  effect: Readonly<Record<string, unknown>>;
  runtime?: 'LIVE' | 'REQUIRES_COMBO_CONTEXT' | 'REQUIRES_TEAM_CONTEXT' | 'REQUIRES_EXTRA_TURN_CONTEXT';
}

export interface CombatCore {
  name: string;
  description: string;
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
  stars?: number;
  maxStars?: number;
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
  /** V8.1 combat identity metadata. This is not the Pow's canonical Passive. */
  core?: CombatCore;
  skillStarProgression?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  display: PowDisplayProfile;
}
