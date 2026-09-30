// 人の服の色ちがい(docs/ART_SPEC.md の「服の色ちがい」)。
// 同じ見た目の人を、遊ぶたびにちがう色の服で出して、くり返し遊んでも同じ絵ばかりに見えないようにする。
// 色ちがいは見た目ごとに4つ(0 はいまの色、1〜3 はこの表の色)。どれを使うかは logic の colorVariants.ts が
// ステージの種から決める(ワルかどうかとは関係なく決めるので、手がかりにはならない)。
//
// 人の絵を描く関数は変えずに、描き上がった絵のドットの色を、この表の通りに置きかえる。
//   const map = variantSwap('hoodie_civ', 2);   // 色の置きかえ(0 や表にないシートは null)
//   recolorPixels(px, w, h, fw, fh, map)        // ドットの色の数の並び(0xRRGGBB、透明は -1)を置きかえる
// ゲームの中では recolor.ts の personSheet がこれを使って、塗り替えたシートを作る。
//
// 置きかえるのは服の色だけ。肌、髪、ふち、目、手がかりの小物、ステージ2の赤紫(小物の色のもと)は置きかえない。
// 髪を変えないのは、ART_SPEC の「市民と悪党は、肌、髪、ふちの色を同じにする」に合わせるため
// (髪の明るい色は肌の影、暗い色はふちと同じ色なので、置きかえると顔までかわってしまう)。
// モヒカンの髪だけは服と同じ扱いにする(ワルだけの見た目で、髪の色が見た目の中心なので)。

import { PixelGrid, md } from './lib';
import { TELL_BASE } from './sheets';

type Colors = readonly string[];

/** 1つの服の色の置きかえ。from の色を、色ちがい1〜3で to[0]〜to[2] の色にする(from と同じ並び) */
interface Swap {
  from: Colors;
  to: readonly [Colors, Colors, Colors];
}

/** 見た目ごとの色ちがい */
interface LookColors {
  /** この色ちがいを使うシート(市民、ワル、ボスの化けた姿) */
  sheets: readonly string[];
  swaps: readonly Swap[];
  /**
   * from の色のうち、服のほかの所(靴の影、目の白など)にも使っている色。
   * この色のドットは、同じ色のひとかたまりが服のほかの色のドットにとなり合うときか、
   * かたまりが大きい(SHARED_BLOCK ドット以上)ときだけ置きかえる
   * (服のひと続きの所だけ変わり、はなれた靴や目は変わらない)
   */
  shared?: Colors;
}

/** 色ちがいの数(0 のいまの色を入れて4つ)。logic の COLOR_VARIANT_COUNT と同じにする(テストで確かめる) */
export const VARIANTS_PER_LOOK = 4;

// どの色にするかの決まり(ステージごと):
// - ステージ1:手がかりの色(ナイフの柄の黄色、財布の茶色、バッグの赤、金、ボスの入れ墨の水色)に近い色の服にしない。
//   黄、茶、赤、ピンク、金、水色を使わず、緑、紺、紫、灰色、黒から選ぶ
// - ステージ2:小物の6色(赤、緑、黄、水色、紫、オレンジ)と女ボスの金に見える服にしない(組の見分けがつかなくなる)。
//   灰色、紺、青、こげ茶、ベージュのような、あざやかでない色か青だけにする
// - ステージ3:宇宙人のくずれの黄緑に近い色(緑、黄緑、黄)の服にしない
// - ステージ4:もれの紫(赤紫、すみれ色も)と、ボスの化けた姿の手がかりの金と、切れかけの蛍光灯のうすい黄色の服にしない
export const COLOR_VARIANTS: Readonly<Record<string, LookColors>> = {
  // ─── ステージ1(路地裏) ───
  // パーカー(灰色)を、緑、黒、紫に。ジーンズはそのまま。
  // もとの絵で、くつ底はパーカーの暗い色、くつの影とパーカーのひもはパーカーの明るい色と同じ色なので、
  // そこもパーカーといっしょに変わる(パーカーとおそろいの色のくつになる)。
  // shared にしてくつを残すと、1枚の色が15色をこえるのでしない
  hoodie: {
    sheets: ['hoodie_civ', 'hoodie_bad'],
    swaps: [{
      from: [md(5, 5, 6), md(4, 4, 5), md(3, 3, 4)],
      to: [
        [md(4, 6, 4), md(3, 5, 3), md(2, 3, 2)],
        [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)],
        [md(5, 4, 6), md(4, 3, 5), md(2, 2, 3)]
      ]
    }]
  },
  // スーツ(紺)を、黒、明るい灰色、深い緑に。バッグの赤と腕時計の金と入れ墨の水色に近い色はさける
  suit: {
    sheets: ['suit_civ', 'suit_bad', 'boss_disguise_suit'],
    swaps: [{
      from: [md(3, 3, 5), md(2, 2, 4), md(1, 1, 3)],
      to: [
        [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)],
        [md(5, 5, 5), md(4, 4, 4), md(2, 2, 3)],
        [md(3, 4, 3), md(2, 3, 2), md(1, 2, 1)]
      ]
    }]
  },
  // カーディガン(ピンク)を、灰色、うす紫、青紫に。袋の中の米袋の白と金、入れ墨の水色に近い色はさける
  // (水色のそでだと、ボスの腕の入れ墨が見えにくくなる)
  shopper: {
    sheets: ['shopper_civ', 'shopper_bad', 'boss_disguise_shopper'],
    swaps: [{
      from: [md(7, 4, 4), md(6, 2, 3), md(4, 1, 2)],
      to: [
        [md(5, 5, 5), md(4, 4, 4), md(2, 2, 2)],
        [md(6, 5, 7), md(5, 4, 6), md(3, 2, 4)],
        [md(4, 4, 6), md(3, 3, 5), md(2, 2, 3)]
      ]
    }]
  },
  // モヒカン(いつもワル)は、髪を青、オレンジがかった赤、すみれ色に。ベストとナイフはそのまま
  mohawk: {
    sheets: ['villain_mohawk'],
    swaps: [{
      from: [md(7, 3, 6), md(6, 1, 5), md(3, 0, 3)],
      to: [
        [md(4, 6, 7), md(2, 4, 7), md(1, 1, 4)],
        [md(7, 4, 3), md(6, 2, 1), md(4, 1, 0)],
        [md(6, 5, 7), md(4, 3, 7), md(2, 1, 4)]
      ]
    }]
  },
  // おばあさんのショール(紫)を、深い緑、紺、あずき色がかった灰色に。入れ墨の水色に近い色(明るい青も)はさける。
  // スカートのオリーブ色(黄みの灰色)に近いこけ色はさける(ショールとスカートが同じ色に見える)
  granny: {
    sheets: ['granny_civ', 'boss_disguise_granny'],
    swaps: [{
      from: [md(5, 3, 6), md(4, 2, 5), md(2, 1, 3)],
      to: [
        [md(2, 5, 3), md(1, 4, 2), md(0, 2, 1)],
        [md(3, 3, 5), md(2, 2, 4), md(1, 1, 2)],
        [md(5, 4, 5), md(4, 3, 4), md(2, 1, 2)]
      ]
    }]
  },

  // ─── ステージ2(地下駐車場) ───
  // 警備員のシャツ(水色がかった青)を、明るい灰色、暗い灰色、こげ茶に。制服の紺と帽子はそのまま
  guard: {
    sheets: ['guard_civ', 'guard_bad', 'boss2_disguise_guard'],
    swaps: [{
      from: [md(5, 6, 7), md(4, 5, 6), md(2, 3, 5)],
      to: [
        [md(6, 6, 6), md(5, 5, 5), md(3, 3, 4)],
        [md(4, 4, 5), md(3, 3, 4), md(2, 2, 3)],
        [md(5, 4, 3), md(4, 3, 2), md(2, 1, 1)]
      ]
    }]
  },
  // 整備士のつなぎ(カーキ)を、青、灰色、黒に近い灰色に。ボスの赤いハイヒールと同じ色はさける
  mechanic: {
    sheets: ['mechanic_civ', 'mechanic_bad', 'boss2_disguise_mechanic'],
    swaps: [{
      from: [md(5, 5, 3), md(4, 4, 2), md(3, 2, 1)],
      to: [
        [md(3, 4, 6), md(2, 3, 5), md(1, 1, 3)],
        [md(5, 5, 5), md(4, 4, 4), md(2, 2, 3)],
        [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)]
      ]
    }]
  },
  // 派手な若者のジャケット(銀)を、デニムの青、こげ茶の革、灰色に。
  // いちばん明るい白は目の白とくつ底にも使っているので shared。明るい灰色はスマホのふちにも使っていて、
  // そこもジャケットといっしょに変わる(shared にすると1枚の色が15色をこえる)
  clubber: {
    sheets: ['clubber_civ', 'clubber_bad'],
    swaps: [{
      from: [md(7, 7, 7), md(5, 5, 6), md(3, 3, 5)],
      to: [
        [md(4, 5, 7), md(3, 4, 6), md(2, 2, 4)],
        [md(5, 4, 3), md(4, 3, 2), md(2, 1, 1)],
        [md(5, 5, 5), md(4, 4, 4), md(2, 2, 2)]
      ]
    }],
    shared: [md(7, 7, 7)]
  },
  // 会社員の女性の上着とスカート(灰色)を、紺、黒、らくだ色に。腕輪の金に近い色はさける
  officelady: {
    sheets: ['officelady_civ', 'officelady_bad', 'boss2_disguise_officelady'],
    swaps: [{
      from: [md(4, 4, 5), md(3, 3, 4), md(2, 2, 3)],
      to: [
        [md(3, 3, 5), md(2, 2, 4), md(1, 1, 2)],
        [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)],
        [md(5, 4, 3), md(4, 3, 2), md(2, 1, 1)]
      ]
    }]
  },

  // ─── ステージ3(ショッピングモール) ───
  // 着ぐるみ(黄色)を、茶色のくま、水色、ピンクに。くずれの黄緑に近い色はさける
  mascot: {
    sheets: ['mascot_civ', 'mascot_bad', 'boss3_disguise_mascot'],
    swaps: [{
      from: [md(7, 6, 2), md(7, 5, 1), md(5, 3, 1)],
      to: [
        [md(6, 4, 3), md(5, 3, 2), md(3, 2, 1)],
        [md(5, 6, 7), md(4, 5, 7), md(2, 3, 5)],
        [md(7, 5, 6), md(6, 4, 5), md(4, 2, 3)]
      ]
    }]
  },
  // 店員のエプロン(青)を、えんじ、茶色、黒に(ズボンも同じ色)。名札のオレンジと、くずれの黄緑に近い色はさける
  clerk: {
    sheets: ['clerk_civ', 'clerk_bad', 'boss3_disguise_clerk'],
    swaps: [{
      from: [md(3, 4, 6), md(2, 3, 5), md(1, 2, 3)],
      to: [
        [md(6, 2, 2), md(5, 1, 1), md(3, 0, 0)],
        [md(5, 4, 3), md(4, 3, 2), md(2, 1, 1)],
        [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)]
      ]
    }]
  },
  // ダンスの学生のジャージの上(赤)を、青、紫、灰色に。くずれの黄緑に近い色はさける
  dancer: {
    sheets: ['dancer_civ', 'dancer_bad'],
    swaps: [{
      from: [md(7, 3, 2), md(6, 1, 1), md(4, 0, 1)],
      to: [
        [md(4, 5, 7), md(2, 3, 6), md(1, 1, 4)],
        [md(5, 3, 6), md(4, 2, 5), md(2, 1, 3)],
        [md(5, 5, 5), md(4, 4, 4), md(2, 2, 2)]
      ]
    }]
  },
  // おじさんのカーディガン(からし色)を、えんじ、紺、明るい灰色に。くずれの黄緑に近い色はさける
  uncle: {
    sheets: ['uncle_civ', 'uncle_bad', 'boss3_disguise_uncle'],
    swaps: [{
      from: [md(6, 5, 2), md(5, 4, 1), md(3, 2, 1)],
      to: [
        [md(5, 2, 2), md(4, 1, 1), md(2, 0, 1)],
        [md(3, 3, 5), md(2, 2, 4), md(1, 1, 3)],
        [md(6, 6, 6), md(5, 5, 5), md(3, 3, 3)]
      ]
    }]
  },

  // ─── ステージ4(高層ビル)。市民とヴィランが同じシート ───
  // 花屋のエプロン(緑)を、青みの緑、オリーブ、深い緑に。エプロンの緑は花束の葉にも使っていて、
  // 葉も同じ色に変わるので、緑のなかまの色だけにする
  florist: {
    sheets: ['tw_florist'],
    swaps: [{
      from: [md(3, 5, 3), md(2, 4, 2), md(1, 2, 1)],
      to: [
        [md(2, 5, 4), md(1, 4, 3), md(0, 2, 2)],
        [md(4, 5, 2), md(3, 4, 1), md(2, 2, 0)],
        [md(2, 4, 2), md(1, 3, 1), md(0, 1, 0)]
      ]
    }]
  },
  // 配達員の帽子と上着(水色がかった青)を、緑、赤、灰色に。紫と金に近い色はさける
  courier: {
    sheets: ['tw_courier'],
    swaps: [{
      from: [md(3, 5, 6), md(2, 3, 5), md(1, 2, 3)],
      to: [
        [md(3, 5, 3), md(2, 4, 2), md(1, 2, 1)],
        [md(7, 3, 3), md(5, 1, 1), md(3, 0, 0)],
        [md(5, 5, 5), md(4, 4, 4), md(2, 2, 2)]
      ]
    }]
  },
  // 新人のスーツ(明るい紺)を、黒、灰色、茶色に
  newbie: {
    sheets: ['tw_newbie'],
    swaps: [{
      from: [md(3, 4, 6), md(2, 3, 5), md(1, 2, 3)],
      to: [
        [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)],
        [md(5, 5, 5), md(4, 4, 4), md(2, 2, 3)],
        [md(5, 4, 3), md(4, 3, 2), md(2, 1, 1)]
      ]
    }]
  },
  // 清掃員のつなぎと帽子(水色)を、うすい緑、オレンジ、紺に。紫と、切れかけの蛍光灯のうすい黄色はさける
  janitor: {
    sheets: ['tw_janitor'],
    swaps: [{
      from: [md(4, 6, 6), md(3, 5, 5), md(2, 3, 4)],
      to: [
        [md(5, 6, 4), md(4, 5, 3), md(2, 3, 2)],
        [md(7, 5, 2), md(6, 3, 1), md(4, 2, 0)],
        [md(2, 3, 5), md(1, 2, 4), md(1, 1, 2)]
      ]
    }]
  },
  // シェフの首のスカーフ(赤)とズボン(灰色)を変える。白いコック服はそのまま(目の白と同じ色なので)
  chef: {
    sheets: ['tw_chef'],
    swaps: [
      { from: [md(6, 1, 1)], to: [[md(1, 3, 6)], [md(1, 5, 2)], [md(7, 4, 2)]] },
      {
        from: [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)],
        to: [
          [md(2, 2, 4), md(1, 1, 3), md(0, 0, 2)],
          [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)],
          [md(3, 2, 2), md(2, 1, 1), md(1, 0, 0)]
        ]
      }
    ]
  },
  // ウェイターのベストとズボン(黒)を、紺、深い緑、灰色に。いちばん暗い色はふちと同じなので変えない。
  // えんじや茶色は、パーティ会場(波4)の赤いカーテンとじゅうたん、木の壁にとけこむのでさける
  waiter: {
    sheets: ['tw_waiter', 'tw_boss_waiter'],
    swaps: [{
      from: [md(2, 2, 3), md(1, 1, 2)],
      to: [
        [md(2, 2, 5), md(1, 1, 3)],
        [md(1, 3, 2), md(0, 2, 1)],
        [md(4, 4, 4), md(2, 2, 2)]
      ]
    }]
  },
  // ドレス(ワイン色)を、エメラルド、青、黒に。紫と金に近い色はさける
  lady: {
    sheets: ['tw_lady', 'tw_boss_lady'],
    swaps: [{
      from: [md(6, 2, 3), md(4, 1, 2), md(3, 0, 1)],
      to: [
        [md(2, 5, 3), md(1, 4, 2), md(0, 2, 1)],
        [md(3, 4, 7), md(2, 3, 6), md(1, 1, 4)],
        [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)]
      ]
    }]
  },
  // 手品師のえんび服とシルクハット(黒)を、紺、灰色、深い緑に。いちばん暗い色はふちと同じなので変えない。
  // えんじや茶色は、パーティ会場(波4)の赤いカーテンとじゅうたん、木の壁にとけこむのでさける
  magician: {
    sheets: ['tw_magician', 'tw_boss_magician'],
    swaps: [{
      from: [md(2, 2, 3), md(1, 1, 2)],
      to: [
        [md(2, 2, 5), md(1, 1, 3)],
        [md(4, 4, 5), md(3, 3, 3)],
        [md(1, 3, 2), md(0, 2, 1)]
      ]
    }]
  }
};

/** シートのキー → 色ちがいの見た目の名前 */
const LOOK_OF_SHEET: ReadonlyMap<string, string> = new Map(
  Object.entries(COLOR_VARIANTS).flatMap(([look, v]) => v.sheets.map((s) => [s, look] as [string, string]))
);

/**
 * シートのキーから見た目の名前を引く。塗り替えたシートのキー 'guard_civ#ff0000' でもよい。
 * 手がかりの出し分けの絵('hoodie_bad_knuckles')は元の絵('hoodie_bad')と同じ表を使う
 * (出し分けの絵だけいまの色のままだと、色でワルが分かってしまうため)
 */
const lookOfSheet = (sheetKey: string): string | undefined => {
  const key = sheetKey.split('#')[0];
  return LOOK_OF_SHEET.get(TELL_BASE[key] ?? key);
};

/** そのシートに色ちがいがあるか(塗り替えたシートのキー 'guard_civ#ff0000' でもよい) */
export const hasVariants = (sheetKey: string): boolean => lookOfSheet(sheetKey) !== undefined;

/** 'rgb(R,G,B)' → 0xRRGGBB */
export const rgbInt = (c: string): number => {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);
  if (!m) throw new Error(`色の書き方がちがう: ${c}`);
  return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
};

/** 色の置きかえ(0xRRGGBB → 0xRRGGBB)と、shared の色 */
export interface VariantSwap {
  map: ReadonlyMap<number, number>;
  shared: ReadonlySet<number>;
}

/** そのシートの色ちがいの置きかえ。0、表にないシート、範囲の外の番号は null(いまの色のまま) */
export function variantSwap(sheetKey: string, variant: number | undefined): VariantSwap | null {
  if (!variant || variant < 1 || variant >= VARIANTS_PER_LOOK) return null;
  const look = lookOfSheet(sheetKey);
  if (!look) return null;
  const def = COLOR_VARIANTS[look];
  const map = new Map<number, number>();
  for (const s of def.swaps) s.from.forEach((c, i) => map.set(rgbInt(c), rgbInt(s.to[variant - 1][i])));
  return { map, shared: new Set((def.shared ?? []).map(rgbInt)) };
}

/**
 * ドットの色を置きかえた新しい並びを返す。px は左上から横に並べた色(0xRRGGBB、透明は -1)、w×h の絵。
 * fw×fh はコマの大きさ(shared の色のかたまりは、コマの境目をまたいでつながらない)。
 * shared でない from の色はいつも置きかえ、shared の色は、同じ色のひとかたまりが置きかえたドットに
 * となり合うときだけ置きかえる(置きかえたかたまりのとなりも、同じように広げていく)
 */
export function recolorPixels(px: Int32Array, w: number, h: number, fw: number, fh: number, swap: VariantSwap): Int32Array {
  const { map, shared } = swap;
  const n = w * h;
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (map.has(px[i]) && !shared.has(px[i])) on[i] = 1;
  if (shared.size > 0) spreadShared(px, w, h, fw, fh, shared, on);
  const out = px.slice();
  for (let i = 0; i < n; i++) if (on[i]) out[i] = map.get(px[i])!;
  return out;
}

/** 1コマの格子の色を置きかえた、新しい格子(テストと tools/artsheet.mjs で使う。ゲームはキャンバスで同じことをする) */
export function recolorGrid(g: PixelGrid, swap: VariantSwap): PixelGrid {
  const px = new Int32Array(g.w * g.h);
  const names = new Map<number, string>();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.cells[y][x];
    px[y * g.w + x] = c ? rgbInt(c) : -1;
    if (c) names.set(rgbInt(c), c);
  }
  const out = recolorPixels(px, g.w, g.h, g.w, g.h, swap);
  const r = new PixelGrid(g.w, g.h);
  for (let i = 0; i < out.length; i++) {
    if (out[i] < 0) continue;
    const v = out[i];
    r.cells[Math.floor(i / g.w)][i % g.w] = names.get(v) ?? `rgb(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255})`;
  }
  return r;
}

/** shared の色のかたまりが、これだけのドット数以上なら、となりに関係なく服と見て置きかえる */
const SHARED_BLOCK = 16;

/** shared の色のかたまりを、置きかえるドットにとなり合うものから順に置きかえる印をつける */
function spreadShared(px: Int32Array, w: number, h: number, fw: number, fh: number, shared: ReadonlySet<number>, on: Uint8Array): void {
  const n = w * h;
  // 同じ色で上下左右につながったかたまりに番号をつける(コマの境目ではつながない)
  const comp = new Int32Array(n).fill(-1);
  const members: number[][] = [];
  const nb = (i: number): number[] => {
    const x = i % w, y = (i - x) / w, out: number[] = [];
    if (x % fw !== 0) out.push(i - 1);
    if ((x + 1) % fw !== 0 && x + 1 < w) out.push(i + 1);
    if (y % fh !== 0) out.push(i - w);
    if ((y + 1) % fh !== 0 && y + 1 < h) out.push(i + w);
    return out;
  };
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0 || !shared.has(px[i])) continue;
    const id = members.length, list = [i];
    comp[i] = id;
    for (let k = 0; k < list.length; k++) {
      for (const j of nb(list[k])) if (comp[j] < 0 && px[j] === px[i]) { comp[j] = id; list.push(j); }
    }
    members.push(list);
  }
  // 大きなかたまり(SHARED_BLOCK ドット以上)は服と見る(ふちで囲まれた腕など。靴の影や目の白はもっと小さい)
  const done = new Uint8Array(members.length);
  members.forEach((list, id) => {
    if (list.length < SHARED_BLOCK) return;
    for (const i of list) on[i] = 1;
    done[id] = 1;
  });
  // 置きかえるドットにとなり合うかたまりを、増えなくなるまで広げる
  let changed = true;
  while (changed) {
    changed = false;
    for (let id = 0; id < members.length; id++) {
      if (done[id]) continue;
      if (!members[id].some((i) => nb(i).some((j) => on[j] === 1))) continue;
      for (const i of members[id]) on[i] = 1;
      done[id] = 1;
      changed = true;
    }
  }
}
