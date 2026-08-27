import type {
  CombatAbility,
  CombatAbilitySet,
  CombatPassive,
  CombatPow,
  CombatRarity,
  PowDisplayProfile
} from './CombatPow';

interface CatalogElement { name?: string; }
interface CatalogStats { hp?: number; atk?: number; ap?: number; def?: number; speed?: number; }
interface CatalogAbility { name?: string; power?: number; type?: string; status?: string; }
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
  'stun', 'silence', 'paralysis', 'freeze', 'slow', 'burn', 'poison'
]);
const HARD_CONTROL_SOURCE = new Set(['stun', 'silence', 'paralysis', 'freeze']);
const BALANCED_CONTROL_ROTATION = ['stun', 'silence', 'paralysis', 'freeze'] as const;
const BENEFICIAL_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'defense up', 'rage gain', 'ap up'
]);
const COMBAT_RARITIES = new Set<CombatRarity>([
  'common', 'rare', 'super_rare', 'epic', 'legendary', 'mythic', 'ancient'
]);

const DEFAULT_DISPLAY: PowDisplayProfile = {
  heightRatio: 0.94,
  scaleAdjust: 1,
  offsetX: 0,
  offsetY: 0
};

function finitePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}

function normalizeRarity(raw: string | undefined): CombatRarity {
  const rarity = String(raw || 'common').trim().toLowerCase() as CombatRarity;
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

function migrateLegacyStatus(rawStatus: string | undefined): string | undefined {
  const raw = String(rawStatus || '').trim();
  if (!raw) return undefined;
  // AP = Ability Power. It must never be converted into the Rage resource.
  return raw;
}

/**
 * Preserve the number of existing hard-CC skills, but distribute their control
 * identity through the whole 99-Pow roster. The rotation prevents a random
 * three-Pow team from inheriting the old pattern where several adjacent Pow
 * could all expose Stun/Freeze at once.
 */
export function balancedHardControlStatus(
  rawStatus: string | undefined,
  rosterOrder: number | undefined,
  abilityOffset: 0 | 1 | 2 | 3
): string | undefined {
  const raw = String(rawStatus || '').trim();
  if (!raw) return undefined;
  const selfDirected = raw.toLowerCase().startsWith('self:');
  const core = selfDirected ? raw.slice(5).trim() : raw;
  if (!HARD_CONTROL_SOURCE.has(core.toLowerCase())) return raw;

  const order = Number.isInteger(rosterOrder) && (rosterOrder as number) > 0
    ? (rosterOrder as number)
    : 1;
  const mapped = BALANCED_CONTROL_ROTATION[(order + abilityOffset) % BALANCED_CONTROL_ROTATION.length];
  return selfDirected ? `self:${mapped}` : mapped;
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

export function standardSkillIndex(rosterOrder: number | undefined, offset: 0 | 1 | 2 | 3): number | undefined {
  if (!Number.isInteger(rosterOrder) || (rosterOrder as number) < 1 || (rosterOrder as number) > STANDARD_POW_COUNT) return undefined;
  const index = ((rosterOrder as number) - 1) * STANDARD_SKILLS_PER_POW + offset + 1;
  return index <= STANDARD_POW_SKILL_COUNT ? index : undefined;
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
  const elementKey = String(pow.element || 'unknown');
  const elementName = String(window.POWDER_DATA?.elements?.[elementKey]?.name || elementKey);
  const passive = normalizePassive(pow.abilities?.passive);

  return {
    id,
    name: String(pow.name || id),
    assetKey: `pow2-canonical-${id}`,
    assetUrl: canonicalAssetUrl(pow.asset, id),
    element: elementName,
    elementKey,
    role: String(pow.role || 'Không xác định'),
    rarity: normalizeRarity(pow.rarity),
    level: 60,
    attack,
    abilityPower,
    defense: finitePositive(stats.def, 45),
    speed: finitePositive(stats.speed, 50),
    hp,
    maxHp: hp,
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
