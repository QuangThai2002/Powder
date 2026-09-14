import type {
  CombatAbility,
  CombatAbilitySet,
  CombatConditionalDamageModifier,
  CombatPassiveCounterGain,
  CombatPyroonMechanic,
  CombatPassive,
  CombatPassiveMechanic,
  CombatPow,
  CombatRarity,
  PowDisplayProfile
} from './CombatPow';

interface CatalogElement { name?: string; }
interface CatalogStats {
  hp?: number;
  atk?: number;
  ap?: number;
  def?: number;
  speed?: number;
  critRate?: number;
  critDamage?: number;
  evasion?: number;
  accuracy?: number;
  critResist?: number;
  lethality?: number;
  defPen?: number;
  healPower?: number;
  shieldPower?: number;
  tenacity?: number;
  damageReduction?: number;
}
interface CatalogAbility {
  id?: string;
  name?: string;
  description?: string;
  power?: number;
  type?: string;
  damageType?: string;
  scalingStat?: string;
  critMode?: string;
  magicCritMultiplier?: number;
  shatterFrozen?: boolean;
  grievousTier?: string;
  status?: string;
  target?: string;
  targetRule?: string;
  hits?: number;
  specialMechanic?: string;
  manaCost?: number;
  cooldown?: number;
  rageCost?: number;
  rageGainMode?: string;
  coefficients?: Record<string, number>;
  masterEffects?: Record<string, unknown>;
  conditionalDamageModifier?: {
    condition?: { targetStatus?: string };
    multiplier?: number;
    consumeStatus?: boolean;
    removeStatus?: boolean;
    reduceStatusDuration?: boolean;
  };
  passiveCounterGain?: {
    counterId?: string;
    amount?: number;
    max?: number;
    target?: string;
    timing?: string;
  };
  pyroonMechanic?: CombatPyroonMechanic;
  usesMana?: boolean;
  /** Adapter-only marker for an approved ability replacement that rejects legacy effects. */
  clearLegacyEffects?: boolean;
  area?: boolean;
  sureHit?: boolean;
  unavoidable?: boolean;
  bypassGuard?: boolean;
  pierceGuard?: boolean;
  bypassFront?: boolean;
}
interface CatalogPassive {
  id?: string;
  name?: string;
  element?: string;
  description?: string;
  art?: string;
  mechanic?: CombatPassiveMechanic;
}
interface CatalogAbilities {
  basic?: CatalogAbility;
  skills?: CatalogAbility[];
  ultimate?: CatalogAbility;
  passive?: CatalogPassive;
}
interface CatalogPow {
  id?: string;
  name?: string;
  element?: string;
  role?: string;
  combatRole?: string;
  roleTags?: string[];
  rarity?: string;
  asset?: string;
  rosterOrder?: number;
  startStars?: number;
  maxStars?: number;
  passiveArt?: string;
  stats?: CatalogStats;
  abilities?: CatalogAbilities;
  skillStarProgression?: Array<Record<string, unknown>>;
}
interface PowderCatalog {
  elements?: Record<string, CatalogElement>;
  pows?: CatalogPow[];
}

type CanonicalSkillMetadata = CatalogAbility;
interface CanonicalPowKit {
  nativeStar?: number;
  maxStarWorkbook?: number;
  core?: string;
  coreDescription?: string;
  skills?: Partial<Record<'basic' | 'skill1' | 'skill2' | 'ultimate', CanonicalSkillMetadata>>;
  starProgression?: Array<Record<string, unknown>>;
}
interface CanonicalSkillCatalog { pows?: Record<string, CanonicalPowKit>; }
interface CanonicalSkillArt { get?: (abilityOrId: string | { id?: string }) => string; }
interface CanonicalPassiveDefinition extends CombatPassiveMechanic { description?: string; }
interface CanonicalPassiveCatalog { get?: (id: string) => CanonicalPassiveDefinition | null; }
interface CanonicalFormResolver {
  resolveAbility?: (pow: CatalogPow, ability: CatalogAbility, stars: number) => CatalogAbility;
  statsAt?: (pow: CatalogPow, stars: number) => CatalogStats;
}

declare global {
  interface Window {
    POWDER_DATA?: PowderCatalog;
    POWDER_SKILL_V81?: CanonicalSkillCatalog;
    POWDER_SKILL_ART?: CanonicalSkillArt;
    POWDER_PASSIVE_CATALOG?: CanonicalPassiveCatalog;
    POWDER_FORM_RESOLVER?: CanonicalFormResolver;
  }
}

export const ACTIVE_TEAM_SIZE = 3;
export const RESERVE_TEAM_SIZE = 2;
export const TOTAL_TEAM_SIZE = ACTIVE_TEAM_SIZE + RESERVE_TEAM_SIZE;

const PLAYER_PREFERRED_IDS = [
  'mosshorn', 'voltkit', 'pyroon', 'frostmaw', 'tidewarden'
] as const;
const ENEMY_PREFERRED_IDS = [
  'terrapup', 'aquabub', 'zephyroo', 'gearbit', 'stormeon'
] as const;

const CANONICAL_SKILL_ART_PREFIX = '/assets/skills/v81/';
export const STANDARD_POW_COUNT = 99;
export const STANDARD_SKILLS_PER_POW = 4;
export const STANDARD_POW_SKILL_COUNT = STANDARD_POW_COUNT * STANDARD_SKILLS_PER_POW;

// Approved Phase 2A decisions are projected by stable Pow ID so the internal
// recovery registry does not need to be bundled into the player build.
const PHASE_2A_ABILITY_METADATA = {
  pyroon: {
    basic: {
      id: 'pyroon.basic',
      name: 'Hỏa Tiễn Thăm Dò',
      description: 'Gây 82% ATK lên mục tiêu hợp lệ. Nếu đánh liên tiếp cùng mục tiêu, nhận 1 Tập Trung; chí mạng nhận thêm 1, tối đa 2 mỗi hành động.',
      power: 82,
      type: 'physical',
      damageType: 'physical',
      scalingStat: 'attack',
      critMode: 'natural-ad',
      target: 'enemy',
      manaCost: 0,
      cooldown: 0,
      coefficients: { attack: 0.82 },
      clearLegacyEffects: true,
      pyroonMechanic: {
        kind: 'focus-basic',
        focusCap: 3,
        sameTargetGain: 1,
        critGain: 1,
        actionGainCap: 2
      }
    },
    skill1: {
      id: 'pyroon.skill1',
      name: 'Xuyên Tâm Hỏa Tuyến',
      description: '22 Mana, CD 2; cần ít nhất 1 Tập Trung. Gây 118% ATK, tiêu toàn bộ Tập Trung và tăng 14% total damage mỗi tầng. Đủ 3 tầng thì chắc chắn chí mạng.',
      power: 118,
      type: 'physical',
      damageType: 'physical',
      scalingStat: 'attack',
      critMode: 'natural-ad',
      target: 'enemy',
      manaCost: 22,
      cooldown: 2,
      coefficients: { attack: 1.18 },
      clearLegacyEffects: true,
      usesMana: true,
      pyroonMechanic: {
        kind: 'focus-pierce',
        focusRequired: 1,
        damagePerFocus: 0.14,
        guaranteedCritAt: 3,
        consumeAllFocus: true
      }
    },
    skill2: {
      id: 'pyroon.skill2',
      name: 'Mồi Lửa Tập Kích',
      description: '30 Mana, CD 3; đặt Mồi Lửa trong 2 lượt. Hai lần sát thương trực tiếp đầu tiên của đồng minh gây thêm 18% ATK của Pyroon và Thiêu Đốt; lần hai cho Pyroon 1 Tập Trung.',
      power: 0,
      type: 'debuff',
      damageType: 'physical',
      scalingStat: 'attack',
      critMode: 'never',
      target: 'enemy',
      manaCost: 30,
      cooldown: 3,
      coefficients: {},
      clearLegacyEffects: true,
      usesMana: true,
      pyroonMechanic: {
        kind: 'fire-bait',
        durationActions: 2,
        triggerLimit: 2,
        procAttackRatio: 0.18,
        burnPerTrigger: 1,
        focusOnFinalTrigger: 1
      }
    },
    ultimate: {
      id: 'pyroon.ultimate',
      name: 'Vũ Điệu Bảy Tia',
      description: '4 Nộ, 32 Mana; bắn 5 phát, mỗi phát 48% ATK. Mục tiêu bị hạ thì chuyển sang địch thấp HP nhất; chí mạng làm phát kế +12% damage; đủ 3 Tập Trung bảo đảm phát cuối chí mạng.',
      power: 48,
      type: 'physical',
      damageType: 'physical',
      scalingStat: 'attack',
      critMode: 'natural-ad',
      target: 'enemy',
      hits: 5,
      manaCost: 32,
      cooldown: 0,
      rageCost: 4,
      coefficients: { attack: 0.48 },
      clearLegacyEffects: true,
      usesMana: true,
      pyroonMechanic: {
        kind: 'seven-rays',
        shots: 5,
        shotAttackRatio: 0.48,
        nextShotCritBonus: 0.12,
        guaranteedFinalCritAtFocus: 3,
        retarget: 'lowest-hp',
        preferFireBait: true
      }
    }
  },
  zephyroo: {
    basic: {
      id: 'zephyroo.basic',
      name: 'Đánh Gió',
      description: 'Đánh Gió: gây 70% AP.',
      power: 70,
      type: 'magic',
      damageType: 'magic',
      scalingStat: 'ability-power',
      critMode: 'never',
      coefficients: { abilityPower: 0.7 },
      masterEffects: {}
    }
  },
  voltkit: {
    ultimate: {
      id: 'voltkit.ultimate',
      name: 'Lôi Kích',
      description: 'Lôi Kích: tiêu 4 Nộ. Gây 200% AP lên mục tiêu. Nếu mục tiêu đang Tê Liệt, hit này gây +35% damage; không tiêu, xóa hoặc rút ngắn Tê Liệt.',
      power: 200,
      type: 'magic',
      damageType: 'magic',
      scalingStat: 'ability-power',
      critMode: 'never',
      target: 'enemy',
      area: false,
      cooldown: 0,
      rageCost: 4,
      coefficients: { abilityPower: 2 },
      clearLegacyEffects: true,
      conditionalDamageModifier: {
        condition: { targetStatus: 'PARALYSIS' },
        multiplier: 1.35,
        consumeStatus: false,
        removeStatus: false,
        reduceStatusDuration: false
      }
    }
  },
  stormcoil: {
    skill1: {
      id: 'stormcoil.skill1',
      name: 'Nhịp Sấm Truyền Lực',
      description: 'Gây 105% AP. Chủ lực nhận +8% Speed trong 1 hành động và +1 Điện Nhịp, tối đa 4. CD 1.',
      power: 105,
      type: 'magic',
      damageType: 'magic',
      scalingStat: 'ability-power',
      critMode: 'never',
      target: 'enemy',
      area: false,
      cooldown: 1,
      rageGainMode: 'none',
      coefficients: { abilityPower: 1.05 },
      clearLegacyEffects: true,
      passiveCounterGain: {
        counterId: 'DIEN_NHIP',
        amount: 1,
        max: 4,
        target: 'designatedCarry',
        timing: 'afterMainAction'
      }
    },
    ultimate: {
      id: 'stormcoil.ultimate',
      name: 'Đại Khúc Lôi Nộ',
      description: 'Tiêu 4 Nộ. Gây 110% AP lên toàn bộ địch; toàn đội +10% Speed trong 2 lượt. Chủ lực còn sống nhận +2 Điện Nhịp, tối đa 4.',
      power: 110,
      type: 'magic',
      damageType: 'magic',
      scalingStat: 'ability-power',
      critMode: 'never',
      target: 'all-enemies',
      area: true,
      cooldown: 0,
      rageCost: 4,
      coefficients: { abilityPower: 1.1 },
      clearLegacyEffects: true,
      passiveCounterGain: {
        counterId: 'DIEN_NHIP',
        amount: 2,
        max: 4,
        target: 'designatedCarry',
        timing: 'afterUltimateActionConfirmed'
      }
    }
  }
} satisfies Readonly<Record<string, Partial<Record<'basic' | 'skill1' | 'skill2' | 'ultimate', CanonicalSkillMetadata>>>>;

const PHASE_2A_PASSIVE_METADATA = {
  bramblet: {
    id: 'bramblet_khai_mach',
    name: 'Khai Mạch',
    description: 'Đồng minh khác nhận Mạch Khởi: hành động chính thứ 2 nạp Nộ lên 4; Ultimate đầu tiên cấp Khiên 3% Max HP.',
    mechanic: {
      trigger: 'ON_BATTLE_START',
      effect: {
        kind: 'brambletKhaiMach',
        mainActionsRequired: 2,
        chargeTarget: 4,
        shieldMaxHpRatio: 0.03
      },
      runtime: 'LIVE'
    }
  },
  coralyn: {
    id: 'coralyn_diep_khuc_nang_luong',
    name: 'Điệp Khúc Năng Lượng',
    description: 'Chọn một đồng minh khác làm chủ lực; sau hành động chính thứ 3 và 6, nạp chủ lực dưới 4 Nộ lên 8.',
    mechanic: {
      trigger: 'ON_BATTLE_START',
      effect: {
        kind: 'coralynEnergyChorus',
        checkpointActions: [3, 6],
        chargeTarget: 8,
        maxCheckpoints: 2
      },
      runtime: 'LIVE'
    }
  },
  stormcoil: {
    id: 'stormcoil_dan_dien',
    name: 'Dẫn Điện',
    description: 'Chọn một đồng minh khác làm chủ lực và quản lý Điện Nhịp của chủ lực trong phạm vi 0–4.',
    mechanic: {
      trigger: 'ON_BATTLE_START',
      effect: {
        kind: 'stormcoilConduction',
        counterId: 'DIEN_NHIP',
        counterMin: 0,
        counterMax: 4
      },
      runtime: 'LIVE'
    }
  }
} satisfies Readonly<Record<string, CatalogPassive>>;

const HOSTILE_SUPPORT_STATUSES = new Set([
  'stun', 'silence', 'paralysis', 'freeze', 'slow', 'burn', 'poison',
  'anti heal', 'attack down', 'ap down', 'defense down', 'accuracy down'
]);
const HARD_CONTROL_SOURCE = new Set(['stun', 'silence', 'paralysis', 'freeze']);
const BALANCED_CONTROL_ROTATION = ['stun', 'silence', 'paralysis', 'freeze'] as const;
type BalancedHardControl = typeof BALANCED_CONTROL_ROTATION[number];
const hardControlBalanceBySkillIndex = new Map<number, BalancedHardControl>();
const BENEFICIAL_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'defense up', 'rage gain', 'ap up',
  'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
]);
const COMBAT_RARITIES = new Set<CombatRarity>([
  'common', 'rare', 'super_rare', 'epic', 'legendary', 'mythic', 'ancient'
]);

const ROLE_CRIT_RESIST: Readonly<Record<string, number>> = Object.freeze({
  assassin: 2, marksman: 4, mage: 4, enchanter: 6, musician: 6,
  healer: 8, fighter: 10, knight: 15, tank: 20
});
const ROLE_EVASION: Readonly<Record<string, number>> = Object.freeze({
  assassin: 10, marksman: 6, mage: 5, enchanter: 5, musician: 5,
  healer: 4, fighter: 4, knight: 3, tank: 2
});
const ROLE_TENACITY: Readonly<Record<string, number>> = Object.freeze({
  assassin: 4, marksman: 4, mage: 5, enchanter: 7, musician: 7,
  healer: 8, fighter: 10, knight: 15, tank: 20
});
const ROLE_HEAL_POWER: Readonly<Record<string, number>> = Object.freeze({
  assassin: 0, marksman: 0, mage: 0, enchanter: 8, musician: 10,
  healer: 15, fighter: 0, knight: 0, tank: 0
});
const ROLE_SHIELD_POWER: Readonly<Record<string, number>> = Object.freeze({
  assassin: 0, marksman: 0, mage: 0, enchanter: 8, musician: 5,
  healer: 5, fighter: 4, knight: 10, tank: 15
});
const SPECIAL_EVA_ELEMENTS = new Set(['wind', 'storm', 'dark']);

const DEFAULT_DISPLAY: PowDisplayProfile = {
  heightRatio: 0.94,
  scaleAdjust: 1,
  offsetX: 0,
  offsetY: 0
};

function finitePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) >= 0 ? (value as number) : fallback;
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  const safe = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, safe));
}

function normalizeText(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function combatRoleKey(pow: CatalogPow): string {
  const raw = normalizeText(pow.combatRole || pow.roleTags?.[0] || pow.role);
  if (raw.includes('sat thu') || raw.includes('assassin')) return 'assassin';
  if (raw.includes('xa thu') || raw.includes('marksman') || raw.includes('archer')) return 'marksman';
  if (raw.includes('phap su') || raw.includes('mage')) return 'mage';
  if (raw.includes('thuat su') || raw.includes('enchanter')) return 'enchanter';
  if (raw.includes('nhac cong') || raw.includes('musician')) return 'musician';
  if (raw.includes('tri lieu') || raw.includes('healer')) return 'healer';
  if (raw.includes('dau si') || raw.includes('fighter')) return 'fighter';
  if (raw.includes('hiep si') || raw.includes('knight')) return 'knight';
  if (raw.includes('do don') || raw.includes('tank')) return 'tank';
  return 'marksman';
}

function normalizeRarity(raw: string | undefined): CombatRarity {
  const normalized = normalizeText(raw).replace(/[\s-]+/g, '_');
  const aliases: Record<string, CombatRarity> = {
    common: 'common', thuong: 'common',
    rare: 'rare', hiem: 'rare',
    super_rare: 'super_rare', sieu_hiem: 'super_rare',
    epic: 'epic', su_thi: 'epic',
    legendary: 'legendary', huyen_thoai: 'legendary',
    mythic: 'mythic', than_thoai: 'mythic',
    ancient: 'ancient', thuong_co: 'ancient'
  };
  const rarity = aliases[normalized] ?? 'common';
  return COMBAT_RARITIES.has(rarity) ? rarity : 'common';
}

function normalizeAbilityType(
  rawType: string | undefined,
  status: string | undefined,
  fallbackType: string
): string {
  const type = String(rawType || fallbackType).trim().toLowerCase();
  const normalizedStatus = String(status || '').replace(/^self:/i, '').trim().toLowerCase();
  if (type === 'support' && HOSTILE_SUPPORT_STATUSES.has(normalizedStatus)) return 'debuff';
  return type;
}

/** Map legacy Core V2 status names into the canonical Combat2 vocabulary. */
function migrateLegacyStatus(rawStatus: string | undefined): string | undefined {
  const raw = String(rawStatus || '').trim();
  if (!raw) return undefined;
  const selfDirected = raw.toLowerCase().startsWith('self:');
  const core = selfDirected ? raw.slice(5).trim() : raw;
  const key = normalizeText(core).replace(/[_-]+/g, ' ');
  const aliases: Record<string, string> = {
    petrify: 'stun', sleep: 'stun', bind: 'stun',
    frostbite: 'freeze',
    'magma burn': 'burn',
    'speed down': 'slow',
    antiheal: 'anti heal', 'anti heal': 'anti heal', 'healing down': 'anti heal',
    'attack down': 'attack down',
    'ap down': 'ap down',
    'defense down': 'defense down', 'def down': 'defense down',
    'accuracy down': 'accuracy down',
    'speed up': 'speed up',
    'effect resist': 'effect resist', 'effect resistance': 'effect resist',
    guard: 'guard',
    'crit up': 'crit up', 'critical up': 'crit up',
    'evasion up': 'evasion up'
  };
  const migrated = aliases[key] ?? core;
  return selfDirected ? `self:${migrated}` : migrated;
}

export function standardSkillIndex(rosterOrder: number | undefined, offset: 0 | 1 | 2 | 3): number | undefined {
  if (!Number.isInteger(rosterOrder) || (rosterOrder as number) < 1 || (rosterOrder as number) > STANDARD_POW_COUNT) return undefined;
  const index = ((rosterOrder as number) - 1) * STANDARD_SKILLS_PER_POW + offset + 1;
  return index <= STANDARD_POW_SKILL_COUNT ? index : undefined;
}

/**
 * Preserve the exact number of existing hard-CC skills, sort them by canonical
 * skill order, then distribute STUN -> SILENCE -> PARALYSIS -> FREEZE in a
 * strict rotation. Legacy hard-CC aliases are normalized before counting.
 */
function configureHardControlDistribution(
  pows: readonly CatalogPow[]
): Readonly<Record<BalancedHardControl, number>> {
  hardControlBalanceBySkillIndex.clear();
  const hardSlots: number[] = [];

  for (const pow of pows) {
    const skills = Array.isArray(pow.abilities?.skills) ? pow.abilities.skills : [];
    const abilities: Array<[0 | 1 | 2 | 3, CatalogAbility | undefined]> = [
      [0, pow.abilities?.basic],
      [1, skills[0]],
      [2, skills[1]],
      [3, pow.abilities?.ultimate]
    ];

    for (const [offset, ability] of abilities) {
      const migrated = migrateLegacyStatus(ability?.status);
      const raw = String(migrated || '').trim();
      const core = raw.toLowerCase().startsWith('self:') ? raw.slice(5).trim() : raw;
      if (!HARD_CONTROL_SOURCE.has(core.toLowerCase())) continue;
      const skillIndex = standardSkillIndex(pow.rosterOrder, offset);
      if (skillIndex !== undefined) hardSlots.push(skillIndex);
    }
  }

  hardSlots.sort((a, b) => a - b);
  const counts: Record<BalancedHardControl, number> = {
    stun: 0,
    silence: 0,
    paralysis: 0,
    freeze: 0
  };

  hardSlots.forEach((skillIndex, ordinal) => {
    const mapped = BALANCED_CONTROL_ROTATION[ordinal % BALANCED_CONTROL_ROTATION.length];
    hardControlBalanceBySkillIndex.set(skillIndex, mapped);
    counts[mapped] += 1;
  });

  return Object.freeze(counts);
}

export function balancedHardControlStatus(
  rawStatus: string | undefined,
  rosterOrder: number | undefined,
  abilityOffset: 0 | 1 | 2 | 3
): string | undefined {
  const migrated = migrateLegacyStatus(rawStatus);
  const raw = String(migrated || '').trim();
  if (!raw) return undefined;
  const selfDirected = raw.toLowerCase().startsWith('self:');
  const core = selfDirected ? raw.slice(5).trim() : raw;
  if (!HARD_CONTROL_SOURCE.has(core.toLowerCase())) return raw;

  const skillIndex = standardSkillIndex(rosterOrder, abilityOffset);
  const mapped = skillIndex !== undefined
    ? hardControlBalanceBySkillIndex.get(skillIndex)
    : undefined;
  const fallbackOrder = Number.isInteger(rosterOrder) && (rosterOrder as number) > 0
    ? (rosterOrder as number)
    : 1;
  const fallback = BALANCED_CONTROL_ROTATION[(fallbackOrder + abilityOffset) % BALANCED_CONTROL_ROTATION.length];
  const status = mapped ?? fallback;
  return selfDirected ? `self:${status}` : status;
}

function normalizeAbilityStatus(rawStatus: string | undefined, normalizedType: string): string | undefined {
  const migrated = migrateLegacyStatus(rawStatus);
  if (!migrated) return undefined;
  const selfDirected = migrated.toLowerCase().startsWith('self:');
  const core = selfDirected ? migrated.slice(5).trim() : migrated;
  const status = core.toLowerCase();
  if (normalizedType !== 'support' && BENEFICIAL_STATUSES.has(status) && !selfDirected) {
    return `self:${core}`;
  }
  return migrated;
}

function canonicalSkillVisual(skillIndex: number | undefined): Pick<CombatAbility, 'iconKey' | 'iconUrl'> {
  if (!Number.isInteger(skillIndex) || (skillIndex as number) < 1 || (skillIndex as number) > STANDARD_POW_SKILL_COUNT) {
    return {};
  }
  const padded = String(skillIndex).padStart(3, '0');
  return {
    iconKey: `combat2-skill-${padded}`,
    iconUrl: `${CANONICAL_SKILL_ART_PREFIX}skill-${padded}.webp`
  };
}

function canonicalSkillMetadata(pow: CatalogPow, abilityOffset: 0 | 1 | 2 | 3): CanonicalSkillMetadata | undefined {
  const slot = (['basic', 'skill1', 'skill2', 'ultimate'] as const)[abilityOffset];
  const catalogMetadata = window.POWDER_SKILL_V81?.pows?.[String(pow.id || '')]?.skills?.[slot];
  const powId = String(pow.id || '').trim().toLowerCase() as keyof typeof PHASE_2A_ABILITY_METADATA;
  const approvedKit = PHASE_2A_ABILITY_METADATA[powId];
  const approvedMetadata = approvedKit?.[slot as keyof typeof approvedKit] as CanonicalSkillMetadata | undefined;
  if (!approvedMetadata) return catalogMetadata;
  return {
    ...catalogMetadata,
    ...approvedMetadata,
    coefficients: { ...catalogMetadata?.coefficients, ...approvedMetadata.coefficients },
    masterEffects: { ...approvedMetadata.masterEffects }
  };
}

function normalizeConditionalDamageModifier(
  modifier: CatalogAbility['conditionalDamageModifier'] | undefined
): CombatConditionalDamageModifier | undefined {
  if (!modifier || String(modifier.condition?.targetStatus || '').trim().toLowerCase() !== 'paralysis') return undefined;
  if (modifier.consumeStatus !== false || modifier.removeStatus !== false || modifier.reduceStatusDuration !== false) return undefined;
  const multiplier = finitePositive(modifier.multiplier, 1);
  return {
    condition: { targetStatus: 'paralysis' },
    multiplier,
    consumeStatus: false,
    removeStatus: false,
    reduceStatusDuration: false
  };
}

function normalizePassiveCounterGain(
  gain: CatalogAbility['passiveCounterGain'] | undefined
): CombatPassiveCounterGain | undefined {
  if (!gain || String(gain.counterId || '').trim().toUpperCase() !== 'DIEN_NHIP') return undefined;
  if (gain.target !== 'designatedCarry') return undefined;
  if (gain.timing !== 'afterMainAction' && gain.timing !== 'afterUltimateActionConfirmed') return undefined;
  return {
    counterId: 'DIEN_NHIP',
    amount: Math.max(0, Math.floor(finiteNumber(gain.amount, 0))),
    max: Math.max(0, Math.floor(finiteNumber(gain.max, 4))),
    target: 'designatedCarry',
    timing: gain.timing
  };
}

function normalizeAbility(
  pow: CatalogPow,
  ability: CatalogAbility | undefined,
  fallbackName: string,
  fallbackPower: number,
  fallbackType: string,
  abilityOffset: 0 | 1 | 2 | 3
): CombatAbility {
  const metadata = canonicalSkillMetadata(pow, abilityOffset);
  const clearLegacyEffects = metadata?.clearLegacyEffects === true;
  const legacyEffectSource = clearLegacyEffects ? undefined : ability;
  const migratedStatus = migrateLegacyStatus(clearLegacyEffects ? undefined : (metadata?.status ?? ability?.status));
  const balancedStatus = balancedHardControlStatus(migratedStatus, pow.rosterOrder, abilityOffset);
  const type = normalizeAbilityType(metadata?.type ?? ability?.type, balancedStatus, fallbackType);
  const status = normalizeAbilityStatus(balancedStatus, type);
  const declaredDamageType = metadata?.damageType ?? ability?.damageType;
  const damageType = declaredDamageType === 'physical' || declaredDamageType === 'magic'
    ? declaredDamageType
    : abilityOffset === 0 ? 'physical' : type === 'physical' ? 'physical' : 'magic';
  const declaredScalingStat = metadata?.scalingStat ?? ability?.scalingStat;
  const scalingStat = declaredScalingStat === 'attack' || declaredScalingStat === 'ability-power'
    ? declaredScalingStat
    : abilityOffset === 0 ? 'attack' : type === 'physical' ? 'attack' : 'ability-power';
  const critMode = metadata?.critMode ?? ability?.critMode;
  const coefficients = metadata?.coefficients ?? ability?.coefficients;
  const masterEffects = metadata?.masterEffects ?? legacyEffectSource?.masterEffects;
  const conditionalDamageModifier = normalizeConditionalDamageModifier(
    metadata?.conditionalDamageModifier ?? ability?.conditionalDamageModifier
  );
  const passiveCounterGain = normalizePassiveCounterGain(
    metadata?.passiveCounterGain ?? legacyEffectSource?.passiveCounterGain
  );
  const target = metadata?.target ?? ability?.target;
  const manaCost = metadata?.manaCost ?? (clearLegacyEffects ? undefined : ability?.manaCost);
  const cooldown = metadata?.cooldown ?? ability?.cooldown;
  const rageCost = metadata?.rageCost ?? ability?.rageCost;
  const rageGainMode = metadata?.rageGainMode ?? legacyEffectSource?.rageGainMode;
  const area = metadata?.area ?? ability?.area;
  return {
    ...(metadata?.id ? { id: String(metadata.id) } : ability?.id ? { id: String(ability.id) } : {}),
    name: String(metadata?.name || ability?.name || fallbackName),
    ...(metadata?.description || ability?.description
      ? { description: String(metadata?.description || ability?.description) }
      : {}),
    power: finiteNonNegative(metadata?.power, finiteNonNegative(ability?.power, fallbackPower)),
    type,
    damageType,
    scalingStat,
    ...(critMode === 'natural-ad' || critMode === 'magic' || critMode === 'never'
      ? { critMode }
      : {}),
    ...(Number.isFinite(metadata?.magicCritMultiplier ?? ability?.magicCritMultiplier)
      ? { magicCritMultiplier: Number(metadata?.magicCritMultiplier ?? ability?.magicCritMultiplier) }
      : {}),
    ...((metadata?.shatterFrozen ?? legacyEffectSource?.shatterFrozen) ? { shatterFrozen: true } : {}),
    ...((metadata?.grievousTier ?? legacyEffectSource?.grievousTier) === 'grievous-40' ||
      (metadata?.grievousTier ?? legacyEffectSource?.grievousTier) === 'grievous-60'
      ? { grievousTier: (metadata?.grievousTier ?? legacyEffectSource?.grievousTier) as 'grievous-40' | 'grievous-60' }
      : {}),
    ...(status ? { status } : {}),
    ...(target ? { target: String(target) } : {}),
    ...((metadata?.targetRule ?? legacyEffectSource?.targetRule)
      ? { targetRule: String(metadata?.targetRule ?? legacyEffectSource?.targetRule) }
      : {}),
    ...(Number.isFinite(metadata?.hits ?? legacyEffectSource?.hits) && Number(metadata?.hits ?? legacyEffectSource?.hits) > 0
      ? { hits: Math.floor(Number(metadata?.hits ?? legacyEffectSource?.hits)) }
      : {}),
    ...((metadata?.specialMechanic ?? legacyEffectSource?.specialMechanic)
      ? { mechanic: String(metadata?.specialMechanic ?? legacyEffectSource?.specialMechanic) }
      : {}),
    ...(Number.isFinite(manaCost) ? { manaCost: Math.max(0, Number(manaCost)) } : {}),
    ...(Number.isFinite(cooldown) ? { cooldown: Math.max(0, Math.floor(Number(cooldown))) } : {}),
    ...(Number.isFinite(rageCost) ? { rageCost: Math.max(0, Number(rageCost)) } : {}),
    ...(rageGainMode === 'none' ? { rageGainMode: 'none' as const } : {}),
    ...(coefficients ? { coefficients: { ...coefficients } } : {}),
    ...(masterEffects ? { masterEffects: { ...masterEffects } } : {}),
    ...(conditionalDamageModifier ? { conditionalDamageModifier } : {}),
    ...(passiveCounterGain ? { passiveCounterGain } : {}),
    ...(metadata?.pyroonMechanic ? { pyroonMechanic: { ...metadata.pyroonMechanic } } : {}),
    ...(metadata?.usesMana === true ? { usesMana: true as const } : {}),
    ...(area ? { area: true } : {}),
    ...((metadata?.sureHit ?? legacyEffectSource?.sureHit) ? { sureHit: true } : {}),
    ...((metadata?.unavoidable ?? legacyEffectSource?.unavoidable) ? { unavoidable: true } : {}),
    ...((metadata?.bypassGuard ?? legacyEffectSource?.bypassGuard) ? { bypassGuard: true } : {}),
    ...((metadata?.pierceGuard ?? legacyEffectSource?.pierceGuard) ? { pierceGuard: true } : {}),
    ...((metadata?.bypassFront ?? legacyEffectSource?.bypassFront) ? { bypassFront: true } : {}),
    ...canonicalSkillVisual(standardSkillIndex(pow.rosterOrder, abilityOffset))
  };
}

function normalizePassive(pow: CatalogPow, passive: CatalogPassive | undefined): CombatPassive | undefined {
  const powId = String(pow.id || '').trim().toLowerCase() as keyof typeof PHASE_2A_PASSIVE_METADATA;
  const approved = PHASE_2A_PASSIVE_METADATA[powId];
  const source = approved ? { ...passive, ...approved } : passive;
  const id = String(source?.id || '').trim();
  if (!id) return undefined;
  const definition = window.POWDER_PASSIVE_CATALOG?.get?.(id) ?? null;
  return {
    id,
    name: String(source?.name || id),
    ...(source?.element ? { element: String(source.element) } : {}),
    ...(source?.description || definition?.description
      ? { description: String(source?.description || definition?.description) }
      : {}),
    ...(pow.passiveArt || source?.art
      ? { artUrl: `/${String(pow.passiveArt || source?.art).replace(/^\/+/, '')}` }
      : {}),
    ...(source?.mechanic || definition
      ? { mechanic: (source?.mechanic || definition) as CombatPassiveMechanic }
      : {})
  };
}

function normalizeAbilities(pow: CatalogPow, stars: number): CombatAbilitySet {
  const name = String(pow.name || pow.id || 'Pow');
  const skills = Array.isArray(pow.abilities?.skills) ? pow.abilities.skills.slice(0, 2) : [];
  const resolve = (ability: CatalogAbility | undefined): CatalogAbility | undefined => ability
    ? window.POWDER_FORM_RESOLVER?.resolveAbility?.(pow, ability, stars) ?? ability
    : undefined;
  const normalized: CombatAbilitySet = {
    basic: normalizeAbility(pow, resolve(pow.abilities?.basic), `${name} Strike`, 80, 'physical', 0),
    skills: [
      normalizeAbility(pow, resolve(skills[0]), `${name} Skill 1`, 110, 'elemental', 1),
      normalizeAbility(pow, resolve(skills[1]), `${name} Skill 2`, 95, 'support', 2)
    ],
    ultimate: normalizeAbility(pow, resolve(pow.abilities?.ultimate), `${name} Ultimate`, 175, 'ultimate', 3)
  };

  return normalized;
}

function canonicalAssetUrl(asset: string | undefined, powId: string): string {
  const normalized = String(asset || '').replace(/^\/+/, '');
  if (!isCanonicalPowAsset(normalized)) {
    throw new Error(`[Combat2] Pow ${powId} has a non-canonical asset: ${normalized || '(missing)'}`);
  }
  return `/${normalized}`;
}

function isCanonicalPowAsset(asset: string): boolean {
  return /^assets\/[^?#]+\.(?:avif|png|webp)$/i.test(asset);
}

function isCombatReadyCatalogPow(pow: CatalogPow): boolean {
  const id = String(pow.id || '').trim();
  const asset = String(pow.asset || '').replace(/^\/+/, '');
  return Boolean(id) && isCanonicalPowAsset(asset);
}

function toCombatPow(pow: CatalogPow, requestedStars?: number): CombatPow {
  const id = String(pow.id || '').trim();
  const startStars = Math.max(0, Math.floor(finiteNumber(pow.startStars, 0)));
  const maxStars = Math.max(startStars, Math.floor(finiteNumber(pow.maxStars, startStars)));
  const stars = clamp(Math.floor(finiteNumber(requestedStars, startStars)), startStars, maxStars);
  const stats = window.POWDER_FORM_RESOLVER?.statsAt?.(pow, stars) ?? pow.stats ?? {};
  const hp = finitePositive(stats.hp, 300);
  const attack = finitePositive(stats.atk, 50);
  const abilityPower = finitePositive(stats.ap, attack);
  const roleKey = combatRoleKey(pow);
  const elementKey = String(pow.element || 'unknown');
  const elementName = String(window.POWDER_DATA?.elements?.[elementKey]?.name || elementKey);
  const passive = normalizePassive(pow, pow.abilities?.passive);
  const kit = window.POWDER_SKILL_V81?.pows?.[id];
  const suppressLegacyCore = id.toLowerCase() === 'stormcoil' && passive?.id === 'stormcoil_dan_dien';
  const roleEvasion = ROLE_EVASION[roleKey] ?? 0;
  const elementEvasion = SPECIAL_EVA_ELEMENTS.has(elementKey) ? 12 : 0;

  return {
    id,
    name: String(pow.name || id),
    assetKey: `pow2-canonical-${id}`,
    assetUrl: canonicalAssetUrl(pow.asset, id),
    element: elementName,
    elementKey,
    role: String(pow.role || pow.combatRole || 'Không xác định'),
    rarity: normalizeRarity(pow.rarity),
    level: 60,
    stars,
    maxStars,
    attack,
    abilityPower,
    defense: finitePositive(stats.def, 45),
    speed: finitePositive(stats.speed, 50),
    hp,
    maxHp: hp,
    critRate: clamp(finiteNumber(stats.critRate, 0), 0, 100),
    critDamage: clamp(finiteNumber(stats.critDamage, 150), 100, 280),
    evasion: clamp(finiteNumber(stats.evasion, Math.max(roleEvasion, elementEvasion)), 0, SPECIAL_EVA_ELEMENTS.has(elementKey) ? 75 : 60),
    accuracy: clamp(finiteNumber(stats.accuracy, 100), 25, 200),
    critResist: clamp(finiteNumber(stats.critResist, ROLE_CRIT_RESIST[roleKey] ?? 0), 0, 50),
    lethality: Math.max(0, finiteNumber(stats.lethality, 0)),
    defPen: clamp(finiteNumber(stats.defPen, 0), 0, 0.6),
    healPower: clamp(finiteNumber(stats.healPower, ROLE_HEAL_POWER[roleKey] ?? 0), 0, 60),
    shieldPower: clamp(finiteNumber(stats.shieldPower, ROLE_SHIELD_POWER[roleKey] ?? 0), 0, 60),
    tenacity: clamp(finiteNumber(stats.tenacity, ROLE_TENACITY[roleKey] ?? 0), 0, 60),
    damageReduction: clamp(finiteNumber(stats.damageReduction, 0), 0, 0.45),
    abilities: normalizeAbilities(pow, stars),
    ...(passive ? { passive } : {}),
    ...(kit?.core && !suppressLegacyCore
      ? { core: { name: String(kit.core), description: String(kit.coreDescription || kit.core) } }
      : {}),
    ...(Array.isArray(pow.skillStarProgression) ? { skillStarProgression: pow.skillStarProgression.map((stage) => ({ ...stage })) } : {}),
    display: { ...DEFAULT_DISPLAY }
  };
}

function selectTeam(
  catalogPows: CatalogPow[],
  preferredIds: readonly string[],
  globallyUsed: Set<string>,
  reservedForOtherTeam: ReadonlySet<string>
): CombatPow[] {
  const byId = new Map(
    catalogPows.filter(isCombatReadyCatalogPow).map((pow) => [String(pow.id), pow] as const)
  );
  const selected: CatalogPow[] = [];

  for (const id of preferredIds) {
    const pow = byId.get(id);
    if (!pow || globallyUsed.has(id)) continue;
    selected.push(pow);
    globallyUsed.add(id);
  }

  const orderedFallback = catalogPows
    .filter(isCombatReadyCatalogPow)
    .slice()
    .sort((a, b) => finitePositive(a.rosterOrder, Number.MAX_SAFE_INTEGER) - finitePositive(b.rosterOrder, Number.MAX_SAFE_INTEGER));

  for (const pow of orderedFallback) {
    if (selected.length >= TOTAL_TEAM_SIZE) break;
    const id = String(pow.id);
    if (globallyUsed.has(id) || reservedForOtherTeam.has(id)) continue;
    selected.push(pow);
    globallyUsed.add(id);
  }

  for (const pow of orderedFallback) {
    if (selected.length >= TOTAL_TEAM_SIZE) break;
    const id = String(pow.id);
    if (globallyUsed.has(id)) continue;
    selected.push(pow);
    globallyUsed.add(id);
  }

  if (selected.length !== TOTAL_TEAM_SIZE) {
    throw new Error(`[Combat2] Canonical catalog cannot provide ${TOTAL_TEAM_SIZE} unique Pow for a team.`);
  }
  return selected.map(toCombatPow);
}

const catalog = window.POWDER_DATA;
const catalogPows = Array.isArray(catalog?.pows) ? catalog.pows : [];
if (catalogPows.length < TOTAL_TEAM_SIZE * 2) {
  throw new Error('[Combat2] POWDER_DATA is missing or incomplete. Load the canonical catalog before Combat 2.0.');
}

export const CANONICAL_HARD_CONTROL_COUNTS = configureHardControlDistribution(catalogPows);
export const CANONICAL_HARD_CONTROL_TOTAL = Object.values(CANONICAL_HARD_CONTROL_COUNTS)
  .reduce((sum, value) => sum + value, 0);

const usedIds = new Set<string>();
const playerReserved = new Set<string>(PLAYER_PREFERRED_IDS);
const enemyReserved = new Set<string>(ENEMY_PREFERRED_IDS);
const enemy = selectTeam(catalogPows, ENEMY_PREFERRED_IDS, usedIds, playerReserved);
const player = selectTeam(catalogPows, PLAYER_PREFERRED_IDS, usedIds, enemyReserved);

export const COMBAT2_STARTER_ROSTER = { enemy, player } satisfies Record<'enemy' | 'player', CombatPow[]>;
export const ALL_COMBAT2_STARTER_POWS: CombatPow[] = [
  ...COMBAT2_STARTER_ROSTER.enemy,
  ...COMBAT2_STARTER_ROSTER.player
];

/** Build an isolated canonical Pow fixture without mutating the active test roster. */
export function combatPowById(id: string, stars?: number): CombatPow | null {
  const normalizedId = String(id || '').trim().toLowerCase();
  const source = catalogPows.find((pow) => String(pow.id || '').trim().toLowerCase() === normalizedId);
  return source && isCombatReadyCatalogPow(source) ? toCombatPow(source, stars) : null;
}

/** Hydrates only the Pow IDs supplied by a validated Main -> Combat2 request. */
export function combatTeamByIds(ids: readonly string[]): CombatPow[] | null {
  const normalized = Array.from(new Set(ids.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean))).slice(0, TOTAL_TEAM_SIZE);
  if (!normalized.length) return null;
  const team = normalized.map(combatPowById);
  return team.every((pow): pow is CombatPow => Boolean(pow)) ? team : null;
}

export interface CombatBossRosterSnapshot {
  powId: string;
  level: number;
  stars: number;
  shiny?: boolean;
  stats: CatalogStats & { maxHp?: number };
  scale?: number;
  boss?: boolean;
  bossType?: string | null;
  aiTier?: string;
  combatGrade?: number;
  gradeScale?: number;
  initialRage?: number;
  initialInitiative?: number;
}

export interface CombatBossBootstrapSnapshot {
  version?: string;
  playerRoster: CombatBossRosterSnapshot[];
  enemyRoster: CombatBossRosterSnapshot[];
  initialRageByPowId?: Record<string, number>;
  initialInitiativeByPowId?: Record<string, number>;
  [key: string]: unknown;
}

function bossSnapshotMap(rows: readonly CombatBossRosterSnapshot[] | undefined): Map<string, CombatBossRosterSnapshot> {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row?.powId || '').toLowerCase(), row] as const));
}

/** Apply only the legacy-derived Boss combat snapshot; normal PvE keeps catalog stats. */
export function applyBossBootstrapToTeam(
  team: CombatPow[],
  rows: readonly CombatBossRosterSnapshot[] | undefined
): CombatPow[] | null {
  const snapshots = bossSnapshotMap(rows);
  if (!team.length || snapshots.size !== team.length || team.some((pow) => !snapshots.has(pow.id.toLowerCase()))) return null;
  const hydrated = team.map((pow): CombatPow | null => {
    const snapshot = snapshots.get(pow.id.toLowerCase());
    const stats = snapshot?.stats;
    if (!snapshot || !stats || !Number.isFinite(stats.hp) || !Number.isFinite(stats.atk) || !Number.isFinite(stats.ap) || !Number.isFinite(stats.def) || !Number.isFinite(stats.speed)) return null;
    const hp = Math.max(1, Math.round(Number(stats.hp)));
    return {
      ...pow,
      level: Math.max(1, Math.floor(Number(snapshot.level) || pow.level)),
      stars: Math.max(0, Math.floor(Number(snapshot.stars) || 0)),
      attack: Math.max(1, Math.round(Number(stats.atk))),
      abilityPower: Math.max(1, Math.round(Number(stats.ap))),
      defense: Math.max(1, Math.round(Number(stats.def))),
      speed: Math.max(1, Math.round(Number(stats.speed))),
      hp,
      maxHp: Math.max(hp, Math.round(Number(stats.maxHp) || hp)),
      critRate: clamp(finiteNumber(stats.critRate, pow.critRate), 0, 100),
      critDamage: clamp(finiteNumber(stats.critDamage, pow.critDamage), 100, 280),
      evasion: clamp(finiteNumber(stats.evasion, pow.evasion), 0, 75),
      accuracy: clamp(finiteNumber(stats.accuracy, pow.accuracy), 25, 200),
      critResist: clamp(finiteNumber(stats.critResist, pow.critResist), 0, 50),
      defPen: clamp(finiteNumber(stats.defPen, pow.defPen), 0, 0.6),
      healPower: clamp(finiteNumber(stats.healPower, pow.healPower), 0, 60),
      shieldPower: clamp(finiteNumber(stats.shieldPower, pow.shieldPower), 0, 60),
      tenacity: clamp(finiteNumber(stats.tenacity, pow.tenacity), 0, 60),
      damageReduction: clamp(finiteNumber(stats.damageReduction, pow.damageReduction), 0, 0.45)
    };
  });
  return hydrated.every((pow): pow is CombatPow => Boolean(pow)) ? hydrated : null;
}

export function bossBootstrapRuntimeOptions(snapshot: CombatBossBootstrapSnapshot | undefined): {
  initialRageByPowId: Record<string, number>;
  initialInitiativeByPowId: Record<string, number>;
} {
  const rage = snapshot?.initialRageByPowId || {};
  const initiative = snapshot?.initialInitiativeByPowId || {};
  return {
    initialRageByPowId: Object.fromEntries(Object.entries(rage).map(([id, value]) => [id.toLowerCase(), clamp(Math.floor(Number(value) || 0), 0, 8)])),
    initialInitiativeByPowId: Object.fromEntries(Object.entries(initiative).map(([id, value]) => [id.toLowerCase(), clamp(Number(value) || 0, 0, 92)]))
  };
}
