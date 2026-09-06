import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';

const PATCH_FLAG = '__powderCombat2124PowSkillMotionIdentityInstalled';

type Slot = 'basic' | 0 | 1 | 'ultimate';
type FxTier = 'full' | 'balanced' | 'lite';

type MotionProfile = {
  x: number;
  y: number;
  scale: number;
  angle: number;
  ghosts: number;
  ghostSpread: number;
  duration: number;
};

type EchoPoolState = {
  idle: Phaser.GameObjects.Image[];
  active: Set<Phaser.GameObjects.Image>;
  created: number;
  reused: number;
  dropped: number;
  cleanupBound: boolean;
};

type ActiveMotion = { cancel: () => void };

interface PatchableScene extends Phaser.Scene {
  powViews?: Map<string, any>;
  performBasicAttack?: (actor: CombatUnitState, target: CombatUnitState) => Promise<void>;
  performAbility?: (actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate') => Promise<void>;
}

const echoPools = new WeakMap<Phaser.Scene, EchoPoolState>();
const activeMotions = new WeakMap<Phaser.GameObjects.Container, ActiveMotion>();

function tier(): FxTier {
  const value = String((globalThis as any).POWDER_COMBAT2_FX_TIER || 'full');
  return value === 'lite' || value === 'balanced' ? value : 'full';
}

function echoActiveCap(): number {
  const value = tier();
  return value === 'full' ? 8 : value === 'balanced' ? 4 : 0;
}

function echoPoolCap(): number {
  const value = tier();
  return value === 'full' ? 8 : value === 'balanced' ? 4 : 0;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roleKey(role: unknown): string {
  const key = norm(role);
  if (key.includes('sat thu') || key.includes('assassin')) return 'assassin';
  if (key.includes('xa thu') || key.includes('marksman')) return 'marksman';
  if (key.includes('phap su') || key.includes('mage')) return 'mage';
  if (key.includes('do don') || key.includes('tank')) return 'tank';
  if (key.includes('dau si') || key.includes('fighter')) return 'fighter';
  if (key.includes('hiep si') || key.includes('knight')) return 'knight';
  if (key.includes('tri lieu') || key.includes('healer')) return 'healer';
  if (key.includes('nhac cong') || key.includes('musician')) return 'musician';
  return 'enchanter';
}

function abilityOf(actor: CombatUnitState, slot: Slot): CombatAbility {
  if (slot === 'basic') return actor.pow.abilities.basic;
  if (slot === 'ultimate') return actor.pow.abilities.ultimate;
  return actor.pow.abilities.skills[slot];
}

function profileFor(actor: CombatUnitState, ability: CombatAbility, slot: Slot): MotionProfile {
  const role = roleKey(actor.pow.role);
  const identity = hash(`${actor.pow.id}:${ability.name}:${slot}:${ability.mechanic || ''}:${ability.status || ''}`);
  const ultimate = slot === 'ultimate';
  const support = ['heal', 'shield', 'buff', 'support', 'restore'].some((key) => norm(`${ability.type} ${ability.status} ${ability.mechanic}`).includes(key));
  const control = ['stun', 'freeze', 'paralysis', 'silence', 'choang', 'dong bang', 'te liet', 'cam lang'].some((key) => norm(`${ability.status} ${ability.mechanic}`).includes(key));
  const hits = Math.max(1, Math.min(8, Number(ability.hits) || 1));

  let x = 0;
  let y = 0;
  let scale = ultimate ? 1.045 : 1.025;
  let angle = 0;
  let ghosts = ultimate ? 3 : hits >= 3 ? 2 : 1;
  let ghostSpread = 12 + Math.min(18, hits * 3);
  let duration = ultimate ? 155 : 105;

  if (role === 'assassin') { x = actor.side === 'player' ? 14 : -14; y = -2; angle = actor.side === 'player' ? -1.4 : 1.4; ghostSpread += 10; }
  else if (role === 'marksman') { x = actor.side === 'player' ? -8 : 8; y = -4; scale += 0.006; ghostSpread += 5; }
  else if (role === 'mage') { y = -9; scale += 0.012; duration += 18; }
  else if (role === 'tank') { x = actor.side === 'player' ? -3 : 3; y = 4; scale = Math.max(scale, 1.035); duration += 28; ghosts = Math.min(ghosts, 2); }
  else if (role === 'fighter') { x = actor.side === 'player' ? 9 : -9; y = 2; scale += 0.008; }
  else if (role === 'knight') { x = actor.side === 'player' ? 5 : -5; y = 1; duration += 12; }
  else if (role === 'healer') { y = -7; scale += support ? 0.018 : 0.006; duration += 20; }
  else if (role === 'musician') { y = -5; angle = (identity % 2 ? 1 : -1) * 1.2; duration += 24; }
  else { y = control ? -5 : -2; angle = (identity % 2 ? 1 : -1) * 0.7; }

  if (support) { y -= 4; ghosts += ultimate ? 1 : 0; }
  if (control) { scale += 0.008; duration += 12; }
  if (ability.area) { scale += 0.01; ghostSpread += 5; }
  if (ability.sureHit || ability.unavoidable) { x += actor.side === 'player' ? 3 : -3; }

  if (tier() === 'balanced') ghosts = Math.min(ghosts, 2);
  if (tier() === 'lite') ghosts = 0;
  if (reducedMotion()) return { x: 0, y: 0, scale: 1, angle: 0, ghosts: 0, ghostSpread: 0, duration: 0 };

  return { x, y, scale, angle, ghosts: Math.min(4, ghosts), ghostSpread, duration };
}

function world(view: any): Phaser.Math.Vector2 {
  try { return view.getWorldPosition(); }
  catch { return new Phaser.Math.Vector2(view?.container?.x || 0, view?.container?.y || 0); }
}

function cleanupPool(scene: Phaser.Scene, state: EchoPoolState): void {
  for (const ghost of state.active) {
    scene.tweens.killTweensOf(ghost);
    if (ghost.scene) ghost.destroy();
  }
  for (const ghost of state.idle) {
    scene.tweens.killTweensOf(ghost);
    if (ghost.scene) ghost.destroy();
  }
  state.active.clear();
  state.idle.length = 0;
  echoPools.delete(scene);
}

function poolFor(scene: Phaser.Scene): EchoPoolState {
  let state = echoPools.get(scene);
  if (!state) {
    state = { idle: [], active: new Set(), created: 0, reused: 0, dropped: 0, cleanupBound: false };
    echoPools.set(scene, state);
  }
  if (!state.cleanupBound) {
    state.cleanupBound = true;
    const cleanup = (): void => {
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      scene.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
      cleanupPool(scene, state!);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }
  return state;
}

function portraitGhost(
  view: any,
  alpha: number,
  depth: number,
  position: Phaser.Math.Vector2,
  state: EchoPoolState
): Phaser.GameObjects.Image | null {
  const scene = view?.scene as Phaser.Scene | undefined;
  const portrait = view?.portrait as Phaser.GameObjects.Image | undefined;
  const container = view?.container as Phaser.GameObjects.Container | undefined;
  if (!scene || !portrait || !container || !portrait.texture?.key) return null;
  if (state.active.size >= echoActiveCap()) {
    state.dropped += 1;
    return null;
  }

  let ghost = state.idle.pop();
  if (ghost) {
    state.reused += 1;
    scene.tweens.killTweensOf(ghost);
    ghost.setTexture(portrait.texture.key, portrait.frame?.name);
  } else {
    ghost = scene.add.image(0, 0, portrait.texture.key, portrait.frame?.name);
    state.created += 1;
  }

  ghost
    .setActive(true)
    .setVisible(true)
    .setPosition(
      position.x + Number(portrait.x || 0) * Number(container.scaleX || 1),
      position.y + Number(portrait.y || 0) * Number(container.scaleY || 1)
    )
    .setDepth(depth)
    .setAlpha(alpha)
    .setRotation(Number(container.rotation || 0) + Number(portrait.rotation || 0))
    .setScale(
      Number(portrait.scaleX || 1) * Number(container.scaleX || 1),
      Number(portrait.scaleY || 1) * Number(container.scaleY || 1)
    )
    .setFlip(Boolean(portrait.flipX), Boolean(portrait.flipY));

  state.active.add(ghost);
  return ghost;
}

function recycleGhost(scene: Phaser.Scene, ghost: Phaser.GameObjects.Image, state: EchoPoolState): void {
  if (!state.active.delete(ghost)) return;
  ghost.setVisible(false).setActive(false).setAlpha(0);
  if (state.idle.length < echoPoolCap()) state.idle.push(ghost);
  else ghost.destroy();
}

function spawnIdentityEchoes(view: any, profile: MotionProfile, identity: number): void {
  if (!profile.ghosts) return;
  const scene = view?.scene as Phaser.Scene | undefined;
  if (!scene) return;
  const state = poolFor(scene);
  const position = world(view);
  const side = view?.side === 'enemy' ? -1 : 1;
  for (let i = 0; i < profile.ghosts; i += 1) {
    const ghost = portraitGhost(view, 0.15 - i * 0.025, 59 - i, position, state);
    if (!ghost) continue;
    const variance = (((identity >>> (i * 3)) & 7) - 3) * 0.8;
    ghost.x -= side * (profile.ghostSpread + i * 8);
    ghost.y += variance + (i % 2 ? 4 : -3);
    scene.tweens.add({
      targets: ghost,
      x: ghost.x - side * (8 + i * 4),
      y: ghost.y + variance,
      alpha: 0,
      scaleX: ghost.scaleX * 1.025,
      scaleY: ghost.scaleY * 1.025,
      duration: 130 + i * 28,
      ease: 'Quad.easeOut',
      onComplete: () => recycleGhost(scene, ghost, state)
    });
  }
}

async function primeSkillMotion(scene: PatchableScene, actor: CombatUnitState, slot: Slot): Promise<void> {
  if (reducedMotion()) return;
  const view = scene.powViews?.get(actor.instanceId);
  const container = view?.container as Phaser.GameObjects.Container | undefined;
  if (!view || !container) return;

  const ability = abilityOf(actor, slot);
  const profile = profileFor(actor, ability, slot);
  if (!profile.duration) return;

  // Final-regression guard: if a second presentation reaches the same Pow before the
  // previous wind-up has settled, restore/cancel that old presentation first. This
  // prevents two yoyo tweens from snapshotting each other's transient coordinates and
  // slowly drifting a Pow away from its canonical formation slot.
  activeMotions.get(container)?.cancel();

  const identity = hash(`${actor.pow.id}:${ability.name}:${slot}`);
  spawnIdentityEchoes(view, profile, identity);

  const baseX = container.x;
  const baseY = container.y;
  const baseScaleX = container.scaleX;
  const baseScaleY = container.scaleY;
  const baseAngle = container.angle;

  await new Promise<void>((resolve) => {
    let settled = false;
    let current!: ActiveMotion;
    const finish = (restore: boolean): void => {
      if (settled) return;
      settled = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onSceneExit);
      scene.events.off(Phaser.Scenes.Events.DESTROY, onSceneExit);
      if (activeMotions.get(container) === current) activeMotions.delete(container);
      if (restore && container.scene) {
        container.setPosition(baseX, baseY).setScale(baseScaleX, baseScaleY).setAngle(baseAngle);
      }
      resolve();
    };
    const onSceneExit = (): void => {
      scene.tweens.killTweensOf(container);
      finish(false);
    };

    current = {
      cancel: (): void => {
        scene.tweens.killTweensOf(container);
        finish(true);
      }
    };
    activeMotions.set(container, current);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onSceneExit);
    scene.events.once(Phaser.Scenes.Events.DESTROY, onSceneExit);
    scene.tweens.add({
      targets: container,
      x: baseX + profile.x,
      y: baseY + profile.y,
      scaleX: baseScaleX * profile.scale,
      scaleY: baseScaleY * profile.scale,
      angle: baseAngle + profile.angle,
      duration: profile.duration,
      yoyo: true,
      ease: slot === 'ultimate' ? 'Sine.easeInOut' : 'Quad.easeOut',
      onComplete: () => finish(true)
    });
  });
}

export function installCombat2124PowSkillMotionIdentityPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalBasic = proto.performBasicAttack;
  const originalAbility = proto.performAbility;

  if (typeof originalBasic === 'function') {
    proto.performBasicAttack = async function combat2124Basic(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState): Promise<void> {
      await primeSkillMotion(this, actor, 'basic');
      await originalBasic.call(this, actor, target);
    };
  }

  if (typeof originalAbility === 'function') {
    proto.performAbility = async function combat2124Ability(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate'): Promise<void> {
      await primeSkillMotion(this, actor, slot);
      await originalAbility.call(this, actor, target, slot);
    };
  }

  root.POWDER_COMBAT2_POW_MOTION_IDENTITY = {
    version: '2.12.4',
    mode: 'canonical-metadata-plus-pow-art',
    performanceRevision: '2.12.10',
    rules: [
      'real-pow-art-only',
      'role-aware-motion',
      'skill-slot-aware-motion',
      'canonical-hits-status-mechanic-aware',
      'adaptive-echo-budget',
      'scene-local-echo-pool',
      'scene-shutdown-pool-cleanup',
      'paired-lifecycle-listener-cleanup',
      'shutdown-safe-motion-await',
      'overlap-safe-motion-cancel',
      'concurrent-echo-cap',
      'no-procedural-element-symbols',
      'no-combat-logic-change',
      '60fps-oriented'
    ]
  };

  root.POWDER_COMBAT2_ECHO_POOL = {
    version: '2.12.10',
    mode: 'scene-local-reuse-with-paired-lifecycle-cleanup-and-motion-overlap-guard',
    snapshot(scene: Phaser.Scene): { idle: number; active: number; created: number; reused: number; dropped: number } {
      const state = poolFor(scene);
      return {
        idle: state.idle.length,
        active: state.active.size,
        created: state.created,
        reused: state.reused,
        dropped: state.dropped
      };
    }
  };
}
