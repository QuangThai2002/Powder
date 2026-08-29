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

  private static addImpactMotif(
    impact: Phaser.GameObjects.Container,
    scene: Phaser.Scene,
    element: CombatProjectileElement,
    profile: ElementVisualProfile,
    reducedMotion: boolean
  ): boolean {
    const radius = profile.impactRadius;
    const { color, coreColor } = profile;

    if (element === 'fire' || element === 'lava') {
      const flameCount = reducedMotion ? 2 : element === 'lava' ? 4 : 3;
      for (let index = 0; index < flameCount; index += 1) {
        const spread = flameCount <= 1 ? 0 : (index / (flameCount - 1) - 0.5) * radius * 1.05;
        impact.add(
          scene.add.triangle(
            spread,
            -radius * 0.14,
            -6,
            radius * 0.45,
            6,
            radius * 0.45,
            0,
            -radius * (element === 'lava' ? 0.75 : 0.95),
            index % 2 === 0 ? coreColor : color,
            element === 'lava' ? 0.78 : 0.7
          )
        );
      }
      if (element === 'lava' && !reducedMotion) {
        impact.add([
          scene.add.polygon(-radius * 0.62, radius * 0.2, [-7, -4, 2, -7, 8, 1, 2, 7, -6, 5], color, 0.82),
          scene.add.polygon(radius * 0.58, radius * 0.26, [-6, -4, 3, -6, 7, 2, 1, 7, -7, 3], coreColor, 0.7)
        ]);
      }
      return true;
    }

    if (element === 'water') {
      impact.add([
        scene.add.ellipse(0, radius * 0.28, radius * 1.65, radius * 0.48, color, 0.06).setStrokeStyle(3, color, 0.84),
        scene.add.ellipse(0, radius * 0.28, radius * 1.05, radius * 0.3, coreColor, 0.04).setStrokeStyle(2, coreColor, 0.72)
      ]);
      if (!reducedMotion) {
        impact.add([
          scene.add.ellipse(-radius * 0.42, -radius * 0.34, 7, 13, coreColor, 0.76).setRotation(-0.35),
          scene.add.ellipse(radius * 0.38, -radius * 0.48, 6, 11, color, 0.72).setRotation(0.3)
        ]);
      }
      return true;
    }

    if (element === 'ice') {
      const shardCount = reducedMotion ? 3 : 5;
      for (let index = 0; index < shardCount; index += 1) {
        const angle = Math.PI * 2 * index / shardCount - Math.PI / 2;
        const distance = radius * 0.62;
        impact.add(
          scene.add.triangle(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            -4,
            6,
            4,
            6,
            0,
            -radius * 0.58,
            index % 2 === 0 ? coreColor : color,
            0.82
          ).setRotation(angle + Math.PI / 2)
        );
      }
      impact.add(scene.add.polygon(0, 0, [0, -radius * 0.62, radius * 0.24, -4, 0, radius * 0.5, -radius * 0.24, -4], coreColor, 0.48));
      return true;
    }

    if (element === 'lightning') {
      const bolt = scene.add.graphics();
      bolt.lineStyle(reducedMotion ? 3 : 4, coreColor, 0.92);
      bolt.beginPath();
      bolt.moveTo(-radius * 0.9, -radius * 0.12);
      bolt.lineTo(-radius * 0.28, -radius * 0.36);
      bolt.lineTo(-radius * 0.06, radius * 0.1);
      bolt.lineTo(radius * 0.32, -radius * 0.2);
      bolt.lineTo(radius * 0.88, radius * 0.14);
      bolt.strokePath();
      impact.add(bolt);
      if (!reducedMotion) {
        impact.add([
          scene.add.rectangle(0, 0, 3, radius * 1.65, color, 0.62).setRotation(0.46),
          scene.add.rectangle(0, 0, 3, radius * 1.4, coreColor, 0.54).setRotation(-0.72)
        ]);
      }
      return true;
    }

    if (element === 'storm') {
      impact.add([
        scene.add.arc(0, 0, radius * 0.88, 205, 18, false, color, 0.03).setStrokeStyle(5, color, 0.82),
        scene.add.arc(0, 0, radius * 0.58, 28, 220, false, coreColor, 0.03).setStrokeStyle(3, coreColor, 0.7)
      ]);
      if (!reducedMotion) {
        impact.add([
          scene.add.circle(-radius * 0.54, -radius * 0.24, 4, coreColor, 0.64),
          scene.add.circle(radius * 0.48, radius * 0.18, 3, color, 0.68),
          scene.add.rectangle(radius * 0.05, -radius * 0.52, 3, radius * 0.72, coreColor, 0.66).setRotation(0.34)
        ]);
      }
      return true;
    }

    if (element === 'wind') {
      impact.add([
        scene.add.arc(0, radius * 0.02, radius * 0.9, 200, 338, false, color, 0.02).setStrokeStyle(4, color, 0.82),
        scene.add.arc(-radius * 0.08, -radius * 0.06, radius * 0.62, 188, 330, false, coreColor, 0.02).setStrokeStyle(3, coreColor, 0.72)
      ]);
      if (!reducedMotion) {
        impact.add(scene.add.arc(radius * 0.08, radius * 0.08, radius * 0.38, 205, 345, false, color, 0.02).setStrokeStyle(2, color, 0.58));
      }
      return true;
    }

    if (element === 'leaf') {
      const count = reducedMotion ? 3 : 5;
      for (let index = 0; index < count; index += 1) {
        const angle = Math.PI * 2 * index / count;
        impact.add(
          scene.add.ellipse(
            Math.cos(angle) * radius * 0.72,
            Math.sin(angle) * radius * 0.72,
            8,
            16,
            index % 2 === 0 ? color : coreColor,
            0.78
          ).setRotation(angle + 0.65)
        );
      }
      return true;
    }

    if (element === 'poison') {
      impact.add([
        scene.add.ellipse(0, radius * 0.28, radius * 1.7, radius * 0.58, color, 0.16),
        scene.add.circle(-radius * 0.38, radius * 0.12, 5, coreColor, 0.68),
        scene.add.circle(radius * 0.26, radius * 0.24, 4, color, 0.78)
      ]);
      if (!reducedMotion) impact.add(scene.add.circle(radius * 0.46, -radius * 0.16, 3, coreColor, 0.62));
      return true;
    }

    if (element === 'earth') {
      const crack = scene.add.graphics();
      crack.lineStyle(reducedMotion ? 3 : 4, coreColor, 0.76);
      crack.beginPath();
      crack.moveTo(0, radius * 0.08);
      crack.lineTo(-radius * 0.28, radius * 0.44);
      crack.lineTo(-radius * 0.62, radius * 0.62);
      crack.moveTo(0, radius * 0.08);
      crack.lineTo(radius * 0.24, radius * 0.42);
      crack.lineTo(radius * 0.7, radius * 0.56);
      crack.strokePath();
      impact.add(crack);
      const rockCount = reducedMotion ? 2 : 4;
      for (let index = 0; index < rockCount; index += 1) {
        const angle = Math.PI + (Math.PI * index / Math.max(1, rockCount - 1));
        impact.add(scene.add.polygon(
          Math.cos(angle) * radius * 0.58,
          radius * 0.32 + Math.sin(angle) * radius * 0.18,
          [-6, -4, 1, -8, 7, -2, 5, 6, -5, 7],
          index % 2 === 0 ? color : coreColor,
          0.76
        ));
      }
      return true;
    }

    if (element === 'steel') {
      const bladeCount = reducedMotion ? 3 : 5;
      for (let index = 0; index < bladeCount; index += 1) {
        const angle = Math.PI * 2 * index / bladeCount;
        impact.add(
          scene.add.rectangle(
            Math.cos(angle) * radius * 0.62,
            Math.sin(angle) * radius * 0.62,
            radius * 0.72,
            4,
            index % 2 === 0 ? coreColor : color,
            0.8
          ).setRotation(angle)
        );
      }
      impact.add(scene.add.circle(0, 0, radius * 0.3, 0x000000, 0).setStrokeStyle(3, coreColor, 0.72));
      return true;
    }

    if (element === 'light') {
      impact.add([
        scene.add.rectangle(0, 0, radius * 1.9, 5, coreColor, 0.82),
        scene.add.rectangle(0, 0, 5, radius * 1.9, coreColor, 0.82),
        scene.add.rectangle(0, 0, radius * 1.25, 3, color, 0.66).setRotation(Math.PI / 4),
        scene.add.rectangle(0, 0, radius * 1.25, 3, color, 0.66).setRotation(-Math.PI / 4)
      ]);
      return true;
    }

    if (element === 'dark') {
      impact.add([
        scene.add.circle(0, 0, radius * 0.58, 0x120b22, 0.72).setStrokeStyle(3, color, 0.78),
        scene.add.arc(radius * 0.14, 0, radius * 0.55, 52, 308, false, color, 0.04).setStrokeStyle(5, coreColor, 0.66)
      ]);
      if (!reducedMotion) {
        impact.add([
          scene.add.circle(-radius * 0.55, -radius * 0.18, 3, coreColor, 0.64),
          scene.add.circle(radius * 0.48, radius * 0.34, 2.5, color, 0.72)
        ]);
      }
      return true;
    }

    return false;
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

    const hasDistinctMotif = this.addImpactMotif(impact, scene, element, profile, reducedMotion);
    if (!reducedMotion && !hasDistinctMotif) {
      const shardCount = 6;
      for (let index = 0; index < shardCount; index += 1) {
        const angle = Math.PI * 2 * index / shardCount;
        impact.add(
          scene.add.rectangle(
            Math.cos(angle) * profile.impactRadius * 0.8,
            Math.sin(angle) * profile.impactRadius * 0.8,
            13,
            3,
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
