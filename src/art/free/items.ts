// 波3の小物(風船、とんがり帽子、紙袋)を、人の絵のどこに付けるかの表(docs/FREEPLAY.md の「波3」)。
// 使い方(右向きの人):
//   const a = itemAnchor(person.sheetKey, item);      // null ならその見た目には付けない
//   const key = FREE_ITEM_SHEETS[item];
//   this.add.sprite(feetX + a.dx, feetY + a.dy, key).setOrigin(...originFor(key)).setDepth(personDepth + (a.front ? 0.1 : -0.1));
//   (feetX, feetY は人の絵を originFor(sheetKey) で置いた位置。足の裏の線)
// 左向き(faceLeft)の人は dx を -dx にし、小物の絵も setFlipX(true) にする(人と小物を同じように反転すれば、ずれない)。
// 風船は 'fp_item_balloon.float' を流す。
//
// 表の値は、待機の1コマ目(右向き)で決めた。歩くときや待機の2コマ目は体が1ドット上下するが、小物は動かさなくてよい。
// 驚く、吹っ飛ぶ、のびているコマのあいだは、小物を消すか、手から離して飛ばす(風船は上へ、帽子と袋は落とす)。
//   帽子:下の真ん中を、頭のてっぺん(髪や帽子の上に2〜3ドットかぶる所)に合わせる
//   風船:ひもの下の端を、手前の手に合わせる。玉は頭の上の後ろ寄り(顔と反対の側)に浮かぶ
//   紙袋:持ち手のてっぺんを、手前の手に合わせる。紙袋は買い物袋の女性とおじさんには付けない(もう袋を持っているので)
// モヒカンの髪と宇宙人の触角は、帽子を人の後ろ(front: false)に置いて、髪と触角が帽子より手前に見えるようにしてある。
// どのワルも、目印(ナイフ、バンダナ、バット、触角)は小物に隠れない。
import type { FreeItem } from '../../logic/types';

export interface ItemAnchor {
  /** 足の裏(originFor で置いた位置)からの横のずれ。右向きのときの値 */
  dx: number;
  /** 足の裏からの縦のずれ(上がマイナス) */
  dy: number;
  /** 人より手前に描くか(false なら人の後ろ) */
  front: boolean;
}

/** 小物 → 絵のキー */
export const FREE_ITEM_SHEETS: Readonly<Record<FreeItem, string>> = {
  balloon: 'fp_item_balloon',
  hat: 'fp_item_hat',
  bag: 'fp_item_bag'
};

/** ルールの札で使う小物の絵のキー */
export const FREE_ITEM_ICONS: Readonly<Record<FreeItem, string>> = {
  balloon: 'ui_item_balloon',
  hat: 'ui_item_hat',
  bag: 'ui_item_bag'
};

/**
 * 見た目ごとの、帽子のつばの段と頭の真ん中、手前の手(64×64 のコマの中のドット。右向き)。
 * hatX は頭の真ん中の線(ドットとドットの境目)、hatY は帽子のいちばん下の段が来るドットの行。
 * hand は手前の手の真ん中のドット。hatBehind は帽子を人の後ろに置く見た目。noBag は紙袋を付けない見た目
 */
interface Spot { hatX: number; hatY: number; hand: [number, number]; hatBehind?: boolean; noBag?: boolean }

/** 立ち姿(STAND)の手前の手 */
const HAND: [number, number] = [32, 35];

const SPOTS: Readonly<Record<string, Spot>> = {
  // 路地裏
  hoodie_civ: { hatX: 35, hatY: 8, hand: HAND },
  suit_civ: { hatX: 35, hatY: 9, hand: HAND },
  shopper_civ: { hatX: 35, hatY: 9, hand: HAND, noBag: true },
  granny_civ: { hatX: 41, hatY: 14, hand: [34, 38] },
  // 地下駐車場(小物の色を塗り替えたシート 'guard_civ#ff8000' なども同じ)
  guard_civ: { hatX: 35, hatY: 7, hand: HAND },
  mechanic_civ: { hatX: 35, hatY: 8, hand: HAND },
  clubber_civ: { hatX: 35, hatY: 7, hand: HAND },
  officelady_civ: { hatX: 35, hatY: 8, hand: HAND },
  // ショッピングモール
  mascot_civ: { hatX: 34, hatY: 9, hand: [30, 36] },
  clerk_civ: { hatX: 35, hatY: 8, hand: HAND },
  dancer_civ: { hatX: 35, hatY: 7, hand: HAND },
  uncle_civ: { hatX: 35, hatY: 9, hand: HAND, noBag: true },
  // 一目で分かるワル。モヒカンと宇宙人の帽子は、人の後ろで少し高く置き、
  // 髪のぎざぎざと触角が帽子の下のほうを突き抜けて見えるようにする
  fp_mohawk: { hatX: 35, hatY: 4, hand: [35, 33], hatBehind: true },
  fp_gang: { hatX: 35, hatY: 6, hand: [33, 35] },
  fp_alien: { hatX: 35, hatY: 6, hand: HAND, hatBehind: true }
};

/** 表にある見た目のシートのキー(フリープレイに出る全部の見た目) */
export const FREE_LOOK_SHEETS: readonly string[] = Object.keys(SPOTS);

/** コマの中で、足の裏の点(originFor の 'feet')は左から32、上から60のドットの境目 */
const FEET_X = 32, FEET_Y = 60;

/**
 * その見た目の人に小物を付ける場所(足の裏からのずれ。右向き)。付けないときは null。
 * sheetKey は色を塗り替えたシートのキー('guard_civ#ff8000')でもよい
 */
export function itemAnchor(sheetKey: string, item: FreeItem): ItemAnchor | null {
  const s = SPOTS[sheetKey.split('#')[0]];
  if (!s) return null;
  switch (item) {
    // 帽子の絵は下の真ん中が基準。いちばん下の段の下の端を hatY の下の端に合わせる
    case 'hat': return { dx: s.hatX - FEET_X, dy: s.hatY + 1 - FEET_Y, front: !s.hatBehind };
    // 風船の絵は下の真ん中が基準。ひもの下の端のドットを手のドットに重ねる
    case 'balloon': return { dx: s.hand[0] - FEET_X, dy: s.hand[1] + 1 - FEET_Y, front: true };
    // 紙袋の絵は上の真ん中が基準。持ち手のてっぺんのドットを手のドットに重ねる
    case 'bag': return s.noBag ? null : { dx: s.hand[0] - FEET_X, dy: s.hand[1] - FEET_Y, front: true };
  }
}
