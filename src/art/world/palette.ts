// 市民、悪党、ボスで共通に使う色。肌、髪、ふちは全員そろえる。
import { OUTLINE, md } from '../lib';
import type { Ramp } from './pix';

export { OUTLINE };

/** 肌(ヒーローの担当とそろえる) */
export const SKIN: Ramp = [md(7, 6, 4), md(6, 4, 3), md(4, 2, 2)];
/** 髪(明るいところは肌の暗い色を使って、色を節約する) */
export const HAIR: Ramp = [md(4, 2, 2), md(2, 1, 1), OUTLINE];
/** 白いもの(シャツ、靴、米袋) */
export const WHITE: Ramp = [md(7, 7, 7), md(7, 7, 7), md(5, 5, 6)];
export const GOLD: Ramp = [md(7, 7, 3), md(7, 5, 1), md(5, 3, 0)];
/** 手がかりの色 */
export const WALLET_BROWN: Ramp = [md(6, 4, 2), md(5, 3, 1), md(3, 1, 0)];
export const KNIFE_YELLOW: Ramp = [md(7, 7, 2), md(7, 6, 0), md(5, 4, 0)];
export const BAG_RED: Ramp = [md(7, 3, 4), md(6, 1, 2), md(4, 0, 1)];
export const BLADE: Ramp = [md(7, 7, 7), md(5, 6, 6), md(3, 4, 4)];
/** ボスの入れ墨(水色) */
export const TATTOO: Ramp = [md(3, 7, 7), md(1, 5, 6), md(0, 3, 5)];
