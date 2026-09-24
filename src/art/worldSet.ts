// 担当:市民、悪党、ボス、壊れる物、背景、ロゴ。
// 中身は src/art/world/ の下に分けてある。
import { type ArtContext, type PixelGrid, addGridImages, addGridSheets } from './lib';
import { drawFar, drawGround, drawWall } from './world/backgrounds';
import { drawLogo } from './world/logo';
import { buildBoss } from './world/boss';
import { buildPeople } from './world/people';
import { buildProps } from './world/props';

/** シートのキー → 行ごとのコマ(絵の決まりのテストでも使う) */
export function buildWorldSheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  const sheets: Record<string, PixelGrid[][]> = { ...buildPeople(skip), ...buildProps() };
  if (!skip.has('boss')) sheets.boss = buildBoss();
  return sheets;
}

/** 背景3枚(奥、壁、地面の順) */
export const WORLD_BGS: Record<string, () => PixelGrid> = { bg_alley_far: drawFar, bg_alley_wall: drawWall, bg_alley_ground: drawGround };

export function generateWorldSet(ctx: ArtContext): void {
  addGridSheets(ctx, buildWorldSheets(ctx.skip));
  addGridImages(ctx, { ...WORLD_BGS, logo: drawLogo });
}
