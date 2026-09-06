import Phaser from 'phaser';

export const COMBAT_VFX_REGISTRY_VERSION = '2.20.4';

export type CombatVfxCategory = 'projectile' | 'slash' | 'impact' | 'magic-circle' | 'charge' | 'ultimate' | 'status';
export type CombatVfxQualityPreset = 'low' | 'medium' | 'high';
export type CombatVfxAssetGroup = 'common' | 'ultimate' | 'status' | 'lazy';

export type CombatVfxAssetSpec = Readonly<{
  id: string;
  category: CombatVfxCategory;
  textureKey: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  fps: number;
  group: CombatVfxAssetGroup;
  blend: Phaser.BlendModes;
  staticImage: boolean;
  enabled: boolean;
}>;

export type CombatVfxActionResolution = Readonly<{
  projectile?: string;
  slash?: string;
  impact: string;
  magicCircle: string;
  cast: string;
  trail?: string;
  travelDurationMs?: number;
  scale: number;
  multiHitCadenceMs: number;
}>;

export type CombatVfxUltimateResolution = Readonly<{
  intro: string;
  charge: string;
  release: string;
  impact: string;
  finish: string;
}>;

export type CombatVfxHitSequence = Readonly<{
  hitCount: number;
  cadenceMs: number;
}>;

type ActionInput = {
  role?: unknown;
  element?: unknown;
  tier?: 'normal' | 'skill' | 'ultimate';
  traits?: readonly string[];
  visualHitCount?: number;
  multiHitCadenceMs?: number;
};

type RegistryRegressionCheck = { name: string; pass: boolean; detail: string };
export type CombatVfxRegistryRegression = {
  version: string;
  pass: boolean;
  checks: RegistryRegressionCheck[];
};

const ASSET_ROOT = '/assets/combat/vfx';
// Bump only when a delivered sheet or its playback metadata changes. Texture and
// animation keys then cannot reuse a stale Phaser cache after a hard refresh/HMR.
const COMBAT_VFX_ASSET_REVISION = '2026-09-05-r3';
// Delivered art is used only by its matching live Combat2 action. Missing textures
// stay on the existing procedural route through ensureCombatVfxTexture().
const LIVE_COMBAT_ASSET_IDS = new Set([
  'cast_core_elemental',
  'dark',
  'slash_heavy',
  'slash_dark',
  'impact_dark',
  'circle_dark',
  'ultimate_intro_standard',
  'ultimate_charge_standard',
  'ultimate_release_standard',
  'ultimate_impact_standard',
  'ultimate_finish_standard'
]);
const LIVE_ULTIMATE_READY_CIRCLE_ASSET_IDS = new Set([
  'ultimate_ready_common',
  'ultimate_ready_rare',
  'ultimate_ready_super_rare',
  'ultimate_ready_epic',
  'ultimate_ready_legendary',
  'ultimate_ready_mythic',
  'ultimate_ready_ancient'
]);
const warned = new Set<string>();
const queuedTextureKeys = new WeakMap<Phaser.Scene, Set<string>>();

function devRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function warnCombatVfxDev(key: string, message: string): void {
  if (!devRuntime() || warned.has(key)) return;
  warned.add(key);
  console.warn(`[Combat2 VFX] ${message}`);
}

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function elementKey(value: unknown): string {
  const key = normalize(value);
  if (key.includes('dung nham') || key.includes('lava')) return 'lava';
  if (key.includes('fire') || key.includes('lua')) return 'fire';
  if (key.includes('water') || key.includes('nuoc')) return 'water';
  if (key.includes('ice') || key.includes('bang')) return 'ice';
  if (key.includes('storm') || key.includes('bao')) return 'storm';
  if (key.includes('lightning') || key.includes('set') || key.includes('electric')) return 'lightning';
  if (key.includes('wind') || key.includes('gio')) return 'wind';
  if (key.includes('leaf') || key.includes('la') || key.includes('nature')) return 'leaf';
  if (key.includes('poison') || key.includes('doc')) return 'poison';
  if (key.includes('earth') || key.includes('dat')) return 'earth';
  if (key.includes('steel') || key.includes('thep')) return 'steel';
  if (key.includes('light') || key.includes('anh sang')) return 'light';
  if (key.includes('dark') || key.includes('bong toi')) return 'dark';
  return 'neutral';
}

function roleKey(value: unknown): string {
  const role = normalize(value);
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('enchanter') || role.includes('warlock')) return 'enchanter';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  if (role.includes('do don') || role.includes('tank')) return 'tank';
  if (role.includes('dau si') || role.includes('fighter')) return 'fighter';
  if (role.includes('hiep si') || role.includes('knight')) return 'knight';
  if (role.includes('sat thu') || role.includes('assassin')) return 'assassin';
  return 'fallback';
}

function folderFor(category: CombatVfxCategory): string {
  if (category === 'magic-circle') return 'magic-circle';
  return category;
}

function extensionFor(category: CombatVfxCategory, id: string): string {
  // FIRST ART PACK was delivered as lossless PNG sheets; existing optional art remains alpha WebP.
  if ([
    'cast_core_elemental',
    'dark',
    'slash_heavy',
    'slash_dark',
    'impact_dark',
    'ultimate_intro_standard',
    'ultimate_charge_standard',
    'ultimate_release_standard',
    'ultimate_impact_standard',
    'ultimate_finish_standard',
    'ultimate_back_common',
    'ultimate_back_epic',
    'ultimate_back_ancient',
    'ultimate_ready_common',
    'ultimate_ready_rare',
    'ultimate_ready_super_rare',
    'ultimate_ready_epic',
    'ultimate_ready_legendary',
    'ultimate_ready_mythic',
    'ultimate_ready_ancient'
  ].includes(id)) return 'png';
  // Circle glyphs need lossless edges; the remaining effects can use alpha WebP.
  return category === 'magic-circle' ? 'png' : 'webp';
}

function defineAsset(
  id: string,
  category: CombatVfxCategory,
  frameWidth: number,
  frameHeight: number,
  frames: number,
  fps: number,
  group: CombatVfxAssetGroup,
  blend: Phaser.BlendModes = Phaser.BlendModes.ADD,
  staticImage = false
): CombatVfxAssetSpec {
  return Object.freeze({
    id,
    category,
    textureKey: `combat-vfx-${COMBAT_VFX_ASSET_REVISION}-${id}`,
    url: `${ASSET_ROOT}/${folderFor(category)}/${id}.${extensionFor(category, id)}?v=${COMBAT_VFX_ASSET_REVISION}`,
    frameWidth,
    frameHeight,
    frames,
    fps,
    group,
    blend,
    staticImage,
    // Art is intentionally opt-in until the matching file has been delivered.
    enabled: false
  });
}

const specs = [
  ...['physical_light', 'physical_heavy', 'arrow', 'bullet_energy'].map((id) => defineAsset(id, 'projectile', 192, 96, 8, 14, 'common', Phaser.BlendModes.NORMAL)),
  ...['fire_small', 'fire_heavy', 'water', 'ice', 'lightning', 'wind', 'leaf', 'earth', 'steel', 'poison', 'light', 'dark', 'lava', 'storm', 'special_ancient'].map((id) => defineAsset(id, 'projectile', 192, 128, 8, 14, id === 'special_ancient' ? 'ultimate' : 'common')),
  ...['slash_light', 'slash_heavy', 'slash_cross', 'slash_multi', 'slash_pierce', 'slash_fire', 'slash_ice', 'slash_lightning', 'slash_wind', 'slash_leaf', 'slash_steel', 'slash_dark', 'slash_light', 'slash_ancient'].map((id) => defineAsset(id, 'slash', 256, 192, 6, 16, id === 'slash_ancient' ? 'ultimate' : 'common')),
  ...['impact_physical', 'impact_heavy', 'impact_magic', 'impact_fire', 'impact_water', 'impact_ice', 'impact_lightning', 'impact_wind', 'impact_leaf', 'impact_earth', 'impact_steel', 'impact_poison', 'impact_light', 'impact_dark', 'impact_critical', 'impact_ultimate'].map((id) => defineAsset(id, 'impact', 192, 192, 8, 18, id === 'impact_ultimate' ? 'ultimate' : 'common')),
  ...['circle_neutral', 'circle_fire', 'circle_water', 'circle_ice', 'circle_lightning', 'circle_wind', 'circle_leaf', 'circle_earth', 'circle_steel', 'circle_poison', 'circle_light', 'circle_dark', 'circle_lava', 'circle_storm', 'circle_ancient'].map((id) => defineAsset(id, 'magic-circle', 384, 384, 8, 12, id === 'circle_ancient' ? 'ultimate' : 'common')),
  ...['cast_core_neutral', 'cast_core_elemental'].map((id) => defineAsset(id, 'charge', 192, 192, 6, 15, 'common')),
  ...['status_burn', 'status_poison', 'status_freeze', 'status_stun', 'status_heal', 'status_shield'].map((id) => defineAsset(id, 'status', 128, 128, id === 'status_freeze' ? 16 : 12, 12, 'status')),
  ...['standard', 'high', 'ancient'].flatMap((tier) => ['intro', 'charge', 'release', 'impact', 'finish'].map((phase) => defineAsset(
    `ultimate_${phase}_${tier}`,
    'ultimate',
    tier === 'ancient' ? 640 : tier === 'high' ? 512 : 384,
    tier === 'ancient' ? 640 : tier === 'high' ? 512 : 384,
    tier === 'ancient' ? 12 : tier === 'high' ? 10 : 8,
    14,
    'ultimate'
  ))),
  ...['ultimate_back_common', 'ultimate_back_epic', 'ultimate_back_ancient'].map((id) => defineAsset(id, 'ultimate', 192, 1024, 8, 14, 'ultimate')),
  ...[
    'ultimate_ready_common',
    'ultimate_ready_rare',
    'ultimate_ready_super_rare',
    'ultimate_ready_epic',
    'ultimate_ready_legendary',
    'ultimate_ready_mythic',
    'ultimate_ready_ancient'
  ].map((id) => defineAsset(id, 'ultimate', 1254, 1254, 1, 0, 'ultimate', Phaser.BlendModes.NORMAL, true))
];

const byId = new Map(specs.map((spec) => [spec.id, spec]));

function configuredAssetIds(): Set<string> {
  const configured = (globalThis as any).POWDER_COMBAT2_VFX_ASSET_PACK;
  if (Array.isArray(configured)) return new Set(configured.map(String));
  if (configured && typeof configured === 'object') {
    return new Set(Object.entries(configured).filter(([, enabled]) => enabled === true).map(([id]) => id));
  }
  return new Set();
}

function enabled(spec: CombatVfxAssetSpec): boolean {
  return LIVE_COMBAT_ASSET_IDS.has(spec.id)
    || LIVE_ULTIMATE_READY_CIRCLE_ASSET_IDS.has(spec.id)
    || spec.enabled
    || configuredAssetIds().has(spec.id);
}

export function getCombatVfxAsset(id: string | undefined): CombatVfxAssetSpec | null {
  return id ? byId.get(id) ?? null : null;
}

export function resolveCombatVfxQualityPreset(reducedMotion = false): CombatVfxQualityPreset {
  if (reducedMotion) return 'low';
  const tier = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  if (tier === 'lite' || tier === 'low') return 'low';
  if (tier === 'balanced' || tier === 'medium') return 'medium';
  return 'high';
}

export function combatVfxLayerBudget(quality: CombatVfxQualityPreset): number {
  if (quality === 'low') return 2;
  if (quality === 'medium') return 3;
  return 5;
}

function projectileFor(element: string): string {
  const map: Record<string, string> = {
    fire: 'fire_small', lava: 'lava', water: 'water', ice: 'ice', lightning: 'lightning', storm: 'storm',
    wind: 'wind', leaf: 'leaf', poison: 'poison', earth: 'earth', steel: 'steel', light: 'light', dark: 'dark'
  };
  return map[element] ?? 'bullet_energy';
}

function impactFor(element: string, role: string, tier: string): string {
  if (tier === 'ultimate') return 'impact_ultimate';
  if (role === 'tank' || role === 'fighter' || role === 'knight') return tier === 'skill' ? 'impact_heavy' : 'impact_physical';
  if (role === 'assassin') return 'impact_critical';
  const map: Record<string, string> = {
    fire: 'impact_fire', water: 'impact_water', ice: 'impact_ice', lightning: 'impact_lightning',
    wind: 'impact_wind', leaf: 'impact_leaf', earth: 'impact_earth', steel: 'impact_steel', poison: 'impact_poison',
    light: 'impact_light', dark: 'impact_dark', lava: 'impact_fire', storm: 'impact_lightning'
  };
  return map[element] ?? 'impact_magic';
}

function slashFor(element: string, role: string, traits: readonly string[]): string | undefined {
  if (role !== 'knight' && role !== 'assassin') return undefined;
  if (traits.includes('multi-hit') || role === 'assassin') return element === 'dark' ? 'slash_dark' : 'slash_multi';
  if (element === 'fire') return 'slash_fire';
  if (element === 'ice') return 'slash_ice';
  if (element === 'lightning' || element === 'storm') return 'slash_lightning';
  if (element === 'wind') return 'slash_wind';
  if (element === 'leaf') return 'slash_leaf';
  if (element === 'steel') return 'slash_steel';
  if (element === 'dark') return 'slash_dark';
  if (element === 'light') return 'slash_light';
  return role === 'knight' ? 'slash_heavy' : 'slash_light';
}

export function resolveCombatVfxAction(input: ActionInput): CombatVfxActionResolution {
  const role = roleKey(input.role);
  const element = elementKey(input.element);
  const tier = input.tier ?? 'normal';
  const traits = input.traits ?? [];
  const projectile = role === 'marksman'
    ? (tier === 'ultimate' ? 'bullet_energy' : 'arrow')
    : ['mage', 'enchanter', 'healer', 'musician', 'fallback'].includes(role)
      ? projectileFor(element)
      : undefined;
  const cadence = tier === 'ultimate' ? 115 : tier === 'skill' ? 95 : 82;
  return Object.freeze({
    projectile,
    slash: slashFor(element, role, traits),
    impact: impactFor(element, role, tier),
    magicCircle: tier === 'ultimate' && traits.includes('ancient') ? 'circle_ancient' : `circle_${element}`,
    cast: ['tank', 'fighter', 'knight', 'assassin'].includes(role) ? 'cast_core_neutral' : 'cast_core_elemental',
    trail: projectile === 'arrow' ? 'physical_light' : undefined,
    scale: tier === 'ultimate' ? 1.28 : tier === 'skill' ? 1.08 : 0.9,
    multiHitCadenceMs: cadence
  });
}

/** Presentation-only hit spacing. It never changes resolver hit count or damage. */
export function resolveCombatVfxHitSequence(input: ActionInput): CombatVfxHitSequence {
  const role = roleKey(input.role);
  const requestedHits = Math.floor(Number(input.visualHitCount) || 0);
  const hitCount = requestedHits > 0
    ? Math.min(4, Math.max(1, requestedHits))
    : role === 'assassin' || input.traits?.includes('multi-hit') ? 2 : 1;
  const defaultCadence = resolveCombatVfxAction(input).multiHitCadenceMs;
  const requestedCadence = Number(input.multiHitCadenceMs);
  return Object.freeze({
    hitCount,
    cadenceMs: Math.min(180, Math.max(45, Number.isFinite(requestedCadence) ? requestedCadence : defaultCadence))
  });
}

export function resolveCombatVfxUltimate(tier: 'standard' | 'high' | 'ancient' = 'standard'): CombatVfxUltimateResolution {
  return Object.freeze({
    intro: `ultimate_intro_${tier}`,
    charge: `ultimate_charge_${tier}`,
    release: `ultimate_release_${tier}`,
    impact: `ultimate_impact_${tier}`,
    finish: `ultimate_finish_${tier}`
  });
}

function queueSetFor(scene: Phaser.Scene): Set<string> {
  let set = queuedTextureKeys.get(scene);
  if (!set) {
    set = new Set<string>();
    queuedTextureKeys.set(scene, set);
    const clear = (): void => { queuedTextureKeys.delete(scene); };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, clear);
    scene.events.once(Phaser.Scenes.Events.DESTROY, clear);
  }
  return set;
}

function queueAsset(scene: Phaser.Scene, spec: CombatVfxAssetSpec, startLoader: boolean): boolean {
  if (scene.textures.exists(spec.textureKey)) return true;
  if (!enabled(spec)) return false;
  const queued = queueSetFor(scene);
  if (queued.has(spec.textureKey)) return false;
  queued.add(spec.textureKey);
  try {
    if (spec.staticImage) {
      scene.load.image(spec.textureKey, spec.url);
    } else {
      scene.load.spritesheet(spec.textureKey, spec.url, {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
        endFrame: spec.frames - 1
      });
    }
    if (startLoader && !(scene.load as any).isLoading?.()) scene.load.start();
  } catch {
    warnCombatVfxDev(`queue:${spec.id}`, `Could not queue optional asset '${spec.id}'; procedural fallback remains active.`);
  }
  return false;
}

/** Queues only enabled common groups during BattleScene preload. */
export function preloadCombatVfxAssets(scene: Phaser.Scene, group: CombatVfxAssetGroup | 'all' = 'common'): void {
  for (const spec of specs) {
    if (group !== 'all' && spec.group !== group) continue;
    queueAsset(scene, spec, false);
  }
}

/** Returns true only when a mapped texture is safe to instantiate this frame. */
export function ensureCombatVfxTexture(scene: Phaser.Scene, assetId: string | undefined, context: string): CombatVfxAssetSpec | null {
  const spec = getCombatVfxAsset(assetId);
  if (!spec) return null;
  if (scene.textures.exists(spec.textureKey)) return spec;
  queueAsset(scene, spec, true);
  if (enabled(spec)) {
    warnCombatVfxDev(`missing:${spec.id}`, `Optional asset '${spec.id}' is not ready for ${context}; procedural fallback is being used.`);
  }
  return null;
}

export function combatVfxAssetState(): Readonly<{ version: string; declared: number; enabled: string[]; loadedContract: string }> {
  return Object.freeze({
    version: COMBAT_VFX_REGISTRY_VERSION,
    declared: specs.length,
    enabled: specs.filter(enabled).map((spec) => spec.id),
    loadedContract: 'revisioned texture and animation keys preload once per scene; unavailable textures keep procedural fallback'
  });
}

export function runCombatVfxRegistryRegression(): CombatVfxRegistryRegression {
  const marksman = resolveCombatVfxAction({ role: 'Xạ thủ', element: 'lightning', tier: 'normal' });
  const knight = resolveCombatVfxAction({ role: 'Hiệp sĩ', element: 'water', tier: 'skill' });
  const assassin = resolveCombatVfxAction({ role: 'Sát thủ', element: 'dark', tier: 'ultimate', traits: ['multi-hit'] });
  const assassinSequence = resolveCombatVfxHitSequence({
    role: 'Sát thủ', element: 'dark', tier: 'ultimate', traits: ['multi-hit'], visualHitCount: 4, multiHitCadenceMs: 115
  });
  const checks: RegistryRegressionCheck[] = [
    { name: 'declared-asset-families', pass: ['projectile', 'slash', 'impact', 'magic-circle', 'charge', 'ultimate', 'status'].every((category) => specs.some((spec) => spec.category === category)), detail: `assets=${specs.length}` },
    { name: 'marksman-projectile-map', pass: marksman.projectile === 'arrow' && marksman.impact === 'impact_lightning', detail: `${marksman.projectile}/${marksman.impact}` },
    { name: 'melee-slash-map', pass: knight.projectile === undefined && knight.slash === 'slash_heavy' && knight.impact === 'impact_heavy', detail: `${knight.slash}/${knight.impact}` },
    { name: 'multi-hit-map', pass: assassin.slash === 'slash_dark' && assassin.impact === 'impact_ultimate' && assassin.multiHitCadenceMs > 0 && assassinSequence.hitCount === 4 && assassinSequence.cadenceMs === 115, detail: `${assassin.slash}/${assassin.impact}/${assassinSequence.hitCount}x${assassinSequence.cadenceMs}` },
    { name: 'missing-assets-fallback', pass: specs.every((spec) => spec.enabled === false), detail: 'new art is opt-in; no absent files are preloaded' },
    { name: 'quality-layer-budget', pass: combatVfxLayerBudget('low') === 2 && combatVfxLayerBudget('medium') === 3 && combatVfxLayerBudget('high') === 5, detail: '2/3/5' }
  ];
  return { version: COMBAT_VFX_REGISTRY_VERSION, pass: checks.every((check) => check.pass), checks };
}
