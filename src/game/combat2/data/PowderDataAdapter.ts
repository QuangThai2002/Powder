import type { CombatPow } from './CombatPow';

const asset = (fileName: string): string =>
  new URL(`../../../../assets/pow-beta12/${fileName}`, import.meta.url).href;

function makePow(
  id: string,
  name: string,
  fileName: string,
  element: string,
  role: string,
  display: CombatPow['display']
): CombatPow {
  return {
    id,
    name,
    assetKey: `pow2-${id}`,
    assetUrl: asset(fileName),
    element,
    role,
    level: 60,
    hp: 1000,
    maxHp: 1000,
    mana: 30,
    maxMana: 100,
    rage: 0,
    maxRage: 100,
    display
  };
}

/**
 * Combat 2.0.1 starter bridge.
 *
 * Uses the canonical portrait art from assets/pow-beta12 directly. It does
 * NOT use the legacy pow-combat-512 replacement path. In 2.0.2 this adapter
 * will be expanded to read the complete Powder roster/stat data.
 */
export const COMBAT2_STARTER_ROSTER = {
  enemy: [
    makePow('stormeon', 'Stormeon', 'stormeon.webp', 'Bão', 'Nhạc công', {
      heightRatio: 0.94,
      scaleAdjust: 1.03,
      offsetY: 2
    }),
    makePow('joltail', 'Joltail', 'joltail.webp', 'Sét', 'Xạ thủ', {
      heightRatio: 0.94,
      scaleAdjust: 1.04,
      offsetY: 3
    }),
    makePow('terrapup', 'Terrapup', 'terrapup.webp', 'Đất', 'Đỡ đòn', {
      heightRatio: 0.94,
      scaleAdjust: 1.05,
      offsetY: 4
    })
  ],
  player: [
    makePow('frostmaw', 'Frostmaw', 'frostmaw.webp', 'Băng', 'Đỡ đòn', {
      heightRatio: 0.96,
      scaleAdjust: 1.03,
      offsetY: 4
    }),
    makePow('tidewarden', 'Tidewarden', 'tidewarden.webp', 'Nước', 'Đỡ đòn', {
      heightRatio: 0.95,
      scaleAdjust: 1.02,
      offsetY: 2
    }),
    makePow('sparkit', 'Sparkit', 'sparkit.webp', 'Sét', 'Đấu sĩ', {
      heightRatio: 0.94,
      scaleAdjust: 1.04,
      offsetY: 3
    })
  ]
} satisfies Record<'enemy' | 'player', CombatPow[]>;

export const ALL_COMBAT2_STARTER_POWS: CombatPow[] = [
  ...COMBAT2_STARTER_ROSTER.enemy,
  ...COMBAT2_STARTER_ROSTER.player
];
