// コマを並べてシートのキャンバスにする。
import { type PixelGrid, cellOrigin, createSheetCanvas } from '../lib';
import type { SheetDef } from '../sheets';

/** rows[行][コマ] の順に並べる */
export function buildSheet(def: SheetDef, rows: PixelGrid[][]): HTMLCanvasElement {
  const { canvas, ctx } = createSheetCanvas(def);
  rows.forEach((frames, r) => {
    if (r >= def.rows.length) return;
    frames.slice(0, def.rows[r].frames).forEach((g, i) => {
      const o = cellOrigin(def, r, i);
      g.drawTo(ctx, o.x, o.y);
    });
  });
  return canvas;
}
