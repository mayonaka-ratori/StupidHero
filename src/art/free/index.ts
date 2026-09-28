// 担当:フリープレイの絵(一目で分かるワル、波3の小物、ルールの札、ヒーローの光)。docs/FREEPLAY.md の「絵」。
// 人の仕組みや色はステージ1〜3(src/art/world*/)のものをそのまま使う。
import { type PixelGrid, buildFxSheets } from '../lib';
import { auraAttack, auraAttackLine, auraPass, auraPassLine } from './fx';
import {
  drawBag, drawBagIcon, drawBalloonFrames, drawBalloonIcon, drawFistIcon, drawHat, drawHatIcon, drawPalmIcon
} from './itemArt';
import { buildFreePeople } from './people';

/** 1行だけの絵(小物、札、光)。lib.ts の buildFxSheets で、シートの表のコマ数(n)の絵を作る */
const ONE_ROW: Record<string, (w: number, h: number, n: number) => PixelGrid[]> = {
  fp_item_balloon: () => drawBalloonFrames(),
  fp_item_hat: () => [drawHat()],
  fp_item_bag: () => [drawBag()],
  ui_rule_fist: () => [drawFistIcon()],
  ui_rule_palm: () => [drawPalmIcon()],
  ui_item_balloon: () => [drawBalloonIcon()],
  ui_item_hat: () => [drawHatIcon()],
  ui_item_bag: () => [drawBagIcon()],
  fx_aura_attack: (_w, _h, n) => auraAttack(n),
  fx_aura_pass: (_w, _h, n) => auraPass(n),
  fx_aura_attack_line: (_w, _h, n) => auraAttackLine(n),
  fx_aura_pass_line: (_w, _h, n) => auraPassLine(n)
};

/** シートのキー → 行ごとのコマ(絵の決まりのテストでも使う) */
export function buildFreeSheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  return { ...buildFreePeople(skip), ...buildFxSheets(ONE_ROW, skip) };
}
