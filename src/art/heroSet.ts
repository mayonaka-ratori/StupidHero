// 担当:ヒーロー、顔のカットイン、すべてのエフェクト(fx_*)。
// 絵はすべてコードで作る。部品は src/art/hero/ の下。
import { cellOrigin, createSheetCanvas, type ArtContext, type PixelGrid } from './lib';
import { sheetByKey } from './sheets';
import { renderPose } from './hero/rig';
import { HERO_ROWS } from './hero/poses';
import { drawFaceSheet } from './hero/faces';
import { FX } from './hero/fx';

/** grid[row][i] のコマをシートに並べて登録する */
function addGridSheet(ctx: ArtContext, key: string, frames: PixelGrid[][]): void {
  if (ctx.skip.has(key)) return;
  const def = sheetByKey(key);
  const { canvas, ctx: g } = createSheetCanvas(def);
  frames.forEach((row, r) => row.forEach((f, i) => {
    const o = cellOrigin(def, r, i);
    f.drawTo(g, o.x, o.y);
  }));
  ctx.addSheet(def, canvas);
}

/** シートのキー → 行ごとのコマ(絵の決まりのテストでも使う) */
export function buildHeroSheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  const sheets: Record<string, PixelGrid[][]> = {};
  if (!skip.has('hero')) sheets.hero = HERO_ROWS.map((row) => row.map((p) => renderPose(p)));
  if (!skip.has('face_hero')) sheets.face_hero = drawFaceSheet('hero');
  if (!skip.has('face_operator')) sheets.face_operator = drawFaceSheet('operator');
  for (const [key, make] of Object.entries(FX)) {
    if (skip.has(key)) continue;
    const def = sheetByKey(key);
    sheets[key] = [make(def.frameW, def.frameH, def.cols)];
  }
  return sheets;
}

export function generateHeroSet(ctx: ArtContext): void {
  for (const [key, rows] of Object.entries(buildHeroSheets(ctx.skip))) addGridSheet(ctx, key, rows);
}
