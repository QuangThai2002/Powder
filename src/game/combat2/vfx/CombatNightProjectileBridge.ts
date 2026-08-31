import Phaser from 'phaser';
import {
  DirectionalElementProjectileVfx,
  type CombatProjectileElement,
  type DirectionalProjectileOptions
} from './DirectionalElementProjectileVfx';
import {
  isCombat2159MarksmanRole,
  playCombat2159MarksmanDirectVfx
} from './Combat2159MarksmanDirectVfx';
import { PowView } from '../views/PowView';

interface PowViewProjectileRuntime {
  scene: Phaser.Scene;
  pow: { elementKey?: string; element?: string; role?: string };
  reducedMotion: boolean;
  container: Phaser.GameObjects.Container;
  getVfxAnchor?: (anchor: 'body') => Phaser.Math.Vector2;
  getWorldPosition: () => Phaser.Math.Vector2;
  playCastSignature?: (support: boolean) => Promise<void>;
  tweenPromise?: (config: Phaser.Types.Tweens.TweenBuilderConfig) => Promise<void>;
}

type RoleAwareProjectileOptions = DirectionalProjectileOptions & { role?: string };

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
  const options: RoleAwareProjectileOptions = {
    scene: view.scene,
    source,
    target,
    element: resolveElement(view.pow),
    reducedMotion: view.reducedMotion,
    role: view.pow.role
  };

  // Combat2 2.15.9: Marksman bypasses the historical owner stack completely.
  // Both real combat and live QA now execute the same dedicated projectile function.
  if (isCombat2159MarksmanRole(view.pow.role)) {
    await playCombat2159MarksmanDirectVfx(options);
    return;
  }

  const roleAwarePlay = DirectionalElementProjectileVfx.play as unknown as
    (runtimeOptions: RoleAwareProjectileOptions) => Promise<void>;
  await roleAwarePlay(options);
}

/**
 * Final attack-travel bridge.
 *
 * Combat2 2.15.9 keeps compatibility routing for every non-Marksman profession,
 * while Marksman has one direct runtime implementation. This avoids the long
 * stacked DirectionalElementProjectileVfx.play override chain that made visual
 * ownership difficult to verify during QA.
 */
export function installCombatNightProjectileBridge(): void {
  const prototype = PowView.prototype as unknown as {
    playElementTravel?: (targetX: number, targetY: number) => Promise<void>;
    playAttackLunge?: (targetX: number, targetY: number) => Promise<void>;
    __nightProjectileBridgeInstalled?: boolean;
    __nightProjectileAttackOwnerInstalled?: boolean;
  };

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
    version: 'combat2-2.15.9',
    runtimeEntryPoint: 'PowView.playAttackLunge',
    directTravelOwner: true,
    attackLungeOwner: true,
    roleForwarding: true,
    elementForwarding: true,
    sourceToTarget: true,
    marksmanDirectRuntime: true,
    marksmanDirectVersion: '2.15.9',
    nonMarksmanCompatibilityOwnerStack: true,
    combatLogicChanged: false
  };
}

installCombatNightProjectileBridge();
