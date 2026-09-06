import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';
import type { CombatProjectileElement, DirectionalProjectileOptions } from '../vfx/DirectionalElementProjectileVfx';
import { powVfxDepth } from '../vfx/CombatNightVfxLayout';
import { playCombat2201ImpactVfx } from '../vfx/Combat2201HighFantasyAnimeVfx';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  powViews?: Map<string, any>;
  performBasicAttack?: (actor: CombatUnitState, target: CombatUnitState) => Promise<void>;
  performAbility?: (actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate') => Promise<void>;
}

type Slot = 'basic' | 0 | 1 | 'ultimate';
export type Combat2104Role = 'marksman' | 'mage' | 'tank' | 'fighter' | 'knight' | 'assassin' | 'enchanter' | 'healer' | 'musician';
export type Combat2104ActionTier = 'normal' | 'skill' | 'ultimate';
export type Combat2104ActionTrait = 'support' | 'control' | 'area' | 'multi-hit' | 'pierce' | 'barrier' | 'single';
export type Combat2104ActionSignature = {
  version: '2.19.4';
  role: Combat2104Role;
  tier: Combat2104ActionTier;
  slot: 'basic' | 'skill-a' | 'skill-b' | 'ultimate';
  abilityName: string;
  traits: Combat2104ActionTrait[];
  visualHitCount?: number;
  rarity?: string;
};

type SignaturePow = { id?: string; role?: string; elementKey?: string; element?: string; rarity?: string };
type SignatureView = { __combat2104ActionSignature?: Combat2104ActionSignature };
const PATCH_FLAG = '__powderCombat2104PowSkillSignatureInstalled';

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

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function lowFx(): boolean {
  if (reducedMotion()) return true;
  const memory = Number((navigator as any)?.deviceMemory || 0);
  const cores = Number(navigator?.hardwareConcurrency || 0);
  return (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
}

function elementColor(elementKey: string): number {
  const key = norm(elementKey);
  if (key.includes('fire') || key.includes('lua')) return 0xff7043;
  if (key.includes('lava') || key.includes('dung nham')) return 0xff4d32;
  if (key.includes('water') || key.includes('nuoc')) return 0x55b9ff;
  if (key.includes('ice') || key.includes('bang')) return 0x9eeeff;
  if (key.includes('lightning') || key.includes('set')) return 0xffe35f;
  if (key.includes('storm') || key.includes('bao')) return 0x8987ff;
  if (key.includes('leaf') || key.includes('la')) return 0x6bdd7d;
  if (key.includes('poison') || key.includes('doc')) return 0x9fdb54;
  if (key.includes('earth') || key.includes('dat')) return 0xc78f58;
  if (key.includes('steel') || key.includes('thep')) return 0xb8c6ce;
  if (key.includes('wind') || key.includes('gio')) return 0xa8f0e3;
  if (key.includes('light') || key.includes('anh sang')) return 0xfff1a3;
  if (key.includes('dark') || key.includes('bong toi')) return 0xa075df;
  return 0x8eeaff;
}

function roleKey(role: string): Combat2104Role {
  const r = norm(role);
  if (r.includes('xa thu') || r.includes('marksman')) return 'marksman';
  if (r.includes('phap su') || r.includes('mage')) return 'mage';
  if (r.includes('do don') || r.includes('tank')) return 'tank';
  if (r.includes('dau si') || r.includes('fighter')) return 'fighter';
  if (r.includes('hiep si') || r.includes('knight')) return 'knight';
  if (r.includes('tri lieu') || r.includes('healer')) return 'healer';
  if (r.includes('nhac cong') || r.includes('musician')) return 'musician';
  if (r.includes('sat thu') || r.includes('assassin')) return 'assassin';
  return 'enchanter';
}

function actionTier(slot: Slot): Combat2104ActionTier {
  return slot === 'ultimate' ? 'ultimate' : slot === 'basic' ? 'normal' : 'skill';
}

function actionSlot(slot: Slot): Combat2104ActionSignature['slot'] {
  return slot === 'ultimate' ? 'ultimate' : slot === 'basic' ? 'basic' : slot === 0 ? 'skill-a' : 'skill-b';
}

function actionTraits(ability: Pick<CombatAbility, 'type' | 'status' | 'mechanic' | 'area' | 'hits' | 'sureHit' | 'unavoidable'>): Combat2104ActionTrait[] {
  const detail = norm(`${ability.type} ${ability.status} ${ability.mechanic}`);
  const traits: Combat2104ActionTrait[] = [];
  if (/(support|heal|restore|buff|cleanse|shield)/.test(detail)) traits.push('support');
  if (/(stun|freeze|paralysis|silence|choang|dong bang|te liet|cam lang|control)/.test(detail)) traits.push('control');
  if (Boolean(ability.area)) traits.push('area');
  if (Math.max(1, Number(ability.hits) || 1) > 1) traits.push('multi-hit');
  if (Boolean(ability.sureHit) || Boolean(ability.unavoidable) || /(pierce|xuyen)/.test(detail)) traits.push('pierce');
  if (/(shield|barrier|khien)/.test(detail)) traits.push('barrier');
  return traits.length ? traits : ['single'];
}

/** Presentation-only action context, shared by live combat and the no-damage QA controls. */
export function createCombat2104ActionSignature(pow: SignaturePow, ability: CombatAbility, slot: Slot): Combat2104ActionSignature {
  const visualHitCount = Math.min(4, Math.max(1, Math.floor(Number(ability.hits) || 1)));
  return {
    version: '2.19.4',
    role: roleKey(String(pow.role || '')),
    tier: actionTier(slot),
    slot: actionSlot(slot),
    abilityName: String(ability.name || 'Pow Skill'),
    traits: actionTraits(ability),
    rarity: String(pow.rarity || ''),
    // Presentation-only: the action renderer stages contacts without changing resolver hit math.
    visualHitCount
  };
}

export function createCombat2104QaSignature(pow: SignaturePow, tier: Combat2104ActionTier): Combat2104ActionSignature {
  return {
    version: '2.19.4',
    role: roleKey(String(pow.role || '')),
    tier,
    slot: tier === 'ultimate' ? 'ultimate' : tier === 'skill' ? 'skill-a' : 'basic',
    abilityName: `${roleKey(String(pow.role || '')).toUpperCase()} ${tier.toUpperCase()}`,
    traits: ['single']
  };
}

function slotScale(slot: Slot): number {
  return slot === 'ultimate' ? 1.32 : slot === 1 ? 1.12 : slot === 0 ? 1 : 0.82;
}

function buildRoleGlyph(scene: Phaser.Scene, key: Combat2104Role, color: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  if (key === 'marksman') {
    c.add([
      scene.add.circle(0, 0, 21, 0x000000, 0).setStrokeStyle(2, color, 0.78),
      scene.add.rectangle(0, 0, 52, 2, color, 0.7),
      scene.add.rectangle(0, 0, 2, 52, color, 0.7)
    ]);
  } else if (key === 'mage') {
    const g = scene.add.graphics();
    g.lineStyle(2.5, color, 0.8);
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? 27 : 12;
      points.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    g.beginPath(); g.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y); g.closePath(); g.strokePath();
    c.add(g);
  } else if (key === 'tank') {
    c.add([
      scene.add.rectangle(0, 0, 46, 36, 0x000000, 0).setStrokeStyle(3, color, 0.8),
      scene.add.rectangle(0, -18, 28, 5, color, 0.6),
      scene.add.rectangle(0, 18, 28, 5, color, 0.6)
    ]);
  } else if (key === 'fighter') {
    c.add([
      scene.add.rectangle(-8, 0, 42, 5, color, 0.78).setRotation(-0.72),
      scene.add.rectangle(8, 0, 42, 5, color, 0.78).setRotation(0.72),
      scene.add.circle(0, 0, 8, color, 0.24).setStrokeStyle(2, color, 0.72)
    ]);
  } else if (key === 'knight') {
    const g = scene.add.graphics();
    g.lineStyle(3, color, 0.82);
    g.beginPath(); g.moveTo(0, -27); g.lineTo(24, -14); g.lineTo(20, 13); g.lineTo(0, 29); g.lineTo(-20, 13); g.lineTo(-24, -14); g.closePath(); g.strokePath();
    c.add(g);
  } else if (key === 'healer') {
    c.add([
      scene.add.rectangle(0, 0, 12, 48, color, 0.72),
      scene.add.rectangle(0, 0, 48, 12, color, 0.72),
      scene.add.circle(0, 0, 28, 0x000000, 0).setStrokeStyle(2, color, 0.55)
    ]);
  } else if (key === 'musician') {
    c.add([
      scene.add.circle(-8, 15, 8, color, 0.78),
      scene.add.circle(18, 9, 8, color, 0.78),
      scene.add.rectangle(8, -5, 4, 42, color, 0.76).setRotation(-0.08),
      scene.add.rectangle(22, -11, 4, 37, color, 0.76).setRotation(-0.08),
      scene.add.rectangle(15, -26, 28, 4, color, 0.76).setRotation(-0.08)
    ]);
  } else if (key === 'assassin') {
    c.add([
      scene.add.triangle(-8, 0, -28, 8, 18, 0, -28, -8, color, 0.82).setRotation(-0.25),
      scene.add.triangle(10, 5, -22, 7, 21, 0, -22, -7, color, 0.62).setRotation(2.8)
    ]);
  } else {
    c.add([
      scene.add.circle(0, 0, 24, 0x000000, 0).setStrokeStyle(2, color, 0.76),
      scene.add.circle(0, 0, 10, color, 0.18).setStrokeStyle(2, color, 0.68),
      scene.add.rectangle(0, 0, 58, 2, color, 0.52).setRotation(0.62)
    ]);
  }
  return c;
}

function addElementMotif(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  elementKey: string,
  color: number,
  radius: number,
  intensity: number
): void {
  const key = norm(elementKey);
  const count = lowFx() ? 3 : 5;
  const motif = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

  if (key.includes('fire') || key.includes('lava') || key.includes('lua') || key.includes('dung nham')) {
    motif.fillStyle(color, 0.48);
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count;
      const x = Math.cos(a) * radius * 0.84;
      const y = Math.sin(a) * radius * 0.84;
      motif.fillTriangle(x, y - 13 * intensity, x - 8 * intensity, y + 9 * intensity, x + 8 * intensity, y + 9 * intensity);
    }
  } else if (key.includes('water') || key.includes('nuoc')) {
    motif.lineStyle(2.8, color, 0.66);
    motif.strokeEllipse(0, 0, radius * 2.3, radius * 0.76);
    motif.strokeEllipse(0, 0, radius * 1.62, radius * 0.5);
  } else if (key.includes('ice') || key.includes('bang')) {
    motif.lineStyle(2.4, color, 0.74);
    for (let i = 0; i < 6; i += 1) motif.lineBetween(0, 0, Math.cos((Math.PI * i) / 3) * radius, Math.sin((Math.PI * i) / 3) * radius);
  } else if (key.includes('lightning') || key.includes('storm') || key.includes('set') || key.includes('bao')) {
    motif.lineStyle(3, color, 0.8);
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (Math.PI * i) / 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      motif.lineBetween(-x * 0.24, -y * 0.24, x * 0.35, y * 0.35);
      motif.lineBetween(x * 0.35, y * 0.35, x, y * 0.8);
    }
  } else if (key.includes('wind') || key.includes('gio')) {
    motif.lineStyle(3, color, 0.72);
    motif.beginPath(); motif.arc(0, 0, radius, Phaser.Math.DegToRad(190), Phaser.Math.DegToRad(342), false); motif.strokePath();
    motif.beginPath(); motif.arc(0, 0, radius * 0.7, Phaser.Math.DegToRad(8), Phaser.Math.DegToRad(160), false); motif.strokePath();
  } else if (key.includes('leaf') || key.includes('la') || key.includes('poison') || key.includes('doc')) {
    motif.fillStyle(color, 0.48);
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count;
      const x = Math.cos(a) * radius * 0.78;
      const y = Math.sin(a) * radius * 0.78;
      motif.fillEllipse(x, y, key.includes('poison') || key.includes('doc') ? 10 : 18, key.includes('poison') || key.includes('doc') ? 10 : 8);
    }
  } else if (key.includes('earth') || key.includes('dat') || key.includes('steel') || key.includes('thep')) {
    motif.lineStyle(2.8, color, 0.76);
    for (let i = 0; i < 4; i += 1) motif.strokeRect(-radius * 0.32 + i * radius * 0.21, -radius * 0.72 + (i % 2) * 9, radius * 0.18, radius * 0.28);
  } else if (key.includes('light') || key.includes('anh sang')) {
    motif.lineStyle(2.6, color, 0.78);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      motif.lineBetween(Math.cos(a) * radius * 0.36, Math.sin(a) * radius * 0.36, Math.cos(a) * radius, Math.sin(a) * radius);
    }
  } else if (key.includes('dark') || key.includes('bong toi')) {
    motif.fillStyle(color, 0.28);
    motif.fillCircle(-radius * 0.18, 0, radius * 0.55);
    motif.fillStyle(0x06111c, 0.92);
    motif.fillCircle(radius * 0.12, -radius * 0.1, radius * 0.5);
  } else {
    motif.lineStyle(2.4, color, 0.62);
    motif.strokeCircle(0, 0, radius * 0.84);
  }
  root.add(motif);
}

function addTraitMarks(scene: Phaser.Scene, root: Phaser.GameObjects.Container, traits: Combat2104ActionTrait[], color: number, radius: number): void {
  const marks = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  if (traits.includes('support') || traits.includes('barrier')) {
    marks.lineStyle(3, 0xffffff, 0.7);
    marks.lineBetween(-radius * 0.26, 0, radius * 0.26, 0);
    marks.lineBetween(0, -radius * 0.26, 0, radius * 0.26);
  }
  if (traits.includes('control')) {
    marks.lineStyle(2.4, color, 0.86);
    marks.strokeRect(-radius * 0.34, -radius * 0.18, radius * 0.68, radius * 0.36);
  }
  if (traits.includes('area')) marks.strokeCircle(0, 0, radius * 0.9);
  if (traits.includes('multi-hit')) {
    marks.lineStyle(2.5, color, 0.76);
    for (const y of [-9, 0, 9]) marks.lineBetween(-radius * 0.62, y, radius * 0.62, y * 0.35);
  }
  if (traits.includes('pierce')) {
    marks.lineStyle(2.8, 0xffffff, 0.72);
    marks.lineBetween(-radius * 0.78, 0, radius * 0.78, 0);
  }
  root.add(marks);
}

async function showSignature(scene: PatchableScene, actor: CombatUnitState, ability: CombatAbility, slot: Slot): Promise<void> {
  // 2.20.1 owns cast circles in the presentation director. This context setter
  // remains intentionally visual-free so the previous single-ring renderer cannot overlap it.
  void scene;
  void actor;
  void ability;
  void slot;
}

/** A compact elemental seal at contact makes named skills readable without changing their existing renderer. */
export async function playCombat2104AbilityImpactAccent(
  options: DirectionalProjectileOptions,
  signature: Combat2104ActionSignature
): Promise<void> {
  await playCombat2201ImpactVfx(
    options.scene,
    options.target,
    options.element,
    signature.tier,
    signature.role,
    signature.traits,
    Boolean(options.reducedMotion)
  );
}

export function installCombat2104PowSkillSignaturePatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalBasic = proto.performBasicAttack;
  const originalAbility = proto.performAbility;

  proto.performBasicAttack = async function combat2104Basic(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState): Promise<void> {
    const view = this.powViews?.get(actor.instanceId) as SignatureView | undefined;
    const hadSignature = Boolean(view) && Object.prototype.hasOwnProperty.call(view, '__combat2104ActionSignature');
    const previousSignature = view?.__combat2104ActionSignature;
    if (view) view.__combat2104ActionSignature = createCombat2104ActionSignature(actor.pow, actor.pow.abilities.basic, 'basic');
    try {
      await showSignature(this, actor, actor.pow.abilities.basic, 'basic');
      await originalBasic.call(this, actor, target);
    } finally {
      if (view) {
        if (hadSignature) view.__combat2104ActionSignature = previousSignature;
        else delete view.__combat2104ActionSignature;
      }
    }
  };

  proto.performAbility = async function combat2104Ability(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate'): Promise<void> {
    const ability = slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
    const view = this.powViews?.get(actor.instanceId) as SignatureView | undefined;
    const hadSignature = Boolean(view) && Object.prototype.hasOwnProperty.call(view, '__combat2104ActionSignature');
    const previousSignature = view?.__combat2104ActionSignature;
    if (view) view.__combat2104ActionSignature = createCombat2104ActionSignature(actor.pow, ability, slot);
    try {
      await showSignature(this, actor, ability, slot);
      await originalAbility.call(this, actor, target, slot);
    } finally {
      if (view) {
        if (hadSignature) view.__combat2104ActionSignature = previousSignature;
        else delete view.__combat2104ActionSignature;
      }
    }
  };

  root.POWDER_COMBAT2_POW_SIGNATURE = {
    version: '2.19.4',
    mode: 'nine-profession-element-skill-signature',
    lowFx: lowFx(),
    roles: ['marksman', 'mage', 'tank', 'fighter', 'knight', 'assassin', 'enchanter', 'healer', 'musician'],
    slots: ['basic', 'skill-a', 'skill-b', 'ultimate'],
    note: 'role glyph + elemental motif + ability traits; presentation only'
  };
}
