import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPowderCanonicalRuntime } from './lib/load-powder-canonical-runtime.mjs';

const rootUrl = new URL('../', import.meta.url);
const rootPath = fileURLToPath(rootUrl);
const fields = ['rarity', 'element', 'role', 'baseStats', 'basic', 'skill1', 'skill2', 'ultimate', 'passive', 'starProgression', 'specialMechanic'];
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));

if (!args['source-dir'] || !args['workbook-json']) {
  throw new Error('Usage: node tools/recover-pow-canonical-design-master.mjs --source-dir <handoff-dir> --workbook-json <extracted-workbook.json>');
}

const sourceDir = resolve(args['source-dir']);
const workbookJsonPath = resolve(args['workbook-json']);
const sourceDate = '2026-09-07';
const phase2aDecisionDate = '2026-09-10';
const jsonName = 'pow-combat-design-01-90.json';
const workbookName = 'Powder_Combat_Design_Master_01-90.xlsx';
const specName = 'POWDER_COMBAT_IMPLEMENTATION_SPEC_01-90.md';

const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const stable = (value) => JSON.stringify(value, (_key, nested) => {
  if (!nested || Array.isArray(nested) || typeof nested !== 'object') return nested;
  return Object.fromEntries(Object.keys(nested).sort().map((key) => [key, nested[key]]));
});
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));
const abilityText = (value) => typeof value === 'string' ? value : value?.text ?? null;
const parsedAbility = (value) => ({
  name: normalize(abilityText(value)).split(':')[0] || null,
  text: abilityText(value),
  cooldown: typeof value === 'object' ? value?.cooldown ?? null : null,
  rageCost: typeof value === 'object' ? value?.rageCost ?? null : null
});
const source = (id, location, value, dateOrCommit = sourceDate) => ({ sourceId: id, location, dateOrCommit, value });

const approvedStats = ({ hp, attack, defense, abilityPower, speed, critRate }) => ({
  sourceText: `HP${hp} ATK${attack} DEF${defense} AP${abilityPower} SPD${speed} CRIT${critRate}`,
  parsed: { hp, attack, defense, abilityPower, speed, critRate }
});

const phase2aApprovedDecisions = new Map(Object.entries({
  pyroon: { baseStats: approvedStats({ hp: 333, attack: 58, defense: 44, abilityPower: 40, speed: 46, critRate: 10 }) },
  voltkit: {
    baseStats: approvedStats({ hp: 285, attack: 40, defense: 42, abilityPower: 61, speed: 58, critRate: 8 }),
    ultimate: {
      name: 'Lôi Kích',
      text: 'Lôi Kích: tiêu 4 Nộ. Gây 200% AP lên mục tiêu. Nếu mục tiêu đang Tê Liệt, hit này gây +35% damage; không tiêu, xóa hoặc rút ngắn Tê Liệt. Nếu mục tiêu không Tê Liệt, gây 200% AP bình thường.',
      cooldown: null,
      rageCost: 4,
      coefficients: { abilityPower: 2 },
      conditionalDamageModifier: {
        condition: { targetStatus: 'PARALYSIS' },
        multiplier: 1.35,
        consumeStatus: false,
        removeStatus: false,
        reduceStatusDuration: false
      }
    }
  },
  zephyroo: {
    basic: { name: 'Đánh Gió', text: 'Đánh Gió: gây 70% AP.', cooldown: null, rageCost: null, coefficients: { abilityPower: 0.7 } }
  },
  cindercore: { baseStats: approvedStats({ hp: 300, attack: 44, defense: 45, abilityPower: 76, speed: 55, critRate: 8 }) },
  ironmantis: { baseStats: approvedStats({ hp: 350, attack: 86, defense: 55, abilityPower: 47, speed: 64, critRate: 28 }) },
  pyrewing: { baseStats: approvedStats({ hp: 340, attack: 87, defense: 51, abilityPower: 46, speed: 72, critRate: 24 }) },
  thunderhorn: { baseStats: approvedStats({ hp: 354, attack: 84, defense: 56, abilityPower: 47, speed: 67, critRate: 22 }) },
  arcbison: { baseStats: approvedStats({ hp: 332, attack: 48, defense: 52, abilityPower: 88, speed: 62, critRate: 10 }) },
  lavarax: { baseStats: approvedStats({ hp: 324, attack: 47, defense: 48, abilityPower: 92, speed: 66, critRate: 12 }) },
  pebblit: { baseStats: approvedStats({ hp: 440, attack: 61, defense: 84, abilityPower: 44, speed: 46, critRate: 7 }) },
  tidewarden: { baseStats: approvedStats({ hp: 452, attack: 63, defense: 83, abilityPower: 47, speed: 45, critRate: 7 }) },
  verdantusk: { baseStats: approvedStats({ hp: 468, attack: 62, defense: 86, abilityPower: 48, speed: 42, critRate: 7 }) },
  magmafang: { baseStats: approvedStats({ hp: 398, attack: 85, defense: 66, abilityPower: 44, speed: 62, critRate: 19 }) },
  scorchmane: { baseStats: approvedStats({ hp: 390, attack: 84, defense: 65, abilityPower: 45, speed: 65, critRate: 21 }) },
  aegiscarab: { baseStats: approvedStats({ hp: 420, attack: 73, defense: 84, abilityPower: 44, speed: 50, critRate: 12 }) },
  rimehorn: { baseStats: approvedStats({ hp: 414, attack: 76, defense: 82, abilityPower: 43, speed: 54, critRate: 14 }) },
  tidefang: { baseStats: approvedStats({ hp: 402, attack: 72, defense: 78, abilityPower: 50, speed: 54, critRate: 11 }) },
  frostwing: { baseStats: approvedStats({ hp: 340, attack: 45, defense: 56, abilityPower: 87, speed: 71, critRate: 10 }) },
  geoquill: { baseStats: approvedStats({ hp: 356, attack: 46, defense: 62, abilityPower: 84, speed: 66, critRate: 9 }) },
  bloomlord: { baseStats: approvedStats({ hp: 372, attack: 42, defense: 60, abilityPower: 92, speed: 58, critRate: 7 }) },
  lumibloom: { baseStats: approvedStats({ hp: 360, attack: 41, defense: 56, abilityPower: 90, speed: 62, critRate: 8 }) },
  cloudtalon: { baseStats: approvedStats({ hp: 350, attack: 43, defense: 55, abilityPower: 80, speed: 74, critRate: 10 }) },
  galehart: { baseStats: approvedStats({ hp: 358, attack: 44, defense: 58, abilityPower: 78, speed: 72, critRate: 9 }) },
  tempestfin: { baseStats: approvedStats({ hp: 346, attack: 42, defense: 54, abilityPower: 82, speed: 75, critRate: 12 }) },
  bramblet: {
    passive: {
      name: 'Khai Mạch',
      text: 'Khai Mạch: Đầu trận, mỗi đồng minh khác nhận 1 Mạch Khởi. Khi một đơn vị có Mạch Khởi hoàn thành hành động chính thứ 2 của họ trong trận, Mạch Khởi của đơn vị đó bị tiêu. Nếu Nộ hiện tại của họ dưới 4, nạp Nộ trực tiếp lên 4/8 trong một logical event; nếu đã có từ 4 Nộ trở lên thì không tăng Nộ. Sau lần đầu đơn vị đó dùng Ultimate trong trận, họ nhận Khiên bằng 3% Max HP của chính họ. Mỗi đơn vị chỉ được kích phần nạp Nộ và phần Khiên một lần mỗi trận. Bramblet không tự nhận Mạch Khởi.'
    },
    starProgression: {
      '1★': '+9% AP +7% HP.',
      '2★': 'S1 damage 105→115% AP; giảm damage 12→14%.',
      '3★': '3★ – Mộc Mạch Khai Chiến: Lần đầu mỗi đồng minh dùng Ultimate trong trận, trong chính hành động Ultimate đó họ gây +8% damage. Khi Ultimate kết thúc, Khiên do Khai Mạch cấp sau Ultimate tăng từ 3% → 5% Max HP.',
      '4★': '4★ – Cổ Mộc Trấn Giới: Ngoài giảm damage địch và Shield toàn đội, toàn đội nhận 8% DR trong 1 lượt để chống nhịp phản công ngay sau Ultimate.',
      '5★': '5★ – Khai Mạch Thức Tỉnh: Mỗi đồng minh khác khi lần đầu dùng Ultimate trong trận cho Bramblet 1 Mộc Ấn, tối đa 3. Mỗi Mộc Ấn tăng 4% hiệu quả Shield và debuff của Bramblet. Khi đạt 3 Mộc Ấn, S1 kế tiếp tác động toàn bộ địch rồi reset toàn bộ Mộc Ấn.'
    },
    specialMechanic: null
  },
  coralyn: {
    passive: {
      name: 'Điệp Khúc Năng Lượng',
      text: 'Điệp Khúc Năng Lượng: Đầu trận, Coralyn chọn 1 đồng minh khác làm chủ lực. Sau khi Coralyn hoàn thành hành động chính thứ 3 và thứ 6 của mình trong trận, kiểm tra chủ lực. Nếu chủ lực còn sống và đang có dưới 4 Nộ, nạp Nộ của họ trực tiếp lên 8/8 trong một logical event. Nếu tại thời điểm checkpoint chủ lực đã có từ 4 Nộ trở lên hoặc đã bị hạ, checkpoint đó bị bỏ qua và không được dời sang lượt khác. Coralyn không thể chọn chính mình. Tối đa 2 checkpoint mỗi trận.'
    },
    starProgression: {
      '1★': '+10% AP +6% Speed.',
      '2★': 'S1 100→110% AP; Slow 15→18%.',
      '3★': '3★ – Điệp Khúc Bảo Hộ: Mỗi lần Điệp Khúc Năng Lượng charge 8/8 thành công, chủ lực nhận Shield bằng 5% Max HP. Nếu chủ lực đã có Shield trước khi charge, thay Shield mới bằng heal 4% Max HP.',
      '4★': '4★ – Đại Hợp Xướng tiến hóa: Mục tiêu đã bị Slow trước Ultimate ngoài Silence còn bị -15% damage gây ra trong 1 lượt. Không thêm Stun AoE.',
      '5★': '5★ – Điệp Khúc Cao Trào: Khi Điệp Khúc Năng Lượng charge thành công lần thứ 2 trong trận, chủ lực nhận thêm +12% Speed +10% DEF trong 2 hành động.'
    },
    specialMechanic: null
  },
  stormcoil: {
    skill1: {
      name: 'Nhịp Sấm Truyền Lực',
      text: 'Nhịp Sấm Truyền Lực: gây 105% AP. Chủ lực được Dẫn Điện chỉ định nhận +8% Speed trong 1 hành động và Stormcoil cộng +1 Điện Nhịp cho chủ lực, tối đa 4 Điện Nhịp. CD 1. Kỹ năng không trực tiếp cấp Rage.',
      cooldown: 1,
      rageCost: null,
      coefficients: { abilityPower: 1.05 },
      passiveCounterGain: { counterId: 'DIEN_NHIP', amount: 1, max: 4, target: 'designatedCarry' }
    },
    ultimate: {
      name: 'Đại Khúc Lôi Nộ',
      text: 'Đại Khúc Lôi Nộ: tiêu 4 Rage. Gây 110% AP lên toàn bộ địch. Toàn đội nhận +10% Speed trong 2 lượt. Nếu chủ lực được Dẫn Điện chỉ định còn sống, Stormcoil cộng +2 Điện Nhịp cho chủ lực, tối đa 4. Ultimate không trực tiếp cấp Rage.',
      cooldown: null,
      rageCost: 4,
      coefficients: { abilityPower: 1.1 },
      target: 'allEnemies',
      passiveCounterGain: { counterId: 'DIEN_NHIP', amount: 2, max: 4, target: 'designatedCarry', timing: 'afterUltimateActionConfirmed' }
    },
    passive: {
      name: 'Dẫn Điện',
      text: 'Dẫn Điện: Đầu trận, Stormcoil chọn 1 đồng minh khác làm chủ lực. Mỗi khi chủ lực hoàn thành một hành động chính gây direct damage, họ nhận 1 Điện Nhịp, tối đa 4. Phản kích, truy kích, Liên Kích, DOT và các hit phụ không được tính là hành động mới cho bộ đếm. Skill1 của Stormcoil có thể cộng thêm 1 Điện Nhịp và Ultimate của Stormcoil có thể cộng thêm 2 Điện Nhịp theo mô tả riêng. Khi chủ lực có đủ 4 Điện Nhịp, sau một hành động chính của chủ lực và sau khi mọi Rage cost của hành động đó đã được xử lý, nếu Nộ hiện tại của chủ lực dưới 4, tiêu toàn bộ 4 Điện Nhịp và nạp Nộ của chủ lực lên 8/8 trong một logical event. Nếu chủ lực đạt 4 Điện Nhịp khi đang có từ 4 Nộ trở lên, 4 Điện Nhịp được giữ lại cho đến một lần kiểm tra hợp lệ sau đó. Dẫn Điện được kích tối đa 1 lần mỗi vòng và tối đa 2 lần mỗi trận.',
      counter: {
        id: 'DIEN_NHIP',
        range: [0, 4],
        belongsTo: 'passive',
        isRage: false,
        isSpecialMechanic: false,
        triggerLimitPerRound: 1,
        triggerLimitPerBattle: 2
      }
    },
    starProgression: {
      '1★': '+8% AP +8% Speed.',
      '2★': 'Skill1 105→115% AP; Speed 8→10%.',
      '3★': '3★ – Lôi Nộ Dẫn Hướng: Mỗi lần Dẫn Điện charge chủ lực lên 8/8 thành công, kỹ năng direct damage tiếp theo của chủ lực trong vòng 2 hành động gây +8% damage và chủ lực nhận +8% Speed trong chính hành động đó. Không cộng dồn; kích mới chỉ refresh thời hạn.',
      '4★': '4★ – Đại Khúc Lôi Nộ tiến hóa: Khi Stormcoil dùng Đại Khúc Lôi Nộ, chủ lực nhận Lôi Nộ trong 2 hành động. Ultimate tiếp theo của chủ lực trong thời gian này gây +12% direct damage và sau khi cast nhận Shield bằng 6% Max HP.',
      '5★': '5★ – Dẫn Điện Thức Tỉnh: Ngay sau khi chủ lực tiêu 4 Rage để dùng Ultimate, Điện Nhịp hiện tại của chủ lực reset về 0. Hành động chính gây direct damage đầu tiên sau Ultimate đó cộng 2 Điện Nhịp thay vì 1. Hiệu ứng này không làm vượt cap 4 Điện Nhịp, không bỏ qua giới hạn 1 lần/vòng và không bỏ qua giới hạn 2 lần/trận của Dẫn Điện.'
    },
    specialMechanic: null
  }
}).map(([name, decisions]) => [name.toLowerCase(), decisions]));

const rarityMap = new Map([
  ['Thường', 'common'], ['Hiếm', 'rare'], ['Siêu hiếm', 'super_rare'], ['Sử thi', 'epic'],
  ['Huyền thoại', 'legendary'], ['Thần thoại', 'mythic'], ['Thượng cổ', 'ancient'], ['Đặc biệt', 'special']
]);
const elementMap = new Map([
  ['Lửa', 'fire'], ['Nước', 'water'], ['Lá', 'leaf'], ['Đất', 'earth'], ['Gió', 'wind'],
  ['Sét', 'lightning'], ['Thép', 'steel'], ['Băng', 'ice'], ['Độc', 'poison'], ['Ánh sáng', 'light'],
  ['Bóng tối', 'dark'], ['Dung nham', 'lava'], ['Bão', 'storm']
]);
const roleMap = new Map([
  ['Xạ thủ', 'marksman'], ['Pháp sư', 'mage'], ['Đỡ đòn', 'tank'], ['Đấu sĩ', 'fighter'],
  ['Hiệp sĩ', 'knight'], ['Thuật sư', 'enchanter'], ['Trị liệu', 'healer'],
  ['Nhạc công', 'musician'], ['Sát thủ', 'assassin']
]);

function parseStats(text) {
  const result = { sourceText: text, parsed: {} };
  const patterns = {
    hp: /\bHP\s*([0-9.]+)/i,
    attack: /\bATK\s*([0-9.]+)/i,
    defense: /\bDEF\s*([0-9.]+)/i,
    abilityPower: /\bAP\s*([0-9.]+)/i,
    speed: /\b(?:SPD|SPEED)\s*([0-9.]+)/i,
    critRate: /\bCRIT(?:\s+RATE)?\s*([0-9.]+)%?/i,
    critDamage: /\b(?:CRIT\s*(?:DMG|DAMAGE)|CD)\s*([0-9.]+)%?/i
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = normalize(text).match(pattern);
    if (match) result.parsed[key] = Number(match[1]);
  }
  return result;
}

function workbookStars(row) {
  const result = {};
  for (let star = 1; star <= 6; star += 1) {
    const value = row?.[`${star}★`];
    if (value !== undefined && value !== null && normalize(value)) result[`${star}★`] = value;
  }
  return result;
}

function workbookSpecial(row) {
  return {
    evolutionType: row?.['Loại tiến hóa'] ?? null,
    counter: row?.Counter ?? null,
    synergy: row?.Synergy ?? null
  };
}

function designSpecial(pow) {
  return { evolutionType: pow?.evolutionType ?? null, counter: pow?.counter ?? null, synergy: pow?.synergy ?? null };
}

function currentSlots(pow) {
  return {
    basic: pow?.abilities?.basic ?? null,
    skill1: pow?.abilities?.skills?.[0] ?? null,
    skill2: pow?.abilities?.skills?.[1] ?? null,
    ultimate: pow?.abilities?.ultimate ?? null
  };
}

function compactAbility(value) {
  if (!value) return null;
  return {
    id: value.id ?? null,
    name: value.name ?? null,
    description: value.description ?? null,
    power: value.power ?? null,
    type: value.type ?? null,
    target: value.target ?? null,
    manaCost: value.manaCost ?? null,
    cooldown: value.cooldown ?? null,
    rageCost: value.rageCost ?? null,
    status: value.status ?? null,
    coefficients: value.coefficients ?? null,
    masterEffects: value.masterEffects ?? null,
    specialMechanic: value.specialMechanic ?? null
  };
}

function currentValue(pow, kit, field) {
  const slots = currentSlots(pow);
  if (field === 'rarity') return pow?.rarity ?? null;
  if (field === 'element') return pow?.element ?? null;
  if (field === 'role') return pow?.combatRole ?? pow?.officialRoleKey ?? pow?.role ?? null;
  if (field === 'baseStats') return pow?.stats ?? null;
  if (['basic', 'skill1', 'skill2', 'ultimate'].includes(field)) return compactAbility(slots[field]);
  if (field === 'passive') return pow?.abilities?.passive ?? null;
  if (field === 'starProgression') return {
    startStars: pow?.startStars ?? null,
    maxStars: pow?.maxStars ?? null,
    v81NativeStar: kit?.nativeStar ?? null,
    v81MaxStar: kit?.maxStarWorkbook ?? null,
    stages: kit?.starProgression ?? []
  };
  if (field === 'specialMechanic') return {
    core: kit?.core ?? pow?.core ?? null,
    evolutionType: kit?.evolutionType ?? null,
    counter: kit?.counter ?? pow?.counterText ?? null,
    specialStarter: Boolean(pow?.specialStarter)
  };
  return null;
}

function canonicalValue(pow, field) {
  if (field === 'rarity') return rarityMap.get(pow.rarity) ?? pow.rarity;
  if (field === 'element') return elementMap.get(pow.element) ?? pow.element;
  if (field === 'role') return roleMap.get(pow.role) ?? pow.role;
  if (field === 'baseStats') return parseStats(pow.statsText);
  if (['basic', 'skill1', 'skill2', 'ultimate'].includes(field)) return parsedAbility(pow.abilities?.[field]);
  if (field === 'passive') return { name: normalize(pow.passive).split(':')[0] || null, text: pow.passive };
  if (field === 'starProgression') return pow.stars;
  if (field === 'specialMechanic') return designSpecial(pow);
  return null;
}

function workbookValue(row, field) {
  if (field === 'rarity') return rarityMap.get(row?.['Phẩm chất']) ?? row?.['Phẩm chất'] ?? null;
  if (field === 'element') return elementMap.get(row?.['Hệ']) ?? row?.['Hệ'] ?? null;
  if (field === 'role') return roleMap.get(row?.['Nghề']) ?? row?.['Nghề'] ?? null;
  if (field === 'baseStats') return parseStats(row?.['Chỉ số / tăng trưởng'] ?? null);
  const column = { basic: 'Đánh thường', skill1: 'Skill 1', skill2: 'Skill 2', ultimate: 'Ultimate' }[field];
  if (column) {
    const value = parsedAbility(row?.[column]);
    if (field === 'skill1') value.cooldown = row?.CD1 ?? null;
    if (field === 'skill2') value.cooldown = row?.CD2 ?? null;
    if (field === 'ultimate') value.rageCost = 4;
    return value;
  }
  if (field === 'passive') return { name: normalize(row?.['Nội tại']).split(':')[0] || null, text: row?.['Nội tại'] ?? null };
  if (field === 'starProgression') return workbookStars(row);
  if (field === 'specialMechanic') return workbookSpecial(row);
  return null;
}

function equivalent(left, right) {
  return normalize(stable(left)) === normalize(stable(right));
}

function unresolvedReason(number, field, pow) {
  const unresolvedStats = /chưa khóa|cần rà|repo cũ|placeholder|chưa final/i.test(pow?.statsText || '');
  if (field === 'baseStats' && unresolvedStats) return pow.statsText;
  if (number === 2 && field === 'ultimate') return 'Ultimate interaction/bonus against Paralysis is explicitly not locked.';
  if (number === 6 && field === 'basic') return 'Basic damage scale must be reviewed as ATK versus AP.';
  if (number === 72 && ['passive', 'starProgression', 'specialMechanic'].includes(field)) return 'Raw +1 Rage opener must be redesigned under the latest Rage support direction.';
  if (number === 73 && ['passive', 'starProgression', 'specialMechanic'].includes(field)) return 'Periodic Rage grant requires an explicit redesign decision.';
  if (number === 77 && ['skill1', 'ultimate', 'passive', 'starProgression', 'specialMechanic'].includes(field)) return 'Raw +1/+2 Rage mechanics require an explicit redesign decision.';
  return null;
}

function runtimeComparable(field, value) {
  if (field === 'rarity' || field === 'element' || field === 'role') return value;
  if (field === 'baseStats') return value;
  if (['basic', 'skill1', 'skill2', 'ultimate'].includes(field)) return value ? { name: value.name, text: value.description, cooldown: value.cooldown, rageCost: value.rageCost } : null;
  if (field === 'passive') return value ? { name: value.name, text: value.description } : null;
  return value;
}

function approvedDecision(designPow, field) {
  const decisions = phase2aApprovedDecisions.get(normalize(designPow?.name).toLowerCase());
  return decisions && Object.hasOwn(decisions, field) ? clone(decisions[field]) : undefined;
}

function matrixEntry({ number, field, designPow, workbookRow, current, pendingRow }) {
  if (number <= 90) {
    const valueA = canonicalValue(designPow, field);
    const valueB = workbookValue(workbookRow, field);
    const approved = approvedDecision(designPow, field);
    if (approved !== undefined) {
      const runtimeDivergence = !equivalent(approved, runtimeComparable(field, current));
      return {
        status: 'CANONICAL_FOUND',
        designSources: [
          source('design-json-v1.1', `pows[number=${number}].${field}`, valueA),
          source('design-workbook-01-90', `01_ALL_POW_01_90 row ${number + 1} / ${field}`, valueB),
          source('phase-2a-approved-decisions', `${designPow.name}.${field}`, approved, phase2aDecisionDate)
        ],
        currentRuntimeValue: current,
        conflict: runtimeDivergence ? 'YES' : 'NO',
        designSourceConflict: false,
        runtimeDivergence,
        chosenCanonicalValue: approved,
        chosenSource: 'phase-2a-approved-decisions',
        evidence: 'Min approved this explicit Phase 2A.2 decision; it supersedes the earlier unresolved candidate without promoting runtime data.',
        confidence: 'HIGH'
      };
    }
    const reason = unresolvedReason(number, field, designPow);
    const designSourceConflict = !equivalent(valueA, valueB);
    const chosen = reason || designSourceConflict ? null : valueA;
    const runtimeDivergence = chosen !== null && !equivalent(chosen, runtimeComparable(field, current));
    return {
      status: reason ? 'NEEDS_DESIGN_DECISION' : designSourceConflict ? 'DESIGN_CONFLICT' : 'CANONICAL_FOUND',
      designSources: [
        source('design-json-v1.1', `pows[number=${number}].${field}`, valueA),
        source(
          field === 'ultimate' ? 'design-workbook-01-90 + implementation-spec' : 'design-workbook-01-90',
          field === 'ultimate'
            ? `01_ALL_POW_01_90 row ${number + 1} / ${field}; implementation spec lines 16 and 136`
            : `01_ALL_POW_01_90 row ${number + 1} / ${field}`,
          valueB
        )
      ],
      currentRuntimeValue: current,
      conflict: designSourceConflict || runtimeDivergence ? 'YES' : 'NO',
      designSourceConflict,
      runtimeDivergence,
      chosenCanonicalValue: chosen,
      chosenSource: chosen === null ? null : 'design-json-v1.1 corroborated by design-workbook-01-90',
      evidence: reason || (designSourceConflict ? 'The two dedicated design sources disagree.' : 'The dedicated JSON and workbook agree; implementation differences do not override them.'),
      confidence: reason ? 'MISSING' : designSourceConflict ? 'LOW' : 'HIGH'
    };
  }

  const pendingMap = {
    rarity: rarityMap.get(pendingRow?.['Phẩm chất']) ?? pendingRow?.['Phẩm chất'] ?? null,
    element: elementMap.get(pendingRow?.['Hệ']) ?? pendingRow?.['Hệ'] ?? null,
    role: roleMap.get(pendingRow?.['Nghề']) ?? pendingRow?.['Nghề'] ?? null
  };
  const candidate = pendingMap[field] ?? null;
  const foundIdentity = candidate !== null;
  const runtimeDivergence = foundIdentity && !equivalent(candidate, runtimeComparable(field, current));
  return {
    status: foundIdentity ? 'CANONICAL_FOUND' : 'NEEDS_DESIGN_DECISION',
    designSources: foundIdentity ? [source('design-workbook-pending-91-99', `03_PENDING_91_99 row ${number - 89} / ${field}`, candidate)] : [],
    currentRuntimeValue: current,
    conflict: runtimeDivergence ? 'YES' : 'NO',
    designSourceConflict: false,
    runtimeDivergence,
    chosenCanonicalValue: foundIdentity ? candidate : null,
    chosenSource: foundIdentity ? 'design-workbook-pending-91-99' : null,
    evidence: foundIdentity
      ? 'The pending-design sheet explicitly supplies this identity field, but does not approve detailed combat design.'
      : pendingRow?.['Trạng thái'] || 'No independent design value was found.',
    confidence: foundIdentity ? 'MEDIUM' : 'MISSING'
  };
}

function gitLastChange(paths) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%H %aI %s', '--', ...paths], { cwd: rootPath, encoding: 'utf8' }).trim();
  } catch {
    return 'MISSING';
  }
}

function markdown(report) {
  const lines = [
    '# Powder Canonical Design Master Recovery', '',
    `Generated: ${report.generatedAt}`, '',
    '## Result', '',
    `- Total Pow: **${report.summary.totalPow}**`,
    `- High-confidence full design: **${report.summary.highConfidenceFullDesign}**`,
    `- Partial design: **${report.summary.partialDesign}**`,
    `- Needs design decision: **${report.summary.needsDesignDecision}**`,
    `- Unresolved fields: **${report.summary.unresolvedFields}** (#1-90: ${report.summary.unresolvedFields1To90}; #91-99: ${report.summary.unresolvedFields91To99})`,
    `- Design conflict: **${report.summary.designConflict}**`,
    `- Passive canonical found: **${report.summary.passiveCanonicalFound}/${report.summary.totalPow}**`,
    `- Star canonical found: **${report.summary.starCanonicalFound}/${report.summary.totalPow}**`,
    `- Basic canonical found: **${report.summary.skillCanonicalFound.basic}/${report.summary.totalPow}**`,
    `- Skill 1 canonical found: **${report.summary.skillCanonicalFound.skill1}/${report.summary.totalPow}**`,
    `- Skill 2 canonical found: **${report.summary.skillCanonicalFound.skill2}/${report.summary.totalPow}**`,
    `- Ultimate canonical found: **${report.summary.skillCanonicalFound.ultimate}/${report.summary.totalPow}**`,
    `- Pow #91-99 source: **${report.summary.pow91To99Source}**`, '',
    'Counts overlap where a partially recovered Pow still requires a decision. `DESIGN_CONFLICT` means two design authorities disagree; runtime divergence is tracked separately.', '',
    '## Source Authority', '',
    '| Source | Scope | Authority | Evidence |', '|---|---|---|---|'
  ];
  for (const row of report.sources) lines.push(`| ${row.id} | ${row.scope} | ${row.authority} | ${row.evidence} |`);
  lines.push('', '## Pyroon Sentinel', '',
    `- Status: **${report.pyroon.status}**`,
    `- Passive sources: ${report.pyroon.passiveSources.map((entry) => `${entry.sourceId} (${entry.location}): ${entry.value?.text || 'MISSING'}`).join('; ') || 'MISSING'}`,
    `- Current passive: ${report.pyroon.currentPassive?.id || 'MISSING'} / ${report.pyroon.currentPassive?.name || 'MISSING'} / ${report.pyroon.currentPassive?.description || 'MISSING'}`,
    `- Canonical candidate: ${report.pyroon.canonicalCandidate?.text || 'MISSING'}`,
    `- Evidence: ${report.pyroon.evidence}`, '',
    '## Per-Pow Status', '',
    '| Runtime # | Design # | PowId | Pow | Overall | Missing/decision fields | Runtime divergence fields |', '|---:|---:|---|---|---|---|---|');
  for (const pow of report.pows) lines.push(`| ${pow.runtimeNumber} | ${pow.designNumber ?? '-'} | ${pow.powId} | ${pow.powName} | ${pow.overallStatus} | ${pow.needsDecisionFields.join(', ') || '-'} | ${pow.runtimeDivergenceFields.join(', ') || '-'} |`);
  lines.push('', '## Identity Mismatches', '', '| Runtime # | Design # | Runtime name | Design name | Reason |', '|---:|---:|---|---|---|');
  for (const mismatch of report.identityMismatches) lines.push(`| ${mismatch.runtimeNumber} | ${mismatch.designNumber ?? '-'} | ${mismatch.runtimeName} | ${mismatch.designName ?? '-'} | ${mismatch.reason} |`);
  lines.push('', '## Per-Pow Blockers', '',
    '| PowId | Pow | Field | Candidate sources | Current value | Why insufficient | Needed decision/source |', '|---|---|---|---|---|---|---|');
  for (const issue of report.blockers) {
    const current = normalize(JSON.stringify(issue.currentValue)).replace(/\|/g, '\\|');
    lines.push(`| ${issue.powId} | ${issue.powName} | ${issue.missingField} | ${issue.candidateSources.join('; ').replace(/\|/g, '\\|') || '-'} | ${current || '-'} | ${issue.whyInsufficient.replace(/\|/g, '\\|')} | ${issue.neededDecisionOrSource.replace(/\|/g, '\\|')} |`);
  }
  lines.push('', '## Recovery Notes', '', ...report.notes.map((note) => `- ${note}`), '');
  return lines.join('\n');
}

const design = JSON.parse(await readFile(resolve(sourceDir, jsonName), 'utf8'));
const workbook = JSON.parse(await readFile(workbookJsonPath, 'utf8'));
const runtime = await loadPowderCanonicalRuntime(rootUrl);
const runtimePows = [...runtime.runtimeData.pows].sort((left, right) => Number(left.rosterOrder) - Number(right.rosterOrder));
const kits = runtime.window.POWDER_SKILL_V81?.pows || {};
const designByName = new Map(design.pows.map((pow) => [normalize(pow.name).toLowerCase(), pow]));
const workbookByNumber = new Map(workbook.sheets['01_ALL_POW_01_90'].map((row) => [Number(row['#']), row]));
const pendingByName = new Map(workbook.sheets['03_PENDING_91_99'].map((row) => [row.Pow, row]));
const pendingNameById = {
  noxabyss: 'Noxabyss', frostmaw: 'Frostmaw', magmorax: 'Magmorax', venomarch: 'Venomarch',
  luxarion: 'Luxarion', tempestrix: 'Tempestrix', starter_fire_flarion: 'Flarion',
  starter_water_aquelion: 'Aquelion', starter_leaf_sylvion: 'Sylvion'
};

const pows = [];
const blockers = [];
for (const runtimePow of runtimePows) {
  const runtimeNumber = Number(runtimePow.rosterOrder);
  const designPow = runtimeNumber <= 90 ? designByName.get(normalize(runtimePow.name).toLowerCase()) : null;
  const designNumber = Number(designPow?.number);
  const workbookRow = Number.isFinite(designNumber) ? workbookByNumber.get(designNumber) : null;
  const pendingRow = runtimeNumber > 90 ? pendingByName.get(pendingNameById[runtimePow.id]) : null;
  const sourceNumber = runtimeNumber <= 90 ? designNumber : runtimeNumber;
  const kit = kits[runtimePow.id];
  const matrix = {};
  for (const field of fields) {
    matrix[field] = matrixEntry({ number: sourceNumber, field, designPow, workbookRow, current: currentValue(runtimePow, kit, field), pendingRow });
    if (matrix[field].status !== 'CANONICAL_FOUND') {
      blockers.push({
        powId: runtimePow.id,
        powName: runtimePow.name,
        runtimeNumber,
        designNumber: Number.isFinite(designNumber) ? designNumber : Number(pendingRow?.['#']),
        missingField: field,
        status: matrix[field].status,
        candidateSources: matrix[field].designSources.map((entry) => `${entry.sourceId}: ${normalize(JSON.stringify(entry.value))}`),
        currentValue: matrix[field].currentRuntimeValue,
        whyInsufficient: matrix[field].evidence,
        neededDecisionOrSource: matrix[field].status === 'DESIGN_CONFLICT'
          ? 'Choose one design authority or provide a newer explicit design.'
          : 'Provide or approve a dedicated design value; do not promote current runtime by default.'
      });
    }
  }
  const identityEvidence = runtimeNumber <= 90 ? {
    matchMethod: 'design-name-to-runtime-name',
    designNumber,
    designName: designPow?.name,
    runtimeNumber,
    runtimeName: runtimePow.name,
    runtimeOrderDivergence: designNumber !== runtimeNumber,
    runtimeNameDivergence: !designPow
  } : {
    matchMethod: 'runtime-id-to-pending-design-name',
    designNumber: Number(pendingRow?.['#']), designName: pendingRow?.Pow,
    runtimeNumber, runtimeName: runtimePow.name,
    runtimeOrderDivergence: Number(pendingRow?.['#']) !== runtimeNumber,
    runtimeNameDivergence: ![pendingRow?.Pow, pendingNameById[runtimePow.id]].includes(runtimePow.name)
  };
  const needsDecisionFields = fields.filter((field) => matrix[field].status === 'NEEDS_DESIGN_DECISION');
  const designConflictFields = fields.filter((field) => matrix[field].status === 'DESIGN_CONFLICT');
  const runtimeDivergenceFields = fields.filter((field) => matrix[field].runtimeDivergence);
  const highConfidence = fields.every((field) => matrix[field].status === 'CANONICAL_FOUND' && matrix[field].confidence === 'HIGH');
  pows.push({
    runtimeNumber,
    designNumber: Number.isFinite(designNumber) ? designNumber : Number(pendingRow?.['#']),
    rosterNumber: runtimeNumber,
    powId: runtimePow.id,
    powName: runtimePow.name,
    identityEvidence,
    overallStatus: designConflictFields.length ? 'DESIGN_CONFLICT' : highConfidence ? 'HIGH_CONFIDENCE_FULL_DESIGN' : 'PARTIAL_DESIGN',
    needsDecisionFields,
    designConflictFields,
    runtimeDivergenceFields,
    fields: matrix
  });
}

const countFound = (field) => pows.filter((pow) => pow.fields[field].status === 'CANONICAL_FOUND').length;
const sourceHashes = {
  json: await sha256(resolve(sourceDir, jsonName)),
  workbook: await sha256(resolve(sourceDir, workbookName)),
  spec: await sha256(resolve(sourceDir, specName))
};
const pyroon = pows.find((pow) => pow.powId === 'pyroon');
const report = {
  schemaVersion: 'powder-canonical-design-master-recovery-v1',
  generatedAt: new Date().toISOString(),
  status: blockers.length ? 'REVIEW_REQUIRED' : 'COMPLETE',
  authorityPolicy: [
    'Latest explicit user-locked design', 'Dedicated Pow design master/spec', 'Later specific design file',
    'Historical implementation with explicit mechanic', 'Current generic runtime as last evidence only'
  ],
  sources: [
    { id: 'phase-2a-approved-decisions', type: 'user-approved-design', file: 'Min approval / Phase 2A.2 final proposal', scope: '36 blocker fields for #1-90', authority: 1, evidence: 'Explicitly approved values superseding unresolved recovered candidates; runtime remains comparison-only.' },
    { id: 'implementation-spec-01-90', type: 'design-spec', file: specName, sha256: sourceHashes.spec, scope: '#1-90 global rules and precedence', authority: 2, evidence: 'Explicitly overrides older workbook rules.' },
    { id: 'design-json-v1.1', type: 'design-master', file: jsonName, sha256: sourceHashes.json, scope: '#1-90 per-Pow design', authority: 2, evidence: 'Machine-readable handoff source generated 2026-09-07.' },
    { id: 'design-workbook-01-90', type: 'design-master', file: workbookName, sha256: sourceHashes.workbook, scope: '#1-90 plus pending #91-99 identity rows', authority: 2, evidence: 'Human-readable source corroborating the JSON and explicitly marking #91-99 pending.' },
    { id: 'phase-prompts-01-90', type: 'design-amendment', file: 'PHASE_0..5_*.md', scope: '#1-90 review flags and implementation constraints', authority: 1, evidence: 'Later phase-specific rules; unresolved values remain blocked.' },
    { id: 'git-import-b75e25a', type: 'implementation-snapshot', file: 'js/data.js + master-data-v9.js + skill-v81-data.js', scope: 'Current runtime baseline', authority: 5, evidence: 'All files entered history together in one import; they are not independent design sources.' },
    { id: 'current-runtime-a52b712', type: 'implementation', file: 'runtime/Combat2/UI', scope: 'Comparison only', authority: 5, evidence: 'Current implementation is recorded but never self-certifies canonical design.' }
  ],
  sourceHistory: {
    data: gitLastChange(['js/data.js']),
    masterData: gitLastChange(['js/master-data-v9.js']),
    skillV81: gitLastChange(['js/skill-v81-data.js']),
    roleSystem: gitLastChange(['js/role-system-v9.js']),
    starterEvolution: gitLastChange(['js/starter-evolution-runtime.js'])
  },
  summary: {
    totalPow: pows.length,
    designRecords: design.pows.length + workbook.sheets['03_PENDING_91_99'].length,
    runtimeRecords: runtimePows.length,
    resolvedRecords: pows.filter((pow) => pow.overallStatus === 'HIGH_CONFIDENCE_FULL_DESIGN').length,
    pendingRecords: pows.filter((pow) => pow.needsDecisionFields.length > 0).length,
    highConfidenceFullDesign: pows.filter((pow) => pow.overallStatus === 'HIGH_CONFIDENCE_FULL_DESIGN').length,
    partialDesign: pows.filter((pow) => pow.overallStatus === 'PARTIAL_DESIGN').length,
    needsDesignDecision: pows.filter((pow) => pow.needsDecisionFields.length > 0).length,
    unresolvedFields: blockers.length,
    unresolvedFields1To90: blockers.filter((blocker) => blocker.runtimeNumber <= 90).length,
    unresolvedFields91To99: blockers.filter((blocker) => blocker.runtimeNumber > 90).length,
    designConflict: pows.filter((pow) => pow.designConflictFields.length > 0).length,
    passiveCanonicalFound: countFound('passive'),
    starCanonicalFound: countFound('starProgression'),
    skillCanonicalFound: { basic: countFound('basic'), skill1: countFound('skill1'), skill2: countFound('skill2'), ultimate: countFound('ultimate') },
    baseStatsCanonicalFound: countFound('baseStats'),
    specialMechanicCanonicalFound: countFound('specialMechanic'),
    pow91To99Source: 'PARTIAL'
  },
  identityMismatches: pows
    .filter((pow) => pow.identityEvidence.runtimeOrderDivergence || pow.identityEvidence.runtimeNameDivergence)
    .map((pow) => ({
      runtimeNumber: pow.runtimeNumber,
      designNumber: pow.designNumber,
      runtimeName: pow.powName,
      designName: pow.identityEvidence.designName,
      reason: pow.identityEvidence.runtimeNameDivergence ? 'Name/identity mismatch between runtime and design source.' : 'Roster order differs; identity was matched by name.'
    })),
  pyroon: {
    status: pyroon.fields.passive.status === 'CANONICAL_FOUND' ? 'RESOLVED' : 'NEEDS_DESIGN_DECISION',
    passiveSources: pyroon.fields.passive.designSources,
    currentPassive: pyroon.fields.passive.currentRuntimeValue,
    canonicalCandidate: pyroon.fields.passive.chosenCanonicalValue,
    evidence: pyroon.fields.passive.evidence
  },
  notes: [
    'No Excel/CSV design master is tracked in the current working tree; the independent master was recovered from CODEX_HANDOFF_POWDER_COMBAT90.zip.',
    'Git history begins with the b75e25a source import for core runtime data, so it cannot provide pre-V8.1 provenance.',
    'Historical combat audit documents corroborate identity/role intent but do not provide complete per-Pow Passive or Star authority.',
    'The latest recovered design pack explicitly supersedes conflicting js/data.js skill content for #1-90.',
    '#91-99 remain intentionally blocked for detailed combat design. Current Ancient and special-Starter runtime data is retained only as a candidate.',
    'Pending workbook roster numbers diverge from current runtime for Noxabyss, Frostmaw, Magmorax, Venomarch and Tempestrix; this is recorded as runtime identity divergence, not silently rewritten.',
    'Pending workbook names Flarion/Aquelion/Sylvion diverge from current runtime names Flaris/Aqueli/Sylvi and require an explicit naming decision.'
  ],
  pows,
  blockers
};

const registry = {
  schemaVersion: 'powder-canonical-design-draft-v1',
  generatedAt: report.generatedAt,
  status: 'DRAFT_REVIEW_REQUIRED',
  sourceAuthority: report.sources,
  globalRules: clone(design.globalRules),
  reviewFlags: clone(design.reviewFlags),
  pows: pows.map((pow) => ({
    powId: pow.powId,
    powName: pow.powName,
    rosterNumber: pow.rosterNumber,
    status: pow.overallStatus,
    identityEvidence: pow.identityEvidence,
    fields: pow.fields
  }))
};

await mkdir(new URL('data/', rootUrl), { recursive: true });
await mkdir(new URL('docs/', rootUrl), { recursive: true });
await mkdir(new URL('reports/', rootUrl), { recursive: true });
await writeFile(new URL('data/pow-canonical-design.json', rootUrl), `${JSON.stringify(registry, null, 2)}\n`);
await writeFile(new URL('reports/pow-canonical-design-master.json', rootUrl), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(new URL('docs/pow-canonical-design-master.md', rootUrl), markdown(report));

console.log(JSON.stringify({ status: report.status, ...report.summary, pyroon: report.pyroon.status, blockers: blockers.length }, null, 2));
