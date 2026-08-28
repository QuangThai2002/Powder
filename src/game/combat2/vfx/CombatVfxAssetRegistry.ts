export type CombatVfxElement =
  | 'fire' | 'steel' | 'water' | 'leaf' | 'earth' | 'wind' | 'lightning'
  | 'lava' | 'storm' | 'ice' | 'poison' | 'light' | 'dark';

export type CombatVfxAssetSpec = {
  id: string;
  textureKey: string;
  url: string;
  displaySize: number;
  alpha?: number;
  blend?: 'add' | 'normal';
  source: 'img' | 'img2';
  preview: boolean;
};

const BASE = '/assets/combat/vfx/preview';

export const COMBAT_VFX_ASSETS = {
  'fire.impact': { id: 'fire.impact', textureKey: 'combat-vfx-fire-impact', url: `${BASE}/fire-impact.webp`, displaySize: 238, alpha: 0.96, blend: 'add', source: 'img', preview: true },
  'steel.impact': { id: 'steel.impact', textureKey: 'combat-vfx-steel-impact', url: `${BASE}/steel-impact.webp`, displaySize: 225, alpha: 0.94, blend: 'add', source: 'img2', preview: true },
  'water.impact': { id: 'water.impact', textureKey: 'combat-vfx-water-impact', url: `${BASE}/water-impact.webp`, displaySize: 232, alpha: 0.94, blend: 'add', source: 'img', preview: true },
  'leaf.impact': { id: 'leaf.impact', textureKey: 'combat-vfx-leaf-impact', url: `${BASE}/leaf-impact.webp`, displaySize: 220, alpha: 0.9, blend: 'add', source: 'img', preview: true },
  'earth.impact': { id: 'earth.impact', textureKey: 'combat-vfx-earth-impact', url: `${BASE}/earth-impact.webp`, displaySize: 232, alpha: 0.94, blend: 'normal', source: 'img', preview: true },
  'wind.impact': { id: 'wind.impact', textureKey: 'combat-vfx-wind-impact', url: `${BASE}/wind-impact.webp`, displaySize: 218, alpha: 0.9, blend: 'add', source: 'img', preview: true },
  'lightning.impact': { id: 'lightning.impact', textureKey: 'combat-vfx-lightning-impact', url: `${BASE}/lightning-impact.webp`, displaySize: 235, alpha: 0.98, blend: 'add', source: 'img', preview: true },
  'lava.impact': { id: 'lava.impact', textureKey: 'combat-vfx-lava-impact', url: `${BASE}/lava-impact.webp`, displaySize: 245, alpha: 0.96, blend: 'add', source: 'img', preview: true },
  'storm.impact': { id: 'storm.impact', textureKey: 'combat-vfx-storm-impact', url: `${BASE}/storm-impact.webp`, displaySize: 235, alpha: 0.94, blend: 'add', source: 'img', preview: true },
  'ice.impact': { id: 'ice.impact', textureKey: 'combat-vfx-ice-impact', url: `${BASE}/ice-impact.webp`, displaySize: 235, alpha: 0.96, blend: 'add', source: 'img', preview: true },
  'poison.impact': { id: 'poison.impact', textureKey: 'combat-vfx-poison-impact', url: `${BASE}/poison-impact.webp`, displaySize: 228, alpha: 0.9, blend: 'add', source: 'img', preview: true },
  'light.impact': { id: 'light.impact', textureKey: 'combat-vfx-light-impact', url: `${BASE}/light-impact.webp`, displaySize: 235, alpha: 0.98, blend: 'add', source: 'img', preview: true },
  'dark.impact': { id: 'dark.impact', textureKey: 'combat-vfx-dark-impact', url: `${BASE}/dark-impact.webp`, displaySize: 232, alpha: 0.93, blend: 'add', source: 'img', preview: true },
  'status.burn': { id: 'status.burn', textureKey: 'combat-vfx-status-burn', url: `${BASE}/status-burn.webp`, displaySize: 180, alpha: 0.72, blend: 'add', source: 'img2', preview: true },
  'status.freeze': { id: 'status.freeze', textureKey: 'combat-vfx-status-freeze', url: `${BASE}/status-freeze.webp`, displaySize: 192, alpha: 0.78, blend: 'add', source: 'img2', preview: true },
  'status.stun': { id: 'status.stun', textureKey: 'combat-vfx-status-stun', url: `${BASE}/status-stun.webp`, displaySize: 178, alpha: 0.76, blend: 'add', source: 'img2', preview: true },
  'status.heal': { id: 'status.heal', textureKey: 'combat-vfx-status-heal', url: `${BASE}/status-heal.webp`, displaySize: 184, alpha: 0.72, blend: 'add', source: 'img2', preview: true },
  'status.shield': { id: 'status.shield', textureKey: 'combat-vfx-status-shield', url: `${BASE}/status-shield.webp`, displaySize: 198, alpha: 0.68, blend: 'add', source: 'img2', preview: true }
} satisfies Record<string, CombatVfxAssetSpec>;

export type CombatVfxAssetId = keyof typeof COMBAT_VFX_ASSETS;

const ELEMENT_ALIASES: Record<string, CombatVfxElement> = {
  fire: 'fire', lua: 'fire',
  steel: 'steel', thep: 'steel',
  water: 'water', nuoc: 'water',
  leaf: 'leaf', grass: 'leaf', la: 'leaf', nature: 'leaf',
  earth: 'earth', dat: 'earth',
  wind: 'wind', gio: 'wind',
  lightning: 'lightning', electric: 'lightning', thunder: 'lightning', set: 'lightning',
  lava: 'lava', dungnham: 'lava',
  storm: 'storm', bao: 'storm',
  ice: 'ice', bang: 'ice',
  poison: 'poison', doc: 'poison',
  light: 'light', anhsang: 'light',
  dark: 'dark', shadow: 'dark', bongtoi: 'dark'
};

function plain(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeCombatVfxElement(value: unknown): CombatVfxElement {
  const key = plain(value);
  return ELEMENT_ALIASES[key] || 'light';
}

export function elementImpactAsset(value: unknown): CombatVfxAssetSpec {
  const element = normalizeCombatVfxElement(value);
  return COMBAT_VFX_ASSETS[`${element}.impact` as CombatVfxAssetId];
}

export function allCombatVfxAssets(): CombatVfxAssetSpec[] {
  return Object.values(COMBAT_VFX_ASSETS);
}
