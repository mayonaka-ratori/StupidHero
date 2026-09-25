// 人物や物を描くための小さな道具(担当:worldSet)。
// Mask で形を作り、Painter で「ふち+3段の影」を付けて PixelGrid に塗る。
import { OUTLINE, PixelGrid } from '../lib';

export type Pt = [number, number];
/** 明るい、ふつう、暗い の3段 */
export type Ramp = [string, string, string];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const add = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];
export const mix = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** 塗る範囲。ドットの真ん中 (x, y) が図形に入れば塗る。 */
export class Mask {
  readonly w: number;
  readonly h: number;
  readonly d: Uint8Array;
  /** 塗ったことのあるドットを囲む範囲(消しても縮めない)。each などはこの中だけを見る */
  private bx0: number; private by0: number; private bx1 = -1; private by1 = -1;
  constructor(w: number, h: number) {
    this.w = w; this.h = h; this.d = new Uint8Array(w * h);
    this.bx0 = w; this.by0 = h;
  }
  private grow(x0: number, y0: number, x1: number, y1: number): void {
    if (x0 < this.bx0) this.bx0 = x0;
    if (y0 < this.by0) this.by0 = y0;
    if (x1 > this.bx1) this.bx1 = x1;
    if (y1 > this.by1) this.by1 = y1;
  }
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] === 1;
  }
  set(x: number, y: number, v = true): this {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
      this.d[y * this.w + x] = v ? 1 : 0;
      if (v) this.grow(x, y, x, y);
    }
    return this;
  }
  rect(x: number, y: number, w: number, h: number, v = true): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v);
    return this;
  }
  /** 太さが変わる線(r1 から r2 へ) */
  capsule(a: Pt, b: Pt, r1: number, r2 = r1, v = true): this {
    const [ax, ay] = a, [bx, by] = b;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    const r = Math.max(r1, r2) + 1;
    const x0 = Math.floor(Math.min(ax, bx) - r), x1 = Math.ceil(Math.max(ax, bx) + r);
    const y0 = Math.floor(Math.min(ay, by) - r), y1 = Math.ceil(Math.max(ay, by) + r);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let t = ((x - ax) * dx + (y - ay) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, py = ay + dy * t;
      const rr = lerp(r1, r2, t);
      if ((x - px) ** 2 + (y - py) ** 2 <= rr * rr + 0.15) this.set(x, y, v);
    }
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, v = true): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1.05) this.set(x, y, v);
      }
    return this;
  }
  poly(pts: Pt[], v = true): this {
    const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
    const cross: number[] = [];
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      // この行で辺と交わる x を集める(inPoly と同じ式)。x より右の交点が奇数個なら中
      cross.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y)) cross.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
      if (!cross.length) continue;
      cross.sort((a, b) => a - b);
      let k = 0;
      for (let x = x0; x <= x1; x++) {
        while (k < cross.length && cross[k] <= x) k++;
        if ((cross.length - k) % 2 === 1) this.set(x, y, v);
      }
    }
    return this;
  }
  union(m: Mask): this {
    for (let i = 0; i < this.d.length; i++) if (m.d[i]) this.d[i] = 1;
    this.grow(m.bx0, m.by0, m.bx1, m.by1);
    return this;
  }
  subtract(m: Mask): this {
    for (let i = 0; i < this.d.length; i++) if (m.d[i]) this.d[i] = 0;
    return this;
  }
  intersect(m: Mask): this {
    for (let i = 0; i < this.d.length; i++) if (!m.d[i]) this.d[i] = 0;
    return this;
  }
  clone(): Mask {
    const m = new Mask(this.w, this.h);
    m.d.set(this.d);
    m.grow(this.bx0, this.by0, this.bx1, this.by1);
    return m;
  }
  empty(): boolean {
    for (let y = this.by0; y <= this.by1; y++) for (let x = this.bx0; x <= this.bx1; x++) if (this.d[y * this.w + x]) return false;
    return true;
  }
  each(fn: (x: number, y: number) => void): void {
    for (let y = this.by0; y <= this.by1; y++) for (let x = this.bx0; x <= this.bx1; x++) if (this.d[y * this.w + x]) fn(x, y);
  }
}

export interface FillOpts {
  /** 前に塗った物との境目: ふち色の線、ramp の暗い色の線、線なし */
  sep?: 'outline' | 'dark' | 'none';
  /** 明るくする割合(左上から)。0で明るい色を使わない */
  hi?: number;
  /** 暗くする割合(右下から) */
  lo?: number;
  /** 影を付けずに1色で塗る */
  flat?: boolean;
  /** 影の段の境目に出る、ぽつんと1つだけのドットをまわりの段にそろえる */
  clean?: boolean;
}

/** 段(0,1,2)の表から、ぽつんと浮いたドットをなくす。まわり4つのうち3つ以上が同じ段なら、それにそろえる */
function cleanTones(m: Mask, tone: Map<number, number>): void {
  for (let pass = 0; pass < 2; pass++) {
    const fix: [number, number][] = [];
    m.each((x, y) => {
      const t = tone.get(y * m.w + x)!;
      const cnt = [0, 0, 0];
      let n = 0, same = 0;
      for (const [dx, dy] of NB4) {
        const u = tone.get((y + dy) * m.w + x + dx);
        if (u === undefined || !m.has(x + dx, y + dy)) continue;
        n++; cnt[u]++;
        if (u === t) same++;
      }
      if (n < 2 || same > 1) return;
      const best = cnt.indexOf(Math.max(...cnt));
      if (best !== t && cnt[best] >= Math.min(3, n)) fix.push([y * m.w + x, best]);
      else if (same === 0 && best !== t && cnt[best] >= 2) fix.push([y * m.w + x, best]);
    });
    for (const [i, t] of fix) tone.set(i, t);
    if (!fix.length) break;
  }
}

/** 形の中の位置から 0(左上)〜1(右下)の値を出す。細い方向の断面で決める。 */
export function shadeT(m: Mask, x: number, y: number): number {
  let l = 0, r = 0, u = 0, d = 0;
  while (m.has(x - l - 1, y)) l++;
  while (m.has(x + r + 1, y)) r++;
  while (m.has(x, y - u - 1)) u++;
  while (m.has(x, y + d + 1)) d++;
  const sh = l + r + 1, sv = u + d + 1;
  const th = (l + 0.5) / sh, tv = (u + 0.5) / sv;
  const wh = sv / (sh + sv);
  return wh * th + (1 - wh) * tv;
}

const NB4: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 塗った順に重ねていく絵。 */
export class Painter {
  readonly g: PixelGrid;
  constructor(w: number, h: number) {
    this.g = new PixelGrid(w, h);
  }
  get w(): number { return this.g.w; }
  get h(): number { return this.g.h; }
  mask(): Mask { return new Mask(this.g.w, this.g.h); }

  /** 形を影つきで塗る */
  fill(m: Mask, ramp: Ramp | string, o: FillOpts = {}): this {
    const sep = o.sep ?? 'outline';
    const rp: Ramp = typeof ramp === 'string' ? [ramp, ramp, ramp] : ramp;
    if (sep !== 'none') {
      const c = sep === 'outline' ? OUTLINE : rp[2];
      const edge: Pt[] = [];
      m.each((x, y) => {
        for (const [dx, dy] of NB4) {
          const nx = x + dx, ny = y + dy;
          if (!m.has(nx, ny) && this.g.get(nx, ny)) edge.push([nx, ny]);
        }
      });
      for (const [x, y] of edge) this.g.px(x, y, c);
    }
    const hi = o.hi ?? 0.3, lo = o.lo ?? 0.66;
    if (o.flat || typeof ramp === 'string') {
      m.each((x, y) => this.g.px(x, y, rp[1]));
      return this;
    }
    const tone = new Map<number, number>();
    m.each((x, y) => {
      const t = shadeT(m, x, y);
      tone.set(y * m.w + x, t < hi ? 0 : t > lo ? 2 : 1);
    });
    if (o.clean) cleanTones(m, tone);
    m.each((x, y) => this.g.px(x, y, rp[tone.get(y * m.w + x)!]));
    return this;
  }
  px(x: number, y: number, c: string | null): this { this.g.px(x, y, c); return this; }
  rect(x: number, y: number, w: number, h: number, c: string | null): this { this.g.rect(x, y, w, h, c); return this; }
  /** 塗ってあるところだけ色を変える */
  recolor(m: Mask, c: string): this {
    m.each((x, y) => { if (this.g.get(x, y)) this.g.px(x, y, c); });
    return this;
  }
  /** 線(1ドット) */
  line(a: Pt, b: Pt, c: string): this {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let i = 0; i <= n; i++) this.g.px(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n), c);
    return this;
  }
  /** 外まわりのふち */
  outline(): this { this.g.outline(); return this; }
  /** 別の格子を (ox, oy) に重ねる。sep を付けると境目に線を入れる */
  blit(src: PixelGrid, ox: number, oy: number, sep: 'outline' | 'none' = 'none'): this {
    if (sep === 'outline') {
      const m = this.mask();
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.cells[y][x]) m.set(ox + x, oy + y);
      this.fill(m, OUTLINE, { sep: 'outline', flat: true });
    }
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.cells[y][x];
      if (c) this.g.px(ox + x, oy + y, c);
    }
    return this;
  }
}

/** 塗ってあるところの外枠 */
export function bbox(g: PixelGrid): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

/** 格子をずらしたコピー */
export function shifted(g: PixelGrid, dx: number, dy: number, w = g.w, h = g.h): PixelGrid {
  const o = new PixelGrid(w, h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) o.px(x + dx, y + dy, g.cells[y][x]);
  return o;
}

/** Scale2x(ドット絵向けの2倍拡大) */
function scale2x(g: PixelGrid): PixelGrid {
  const o = new PixelGrid(g.w * 2, g.h * 2);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const P = g.get(x, y), A = g.get(x, y - 1), B = g.get(x + 1, y), C = g.get(x - 1, y), D = g.get(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C !== B && A !== D) {
      if (C === A) e0 = A;
      if (A === B) e1 = B;
      if (D === C) e2 = C;
      if (B === D) e3 = D;
    }
    o.cells[y * 2][x * 2] = e0; o.cells[y * 2][x * 2 + 1] = e1;
    o.cells[y * 2 + 1][x * 2] = e2; o.cells[y * 2 + 1][x * 2 + 1] = e3;
  }
  return o;
}

/**
 * ドット絵を回す(RotSprite のまねごと)。Scale2x で8倍にしてから回して、真ん中を拾う。
 * 回す中心 (px, py) は、出来上がりで (qx, qy) に来る。angle はラジアン(正で時計回り)。
 */
export function rotateGrid(g: PixelGrid, angle: number, px: number, py: number, qx: number, qy: number, w = g.w, h = g.h): PixelGrid {
  const k = Math.round((angle / (Math.PI / 2)) * 1000) / 1000;
  if (Number.isInteger(k)) return rotate90(g, ((k % 4) + 4) % 4, px, py, qx, qy, w, h);
  const S = 8;
  const big = scale2x(scale2x(scale2x(g)));
  const o = new PixelGrid(w, h);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // 出来上がりのドットの真ん中を、元の絵のどこから取るか
    const dx = x + 0.5 - (qx + 0.5), dy = y + 0.5 - (qy + 0.5);
    const sx = cos * dx + sin * dy + px + 0.5, sy = -sin * dx + cos * dy + py + 0.5;
    const bx = Math.floor(sx * S), by = Math.floor(sy * S);
    if (bx < 0 || by < 0 || bx >= big.w || by >= big.h) continue;
    o.cells[y][x] = big.cells[by][bx];
  }
  return o;
}

function rotate90(g: PixelGrid, q: number, px: number, py: number, qx: number, qy: number, w: number, h: number): PixelGrid {
  const o = new PixelGrid(w, h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.cells[y][x];
    if (!c) continue;
    const dx = x - px, dy = y - py;
    let rx = dx, ry = dy;
    if (q === 1) { rx = -dy; ry = dx; } else if (q === 2) { rx = -dx; ry = -dy; } else if (q === 3) { rx = dy; ry = -dx; }
    o.px(qx + rx, qy + ry, c);
  }
  return o;
}
