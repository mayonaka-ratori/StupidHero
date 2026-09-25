// 夜の高層ビルの背景。見本は mocks/stage4_src/scenes.ts(見本は1枚の絵、ここでは奥、壁、床に分ける)。
//   奥の絵は階ごとに4枚(bg_tower1_far〜bg_tower4_far)。窓の外の街は、上の階ほど小さく遠くなる。
//   壁と床は「ふつうの階」(bg_tower_wall、bg_tower_ground)と「パーティ会場」(bg_party_wall、bg_party_ground)の2組。
//   ふつうの階の壁は天井と柱だけで、柱のあいだは透明(お店やオフィスの中は奥の絵で見せる)。
//   エレベーターの中は bg_lift(後ろのガラスは透明)と、その向こうを縦に流す夜景 bg_lift_view。
// どれも左右の端がつながる(x は幅で折り返して描く)。bg_lift_view は上下もつながる。bg_lift だけは1枚で、つながらない。
// 背景だけはディザ(市松模様)を使ってよい。色は「奥の絵1枚と、それに組む壁と床で45色まで」。文字は描かない。
import { md, OUTLINE, PixelGrid } from '../lib';
import { Painter } from '../world/pix';
import { Wrap, dith, hash } from '../world/wrap';

// ---------- 色(どの組でも共通) ----------
const NIGHT = [md(0, 0, 1), md(1, 1, 2), md(1, 1, 3)];
const STAR = md(7, 7, 7), STAR_D = md(4, 4, 6);
/** 建物(明るい → 暗い)。C[5] は NIGHT[1] と同じ */
const C = [md(6, 6, 6), md(5, 5, 5), md(4, 4, 5), md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)];
/** 明かり */
const LIT = [md(7, 7, 6), md(7, 6, 4), md(6, 5, 3), md(4, 3, 2)];
const WOOD = [md(6, 4, 2), md(5, 3, 1), md(4, 2, 1), md(2, 1, 0)];
/** みがいた石(床と柱)。MARBLE[1] だけが新しい色 */
const MARBLE = [C[0], md(5, 5, 6), C[1], C[2]];
const GOLD = [md(7, 7, 3), md(7, 5, 1), md(5, 3, 0)];
const LEAF = [md(3, 5, 2), md(2, 4, 1), md(1, 2, 1)];
/** ガラスの映りこみ */
const GLASSB = md(3, 3, 5);
const WHITE = STAR;

/** 夜空(上から暗い → 少し明るい)と星。y0〜y1 に塗る */
function nightSky(G: Wrap, x0: number, y0: number, w: number, y1: number, seed: number, stars = 1): void {
  const h = y1 - y0;
  G.rect(x0, y0, w, h, NIGHT[0]);
  const band = y0 + Math.floor(h * 0.55);
  G.dither(x0, band, w, 3, NIGHT[0], NIGHT[1]);
  G.rect(x0, band + 3, w, y1 - band - 3, NIGHT[1]);
  G.dither(x0, y1 - Math.floor(h * 0.18), w, 2, NIGHT[1], NIGHT[2]);
  G.rect(x0, y1 - Math.floor(h * 0.18) + 2, w, Math.floor(h * 0.18) - 2, NIGHT[2]);
  for (let i = 0; i < (w * h * stars) / 70; i++) {
    const x = x0 + Math.floor(hash(i, 1, seed) * w), y = y0 + Math.floor(hash(i, 2, seed) * h * 0.55);
    G.px(x, y, i % 5 === 0 ? STAR : STAR_D);
  }
}

/**
 * 窓の外の夜の街。far が大きいほど、街は低く、小さく、遠くなる(0:すぐ前、1:近い、2:遠い、3:はるか下)。
 * clip を付けると、x0〜x0+w の外には描かない(窓の中だけに描くとき)
 */
function city(G: Wrap, x0: number, y0: number, w: number, h: number, far: number, seed: number, clip = true): void {
  nightSky(G, x0, y0, w, y0 + h, seed, far >= 2 ? 1.4 : 1);
  const base = y0 + h;
  const inX = (x: number) => !clip || (x >= x0 && x < x0 + w);
  const n = 6 + far * 7;
  for (let i = 0; i < n; i++) {
    const bw = Math.max(3, Math.floor((14 - far * 3.5) * (0.6 + hash(i, 3, seed))));
    const bh = Math.max(2, Math.floor(h * (0.8 - far * 0.22) * (0.3 + hash(i, 4, seed) * 0.7)));
    const bx = x0 + Math.floor(hash(i, 5, seed) * (w + bw)) - bw;
    const col = far === 0 ? C[4] : C[5];
    for (let x = bx; x < bx + bw; x++) {
      if (!inX(x)) continue;
      for (let y = base - bh; y < base; y++) {
        G.px(x, y, col);
        const wx = x - bx, wy = y - (base - bh);
        const step = far >= 2 ? 2 : 3;
        if (wx % step === 1 && wy % step === 1 && hash(x, y, seed) > 0.45) G.px(x, y, hash(x, y, 9) > 0.7 ? LIT[0] : LIT[2]);
      }
      // 屋上のへり
      if (far === 0) G.px(x, base - bh, C[3]);
    }
  }
  // 遠いほど、下のほうに街の明かりの粒が広がる
  if (far > 0) for (let i = 0; i < w * far * 3; i++) {
    const x = x0 + Math.floor(hash(i, 6, seed) * w), y = base - 1 - Math.floor(hash(i, 7, seed) ** 2 * h * (far >= 3 ? 0.18 : 0.26));
    if (inX(x)) G.px(x, y, [LIT[1], LIT[0], LIT[2], STAR_D][i % 4]);
  }
}

/** つり下げのあかり(奥の絵の中の、ふつうの白い明かり) */
function pendant(G: Wrap, x: number, top: number, len: number): void {
  G.rect(x, top, 1, len, C[3]);
  const y = top + len;
  G.rect(x - 4, y, 9, 1, OUTLINE).rect(x - 5, y + 1, 11, 3, C[2]).rect(x - 5, y + 1, 11, 1, C[1]).rect(x - 6, y + 4, 13, 1, OUTLINE);
  G.rect(x - 4, y + 5, 9, 1, LIT[0]).rect(x - 3, y + 6, 7, 1, LIT[1]);
  for (let j = 7; j < 14; j++) for (let i = -2 - (j >> 2); i <= 2 + (j >> 2); i++) if (dith(x + i, y + j) && j % 2 === 0) G.px(x + i, y + j, LIT[2]);
}

/** 奥の絵の下(床に隠れるところ)と天井(壁の天井に隠れるところ)をうめる */
function fillHidden(G: Wrap, floor: string): void {
  G.rect(0, 0, G.w, 10, C[4]);
  G.rect(0, 122, G.w, 2, OUTLINE);
  G.rect(0, 124, G.w, G.h - 124, floor);
}

// =====================================================================
// 1階 ロビーとお店:左はガラスの壁の向こうのすぐ前の街、右は受付の木の壁とカフェ
// =====================================================================
export function drawTower1Far(): PixelGrid {
  const W = 216, H = 214;
  const G = new Wrap(W, H);
  city(G, 0, 8, 118, 116, 0, 11);
  // ガラスのわく(縦と横)
  for (let x = 0; x < 118; x += 29) G.rect(x, 8, 2, 116, C[3]).rect(x, 8, 1, 116, C[2]);
  G.rect(0, 60, 118, 2, C[3]).rect(0, 60, 118, 1, C[2]);
  // ガラスの映りこみ(ななめの線)
  for (let x = 8; x < 118; x += 29) { G.line(x, 110, x + 14, 70, GLASSB); G.line(x + 3, 110, x + 16, 74, GLASSB); }
  // 自動ドア(ガラスの中の、もう1枚のわく)
  G.outlineRect(36, 72, 46, 52, C[2]);
  G.rect(58, 72, 2, 52, C[3]);
  city(G, 36, 72, 22, 52, 0, 12); city(G, 60, 72, 22, 52, 0, 13);
  G.rect(34, 68, 50, 4, C[2]).rect(34, 68, 50, 1, C[1]);
  // 2階の手すり(右半分の上)と、2階の明かりのついた部屋
  G.rect(118, 8, 98, 48, C[3]);
  for (let x = 124; x < W; x += 22) G.rect(x, 14, 16, 26, LIT[3]).rect(x + 1, 15, 14, 3, LIT[2]);
  G.rect(118, 40, 98, 8, GLASSB);
  for (let x = 118; x < W; x += 8) G.rect(x, 40, 1, 8, C[2]);
  G.rect(118, 39, 98, 1, C[1]).rect(118, 48, 98, 3, C[2]).rect(118, 48, 98, 1, C[1]).rect(118, 51, 98, 1, C[5]);
  // 右:受付の木の壁
  G.rect(118, 52, 98, 72, WOOD[2]);
  for (let x = 118; x < W; x += 6) G.rect(x, 52, 1, 72, WOOD[3]).px(x + 2, 52 + (x % 11), WOOD[1]);
  // 会社の名前の板(文字は描かない)
  G.rect(128, 60, 34, 10, GOLD[1]).outlineRect(128, 60, 34, 10).rect(128, 60, 34, 1, GOLD[0]);
  G.rect(132, 63, 4, 4, WOOD[3]).rect(139, 64, 19, 2, WOOD[3]);
  // 受付のカウンター
  G.rect(122, 96, 50, 26, MARBLE[1]).rect(122, 96, 50, 2, WHITE).outlineRect(122, 96, 50, 26);
  G.rect(122, 104, 50, 1, GOLD[1]);
  // カフェ(右はし):しまのひさし、明るい店の中、黒板、ショーケース
  G.rect(176, 76, 40, 46, LIT[2]);
  G.dither(176, 78, 40, 3, LIT[0], LIT[1]);
  for (let x = 176; x < W; x += 4) G.rect(x, 70, 2, 8, md(7, 4, 1)).rect(x + 2, 70, 2, 8, WHITE);
  G.rect(176, 78, 40, 1, OUTLINE);
  G.rect(180, 84, 14, 10, OUTLINE).rect(181, 85, 12, 8, LEAF[2]);
  for (let i = 0; i < 4; i++) G.rect(182, 86 + i * 2, 6 + (i % 2) * 3, 1, C[0]);
  G.rect(198, 90, 12, 10, C[1]).rect(199, 91, 10, 3, C[3]).px(203, 96, OUTLINE);
  G.rect(176, 104, 40, 18, WOOD[1]).rect(176, 104, 40, 2, WOOD[0]).outlineRect(176, 104, 40, 18);
  // 右はしの柱(左はしのガラスのわくとつながる)
  G.rect(213, 8, 3, 116, C[2]).rect(213, 8, 1, 116, C[1]);
  // 柱
  G.rect(116, 8, 4, 116, C[2]).rect(116, 8, 1, 116, C[1]).rect(119, 8, 1, 116, C[4]);
  // 植えこみ(ガラスの壁ぞい)
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(hash(i, 1, 44) * 116), y = 116 + Math.floor(hash(i, 2, 44) * 6);
    G.rect(x, y, 2, 2, LEAF[i % 3]);
  }
  for (const x of [22, 70]) pendant(G, x, 8, 12);
  pendant(G, 196, 52, 10);
  fillHidden(G, MARBLE[1]);
  return G.g;
}

// =====================================================================
// 18階 オフィス:大きな窓のすぐ外に、明かりのついた近くのビル。窓の下に机とパソコンの並び
// =====================================================================
const SCREEN = [md(3, 5, 7), md(2, 3, 5)];

/** 窓のすぐ外の、明かりのついた大きなビルの壁(窓のます目) */
function nearFacade(G: Wrap, x0: number, w: number, y0: number, y1: number, seed: number, dark: boolean): void {
  G.rect(x0, y0, w, y1 - y0, dark ? C[5] : C[4]);
  for (let y = y0 + 3; y < y1 - 2; y += 7) for (let x = x0 + 2; x < x0 + w - 3; x += 6) {
    const on = hash(x, y, seed) > 0.4;
    G.rect(x, y, 4, 4, on ? (hash(x, y, seed + 1) > 0.6 ? LIT[0] : LIT[2]) : NIGHT[1]);
    if (on) G.rect(x, y + 3, 4, 1, LIT[3]);
  }
  G.rect(x0, y0, 1, y1 - y0, C[3]);
}

export function drawTower2Far(): PixelGrid {
  const W = 216, H = 214;
  const G = new Wrap(W, H);
  // 窓の外:夜空と、遠くのビルと、すぐ外の大きなビル
  city(G, 0, 10, W, 80, 1, 21, false);
  nearFacade(G, 8, 62, 22, 90, 3, false);
  nearFacade(G, 98, 40, 34, 90, 5, true);
  nearFacade(G, 160, 50, 16, 90, 7, false);
  // 窓のわく(27ドットおき)と、上のブラインド
  for (let x = 0; x < W; x += 27) G.rect(x, 10, 2, 80, C[2]).rect(x, 10, 1, 80, C[1]);
  for (let y = 10; y < 18; y++) G.rect(0, y, W, 1, y % 2 ? C[2] : C[1]);
  G.rect(0, 18, W, 1, C[3]);
  // ガラスの映りこみ
  for (let x = 6; x < W; x += 54) G.line(x, 84, x + 10, 64, GLASSB);
  // 窓の下のへり
  G.rect(0, 88, W, 3, C[1]).rect(0, 88, W, 1, C[0]).rect(0, 91, W, 1, C[4]);
  // オフィスの壁と、ついたて
  G.rect(0, 92, W, 30, C[3]);
  for (let x = 0; x < W; x += 54) {
    // 机(白い天板)とパソコン、いす
    const dx = x + 8;
    G.rect(dx, 98, 12, 9, OUTLINE).rect(dx + 1, 99, 10, 7, SCREEN[1]).rect(dx + 2, 100, 5, 1, SCREEN[0]).rect(dx + 2, 102, 7, 1, SCREEN[0]);
    G.rect(dx + 5, 107, 2, 3, C[4]);
    G.rect(dx - 4, 110, 44, 3, C[0]).rect(dx - 4, 113, 44, 1, C[2]);
    G.rect(dx + 24, 104, 8, 6, WHITE).rect(dx + 25, 106, 6, 1, C[2]);
    // いすの背もたれ(机の手前)
    G.rect(dx + 14, 106, 7, 10, C[4]).rect(dx + 14, 106, 7, 1, C[3]);
    G.rect(dx - 4, 114, 2, 8, C[4]).rect(dx + 38, 114, 2, 8, C[4]);
    // ついたて(机のあいだ)
    G.rect(x + 50, 96, 4, 26, C[2]).rect(x + 50, 96, 4, 1, C[1]);
  }
  // 観葉植物(窓ぎわ)
  for (let i = 0; i < 16; i++) G.rect(88 + Math.floor(hash(i, 1, 8) * 10), 80 + Math.floor(hash(i, 2, 8) * 10), 2, 2, LEAF[i % 3]);
  G.rect(89, 90, 8, 6, C[1]);
  fillHidden(G, C[3]);
  return G.g;
}

// =====================================================================
// 35階 レストラン街:左は大きな窓の向こうの遠い夜景、右はレストランの入り口
// =====================================================================
const AWNING = [md(6, 1, 2), md(4, 0, 1)];

export function drawTower3Far(): PixelGrid {
  const W = 216, H = 214;
  const G = new Wrap(W, H);
  G.rect(0, 0, W, H, C[4]);
  // 左:大きな窓と遠い夜景(街は窓の下の方に小さく)
  city(G, 0, 12, 104, 92, 2, 31);
  for (const x of [0, 34, 68, 102]) G.rect(x, 12, 3, 92, C[3]).rect(x + 1, 12, 1, 92, C[2]);
  G.rect(0, 12, 104, 2, C[3]);
  G.line(10, 96, 22, 72, GLASSB).line(46, 96, 58, 72, GLASSB);
  // 窓の下の植えこみ
  G.rect(0, 104, 104, 18, WOOD[3]).rect(0, 104, 104, 2, WOOD[1]);
  for (let i = 0; i < 40; i++) G.rect(Math.floor(hash(i, 1, 6) * 104), 98 + Math.floor(hash(i, 2, 6) * 7), 2, 2, LEAF[i % 3]);
  // 右:レストランの入り口。木の壁、赤いひさし、明るい店の中(テーブルとキャンドル)
  G.rect(106, 12, 110, 110, WOOD[2]);
  for (let x = 106; x < W; x += 8) G.rect(x, 12, 1, 110, WOOD[3]);
  // 店の看板(金の板と、形の印。文字は描かない)
  G.rect(128, 20, 60, 10, WOOD[3]).outlineRect(128, 20, 60, 10, GOLD[2]);
  G.rect(152, 22, 12, 6, GOLD[1]).rect(154, 24, 8, 2, WOOD[3]);
  // ひさし(赤、下のふちは波の形)
  G.rect(112, 34, 96, 8, AWNING[0]).rect(112, 34, 96, 1, LIT[1]);
  for (let x = 112; x < 208; x += 6) G.rect(x, 42, 4, 2, AWNING[0]).px(x + 1, 44, AWNING[1]).px(x + 2, 44, AWNING[1]);
  for (let x = 112; x < 208; x += 12) G.rect(x, 35, 1, 7, AWNING[1]);
  // 店の中(ガラスの向こう)
  G.rect(116, 48, 88, 56, LIT[2]);
  G.dither(116, 48, 88, 3, LIT[0], LIT[1]);
  for (let x = 120; x < 200; x += 22) {
    // テーブル(白いクロス)とキャンドル、いす
    G.rect(x, 86, 14, 3, WHITE).rect(x + 1, 89, 12, 6, C[1]);
    G.rect(x + 6, 82, 2, 4, WHITE).px(x + 6, 81, LIT[1]);
    G.rect(x - 3, 82, 3, 13, WOOD[1]).rect(x + 14, 82, 3, 13, WOOD[1]);
  }
  // 店の奥のワインの棚
  for (let x = 118; x < 202; x += 4) for (let y = 54; y < 72; y += 4) G.px(x + 1, y + 1, (x + y) % 8 === 0 ? AWNING[1] : LEAF[2]);
  G.rect(116, 74, 88, 1, WOOD[3]);
  G.outlineRect(116, 48, 88, 56, WOOD[3]);
  G.rect(158, 48, 2, 56, WOOD[3]);
  // 入り口のメニューの立て板(文字は描かない)
  G.rect(196, 96, 12, 14, OUTLINE).rect(197, 97, 10, 12, LEAF[2]);
  for (let i = 0; i < 3; i++) G.rect(198, 99 + i * 3, 7, 1, C[1]);
  G.line(198, 110, 196, 121, WOOD[3]).line(206, 110, 208, 121, WOOD[3]);
  // 店の前の植木ばち
  G.rect(110, 108, 10, 12, C[2]).rect(110, 108, 10, 1, C[1]);
  for (let i = 0; i < 14; i++) G.rect(108 + Math.floor(hash(i, 3, 7) * 13), 96 + Math.floor(hash(i, 4, 7) * 12), 2, 2, LEAF[i % 3]);
  // 天井のあかり(ダウンライト)
  for (let x = 12; x < W; x += 36) G.rect(x, 10, 4, 1, LIT[0]);
  fillHidden(G, WOOD[3]);
  return G.g;
}

// =====================================================================
// 最上階 パーティ会場の大きな窓の外:月と星と、はるか下の小さな街(壁の窓から見える)
// =====================================================================
const MOON = [md(7, 7, 6), md(7, 7, 5), md(6, 6, 4)];

export function drawTower4Far(): PixelGrid {
  const W = 216, H = 214;
  const G = new Wrap(W, H);
  nightSky(G, 0, 0, W, 108, 5, 1.6);
  // 月
  const moon = new Painter(20, 20);
  moon.fill(moon.mask().ellipse(10, 10, 8, 8), [MOON[0], MOON[1], MOON[2]], { sep: 'none', hi: 0.5, lo: 0.85 });
  moon.px(7, 8, MOON[2]).px(12, 12, MOON[2]).px(13, 6, MOON[2]);
  G.blit(moon.g, 150, 12);
  // 地平線の光と、はるか下の小さな街(明かりの粒だけ)
  G.rect(0, 94, W, 30, NIGHT[2]);
  G.dither(0, 92, W, 2, NIGHT[1], NIGHT[2]);
  for (let y = 96; y < 124; y++) for (let x = 0; x < W; x++) {
    const t = (y - 96) / 28;
    if (hash(x, y, 71) < 0.08 + t * 0.35) G.px(x, y, [LIT[1], LIT[2], STAR_D, LIT[0], C[3]][Math.floor(hash(x, y, 72) * 5)]);
  }
  // 遠くの小さな高いビル(地平線から少し出る)
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(hash(i, 1, 73) * W), h = 2 + Math.floor(hash(i, 2, 73) * 5);
    G.rect(x, 96 - h, 2, h, C[5]).px(x, 96 - h + 1, LIT[2]);
  }
  fillHidden(G, WOOD[3]);
  G.rect(0, 0, W, 10, NIGHT[0]);
  return G.g;
}

// =====================================================================
// ふつうの階の壁 648×130:天井と柱だけ。柱のあいだは透明で、奥の絵が見える
// =====================================================================
/** 柱の左はし(床の映りこみと合わせる) */
const PILLARS = [48, 156, 264, 372, 480, 588];

export function drawTowerWall(): PixelGrid {
  const W = 648, H = 130;
  const G = new Wrap(W, H);
  // 天井(ダウンライトの並び)
  G.rect(0, 0, W, 9, C[4]).rect(0, 8, W, 1, C[3]).rect(0, 9, W, 1, C[5]);
  for (let x = 6; x < W; x += 36) G.rect(x, 5, 6, 2, LIT[0]).rect(x + 1, 7, 4, 1, LIT[1]);
  // 柱(みがいた石。左に光、右に影)と、柱の上の飾り、下の台
  for (const x of PILLARS) {
    G.rect(x, 10, 12, 108, MARBLE[1]);
    G.rect(x, 10, 2, 108, MARBLE[0]).rect(x + 9, 10, 2, 108, MARBLE[3]).rect(x + 11, 10, 1, 108, C[4]).rect(x - 1, 10, 1, 108, C[4]);
    // 石の目地
    for (let y = 30; y < 118; y += 22) G.rect(x, y, 12, 1, MARBLE[3]);
    G.rect(x - 3, 10, 18, 3, C[2]).rect(x - 3, 10, 18, 1, C[1]).rect(x - 3, 13, 18, 1, C[4]);
    G.rect(x - 3, 108, 18, 10, C[3]).rect(x - 3, 108, 18, 1, C[2]);
    // 柱につけた小さな明かり
    G.rect(x + 4, 44, 4, 5, C[2]).rect(x + 5, 45, 2, 3, LIT[0]).outlineRect(x + 4, 44, 4, 5);
  }
  // 壁のすそ(床とのさかい)
  G.rect(0, 118, W, 3, C[3]).rect(0, 118, W, 1, C[2]);
  G.rect(0, 121, W, 9, OUTLINE);
  return G.g;
}

// =====================================================================
// ふつうの階の床 648×90:みがいた石の大きなタイル。天井のあかりと柱が映りこむ
// =====================================================================
export function drawTowerGround(): PixelGrid {
  const W = 648, H = 90;
  const G = new Wrap(W, H);
  G.rect(0, 0, W, 4, OUTLINE);
  G.dither(0, 4, W, 2, OUTLINE, MARBLE[3]);
  const rows = [6, 12, 20, 30, 42, 56, 72, 90];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let y = rows[r]; y < rows[r + 1]; y++) for (let x = 0; x < W; x++) G.px(x, y, (Math.floor(x / 36) + r) % 2 ? MARBLE[1] : MARBLE[2]);
    G.rect(0, rows[r], W, 1, MARBLE[3]);
    G.rect(0, rows[r] + 1, W, 1, MARBLE[0]);
  }
  // 目地(奥から手前へ広がる)
  for (let x = 0; x < W; x += 36) for (let y = 6; y < H; y++) {
    const t = (y - 6) / (H - 6);
    G.px(x + Math.round((x % 72 === 0 ? -1 : 1) * t * 3), y, MARBLE[3]);
  }
  // 柱の映りこみ(縦の帯。奥はしっかり、手前はうすれる)
  for (const px of PILLARS) for (let y = 6; y < 50; y++) for (let i = 0; i < 12; i++) {
    const x = px + i;
    if (G.get(x, y) === MARBLE[3]) continue;
    if (y < 22 ? dith(x, y) : dith(x, y) && y % 2 === 0) G.px(x, y, i < 3 ? MARBLE[0] : C[2]);
  }
  // 天井のあかりの映りこみ
  for (let x = 6; x < W; x += 36) G.rect(x + 1, 14, 4, 1, LIT[0]).rect(x + 2, 26, 2, 1, LIT[0]);
  return G.g;
}

// =====================================================================
// パーティ会場の壁 648×130:赤いカーテン、金の窓わく、腰の高さの木の壁。窓は透明
// =====================================================================
const RED = [md(6, 1, 2), md(5, 0, 1), md(3, 0, 1)];
const CARPET = [md(5, 1, 2), md(4, 1, 1), md(3, 0, 1)];

export function drawPartyWall(): PixelGrid {
  const W = 648, H = 130;
  const G = new Wrap(W, H);
  // 上の飾り幕(赤と金のふさ)
  G.rect(0, 0, W, 7, RED[1]).rect(0, 0, W, 1, RED[0]);
  for (let x = 0; x < W; x += 12) {
    G.rect(x, 7, 12, 2, RED[1]).rect(x + 2, 9, 8, 1, RED[1]).rect(x + 4, 10, 4, 1, RED[2]);
    G.px(x + 6, 11, GOLD[1]).px(x + 6, 12, GOLD[0]);
  }
  G.rect(0, 6, W, 1, GOLD[1]);
  // 窓の金のわく(36ドットおき。横の桟は2本)
  for (let x = 0; x < W; x += 36) G.rect(x, 12, 3, 92, GOLD[2]).rect(x + 1, 12, 1, 92, GOLD[1]);
  for (const y of [44, 76]) G.rect(0, y, W, 2, GOLD[2]).rect(0, y, W, 1, GOLD[1]);
  // 窓の上の丸い飾り(アーチの形)
  for (let x = 0; x < W; x += 36) for (let i = 3; i < 36; i++) {
    const t = (i - 1.5) / 33;
    const y = 12 + Math.round(6 * (1 - Math.sin(t * Math.PI)));
    for (let yy = 12; yy <= y; yy++) G.px(x + i, yy, yy === y ? GOLD[1] : RED[2]);
  }
  // 赤いカーテン(216ドットおきに、左右に分けてたばねる)
  for (let c = 0; c < 3; c++) {
    const cx = c * 216 + 108;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const x = cx + side * (3 + i);
        // 上から下へ、たばねた所(y=70)で細くなり、下でまた広がる
        const narrow = (y: number) => (y < 70 ? 26 - Math.round((y - 12) * 0.22) : 13 + Math.round((y - 70) * 0.35));
        for (let y = 8; y < 108; y++) {
          if (i >= narrow(y)) continue;
          const k = (i + (y > 70 ? 2 : 0)) % 7;
          G.px(x, y, k < 2 ? RED[0] : k < 5 ? RED[1] : RED[2]);
        }
      }
      // たばねた金のひもと、ふさ
      const tx = cx + side * 10;
      G.rect(tx - 6, 69, 12, 2, GOLD[1]).rect(tx - 6, 69, 12, 1, GOLD[0]);
      G.rect(tx + side * 6, 71, 2, 5, GOLD[1]).px(tx + side * 6, 76, GOLD[2]);
    }
  }
  // 腰の高さの木の壁と金の線
  G.rect(0, 104, W, 16, WOOD[3]).rect(0, 104, W, 2, GOLD[1]).rect(0, 104, W, 1, GOLD[0]);
  for (let x = 4; x < W; x += 18) G.outlineRect(x, 109, 14, 7, WOOD[2]);
  // 壁のあかり(カーテンのあいだの柱に)
  for (let c = 0; c < 3; c++) {
    const x = c * 216;
    G.rect(x - 2, 52, 5, 3, GOLD[1]).rect(x - 1, 49, 3, 3, LIT[0]).px(x, 48, LIT[1]);
  }
  G.rect(0, 120, W, 10, OUTLINE);
  return G.g;
}

// =====================================================================
// パーティ会場の床 648×90:寄せ木と、まん中に赤いじゅうたん(金のひし形の模様)
// =====================================================================
export function drawPartyGround(): PixelGrid {
  const W = 648, H = 90;
  const G = new Wrap(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) G.px(x, y, ((x >> 3) + (y >> 2)) % 2 ? WOOD[1] : WOOD[2]);
  G.rect(0, 8, W, 68, CARPET[1]);
  G.rect(0, 8, W, 1, GOLD[1]).rect(0, 10, W, 1, GOLD[2]).rect(0, 75, W, 1, GOLD[1]).rect(0, 73, W, 1, GOLD[2]);
  for (let y = 16; y < 72; y += 12) for (let x = ((y / 12) % 2) * 8; x < W; x += 16) {
    G.px(x, y, GOLD[1]).px(x - 1, y + 1, GOLD[2]).px(x + 1, y + 1, GOLD[2]).px(x, y + 2, GOLD[1]);
  }
  // じゅうたんの毛並み(ディザ)と、奥の影
  for (let y = 12; y < 72; y++) for (let x = 0; x < W; x++) if (G.get(x, y) === CARPET[1] && (x * 7 + y * 3) % 11 === 0) G.px(x, y, CARPET[2]);
  G.rect(0, 0, W, 3, OUTLINE);
  G.dither(0, 3, W, 2, OUTLINE, WOOD[3]);
  G.dither(0, 12, W, 2, CARPET[2], CARPET[1]);
  // 窓の月あかりとシャンデリアの映りこみ(寄せ木の明るい点)
  for (let x = 20; x < W; x += 108) for (let y = 78; y < 88; y++) for (let i = 0; i < 24; i++) if (dith(x + i, y)) G.px(x + i, y, WOOD[0]);
  for (let x = 40; x < W; x += 72) G.rect(x, 20, 6, 1, CARPET[0]).rect(x + 1, 40, 4, 1, CARPET[0]);
  return G.g;
}

// =====================================================================
// エレベーターの中 216×214(1枚で、つながらない)。後ろのガラスは透明で、bg_lift_view が見える
// =====================================================================
const STEEL = [md(6, 6, 6), md(5, 5, 5), md(3, 3, 4), md(2, 2, 3)];

/** エレベーターの中の決まった場所(コードで重ねるときに使う) */
export const LIFT_LAYOUT = {
  /** 後ろのガラス(透明なところ) */
  glass: { x: 0, y: 16, w: 176, h: 128 },
  /** 扉の口。tw_lift_door を2枚並べる */
  door: { x: 182, y: 30, w: 30, h: 114 },
  /** 階の数字を出す枠(数字はコードで出す) */
  display: { x: 184, y: 2, w: 26, h: 12 },
  /** ボタン(上から6つ。4×4)。ヴィランのそばの1つを紫で塗る */
  buttons: Array.from({ length: 6 }, (_, i) => ({ x: 170, y: 100 + i * 6, w: 4, h: 4 })),
  /** 床の奥のはし */
  floorY: 144
} as const;

export function drawLift(): PixelGrid {
  const W = 216, H = 214;
  const G = new PixelGrid(W, H);
  const r = (x: number, y: number, w: number, h: number, c: string | null) => G.rect(x, y, w, h, c);
  const box = (x: number, y: number, w: number, h: number, c: string) => { r(x - 1, y - 1, w + 2, 1, c); r(x - 1, y + h, w + 2, 1, c); r(x - 1, y, 1, h, c); r(x + w, y, 1, h, c); };
  // ガラスのわく(縦と横)。ガラスのところは透明
  for (const x of [0, 58, 116, 173]) r(x, 16, 3, 128, STEEL[2]).rect(x + 1, 16, 1, 128, STEEL[1]);
  r(0, 80, 176, 2, STEEL[2]).rect(0, 80, 176, 1, STEEL[1]);
  // ガラスの映りこみ(ななめの短い線。透明の上に少しだけ)
  for (const x of [14, 72, 130]) for (let i = 0; i < 10; i++) G.px(x + i, 40 - i, GLASSB).px(x + i + 3, 42 - i, GLASSB);
  // 天井(あかりの帯)と、階の数字の枠
  r(0, 0, W, 16, STEEL[3]).rect(0, 14, W, 2, STEEL[2]);
  r(8, 5, 160, 3, LIT[0]).rect(8, 8, 160, 1, LIT[2]);
  const d = LIFT_LAYOUT.display;
  r(d.x, d.y, d.w, d.h, OUTLINE);
  box(d.x, d.y, d.w, d.h, STEEL[1]);
  // 手すり
  r(0, 118, 176, 3, STEEL[1]).rect(0, 118, 176, 1, STEEL[0]);
  for (const x of [6, 170]) r(x, 118, 2, 10, STEEL[2]);
  // ガラスの下の腰板
  r(0, 128, 176, 16, STEEL[2]).rect(0, 128, 176, 1, STEEL[1]);
  for (let x = 0; x < 176; x += 44) r(x, 129, 1, 15, STEEL[3]);
  // 右:扉のまわりの壁と、扉の口の向こうの明るいろうか
  r(176, 16, 40, 128, STEEL[2]);
  for (let y = 20; y < 144; y += 16) r(176, y, 40, 1, STEEL[3]);
  const dr = LIFT_LAYOUT.door;
  r(dr.x, dr.y, dr.w, dr.h, LIT[2]);
  for (let y = dr.y; y < dr.y + 4; y++) for (let x = dr.x; x < dr.x + dr.w; x++) G.px(x, y, dith(x, y) ? LIT[0] : LIT[1]);
  r(dr.x, dr.y + 90, dr.w, 24, WOOD[1]).rect(dr.x, dr.y + 90, dr.w, 1, WOOD[0]);
  r(dr.x + 4, dr.y + 20, 8, 40, LIT[3]).rect(dr.x + 18, dr.y + 20, 8, 40, LIT[3]);
  box(dr.x, dr.y, dr.w, dr.h, STEEL[3]);
  r(dr.x - 2, dr.y - 4, dr.w + 4, 3, STEEL[1]).rect(dr.x - 2, dr.y - 4, dr.w + 4, 1, STEEL[0]);
  // ボタンの板(扉の左)
  r(168, 96, 8, 44, STEEL[1]);
  box(168, 96, 8, 44, STEEL[3]);
  for (const b of LIFT_LAYOUT.buttons) r(b.x, b.y, b.w, b.h, STEEL[2]).px(b.x, b.y, STEEL[0]);
  // 床(ます目のゴムの床)
  for (let y = 144; y < H; y++) for (let x = 0; x < W; x++) G.px(x, y, ((x >> 4) + (y >> 3)) % 2 ? STEEL[2] : STEEL[3]);
  r(0, 144, W, 1, STEEL[1]);
  for (let y = 145; y < 147; y++) for (let x = 0; x < W; x++) G.px(x, y, dith(x, y) ? OUTLINE : STEEL[3]);
  // 扉の前の敷居(金属の溝)
  r(176, 144, 40, 3, STEEL[1]).rect(176, 146, 40, 1, OUTLINE);
  return G;
}

/**
 * エレベーターのガラスの向こうの夜景 216×256。上下と左右がつながる(縦に流して、上っていくように見せる)。
 * 遠くの街の明かりと、すぐそばを通りすぎるビルの柱と窓
 */
export function drawLiftView(): PixelGrid {
  const W = 216, H = 256;
  const G = new PixelGrid(W, H);
  const px = (x: number, y: number, c: string) => G.px(((x % W) + W) % W, ((y % H) + H) % H, c);
  // 夜空(上下がつながるように、1色とディザだけ)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, (y >> 5) % 2 === 1 && dith(x, y) && y % 32 < 3 ? NIGHT[1] : NIGHT[0]);
  // 遠くの街の明かり(上下にちらばる小さな粒)
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(hash(i, 1, 81) * W), y = Math.floor(hash(i, 2, 81) * H);
    px(x, y, [LIT[1], LIT[2], STAR_D, LIT[0], C[3]][i % 5]);
  }
  // 遠くのビル(暗い帯と、ぽつぽつの窓)
  for (let i = 0; i < 6; i++) {
    const x0 = Math.floor(hash(i, 3, 82) * W), w = 8 + Math.floor(hash(i, 4, 82) * 10);
    for (let y = 0; y < H; y++) for (let x = x0; x < x0 + w; x++) {
      px(x, y, C[5]);
      if ((x - x0) % 3 === 1 && y % 4 === 1 && hash(x, y, 83) > 0.6) px(x, y, LIT[2]);
    }
  }
  // すぐそばのビルの柱と窓(大きく、速く流れて見える)。窓は8ドットおきで、256で上下がつながる
  for (const [x0, w, seed] of [[20, 26, 1], [118, 34, 2]] as const) {
    for (let y = 0; y < H; y++) for (let x = x0; x < x0 + w; x++) {
      const wx = x - x0, wy = y % 16;
      let c = C[4];
      if (wx === 0) c = C[3];
      else if (wx === w - 1) c = C[5];
      else if (wy >= 3 && wy < 11 && wx % 8 >= 2 && wx % 8 < 7) c = hash(Math.floor(wx / 8), Math.floor(y / 16), seed) > 0.45 ? (wy < 5 ? LIT[1] : LIT[2]) : NIGHT[1];
      else if (wy === 14) c = C[3];
      px(x, y, c);
    }
  }
  return G;
}
