// フリープレイの名前と、ルールの札の文(docs/FREEPLAY.md)。文の担当とロジックの担当の両方が使う。

import type { FreeItem, FreeRule } from './types';

/** 画面に出すフリープレイの名前(ボタン、結果画面、共有カード) */
export const FREE_NAME = 'フリープレイ';

/** 小物の名前(セリフと共有の文に入れる) */
export const FREE_ITEM_NAME: Readonly<Record<FreeItem, string>> = {
  balloon: '風船',
  hat: '帽子',
  bag: '紙袋'
};

/** 小物の名前のひらがな(ルールの札。字が読めない人のために、札には絵もつける) */
const FREE_ITEM_KANA: Readonly<Record<FreeItem, string>> = {
  balloon: 'ふうせん',
  hat: 'ぼうし',
  bag: 'かみぶくろ'
};

export const FREE_ITEMS: readonly FreeItem[] = ['balloon', 'hat', 'bag'];

/** ルールの札の文(ひらがな) */
export function ruleSignText(rule: FreeRule): string {
  if (rule.kind === 'allBad') return 'みんなワル';
  if (rule.kind === 'allCiv') return 'みんないいひと';
  return `${FREE_ITEM_KANA[rule.item]}=ワル`;
}
