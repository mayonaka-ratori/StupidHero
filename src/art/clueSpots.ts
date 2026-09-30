// 仕分けの画面の「持ち物」の窓で大きく見せる場所。シートごとに、コマの中の四角(左上と大きさ)を決める。
// 使い方:
//   const r = clueSpotFor(person.sheetKey);   // { x, y, w, h }(64×64 のコマの中のドット)
//   sprite.setCrop(r.x, r.y, r.w, r.h);        // その場所だけを切り出して、窓の中で3倍にする
// 場所は仕分けの動き(sortIdle)の4コマを見て決めた。4コマのどれでも手がかりが四角に入るようにしてある。
// ステージ1の小物は、ふちの線まで、四角のふちから1ドット以上内側に入れる(切れると形が変わり、ちがう小物に見える。
// tellSheets.test.ts で確かめる)。
//
// 同じ見た目の市民、ワル、ボスの化けた姿は、かならず同じ四角にする(窓に映る場所で正体が分からないように)。
// そのため、四角はその見た目の市民とワルの手がかりが両方入る場所にし、ボスのおかしなところは入るときだけ入る。
//   パーカー:ポケットのあたり(市民は財布、バナナ、カギ。ワルはナイフの柄、メリケンサック、スタンガン)
//   スーツ:胸と腕のあたり(市民とボスは腕時計、スマホ、切符。ワルは赤いバッグ、がま口、真珠。ボスは腕の水色の入れ墨も)
//   買い物袋:袋の口と手(市民とボスは米袋、長ねぎ、フランスパン。ワルは金色の財布、腕時計、スマホ。
//   ボスは袋を高く持ち上げているので、小物の上のはしが出ることがある)
//   おばあさん:背中の手(市民は腰をたたく手。ボスは腕の水色の入れ墨)
//   モヒカン:ナイフを持つ手
//   ステージ2の4人:小物(腕章、首の布、ヘアバンド、スカーフ)。女ボスは金色の小物(会社員の女ボスは金の腕輪も、4コマのうち3コマで入る。
//   警備員の女ボスのサングラスは頭の上なので入らない)
//   ステージ3の4人:くずれる場所(着ぐるみは頭、店員は目、学生は腕のつけね、おじさんは胴)。市民のぎこちない動きも同じ四角に入る。
//   親玉は、着ぐるみの触角は入る。店員の逆さの名札とおじさんのとがった耳は入らない(見た目で見分ける)

import { TELL_BASE } from './sheets';

/** 窓で見せる四角の大きさ(コマのドット)。窓の中では3倍にする */
export const CLUE_W = 16;
export const CLUE_H = 14;

export interface ClueRect { x: number; y: number; w: number; h: number }

const r = (x: number, y: number): ClueRect => ({ x, y, w: CLUE_W, h: CLUE_H });

/** 見た目ごとの四角 */
const HOODIE = r(18, 26);
const SUIT = r(24, 21);
const SHOPPER = r(30, 27);
const GRANNY = r(20, 22);
const MOHAWK = r(35, 22);
const GUARD = r(26, 15);
const MECHANIC = r(25, 14);
const CLUBBER = r(26, 3);
const OFFICELADY = r(26, 13);
const MASCOT = r(26, 4);
const CLERK = r(31, 7);
const DANCER = r(27, 14);
const UNCLE = r(23, 23);

/** 元の絵の四角(手がかりの出し分けの絵は、下で元の絵と同じ四角を足す) */
const BASE_SPOTS: Readonly<Record<string, ClueRect>> = {
  hoodie_civ: HOODIE,
  hoodie_bad: HOODIE,
  suit_civ: SUIT,
  suit_bad: SUIT,
  boss_disguise_suit: SUIT,
  shopper_civ: SHOPPER,
  shopper_bad: SHOPPER,
  boss_disguise_shopper: SHOPPER,
  granny_civ: GRANNY,
  boss_disguise_granny: GRANNY,
  villain_mohawk: MOHAWK,
  guard_civ: GUARD,
  guard_bad: GUARD,
  boss2_disguise_guard: GUARD,
  mechanic_civ: MECHANIC,
  mechanic_bad: MECHANIC,
  boss2_disguise_mechanic: MECHANIC,
  clubber_civ: CLUBBER,
  clubber_bad: CLUBBER,
  officelady_civ: OFFICELADY,
  officelady_bad: OFFICELADY,
  boss2_disguise_officelady: OFFICELADY,
  mascot_civ: MASCOT,
  mascot_bad: MASCOT,
  boss3_disguise_mascot: MASCOT,
  clerk_civ: CLERK,
  clerk_bad: CLERK,
  boss3_disguise_clerk: CLERK,
  dancer_civ: DANCER,
  dancer_bad: DANCER,
  uncle_civ: UNCLE,
  uncle_bad: UNCLE,
  boss3_disguise_uncle: UNCLE
};

/**
 * 仕分けに出るシート → 四角。手がかりの出し分けの絵(sheets.ts の TELL_SHEETS。'hoodie_bad_knuckles' など)は、
 * 元の絵と同じ四角(映る場所で、どの出し分けかも正体も分からないように)
 */
export const CLUE_SPOTS: Readonly<Record<string, ClueRect>> = {
  ...BASE_SPOTS,
  ...Object.fromEntries(Object.entries(TELL_BASE).map(([key, base]) => [key, BASE_SPOTS[base]]))
};

/** そのシートの四角(色を塗り替えたシートのキー 'guard_civ#ff0000' でもよい)。表にないときは胸のあたり */
export function clueSpotFor(sheetKey: string): ClueRect {
  return CLUE_SPOTS[sheetKey.split('#')[0]] ?? r(24, 22);
}
