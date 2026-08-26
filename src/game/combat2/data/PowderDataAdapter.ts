import type {
  CombatAbility,
  CombatAbilitySet,
  CombatPow,
  PowDisplayProfile
} from './CombatPow';

interface CatalogElement {
  name?: string;
}

interface CatalogStats {
  hp?: number;
  atk?: number;
  def?: number;
  speed?: number;
}

interface CatalogAbility {
  name?: string;
  power?: number;
  type?: string;
  status?: string;
}

interface CatalogAbilities {
  basic?: CatalogAbility;
  skills?: CatalogAbility[];
  ultimate?: CatalogAbility;
}

interface CatalogPow {
  id?: string;
  name?: string;
  element?: string;
  role?: string;
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
  interface Window {
    POWDER_DATA?: PowderCatalog;
  }
}

const TEAM_SIZE = 3;
const PLAYER_PREFERRED_IDS = ['frostmaw', 'tidewarden', 'sparkit'] as const;
const ENEMY_PREFERRED_IDS = ['stormeon', 'joltail', 'terrapup'] as const;
const CANONICAL_PREFIX = 'assets/pow-beta12/';

const DEFAULT_DISPLAY: PowDisplayProfile = {
  heightRatio: 0.94,
  scaleAdjust: 1,
  offsetX: 0,
  offsetY: 0
};

function finitePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

function normalizeAbility(
  ability: CatalogAbility | undefined,
  fallbackName: string,
  fallbackPower: number,
  fallbackType: string
): CombatAbility {
  return {
    name: String(ability?.name || fallbackName),
    power: finitePositive(ability?.power, fallbackPower),
    type: String(ability?.type || fallbackType),
    ...(ability?.status ? { status: String(ability.status) } : {})
  };
}

function normalizeAbilities(pow: CatalogPow): CombatAbilitySet {
  const name = String(pow.name || pow.id || 'Pow');
  const skills = Array.isArray(pow.abilities?.skills)
    ? pow.abilities.skills.slice(0, 2)
    : [];

  return {
    basic: normalizeAbility(
      pow.abilities?.basic,
      `${name} Strike`,
      80,
      'physical'
    ),
    skills: [
      normalizeAbility(skills[0], `${name} Skill 1`, 110, 'elemental'),
      normalizeAbility(skills[1], `${name} Skill 2`, 95, 'support')
    ],
    ultimate: normalizeAbility(
      pow.abilities?.ultimate,
      `${name} Ultimate`,
      175,
      'ultimate'
    )
  };
}

function canonicalAssetUrl(asset: string | undefined, powId: string): string {
  const normalized = String(asset || '').replace(/^\/+/, '');

  if (!normalized.startsWith(CANONICAL_PREFIX)) {
    throw new Error(
      `[Combat2] Pow ${powId} has a non-canonical asset: ${normalized || '(missing)'}`
    );
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
  const elementKey = String(pow.element || 'unknown');
  const elementName = String(
    window.POWDER_DATA?.elements?.[elementKey]?.name || elementKey
  );

  return {
    id,
    name: String(pow.name || id),
    assetKey: `pow2-canonical-${id}`,
    assetUrl: canonicalAssetUrl(pow.asset, id),
    element: elementName,
    elementKey,
    role: String(pow.role || 'Không xác định'),
    level: 60,
    attack: finitePositive(stats.atk, 50),
    defense: finitePositive(stats.def, 45),
    speed: finitePositive(stats.speed, 50),
    hp,
    maxHp: hp,
    mana: 30,
    maxMana: 100,
    rage: 0,
    maxRage: 100,
    abilities: normalizeAbilities(pow),
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
    catalogPows
      .filter(isCombatReadyCatalogPow)
      .map((pow) => [String(pow.id), pow] as const)
  );

  const selected: CatalogPow[] = [];

  for (const id of preferredIds) {
    const pow = byId.get(id);
    if (!pow || globallyUsed.has(id)) {
      continue;
    }

    selected.push(pow);
    globallyUsed.add(id);
  }

  const orderedFallback = catalogPows
    .filter(isCombatReadyCatalogPow)
    .slice()
    .sort(
      (a, b) =>
        finitePositive(a.rosterOrder, Number.MAX_SAFE_INTEGER) -
        finitePositive(b.rosterOrder, Number.MAX_SAFE_INTEGER)
    );

  for (const pow of orderedFallback) {
    if (selected.length >= TEAM_SIZE) {
      break;
    }

    const id = String(pow.id);
    if (globallyUsed.has(id) || reservedForOtherTeam.has(id)) {
      continue;
    }

    selected.push(pow);
    globallyUsed.add(id);
  }

  if (selected.length < TEAM_SIZE) {
    for (const pow of orderedFallback) {
      if (selected.length >= TEAM_SIZE) {
        break;
      }

      const id = String(pow.id);
      if (globallyUsed.has(id)) {
        continue;
      }

      selected.push(pow);
      globallyUsed.add(id);
    }
  }

  if (selected.length !== TEAM_SIZE) {
    throw new Error(
      `[Combat2] Canonical catalog cannot provide ${TEAM_SIZE} unique Pow for a team.`
    );
  }

  return selected.map(toCombatPow);
}

const catalog = window.POWDER_DATA;
const catalogPows = Array.isArray(catalog?.pows) ? catalog.pows : [];

if (catalogPows.length < TEAM_SIZE * 2) {
  throw new Error(
    '[Combat2] POWDER_DATA is missing or incomplete. Load /js/data.js before Combat 2.0.'
  );
}

const usedIds = new Set<string>();
const playerReserved = new Set<string>(PLAYER_PREFERRED_IDS);
const enemyReserved = new Set<string>(ENEMY_PREFERRED_IDS);

const enemy = selectTeam(
  catalogPows,
  ENEMY_PREFERRED_IDS,
  usedIds,
  playerReserved
);
const player = selectTeam(
  catalogPows,
  PLAYER_PREFERRED_IDS,
  usedIds,
  enemyReserved
);

export const COMBAT2_STARTER_ROSTER = {
  enemy,
  player
} satisfies Record<'enemy' | 'player', CombatPow[]>;

export const ALL_COMBAT2_STARTER_POWS: CombatPow[] = [
  ...COMBAT2_STARTER_ROSTER.enemy,
  ...COMBAT2_STARTER_ROSTER.player
];
