// 担当:ステージ4(高層ビル)の人、親玉、物、エフェクト、背景。
// 人の仕組みや色はステージ1(src/art/world/)のものをそのまま使う。
import { type ArtContext, type PixelGrid, addGridImages, addGridSheets } from '../lib';
import { sheetByKey } from '../sheets';
import {
  drawLift, drawLiftView, drawPartyGround, drawPartyWall, drawTower1Far, drawTower2Far, drawTower3Far, drawTower4Far,
  drawTowerGround, drawTowerWall
} from './backgrounds';
import { buildBoss4 } from './boss4';
import { FX4 } from './fx';
import { buildPeople4 } from './people';
import { buildProps4 } from './props';

/** シートのキー → 行ごとのコマ(絵の一覧のテストでも使う) */
export function buildWorld4Sheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  const sheets: Record<string, PixelGrid[][]> = { ...buildPeople4(skip), ...buildProps4() };
  if (!skip.has('boss4')) sheets.boss4 = buildBoss4();
  for (const [key, make] of Object.entries(FX4)) {
    const def = sheetByKey(key);
    sheets[key] = [make(def.frameW, def.frameH, def.rows[0].frames)];
  }
  return sheets;
}

/** 背景の1枚絵(キー → 描く関数) */
export const WORLD4_IMAGES: Record<string, () => PixelGrid> = {
  bg_tower1_far: drawTower1Far, bg_tower2_far: drawTower2Far, bg_tower3_far: drawTower3Far, bg_tower4_far: drawTower4Far,
  bg_tower_wall: drawTowerWall, bg_tower_ground: drawTowerGround,
  bg_party_wall: drawPartyWall, bg_party_ground: drawPartyGround,
  bg_lift: drawLift, bg_lift_view: drawLiftView
};

/**
 * 色の数を確かめる組(奥の絵1枚と、それに組む壁と床で45色まで)。
 * 1枚目が奥の絵(透明なし)。エレベーターは中の絵と、その後ろの夜景の2枚
 */
export const WORLD4_BG_SETS: Record<string, string[]> = {
  tower1: ['bg_tower1_far', 'bg_tower_wall', 'bg_tower_ground'],
  tower2: ['bg_tower2_far', 'bg_tower_wall', 'bg_tower_ground'],
  tower3: ['bg_tower3_far', 'bg_tower_wall', 'bg_tower_ground'],
  tower4: ['bg_tower4_far', 'bg_party_wall', 'bg_party_ground'],
  lift: ['bg_lift_view', 'bg_lift']
};

export function generateWorld4Set(ctx: ArtContext): void {
  addGridSheets(ctx, buildWorld4Sheets(ctx.skip));
  addGridImages(ctx, WORLD4_IMAGES);
}
