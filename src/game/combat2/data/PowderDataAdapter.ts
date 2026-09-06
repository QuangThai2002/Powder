import type {
  CombatAbility,
  CombatAbilitySet,
  CombatPassive,
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
  defPen?: number;
  healPower?: number;
  shieldPower?: number;
  tenacity?: number;
  damageReduction?: number;
}
interface CatalogAbility {
  name?: string;
  power?: number;
  type?: string;
  status?: string;
  target?: string;
  area?: boolean;
  sureHit?: boolean;
  unavoidable?: boolean;
  bypassGuard?: boolean;
  pierceGuard?: boolean;
  bypassFront?: boolean;
}
interface CatalogPassive { id?: string; name?: string; element?: string; }
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
  stats?: CatalogStats;
  abilities?: CatalogAbilities;
}
interface PowderCatalog {
  elements?: Record<string, CatalogElement>;
  pows?: CatalogPow[];
}

declare global {
  interface Window { POWDER_DATA?: PowderCatalog; }
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

const CANONICAL_PREFIX = 'assets/pow-beta12/';
const CANONICAL_SKILL_ART_PREFIX = '/assets/skills/v81/';
export const STANDARD_POW_COUNT = 99;
export const STANDARD_SKILLS_PER_POW = 4;
export const STANDARD_POW_SKILL_COUNT = STANDARD_POW_COUNT * STANDARD_SKILLS_PER_POW;

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

function normalizeAbility(
  pow: CatalogPow,
  ability: CatalogAbility | undefined,
  fallbackName: string,
  fallbackPower: number,
  fallbackType: string,
  abilityOffset: 0 | 1 | 2 | 3
): CombatAbility {
  const migratedStatus = migrateLegacyStatus(ability?.status);
  const balancedStatus = balancedHardControlStatus(migratedStatus, pow.rosterOrder, abilityOffset);
  const type = normalizeAbilityType(ability?.type, balancedStatus, fallbackType);
  const status = normalizeAbilityStatus(balancedStatus, type);
  return {
    name: String(ability?.name || fallbackName),
    power: finitePositive(ability?.power, fallbackPower),
    type,
    ...(status ? { status } : {}),
    ...(ability?.target ? { target: String(ability.target) } : {}),
    ...(ability?.area ? { area: true } : {}),
    ...(ability?.sureHit ? { sureHit: true } : {}),
    ...(ability?.unavoidable ? { unavoidable: true } : {}),
    ...(ability?.bypassGuard ? { bypassGuard: true } : {}),
    ...(ability?.pierceGuard ? { pierceGuard: true } : {}),
    ...(ability?.bypassFront ? { bypassFront: true } : {}),
    ...canonicalSkillVisual(standardSkillIndex(pow.rosterOrder, abilityOffset))
  };
}

function normalizePassive(passive: CatalogPassive | undefined): CombatPassive | undefined {
  const id = String(passive?.id || '').trim();
  if (!id) return undefined;
  return {
    id,
    name: String(passive?.name || id),
    ...(passive?.element ? { element: String(passive.element) } : {})
  };
}

function normalizeAbilities(pow: CatalogPow): CombatAbilitySet {
  const name = String(pow.name || pow.id || 'Pow');
  const skills = Array.isArray(pow.abilities?.skills) ? pow.abilities.skills.slice(0, 2) : [];
  const normalized: CombatAbilitySet = {
    basic: normalizeAbility(pow, pow.abilities?.basic, `${name} Strike`, 80, 'physical', 0),
    skills: [
      normalizeAbility(pow, skills[0], `${name} Skill 1`, 110, 'elemental', 1),
      normalizeAbility(pow, skills[1], `${name} Skill 2`, 95, 'support', 2)
    ],
    ultimate: normalizeAbility(pow, pow.abilities?.ultimate, `${name} Ultimate`, 175, 'ultimate', 3)
  };

  // Combat-only fixture: real Cleanse and active Revive for deterministic testing.
  if (String(pow.id || '').trim().toLowerCase() === 'mosshorn') {
    normalized.skills = [
      {
        ...normalized.skills[0],
        name: 'Thanh Tẩy Sinh Mệnh',
        power: 1,
        type: 'support',
        status: 'cleanse'
      },
      {
        ...normalized.skills[1],
        name: 'Hồi Sinh Mầm Sống',
        power: 1,
        type: 'support',
        status: 'revive'
      }
    ];
  }

  return normalized;
}

function canonicalAssetUrl(asset: string | undefined, powId: string): string {
  const normalized = String(asset || '').replace(/^\/+/, '');
  if (!normalized.startsWith(CANONICAL_PREFIX)) {
    throw new Error(`[Combat2] Pow ${powId} has a non-canonical asset: ${normalized || '(missing)'}`);
  }
  return `/${normalized}`;
}

function isCombatReadyCatalogPow(pow: CatalogPow): boolean {
  const id = String(pow.id || '').trim();
  const asset = String(pow.asset || '').replace(/^\/+/, '');
  return Boolean(id) && asset.startsWith(CANONICAL_PREFIX);
}

function toCombatPow(pow: CatalogPow): CombatPow {
  const id = String(pow.id || '').trim();
  const stats = pow.stats ?? {};
  const hp = finitePositive(stats.hp, 300);
  const attack = finitePositive(stats.atk, 50);
  const abilityPower = finitePositive(stats.ap, attack);
  const roleKey = combatRoleKey(pow);
  const elementKey = String(pow.element || 'unknown');
  const elementName = String(window.POWDER_DATA?.elements?.[elementKey]?.name || elementKey);
  const passive = normalizePassive(pow.abilities?.passive);
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
    attack,
    abilityPower,
    defense: finitePositive(stats.def, 45),
    speed: finitePositive(stats.speed, 50),
    hp,
    maxHp: hp,
    critRate: clamp(finiteNumber(stats.critRate, 0), 0, 100),
    critDamage: clamp(finiteNumber(stats.critDamage, 150), 100, 250),
    evasion: clamp(finiteNumber(stats.evasion, Math.max(roleEvasion, elementEvasion)), 0, SPECIAL_EVA_ELEMENTS.has(elementKey) ? 75 : 60),
    accuracy: clamp(finiteNumber(stats.accuracy, 100), 25, 200),
    critResist: clamp(finiteNumber(stats.critResist, ROLE_CRIT_RESIST[roleKey] ?? 0), 0, 50),
    defPen: clamp(finiteNumber(stats.defPen, 0), 0, 0.6),
    healPower: clamp(finiteNumber(stats.healPower, ROLE_HEAL_POWER[roleKey] ?? 0), 0, 60),
    shieldPower: clamp(finiteNumber(stats.shieldPower, ROLE_SHIELD_POWER[roleKey] ?? 0), 0, 60),
    tenacity: clamp(finiteNumber(stats.tenacity, ROLE_TENACITY[roleKey] ?? 0), 0, 60),
    damageReduction: clamp(finiteNumber(stats.damageReduction, 0), 0, 0.45),
    abilities: normalizeAbilities(pow),
    ...(passive ? { passive } : {}),
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
export function combatPowById(id: string): CombatPow | null {
  const normalizedId = String(id || '').trim().toLowerCase();
  const source = catalogPows.find((pow) => String(pow.id || '').trim().toLowerCase() === normalizedId);
  return source && isCombatReadyCatalogPow(source) ? toCombatPow(source) : null;
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
      attack: Math.max(1, Math.round(Number(stats.atk))),
      abilityPower: Math.max(1, Math.round(Number(stats.ap))),
      defense: Math.max(1, Math.round(Number(stats.def))),
      speed: Math.max(1, Math.round(Number(stats.speed))),
      hp,
      maxHp: Math.max(hp, Math.round(Number(stats.maxHp) || hp)),
      critRate: clamp(finiteNumber(stats.critRate, pow.critRate), 0, 100),
      critDamage: clamp(finiteNumber(stats.critDamage, pow.critDamage), 100, 250),
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
