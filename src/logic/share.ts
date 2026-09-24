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
//
// フリープレイ:1行目はルールと場面をつなげる(「『風船の人はワル!』でおばあちゃんに全力パンチ!」)。
//   const s = stats.snapshot();
//   const caption = freeShareCaption({ worstScene: s.worstScene, caption: worstCaption(s), free: s.free!, titleName });
//   buildShareText({ caption, url })
//   結果画面の小さな1行:heroAccuracyText(s.free!)(「ヒーローだけなら10/27人、あなたが直して25/27人」)

import { FREE_ITEMS, FREE_ITEM_NAME } from './freeNames';
import type { FreeRule, FreeTally, FreeWorstScene, StageId, WorstScene } from './types';

const SHARE_HASHTAG = '#StupidHero';

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

// ─── フリープレイ ─────────────────────────────────

/** フリープレイだけの、いちばんひどい場面の見出し(ワルごとに変える) */
export const FREE_WORST_CAPTION: Readonly<Record<FreeWorstScene, string>> = {
  waveKnife: 'ナイフ男に笑顔で手を振った!',
  waveGang: 'ギャングの車に手を振って見送った!',
  waveUfo: 'UFOに手を振った!',
  closeCall: 'ギリギリセーフ!'
};

/**
 * ルールを共有の文に入れるときの言い方(かぎかっこの中身)。
 * 小物のルールは「風船の人はワル!」、みんなワルは「みんなワル!」、みんないい人は「みんないい人!」
 * (ルールの札の「みんなワル」「みんないいひと」と同じ言い方)
 */
export function ruleQuote(rule: FreeRule): string {
  if (rule.kind === 'allBad') return 'みんなワル!';
  if (rule.kind === 'allCiv') return 'みんないい人!';
  return `${FREE_ITEM_NAME[rule.item]}の人はワル!`;
}

export interface FreeShareCaptionInput {
  /** ステージの場面(stats.worstScene) */
  worstScene: WorstScene | null;
  /** ステージの場面の見出し(worstCaption(stats)。ステージの場面がないときは使わない) */
  caption: string;
  /** フリープレイの数(stats.free)。worst と worstRule を見る */
  free: Pick<FreeTally, 'worst' | 'worstRule'>;
  /** 称号の名前 */
  titleName: string;
}

/**
 * フリープレイの共有文の1行目。ステージの場面(市民を殴った、など)があればその見出し、
 * なければフリープレイだけの場面(ワルに手を振った、ギリギリセーフ)の見出しにし、
 * そのときのルールを前につける(「『風船の人はワル!』でおばあちゃんに全力パンチ!」)。
 * どちらもなければ称号(ルールはつけない)
 */
export function freeShareCaption(i: FreeShareCaptionInput): string {
  let scene = '';
  if (i.worstScene && STRONG_SCENES.includes(i.worstScene) && i.caption) scene = i.caption;
  else if (i.free.worst) scene = FREE_WORST_CAPTION[i.free.worst];
  if (!scene) return `称号「${i.titleName}」`;
  return i.free.worstRule ? `『${ruleQuote(i.free.worstRule)}』で${scene}` : scene;
}

/** 「ヒーローだけなら10/27人、あなたが直して25/27人」(結果画面のいちばん下の小さな1行) */
export function heroAccuracyText(t: Pick<FreeTally, 'heroRight' | 'fixedRight' | 'units'>): string {
  return `ヒーローだけなら${t.heroRight}/${t.units}人、あなたが直して${t.fixedRight}/${t.units}人`;
}

/** フリープレイの共有と結果画面の文の全部(字を先に読みこむため。数字は別に読みこむ) */
export function freeShareTexts(): string[] {
  const rules: FreeRule[] = [{ kind: 'allBad' }, { kind: 'allCiv' }, ...FREE_ITEMS.map((item): FreeRule => ({ kind: 'item', item }))];
  return [...Object.values(FREE_WORST_CAPTION), ...rules.map((r) => `『${ruleQuote(r)}』で`), 'ヒーローだけなら人、あなたが直して人'];
}
