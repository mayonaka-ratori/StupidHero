// 人の形を、関節の位置(Pose)と見た目(Look)から描く仕組み。
// 64×64 のコマの中の座標で描く。右向き。足の裏は y=59(コマの下から4ドット上の線の上)。
import { OUTLINE, PixelGrid } from '../lib';
import { Mask, Painter, type Pt, type Ramp, add, mix } from './pix';
import { WHITE } from './palette';

export interface Arm {
  /** ひじ */
  e: Pt;
  /** 手の真ん中 */
  h: Pt;
  /** 手を描かない(物で隠れるとき) */
  noHand?: boolean;
}
export interface Leg {
  /** ひざ */
  k: Pt;
  /** 足首 */
  a: Pt;
  /** つま先の向き(ラジアン。0で右、正で下へ) */
  toe?: number;
}
export type Face = 'normal' | 'worried' | 'surprised' | 'hurt' | 'ko' | 'angry' | 'grin' | 'sly' | 'shut';

export interface Pose {
  /** あごの下の、首がつながるところ */
  head: Pt;
  face: Face;
  /** -1 で後ろ(左)を向く */
  look?: 1 | -1;
  /** 下を向く(目を1ドット下げる) */
  down?: boolean;
  /** 胴の上の真ん中(首のつけ根) */
  neck: Pt;
  /** 腰の真ん中(脚のつけ根の高さ) */
  hip: Pt;
  aB: Arm;
  aF: Arm;
  lB: Leg;
  lF: Leg;
  /** 汗を描く */
  sweat?: boolean;
}

export interface Build {
  /** 肩の半分の幅 */
  sh: number;
  /** 腰の半分の幅 */
  wa: number;
  arm: number;
  thigh: number;
  shin: number;
  /** 上着のすその位置(腰からの差。+で下) */
  hem: number;
  /** 胸の出っぱり */
  chest: number;
  /** 肩、腰、手、靴、首の大きさの倍率(ボス用。ふつうは1) */
  scale?: number;
}

export interface Look {
  skin: Ramp;
  hair: Ramp;
  hairStyle: HairStyle;
  top: Ramp;
  sleeve: 'long' | 'short' | 'none' | 'rolled';
  bottom: Ramp;
  legs: 'pants' | 'longskirt';
  shoes: Ramp;
  /** 靴の底の色 */
  sole?: string;
  build: Build;
  /** 胴の模様(ジッパー、ネクタイなど) */
  torso?(P: Painter, pose: Pose, top: Mask): void;
  /** 顔に足すもの(めがね、傷) */
  headExtra?(g: PixelGrid, pose: Pose): void;
  /** 何より後ろ */
  behind?(P: Painter, pose: Pose): void;
  /** 胴の上、頭と手前の腕の下 */
  mid?(P: Painter, pose: Pose): void;
  /** いちばん手前 */
  front?(P: Painter, pose: Pose): void;
  /** 奥の腕のあと、奥の脚の前 */
  farHand?(P: Painter, pose: Pose): void;
  /** 手前の袖口の色(シャツのそでなど) */
  cuff?: string;
  /** 首の長さの差 */
  neckLen?: number;
  /** 頭を自分で描く(ボス用) */
  customHead?(pose: Pose): { g: PixelGrid; nx: number; ny: number };
  /** 汗の色(null で描かない) */
  sweat?: string | null;
}

const dark = (r: Ramp): Ramp => [r[1], r[2], r[2]];

// ---------- 頭 ----------

/** 頭のドット(右向き)。S s d:肌、H h k:髪、e:目(ふち色)、m:口 */
const FACE = [
  '....SSSSS....',
  '..SSSSSSSSS..',
  '.SSSSSSSSSSS.',
  '.SSSSSSSSSSS.',
  '.SSSSSSSSSSS.',
  '.SSSSSSSSSSSS',
  '.sSSSSSSSSSSs',
  '.ssSSSSSSSSS.',
  '..ssSSSSSSSs.',
  '...ssSSSSSs..',
  '.....ssss....'
];
/** 首がつながる点(頭の格子の中) */
const NECK_COL = 5;
const HEAD_ROWS = FACE.length;

export interface HairStyle {
  /** 顔の上に重ねる髪。上にはみ出す行は top 行ぶん */
  rows: string[];
  top: number;
  /** 耳を描くか */
  ear?: boolean;
}

export const HAIR_SHORT: HairStyle = {
  top: 1,
  ear: true,
  rows: [
    '....hHh.h....',
    '...hhHHhhh...',
    '..hHHHhhhhhh.',
    '.hHHhhhhhhhhh',
    '.hhhhhhhhh.h.',
    '.hhhh........',
    '.hhh.........',
    '.hh..........',
    '.h...........'
  ]
};

export const HAIR_SLICK: HairStyle = {
  top: 0,
  ear: true,
  rows: [
    '....hhhhh....',
    '..hHHHHHHhh..',
    '.hHHhhhhhhhk.',
    '.hhhhhhhhhk..',
    '.hhhhhh......',
    '.hhhh........',
    '.hhh.........',
    '.hh..........',
    '.h...........'
  ]
};

export const HAIR_BUN: HairStyle = {
  top: 2,
  ear: false,
  rows: [
    '.hHHhh.......',
    '.hHhhh.......',
    '..hhhhhhh....',
    '..hHHHhhhhh..',
    '.hHHhhhhhhhh.',
    '.hhhhhhhhhhhh',
    '.hhhhhhhhh.h.',
    '.hhhhhh......',
    '.hhhhh.......',
    '.hhhhh.......',
    '.hhhhh.......',
    '..hhhh.......',
    '...hh........'
  ]
};

export const HAIR_MOHAWK: HairStyle = {
  top: 3,
  ear: true,
  rows: [
    '...hHH.H.....',
    '..hHHHHHh....',
    '.hHHHhhhhh...',
    '.hHhhhhhhhh..',
    '.shhhhhhhhs..',
    '.sss.........',
    '.ss..........',
    '.s...........'
  ]
};

export const HAIR_GRANNY: HairStyle = {
  top: 3,
  ear: false,
  rows: [
    '...HHh.......',
    '..HHhhh......',
    '..hhhhk......',
    '...hhhhhh....',
    '..hHHHHhhhh..',
    '.hHHHhhhhhhh.',
    '.hHhhhhhhhhhh',
    '.hhhhhhhhh.h.',
    '.hhhhhh......',
    '.hhhhh.......',
    '..hhhh.......',
    '..hhh........'
  ]
};

function paintTemplate(g: PixelGrid, rows: string[], oy: number, skin: Ramp, hair: Ramp): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const c = ch === 'S' ? skin[0] : ch === 's' ? skin[1] : ch === 'd' ? skin[2]
        : ch === 'H' ? hair[0] : ch === 'h' ? hair[1] : ch === 'k' ? hair[2]
          : ch === 'e' ? OUTLINE : null;
      if (c) g.px(x, y + oy, c);
    }
  });
}

/** 右向きの頭を描いた格子と、首がつながる点 */
function drawHead(look: Look, pose: Pose): { g: PixelGrid; nx: number; ny: number } {
  const hs = look.hairStyle;
  const top = hs.top;
  const g = new PixelGrid(14, HEAD_ROWS + top + 1);
  const S = look.skin, H = look.hair;
  paintTemplate(g, FACE, top, S, H);
  // 耳
  if (hs.ear) {
    g.px(5, top + 4, S[1]).px(5, top + 5, S[2]).px(4, top + 5, S[1]).px(5, top + 6, S[1]);
  }
  paintTemplate(g, hs.rows, 0, S, H);
  const y = (r: number) => top + r + (pose.down ? 1 : 0);
  const P = (x: number, r: number, c: string) => g.px(x, y(r), c);
  const brow = H[2] === OUTLINE ? H[1] : H[2];
  // 表情
  switch (pose.face) {
    case 'normal':
    case 'sly':
      P(8, 3, brow); P(9, 3, brow); P(10, 3, brow);
      P(9, 4, OUTLINE); P(9, 5, OUTLINE);
      if (pose.face === 'sly') { P(10, 4, OUTLINE); P(9, 4, S[1]); }
      P(9, 8, S[2]); P(10, 8, S[2]);
      break;
    case 'grin':
      P(8, 3, brow); P(9, 3, brow); P(10, 3, brow);
      P(9, 4, OUTLINE); P(9, 5, OUTLINE);
      P(8, 8, S[2]); P(9, 8, OUTLINE); P(10, 8, OUTLINE); P(11, 7, S[2]);
      break;
    case 'angry':
      P(8, 2, brow); P(9, 3, brow); P(10, 4, brow);
      P(9, 5, OUTLINE); P(10, 5, OUTLINE);
      P(9, 8, OUTLINE); P(10, 8, OUTLINE); P(10, 9, S[2]);
      break;
    case 'worried':
      P(8, 3, brow); P(9, 2, brow); P(10, 2, brow);
      P(9, 4, OUTLINE); P(9, 5, OUTLINE);
      P(9, 8, S[2]); P(10, 9, S[2]); P(10, 8, S[2]);
      break;
    case 'surprised':
      P(8, 2, brow); P(9, 1, brow); P(10, 2, brow);
      P(9, 3, OUTLINE); P(9, 4, OUTLINE); P(9, 5, OUTLINE);
      P(9, 8, OUTLINE); P(10, 8, OUTLINE); P(9, 9, OUTLINE); P(10, 9, OUTLINE);
      break;
    case 'hurt':
      P(8, 3, brow); P(9, 3, brow);
      P(8, 5, OUTLINE); P(9, 5, OUTLINE); P(10, 4, OUTLINE);
      P(9, 8, OUTLINE); P(10, 8, OUTLINE); P(10, 9, OUTLINE);
      break;
    case 'ko':
      P(8, 3, OUTLINE); P(10, 3, OUTLINE); P(9, 4, OUTLINE); P(8, 5, OUTLINE); P(10, 5, OUTLINE);
      P(9, 8, OUTLINE); P(10, 8, OUTLINE); P(10, 9, OUTLINE);
      break;
    case 'shut':
      P(8, 3, brow); P(9, 3, brow); P(10, 3, brow);
      P(8, 5, OUTLINE); P(9, 5, OUTLINE);
      P(9, 8, S[2]); P(10, 8, S[2]);
      break;
  }
  look.headExtra?.(g, pose);
  return { g, nx: NECK_COL, ny: top + HEAD_ROWS };
}

// ---------- 体 ----------

const shoePoly = (a: Pt, ang: number, k = 1): Pt[] => {
  const pts: Pt[] = [[-2, -1], [2, -1], [4, 0.6], [4.4, 2.5], [-2, 2.5]];
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([x, y]) => [a[0] + k * (x * c - y * s), a[1] + k * (x * s + y * c)]);
};

function drawShoe(P: Painter, look: Look, leg: Leg, far: boolean): void {
  const k = look.build.scale ?? 1;
  const m = P.mask().poly(shoePoly(leg.a, leg.toe ?? 0, k));
  const r = far ? dark(look.shoes) : look.shoes;
  P.fill(m, r, { sep: 'outline', hi: 0.35, lo: 0.75 });
  if (look.sole && !leg.toe) {
    let y = 0;
    for (let j = 0; j < 8; j++) for (let x = Math.round(leg.a[0] - 2 * k); x <= Math.round(leg.a[0] + 4 * k); x++) if (m.has(x, Math.round(leg.a[1]) + j)) y = Math.round(leg.a[1]) + j;
    for (let x = Math.round(leg.a[0] - 2 * k); x <= Math.round(leg.a[0] + 5 * k); x++) if (m.has(x, y)) P.px(x, y, look.sole);
  }
}

function legMask(P: Painter, b: Build, hipJ: Pt, leg: Leg): Mask {
  const m = P.mask();
  m.capsule(hipJ, leg.k, b.thigh, b.thigh * 0.9);
  m.capsule(leg.k, add(leg.a, 0, -1), b.shin, b.shin * 0.8);
  return m;
}

function armMasks(P: Painter, look: Look, s: Pt, arm: Arm): { sleeve: Mask; skin: Mask; wrist: Pt } {
  const b = look.build;
  const dx = arm.h[0] - arm.e[0], dy = arm.h[1] - arm.e[1];
  const L = Math.hypot(dx, dy) || 1;
  const wrist: Pt = [arm.h[0] - (dx / L) * 1.6 * (b.scale ?? 1), arm.h[1] - (dy / L) * 1.6 * (b.scale ?? 1)];
  const upper = P.mask().capsule(s, arm.e, b.arm, b.arm * 0.92);
  const fore = P.mask().capsule(arm.e, wrist, b.arm * 0.9, b.arm * 0.75);
  const hand = P.mask();
  const hk = b.scale ?? 1;
  if (!arm.noHand) hand.ellipse(arm.h[0], arm.h[1], 1.7 * hk, 1.7 * hk);
  const sleeve = P.mask(), skin = P.mask();
  switch (look.sleeve) {
    case 'long': sleeve.union(upper).union(fore); break;
    case 'rolled': {
      sleeve.union(upper).union(P.mask().capsule(arm.e, mix(arm.e, wrist, 0.2), b.arm * 0.95));
      skin.union(fore).subtract(sleeve);
      break;
    }
    case 'short': {
      const half = mix(s, arm.e, 0.6);
      sleeve.union(P.mask().capsule(s, half, b.arm + 0.3));
      skin.union(upper).union(fore).subtract(sleeve);
      break;
    }
    case 'none': skin.union(upper).union(fore); break;
  }
  skin.union(hand.subtract(sleeve));
  return { sleeve, skin, wrist };
}

function drawArm(P: Painter, look: Look, s: Pt, arm: Arm, far: boolean, first: boolean): void {
  const { sleeve, skin, wrist } = armMasks(P, look, s, arm);
  const top = far ? dark(look.top) : look.top;
  const sk = far ? dark(look.skin) : look.skin;
  const sep = first ? 'none' : 'outline';
  // 腕の全体を1つの形として境目を付け、袖と肌を塗り分ける
  const all = sleeve.clone().union(skin);
  if (sep === 'outline') P.fill(all, OUTLINE, { sep: 'outline', flat: true });
  if (!sleeve.empty()) P.fill(sleeve, top, { sep: 'none' });
  if (!skin.empty()) P.fill(skin, sk, { sep: 'none', hi: 0.25, lo: 0.7 });
  if (look.cuff && look.sleeve === 'long' && !arm.noHand) {
    const c = mix(wrist, arm.h, 0.2);
    P.px(c[0], c[1], look.cuff);
  }
}

export function shoulders(pose: Pose, k = 1): { sB: Pt; sF: Pt } {
  const n = pose.neck;
  return { sF: [n[0] - 1 * k, n[1] + 2.5 * k], sB: [n[0] + 4 * k, n[1] + 2.5 * k] };
}

function hips(pose: Pose, k = 1): { hB: Pt; hF: Pt } {
  const p = pose.hip;
  return { hF: [p[0] - 2 * k, p[1] - 0.5], hB: [p[0] + 2 * k, p[1] - 0.5] };
}

function torsoMask(P: Painter, b: Build, pose: Pose, hemDy = b.hem): Mask {
  const n = pose.neck, p = pose.hip;
  const mid = mix(n, p, 0.45);
  const hemY = p[1] + hemDy;
  const hx = n[0] + (p[0] - n[0]) * ((hemY - n[1]) / Math.max(1, p[1] - n[1]));
  const k = b.scale ?? 1;
  return P.mask().poly([
    [n[0] - b.sh + 2 * k, n[1]], [n[0] + b.sh - 3 * k, n[1]],
    [n[0] + b.sh, n[1] + 3 * k], [mid[0] + b.sh - 1 + b.chest, mid[1]],
    [hx + b.wa, hemY], [hx - b.wa, hemY],
    [mid[0] - b.sh + 1, mid[1]], [n[0] - b.sh, n[1] + 3 * k]
  ]);
}

function pelvisMask(P: Painter, b: Build, pose: Pose): Mask {
  const p = pose.hip;
  const k = b.scale ?? 1;
  return P.mask().poly([[p[0] - b.wa, p[1] - 5 * k], [p[0] + b.wa, p[1] - 5 * k], [p[0] + b.wa, p[1] + 1.5 * k], [p[0] - b.wa + 1, p[1] + 2 * k]]);
}

function drawSweat(P: Painter, pose: Pose, c: string): void {
  const x = Math.round(pose.head[0] + (pose.look === -1 ? -9 : 8)), y = Math.round(pose.head[1] - 13);
  P.px(x, y, c).px(x, y + 1, c).px(x - 1, y + 2, c).px(x, y + 2, c).px(x + 1, y + 2, c).px(x - 1, y + 3, c).px(x, y + 3, c).px(x + 1, y + 3, c);
}

/** 人を1コマ描く */
export function drawPerson(look: Look, pose: Pose, w = 64, h = 64): PixelGrid {
  const P = new Painter(w, h);
  const b = look.build;
  const k = b.scale ?? 1;
  const { sB, sF } = shoulders(pose, k);
  const { hB, hF } = hips(pose, k);
  look.behind?.(P, pose);
  // 奥の腕
  drawArm(P, look, sB, pose.aB, true, true);
  look.farHand?.(P, pose);
  // 奥の脚
  if (look.legs === 'pants') {
    P.fill(legMask(P, b, hB, pose.lB), dark(look.bottom), { sep: 'outline' });
  } else {
    P.fill(P.mask().capsule(pose.lB.k, add(pose.lB.a, 0, -1), 1.6, 1.4), dark(look.skin), { sep: 'outline' });
  }
  drawShoe(P, look, pose.lB, true);
  // 手前の脚と腰
  if (look.legs === 'pants') {
    const m = legMask(P, b, hF, pose.lF).union(pelvisMask(P, b, pose));
    P.fill(m, look.bottom, { sep: 'outline' });
  } else {
    P.fill(P.mask().capsule(pose.lF.k, add(pose.lF.a, 0, -1), 1.6, 1.4), look.skin, { sep: 'outline' });
  }
  drawShoe(P, look, pose.lF, false);
  if (look.legs === 'longskirt') {
    const p = pose.hip;
    const ay = Math.min(pose.lF.a[1], pose.lB.a[1]) - 4;
    const xs = [pose.lF.k[0], pose.lB.k[0], pose.lF.a[0], pose.lB.a[0]];
    const x0 = Math.min(...xs) - 3.5, x1 = Math.max(...xs) + 3.5;
    const m = P.mask().poly([[p[0] - b.wa, p[1] - 5], [p[0] + b.wa, p[1] - 5], [p[0] + b.wa + 1, p[1]], [x1, ay], [x0, ay], [p[0] - b.wa - 1, p[1]]]);
    P.fill(m, look.bottom, { sep: 'outline', hi: 0.25, lo: 0.6 });
    // ひだ
    const fx = Math.round((x0 + x1) / 2);
    for (let y = Math.round(p[1] + 2); y < ay - 1; y++) if (m.has(fx, y)) P.px(fx, y, look.bottom[2]);
  }
  // 胴
  const top = torsoMask(P, b, pose);
  P.fill(top, look.top, { sep: 'outline', hi: 0.32, lo: 0.64 });
  look.torso?.(P, pose, top);
  look.mid?.(P, pose);
  // 首と頭
  const neckLen = look.neckLen ?? 0;
  const nk = P.mask().capsule(add(pose.head, 0, -1 - neckLen), add(pose.neck, 0, 1), 1.6 * k);
  P.fill(nk, [look.skin[1], look.skin[2], look.skin[2]], { sep: 'outline', flat: true });
  P.px(pose.head[0] + 1, pose.head[1] + 1, look.skin[2]);
  const hd = look.customHead ? look.customHead(pose) : drawHead(look, pose);
  const hg = pose.look === -1 ? hd.g.flipped() : hd.g;
  const nx = pose.look === -1 ? hd.g.w - 1 - hd.nx : hd.nx;
  P.blit(hg, Math.round(pose.head[0] - nx), Math.round(pose.head[1] - hd.ny - neckLen), 'outline');
  // 手前の腕
  drawArm(P, look, sF, pose.aF, false, false);
  look.front?.(P, pose);
  if (pose.sweat && look.sweat !== null) drawSweat(P, pose, look.sweat ?? WHITE[0]);
  P.outline();
  return P.g;
}

// ---------- ポーズを作る道具 ----------

export const clonePose = (p: Pose): Pose => JSON.parse(JSON.stringify(p)) as Pose;

/** 体全体をずらす */
export function movePose(p: Pose, dx: number, dy: number): Pose {
  const q = clonePose(p);
  const mv = (pt: Pt) => { pt[0] += dx; pt[1] += dy; };
  mv(q.head); mv(q.neck); mv(q.hip);
  for (const a of [q.aB, q.aF]) { mv(a.e); mv(a.h); }
  for (const l of [q.lB, q.lF]) { mv(l.k); mv(l.a); }
  return q;
}

/** 上半身だけずらす(腰から上) */
export function moveUpper(p: Pose, dx: number, dy: number): Pose {
  const q = clonePose(p);
  const mv = (pt: Pt) => { pt[0] += dx; pt[1] += dy; };
  mv(q.head); mv(q.neck);
  for (const a of [q.aB, q.aF]) { mv(a.e); mv(a.h); }
  return q;
}

/** 腰の高さからの差を y だけ伸ばす(ボスの化けた姿用)。足の裏 y=59 は動かない */
export function stretchPose(p: Pose, sy: number, sx: number, cx = 32, feet = 59): Pose {
  const q = clonePose(p);
  const tf = (pt: Pt) => { pt[0] = cx + (pt[0] - cx) * sx; pt[1] = feet - (feet - pt[1]) * sy; };
  tf(q.neck); tf(q.hip);
  for (const a of [q.aB, q.aF]) { tf(a.e); tf(a.h); }
  for (const l of [q.lB, q.lF]) { tf(l.k); tf(l.a); }
  // 頭は大きさを変えず、首の上に乗せる
  q.head = [cx + (p.head[0] - cx) * sx, q.neck[1] - (p.neck[1] - p.head[1])];
  return q;
}
