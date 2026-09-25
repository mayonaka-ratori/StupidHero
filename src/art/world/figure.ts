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

/** 奥の手足の暗い色(フリープレイの人の絵 art/free/people.ts でも使う) */
export const dark = (r: Ramp): Ramp => [r[1], r[2], r[2]];

// ---------- 頭 ----------

/**
 * 頭のドット(右向き)。S s d:肌(明るい、ふつう、影)、H h k:髪、e:目(ふち色)、m:口
 * 顔は明るい色で平らに塗り、耳の下からあごの下へ影を入れて、あごの形を見せる。
 * 顔の部品の位置(まゆ3行目、目4〜5行目の9列、口8行目、鼻12列)は、ほかのステージの頭の小物がこれに合わせている。
 */
const FACE = [
  '....SSSSS....',
  '..SSSSSSSSS..',
  '.SSSSSSSSSSS.',
  '.SSSSSSSSSSS.',
  '.SSSSSSSSSSS.',
  '.sSSSSSSSSSSS',
  '.sSSSSSSSSSSs',
  '.ssSSSSSSSSS.',
  '..sdsSSSSSSS.',
  '...ddsSSSSs..',
  '.....dssss...'
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

// 髪は左上に明るい房(H)を置き、房の分かれ目にだけ濃い線(k)を入れる。
export const HAIR_SHORT: HairStyle = {
  top: 1,
  ear: true,
  rows: [
    '...hh.hh.....',
    '..hhHHhhhh...',
    '.hhHHhhhhhhh.',
    '.hHhhhhhhkhhk',
    '.hhhhhhk.....',
    '.hhhhh.......',
    '.hhh.........',
    '.hhk.........',
    '.hk..........'
  ]
};

export const HAIR_SLICK: HairStyle = {
  top: 0,
  ear: true,
  rows: [
    '....hhhhh....',
    '..hhHHHHhhh..',
    '.hHHhhhhhhhhk',
    '.hhkkhhhhk...',
    '.hhhhhh......',
    '.hhhh........',
    '.hhh.........',
    '.hhk.........',
    '.hk..........'
  ]
};

export const HAIR_BUN: HairStyle = {
  top: 2,
  ear: false,
  rows: [
    '.hHHh........',
    '.hHhhk.......',
    '..hhkhhhh....',
    '..hHHHHhhhh..',
    '.hHHHhhhhhhh.',
    '.hHHhhhhhhhhh',
    '.hhhhhhhhk.h.',
    '.hhhhhh......',
    '.hhhhh.......',
    '.hhhhh.......',
    '.hhhhk.......',
    '..hhhk.......',
    '...hh........'
  ]
};

export const HAIR_MOHAWK: HairStyle = {
  top: 3,
  ear: true,
  rows: [
    '...hHH.H.....',
    '..hHHHHHh....',
    '.hHHHhhhhk...',
    '.hHhhhhhhhk..',
    '.dhhhhhhhhd..',
    '.ddssss......',
    '.dsss........',
    '.dss.........',
    '.ds..........',
    '.d...........'
  ]
};

export const HAIR_GRANNY: HairStyle = {
  top: 3,
  ear: false,
  rows: [
    '...HHh.......',
    '..HHhhh......',
    '..hhhhk......',
    '...hhkhhh....',
    '..hHHHHhhhh..',
    '.hHHHhhhhhhh.',
    '.hHhhhhhhhhhh',
    '.hhhhhhhhk.h.',
    '.hhhhhh......',
    '.hhhhk.......',
    '..hhhk.......',
    '..hhk........'
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
  // 耳(外が明るく、穴のところが影)
  if (hs.ear) {
    g.px(4, top + 4, S[1]).px(5, top + 4, S[1]);
    g.px(4, top + 5, S[0]).px(5, top + 5, S[2]);
    g.px(4, top + 6, S[1]).px(5, top + 6, S[1]);
  }
  paintTemplate(g, hs.rows, 0, S, H);
  const y = (r: number) => top + r + (pose.down ? 1 : 0);
  const P = (x: number, r: number, c: string) => g.px(x, y(r), c);
  const brow = H[2] === OUTLINE ? H[1] : H[2];
  const O = OUTLINE, D = S[2];
  // 表情。顔は斜め前を向き、目は手前(8列)と奥(11列)の2つ。目は縦2ドット、口は8行目。
  // 縮めても読めるように、まゆの傾きと口の形をはっきり変える
  const eyes = (r = 4, h = 2) => { for (let j = 0; j < h; j++) { P(8, r + j, O); P(11, r + j, O); } };
  const brows = (l: number, m: number, r: number) => { P(7, l, brow); P(8, m, brow); P(11, r, brow); };
  switch (pose.face) {
    case 'normal':
      brows(3, 3, 3); eyes();
      P(9, 8, D); P(10, 8, D);
      break;
    case 'sly':
      // 目を細め(上まぶたが下りる)、口のはしを上げる
      brows(3, 3, 3);
      P(8, 4, S[1]); P(11, 4, S[1]); P(8, 5, O); P(11, 5, O); P(9, 5, O);
      P(9, 8, D); P(10, 8, D); P(11, 7, D);
      break;
    case 'grin':
      brows(3, 2, 2); eyes();
      P(8, 8, D); P(9, 8, O); P(10, 8, O); P(11, 7, O); P(9, 9, D); P(10, 9, D);
      break;
    case 'angry':
      // まゆの奥の端を上げ、手前(鼻の側)を下げる
      P(6, 2, brow); P(7, 3, brow); P(8, 3, brow); P(10, 3, brow); P(11, 3, brow);
      P(8, 4, O); P(8, 5, O); P(11, 4, O); P(11, 5, O);
      P(9, 8, O); P(10, 8, O); P(11, 8, O);
      break;
    case 'worried':
      // まゆの手前を上げる。口はへの字
      P(7, 3, brow); P(8, 2, brow); P(11, 2, brow);
      eyes();
      P(9, 8, D); P(10, 8, D); P(8, 9, D);
      break;
    case 'surprised':
      P(7, 2, brow); P(8, 1, brow); P(11, 1, brow);
      eyes(3, 3);
      P(9, 8, O); P(10, 8, O); P(9, 9, O); P(10, 9, O);
      break;
    case 'hurt':
      // ぎゅっとつぶった目(>の形)と、ゆがんだ口
      P(7, 3, brow); P(8, 3, brow);
      P(7, 4, O); P(8, 5, O); P(7, 6, O); P(11, 4, O); P(10, 5, O); P(11, 6, O);
      P(9, 8, O); P(10, 8, O); P(10, 9, O);
      break;
    case 'ko':
      // ×の目
      P(7, 3, O); P(9, 3, O); P(8, 4, O); P(7, 5, O); P(9, 5, O);
      P(11, 3, O); P(11, 5, O);
      P(9, 8, O); P(10, 8, O); P(10, 9, O);
      break;
    case 'shut':
      brows(3, 3, 3);
      P(7, 5, O); P(8, 5, O); P(11, 5, O);
      P(9, 8, D); P(10, 8, D);
      break;
  }
  look.headExtra?.(g, pose);
  return { g, nx: NECK_COL, ny: top + HEAD_ROWS };
}

// ---------- 体 ----------

/** 靴の形。かかとから、つま先を丸く高くした、ずんぐりした形 */
const shoePoly = (a: Pt, ang: number, k = 1): Pt[] => {
  const pts: Pt[] = [[-2.5, -1.5], [1.6, -1.5], [3.4, -0.3], [4.8, 0.7], [5.2, 2.5], [-2.5, 2.5]];
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([x, y]) => [a[0] + k * (x * c - y * s), a[1] + k * (x * s + y * c)]);
};

function drawShoe(P: Painter, look: Look, leg: Leg, far: boolean): void {
  const k = look.build.scale ?? 1;
  const ang = leg.toe ?? 0;
  const m = P.mask().poly(shoePoly(leg.a, ang, k));
  const r = far ? dark(look.shoes) : look.shoes;
  P.fill(m, r, { sep: 'outline', hi: 0.3, lo: 0.72, clean: true });
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (x: number, y: number): Pt => [Math.round(leg.a[0] + k * (x * c - y * s)), Math.round(leg.a[1] + k * (x * s + y * c))];
  // 底(いちばん下の段)。底の色がなければ影の色
  const sole = look.sole ?? r[2];
  const byX = new Map<number, number>();
  m.each((x, y) => { if (!m.has(x, y + 1) && (byX.get(x) ?? -1) < y) byX.set(x, y); });
  if (!leg.toe || Math.abs(ang) < 0.35) for (const [x, y] of byX) P.px(x, y, sole);
  // つま先の上の小さな光
  if (!far) {
    const [tx, ty] = at(2.6, 0);
    if (m.has(tx, ty)) P.px(tx, ty, r[0]);
    const [ux, uy] = at(3.6, 0.8);
    if (m.has(ux, uy) && m.has(ux, uy + 1)) P.px(ux, uy, r[0]);
  }
}

function legMask(P: Painter, b: Build, hipJ: Pt, leg: Leg): Mask {
  const m = P.mask();
  m.capsule(hipJ, leg.k, b.thigh, b.thigh * 0.9);
  m.capsule(leg.k, add(leg.a, 0, -1), b.shin, b.shin * 0.88);
  return m;
}

/** 手の大きさ(半径)。ずんぐりした手にする */
export const HAND_R = 2;

/** 手足をヒーローに合わせて太くする */
function thicken(b: Build): Build {
  return { ...b, arm: b.arm + 0.35, thigh: b.thigh + 0.3, shin: b.shin + 0.45 };
}

function armMasks(P: Painter, look: Look, s: Pt, arm: Arm): { sleeve: Mask; skin: Mask; wrist: Pt } {
  const b = look.build;
  const dx = arm.h[0] - arm.e[0], dy = arm.h[1] - arm.e[1];
  const L = Math.hypot(dx, dy) || 1;
  const wrist: Pt = [arm.h[0] - (dx / L) * 1.8 * (b.scale ?? 1), arm.h[1] - (dy / L) * 1.8 * (b.scale ?? 1)];
  const upper = P.mask().capsule(s, arm.e, b.arm, b.arm * 0.92);
  const fore = P.mask().capsule(arm.e, wrist, b.arm * 0.9, b.arm * 0.75);
  const hand = P.mask();
  const hk = b.scale ?? 1;
  if (!arm.noHand) hand.ellipse(arm.h[0], arm.h[1], HAND_R * hk, HAND_R * hk);
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

/**
 * 曲げた関節(ひじ、ひざ)の内側に、服のしわを2ドット入れる。a と c は関節の両どなりの点。
 * 曲がりが小さいときは入れない。m の中で、いま色が ramp のところだけを塗る
 */
function bendFold(P: Painter, m: Mask, a: Pt, j: Pt, c: Pt, ramp: Ramp): void {
  const mx = (a[0] + c[0]) / 2 - j[0], my = (a[1] + c[1]) / 2 - j[1];
  const L = Math.hypot(mx, my);
  if (L < 1.6) return;
  const ux = mx / L, uy = my / L;
  const ok = new Set<string>([ramp[0], ramp[1]]);
  for (const d of [0.8, 1.8]) {
    const x = Math.round(j[0] + ux * d), y = Math.round(j[1] + uy * d);
    const cur = P.g.get(x, y);
    if (m.has(x, y) && cur && ok.has(cur)) P.px(x, y, ramp[2]);
  }
}

function drawArm(P: Painter, look: Look, s: Pt, arm: Arm, far: boolean, first: boolean): void {
  const { sleeve, skin, wrist } = armMasks(P, look, s, arm);
  const top = far ? dark(look.top) : look.top;
  const sk = far ? dark(look.skin) : look.skin;
  const sep = first ? 'none' : 'outline';
  // 腕の全体を1つの形として境目を付け、袖と肌を塗り分ける
  const all = sleeve.clone().union(skin);
  if (sep === 'outline') P.fill(all, OUTLINE, { sep: 'outline', flat: true });
  if (!sleeve.empty()) {
    P.fill(sleeve, top, { sep: 'none', clean: true });
    if (look.sleeve === 'long' && !far) bendFold(P, sleeve, s, arm.e, arm.h, top);
  }
  if (!skin.empty()) P.fill(skin, sk, { sep: 'none', hi: 0.25, lo: 0.7, clean: true });
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
export function drawPerson(look0: Look, pose: Pose, w = 64, h = 64): PixelGrid {
  const P = new Painter(w, h);
  const look: Look = { ...look0, build: thicken(look0.build) };
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
    P.fill(legMask(P, b, hB, pose.lB), dark(look.bottom), { sep: 'outline', clean: true });
  } else {
    P.fill(P.mask().capsule(pose.lB.k, add(pose.lB.a, 0, -1), 1.9, 1.6), dark(look.skin), { sep: 'outline', clean: true });
  }
  drawShoe(P, look, pose.lB, true);
  // 手前の脚と腰
  if (look.legs === 'pants') {
    const m = legMask(P, b, hF, pose.lF).union(pelvisMask(P, b, pose));
    P.fill(m, look.bottom, { sep: 'outline', clean: true });
    bendFold(P, m, hF, pose.lF.k, pose.lF.a, look.bottom);
  } else {
    P.fill(P.mask().capsule(pose.lF.k, add(pose.lF.a, 0, -1), 1.9, 1.6), look.skin, { sep: 'outline', clean: true });
  }
  drawShoe(P, look, pose.lF, false);
  if (look.legs === 'longskirt') {
    const p = pose.hip;
    const ay = Math.min(pose.lF.a[1], pose.lB.a[1]) - 4;
    const xs = [pose.lF.k[0], pose.lB.k[0], pose.lF.a[0], pose.lB.a[0]];
    const x0 = Math.min(...xs) - 3.5, x1 = Math.max(...xs) + 3.5;
    const m = P.mask().poly([[p[0] - b.wa, p[1] - 5], [p[0] + b.wa, p[1] - 5], [p[0] + b.wa + 1, p[1]], [x1, ay], [x0, ay], [p[0] - b.wa - 1, p[1]]]);
    P.fill(m, look.bottom, { sep: 'outline', hi: 0.25, lo: 0.6, clean: true });
    // ひだ
    const fx = Math.round((x0 + x1) / 2);
    for (let y = Math.round(p[1] + 2); y < ay - 1; y++) if (m.has(fx, y)) P.px(fx, y, look.bottom[2]);
  }
  // 胴
  const top = torsoMask(P, b, pose);
  P.fill(top, look.top, { sep: 'outline', hi: 0.32, lo: 0.64, clean: true });
  look.torso?.(P, pose, top);
  look.mid?.(P, pose);
  // 首と頭
  const neckLen = look.neckLen ?? 0;
  const nk = P.mask().capsule(add(pose.head, 0, -1 - neckLen), add(pose.neck, 0, 1), 1.6 * k);
  P.fill(nk, [look.skin[1], look.skin[2], look.skin[2]], { sep: 'outline', flat: true });
  // あごの下の影(首の上の段)
  nk.each((x, y) => { if (y === Math.round(pose.head[1] - neckLen) + 1 || (y === Math.round(pose.head[1] - neckLen) + 2 && x > pose.head[0])) P.px(x, y, look.skin[2]); });
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
