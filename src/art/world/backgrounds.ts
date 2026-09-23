// 夜の路地裏の背景3枚。どれも左右の端がつながる(x は幅で折り返して描く)。
// 背景だけはディザ(市松模様)を使ってよい。3枚合わせて45色まで。
import { md, OUTLINE, PixelGrid } from '../lib';
import { windowGrid } from './props';

// ---------- 色(3枚で共通) ----------
const SKY = [md(0, 0, 1), md(1, 0, 2), md(1, 1, 2), md(2, 1, 3), md(3, 1, 3)];
const STAR = md(7, 7, 7), STAR_D = md(4, 4, 6);
const MOON = [md(7, 7, 5), md(6, 6, 4)];
const FAR_B = [md(1, 0, 1), md(1, 1, 2), md(2, 1, 3)];
const LIT_Y = md(7, 6, 3), LIT_C = md(3, 5, 6), BEACON = md(7, 1, 1);
const BRICK = [md(5, 2, 2), md(4, 1, 2), md(3, 1, 1), md(2, 0, 1)];
const BRICK2 = [md(4, 2, 3), md(3, 1, 2), md(2, 1, 2), md(1, 0, 1)];
const CONC = [md(4, 4, 5), md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)];
const METAL = [md(6, 6, 6), md(4, 4, 5), md(3, 3, 4)];
const PINK = md(7, 3, 6), PINK_C = md(7, 6, 7), CYAN = md(3, 7, 7);
const DOOR = [md(3, 4, 4), md(2, 3, 3), md(1, 2, 2)];
const ASPHALT = [md(2, 2, 3), md(1, 1, 2), md(1, 0, 1)];

/** 決まった乱数(同じ入力で同じ値) */
const hash = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const dith = (x: number, y: number) => (x + y) % 2 === 0;

/** 横が折り返す格子 */
class Wrap {
  readonly g: PixelGrid;
  constructor(readonly w: number, readonly h: number) { this.g = new PixelGrid(w, h); }
  px(x: number, y: number, c: string | null): this {
    x = ((Math.round(x) % this.w) + this.w) % this.w;
    this.g.px(x, Math.round(y), c);
    return this;
  }
  get(x: number, y: number): string | null { return this.g.get(((x % this.w) + this.w) % this.w, y); }
  rect(x: number, y: number, w: number, h: number, c: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  /** 2色の市松模様で塗る */
  dither(x: number, y: number, w: number, h: number, a: string, b: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, dith(x + i, y + j) ? a : b);
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    return this;
  }
  blit(src: PixelGrid, ox: number, oy: number): this {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.cells[y][x]) this.px(ox + x, oy + y, src.cells[y][x]);
    return this;
  }
  /** 塗ったところのまわりにふち */
  outlineRect(x: number, y: number, w: number, h: number, c = OUTLINE): this {
    this.rect(x - 1, y - 1, w + 2, 1, c).rect(x - 1, y + h, w + 2, 1, c).rect(x - 1, y, 1, h, c).rect(x + w, y, 1, h, c);
    return this;
  }
}

// =====================================================================
// 遠くのビルと夜空 216×214
// =====================================================================
export function drawFar(): PixelGrid {
  const W = 216, H = 214;
  const G = new Wrap(W, H);
  // 夜空:上から下へ明るくなる(境目はディザ)
  const bands = [0, 26, 52, 78, 104];
  for (let y = 0; y < H; y++) {
    let i = bands.findIndex((b, k) => y >= b && (k === bands.length - 1 || y < bands[k + 1]));
    i = Math.max(0, i);
    const next = Math.min(SKY.length - 1, i + 1);
    const into = y - bands[i];
    for (let x = 0; x < W; x++) {
      let c = SKY[i];
      if (into > 18 && dith(x, y)) c = SKY[next];
      else if (into > 22) c = SKY[next];
      G.px(x, y, c);
    }
  }
  // 星
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 1) * W), y = Math.floor(hash(i, 2) * 70);
    G.px(x, y, hash(i, 3) > 0.75 ? STAR : STAR_D);
    if (hash(i, 4) > 0.94) { G.px(x - 1, y, STAR_D).px(x + 1, y, STAR_D).px(x, y - 1, STAR_D).px(x, y + 1, STAR_D).px(x, y, STAR); }
  }
  // 月
  const mx = 168, my = 26;
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
    const d = x * x + y * y;
    if (d > 81) continue;
    const shade = (x + 3) * (x + 3) + (y + 3) * (y + 3) > 60;
    G.px(mx + x, my + y, shade ? MOON[1] : MOON[0]);
  }
  for (const [x, y, r] of [[-3, -2, 2], [3, 3, 1.5], [-1, 5, 1]] as const)
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= r * r) G.px(mx + x + i, my + y + j, MOON[1]);
  // 遠くのビル2層
  const skyline = (layer: number) => {
    const col = FAR_B[2 - layer];
    const top = layer === 0 ? 60 : 80;
    let x = layer * 11;
    let k = 0;
    while (x < W + layer * 11) {
      const bw = 14 + Math.floor(hash(k, layer, 7) * 22);
      const bh = top + Math.floor(hash(k, layer, 9) * 34) - (layer === 0 ? 10 : 0);
      G.rect(x, bh, bw, H - bh, col);
      // 屋上の出っぱり
      if (hash(k, layer, 3) > 0.5) G.rect(x + 3, bh - 4, 4, 4, col);
      if (hash(k, layer, 4) > 0.7) { G.rect(x + bw / 2, bh - 12, 1, 12, col); G.px(x + bw / 2, bh - 13, BEACON); }
      // 窓の明かり
      for (let wy = bh + 4; wy < H - 20; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
        const r = hash(wx, wy, layer);
        if (r > (layer === 0 ? 0.86 : 0.8)) G.px(wx, wy, r > 0.95 ? LIT_C : layer === 0 ? FAR_B[2] : LIT_Y);
      }
      x += bw + (layer === 0 ? 2 : 0);
      k++;
    }
  };
  skyline(0);
  skyline(1);
  // 街の明かりのもや(ビルのすそ)
  for (let y = 150; y < H; y++) for (let x = 0; x < W; x++) if (G.get(x, y) === FAR_B[1] && dith(x, y) && y > 160) G.px(x, y, FAR_B[0]);
  return G.g;
}

// =====================================================================
// 手前の建物の壁 648×130(上の空は透明)
// =====================================================================
function bricks(G: Wrap, x0: number, y0: number, w: number, h: number, pal: string[], seed: number): void {
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 4), inRow = (y - y0) % 4;
    const off = row % 2 ? 4 : 0;
    for (let x = x0; x < x0 + w; x++) {
      const bx = Math.floor((x - x0 + off) / 8), inB = (x - x0 + off) % 8;
      let c: string;
      if (inRow === 3 || inB === 7) c = pal[3];
      else {
        const r = hash(bx, row, seed);
        c = r > 0.85 ? pal[0] : r < 0.18 ? pal[2] : pal[1];
        if (inRow === 0 && inB < 6 && c === pal[1] && r > 0.6) c = pal[0];
        if (inRow === 2 && c === pal[1] && dith(x, y) && r < 0.35) c = pal[2];
      }
      G.px(x, y, c);
    }
  }
  // 下の方は暗く(ディザ)
  for (let y = y0 + h - 18; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const c = G.get(x, y);
    const k = y - (y0 + h - 18);
    if (c === pal[1] && (k > 9 || dith(x, y))) G.px(x, y, pal[2]);
    else if (c === pal[0] && k > 4) G.px(x, y, pal[1]);
  }
}

function concrete(G: Wrap, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    let c = CONC[2];
    if ((y - y0) % 22 === 0) c = CONC[3];
    else if ((y - y0) % 22 === 1) c = CONC[1];
    else if (hash(x, y, 5) > 0.93) c = CONC[3];
    else if (hash(x >> 2, y >> 2, 6) > 0.8 && dith(x, y)) c = CONC[1];
    if ((x - x0) % 48 === 0) c = CONC[3];
    G.px(x, y, c);
  }
  for (let y = y0 + h - 14; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (dith(x, y) || y > y0 + h - 6) G.px(x, y, G.get(x, y) === CONC[2] ? CONC[3] : G.get(x, y));
}

function cornice(G: Wrap, x: number, y: number, w: number): void {
  G.rect(x - 2, y, w + 4, 4, CONC[1]).rect(x - 2, y, w + 4, 1, CONC[0]).rect(x - 2, y + 3, w + 4, 1, CONC[3]);
  G.rect(x - 2, y - 1, w + 4, 1, OUTLINE).rect(x, y + 4, w, 1, OUTLINE);
}

function drainPipe(G: Wrap, x: number, y0: number, y1: number): void {
  G.rect(x, y0, 3, y1 - y0, METAL[1]).rect(x, y0, 1, y1 - y0, METAL[0]).rect(x + 2, y0, 1, y1 - y0, METAL[2]);
  G.rect(x - 1, y0, 1, y1 - y0, OUTLINE).rect(x + 3, y0, 1, y1 - y0, OUTLINE);
  for (let y = y0 + 8; y < y1; y += 22) G.rect(x - 1, y, 5, 2, METAL[2]).rect(x - 1, y, 5, 1, METAL[0]);
  // 下の曲がり
  G.rect(x, y1 - 2, 6, 3, METAL[1]).rect(x, y1 - 2, 6, 1, METAL[0]).rect(x + 6, y1 - 2, 1, 3, OUTLINE);
}

function door(G: Wrap, x: number, y: number): void {
  const w = 26, h = 42;
  G.rect(x - 3, y - 3, w + 6, h + 3, CONC[1]).rect(x - 3, y - 3, w + 6, 1, CONC[0]);
  G.outlineRect(x, y, w, h);
  G.rect(x, y, w, h, DOOR[1]);
  G.rect(x, y, 1, h, DOOR[0]).rect(x + w - 1, y, 1, h, DOOR[2]);
  G.rect(x + 3, y + 4, w - 6, 14, DOOR[2]).rect(x + 3, y + 22, w - 6, 16, DOOR[2]);
  G.rect(x + 4, y + 5, w - 8, 12, DOOR[1]).rect(x + 4, y + 23, w - 8, 14, DOOR[1]);
  G.rect(x + 4, y + 5, w - 8, 1, DOOR[0]).rect(x + 4, y + 23, w - 8, 1, DOOR[0]);
  G.rect(x + w - 5, y + 20, 2, 3, METAL[0]);
  // 上の明かり
  G.rect(x + 9, y - 9, 8, 4, METAL[2]).rect(x + 10, y - 6, 6, 2, LIT_Y).outlineRect(x + 9, y - 9, 8, 5);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) {
    const px = x + 7 + i, py = y - 4 + j;
    if (dith(px, py) && G.get(px, py) !== OUTLINE && Math.abs(i - 5.5) < 6 - j) G.px(px, py, LIT_Y);
  }
}

function window(G: Wrap, x: number, y: number, lit: boolean, seed: number): void {
  G.blit(windowGrid(lit ? 'lit' : 'dark', seed), x, y);
  G.outlineRect(x + 2, y + 3, 20, 25);
}

function acUnit(G: Wrap, x: number, y: number): void {
  G.rect(x, y, 16, 10, METAL[1]).rect(x, y, 16, 1, METAL[0]).rect(x, y + 9, 16, 1, METAL[2]);
  for (let i = 0; i < 4; i++) G.rect(x + 2, y + 2 + i * 2, 7, 1, METAL[2]);
  G.rect(x + 11, y + 2, 4, 6, METAL[2]).px(x + 12, y + 3, METAL[0]);
  G.outlineRect(x, y, 16, 10);
  // したたる水のあと
  G.rect(x + 3, y + 11, 1, 5, CONC[3]);
}

function neonHeart(G: Wrap, x: number, y: number): void {
  // 縦長の看板の箱と、ハートと矢印のネオン
  G.rect(x, y, 22, 44, BRICK2[3]).outlineRect(x, y, 22, 44);
  G.rect(x + 1, y + 1, 20, 1, BRICK2[2]);
  const heart = (cx: number, cy: number, c: string) => {
    for (let j = -5; j <= 6; j++) for (let i = -8; i <= 8; i++) {
      const X = i / 7, Y = -j / 6;
      const v = (X * X + Y * Y - 0.6) ** 3 - X * X * Y * Y * Y;
      const inside = v <= 0;
      const X2 = i / 5.4, Y2 = -(j - 0.3) / 4.6;
      const inner = (X2 * X2 + Y2 * Y2 - 0.6) ** 3 - X2 * X2 * Y2 * Y2 * Y2 <= 0;
      if (inside && !inner) G.px(cx + i, cy + j, c);
    }
  };
  heart(x + 11, y + 12, PINK);
  G.px(x + 7, y + 9, PINK_C).px(x + 15, y + 9, PINK_C);
  // 矢印
  G.line(x + 5, y + 26, x + 16, y + 26, CYAN).line(x + 16, y + 26, x + 12, y + 22, CYAN).line(x + 16, y + 26, x + 12, y + 30, CYAN);
  for (let i = 0; i < 4; i++) G.px(x + 5 + i * 4, y + 36, i % 2 ? CYAN : PINK).px(x + 5 + i * 4, y + 38, i % 2 ? PINK : CYAN);
  // 壁への光のにじみ(ディザ)
  for (let j = -4; j < 48; j++) for (let i = -6; i < 28; i++) {
    const px = x + i, py = y + j;
    if (i >= -1 && i <= 22 && j >= -1 && j <= 44) continue;
    const d = Math.min(Math.abs(i < 0 ? i : i - 22), 6);
    if (dith(px, py) && d < 5 && hash(px, py, 11) > 0.35) {
      const c = G.get(px, py);
      if (c && c !== OUTLINE && c !== PINK) G.px(px, py, BRICK2[0]);
    }
  }
  // 腕金
  G.rect(x - 6, y + 6, 6, 2, METAL[2]).rect(x - 6, y + 36, 6, 2, METAL[2]);
}

function shutter(G: Wrap, x: number, y: number, w: number, h: number): void {
  G.rect(x - 2, y - 8, w + 4, 8, CONC[1]).rect(x - 2, y - 8, w + 4, 1, CONC[0]).outlineRect(x - 2, y - 8, w + 4, 8);
  // 店の看板の帯(文字はなし、色の帯)
  G.rect(x + 4, y - 6, w - 8, 4, BRICK[0]).rect(x + 4, y - 6, w - 8, 1, PINK_C);
  for (let i = 0; i < w - 8; i += 6) G.rect(x + 4 + i, y - 4, 3, 2, LIT_Y);
  for (let j = 0; j < h; j++) {
    const c = j % 3 === 0 ? METAL[2] : j % 3 === 1 ? METAL[0] : METAL[1];
    G.rect(x, y + j, w, 1, c);
  }
  G.outlineRect(x, y, w, h);
  G.rect(x + w / 2 - 3, y + h - 3, 6, 1, OUTLINE);
  // 落書き(文字でない形)
  const gx = x + 10, gy = y + 12;
  for (let i = 0; i < 18; i++) {
    const yy = gy + Math.round(Math.sin(i * 0.7) * 3);
    G.px(gx + i, yy, CYAN).px(gx + i, yy + 1, CYAN);
    if (i % 5 === 0) G.px(gx + i, yy + 2, PINK).px(gx + i, yy + 3, PINK);
  }
  for (let i = 0; i < 6; i++) G.px(gx + 22 + i, gy - 2 + i, PINK).px(gx + 27 - i, gy - 2 + i, PINK);
}

function fireEscape(G: Wrap, x: number, y: number): void {
  // 踊り場と手すりとはしご
  G.rect(x, y, 44, 2, METAL[2]).rect(x, y, 44, 1, METAL[1]).rect(x, y + 2, 44, 1, OUTLINE);
  G.rect(x, y - 10, 44, 1, METAL[2]);
  for (let i = 0; i <= 44; i += 4) G.rect(x + i, y - 10, 1, 10, METAL[2]);
  for (let j = 0; j < 30; j += 3) G.rect(x + 30, y + 3 + j, 7, 1, METAL[2]);
  G.rect(x + 30, y + 3, 1, 30, METAL[1]).rect(x + 36, y + 3, 1, 30, METAL[1]);
}

function waterTank(G: Wrap, x: number, y: number): void {
  // 屋上の給水塔(シルエット)
  const c = CONC[3];
  for (let j = 0; j < 16; j++) {
    const w = j < 4 ? 6 + j * 2 : 14;
    G.rect(x + 7 - w / 2, y + j, w, 1, c);
  }
  G.rect(x - 1, y + 16, 2, 8, c).rect(x + 13, y + 16, 2, 8, c).line(x, y + 16, x + 14, y + 23, c).line(x + 14, y + 16, x, y + 23, c);
  G.rect(x + 1, y + 6, 1, 8, CONC[2]);
}

export function drawWall(): PixelGrid {
  const W = 648, H = 130;
  const G = new Wrap(W, H);
  // --- 建物A(赤れんが、x 0〜150、屋上 y=16)---
  bricks(G, 0, 16, 150, H - 16, BRICK, 1);
  cornice(G, 0, 16, 150);
  window(G, 14, 28, true, 0); window(G, 58, 28, false, 0); window(G, 104, 28, true, 1);
  window(G, 14, 70, false, 1);
  door(G, 60, 88);
  acUnit(G, 108, 72);
  drainPipe(G, 140, 20, 124);
  // --- すき間(x 150〜170):空が見える ---
  G.rect(150, 58, 20, H - 58, CONC[3]);
  for (let y = 60; y < H; y += 6) G.rect(150, y, 20, 1, FAR_B[0]);
  G.line(150, 56, 170, 58, CONC[2]);
  // --- 建物B(コンクリート、高い、x 170〜392)---
  concrete(G, 170, 0, 222, H);
  G.rect(170, 0, 1, H, OUTLINE).rect(391, 0, 1, H, OUTLINE);
  window(G, 184, 8, true, 0); window(G, 226, 8, false, 1); window(G, 334, 8, true, 1);
  window(G, 184, 52, false, 0); window(G, 334, 52, true, 0);
  acUnit(G, 188, 42); acUnit(G, 338, 86);
  neonHeart(G, 276, 22);
  fireEscape(G, 216, 46);
  shutter(G, 296, 90, 52, 34);
  drainPipe(G, 372, 0, 124);
  // --- すき間(x 392〜420):電線 ---
  G.rect(392, 44, 28, H - 44, CONC[3]);
  for (let y = 46; y < H; y += 5) G.rect(392, y, 28, 1, FAR_B[0]);
  G.rect(392, 44, 28, 1, CONC[2]);
  for (let i = 0; i < 28; i++) {
    G.px(392 + i, 20 + Math.round(Math.sin((i / 27) * Math.PI) * 4), OUTLINE);
    G.px(392 + i, 28 + Math.round(Math.sin((i / 27) * Math.PI) * 3), OUTLINE);
  }
  // --- 建物C(紫がかったれんが、x 420〜648、屋上 y=26)---
  bricks(G, 420, 26, 228, H - 26, BRICK2, 2);
  cornice(G, 420, 26, 228);
  waterTank(G, 470, 2);
  window(G, 436, 38, true, 1); window(G, 482, 38, false, 0); window(G, 580, 38, true, 0);
  window(G, 436, 80, true, 0);
  drainPipe(G, 528, 30, 124);
  door(G, 548, 88);
  fireEscape(G, 574, 76);
  // 小さなネオン(星)
  const sx = 618, sy = 44;
  G.rect(sx - 8, sy - 8, 17, 17, BRICK[3]).outlineRect(sx - 8, sy - 8, 17, 17);
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, a2 = -Math.PI / 2 + ((i + 1) * Math.PI) / 5;
    const r = i % 2 ? 2.4 : 6, r2 = (i + 1) % 2 ? 2.4 : 6;
    if (i < 10) G.line(sx + Math.cos(a) * r, sy + Math.sin(a) * r, sx + Math.cos(a2) * r2, sy + Math.sin(a2) * r2, CYAN);
  }
  G.px(sx, sy, STAR);
  // 壁のすそ(地面に隠れる)
  G.rect(0, H - 6, W, 6, OUTLINE);
  return G.g;
}

// =====================================================================
// 地面 648×90(y=124〜214に置く)
// =====================================================================
export function drawGround(): PixelGrid {
  const W = 648, H = 90;
  const G = new Wrap(W, H);
  // 壁ぎわの影
  G.rect(0, 0, W, 6, OUTLINE);
  G.dither(0, 6, W, 1, OUTLINE, CONC[3]);
  // 歩道(奥)
  const walkTop = 7, walkBot = 22;
  for (let y = walkTop; y < walkBot; y++) for (let x = 0; x < W; x++) {
    let c = CONC[1];
    if (hash(x, y, 21) > 0.9) c = CONC[2];
    else if (hash(x, y, 22) > 0.95) c = CONC[0];
    G.px(x, y, c);
  }
  G.rect(0, walkTop, W, 1, CONC[2]);
  G.rect(0, 14, W, 1, CONC[2]);
  // 継ぎ目(手前に向かって斜めに広がる)
  for (let x = 0; x < W; x += 24) G.line(x, walkTop, x - 4, walkBot - 1, CONC[2]);
  // 縁石
  G.rect(0, walkBot, W, 2, CONC[0]).rect(0, walkBot + 2, W, 3, CONC[2]).rect(0, walkBot + 5, W, 1, OUTLINE);
  for (let x = 0; x < W; x += 32) G.rect(x, walkBot, 1, 5, CONC[2]);
  // 車道(アスファルト)。手前ほど線の間をあけ、ざらつきを増やす
  const roadTop = walkBot + 6;
  for (let y = roadTop; y < H; y++) {
    const t = (y - roadTop) / (H - roadTop);
    for (let x = 0; x < W; x++) {
      let c = ASPHALT[0];
      const r = hash(x, y, 31);
      if (t > 0.55 && dith(x, y) && r > 0.35) c = ASPHALT[1];
      else if (r > 0.97 - t * 0.04) c = ASPHALT[1];
      else if (r < 0.02 + t * 0.02) c = CONC[2];
      G.px(x, y, c);
    }
  }
  // 側溝の影
  G.dither(0, roadTop, W, 2, ASPHALT[1], ASPHALT[2]);
  // 奥から手前へ広がる、うっすらした横すじ
  let yy = roadTop + 5, step = 4;
  while (yy < H) {
    for (let x = 0; x < W; x += 2) if (hash(x, yy, 41) > 0.3) G.px(x + (yy % 2), yy, ASPHALT[1]);
    yy += step; step += 3;
  }
  // 排水の格子
  for (const gx of [40, 300, 520]) {
    G.rect(gx, roadTop, 18, 4, OUTLINE);
    for (let i = 1; i < 18; i += 3) G.rect(gx + i, roadTop, 1, 4, METAL[2]);
    G.rect(gx, roadTop - 1, 18, 1, METAL[1]);
  }
  // マンホール
  const manhole = (cx: number, cy: number) => {
    for (let j = -4; j <= 4; j++) for (let i = -15; i <= 15; i++) {
      const d = (i / 15) ** 2 + (j / 4.5) ** 2;
      if (d > 1) continue;
      let c = METAL[2];
      if (d > 0.72) c = OUTLINE;
      else if ((i + j * 3) % 4 === 0) c = CONC[3];
      else if (j < -1) c = METAL[1];
      G.px(cx + i, cy + j, c);
    }
  };
  manhole(180, 56);
  manhole(470, 70);
  // ネオンが映った水たまり
  const puddle = (cx: number, cy: number, rx: number, ry: number) => {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
      if ((i / rx) ** 2 + (j / ry) ** 2 > 1) continue;
      const px = cx + i, py = cy + j;
      let c = FAR_B[1];
      if (Math.abs(i - 4) < 3 && dith(px, py)) c = PINK;
      else if (Math.abs(i + 8) < 2 && dith(px, py)) c = CYAN;
      else if (j < -ry / 2 && dith(px, py)) c = SKY[3];
      G.px(px, py, c);
    }
    G.rect(cx - rx + 2, cy - ry - 1, rx * 2 - 4, 1, ASPHALT[1]);
  };
  puddle(292, 46, 18, 4);
  puddle(600, 78, 24, 5);
  // ひび
  const crack = (x: number, y: number, len: number, s: number) => {
    let cx = x, cy = y;
    for (let i = 0; i < len; i++) {
      G.px(cx, cy, ASPHALT[2]);
      cx += 1; cy += hash(i, s, 51) > 0.5 ? 1 : hash(i, s, 52) > 0.6 ? -1 : 0;
      if (cy < roadTop + 2) cy = roadTop + 2;
      if (cy >= H) break;
    }
  };
  crack(90, 44, 26, 1); crack(380, 60, 34, 2); crack(560, 40, 20, 3); crack(10, 72, 30, 4);
  // 落ちている物(紙くず、缶)
  G.rect(130, 36, 3, 2, STAR).px(130, 38, OUTLINE).px(133, 37, OUTLINE);
  G.rect(420, 82, 4, 2, BRICK[0]).px(420, 82, STAR);
  G.rect(250, 16, 3, 2, STAR_D);
  return G.g;
}
