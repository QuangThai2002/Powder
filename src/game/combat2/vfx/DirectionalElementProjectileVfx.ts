import Phaser from 'phaser';
import { powVfxDepth } from './CombatNightVfxLayout';

export type CombatProjectileElement =
  | 'fire'
  | 'water'
  | 'ice'
  | 'lightning'
  | 'wind'
  | 'leaf'
  | 'poison'
  | 'earth'
  | 'steel'
  | 'light'
  | 'dark'
  | 'lava'
  | 'storm'
  | 'neutral';

export interface DirectionalProjectileOptions {
  scene: Phaser.Scene;
  source: Phaser.Math.Vector2;
  target: Phaser.Math.Vector2;
  element: CombatProjectileElement;
  reducedMotion?: boolean;
  durationMs?: number;
}

interface ElementVisualProfile {
  color: number;
  coreColor: number;
  length: number;
  thickness: number;
  impactRadius: number;
}

const PROFILE: Record<CombatProjectileElement, ElementVisualProfile> = {
  fire: { color: 0xff7043, coreColor: 0xfff0b0, length: 38, thickness: 8, impactRadius: 27 },
  lava: { color: 0xff4f2e, coreColor: 0xffc04d, length: 42, thickness: 10, impactRadius: 30 },
  water: { color: 0x4db9ff, coreColor: 0xd7f5ff, length: 36, thickness: 7, impactRadius: 26 },
  ice: { color: 0x8adfff, coreColor: 0xf0fdff, length: 44, thickness: 7, impactRadius: 28 },
  lightning: { color: 0xf5dd62, coreColor: 0xffffff, length: 46, thickness: 6, impactRadius: 25 },
  storm: { color: 0x78a9ff, coreColor: 0xdce6ff, length: 45, thickness: 7, impactRadius: 29 },
  wind: { color: 0x76e4d2, coreColor: 0xe8fffa, length: 52, thickness: 6, impactRadius: 27 },
  leaf: { color: 0x72d67f, coreColor: 0xdfffd8, length: 36, thickness: 7, impactRadius: 25 },
  poison: { color: 0xa5df66, coreColor: 0xe5ffb8, length: 34, thickness: 8, impactRadius: 27 },
  earth: { color: 0xb78c5d, coreColor: 0xf2d6ae, length: 35, thickness: 10, impactRadius: 31 },
  steel: { color: 0xc3d3dc, coreColor: 0xffffff, length: 48, thickness: 6, impactRadius: 26 },
  light: { color: 0xffefad, coreColor: 0xffffff, length: 42, thickness: 8, impactRadius: 30 },
  dark: { color: 0xa88cf2, coreColor: 0xeadfff, length: 40, thickness: 9, impactRadius: 30 },
  neutral: { color: 0x9ed8e8, coreColor: 0xffffff, length: 36, thickness: 7, impactRadius: 25 }
};

/**
 * Small, isolated Night Upgrade adapter for source -> target projectile readability.
 *
 * The projectile container is rotated once from atan2(target - source), so directional
 * art (wind, ice, steel, lightning, etc.) always points toward the victim. This class
 * deliberately owns no gameplay state and does not mutate PowView or CombatState.
 */
export class DirectionalElementProjectileVfx {
  static async play(options: DirectionalProjectileOptions): Promise<void> {
    const { scene, source, target, element } = options;
    const reducedMotion = Boolean(options.reducedMotion);
    const profile = PROFILE[element] ?? PROFILE.neutral;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const duration = Phaser.Math.Clamp(
      options.durationMs ?? (reducedMotion ? 150 : Math.round(180 + Math.min(180, distance * 0.14))),
      120,
      420
    );

    const trail = scene.add.graphics().setDepth(powVfxDepth('behind'));
    trail.lineStyle(reducedMotion ? 2 : 3, profile.color, reducedMotion ? 0.18 : 0.34);
    trail.lineBetween(source.x, source.y, target.x, target.y);

    const projectile = scene.add.container(source.x, source.y)
      .setDepth(powVfxDepth('foreground'))
      .setRotation(angle);
    this.buildProjectile(projectile, scene, element, profile, reducedMotion);

    await Promise.all([
      this.tween(scene, {
        targets: projectile,
        x: target.x,
        y: target.y,
        duration,
        ease: element === 'lightning' ? 'Expo.easeIn' : 'Quad.easeIn'
      }),
      this.tween(scene, {
        targets: trail,
        alpha: 0,
        duration: Math.max(120, duration - 10)
      })
    ]);

    projectile.destroy(true);
    trail.destroy();
    await this.playImpact(scene, target, element, profile, reducedMotion);
  }

  private static buildProjectile(
    container: Phaser.GameObjects.Container,
    scene: Phaser.Scene,
    element: CombatProjectileElement,
    profile: ElementVisualProfile,
    reducedMotion: boolean
  ): void {
    const { length, thickness, color, coreColor } = profile;

    if (element === 'wind') {
      container.add([
        scene.add.arc(0, 0, length * 0.44, -55, 55, false, color, 0.08).setStrokeStyle(4, color, 0.92),
        scene.add.arc(-10, 0, length * 0.31, -48, 48, false, coreColor, 0.04).setStrokeStyle(2, coreColor, 0.72),
        scene.add.triangle(length * 0.34, 0, -8, -7, -8, 7, 8, 0, coreColor, 0.82)
      ]);
      return;
    }

    if (element === 'ice' || element === 'steel') {
      container.add([
        scene.add.triangle(length * 0.12, 0, -length * 0.48, -thickness, -length * 0.48, thickness, length * 0.52, 0, color, 0.92),
        scene.add.triangle(length * 0.18, 0, -length * 0.24, -thickness * 0.42, -length * 0.24, thickness * 0.42, length * 0.42, 0, coreColor, 0.9)
      ]);
      return;
    }

    if (element === 'lightning' || element === 'storm') {
      const bolt = scene.add.graphics();
      bolt.lineStyle(reducedMotion ? 4 : 5, color, 0.95);
      bolt.beginPath();
      bolt.moveTo(-length * 0.52, 0);
      bolt.lineTo(-length * 0.18, -thickness);
      bolt.lineTo(0, thickness * 0.72);
      bolt.lineTo(length * 0.2, -thickness * 0.48);
      bolt.lineTo(length * 0.52, 0);
      bolt.strokePath();
      container.add([bolt, scene.add.circle(length * 0.45, 0, thickness * 0.58, coreColor, 0.88)]);
      return;
    }

    if (element === 'earth') {
      container.add([
        scene.add.polygon(0, 0, [-18, -9, -4, -15, 16, -8, 21, 5, 4, 14, -17, 8], color, 0.92),
        scene.add.circle(8, -2, 4, coreColor, 0.6)
      ]);
      return;
    }

    const coreRadius = Math.max(6, thickness * 0.9);
    container.add([
      scene.add.ellipse(-length * 0.18, 0, length, thickness * 1.8, color, 0.28),
      scene.add.circle(length * 0.22, 0, coreRadius, color, 0.96),
      scene.add.circle(length * 0.28, 0, Math.max(3, coreRadius * 0.46), coreColor, 0.96)
    ]);
  }

  private static async playImpact(
    scene: Phaser.Scene,
    target: Phaser.Math.Vector2,
    element: CombatProjectileElement,
    profile: ElementVisualProfile,
    reducedMotion: boolean
  ): Promise<void> {
    const impact = scene.add.container(target.x, target.y).setDepth(powVfxDepth('foreground') + 1);
    impact.add([
      scene.add.circle(0, 0, profile.impactRadius * 0.55, profile.color, 0.18),
      scene.add.circle(0, 0, profile.impactRadius, 0x000000, 0).setStrokeStyle(3, profile.color, 0.92),
      scene.add.circle(0, 0, profile.impactRadius * 0.32, profile.coreColor, 0.42)
    ]);

    if (!reducedMotion) {
      const shardCount = element === 'earth' ? 5 : element === 'lightning' ? 7 : 6;
      for (let index = 0; index < shardCount; index += 1) {
        const angle = Math.PI * 2 * index / shardCount;
        impact.add(
          scene.add.rectangle(
            Math.cos(angle) * profile.impactRadius * 0.8,
            Math.sin(angle) * profile.impactRadius * 0.8,
            element === 'wind' ? 18 : 13,
            element === 'earth' ? 6 : 3,
            profile.color,
            0.78
          ).setRotation(angle)
        );
      }
    }

    await this.tween(scene, {
      targets: impact,
      scaleX: reducedMotion ? 1.35 : 1.75,
      scaleY: reducedMotion ? 1.35 : 1.75,
      alpha: 0,
      duration: reducedMotion ? 130 : 210,
      ease: 'Quad.easeOut'
    });
    impact.destroy(true);
  }

  private static tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const duration = typeof config.duration === 'number' ? config.duration : 180;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, Math.max(260, duration + 220));
      try {
        scene.tweens.add({ ...config, onComplete: finish });
      } catch {
        finish();
      }
    });
  }
}
