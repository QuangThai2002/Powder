import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2153ProjectileClarityInstalled';
const BALANCED_BURST_THRESHOLD = 2;
const PROJECTILE_DURATION_SCALE = 2.25;
const HEALER_SCALE_VS_MAGE = 0.8;

type FxTier = 'full' | 'balanced' | 'lite';
type RangedRole = 'marksman' | 'mage' | 'enchanter' | 'healer' | 'musician';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

type ElementProfile = {
  color: number;
  core: number;
  accent: number;
  trail: string;
};

const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff7043, core: 0xfff4c7, accent: 0xffa34f, trail: 'crisp-flame-wake' },
  lava: { color: 0xff4f2e, core: 0xffe09a, accent: 0xff8d36, trail: 'crisp-molten-wake' },
  water: { color: 0x4db9ff, core: 0xe7f9ff, accent: 0x7fd7ff, trail: 'crisp-water-wake' },
  ice: { color: 0x8adfff, core: 0xffffff, accent: 0xb9f2ff, trail: 'crisp-ice-shard-wake' },
  lightning: { color: 0xf5dd62, core: 0xffffff, accent: 0xffef8a, trail: 'crisp-electric-wake' },
  storm: { color: 0x78a9ff, core: 0xf0f4ff, accent: 0x9cc2ff, trail: 'crisp-storm-arc-wake' },
  wind: { color: 0x76e4d2, core: 0xf3fffc, accent: 0xa0f0e4, trail: 'crisp-wind-cut-wake' },
  leaf: { color: 0x72d67f, core: 0xf1ffe9, accent: 0xa5ec91, trail: 'crisp-leaf-wake' },
  poison: { color: 0xa5df66, core: 0xf0ffc8, accent: 0xc9ef78, trail: 'crisp-toxic-wake' },
  earth: { color: 0xb78c5d, core: 0xffe4bd, accent: 0xd6ad77, trail: 'crisp-earth-shard-wake' },
  steel: { color: 0xc3d3dc, core: 0xffffff, accent: 0xe0ebf0, trail: 'crisp-steel-razor-wake' },
  light: { color: 0xffefad, core: 0xffffff, accent: 0xfff6cc, trail: 'crisp-radiant-wake' },
  dark: { color: 0xa88cf2, core: 0xf1eaff, accent: 0xc0a7ff, trail: 'crisp-shadow-wake' },
  neutral: { color: 0x9ed8e8, core: 0xffffff, accent: 0xc7eef5, trail: 'crisp-energy-wake' }
});

let activeShots = 0;

function normalize(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveRangedRole(rawRole: string | undefined): RangedRole | null {
  const role = normalize(rawRole);
  if (role.includes('xa thu') || role.includes('marksman') || role.includes('archer')) return 'marksman';
  if (role.includes('phap su') || role.includes('mage')) return 'mage';
  if (role.includes('thuat su') || role.includes('thuat si') || role.includes('enchanter')) return 'enchanter';
  if (role.includes('tri lieu') || role.includes('healer')) return 'healer';
  if (role.includes('nhac cong') || role.includes('musician')) return 'musician';
  return null;
}

function fxTier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function readableDuration(
  options: DirectionalProjectileOptions,
  current: FxTier,
  burstReducedMotion: boolean
): number {
  const requested = Number(options.durationMs || 0);
  const distance = Math.max(1, Phaser.Math.Distance.Between(
    options.source.x,
    options.source.y,
    options.target.x,
    options.target.y
  ));

  let baseDuration: number;
  if (current === 'lite') {
    baseDuration = Phaser.Math.Clamp(requested > 0 ? requested : 195, 175, 215);
  } else if (current === 'balanced') {
    const natural = burstReducedMotion ? 215 : Math.round(225 + Math.min(35, distance * 0.035));
    baseDuration = Phaser.Math.Clamp(
      requested > 0 ? requested : natural,
      burstReducedMotion ? 195 : 215,
      burstReducedMotion ? 235 : 275
    );
  } else {
    const natural = Math.round(240 + Math.min(55, distance * 0.05));
    baseDuration = Phaser.Math.Clamp(requested > 0 ? requested : natural, 230, 310);
  }

  return Math.round(baseDuration * PROJECTILE_DURATION_SCALE);
}

function baseRadius(reducedDetail: boolean): number {
  return reducedDetail ? 36 : 48;
}

function tweenObject(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  config: CombatTweenConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let tween: Phaser.Tweens.Tween | null = null;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      if (settled) return;
      try { tween?.stop(); } catch { /* scene teardown owns tween cleanup */ }
      finish();
    };

    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);

    try {
      tween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch {
      finish();
    }
  });
}

function addWakeSegments(
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Container,
  element: CombatProjectileElement,
  radius: number,
  reducedDetail: boolean,
  strength = 1
): Phaser.GameObjects.Container | null {
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const wake = scene.add.container(0, 0);
  const length = Math.min(190, radius * (reducedDetail ? 2.55 : 3.5) * strength);
  const outerThickness = Math.max(8, radius * 0.34);
  const midThickness = Math.max(5, radius * 0.19);
  const coreThickness = Math.max(2.5, radius * 0.075);

  // Three hard-edged layers: faint outer pressure, colored middle wake, sharp white core.
  const outer = scene.add.triangle(
    -length * 0.43,
    0,
    -length * 0.56,
    -outerThickness * 0.5,
    length * 0.44,
    0,
    -length * 0.56,
    outerThickness * 0.5,
    profile.color,
    reducedDetail ? 0.08 : 0.13
  );
  const middle = scene.add.triangle(
    -length * 0.3,
    0,
    -length * 0.46,
    -midThickness * 0.5,
    length * 0.46,
    0,
    -length * 0.46,
    midThickness * 0.5,
    profile.color,
    reducedDetail ? 0.24 : 0.38
  );
  const core = scene.add.rectangle(
    -length * 0.18,
    0,
    length * 0.62,
    coreThickness,
    profile.core,
    reducedDetail ? 0.52 : 0.78
  );
  const coreTip = scene.add.triangle(
    -length * 0.5,
    0,
    -radius * 0.24,
    -coreThickness * 0.9,
    radius * 0.18,
    0,
    -radius * 0.24,
    coreThickness * 0.9,
    profile.core,
    reducedDetail ? 0.38 : 0.58
  );
  outer.setBlendMode(Phaser.BlendModes.ADD);
  middle.setBlendMode(Phaser.BlendModes.ADD);
  core.setBlendMode(Phaser.BlendModes.ADD);
  wake.add([outer, middle, core, coreTip]);

  // Broken wake cuts make motion read clearly without drawing a full source->target beam.
  wake.add([
    scene.add.rectangle(-length * 0.62, -radius * 0.19, length * 0.2, Math.max(2, radius * 0.045), profile.accent, reducedDetail ? 0.24 : 0.46).setRotation(-0.08),
    scene.add.rectangle(-length * 0.8, radius * 0.16, length * 0.13, Math.max(2, radius * 0.04), profile.core, reducedDetail ? 0.18 : 0.38).setRotation(0.08),
    scene.add.rectangle(-length * 0.93, -radius * 0.04, length * 0.08, Math.max(2, radius * 0.035), profile.color, reducedDetail ? 0.14 : 0.3)
  ]);

  const alpha = reducedDetail ? 0.42 : 0.7;
  switch (element) {
    case 'fire':
    case 'lava':
      wake.add([
        scene.add.triangle(-length * 0.72, -radius * 0.22, -radius * 0.36, -radius * 0.28, radius * 0.28, 0, -radius * 0.36, radius * 0.28, profile.accent, alpha),
        scene.add.triangle(-length * 0.52, radius * 0.24, -radius * 0.3, -radius * 0.22, radius * 0.22, 0, -radius * 0.3, radius * 0.22, profile.color, alpha * 0.78)
      ]);
      break;
    case 'water':
      wake.add([
        scene.add.arc(-length * 0.62, 0, radius * 0.42, 205, 335, false, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, profile.accent, alpha),
        scene.add.circle(-length * 0.78, radius * 0.18, Math.max(3, radius * 0.08), profile.core, alpha * 0.7)
      ]);
      break;
    case 'ice':
      wake.add([
        scene.add.triangle(-length * 0.68, -radius * 0.2, -radius * 0.25, -radius * 0.15, radius * 0.18, 0, -radius * 0.25, radius * 0.15, profile.core, alpha).setRotation(-0.22),
        scene.add.triangle(-length * 0.48, radius * 0.22, -radius * 0.22, -radius * 0.14, radius * 0.16, 0, -radius * 0.22, radius * 0.14, profile.color, alpha * 0.82).setRotation(0.28)
      ]);
      break;
    case 'lightning':
    case 'storm': {
      const bolt = scene.add.graphics();
      bolt.lineStyle(reducedDetail ? 2 : 4, profile.core, alpha);
      bolt.beginPath();
      bolt.moveTo(-length * 0.86, 0);
      bolt.lineTo(-length * 0.69, -radius * 0.23);
      bolt.lineTo(-length * 0.54, radius * 0.16);
      bolt.lineTo(-length * 0.36, -radius * 0.13);
      bolt.lineTo(-length * 0.16, radius * 0.08);
      bolt.lineTo(-radius * 0.08, 0);
      bolt.strokePath();
      wake.add(bolt);
      if (element === 'storm') {
        wake.add(scene.add.arc(-length * 0.5, 0, radius * 0.55, 205, 335, false, 0x000000, 0)
          .setStrokeStyle(reducedDetail ? 2 : 3, profile.color, alpha * 0.72));
      }
      break;
    }
    case 'wind':
      wake.add([
        scene.add.arc(-length * 0.66, 0, radius * 0.58, 205, 335, false, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, profile.color, alpha),
        scene.add.arc(-length * 0.43, 0, radius * 0.4, 205, 335, false, 0x000000, 0).setStrokeStyle(2, profile.core, alpha * 0.7)
      ]);
      break;
    case 'leaf':
      wake.add([
        scene.add.ellipse(-length * 0.65, -radius * 0.17, radius * 0.38, radius * 0.16, profile.color, alpha).setRotation(-0.48),
        scene.add.ellipse(-length * 0.43, radius * 0.18, radius * 0.32, radius * 0.14, profile.core, alpha * 0.72).setRotation(0.48)
      ]);
      break;
    case 'poison':
      wake.add([
        scene.add.circle(-length * 0.68, -radius * 0.14, radius * 0.13, profile.color, alpha * 0.48),
        scene.add.circle(-length * 0.5, radius * 0.16, radius * 0.1, profile.core, alpha * 0.44),
        scene.add.circle(-length * 0.36, -radius * 0.06, radius * 0.16, profile.accent, alpha * 0.36)
      ]);
      break;
    case 'earth':
      wake.add([
        scene.add.rectangle(-length * 0.68, -radius * 0.16, radius * 0.28, radius * 0.17, profile.color, alpha).setRotation(-0.42),
        scene.add.rectangle(-length * 0.48, radius * 0.2, radius * 0.23, radius * 0.15, profile.core, alpha * 0.72).setRotation(0.34)
      ]);
      break;
    case 'steel':
      wake.add([
        scene.add.rectangle(-length * 0.68, -radius * 0.15, radius * 0.62, Math.max(2, radius * 0.045), profile.core, alpha).setRotation(-0.1),
        scene.add.rectangle(-length * 0.46, radius * 0.16, radius * 0.5, Math.max(2, radius * 0.04), profile.color, alpha * 0.82).setRotation(0.1)
      ]);
      break;
    case 'light':
      wake.add([
        scene.add.rectangle(-length * 0.62, -radius * 0.15, radius * 0.74, Math.max(2, radius * 0.045), profile.core, alpha),
        scene.add.rectangle(-length * 0.48, radius * 0.15, radius * 0.6, Math.max(2, radius * 0.04), profile.accent, alpha * 0.72)
      ]);
      break;
    case 'dark':
      wake.add([
        scene.add.arc(-length * 0.62, -radius * 0.04, radius * 0.52, 200, 340, false, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, profile.color, alpha * 0.62),
        scene.add.circle(-length * 0.42, radius * 0.12, radius * 0.1, profile.core, alpha * 0.48)
      ]);
      break;
    default:
      break;
  }

  const spin = scene.add.container(-radius * 0.05, 0);
  spin.add([
    scene.add.circle(0, -radius * 0.62, Math.max(3, radius * 0.06), profile.core, reducedDetail ? 0.34 : 0.58),
    scene.add.circle(0, radius * 0.62, Math.max(3, radius * 0.06), profile.accent, reducedDetail ? 0.3 : 0.52)
  ]);
  wake.add(spin);
  projectile.add(wake);
  return spin;
}

function addElementImpactAccent(
  scene: Phaser.Scene,
  impact: Phaser.GameObjects.Container,
  element: CombatProjectileElement,
  radius: number,
  reducedDetail: boolean
): void {
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const alpha = reducedDetail ? 0.45 : 0.7;

  if (element === 'lightning' || element === 'storm') {
    const g = scene.add.graphics();
    g.lineStyle(reducedDetail ? 2 : 4, profile.core, alpha);
    g.lineBetween(-radius * 0.88, radius * 0.18, -radius * 0.18, -radius * 0.42);
    g.lineBetween(-radius * 0.18, -radius * 0.42, radius * 0.16, radius * 0.14);
    g.lineBetween(radius * 0.16, radius * 0.14, radius * 0.86, -radius * 0.2);
    impact.add(g);
    return;
  }
  if (element === 'wind' || element === 'water') {
    impact.add([
      scene.add.arc(0, 0, radius * 0.78, 198, 342, false, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, profile.color, alpha),
      scene.add.arc(0, 0, radius * 0.5, 20, 160, false, 0x000000, 0).setStrokeStyle(2, profile.core, alpha * 0.7)
    ]);
    return;
  }
  if (element === 'ice' || element === 'earth' || element === 'steel') {
    impact.add([
      scene.add.triangle(-radius * 0.42, -radius * 0.12, -radius * 0.18, -radius * 0.36, radius * 0.22, 0, -radius * 0.18, radius * 0.36, profile.color, alpha).setRotation(-0.34),
      scene.add.triangle(radius * 0.42, radius * 0.1, -radius * 0.15, -radius * 0.25, radius * 0.18, 0, -radius * 0.15, radius * 0.25, profile.core, alpha * 0.72).setRotation(0.4)
    ]);
    return;
  }
  if (element === 'leaf') {
    impact.add([
      scene.add.ellipse(-radius * 0.4, 0, radius * 0.4, radius * 0.16, profile.color, alpha).setRotation(-0.55),
      scene.add.ellipse(radius * 0.4, 0, radius * 0.4, radius * 0.16, profile.core, alpha * 0.72).setRotation(0.55)
    ]);
    return;
  }
  if (element === 'poison') {
    impact.add([
      scene.add.circle(-radius * 0.3, -radius * 0.2, radius * 0.14, profile.color, alpha * 0.52),
      scene.add.circle(radius * 0.32, radius * 0.16, radius * 0.1, profile.core, alpha * 0.46)
    ]);
    return;
  }
  if (element === 'fire' || element === 'lava' || element === 'light') {
    impact.add([
      scene.add.triangle(0, -radius * 0.7, -radius * 0.2, -radius * 0.34, radius * 0.2, -radius * 0.34, 0, radius * 0.06, profile.core, alpha),
      scene.add.triangle(0, radius * 0.7, -radius * 0.18, radius * 0.34, radius * 0.18, radius * 0.34, 0, -radius * 0.06, profile.color, alpha * 0.72)
    ]);
    return;
  }
  if (element === 'dark') {
    impact.add([
      scene.add.arc(0, 0, radius * 0.72, 190, 350, false, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, profile.color, alpha * 0.68),
      scene.add.arc(0, 0, radius * 0.46, 15, 165, false, 0x000000, 0).setStrokeStyle(2, profile.core, alpha * 0.48)
    ]);
  }
}

async function animateImpact(
  options: DirectionalProjectileOptions,
  role: RangedRole,
  reducedDetail: boolean,
  scale = 1
): Promise<void> {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const radius = (reducedDetail ? 22 : 30) * scale;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const impact = scene.add.container(target.x, target.y)
    .setDepth(powVfxDepth('foreground') + 3)
    .setScale(0.72);

  // Compression core.
  const compression = scene.add.circle(0, 0, radius * 0.44, profile.core, role === 'healer' ? 0.5 : 0.88);
  compression.setBlendMode(Phaser.BlendModes.ADD);
  impact.add(compression);

  if (role === 'marksman') {
    const pierce = scene.add.container(0, 0).setRotation(angle);
    pierce.add([
      scene.add.rectangle(0, 0, radius * 2.8, Math.max(4, radius * 0.14), profile.color, 0.48),
      scene.add.rectangle(radius * 0.12, 0, radius * 2.15, Math.max(2.5, radius * 0.055), profile.core, 0.98),
      scene.add.triangle(radius * 1.38, 0, -radius * 0.24, -radius * 0.18, radius * 0.32, 0, -radius * 0.24, radius * 0.18, profile.core, 0.94)
    ]);
    impact.add(pierce);
  } else if (role === 'musician') {
    impact.add([
      scene.add.circle(0, 0, radius * 0.78, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, profile.color, 0.84),
      scene.add.circle(0, 0, radius * 1.08, 0x000000, 0).setStrokeStyle(2, profile.core, 0.5)
    ]);
  } else {
    const healer = role === 'healer';
    impact.add([
      scene.add.circle(0, 0, radius * 0.78, 0x000000, 0).setStrokeStyle(healer ? 2 : 3, profile.color, healer ? 0.52 : 0.86),
      scene.add.circle(0, 0, radius * 1.08, 0x000000, 0).setStrokeStyle(2, profile.core, healer ? 0.3 : 0.5)
    ]);
    if (role === 'enchanter') {
      impact.add(scene.add.rectangle(0, 0, radius * 1.18, radius * 1.18, 0x000000, 0)
        .setStrokeStyle(2, profile.core, 0.56)
        .setRotation(Math.PI / 4));
    }
  }

  addElementImpactAccent(scene, impact, element, radius, reducedDetail);

  try {
    // Phase 1: compress at the contact point.
    await tweenObject(scene, impact, {
      scaleX: 0.56,
      scaleY: 0.56,
      alpha: 1,
      duration: reducedDetail ? 42 : 56,
      ease: 'Quad.easeIn'
    }, 150);

    // Phase 2+3: piercing release and burst, finite only.
    await tweenObject(scene, impact, {
      scaleX: reducedDetail ? 1.18 : 1.46,
      scaleY: reducedDetail ? 1.18 : 1.46,
      alpha: 0,
      duration: reducedDetail ? 130 : 175,
      ease: 'Cubic.easeOut'
    }, reducedDetail ? 300 : 360);
  } finally {
    impact.destroy(true);
  }
}

async function fly(
  options: DirectionalProjectileOptions,
  projectile: Phaser.GameObjects.Container,
  durationMs: number,
  spinObjects: readonly Phaser.GameObjects.Container[] = []
): Promise<void> {
  const spinTweens = spinObjects.map((spin, index) => tweenObject(options.scene, spin, {
    angle: (index % 2 === 0 ? 1 : -1) * (index === 0 ? 360 : 260),
    duration: durationMs,
    ease: 'Linear'
  }, durationMs + 180));

  // One finite scale pass makes the shot feel pressurized without introducing a pulse loop.
  const pressure = tweenObject(options.scene, projectile, {
    scaleX: 1.035,
    scaleY: 0.985,
    duration: Math.max(120, Math.round(durationMs * 0.52)),
    yoyo: true,
    ease: 'Sine.easeInOut'
  }, durationMs + 220);

  try {
    await Promise.all([
      tweenObject(options.scene, projectile, {
        x: options.target.x,
        y: options.target.y,
        duration: durationMs,
        ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut'
      }, durationMs + 320),
      pressure,
      ...spinTweens
    ]);
  } finally {
    projectile.destroy(true);
  }
}

function makeMagicArrow(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean
): { projectile: Phaser.GameObjects.Container; spin: Phaser.GameObjects.Container[] } {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const radius = baseRadius(reducedDetail);
  const length = radius * (reducedDetail ? 2.85 : 3.2);
  const shaft = Math.max(6, radius * 0.145);
  const head = radius * 0.9;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  const trailSpin = addWakeSegments(scene, projectile, element, radius, reducedDetail, 1.14);

  const aura = scene.add.ellipse(-length * 0.08, 0, length * 0.92, radius * 0.28, profile.color, reducedDetail ? 0.06 : 0.1);
  aura.setBlendMode(Phaser.BlendModes.ADD);
  const outerSpine = scene.add.rectangle(-length * 0.04, 0, length * 0.72, shaft * 1.7, profile.color, 0.68);
  const innerSpine = scene.add.rectangle(length * 0.01, 0, length * 0.67, Math.max(3, shaft * 0.4), profile.core, 0.98);
  const edgeTop = scene.add.rectangle(-length * 0.02, -shaft * 0.68, length * 0.56, Math.max(2, shaft * 0.16), profile.accent, reducedDetail ? 0.42 : 0.72);
  const edgeBottom = scene.add.rectangle(-length * 0.02, shaft * 0.68, length * 0.56, Math.max(2, shaft * 0.16), profile.accent, reducedDetail ? 0.38 : 0.66);

  projectile.add([
    aura,
    outerSpine,
    innerSpine,
    edgeTop,
    edgeBottom,
    scene.add.triangle(
      length * 0.43,
      0,
      -head * 0.58,
      -head * 0.48,
      -head * 0.58,
      head * 0.48,
      head * 0.72,
      0,
      profile.color,
      0.98
    ),
    scene.add.triangle(
      length * 0.47,
      0,
      -head * 0.28,
      -head * 0.22,
      -head * 0.28,
      head * 0.22,
      head * 0.42,
      0,
      profile.core,
      1
    )
  ]);

  // Narrow corkscrew rings: sharper than the broad 2.15.2 rings and still no physical feathers.
  const helix = scene.add.container(0, 0);
  [-0.28, -0.08, 0.12, 0.28].forEach((ratio, index) => {
    helix.add(scene.add.ellipse(
      length * ratio,
      0,
      radius * (index % 2 === 0 ? 0.34 : 0.28),
      radius * (index % 2 === 0 ? 0.82 : 0.66),
      0x000000,
      0
    ).setStrokeStyle(reducedDetail ? 1.5 : 2.5, index % 2 === 0 ? profile.core : profile.accent, reducedDetail ? 0.44 : 0.76)
      .setRotation(index % 2 === 0 ? 0.24 : -0.24));
  });
  projectile.add(helix);

  const tipSpin = scene.add.container(length * 0.2, 0);
  tipSpin.add([
    scene.add.circle(0, -radius * 0.58, Math.max(3, radius * 0.065), profile.core, reducedDetail ? 0.48 : 0.82),
    scene.add.circle(0, radius * 0.58, Math.max(3, radius * 0.065), profile.accent, reducedDetail ? 0.44 : 0.76),
    scene.add.circle(-radius * 0.48, 0, Math.max(2.5, radius * 0.055), profile.core, reducedDetail ? 0.34 : 0.58)
  ]);
  projectile.add(tipSpin);

  return { projectile, spin: [tipSpin, helix, ...(trailSpin ? [trailSpin] : [])] };
}

function makeEnergyOrb(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean,
  role: 'mage' | 'enchanter' | 'healer'
): { projectile: Phaser.GameObjects.Container; spin: Phaser.GameObjects.Container[]; scale: number } {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const healer = role === 'healer';
  const scale = healer ? HEALER_SCALE_VS_MAGE : 1;
  const radius = baseRadius(reducedDetail) * scale;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  const trailSpin = addWakeSegments(scene, projectile, element, radius, reducedDetail, healer ? 0.82 : 1);
  const aura = scene.add.circle(0, 0, radius * 1.04, profile.color, healer ? 0.045 : reducedDetail ? 0.055 : 0.09);
  aura.setBlendMode(Phaser.BlendModes.ADD);
  const outer = scene.add.circle(0, 0, radius * 0.82, profile.color, healer ? 0.12 : 0.2)
    .setStrokeStyle(reducedDetail ? 2 : 3, profile.accent, healer ? 0.32 : 0.58);
  const middle = scene.add.circle(0, 0, radius * 0.57, profile.color, healer ? 0.64 : 0.9);
  const core = scene.add.circle(radius * 0.07, -radius * 0.05, radius * 0.22, profile.core, healer ? 0.7 : 0.98);
  core.setBlendMode(Phaser.BlendModes.ADD);
  projectile.add([aura, outer, middle, core]);

  const ringA = scene.add.ellipse(0, 0, radius * 1.72, radius * 0.56, 0x000000, 0)
    .setStrokeStyle(reducedDetail ? 1.5 : 2.5, profile.core, healer ? 0.22 : 0.54)
    .setRotation(0.28);
  const ringB = scene.add.ellipse(0, 0, radius * 1.52, radius * 0.46, 0x000000, 0)
    .setStrokeStyle(reducedDetail ? 1 : 2, profile.accent, healer ? 0.18 : 0.44)
    .setRotation(-0.42);
  projectile.add([ringA, ringB]);

  if (role === 'enchanter') {
    projectile.add([
      scene.add.rectangle(0, 0, radius * 1.18, radius * 1.18, 0x000000, 0).setStrokeStyle(reducedDetail ? 1 : 2, profile.core, 0.62).setRotation(Math.PI / 4),
      scene.add.rectangle(0, 0, radius * 0.82, radius * 0.82, 0x000000, 0).setStrokeStyle(1, profile.accent, 0.48).setRotation(Math.PI / 4)
    ]);
  }

  const orbit = scene.add.container(0, 0);
  orbit.add([
    scene.add.circle(radius * 0.78, 0, Math.max(3, radius * 0.06), profile.core, healer ? 0.32 : 0.66),
    scene.add.circle(-radius * 0.78, 0, Math.max(3, radius * 0.06), profile.accent, healer ? 0.28 : 0.56)
  ]);
  projectile.add(orbit);

  return { projectile, spin: [orbit, ...(trailSpin ? [trailSpin] : [])], scale };
}

function makeMusicNote(
  options: DirectionalProjectileOptions,
  reducedDetail: boolean
): { projectile: Phaser.GameObjects.Container; spin: Phaser.GameObjects.Container[] } {
  const { scene, source, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const radius = baseRadius(reducedDetail) * (reducedDetail ? 0.9 : 0.98);
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);
  const trailSpin = addWakeSegments(scene, projectile, element, radius, reducedDetail, 0.9);

  const note = scene.add.container(0, 0).setRotation(-angle - 0.08);
  const noteGlow = scene.add.circle(0, 0, radius * 0.88, profile.color, reducedDetail ? 0.03 : 0.055);
  noteGlow.setBlendMode(Phaser.BlendModes.ADD);
  note.add([
    noteGlow,
    scene.add.ellipse(-radius * 0.18, radius * 0.28, radius * 0.76, radius * 0.46, profile.color, 0.98).setRotation(-0.28),
    scene.add.ellipse(-radius * 0.12, radius * 0.24, radius * 0.26, radius * 0.14, profile.core, 0.9).setRotation(-0.28),
    scene.add.rectangle(radius * 0.17, -radius * 0.18, Math.max(5, radius * 0.1), radius * 1.12, profile.color, 0.98),
    scene.add.rectangle(radius * 0.17, -radius * 0.18, Math.max(2, radius * 0.035), radius * 1.02, profile.core, 0.72),
    scene.add.triangle(radius * 0.5, -radius * 0.58, -radius * 0.3, -radius * 0.18, radius * 0.3, 0, -radius * 0.3, radius * 0.18, profile.accent, 0.96),
    scene.add.ellipse(-radius * 0.72, -radius * 0.14, radius * 0.24, radius * 0.12, profile.color, reducedDetail ? 0.3 : 0.5),
    scene.add.ellipse(-radius * 0.94, radius * 0.12, radius * 0.16, radius * 0.09, profile.core, reducedDetail ? 0.24 : 0.42)
  ]);
  projectile.add(note);

  return { projectile, spin: trailSpin ? [trailSpin] : [] };
}

async function playRoleProjectile(
  options: RoleAwareOptions,
  role: RangedRole,
  durationMs: number,
  reducedDetail: boolean
): Promise<void> {
  if (role === 'marksman') {
    const built = makeMagicArrow(options, reducedDetail);
    await fly(options, built.projectile, durationMs, built.spin);
    await animateImpact(options, role, reducedDetail, 1);
    return;
  }

  if (role === 'musician') {
    const built = makeMusicNote(options, reducedDetail);
    await fly(options, built.projectile, durationMs, built.spin);
    await animateImpact(options, role, reducedDetail, 0.92);
    return;
  }

  const built = makeEnergyOrb(options, reducedDetail, role);
  await fly(options, built.projectile, durationMs, built.spin);
  await animateImpact(options, role, reducedDetail, built.scale);
}

export function installCombat2153ProjectileClarityVfxPatch(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const owner = DirectionalElementProjectileVfx as any;
  if (typeof owner.play !== 'function') return;
  const previousPlay = owner.play.bind(owner) as (options: DirectionalProjectileOptions) => Promise<void>;

  owner.play = async (rawOptions: DirectionalProjectileOptions): Promise<void> => {
    const options = rawOptions as RoleAwareOptions;
    const role = resolveRangedRole(options.role);
    if (!role) {
      await previousPlay(rawOptions);
      return;
    }

    const current = fxTier();
    const concurrency = activeShots + 1;
    const burstReducedMotion = current === 'balanced' && concurrency >= BALANCED_BURST_THRESHOLD;
    const reducedDetail = Boolean(options.reducedMotion) || current === 'lite' || burstReducedMotion;
    const durationMs = readableDuration(options, current, burstReducedMotion);

    activeShots += 1;
    try {
      await playRoleProjectile(options, role, durationMs, reducedDetail);
    } finally {
      activeShots = Math.max(0, activeShots - 1);
    }
  };

  const trailStyles = Object.fromEntries(Object.entries(ELEMENT).map(([key, profile]) => [key, profile.trail]));

  root.POWDER_COMBAT2_PROJECTILE_CLARITY_VFX = {
    version: '2.15.3',
    family: 'Combat2',
    owner: 'final-ranged-projectile-clarity-owner',
    sharpCore: true,
    hardEdgeWake: true,
    threeLayerWake: true,
    brokenWakeCuts: 3,
    glowIsSecondary: true,
    pressureTweenFinite: true,
    impactPhases: ['compress', 'pierce', 'burst'],
    elementTrailStyles: trailStyles,
    distinctElementTrail: true,
    magicArrow: {
      physicalFeathers: false,
      narrowCorkscrew: true,
      sharpEnergySpine: true,
      luminousEdgeLines: true,
      rotatingTipEnergy: true
    },
    healerScaleVsMage: HEALER_SCALE_VS_MAGE,
    travelDurationScaleVsCombat2Baseline: PROJECTILE_DURATION_SCALE,
    travelSpeedPreservedFrom2152: true,
    singleProjectileContainerPerRangedAction: true,
    noFullPathBeam: true,
    noDuplicateGuideProjectile: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    finiteTweensOnly: true,
    delegatesNonRangedToPreviousOwner: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_PROJECTILE_TRAIL_VFX = {
    ...(root.POWDER_COMBAT2_PROJECTILE_TRAIL_VFX || {}),
    version: '2.15.3',
    family: 'Combat2',
    owner: 'Combat2153ProjectileClarityVfxPatch',
    attachedTrail: true,
    shortWakeOnly: true,
    trailStyles,
    distinctElementTrail: true,
    distinctElementImpactAccent: true,
    singleProjectileContainerPerRangedAction: true,
    noFullPathBeam: true,
    noPhysicalArrowFletching: true,
    noDuplicateGuideProjectile: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_RANGED_ROLE_VFX = {
    version: '2.15.3',
    family: 'Combat2',
    roles: {
      marksman: 'sharp-spiral-magic-arrow+three-layer-wake',
      mage: 'crisp-layered-energy-orb+three-layer-wake',
      enchanter: 'crisp-arcane-orb+three-layer-wake',
      healer: 'crisp-soft-orb-80pct+three-layer-wake',
      musician: 'crisp-music-note+three-layer-wake'
    },
    sourceToTargetReadable: true,
    powerReadability: 'sharp-core+hard-edge-wake+compress-pierce-burst-impact',
    healerScaleVsMage: HEALER_SCALE_VS_MAGE,
    particleEmitters: false,
    repeatingTweenLoops: false,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_FX_BUDGET = {
    version: '2.15.3',
    family: 'Combat2',
    source: 'POWDER_COMBAT2_FX_TIER',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    rangedOwner: 'Combat2153ProjectileClarityVfxPatch',
    singleProjectileContainer: true,
    attachedTrailChildrenOnly: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    finiteTweensOnly: true,
    delegatesMelee: true,
    combatLogicChanged: false
  };
}

installCombat2153ProjectileClarityVfxPatch();
