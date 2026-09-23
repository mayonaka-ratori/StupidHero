// ヒーローの骨組み。ポーズの数字(関節の角度と位置)から1コマを描く。
// 角度は度。0 = 真下、90 = 前(右)、180 = 真上、-90 = 後ろ(左)。
import { PixelGrid } from '../lib';
import { BLUE, HAIR, HERO_KEYS, OUT, RED, SKIN, type Ramp } from './palette';
import { HEADS, HEAD_NECK, HEAD_TAIL, type FaceId } from './heads';
import { stamp } from './sprite';

export type Hand = 'fist' | 'open' | 'flat' | 'point' | 'thumb';

/** 腕: a = 肩の角度、e = ひじの曲げ(前腕の角度 = a + e)、hand = 手の形、ha = 手の向き(省略時は前腕の向き) */
export interface Arm { a: number; e: number; hand?: Hand; ha?: number }
/** 脚: a = 股の角度(前に上げると+)、k = ひざの曲げ(すねの角度 = a - k)、f = 足先の向き(省略時はすねに直角) */
export interface Leg { a: number; k: number; f?: number }
/** マント: a = なびく向き、len = 長さ、ph = 揺れの位相、w = すその幅、bend = しなり */
export interface Cape { a: number; len: number; ph: number; w?: number; bend?: number; amp?: number }
/** ポニーテール: a = 向き、ph = 揺れ */
export interface Tail { a: number; ph?: number; len?: number; curl?: number }

export interface Pose {
  /** 腰の位置。ground のときは y を足から自動で決める */
  x?: number;
  y?: number;
  /** 地面に立っているか(既定 true)。false のときは y をそのまま使う(空中) */
  ground?: boolean;
  /** 胴の傾き(+で前のめり) */
  lean: number;
  face: FaceId;
  /** 頭のずらし */
  hx?: number;
  hy?: number;
  af: Arm;
  ab: Arm;
  lf: Leg;
  lb: Leg;
  cape: Cape;
  tail?: Tail;
  /** 奥の腕を胴より手前に描く(腕組みなど) */
  abFront?: boolean;
  /** 手前の腕を頭より奥に描く */
  afBehindHead?: boolean;
  /** 胴の高さを縮める(しゃがみのつぶれ) */
  squash?: number;
  /** 腕の角度を胴の傾きからの角度として読む */
  armRel?: boolean;
}

type V = { x: number; y: number };
const rad = (d: number): number => (d * Math.PI) / 180;
export const dir = (a: number): V => ({ x: Math.sin(rad(a)), y: Math.cos(rad(a)) });
const add = (p: V, q: V, s = 1): V => ({ x: p.x + q.x * s, y: p.y + q.y * s });
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** 光の向き(光の来る方、左上) */
const LIGHT = { x: -0.6, y: -0.8 };
const darker = (r: Ramp): Ramp => [r[1], r[2], r[2]];

export const BODY = {
  /** 胴の縦の伸ばし */
  torsoK: 1.1,
  upper: 7.5,
  fore: 6.5,
  thigh: 13.5,
  shin: 13,
  ground: 59 // 足の裏の一番下(この行のすぐ上までが足、ふちがこの行)
};

type Paint = (t: number, shade: 0 | 1 | 2) => string | null;

/** 太さが変わる棒を描く。t は a→b の割合、shade は光の当たり方 */
function capsule(g: PixelGrid, a: V, b: V, r0: number, r1: number, paint: Paint, lightBias = 0): void {
  const rmax = Math.max(r0, r1);
  const x0 = Math.floor(Math.min(a.x, b.x) - rmax - 1), x1 = Math.ceil(Math.max(a.x, b.x) + rmax + 1);
  const y0 = Math.floor(Math.min(a.y, b.y) - rmax - 1), y1 = Math.ceil(Math.max(a.y, b.y) + rmax + 1);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-6;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const t = clamp01(((px - a.x) * dx + (py - a.y) * dy) / len2);
    const cx = a.x + dx * t, cy = a.y + dy * t;
    const r = r0 + (r1 - r0) * t;
    const ox = px - cx, oy = py - cy;
    const d = Math.hypot(ox, oy);
    if (d > r) continue;
    const s = d < 1e-6 ? 0 : ((ox * LIGHT.x + oy * LIGHT.y) / r) + lightBias;
    const shade: 0 | 1 | 2 = s > 0.32 ? 0 : s < -0.3 ? 2 : 1;
    const c = paint(t, shade);
    if (c) g.px(x, y, c);
  }
}

const ramp = (r: Ramp): Paint => (_t, s) => r[s];

function disk(g: PixelGrid, c: V, r: number, rp: Ramp): void {
  capsule(g, c, c, r, r, ramp(rp));
}

// ---------- 部品 ----------

function drawArm(g: PixelGrid, sh: V, arm: Arm, back: boolean): V {
  const blue = back ? darker(BLUE) : BLUE;
  const red = back ? darker(RED) : RED;
  const gold = back ? darker(HAIR) : HAIR;
  const el = add(sh, dir(arm.a), BODY.upper);
  const fa = arm.a + arm.e;
  const hand = add(el, dir(fa), BODY.fore);
  capsule(g, sh, el, 1.9, 1.5, ramp(blue));
  capsule(g, el, hand, 1.5, 1.6, (t, s) => (t < 0.3 ? blue[s] : t < 0.48 ? gold[s] : red[s]));
  const ha = arm.ha ?? fa;
  const hd = dir(ha);
  switch (arm.hand ?? 'fist') {
    case 'fist':
      disk(g, add(hand, hd, 0.8), 2.1, red);
      break;
    case 'open': {
      disk(g, add(hand, hd, 0.6), 1.7, red);
      capsule(g, add(hand, hd, 1), add(hand, hd, 3.6), 1.4, 1.1, ramp(red));
      // 親指
      capsule(g, add(hand, hd, 0.5), add(add(hand, hd, 1.2), dir(ha - 90), 2.2), 0.8, 0.8, ramp(red));
      break;
    }
    case 'flat':
      capsule(g, add(hand, hd, 0.3), add(hand, hd, 3.8), 1.3, 1.0, ramp(red));
      break;
    case 'point':
      disk(g, add(hand, hd, 0.6), 1.9, red);
      capsule(g, add(hand, hd, 1.5), add(hand, hd, 4.5), 0.75, 0.75, ramp(red));
      break;
    case 'thumb':
      disk(g, add(hand, hd, 0.6), 2.0, red);
      capsule(g, add(hand, dir(ha + 90), 1.2), add(hand, dir(ha + 150), 3.8), 0.8, 0.8, ramp(red));
      break;
  }
  return hand;
}

function legJoints(hip: V, leg: Leg): { knee: V; ankle: V; heel: V; toe: V } {
  const knee = add(hip, dir(leg.a), BODY.thigh);
  const sa = leg.a - leg.k;
  const ankle = add(knee, dir(sa), BODY.shin);
  const fa = leg.f ?? sa + 90;
  const fd = dir(fa);
  return { knee, ankle, heel: add(ankle, fd, -1), toe: add(ankle, fd, 2.9) };
}
const FOOT_R = 1.7;

function drawLeg(g: PixelGrid, hip: V, leg: Leg, back: boolean): void {
  const blue = back ? darker(BLUE) : BLUE;
  const red = back ? darker(RED) : RED;
  const gold = back ? darker(HAIR) : HAIR;
  const j = legJoints(hip, leg);
  capsule(g, hip, j.knee, 2.6, 2.1, ramp(blue));
  capsule(g, j.knee, j.ankle, 2.1, 1.7, (t, s) => (t < 0.28 ? blue[s] : t < 0.4 ? gold[s] : red[s]));
  // ブーツの折り返しを少し太く
  const cuff = add(j.knee, dir(leg.a - leg.k), BODY.shin * 0.4);
  disk(g, cuff, 2.3, red);
  capsule(g, j.heel, j.toe, FOOT_R, FOOT_R, ramp(red));
}

function drawCape(g: PixelGrid, n: V, c: Cape, floor: number): void {
  const d = dir(c.a);
  const s = { x: -d.y, y: d.x };
  const w0 = 2.5, w1 = c.w ?? 7.5, bend = c.bend ?? 0, amp = c.amp ?? 1.2;
  const R = RED;
  for (let y = 0; y < Math.min(g.h, floor); y++) for (let x = 1; x < g.w - 1; x++) {
    const rx = x + 0.5 - n.x, ry = y + 0.5 - n.y;
    const v = rx * d.x + ry * d.y;
    if (v < -1) continue;
    const t = clamp01(v / c.len);
    const u = rx * s.x + ry * s.y - bend * t * t;
    const half = w0 + (w1 - w0) * Math.sqrt(t);
    if (Math.abs(u) > half) continue;
    const tip = c.len + amp * Math.sin(u * 1.1 + c.ph);
    if (v > tip) continue;
    const fold = Math.sin(u * 1.05 + c.ph * 0.8 - v * 0.12);
    // 左上からの光:外側(u の符号で左右が変わる)ほど明るさを変える
    const side = (u * (s.x * LIGHT.x + s.y * LIGHT.y)) / half;
    const k = fold * 0.8 + side * 0.6;
    const col = k > 0.55 ? R[0] : k < -0.35 ? R[2] : R[1];
    g.px(x, y, col);
  }
}

function drawTail(g: PixelGrid, base: V, tl: Tail): void {
  const n = tl.len ?? 7;
  let p = base;
  const ph = tl.ph ?? 0;
  const curl = tl.curl ?? 0;
  for (let i = 0; i < n; i++) {
    const a = tl.a + Math.sin(i * 0.8 + ph) * 18 + curl * i;
    const r = 2.3 - (1.5 * i) / n;
    capsule(g, p, add(p, dir(a), 1.4), r, r - 0.15, ramp(HAIR), 0.15);
    p = add(p, dir(a), 1.4);
  }
}

// 胴の形: 腰からの高さ w ごとの左右の幅 [後ろ, 前]
const TORSO: [number, number, number][] = [
  [-3.2, -5.4, 5.2],
  [-2, -5, 5],
  [-1, -4.6, 4.6],
  [0, -4.1, 4.1],
  [1, -3.7, 3.7],
  [2, -3.4, 3.4],
  [3, -3.0, 3.1],
  [4, -2.9, 3.0],
  [5, -3.0, 3.4],
  [6, -3.4, 4.2],
  [7, -3.8, 4.5],
  [8, -4.1, 4.2],
  [9, -4.3, 3.9],
  [10, -4.0, 3.4],
  [10.8, -2.6, 2.2]
];

function torsoWidth(w: number): [number, number] | null {
  if (w < TORSO[0][0] || w > TORSO[TORSO.length - 1][0]) return null;
  for (let i = 0; i < TORSO.length - 1; i++) {
    const [w0, l0, r0] = TORSO[i];
    const [w1, l1, r1] = TORSO[i + 1];
    if (w >= w0 && w <= w1) {
      const t = (w - w0) / (w1 - w0);
      return [l0 + (l1 - l0) * t, r0 + (r1 - r0) * t];
    }
  }
  return null;
}

const STAR = [
  '..1..',
  '11211',
  '.212.',
  '.2.2.'
];

function drawTorso(g: PixelGrid, H: V, lean: number, squash: number): V {
  const up = { x: Math.sin(rad(lean)), y: -Math.cos(rad(lean)) };
  const right = { x: Math.cos(rad(lean)), y: Math.sin(rad(lean)) };
  const k = BODY.torsoK * (1 - squash);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const rx = x + 0.5 - H.x, ry = y + 0.5 - H.y;
    const u = rx * right.x + ry * right.y;
    const w = (rx * up.x + ry * up.y) / k;
    const ext = torsoWidth(w);
    if (!ext) continue;
    const [l, r] = ext;
    if (u < l || u > r) continue;
    const n = (u - (l + r) / 2) / ((r - l) / 2); // -1(後ろ)〜1(前)
    let s: 0 | 1 | 2 = n < -0.45 ? 0 : n > 0.5 ? 2 : 1;
    let col: string;
    if (w < 0.2) {
      // スカート:ひだ
      const pleat = Math.floor(u + 20) % 3;
      if (s === 1 && pleat === 0) s = 2;
      if (w < -2.4 && s === 0) s = 1;
      col = RED[s];
    } else if (w < 2.0) {
      col = HAIR[s];
    } else {
      if (w > 9.2 && s === 1 && n < 0.1) s = 0; // 肩に光
      if (w > 4.6 && w < 5.6 && n > 0) s = 2; // 胸の下の影
      col = BLUE[s];
    }
    g.px(x, y, col);
  }
  // 胸の星(傾けず、胸の位置に置く)
  const c = add(add(H, up, 7.6 * k), right, 0.9);
  stamp(g, STAR, HERO_KEYS, Math.round(c.x - 2.5), Math.round(c.y - 2), false);
  // ベルトのバックル
  const bk = add(add(H, up, 1.1 * k), right, 1.2);
  g.px(Math.floor(bk.x), Math.floor(bk.y), HAIR[0]);
  return up;
}

// ---------- 組み立て ----------

function composite(dst: PixelGrid, layer: PixelGrid): void {
  layer.outline(OUT);
  for (let y = 0; y < dst.h; y++) for (let x = 0; x < dst.w; x++) {
    const c = layer.cells[y][x];
    if (c) dst.cells[y][x] = c;
  }
}

export function renderPose(p: Pose, size = 64): PixelGrid {
  const lean = p.lean;
  const squash = p.squash ?? 0;
  const tk = BODY.torsoK * (1 - squash);
  let H: V = { x: p.x ?? 32, y: p.y ?? 30 };
  const up = { x: Math.sin(rad(lean)), y: -Math.cos(rad(lean)) };
  const right = { x: Math.cos(rad(lean)), y: Math.sin(rad(lean)) };
  const L = (u: number, w: number): V => ({ x: H.x + right.x * u + up.x * w * tk, y: H.y + right.y * u + up.y * w * tk });

  if (p.ground !== false) {
    // 低い方の足の裏を地面にそろえる
    const bottoms = [
      legJoints(L(-1, -0.5), p.lf),
      legJoints(L(1.4, -0.5), p.lb)
    ].map((j) => Math.max(j.heel.y, j.toe.y) + FOOT_R);
    const low = Math.max(...bottoms);
    H = { x: H.x, y: H.y + (BODY.ground - low) };
  }

  const shF = L(-0.8, 9.6), shB = L(1.6, 9.6);
  const hipF = L(-1, -0.5), hipB = L(1.4, -0.5);
  const neck = L(0.4, 11.2);
  const capeN = L(-2.2, 10.2);

  const rel = (a: Arm): Arm => (p.armRel ? { ...a, a: a.a - lean, ha: a.ha === undefined ? undefined : a.ha - lean } : a);
  const af = rel(p.af), ab = rel(p.ab);
  const out = new PixelGrid(size, size);
  const layer = (): PixelGrid => new PixelGrid(size, size);

  let g = layer();
  drawCape(g, capeN, p.cape, p.ground === false ? size : BODY.ground);
  composite(out, g);

  if (!p.abFront) { g = layer(); drawArm(g, shB, ab, true); composite(out, g); }
  g = layer(); drawLeg(g, hipB, p.lb, true); composite(out, g);
  g = layer(); drawLeg(g, hipF, p.lf, false); composite(out, g);

  const headX = Math.round(neck.x + (p.hx ?? 0) - HEAD_NECK.x);
  const headY = Math.round(neck.y + (p.hy ?? 0) - HEAD_NECK.y);
  const tail = p.tail ?? { a: -40 };
  g = layer(); drawTail(g, { x: headX + HEAD_TAIL.x + 0.5, y: headY + HEAD_TAIL.y + 0.5 }, tail); composite(out, g);

  g = layer(); drawTorso(g, H, lean, squash); composite(out, g);
  if (p.abFront) { g = layer(); drawArm(g, shB, ab, true); composite(out, g); }
  if (p.afBehindHead) { g = layer(); drawArm(g, shF, af, false); composite(out, g); }

  g = layer();
  capsule(g, L(0.3, 9.5), { x: neck.x + (p.hx ?? 0) * 0.5, y: neck.y + (p.hy ?? 0) * 0.5 - 0.5 }, 1.4, 1.4, (_t, s) => (s === 0 ? SKIN[1] : SKIN[2]));
  stamp(g, HEADS[p.face], HERO_KEYS, headX, headY);
  composite(out, g);

  if (!p.afBehindHead) { g = layer(); drawArm(g, shF, af, false); composite(out, g); }
  return out;
}
