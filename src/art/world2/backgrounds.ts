// 夜の地下駐車場の背景3枚。どれも左右の端がつながる(x は幅で折り返して描く)。
// 背景だけはディザ(市松模様)を使ってよい。3枚合わせて45色まで。文字は描かない。
import { md, OUTLINE, PixelGrid } from '../lib';

// ---------- 色(3枚で共通) ----------
/** コンクリート:明るい → 暗い */
const C = [md(5, 5, 6), md(4, 4, 5), md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)];
const DEEP = [md(0, 0, 1), md(1, 1, 2)];
const LIGHT = md(7, 7, 7), GLOW = md(5, 6, 6), GLOW2 = md(4, 5, 5);
const HAZ_Y = md(7, 6, 1), HAZ_YD = md(5, 4, 0);
const BAND = [md(2, 4, 6), md(1, 2, 4)];
const LINE_W = md(6, 6, 6);
const RED = md(7, 1, 1), RED_D = md(5, 1, 1);
const EXIT = md(1, 6, 3);
const PIPE = [md(5, 5, 6), md(4, 4, 5), md(3, 3, 4)];
const DOOR = [md(4, 4, 5), md(3, 3, 4), md(2, 2, 3)];

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
  get(x: number, y: number): string | null { return this.g.get(((Math.round(x) % this.w) + this.w) % this.w, Math.round(y)); }
  rect(x: number, y: number, w: number, h: number, c: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  dither(x: number, y: number, w: number, h: number, a: string, b: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, dith(x + i, y + j) ? a : b);
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    return this;
  }
  outlineRect(x: number, y: number, w: number, h: number, c = OUTLINE): this {
    this.rect(x - 1, y - 1, w + 2, 1, c).rect(x - 1, y + h, w + 2, 1, c).rect(x - 1, y, 1, h, c).rect(x + w, y, 1, h, c);
    return this;
  }
  /** すでに塗った色 from だけを to に変える */
  swap(x: number, y: number, w: number, h: number, from: string, to: string, pattern: (x: number, y: number) => boolean = () => true): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.get(x + i, y + j) === from && pattern(x + i, y + j)) this.px(x + i, y + j, to);
    return this;
  }
}

/** 右向きの矢印(塗り) */
function arrow(G: Wrap, x: number, y: number, len: number, t: number, c: string, dark: string): void {
  const head = t + 3;
  G.rect(x, y - Math.floor(t / 2), len - head, t, c);
  for (let i = 0; i <= head; i++) G.rect(x + len - head + i, y - (head - i), 1, (head - i) * 2 + 1, c);
  // 下のふちに影
  G.rect(x, y - Math.floor(t / 2) + t, len - head, 1, dark);
}

// =====================================================================
// 奥 216×214(透明なし)。隣の区画の暗い天井、遠くの柱、止めてある車の影
// =====================================================================
export function drawFar(): PixelGrid {
  const W = 216, H = 214;
  const G = new Wrap(W, H);
  // 天井
  G.rect(0, 0, W, 54, DEEP[0]);
  G.dither(0, 48, W, 6, DEEP[0], DEEP[1]);
  // 梁
  for (let x = 0; x < W; x += 54) G.rect(x + 20, 0, 10, 50, DEEP[1]).rect(x + 20, 48, 10, 2, C[4]);
  // 奥へ並ぶ蛍光灯(手前ほど長い)
  for (let x = 0; x < W; x += 27) { G.rect(x + 3, 36, 12, 1, LIGHT); G.rect(x + 3, 37, 12, 1, GLOW2); }
  for (let x = 13; x < W + 13; x += 27) G.rect(x, 44, 7, 1, GLOW);
  // 遠くの壁
  G.rect(0, 54, W, 160, C[4]);
  G.dither(0, 54, W, 4, DEEP[1], C[4]);
  // 蛍光灯の下の明るみ
  for (let x = 0; x < W; x += 27) G.swap(x, 54, 18, 12, C[4], C[3], (px, py) => dith(px, py) && py < 54 + 12 - Math.abs(px - x - 9) / 1.5);
  // 遠くの柱
  for (let x = 0; x < W; x += 54) {
    G.rect(x + 22, 50, 8, 60, C[3]).rect(x + 22, 50, 2, 60, C[2]);
    for (let y = 96; y < 110; y++) for (let i = 0; i < 8; i++) if (Math.floor((i + y) / 3) % 2) G.px(x + 22 + i, y, HAZ_YD);
  }
  // 壁の色の帯
  G.rect(0, 78, W, 3, BAND[1]);
  for (let x = 0; x < W; x += 54) G.rect(x + 22, 78, 8, 3, C[3]);
  // 止めてある車の影(赤い尾灯)
  const car = (x: number, w: number, tall: boolean) => {
    const top = tall ? 86 : 91;
    G.rect(x + 4, top, w - 10, 6, DEEP[1]).rect(x, top + 6, w, 12, DEEP[1]);
    G.rect(x + 6, top + 1, w - 14, 4, DEEP[0]);
    G.rect(x + 1, top + 6, w - 2, 1, C[3]);
    G.rect(x, top + 9, 2, 2, RED).rect(x + w - 2, top + 9, 2, 2, RED);
    G.rect(x + 4, top + 17, 6, 3, DEEP[0]).rect(x + w - 10, top + 17, 6, 3, DEEP[0]);
  };
  car(2, 30, false); car(60, 34, true); car(118, 30, false); car(168, 32, true);
  // 床
  G.rect(0, 110, W, 104, C[3]);
  G.dither(0, 108, W, 3, C[4], C[3]);
  for (let x = 0; x < W; x += 27) G.line(x, 111, x - 4, 124, C[2]);
  return G.g;
}

// =====================================================================
// 手前の壁 648×130。天井、梁、配管、蛍光灯、柱、矢印、非常口。奥が見える開口部は透明
// =====================================================================
const PILLARS = [70, 286, 502];
const LIGHTS = [16, 166, 232, 382, 448, 598];

export function drawWall(): PixelGrid {
  const W = 648, H = 130;
  const G = new Wrap(W, H);
  // 奥の壁(コンクリート)
  for (let y = 18; y < H; y++) for (let x = 0; x < W; x++) {
    let c = C[2];
    if (x % 36 === 0) c = C[3];
    else if (hash(x, y, 3) > 0.94) c = C[3];
    else if (hash(x >> 2, y >> 2, 4) > 0.82 && dith(x, y)) c = C[1];
    G.px(x, y, c);
  }
  G.rect(0, 60, W, 1, C[3]).rect(0, 61, W, 1, C[1]);
  // 下の塗り分けと色の帯
  G.rect(0, 86, W, 2, LINE_W).rect(0, 88, W, 7, BAND[0]).rect(0, 95, W, 1, BAND[1]);
  for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) G.px(x, y, y > 112 && dith(x, y) ? C[4] : C[3]);
  // 開口部(奥が見える)
  const opening = (x0: number, w: number) => {
    G.rect(x0, 34, w, 48, null);
    G.rect(x0 - 2, 30, w + 4, 4, C[1]).rect(x0 - 2, 30, w + 4, 1, C[0]).rect(x0 - 2, 33, w + 4, 1, OUTLINE);
    G.rect(x0 - 2, 82, w + 4, 4, C[1]).rect(x0 - 2, 82, w + 4, 1, C[0]).rect(x0 - 2, 85, w + 4, 1, C[3]);
    G.rect(x0 - 1, 34, 1, 48, OUTLINE).rect(x0 + w, 34, 1, 48, OUTLINE);
    // 手すりの柱
    for (let x = x0 + 22; x < x0 + w - 4; x += 30) G.rect(x, 34, 3, 48, C[3]).rect(x, 34, 1, 48, C[2]).px(x + 3, 60, OUTLINE);
  };
  opening(110, 146);
  opening(546, 88);
  // 壁の矢印(進む向き)
  arrow(G, 330, 72, 34, 6, HAZ_Y, HAZ_YD);
  arrow(G, 420, 72, 34, 6, HAZ_Y, HAZ_YD);
  arrow(G, 16, 72, 34, 6, LINE_W, C[3]);
  // 非常口の扉と、上の緑の灯り(絵だけ)
  const dx = 392;
  G.rect(dx - 2, 98, 30, 26, C[1]).outlineRect(dx, 100, 26, 26).rect(dx, 100, 26, 26, DOOR[1]);
  G.rect(dx, 100, 1, 26, DOOR[0]).rect(dx + 25, 100, 1, 26, DOOR[2]).rect(dx + 12, 100, 1, 26, DOOR[2]);
  G.rect(dx + 8, 112, 3, 1, OUTLINE).rect(dx + 15, 112, 3, 1, OUTLINE);
  G.rect(dx + 5, 64, 16, 8, EXIT).outlineRect(dx + 5, 64, 16, 8);
  // 走る人の形と矢印
  G.px(dx + 9, 65, LIGHT).rect(dx + 8, 66, 2, 3, LIGHT).px(dx + 7, 67, LIGHT).px(dx + 10, 67, LIGHT).px(dx + 7, 70, LIGHT).px(dx + 10, 69, LIGHT).px(dx + 11, 70, LIGHT);
  G.rect(dx + 13, 67, 5, 1, LIGHT).px(dx + 16, 66, LIGHT).px(dx + 16, 68, LIGHT);
  G.swap(dx + 2, 60, 22, 16, C[2], C[1], (x, y) => dith(x, y));
  // 柱(手前)。下にしま模様、番号の板(文字なし)
  for (const px of PILLARS) {
    const w = 26;
    G.rect(px, 14, w, H - 14, C[1]).rect(px, 14, 3, H - 14, C[0]).rect(px + w - 5, 14, 5, H - 14, C[2]).rect(px + w - 1, 14, 1, H - 14, C[3]);
    G.rect(px - 1, 14, 1, H - 14, OUTLINE).rect(px + w, 14, 1, H - 14, OUTLINE);
    G.rect(px + 7, 44, 12, 12, LIGHT).rect(px + 8, 45, 10, 10, BAND[0]).rect(px + 10, 48, 6, 1, LIGHT).rect(px + 10, 52, 6, 1, LIGHT);
    for (let y = 100; y < 124; y++) for (let i = 0; i < w; i++) G.px(px + i, y, Math.floor((i - y + 300) / 4) % 2 ? (i > w - 5 ? HAZ_YD : HAZ_Y) : OUTLINE);
    G.rect(px, 99, w, 1, OUTLINE);
    // 角のすり傷
    G.px(px + 1, 70, C[3]).px(px + 2, 71, C[3]).px(px + 1, 88, C[2]);
  }
  // 天井と梁
  G.rect(0, 0, W, 16, C[4]).rect(0, 16, W, 1, C[3]).rect(0, 17, W, 1, OUTLINE);
  for (let x = 0; x < W; x += 36) G.rect(x, 0, 1, 16, DEEP[1]);
  for (const px of PILLARS) {
    G.rect(px - 14, 0, 54, 22, C[3]).rect(px - 14, 20, 54, 2, C[2]).rect(px - 14, 22, 54, 1, OUTLINE);
    G.rect(px - 14, 0, 2, 22, C[2]);
  }
  // 配管(太い管と赤い細い管)
  G.rect(0, 5, W, 5, PIPE[1]).rect(0, 5, W, 1, PIPE[0]).rect(0, 9, W, 1, PIPE[2]).rect(0, 10, W, 1, OUTLINE).rect(0, 4, W, 1, OUTLINE);
  for (let x = 20; x < W; x += 72) G.rect(x, 4, 3, 7, PIPE[2]).rect(x, 4, 1, 7, PIPE[0]);
  G.rect(0, 13, W, 2, RED_D).rect(0, 13, W, 1, RED);
  for (let x = 50; x < W; x += 108) G.rect(x, 15, 1, 3, RED_D).rect(x - 1, 18, 3, 1, PIPE[1]);
  // 蛍光灯と、その下の明かり
  for (const lx of LIGHTS) {
    G.rect(lx + 12, 18, 1, 6, C[3]).rect(lx + 22, 18, 1, 6, C[3]);
    G.rect(lx + 6, 24, 24, 3, C[1]).rect(lx + 6, 24, 24, 1, C[0]).outlineRect(lx + 6, 24, 24, 3);
    G.rect(lx + 7, 27, 22, 2, LIGHT).rect(lx + 7, 29, 22, 1, GLOW);
    for (let j = 0; j < 30; j++) for (let i = -10; i < 46; i++) {
      const x = lx + i, y = 31 + j;
      if (Math.abs(i - 18) > 26 - j * 0.6) continue;
      const c = G.get(x, y);
      if (c === C[2] && dith(x, y) && j < 22) G.px(x, y, C[1]);
      else if (c === C[3] && dith(x, y)) G.px(x, y, C[2]);
    }
  }
  // 監視カメラ
  for (const cx of [250, 612]) {
    G.rect(cx, 18, 2, 4, C[3]).rect(cx - 3, 22, 8, 4, C[1]).rect(cx - 3, 22, 8, 1, C[0]).outlineRect(cx - 3, 22, 8, 4);
    G.px(cx + 4, 24, RED);
  }
  // 壁のすそ(床に隠れる)
  G.rect(0, H - 6, W, 6, OUTLINE);
  return G.g;
}

// =====================================================================
// 床 648×90(y=124〜214に置く)。駐車の白線、車止め、走る道の矢印、油じみ
// =====================================================================
export function drawGround(): PixelGrid {
  const W = 648, H = 90;
  const G = new Wrap(W, H);
  // 壁ぎわの影
  G.rect(0, 0, W, 6, OUTLINE);
  G.dither(0, 6, W, 1, OUTLINE, C[4]);
  // 壁ぞいの縁石(黄色いふち)
  G.rect(0, 7, W, 3, C[2]).rect(0, 7, W, 1, C[1]);
  G.rect(0, 10, W, 2, HAZ_Y).rect(0, 12, W, 1, HAZ_YD).rect(0, 13, W, 1, OUTLINE);
  for (let x = 0; x < W; x += 24) G.rect(x, 10, 1, 3, HAZ_YD);
  // 床のコンクリート。手前ほどざらつく
  for (let y = 14; y < H; y++) {
    const t = (y - 14) / (H - 14);
    for (let x = 0; x < W; x++) {
      let c = C[3];
      const r = hash(x, y, 7);
      if (r > 0.97 - t * 0.03) c = C[4];
      else if (r < 0.03) c = C[2];
      G.px(x, y, c);
    }
  }
  G.dither(0, 14, W, 2, C[4], C[3]);
  // 蛍光灯の下の明るみ(壁の灯りの位置にそろえる)
  for (const lx of LIGHTS) {
    const cx = lx + 18;
    for (let j = 0; j < 40; j++) for (let i = -40; i <= 40; i++) {
      const x = cx + i, y = 18 + j;
      if ((i / 40) ** 2 + ((j - 18) / 20) ** 2 > 1) continue;
      if (G.get(x, y) === C[3] && dith(x, y)) G.px(x, y, C[2]);
    }
  }
  // 駐車の区画:奥から手前へ斜めに広がる白線と車止め
  const bayTop = 16, bayBot = 50;
  for (let x = 0; x < W; x += 54) {
    G.line(x, bayTop, x - 9, bayBot, LINE_W);
    G.line(x + 1, bayTop, x - 8, bayBot, LINE_W);
    // 車止め
    const sx = x + 18;
    G.rect(sx, 18, 16, 3, C[1]).rect(sx, 18, 16, 1, C[0]).outlineRect(sx, 18, 16, 3);
    G.rect(sx + 3, 18, 3, 1, HAZ_Y).rect(sx + 10, 18, 3, 1, HAZ_Y);
  }
  G.rect(0, bayBot, W, 2, LINE_W);
  // 走る道の中央の破線と、床の矢印
  for (let x = 0; x < W; x += 24) G.rect(x, 70, 12, 2, HAZ_Y).rect(x, 72, 12, 1, HAZ_YD);
  for (const ax of [60, 276, 492]) arrow(G, ax, 61, 40, 3, LINE_W, C[4]);
  // 油じみ
  const stain = (cx: number, cy: number, rx: number, ry: number) => {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
      const d = (i / rx) ** 2 + (j / ry) ** 2;
      if (d > 1) continue;
      if (d < 0.5 || dith(cx + i, cy + j)) G.px(cx + i, cy + j, C[4]);
    }
  };
  stain(40, 34, 12, 4); stain(150, 40, 9, 3); stain(350, 30, 14, 4); stain(560, 42, 10, 3); stain(430, 80, 16, 4);
  // 排水の溝
  for (const gx of [200, 520]) {
    G.rect(gx, 78, 30, 4, OUTLINE);
    for (let i = 1; i < 30; i += 3) G.rect(gx + i, 78, 1, 4, C[2]);
    G.rect(gx, 77, 30, 1, C[1]);
  }
  // タイヤのあと
  for (let x = 0; x < W; x += 2) { if (hash(x, 1, 9) > 0.4) G.px(x, 84 + (x % 3 === 0 ? 1 : 0), C[4]); if (hash(x, 2, 9) > 0.5) G.px(x + 1, 58, C[4]); }
  return G.g;
}
