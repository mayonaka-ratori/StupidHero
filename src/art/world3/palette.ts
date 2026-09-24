// ステージ3(ショッピングモール)で共通に使う色。
// 人の肌、髪、ふちはステージ1の palette.ts のものをそのまま使う(市民と宇宙人でそろえる)。
import { md } from '../lib';
import type { Ramp } from '../world/pix';

/**
 * 宇宙人の黄緑(くずれ、合図の光、正体の目)。まん中が R146 G255 B0。
 * 明るい緑(R0 G255 B0)は使わない決まりなので、赤を少し入れて黄緑にしてある
 */
export const GLITCH: Ramp = [md(6, 7, 4), md(4, 7, 0), md(2, 5, 0)];
