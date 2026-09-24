// 担当:ステージ3(ショッピングモール)の人、親玉、物、エフェクト、背景。
// 人の仕組みや色はステージ1(src/art/world/)のものをそのまま使う。
import { type ArtContext, createCanvas, type PixelGrid } from '../lib';
import { IMAGES, sheetByKey } from '../sheets';
import { buildSheet } from '../world/sheet';
import { drawFar, drawGround, drawWall } from './backgrounds';
import { buildBoss3 } from './boss3';
import { FX3 } from './fx';
import { buildPeople3 } from './people';
import { buildProps3 } from './props';

/** シートのキー → 行ごとのコマ(絵の一覧のテストでも使う) */
export function buildWorld3Sheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  const sheets: Record<string, PixelGrid[][]> = { ...buildPeople3(skip), ...buildProps3() };
  if (!skip.has('boss3')) sheets.boss3 = buildBoss3();
  for (const [key, make] of Object.entries(FX3)) {
    const def = sheetByKey(key);
    sheets[key] = [make(def.frameW, def.frameH, def.rows[0].frames)];
  }
  return sheets;
}

export const WORLD3_IMAGES: Record<string, () => PixelGrid> = { bg_mall_far: drawFar, bg_mall_wall: drawWall, bg_mall_ground: drawGround };

export function generateWorld3Set(ctx: ArtContext): void {
  for (const [key, rows] of Object.entries(buildWorld3Sheets(ctx.skip))) {
    if (ctx.skip.has(key)) continue;
    const def = sheetByKey(key);
    ctx.addSheet(def, buildSheet(def, rows));
  }
  for (const [key, draw] of Object.entries(WORLD3_IMAGES)) {
    if (ctx.skip.has(key)) continue;
    const def = IMAGES.find((d) => d.key === key)!;
    const g = draw();
    const { canvas, ctx: c } = createCanvas(def.w, def.h);
    g.drawTo(c, 0, 0);
    ctx.addImage(def, canvas);
  }
}
