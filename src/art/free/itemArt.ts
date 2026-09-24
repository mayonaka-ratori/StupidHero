// 波3の小物(風船、とんがり帽子、大きな紙袋)の絵と、ルールの札の絵(16×16)。
// 小物は人の絵に重ねる別の絵。付ける場所は items.ts の表で決める。
// 色は、赤(ヒーローの光)、水色(ヒーローの光)、赤紫(ステージ2の塗り替え)、黄緑(宇宙人のくずれ)を使わない。
// 形も、今の人の絵にある帽子(警備員、ダンスの学生)、サングラス、買い物袋とまぎれないようにする。
import { md, OUTLINE, PixelGrid } from '../lib';
import { SKIN } from '../world/palette';
import type { Ramp } from '../world/pix';

/** 風船の黄色と、ひも(明るい灰色。暗い背景でも見える) */
export const BALLOON: Ramp = [md(7, 7, 4), md(7, 6, 1), md(6, 4, 0)];
const STRING = md(5, 5, 6);
const W = md(7, 7, 7);
/** とんがり帽子の濃い緑(宇宙人の肌の緑より暗くする) */
export const HAT: Ramp = [md(1, 5, 2), md(0, 3, 1), md(0, 2, 1)];
/** 紙袋の茶色(クラフト紙) */
export const PAPER: Ramp = [md(6, 5, 3), md(5, 3, 2), md(3, 2, 1)];
/** ヒーローの手袋の赤(拳の札だけに使う) */
const GLOVE: Ramp = [md(7, 2, 1), md(5, 0, 1), md(3, 0, 1)];
/** 手のひらの札の、手を振る線(水色) */
const WAVE = md(3, 7, 7);

const grid = (w: number, h: number, draw: (g: PixelGrid) => void): PixelGrid => {
  const g = new PixelGrid(w, h);
  draw(g);
  return g;
};

/** src の塗ってあるところを dst に重ねる */
function over(dst: PixelGrid, src: PixelGrid, ox = 0, oy = 0): void {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const c = src.cells[y][x];
    if (c) dst.px(x + ox, y + oy, c);
  }
}

/** 風船の玉(ふち取りつき)。(cx, cy) は玉の真ん中。結び目の下の端の y を返す */
function balloonBody(g: PixelGrid, cx: number, cy: number, rx: number, ry: number): number {
  const b = new PixelGrid(g.w, g.h);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    // 左上から光。右下が影
    const t = nx * 0.6 + ny * 0.8;
    b.px(x, y, t < -0.45 ? BALLOON[0] : t > 0.45 ? BALLOON[2] : BALLOON[1]);
  }
  // 結び目(小さな三角)
  const ky = Math.round(cy + ry);
  const kx = Math.floor(cx);
  b.px(kx, ky, BALLOON[2]).px(kx - 1, ky + 1, BALLOON[2]).px(kx, ky + 1, BALLOON[1]).px(kx + 1, ky + 1, BALLOON[2]);
  // 光
  const hx = Math.floor(cx - rx * 0.45), hy = Math.floor(cy - ry * 0.5);
  b.px(hx, hy, W).px(hx, hy + 1, W).px(hx + 1, hy - 1, W);
  b.outline();
  over(g, b);
  return ky + 2;
}

/**
 * 風船 32×48 の2コマ(ゆれる)。ひもの下の端はコマの下の真ん中(16, 47)で、手に持つところ。
 * 玉はそこから左上(人の頭の上の、後ろ寄り)に浮かぶ。右向きの人に合わせてあり、左向きは絵ごと反転する
 */
export function drawBalloonFrames(): PixelGrid[] {
  return [0, 1].map((i) => grid(32, 48, (g) => {
    const cx = 7.5 + i, cy = 8.5 - i;
    const top = balloonBody(g, cx, cy, 6, 7.3);
    // ひも:結び目から手まで。ゆるく曲がり、コマごとに曲がる向きを変える
    const x0 = Math.floor(cx), x1 = 16, y1 = 47;
    for (let y = top; y <= y1; y++) {
      const t = (y - top) / (y1 - top);
      const bend = Math.sin(t * Math.PI) * (i ? -1.6 : 1.6);
      g.px(Math.round(x0 + (x1 - x0) * t * t * 0.4 + (x1 - x0) * t * 0.6 + bend), y, STRING);
    }
    g.px(x1, y1, STRING);
  }));
}

/** とんがり帽子。広いほうの下の端が baseY、高さは tall ドット。真ん中は x=8(16ドット幅の絵) */
function hatInto(g: PixelGrid, baseY: number, tall: number): void {
  const h = new PixelGrid(g.w, g.h);
  const apex = baseY - tall;
  for (let y = apex; y <= baseY; y++) {
    const hw = 0.6 + (y - apex) * (5.6 / tall);
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      if (Math.abs(dx) > hw) continue;
      // ななめのしま(白)と、左が明るく右が暗い
      const stripe = ((x - y * 0.8 + 40) % 5) < 1.4 && y > apex + 2 && y < baseY;
      const t = dx / Math.max(1, hw);
      h.px(x, y, stripe ? W : t < -0.4 ? HAT[0] : t > 0.45 ? HAT[2] : HAT[1]);
    }
  }
  // 下の縁(ゴムの見えるところ)は暗く
  for (let x = 0; x < 16; x++) if (h.get(x, baseY)) h.px(x, baseY, HAT[2]);
  // てっぺんのぽんぽん(白)
  const py = apex - 1;
  h.rect(7, py - 1, 2, 3, W).px(6, py, W).px(9, py, W).px(8, py + 1, md(5, 5, 6)).px(9, py, md(5, 5, 6));
  h.outline();
  over(g, h);
}

/** とんがり帽子 16×20(帽子は14×15と、てっぺんのぽんぽん)。下の縁がコマの下の段(y=19)。頭のてっぺんに下の真ん中を合わせる */
export const drawHat = (): PixelGrid => grid(16, 20, (g) => hatInto(g, 19, 15));

/** 大きな紙袋。持ち手のてっぺんが (8, topY)。袋は 11×11 */
function bagInto(g: PixelGrid, topY: number): void {
  const b = new PixelGrid(g.w, g.h);
  const y0 = topY + 4;
  // 袋:左の面が正面(明るい)、右の3列が横のまち(暗い)
  for (let y = y0; y <= y0 + 10; y++) for (let x = 3; x <= 13; x++) {
    const side = x >= 11;
    b.px(x, y, side ? PAPER[2] : x <= 4 ? PAPER[0] : PAPER[1]);
  }
  // 口の折り返し(明るい帯と、ぎざぎざの切り口)
  for (let x = 3; x <= 13; x++) b.px(x, y0 + 1, x >= 11 ? PAPER[1] : PAPER[0]);
  for (let x = 3; x <= 13; x += 2) b.px(x, y0, null);
  // 横のまちの折り目と、底の折り目
  for (let y = y0 + 2; y <= y0 + 10; y++) b.px(11, y, PAPER[1]);
  for (let x = 4; x <= 10; x++) b.px(x, y0 + 9, PAPER[2]);
  b.px(12, y0 + 6, PAPER[1]);
  // ねじった紙の持ち手(輪)
  for (let x = 6; x <= 10; x++) b.px(x, topY, PAPER[2]);
  for (let y = topY + 1; y < y0; y++) b.px(5, y, PAPER[2]).px(11, y, PAPER[2]);
  b.outline();
  over(g, b);
}

/** 紙袋 16×16。持ち手のてっぺんがコマの上の真ん中(8, 0)。そこを手に合わせる */
export const drawBag = (): PixelGrid => grid(16, 16, (g) => bagInto(g, 0));

// ---------------------------------------------------------------------
// ルールの札の絵(16×16)。字が読めなくても分かるように、形だけで見分ける
// ---------------------------------------------------------------------

/** 手で打つ小さな絵 */
function stampRows(g: PixelGrid, rows: string[], keys: Record<string, string>, ox = 0, oy = 0): void {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const c = keys[r[x]];
      if (c) g.px(x + ox, y + oy, c);
    }
  });
}

/** 拳(ヒーローの赤い手袋。指のつけ根を上にしてにぎる)。殴りかかる */
export const drawFistIcon = (): PixelGrid => grid(16, 16, (g) => {
  stampRows(g, [
    '................',
    '...oooooooooo...',
    '..o0o00o01o12o..',
    '..o0o01o11o12o..',
    '..o1o11o11o22o..',
    '.oo0o11o11o22o..',
    'o000oo1oo1oo2o..',
    'o00001111o122o..',
    'o01111111o122o..',
    '.o111111o1222o..',
    '..o1111111222o..',
    '..o112222222o...',
    '...owwwwwwwo....',
    '...owwwwwwwo....',
    '...oooooooooo...',
    '................'
  ], { o: OUTLINE, '0': GLOVE[0], '1': GLOVE[1], '2': GLOVE[2], w: W });
});

/** 手のひら(指を開いて見せる)と、手を振る線。素通りする */
export const drawPalmIcon = (): PixelGrid => grid(16, 16, (g) => {
  stampRows(g, [
    '.....o..o.......',
    '....o0oo0o.o....',
    '..o.o0oo0oo0o...',
    '.o0oo0oo0oo0o...',
    '.o0oo0oo0oo0o.o.',
    '.o0oo0oo0oo0oo0o',
    '.o0oo00o00o0o01o',
    '.o000000000001o.',
    '.o00000000011o..',
    '..o0000000011o..',
    '..o0000000111o..',
    '...o00000111o...',
    '...o11111112o...',
    '....oooooooo....',
    '................',
    '................'
  ], { o: OUTLINE, '0': SKIN[0], '1': SKIN[1], '2': SKIN[2] });
  // 手を振る線(左右に2本ずつ)
  g.px(0, 9, WAVE).px(0, 10, WAVE).px(15, 1, WAVE).px(15, 2, WAVE).px(14, 0, WAVE);
});

/** 風船の札 */
export const drawBalloonIcon = (): PixelGrid => grid(16, 16, (g) => {
  const top = balloonBody(g, 8, 5.2, 4.3, 4.8);
  for (let y = top; y < 16; y++) g.px(8 + ((y - top) % 4 === 1 ? 1 : (y - top) % 4 === 3 ? -1 : 0), y, STRING);
});

/** 帽子の札(下の縁を1段上げて、下にもふちを付ける) */
export const drawHatIcon = (): PixelGrid => grid(16, 16, (g) => hatInto(g, 14, 11));

/** 紙袋の札(小物の紙袋と同じ絵) */
export const drawBagIcon = (): PixelGrid => grid(16, 16, (g) => bagInto(g, 0));
