import Phaser from 'phaser';
import { allExactCombatVfxSpecs } from '../vfx/Combat2140ExactVfxRegistry';
import { COMBAT_DISPLAY_FONT } from './CombatTheme';

const PATCH_FLAG = '__powderCombat2142AssetVfxLiveInstalled';
const ATLAS_KEY = 'combat-vfx-atlas-a';
const VERSION = '2.14.2';

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
  return {
    version: VERSION,
    mode: 'asset-vfx-live',
    expectedTextures: keys.length,
    loadedTextures: keys.length - missing.length,
    missingTextures: missing,
    ready: missing.length === 0
  };
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
    if (text.includes('POWDER COMBAT 2.12.5')) {
      child.setText(`POWDER COMBAT ${VERSION}`);
      return;
    }
    if (text.includes('CONTACT-TIMED AUDIO')) {
      child.setText('ASSET VFX · CAST → TRAVEL → IMPACT · CONTACT AUDIO');
      return;
    }
    if (text.includes('2.12.5 · CONTACT AUDIO SYNC')) runtimeBadge = child;
  });

  const label = snapshot.ready
    ? `${VERSION} · ASSET VFX LIVE · ${snapshot.loadedTextures}/${snapshot.expectedTextures}`
    : `${VERSION} · VFX MISSING · ${snapshot.loadedTextures}/${snapshot.expectedTextures}`;
  const color = snapshot.ready ? '#aef7d3' : '#ffb38c';

  if (runtimeBadge) {
    runtimeBadge.setText(label).setColor(color).setAlpha(0.9);
  } else if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    scene.add.text(scene.scale.width - 18, scene.scale.height - 58, label, {
      fontFamily: COMBAT_DISPLAY_FONT,
      fontSize: '11px',
      color,
      fontStyle: 'bold',
      backgroundColor: '#041018cc',
      padding: { x: 7, y: 4 }
    }).setOrigin(1, 1).setDepth(119).setAlpha(0.9);
  }
}

export function installCombat2142AssetVfxLivePatch(BattleSceneClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = BattleSceneClass.prototype as any;
  const originalIntro = proto.showPreBattleIntro;
  if (typeof originalIntro === 'function') {
    proto.showPreBattleIntro = function combat2142AssetVfxIntro(this: Phaser.Scene & any, ...args: any[]): any {
      const result = originalIntro.apply(this, args);
      const snapshot = textureSnapshot(this);
      root.POWDER_COMBAT2_ASSET_VFX_LIVE = snapshot;
      replaceLegacyVersionText(this, snapshot);
      if (!snapshot.ready) console.warn('[Combat2 2.14.2 VFX preload incomplete]', snapshot.missingTextures);
      else console.info('[Combat2 2.14.2 Asset VFX LIVE]', snapshot);
      return result;
    };
  }

  root.POWDER_COMBAT2_RUNTIME_VERSION = VERSION;
  root.POWDER_COMBAT2_ASSET_VFX_LIVE = {
    version: VERSION,
    mode: 'asset-vfx-live',
    expectedTextures: expectedTextureKeys().length,
    loadedTextures: 0,
    missingTextures: expectedTextureKeys(),
    ready: false
  } satisfies RuntimeSnapshot;
}
