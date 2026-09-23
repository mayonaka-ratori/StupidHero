// ゲーム全体で共有する定数。数字の出どころは docs/SPEC.md と docs/ART_SPEC.md。

/** 論理画面の横幅(ドット)。固定。 */
export const GAME_W = 216;
/** 上のアクション部分の高さ。 */
export const ACTION_H = 214;
/** 論理画面の高さの下限と上限。端末の縦横比に合わせてこの間で決まり、余りは下の操作部分に回す。 */
export const MIN_H = 384;
export const MAX_H = 468;

/** 画面に文字を書くときのフォント。美咲フォントなどに差し替えるときはここだけ変える。 */
export const FONT_FAMILY = 'DotGothic16';

export const SCENES = {
  boot: 'Boot',
  title: 'Title',
  intro: 'Intro',
  sort: 'Sort',
  street: 'Street',
  boss: 'Boss',
  result: 'Result'
} as const;

/** UIの色。絵の色とは別。 */
export const UI = {
  black: 0x000000,
  panel: 0x0e0c1a,
  panelLine: 0x3a3354,
  winFill: 0x0e1646,
  winEdge: 0xe8ecff,
  winInner: 0x2f4cc0,
  cutFill: 0x3a0e28,
  cutEdge: 0xffd0e4,
  cutAlarm: 0x780e14,
  bad: 0xd8312d,
  civ: 0x2d6ad8,
  stop: 0xf5c542,
  go: 0xd8312d,
  gold: 0xffd35a,
  text: 0xffffff,
  textDim: 0xc8c0e0,
  danger: 0xff7a70
} as const;

export const css = (c: number): string => '#' + c.toString(16).padStart(6, '0');
