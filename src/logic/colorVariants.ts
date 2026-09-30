// 人の服の色ちがい(docs/ART_SPEC.md の「服の色ちがい」)を、1人ずつ決める。
// 同じ見た目の人でも、遊ぶたびに、また同じ回の中でも、ちがう色の服で出てくるようにする(見た目だけ。数字は変わらない)。
//
// 使い方(stage.ts の createStage と freeplay.ts の createFreePlay が、人を並べ終わったあとに呼ぶ):
//   rollColorVariants(stage);   // stage の全員と、ラッシュの人に colorVariant(0〜3)を入れる
//
// 決まり:
// - ステージの種から作った、ほかとは別の乱数で決める(人の並びや名前を決める乱数は1回も引かないので、
//   同じ種なら今までと同じ並びのまま、色ちがいだけが足される)
// - ワルか市民かボスかを見ずに、出てくる順に1人ずつ同じ確率で選ぶ。色が手がかりにならないようにするため
// - ボスの化けた姿も、同じ見た目の市民と同じ4つの色から選ぶ(化けた姿の絵も同じ表で塗り替えるので、
//   色でボスと分かることはない)
// - フリープレイの一目で分かるワル(fp_*)は色ちがいなし(いつも0)

import { createRng, hashSeed } from './rng';
import type { Look, Stage } from './types';

/** 色ちがいの数(0 のいまの色を入れて4つ)。絵の表(src/art/variants.ts)の数と同じにする */
export const COLOR_VARIANT_COUNT = 4;

/** その見た目の色ちがいの数(フリープレイの一目で分かるワルは1つだけ) */
export const colorVariantCount = (look: Look): number => (look.startsWith('fp_') ? 1 : COLOR_VARIANT_COUNT);

/** 色ちがいを決める乱数の種(ステージの種から作る。ほかの乱数とは別) */
const variantSeed = (seed: number): number => hashSeed(`colorVariant:${seed >>> 0}`);

/** ステージの全員(波の順、出てくる順)と、ラッシュの人に colorVariant を入れる。同じ種なら同じ色になる */
export function rollColorVariants(stage: Pick<Stage, 'seed' | 'waves' | 'rush'>): void {
  const rng = createRng(variantSeed(stage.seed));
  const roll = (look: Look): number => rng.int(0, colorVariantCount(look) - 1);
  for (const w of stage.waves) for (const p of w.people) p.colorVariant = roll(p.look);
  const rush = stage.rush;
  if (rush?.kind === 'sale') for (const r of rush.runners) r.colorVariant = roll(r.look);
  if (rush?.kind === 'elevator') for (const r of rush.riders) r.colorVariant = roll(r.look);
}
