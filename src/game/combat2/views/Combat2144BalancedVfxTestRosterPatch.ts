import type { CombatAbility, CombatPow, CombatRarity } from '../data/CombatPow';
import {
  ALL_COMBAT2_STARTER_POWS,
  COMBAT2_STARTER_ROSTER,
  balancedHardControlStatus,
  standardSkillIndex
} from '../data/PowderDataAdapter';
import { CombatState } from '../systems/CombatState';

const PATCH_FLAG = '__powderCombatNight39DiverseRosterInstalled';
const RAGE_PATCH_FLAG = '__powderCombatNight39FourRageInstalled';
const CANONICAL_PREFIX = 'assets/pow-beta12/';
const SKILL_ART_PREFIX = '/assets/skills/v81/';
const OLD_ACTIVE_IDS = new Set(['terrapup', 'aquabub', 'zephyroo', 'mosshorn', 'voltkit', 'pyroon']);
const SHOWCASE_EFFECTS = ['burn', 'poison', 'freeze', 'stun', 'regeneration', 'shield'] as const;
type ShowcaseEffect = typeof SHOWCASE_EFFECTS[number];

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

interface CatalogPow {
  id?: string;
  name?: string;
  asset?: string;
  element?: string;
  role?: string;
  combatRole?: string;
  rarity?: string;
  rosterOrder?: number;
  stats?: CatalogStats;
  abilities?: {
    basic?: CatalogAbility;
    skills?: CatalogAbility[];
    ultimate?: CatalogAbility;
    passive?: { id?: string; name?: string; element?: string };
  };
}

interface CatalogData {
  elements?: Record<string, { name?: string }>;
  pows?: CatalogPow[];
}

const HOSTILE_STATUSES = new Set([
  'stun', 'silence', 'paralysis', 'freeze', 'slow', 'burn', 'poison',
  'anti heal', 'attack down', 'ap down', 'defense down', 'accuracy down'
]);
const BENEFICIAL_STATUSES = new Set([
  'shield', 'regeneration', 'attack up', 'defense up', 'rage gain', 'ap up',
  'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
]);

function finitePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeText(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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

function normalizedStatus(raw: string | undefined, rosterOrder: number | undefined, offset: 0 | 1 | 2 | 3, type: string): string | undefined {
  const balanced = balancedHardControlStatus(raw, rosterOrder, offset);
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
  return { iconKey: `combat2-skill-${padded}`, iconUrl: `${SKILL_ART_PREFIX}skill-${padded}.webp` };
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
  const status = normalizedStatus(ability?.status, pow.rosterOrder, offset, type);
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

function toCombatPow(raw: CatalogPow, catalog: CatalogData): CombatPow | null {
  const id = String(raw.id || '').trim().toLowerCase();
  const asset = String(raw.asset || '').replace(/^\/+/, '');
  if (!id || !asset.startsWith(CANONICAL_PREFIX)) return null;

  const name = String(raw.name || id);
  const stats = raw.stats ?? {};
  const attack = finitePositive(stats.atk, 50);
  const hp = finitePositive(stats.hp, 300);
  const skills = Array.isArray(raw.abilities?.skills) ? raw.abilities?.skills.slice(0, 2) : [];
  const elementKey = String(raw.element || 'unknown');
  const passiveId = String(raw.abilities?.passive?.id || '').trim();

  return {
    id,
    name,
    assetKey: `pow2-canonical-${id}`,
    assetUrl: `/${asset}`,
    element: String(catalog.elements?.[elementKey]?.name || elementKey),
    elementKey,
    role: String(raw.role || raw.combatRole || 'Không xác định'),
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
}

function allAbilities(pow: CombatPow): CombatAbility[] {
  return [pow.abilities.basic, ...pow.abilities.skills, pow.abilities.ultimate];
}

function effectMatches(pow: CombatPow, effect: ShowcaseEffect): boolean {
  const statuses = allAbilities(pow).map((ability) => statusCore(ability.status));
  if (effect === 'stun') return statuses.some((status) => status === 'stun' || status === 'paralysis');
  return statuses.includes(effect);
}

function effectSlotScore(pow: CombatPow, effect: ShowcaseEffect): number {
  const entries = [pow.abilities.basic, pow.abilities.skills[0], pow.abilities.skills[1], pow.abilities.ultimate];
  const scores = [8, 28, 28, 18];
  return entries.reduce((score, ability, index) => {
    const core = statusCore(ability?.status);
    const matches = effect === 'stun' ? core === 'stun' || core === 'paralysis' : core === effect;
    return matches ? Math.max(score, scores[index]) : score;
  }, 0);
}

function installDiverseShowcaseRoster(): void {
  const root = globalThis as any;
  const catalog = (window as any).POWDER_DATA as CatalogData | undefined;
  const rawPows = Array.isArray(catalog?.pows) ? catalog!.pows! : [];
  const candidates = rawPows
    .map((pow) => toCombatPow(pow, catalog ?? {}))
    .filter((pow): pow is CombatPow => Boolean(pow));

  if (candidates.length < 10) {
    root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER = {
      version: 'night-39', mode: 'canonical-fallback', rosterMutation: false,
      reason: 'catalog-too-small', candidateCount: candidates.length
    };
    return;
  }

  const usedIds = new Set<string>();
  const usedElements = new Set<string>();
  const active: CombatPow[] = [];
  const requestedCoverage: Array<{ effect: ShowcaseEffect; powId: string | null }> = [];

  const chooseForEffect = (effect: ShowcaseEffect): CombatPow | undefined => {
    const eligible = candidates
      .filter((pow) => !usedIds.has(pow.id) && effectMatches(pow, effect))
      .sort((a, b) => {
        const score = (pow: CombatPow): number =>
          (usedElements.has(pow.elementKey) ? 0 : 120) +
          (OLD_ACTIVE_IDS.has(pow.id) ? 0 : 80) +
          effectSlotScore(pow, effect);
        return score(b) - score(a);
      });
    return eligible[0];
  };

  for (const effect of SHOWCASE_EFFECTS) {
    const pick = chooseForEffect(effect);
    if (!pick) {
      requestedCoverage.push({ effect, powId: null });
      continue;
    }
    active.push(pick);
    usedIds.add(pick.id);
    usedElements.add(pick.elementKey);
    requestedCoverage.push({ effect, powId: pick.id });
  }

  // If a rare catalog build cannot expose all six requested statuses, still keep
  // six visually distinct active Pows rather than falling back to the old lineup.
  const fallbackOrder = candidates
    .filter((pow) => !usedIds.has(pow.id))
    .sort((a, b) => {
      const score = (pow: CombatPow): number =>
        (usedElements.has(pow.elementKey) ? 0 : 120) +
        (OLD_ACTIVE_IDS.has(pow.id) ? 0 : 60) +
        SHOWCASE_EFFECTS.filter((effect) => effectMatches(pow, effect)).length * 8;
      return score(b) - score(a);
    });
  for (const pow of fallbackOrder) {
    if (active.length >= 6) break;
    active.push(pow);
    usedIds.add(pow.id);
    usedElements.add(pow.elementKey);
  }
  if (active.length < 6) return;

  const takeReserves = (count: number): CombatPow[] => {
    const pool = candidates
      .filter((pow) => !usedIds.has(pow.id))
      .sort((a, b) => {
        const score = (pow: CombatPow): number =>
          (usedElements.has(pow.elementKey) ? 0 : 80) + (OLD_ACTIVE_IDS.has(pow.id) ? 0 : 30);
        return score(b) - score(a);
      });
    const chosen = pool.slice(0, count);
    for (const pow of chosen) {
      usedIds.add(pow.id);
      usedElements.add(pow.elementKey);
    }
    return chosen;
  };

  const playerActive = active.slice(0, 3);
  const enemyActive = active.slice(3, 6);
  const playerTeam = [...playerActive, ...takeReserves(2)];
  const enemyTeam = [...enemyActive, ...takeReserves(2)];
  if (playerTeam.length !== 5 || enemyTeam.length !== 5) return;

  COMBAT2_STARTER_ROSTER.player.splice(0, COMBAT2_STARTER_ROSTER.player.length, ...playerTeam);
  COMBAT2_STARTER_ROSTER.enemy.splice(0, COMBAT2_STARTER_ROSTER.enemy.length, ...enemyTeam);
  ALL_COMBAT2_STARTER_POWS.splice(
    0,
    ALL_COMBAT2_STARTER_POWS.length,
    ...COMBAT2_STARTER_ROSTER.enemy,
    ...COMBAT2_STARTER_ROSTER.player
  );

  const describe = (pow: CombatPow) => ({
    id: pow.id,
    name: pow.name,
    element: pow.elementKey,
    statuses: allAbilities(pow).map((ability) => statusCore(ability.status)).filter(Boolean)
  });
  const actualCoverage = SHOWCASE_EFFECTS.filter((effect) => active.some((pow) => effectMatches(pow, effect)));

  root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER = {
    version: 'night-39',
    mode: 'real-catalog-diverse-effect-showcase',
    rosterMutation: true,
    testRosterOnly: true,
    oldSixDeprioritized: true,
    playerActive: playerActive.map(describe),
    enemyActive: enemyActive.map(describe),
    requestedCoverage,
    actualCoverage,
    uniqueActiveElements: new Set(active.map((pow) => pow.elementKey)).size,
    initialRage: 4
  };
}

function installFourRageTestStart(): void {
  const root = globalThis as any;
  if (root[RAGE_PATCH_FLAG]) return;
  root[RAGE_PATCH_FLAG] = true;

  const proto = CombatState.prototype as any;
  const originalMakeUnits = proto.makeUnits;
  if (typeof originalMakeUnits !== 'function') return;

  proto.makeUnits = function combatNight39MakeUnitsWithFourRage(...args: any[]): any[] {
    const units = originalMakeUnits.apply(this, args) as any[];
    for (const unit of units) unit.ragePoints = 4;
    return units;
  };
}

export function installCombat2144BalancedVfxTestRoster(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  installDiverseShowcaseRoster();
  installFourRageTestStart();
}

installCombat2144BalancedVfxTestRoster();
