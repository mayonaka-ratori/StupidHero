// 形を塗る小さな道具(顔のカットインとエフェクトで使う)。
// どれもドットの真ん中が形の中に入るかで決める(ぼかしなし)。
import type { PixelGrid } from '../lib';

export type Pt = readonly [number, number];
export type ColorAt = string | null | ((x: number, y: number) => string | null);

const pick = (c: ColorAt, x: number, y: number): string | null => (typeof c === 'function' ? c(x, y) : c);

export function fillWhere(g: PixelGrid, inside: (px: number, py: number) => boolean, c: ColorAt, bounds?: [number, number, number, number]): void {
  const [x0, y0, x1, y1] = bounds ?? [0, 0, g.w - 1, g.h - 1];
  for (let y = Math.max(0, y0); y <= Math.min(g.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(g.w - 1, x1); x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const col = pick(c, x, y);
    if (col !== null) g.cells[y][x] = col;
  }
}

export function ellipse(g: PixelGrid, cx: number, cy: number, rx: number, ry: number, c: ColorAt): void {
  fillWhere(g, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, c,
    [Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(cy + ry + 1)]);
}

function insidePoly(pts: readonly Pt[], px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function poly(g: PixelGrid, pts: readonly Pt[], c: ColorAt): void {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  fillWhere(g, (px, py) => insidePoly(pts, px, py), c,
    [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys))]);
}

/** 太さ r の線(端は丸い) */
export function line(g: PixelGrid, a: Pt, b: Pt, r: number, c: ColorAt): void {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1e-6;
  fillWhere(g, (px, py) => {
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
    return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t)) <= r;
  }, c, [Math.floor(Math.min(a[0], b[0]) - r - 1), Math.floor(Math.min(a[1], b[1]) - r - 1), Math.ceil(Math.max(a[0], b[0]) + r + 1), Math.ceil(Math.max(a[1], b[1]) + r + 1)]);
}

/** 1ドット幅の線(ブレゼンハム) */
export function line1(g: PixelGrid, x0: number, y0: number, x1: number, y1: number, c: string): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** 決まった乱数(毎回同じ絵になるように) */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
