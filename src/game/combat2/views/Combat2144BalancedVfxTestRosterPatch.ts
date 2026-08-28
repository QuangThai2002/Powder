import { COMBAT2_STARTER_ROSTER } from '../data/PowderDataAdapter';
import type { CombatAbility, CombatPow } from '../data/CombatPow';
import { CombatState } from '../systems/CombatState';

const PATCH_FLAG = '__powderCombat2144BalancedVfxTestRosterInstalled';
const RAGE_PATCH_FLAG = '__powderCombat2144BalancedVfxTestRageInstalled';
const VERSION = '2.14.4-test-roster-hotfix';

function ability(base: CombatAbility, patch: Partial<CombatAbility>): CombatAbility {
  return { ...base, ...patch };
}

function setStats(pow: CombatPow, hp: number, attack: number, ap: number, defense: number, speed: number): void {
  Object.assign(pow, {
    level: 60,
    hp,
    maxHp: hp,
    attack,
    abilityPower: ap,
    defense,
    speed,
    accuracy: 100,
    critRate: 10,
    critDamage: 150,
    critResist: 8,
    evasion: Math.min(Number(pow.evasion || 0), 10),
    tenacity: 8,
    damageReduction: 0
  });
}

function configureSupport(pow: CombatPow): void {
  const [s1, s2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(s1, { name: 'Thủy Kính Hộ Thể', power: 1, type: 'support', status: 'shield', target: 'ally', description: 'TEST · Khiên đồng minh.' }),
    ability(s2, { name: 'Triều Sinh', power: 1, type: 'support', status: 'regeneration', target: 'ally', description: 'TEST · Hồi phục đồng minh.' })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, { name: 'Hải Triều Trấn Giới', power: 145, type: 'elemental', area: true, description: 'TEST · Ultimate diện rộng.' });
}

function configureFreeze(pow: CombatPow): void {
  const [s1, s2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(s1, { name: 'Băng Nha Phong Tỏa', power: 100, type: 'elemental', status: 'freeze', target: 'enemy', description: 'TEST · Đóng băng.' }),
    ability(s2, { name: 'Băng Giáp', power: 1, type: 'support', status: 'shield', target: 'self', description: 'TEST · Khiên bản thân.' })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, { name: 'Băng Phong Tuyệt Vực', power: 140, type: 'elemental', status: 'freeze', area: true, description: 'TEST · Freeze diện rộng.' });
}

function configureBurn(pow: CombatPow): void {
  const [s1, s2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(s1, { name: 'Hỏa Ấn Thiêu Đốt', power: 105, type: 'elemental', status: 'burn', target: 'enemy', description: 'TEST · Burn 12 frame.' }),
    ability(s2, { name: 'Hỏa Lực Cường Hóa', power: 1, type: 'support', status: 'attack up', target: 'self', description: 'TEST · Buff ATK.' })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, { name: 'Xích Viêm Bạo Liệt', power: 150, type: 'elemental', status: 'burn', area: true, description: 'TEST · Ultimate Burn.' });
}

function configureTankStun(pow: CombatPow): void {
  const [s1, s2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(s1, { name: 'Nham Giáp', power: 1, type: 'support', status: 'shield', target: 'self', description: 'TEST · Khiên.' }),
    ability(s2, { name: 'Địa Chấn Choáng', power: 100, type: 'physical', status: 'stun', target: 'enemy', description: 'TEST · Stun.' })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, { name: 'Đại Địa Chấn', power: 145, type: 'physical', area: true, description: 'TEST · Ultimate diện rộng.' });
}

function configureStormControl(pow: CombatPow): void {
  const [s1, s2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(s1, { name: 'Lôi Kích Choáng', power: 100, type: 'elemental', status: 'stun', target: 'enemy', description: 'TEST · Stun.' }),
    ability(s2, { name: 'Điện Trường Tê Liệt', power: 95, type: 'debuff', status: 'paralysis', target: 'enemy', description: 'TEST · Paralysis.' })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, { name: 'Thiên Lôi Bạo Vũ', power: 140, type: 'elemental', status: 'stun', area: true, description: 'TEST · Ultimate Stun.' });
}

function configureArmorBreak(pow: CombatPow): void {
  const [s1, s2] = pow.abilities.skills;
  pow.abilities.skills = [
    ability(s1, { name: 'Xuyên Giáp Cơ Giới', power: 105, type: 'physical', status: 'defense down', target: 'enemy', description: 'TEST · Giảm DEF.' }),
    ability(s2, { name: 'Hợp Kim Hộ Thuẫn', power: 1, type: 'support', status: 'shield', target: 'self', description: 'TEST · Khiên.' })
  ];
  pow.abilities.ultimate = ability(pow.abilities.ultimate, { name: 'Pháo Xuyên Thành', power: 150, type: 'physical', sureHit: true, bypassGuard: true, description: 'TEST · Tất Trúng/Xuyên Bảo Hộ.' });
}

function installFourRageTestStart(): void {
  const root = globalThis as any;
  if (root[RAGE_PATCH_FLAG]) return;
  root[RAGE_PATCH_FLAG] = true;
  const proto = CombatState.prototype as any;
  const originalMakeUnits = proto.makeUnits;
  if (typeof originalMakeUnits !== 'function') return;
  proto.makeUnits = function combat2144MakeUnitsWithTestRage(...args: any[]): any[] {
    const units = originalMakeUnits.apply(this, args) as any[];
    for (const unit of units) unit.ragePoints = 4;
    return units;
  };
}

export function installCombat2144BalancedVfxTestRoster(): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const originalPlayer = COMBAT2_STARTER_ROSTER.player.slice();
  const originalEnemy = COMBAT2_STARTER_ROSTER.enemy.slice();
  if (originalPlayer.length < 5 || originalEnemy.length < 5) {
    console.warn('[Combat2 2.14.4] Test roster skipped: starter roster incomplete.');
    installFourRageTestStart();
    return;
  }

  // Use Pow objects already proven loadable by Combat2. No ID lookup and no boot-time throw.
  // Previous player order: 0/1/2 active, 3/4 reserve. Move two reserves into the active line.
  const player = [originalPlayer[4], originalPlayer[3], originalPlayer[2], originalPlayer[0], originalPlayer[1]];
  // Move two enemy reserves into the active line as well.
  const enemy = [originalEnemy[0], originalEnemy[4], originalEnemy[3], originalEnemy[1], originalEnemy[2]];

  COMBAT2_STARTER_ROSTER.player.splice(0, COMBAT2_STARTER_ROSTER.player.length, ...player);
  COMBAT2_STARTER_ROSTER.enemy.splice(0, COMBAT2_STARTER_ROSTER.enemy.length, ...enemy);

  setStats(player[0], 340, 50, 50, 62, 48);
  setStats(enemy[0], 340, 50, 50, 62, 48);
  setStats(player[1], 310, 56, 62, 50, 56);
  setStats(enemy[1], 310, 56, 62, 50, 56);
  setStats(player[2], 300, 64, 58, 46, 60);
  setStats(enemy[2], 300, 64, 58, 46, 60);

  configureSupport(player[0]);
  configureFreeze(player[1]);
  configureBurn(player[2]);
  configureTankStun(enemy[0]);
  configureStormControl(enemy[1]);
  configureArmorBreak(enemy[2]);
  installFourRageTestStart();

  root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER = {
    version: VERSION,
    initialRage: 4,
    player: player.map((pow) => pow.id),
    enemy: enemy.map((pow) => pow.id),
    activePairs: [[player[0].id, enemy[0].id], [player[1].id, enemy[1].id], [player[2].id, enemy[2].id]],
    showcase: ['shield', 'regeneration', 'freeze', 'stun', 'paralysis', 'burn', 'defense down']
  };
}

installCombat2144BalancedVfxTestRoster();
