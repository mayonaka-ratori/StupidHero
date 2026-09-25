// ステージ4(高層ビル)で共通に使う色。
// 人の肌、髪、ふちはステージ1の palette.ts のものをそのまま使う。
import { md } from '../lib';
import type { Ramp } from '../world/pix';

/**
 * 超能力の紫(明るい、ふつう、濃い)。R255 G219 B255、R219 G109 B255、R146 G36 B219。
 * もれ、念力、エレベーターのボタン、親玉の光だけに使う(docs/ART_SPEC.md の「決まった所にしか使わない色」)。
 * ステージ2の赤紫(R255 G0 B255)とは別の色
 */
export const PSY: Ramp = [md(7, 6, 7), md(6, 3, 7), md(4, 1, 6)];

/** 切れかけの蛍光灯のうすい黄色(紫とまちがえない色) */
export const WEAK: Ramp = [md(7, 7, 4), md(6, 6, 3), md(4, 4, 2)];
