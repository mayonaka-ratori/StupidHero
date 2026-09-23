// エフェクト(fx_*)。光は白、薄い黄色、金の3段。半透明は使わない(ゲームで点滅させる)。
// どれも左右反転しても変に見えない形にする。置くときの基準はコマの真ん中。
import { md, OUTLINE, PixelGrid } from '../lib';
import { ellipse, fillWhere, line, line1, poly, rng, type Pt } from './shapes';
import { stamp } from './sprite';

export type FxMaker = (w: number, h: number, frames: number) => PixelGrid[];

// 光の3段
const W = md(7, 7, 7);
const Y = md(7, 7, 4);
const G = md(7, 5, 1);
// 火
const O = md(7, 3, 0);
const R = md(6, 1, 0);
const DR = md(3, 0, 0);
// 煙、ほこり
const SM1 = md(5, 4, 4);
const SM2 = md(3, 2, 3);
const SM3 = md(2, 1, 2);
const DU1 = md(6, 5, 4);
const DU2 = md(5, 4, 3);
const DU3 = md(3, 2, 2);

const rad = (d: number): number => (d * Math.PI) / 180;
const polar = (cx: number, cy: number, r: number, a: number): Pt => [cx + Math.cos(rad(a)) * r, cy + Math.sin(rad(a)) * r];

const frames = (w: number, h: number, n: number, draw: (g: PixelGrid, i: number) => void): PixelGrid[] =>
  Array.from({ length: n }, (_, i) => {
    const g = new PixelGrid(w, h);
    draw(g, i);
    return g;
  });

/** 中心から外へとがる光の筋(三角形)。色は内側から外へ */
function ray(g: PixelGrid, cx: number, cy: number, a: number, r0: number, r1: number, halfW: number, cols: string[]): void {
  const tip = polar(cx, cy, r1, a);
  const b1 = polar(cx, cy, r0, a - 90 * 0), p1: Pt = [b1[0] + Math.cos(rad(a + 90)) * halfW, b1[1] + Math.sin(rad(a + 90)) * halfW];
  const p2: Pt = [b1[0] - Math.cos(rad(a + 90)) * halfW, b1[1] - Math.sin(rad(a + 90)) * halfW];
  poly(g, [p1, tip, p2], (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    const t = (d - r0) / (r1 - r0);
    return cols[Math.min(cols.length - 1, Math.max(0, Math.floor(t * cols.length)))];
  });
}

/** 輪(太さ th) */
function ring(g: PixelGrid, cx: number, cy: number, rx: number, ry: number, th: number, c: (t: number, a: number) => string | null): void {
  fillWhere(g, (px, py) => {
    const d = Math.hypot((px - cx) / rx, (py - cy) / ry);
    return d <= 1 && d >= 1 - th / Math.min(rx, ry);
  }, (x, y) => {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    const t = (1 - d) / (th / Math.min(rx, ry));
    return c(t, (Math.atan2(y + 0.5 - cy, x + 0.5 - cx) * 180) / Math.PI);
  });
}

/** 4本の光の十字(キラッ) */
function twinkle(g: PixelGrid, cx: number, cy: number, len: number, diag = 0): void {
  for (const a of [0, 90, 180, 270]) ray(g, cx, cy, a, 0, len, len > 5 ? 1.3 : 0.9, [W, Y, G]);
  if (diag > 0) for (const a of [45, 135, 225, 315]) ray(g, cx, cy, a, 0, diag, 0.8, [Y, G]);
  g.px(Math.floor(cx), Math.floor(cy), W);
}

// ---------- 殴ったときの火花 ----------
function hitSpark(size: number, n: number): PixelGrid[] {
  const c = size / 2;
  const s = size / 32;
  return frames(size, size, n, (g, i) => {
    const rot = 12;
    if (i === 0) {
      ellipse(g, c, c, 4 * s, 4 * s, W);
      for (let k = 0; k < 4; k++) ray(g, c, c, rot + k * 90, 2 * s, 9 * s, 2 * s, [W, Y]);
      for (let k = 0; k < 4; k++) ray(g, c, c, rot + 45 + k * 90, 2 * s, 6 * s, 1.5 * s, [Y, G]);
    } else if (i === 1) {
      for (let k = 0; k < 4; k++) ray(g, c, c, rot + k * 90, 3 * s, 15.5 * s, 2.6 * s, [W, W, Y, G]);
      for (let k = 0; k < 4; k++) ray(g, c, c, rot + 45 + k * 90, 3 * s, 11 * s, 2 * s, [W, Y, G]);
      for (let k = 0; k < 8; k++) ray(g, c, c, rot + 22.5 + k * 45, 3 * s, 7.5 * s, 1.2 * s, [Y, G]);
      ellipse(g, c, c, 5.5 * s, 5.5 * s, (x, y) => (Math.hypot(x + 0.5 - c, y + 0.5 - c) < 3.5 * s ? W : Y));
    } else if (i === 2) {
      ring(g, c, c, 9 * s, 9 * s, 2.2 * s, (t) => (t > 0.5 ? Y : G));
      for (let k = 0; k < 4; k++) ray(g, c, c, rot + k * 90, 9 * s, 15.5 * s, 1.6 * s, [Y, G]);
      for (let k = 0; k < 4; k++) ray(g, c, c, rot + 45 + k * 90, 8 * s, 12.5 * s, 1.2 * s, [G]);
    } else {
      for (let k = 0; k < 8; k++) {
        const [x, y] = polar(c, c, (k % 2 ? 11 : 13.5) * s, rot + k * 45);
        ellipse(g, x, y, 1.2 * s, 1.2 * s, k % 2 ? G : Y);
      }
    }
  });
}

// ---------- 砂ぼこり ----------
function dust(w: number, h: number, n: number): PixelGrid[] {
  const rnd = rng(7);
  const puffs = Array.from({ length: 9 }, (_, k) => ({ a: k * 40 + rnd() * 20, d: 0.4 + rnd() * 0.6, r: 0.55 + rnd() * 0.45 }));
  return frames(w, h, n, (g, i) => {
    const grow = [0.45, 0.75, 0.95, 1.05][i];
    const shrink = [1, 1, 0.8, 0.5][i];
    const c = w / 2;
    for (const p of puffs) {
      const [x, y] = polar(c, h / 2 + 1, p.d * 9 * grow, p.a);
      const r = p.r * 6 * shrink * (0.7 + grow * 0.5);
      if (r < 1) continue;
      ellipse(g, x, y, r, r * 0.85, (px, py) => {
        const k = (px + 0.5 - x) / r * 0.7 + (py + 0.5 - y) / r * 0.7;
        return k < -0.35 ? DU1 : k > 0.45 ? DU3 : DU2;
      });
    }
    if (i === 3) {
      // すき間を作って散っていく
      for (const [hx, hy, hr] of [[12, 13, 2.5], [20, 18, 2], [15, 20, 1.6], [19, 11, 1.8]]) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < hr) g.px(x, y, null);
      }
    }
    g.outline(SM3);
  });
}

// ---------- 目を回した星 ----------
const STAR5 = ['..y..', '.yyy.', 'yywyy', '.yyy.', '.y.y.'];
function dizzy(w: number, h: number, n: number): PixelGrid[] {
  return frames(w, h, n, (g, i) => {
    for (let k = 0; k < 3; k++) {
      const a = rad(i * 30 + k * 120);
      const x = w / 2 + Math.cos(a) * 4 - 2.5, y = h / 2 + Math.sin(a) * 2 - 2.5;
      const front = Math.sin(a) > -0.2;
      stamp(g, front ? STAR5 : ['.y.', 'yyy', '.y.'], { y: front ? Y : G, w: W }, Math.round(x + (front ? 0 : 1)), Math.round(y + (front ? 0 : 1)));
    }
    g.outline(OUTLINE);
  });
}

// ---------- 破片 ----------
function debris(w: number, h: number, n: number): PixelGrid[] {
  const B1 = md(6, 3, 2), B2 = md(4, 2, 1), B3 = md(2, 1, 1), GR = md(5, 5, 5), GD = md(3, 3, 4);
  return frames(w, h, n, (g, i) => {
    const a = i * 90 + 15;
    const cx = 7, cy = 8;
    const pts: Pt[] = [polar(cx, cy, 4.5, a), polar(cx, cy, 3.5, a + 100), polar(cx, cy, 4.8, a + 190), polar(cx, cy, 3, a + 270)];
    poly(g, pts, (x, y) => {
      const k = (x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.6;
      return k < -1 ? B1 : k > 1.2 ? B3 : B2;
    });
    const [sx, sy] = polar(12, 4, 1.2, a * 2);
    g.px(Math.round(sx), Math.round(sy), GR).px(Math.round(sx) + 1, Math.round(sy), GD);
    const [tx, ty] = polar(12, 12, 1.5, -a);
    g.px(Math.round(tx), Math.round(ty), B1).px(Math.round(tx), Math.round(ty) + 1, B2);
    g.outline(OUTLINE);
  });
}

// ---------- 「!」の合図 ----------
function mark(col: [string, string, string]): FxMaker {
  return (w, h, n) => frames(w, h, n, (g, i) => {
    const up = i === 1 ? 0 : 1;
    const x = 6;
    // 縦棒(上が太く下が細い)
    poly(g, [[x - 0.5, 2 + up], [x + 4.5, 2 + up], [x + 3.3, 10 + up], [x + 0.7, 10 + up]], (px) => (px <= x ? col[0] : px >= x + 3 ? col[2] : col[1]));
    ellipse(g, x + 2, 13 + up, 1.6, 1.4, (px) => (px <= x + 1 ? col[0] : col[1]));
    g.outline(OUTLINE);
  });
}

// ---------- 足元の影 ----------
const shadow: FxMaker = (w, h, n) => frames(w, h, n, (g) => {
  ellipse(g, w / 2, h / 2, w / 2 - 1, h / 2 - 1, md(1, 1, 2));
});

// ---------- 勝利ポーズのがれき ----------
const rubble: FxMaker = (w, h, n) => frames(w, h, n, (g) => {
  const C1 = md(5, 5, 5), C2 = md(4, 4, 4), C3 = md(2, 2, 3), CR = md(1, 1, 2);
  const rnd = rng(31);
  const cx = w / 2;
  // 地面のへこみ(ひび)
  ellipse(g, cx, h - 5, 21, 3.5, CR);
  // かたまり
  const chunks: [number, number, number][] = [[-15, 3, 4], [-9, 1, 5], [-2, 0, 4.5], [5, 1, 5.5], [12, 2, 4.5], [18, 4, 3.5], [-19, 5, 3], [-5, 4, 3.5], [9, 5, 3.5]];
  for (const [dx, dy, r] of chunks) {
    const x = cx + dx, y = h - 8 + dy;
    const pts: Pt[] = Array.from({ length: 5 }, (_, k) => polar(x, y, r * (0.75 + rnd() * 0.35), k * 72 + rnd() * 30 - 90));
    poly(g, pts, (px, py) => {
      const k = (px + 0.5 - x) * 0.5 + (py + 0.5 - y) * 0.7;
      return k < -1 ? C1 : k > 1 ? C3 : C2;
    });
  }
  // 立ち上がった板
  poly(g, [[cx - 13, h - 8], [cx - 10, h - 19], [cx - 6, h - 17], [cx - 7, h - 7]], (px) => (px < cx - 10 ? C1 : C2));
  poly(g, [[cx + 8, h - 7], [cx + 11, h - 17], [cx + 15, h - 15], [cx + 14, h - 6]], (px) => (px < cx + 11 ? C2 : C3));
  g.outline(OUTLINE);
  // 下のふちを平らに(地面と同じ高さ)
  for (let x = 0; x < w; x++) g.px(x, h - 1, null);
});

// ---------- オーラ ----------
const aura: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const cx = w / 2, cy = h / 2 + 2, rx = 17, ry = 28;
  const ph = i * 1.6;
  fillWhere(g, (px, py) => {
    const a = Math.atan2(py - cy, px - cx);
    const up = Math.max(0, -Math.sin(a)); // 上ほど炎が伸びる
    const flame = 1 + up * (0.12 + 0.12 * Math.sin(Math.abs(Math.cos(a)) * 9 + ph)) + 0.04 * Math.sin(a * 6 + ph * 2);
    const d = Math.hypot((px - cx) / rx, (py - cy) / ry) / flame;
    return d <= 1 && d >= 0.8;
  }, (x, y) => {
    const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
    const up = Math.max(0, -Math.sin(a));
    const flame = 1 + up * (0.12 + 0.12 * Math.sin(Math.abs(Math.cos(a)) * 9 + ph)) + 0.04 * Math.sin(a * 6 + ph * 2);
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) / flame;
    return d < 0.86 ? W : d < 0.93 ? Y : G;
  });
  // 立ちのぼる光の粒
  const rnd = rng(100 + i);
  for (let k = 0; k < 7; k++) {
    const x = cx + (rnd() - 0.5) * 34, y = 4 + rnd() * 20 + ((i * 5) % 8);
    if (Math.hypot((x - cx) / rx, (y - cy) / ry) < 0.8) continue;
    g.px(Math.round(x), Math.round(y), k % 2 ? Y : G);
    if (k % 3 === 0) g.px(Math.round(x), Math.round(y) + 1, G);
  }
});

// ---------- 光の尾 ----------
const trail: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const lines: [number, number, number][] = [
    // y, 長さ, ずれ
    [6, 30, 0], [11, 40, 7], [16, 46, 2], [21, 38, 9], [26, 28, 4]
  ];
  lines.forEach(([y, len, off], k) => {
    const l = len - ((i * 7 + off + k * 3) % 12);
    const x1 = w - 1 - ((k * 3 + i * 2) % 5);
    const x0 = x1 - l;
    const th = k === 2 ? 1.5 : k % 2 ? 0.9 : 0.6;
    // 右(ヒーロー側)が太く明るく、左へ細く
    for (let x = Math.floor(x0); x <= x1; x++) {
      const t = (x - x0) / l;
      const r = th * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.1))));
      for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
        if (Math.abs(yy + 0.5 - (y + 0.5)) > r) continue;
        g.px(x, yy, t > 0.7 ? W : t > 0.35 ? Y : G);
      }
    }
  });
});

// ---------- 飛んでいく光の拳 ----------
// 横から見た握りこぶし(右が指の側)
const FIST = [
  '...GGGGGGG....',
  '..GYYYYYYYGG..',
  '.GYWWWWWWWYYG.',
  'GYWWWYYYYYWWYG',
  'GYWWWWWWWWWWYG',
  'GYWWWWWYYYYWYG',
  'GYWWWWWWWWWWYG',
  'GYWWWWWYYYYWYG',
  '.GYWWWWWWWWYG.',
  '..GYYYYYYYYG..',
  '...GGGGGGGG...'
];
const punchFx: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const fx = w - 16, fy = Math.round(h / 2 - 5.5);
  // 後ろの筋
  const ys = [fy + 2, fy + 5, fy + 8];
  ys.forEach((y, k) => {
    const len = 10 + ((i * 5 + k * 4) % 9);
    for (let x = fx - len; x < fx + 2; x++) g.px(x, y, x > fx - 4 ? Y : (x + i) % 5 === 0 ? null : G);
  });
  stamp(g, FIST, { W, Y, G }, fx, fy + (i % 2));
});

// ---------- 着地の衝撃波 ----------
const shockwave: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const cx = w / 2, by = h - 3;
  const rx = [14, 26, 38, 46][i], ry = [8, 12, 15, 16][i], th = [5, 4, 3, 2][i];
  fillWhere(g, (px, py) => {
    if (py > by) return false;
    const d = Math.hypot((px - cx) / rx, (py - by) / ry);
    return d <= 1 && d >= 1 - th / ry;
  }, (x, y) => {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - by) / ry);
    const t = (1 - d) * ry / th;
    if (i === 3 && (Math.floor(x / 3) % 3 === 0)) return null;
    return t < 0.34 ? G : t < 0.67 ? Y : W;
  });
  // 地面を走る光
  const gl = [10, 22, 36, 45][i];
  for (let x = Math.round(cx - gl); x <= Math.round(cx + gl); x++) {
    const t = Math.abs(x + 0.5 - cx) / gl;
    g.px(x, by, t < 0.5 ? W : t < 0.8 ? Y : G);
    if (t < 0.6 || i < 2) g.px(x, by + 1, t < 0.3 ? Y : G);
  }
  // 飛ぶ小石
  if (i >= 1) for (const s of [-1, 1]) {
    const x = cx + s * (rx * 0.75), y = by - ry * 0.9 - i;
    g.px(Math.round(x), Math.round(y), G).px(Math.round(x + s), Math.round(y - 1), Y);
  }
});

// ---------- 必殺技の光線(横につなげる) ----------
const beam: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const cy = h / 2;
  const ph = (i / n) * Math.PI * 2;
  for (let x = 0; x < w; x++) {
    // 周期は w で割り切れるようにする(つなぎ目が見えない)
    const u = (x / w) * Math.PI * 2;
    const core = 5 + Math.sin(u * 2 + ph) * 1.2;
    const mid = core + 5 + Math.sin(u * 3 - ph) * 1.5;
    const out = mid + 4 + Math.sin(u * 4 + ph * 2) * 1.5;
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y + 0.5 - cy);
      if (d <= core) g.px(x, y, W);
      else if (d <= mid) g.px(x, y, Y);
      else if (d <= out) g.px(x, y, G);
    }
  }
  // 中を流れる光の筋
  for (let k = 0; k < 3; k++) {
    const y = Math.round(cy - 9 + k * 9);
    const x0 = ((k * 11 + i * 8) % w);
    for (let d = 0; d < 7; d++) {
      const x = (x0 + d) % w;
      if (g.get(x, y) === Y) g.px(x, y, W);
      else if (g.get(x, y) === W) g.px(x, y, Y);
    }
  }
});

// ---------- 光線の先 ----------
const beamHead: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const cy = h / 2;
  const ph = (i / n) * Math.PI * 2;
  // 左端は光線と同じ太さ
  for (let x = 0; x < 26; x++) {
    const u = (x / 32) * Math.PI * 2;
    const core = 5 + Math.sin(u * 2 + ph) * 1.2;
    const mid = core + 5 + Math.sin(u * 3 - ph) * 1.5;
    const out = mid + 4 + Math.sin(u * 4 + ph * 2) * 1.5;
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y + 0.5 - cy);
      if (d <= core) g.px(x, y, W);
      else if (d <= mid) g.px(x, y, Y);
      else if (d <= out) g.px(x, y, G);
    }
  }
  const hx = 28, r = 13 + (i % 2) * 1.5;
  const rot = i * 11;
  for (let k = 0; k < 8; k++) ray(g, hx, cy, rot + k * 45 - 90, r - 3, r + (k % 2 ? 4 : 8), k % 2 ? 1.5 : 2.4, [Y, G]);
  ellipse(g, hx, cy, r, r, (x, y) => {
    const d = Math.hypot(x + 0.5 - hx, y + 0.5 - cy) / r;
    return d < 0.62 ? W : d < 0.85 ? Y : G;
  });
});

// ---------- キラキラ ----------
const sparkle: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const c = w / 2;
  if (i === 0) { g.px(7, 7, W).px(8, 7, Y).px(7, 8, Y).px(8, 8, G); }
  else if (i === 1) twinkle(g, c, c, 4.5);
  else if (i === 2) { twinkle(g, c, c, 7.5, 4); g.px(2, 12, Y).px(13, 3, G); }
  else { twinkle(g, c, c, 3.5); g.px(3, 12, G).px(12, 2, Y).px(13, 12, G); }
});

// ---------- 急ブレーキの火花 ----------
const brake: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const ox = w / 2, oy = h - 2;
  const rnd = rng(55 + i * 3);
  // 焦げあと
  for (let x = Math.round(ox - 12 - i * 2); x <= ox + 2; x++) g.px(x, h - 1, md(2, 1, 1));
  const cnt = [7, 9, 8, 5][i];
  for (let k = 0; k < cnt; k++) {
    const a = 200 + rnd() * 60; // 後ろ上へ
    const d0 = 1 + rnd() * 3 + i * 2, d1 = d0 + 3 + rnd() * 5 - i;
    if (d1 <= d0) continue;
    const p0 = polar(ox, oy, d0, a), p1 = polar(ox, oy, d1, a);
    line1(g, p0[0], p0[1], p1[0], p1[1], k % 3 === 0 ? W : k % 3 === 1 ? Y : G);
    g.px(Math.round(p1[0]), Math.round(p1[1]), O);
  }
  if (i < 2) ellipse(g, ox, oy, 2.2 - i * 0.6, 1.6, W);
});

// ---------- 「ガーン」の稲妻 ----------
const gaan: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const B1 = md(5, 6, 7), B2 = md(2, 3, 7), B3 = md(1, 1, 4);
  // 上から下へ走る太い稲妻。コマごとに位置を入れかえる
  const bolts: [number, number, number][] = i === 0 ? [[10, 1, 50], [30, 0, 58], [52, 2, 46]] : [[6, 0, 46], [24, 2, 54], [46, 0, 58]];
  bolts.forEach(([x0, y0, len], k) => {
    const rnd = rng(9 + k * 7 + i * 31);
    let x = x0, y = y0;
    const pts: Pt[] = [[x, y]];
    let s = k % 2 ? 1 : -1;
    while (y < y0 + len) {
      x += s * (3 + rnd() * 4);
      y += 5 + rnd() * 4;
      s = -s;
      pts.push([Math.max(3, Math.min(w - 4, x)), Math.min(y, h - 3)]);
    }
    for (let j = 1; j < pts.length; j++) {
      const t = j / pts.length;
      const th = 2.2 * (1 - t * 0.55);
      line(g, pts[j - 1], pts[j], th + 1, B3);
    }
    for (let j = 1; j < pts.length; j++) {
      const t = j / pts.length;
      const th = 2.2 * (1 - t * 0.55);
      line(g, pts[j - 1], pts[j], th, B2);
      line(g, pts[j - 1], pts[j], th - 1.1, B1);
    }
  });
  // マンガのショック線(上から下りる縦線)
  for (let k = 0; k < 6; k++) {
    const x = 2 + ((k * 11 + i * 5) % 60);
    const len = 10 + ((k * 7 + i * 3) % 14);
    for (let y = 0; y < len; y++) if (!g.get(x, y)) g.px(x, y, y < len - 4 ? B2 : B3);
  }
});

// ---------- 「キラーン」の光 ----------
const kiran: FxMaker = (w, h, n) => frames(w, h, n, (g, i) => {
  const c = w / 2;
  const len = [6, 15, 13, 5][i];
  const diag = [0, 7, 9, 0][i];
  if (i === 2) ring(g, c, c, 10, 10, 1.2, () => Y);
  twinkle(g, c, c, len, diag);
  if (i >= 1) ellipse(g, c, c, i === 1 ? 2.8 : 2, i === 1 ? 2.8 : 2, W);
  if (i === 3) { g.px(4, 6, Y).px(27, 25, Y).px(26, 5, G); }
});

// ---------- 勝利ポーズの爆発 ----------
const explosion: FxMaker = (w, h, n) => {
  const rnd = rng(2024);
  const puffs = Array.from({ length: 16 }, (_, k) => ({
    a: k * 22.5 + rnd() * 18,
    d: 0.35 + rnd() * 0.55,
    r: 0.35 + rnd() * 0.3,
    up: rnd()
  }));
  return frames(w, h, n, (g, i) => {
    const cx = w / 2, cy = h / 2 + 5;
    const size = [12, 26, 33, 36, 38, 38][i];
    const heat = [1.6, 1.25, 0.95, 0.65, 0.35, 0.12][i];
    const rise = [0, 1, 3, 5, 7, 9][i];
    const shapes: { x: number; y: number; r: number }[] = [{ x: cx, y: cy - rise * 0.5, r: size * 0.55 }];
    for (const p of puffs) {
      const [x, y] = polar(cx, cy - rise * (0.5 + p.up), p.d * size * 0.75, p.a);
      shapes.push({ x, y: y - (p.a > 180 ? rise * 0.3 : 0), r: p.r * size * (i >= 4 ? 0.8 : 1) });
    }
    // 散っていくときの穴
    const hr = rng(5);
    const holes = Array.from({ length: 7 }, () => [cx + (hr() - 0.5) * 70, cy - rise + (hr() - 0.5) * 70, 4 + hr() * 6]);
    // 真ん中からの距離で熱さ(色)を決める
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = -1;
      for (const s of shapes) {
        const v = 1 - Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) / s.r;
        if (v > best) best = v;
      }
      if (best < 0) continue;
      const dc = Math.hypot(x + 0.5 - cx, (y + 0.5 - (cy - rise)) * 1.1) / (size * 0.95);
      const k = heat - dc + best * 0.35;
      let c: string;
      if (k > 0.95) c = W;
      else if (k > 0.72) c = Y;
      else if (k > 0.52) c = G;
      else if (k > 0.34) c = O;
      else if (k > 0.18) c = R;
      else if (k > 0.05) c = DR;
      else if (k > -0.2) c = best > 0.35 ? SM2 : SM3;
      else c = best > 0.5 ? SM1 : SM2;
      if (i === 5 && holes.some(([hx, hy, hr]) => Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < hr)) continue;
      g.px(x, y, c);
    }
    if (i >= 3) g.outline(SM3);
    // 飛び散る火の粉
    if (i >= 1 && i <= 4) {
      const sr = rng(77 + i);
      for (let k = 0; k < 10; k++) {
        const [x, y] = polar(cx, cy - rise, size * (0.95 + sr() * 0.3), sr() * 360);
        if (x < 1 || y < 1 || x > w - 2 || y > h - 2) continue;
        g.px(Math.round(x), Math.round(y), k % 2 ? Y : O);
        g.px(Math.round(x) + 1, Math.round(y), G);
      }
    }
  });
};

export const FX: Record<string, FxMaker> = {
  fx_hit: (w, _h, n) => hitSpark(w, n),
  fx_hit_big: (w, _h, n) => hitSpark(w, n),
  fx_dust: dust,
  fx_stars: dizzy,
  fx_debris: debris,
  fx_mark_stop: mark([md(7, 7, 4), md(7, 6, 1), md(6, 4, 0)]),
  fx_mark_go: mark([md(7, 3, 2), md(6, 1, 1), md(4, 0, 1)]),
  fx_shadow: shadow,
  fx_rubble: rubble,
  fx_aura: aura,
  fx_trail: trail,
  fx_punch: punchFx,
  fx_shockwave: shockwave,
  fx_beam: beam,
  fx_beam_head: beamHead,
  fx_sparkle: sparkle,
  fx_brake: brake,
  fx_gaan: gaan,
  fx_kiran: kiran,
  fx_explosion: explosion
};
