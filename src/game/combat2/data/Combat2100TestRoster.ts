import type { CombatAbility, CombatPow, CombatRarity } from './CombatPow';
import {
  ALL_COMBAT2_STARTER_POWS,
  COMBAT2_STARTER_ROSTER,
  balancedHardControlStatus,
  standardSkillIndex
} from './PowderDataAdapter';

const PLAYER_IDS = ['arclynx', 'blazetalon', 'bloomlord', 'aquarion', 'aegiscarab'] as const;
const ENEMY_IDS = ['aeralune', 'bouldrax', 'bramblet', 'brookfin', 'ashmane'] as const;
const SKILL_PREFIX = '/assets/skills/v81/';

const BENEFICIAL = new Set([
  'shield', 'regeneration', 'attack up', 'defense up', 'rage gain', 'ap up',
  'speed up', 'effect resist', 'guard', 'crit up', 'evasion up'
]);
const HOSTILE = new Set([
  'stun', 'silence', 'paralysis', 'freeze', 'slow', 'burn', 'poison', 'anti heal',
  'attack down', 'ap down', 'defense down', 'accuracy down'
]);

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function finite(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positive(value: unknown, fallback: number): number {
  const n = finite(value, fallback);
  return n > 0 ? n : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, finite(value, fallback)));
}

function rarityOf(value: unknown): CombatRarity {
  const key = norm(value).replace(/[\s-]+/g, '_');
  const map: Record<string, CombatRarity> = {
    common: 'common', thuong: 'common', rare: 'rare', hiem: 'rare',
    super_rare: 'super_rare', sieu_hiem: 'super_rare', epic: 'epic', su_thi: 'epic',
    legendary: 'legendary', huyen_thoai: 'legendary', mythic: 'mythic', than_thoai: 'mythic',
    ancient: 'ancient', thuong_co: 'ancient'
  };
  return map[key] || 'common';
}

function statusOf(row: any, offset: 0 | 1 | 2 | 3): string | undefined {
  const raw = balancedHardControlStatus(row?.status, row?.__rosterOrder, offset);
  if (!raw) return undefined;
  const self = String(raw).toLowerCase().startsWith('self:');
  const core = self ? String(raw).slice(5).trim() : String(raw).trim();
  const key = norm(core).replace(/[_-]+/g, ' ');
  const aliases: Record<string, string> = {
    petrify: 'stun', sleep: 'stun', bind: 'stun', frostbite: 'freeze',
    'magma burn': 'burn', 'speed down': 'slow', antiheal: 'anti heal',
    'healing down': 'anti heal', 'def down': 'defense down'
  };
  const canonical = aliases[key] || core;
  if (!self && BENEFICIAL.has(norm(canonical))) return `self:${canonical}`;
  return self ? `self:${canonical}` : canonical;
}

function abilityOf(pow: any, row: any, offset: 0 | 1 | 2 | 3, fallbackName: string, fallbackPower: number, fallbackType: string): CombatAbility {
  const source = { ...(row || {}), __rosterOrder: pow.rosterOrder };
  const status = statusOf(source, offset);
  let type = String(row?.type || fallbackType).trim().toLowerCase();
  const statusKey = norm(String(status || '').replace(/^self:/i, ''));
  if (type === 'support' && HOSTILE.has(statusKey)) type = 'debuff';
  const skillIndex = standardSkillIndex(Number(pow.rosterOrder), offset);
  const padded = Number.isInteger(skillIndex) ? String(skillIndex).padStart(3, '0') : '';
  const hits = Math.max(1, Math.min(20, Math.round(finite(row?.hits, 1))));
  return {
    name: String(row?.name || fallbackName),
    power: positive(row?.power, fallbackPower),
    type,
    damageType: row?.damageType === 'physical' || row?.damageType === 'magic'
      ? row.damageType
      : type === 'physical' ? 'physical' : 'magic',
    scalingStat: row?.scalingStat === 'attack' || row?.scalingStat === 'ability-power'
      ? row.scalingStat
      : type === 'physical' ? 'attack' : 'ability-power',
    ...(row?.critMode === 'natural-ad' || row?.critMode === 'magic' || row?.critMode === 'never'
      ? { critMode: row.critMode }
      : {}),
    ...(Number.isFinite(row?.magicCritMultiplier) ? { magicCritMultiplier: Number(row.magicCritMultiplier) } : {}),
    ...(row?.shatterFrozen ? { shatterFrozen: true } : {}),
    ...(row?.grievousTier === 'grievous-40' || row?.grievousTier === 'grievous-60'
      ? { grievousTier: row.grievousTier }
      : {}),
    ...(status ? { status } : {}),
    ...(row?.target ? { target: String(row.target) } : {}),
    ...(row?.area ? { area: true } : {}),
    ...(hits > 1 ? { hits } : {}),
    ...(row?.mechanic ? { mechanic: String(row.mechanic) } : {}),
    ...((row?.description || row?.rulesText) ? { description: String(row.description || row.rulesText) } : {}),
    ...(row?.sureHit ? { sureHit: true } : {}),
    ...(row?.unavoidable ? { unavoidable: true } : {}),
    ...(row?.bypassGuard ? { bypassGuard: true } : {}),
    ...(row?.pierceGuard ? { pierceGuard: true } : {}),
    ...(row?.bypassFront ? { bypassFront: true } : {}),
    ...(padded ? { iconKey: `combat2-skill-${padded}`, iconUrl: `${SKILL_PREFIX}skill-${padded}.webp` } : {})
  };
}

function convert(row: any, fallback: CombatPow): CombatPow {
  if (!row?.id || !String(row.asset || '').replace(/^\/+/, '').startsWith('assets/pow-beta12/')) return fallback;
  const stats = row.stats || {};
  const hp = positive(stats.hp, fallback.maxHp || 300);
  const atk = positive(stats.atk, fallback.attack || 50);
  const ap = positive(stats.ap, atk);
  const skills = Array.isArray(row.abilities?.skills) ? row.abilities.skills : [];
  const elementKey = String(row.element || fallback.elementKey || 'unknown');
  const elements = (window as any).POWDER_DATA?.elements || {};
  const name = String(row.name || row.id);
  return {
    id: String(row.id),
    name,
    assetKey: `pow2-canonical-${row.id}`,
    assetUrl: `/${String(row.asset).replace(/^\/+/, '')}`,
    element: String(elements?.[elementKey]?.name || elementKey),
    elementKey,
    role: String(row.role || row.combatRole || fallback.role || 'Không xác định'),
    rarity: rarityOf(row.rarity),
    level: 60,
    attack: atk,
    abilityPower: ap,
    defense: positive(stats.def, fallback.defense || 45),
    speed: positive(stats.speed, fallback.speed || 50),
    hp,
    maxHp: hp,
    critRate: clamp(stats.critRate, 0, 100, fallback.critRate || 0),
    critDamage: clamp(stats.critDamage, 100, 280, fallback.critDamage || 150),
    evasion: clamp(stats.evasion, 0, 75, fallback.evasion || 0),
    accuracy: clamp(stats.accuracy, 25, 200, fallback.accuracy || 100),
    critResist: clamp(stats.critResist, 0, 50, fallback.critResist || 0),
    lethality: Math.max(0, finite(stats.lethality, fallback.lethality || 0)),
    defPen: clamp(stats.defPen, 0, 0.6, fallback.defPen || 0),
    healPower: clamp(stats.healPower, 0, 60, fallback.healPower || 0),
    shieldPower: clamp(stats.shieldPower, 0, 60, fallback.shieldPower || 0),
    tenacity: clamp(stats.tenacity, 0, 60, fallback.tenacity || 0),
    damageReduction: clamp(stats.damageReduction, 0, 0.45, fallback.damageReduction || 0),
    abilities: {
      basic: abilityOf(row, row.abilities?.basic, 0, `${name} Strike`, 80, 'physical'),
      skills: [
        abilityOf(row, skills[0], 1, `${name} Skill 1`, 110, 'elemental'),
        abilityOf(row, skills[1], 2, `${name} Skill 2`, 95, 'support')
      ],
      ultimate: abilityOf(row, row.abilities?.ultimate, 3, `${name} Ultimate`, 175, 'ultimate')
    },
    ...(row.abilities?.passive?.id ? { passive: { id: String(row.abilities.passive.id), name: String(row.abilities.passive.name || row.abilities.passive.id), ...(row.abilities.passive.element ? { element: String(row.abilities.passive.element) } : {}) } } : {}),
    display: { heightRatio: 0.94, scaleAdjust: 1, offsetX: 0, offsetY: 0 }
  };
}

function buildTeam(ids: readonly string[], fallback: CombatPow[], used: Set<string>): CombatPow[] {
  const rows = ((window as any).POWDER_DATA?.pows || []) as any[];
  const byId = new Map(rows.map((row) => [String(row?.id || ''), row]));
  const output: CombatPow[] = [];
  ids.forEach((id, index) => {
    const fallbackPow = fallback[index] || fallback[0];
    const row = byId.get(id);
    const pow = row ? convert(row, fallbackPow) : fallbackPow;
    if (pow && !used.has(pow.id)) { output.push(pow); used.add(pow.id); }
  });
  for (const pow of fallback) {
    if (output.length >= 5) break;
    if (!used.has(pow.id)) { output.push(pow); used.add(pow.id); }
  }
  return output.slice(0, 5);
}

export function installCombat2100TestRoster(): { player: string[]; enemy: string[]; requested: string[] } {
  const originalPlayer = [...COMBAT2_STARTER_ROSTER.player];
  const originalEnemy = [...COMBAT2_STARTER_ROSTER.enemy];
  const used = new Set<string>();
  const player = buildTeam(PLAYER_IDS, originalPlayer, used);
  const enemy = buildTeam(ENEMY_IDS, originalEnemy, used);
  if (player.length !== 5 || enemy.length !== 5) return { player: originalPlayer.map((p) => p.id), enemy: originalEnemy.map((p) => p.id), requested: [...PLAYER_IDS, ...ENEMY_IDS] };
  COMBAT2_STARTER_ROSTER.player.splice(0, COMBAT2_STARTER_ROSTER.player.length, ...player);
  COMBAT2_STARTER_ROSTER.enemy.splice(0, COMBAT2_STARTER_ROSTER.enemy.length, ...enemy);
  ALL_COMBAT2_STARTER_POWS.splice(0, ALL_COMBAT2_STARTER_POWS.length, ...enemy, ...player);
  const report = { player: player.map((p) => p.id), enemy: enemy.map((p) => p.id), requested: [...PLAYER_IDS, ...ENEMY_IDS] };
  (globalThis as any).POWDER_COMBAT2_TEST_ROSTER = { version: '2.10.0', ...report };
  return report;
}
