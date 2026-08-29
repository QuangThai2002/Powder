import Phaser from 'phaser';
import { DirectionalElementProjectileVfx, type CombatProjectileElement } from './DirectionalElementProjectileVfx';
import { PowView } from '../views/PowView';

interface PowViewProjectileRuntime {
  scene: Phaser.Scene;
  pow: { elementKey?: string; element?: string };
  reducedMotion: boolean;
  container: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition: () => Phaser.Math.Vector2;
  playCastSignature?: (support: boolean) => Promise<void>;
  tweenPromise?: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Promise<void>;
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

async function playNightProjectile(
  view: PowViewProjectileRuntime,
  targetX: number,
  targetY: number
): Promise<void> {
  const source = typeof view.getVfxAnchor === 'function'
    ? view.getVfxAnchor('body')
    : view.getWorldPosition();
  const target = new Phaser.Math.Vector2(targetX, targetY);

  await DirectionalElementProjectileVfx.play({
    scene: view.scene,
    source,
    target,
    element: resolveElement(view.pow),
    reducedMotion: view.reducedMotion
  });
}

/**
 * Final Night projectile owner.
 *
 * The previous bridge only replaced playElementTravel. That was too indirect: older
 * presentation patches can still make it difficult to prove that the live attack entry
 * point actually reaches the Night projectile. Night 34 therefore owns playAttackLunge
 * itself and calls DirectionalElementProjectileVfx directly from the method BattleScene
 * invokes for basic attacks and offensive skills.
 *
 * Presentation only: no damage, targeting, turn order or combat-state mutations.
 */
export function installCombatNightProjectileBridge(): void {
  const prototype = PowView.prototype as unknown as {
    playElementTravel?: (targetX: number, targetY: number) => Promise<void>;
    playAttackLunge?: (targetX: number, targetY: number) => Promise<void>;
    __nightProjectileBridgeInstalled?: boolean;
    __nightProjectileAttackOwnerInstalled?: boolean;
  };

  // A previous Night version may already have installed the travel bridge. Upgrade it
  // in-place instead of returning early so hot reloads / branch refreshes pick up Night 34.
  prototype.playElementTravel = async function (
    this: PowViewProjectileRuntime,
    targetX: number,
    targetY: number
  ): Promise<void> {
    await playNightProjectile(this, targetX, targetY);
  };

  prototype.playAttackLunge = async function (
    this: PowViewProjectileRuntime,
    targetX: number,
    targetY: number
  ): Promise<void> {
    const startX = this.container.x;
    const startY = this.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const attackX = startX + (dx / distance) * 34;
    const attackY = startY + (dy / distance) * 34;

    if (typeof this.playCastSignature === 'function') {
      await this.playCastSignature(false);
    }

    const lunge = typeof this.tweenPromise === 'function'
      ? this.tweenPromise({
          targets: this.container,
          x: attackX,
          y: attackY,
          duration: this.reducedMotion ? 80 : 140,
          ease: 'Quad.easeOut',
          yoyo: true
        })
      : Promise.resolve();

    try {
      await Promise.all([
        playNightProjectile(this, targetX, targetY),
        lunge
      ]);
    } finally {
      this.container.setPosition(startX, startY);
    }
  };

  prototype.__nightProjectileBridgeInstalled = true;
  prototype.__nightProjectileAttackOwnerInstalled = true;

  const root = globalThis as any;
  root.POWDER_COMBAT2_NIGHT_PROJECTILE = {
    version: 'night-34',
    runtimeEntryPoint: 'PowView.playAttackLunge',
    directTravelOwner: true,
    attackLungeOwner: true,
    sourceToTarget: true,
    combatLogicChanged: false
  };
}

installCombatNightProjectileBridge();
