// ステージ4の見本の場面を組み立てる。背景は見本なので、216×214の1枚に直接描く
// (ゲームに入れるときは、奥、壁、床の3枚に分ける)。
import { buildHeroSheets } from '../../src/art/heroSet';
import { md, OUTLINE, PixelGrid } from '../../src/art/lib';
import { GOLD, WHITE } from '../../src/art/world/palette';
import { Painter } from '../../src/art/world/pix';
import { Wrap, dith, hash } from '../../src/art/world/wrap';
import { type Person, buildPeople, magician, redraw, sprite } from './people';

export const PANEL = md(2, 2, 3);
const W = 216, H = 214;

// ---------- 超能力のもれ(紫) ----------
/** 超能力の光。宇宙人の黄緑、ステージ2の赤紫、ヒーローの赤と水色は使わない */
const PSY = [md(7, 6, 7), md(6, 3, 7), md(4, 1, 6)];

// ---------- 共通の色 ----------
const NIGHT = [md(0, 0, 1), md(1, 1, 2), md(1, 1, 3)];
const C = [md(6, 6, 6), md(5, 5, 5), md(4, 4, 5), md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)];
const LIT = [md(7, 7, 6), md(7, 6, 4), md(6, 5, 3), md(4, 3, 2)];
const WOOD = [md(6, 4, 2), md(5, 3, 1), md(4, 2, 1), md(2, 1, 0)];
const MARBLE = [md(6, 6, 6), md(5, 5, 6), md(5, 5, 5), md(4, 4, 5)];
const LEAF = [md(3, 6, 2), md(2, 4, 1), md(1, 2, 1)];

function blit(dst: PixelGrid, src: PixelGrid, ox: number, oy: number): void {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.cells[y][x]; if (c) dst.px(ox + x, oy + y, c); }
}
/** 人のコマ(64×64、足の裏は y=59)を、足元 (x, feet) に置く */
function place(dst: PixelGrid, frame: PixelGrid, x: number, feet: number, flip = false): void {
  blit(dst, flip ? frame.flipped() : frame, Math.round(x - 32), Math.round(feet - 59));
}
/** 足元の影 */
function shadow(G: Wrap, x: number, feet: number, w = 20, c = OUTLINE): void {
  for (let i = -w / 2; i < w / 2; i++) { if (dith(x + i, feet)) G.px(x + i, feet, c); G.px(x + i, feet + 1, c); }
}

// ---------- 夜の街(窓の外) ----------
/** 窓の外の夜の街。far が大きいほど、街は下に小さく遠くなる */
function cityView(G: Wrap, x0: number, y0: number, w: number, h: number, far: number, seed: number): void {
  G.rect(x0, y0, w, h, NIGHT[0]);
  G.dither(x0, y0 + Math.floor(h * 0.45), w, 3, NIGHT[0], NIGHT[1]);
  G.rect(x0, y0 + Math.floor(h * 0.45) + 3, w, h, NIGHT[1]);
  for (let i = 0; i < w * h / 60; i++) {
    const x = x0 + Math.floor(hash(i, 1, seed) * w), y = y0 + Math.floor(hash(i, 2, seed) * h * 0.5);
    G.px(x, y, i % 5 === 0 ? md(7, 7, 7) : md(4, 4, 6));
  }
  // ビル。far が大きいほど低く、数が多く、小さい
  const base = y0 + h;
  const n = 6 + far * 6;
  for (let i = 0; i < n; i++) {
    const bw = Math.max(4, Math.floor((14 - far * 3) * (0.6 + hash(i, 3, seed))));
    const bh = Math.floor((h * (0.75 - far * 0.18)) * (0.3 + hash(i, 4, seed) * 0.7));
    const bx = x0 + Math.floor(hash(i, 5, seed) * (w + bw)) - bw;
    const col = far === 0 ? C[4] : C[5];
    for (let x = Math.max(x0, bx); x < Math.min(x0 + w, bx + bw); x++) for (let y = base - bh; y < base; y++) {
      G.px(x, y, col);
      const wx = x - bx, wy = y - (base - bh);
      if (wx % 3 === 1 && wy % 3 === 1 && hash(x, y, seed) > 0.45) G.px(x, y, hash(x, y, 9) > 0.7 ? LIT[0] : LIT[2]);
    }
  }
  // 遠いほど、下の方に街の明かりの粒が広がる
  if (far > 0) for (let i = 0; i < w * far * 3; i++) {
    const x = x0 + Math.floor(hash(i, 6, seed) * w), y = base - 1 - Math.floor(hash(i, 7, seed) ** 2 * h * 0.25);
    G.px(x, y, [LIT[1], LIT[0], md(7, 4, 3), md(4, 6, 7)][i % 4]);
  }
}

// ---------- 小物 ----------
function plant(): PixelGrid {
  const P = new Painter(24, 44);
  const pot = P.mask().poly([[4, 30], [19, 30], [17, 43], [6, 43]]);
  P.fill(pot, [C[1], C[2], C[3]], { hi: 0.3, lo: 0.7 });
  P.rect(4, 30, 16, 2, C[0]);
  for (let i = 0; i < 40; i++) {
    const a = hash(i, 1, 7) * Math.PI - Math.PI;
    const r = 4 + hash(i, 2, 7) * 11;
    const x = 12 + Math.cos(a) * r * 0.8, y = 22 + Math.sin(a) * r * 1.3;
    const m = P.mask().ellipse(x, y, 2.4, 1.5);
    P.fill(m, LEAF as unknown as [string, string, string], { sep: 'dark', hi: 0.4, lo: 0.7 });
  }
  P.line([12, 30], [12, 18], WOOD[3]);
  P.outline();
  return P.g;
}

function flowerStand(): PixelGrid {
  const P = new Painter(26, 50);
  const stand = P.mask().rect(10, 26, 6, 22).union(P.mask().rect(6, 46, 14, 3));
  P.fill(stand, [GOLD[0], GOLD[1], GOLD[2]], { hi: 0.3, lo: 0.7 });
  const vase = P.mask().ellipse(13, 22, 6, 5);
  P.fill(vase, [WHITE[0], MARBLE[1], MARBLE[3]], { hi: 0.35, lo: 0.7 });
  for (let i = 0; i < 30; i++) {
    const x = 3 + hash(i, 1, 3) * 20, y = 2 + hash(i, 2, 3) * 16;
    const c = [md(7, 3, 4), md(7, 6, 2), WHITE[0], md(5, 4, 7), LEAF[1]][i % 5];
    P.fill(P.mask().ellipse(x, y, 1.6, 1.6), c, { sep: 'outline' });
  }
  P.outline();
  return P.g;
}

function champagneTower(): PixelGrid {
  const P = new Painter(40, 48);
  // テーブル(白いクロス)
  const cloth = P.mask().poly([[2, 28], [37, 28], [39, 47], [0, 47]]);
  P.fill(cloth, [WHITE[0], MARBLE[1], MARBLE[3]], { hi: 0.25, lo: 0.75 });
  for (let x = 3; x < 38; x += 6) P.line([x, 30], [x - 1, 46], MARBLE[2]);
  P.rect(1, 28, 38, 1, WHITE[0]);
  // グラスのピラミッド(4段)
  const glass = (x: number, y: number) => sprite(P, x, y, ['g.g', 'ygy', '.g.', 'ggg'], { g: md(6, 7, 7), y: md(7, 6, 2) });
  for (let row = 0; row < 4; row++) {
    const n = 4 - row;
    for (let i = 0; i < n; i++) glass(20 - n * 2.5 + i * 5 - 1, 23 - row * 5);
  }
  P.outline();
  return P.g;
}

function piano(): PixelGrid {
  const P = new Painter(62, 44);
  const body = P.mask().poly([[2, 14], [44, 10], [58, 16], [58, 26], [2, 28]]);
  P.fill(body, [md(2, 2, 3), md(1, 1, 2), OUTLINE], { hi: 0.25, lo: 0.8 });
  // ふた(開いている)
  const lid = P.mask().poly([[6, 12], [40, 0], [44, 2], [48, 11]]);
  P.fill(lid, [md(3, 3, 4), md(1, 1, 2), OUTLINE], { hi: 0.4, lo: 0.8 });
  P.line([20, 13], [30, 5], GOLD[2]);
  // けん盤
  P.rect(3, 24, 20, 3, WHITE[0]);
  for (let x = 4; x < 23; x += 2) P.px(x, 24, OUTLINE);
  // 脚
  for (const x of [6, 30, 52]) P.fill(P.mask().rect(x, 28, 3, 14), [md(2, 2, 3), md(1, 1, 2), OUTLINE]);
  P.rect(4, 26, 50, 1, GOLD[1]);
  // つやの光
  P.line([46, 18], [54, 18], md(4, 4, 5));
  P.outline();
  return P.g;
}

function chandelier(psy = false): PixelGrid {
  const P = new Painter(56, 34);
  const gold: [string, string, string] = [GOLD[0], GOLD[1], GOLD[2]];
  P.rect(27, 0, 2, 8, GOLD[2]);
  // 3段の輪
  for (const [y, rx] of [[10, 10], [17, 18], [24, 25]] as const) {
    const m = P.mask().ellipse(28, y, rx, 2.2);
    P.fill(m, gold, { hi: 0.4, lo: 0.7 });
    // ろうそくと炎
    for (let x = 28 - rx + 2; x <= 28 + rx - 2; x += 6) {
      P.rect(x, y - 5, 2, 4, WHITE[0]);
      P.px(x, y - 7, psy ? PSY[1] : LIT[1]).px(x + 1, y - 6, psy ? PSY[0] : LIT[0]).px(x, y - 6, psy ? PSY[0] : LIT[0]);
    }
    // しずくのかざり
    for (let x = 28 - rx; x <= 28 + rx; x += 4) P.px(x, y + 3, md(6, 7, 7)).px(x, y + 4, WHITE[0]);
  }
  P.fill(P.mask().ellipse(28, 30, 3, 3), gold);
  P.outline();
  return P.g;
}

/** もれ:浮いた小物(ペン、名刺、コーヒーカップ)と、そのまわりの紫の粒 */
function floatingBits(G: Wrap, x: number, y: number, kind: 'pen' | 'card' | 'cup' | 'glass'): void {
  const Pn = new Painter(12, 12);
  if (kind === 'pen') sprite(Pn, 2, 4, ['.......b', '....bbb.', '.bbb....', 'w.......'], { b: md(2, 3, 6), w: GOLD[1] });
  if (kind === 'card') sprite(Pn, 2, 3, ['wwwwww', 'wbwggw', 'wwwwww', 'wgggww'], { w: WHITE[0], b: md(2, 3, 6), g: WHITE[2] });
  if (kind === 'cup') sprite(Pn, 3, 3, ['wwwww', 'wbbbwh', 'wwwwwh', '.www.'], { w: WHITE[0], b: WOOD[3], h: WHITE[2] });
  if (kind === 'glass') sprite(Pn, 4, 2, ['g.g', 'ygy', '.g.', '.g.', 'ggg'], { g: md(6, 7, 7), y: md(7, 6, 2) });
  // まわりの紫のもや(市松で)
  for (let j = -7; j <= 7; j++) for (let i = -8; i <= 8; i++) {
    const d = (i * i) / 64 + (j * j) / 49;
    if (d < 1 && d > 0.45 && dith(x + i, y + j)) G.px(x + i, y + j, PSY[2]);
  }
  blit(G.g, Pn.g, x - 6, y - 6);
  spark(G, x + 7, y - 5); G.px(x - 7, y + 4, PSY[0]).px(x + 2, y + 8, PSY[1]);
}

/** 紫の火花(十字) */
function spark(G: Wrap, x: number, y: number, big = false): void {
  G.px(x, y, PSY[0]);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) G.px(x + dx, y + dy, PSY[1]);
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) G.px(x + dx, y + dy, PSY[2]);
}

/** つり下げのあかり。psy なら紫になり、火花が出る */
function pendant(G: Wrap, x: number, top: number, len: number, psy: boolean): void {
  G.rect(x, top, 1, len, C[3]);
  const y = top + len;
  const shade = psy ? PSY : [LIT[0], LIT[1], LIT[2]];
  G.rect(x - 4, y, 9, 1, OUTLINE).rect(x - 5, y + 1, 11, 3, C[2]).rect(x - 5, y + 1, 11, 1, C[1]).rect(x - 6, y + 4, 13, 1, OUTLINE);
  G.rect(x - 4, y + 5, 9, 1, shade[0]).rect(x - 3, y + 6, 7, 1, shade[1]);
  // 下へこぼれる光(ディザ)
  for (let j = 7; j < 14; j++) for (let i = -2 - (j >> 2); i <= 2 + (j >> 2); i++) if (dith(x + i, y + j) && j % 2 === 0) G.px(x + i, y + j, shade[2]);
  if (psy) { spark(G, x - 8, y + 2, true); spark(G, x + 8, y + 7); }
}

// =====================================================================
// 1階 ロビーとお店
// =====================================================================
function lobbyBg(psyLamp: number | null): Wrap {
  const G = new Wrap(W, H);
  // 天井
  G.rect(0, 0, W, 8, C[4]).rect(0, 7, W, 1, C[5]);
  // 左:ガラスの壁の向こうの夜の街
  cityView(G, 0, 8, 118, 116, 0, 11);
  // ガラスのわく(縦と横)
  for (let x = 0; x < 118; x += 29) G.rect(x, 8, 2, 116, C[3]).rect(x, 8, 1, 116, C[2]);
  G.rect(0, 60, 118, 2, C[3]).rect(0, 60, 118, 1, C[2]);
  // ガラスの映りこみ(ななめの線)
  for (let x = 8; x < 118; x += 29) { G.line(x, 110, x + 14, 70, md(3, 3, 5)); G.line(x + 3, 110, x + 16, 74, md(3, 3, 5)); }
  // 自動ドア(ガラスの中の、もう1枚のわく)
  G.rect(36, 72, 46, 52, NIGHT[2]).outlineRect(36, 72, 46, 52, C[2]);
  G.rect(58, 72, 2, 52, C[3]);
  cityView(G, 37, 73, 21, 50, 0, 12); cityView(G, 60, 73, 21, 50, 0, 13);
  G.rect(34, 68, 50, 4, C[2]).rect(34, 68, 50, 1, C[1]);
  // 2階の手すり(右半分の上)
  G.rect(118, 8, 98, 48, C[3]);
  for (let x = 124; x < W; x += 22) G.rect(x, 14, 16, 26, LIT[3]).rect(x + 1, 15, 14, 3, LIT[2]);
  G.rect(118, 40, 98, 8, md(3, 4, 5));
  for (let x = 118; x < W; x += 8) G.rect(x, 40, 1, 8, C[2]);
  G.rect(118, 39, 98, 1, C[1]).rect(118, 48, 98, 3, C[2]).rect(118, 48, 98, 1, C[1]).rect(118, 51, 98, 1, C[5]);
  // 右:受付の木の壁とカフェ
  G.rect(118, 52, 98, 72, WOOD[2]);
  for (let x = 118; x < W; x += 6) G.rect(x, 52, 1, 72, WOOD[3]).px(x + 2, 52 + (x % 11), WOOD[1]);
  // 会社の名前の板(文字は描かない)
  G.rect(128, 60, 34, 10, GOLD[1]).outlineRect(128, 60, 34, 10).rect(128, 60, 34, 1, GOLD[0]);
  G.rect(132, 63, 4, 4, WOOD[3]).rect(139, 64, 19, 2, WOOD[3]);
  // 受付のカウンター
  G.rect(122, 96, 50, 28, MARBLE[1]).rect(122, 96, 50, 2, WHITE[0]).outlineRect(122, 96, 50, 28);
  G.rect(122, 104, 50, 1, GOLD[1]);
  // カフェ(右はし):しまのひさし、明るい店の中
  G.rect(176, 76, 40, 48, LIT[2]);
  G.dither(176, 76, 40, 3, LIT[0], LIT[1]);
  for (let x = 176; x < W; x += 4) G.rect(x, 70, 2, 8, md(7, 4, 1)).rect(x + 2, 70, 2, 8, WHITE[0]);
  G.rect(176, 78, 40, 1, OUTLINE);
  G.rect(180, 84, 14, 10, OUTLINE).rect(181, 85, 12, 8, md(2, 3, 2));
  for (let i = 0; i < 4; i++) G.rect(182, 86 + i * 2, 6 + (i % 2) * 3, 1, WHITE[1]);
  G.rect(198, 90, 12, 10, C[1]).rect(199, 91, 10, 3, C[3]).px(203, 96, OUTLINE);
  G.rect(176, 104, 40, 20, WOOD[1]).rect(176, 104, 40, 2, WOOD[0]).outlineRect(176, 104, 40, 20);
  // 柱
  G.rect(116, 8, 4, 116, C[2]).rect(116, 8, 1, 116, C[1]).rect(119, 8, 1, 116, C[4]);
  // 壁のすそ
  G.rect(0, 122, W, 2, OUTLINE);
  // 床:みがいた大理石。奥から手前へ広がる目地と、明かりの映りこみ
  for (let y = 124; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (y - 124) / 90;
    const row = Math.floor(Math.sqrt(t) * 6);
    const col = Math.floor((x - 108) / (24 + t * 30));
    G.px(x, y, (row + col) % 2 ? MARBLE[1] : MARBLE[2]);
  }
  for (const y of [124, 127, 133, 143, 157, 176, 200]) G.rect(0, y, W, 1, MARBLE[3]);
  for (let i = -6; i <= 6; i++) for (let y = 124; y < H; y++) {
    const t = (y - 124) / 90;
    G.px(108 + i * (24 + t * 30) * 1, y, MARBLE[3]);
  }
  G.dither(0, 124, W, 2, OUTLINE, MARBLE[3]);
  // 窓の映りこみ(ガラスの街の青)と、カフェの明かりの映りこみ
  for (let y = 128; y < 170; y++) for (let x = 0; x < 110; x++) if (dith(x, y) && y % 3 === 0) G.px(x, y, md(3, 3, 5));
  // つり下げのあかり
  for (const x of [22, 70, 196]) pendant(G, x, x > 118 ? 52 : 8, x > 118 ? 10 : 12, x === psyLamp);
  return G;
}

function lobby(people: Person[], hero: PixelGrid): PixelGrid {
  const G = lobbyBg(196);
  const florist = people.find((p) => p.id === 'florist')!;
  const courier = people.find((p) => p.id === 'courier')!;
  blit(G.g, plant(), 2, 140);
  blit(G.g, flowerStand(), 66, 134);
  shadow(G, 40, 190); shadow(G, 128, 186); shadow(G, 180, 192);
  place(G.g, hero, 40, 190);
  place(G.g, florist.frame, 128, 186, true);
  place(G.g, courier.frame, 180, 192, true);
  // ヴィラン(配達員)のもれ:頭の上に浮いた名刺とペン。上のあかりが紫
  floatingBits(G, 164, 132, 'card');
  floatingBits(G, 198, 128, 'pen');
  return G.g;
}

// =====================================================================
// 最上階 パーティ会場
// =====================================================================
const RED = [md(6, 1, 2), md(5, 0, 1), md(3, 0, 1)];
const CARPET = [md(5, 1, 2), md(4, 1, 1), md(3, 0, 1)];

function partyBg(): Wrap {
  const G = new Wrap(W, H);
  // 大きな窓:月と、はるか下の街
  cityView(G, 0, 0, W, 112, 2, 21);
  G.rect(0, 0, W, 60, NIGHT[0]);
  for (let i = 0; i < 70; i++) G.px(Math.floor(hash(i, 1, 5) * W), Math.floor(hash(i, 2, 5) * 60), i % 6 === 0 ? md(7, 7, 7) : md(4, 4, 6));
  // 月
  const moon = new Painter(20, 20);
  moon.fill(moon.mask().ellipse(10, 10, 8, 8), [md(7, 7, 6), md(7, 7, 5), md(6, 6, 4)], { sep: 'none', hi: 0.5, lo: 0.85 });
  moon.px(7, 8, md(6, 6, 4)).px(12, 12, md(6, 6, 4)).px(13, 6, md(6, 6, 4));
  blit(G.g, moon.g, 160, 10);
  // 窓のわく(金の格子とアーチ)
  for (let x = 0; x < W; x += 36) G.rect(x, 0, 3, 112, GOLD[2]).rect(x + 1, 0, 1, 112, GOLD[1]);
  G.rect(0, 40, W, 2, GOLD[2]).rect(0, 40, W, 1, GOLD[1]);
  // 赤いカーテン(左右)
  for (const [x0, w] of [[0, 22], [194, 22]] as const) {
    for (let x = x0; x < x0 + w; x++) {
      const k = (x - x0) % 7;
      G.rect(x, 0, 1, 114, k < 2 ? RED[0] : k < 5 ? RED[1] : RED[2]);
    }
    G.rect(x0, 0, w, 6, GOLD[1]).rect(x0, 5, w, 1, GOLD[2]);
    // たばねた所と金のふさ
    const tx = x0 === 0 ? 18 : 196;
    G.rect(tx - 1, 70, 4, 4, GOLD[1]).rect(tx, 74, 2, 6, GOLD[0]);
  }
  // 腰の高さの木の壁と金の線
  G.rect(0, 112, W, 12, WOOD[3]).rect(0, 112, W, 2, GOLD[1]);
  for (let x = 4; x < W; x += 18) G.outlineRect(x, 116, 14, 5, WOOD[2]);
  G.rect(0, 122, W, 2, OUTLINE);
  // 床:手前は寄せ木、真ん中に赤いじゅうたん(金のひし形の模様)
  for (let y = 124; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (y - 124) / 90;
    G.px(x, y, ((x >> 3) + (y >> 2)) % 2 ? WOOD[1] : WOOD[2]);
    const edge = 10 - t * 8;
    if (y >= 132 && y < 200 && x > edge && x < W - edge) G.px(x, y, CARPET[1]);
  }
  for (let y = 136; y < 198; y += 12) for (let x = 12; x < W - 12; x += 16) {
    G.px(x, y, GOLD[1]).px(x - 1, y + 1, GOLD[2]).px(x + 1, y + 1, GOLD[2]).px(x, y + 2, GOLD[1]);
  }
  G.rect(0, 132, W, 1, GOLD[1]).rect(0, 199, W, 1, GOLD[1]);
  G.dither(0, 124, W, 2, OUTLINE, WOOD[3]);
  // 窓の月あかりの映りこみ
  for (let y = 126; y < 132; y++) for (let x = 150; x < 190; x++) if (dith(x, y)) G.px(x, y, WOOD[0]);
  return G;
}

function party(people: Person[], hero: PixelGrid): PixelGrid {
  const G = partyBg();
  const lady = people.find((p) => p.id === 'lady')!;
  const waiter = people.find((p) => p.id === 'waiter')!;
  // シャンデリア
  blit(G.g, chandelier(false), 52, 0);
  // シャンパンタワー
  blit(G.g, champagneTower(), 70, 142);
  // 念力で浮いたピアノ(下に影、まわりに紫のふちと粒)
  const px0 = 146, py0 = 102;
  for (let i = 0; i < 48; i++) if (dith(px0 + 6 + i, 190)) G.px(px0 + 6 + i, 190, OUTLINE);
  for (let i = 0; i < 40; i++) G.px(px0 + 10 + i, 191, OUTLINE);
  // 脚の下の、浮いていることを見せる紫の線(下へ行くほどうすい)
  for (const lx of [7, 31, 53]) for (let y = 146; y < 170; y += 3) if (y < 158 || dith(lx, y)) G.px(px0 + lx, y, PSY[2]);
  const pg = piano();
  // ピアノの形のまわりを紫で1ドットふちどる
  for (let y = -1; y <= pg.h; y++) for (let x = -1; x <= pg.w; x++) {
    if (pg.get(x, y)) continue;
    if (pg.get(x - 1, y) || pg.get(x + 1, y) || pg.get(x, y - 1) || pg.get(x, y + 1)) G.px(px0 + x, py0 + y, PSY[1]);
  }
  blit(G.g, pg, px0, py0);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = px0 + 31 + Math.cos(a) * 38, y = py0 + 22 + Math.sin(a) * 28;
    if (i % 2 === 0) spark(G, x, y, i % 4 === 0); else G.px(x, y, PSY[0]);
  }
  shadow(G, 38, 192); shadow(G, 120, 194); shadow(G, 180, 198);
  place(G.g, hero, 38, 192);
  // ヴィランのドレスの女性:手をピアノへ向ける
  const casting = redraw(lady, (p) => { p.face = 'grin'; p.aF = { e: [36, 24], h: [42, 18] }; });
  place(G.g, casting, 120, 194);
  spark(G, 120 - 32 + 43, 194 - 59 + 15, true);
  // 市民のウェイターは、ピアノの下でおびえている
  const scared = redraw(waiter, (p) => { p.face = 'surprised'; p.sweat = true; });
  place(G.g, scared, 180, 198, true);
  return G.g;
}

// =====================================================================
// エレベーターの中(ラッシュ)
// =====================================================================
const STEEL = [md(6, 6, 6), md(5, 5, 5), md(3, 3, 4), md(2, 2, 3)];

function elevator(people: Person[], heroSheet: PixelGrid[][]): PixelGrid {
  const G = new Wrap(W, H);
  // 後ろのガラスの向こう:夜景が下へ流れる(縦の流れの線)
  cityView(G, 0, 16, 176, 128, 1, 31);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 41) * 176), y = 18 + Math.floor(hash(i, 2, 41) * 110);
    const len = 6 + Math.floor(hash(i, 3, 41) * 14);
    for (let j = 0; j < len; j++) if (j % 2 === 0) G.px(x, y + j, j < 3 ? LIT[1] : md(3, 3, 5));
  }
  // ガラスのわく
  for (const x of [0, 58, 116, 174]) G.rect(x, 16, 3, 128, STEEL[2]).rect(x + 1, 16, 1, 128, STEEL[1]);
  G.rect(0, 80, 176, 2, STEEL[2]);
  // 天井(あかりの帯)と、階の数字を出す枠(数字はコードで入れる)
  G.rect(0, 0, W, 16, STEEL[3]).rect(0, 14, W, 2, STEEL[2]);
  G.rect(8, 5, 160, 3, LIT[0]).rect(8, 8, 160, 1, LIT[2]);
  G.rect(184, 2, 26, 12, OUTLINE).outlineRect(184, 2, 26, 12, STEEL[1]);
  // 手すり
  G.rect(0, 118, 176, 3, STEEL[1]).rect(0, 118, 176, 1, STEEL[0]);
  for (const x of [6, 170]) G.rect(x, 118, 2, 10, STEEL[2]);
  // 右:開いた扉と、その先の階のろうか(明るい)
  G.rect(176, 16, 40, 128, STEEL[2]);
  G.rect(182, 30, 30, 114, LIT[2]);
  G.dither(182, 30, 30, 4, LIT[0], LIT[1]);
  G.rect(182, 120, 30, 24, WOOD[1]);
  G.rect(182, 30, 3, 114, STEEL[1]).rect(209, 30, 3, 114, STEEL[1]);
  G.outlineRect(182, 30, 30, 114, STEEL[3]);
  // ボタンの板(扉の左)。乗ってきたヴィランのそばのボタンだけ紫
  G.rect(168, 96, 8, 44, STEEL[1]).outlineRect(168, 96, 8, 44, STEEL[3]);
  for (let i = 0; i < 6; i++) {
    const y = 100 + i * 6, psy = i === 2;
    G.rect(170, y, 4, 4, psy ? PSY[1] : STEEL[2]).px(170, y, psy ? PSY[0] : STEEL[0]);
  }
  spark(G, 165, 108, true); spark(G, 178, 104);
  // 床
  for (let y = 144; y < H; y++) for (let x = 0; x < W; x++) G.px(x, y, ((x >> 4) + (y >> 3)) % 2 ? STEEL[2] : STEEL[3]);
  G.rect(0, 144, W, 1, STEEL[1]);
  G.dither(0, 145, W, 2, OUTLINE, STEEL[3]);
  // 待てで通した市民(奥にたまる)
  const florist = people.find((p) => p.id === 'florist')!;
  const newbie = people.find((p) => p.id === 'newbie')!;
  const chef = people.find((p) => p.id === 'chef')!;
  shadow(G, 20, 190); shadow(G, 42, 188);
  place(G.g, florist.frame, 20, 190);
  place(G.g, newbie.frame, 42, 188);
  // ヒーロー(扉の方を向いて構える)
  const hero = heroSheet[3][0];
  shadow(G, 104, 196);
  place(G.g, hero, 104, 196);
  // 乗ってきたシェフ(ヴィラン)。頭の上でおたまと小物が浮く
  shadow(G, 176, 196);
  place(G.g, chef.frame, 176, 196, true);
  floatingBits(G, 196, 120, 'cup');
  return G.g;
}

// =====================================================================
// 仕分けの画面のもれの見え方(同じ絵の市民とヴィラン、紛らわしい市民)
// =====================================================================
function leakPanel(p: PixelGrid, kind: 'civ' | 'bad' | 'decoy'): PixelGrid {
  const PW = 100, PH = 150;
  const G = new Wrap(PW, PH);
  // オフィスの壁と机
  G.rect(0, 0, PW, PH, md(4, 4, 5));
  for (let x = 0; x < PW; x += 20) G.rect(x, 0, 1, 104, md(3, 3, 4));
  G.rect(0, 0, PW, 4, C[3]);
  // 左上の照明(場所はどの人でも同じ)
  const psy = kind === 'bad';
  G.rect(2, 4, 34, 6, C[2]).outlineRect(2, 4, 34, 6).rect(3, 10, 32, 3, psy ? PSY[1] : LIT[0]).rect(4, 13, 30, 1, psy ? PSY[2] : LIT[2]);
  for (let j = 14; j < 30; j++) for (let i = 4 - (j - 14); i < 34 + (j - 14); i++) if (dith(i, j) && j % 2 === 0 && i >= 0) G.px(i, j, psy ? PSY[2] : md(5, 5, 5));
  if (psy) { spark(G, 38, 8, true); spark(G, 30, 22, true); spark(G, 8, 26); }
  // 左下の机とペン立て(場所はどの人でも同じ)
  G.rect(0, 96, 34, 8, WOOD[1]).rect(0, 96, 34, 2, WOOD[0]).outlineRect(0, 96, 34, 8);
  G.rect(0, 104, 34, 46, WOOD[3]);
  G.rect(8, 86, 8, 10, C[2]).outlineRect(8, 86, 8, 10);
  if (psy) {
    // ペンとマグカップが、机から浮いている
    floatingBits(G, 14, 70, 'pen');
    floatingBits(G, 26, 82, 'cup');
    G.line(11, 85, 11, 82, md(6, 1, 1));
  } else {
    G.line(11, 85, 10, 80, md(2, 3, 6)).line(13, 85, 14, 81, md(6, 1, 1));
    const Pn = new Painter(12, 12);
    sprite(Pn, 3, 3, ['wwwww', 'wbbbwh', 'wwwwwh', '.www.'], { w: WHITE[0], b: WOOD[3], h: WHITE[2] });
    blit(G.g, Pn.g, 20, 87);
  }
  G.rect(0, 104, PW, 1, OUTLINE);
  // 床
  G.rect(34, 104, PW - 34, 46, md(3, 3, 4));
  // 人は2倍
  const big = new PixelGrid(128, 128);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const c = p.cells[y][x]; if (c) big.rect(x * 2, y * 2, 2, 2, c); }
  blit(G.g, big, 64 - 64, 146 - 118);
  return G.g;
}

function leaks(people: Person[]): PixelGrid {
  const newbie = people.find((p) => p.id === 'newbie')!;
  const magi = redraw({ ...people.find((p) => p.id === 'magician')!, look: magician(true).look }, () => {});
  const panels = [leakPanel(newbie.frame, 'civ'), leakPanel(newbie.frame, 'bad'), leakPanel(magi, 'decoy')];
  const g = new PixelGrid(100 * 3 + 8, 150);
  g.rect(0, 0, g.w, g.h, PANEL);
  panels.forEach((p, i) => blit(g, p, i * 104, 0));
  return g;
}

function lineup(people: Person[]): PixelGrid {
  const g = new PixelGrid(64 * 4, 64 * 2);
  g.rect(0, 0, g.w, g.h, PANEL);
  people.forEach((p, i) => blit(g, p.frame, (i % 4) * 64, Math.floor(i / 4) * 64));
  return g;
}

export function buildImages(): Record<string, { grid: PixelGrid; scale: number }> {
  const people = buildPeople();
  const heroSheet = buildHeroSheets().hero;
  const hero = heroSheet[0][0];
  return {
    people: { grid: lineup(people), scale: 3 },
    lobby: { grid: lobby(people, hero), scale: 3 },
    party: { grid: party(people, hero), scale: 3 },
    elevator: { grid: elevator(people, heroSheet), scale: 3 },
    leaks: { grid: leaks(people), scale: 2 }
  };
}
