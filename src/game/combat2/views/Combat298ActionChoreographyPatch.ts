import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';
import type { PowView } from './PowView';

type AbilitySlot = 'basic' | 0 | 1 | 'ultimate';
type ProjectileStyle = 'comet' | 'wave' | 'shard' | 'bolt' | 'leaf' | 'venom' | 'rock' | 'steel' | 'slash' | 'halo' | 'void' | 'arcane';

interface ActionContext {
  token: number;
  actorId: string;
  targetId: string;
  ability: CombatAbility;
  slot: AbilitySlot;
  elementKey: string;
  side: 'player' | 'enemy';
  hits: number;
}

interface PatchableScene extends Phaser.Scene {
  powViews?: Map<string, PowView>;
  performBasicAttack?: (actor: CombatUnitState, target: CombatUnitState) => Promise<void>;
  performAbility?: (actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate') => Promise<void>;
  startCombatFlow?: () => void;
}

const PATCH_FLAG = '__powderCombat298ActionChoreographyInstalled';
const contextByScene = new WeakMap<object, ActionContext>();
let actionToken = 0;

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function lowFx(): boolean {
  if (reducedMotion()) return true;
  const memory = Number((navigator as any)?.deviceMemory || 0);
  const cores = Number(navigator?.hardwareConcurrency || 0);
  return (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
}

function colorFor(elementKey: string): number {
  const key = norm(elementKey);
  if (key.includes('fire') || key.includes('lua')) return 0xff7043;
  if (key.includes('lava') || key.includes('dung nham')) return 0xff4f2e;
  if (key.includes('water') || key.includes('nuoc')) return 0x4db9ff;
  if (key.includes('ice') || key.includes('bang')) return 0x8adfff;
  if (key.includes('lightning') || key.includes('electric') || key.includes('set')) return 0xf5dd62;
  if (key.includes('storm') || key.includes('bao')) return 0x78a9ff;
  if (key.includes('leaf') || key.includes('nature') || key.includes('la')) return 0x72d67f;
  if (key.includes('poison') || key.includes('doc')) return 0xa5df66;
  if (key.includes('earth') || key.includes('dat')) return 0xb78c5d;
  if (key.includes('steel') || key.includes('thep')) return 0xc3d3dc;
  if (key.includes('wind') || key.includes('gio')) return 0x76e4d2;
  if (key.includes('light') || key.includes('anh sang')) return 0xffefad;
  if (key.includes('dark') || key.includes('bong toi')) return 0xa88cf2;
  return 0x79def4;
}

function styleFor(elementKey: string): ProjectileStyle {
  const key = norm(elementKey);
  if (key.includes('fire') || key.includes('lua') || key.includes('lava') || key.includes('dung nham')) return 'comet';
  if (key.includes('water') || key.includes('nuoc')) return 'wave';
  if (key.includes('ice') || key.includes('bang')) return 'shard';
  if (key.includes('lightning') || key.includes('electric') || key.includes('set') || key.includes('storm') || key.includes('bao')) return 'bolt';
  if (key.includes('leaf') || key.includes('nature') || key.includes('la')) return 'leaf';
  if (key.includes('poison') || key.includes('doc')) return 'venom';
  if (key.includes('earth') || key.includes('dat')) return 'rock';
  if (key.includes('steel') || key.includes('thep')) return 'steel';
  if (key.includes('wind') || key.includes('gio')) return 'slash';
  if (key.includes('light') || key.includes('anh sang')) return 'halo';
  if (key.includes('dark') || key.includes('bong toi')) return 'void';
  return 'arcane';
}

function strength(slot: AbilitySlot): number {
  return slot === 'ultimate' ? 1.7 : slot === 1 ? 1.28 : slot === 0 ? 1.05 : 0.82;
}

function accent(slot: AbilitySlot): number {
  return slot === 'ultimate' ? 0xffd36a : slot === 1 ? 0xc5a7ff : slot === 0 ? 0x8eeaff : 0xe9f7ff;
}

function hitCount(ability: CombatAbility, slot: AbilitySlot): number {
  const raw = Math.max(1, Math.round(Number(ability?.hits) || 1));
  const cap = lowFx() ? 2 : slot === 'ultimate' ? 5 : 4;
  return Math.min(cap, raw);
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const duration = typeof config.duration === 'number' ? config.duration : 180;
    const delay = typeof config.delay === 'number' ? config.delay : 0;
    const hold = typeof config.hold === 'number' ? config.hold : 0;
    const finish = (): void => { if (settled) return; settled = true; window.clearTimeout(timer); resolve(); };
    const timer = window.setTimeout(finish, Math.max(320, delay + duration * (config.yoyo ? 2 : 1) + hold + 300));
    try { scene.tweens.add({ ...config, onComplete: finish }); }
    catch { finish(); }
  });
}

function castSigil(scene: Phaser.Scene, x: number, y: number, color: number, slot: AbilitySlot): Phaser.GameObjects.Container {
  const s = strength(slot);
  const c = scene.add.container(x, y).setDepth(63).setScale(0.62);
  const ring = scene.add.circle(0, 0, 38 + s * 11, 0x000000, 0).setStrokeStyle(slot === 'ultimate' ? 5 : 3, color, 0.92);
  const inner = scene.add.circle(0, 0, 24 + s * 6, accent(slot), 0.06).setStrokeStyle(2, accent(slot), 0.68);
  c.add([ring, inner]);
  if (!lowFx()) {
    for (let i = 0; i < (slot === 'ultimate' ? 8 : 4); i += 1) {
      const a = Math.PI * 2 * i / (slot === 'ultimate' ? 8 : 4);
      c.add(scene.add.rectangle(Math.cos(a) * (46 + s * 8), Math.sin(a) * (46 + s * 8), 18 + s * 5, 3, i % 2 ? color : accent(slot), 0.68).setRotation(a));
    }
  }
  return c;
}

function drawTravelLine(scene: Phaser.Scene, start: Phaser.Math.Vector2, target: Phaser.Math.Vector2, style: ProjectileStyle, color: number, slot: AbilitySlot): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(57);
  const alpha = lowFx() ? 0.2 : 0.38;
  const width = slot === 'ultimate' ? 5 : slot === 1 ? 4 : 3;
  if (style === 'bolt') {
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 7; i += 1) {
      const t = i / 7;
      const wobble = i === 0 || i === 7 ? 0 : (i % 2 ? 13 : -13) * strength(slot);
      points.push(new Phaser.Math.Vector2(start.x + dx * t + nx * wobble, start.y + dy * t + ny * wobble));
    }
    g.lineStyle(width, color, alpha);
    g.beginPath(); g.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y); g.strokePath();
  } else if (style === 'slash') {
    g.lineStyle(width + 2, color, alpha).lineBetween(start.x, start.y, target.x, target.y);
    g.lineStyle(1, 0xffffff, alpha * 0.8).lineBetween(start.x, start.y - 6, target.x, target.y - 6);
  } else if (style === 'halo' || style === 'void') {
    g.lineStyle(width + (slot === 'ultimate' ? 3 : 1), color, alpha + 0.08).lineBetween(start.x, start.y, target.x, target.y);
  } else {
    g.lineStyle(width, color, alpha).lineBetween(start.x, start.y, target.x, target.y);
  }
  return g;
}

function projectile(scene: Phaser.Scene, x: number, y: number, style: ProjectileStyle, color: number, slot: AbilitySlot): Phaser.GameObjects.Container {
  const s = strength(slot);
  const p = scene.add.container(x, y).setDepth(61);
  if (style === 'comet') {
    p.add([scene.add.circle(0, 0, 9 + s * 4, color, 0.96), scene.add.circle(0, 0, 17 + s * 4, 0x000000, 0).setStrokeStyle(2, color, 0.7), scene.add.rectangle(-19 - s * 4, 0, 34 + s * 8, 7 + s * 2, color, 0.45)]);
  } else if (style === 'wave') {
    p.add([scene.add.ellipse(0, 0, 34 + s * 8, 18 + s * 4, color, 0.78).setStrokeStyle(2, 0xc8f7ff, 0.72), scene.add.circle(9, -4, 5, 0xe9fbff, 0.8)]);
  } else if (style === 'shard') {
    p.add([scene.add.triangle(0, 0, -22, 10, 24, 0, -22, -10, color, 0.92).setStrokeStyle(2, 0xe8fdff, 0.85), scene.add.rectangle(-17, 0, 28, 3, 0xffffff, 0.5)]);
  } else if (style === 'bolt') {
    p.add([scene.add.circle(0, 0, 9 + s * 3, color, 0.96), scene.add.rectangle(-12, -8, 26, 4, color, 0.8).setRotation(-0.55), scene.add.rectangle(9, 8, 22, 4, color, 0.8).setRotation(0.55)]);
  } else if (style === 'leaf') {
    p.add([scene.add.ellipse(0, 0, 30 + s * 6, 17 + s * 3, color, 0.92).setRotation(-0.55), scene.add.rectangle(-2, 0, 24, 2, 0xe6ffd8, 0.72).setRotation(-0.55)]);
  } else if (style === 'venom') {
    p.add([scene.add.circle(0, 0, 12 + s * 3, color, 0.9), scene.add.circle(-8, -10, 5, 0xdfff9a, 0.66), scene.add.circle(10, 8, 4, 0x6d9e36, 0.72)]);
  } else if (style === 'rock' || style === 'steel') {
    const edge = style === 'steel' ? 0xf0fbff : 0xe9cda1;
    p.add([scene.add.rectangle(0, 0, 25 + s * 5, 25 + s * 5, color, 0.9).setRotation(0.72).setStrokeStyle(2, edge, 0.72), scene.add.rectangle(-16, 5, 18, 5, color, 0.5).setRotation(0.3)]);
  } else if (style === 'slash') {
    p.add([scene.add.rectangle(0, 0, 48 + s * 10, 6 + s * 2, color, 0.9).setRotation(-0.42), scene.add.rectangle(-4, 7, 36 + s * 8, 2, 0xf1fffb, 0.7).setRotation(-0.42)]);
  } else if (style === 'halo') {
    p.add([scene.add.circle(0, 0, 11 + s * 3, 0xfff7cf, 0.98), scene.add.circle(0, 0, 20 + s * 5, 0x000000, 0).setStrokeStyle(3, color, 0.82)]);
  } else if (style === 'void') {
    p.add([scene.add.circle(0, 0, 13 + s * 4, 0x24143a, 0.98).setStrokeStyle(3, color, 0.9), scene.add.circle(0, 0, 22 + s * 5, 0x000000, 0).setStrokeStyle(2, 0xe2cfff, 0.48)]);
  } else {
    p.add([scene.add.circle(0, 0, 10 + s * 3, color, 0.96), scene.add.circle(0, 0, 18 + s * 4, 0x000000, 0).setStrokeStyle(2, accent(slot), 0.62)]);
  }
  return p;
}

async function impactBurst(scene: Phaser.Scene, x: number, y: number, style: ProjectileStyle, color: number, slot: AbilitySlot, mini: boolean): Promise<void> {
  const s = strength(slot) * (mini ? 0.68 : 1);
  const burst = scene.add.container(x, y).setDepth(66).setScale(0.62);
  const core = scene.add.circle(0, 0, 16 + s * 8, color, mini ? 0.09 : 0.17);
  const ring = scene.add.circle(0, 0, 24 + s * 14, 0x000000, 0).setStrokeStyle(slot === 'ultimate' && !mini ? 5 : 3, color, mini ? 0.64 : 0.92);
  burst.add([core, ring]);
  const rayCount = lowFx() ? 4 : slot === 'ultimate' && !mini ? 10 : 6;
  for (let i = 0; i < rayCount; i += 1) {
    const a = Math.PI * 2 * i / rayCount;
    const long = (style === 'slash' || style === 'bolt') ? 32 + s * 16 : 24 + s * 12;
    burst.add(scene.add.rectangle(Math.cos(a) * (22 + s * 6), Math.sin(a) * (22 + s * 6), long, mini ? 3 : 4, i % 2 ? color : accent(slot), mini ? 0.55 : 0.82).setRotation(a));
  }
  await tween(scene, { targets: burst, scaleX: mini ? 1.15 : 1.72, scaleY: mini ? 1.15 : 1.72, alpha: 0, duration: reducedMotion() ? 110 : mini ? 145 : 220, ease: 'Quad.easeOut' });
  burst.destroy(true);
}

async function travelHit(scene: Phaser.Scene, start: Phaser.Math.Vector2, target: Phaser.Math.Vector2, ctx: ActionContext, hitIndex: number): Promise<void> {
  const color = colorFor(ctx.elementKey);
  const style = styleFor(ctx.elementKey);
  const line = drawTravelLine(scene, start, target, style, color, ctx.slot);
  const shot = projectile(scene, start.x, start.y, style, color, ctx.slot);
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  shot.setRotation(Math.atan2(dy, dx));
  const distance = Math.hypot(dx, dy);
  const duration = reducedMotion() ? 100 : Math.round(Phaser.Math.Clamp(distance * 0.14, 125, ctx.slot === 'ultimate' ? 235 : 205));
  await Promise.all([
    tween(scene, { targets: shot, x: target.x, y: target.y, duration, ease: style === 'bolt' ? 'Cubic.easeIn' : 'Quad.easeIn' }),
    tween(scene, { targets: line, alpha: 0, duration: duration + 40, ease: 'Quad.easeOut' })
  ]);
  shot.destroy(true);
  line.destroy();
  await impactBurst(scene, target.x, target.y, style, color, ctx.slot, hitIndex < ctx.hits - 1);
}

async function miniTargetReaction(scene: PatchableScene, targetId: string, ordinal: number): Promise<void> {
  const targetView = scene.powViews?.get(targetId) as any;
  const c = targetView?.container as Phaser.GameObjects.Container | undefined;
  if (!c || !c.active || reducedMotion()) return;
  const startX = c.x;
  const dir = ordinal % 2 === 0 ? 1 : -1;
  await tween(scene, { targets: c, x: startX + dir * 5, duration: 45, yoyo: true, ease: 'Sine.easeInOut' });
  if (c.active) c.setX(startX);
}

function showHitChain(scene: Phaser.Scene, target: Phaser.Math.Vector2, hits: number, slot: AbilitySlot): void {
  if (hits <= 1) return;
  const text = scene.add.text(target.x, target.y - 42, `HIT ×${hits}`, {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: slot === 'ultimate' ? '23px' : '18px',
    color: slot === 'ultimate' ? '#ffe08a' : '#dff8ff',
    fontStyle: 'bold',
    stroke: '#041018',
    strokeThickness: 5,
    backgroundColor: '#06111cbb',
    padding: { x: 9, y: 5 }
  }).setOrigin(0.5).setDepth(74).setScale(0.84);
  scene.tweens.add({ targets: text, y: target.y - 66, scaleX: 1, scaleY: 1, alpha: 0, delay: 220, duration: reducedMotion() ? 260 : 520, ease: 'Quad.easeOut', onComplete: () => text.destroy() });
}

function localBadge(scene: Phaser.Scene): void {
  if (typeof location === 'undefined' || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  scene.add.text(18, scene.scale.height - 18, 'COMBAT2 2.9.8 · ACTION CHOREOGRAPHY', {
    fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#9deaff', fontStyle: 'bold', backgroundColor: '#04101899', padding: { x: 7, y: 4 }
  }).setOrigin(0, 1).setDepth(95).setAlpha(0.72);
}

export function installCombat298ActionChoreographyPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const sceneProto = BattleSceneClass.prototype as any;
  const originalCreate = sceneProto.create;
  sceneProto.create = function combat298Create(this: PatchableScene): void {
    originalCreate.call(this);
    localBadge(this);
  };

  const originalBasic = sceneProto.performBasicAttack;
  sceneProto.performBasicAttack = async function combat298Basic(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState): Promise<void> {
    const ability = actor.pow.abilities.basic;
    const ctx: ActionContext = { token: ++actionToken, actorId: actor.instanceId, targetId: target.instanceId, ability, slot: 'basic', elementKey: actor.pow.elementKey, side: actor.side, hits: hitCount(ability, 'basic') };
    contextByScene.set(this, ctx);
    try { await originalBasic.call(this, actor, target); }
    finally { if (contextByScene.get(this)?.token === ctx.token) contextByScene.delete(this); }
  };

  const originalAbility = sceneProto.performAbility;
  sceneProto.performAbility = async function combat298Ability(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate'): Promise<void> {
    const ability = slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
    const ctx: ActionContext = { token: ++actionToken, actorId: actor.instanceId, targetId: target.instanceId, ability, slot, elementKey: actor.pow.elementKey, side: actor.side, hits: hitCount(ability, slot) };
    contextByScene.set(this, ctx);
    try { await originalAbility.call(this, actor, target, slot); }
    finally { if (contextByScene.get(this)?.token === ctx.token) contextByScene.delete(this); }
  };

  const powProto = PowViewClass.prototype as any;
  const originalHit = powProto.playHit;
  const originalStatusPulse = powProto.playStatusPulse;

  powProto.playAttackLunge = async function combat298AttackLunge(this: any, targetX: number, targetY: number): Promise<void> {
    const scene = this.scene as PatchableScene;
    const ctx = contextByScene.get(scene) ?? {
      token: 0, actorId: '', targetId: '', ability: { name: 'Attack', power: 1, type: 'physical' }, slot: 'basic' as AbilitySlot,
      elementKey: this.pow?.elementKey || '', side: this.side || 'player', hits: 1
    };
    const c = this.container as Phaser.GameObjects.Container;
    const start = new Phaser.Math.Vector2(c.x, c.y);
    const target = new Phaser.Math.Vector2(targetX, targetY);
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const baseScaleX = c.scaleX;
    const baseScaleY = c.scaleY;
    const sigil = castSigil(scene, start.x, start.y, colorFor(ctx.elementKey), ctx.slot);
    const pull = ctx.slot === 'ultimate' ? 17 : ctx.slot === 1 ? 13 : 9;
    const push = ctx.slot === 'ultimate' ? 76 : ctx.slot === 1 ? 62 : ctx.slot === 0 ? 52 : 42;

    await Promise.all([
      tween(scene, { targets: sigil, scaleX: 1.32, scaleY: 1.32, alpha: 0, duration: reducedMotion() ? 120 : ctx.slot === 'ultimate' ? 280 : 190, ease: 'Quad.easeOut' }),
      tween(scene, { targets: c, x: start.x - ux * pull, y: start.y - uy * pull, scaleX: baseScaleX * 0.97, scaleY: baseScaleY * 0.97, duration: reducedMotion() ? 65 : 105, ease: 'Sine.easeOut' })
    ]);
    sigil.destroy(true);

    await tween(scene, { targets: c, x: start.x + ux * push, y: start.y + uy * push, scaleX: baseScaleX * 1.025, scaleY: baseScaleY * 1.025, duration: reducedMotion() ? 75 : 115, ease: 'Cubic.easeOut' });

    const travelStart = new Phaser.Math.Vector2(c.x, c.y);
    const hits = Math.max(1, ctx.hits);
    for (let i = 0; i < hits; i += 1) {
      await travelHit(scene, travelStart, target, ctx, i);
      if (i < hits - 1) await miniTargetReaction(scene, ctx.targetId, i);
      if (i < hits - 1 && !reducedMotion()) await new Promise<void>((resolve) => scene.time.delayedCall(45, resolve));
    }
    showHitChain(scene, target, hits, ctx.slot);

    await tween(scene, { targets: c, x: start.x, y: start.y, scaleX: baseScaleX, scaleY: baseScaleY, duration: reducedMotion() ? 80 : 145, ease: 'Back.easeOut' });
    if (c.active) c.setPosition(start.x, start.y).setScale(baseScaleX, baseScaleY);
  };

  powProto.playHit = async function combat298Hit(this: any): Promise<void> {
    const scene = this.scene as PatchableScene;
    const ctx = contextByScene.get(scene);
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const color = colorFor(ctx?.elementKey || this.pow?.elementKey || '');
    const style = styleFor(ctx?.elementKey || this.pow?.elementKey || '');
    const slot = ctx?.slot ?? 'basic';
    const impact = impactBurst(scene, p.x, p.y, style, color, slot, false);
    if (!reducedMotion() && slot === 'ultimate') scene.cameras.main.shake(130, 0.0025);
    await Promise.all([Promise.resolve(originalHit.call(this)), impact]);
  };

  powProto.playStatusPulse = async function combat298StatusPulse(this: any): Promise<void> {
    const scene = this.scene as PatchableScene;
    const ctx = contextByScene.get(scene);
    const original = Promise.resolve(originalStatusPulse.call(this));
    if (!ctx || norm(ctx.ability.type) !== 'support') { await original; return; }
    const p = this.getWorldPosition() as Phaser.Math.Vector2;
    const color = colorFor(ctx.elementKey);
    const aura = scene.add.container(p.x, p.y).setDepth(64).setScale(0.68);
    aura.add([
      scene.add.circle(0, 0, 48, color, 0.08).setStrokeStyle(4, color, 0.78),
      scene.add.circle(0, 0, 30, 0x73f0aa, 0.06).setStrokeStyle(2, 0x73f0aa, 0.7)
    ]);
    if (!lowFx()) {
      for (let i = 0; i < 6; i += 1) {
        const a = Math.PI * 2 * i / 6;
        aura.add(scene.add.circle(Math.cos(a) * 42, Math.sin(a) * 42, 4, i % 2 ? color : 0x73f0aa, 0.82));
      }
    }
    await Promise.all([original, tween(scene, { targets: aura, y: p.y - 12, scaleX: 1.48, scaleY: 1.48, alpha: 0, duration: reducedMotion() ? 150 : 280, ease: 'Sine.easeOut' })]);
    aura.destroy(true);
  };

  sceneProto.showPreBattleIntro = function combat298Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.42);
    const plateWidth = Math.min(720, width * 0.78);
    const plate = this.add.rectangle(width / 2, height / 2, plateWidth, 124, 0x081d2a, 0.95).setStrokeStyle(2, 0xd7b86c, 0.75);
    const title = this.add.text(width / 2, height / 2 - 14, 'POWDER COMBAT 2.9.8', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '35px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 27, 'ACTION CHOREOGRAPHY · MULTI-HIT · ELEMENT FX', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#8eeaff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(100);
    this.tweens.add({ targets: intro, alpha: 0, delay: 850, duration: 300, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
  };

  root.POWDER_COMBAT2_ACTION_FX = {
    version: '2.9.8',
    context: (scene: object) => contextByScene.get(scene) ?? null,
    lowFx: lowFx()
  };
}