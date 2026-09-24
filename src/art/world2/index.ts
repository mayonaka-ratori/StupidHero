// 担当:ステージ2(地下駐車場)の人、女ボス、物、背景。
// 人の仕組みや色はステージ1(src/art/world/)のものをそのまま使う。
import { type ArtContext, createCanvas, type PixelGrid } from '../lib';
import { IMAGES, sheetByKey } from '../sheets';
import { buildSheet } from '../world/sheet';
import { drawFar, drawGround, drawWall } from './backgrounds';
import { buildBoss2 } from './boss2';
import { buildPeople2 } from './people';
import { buildProps2 } from './props';

/** シートのキー → 行ごとのコマ(絵の決まりのテストでも使う) */
export function buildWorld2Sheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  const sheets: Record<string, PixelGrid[][]> = { ...buildPeople2(skip), ...buildProps2() };
  if (!skip.has('boss2')) sheets.boss2 = buildBoss2();
  return sheets;
}

export const WORLD2_IMAGES: Record<string, () => PixelGrid> = { bg_garage_far: drawFar, bg_garage_wall: drawWall, bg_garage_ground: drawGround };

export function generateWorld2Set(ctx: ArtContext): void {
  for (const [key, rows] of Object.entries(buildWorld2Sheets(ctx.skip))) {
    if (ctx.skip.has(key)) continue;
    const def = sheetByKey(key);
    ctx.addSheet(def, buildSheet(def, rows));
  }
  for (const [key, draw] of Object.entries(WORLD2_IMAGES)) {
    if (ctx.skip.has(key)) continue;
    const def = IMAGES.find((d) => d.key === key)!;
    const g = draw();
    const { canvas, ctx: c } = createCanvas(def.w, def.h);
    g.drawTo(c, 0, 0);
    ctx.addImage(def, canvas);
  }
}
