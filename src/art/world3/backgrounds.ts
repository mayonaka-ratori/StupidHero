// 閉店まぎわの夜のショッピングモールの背景3枚。どれも左右の端がつながる(x は幅で折り返して描く)。
// 背景だけはディザ(市松模様)を使ってよい。3枚合わせて45色まで。文字は描かない(看板は色と形だけ)。
import { md, OUTLINE, PixelGrid } from '../lib';
import { Wrap, dith, hash } from '../world/wrap';

// ---------- 色(3枚で共通) ----------
const NIGHT = [md(0, 0, 1), md(1, 1, 2), md(1, 1, 3)];
const STAR = md(7, 7, 7), STAR_D = md(4, 4, 6);
const MOON = md(7, 7, 5);
/** 建物(明るい → 暗い) */
const C = [md(6, 6, 6), md(5, 5, 5), md(4, 4, 5), md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)];
/** 店の明かり */
const LIT = [md(7, 7, 6), md(7, 6, 4), md(6, 5, 3), md(4, 3, 2)];
/** 看板の色 */
const PINK = md(7, 3, 5), CYAN = md(3, 6, 7), ORANGE = md(7, 4, 1), PURPLE = md(4, 2, 5), RED = md(6, 1, 2);
/** ガラスの手すり */
const GLASS = [md(4, 6, 7), md(3, 4, 5), md(2, 3, 4)];
/** 床のタイル */
const FLOOR = [md(6, 5, 4), md(5, 4, 3), md(4, 3, 3), md(3, 2, 2)];
/** 植えこみ */
const LEAF = [md(3, 5, 2), md(2, 4, 1), md(1, 2, 1)];

/** 棚に並んだ商品(色の箱) */
function goods(G: Wrap, x: number, y: number, w: number, seed: number): void {
  const cols = [PINK, CYAN, ORANGE, LIT[0], PURPLE, RED];
  for (let i = 0; i < w; i += 3) {
    const h = 2 + Math.floor(hash(x + i, y, seed) * 3);
    G.rect(x + i, y - h, 2, h, cols[Math.floor(hash(i, seed, 3) * cols.length)]);
  }
  G.rect(x - 1, y, w + 1, 1, C[3]);
}

/** 閉まったシャッター(横のすじ)。open は上から何ドット上げたか */
function shutter(G: Wrap, x: number, y: number, w: number, h: number, open: number): void {
  const sh = h - open;
  for (let j = 0; j < sh; j++) G.rect(x, y + j, w, 1, j % 3 === 2 ? C[4] : j % 3 === 0 ? C[2] : C[3]);
  G.rect(x, y + sh - 1, w, 1, C[5]);
  if (sh > 4) G.rect(x + Math.floor(w / 2) - 3, y + sh - 3, 6, 1, C[5]);
}

// =====================================================================
// 奥 216×214(透明なし)。天窓の夜空、吹き抜けの上の階の店、手すり
// =====================================================================
export function drawFar(): PixelGrid {
  const W = 216, H = 214;
  const G = new Wrap(W, H);
  G.rect(0, 0, W, H, C[4]);
  // 天窓(夜空と星と月)
  G.rect(0, 0, W, 28, NIGHT[0]);
  G.dither(0, 20, W, 8, NIGHT[0], NIGHT[1]);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash(i, 1, 2) * W), y = Math.floor(hash(i, 2, 2) * 24);
    G.px(x, y, i % 4 === 0 ? STAR : STAR_D);
  }
  G.rect(150, 5, 5, 5, MOON).px(150, 5, NIGHT[0]).px(154, 9, NIGHT[0]).rect(152, 6, 2, 2, NIGHT[2]);
  // 天窓のわく
  for (let x = 0; x < W; x += 27) G.rect(x, 0, 2, 28, C[4]).rect(x, 0, 1, 28, C[3]);
  G.rect(0, 12, W, 1, C[4]);
  G.rect(0, 26, W, 3, C[3]).rect(0, 28, W, 1, C[5]);
  // 3階と2階の店(遠いほど暗い)
  const floor = (y: number, h: number, dark: boolean) => {
    G.rect(0, y, W, h, dark ? C[4] : C[3]);
    for (let x = 0; x < W; x += 54) {
      const lit = hash(x, y, 4) > 0.35;
      const sx = x + 6, sw = 40;
      G.rect(sx, y + 5, sw, h - 7, lit ? LIT[dark ? 3 : 2] : C[5]);
      if (lit) {
        G.dither(sx, y + 5, sw, 2, LIT[1], LIT[2]);
        goods(G, sx + 3, y + h - 6, sw - 6, x + y);
      } else shutter(G, sx, y + 5, sw, h - 7, 0);
      // 看板(色の板だけ)
      G.rect(sx + 8, y + 1, 24, 3, [PINK, CYAN, ORANGE, PURPLE][(x / 54) % 4]);
      // 柱
      G.rect(x, y, 4, h, C[dark ? 3 : 2]).rect(x, y, 1, h, C[1]);
    }
    // 手すり(ガラスと上の金属)
    G.rect(0, y + h, W, 6, GLASS[2]).rect(0, y + h, W, 1, C[1]);
    for (let x = 0; x < W; x += 9) G.rect(x, y + h, 1, 6, C[3]);
    G.rect(0, y + h + 6, W, 3, C[2]).rect(0, y + h + 9, W, 1, C[5]);
    // 下の階の天井のあかり
    for (let x = 12; x < W; x += 27) G.rect(x, y + h + 10, 3, 1, LIT[0]);
  };
  floor(29, 24, true);
  floor(67, 30, false);
  // 吹き抜けの下(ほとんど手前の壁に隠れる)
  G.rect(0, 112, W, 102, C[4]);
  G.dither(0, 112, W, 4, C[5], C[4]);
  for (let x = 0; x < W; x += 54) G.rect(x + 10, 118, 34, 50, LIT[3]);
  G.rect(0, 168, W, 46, FLOOR[3]);
  return G.g;
}

// =====================================================================
// 手前の壁 648×130。上は吹き抜け(透明)、2階の床のへり、1階の店の並び
// =====================================================================
/** 店の区画(左はし、幅、種類) */
const SHOPS: [number, number, 'window' | 'half' | 'closed' | 'fashion'][] = [
  [0, 108, 'window'], [108, 108, 'half'], [216, 108, 'fashion'], [324, 108, 'closed'], [432, 108, 'window'], [540, 108, 'half']
];
/** 明かりがもれて床に映る場所(床の絵と合わせる) */
const MALL_LIGHTS = [20, 128, 236, 452, 560];

export function drawWall(): PixelGrid {
  const W = 648, H = 130;
  const G = new Wrap(W, H);
  // 2階の手すりと、床のへり(ここより上は透明。奥の絵の天窓と3階が見える)
  G.rect(0, 46, W, 8, GLASS[1]);
  for (let x = 0; x < W; x += 12) G.rect(x, 46, 1, 8, C[2]).px(x + 3, 48, GLASS[0]).px(x + 4, 47, GLASS[0]);
  G.rect(0, 45, W, 1, C[1]).rect(0, 44, W, 1, OUTLINE);
  G.rect(0, 54, W, 7, C[1]).rect(0, 54, W, 1, C[0]).rect(0, 59, W, 2, C[3]);
  G.rect(0, 61, W, 3, C[4]);
  // 下向きのあかり
  for (let x = 10; x < W; x += 36) G.rect(x, 62, 4, 2, LIT[0]).rect(x + 1, 64, 2, 1, LIT[1]);
  // 店の上の壁
  G.rect(0, 65, W, 60, C[2]);
  // 化粧板の壁(横長の板。上のふちに光、下のふちに影)
  for (let y = 65; y < 125; y++) for (let x = 0; x < W; x++) {
    const ly = (y - 65) % 12, lx = (x + (Math.floor((y - 65) / 12) % 2) * 27) % 54;
    if (ly === 0) G.px(x, y, C[1]);
    else if (ly === 11 || lx === 0) G.px(x, y, C[3]);
  }
  for (const [x0, w, kind] of SHOPS) {
    const sx = x0 + 10, sw = w - 20;
    // 看板(色の板と、形の印)
    const col = kind === 'fashion' ? PINK : kind === 'closed' ? PURPLE : kind === 'half' ? ORANGE : CYAN;
    G.rect(sx + 10, 67, sw - 20, 9, col).outlineRect(sx + 10, 67, sw - 20, 9);
    G.rect(sx + 10, 67, sw - 20, 1, LIT[0]);
    const ix = sx + Math.floor(sw / 2) - 3;
    G.rect(ix, 69, 6, 4, C[5]).rect(ix + 1, 70, 4, 2, col);
    // 入り口のわく
    G.rect(sx - 2, 78, sw + 4, 3, C[4]).rect(sx - 2, 78, sw + 4, 1, C[1]);
    const y0 = 81, h = 43;
    if (kind === 'closed') {
      G.rect(sx, y0, sw, h, C[5]);
      shutter(G, sx, y0, sw, h, 0);
    } else {
      // 明るい店の中
      G.rect(sx, y0, sw, h, LIT[2]);
      G.dither(sx, y0, sw, 3, LIT[0], LIT[1]);
      G.rect(sx, y0 + 3, sw, 1, LIT[1]);
      // 奥の棚
      for (const sy of [y0 + 12, y0 + 24, y0 + 36]) goods(G, sx + 4, sy, sw - 8, sx + sy);
      if (kind === 'fashion') {
        // 服の形(ハンガーにかかった服)
        for (let x = sx + 6; x < sx + sw - 8; x += 12) {
          G.rect(x, y0 + 14, 8, 14, [PINK, CYAN, PURPLE, RED][(x >> 3) % 4]).rect(x + 3, y0 + 14, 2, 2, C[3]);
          G.rect(x + 1, y0 + 15, 1, 12, LIT[0]);
        }
      }
      // ショーウィンドウのガラスの光(ななめの線)
      for (let x = sx + 8; x < sx + sw; x += 26) { G.line(x, y0 + 30, x + 10, y0 + 12, LIT[0]); G.line(x + 3, y0 + 30, x + 12, y0 + 14, LIT[0]); }
      if (kind === 'half') shutter(G, sx, y0, sw, h, 26);
      // ガラスのわく
      G.rect(sx + Math.floor(sw / 2), y0, 1, h, C[3]);
      G.outlineRect(sx, y0, sw, h, C[4]);
    }
    // 店と店のあいだの柱
    G.rect(x0 - 3, 65, 6, 60, C[1]).rect(x0 - 3, 65, 1, 60, C[0]).rect(x0 + 2, 65, 1, 60, C[3]);
    // 柱の植えこみ
    G.rect(x0 - 5, 112, 10, 8, C[3]).rect(x0 - 5, 112, 10, 1, C[1]);
    for (let i = 0; i < 14; i++) {
      const lx = x0 - 6 + Math.floor(hash(i, x0, 1) * 12), ly = 104 + Math.floor(hash(i, x0, 2) * 9);
      G.rect(lx, ly, 2, 2, LEAF[i % 3]);
    }
  }
  // 壁のすそ(床に隠れる)
  G.rect(0, 124, W, 6, OUTLINE);
  return G.g;
}

// =====================================================================
// 床 648×90(y=124〜214に置く)。みがいた大きなタイル、店の明かりの映りこみ
// =====================================================================
export function drawGround(): PixelGrid {
  const W = 648, H = 90;
  const G = new Wrap(W, H);
  // 壁ぎわの影
  G.rect(0, 0, W, 4, OUTLINE);
  G.dither(0, 4, W, 2, OUTLINE, FLOOR[3]);
  // タイル:奥ほど低い段、手前ほど高い段。市松の2色
  const rows = [6, 12, 20, 30, 42, 56, 72, 90];
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = rows[r], y1 = rows[r + 1];
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
      const t = Math.floor(x / 36) + r;
      G.px(x, y, t % 2 ? FLOOR[1] : FLOOR[2]);
    }
    G.rect(0, y0, W, 1, FLOOR[3]);
    G.rect(0, y0 + 1, W, 1, FLOOR[0]);
  }
  // タイルの目地(奥から手前へ広がる)
  for (let x = 0; x < W; x += 36) {
    for (let y = 6; y < H; y++) {
      const t = (y - 6) / (H - 6);
      G.px(x + Math.round((x % 72 === 0 ? -1 : 1) * t * 3), y, FLOOR[3]);
    }
  }
  // タイルの目地の右に光(みがいた面のふち)
  for (let x = 0; x < W; x += 36) {
    for (let y = 8; y < H; y++) {
      const t = (y - 6) / (H - 6);
      const jx = x + Math.round((x % 72 === 0 ? -1 : 1) * t * 3);
      if (!rows.includes(y)) G.px(jx + 1, y, FLOOR[0]);
    }
  }
  // 店の明かりの映りこみ(縦にのびる帯)。奥はしっかり、手前へ行くほどディザでうすれる(乱数は使わない)
  for (const lx of MALL_LIGHTS) {
    for (let y = 6; y < 60; y++) {
      const t = (y - 6) / 54;
      const half = Math.round(34 - t * 10);
      for (let i = -half; i <= half; i++) {
        const x = lx + 44 + i;
        const c = G.get(x, y);
        if (c === FLOOR[3]) continue;
        const inner = Math.abs(i) < half - 8;
        if (t < 0.35 && inner) { if (dith(x, y)) G.px(x, y, LIT[2]); }
        else if (t < 0.7) { if (dith(x, y)) G.px(x, y, FLOOR[0]); }
        else if (dith(x, y) && y % 2 === 0) G.px(x, y, FLOOR[0]);
      }
    }
  }
  // 天井のあかりの点の映りこみ
  for (let x = 10; x < W; x += 36) G.rect(x + 1, 14, 2, 1, LIT[0]).px(x + 1, 26, LIT[0]);
  return G.g;
}
