import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import { powVfxDepth } from './CombatNightVfxLayout';

const FLAG = '__powderCombat2152ProjectileTrailVfxInstalled';
const BALANCED_BURST_THRESHOLD = 2;
const PROJECTILE_DURATION_SCALE = 2.25;
const HEALER_SCALE_VS_MAGE = 0.8;

type FxTier = 'full' | 'balanced' | 'lite';
type RangedRole = 'marksman' | 'mage' | 'enchanter' | 'healer' | 'musician';
type RoleAwareOptions = DirectionalProjectileOptions & { role?: string };

type ElementProfile = {
  color: number;
  core: number;
  trail: string;
};

const ELEMENT: Readonly<Record<CombatProjectileElement, ElementProfile>> = Object.freeze({
  fire: { color: 0xff7043, core: 0xfff0b0, trail: 'flame-wake' },
  lava: { color: 0xff4f2e, core: 0xffc04d, trail: 'molten-flame-wake' },
  water: { color: 0x4db9ff, core: 0xd7f5ff, trail: 'water-ripple-wake' },
  ice: { color: 0x8adfff, core: 0xf0fdff, trail: 'ice-crystal-wake' },
  lightning: { color: 0xf5dd62, core: 0xffffff, trail: 'electric-zigzag-wake' },
  storm: { color: 0x78a9ff, core: 0xdce6ff, trail: 'storm-arc-wake' },
  wind: { color: 0x76e4d2, core: 0xe8fffa, trail: 'wind-spiral-wake' },
  leaf: { color: 0x72d67f, core: 0xdfffd8, trail: 'leaf-wake' },
  poison: { color: 0xa5df66, core: 0xe5ffb8, trail: 'toxic-vapor-wake' },
  earth: { color: 0xb78c5d, core: 0xf2d6ae, trail: 'earth-shard-wake' },
  steel: { color: 0xc3d3dc, core: 0xffffff, trail: 'steel-razor-wake' },
  light: { color: 0xffefad, core: 0xffffff, trail: 'radiant-ray-wake' },
  dark: { color: 0xa88cf2, core: 0xeadfff, trail: 'shadow-wisp-wake' },
  neutral: { color: 0x9ed8e8, core: 0xffffff, trail: 'energy-wake' }
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

function addGenericWake(
  scene: Phaser.Scene,
  trail: Phaser.GameObjects.Container,
  radius: number,
  profile: ElementProfile,
  reducedDetail: boolean,
  strength: number
): number {
  const length = Math.min(180, radius * (reducedDetail ? 2.35 : 3.25) * strength);
  trail.add([
    scene.add.ellipse(-length * 0.48, 0, length, radius * 0.7, profile.color, reducedDetail ? 0.09 : 0.14),
    scene.add.ellipse(-length * 0.38, 0, length * 0.76, radius * 0.38, profile.color, reducedDetail ? 0.16 : 0.24),
    scene.add.rectangle(-length * 0.34, 0, length * 0.64, Math.max(3, radius * 0.1), profile.core, reducedDetail ? 0.34 : 0.5)
  ]);
  return length;
}

function addElementWake(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  element: CombatProjectileElement,
  radius: number,
  reducedDetail: boolean,
  strength = 1
): Phaser.GameObjects.Container | null {
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const trail = scene.add.container(0, 0);
  root.add(trail);
  const length = addGenericWake(scene, trail, radius, profile, reducedDetail, strength);
  const alpha = reducedDetail ? 0.42 : 0.68;

  switch (element) {
    case 'fire':
    case 'lava': {
      trail.add([
        scene.add.triangle(-length * 0.76, 0, -radius * 0.8, -radius * 0.38, radius * 0.3, 0, -radius * 0.8, radius * 0.38, profile.color, alpha),
        scene.add.triangle(-length * 0.5, -radius * 0.23, -radius * 0.58, -radius * 0.25, radius * 0.2, 0, -radius * 0.58, radius * 0.25, profile.core, alpha * 0.72),
        scene.add.triangle(-length * 0.45, radius * 0.28, -radius * 0.52, -radius * 0.22, radius * 0.22, 0, -radius * 0.52, radius * 0.22, profile.color, alpha * 0.8)
      ]);
      break;
    }
    case 'water': {
      trail.add([
        scene.add.ellipse(-length * 0.64, -radius * 0.2, radius * 0.75, radius * 0.32, profile.core, alpha * 0.55).setRotation(-0.18),
        scene.add.ellipse(-length * 0.43, radius * 0.24, radius * 0.58, radius * 0.26, profile.color, alpha * 0.7).setRotation(0.18),
        scene.add.circle(-length * 0.82, radius * 0.18, Math.max(3, radius * 0.1), profile.core, alpha * 0.7)
      ]);
      break;
    }
    case 'ice': {
      trail.add([
        scene.add.triangle(-length * 0.68, -radius * 0.22, -radius * 0.36, -radius * 0.18, radius * 0.22, 0, -radius * 0.36, radius * 0.18, profile.core, alpha * 0.78).setRotation(-0.2),
        scene.add.triangle(-length * 0.48, radius * 0.26, -radius * 0.3, -radius * 0.16, radius * 0.18, 0, -radius * 0.3, radius * 0.16, profile.color, alpha * 0.82).setRotation(0.28),
        scene.add.triangle(-length * 0.84, radius * 0.04, -radius * 0.22, -radius * 0.12, radius * 0.14, 0, -radius * 0.22, radius * 0.12, profile.core, alpha * 0.58)
      ]);
      break;
    }
    case 'lightning':
    case 'storm': {
      const bolt = scene.add.graphics();
      bolt.lineStyle(reducedDetail ? 3 : 5, profile.core, alpha);
      bolt.beginPath();
      bolt.moveTo(-length * 0.92, 0);
      bolt.lineTo(-length * 0.72, -radius * 0.28);
      bolt.lineTo(-length * 0.57, radius * 0.18);
      bolt.lineTo(-length * 0.37, -radius * 0.17);
      bolt.lineTo(-length * 0.17, radius * 0.1);
      bolt.lineTo(0, 0);
      bolt.strokePath();
      trail.add(bolt);
      if (element === 'storm') {
        trail.add([
          scene.add.arc(-length * 0.56, 0, radius * 0.72, 205, 335, false, 0x000000, 0).setStrokeStyle(3, profile.color, alpha * 0.72),
          scene.add.arc(-length * 0.34, 0, radius * 0.5, 205, 335, false, 0x000000, 0).setStrokeStyle(2, profile.core, alpha * 0.55)
        ]);
      }
      break;
    }
    case 'wind': {
      trail.add([
        scene.add.arc(-length * 0.65, 0, radius * 0.78, 205, 335, false, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 4, profile.color, alpha),
        scene.add.arc(-length * 0.43, 0, radius * 0.58, 200, 340, false, 0x000000, 0).setStrokeStyle(reducedDetail ? 2 : 3, profile.core, alpha * 0.7),
        scene.add.arc(-length * 0.23, 0, radius * 0.38, 195, 345, false, 0x000000, 0).setStrokeStyle(2, profile.color, alpha * 0.65)
      ]);
      break;
    }
    case 'leaf': {
      trail.add([
        scene.add.ellipse(-length * 0.72, -radius * 0.22, radius * 0.46, radius * 0.22, profile.color, alpha).setRotation(-0.5),
        scene.add.ellipse(-length * 0.5, radius * 0.26, radius * 0.4, radius * 0.2, profile.core, alpha * 0.68).setRotation(0.48),
        scene.add.ellipse(-length * 0.3, -radius * 0.14, radius * 0.32, radius * 0.16, profile.color, alpha * 0.8).setRotation(-0.3)
      ]);
      break;
    }
    case 'poison': {
      trail.add([
        scene.add.circle(-length * 0.74, -radius * 0.18, radius * 0.2, profile.color, alpha * 0.48),
        scene.add.circle(-length * 0.57, radius * 0.22, radius * 0.15, profile.core, alpha * 0.44),
        scene.add.circle(-length * 0.39, -radius * 0.05, radius * 0.24, profile.color, alpha * 0.36),
        scene.add.ellipse(-length * 0.52, 0, radius * 1.08, radius * 0.52, profile.color, reducedDetail ? 0.07 : 0.12)
      ]);
      break;
    }
    case 'earth': {
      trail.add([
        scene.add.rectangle(-length * 0.7, -radius * 0.2, radius * 0.34, radius * 0.22, profile.color, alpha).setRotation(-0.45),
        scene.add.rectangle(-length * 0.5, radius * 0.24, radius * 0.28, radius * 0.2, profile.core, alpha * 0.72).setRotation(0.34),
        scene.add.triangle(-length * 0.34, -radius * 0.1, -radius * 0.28, -radius * 0.16, radius * 0.18, 0, -radius * 0.28, radius * 0.16, profile.color, alpha * 0.72)
      ]);
      break;
    }
    case 'steel': {
      trail.add([
        scene.add.rectangle(-length * 0.7, -radius * 0.2, radius * 0.74, Math.max(3, radius * 0.07), profile.core, alpha).setRotation(-0.12),
        scene.add.rectangle(-length * 0.48, radius * 0.22, radius * 0.62, Math.max(3, radius * 0.06), profile.color, alpha * 0.82).setRotation(0.12),
        scene.add.rectangle(-length * 0.3, -radius * 0.02, radius * 0.58, Math.max(2, radius * 0.04), 0xffffff, alpha * 0.75)
      ]);
      break;
    }
    case 'light': {
      trail.add([
        scene.add.rectangle(-length * 0.62, 0, radius * 1.3, Math.max(3, radius * 0.08), profile.core, alpha * 0.82),
        scene.add.rectangle(-length * 0.5, -radius * 0.25, radius * 0.82, Math.max(2, radius * 0.05), profile.color, alpha * 0.62).setRotation(-0.12),
        scene.add.rectangle(-length * 0.4, radius * 0.25, radius * 0.72, Math.max(2, radius * 0.05), profile.color, alpha * 0.58).setRotation(0.12)
      ]);
      break;
    }
    case 'dark': {
      trail.add([
        scene.add.ellipse(-length * 0.7, -radius * 0.12, radius * 0.9, radius * 0.44, profile.color, alpha * 0.38).setRotation(-0.18),
        scene.add.ellipse(-length * 0.5, radius * 0.18, radius * 0.72, radius * 0.36, 0x50336f, alpha * 0.42).setRotation(0.2),
        scene.add.circle(-length * 0.32, -radius * 0.08, radius * 0.18, profile.core, alpha * 0.45)
      ]);
      break;
    }
    default:
      break;
  }

  const spin = scene.add.container(-radius * 0.08, 0);
  spin.add([
    scene.add.circle(0, -radius * 0.72, Math.max(3, radius * 0.075), profile.core, reducedDetail ? 0.36 : 0.62),
    scene.add.circle(0, radius * 0.72, Math.max(3, radius * 0.075), profile.color, reducedDetail ? 0.32 : 0.58)
  ]);
  root.add(spin);
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
  const alpha = reducedDetail ? 0.48 : 0.74;

  if (element === 'lightning' || element === 'storm') {
    const g = scene.add.graphics();
    g.lineStyle(reducedDetail ? 2 : 4, profile.core, alpha);
    g.lineBetween(-radius * 0.9, radius * 0.2, -radius * 0.15, -radius * 0.45);
    g.lineBetween(-radius * 0.15, -radius * 0.45, radius * 0.15, radius * 0.18);
    g.lineBetween(radius * 0.15, radius * 0.18, radius * 0.88, -radius * 0.24);
    impact.add(g);
    return;
  }
  if (element === 'wind') {
    impact.add([
      scene.add.arc(0, 0, radius * 0.8, 195, 345, false, 0x000000, 0).setStrokeStyle(3, profile.color, alpha),
      scene.add.arc(0, 0, radius * 0.52, 20, 160, false, 0x000000, 0).setStrokeStyle(2, profile.core, alpha * 0.7)
    ]);
    return;
  }
  if (element === 'poison') {
    impact.add([
      scene.add.circle(-radius * 0.32, -radius * 0.24, radius * 0.18, profile.color, alpha * 0.55),
      scene.add.circle(radius * 0.34, radius * 0.18, radius * 0.13, profile.core, alpha * 0.48)
    ]);
    return;
  }
  if (element === 'ice' || element === 'earth' || element === 'steel') {
    impact.add([
      scene.add.triangle(-radius * 0.45, -radius * 0.15, -radius * 0.2, -radius * 0.4, radius * 0.24, 0, -radius * 0.2, radius * 0.4, profile.color, alpha).setRotation(-0.35),
      scene.add.triangle(radius * 0.46, radius * 0.12, -radius * 0.16, -radius * 0.28, radius * 0.2, 0, -radius * 0.16, radius * 0.28, profile.core, alpha * 0.72).setRotation(0.4)
    ]);
    return;
  }
  if (element === 'leaf') {
    impact.add([
      scene.add.ellipse(-radius * 0.42, 0, radius * 0.44, radius * 0.2, profile.color, alpha).setRotation(-0.55),
      scene.add.ellipse(radius * 0.42, 0, radius * 0.44, radius * 0.2, profile.core, alpha * 0.72).setRotation(0.55)
    ]);
    return;
  }
  if (element === 'fire' || element === 'lava' || element === 'light') {
    impact.add([
      scene.add.triangle(0, -radius * 0.72, -radius * 0.22, -radius * 0.38, radius * 0.22, -radius * 0.38, 0, radius * 0.08, profile.core, alpha),
      scene.add.triangle(0, radius * 0.72, -radius * 0.2, radius * 0.38, radius * 0.2, radius * 0.38, 0, -radius * 0.08, profile.color, alpha * 0.72)
    ]);
    return;
  }
  if (element === 'dark') {
    impact.add([
      scene.add.ellipse(-radius * 0.2, 0, radius * 1.15, radius * 0.42, 0x50336f, alpha * 0.35).setRotation(-0.35),
      scene.add.ellipse(radius * 0.2, 0, radius * 1.15, radius * 0.42, profile.color, alpha * 0.32).setRotation(0.35)
    ]);
  }
}

async function animateImpact(
  options: DirectionalProjectileOptions,
  role: RangedRole,
  reducedDetail: boolean,
  scale = 1
): Promise<void> {
  const { scene, target, element } = options;
  const profile = ELEMENT[element] ?? ELEMENT.neutral;
  const radius = (reducedDetail ? 22 : 30) * scale;
  const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 3);

  if (role === 'marksman') {
    impact.add([
      scene.add.rectangle(0, 0, radius * 2.4, Math.max(5, radius * 0.2), profile.color, 0.42),
      scene.add.rectangle(0, 0, radius * 1.75, Math.max(2.5, radius * 0.07), profile.core, 0.95),
      scene.add.circle(0, 0, radius * 0.38, 0xffffff, 0.78)
    ]);
  } else if (role === 'musician') {
    impact.add([
      scene.add.circle(0, 0, radius * 0.35, profile.core, 0.66),
      scene.add.circle(0, 0, radius * 0.8, 0x000000, 0).setStrokeStyle(3, profile.color, 0.8),
      scene.add.circle(0, 0, radius * 1.18, 0x000000, 0).setStrokeStyle(2, profile.core, 0.46)
    ]);
  } else {
    const healer = role === 'healer';
    impact.add([
      scene.add.circle(0, 0, radius * 0.42, profile.core, healer ? 0.42 : 0.68),
      scene.add.circle(0, 0, radius * 0.86, 0x000000, 0).setStrokeStyle(healer ? 2 : 3, profile.color, healer ? 0.52 : 0.82),
      scene.add.circle(0, 0, radius * 1.18, 0x000000, 0).setStrokeStyle(2, profile.core, healer ? 0.28 : 0.44)
    ]);
    if (role === 'enchanter') {
      impact.add(scene.add.rectangle(0, 0, radius * 1.28, radius * 1.28, 0x000000, 0)
        .setStrokeStyle(2, profile.core, 0.55)
        .setRotation(Math.PI / 4));
    }
  }

  addElementImpactAccent(scene, impact, element, radius, reducedDetail);

  try {
    await tweenObject(scene, impact, {
      scaleX: reducedDetail ? 1.22 : 1.48,
      scaleY: reducedDetail ? 1.22 : 1.48,
      alpha: 0,
      duration: reducedDetail ? 145 : 195,
      ease: 'Quad.easeOut'
    }, reducedDetail ? 340 : 420);
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
    angle: (index % 2 === 0 ? 1 : -1) * (index === 0 ? 420 : 300),
    duration: durationMs,
    ease: 'Linear'
  }, durationMs + 180));

  try {
    await Promise.all([
      tweenObject(options.scene, projectile, {
        x: options.target.x,
        y: options.target.y,
        duration: durationMs,
        ease: options.element === 'lightning' ? 'Quad.easeInOut' : 'Sine.easeInOut'
      }, durationMs + 320),
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
  const length = radius * (reducedDetail ? 2.75 : 3.15);
  const shaft = Math.max(7, radius * 0.17);
  const head = radius * 0.88;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const projectile = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 2)
    .setRotation(angle);

  const trailSpin = addElementWake(scene, projectile, element, radius, reducedDetail, 1.12);

  // Magic arrow only: no physical feather/fletching. The body is pure elemental energy.
  projectile.add([
    scene.add.ellipse(-length * 0.13, 0, length * 0.95, radius * 0.34, profile.color, reducedDetail ? 0.12 : 0.2),
    scene.add.rectangle(-length * 0.08, 0, length * 0.76, shaft * 1.8, profile.color, 0.78),
    scene.add.rectangle(-length * 0.02, 0, length * 0.7, Math.max(3, shaft * 0.42), profile.core, 0.96),
    scene.add.triangle(
      length * 0.43,
      0,
      -head * 0.56,
      -head * 0.52,
      -head * 0.56,
      head * 0.52,
      head * 0.68,
      0,
      profile.color,
      0.98
    ),
    scene.add.triangle(
      length * 0.46,
      0,
      -head * 0.3,
      -head * 0.26,
      -head * 0.3,
      head * 0.26,
      head * 0.4,
      0,
      profile.core,
      0.96
    )
  ]);

  // Corkscrew rings make the shot read as a magical rotating arrow rather than a physical arrow.
  const helix = scene.add.container(0, 0);
  const ringXs = [-0.3, -0.08, 0.14, 0.3];
  ringXs.forEach((ratio, index) => {
    helix.add(scene.add.ellipse(
      length * ratio,
      0,
      radius * (index % 2 === 0 ? 0.48 : 0.38),
      radius * (index % 2 === 0 ? 0.96 : 0.78),
      0x000000,
      0
    ).setStrokeStyle(reducedDetail ? 2 : 3, index % 2 === 0 ? profile.core : profile.color, reducedDetail ? 0.42 : 0.7)
      .setRotation(index % 2 === 0 ? 0.28 : -0.28));
  });
  projectile.add(helix);

  const tipSpin = scene.add.container(length * 0.18, 0);
  tipSpin.add([
    scene.add.circle(0, -radius * 0.68, Math.max(4, radius * 0.085), profile.core, reducedDetail ? 0.5 : 0.82),
    scene.add.circle(0, radius * 0.68, Math.max(4, radius * 0.085), profile.color, reducedDetail ? 0.46 : 0.76),
    scene.add.circle(-radius * 0.58, 0, Math.max(3, radius * 0.07), profile.core, reducedDetail ? 0.38 : 0.62)
  ]);
  projectile.add(tipSpin);

  return { projectile, spin: [tipSpin, ...(trailSpin ? [trailSpin] : [])] };
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
  const trailSpin = addElementWake(scene, projectile, element, radius, reducedDetail, healer ? 0.82 : role === 'enchanter' ? 1.08 : 1);

  projectile.add([
    scene.add.circle(0, 0, radius * 1.12, profile.color, healer ? 0.055 : reducedDetail ? 0.07 : 0.11),
    scene.add.circle(0, 0, radius * 0.88, profile.color, healer ? 0.16 : 0.24).setStrokeStyle(reducedDetail ? 2 : 3, profile.color, healer ? 0.42 : 0.66),
    scene.add.circle(0, 0, radius * 0.61, profile.color, healer ? 0.72 : 0.92),
    scene.add.circle(radius * 0.08, -radius * 0.07, radius * 0.25, profile.core, healer ? 0.72 : 0.96),
    scene.add.ellipse(0, 0, radius * 1.92, radius * 0.7, 0x000000, 0)
      .setStrokeStyle(reducedDetail ? 1 : 2, profile.core, healer ? 0.25 : 0.48)
      .setRotation(0.28),
    scene.add.ellipse(0, 0, radius * 1.72, radius * 0.58, 0x000000, 0)
      .setStrokeStyle(reducedDetail ? 1 : 2, profile.color, healer ? 0.2 : 0.42)
      .setRotation(-0.42)
  ]);

  if (role === 'enchanter') {
    projectile.add([
      scene.add.rectangle(0, 0, radius * 1.28, radius * 1.28, 0x000000, 0).setStrokeStyle(reducedDetail ? 1 : 2, profile.core, 0.56).setRotation(Math.PI / 4),
      scene.add.rectangle(0, 0, radius * 0.94, radius * 0.94, 0x000000, 0).setStrokeStyle(1, profile.color, 0.48).setRotation(Math.PI / 4)
    ]);
  }

  const orbit = scene.add.container(0, 0);
  orbit.add([
    scene.add.circle(radius * 0.88, 0, Math.max(3, radius * 0.075), profile.core, healer ? 0.38 : 0.68),
    scene.add.circle(-radius * 0.88, 0, Math.max(3, radius * 0.075), profile.color, healer ? 0.32 : 0.58),
    scene.add.circle(0, radius * 0.88, Math.max(2.5, radius * 0.06), profile.core, healer ? 0.26 : 0.46)
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
  const trailSpin = addElementWake(scene, projectile, element, radius, reducedDetail, 0.92);

  const note = scene.add.container(0, 0).setRotation(-angle - 0.1);
  note.add([
    scene.add.circle(0, 0, radius * 0.98, profile.color, reducedDetail ? 0.04 : 0.075),
    scene.add.ellipse(-radius * 0.2, radius * 0.3, radius * 0.82, radius * 0.52, profile.color, 0.98).setRotation(-0.28),
    scene.add.ellipse(-radius * 0.14, radius * 0.25, radius * 0.3, radius * 0.18, profile.core, 0.86).setRotation(-0.28),
    scene.add.rectangle(radius * 0.18, -radius * 0.18, Math.max(5, radius * 0.115), radius * 1.18, profile.color, 0.98),
    scene.add.triangle(radius * 0.54, -radius * 0.62, -radius * 0.34, -radius * 0.2, radius * 0.34, 0, -radius * 0.34, radius * 0.2, profile.color, 0.96),
    scene.add.ellipse(-radius * 0.76, -radius * 0.16, radius * 0.3, radius * 0.18, profile.color, reducedDetail ? 0.34 : 0.54),
    scene.add.ellipse(-radius * 1.02, radius * 0.14, radius * 0.2, radius * 0.12, profile.core, reducedDetail ? 0.28 : 0.46)
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

export function installCombat2152ProjectileTrailVfxPatch(): void {
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

  const trailStyles = Object.fromEntries(
    Object.entries(ELEMENT).map(([key, profile]) => [key, profile.trail])
  );

  root.POWDER_COMBAT2_PROJECTILE_TRAIL_VFX = {
    version: '2.15.2',
    family: 'Combat2',
    owner: 'final-ranged-projectile-and-attached-trail-owner',
    rangedRoles: ['marksman', 'mage', 'enchanter', 'healer', 'musician'],
    magicArrow: {
      physicalFeathers: false,
      elementalEnergyBody: true,
      corkscrewRings: true,
      rotatingTipEnergy: true
    },
    attachedTrail: true,
    shortWakeOnly: true,
    trailStyles,
    distinctElementTrail: true,
    distinctElementImpactAccent: true,
    healerScaleVsMage: HEALER_SCALE_VS_MAGE,
    travelDurationScaleVsCombat2Baseline: PROJECTILE_DURATION_SCALE,
    travelSpeedPreservedFrom2151: true,
    singleProjectileContainerPerRangedAction: true,
    noFullPathBeam: true,
    noPhysicalArrowFletching: true,
    noDuplicateGuideProjectile: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    finiteSpinTweenOnly: true,
    delegatesNonRangedToPreviousOwner: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_RANGED_ROLE_VFX = {
    version: '2.15.2',
    family: 'Combat2',
    roles: {
      marksman: 'spiral-element-magic-arrow-with-attached-wake',
      mage: 'layered-energy-orb-with-element-wake',
      enchanter: 'arcane-energy-orb-with-element-wake',
      healer: 'soft-energy-orb-80pct-with-element-wake',
      musician: 'music-note-with-element-wake'
    },
    elementTrailIdentity: true,
    sourceToTargetReadable: true,
    powerReadability: 'bright-core+attached-wake+impact-accent',
    healerScaleVsMage: HEALER_SCALE_VS_MAGE,
    particleEmitters: false,
    repeatingTweenLoops: false,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_FX_BUDGET = {
    version: '2.15.2',
    family: 'Combat2',
    source: 'POWDER_COMBAT2_FX_TIER',
    balancedBurstThreshold: BALANCED_BURST_THRESHOLD,
    rangedOwner: 'Combat2152ProjectileTrailVfxPatch',
    singleProjectileContainer: true,
    attachedTrailChildrenOnly: true,
    particleEmitters: false,
    repeatingTweenLoops: false,
    delegatesMelee: true,
    combatLogicChanged: false
  };
}

installCombat2152ProjectileTrailVfxPatch();
