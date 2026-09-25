// ステージ4のもれと念力のエフェクト。紫(PSY)は半透明にせず、市松で薄く見せる。
// どれも左右反転しても変に見えない形にする。置くときの基準はコマの真ん中(照明だけは上の真ん中)。
import { md, OUTLINE, PixelGrid } from '../lib';
import { Painter } from '../world/pix';
import { GOLD, WHITE } from '../world/palette';
import { dith } from '../world/wrap';
import { sprite } from './people';
import { PSY, WEAK } from './palette';

const W0 = WHITE[0];

const frames = (w: number, h: number, n: number, draw: (g: PixelGrid, i: number) => void): PixelGrid[] =>
  Array.from({ length: n }, (_, i) => {
    const g = new PixelGrid(w, h);
    draw(g, i);
    return g;
  });

/** 紫の火花 9×9(十字)。小さい → 大きい → 細長い → 消えかけ */
function spark(w: number, h: number, n: number): PixelGrid[] {
  const c = Math.floor(w / 2);
  return frames(w, h, n, (g, i) => {
    const r = [1, 2, 3, 1][i % 4];
    for (let k = -r; k <= r; k++) {
      const col = Math.abs(k) === r && r > 1 ? PSY[2] : PSY[1];
      g.px(c + k, c, col).px(c, c + k, col);
    }
    if (i % 4 === 1) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.px(c + dx, c + dy, PSY[2]);
    if (i % 4 === 3) { g.px(c, c, PSY[2]); return; }
    g.px(c, c, PSY[0]);
    if (r >= 2) g.px(c - 1, c, PSY[0]).px(c + 1, c, PSY[0]).px(c, c - 1, PSY[0]).px(c, c + 1, PSY[0]);
  });
}

/** 紫のもや 16×14。浮いた小物を包む市松の輪。2コマは市松の向きを入れかえたもの */
function haze(w: number, h: number, n: number): PixelGrid[] {
  const cx = (w - 1) / 2, cy = (h - 1) / 2, rx = w / 2, ry = h / 2;
  return frames(w, h, n, (g, i) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d >= 1) continue;
      const on = dith(x + i, y);
      if (d > 0.62 && on) g.px(x, y, d > 0.82 ? PSY[2] : PSY[1]);
      else if (d > 0.4 && on && (x + y + i) % 4 === 0) g.px(x, y, PSY[2]);
    }
    // 輪の上に小さな明るい粒
    g.px(Math.round(cx + 5), 2 + i, PSY[0]).px(Math.round(cx - 6), h - 4 - i, PSY[0]);
  });
}

/**
 * 仕分けの画面の左上の照明 40×24(天井につけた蛍光灯と、下へこぼれる光)。
 * 0:ふつう(白)、1:もれ(紫)、2:切れかけ(うすい黄色で端が黒い)、3:切れかけの暗いほう
 */
function lamp(w: number, h: number, n: number): PixelGrid[] {
  const METAL = [md(5, 5, 5), md(4, 4, 5), md(3, 3, 4)];
  return frames(w, h, n, (g, i) => {
    const P = new Painter(w, h);
    // 天井から下げる2本のつり線
    P.rect(8, 0, 1, 2, METAL[2]).rect(31, 0, 1, 2, METAL[2]);
    // 本体(金属の箱)
    P.fill(P.mask().rect(3, 2, 34, 4), [METAL[0], METAL[1], METAL[2]], { sep: 'outline', hi: 0.3, lo: 0.8 });
    // 光る管
    const tube = [[W0, md(7, 7, 6)], [PSY[0], PSY[1]], [WEAK[0], WEAK[1]], [WEAK[1], WEAK[2]]][i];
    P.rect(4, 6, 32, 2, tube[1]).rect(6, 6, 28, 1, tube[0]);
    if (i >= 2) {
      // 切れかけ:管の両端が黒い
      P.rect(4, 6, 4, 2, OUTLINE).rect(32, 6, 4, 2, OUTLINE);
    }
    P.outline();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = P.g.get(x, y); if (c) g.px(x, y, c); }
    // 下へこぼれる光(市松。下ほど広く、まばらに)
    const spill = [md(6, 6, 6), PSY[2], WEAK[2], null][i];
    if (!spill) return;
    for (let y = 10; y < h; y++) {
      const half = 14 + (y - 10) * 0.45;
      for (let x = Math.round(20 - half); x <= Math.round(19 + half); x++) {
        if (!dith(x, y) || y % 2 !== 0) continue;
        if (i === 2 && x % 4 !== 0) continue;
        if (y > 18 && (x + y) % 4 !== 0) continue;
        g.px(x, y, spill);
      }
    }
    if (i === 1) {
      // もれ:照明のまわりの紫の粒(火花は fx_psy_spark をコードで重ねる)
      g.px(1, 4, PSY[1]).px(38, 9, PSY[1]).px(2, 12, PSY[0]);
    }
  });
}

/**
 * 机の上の小物 12×12:ペン、名刺、マグカップ、グラス、ナプキン、キャンドル、ケーキ、肉料理(どれも3×3ドット以上)。
 * ケーキと肉料理は、親玉が正体を現したときに会場で浮く料理(白い皿にのせる)。どれも下の端は7段目にそろえる
 */
function items(w: number, h: number, n: number): PixelGrid[] {
  const INK = md(2, 3, 6), CAP = GOLD[1], PAPER = WHITE[2], COFFEE = md(3, 2, 1), GLASS = md(6, 7, 7), FIZZ = md(7, 6, 2);
  const SPONGE = md(7, 6, 3), BERRY = md(6, 1, 1), MEAT = md(4, 2, 1), MEAT_HI = md(5, 3, 1), LEAF = md(2, 4, 1);
  const draw: ((P: Painter) => void)[] = [
    // ペン(紺の軸、金の先)
    (P) => sprite(P, 2, 4, ['.......b', '....bbb.', '.bbb....', 'w.......'], { b: INK, w: CAP }),
    // 名刺(白い札、紺の印と灰色の線。文字は描かない)
    (P) => sprite(P, 2, 3, ['wwwwwww', 'wbwgggw', 'wwwwwww', 'wggggww'], { w: W0, b: INK, g: PAPER }),
    // マグカップ(白、コーヒー、取っ手)
    (P) => sprite(P, 3, 3, ['wwwww.', 'wcccwh', 'wwwwwh', 'wwwww.', '.www..'], { w: W0, c: COFFEE, h: PAPER }),
    // グラス(シャンパン)
    (P) => sprite(P, 4, 2, ['g.g', 'ygy', 'yyy', '.g.', '.g.', 'ggg'], { g: GLASS, y: FIZZ }),
    // ナプキン(三角に折った白い布。折り目は灰色)
    (P) => sprite(P, 2, 4, ['....w...', '...wgw..', '..wwgww.', '.wwwgwww'], { w: W0, g: PAPER }),
    // キャンドル(白いろうそく、黄色い炎、金の台)
    (P) => sprite(P, 4, 1, ['.f.', '.y.', 'www', 'www', 'www', 'wwp', 'ooo'], { f: FIZZ, y: W0, w: W0, p: PAPER, o: CAP }),
    // ケーキ(白い皿に、いちごをのせたショートケーキ。スポンジとクリームの2段)
    (P) => sprite(P, 2, 2, ['...rr...', '..wwww..', '..ssss..', '..wrrw..', '..ssss..', 'pwwwwwwp'], { r: BERRY, w: W0, s: SPONGE, p: PAPER }),
    // 肉料理(白い皿に、焼いた肉と葉っぱ)
    (P) => sprite(P, 2, 3, ['...l.l..', '..mmmm..', '.mhhmmm.', '.mmmmmm.', 'pwwwwwwp'], { l: LEAF, m: MEAT, h: MEAT_HI, w: W0, p: PAPER })
  ];
  return Array.from({ length: n }, (_, i) => {
    const P = new Painter(w, h);
    draw[i](P);
    return P.g;
  });
}

export const FX4: Record<string, (w: number, h: number, n: number) => PixelGrid[]> = {
  fx_psy_spark: spark,
  fx_psy_haze: haze,
  fx_psy_lamp: lamp,
  fx_psy_items: items
};
