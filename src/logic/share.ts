// SNSに流す共有文を作る。数字は画像(共有カード)に入っているので、文は短くする。
//
// おばあちゃんに全力パンチ!     ← いちばんひどかった場面の見出し(弱いときは称号)
// #StupidHero
// https://(ゲームのURL)
//
// 使い方:buildShareText({ caption: shareCaption({ worstScene, caption: worstCaption(s), titleName }), url })
// いちばんひどい場面の見出しのうち、ステージで言い方を変えるもの(STAGE_WORST_CAPTIONS)と、
// 「市民がさらわれた!」(ABDUCTED_CAPTION)はここに置く。共有カード(src/scenes/result/card.ts)が使う。
// 見出しは共有カードの今の文に合わせて「!」を半角で書く。

import type { StageId, WorstScene } from './types';

export const SHARE_HASHTAG = '#StupidHero';

/**
 * 見出しにして目を引く場面(市民やおばあさんに当たった、市民がさらわれた、街がこわれた)。
 * ボスを倒しただけ、何もなかったは弱い
 */
const STRONG_SCENES: readonly WorstScene[] = ['grannyHit', 'specialOnCiv', 'civHit', 'abducted', 'bigPropBroken'];

/** 買い物客がUFOに連れ去られた場面の見出し(ステージ3) */
export const ABDUCTED_CAPTION = '市民がさらわれた!';

/**
 * ステージごとに言い方を変える見出し(路地裏の文は「街」なので、ほかのステージは変える)。
 * 大きな物が壊れた場面:地下駐車場「駐車場ボロボロ!」、ショッピングモール「モールがこわれた!」
 */
export const STAGE_WORST_CAPTIONS: Readonly<Partial<Record<StageId, Partial<Record<WorstScene, string>>>>> = {
  garage: { bigPropBroken: '駐車場ボロボロ!' },
  mall: { bigPropBroken: 'モールがこわれた!' }
};

export interface ShareCaptionInput {
  /** いちばんひどかった場面(stats.worstScene) */
  worstScene: WorstScene | null;
  /** その場面の見出し(worstCaption(stats)) */
  caption: string;
  /** 称号の名前 */
  titleName: string;
}

/** 共有文の1行目。ひどい場面があればその見出し、なければ称号 */
export function shareCaption(i: ShareCaptionInput): string {
  if (i.worstScene && STRONG_SCENES.includes(i.worstScene) && i.caption) return i.caption;
  return `称号「${i.titleName}」`;
}

export interface ShareInput {
  /** 1行目(shareCaption の答え) */
  caption: string;
  /** ゲームのURL */
  url: string;
}

/** 共有する文を作る(改行は \n) */
export function buildShareText(i: ShareInput): string {
  return [i.caption, SHARE_HASHTAG, i.url].join('\n');
}

/** 「Xに投稿」ボタン用のURL(共有メニューが使えないとき) */
export function xPostUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
