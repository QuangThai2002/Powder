import Phaser from 'phaser';

export interface QuadraticCurveSegment {
  controlX: number;
  controlY: number;
  endX: number;
  endY: number;
}

/** Draw a quadratic path with line segments supported by the Phaser 4 Graphics API. */
export function strokeQuadraticPath(
  graphics: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  segments: readonly QuadraticCurveSegment[],
  samplesPerCurve = 12
): void {
  let fromX = startX;
  let fromY = startY;
  graphics.beginPath();
  graphics.moveTo(fromX, fromY);

  for (const curve of segments) {
    for (let index = 1; index <= samplesPerCurve; index += 1) {
      const t = index / samplesPerCurve;
      const inverse = 1 - t;
      graphics.lineTo(
        inverse * inverse * fromX + 2 * inverse * t * curve.controlX + t * t * curve.endX,
        inverse * inverse * fromY + 2 * inverse * t * curve.controlY + t * t * curve.endY
      );
    }
    fromX = curve.endX;
    fromY = curve.endY;
  }

  graphics.strokePath();
}
