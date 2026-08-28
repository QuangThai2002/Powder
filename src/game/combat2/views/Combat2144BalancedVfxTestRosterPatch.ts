import { ALL_COMBAT2_STARTER_POWS, COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import type { CombatAbility, CombatPow } from '../data/CombatPow';
import { CombatState } from '../systems/CombatState';

const PATCH_FLAG = '__powderCombat2144BalancedVfxTestRosterInstalled';
const RAGE_PATCH_FLAG = '__powderCombat2144BalancedVfxTestRageInstalled';
const VERSION = '2.14.4-test-roster';

function byId(id: string): CombatPow {
  const pow = ALL_COMBAT2_STARTER_POWS.find((entry) => entry.id === id);
  if (!pow) throw new Error(`[Combat2 test roster] Missing Pow: ${id}`);
  return pow;
}

function ability(base: CombatAbility, patch: Partial<CombatAbility>): CombatAbility {
  return { ...base, ...patch };
}

function setStats(pow: CombatPow, stats: Pick<CombatPow, 'hp' | 'maxHp' | 'attack' | 'abilityPower' | 'defense' | 'speed'>): void {
  Object.assign(pow, stats, {
    level: 60,
    accuracy: 100,
    critRate: 10,
    critDamage: 150,
    critResist: 8,
    evasion: Math.min(pow.evasion, 10),
    tenacity: 8,
    damageReduction: 0
  });
}

function configureTidewarden(pow: CombatPow): void {
  const [skill1, skill2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(skill1, {
      name: 'Thủy Kính Hộ Thể', power: 1, type: 'support', status: 'shield', target: 'ally',
      description: 'Tạo Khiên cho một đồng minh để kiểm thử Shield VFX.'
    }),
    ability(skill2, {
      name: 'Triều Sinh', power: 1, type: 'support', status: 'regeneration', target: 'ally',
      description: 'Hồi phục đồng minh để kiểm thử Heal VFX.'
    })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, {
    name: 'Hải Triều Trấn Giới', power: 145, type: 'elemental', area: true,
    description: 'Đòn Nước diện rộng; dùng để kiểm thử Ultimate/impact.'
  });
}

function configureTerrapup(pow: CombatPow): void {
  const [skill1, skill2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(skill1, {
      name: 'Nham Giáp', power: 1, type: 'support', status: 'shield', target: 'self',
      description: 'Tạo Khiên cho bản thân để đối chiếu với Tidewarden.'
    }),
    ability(skill2, {
      name: 'Địa Chấn Choáng', power: 100, type: 'physical', status: 'stun', target: 'enemy',
      description: 'Đòn Đất gây Choáng để kiểm thử Stun VFX.'
    })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, {
    name: 'Đại Địa Chấn', power: 145, type: 'physical', area: true,
    description: 'Đòn Đất diện rộng cân với Hải Triều Trấn Giới.'
  });
}

function configureFrostmaw(pow: CombatPow): void {
  const [skill1, skill2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(skill1, {
      name: 'Băng Nha Phong Tỏa', power: 100, type: 'elemental', status: 'freeze', target: 'enemy',
      description: 'Gây Đóng Băng để kiểm thử Freeze VFX bám mục tiêu.'
    }),
    ability(skill2, {
      name: 'Băng Giáp', power: 1, type: 'support', status: 'shield', target: 'self',
      description: 'Tạo Khiên băng cho bản thân.'
    })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, {
    name: 'Băng Phong Tuyệt Vực', power: 140, type: 'elemental', status: 'freeze', area: true,
    description: 'Ultimate Băng diện rộng để kiểm thử Freeze + Ultimate VFX.'
  });
}

function configureStormeon(pow: CombatPow): void {
  const [skill1, skill2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(skill1, {
      name: 'Lôi Kích Tê Liệt', power: 100, type: 'elemental', status: 'stun', target: 'enemy',
      description: 'Gây Choáng để đối chiếu trực tiếp với Freeze.'
    }),
    ability(skill2, {
      name: 'Điện Trường Tê Liệt', power: 95, type: 'debuff', status: 'paralysis', target: 'enemy',
      description: 'Gây Tê Liệt để kiểm thử điện/status VFX.'
    })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, {
    name: 'Thiên Lôi Bạo Vũ', power: 140, type: 'elemental', status: 'stun', area: true,
    description: 'Ultimate Sét diện rộng cân với Băng Phong Tuyệt Vực.'
  });
}

function configurePyroon(pow: CombatPow): void {
  const [skill1, skill2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(skill1, {
      name: 'Hỏa Ấn Thiêu Đốt', power: 105, type: 'elemental', status: 'burn', target: 'enemy',
      description: 'Gây Thiêu Đốt để kiểm thử Burn VFX 12 frame.'
    }),
    ability(skill2, {
      name: 'Hỏa Lực Cường Hóa', power: 1, type: 'support', status: 'attack up', target: 'self',
      description: 'Tăng ATK; không được giả thành Heal VFX.'
    })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, {
    name: 'Xích Viêm Bạo Liệt', power: 150, type: 'elemental', status: 'burn', area: true,
    description: 'Ultimate Lửa diện rộng, gây Burn.'
  });
}

function configureGearbit(pow: CombatPow): void {
  const [skill1, skill2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(skill1, {
      name: 'Xuyên Giáp Cơ Giới', power: 105, type: 'physical', status: 'defense down', target: 'enemy',
      description: 'Giảm DEF để kiểm thử debuff khác với Burn/CC.'
    }),
    ability(skill2, {
      name: 'Hợp Kim Hộ Thuẫn', power: 1, type: 'support', status: 'shield', target: 'self',
      description: 'Tạo Khiên để đối chiếu Shield VFX.'
    })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, {
    name: 'Pháo Xuyên Thành', power: 150, type: 'physical', sureHit: true, bypassGuard: true,
    description: 'Ultimate Thép Tất Trúng và xuyên Bảo Hộ.'
  });
}

function installFourRageTestStart(): void {
  const root = globalThis as any;
  if (root[RAGE_PATCH_FLAG]) return;
  root[RAGE_PATCH_FLAG] = true;

  const proto = CombatState.prototype as any;
  const originalMakeUnits = proto.makeUnits;
  if (typeof originalMakeUnits !== 'function') return;

  proto.makeUnits = function combat2144MakeUnitsWithTestRage(...args: unknown[]): any[] {
    const units = originalMakeUnits.apply(this, args) as any[];
    units.forEach((unit) => { unit.ragePoints = 4; });
    return units;
  };
}

export function installCombat2144BalancedVfxTestRoster(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  // Active field: tank/support + controller + damage on both sides.
  // Reserves remain useful for testing promotion/revive flow.
  const player = [byId('tidewarden'), byId('frostmaw'), byId('pyroon'), byId('mosshorn'), byId('voltkit')];
  const enemy = [byId('terrapup'), byId('stormeon'), byId('gearbit'), byId('aquabub'), byId('zephyroo')];

  COMBAT2_STARTER_ROSTER.player.splice(0, COMBAT2_STARTER_ROSTER.player.length, ...player);
  COMBAT2_STARTER_ROSTER.enemy.splice(0, COMBAT2_STARTER_ROSTER.enemy.length, ...enemy);

  // Mirrored stat budgets make visual/mechanic comparisons last long enough to test.
  setStats(byId('tidewarden'), { hp: 340, maxHp: 340, attack: 50, abilityPower: 50, defense: 62, speed: 48 });
  setStats(byId('terrapup'),    { hp: 340, maxHp: 340, attack: 50, abilityPower: 50, defense: 62, speed: 48 });
  setStats(byId('frostmaw'),    { hp: 310, maxHp: 310, attack: 56, abilityPower: 62, defense: 50, speed: 56 });
  setStats(byId('stormeon'),    { hp: 310, maxHp: 310, attack: 56, abilityPower: 62, defense: 50, speed: 56 });
  setStats(byId('pyroon'),      { hp: 300, maxHp: 300, attack: 64, abilityPower: 58, defense: 46, speed: 60 });
  setStats(byId('gearbit'),     { hp: 300, maxHp: 300, attack: 64, abilityPower: 58, defense: 46, speed: 60 });

  configureTidewarden(byId('tidewarden'));
  configureTerrapup(byId('terrapup'));
  configureFrostmaw(byId('frostmaw'));
  configureStormeon(byId('stormeon'));
  configurePyroon(byId('pyroon'));
  configureGearbit(byId('gearbit'));
  installFourRageTestStart();

  root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER = {
    version: VERSION,
    initialRage: 4,
    player: player.map((pow) => pow.id),
    enemy: enemy.map((pow) => pow.id),
    activePairs: [
      ['tidewarden', 'terrapup'],
      ['frostmaw', 'stormeon'],
      ['pyroon', 'gearbit']
    ],
    showcase: ['shield', 'regeneration', 'freeze', 'stun', 'paralysis', 'burn', 'defense down']
  };
}

installCombat2144BalancedVfxTestRoster();
