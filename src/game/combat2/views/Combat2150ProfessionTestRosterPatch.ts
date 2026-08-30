import type { CombatAbility, CombatPow, CombatRarity } from '../data/CombatPow';
import {
  ALL_COMBAT2_STARTER_POWS,
  COMBAT2_STARTER_ROSTER,
  balancedHardControlStatus,
  standardSkillIndex
} from '../data/PowderDataAdapter';

const PATCH_FLAG = '__powderCombat2150ProfessionRosterInstalled';
const CANONICAL_PREFIX = 'assets/pow-beta12/';
const SKILL_ART_PREFIX = '/assets/skills/v81/';

const ROLE_ORDER = [
  'marksman',
  'mage',
  'fighter',
  'knight',
  'enchanter',
  'healer',
  'musician',
  'assassin',
  'tank'
] as const;

type RoleKey = typeof ROLE_ORDER[number];

type CatalogAbility = {
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
};

type CatalogPow = {
  id?: string;
  name?: string;
  asset?: string;
  element?: string;
  role?: string;
  combatRole?: string;
  roleTags?: string[];
  rarity?: string;
  rosterOrder?: number;
  stats?: {
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
  };
  abilities?: {
    basic?: CatalogAbility;
    skills?: CatalogAbility[];
    ultimate?: CatalogAbility;
    passive?: { id?: string; name?: string; element?: string };
  };
};

type CatalogData = {
  elements?: Record<string, { name?: string }>;
  pows?: CatalogPow[];
};

type ProfessionCandidate = {
  pow: CombatPow;
  roleKey: RoleKey;
};

const ROLE_LABEL: Readonly<Record<RoleKey, string>> = Object.freeze({
  marksman: 'Xạ thủ',
  mage: 'Pháp sư',
  fighter: 'Đấu sĩ',
  knight: 'Hiệp sĩ',
  enchanter: 'Thuật sư',
  healer: 'Trị liệu',
  musician: 'Nhạc công',
  assassin: 'Sát thủ',
  tank: 'Đỡ đòn'
});

const HOSTILE_STATUSES = new Set([
  'stun', 'silence', 'paralysis', 'freeze', 'slow', 'burn', 'poison',
  'anti heal', 'attack down', 'ap down', 'defense down', 'accuracy down'
]);
const BENEFICIAL_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'defense up', 'rage gain', 'ap up',
  'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
]);

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveRoleKey(value: unknown): RoleKey | null {
  const raw = normalizeText(value);
  if (raw.includes('sat thu') || raw.includes('assassin')) return 'assassin';
  if (raw.includes('xa thu') || raw.includes('marksman') || raw.includes('archer')) return 'marksman';
  if (raw.includes('phap su') || raw.includes('mage')) return 'mage';
  if (raw.includes('thuat su') || raw.includes('thuat si') || raw.includes('enchanter')) return 'enchanter';
  if (raw.includes('nhac cong') || raw.includes('musician')) return 'musician';
  if (raw.includes('tri lieu') || raw.includes('healer')) return 'healer';
  if (raw.includes('dau si') || raw.includes('fighter')) return 'fighter';
  if (raw.includes('hiep si') || raw.includes('knight')) return 'knight';
  if (raw.includes('do don') || raw.includes('tank')) return 'tank';
  return null;
}

function roleKeyOfCatalogPow(pow: CatalogPow): RoleKey | null {
  return resolveRoleKey(pow.combatRole || pow.roleTags?.[0] || pow.role);
}

function finitePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeRarity(raw: string | undefined): CombatRarity {
  const key = normalizeText(raw).replace(/[\s-]+/g, '_');
  const aliases: Record<string, CombatRarity> = {
    common: 'common', thuong: 'common',
    rare: 'rare', hiem: 'rare',
    super_rare: 'super_rare', sieu_hiem: 'super_rare',
    epic: 'epic', su_thi: 'epic',
    legendary: 'legendary', huyen_thoai: 'legendary',
    mythic: 'mythic', than_thoai: 'mythic',
    ancient: 'ancient', thuong_co: 'ancient'
  };
  return aliases[key] ?? 'common';
}

function statusCore(status: string | undefined): string {
  const raw = String(status || '').trim().toLowerCase();
  return raw.startsWith('self:') ? raw.slice(5).trim() : raw;
}

function normalizeAbilityType(rawType: string | undefined, status: string | undefined, fallback: string): string {
  const type = String(rawType || fallback).trim().toLowerCase();
  if (type === 'support' && HOSTILE_STATUSES.has(statusCore(status))) return 'debuff';
  return type;
}

function normalizeAbilityStatus(
  rawStatus: string | undefined,
  rosterOrder: number | undefined,
  offset: 0 | 1 | 2 | 3,
  type: string
): string | undefined {
  const balanced = balancedHardControlStatus(rawStatus, rosterOrder, offset);
  if (!balanced) return undefined;
  const core = statusCore(balanced);
  if (type !== 'support' && BENEFICIAL_STATUSES.has(core) && !balanced.toLowerCase().startsWith('self:')) {
    return `self:${balanced}`;
  }
  return balanced;
}

function skillVisual(rosterOrder: number | undefined, offset: 0 | 1 | 2 | 3): Pick<CombatAbility, 'iconKey' | 'iconUrl'> {
  const index = standardSkillIndex(rosterOrder, offset);
  if (!index) return {};
  const padded = String(index).padStart(3, '0');
  return {
    iconKey: `combat2-skill-${padded}`,
    iconUrl: `${SKILL_ART_PREFIX}skill-${padded}.webp`
  };
}

function makeAbility(
  pow: CatalogPow,
  ability: CatalogAbility | undefined,
  offset: 0 | 1 | 2 | 3,
  fallbackName: string,
  fallbackPower: number,
  fallbackType: string
): CombatAbility {
  const provisionalStatus = balancedHardControlStatus(ability?.status, pow.rosterOrder, offset);
  const type = normalizeAbilityType(ability?.type, provisionalStatus, fallbackType);
  const status = normalizeAbilityStatus(ability?.status, pow.rosterOrder, offset, type);
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
    ...skillVisual(pow.rosterOrder, offset)
  };
}

function toCombatCandidate(raw: CatalogPow, catalog: CatalogData): ProfessionCandidate | null {
  const roleKey = roleKeyOfCatalogPow(raw);
  const id = String(raw.id || '').trim().toLowerCase();
  const asset = String(raw.asset || '').replace(/^\/+/, '');
  if (!roleKey || !id || !asset.startsWith(CANONICAL_PREFIX)) return null;

  const name = String(raw.name || id);
  const stats = raw.stats ?? {};
  const attack = finitePositive(stats.atk, 50);
  const hp = finitePositive(stats.hp, 300);
  const skills = Array.isArray(raw.abilities?.skills) ? raw.abilities!.skills!.slice(0, 2) : [];
  const elementKey = String(raw.element || 'unknown');
  const passiveId = String(raw.abilities?.passive?.id || '').trim();

  const pow: CombatPow = {
    id,
    name,
    assetKey: `pow2-canonical-${id}`,
    assetUrl: `/${asset}`,
    element: String(catalog.elements?.[elementKey]?.name || elementKey),
    elementKey,
    role: ROLE_LABEL[roleKey],
    rarity: normalizeRarity(raw.rarity),
    level: 60,
    attack,
    abilityPower: finitePositive(stats.ap, attack),
    defense: finitePositive(stats.def, 45),
    speed: finitePositive(stats.speed, 50),
    hp,
    maxHp: hp,
    critRate: clamp(finiteNumber(stats.critRate, 0), 0, 100),
    critDamage: clamp(finiteNumber(stats.critDamage, 150), 100, 250),
    evasion: clamp(finiteNumber(stats.evasion, 0), 0, 75),
    accuracy: clamp(finiteNumber(stats.accuracy, 100), 25, 200),
    critResist: clamp(finiteNumber(stats.critResist, 0), 0, 50),
    defPen: clamp(finiteNumber(stats.defPen, 0), 0, 0.6),
    healPower: clamp(finiteNumber(stats.healPower, 0), 0, 60),
    shieldPower: clamp(finiteNumber(stats.shieldPower, 0), 0, 60),
    tenacity: clamp(finiteNumber(stats.tenacity, 0), 0, 60),
    damageReduction: clamp(finiteNumber(stats.damageReduction, 0), 0, 0.45),
    abilities: {
      basic: makeAbility(raw, raw.abilities?.basic, 0, `${name} Strike`, 80, 'physical'),
      skills: [
        makeAbility(raw, skills[0], 1, `${name} Skill 1`, 110, 'elemental'),
        makeAbility(raw, skills[1], 2, `${name} Skill 2`, 95, 'support')
      ],
      ultimate: makeAbility(raw, raw.abilities?.ultimate, 3, `${name} Ultimate`, 175, 'ultimate')
    },
    ...(passiveId ? {
      passive: {
        id: passiveId,
        name: String(raw.abilities?.passive?.name || passiveId),
        ...(raw.abilities?.passive?.element ? { element: String(raw.abilities.passive.element) } : {})
      }
    } : {}),
    display: { heightRatio: 0.94, scaleAdjust: 1, offsetX: 0, offsetY: 0 }
  };

  return { pow, roleKey };
}

function resolveRequestedFocus(): RoleKey | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('profession');
  return resolveRoleKey(raw);
}

function installProfessionRoster(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const catalog = (window as any).POWDER_DATA as CatalogData | undefined;
  const rawPows = Array.isArray(catalog?.pows) ? catalog!.pows! : [];
  const candidates = rawPows
    .map((pow) => toCombatCandidate(pow, catalog ?? {}))
    .filter((candidate): candidate is ProfessionCandidate => Boolean(candidate));

  const buckets = new Map<RoleKey, ProfessionCandidate[]>();
  for (const role of ROLE_ORDER) buckets.set(role, []);
  for (const candidate of candidates) buckets.get(candidate.roleKey)?.push(candidate);

  const usedIds = new Set<string>();
  const usedElements = new Set<string>();
  const selected = new Map<RoleKey, ProfessionCandidate>();

  for (const role of ROLE_ORDER) {
    const pool = (buckets.get(role) ?? [])
      .filter((candidate) => !usedIds.has(candidate.pow.id))
      .sort((a, b) => {
        const score = (candidate: ProfessionCandidate): number =>
          (usedElements.has(candidate.pow.elementKey) ? 0 : 100) +
          (candidate.pow.rarity === 'ancient' ? 10 : candidate.pow.rarity === 'mythic' ? 8 : 0);
        return score(b) - score(a);
      });
    const pick = pool[0];
    if (!pick) continue;
    selected.set(role, pick);
    usedIds.add(pick.pow.id);
    usedElements.add(pick.pow.elementKey);
  }

  const missingRoles = ROLE_ORDER.filter((role) => !selected.has(role));
  if (missingRoles.length > 0) {
    root.POWDER_COMBAT2_PROFESSION_TEST_ROSTER = {
      version: '2.15.0',
      mode: 'canonical-9-role-coverage',
      rosterMutation: false,
      missingRoles,
      candidateCount: candidates.length,
      combatLogicChanged: false
    };
    return;
  }

  const focusRole = resolveRequestedFocus();
  const orderedRoles = focusRole
    ? [focusRole, ...ROLE_ORDER.filter((role) => role !== focusRole)]
    : [...ROLE_ORDER];
  const orderedPows = orderedRoles.map((role) => selected.get(role)!.pow);

  const extra = candidates
    .filter((candidate) => !usedIds.has(candidate.pow.id))
    .sort((a, b) => {
      const aUnique = usedElements.has(a.pow.elementKey) ? 0 : 1;
      const bUnique = usedElements.has(b.pow.elementKey) ? 0 : 1;
      return bUnique - aUnique;
    })[0];
  if (!extra) return;

  const fullRoster = [...orderedPows, extra.pow];
  const playerTeam = fullRoster.slice(0, 5);
  const enemyTeam = fullRoster.slice(5, 10);
  if (playerTeam.length !== 5 || enemyTeam.length !== 5) return;

  COMBAT2_STARTER_ROSTER.player.splice(0, COMBAT2_STARTER_ROSTER.player.length, ...playerTeam);
  COMBAT2_STARTER_ROSTER.enemy.splice(0, COMBAT2_STARTER_ROSTER.enemy.length, ...enemyTeam);
  ALL_COMBAT2_STARTER_POWS.splice(
    0,
    ALL_COMBAT2_STARTER_POWS.length,
    ...enemyTeam,
    ...playerTeam
  );

  const roleForPow = (pow: CombatPow): RoleKey | 'extra' => {
    for (const [role, candidate] of selected) {
      if (candidate.pow.id === pow.id) return role;
    }
    return 'extra';
  };
  const describe = (pow: CombatPow) => ({
    id: pow.id,
    name: pow.name,
    role: roleForPow(pow),
    roleLabel: pow.role,
    element: pow.elementKey
  });

  const focusProfession = (roleInput: string): void => {
    const role = resolveRoleKey(roleInput);
    if (!role || typeof window === 'undefined') return;
    const next = new URL(window.location.href);
    next.searchParams.set('profession', role);
    window.location.assign(next.toString());
  };

  root.POWDER_COMBAT2_PROFESSION_TEST_ROSTER = {
    version: '2.15.0',
    mode: 'canonical-9-role-coverage',
    rosterMutation: true,
    canonicalCatalogOnly: true,
    mainCatalogMutated: false,
    roles: [...ROLE_ORDER],
    missingRoles: [],
    focusRole,
    focusQuery: 'profession',
    focusProfession,
    player: playerTeam.map(describe),
    enemy: enemyTeam.map(describe),
    active: [...playerTeam.slice(0, 3), ...enemyTeam.slice(0, 3)].map(describe),
    reserves: [...playerTeam.slice(3), ...enemyTeam.slice(3)].map(describe),
    nineRoleCoverage: true,
    focusedRoleStartsPlayerActive: Boolean(focusRole),
    combatLogicChanged: false
  };
}

installProfessionRoster();
