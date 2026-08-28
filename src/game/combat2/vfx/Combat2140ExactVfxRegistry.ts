export type ExactCombatVfxSpec = {
  id: string;
  textureKey: string;
  url: string;
  displaySize: number;
  alpha: number;
  source: 'img' | 'img2';
};

const BASE = '/assets/combat/vfx/preview';

export const EXACT_ELEMENT_VFX = {
  wind: { id: 'wind.impact', textureKey: 'combat-vfx-exact-wind', url: `${BASE}/wind-impact.webp`, displaySize: 218, alpha: 0.90, source: 'img' },
  lightning: { id: 'lightning.impact', textureKey: 'combat-vfx-exact-lightning', url: `${BASE}/lightning-impact.webp`, displaySize: 236, alpha: 0.98, source: 'img' },
  lava: { id: 'lava.impact', textureKey: 'combat-vfx-exact-lava', url: `${BASE}/lava-impact.webp`, displaySize: 246, alpha: 0.96, source: 'img' },
  storm: { id: 'storm.impact', textureKey: 'combat-vfx-exact-storm', url: `${BASE}/storm-impact.webp`, displaySize: 238, alpha: 0.94, source: 'img' },
  ice: { id: 'ice.impact', textureKey: 'combat-vfx-exact-ice', url: `${BASE}/ice-impact.webp`, displaySize: 238, alpha: 0.96, source: 'img' },
  poison: { id: 'poison.impact', textureKey: 'combat-vfx-exact-poison', url: `${BASE}/poison-impact.webp`, displaySize: 230, alpha: 0.90, source: 'img' },
  light: { id: 'light.impact', textureKey: 'combat-vfx-exact-light', url: `${BASE}/light-impact.webp`, displaySize: 238, alpha: 0.98, source: 'img' },
  dark: { id: 'dark.impact', textureKey: 'combat-vfx-exact-dark', url: `${BASE}/dark-impact.webp`, displaySize: 234, alpha: 0.93, source: 'img' }
} satisfies Record<string, ExactCombatVfxSpec>;

export const EXACT_STATUS_VFX = {
  burn: { id: 'status.burn', textureKey: 'combat-vfx-exact-status-burn', url: `${BASE}/status-burn.webp`, displaySize: 180, alpha: 0.72, source: 'img2' },
  freeze: { id: 'status.freeze', textureKey: 'combat-vfx-exact-status-freeze', url: `${BASE}/status-freeze.webp`, displaySize: 194, alpha: 0.78, source: 'img2' },
  stun: { id: 'status.stun', textureKey: 'combat-vfx-exact-status-stun', url: `${BASE}/status-stun.webp`, displaySize: 180, alpha: 0.76, source: 'img2' },
  heal: { id: 'status.heal', textureKey: 'combat-vfx-exact-status-heal', url: `${BASE}/status-heal.webp`, displaySize: 186, alpha: 0.72, source: 'img2' },
  shield: { id: 'status.shield', textureKey: 'combat-vfx-exact-status-shield', url: `${BASE}/status-shield.webp`, displaySize: 200, alpha: 0.68, source: 'img2' }
} satisfies Record<string, ExactCombatVfxSpec>;

function plain(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function exactElementVfx(value: unknown): ExactCombatVfxSpec | null {
  const key = plain(value);
  if (key.includes('lightning') || key.includes('electric') || key.includes('thunder') || key.includes('set')) return EXACT_ELEMENT_VFX.lightning;
  if (key.includes('ice') || key.includes('bang')) return EXACT_ELEMENT_VFX.ice;
  if (key.includes('poison') || key.includes('doc')) return EXACT_ELEMENT_VFX.poison;
  if (key.includes('wind') || key.includes('gio')) return EXACT_ELEMENT_VFX.wind;
  if (key.includes('lava') || key.includes('dung nham') || key.includes('dungnham')) return EXACT_ELEMENT_VFX.lava;
  if (key.includes('storm') || key.includes('bao')) return EXACT_ELEMENT_VFX.storm;
  if (key.includes('light') || key.includes('anh sang') || key.includes('anhsang')) return EXACT_ELEMENT_VFX.light;
  if (key.includes('dark') || key.includes('shadow') || key.includes('bong toi') || key.includes('bongtoi')) return EXACT_ELEMENT_VFX.dark;
  return null;
}

export function exactStatusVfx(value: unknown): ExactCombatVfxSpec | null {
  const key = plain(value);
  if (key.includes('burn') || key.includes('thieu dot')) return EXACT_STATUS_VFX.burn;
  if (key.includes('freeze') || key.includes('dong bang') || key.includes('lam lanh') || key.includes('frost')) return EXACT_STATUS_VFX.freeze;
  if (key.includes('stun') || key.includes('choang') || key.includes('te liet') || key.includes('paralysis')) return EXACT_STATUS_VFX.stun;
  if (key.includes('heal') || key.includes('hoi mau') || key.includes('hoi phuc') || key.includes('regeneration')) return EXACT_STATUS_VFX.heal;
  if (key.includes('shield') || key.includes('khien') || key.includes('barrier') || key.includes('bao ho') || key.includes('guard')) return EXACT_STATUS_VFX.shield;
  return null;
}

export function allExactCombatVfxSpecs(): ExactCombatVfxSpec[] {
  return [...Object.values(EXACT_ELEMENT_VFX), ...Object.values(EXACT_STATUS_VFX)];
}
