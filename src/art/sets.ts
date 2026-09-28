// 担当ごとの絵の一覧(シートを作る関数と、背景などの1枚絵を描く関数)。
// ゲームで絵を作るとき(index.ts の generateArt)は、この順にシートと1枚絵を登録する。
// 絵の決まりのテスト(artRules.test.ts)も、この一覧から全部の絵を作って確かめる。
import type { PixelGrid } from './lib';
import { buildHeroSheets } from './heroSet';
import { WORLD_BGS, buildWorldSheets } from './worldSet';
import { drawLogo } from './world/logo';
import { WORLD2_IMAGES, buildWorld2Sheets } from './world2';
import { WORLD3_IMAGES, buildWorld3Sheets } from './world3';
import { WORLD4_IMAGES, buildWorld4Sheets } from './world4';
import { buildFreeSheets } from './free';

interface ArtSet {
  /** シートのキー → 行ごとのコマ。skip のキー(PNGを用意したもの)は作らない */
  sheets: (skip?: Set<string>) => Record<string, PixelGrid[][]>;
  /** 1枚絵のキー → 描く関数 */
  images: Record<string, () => PixelGrid>;
}

/** 担当の名前 → 絵(ヒーローと顔とエフェクト、ステージ1〜4、フリープレイ) */
export const ART_SETS: Record<string, ArtSet> = {
  hero: { sheets: buildHeroSheets, images: {} },
  world: { sheets: buildWorldSheets, images: { ...WORLD_BGS, logo: drawLogo } },
  world2: { sheets: buildWorld2Sheets, images: WORLD2_IMAGES },
  world3: { sheets: buildWorld3Sheets, images: WORLD3_IMAGES },
  world4: { sheets: buildWorld4Sheets, images: WORLD4_IMAGES },
  free: { sheets: buildFreeSheets, images: {} }
};
