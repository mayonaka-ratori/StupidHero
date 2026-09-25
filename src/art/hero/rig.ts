// ヒーローの骨組み。ポーズの数字(関節の角度と位置)から1コマを描く。
// 角度は度。0 = 真下、90 = 前(右)、180 = 真上、-90 = 後ろ(左)。
// 絵の決まり(承認されたモック mocks/hero_art_src/idle2.py、punch2.py にそろえる):
// ふちは1ドットの黒っぽい色、光は左上から、色は3段(髪は4段)、はぐれた1ドットを残さない。
// 頭、こぶし、ブーツは太めに描き、頭は手で打った絵(heads.ts)を首の点に合わせて置く。
import { PixelGrid } from '../lib';
import { BLUE, HAIR4, HERO_KEYS, OUT, RED, SKIN, WHITE, type Ramp } from './palette';
import { HEADS, HEAD_NECK, HEAD_TAIL, type FaceId } from './heads';
import { stamp } from './sprite';

export type Hand = 'fist' | 'open' | 'flat' | 'point' | 'thumb';

/** 腕: a = 肩の角度、e = ひじの曲げ(前腕の角度 = a + e)、hand = 手の形、ha = 手の向き(省略時は前腕の向き)、fs = こぶしの大きさ(1が基本) */
export interface Arm { a: number; e: number; hand?: Hand; ha?: number; fs?: number }
/**
 * 脚: a = 股の角度(前に上げると+)、k = ひざの曲げ(すねの角度 = a - k)、f = 足先の向き(省略時はすねに直角。地面に立つ足は前向き)、
 * front = 足を正面から見た形(かかととつま先が同じ長さ)
 */
export interface Leg { a: number; k: number; f?: number; front?: boolean }
/** マント: a = なびく向き、len = 長さ、ph = 揺れの位相、w = すその幅、bend = しなり */
export interface Cape { a: number; len: number; ph: number; w?: number; bend?: number; amp?: number }
/** ポニーテール: a = 向き、ph = 揺れ */
export interface Tail { a: number; ph?: number; len?: number; curl?: number }
/** コマごとの手直し。(x, y) を左上に、HERO_KEYS の文字で打った絵を上から重ねる('.' と ' ' はそのまま、'_' で消す) */
export interface Fix { x: number; y: number; rows: string[] }

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
  /** 仕上げの手直し */
  fix?: Fix[];
}

type V = { x: number; y: number };
const rad = (d: number): number => (d * Math.PI) / 180;
const dir = (a: number): V => ({ x: Math.sin(rad(a)), y: Math.cos(rad(a)) });
const add = (p: V, q: V, s = 1): V => ({ x: p.x + q.x * s, y: p.y + q.y * s });
const sub = (p: V, q: V): V => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p: V, q: V): number => p.x * q.x + p.y * q.y;
const len = (p: V): number => Math.hypot(p.x, p.y);
const norm = (p: V): V => { const l = len(p) || 1; return { x: p.x / l, y: p.y / l }; };
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** 光の向き(光の来る方、左上) */
const LIGHT = norm({ x: -0.6, y: -0.8 });
/** 奥の手足の色(1段暗くする) */
const darker = (r: Ramp): Ramp => [r[1], r[2], r[2]];
/** 光の当たり具合 s から3段の色の番号 */
const shade3 = (s: number): 0 | 1 | 2 => (s > 0.25 ? 0 : s < -0.36 ? 2 : 1);

const BODY = {
  upper: 8,
  fore: 6.5,
  thigh: 13.3,
  shin: 12.2,
  ground: 59 // 足の裏の一番下のすぐ下の行(ここがふち)
};

type Paint = (t: number, s: number, x: number, y: number) => string | null;

/**
 * 太さが変わる棒を描く。t は a→b の割合、s は光の当たり方(-1〜1)。
 * caps = false のときは両端を丸めない(ブーツの口などに使う)
 */
function rod(g: PixelGrid, a: V, b: V, r0: number, r1: number, paint: Paint, caps = true, bias = 0): void {
  const rmax = Math.max(r0, r1);
  const x0 = Math.floor(Math.min(a.x, b.x) - rmax - 1), x1 = Math.ceil(Math.max(a.x, b.x) + rmax + 1);
  const y0 = Math.floor(Math.min(a.y, b.y) - rmax - 1), y1 = Math.ceil(Math.max(a.y, b.y) + rmax + 1);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-6;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const tr = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    if (!caps && (tr < 0 || tr > 1)) continue;
    const t = clamp01(tr);
    const cx = a.x + dx * t, cy = a.y + dy * t;
    const r = r0 + (r1 - r0) * t;
    const ox = px - cx, oy = py - cy;
    const d = Math.hypot(ox, oy);
    if (d > r) continue;
    const s = (ox * LIGHT.x + oy * LIGHT.y) / r + bias;
    const c = paint(t, s, x, y);
    if (c) g.px(x, y, c);
  }
}

const ramp = (r: Ramp): Paint => (_t, s) => r[shade3(s)];
const gold4 = (s: number, back: boolean): string =>
  back ? (s > 0.2 ? HAIR4[1] : s > -0.3 ? HAIR4[2] : HAIR4[3]) : (s > 0.45 ? HAIR4[0] : s > -0.05 ? HAIR4[1] : s > -0.45 ? HAIR4[2] : HAIR4[3]);

/** 角の丸い四角(こぶし)。c = 中心、d = 向き、ha = 向きの長さの半分、hc = 幅の半分 */
function box(g: PixelGrid, c: V, d: V, ha: number, hc: number, paint: (s: number, u: number, v: number, x: number, y: number) => string | null): void {
  const n = { x: -d.y, y: d.x };
  const R = Math.max(ha, hc) + 1;
  for (let y = Math.floor(c.y - R); y <= Math.ceil(c.y + R); y++) for (let x = Math.floor(c.x - R); x <= Math.ceil(c.x + R); x++) {
    const p = { x: x + 0.5 - c.x, y: y + 0.5 - c.y };
    const u = dot(p, d) / ha, v = dot(p, n) / hc;
    if (u ** 4 + v ** 4 > 1) continue;
    const s = (p.x * LIGHT.x + p.y * LIGHT.y) / Math.max(ha, hc);
    const col = paint(s, u, v, x, y);
    if (col) g.px(x, y, col);
  }
}

// ---------- 仕上げ(はぐれたドットとトゲを消して、ふちを付ける) ----------

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8: [number, number][] = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** まわり8ドットに同じ色がない1ドットを、まわりでいちばん多い色にする(白は残す) */
function despeckle(g: PixelGrid): void {
  const next = g.cells.map((r) => r.slice());
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.cells[y][x];
    if (!c || c === WHITE) continue;
    if (N8.some(([dx, dy]) => g.get(x + dx, y + dy) === c)) continue;
    const count = new Map<string, number>();
    for (const [dx, dy] of N4) {
      const n = g.get(x + dx, y + dy);
      if (n && n !== WHITE) count.set(n, (count.get(n) ?? 0) + 1);
    }
    let best: string | null = null, bn = 1;
    for (const [k, v] of count) if (v > bn) { best = k; bn = v; }
    if (best) next[y][x] = best;
  }
  for (let y = 0; y < g.h; y++) g.cells[y] = next[y];
}

/** 上下左右に1つしか仲間がいないドット(ふちにトゲができる)を消す */
function despike(g: PixelGrid): void {
  const del: [number, number][] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!g.cells[y][x]) continue;
    let n = 0;
    for (const [dx, dy] of N4) if (g.get(x + dx, y + dy)) n++;
    if (n <= 1) del.push([x, y]);
  }
  for (const [x, y] of del) g.cells[y][x] = null;
}

function clean(g: PixelGrid): void {
  despike(g);
  despeckle(g);
}

/** ふちを付けたときにコマの端にかかるか(ふちも端から1ドット離す) */
function touchesEdge(g: PixelGrid): boolean {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.cells[y][x] && (x < 2 || y < 2 || x > g.w - 3 || y > g.h - 3)) return true;
  }
  return false;
}

function composite(dst: PixelGrid, layer: PixelGrid): void {
  layer.outline(OUT);
  for (let y = 0; y < dst.h; y++) for (let x = 0; x < dst.w; x++) {
    const c = layer.cells[y][x];
    if (c) dst.cells[y][x] = c;
  }
}

// ---------- 部品 ----------

function drawHand(g: PixelGrid, wrist: V, arm: Arm, fa: number, back: boolean): void {
  const red = back ? darker(RED) : RED;
  const ha = arm.ha ?? fa;
  const hd = dir(ha);
  const fs = arm.fs ?? 1;
  switch (arm.hand ?? 'fist') {
    case 'fist': {
      // 手袋のこぶし。上に光、下のふちは影、まん中に指の筋
      const hl = 3.3 * fs, hc = 2.9 * fs;
      box(g, add(wrist, hd, hl - 0.4), hd, hl, hc, (s, u, v, x, y) => {
        if (s < -0.62) return red[2];
        if (s > 0.38) return red[0];
        if (fs >= 0.9 && Math.abs(v) < 0.2 && u > -0.4) return (x + y) % 2 ? red[0] : red[1];
        return red[1];
      });
      break;
    }
    case 'open': {
      rod(g, wrist, add(wrist, hd, 1.6), 2.2, 2.1, ramp(red));
      rod(g, add(wrist, hd, 1.8), add(wrist, hd, 4.2), 1.8, 1.4, ramp(red));
      // 親指
      rod(g, add(wrist, hd, 0.8), add(add(wrist, hd, 1.6), dir(ha - 90), 2.6), 1.0, 1.0, ramp(red));
      break;
    }
    case 'flat':
      rod(g, add(wrist, hd, 0.4), add(wrist, hd, 4.4), 1.8, 1.4, ramp(red));
      break;
    case 'point':
      box(g, add(wrist, hd, 2.0), hd, 2.4, 2.3, (s) => red[shade3(s)]);
      rod(g, add(wrist, hd, 3.5), add(wrist, hd, 6.8), 1.05, 1.0, ramp(red));
      break;
    case 'thumb':
      box(g, add(wrist, hd, 2.0), hd, 2.4, 2.4, (s) => red[shade3(s)]);
      rod(g, add(wrist, dir(ha + 90), 1.2), add(wrist, dir(ha + 150), 4.4), 1.0, 1.0, ramp(red));
      break;
  }
}

function drawArm(g: PixelGrid, sh: V, arm: Arm, back: boolean): void {
  const blue = back ? darker(BLUE) : BLUE;
  const el = add(sh, dir(arm.a), BODY.upper);
  const fa = arm.a + arm.e;
  const wrist = add(el, dir(fa), BODY.fore);
  rod(g, sh, el, 2.0, 1.8, ramp(blue));
  rod(g, el, wrist, 1.8, 1.8, ramp(blue));
  // 金の袖口(前腕の先の2ドット)
  const fd = dir(fa);
  rod(g, add(wrist, fd, -1.8), wrist, 2.3, 2.3, (_t, s) => gold4(s, back), false);
  drawHand(g, wrist, arm, fa, back);
}

interface LegJ { hip: V; knee: V; ankle: V; sd: V; fd: V }
function legJoints(hip: V, leg: Leg, f?: number): LegJ {
  const knee = add(hip, dir(leg.a), BODY.thigh);
  const sa = leg.a - leg.k;
  const ankle = add(knee, dir(sa), BODY.shin);
  const fa = leg.f ?? f ?? sa + 90;
  return { hip, knee, ankle, sd: dir(sa), fd: dir(fa) };
}

/** 足首から足の裏までの深さ */
const SOLE = 2.4;

/** 足(ブーツの足先)の形。かかと〜つま先の棒で、足の裏は平ら */
function footShape(j: LegJ, front: boolean): { heel: V; toe: V; nrm: V; r: number } {
  // 足の裏の向き:足先の向きに直角で、ひざと反対の側
  let nrm = { x: -j.fd.y, y: j.fd.x };
  if (dot(nrm, j.sd) < 0) nrm = { x: -nrm.x, y: -nrm.y };
  const heelL = front ? 3.0 : 1.8, toeL = front ? 3.0 : 4.4;
  return { heel: add(j.ankle, j.fd, -heelL), toe: add(j.ankle, j.fd, toeL), nrm, r: 2.7 };
}

function drawLeg(g: PixelGrid, j: LegJ, leg: Leg, back: boolean): void {
  const blue = back ? darker(BLUE) : BLUE;
  const bias = back ? -0.1 : 0;
  const ft = footShape(j, !!leg.front);
  // 足の裏より下は塗らない(足の裏を平らにする)
  const above = (x: number, y: number): boolean => dot(sub({ x: x + 0.5, y: y + 0.5 }, j.ankle), ft.nrm) <= SOLE;
  const boot = (_t: number, s: number, x: number, y: number): string | null => (above(x, y) ? RED[shade3(s + bias)] : null);
  // もも
  rod(g, j.hip, j.knee, 3.0, 2.4, ramp(blue), true, 0.12);
  // ブーツの筒(口は平ら)。足首に向かって太くなる
  const top = add(j.knee, j.sd, -0.6);
  rod(g, top, j.ankle, 3.1, 3.4, boot, false);
  rod(g, j.ankle, j.ankle, 3.4, 3.4, boot);
  // 足先
  const fd = norm(sub(ft.toe, ft.heel));
  const fl = len(sub(ft.toe, ft.heel));
  const x0 = Math.floor(Math.min(ft.heel.x, ft.toe.x) - 4), x1 = Math.ceil(Math.max(ft.heel.x, ft.toe.x) + 4);
  const y0 = Math.floor(Math.min(ft.heel.y, ft.toe.y) - 4), y1 = Math.ceil(Math.max(ft.heel.y, ft.toe.y) + 4);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = sub({ x: x + 0.5, y: y + 0.5 }, ft.heel);
    const along = Math.max(0, Math.min(fl, dot(p, fd)));
    const off = sub(p, { x: fd.x * along, y: fd.y * along });
    if (len(off) > ft.r || !above(x, y)) continue;
    const s = dot(off, LIGHT) / ft.r + bias;
    g.px(x, y, RED[shade3(s)]);
  }
  // 足の裏の1列は暗く
  for (let y = y0 - 4; y <= y1 + 4; y++) for (let x = x0 - 4; x <= x1 + 4; x++) {
    if (!g.get(x, y) || g.get(x, y) === blue[0] || g.get(x, y) === blue[1] || g.get(x, y) === blue[2]) continue;
    const dp = dot(sub({ x: x + 0.5, y: y + 0.5 }, j.ankle), ft.nrm);
    if (dp > SOLE - 1) g.px(x, y, RED[2]);
  }
  // ブーツの口の金の折り返し(少し太い)
  rod(g, top, add(top, j.sd, 1.4), 3.5, 3.5, (_t, s) => gold4(s, back), false);
  // 光の粒(白)
  const sh = add(add(top, j.sd, 1.4 + (BODY.shin - 2) * 0.55), { x: -j.sd.y, y: j.sd.x }, j.sd.y >= 0 ? 1.6 : -1.6);
  g.px(Math.floor(sh.x), Math.floor(sh.y), WHITE);
}

function drawCape(g: PixelGrid, n: V, c: Cape, floor: number): void {
  const d = dir(c.a);
  const s = { x: -d.y, y: d.x };
  const w0 = 2.6, w1 = c.w ?? 8, bend = c.bend ?? 0, amp = c.amp ?? 1.4;
  const folds = 1.0 + w1 / 7; // ひだの数
  for (let y = 0; y < Math.min(g.h, floor); y++) for (let x = 0; x < g.w; x++) {
    const rx = x + 0.5 - n.x, ry = y + 0.5 - n.y;
    const v = rx * d.x + ry * d.y;
    if (v < -1.5) continue;
    const t = clamp01(v / c.len);
    const u = rx * s.x + ry * s.y - bend * t * t;
    const half = w0 + (w1 - w0) * Math.sqrt(t);
    if (Math.abs(u) > half) continue;
    // ひだ:首から扇に広がる帯。山の手前が明るく、谷が暗い
    const phi = ((u / half) * folds) / 2 + c.ph * 0.16 + 10;
    const fr = phi - Math.floor(phi);
    const tip = c.len + amp * Math.cos(fr * Math.PI * 2);
    if (v > tip) continue;
    // 外側のふちは裏地がのぞいて暗い
    const rim = u > half - 0.9;
    let col: string;
    if (rim) col = RED[2];
    else if (fr < 0.3) col = RED[0];
    else if (fr > 0.72 && u < half - 2) col = RED[2];
    else col = RED[1];
    // 首の近くは細いので、ひだを弱める
    if (t < 0.12 && col === RED[2] && !rim) col = RED[1];
    g.px(x, y, col);
  }
}

function drawTail(g: PixelGrid, base: V, tl: Tail): void {
  const n = tl.len ?? 9;
  let p = base;
  const ph = tl.ph ?? 0;
  // 後ろ下へ垂れる向きのときは、付け根で後ろへはね、先で下へ垂れる(省略時)
  const droop = tl.a < 0 ? 80 * Math.max(0, Math.cos(rad(tl.a))) : 0;
  const curl = tl.curl ?? (2 * droop) / n;
  // 垂れる髪は太く、なびく髪は細め
  const r0 = 2.5 + droop / 110;
  // なびく髪は大きく波打つ
  const wob = 6 + 9 * (1 - droop / 80);
  const pts: [V, V, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = tl.a - (tl.curl === undefined ? droop : 0) + Math.sin(i * 0.8 + ph) * wob + curl * i;
    const r = r0 * (1 - (0.7 * i) / n);
    const q = add(p, dir(a), 1.5);
    pts.push([p, q, r, r - 0.2]);
    p = q;
  }
  for (const [a, b, r0, r1] of pts) rod(g, a, b, r0, r1, (_t, s) => (s > 0.5 ? HAIR4[0] : s > 0.05 ? HAIR4[1] : s > -0.45 ? HAIR4[2] : HAIR4[3]), true);
}

// 胴の形: 腰からの高さ w ごとの左右の幅 [後ろ, 前]。w < 4.5 がスカート、4.5〜5.5 がベルト
const TORSO: [number, number, number][] = [
  [-0.5, -8.6, 8.6],
  [1.5, -8.2, 8.4],
  [2.2, -7.4, 8.0],
  [3.0, -5.6, 5.0],
  [4.4, -5.0, 4.6],
  [4.5, -4.6, 4.7],
  [5.5, -4.5, 4.6],
  [6.0, -3.7, 4.5],
  [8.4, -3.7, 4.5],
  [9.0, -4.6, 5.5],
  [10.5, -4.7, 5.6],
  [11.0, -5.6, 6.6],
  [12.0, -6.6, 7.5],
  [13.6, -6.6, 7.6],
  [14.2, -5.4, 6.4]
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

/** 胴の座標。u = 横(前が+)、w = 腰からの高さ。傾きが小さいときは横の行を水平のまま保つ(ずらすだけ) */
interface BodyFrame { L: (u: number, w: number) => V; inv: (px: number, py: number) => { u: number; w: number } }
function bodyFrame(H: V, lean: number, k: number): BodyFrame {
  if (Math.abs(lean) <= 20) {
    const t = Math.tan(rad(lean));
    return {
      L: (u, w) => ({ x: H.x + u + w * k * t, y: H.y - w * k }),
      inv: (px, py) => { const w = (H.y - py) / k; return { u: px - H.x - w * k * t, w }; }
    };
  }
  const up = { x: Math.sin(rad(lean)), y: -Math.cos(rad(lean)) };
  const right = { x: Math.cos(rad(lean)), y: Math.sin(rad(lean)) };
  return {
    L: (u, w) => ({ x: H.x + right.x * u + up.x * w * k, y: H.y + right.y * u + up.y * w * k }),
    inv: (px, py) => { const rx = px - H.x, ry = py - H.y; return { u: rx * right.x + ry * right.y, w: (rx * up.x + ry * up.y) / k }; }
  };
}

const STAR = [
  '..1..',
  '11H11',
  '.121.',
  '.2.2.'
];

function drawTorso(g: PixelGrid, F: BodyFrame): void {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const { u, w } = F.inv(x + 0.5, y + 0.5);
    const ext = torsoWidth(w);
    if (!ext) continue;
    const [l, r] = ext;
    if (u < l || u > r) continue;
    const n = (u - (l + r) / 2) / ((r - l) / 2); // -1(後ろ、光の側)〜1(前、影の側)
    let col: string;
    if (w < 4.5) {
      // スカート:腰から広がるひだ。ひだの左はしが明るく、右はしが暗い
      const p = (u - l) / (r - l);
      const f = p * 3.2 + 0.05;
      const fr = f - Math.floor(f);
      col = fr < 0.22 ? RED[0] : fr > 0.78 ? RED[2] : RED[1];
      if (n > 0.8) col = RED[2];
      if (w < 0.5 && fr > 0.45 && fr < 0.6) col = RED[2]; // すそのひだの折り目
    } else if (w < 5.5) {
      // 金のベルト
      col = n > 0.78 ? HAIR4[2] : Math.abs(n + 0.72) < 0.13 || Math.abs(n - 0.4) < 0.12 ? HAIR4[0] : HAIR4[1];
    } else {
      let s = n < -0.78 ? 0 : n > 0.66 ? 2 : 1;
      if (w > 10.8 && n < -0.45) s = 0; // 肩に光
      if (w > 12.3 && n < -0.2) s = 0;
      col = BLUE[s];
    }
    g.px(x, y, col);
  }
}

function drawTorsoMarks(g: PixelGrid, F: BodyFrame): void {
  // 胸の星(傾けず、胸の位置に置く)
  const c = F.L(1.0, 10.1);
  stamp(g, STAR, HERO_KEYS, Math.round(c.x - 2.5), Math.round(c.y - 2), false);
}

// ---------- 組み立て ----------

export function renderPose(p: Pose, size = 64): PixelGrid {
  const lean = p.lean;
  const k = 1 - (p.squash ?? 0);
  let H: V = { x: p.x ?? 31.5, y: p.y ?? 30 };
  const L = (u: number, w: number): V => bodyFrame(H, lean, k).L(u, w);
  const grounded = p.ground !== false;

  // 地面に立つときは、低い方の足を平らに置く
  let fF: number | undefined, fB: number | undefined;
  if (grounded) {
    const aF = legJoints(L(-2.8, 1.2), p.lf).ankle.y, aB = legJoints(L(3.4, 1.2), p.lb).ankle.y;
    const lo = Math.max(aF, aB);
    if (aF > lo - 2.5) fF = 90;
    if (aB > lo - 2.5) fB = 90;
  }
  const legs = (): [LegJ, LegJ] => [legJoints(L(-2.8, 1.2), p.lf, fF), legJoints(L(3.4, 1.2), p.lb, fB)];

  const legLow = (j: LegJ, leg: Leg, back: boolean): number => {
    const tmp = new PixelGrid(size, size * 2);
    drawLeg(tmp, j, leg, back);
    clean(tmp);
    let low = -1;
    for (let y = 0; y < tmp.h; y++) if (tmp.cells[y].some((c) => c)) low = y;
    return low;
  };
  let [jF, jB] = legs();
  if (grounded) {
    // 足の一番下の行を地面のすぐ上にそろえる
    const lowF = legLow(jF, p.lf, false), lowB = legLow(jB, p.lb, true);
    const dy = BODY.ground - 1 - Math.max(lowF, lowB);
    H = { x: H.x, y: H.y + dy };
    [jF, jB] = legs();
    // 立っている足がもう片方より少し浮くときは、すねを伸ばして地面に着ける
    const snap = (j: LegJ, low: number, planted: boolean): LegJ => {
      const gap = BODY.ground - 1 - (low + dy);
      return planted && gap > 0 && gap <= 3 ? { ...j, ankle: { x: j.ankle.x, y: j.ankle.y + gap } } : j;
    };
    jF = snap(jF, lowF, fF !== undefined);
    jB = snap(jB, lowB, fB !== undefined);
  }

  // 横向きに近いほど(前のめりほど)肩を胴のまん中へ寄せ、少し下げる(腕が顔にかぶらないように)
  const side = Math.min(1, Math.abs(lean) / 25);
  const drop = Math.max(0, lean) * 0.09;
  const shF = L(-5.6 * (1 - 0.5 * side), 12.5 - drop), shB = L(5.6 * (1 - 0.5 * side), 12.7 - drop);
  const neckBase = L(1.5, 15.2);
  const neckTop = L(1.5, 16);
  const capeN = L(-5.2, 14.2);

  const rel = (a: Arm): Arm => (p.armRel ? { ...a, a: a.a - lean, ha: a.ha === undefined ? undefined : a.ha - lean } : a);
  const af = rel(p.af), ab = rel(p.ab);
  const out = new PixelGrid(size, size);
  const layer = (): PixelGrid => new PixelGrid(size, size);
  const put = (draw: (g: PixelGrid) => void, after?: (g: PixelGrid) => void, tidy = true): void => {
    const g = layer();
    draw(g);
    if (tidy) clean(g);
    else despike(g);
    after?.(g);
    composite(out, g);
  };

  put((g) => {
    // マントがコマの外にはみ出すときは、収まるまで短く細くする(端で切れた形にしない)
    let c = p.cape;
    for (let n = 0; n < 12; n++) {
      g.cells.forEach((row) => row.fill(null));
      drawCape(g, capeN, c, grounded ? BODY.ground : size);
      if (!touchesEdge(g)) break;
      c = { ...c, len: c.len - 1.2, w: (c.w ?? 8) * 0.96 };
    }
  });
  if (!p.abFront) put((g) => drawArm(g, shB, ab, true));
  put((g) => drawLeg(g, jB, p.lb, true));
  put((g) => drawLeg(g, jF, p.lf, false));

  // 頭の位置:頭の表の首の点を、首の上の点に合わせる
  const hx = p.hx ?? 0, hy = p.hy ?? 0;
  const headX = Math.round(neckTop.x + hx - HEAD_NECK.x);
  const headY = Math.round(neckTop.y + hy - HEAD_NECK.y);
  const tail = p.tail ?? { a: -40 };
  put((g) => {
    drawTail(g, { x: headX + HEAD_TAIL.x, y: headY + HEAD_TAIL.y }, tail);
  }, (g) => {
    // 髪ゴム
    const tx = headX + HEAD_TAIL.x, ty = headY + HEAD_TAIL.y;
    g.px(Math.floor(tx) - 1, Math.floor(ty) - 1, RED[0]);
    g.px(Math.floor(tx), Math.floor(ty) - 1, RED[1]);
    g.px(Math.floor(tx) - 1, Math.floor(ty), RED[1]);
    g.px(Math.floor(tx), Math.floor(ty), RED[2]);
  });

  // 胴の模様(ベルトのつや、スカートのひだ)は1ドットの細かさで描くので、はぐれたドットの掃除はしない
  put((g) => drawTorso(g, bodyFrame(H, lean, k)), (g) => drawTorsoMarks(g, bodyFrame(H, lean, k)), false);
  if (p.abFront) put((g) => drawArm(g, shB, ab, true));
  if (p.afBehindHead) put((g) => drawArm(g, shF, af, false));

  // 首と頭。首の芯は頭の首の点まで通す(あごと首がずれないように)
  const neckEnd = { x: headX + HEAD_NECK.x, y: headY + HEAD_NECK.y };
  put((g) => {
    rod(g, neckBase, neckEnd, 2.0, 2.0, (_t, _s, x) => (x + 0.5 < neckEnd.x - 1 ? SKIN[2] : SKIN[1]));
  }, (g) => {
    stamp(g, HEADS[p.face], HERO_KEYS, headX, headY);
  });

  if (!p.afBehindHead) put((g) => drawArm(g, shF, af, false));

  // 重ねた部品のすきまにのぞく1ドット(3方をふちに囲まれたもの)は、ふちにする。頭の中(口など)は除く
  const hw = HEADS[p.face][0].length, hh = HEADS[p.face].length;
  seal(out, (x, y) => x >= headX && x < headX + hw && y >= headY && y < headY + hh);

  for (const f of p.fix ?? []) applyFix(out, f);
  return out;
}

function seal(g: PixelGrid, keep: (x: number, y: number) => boolean): void {
  const hit: [number, number][] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.cells[y][x];
    if (!c || c === OUT || c === WHITE || keep(x, y)) continue;
    let n = 0;
    for (const [dx, dy] of N4) if (g.get(x + dx, y + dy) === OUT) n++;
    if (n >= 3) hit.push([x, y]);
  }
  for (const [x, y] of hit) g.cells[y][x] = OUT;
}

function applyFix(g: PixelGrid, f: Fix): void {
  f.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ' ' || ch === '.') continue;
      if (ch === '_') { g.px(f.x + i, f.y + j, null); continue; }
      const c = HERO_KEYS[ch];
      if (!c) throw new Error(`fix: unknown key '${ch}'`);
      g.px(f.x + i, f.y + j, c);
    }
  });
}
