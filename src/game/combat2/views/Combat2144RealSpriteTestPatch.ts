import Phaser from 'phaser';
import type { CombatAbility } from '../data/CombatPow';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

const FLAG = '__combat2144RealSpriteTest';
const VERSION = '2.14.4';
const ACTION_SHEET = 'combat2144-real-action';
const ACTION_URL = '/assets/combat/vfx/real/action-test6-12x6.webp';
const STATUS_SHEET = 'combat2144-real-status';
const STATUS_URL = '/assets/combat/vfx/real/status-test5-12x5.webp';
const CTX = '__combat2144ctx';
const PERSIST = '__combat2144persist';

const ELEMENT_ROWS = { fire: 0, water: 1, ice: 2, earth: 3, storm: 4, steel: 5 } as const;
const STATUS_ROWS = { burn: 0, freeze: 1, stun: 2, heal: 3, shield: 4 } as const;
type ElementVfx = keyof typeof ELEMENT_ROWS;
type StatusVfx = keyof typeof STATUS_ROWS;

function plain(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function element(value: unknown): ElementVfx | null {
  const text = plain(value);
  if (text.includes('fire') || text.includes('lua')) return 'fire';
  if (text.includes('water') || text.includes('nuoc')) return 'water';
  if (text.includes('ice') || text.includes('bang')) return 'ice';
  if (text.includes('earth') || text.includes('dat')) return 'earth';
  if (text.includes('storm') || text.includes('bao') || text.includes('lightning') || text.includes('set') || text.includes('electric')) return 'storm';
  if (text.includes('steel') || text.includes('thep')) return 'steel';
  return null;
}
function status(value: unknown): StatusVfx | null {
  const text = plain(value);
  if (text.includes('burn') || text.includes('thieu dot')) return 'burn';
  if (text.includes('freeze') || text.includes('dong bang') || text.includes('frost')) return 'freeze';
  if (text.includes('stun') || text.includes('choang') || text.includes('paralysis') || text.includes('te liet')) return 'stun';
  if (text.includes('shield') || text.includes('khien') || text.includes('barrier') || text.includes('guard')) return 'shield';
  if (text.includes('heal') || text.includes('hoi mau') || text.includes('hoi phuc') || text.includes('regeneration') || text.includes('revive')) return 'heal';
  return null;
}
function own(view: any): ElementVfx | null {
  return element(`${view?.pow?.elementKey || ''} ${view?.pow?.element || ''}`);
}
function abilityStatus(ability?: CombatAbility): StatusVfx | null {
  return ability ? status(`${ability.name || ''} ${ability.type || ''} ${ability.status || ''} ${ability.description || ''}`) : null;
}
function actionKey(kind: ElementVfx, phase: 'cast' | 'travel' | 'impact' | 'loop'): string {
  return `combat2144-action-${kind}-${phase}`;
}
function statusKey(kind: StatusVfx, phase: 'burst' | 'loop' | 'break'): string {
  return `combat2144-status-${kind}-${phase}`;
}

function ensureAnimations(scene: Phaser.Scene): number {
  let count = 0;
  if (scene.textures.exists(ACTION_SHEET)) {
    for (const kind of Object.keys(ELEMENT_ROWS) as ElementVfx[]) {
      const base = ELEMENT_ROWS[kind] * 12;
      const definitions: Array<['cast' | 'travel' | 'impact' | 'loop', number, number, number, number]> = [
        ['cast', 0, 4, 8, 0],
        ['travel', 2, 7, 14, -1],
        ['impact', 4, 11, 9, 0],
        ['loop', 0, 11, 7, -1]
      ];
      for (const [phase, start, end, frameRate, repeat] of definitions) {
        const key = actionKey(kind, phase);
        if (!scene.anims.exists(key)) {
          scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(ACTION_SHEET, { start: base + start, end: base + end }), frameRate, repeat, skipMissedFrames: true });
        }
        if (scene.anims.exists(key)) count += 1;
      }
    }
  }
  if (scene.textures.exists(STATUS_SHEET)) {
    for (const kind of Object.keys(STATUS_ROWS) as StatusVfx[]) {
      const base = STATUS_ROWS[kind] * 12;
      const burst = statusKey(kind, 'burst');
      const loop = statusKey(kind, 'loop');
      const reverse = statusKey(kind, 'break');
      if (!scene.anims.exists(burst)) scene.anims.create({ key: burst, frames: scene.anims.generateFrameNumbers(STATUS_SHEET, { start: base, end: base + 11 }), frameRate: 8, repeat: 0, skipMissedFrames: true });
      if (!scene.anims.exists(loop)) scene.anims.create({ key: loop, frames: scene.anims.generateFrameNumbers(STATUS_SHEET, { start: base, end: base + 11 }), frameRate: 7, repeat: -1, skipMissedFrames: true });
      if (!scene.anims.exists(reverse)) scene.anims.create({ key: reverse, frames: scene.anims.generateFrameNumbers(STATUS_SHEET, { start: base + 11, end: base }), frameRate: 10, repeat: 0, skipMissedFrames: true });
      if (scene.anims.exists(burst)) count += 1;
      if (scene.anims.exists(loop)) count += 1;
      if (scene.anims.exists(reverse)) count += 1;
    }
  }
  return count;
}

function position(view: any): Phaser.Math.Vector2 {
  try { return view.getWorldPosition() as Phaser.Math.Vector2; }
  catch { return new Phaser.Math.Vector2(view?.container?.x || 0, view?.container?.y || 0); }
}
function actionSprite(scene: Phaser.Scene, x: number, y: number, size: number, depth = 64, alpha = 0.98): Phaser.GameObjects.Sprite | null {
  if (!scene.textures.exists(ACTION_SHEET)) return null;
  return scene.add.sprite(x, y, ACTION_SHEET, 0).setDepth(depth).setDisplaySize(size, size).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha);
}
function statusSprite(scene: Phaser.Scene, x: number, y: number, size: number, depth = 72, alpha = 0.92): Phaser.GameObjects.Sprite | null {
  if (!scene.textures.exists(STATUS_SHEET)) return null;
  return scene.add.sprite(x, y, STATUS_SHEET, 0).setDepth(depth).setDisplaySize(size, size).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha);
}
function playOnce(scene: Phaser.Scene, fx: Phaser.GameObjects.Sprite, animationKey: string): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const done = (): void => {
      if (finished) return;
      finished = true;
      if (fx.scene) fx.destroy();
      resolve();
    };
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, done);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
    scene.events.once(Phaser.Scenes.Events.DESTROY, done);
    fx.play(animationKey);
  });
}

async function actionBurst(scene: Phaser.Scene, kind: ElementVfx, phase: 'cast' | 'impact', x: number, y: number, strong = false): Promise<boolean> {
  ensureAnimations(scene);
  const animationKey = actionKey(kind, phase);
  if (!scene.anims.exists(animationKey)) return false;
  const size = phase === 'impact' ? (strong ? 390 : 325) : (strong ? 290 : 235);
  const fx = actionSprite(scene, x, y, size, strong ? 88 : 64, phase === 'impact' ? 0.98 : 0.9);
  if (!fx) return false;
  await playOnce(scene, fx, animationKey);
  return true;
}
async function actionTravel(scene: Phaser.Scene, kind: ElementVfx, from: Phaser.Math.Vector2, x: number, y: number): Promise<boolean> {
  ensureAnimations(scene);
  const animationKey = actionKey(kind, 'travel');
  if (!scene.anims.exists(animationKey)) return false;
  const fx = actionSprite(scene, from.x, from.y - 5, 180, 66, 0.98);
  if (!fx) return false;
  fx.setRotation(Math.atan2(y - from.y, x - from.x)).play(animationKey);
  await new Promise<void>((resolve) => scene.tweens.add({ targets: fx, x, y: y - 5, duration: 600, ease: 'Sine.easeInOut', onComplete: () => resolve() }));
  fx.destroy();
  await actionBurst(scene, kind, 'impact', x, y - 5);
  return true;
}
async function statusBurst(scene: Phaser.Scene, kind: StatusVfx, x: number, y: number, strong = false, reverse = false): Promise<boolean> {
  ensureAnimations(scene);
  const animationKey = statusKey(kind, reverse ? 'break' : 'burst');
  if (!scene.anims.exists(animationKey)) return false;
  const fx = statusSprite(scene, x, y, strong ? 355 : 285, strong ? 92 : 76, kind === 'shield' ? 0.82 : 0.96);
  if (!fx) return false;
  await playOnce(scene, fx, animationKey);
  return true;
}
function persistentStatus(unit: any): StatusVfx | null {
  if (unit?.controlActionsRemaining > 0 && unit?.controlStatus === 'freeze') return 'freeze';
  if (unit?.controlActionsRemaining > 0 || unit?.paralysisActionsRemaining > 0) return 'stun';
  if (unit?.burnActionsRemaining > 0) return 'burn';
  if (Number(unit?.shield || 0) > 0) return 'shield';
  if (unit?.regenerationActionsRemaining > 0) return 'heal';
  return null;
}

export function installCombat2144RealSpriteTestPatch(BattleSceneClass: any, PowViewClass: any): void {
  const root = globalThis as any;
  if (root[FLAG]) return;
  root[FLAG] = true;

  const battle = BattleSceneClass.prototype as any;
  const previousPreload = battle.preload;
  battle.preload = function combat2144Preload(this: Phaser.Scene, ...args: any[]): void {
    previousPreload?.apply(this, args);
    if (!this.textures.exists(ACTION_SHEET)) this.load.spritesheet(ACTION_SHEET, ACTION_URL, { frameWidth: 16, frameHeight: 16, endFrame: 71 });
    if (!this.textures.exists(STATUS_SHEET)) this.load.spritesheet(STATUS_SHEET, STATUS_URL, { frameWidth: 12, frameHeight: 12, endFrame: 59 });
  };

  const previousCreate = battle.create;
  battle.create = function combat2144Create(this: any, ...args: any[]): any {
    const result = previousCreate?.apply(this, args);
    const animations = ensureAnimations(this);
    if (root.POWDER_COMBAT2_BALANCED_VFX_TEST_ROSTER) {
      for (const unit of this.combatState?.units || []) unit.ragePoints = 4;
      this.refreshViews?.();
    }
    const sheets = Number(this.textures.exists(ACTION_SHEET)) + Number(this.textures.exists(STATUS_SHEET));
    this.add.text(this.scale.width - 18, this.scale.height - 18, `${VERSION} · REAL SPRITE · ${sheets}/2 SHEETS · ${animations}/39 ANIMS · 4 NỘ`, {
      fontFamily: COMBAT_DISPLAY_FONT, fontSize: '12px', color: sheets === 2 && animations >= 39 ? '#aef7d3' : '#ffb38c', fontStyle: 'bold', backgroundColor: '#041018dd', padding: { x: 7, y: 4 }
    }).setOrigin(1, 1).setDepth(150);
    return result;
  };

  const previousAbility = battle.performAbility;
  if (previousAbility) {
    battle.performAbility = async function combat2144AbilityContext(this: any, actor: any, target: any, slot: any): Promise<any> {
      const previous = this[CTX];
      const ability = slot === 'ultimate' ? actor.pow.abilities.ultimate : actor.pow.abilities.skills[slot];
      this[CTX] = { ability, element: actor.pow.elementKey || actor.pow.element };
      try { return await previousAbility.call(this, actor, target, slot); }
      finally { if (previous === undefined) delete this[CTX]; else this[CTX] = previous; }
    };
  }

  const view = PowViewClass.prototype as any;
  const previousCast = view.playCastSignature;
  view.playCastSignature = async function combat2144Cast(this: any, support: boolean): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    ensureAnimations(scene);
    const context = (scene as any)[CTX];
    const special = support ? abilityStatus(context?.ability) : null;
    const p = position(this);
    if (special && await statusBurst(scene, special, p.x, p.y - 4, true)) return;
    const kind = own(this);
    if (kind && await actionBurst(scene, kind, 'cast', p.x, p.y - 6, support)) return;
    await previousCast?.call(this, support);
  };

  const previousTravel = view.playElementTravel;
  view.playElementTravel = async function combat2144Travel(this: any, x: number, y: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const kind = own(this);
    if (kind && await actionTravel(scene, kind, position(this), x, y)) return;
    await previousTravel?.call(this, x, y);
  };

  const previousImpact = view.playElementImpact;
  view.playElementImpact = async function combat2144Impact(this: any, x: number, y: number): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const context = (scene as any)[CTX];
    const special = abilityStatus(context?.ability);
    if (special && await statusBurst(scene, special, x, y - 4, true)) return;
    const kind = element(context?.element) || own(this);
    if (kind && await actionBurst(scene, kind, 'impact', x, y)) return;
    await previousImpact?.call(this, x, y);
  };

  const previousHitFlash = view.playHitFlash;
  view.playHitFlash = function combat2144HitFlash(this: any): void {
    previousHitFlash?.call(this);
    const scene = this.scene as Phaser.Scene;
    const context = (scene as any)[CTX];
    const p = position(this);
    const special = abilityStatus(context?.ability);
    if (special) { void statusBurst(scene, special, p.x, p.y - 4, true); return; }
    const sourceElement = element(context?.element);
    if (sourceElement) void actionBurst(scene, sourceElement, 'impact', p.x, p.y - 4);
  };

  const previousSupport = view.playSupportAura;
  view.playSupportAura = async function combat2144Support(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const special = abilityStatus((scene as any)[CTX]?.ability) || status(this.runtimeVisualStatus);
    const p = position(this);
    if (special && await statusBurst(scene, special, p.x, p.y - 4, true)) return;
    const kind = own(this);
    if (kind && await actionBurst(scene, kind, 'cast', p.x, p.y - 4, true)) return;
    await previousSupport?.call(this);
  };

  const previousControl = view.playControlLock;
  view.playControlLock = async function combat2144Control(this: any, label: string): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const special = status(label) || ((plain(label).includes('cam lang') || plain(label).includes('silence')) ? 'stun' : null);
    const p = position(this);
    if (special && await statusBurst(scene, special, p.x, p.y - 4, true)) {
      const startX = this.container.x;
      await new Promise<void>((resolve) => scene.tweens.add({ targets: this.container, x: startX + 8, duration: 80, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => resolve() }));
      this.container.setX(startX);
      return;
    }
    await previousControl?.call(this, label);
  };

  const previousResource = view.playResourcePulse;
  view.playResourcePulse = function combat2144Resource(this: any, color: number): void {
    const scene = this.scene as Phaser.Scene;
    const p = position(this);
    const special: StatusVfx = color === 0x8edfff ? 'shield' : color === 0x73f0aa ? 'heal' : 'heal';
    if (scene.textures.exists(STATUS_SHEET)) { void statusBurst(scene, special, p.x, p.y - 4); return; }
    previousResource?.call(this, color);
  };

  const previousShieldBreak = view.playShieldBreak;
  view.playShieldBreak = function combat2144ShieldBreak(this: any): void {
    const scene = this.scene as Phaser.Scene;
    const p = position(this);
    if (scene.textures.exists(STATUS_SHEET)) { void statusBurst(scene, 'shield', p.x, p.y - 4, true, true); return; }
    previousShieldBreak?.call(this);
  };

  const previousStatusPulse = view.playStatusPulse;
  view.playStatusPulse = async function combat2144StatusPulse(this: any): Promise<void> {
    const scene = this.scene as Phaser.Scene;
    const special = status(this.runtimeVisualStatus);
    const p = position(this);
    if (special && await statusBurst(scene, special, p.x, p.y - 4, true)) return;
    await previousStatusPulse?.call(this);
  };

  const previousUpdate = view.updateRuntime;
  view.updateRuntime = function combat2144PersistentStatus(this: any, unit: any): void {
    previousUpdate?.call(this, unit);
    ensureAnimations(this.scene);
    const kind = persistentStatus(unit);
    let fx = this[PERSIST] as Phaser.GameObjects.Sprite | undefined;
    if (!kind || !unit?.alive || unit.fieldSlot === null) {
      fx?.destroy();
      this[PERSIST] = null;
    } else {
      const animationKey = statusKey(kind, 'loop');
      if (!fx?.scene || fx.getData('kind') !== kind) {
        fx?.destroy();
        fx = statusSprite(this.scene, 0, 0, kind === 'shield' ? 285 : 250, 58, kind === 'shield' ? 0.58 : 0.76) || undefined;
        if (fx) {
          fx.setData('kind', kind).play(animationKey);
          this[PERSIST] = fx;
        }
      }
      if (fx?.scene) {
        const p = position(this);
        fx.setPosition(p.x, p.y - 5).setVisible(true);
      }
    }
    const ready = this.combat271UltimateReadyFx;
    if (ready?.scene && !ready.getData?.('__2144keep')) {
      ready.destroy(true);
      this.combat271UltimateReadyFx = undefined;
    }
  };

  root.POWDER_COMBAT2_RUNTIME_VERSION = VERSION;
  root.POWDER_COMBAT2_REAL_SPRITE_VFX = {
    version: VERSION,
    frameBased: true,
    actionSheet: ACTION_SHEET,
    statusSheet: STATUS_SHEET,
    elements: Object.keys(ELEMENT_ROWS),
    statuses: Object.keys(STATUS_ROWS),
    expectedAnimations: 39,
    testRage: 4
  };
}
