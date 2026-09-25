// ヒーローの色(1シート15色まで。透明を除く)。顔のカットイン(faces.ts)と同じ15色。
// 光は左上から。どの色も明るい順に並べる。髪だけ4段(いちばん明るい H はつやの帯)。
import { md, OUTLINE } from '../lib';

export type Ramp = readonly [string, string, string];

export const OUT = OUTLINE;
/** 肌 a,b,c */
export const SKIN: Ramp = [md(7, 6, 5), md(7, 5, 4), md(5, 3, 3)];
/** 金髪 H,1,2,3。胸の星、ベルト、袖口とブーツのふちの金にも使う */
export const HAIR4 = [md(7, 7, 5), md(7, 6, 1), md(6, 4, 0), md(4, 2, 1)] as const;
/** スーツの青 L,B,N。マスクは N */
export const BLUE: Ramp = [md(3, 5, 7), md(1, 3, 6), md(1, 1, 4)];
/** マント、スカート、手袋、ブーツの赤 R,r,d */
export const RED: Ramp = [md(7, 3, 2), md(6, 1, 1), md(3, 0, 2)];
export const WHITE = md(7, 7, 7);

/** 1文字で色を指す表(手で打つ絵に使う)。モックの文字と同じ */
export const HERO_KEYS: Record<string, string> = {
  o: OUT,
  a: SKIN[0], b: SKIN[1], c: SKIN[2],
  H: HAIR4[0], '1': HAIR4[1], '2': HAIR4[2], '3': HAIR4[3],
  L: BLUE[0], B: BLUE[1], N: BLUE[2],
  R: RED[0], r: RED[1], d: RED[2],
  w: WHITE
};
