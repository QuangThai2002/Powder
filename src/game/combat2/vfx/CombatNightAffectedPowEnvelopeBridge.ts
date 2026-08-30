import Phaser from 'phaser';
import type { CombatUnitState } from '../systems/CombatState';
import { PowView } from '../views/PowView';
import {
  NIGHT_STATUS_VFX_DEFAULTS,
  fitVfxFrameToPow,
  powVfxDepth,
  type PowVfxAnchor
} from './CombatNightVfxLayout';

const FLAG = '__powderCombatNightAffectedPowEnvelopeInstalled';
const AURA_KEY = '__nightAffectedPowEnvelope';
const SIGNATURE_KEY = '__nightAffectedPowEnvelopeSignature';
const CLEANUP_KEY = '__nightAffectedPowEnvelopeCleanup';
const SHIELD_IMAGE_KEY = '__nightPersistentShieldImage';
const REGEN_IMAGE_KEY = '__nightPersistentRegenImage';
const SUPPORT_MOTION_STATE_KEY = '__nightPersistentSupportMotionState';

type StatusBand = {
  key: string;
  color: number;
  strong?: boolean;
};

type CoreStatusKind = 'burn' | 'poison' | 'freeze' | 'stun';

function addBand(list: StatusBand[], key: string, color: number, strong = false): void {
  if (list.some((entry) => entry.key === key)) return;
  list.push({ key, color, strong });
}

function activeBands(unit: CombatUnitState): StatusBand[] {
  const rows: StatusBand[] = [];
  if (!unit?.alive || unit.fieldSlot === null) return rows;

  if (unit.controlImmunityActionsRemaining > 0) addBand(rows, 'control-immunity', 0x8ef7ff, true);
  if (unit.controlActionsRemaining > 0) {
    if (unit.controlStatus === 'freeze') addBand(rows, 'freeze', 0x8adfff, true);
    else addBand(rows, 'stun', 0xf5dd62, true);
  }
  if (unit.silenceActionsRemaining > 0) addBand(rows, 'silence', 0xc9a0ff, true);
  if (unit.paralysisActionsRemaining > 0) addBand(rows, 'paralysis', 0xf5dd62, true);
  if (unit.freezeStage === 2 && unit.freezeStageActionsRemaining > 0) addBand(rows, 'frostbite', 0x8adfff, true);
  else if (unit.freezeStage === 1 && unit.freezeStageActionsRemaining > 0) addBand(rows, 'chill', 0x8adfff);

  if (unit.antiHealActionsRemaining > 0 && unit.antiHeal > 0) addBand(rows, 'anti-heal', 0xff8da0);
  if (unit.attackBuffActionsRemaining > 0 && unit.attackMultiplier < 1) addBand(rows, 'attack-down', 0xff8da0);
  if (unit.abilityPowerBuffActionsRemaining > 0 && unit.abilityPowerMultiplier < 1) addBand(rows, 'ap-down', 0xff8da0);
  if (unit.defenseBuffActionsRemaining > 0 && unit.defenseMultiplier < 1) addBand(rows, 'defense-down', 0xff8da0);
  if (unit.accuracyDebuffActionsRemaining > 0 && unit.accuracyBonus < 0) addBand(rows, 'accuracy-down', 0xff8da0);
  if (unit.speedDebuffActionsRemaining > 0) addBand(rows, 'slow', 0x78a9ff);

  if (unit.burnActionsRemaining > 0) addBand(rows, 'burn', 0xff7043, true);
  if (unit.poisonActionsRemaining > 0) addBand(rows, 'poison', 0xa5df66, true);

  if (unit.regenerationActionsRemaining > 0) addBand(rows, 'regeneration', 0x73f0aa);
  if (unit.guardActionsRemaining > 0 && unit.damageReductionBonus > 0) addBand(rows, 'guard', 0x90d8ff);
  if (unit.tenacityBuffActionsRemaining > 0 && unit.tenacityBonus > 0) addBand(rows, 'tenacity-up', 0x8ef7ff);
  if (unit.critBuffActionsRemaining > 0 && unit.critRateBonus > 0) addBand(rows, 'crit-up', 0xffc46b);
  if (unit.evasionBuffActionsRemaining > 0 && unit.evasionBonus > 0) addBand(rows, 'evasion-up', 0xffc46b);
  if (unit.attackBuffActionsRemaining > 0 && unit.attackMultiplier > 1) addBand(rows, 'attack-up', 0xffc46b);
  if (unit.abilityPowerBuffActionsRemaining > 0 && unit.abilityPowerMultiplier > 1) addBand(rows, 'ap-up', 0xffc46b);
  if (unit.defenseBuffActionsRemaining > 0 && unit.defenseMultiplier > 1) addBand(rows, 'defense-up', 0xffc46b);
  if (unit.speedBuffActionsRemaining > 0) addBand(rows, 'speed-up', 0xffc46b);
  if (unit.shield > 0) addBand(rows, 'shield', 0x8edfff, true);
  if (unit.reviveMarkerActionsRemaining > 0) addBand(rows, 'revive-marker', 0xe4b8ff);

  return rows;
}

function clearAura(view: any): void {
  const aura = view[AURA_KEY] as Phaser.GameObjects.Graphics | undefined;
  if (aura?.active) aura.destroy();
  view[AURA_KEY] = null;
  view[SIGNATURE_KEY] = '';
}

function ensureCleanup(view: any): void {
  if (view[CLEANUP_KEY]) return;
  const scene = view.scene as Phaser.Scene | undefined;
  if (!scene?.events) return;
  const cleanup = (): void => {
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
    clearAura(view);
    view[CLEANUP_KEY] = false;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  view[CLEANUP_KEY] = true;
}

function drawAllStatusBands(view: any, unit: CombatUnitState): void {
  // Retire the old full-card status border. The new visual hugs only the Pow portrait.
  const legacyFrame = view.statusFrame as Phaser.GameObjects.Rectangle | undefined;
  legacyFrame?.setVisible(false);

  const bands = activeBands(unit);
  if (bands.length <= 0) {
    clearAura(view);
    return;
  }

  const scene = view.scene as Phaser.Scene | undefined;
  const layout = typeof view.getVfxLayout === 'function' ? view.getVfxLayout() : null;
  const center = typeof view.getVfxAnchor === 'function' ? view.getVfxAnchor('body') as Phaser.Math.Vector2 : null;
  if (!scene?.add || !layout || !center) return;

  ensureCleanup(view);
  const width = Math.max(54, Number(layout.artWidth || 210) * Number(layout.fieldScale || 1) * 0.96);
  const height = Math.max(54, Number(layout.artHeight || 190) * Number(layout.fieldScale || 1) * 0.98);
  const signature = `${bands.map((entry) => entry.key).join('|')}@${Math.round(width)}x${Math.round(height)}`;

  let aura = view[AURA_KEY] as Phaser.GameObjects.Graphics | undefined;
  if (!aura?.active) {
    aura = scene.add.graphics().setDepth(powVfxDepth('status') - 2);
    view[AURA_KEY] = aura;
  }
  aura.setPosition(center.x, center.y).setVisible(true);
  if (view[SIGNATURE_KEY] === signature) return;
  view[SIGNATURE_KEY] = signature;
  aura.clear();

  // A very faint primary tint binds the status to the portrait without washing out Pow art.
  aura.fillStyle(bands[0].color, bands[0].strong ? 0.026 : 0.018);
  aura.fillRoundedRect(-width / 2, -height / 2, width, height, 14);

  // Every simultaneously active status receives its own nested perimeter band.
  // No particles, no permanent tweens, and only one Graphics object per affected Pow.
  const maxInset = Math.min(24, Math.max(8, Math.min(width, height) * 0.15));
  const step = bands.length <= 1 ? 0 : maxInset / Math.max(1, bands.length - 1);
  bands.forEach((entry, index) => {
    const inset = 2 + step * index;
    const ringW = Math.max(28, width - inset * 2);
    const ringH = Math.max(28, height - inset * 2);
    const alpha = entry.strong ? 0.86 : 0.58;
    aura!.lineStyle(entry.strong ? 3 : 2, entry.color, alpha);
    aura!.strokeRoundedRect(-ringW / 2, -ringH / 2, ringW, ringH, Math.max(7, 14 - index * 0.6));
  });
}

function refitDedicatedStatusSprite(view: any): void {
  const owner = view.persistentStatusVfx as any;
  const active = owner?.active as { kind?: CoreStatusKind; object?: Phaser.GameObjects.GameObject } | undefined;
  const kind = active?.kind;
  const sprite = active?.object;
  if (!kind || !(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.active) return;

  const layout = typeof view.getVfxLayout === 'function' ? view.getVfxLayout() : null;
  const getAnchor = typeof view.getVfxAnchor === 'function' ? view.getVfxAnchor.bind(view) : null;
  if (!layout || !getAnchor) return;
  const profile = NIGHT_STATUS_VFX_DEFAULTS[kind];
  const anchor = getAnchor(profile.anchor as PowVfxAnchor) as Phaser.Math.Vector2;
  if (kind === 'poison') anchor.y -= Number(layout.artHeight || 190) * Number(layout.fieldScale || 1) * 0.24;

  const frameWidth = Math.max(1, Number(sprite.frame?.width || 80));
  const frameHeight = Math.max(1, Number(sprite.frame?.height || 80));
  sprite
    .setPosition(anchor.x, anchor.y)
    .setScale(fitVfxFrameToPow(
      frameWidth,
      frameHeight,
      layout,
      profile.widthRatio,
      profile.heightRatio
    ));
}

function expandSupportAsset(view: any, imageKey: string, kind: 'shield' | 'regen'): void {
  const image = view[imageKey] as Phaser.GameObjects.Image | undefined;
  if (!image?.active || !image.scene) return;
  const layout = typeof view.getVfxLayout === 'function' ? view.getVfxLayout() : null;
  const center = typeof view.getVfxAnchor === 'function' ? view.getVfxAnchor('body') as Phaser.Math.Vector2 : null;
  if (!layout || !center) return;

  const artWidth = Number(layout.artWidth || 210) * Number(layout.fieldScale || 1);
  const artHeight = Number(layout.artHeight || 190) * Number(layout.fieldScale || 1);
  const size = kind === 'shield'
    ? Math.max(84, Math.min(artWidth * 0.92, artHeight * 1.02, 210))
    : Math.max(76, Math.min(artWidth * 0.74, artHeight * 0.86, 170));
  const y = kind === 'regen' ? center.y + artHeight * 0.05 : center.y;
  const alpha = kind === 'shield' ? 0.16 : 0.15;

  image.setPosition(center.x, y).setDisplaySize(size, size).setAlpha(alpha).setVisible(true);
  const motion = (image as any)[SUPPORT_MOTION_STATE_KEY];
  if (motion) {
    motion.baseX = center.x;
    motion.baseY = y;
    motion.baseScaleX = image.scaleX;
    motion.baseScaleY = image.scaleY;
    motion.baseAlpha = alpha;
  }
}

export function installCombatNightAffectedPowEnvelopeBridge(): void {
  const root = globalThis as any;
  if (root[FLAG]) return;

  const proto = PowView.prototype as any;
  const previousUpdate = proto.updateRuntime;
  if (typeof previousUpdate !== 'function') return;

  proto.updateRuntime = function combatNightAffectedPowEnvelopeUpdate(this: any, unit: CombatUnitState): void {
    previousUpdate.call(this, unit);
    drawAllStatusBands(this, unit);
    refitDedicatedStatusSprite(this);
    expandSupportAsset(this, SHIELD_IMAGE_KEY, 'shield');
    expandSupportAsset(this, REGEN_IMAGE_KEY, 'regen');
  };

  root[FLAG] = true;
  root.POWDER_COMBAT2_NIGHT_AFFECTED_POW_ENVELOPE = {
    version: 'night-41',
    mode: 'all-active-statuses-surround-pow-portrait',
    simultaneousStatusesVisible: true,
    oneGraphicsPerAffectedPow: true,
    cardWideStatusFrameRetired: true,
    dedicatedStatusSpriteSheetsPreserved: true,
    liveRefitDedicatedStatusSprites: true,
    supportAssetsExpandedAroundPow: true,
    particleEmitters: false,
    tweenLoops: false,
    combatLogicChanged: false,
    covered: [
      'control-immunity', 'freeze', 'stun', 'silence', 'paralysis', 'frostbite', 'chill',
      'anti-heal', 'attack-down', 'ap-down', 'defense-down', 'accuracy-down', 'slow',
      'burn', 'poison', 'regeneration', 'guard', 'tenacity-up', 'crit-up', 'evasion-up',
      'attack-up', 'ap-up', 'defense-up', 'speed-up', 'shield', 'revive-marker'
    ]
  };
}
