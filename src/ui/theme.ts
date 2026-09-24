// UIの部品で使う色と文字の大きさ。config.ts の UI の色に足りないものだけをここに置く。
// 使い方:
//   import { FS, UIX, NAMES } from '../ui/theme';
//   new PixelText(this, 8, 8, 'こんにちは', { size: FS.body });

import { UI } from '../config';

/**
 * 文字の大きさ(ドット)。DotGothic16は16ドットの升目で作られた字なので、
 * 16だけが升目どおりにくっきり出る。12はドットの幅が少し不ぞろいになるが、漢字も読める。
 * - big: 16。ボタン、見出し、大きなセリフ
 * - body: 12。セリフ、プロフィール、数字
 * - small: 10。かなと数字だけの短いもの(札、ヒント)。漢字は黒くつぶれるので避ける(8はかなも読みにくい)
 */
export const FS = { small: 10, body: 12, big: 16 } as const;

/** config の UI にない色 */
export const UIX = {
  /** 青いウィンドウのふちのすぐ内側の線 */
  winInner: UI.winInner,
  /** 赤紫のカットインのふちのすぐ内側の線 */
  cutInner: 0xa02a60,
  /** 警告のカットインのふち */
  alarmEdge: 0xffe08a,
  alarmInner: 0xc0303a,
  /** 名前の色 */
  name: UI.gold,
  /** 黄色いボタン(待て)の文字 */
  stopText: 0x2a1a00,
  /** 使えないボタン */
  disabled: 0x4a4660,
  disabledText: 0x8a84a0,
  /** 吹き出し */
  bubble: 0xffffff,
  bubbleText: 0x111111,
  /** 時間のバー */
  time: 0xf5c542,
  /** 体力のバー */
  hp: 0xd8312d,
  hpTrail: 0xffffff,
  /** 顔のまわりの白い線 */
  faceEdge: 0xffffff,
  faceBg: 0x7fb0e6
} as const;

/** 文字の中で {名前}…{/} と書いたときに使える色の名前 */
export const TEXT_COLORS: Record<string, number> = {
  white: UI.text,
  gold: UI.gold,
  dim: UI.textDim,
  red: UI.danger,
  danger: UI.danger,
  bad: UI.bad,
  civ: 0x7fb0ff,
  black: 0x000000,
  yellow: UI.stop
};

/** 2人の名前。決まったらここだけ変える */
export const NAMES = { operator: 'オペレーター', hero: 'ヒーロー' } as const;

/**
 * 部品の重なりの順(depth)。数字が大きいほど手前。
 * UIの部品は作るとふつう DEPTH.ui になる(札と吹き出しも)。ゲームの絵は panel(900)より小さい数にしておく。
 */
export const DEPTH = { panel: 900, ui: 1000, cutin: 1100, fx: 1500, flash: 1800 } as const;

/** 2つの色を混ぜる(t=0でa、t=1でb) */
function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return ch(16) | ch(8) | ch(0);
}
/** 暗くする(t=0.3で3割暗く) */
export const darker = (c: number, t = 0.3): number => mix(c, 0x000000, t);
/** 明るくする */
export const lighter = (c: number, t = 0.3): number => mix(c, 0xffffff, t);
