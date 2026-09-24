// 担当:ステージ2(地下駐車場)の人、女ボス、物、背景。
// 人の仕組みや色はステージ1(src/art/world/)のものをそのまま使う。
import { type ArtContext, type PixelGrid, addGridImages, addGridSheets } from '../lib';
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
  addGridSheets(ctx, buildWorld2Sheets(ctx.skip));
  addGridImages(ctx, WORLD2_IMAGES);
}
