import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import type { CombatUnitState } from '../systems/CombatState';
import { powVfxDepth } from '../vfx/CombatNightVfxLayout';
import { CombatPresentationDirector } from './CombatPresentationDirector';
import { COMBAT_BODY_FONT, COMBAT_DISPLAY_FONT } from './CombatTheme';

export const COMBAT2196_ARENA_PRESENTATION_VERSION = '2.19.6';

type Profession = 'marksman' | 'mage' | 'tank' | 'fighter' | 'knight' | 'assassin' | 'enchanter' | 'healer' | 'musician';
type Palette = { main: number; core: number; dark: number; text: string };
type PresentationTweenConfig = Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets' | 'onComplete' | 'onStop'>;

type PatchableScene = Phaser.Scene & {
  actionMenu?: Phaser.GameObjects.Container | null;
  roundText?: Phaser.GameObjects.Text;
  turnText?: Phaser.GameObjects.Text;
  __combat2196Hud?: Phaser.GameObjects.Container | null;
  __combat2196Deck?: Phaser.GameObjects.Container | null;
};

type RuntimePowView = {
  pow?: { role?: string; elementKey?: string; element?: string };
  side?: 'player' | 'enemy';
  reducedMotion?: boolean;
  getWorldPosition?: () => Phaser.Math.Vector2;
  __combat2104ActionSignature?: { role?: string; tier?: string; traits?: string[] };
};

const PATCH_FLAG = '__powderCombat2196ArenaPresentationInstalled';

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function resolvePalette(element: unknown): Palette {
  const key = normalize(element);
  if (key.includes('lava') || key.includes('dung nham')) return { main: 0xf15c3e, core: 0xffdc78, dark: 0x5c231a, text: '#ffd6a6' };
  if (key.includes('fire') || key.includes('lua')) return { main: 0xff7649, core: 0xffe5ae, dark: 0x62251b, text: '#ffd5bb' };
  if (key.includes('water') || key.includes('nuoc')) return { main: 0x5bc9f4, core: 0xe9fbff, dark: 0x1e5e78, text: '#c8f1ff' };
  if (key.includes('ice') || key.includes('bang')) return { main: 0x9ce8ff, core: 0xffffff, dark: 0x356f84, text: '#e8fbff' };
  if (key.includes('lightning') || key.includes('set')) return { main: 0xf6da62, core: 0xffffe7, dark: 0x756218, text: '#fff0a8' };
  if (key.includes('storm') || key.includes('bao')) return { main: 0x8da8ff, core: 0xf3f5ff, dark: 0x40528a, text: '#dce6ff' };
  if (key.includes('wind') || key.includes('gio')) return { main: 0x75dfcb, core: 0xf1fffc, dark: 0x2d7268, text: '#d6fff6' };
  if (key.includes('leaf') || key.includes('la')) return { main: 0x78d788, core: 0xf0ffe9, dark: 0x315f3a, text: '#d8ffd9' };
  if (key.includes('poison') || key.includes('doc')) return { main: 0xa7d56a, core: 0xf4ffd7, dark: 0x4c672b, text: '#e5ffc4' };
  if (key.includes('earth') || key.includes('dat')) return { main: 0xc09369, core: 0xffe4bf, dark: 0x634933, text: '#ffe0bd' };
  if (key.includes('steel') || key.includes('thep')) return { main: 0xc9d9e2, core: 0xffffff, dark: 0x52636b, text: '#e9f8ff' };
  if (key.includes('light') || key.includes('anh sang')) return { main: 0xffe5a3, core: 0xffffff, dark: 0x7e7040, text: '#fff5c8' };
  if (key.includes('dark') || key.includes('bong toi')) return { main: 0xaf8be9, core: 0xf7f1ff, dark: 0x4e386a, text: '#e9dcff' };
  return { main: 0x7bdced, core: 0xf1ffff, dark: 0x285d69, text: '#d6f8ff' };
}

function resolveProfession(role: unknown): Profession {
  const key = normalize(role);
  if (key.includes('xa thu') || key.includes('marksman')) return 'marksman';
  if (key.includes('phap su') || key.includes('mage')) return 'mage';
  if (key.includes('do don') || key.includes('tank')) return 'tank';
  if (key.includes('dau si') || key.includes('fighter')) return 'fighter';
  if (key.includes('hiep si') || key.includes('knight')) return 'knight';
  if (key.includes('sat thu') || key.includes('assassin')) return 'assassin';
  if (key.includes('tri lieu') || key.includes('healer')) return 'healer';
  if (key.includes('nhac cong') || key.includes('musician')) return 'musician';
  return 'enchanter';
}

function colorFromCss(value: string): number {
  return Phaser.Display.Color.HexStringToColor(value).color;
}

function tween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: PresentationTweenConfig,
  fallbackMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let activeTween: Phaser.Tweens.Tween | null = null;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
      scene.events.off(Phaser.Scenes.Events.DESTROY, abort);
      resolve();
    };
    const abort = (): void => {
      try { activeTween?.stop(); } catch { /* scene teardown only */ }
      finish();
    };
    const timer = window.setTimeout(finish, fallbackMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
    scene.events.once(Phaser.Scenes.Events.DESTROY, abort);
    try {
      activeTween = scene.tweens.add({ ...config, targets: target, onComplete: finish, onStop: finish });
    } catch { finish(); }
  });
}

function abilityTraits(ability: CombatAbility): { support: boolean; control: boolean; area: boolean; multiHit: boolean } {
  const detail = normalize(`${ability.type} ${ability.status} ${ability.mechanic}`);
  return {
    support: /(support|heal|restore|cleanse|shield|buff)/.test(detail),
    control: /(stun|freeze|paralysis|silence|choang|dong bang|te liet|cam lang|control)/.test(detail),
    area: Boolean(ability.area),
    multiHit: Math.max(1, Number(ability.hits) || 1) > 1
  };
}

function addRoleCrest(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  role: Profession,
  palette: Palette,
  radius: number
): void {
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  g.lineStyle(3.2, palette.main, 0.88);
  g.fillStyle(palette.main, 0.1);

  if (role === 'marksman') {
    g.strokeCircle(0, 0, radius * 0.42);
    g.lineBetween(-radius * 0.9, 0, radius * 0.9, 0);
    g.lineBetween(0, -radius * 0.9, 0, radius * 0.9);
    g.fillTriangle(radius * 0.74, 0, radius * 0.38, -radius * 0.18, radius * 0.38, radius * 0.18);
  } else if (role === 'mage') {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const distance = i % 2 ? radius * 0.38 : radius * 0.76;
      points.push(new Phaser.Math.Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance));
    }
    g.beginPath(); g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y);
    g.closePath(); g.strokePath();
    g.strokeCircle(0, 0, radius * 0.28);
  } else if (role === 'tank') {
    g.strokeRect(-radius * 0.56, -radius * 0.48, radius * 1.12, radius * 0.96);
    g.lineBetween(-radius * 0.32, 0, radius * 0.32, 0);
    g.lineBetween(0, -radius * 0.3, 0, radius * 0.3);
  } else if (role === 'fighter') {
    g.strokeCircle(radius * 0.1, 0, radius * 0.42);
    g.lineBetween(-radius * 0.86, -radius * 0.22, radius * 0.7, radius * 0.22);
    g.lineBetween(-radius * 0.86, radius * 0.22, radius * 0.7, -radius * 0.22);
  } else if (role === 'knight') {
    g.lineStyle(4.3, palette.main, 0.92);
    g.lineBetween(-radius * 0.74, radius * 0.58, radius * 0.74, -radius * 0.58);
    g.lineStyle(2.1, palette.core, 0.9);
    g.lineBetween(-radius * 0.84, radius * 0.25, radius * 0.62, -radius * 0.78);
  } else if (role === 'assassin') {
    g.lineBetween(-radius * 0.74, -radius * 0.58, radius * 0.74, radius * 0.58);
    g.lineBetween(-radius * 0.74, radius * 0.58, radius * 0.74, -radius * 0.58);
    g.lineStyle(1.6, palette.core, 0.72);
    g.lineBetween(-radius * 0.46, -radius * 0.8, radius * 0.5, radius * 0.04);
  } else if (role === 'healer') {
    g.lineStyle(4, palette.main, 0.88);
    g.lineBetween(-radius * 0.58, 0, radius * 0.58, 0);
    g.lineBetween(0, -radius * 0.58, 0, radius * 0.58);
    g.lineStyle(2, palette.core, 0.74);
    g.strokeCircle(0, 0, radius * 0.76);
  } else if (role === 'musician') {
    g.fillStyle(palette.main, 0.88);
    g.fillCircle(-radius * 0.24, radius * 0.36, radius * 0.17);
    g.fillCircle(radius * 0.4, radius * 0.16, radius * 0.17);
    g.lineStyle(3.4, palette.main, 0.9);
    g.lineBetween(-radius * 0.08, radius * 0.35, -radius * 0.08, -radius * 0.55);
    g.lineBetween(radius * 0.56, radius * 0.15, radius * 0.56, -radius * 0.76);
    g.lineBetween(-radius * 0.08, -radius * 0.55, radius * 0.56, -radius * 0.76);
  } else {
    g.strokeCircle(0, 0, radius * 0.7);
    g.strokeCircle(0, 0, radius * 0.32);
    g.lineBetween(-radius * 0.72, radius * 0.72, radius * 0.72, -radius * 0.72);
  }
  root.add(g);
}

function addElementOrbit(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  element: unknown,
  palette: Palette,
  radius: number,
  strength: number
): void {
  const key = normalize(element);
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const count = reducedMotion() ? 3 : 6;
  g.lineStyle(2.2, palette.main, 0.7);

  if (key.includes('fire') || key.includes('lava') || key.includes('lua') || key.includes('dung nham')) {
    g.fillStyle(palette.main, 0.58);
    for (let i = 0; i < count; i += 1) {
      const a = i * Math.PI * 2 / count;
      const x = Math.cos(a) * radius * 0.9;
      const y = Math.sin(a) * radius * 0.9;
      g.fillTriangle(x, y - 11 * strength, x - 7 * strength, y + 8 * strength, x + 7 * strength, y + 8 * strength);
    }
  } else if (key.includes('water') || key.includes('nuoc')) {
    g.strokeEllipse(0, 0, radius * 2.2, radius * 0.72);
    g.lineStyle(1.6, palette.core, 0.56);
    g.strokeEllipse(0, 0, radius * 1.58, radius * 0.48);
  } else if (key.includes('ice') || key.includes('bang')) {
    for (let i = 0; i < 6; i += 1) {
      const a = i * Math.PI / 3;
      g.lineBetween(Math.cos(a) * radius * 0.18, Math.sin(a) * radius * 0.18, Math.cos(a) * radius, Math.sin(a) * radius);
    }
  } else if (key.includes('lightning') || key.includes('storm') || key.includes('set') || key.includes('bao')) {
    g.lineStyle(3, palette.main, 0.88);
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      g.lineBetween(-x * 0.2, -y * 0.2, x * 0.34, y * 0.34);
      g.lineBetween(x * 0.34, y * 0.34, x * 0.82, y * 0.72);
    }
  } else if (key.includes('wind') || key.includes('gio')) {
    g.beginPath(); g.arc(0, 0, radius, Phaser.Math.DegToRad(190), Phaser.Math.DegToRad(342), false); g.strokePath();
    g.beginPath(); g.arc(0, 0, radius * 0.67, Phaser.Math.DegToRad(8), Phaser.Math.DegToRad(160), false); g.strokePath();
  } else if (key.includes('leaf') || key.includes('la') || key.includes('poison') || key.includes('doc')) {
    g.fillStyle(palette.main, 0.52);
    for (let i = 0; i < count; i += 1) {
      const a = i * Math.PI * 2 / count;
      const x = Math.cos(a) * radius * 0.78;
      const y = Math.sin(a) * radius * 0.78;
      g.fillEllipse(x, y, key.includes('poison') || key.includes('doc') ? 9 : 17, key.includes('poison') || key.includes('doc') ? 9 : 7);
    }
  } else if (key.includes('earth') || key.includes('dat') || key.includes('steel') || key.includes('thep')) {
    for (let i = 0; i < 4; i += 1) g.strokeRect(-radius * 0.46 + i * radius * 0.27, -radius * 0.7 + (i % 2) * 10, radius * 0.2, radius * 0.32);
  } else if (key.includes('light') || key.includes('anh sang')) {
    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4;
      g.lineBetween(Math.cos(a) * radius * 0.35, Math.sin(a) * radius * 0.35, Math.cos(a) * radius, Math.sin(a) * radius);
    }
  } else if (key.includes('dark') || key.includes('bong toi')) {
    g.fillStyle(palette.main, 0.26);
    g.fillCircle(-radius * 0.18, 0, radius * 0.58);
    g.fillStyle(0x06111c, 0.92);
    g.fillCircle(radius * 0.12, -radius * 0.1, radius * 0.5);
  } else {
    g.strokeCircle(0, 0, radius * 0.86);
  }
  root.add(g);
}

function addTraitMarks(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  traits: ReturnType<typeof abilityTraits>,
  palette: Palette,
  radius: number
): void {
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  if (traits.support) {
    g.lineStyle(3.2, palette.core, 0.76);
    g.lineBetween(-radius * 0.24, 0, radius * 0.24, 0);
    g.lineBetween(0, -radius * 0.24, 0, radius * 0.24);
  }
  if (traits.control) {
    g.lineStyle(2.5, palette.main, 0.82);
    g.strokeRect(-radius * 0.35, -radius * 0.2, radius * 0.7, radius * 0.4);
  }
  if (traits.area) {
    g.lineStyle(2, palette.core, 0.58);
    g.strokeCircle(0, 0, radius * 1.05);
  }
  if (traits.multiHit) {
    g.lineStyle(2.4, palette.main, 0.76);
    [-8, 0, 8].forEach((y) => g.lineBetween(-radius * 0.62, y, radius * 0.62, y * 0.34));
  }
  root.add(g);
}

async function playSkillCastFrame(
  scene: Phaser.Scene,
  actorView: RuntimePowView | undefined,
  targetView: RuntimePowView | undefined,
  ability: CombatAbility,
  slot: 0 | 1,
  elementKey: string,
  selfTargeted: boolean
): Promise<void> {
  const source = actorView?.getWorldPosition?.();
  if (!source) return;
  const palette = resolvePalette(elementKey);
  const role = resolveProfession(actorView?.pow?.role);
  const traits = abilityTraits(ability);
  const radius = slot === 0 ? 54 : 64;
  const root = scene.add.container(source.x, source.y)
    .setDepth(powVfxDepth('foreground') + 20)
    .setScale(0.66);
  const outer = scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(slot === 0 ? 2.4 : 3.2, palette.main, 0.88);
  const inner = scene.add.circle(0, 0, radius * 0.58, palette.main, 0.055).setStrokeStyle(1.3, palette.core, 0.54);
  root.add([outer, inner]);
  addElementOrbit(scene, root, elementKey, palette, radius, slot === 0 ? 1 : 1.16);
  addRoleCrest(scene, root, role, palette, radius);
  addTraitMarks(scene, root, traits, palette, radius);

  const target = !selfTargeted ? targetView?.getWorldPosition?.() : undefined;
  const guide = scene.add.graphics().setDepth(powVfxDepth('foreground') + 17).setBlendMode(Phaser.BlendModes.ADD);
  if (target) {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const bend = slot === 0 ? 18 : 34;
    const mx = (source.x + target.x) / 2 + Math.cos(angle + Math.PI / 2) * bend;
    const my = (source.y + target.y) / 2 + Math.sin(angle + Math.PI / 2) * bend;
    guide.lineStyle(slot === 0 ? 2 : 3, palette.main, 0.3);
    guide.beginPath(); guide.moveTo(source.x, source.y); guide.lineTo(mx, my); guide.lineTo(target.x, target.y); guide.strokePath();
  }

  const duration = reducedMotion() ? 100 : slot === 0 ? 165 : 205;
  try {
    await Promise.all([
      tween(scene, root, {
        scaleX: slot === 0 ? 1.18 : 1.28,
        scaleY: slot === 0 ? 1.18 : 1.28,
        rotation: slot === 0 ? 0.16 : -0.24,
        alpha: 0,
        duration,
        ease: 'Cubic.easeOut'
      }, duration + 250),
      tween(scene, guide, { alpha: 0, duration: Math.max(90, duration - 20), ease: 'Quad.easeOut' }, duration + 220)
    ]);
  } finally {
    root.destroy(true);
    guide.destroy();
  }
}

async function playUltimateRoleCrest(
  scene: Phaser.Scene,
  actorView: RuntimePowView | undefined,
  elementKey: string
): Promise<void> {
  const point = actorView?.getWorldPosition?.();
  if (!point) return;
  const palette = resolvePalette(elementKey);
  const root = scene.add.container(point.x, point.y).setDepth(79).setScale(0.46);
  const outer = scene.add.circle(0, 0, 116, palette.main, 0.07).setStrokeStyle(5, palette.main, 0.9);
  const inner = scene.add.circle(0, 0, 76, 0x000000, 0).setStrokeStyle(2.6, palette.core, 0.66);
  root.add([outer, inner]);
  addElementOrbit(scene, root, elementKey, palette, 112, 1.42);
  addRoleCrest(scene, root, resolveProfession(actorView?.pow?.role), palette, 78);
  try {
    await tween(scene, root, {
      scaleX: 1.34,
      scaleY: 1.34,
      rotation: reducedMotion() ? 0 : 0.44,
      alpha: 0,
      duration: reducedMotion() ? 230 : 620,
      ease: 'Quad.easeOut'
    }, 920);
  } finally { root.destroy(true); }
}

function cleanupDeck(scene: PatchableScene): void {
  scene.__combat2196Deck?.destroy(true);
  scene.__combat2196Deck = null;
}

function decorateActionDeck(scene: PatchableScene, actor: CombatUnitState): void {
  cleanupDeck(scene);
  const menu = scene.actionMenu;
  if (!menu || actor.side !== 'player') return;

  const portrait = scene.scale.height > scene.scale.width;
  const compact = portrait || scene.scale.width < 1180;
  const overlayTop = Math.round(scene.scale.height * (compact ? 0.36 : 0.625));
  const panelWidth = Math.min(scene.scale.width - (compact ? 30 : 96), compact ? 740 : 1060);
  const panelHeight = compact ? 62 : 66;
  const palette = resolvePalette(actor.pow.elementKey || actor.pow.element);
  const root = scene.add.container(scene.scale.width / 2, overlayTop + 29);
  const shadow = scene.add.rectangle(0, 7, panelWidth + 20, panelHeight + 14, 0x01060b, 0.44).setOrigin(0.5);
  const plate = scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x061623, 0.76).setStrokeStyle(1.5, palette.main, 0.78);
  const inset = scene.add.rectangle(0, 0, panelWidth - 18, panelHeight - 16, 0x0a2030, 0.28).setStrokeStyle(1, palette.core, 0.22);
  const rail = scene.add.rectangle(0, -panelHeight / 2 + 4, panelWidth - 16, 4, palette.main, 0.88);
  const underside = scene.add.rectangle(0, panelHeight / 2 - 4, panelWidth - 42, 1, palette.core, 0.32);
  root.add([shadow, plate, inset, rail, underside]);

  const crest = scene.add.container(-panelWidth / 2 + 34, 0);
  crest.add(scene.add.circle(0, 0, compact ? 19 : 22, 0x020d15, 0.72).setStrokeStyle(1.5, palette.main, 0.86));
  addRoleCrest(scene, crest, resolveProfession(actor.pow.role), palette, compact ? 13 : 15);
  root.add(crest);

  const rage = Math.max(0, Math.min(8, Math.floor(Number(actor.ragePoints) || 0)));
  const markerX = panelWidth / 2 - (compact ? 112 : 136);
  for (let i = 0; i < 4; i += 1) {
    const filled = rage >= (i + 1) || rage >= (i + 5);
    const overflow = rage >= i + 5;
    root.add(scene.add.rectangle(markerX + i * (compact ? 18 : 22), compact ? 8 : 9, compact ? 12 : 15, 5, overflow ? 0xff6675 : palette.main, filled ? 0.96 : 0.2));
  }
  root.add(scene.add.text(panelWidth / 2 - 18, -11, `NỘ ${rage}/8`, {
    fontFamily: COMBAT_DISPLAY_FONT,
    fontSize: compact ? '10px' : '11px',
    color: rage >= 4 ? '#ffe58b' : palette.text,
    fontStyle: 'bold'
  }).setOrigin(1, 0.5));

  // Combat27 owns the interactive overlay. Adding this at index 1 keeps the accent
  // above its dimmer but beneath its title, cards, and hit areas without moving them.
  menu.addAt(root, 1);
  scene.__combat2196Deck = root;
}

function decorateRoundHud(scene: PatchableScene): void {
  scene.__combat2196Hud?.destroy(true);
  const round = scene.roundText;
  const turn = scene.turnText;
  if (!round || !turn) return;

  const y = scene.scale.height / 2 - 47;
  const root = scene.add.container(scene.scale.width / 2, y).setDepth(39).setAlpha(0);
  const shadow = scene.add.rectangle(0, 5, 416, 92, 0x02070c, 0.44);
  const plate = scene.add.rectangle(0, 0, 396, 78, 0x061723, 0.87).setStrokeStyle(1.5, 0xd7bc72, 0.62);
  const core = scene.add.rectangle(0, 0, 360, 58, 0x0c2636, 0.45).setStrokeStyle(1, 0x88dbec, 0.2);
  const left = scene.add.triangle(-183, 0, -12, 0, 12, -10, 12, 10, 0x77dced, 0.76);
  const right = scene.add.triangle(183, 0, 12, 0, -12, -10, -12, 10, 0xffc281, 0.62);
  root.add([shadow, plate, core, left, right]);
  scene.__combat2196Hud = root;

  round
    .setPosition(scene.scale.width / 2, y - 17)
    .setDepth(41)
    .setStyle({ fontFamily: COMBAT_DISPLAY_FONT, fontSize: '19px', color: '#fff3c9', fontStyle: 'bold', backgroundColor: '#00000000', padding: { x: 6, y: 2 }, stroke: '#02080d', strokeThickness: 3 });
  turn
    .setPosition(scene.scale.width / 2, y + 17)
    .setDepth(41)
    .setStyle({ fontFamily: COMBAT_BODY_FONT, fontSize: '14px', color: '#bce9f4', fontStyle: 'bold', backgroundColor: '#00000000', padding: { x: 5, y: 1 }, stroke: '#02080d', strokeThickness: 2 });

  scene.tweens.add({ targets: root, alpha: 1, y: y - 3, duration: reducedMotion() ? 90 : 220, ease: 'Quad.easeOut' });
}

function spawnActionAccent(scene: Phaser.Scene, view: RuntimePowView | undefined, name: string, color: string): void {
  const point = view?.getWorldPosition?.();
  if (!view || !point) return;
  const signature = view.__combat2104ActionSignature;
  const palette = resolvePalette(view.pow?.elementKey || view.pow?.element);
  const accent = signature ? palette.main : colorFromCss(color);
  const y = point.y < scene.scale.height / 2 ? Math.min(scene.scale.height / 2 - 115, point.y + 160) : Math.max(scene.scale.height / 2 + 115, point.y - 160);
  const ultimate = signature?.tier === 'ultimate';
  const width = Math.min(468, Math.max(244, 144 + String(name || '').length * 8.8 + (ultimate ? 58 : 0)));
  const height = ultimate ? 64 : 50;
  const root = scene.add.container(point.x, y).setDepth(45).setScale(reducedMotion() ? 1 : 0.9).setAlpha(reducedMotion() ? 0.78 : 0.96);
  const shadow = scene.add.rectangle(0, 5, width + 18, height + 12, 0x01050a, 0.42);
  const plate = scene.add.rectangle(0, 0, width, height, 0x061521, 0.72).setStrokeStyle(ultimate ? 2.2 : 1.5, accent, ultimate ? 0.88 : 0.7);
  const rail = scene.add.rectangle(0, -height / 2 + 3, width - 16, 3, accent, 0.86).setBlendMode(Phaser.BlendModes.ADD);
  const lowerRail = scene.add.rectangle(0, height / 2 - 3, width - 40, 1, palette.core, 0.3);
  root.add([shadow, plate, rail, lowerRail]);

  const crest = scene.add.container(-width / 2 + 27, 0);
  crest.add(scene.add.circle(0, 0, ultimate ? 20 : 17, 0x020c14, 0.78).setStrokeStyle(1.5, accent, 0.86));
  addRoleCrest(scene, crest, resolveProfession(signature?.role || view.pow?.role), palette, ultimate ? 13 : 11);
  root.add(crest);

  const traits = Array.isArray(signature?.traits) ? signature.traits.slice(0, 4) : [];
  traits.forEach((trait, index) => {
    const traitColor = trait === 'control' ? 0xffe47c : trait === 'support' || trait === 'barrier' ? 0x8df2c2 : accent;
    const x = width / 2 - 22 - index * 13;
    root.add(scene.add.circle(x, 0, 3.6, traitColor, 0.92).setStrokeStyle(1, palette.core, 0.62));
  });

  void tween(scene, root, {
    scaleX: reducedMotion() ? 1 : ultimate ? 1.1 : 1.06,
    scaleY: reducedMotion() ? 1 : ultimate ? 1.1 : 1.06,
    alpha: 0,
    duration: reducedMotion() ? 150 : ultimate ? 430 : 310,
    ease: 'Cubic.easeOut'
  }, ultimate ? 760 : 580)
    .finally(() => root.destroy(true));
}

function spawnDamageAccent(scene: Phaser.Scene, view: RuntimePowView, crit: boolean): void {
  const point = view.getWorldPosition?.();
  if (!point) return;
  const color = crit ? 0xffee9b : 0xff9f75;
  const root = scene.add.container(point.x, point.y - 44).setDepth(48).setScale(0.52);
  const ring = scene.add.circle(0, 0, crit ? 64 : 48, 0x000000, 0).setStrokeStyle(crit ? 4 : 2.5, color, 0.74);
  root.add(ring);
  const rays = crit ? 8 : 4;
  for (let i = 0; i < rays; i += 1) {
    const a = Math.PI * 2 * i / rays;
    root.add(scene.add.rectangle(Math.cos(a) * 42, Math.sin(a) * 42, crit ? 28 : 18, 3, color, 0.72).setRotation(a));
  }
  void tween(scene, root, { scaleX: crit ? 1.65 : 1.38, scaleY: crit ? 1.65 : 1.38, alpha: 0, duration: reducedMotion() ? 130 : 230, ease: 'Cubic.easeOut' }, 460)
    .finally(() => root.destroy(true));
}

function installDirectorPresentation(): void {
  const proto = CombatPresentationDirector.prototype as any;
  if (proto.__combat2196ArenaPresentationInstalled) return;
  proto.__combat2196ArenaPresentationInstalled = true;

  const originalSkill = proto.playSkillIntro;
  if (typeof originalSkill === 'function') {
    proto.playSkillIntro = async function combat2196SkillIntro(
      this: { scene: Phaser.Scene },
      actorView: RuntimePowView | undefined,
      targetView: RuntimePowView | undefined,
      ability: CombatAbility,
      slot: 0 | 1,
      elementKey: string,
      selfTargeted: boolean
    ): Promise<void> {
      await Promise.all([
        originalSkill.call(this, actorView, targetView, ability, slot, elementKey, selfTargeted),
        playSkillCastFrame(this.scene, actorView, targetView, ability, slot, elementKey, selfTargeted)
      ]);
    };
  }

  const originalUltimate = proto.playUltimateIntro;
  if (typeof originalUltimate === 'function') {
    proto.playUltimateIntro = async function combat2196UltimateIntro(
      this: { scene: Phaser.Scene },
      actorView: RuntimePowView | undefined,
      ability: CombatAbility,
      side: 'player' | 'enemy',
      elementKey: string
    ): Promise<void> {
      await Promise.all([
        originalUltimate.call(this, actorView, ability, side, elementKey),
        playUltimateRoleCrest(this.scene, actorView, elementKey)
      ]);
    };
  }
}

export function installCombat2196ArenaPresentationPatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalCreate = proto.create;
  const originalCreateMenu = proto.createActionMenu;
  const originalDestroyMenu = proto.destroyActionMenu;
  const originalActionBanner = proto.showActionBanner;
  const originalDamageNumber = proto.showDamageNumber;

  if (typeof originalCreate === 'function') {
    proto.create = function combat2196Create(this: PatchableScene, ...args: unknown[]): unknown {
      const result = originalCreate.apply(this, args);
      decorateRoundHud(this);
      return result;
    };
  }

  if (typeof originalCreateMenu === 'function') {
    proto.createActionMenu = function combat2196CreateActionMenu(this: PatchableScene, actor: CombatUnitState): void {
      cleanupDeck(this);
      originalCreateMenu.call(this, actor);
      decorateActionDeck(this, actor);
    };
  }

  if (typeof originalDestroyMenu === 'function') {
    proto.destroyActionMenu = function combat2196DestroyActionMenu(this: PatchableScene): void {
      cleanupDeck(this);
      originalDestroyMenu.call(this);
    };
  }

  if (typeof originalActionBanner === 'function') {
    proto.showActionBanner = function combat2196ActionBanner(this: Phaser.Scene, view: RuntimePowView | undefined, name: string, color: string): void {
      spawnActionAccent(this, view, name, color);
      originalActionBanner.call(this, view, name, color);
    };
  }

  if (typeof originalDamageNumber === 'function') {
    proto.showDamageNumber = function combat2196DamageNumber(
      this: Phaser.Scene,
      view: RuntimePowView,
      hpDamage: number,
      shieldDamage: number,
      defeated: boolean,
      crit = false
    ): void {
      spawnDamageAccent(this, view, crit);
      originalDamageNumber.call(this, view, hpDamage, shieldDamage, defeated, crit);
    };
  }

  installDirectorPresentation();
  root.POWDER_COMBAT2_ARENA_PRESENTATION = {
    version: COMBAT2196_ARENA_PRESENTATION_VERSION,
    direction: 'arcane-arena-command-deck',
    hud: 'center-round-console',
    actionMenu: 'element-accented-responsive-deck',
    skillCast: 'profession-element-trait-frame',
    ultimate: 'role-crest-over-cinematic',
    oneShotOnly: true,
    reducedMotion: reducedMotion(),
    combatLogicChanged: false
  };
}
