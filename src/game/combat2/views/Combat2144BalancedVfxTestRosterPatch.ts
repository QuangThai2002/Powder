import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import type { CombatAbility, CombatPow, CombatRarity } from '../data/CombatPow';
import { CombatState } from '../systems/CombatState';

const PATCH_FLAG = '__powderCombat2145DiverseVfxTestRosterInstalled';
const RAGE_PATCH_FLAG = '__powderCombat2145DiverseVfxTestRageInstalled';
const VERSION = '2.14.5-diverse-roster';

const TARGET_ELEMENTS = [
  'poison', 'light', 'ice', 'wind', 'steel',
  'dark', 'lava', 'storm', 'leaf', 'lightning'
] as const;

type RawPow = {
  id?: string;
  name?: string;
  element?: string;
  role?: string;
  combatRole?: string;
  rarity?: string;
  asset?: string;
  stats?: Record<string, number>;
};

type SkillSpec = Pick<CombatAbility, 'name' | 'power' | 'type' | 'status' | 'target' | 'area' | 'sureHit' | 'bypassGuard' | 'description'>;

function plain(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeElement(value: unknown): string {
  const key = plain(value).replace(/\s+/g, '');
  if (key.includes('poison') || key.includes('doc')) return 'poison';
  if (key.includes('lightning') || key.includes('electric') || key === 'set') return 'lightning';
  if (key.includes('storm') || key.includes('bao')) return 'storm';
  if (key.includes('lava') || key.includes('dungnham')) return 'lava';
  if (key.includes('ice') || key.includes('bang')) return 'ice';
  if (key.includes('steel') || key.includes('thep')) return 'steel';
  if (key.includes('wind') || key.includes('gio')) return 'wind';
  if (key.includes('leaf') || key.includes('nature') || key === 'la') return 'leaf';
  if (key.includes('earth') || key.includes('dat')) return 'earth';
  if (key.includes('water') || key.includes('nuoc')) return 'water';
  if (key.includes('fire') || key.includes('lua')) return 'fire';
  if (key.includes('light') || key.includes('anhsang')) return 'light';
  if (key.includes('dark') || key.includes('bongtoi')) return 'dark';
  return key || 'unknown';
}

function rarity(value: unknown): CombatRarity {
  const key = plain(value).replace(/\s+/g, '_');
  if (key.includes('ancient') || key.includes('thuong_co')) return 'ancient';
  if (key.includes('mythic') || key.includes('than_thoai')) return 'mythic';
  if (key.includes('legendary') || key.includes('huyen_thoai')) return 'legendary';
  if (key.includes('epic') || key.includes('su_thi')) return 'epic';
  if (key.includes('super') || key.includes('sieu_hiem')) return 'super_rare';
  if (key.includes('rare') || key.includes('hiem')) return 'rare';
  return 'common';
}

function elementDisplayName(elementKey: string): string {
  const table = (window as any).POWDER_DATA?.elements || {};
  return String(table?.[elementKey]?.name || elementKey);
}

function skillSetFor(elementKey: string): { skill1: SkillSpec; skill2: SkillSpec; ultimate: SkillSpec } {
  const attack = (name: string, status?: string): SkillSpec => ({
    name, power: 102, type: 'elemental', ...(status ? { status } : {}), target: 'enemy', description: `TEST ${elementKey.toUpperCase()} · ${status || 'impact'}`
  });
  const self = (name: string, status: string): SkillSpec => ({
    name, power: 1, type: 'support', status, target: 'self', description: `TEST ${elementKey.toUpperCase()} · ${status}`
  });
  const ally = (name: string, status: string): SkillSpec => ({
    name, power: 1, type: 'support', status, target: 'ally', description: `TEST ${elementKey.toUpperCase()} · ${status}`
  });
  const ult = (name: string, status?: string): SkillSpec => ({
    name, power: 148, type: 'elemental', ...(status ? { status } : {}), target: 'enemy', area: true, description: `TEST ULT ${elementKey.toUpperCase()} · ${status || 'AOE'}`
  });

  switch (elementKey) {
    case 'poison': return { skill1: attack('Độc Vụ Xâm Thực', 'poison'), skill2: attack('Ăn Mòn Hồi Phục', 'anti heal'), ultimate: ult('Vạn Độc Bạo Phát', 'poison') };
    case 'light': return { skill1: ally('Thánh Quang Hồi Phục', 'regeneration'), skill2: ally('Quang Thuẫn', 'shield'), ultimate: ult('Thiên Quang Giáng Thế') };
    case 'dark': return { skill1: attack('Hắc Ấn Câm Lặng', 'silence'), skill2: attack('Ám Thực Phá Giáp', 'defense down'), ultimate: ult('Hư Không Sụp Đổ', 'stun') };
    case 'lava': return { skill1: attack('Nham Viêm Thiêu Đốt', 'burn'), skill2: self('Dung Nham Cường Hóa', 'attack up'), ultimate: ult('Hỏa Sơn Bạo Liệt', 'burn') };
    case 'ice': return { skill1: attack('Băng Phong Khóa', 'freeze'), skill2: self('Băng Giáp', 'shield'), ultimate: ult('Băng Vực Tuyệt Đối', 'freeze') };
    case 'storm': return { skill1: attack('Bão Lôi Choáng', 'stun'), skill2: attack('Điện Trường Tê Liệt', 'paralysis'), ultimate: ult('Thiên Lôi Bạo Vũ', 'stun') };
    case 'lightning': return { skill1: attack('Lôi Kích', 'stun'), skill2: attack('Điện Xung Tê Liệt', 'paralysis'), ultimate: ult('Vạn Lôi Thiên Phạt', 'stun') };
    case 'steel': return { skill1: attack('Xuyên Giáp Cơ Giới', 'defense down'), skill2: self('Hợp Kim Hộ Thuẫn', 'shield'), ultimate: { ...ult('Pháo Xuyên Thành'), sureHit: true, bypassGuard: true } };
    case 'wind': return { skill1: self('Phong Hành Gia Tốc', 'speed up'), skill2: self('Ảnh Phong Né Tránh', 'evasion up'), ultimate: ult('Long Quyển Thiên Không') };
    case 'leaf': return { skill1: ally('Sinh Mệnh Nảy Mầm', 'regeneration'), skill2: attack('Độc Đằng Quấn Siết', 'poison'), ultimate: ult('Cổ Mộc Bạo Sinh') };
    default: return { skill1: attack('Nguyên Tố Kích'), skill2: self('Nguyên Tố Cường Hóa', 'attack up'), ultimate: ult('Nguyên Tố Bạo Phát') };
  }
}

function toCombatPow(raw: RawPow, ordinal: number): CombatPow {
  const id = String(raw.id || `test-${ordinal}`);
  const elementKey = normalizeElement(raw.element);
  const stats = raw.stats || {};
  const kit = skillSetFor(elementKey);
  const asset = String(raw.asset || '').replace(/^\/+/, '');
  const baseHp = Number(stats.hp || 300);
  const baseAtk = Number(stats.atk || 55);
  const baseAp = Number(stats.ap || baseAtk);
  const baseDef = Number(stats.def || 50);
  const baseSpeed = Number(stats.speed || 50);
  return {
    id,
    name: String(raw.name || id),
    assetKey: `combat2145-diverse-${id}`,
    assetUrl: `/${asset}`,
    element: elementDisplayName(String(raw.element || elementKey)),
    elementKey,
    role: String(raw.role || raw.combatRole || 'Đấu sĩ'),
    rarity: rarity(raw.rarity),
    level: 60,
    attack: baseAtk,
    abilityPower: baseAp,
    defense: baseDef,
    speed: baseSpeed,
    hp: baseHp,
    maxHp: baseHp,
    critRate: 10,
    critDamage: 150,
    evasion: 6,
    accuracy: 100,
    critResist: 8,
    defPen: 0,
    healPower: 10,
    shieldPower: 10,
    tenacity: 8,
    damageReduction: 0,
    abilities: {
      basic: { name: `${elementDisplayName(String(raw.element || elementKey))} Kích`, power: 90, type: 'elemental', target: 'enemy', description: `TEST BASIC · ${elementKey}` },
      skills: [kit.skill1 as CombatAbility, kit.skill2 as CombatAbility],
      ultimate: kit.ultimate as CombatAbility
    },
    display: { heightRatio: 0.94, scaleAdjust: 1, offsetX: 0, offsetY: 0 }
  };
}

function balancedStats(pow: CombatPow, pairIndex: number): void {
  const hp = pairIndex === 0 ? 340 : pairIndex === 1 ? 320 : pairIndex === 2 ? 300 : 310;
  const attack = pairIndex === 2 ? 64 : pairIndex === 1 ? 60 : 56;
  Object.assign(pow, {
    level: 60,
    hp,
    maxHp: hp,
    attack,
    abilityPower: attack,
    defense: pairIndex === 0 ? 60 : 50,
    speed: 50 + pairIndex * 4,
    accuracy: 100,
    critRate: 10,
    critDamage: 150,
    critResist: 8,
    evasion: 6,
    tenacity: 8,
    damageReduction: 0
  });
}

function installFourRageTestStart(): void {
  const root = globalThis as any;
  if (root[RAGE_PATCH_FLAG]) return;
  root[RAGE_PATCH_FLAG] = true;
  const proto = CombatState.prototype as any;
  const originalMakeUnits = proto.makeUnits;
  if (typeof originalMakeUnits !== 'function') return;
  proto.makeUnits = function combat2145MakeUnitsWithTestRage(...args: any[]): any[] {
    const units = originalMakeUnits.apply(this, args) as any[];
    for (const unit of units) unit.ragePoints = 4;
    return units;
  };
}

function selectDiverseCatalog(): CombatPow[] {
  const rawPows: RawPow[] = Array.isArray((window as any).POWDER_DATA?.pows) ? (window as any).POWDER_DATA.pows : [];
  const oldIds = new Set([...COMBAT2_STARTER_ROSTER.player, ...COMBAT2_STARTER_ROSTER.enemy].map((pow) => pow.id));
  const candidates = rawPows.filter((pow) => Boolean(pow?.id && pow?.asset) && !oldIds.has(String(pow.id)));
  const used = new Set<string>();
  const picked: RawPow[] = [];

  for (const wanted of TARGET_ELEMENTS) {
    const match = candidates.find((pow) => !used.has(String(pow.id)) && normalizeElement(pow.element) === wanted);
    if (match) { picked.push(match); used.add(String(match.id)); }
  }

  for (const candidate of candidates) {
    if (picked.length >= 10) break;
    if (used.has(String(candidate.id))) continue;
    const elementKey = normalizeElement(candidate.element);
    if (picked.some((pow) => normalizeElement(pow.element) === elementKey)) continue;
    picked.push(candidate); used.add(String(candidate.id));
  }

  for (const candidate of candidates) {
    if (picked.length >= 10) break;
    if (used.has(String(candidate.id))) continue;
    picked.push(candidate); used.add(String(candidate.id));
  }

  return picked.slice(0, 10).map(toCombatPow);
}

export function installCombat2144BalancedVfxTestRoster(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const selected = selectDiverseCatalog();
  if (selected.length < 10) {
    console.warn('[Combat2 2.14.5] Full diverse roster unavailable; keeping canonical roster and enabling four Rage only.');
    installFourRageTestStart();
    return;
  }

  // Deliberately split ten different elements across both sides.
  const player = [selected[0], selected[1], selected[2], selected[3], selected[4]];
  const enemy = [selected[5], selected[6], selected[7], selected[8], selected[9]];
  player.forEach((pow, index) => balancedStats(pow, index));
  enemy.forEach((pow, index) => balancedStats(pow, index));

  COMBAT2_STARTER_ROSTER.player.splice(0, COMBAT2_STARTER_ROSTER.player.length, ...player);
  COMBAT2_STARTER_ROSTER.enemy.splice(0, COMBAT2_STARTER_ROSTER.enemy.length, ...enemy);
  installFourRageTestStart();

  root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER = {
    version: VERSION,
    initialRage: 4,
    player: player.map((pow) => ({ id: pow.id, name: pow.name, element: pow.elementKey })),
    enemy: enemy.map((pow) => ({ id: pow.id, name: pow.name, element: pow.elementKey })),
    elementCount: new Set([...player, ...enemy].map((pow) => pow.elementKey)).size,
    showcase: ['poison', 'light', 'dark', 'lava', 'ice', 'storm', 'steel', 'wind', 'leaf', 'lightning', 'burn', 'freeze', 'stun', 'heal', 'shield']
  };
}

installCombat2144BalancedVfxTestRoster();
