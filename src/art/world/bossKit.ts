// 3つのステージのボスの絵で共通に使う道具(96×96のコマ)。
// ボスの正体は、人の仕組み(figure.ts)を使わず、ここの道具で太い体を組み立てる。
// 光は左上から。形ごとに「明るい、ふつう、影、いちばん暗い」の段で塗り、1ドットのふちで囲む。

import { OUTLINE, PixelGrid } from '../lib';
import { type Look, type Pose, drawPerson, stretchPose } from './figure';
import { idleFrames, walkFrames } from './poses';
import { Mask, Painter, type Pt, bbox, rotateGrid, shifted } from './pix';

/** 96×96のコマに人を描く(化けた姿などの、ふつうの人の仕組みで描くとき) */
export const P96 = (look: Look, p: Pose): PixelGrid => drawPerson(look, p, 96, 96);

/** 足の裏(y=91)にそろえる。centerX で体の真ん中(x=48)にもそろえる */
export function alignFeet(g: PixelGrid, centerX = false): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  return shifted(g, centerX ? 48 - Math.round((b.x0 + b.x1) / 2) : 0, 91 - b.y1);
}

/** 空中のコマ:体の真ん中を (48, 46) にそろえる */
export function alignCenter(g: PixelGrid): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  return shifted(g, 48 - Math.round((b.x0 + b.x1) / 2), 46 - Math.round((b.y0 + b.y1) / 2));
}

// ---------- ボスのポーズ ----------

export interface BArm {
  /** ひじ */
  e: Pt;
  /** 手の真ん中 */
  h: Pt;
  /** 手の形。省くと握りこぶし */
  hand?: 'fist' | 'open' | 'point' | 'none';
}
export interface BLeg {
  /** ひざ */
  k: Pt;
  /** 足首 */
  a: Pt;
  /** つま先の向き(ラジアン。0で右、正で下へ) */
  toe?: number;
}
export interface BPose {
  /** あごの下の、首がつながる点 */
  head: Pt;
  /** 胴の上の真ん中(首のつけ根) */
  neck: Pt;
  /** 腰の真ん中(脚のつけ根の高さ) */
  hip: Pt;
  /** 奥(右)の腕と、手前(左)の腕 */
  aB: BArm;
  aF: BArm;
  lB: BLeg;
  lF: BLeg;
  /** 頭の傾き(ラジアン。負で後ろへのけぞる)。首がつながる点を中心に回す */
  tilt?: number;
}

export const cloneB = (p: BPose): BPose => JSON.parse(JSON.stringify(p)) as BPose;

/** 上半身だけずらす(腰から上) */
export function moveUpperB(p: BPose, dx: number, dy: number): BPose {
  const q = cloneB(p);
  for (const pt of [q.head, q.neck, q.aB.e, q.aB.h, q.aF.e, q.aF.h]) { pt[0] += dx; pt[1] += dy; }
  return q;
}

// ---------- 塗り ----------

/** 明るい、ふつう、影、いちばん暗い(省くと影で止める) */
export type Ramp4 = readonly [string, string, string, string?];

/** 奥の手足の色(1段暗くする) */
export const farRamp = (r: Ramp4): Ramp4 => [r[1], r[2], r[3] ?? r[2], r[3] ?? r[2]];

export interface ShadeOpts {
  /** 前に塗った物との境目: ふち色の線、ramp の暗い色の線、線なし */
  sep?: 'outline' | 'dark' | 'none';
  /** 光の側からの割合がこれより小さいと明るい色 */
  hi?: number;
  /** これより大きいと影 */
  lo?: number;
  /** これより大きいと、いちばん暗い色 */
  deep?: number;
  /** 光の向き(光の来る方へ進む向き)。省くと左上 */
  light?: Pt;
}

const NB4: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** m の外に出るまで、向き d に何ドット進めるか */
function run(m: Mask, x: number, y: number, d: Pt, max = 24): number {
  let k = 1;
  while (k <= max && m.has(Math.round(x + d[0] * k), Math.round(y + d[1] * k))) k++;
  return k - 1;
}

/** 形の中の位置から 0(光の側)〜1(影の側)の値を出す */
export function lightT(m: Mask, x: number, y: number, light: Pt = [-0.55, -0.84]): number {
  const back: Pt = [-light[0], -light[1]];
  const a = run(m, x, y, light), b = run(m, x, y, back);
  // 横の断面も少し混ぜる(細長い形で、縦だけで決まらないように)
  const l = run(m, x, y, [-1, 0]), r = run(m, x, y, [1, 0]);
  const t1 = (a + 0.5) / (a + b + 1), t2 = (l + 0.5) / (l + r + 1);
  return t1 * 0.7 + t2 * 0.3;
}

/**
 * 形を、左上から光が当たったように段で塗る。
 * 1ドットだけ飛び出た色は、まわりの色にそろえて消す
 */
export function shade(P: Painter, m: Mask, ramp: Ramp4 | string, o: ShadeOpts = {}): void {
  const rp: Ramp4 = typeof ramp === 'string' ? [ramp, ramp, ramp] : ramp;
  const sep = o.sep ?? 'outline';
  if (sep !== 'none') {
    const c = sep === 'outline' ? OUTLINE : (rp[3] ?? rp[2]);
    const edge: Pt[] = [];
    m.each((x, y) => {
      for (const [dx, dy] of NB4) if (!m.has(x + dx, y + dy) && P.g.get(x + dx, y + dy)) edge.push([x + dx, y + dy]);
    });
    for (const [x, y] of edge) P.g.px(x, y, c);
  }
  if (typeof ramp === 'string') { m.each((x, y) => { P.g.px(x, y, ramp); }); return; }
  const hi = o.hi ?? 0.3, lo = o.lo ?? 0.62, deep = o.deep ?? 0.86;
  const tone = new Map<number, number>();
  const W = P.w;
  m.each((x, y) => {
    const t = lightT(m, x, y, o.light);
    tone.set(y * W + x, t < hi ? 0 : rp[3] && t > deep ? 3 : t > lo ? 2 : 1);
  });
  cleanTones(m, tone, W);
  m.each((x, y) => { P.g.px(x, y, rp[tone.get(y * W + x)!] ?? rp[2]); });
}

/**
 * 丸い物(頭、こぶし、肩)を、だ円の玉として塗る。玉の真ん中 (cx, cy)、半径 rx, ry。
 * cut は段の境目(明るい、ふつう、影)。形は m のまま(玉の外のところは玉のふちの向きで塗る)
 */
export function shadeBall(
  P: Painter, m: Mask, ramp: Ramp4, cx: number, cy: number, rx: number, ry: number,
  o: { sep?: 'outline' | 'dark' | 'none'; cut?: readonly [number, number, number] } = {}
): void {
  const sep = o.sep ?? 'outline';
  if (sep !== 'none') {
    const c = sep === 'outline' ? OUTLINE : (ramp[3] ?? ramp[2]);
    const edge: Pt[] = [];
    m.each((x, y) => {
      for (const [dx, dy] of NB4) if (!m.has(x + dx, y + dy) && P.g.get(x + dx, y + dy)) edge.push([x + dx, y + dy]);
    });
    for (const [x, y] of edge) P.g.px(x, y, c);
  }
  const [c0, c1, c2] = o.cut ?? [0.62, 0.2, -0.25];
  const W = P.w;
  const tone = new Map<number, number>();
  m.each((x, y) => {
    let nx = (x - cx) / rx, ny = (y - cy) / ry;
    const r = Math.hypot(nx, ny);
    if (r > 1) { nx /= r; ny /= r; }
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const b = -0.5 * nx - 0.62 * ny + 0.6 * nz;
    tone.set(y * W + x, b > c0 ? 0 : b > c1 ? 1 : b > c2 || !ramp[3] ? 2 : 3);
  });
  cleanTones(m, tone, W);
  m.each((x, y) => { P.g.px(x, y, ramp[tone.get(y * W + x)!] ?? ramp[2]); });
}

/** まわりに同じ段が1つもない1ドットを、まわりでいちばん多い段にそろえる */
function cleanTones(m: Mask, tone: Map<number, number>, W: number): void {
  for (let pass = 0; pass < 2; pass++) {
    const fix: [number, number][] = [];
    m.each((x, y) => {
      const t = tone.get(y * W + x)!;
      const cnt = [0, 0, 0, 0];
      let same = 0, n = 0;
      for (const [dx, dy] of NB4) {
        const u = tone.get((y + dy) * W + x + dx);
        if (u === undefined || !m.has(x + dx, y + dy)) continue;
        n++; cnt[u]++;
        if (u === t) same++;
      }
      if (n >= 2 && same === 0) fix.push([y * W + x, cnt.indexOf(Math.max(...cnt))]);
    });
    for (const [i, t] of fix) tone.set(i, t);
  }
}

// ---------- 形 ----------

/** 腕の形:力こぶのふくらみのある二の腕、太い前腕、手 */
export interface ArmDims {
  /** 二の腕の太さ(半径) */
  up: number;
  /** 前腕の太さ(ひじ側、手首側) */
  fore: number;
  wrist: number;
  /** こぶしの半径 */
  fist: number;
  /** 力こぶのふくらみ */
  bulge?: number;
}

export function armShapes(P: Painter, s: Pt, arm: BArm, d: ArmDims): { upper: Mask; fore: Mask; hand: Mask; wrist: Pt } {
  const [ex, ey] = arm.e, [hx, hy] = arm.h;
  const L = Math.hypot(hx - ex, hy - ey) || 1;
  const ux = (hx - ex) / L, uy = (hy - ey) / L;
  const wrist: Pt = [hx - ux * d.fist * 0.9, hy - uy * d.fist * 0.9];
  const upper = P.mask().capsule(s, arm.e, d.up, d.up * 0.85);
  if (d.bulge) {
    // 力こぶ:二の腕の途中を、腕の向きに直角にふくらませる
    const c: Pt = [s[0] + (ex - s[0]) * 0.45, s[1] + (ey - s[1]) * 0.45];
    upper.capsule([c[0] - (ex - s[0]) * 0.18, c[1] - (ey - s[1]) * 0.18], [c[0] + (ex - s[0]) * 0.18, c[1] + (ey - s[1]) * 0.18], d.up + d.bulge);
  }
  const fore = P.mask().capsule(arm.e, wrist, d.fore, d.wrist);
  const hand = P.mask();
  const kind = arm.hand ?? 'fist';
  if (kind === 'fist') hand.ellipse(hx, hy, d.fist, d.fist * 0.9).ellipse(hx + ux * 0.8, hy + uy * 0.8, d.fist * 0.85, d.fist * 0.85);
  else if (kind === 'open') hand.capsule(wrist, [hx + ux * d.fist * 0.6, hy + uy * d.fist * 0.6], d.fist * 0.8, d.fist * 0.6);
  else if (kind === 'point') {
    hand.ellipse(hx - ux * 0.5, hy - uy * 0.5, d.fist * 0.85, d.fist * 0.8);
    hand.capsule([hx, hy], [hx + ux * (d.fist + 3), hy + uy * (d.fist + 3)], 0.6);
  }
  return { upper, fore, hand, wrist };
}

/**
 * 腕や脚にそって並べた山形(>)の帯。a から b への線の t0〜t1 のところに count 個。
 * r は山の半分の幅、thick は帯の太さ。山の先は b の向き
 */
export function chevronMask(P: Painter, a: Pt, b: Pt, t0: number, t1: number, count: number, r: number, thick = 2): Mask {
  const m = P.mask();
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const x0 = Math.floor(Math.min(a[0], b[0]) - r - 2), x1 = Math.ceil(Math.max(a[0], b[0]) + r + 2);
  const y0 = Math.floor(Math.min(a[1], b[1]) - r - 2), y1 = Math.ceil(Math.max(a[1], b[1]) + r + 2);
  for (let i = 0; i < count; i++) {
    const s = L * (count === 1 ? (t0 + t1) / 2 : t0 + ((t1 - t0) * i) / (count - 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const along = (x - a[0]) * ux + (y - a[1]) * uy;
      const perp = -(x - a[0]) * uy + (y - a[1]) * ux;
      if (Math.abs(perp) > r) continue;
      const d = along + Math.abs(perp) * 0.8 - s;
      if (d >= 0 && d < thick) m.set(x, y);
    }
  }
  return m;
}

/** 脚の形:太もも、すね */
export function legShapes(P: Painter, hip: Pt, leg: BLeg, thigh: number, shin: number, ankle: number): { thigh: Mask; shin: Mask } {
  return {
    thigh: P.mask().capsule(hip, leg.k, thigh, thigh * 0.85),
    shin: P.mask().capsule(leg.k, leg.a, shin, ankle)
  };
}

/** ブーツや靴の形。足首 a から、つま先の向き toe へ。len は長さ、hgt は高さ */
export function footShape(P: Painter, a: Pt, toe: number, len: number, hgt: number, heel = 2.5): Mask {
  const c = Math.cos(toe), s = Math.sin(toe);
  const pts: Pt[] = [[-heel, -hgt * 0.6], [len * 0.35, -hgt * 0.5], [len * 0.8, 0], [len, hgt * 0.55], [len, hgt], [-heel, hgt]];
  return P.mask().poly(pts.map(([x, y]) => [a[0] + x * c - y * s, a[1] + x * s + y * c] as Pt));
}

// ---------- 頭 ----------

/** 文字の絵から格子を作る(keys にない文字は透明) */
export function gridFromRows(rows: readonly string[], keys: Record<string, string>): PixelGrid {
  const w = Math.max(...rows.map((r) => r.length));
  const g = new PixelGrid(w, rows.length);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = keys[r[x]]; if (c) g.px(x, y, c); } });
  return g;
}

/** 文字の絵の一部を書きかえる(r 行目の c 列目から s に) */
export function patchRows(rows: string[], r: number, c: number, s: string): void {
  const row = rows[r].padEnd(c + s.length, '.');
  rows[r] = row.slice(0, c) + s + row.slice(c + s.length);
}

export interface HeadArt {
  g: PixelGrid;
  /** 首がつながる点(格子の中)。首の太さの真ん中、あごの下の線 */
  nx: number;
  ny: number;
}

/**
 * 首と頭を描く。首は頭の格子のつながる点から胴の首のつけ根まで、太さ neckW でつなぐ
 * (頭がどこにずれても、あごの下から首が出るように)。頭はふちの線を付けて上に重ねる
 */
export function drawNeckAndHead(P: Painter, pose: BPose, head: HeadArt, neckW: number, neckRamp: Ramp4, flip = false): void {
  const hx = pose.head[0], hy = pose.head[1];
  const nk = P.mask().poly([
    [hx - neckW, hy - 3], [hx + neckW, hy - 3],
    [pose.neck[0] + neckW + 1.5, pose.neck[1] + 3], [pose.neck[0] - neckW - 1.5, pose.neck[1] + 3]
  ]);
  // 首の横だけふちで分ける(下は胸につながる)
  nk.each((x, y) => {
    for (const [dx, dy] of NB4) {
      if (nk.has(x + dx, y + dy) || !P.g.get(x + dx, y + dy) || y + dy > pose.neck[1] - 1) continue;
      P.g.px(x + dx, y + dy, OUTLINE);
    }
  });
  shade(P, nk, neckRamp, { sep: 'none', hi: 0.2, lo: 0.5 });
  let g = flip ? head.g.flipped() : head.g;
  let nx = flip ? head.g.w - 1 - head.nx : head.nx, ny = head.ny;
  if (pose.tilt) {
    // まわりに余白を足してから、首がつながる点を中心に回す
    const pad = 8;
    const big = shifted(g, pad, pad, g.w + pad * 2, g.h + pad * 2);
    g = rotateGrid(big, pose.tilt, nx + pad, ny + pad, nx + pad, ny + pad);
    nx += pad; ny += pad;
  }
  P.blit(g, Math.round(hx - nx), Math.round(hy - ny), 'outline');
}

// ---------- 服の切れはし ----------

export interface ScrapStyle {
  /** 首から下へ何ドットのところから飛ばすか */
  dy: number;
  /** step 1つで飛ぶ距離の増え方 */
  spread: number;
  /** 切れはしの色。i 番目の切れはしは colors[i % 長さ] */
  colors: readonly string[];
  /** この外に出た切れはしは描かない */
  xMax: number;
  yMin: number;
}

/** 化けていた服の切れはし。step が大きいほど遠くへ飛ぶ */
export function drawScraps(P: Painter, pose: { neck: Pt }, step: number, style: ScrapStyle): void {
  const c: Pt = [pose.neck[0], pose.neck[1] + style.dy];
  const pieces: [number, number, number][] = [
    [-2.4, 14, 0], [-0.5, 18, 1], [0.4, 16, 2], [1.4, 17, 1], [2.3, 15, 0], [3.0, 19, 2], [-1.4, 20, 1], [4.2, 16, 2]
  ];
  const shapes = [['111.', '.111', '..1.'], ['.11', '111', '1..'], ['11..', '.111', '.11.', '..1.']];
  pieces.forEach(([ang, d, sh], i) => {
    const r = d * (0.35 + step * style.spread) + (i % 3);
    const x = Math.round(c[0] + Math.cos(ang) * r * 1.4), y = Math.round(c[1] + Math.sin(ang) * r - step * 3);
    if (y > 88 || y < style.yMin || x < 1 || x > style.xMax) return;
    const m = P.mask();
    shapes[(sh + step) % shapes.length].forEach((row, j) => { for (let q = 0; q < row.length; q++) if (row[q] === '1') m.set(x + q, y + j); });
    P.fill(m, style.colors[i % style.colors.length], { sep: 'outline', flat: true });
  });
}

/**
 * 化けたボスのシート(待機、歩き、仕分けの3行)。市民の動きを使い、体を少し大きくする(sy は縦、sx は横の倍率)。
 * walk を渡すとその歩き、tweak を渡すと大きくしたあとの動きをさらに変える
 */
export function disguiseRows(
  look: Look, base: Pose, sort: Pose[], opt: { sx: number; sy?: number; walk?: Pose[]; tweak?: (p: Pose) => Pose }
): PixelGrid[][] {
  const st = (p: Pose): Pose => {
    const s = stretchPose(p, opt.sy ?? 1.1, opt.sx);
    return opt.tweak ? opt.tweak(s) : s;
  };
  const draw = (ps: Pose[]): PixelGrid[] => ps.map((p) => drawPerson(look, st(p)));
  return [draw(idleFrames(base)), draw(opt.walk ?? walkFrames(base)), draw(sort)];
}
