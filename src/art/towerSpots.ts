// ステージ4(高層ビル)の仕分けの画面の、照明と机と小物の場所。「まわり」の窓で大きく見せる四角もここに書く
// (docs/STAGE4.md の「仕分けの画面の背景」「もれ」「まわり」の窓)。src/art/clueSpots.ts と同じ形の表にしてある。
//
// 使い方:
//   const d = towerDeskFor(wave.no);            // { items: [...], rect }(机の下の真ん中からのずれと、窓の四角)
//   const look = leakLook(leakSpots(person));   // 照明のコマ、火花、小物を浮かせるか、もや、糸、風船
//   deskRect(d, deskX, deskY)                   // 窓の四角を、画面の座標にする
//
// 照明と机は、どの階も同じ場所に置く(TOWER_LAMP、TOWER_DESK)。人の絵(2倍)と重ならないように、
// 照明は頭の上、机は人の左の細い所に置く。机の上の小物は階ごとに2つ(1階は名刺とペン、18階はペンとマグカップ、
// 35階はグラスとナプキン、最上階はグラスとキャンドル)。もれや紛らわしい市民の理由が出るのは、1つ目(spot)だけ。
// 窓の四角は、1つ目の小物が浮いたときの紫のもや(16×14)と同じ場所にする。浮く前の小物と、机の天板の端も入る。

import type { LeakSpots } from '../logic/tower';
import type { WaveNo } from '../logic/types';
import { CLUE_H, CLUE_W, type ClueRect } from './clueSpots';

/** fx_psy_items のコマ */
export const TOWER_ITEM_FRAMES = { pen: 0, card: 1, cup: 2, glass: 3, napkin: 4, candle: 5 } as const;
export type TowerItem = keyof typeof TOWER_ITEM_FRAMES;
/**
 * fx_psy_items の料理のコマ(机には置かない)。親玉が正体を現したときに、グラスなどといっしょに会場で浮く
 * (src/scenes/street/psychic.ts の liftAround)。絵の下の端は、ほかの小物と同じ7段目
 */
export const PARTY_FOOD_FRAMES = { cake: 6, dish: 7 } as const;

/** fx_psy_items の1コマ(12×12)の中で、絵がある行の上と下(src/art/world4/fx.ts の items に合わせる) */
export const TOWER_ITEM_ROWS: Readonly<Record<TowerItem, { top: number; bottom: number }>> = {
  pen: { top: 4, bottom: 7 },
  card: { top: 3, bottom: 6 },
  cup: { top: 3, bottom: 7 },
  glass: { top: 2, bottom: 7 },
  napkin: { top: 4, bottom: 7 },
  candle: { top: 1, bottom: 7 }
};

/** 小物のコマの大きさ */
export const TOWER_ITEM_SIZE = 12;
/** 机(tw_desk)の大きさ */
export const TOWER_DESK_W = 40;
export const TOWER_DESK_H = 32;
/** 小物の下の端をのせる行(机のコマの上から数えて。天板の上の面は3〜4段目) */
export const DESK_TOP_ROW = 4;
/** 浮いた小物が上がる高さ(ドット)。上下のゆれは、ここから1ドット上まで */
export const FLOAT_PX = 3;

/**
 * 仕分けの画面の照明(fx_psy_lamp の上の真ん中)。頭の上の、左上の字(STAGE、人数、時間)の右。
 * 照明は窓に映さないので、画面の左上に大きく(2倍で)出す。机と小物は背景と同じ1倍(小さい所は「まわり」の窓で見る)
 */
export const TOWER_LAMP = { x: 94, y: 0, scale: 2 } as const;
/** fx_psy_lamp の大きさ */
export const TOWER_LAMP_W = 40;
export const TOWER_LAMP_H = 24;
/** 仕分けの画面の机(tw_desk の下の真ん中)。人の左の細い所。足の高さ(204)にそろえる */
export const TOWER_DESK = { x: 38, y: 204 } as const;

/** 机の上の小物1つ。dx は机の真ん中から小物のコマの真ん中までのずれ */
export interface DeskItem { item: TowerItem; dx: number }

/** 1つの階の机。items[0] がもれの出る小物(spot)。rect は窓の四角(机の下の真ん中からのずれ) */
export interface TowerDeskSpot { items: readonly [DeskItem, DeskItem]; rect: ClueRect }

/** 1つ目の小物は机の右寄り(人の側。手品の糸がつえから届く側)、2つ目は左寄り */
const SPOT_DX = 9;
const OTHER_DX = -9;

/** 小物のコマの真ん中の、机の下の真ん中からの高さ(浮いていないとき。上がマイナス) */
export function itemRestDy(item: TowerItem): number {
  const bottomY = -TOWER_DESK_H + DESK_TOP_ROW;
  return bottomY - TOWER_ITEM_ROWS[item].bottom + TOWER_ITEM_SIZE / 2;
}

/** 1つ目の小物が浮いたときのもや(16×14)の四角 = 窓の四角 */
function spotRect(item: TowerItem): ClueRect {
  const cy = itemRestDy(item) - FLOAT_PX;
  return { x: SPOT_DX - CLUE_W / 2, y: cy - CLUE_H / 2, w: CLUE_W, h: CLUE_H };
}

const floor = (spot: TowerItem, other: TowerItem): TowerDeskSpot => ({
  items: [{ item: spot, dx: SPOT_DX }, { item: other, dx: OTHER_DX }],
  rect: spotRect(spot)
});

/** 階ごと(波1から順に、1階、18階、35階、最上階)の机の上の小物と、窓の四角 */
export const TOWER_DESKS: readonly TowerDeskSpot[] = [
  floor('card', 'pen'),
  floor('pen', 'cup'),
  floor('glass', 'napkin'),
  floor('glass', 'candle')
];

/** その波(階)の机 */
export function towerDeskFor(no: WaveNo): TowerDeskSpot {
  return TOWER_DESKS[Math.min(TOWER_DESKS.length, Math.max(1, no)) - 1];
}

/** 窓の四角を、机を (deskX, deskY)(下の真ん中)に置いたときの座標にする */
export function deskRect(d: TowerDeskSpot, deskX: number, deskY: number): ClueRect {
  return { x: deskX + d.rect.x, y: deskY + d.rect.y, w: d.rect.w, h: d.rect.h };
}

/** 照明と小物の見せ方(leakSpots の答えを絵にするときの決まり) */
export interface LeakLook {
  /** fx_psy_lamp のコマ(0:ふつう、1:もれ(紫)、2:切れかけ) */
  lampFrame: 0 | 1 | 2;
  /** 照明のまわりに火花を2つ出す */
  lampSparks: boolean;
  /** 1つ目の小物を浮かせる(もれ、手品の糸、風船) */
  itemFloat: boolean;
  /** 浮いた小物を紫のもやで包み、火花を1つ出す(もれ) */
  haze: boolean;
  /** つえの先から小物へ糸を引く(手品の糸) */
  thread: boolean;
  /** 小物に風船をひもで結ぶ(風船) */
  balloon: boolean;
}

/** leakSpots の答えから、照明と小物の見せ方を決める。親玉とふつうの市民は全部ふつう */
export function leakLook(s: LeakSpots): LeakLook {
  return {
    lampFrame: s.light === 'leak' ? 1 : s.light === 'flicker' ? 2 : 0,
    lampSparks: s.light === 'leak',
    itemFloat: s.item !== null,
    haze: s.item === 'leak',
    thread: s.item === 'thread',
    balloon: s.item === 'balloon'
  };
}

/** 何も起きていないときの見せ方(人が出ていないとき、中断中) */
export const CALM_LOOK: LeakLook = leakLook({ light: null, item: null });
