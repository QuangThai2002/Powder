import Phaser from 'phaser';

const PATCH_FLAG = '__powderCombat2133PrimitiveGuardInstalled';

/**
 * Final presentation guard for 2.13.3.
 * UI geometry (cards, HP bars, target/turn frames) is intentionally preserved.
 * Geometry that used to impersonate magic/status VFX is suppressed.
 */
export function installCombat2133PrimitiveGuardPatch(PowViewClass: any): void {
  const root = globalThis as any;
  if (root[PATCH_FLAG]) return;
  root[PATCH_FLAG] = true;

  const proto = PowViewClass.prototype as any;
  const originalUpdateRuntime = proto.updateRuntime;
  if (typeof originalUpdateRuntime === 'function') {
    proto.updateRuntime = function combat2133PrimitiveGuardRuntime(this: any, unit: any): void {
      originalUpdateRuntime.call(this, unit);

      // The old cyan immunity ellipse was a procedural status effect. 2.13.2/2.13.3
      // already render status feedback with the bundled transparent VFX atlas instead.
      const immunityRing = this.controlImmunityRing as Phaser.GameObjects.Ellipse | undefined;
      immunityRing?.setVisible(false);
    };
  }

  root.POWDER_COMBAT2_PRIMITIVE_PRIMARY_FX = {
    version: '2.13.3',
    enabled: false,
    uiGeometryPreserved: true,
    suppressed: [
      'control-immunity-ellipse',
      'skill-cast-rings',
      'source-target-line',
      'ultimate-magic-circle',
      'ultimate-impact-ray-rectangles'
    ]
  };
}
