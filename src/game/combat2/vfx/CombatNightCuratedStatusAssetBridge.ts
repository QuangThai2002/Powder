import Phaser from 'phaser';
import { BattleScene } from '../scenes/BattleScene';
import { PowView } from '../views/PowView';
import {
  PersistentPowStatusVfx,
  type PersistentPowStatusKind,
  type PersistentStatusSheetMap
} from './PersistentPowStatusVfx';
import part00 from './statusAtlasData/part00';
import part01 from './statusAtlasData/part01';
import part02 from './statusAtlasData/part02';
import part03 from './statusAtlasData/part03';
import part04 from './statusAtlasData/part04';
import part05 from './statusAtlasData/part05';
import part06 from './statusAtlasData/part06';
import part07 from './statusAtlasData/part07';
import part08 from './statusAtlasData/part08';
import part09 from './statusAtlasData/part09';
import part10 from './statusAtlasData/part10';
import part11 from './statusAtlasData/part11';
import part12 from './statusAtlasData/part12';

const FLAG = '__powderCombatNightCuratedStatusAssetBridgeInstalled';
const PRELOAD_FLAG = '__powderCombatNight38RealStatusPreloadInstalled';
const OWNER_FLAG = '__powderCombatNight38RealStatusOwnerInstalled';
const DEDUP_FLAG = '__powderCombatNight38LegacyPersistentDedupInstalled';
const INSTALL_VERSION = 'night-38';
const LEGACY_PERSISTENT_KEY = '__powderCombat2140PersistentFx';
const ATLAS_TEXTURE_KEY = 'combat2-night-status-atlas-real';
const FRAME_SIZE = 80;
const TOTAL_FRAMES = 52;
const ATLAS_WIDTH = FRAME_SIZE * 4;
const ATLAS_HEIGHT = FRAME_SIZE * 13;

const ATLAS_DATA_URI = `data:image/avif;base64,${[
  part00,
  part01,
  part02,
  part03,
  part04,
  part05,
  part06,
  part07,
  part08,
  part09,
  part10,
  part11,
  part12
].join('')}`;

const STATUS_SHEETS: PersistentStatusSheetMap = Object.freeze({
  burn: Object.freeze({
    textureKey: ATLAS_TEXTURE_KEY,
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    startFrame: 0,
    endFrame: 11,
    frameRate: 12,
    repeat: -1
  }),
  poison: Object.freeze({
    textureKey: ATLAS_TEXTURE_KEY,
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    startFrame: 12,
    endFrame: 23,
    frameRate: 10,
    repeat: -1
  }),
  stun: Object.freeze({
    textureKey: ATLAS_TEXTURE_KEY,
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    startFrame: 24,
    endFrame: 35,
    frameRate: 14,
    repeat: -1
  }),
  freeze: Object.freeze({
    textureKey: ATLAS_TEXTURE_KEY,
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    startFrame: 36,
    endFrame: 51,
    frameRate: 10,
    repeat: 0
  })
});

function installRealStatusPreload(): void {
  const sceneProto = BattleScene.prototype as any;
  if (sceneProto[PRELOAD_FLAG] === INSTALL_VERSION) return;

  const previousPreload = sceneProto.preload;
  sceneProto.preload = function combatNight38RealStatusPreload(
    this: Phaser.Scene,
    ...args: any[]
  ): void {
    if (typeof previousPreload === 'function') previousPreload.apply(this, args);
    if (this.textures.exists(ATLAS_TEXTURE_KEY)) return;

    this.load.spritesheet(ATLAS_TEXTURE_KEY, ATLAS_DATA_URI, {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      startFrame: 0,
      endFrame: TOTAL_FRAMES - 1
    });
  };

  sceneProto[PRELOAD_FLAG] = INSTALL_VERSION;
}

function installRealStatusOwner(): void {
  const proto = PersistentPowStatusVfx.prototype as any;
  if (proto[OWNER_FLAG] === INSTALL_VERSION) return;

  const previousSetStatus = proto.setStatus;
  if (typeof previousSetStatus !== 'function') return;

  proto.setStatus = function combatNight38RealStatusSet(
    this: any,
    kind: PersistentPowStatusKind | null,
    ...args: any[]
  ): void {
    // The original owner already knows how to play ONE Sprite through ordered
    // frame numbers. Night38 only supplies the verified real-sheet map here.
    this.sheetSpecs = STATUS_SHEETS;
    previousSetStatus.call(this, kind, ...args);
  };

  proto[OWNER_FLAG] = INSTALL_VERSION;
}

function installLegacyPersistentDedup(): void {
  const proto = PowView.prototype as any;
  if (proto[DEDUP_FLAG] === INSTALL_VERSION) return;

  const previousUpdate = proto.updateRuntime;
  if (typeof previousUpdate !== 'function') return;

  proto.updateRuntime = function combatNight38LegacyPersistentDedup(this: any, ...args: any[]): void {
    previousUpdate.apply(this, args);
    const legacy = this[LEGACY_PERSISTENT_KEY] as Phaser.GameObjects.Image | undefined;
    if (legacy?.active) legacy.setVisible(false);
  };

  proto[DEDUP_FLAG] = INSTALL_VERSION;
}

export function installCombatNightCuratedStatusAssetBridge(): void {
  const root = globalThis as any;
  if (root[FLAG] === INSTALL_VERSION) return;

  installRealStatusPreload();
  installRealStatusOwner();
  installLegacyPersistentDedup();
  root[FLAG] = INSTALL_VERSION;

  const ranges = Object.freeze({
    burn: Object.freeze([0, 11]),
    poison: Object.freeze([12, 23]),
    stun: Object.freeze([24, 35]),
    freeze: Object.freeze([36, 51])
  });

  root.POWDER_COMBAT2_NIGHT_STATUS_ASSETS = {
    version: INSTALL_VERSION,
    mode: 'real-spritesheet-ordered-frames',
    textureKey: ATLAS_TEXTURE_KEY,
    format: 'avif-data-uri-qa',
    atlasWidth: ATLAS_WIDTH,
    atlasHeight: ATLAS_HEIGHT,
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    totalFrames: TOTAL_FRAMES,
    ranges,
    burnLoop: true,
    poisonLoop: true,
    stunLoop: true,
    freezeBuildThenHold: true,
    oneSpritePerPow: true,
    orderedFrames: true,
    realArtworkFrames: true,
    proceduralStatusAnimation: false,
    particleEmitters: false,
    tweenLoops: false,
    duplicateLegacyPersistentHidden: true,
    combatLogicChanged: false
  };

  root.POWDER_COMBAT2_NIGHT_PERSISTENT_STATUS = {
    ...(root.POWDER_COMBAT2_NIGHT_PERSISTENT_STATUS || {}),
    version: INSTALL_VERSION,
    ownerPerPowMax: 1,
    fullSheetPriority: true,
    realSpriteSheetPlayback: true,
    atlasFrames: TOTAL_FRAMES,
    oneSpritePerPow: true,
    orderedFrames: true,
    proceduralStatusAnimation: false,
    particleEmitters: false,
    tweenLoops: false,
    combatLogicChanged: false
  };
}

installCombatNightCuratedStatusAssetBridge();
