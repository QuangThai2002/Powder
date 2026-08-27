import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

interface PatchableScene extends Phaser.Scene {
  powViews?: Map<string, any>;
  performBasicAttack?: (actor: CombatUnitState, target: CombatUnitState) => Promise<void>;
  performAbility?: (actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate') => Promise<void>;
  showPreBattleIntro?: () => void;
  startCombatFlow?: () => void;
}

type Slot = 'basic' | 0 | 1 | 'ultimate';
const PATCH_FLAG = '__powderCombat2104PowSkillSignatureInstalled';

function norm(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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

function roleKey(role: string): string {
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

function slotScale(slot: Slot): number {
  return slot === 'ultimate' ? 1.32 : slot === 1 ? 1.12 : slot === 0 ? 1 : 0.82;
}

function buildRoleGlyph(scene: Phaser.Scene, role: string, color: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const key = roleKey(role);
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

async function showSignature(scene: PatchableScene, actor: CombatUnitState, ability: CombatAbility, slot: Slot): Promise<void> {
  const view = scene.powViews?.get(actor.instanceId);
  const p = view?.getWorldPosition?.() as Phaser.Math.Vector2 | undefined;
  if (!p) return;

  const color = elementColor(actor.pow.elementKey);
  const identity = hash(`${actor.pow.id}:${ability.name}:${slot}`);
  const radius = 44 + (identity % 14);
  const scale = slotScale(slot);
  const sign = scene.add.container(p.x, p.y).setDepth(70).setScale(0.68 * scale).setAlpha(0.92);
  const outer = scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(slot === 'ultimate' ? 4 : 2.5, color, 0.82);
  const inner = scene.add.circle(0, 0, Math.round(radius * 0.62), color, 0.035).setStrokeStyle(1.5, 0xffffff, 0.32);
  const glyph = buildRoleGlyph(scene, actor.pow.role, color).setRotation(((identity >>> 5) % 16) * Math.PI / 16);
  sign.add([outer, inner, glyph]);

  const spokes = lowFx() ? 3 : 4 + (identity % 4);
  for (let i = 0; i < spokes; i += 1) {
    const angle = ((Math.PI * 2 * i) / spokes) + (((identity >>> 9) % 12) * Math.PI / 36);
    sign.add(scene.add.rectangle(Math.cos(angle) * (radius + 10), Math.sin(angle) * (radius + 10), 18 + (identity % 10), 3, color, 0.58).setRotation(angle));
  }

  const showName = slot !== 'basic';
  let label: Phaser.GameObjects.Text | null = null;
  if (showName) {
    label = scene.add.text(p.x, p.y + (actor.side === 'enemy' ? 78 : -78), ability.name.toUpperCase(), {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: slot === 'ultimate' ? '18px' : '13px',
      color: slot === 'ultimate' ? '#fff2b8' : '#e9faff',
      fontStyle: 'bold',
      stroke: '#031019',
      strokeThickness: 5,
      backgroundColor: '#041018bb',
      padding: { x: 9, y: 5 }
    }).setOrigin(0.5).setDepth(71).setAlpha(0.94);
  }

  if (reducedMotion()) {
    scene.time.delayedCall(slot === 'ultimate' ? 130 : 80, () => { sign.destroy(true); label?.destroy(); });
    return;
  }

  const duration = slot === 'ultimate' ? 220 : slot === 1 ? 150 : 115;
  await new Promise<void>((resolve) => {
    scene.tweens.add({
      targets: sign,
      scaleX: 1.16 * scale,
      scaleY: 1.16 * scale,
      angle: ((identity % 2) ? 1 : -1) * (slot === 'ultimate' ? 18 : 10),
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => resolve()
    });
    if (label) scene.tweens.add({ targets: label, alpha: 0, y: label.y + (actor.side === 'enemy' ? 8 : -8), delay: Math.round(duration * 0.36), duration: Math.round(duration * 0.7), ease: 'Quad.easeOut' });
  });
  sign.destroy(true);
  label?.destroy();
}

function installIntro(BattleSceneClass: any): void {
  const proto = BattleSceneClass.prototype as any;
  proto.showPreBattleIntro = function combat2104Intro(this: PatchableScene): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x02080e, 0.42);
    const plate = this.add.rectangle(width / 2, height / 2, Math.min(810, width * 0.84), 144, 0x081d2a, 0.96).setStrokeStyle(2, 0xd7b86c, 0.78);
    const title = this.add.text(width / 2, height / 2 - 22, 'POWDER COMBAT 2.10.4', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: height > width ? '31px' : '36px', color: '#fff6df', fontStyle: 'bold'
    }).setOrigin(0.5);
    const sub = this.add.text(width / 2, height / 2 + 24, 'POW SIGNATURE · ROLE GLYPH · SKILL IDENTITY', {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '13px', color: '#bfefff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const intro = this.add.container(0, 0, [shade, plate, title, sub]).setDepth(105);
    this.tweens.add({ targets: intro, alpha: 0, delay: 690, duration: 240, ease: 'Quad.easeOut', onComplete: () => { intro.destroy(true); this.startCombatFlow?.(); } });
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      this.add.text(width - 18, height - 58, '2.10.4 · POW SKILL SIGNATURE', {
        fontFamily: COMBAT_DISPLAY_FONT, fontSize: '11px', color: '#dff8ff', fontStyle: 'bold', backgroundColor: '#04101899', padding: { x: 7, y: 4 }
      }).setOrigin(1, 1).setDepth(98).setAlpha(0.72);
    }
  };
}

export function installCombat2104PowSkillSignaturePatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalBasic = proto.performBasicAttack;
  const originalAbility = proto.performAbility;

  proto.performBasicAttack = async function combat2104Basic(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState): Promise<void> {
    await showSignature(this, actor, actor.pow.abilities.basic, 'basic');
    await originalBasic.call(this, actor, target);
  };

  proto.performAbility = async function combat2104Ability(this: PatchableScene, actor: CombatUnitState, target: CombatUnitState, slot: 0 | 1 | 'ultimate'): Promise<void> {
    const ability = slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
    await showSignature(this, actor, ability, slot);
    await originalAbility.call(this, actor, target, slot);
  };

  installIntro(BattleSceneClass);
  root.POWDER_COMBAT2_POW_SIGNATURE = {
    version: '2.10.4',
    mode: 'deterministic-per-pow-per-skill',
    lowFx: lowFx(),
    note: 'role glyph + pow/ability hash; one-shot only'
  };
}
