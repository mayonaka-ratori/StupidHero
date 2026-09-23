// ヒーローの色(1シート15色まで。透明を除く)。
// 光は左上から。どの色も [明るい, ふつう, 影] の3段。
import { md, OUTLINE } from '../lib';

export type Ramp = readonly [string, string, string];

export const OUT = OUTLINE;
/** 肌(市民、悪党の担当とそろえる) */
export const SKIN: Ramp = [md(7, 6, 4), md(6, 4, 3), md(4, 2, 2)];
/** 金髪。胸の星、ベルト、ブーツのふちの金にも使う */
export const HAIR: Ramp = [md(7, 7, 3), md(7, 5, 1), md(5, 3, 0)];
/** スーツの青。マスクは影の色 */
export const BLUE: Ramp = [md(2, 4, 7), md(1, 2, 6), md(0, 1, 3)];
/** マント、スカート、手袋、ブーツの赤 */
export const RED: Ramp = [md(7, 2, 1), md(5, 0, 1), md(3, 0, 1)];
export const WHITE = md(7, 7, 7);

/** 1文字で色を指す表(手で打つ絵に使う) */
export const HERO_KEYS: Record<string, string> = {
  o: OUT,
  a: SKIN[0], b: SKIN[1], c: SKIN[2],
  '1': HAIR[0], '2': HAIR[1], '3': HAIR[2],
  B: BLUE[0], n: BLUE[1], m: BLUE[2],
  R: RED[0], r: RED[1], d: RED[2],
  w: WHITE
};
