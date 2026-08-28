import Phaser from 'phaser';
import { allExactCombatVfxSpecs } from '../vfx/Combat2140ExactVfxRegistry';
import { CombatPresentationDirector } from './CombatPresentationDirector';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';
import { PowView } from './PowView';
import './Combat2144BalancedVfxTestRosterPatch';
import { installCombat2143ReadableCinematicVfxPatch } from './Combat2143ReadableCinematicVfxPatch';
import { installCombat2144RealSpriteTestPatch } from './Combat2144RealSpriteTestPatch';

const PATCH_FLAG = '__powderCombat2142AssetVfxLiveInstalled';
const ATLAS_KEY = 'combat-vfx-atlas-a';
const PERSISTENT_FX_KEY = '__powderCombat2140PersistentFx';
const VERSION = '2.14.4';

type RuntimeSnapshot = {
  version: string;
  mode: 'asset-vfx-live';
  expectedTextures: number;
  loadedTextures: number;
  missingTextures: string[];
  ready: boolean;
};

function expectedTextureKeys(): string[] {
  return [ATLAS_KEY, ...allExactCombatVfxSpecs().map((spec) => spec.textureKey)];
}

function textureSnapshot(scene: Phaser.Scene): RuntimeSnapshot {
  const keys = expectedTextureKeys();
  const missing = keys.filter((key) => !scene.textures.exists(key));
  return { version: VERSION, mode: 'asset-vfx-live', expectedTextures: keys.length, loadedTextures: keys.length - missing.length, missingTextures: missing, ready: missing.length === 0 };
}

function walkGameObjects(items: Phaser.GameObjects.GameObject[], visit: (child: Phaser.GameObjects.GameObject) => void): void {
  for (const child of items) {
    visit(child);
    const nested = (child as any).list;
    if (Array.isArray(nested) && nested.length) walkGameObjects(nested as Phaser.GameObjects.GameObject[], visit);
  }
}

function replaceLegacyVersionText(scene: Phaser.Scene, snapshot: RuntimeSnapshot): void {
  let runtimeBadge: Phaser.GameObjects.Text | null = null;
  walkGameObjects((scene.children?.list || []) as Phaser.GameObjects.GameObject[], (child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    const text = String(child.text || '');
    if (/POWDER COMBAT 2\./.test(text)) child.setText(`POWDER COMBAT ${VERSION}`);
    if (text.includes('CONTACT-TIMED AUDIO')) child.setText('REAL SPRITE VFX · FRAME-BY-FRAME');
    if (/CONTACT AUDIO SYNC|ASSET VFX LIVE|VFX RECOVERY|VFX MISSING/.test(text)) runtimeBadge = child;
  });
  const label = snapshot.ready ? `${VERSION} · BASE ASSET ${snapshot.loadedTextures}/${snapshot.expectedTextures}` : `${VERSION} · BASE FALLBACK ${snapshot.loadedTextures}/${snapshot.expectedTextures}`;
  const color = snapshot.ready ? '#aef7d3' : '#ffd18c';
  if (runtimeBadge) runtimeBadge.setText(label).setColor(color).setAlpha(0.72);
  else if (['localhost', '127.0.0.1'].includes(location.hostname)) scene.add.text(scene.scale.width - 18, scene.scale.height - 52, label, { fontFamily: COMBAT_DISPLAY_FONT, fontSize: '10px', color, fontStyle: 'bold', backgroundColor: '#041018aa', padding: { x: 6, y: 3 } }).setOrigin(1, 1).setDepth(118).setAlpha(0.72);
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function installPersistentFxIdleHardening(PowViewClass: any): void {
  const proto = PowViewClass.prototype as any;
  const previousUpdate = proto.updateRuntime;
  if (typeof previousUpdate !== 'function') return;
  proto.updateRuntime = function combat2144PersistentFxIdleHardening(this: any, unit: any): void {
    previousUpdate.call(this, unit);
    const fx = this[PERSISTENT_FX_KEY] as Phaser.GameObjects.Image | undefined;
    if (!fx?.scene) return;
    const unitOffField = !unit?.alive || unit?.fieldSlot === null;
    if (!unitOffField && fx.visible && fx.active && !prefersReducedMotion()) return;
    try { this.scene?.tweens?.killTweensOf?.(fx); } catch { /* presentation cleanup only */ }
  };
}

export function installCombat2142AssetVfxLivePatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalIntro = proto.showPreBattleIntro;
  if (typeof originalIntro === 'function') {
    proto.showPreBattleIntro = function combat2144AssetVfxIntro(this: Phaser.Scene & any, ...args: any[]): any {
      const result = originalIntro.apply(this, args);
      const snapshot = textureSnapshot(this);
      root.POWDER_COMBAT2_ASSET_VFX_LIVE = snapshot;
      replaceLegacyVersionText(this, snapshot);
      return result;
    };
  }

  root.POWDER_COMBAT2_RUNTIME_VERSION = VERSION;
  root.POWDER_COMBAT2_ASSET_VFX_LIVE = { version: VERSION, mode: 'asset-vfx-live', expectedTextures: expectedTextureKeys().length, loadedTextures: 0, missingTextures: expectedTextureKeys(), ready: false } satisfies RuntimeSnapshot;

  // Keep old asset layer only as fallback, then override visible combat actions with real frame animation.
  installCombat2143ReadableCinematicVfxPatch(BattleSceneClass, PowView, CombatPresentationDirector);
  installPersistentFxIdleHardening(PowView);
  installCombat2144RealSpriteTestPatch(BattleSceneClass, PowView);
}
