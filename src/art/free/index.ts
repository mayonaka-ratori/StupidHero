// 担当:フリープレイの絵(一目で分かるワル、波3の小物、ルールの札、ヒーローの光)。docs/FREEPLAY.md の「絵」。
// 人の仕組みや色はステージ1〜3(src/art/world*/)のものをそのまま使う。
import { type ArtContext, type PixelGrid, addGridSheets } from '../lib';
import { sheetByKey } from '../sheets';
import { auraAttack, auraAttackLine, auraPass, auraPassLine } from './fx';
import {
  drawBag, drawBagIcon, drawBalloonFrames, drawBalloonIcon, drawFistIcon, drawHat, drawHatIcon, drawPalmIcon
} from './itemArt';
import { buildFreePeople } from './people';

/** 1行だけの絵(小物、札、光)。コマ数を受け取って、そのコマ数の絵を返す */
const ONE_ROW: Record<string, (n: number) => PixelGrid[]> = {
  fp_item_balloon: () => drawBalloonFrames(),
  fp_item_hat: () => [drawHat()],
  fp_item_bag: () => [drawBag()],
  ui_rule_fist: () => [drawFistIcon()],
  ui_rule_palm: () => [drawPalmIcon()],
  ui_item_balloon: () => [drawBalloonIcon()],
  ui_item_hat: () => [drawHatIcon()],
  ui_item_bag: () => [drawBagIcon()],
  fx_aura_attack: auraAttack,
  fx_aura_pass: auraPass,
  fx_aura_attack_line: auraAttackLine,
  fx_aura_pass_line: auraPassLine
};

/** シートのキー → 行ごとのコマ(絵の決まりのテストでも使う) */
export function buildFreeSheets(skip: Set<string> = new Set()): Record<string, PixelGrid[][]> {
  const sheets: Record<string, PixelGrid[][]> = { ...buildFreePeople(skip) };
  for (const [key, make] of Object.entries(ONE_ROW)) {
    if (skip.has(key)) continue;
    sheets[key] = [make(sheetByKey(key).rows[0].frames)];
  }
  return sheets;
}

export function generateFreeSet(ctx: ArtContext): void {
  addGridSheets(ctx, buildFreeSheets(ctx.skip));
}
