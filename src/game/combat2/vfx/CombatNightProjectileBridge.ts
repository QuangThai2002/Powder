import Phaser from 'phaser';
import { DirectionalElementProjectileVfx, type CombatProjectileElement } from './DirectionalElementProjectileVfx';
import { PowView } from '../views/PowView';

interface PowViewProjectileRuntime {
  scene: Phaser.Scene;
  pow: { elementKey?: string; element?: string };
  reducedMotion: boolean;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition: () => Phaser.Math.Vector2;
}

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveElement(pow: PowViewProjectileRuntime['pow']): CombatProjectileElement {
  const key = normalize(`${pow.elementKey ?? ''} ${pow.element ?? ''}`);
  if (key.includes('dung nham') || key.includes('lava')) return 'lava';
  if (key.includes('lua') || key.includes('fire')) return 'fire';
  if (key.includes('nuoc') || key.includes('water')) return 'water';
  if (key.includes('bang') || key.includes('ice')) return 'ice';
  if (key.includes('bao') || key.includes('storm')) return 'storm';
  if (key.includes('set') || key.includes('lightning') || key.includes('electric')) return 'lightning';
  if (key.includes('gio') || key.includes('wind')) return 'wind';
  if (key.includes('la') || key.includes('leaf') || key.includes('nature')) return 'leaf';
  if (key.includes('doc') || key.includes('poison')) return 'poison';
  if (key.includes('dat') || key.includes('earth')) return 'earth';
  if (key.includes('thep') || key.includes('steel')) return 'steel';
  if (key.includes('anh sang') || key.includes('light')) return 'light';
  if (key.includes('bong toi') || key.includes('dark')) return 'dark';
  return 'neutral';
}

/**
 * Night Upgrade runtime bridge.
 * Replaces only PowView's presentation-only travel method; no combat state or damage logic changes.
 */
export function installCombatNightProjectileBridge(): void {
  const prototype = PowView.prototype as unknown as {
    playElementTravel?: (targetX: number, targetY: number) => Promise<void>;
    __nightProjectileBridgeInstalled?: boolean;
  };
  if (prototype.__nightProjectileBridgeInstalled) return;

  prototype.playElementTravel = async function (this: PowViewProjectileRuntime, targetX: number, targetY: number): Promise<void> {
    const source = typeof this.getVfxAnchor === 'function'
      ? this.getVfxAnchor('body')
      : this.getWorldPosition();
    const target = new Phaser.Math.Vector2(targetX, targetY);

    await DirectionalElementProjectileVfx.play({
      scene: this.scene,
      source,
      target,
      element: resolveElement(this.pow),
      reducedMotion: this.reducedMotion
    });
  };

  prototype.__nightProjectileBridgeInstalled = true;
}

installCombatNightProjectileBridge();
