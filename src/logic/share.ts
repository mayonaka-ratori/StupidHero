// SNSに流す共有文を作る。形はSPEC「SNS共有」の文の例と同じ。
//
// 【Stupid Hero】路地裏ステージ
// 悪党8人撃破/市民3人負傷
// 被害額¥2,400万(自販機30台分)
// 称号「歩く解体工事」(3/12)
// #StupidHero
// https://(ゲームのURL)

import { formatDamage } from './format';

export const SHARE_HASHTAG = '#StupidHero';

export interface ShareInput {
  /** ステージの名前(例 '路地裏')。stage.name */
  stageName: string;
  /** 悪党撃破数 */
  defeated: number;
  /** 市民負傷数 */
  civHurt: number;
  /** 被害額(円) */
  damage: number;
  /** 称号の名前(例 '歩く解体工事') */
  titleName: string;
  /** 集めた称号の数(今回の分を含む) */
  titlesCollected: number;
  /** 称号の全体の数(12) */
  titlesTotal: number;
  /** ゲームのURL */
  url: string;
}

/** 共有する文を作る(改行は \n) */
export function buildShareText(i: ShareInput): string {
  return [
    `【Stupid Hero】${i.stageName}ステージ`,
    `悪党${i.defeated}人撃破/市民${i.civHurt}人負傷`,
    `被害額${formatDamage(i.damage)}`,
    `称号「${i.titleName}」(${i.titlesCollected}/${i.titlesTotal})`,
    SHARE_HASHTAG,
    i.url
  ].join('\n');
}

/** 「Xに投稿」ボタン用のURL(共有メニューが使えないとき) */
export function xPostUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
