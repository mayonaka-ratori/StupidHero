// ステージ4(高層ビル)の仕分けの画面の、照明と机と小物の場所と、もれの見せ方
// (docs/STAGE4.md の「仕分けの画面の背景」「もれ」「紛らわしい市民」)。
//
// 使い方:
//   const d = towerDeskFor(wave.no);            // { items: [...] }(机の下の真ん中からのずれ)
//   const look = leakLook(leakSpots(person));   // 照明のコマ、火花の数、小物を浮かせるか、もや、糸、煙、風船
//
// 照明と机は、どの階も同じ場所に置く(TOWER_LAMP、TOWER_DESK)。人の絵(2倍)と重ならないように、
// 照明は頭の上、机は人の左の細い所に置く。机の上の小物は階ごとに2つ(1階は名刺とペン、18階はペンとマグカップ、
// 35階はグラスとナプキン、最上階はグラスとキャンドル)。もれや紛らわしい市民の理由が出るのは、1つ目(spot)だけ。
// 大きく映す窓はない(前は「まわり」の窓があったが、やさしすぎたのでやめた)。プレイヤーは仕分けの画面の机と照明をじかに見る。

import type { LeakSpots } from '../logic/tower';
import type { WaveNo } from '../logic/types';
import { sheetByKey } from './sheets';

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

/** 小物のコマ(fx_psy_items)の大きさ(縦と横は同じ) */
export const TOWER_ITEM_SIZE = sheetByKey('fx_psy_items').frameW;
/** 机(tw_desk)の大きさ */
export const TOWER_DESK_W = sheetByKey('tw_desk').frameW;
export const TOWER_DESK_H = sheetByKey('tw_desk').frameH;
/** 小物の下の端をのせる行(机のコマの上から数えて。天板の上の面は3〜4段目) */
export const DESK_TOP_ROW = 4;
/** 浮いた小物が上がる高さ(ドット)。上下のゆれは、ここから1ドット上まで */
export const FLOAT_PX = 3;

/**
 * 仕分けの画面の照明(fx_psy_lamp の上の真ん中)。頭の上の、左上の字(STAGE、人数、時間)の右。
 * 照明は画面の左上に大きく(2倍で)出す。机と小物は背景と同じ1倍
 */
export const TOWER_LAMP = { x: 94, y: 0, scale: 2 } as const;
/** fx_psy_lamp の大きさ */
export const TOWER_LAMP_W = sheetByKey('fx_psy_lamp').frameW;
export const TOWER_LAMP_H = sheetByKey('fx_psy_lamp').frameH;
/** 仕分けの画面の机(tw_desk の下の真ん中)。人の左の細い所。足の高さ(204)にそろえる */
export const TOWER_DESK = { x: 38, y: 204 } as const;

/** 机の上の小物1つ。dx は机の真ん中から小物のコマの真ん中までのずれ */
interface DeskItem { item: TowerItem; dx: number }

/** 1つの階の机。items[0] がもれの出る小物(spot) */
export interface TowerDeskSpot { items: readonly [DeskItem, DeskItem] }

/** 1つ目の小物は机の右寄り(人の側。手品の糸がつえから届く側)、2つ目は左寄り */
const SPOT_DX = 9;
const OTHER_DX = -9;

/** 小物のコマの真ん中の、机の下の真ん中からの高さ(浮いていないとき。上がマイナス) */
export function itemRestDy(item: TowerItem): number {
  const bottomY = -TOWER_DESK_H + DESK_TOP_ROW;
  return bottomY - TOWER_ITEM_ROWS[item].bottom + TOWER_ITEM_SIZE / 2;
}

const floor = (spot: TowerItem, other: TowerItem): TowerDeskSpot => ({
  items: [{ item: spot, dx: SPOT_DX }, { item: other, dx: OTHER_DX }]
});

/** 階ごと(波1から順に、1階、18階、35階、最上階)の机の上の小物 */
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

/** fx_psy_lamp のコマ(src/art/world4/fx.ts の lamp) */
export const LAMP_FRAMES = { normal: 0, leak: 1, flicker: 2, flickerDark: 3, cellophane: 4 } as const;

/** 照明と小物の見せ方(leakSpots の答えを絵にするときの決まり) */
export interface LeakLook {
  /** fx_psy_lamp のコマ(0:ふつう、1:もれ(紫)、2:切れかけ、4:紫のセロハン) */
  lampFrame: 0 | 1 | 2 | 4;
  /** 照明のまわりに出す火花の数(もれだけ。2か所とももれていれば2つ、照明だけなら1つ) */
  lampSparks: 0 | 1 | 2;
  /** 1つ目の小物を浮かせる(もれ、手品の糸、手品の紫の煙、紫の風船) */
  itemFloat: boolean;
  /** 浮いた小物を紫のもやで包み、火花を1つ出す(もれ) */
  haze: boolean;
  /** つえの先から小物へ糸を引く(手品の糸、手品の紫の煙) */
  thread: boolean;
  /** 小物のそばに紫の煙を出す(手品の紫の煙) */
  smoke: boolean;
  /** 小物に紫の風船をひもで結ぶ(紫の風船) */
  balloon: boolean;
}

/** leakSpots の答えから、照明と小物の見せ方を決める。親玉とふつうの市民は全部ふつう */
export function leakLook(s: LeakSpots): LeakLook {
  const lampFrame = s.light === 'leak' ? LAMP_FRAMES.leak
    : s.light === 'flicker' ? LAMP_FRAMES.flicker
      : s.light === 'cellophane' ? LAMP_FRAMES.cellophane : LAMP_FRAMES.normal;
  return {
    lampFrame,
    // もれが照明だけのときは、火花を1つにして少し見つけにくくする
    lampSparks: s.light !== 'leak' ? 0 : s.item === 'leak' ? 2 : 1,
    itemFloat: s.item !== null,
    haze: s.item === 'leak',
    thread: s.item === 'thread' || s.item === 'smoke',
    smoke: s.item === 'smoke',
    balloon: s.item === 'balloon'
  };
}

/** 何も起きていないときの見せ方(人が出ていないとき、中断中) */
export const CALM_LOOK: LeakLook = leakLook({ light: null, item: null });
