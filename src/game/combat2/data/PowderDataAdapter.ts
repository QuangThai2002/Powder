import type { CombatPow } from './CombatPow';

const CANONICAL_ASSETS = {
  stormeon: new URL('../../../../assets/pow-beta12/stormeon.webp', import.meta.url).href,
  joltail: new URL('../../../../assets/pow-beta12/joltail.webp', import.meta.url).href,
  terrapup: new URL('../../../../assets/pow-beta12/terrapup.webp', import.meta.url).href,
  frostmaw: new URL('../../../../assets/pow-beta12/frostmaw.webp', import.meta.url).href,
  tidewarden: new URL('../../../../assets/pow-beta12/tidewarden.webp', import.meta.url).href,
  sparkit: new URL('../../../../assets/pow-beta12/sparkit.webp', import.meta.url).href
} as const;

type StarterPowId = keyof typeof CANONICAL_ASSETS;

function makePow(
  id: StarterPowId,
  name: string,
  element: string,
  role: string,
  display: CombatPow['display']
): CombatPow {
  return {
    id,
    name,
    assetKey: `pow2-${id}`,
    assetUrl: CANONICAL_ASSETS[id],
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
    makePow('stormeon', 'Stormeon', 'Bão', 'Nhạc công', {
      heightRatio: 0.94,
      scaleAdjust: 1.03,
      offsetY: 2
    }),
    makePow('joltail', 'Joltail', 'Sét', 'Xạ thủ', {
      heightRatio: 0.94,
      scaleAdjust: 1.04,
      offsetY: 3
    }),
    makePow('terrapup', 'Terrapup', 'Đất', 'Đỡ đòn', {
      heightRatio: 0.94,
      scaleAdjust: 1.05,
      offsetY: 4
    })
  ],
  player: [
    makePow('frostmaw', 'Frostmaw', 'Băng', 'Đỡ đòn', {
      heightRatio: 0.96,
      scaleAdjust: 1.03,
      offsetY: 4
    }),
    makePow('tidewarden', 'Tidewarden', 'Nước', 'Đỡ đòn', {
      heightRatio: 0.95,
      scaleAdjust: 1.02,
      offsetY: 2
    }),
    makePow('sparkit', 'Sparkit', 'Sét', 'Đấu sĩ', {
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
