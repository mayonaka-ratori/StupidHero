// 担当:ステージ3(ショッピングモール)の人、親玉、物、エフェクト、背景。
// 人の仕組みや色はステージ1(src/art/world/)のものをそのまま使う。
import { type PixelGrid, buildFxSheets } from '../lib';
import { drawFar, drawGround, drawWall } from './backgrounds';
import { buildBoss3 } from './boss3';
import { FX3 } from './fx';
import { buildPeople3 } from './people';
import { buildProps3 } from './props';

/** シートのキー → 行ごとのコマ(絵の一覧のテストでも使う) */
export function buildWorld3Sheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  const sheets: Record<string, PixelGrid[][]> = { ...buildPeople3(skip), ...buildProps3() };
  if (!skip.has('boss3')) sheets.boss3 = buildBoss3();
  return { ...sheets, ...buildFxSheets(FX3, skip) };
}

export const WORLD3_IMAGES: Record<string, () => PixelGrid> = { bg_mall_far: drawFar, bg_mall_wall: drawWall, bg_mall_ground: drawGround };
