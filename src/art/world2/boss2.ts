// ギャングの女ボス(正体)。96×96、足の裏は y=91、体の真ん中は x=48。
// 白い毛皮のコートを肩にはおり、中は紫のドレス。紫のサングラス、赤い大きな髪、赤い口紅、赤いハイヒール、金の耳飾りと腕輪。
// 体は bossKit の道具で組み立てる(人の仕組み figure.ts は使わない)。
import { OUTLINE, PixelGrid, md } from '../lib';
import { Mask, Painter, type Pt, rotateGrid } from '../world/pix';
import {
  type ArmDims, type BArm, type BLeg, type BPose, type HeadArt, type Ramp4, type ScrapStyle,
  alignCenter, alignFeet, armShapes, cloneB, drawNeckAndHead, drawScraps, legShapes, moveUpperB, shade, shadeBall
} from '../world/bossKit';

// ---------- 色(15色) ----------
const SKIN = [md(7, 6, 5), md(7, 5, 4), md(5, 3, 3)] as const;
/** 赤い髪。口紅とハイヒールもこの色 */
const HAIR = [md(7, 3, 2), md(6, 1, 1), md(3, 0, 1)] as const;
/** 白い毛皮(ふつうは青みの灰色、影は暗い紫。駐車場の白い線にまぎれないように濃いめ) */
const FUR = [md(7, 7, 7), md(5, 5, 6), md(3, 2, 4)] as const;
/** 紫のドレス。サングラスのレンズもこの暗い色 */
const DRESS = [md(5, 2, 6), md(4, 1, 5), md(2, 0, 3)] as const;
const GOLD = [md(7, 7, 3), md(7, 5, 1)] as const;

type BossFace = 'smirk' | 'grin' | 'shout' | 'hurt' | 'ko';

// ---------- 頭 ----------

const HW = 32, HH = 34, NX = 18, NY = 22;

function bossHead(face: BossFace): HeadArt {
  const P = new Painter(HW, HH);
  const hairR: Ramp4 = [HAIR[0], HAIR[1], HAIR[2]];
  // 後ろの大きな髪(肩までふくらむ)
  const back = P.mask().ellipse(14, 11, 10, 9.5).union(P.mask().ellipse(9.5, 19, 7.5, 8.5)).union(P.mask().ellipse(11, 26, 5.5, 4.5));
  shadeBall(P, back, hairR, 12, 9, 12, 16, { sep: 'none', cut: [0.5, -0.05, -9] });
  // 顔
  const skin = P.mask().ellipse(19.5, 15, 6, 7)
    .union(P.mask().poly([[14, 15], [25, 13], [25.4, 18.5], [23, 22.4], [19.5, 23.6], [15.5, 21.5]]))
    .union(P.mask().poly([[24.5, 13], [27, 17.6], [24.8, 18.2]]));
  shadeBall(P, skin, [SKIN[0], SKIN[1], SKIN[2]], 18, 11, 10, 13, { sep: 'outline', cut: [0.45, -0.2, -9] });
  // 前髪(額をおおい、前へ大きくはねる)
  const bang = P.mask().ellipse(18, 7, 9, 5.5).union(P.mask().poly([[18, 5], [27, 7], [27.5, 11], [24, 9.6], [19, 12.4], [14, 13]]));
  shadeBall(P, bang, hairR, 14, 4, 11, 10, { sep: 'outline', cut: [0.45, -0.1, -9] });
  // 髪の流れ(明るい筋と暗い筋)
  const put = (pts: [number, number][], c: string) => { for (const [x, y] of pts) P.px(x, y, c); };
  // 明るい筋(左上)と、毛束の分かれ目(暗い線)
  P.line([12, 3], [9, 5], HAIR[0]).line([8, 6], [6, 10], HAIR[0]).line([15, 2], [18, 2], HAIR[0]);
  P.line([20, 9], [23, 10], HAIR[2]);
  P.line([10, 13], [8, 17], HAIR[2]).line([8, 18], [9, 22], HAIR[2]);
  P.line([13, 16], [13, 20], HAIR[2]).line([12, 21], [11, 24], HAIR[2]);
  // 耳飾り(金の輪)
  put([[15, 19], [15, 20], [15, 21], [16, 22]], GOLD[1]); P.px(15, 19, GOLD[0]);
  const o = OUTLINE;
  // 鼻の下とあごの影
  put([[25, 18], [26, 18]], SKIN[2]);
  // 目のまわり
  if (face === 'ko') {
    // サングラスが飛んで、目を回している
    put([[18, 13], [20, 13], [19, 14], [18, 15], [20, 15]], o);
    put([[23, 13], [24, 14], [23, 15]], o);
    put([[18, 12], [19, 12], [20, 12]], SKIN[2]);
  } else if (face === 'hurt') {
    // サングラスがずれて(鼻の上へ下がる)、ぎゅっとつぶった目がのぞく
    put([[17, 13], [18, 14], [19, 14], [20, 13]], o);
    put([[16, 15], [17, 15], [18, 15], [19, 15], [20, 15], [21, 16], [22, 16], [23, 16], [24, 16], [25, 16]], o);
    put([[17, 16], [18, 16], [19, 16], [20, 16], [22, 17], [23, 17], [24, 17]], o);
    put([[17, 17], [18, 17], [19, 17]], o);
    put([[18, 16]], FUR[0]);
  } else {
    // 黒いサングラス:横長のレンズに、白い照り返し
    put([[16, 13], [17, 13], [18, 13], [19, 13], [20, 13], [21, 13], [22, 13], [23, 13], [24, 13], [25, 13]], o);
    put([[16, 14], [17, 14], [18, 14], [19, 14], [20, 14], [21, 14], [22, 14], [23, 14], [24, 14], [25, 14]], o);
    put([[17, 15], [18, 15], [19, 15], [20, 15], [22, 15], [23, 15], [24, 15]], o);
    put([[18, 16], [19, 16], [23, 16]], o);
    put([[17, 14], [18, 15]], FUR[0]);
    put([[23, 14]], FUR[1]);
  }
  // 口(赤い口紅)
  if (face === 'smirk') { put([[21, 20], [22, 20], [23, 20]], HAIR[1]); put([[24, 19]], HAIR[1]); put([[22, 21]], HAIR[2]); }
  if (face === 'grin') { put([[21, 19], [22, 20], [23, 20], [24, 19]], HAIR[1]); put([[22, 21], [23, 21]], HAIR[1]); put([[22, 20], [23, 20]], FUR[0]); }
  if (face === 'shout') {
    put([[21, 19], [22, 19], [23, 19], [24, 19]], HAIR[1]);
    put([[21, 20], [22, 20], [23, 20], [24, 20], [22, 21], [23, 21]], o);
    put([[22, 20], [23, 20]], FUR[0]);
    put([[21, 21], [24, 21], [22, 22], [23, 22]], HAIR[1]);
  }
  if (face === 'hurt') { put([[21, 20], [22, 20], [23, 20], [24, 20]], o); put([[22, 21], [23, 21]], HAIR[1]); put([[22, 19], [23, 19]], HAIR[1]); }
  if (face === 'ko') { put([[22, 20], [23, 20]], o); put([[22, 21]], HAIR[1]); }
  return { g: P.g, nx: NX, ny: NY };
}

// ---------- 毛皮 ----------

/** 毛皮の房:ふちをふわふわに(小さな丸を並べる)して、中に短い毛の線を置く */
function furMask(base: Mask, puff: number): Mask {
  const m = base.clone();
  const edge: Pt[] = [];
  base.each((x, y) => { if (!base.has(x - 1, y) || !base.has(x + 1, y) || !base.has(x, y + 1)) edge.push([x, y]); });
  edge.forEach(([x, y]) => { if ((x * 7 + y * 3) % 7 === 0) m.ellipse(x, y, puff, puff); });
  return m;
}

function furTufts(P: Painter, m: Mask, dark: string, seed = 0): void {
  // 間をあけて、短い「く」の字の毛を置く
  m.each((x, y) => {
    if ((x + seed) % 5 !== 0 || (y + (x % 10 < 5 ? 0 : 3)) % 6 !== 0) return;
    if (!m.has(x, y + 1) || !m.has(x + 1, y + 2) || !m.has(x - 1, y) || !m.has(x + 2, y + 2)) return;
    // 毛は、下の色より1段暗い色で
    for (const [qx, qy] of [[x, y], [x, y + 1], [x + 1, y + 2]] as const) {
      const c = P.g.get(qx, qy);
      P.px(qx, qy, c === FUR[0] ? FUR[1] : dark);
    }
  });
}

function fillFur(P: Painter, m: Mask, far: boolean, sep: 'outline' | 'dark' | 'none' = 'outline', seed = 0): void {
  const r: Ramp4 = far ? [FUR[1], FUR[2], FUR[2]] : [FUR[0], FUR[1], FUR[2]];
  shade(P, m, r, { sep, hi: 0.3, lo: 0.62 });
  furTufts(P, m, FUR[2], seed);
}

// ---------- 体 ----------

const ARM: ArmDims = { up: 3.8, fore: 3.6, wrist: 2.8, fist: 2.4 };
const shoulderF = (p: BPose): Pt => [p.neck[0] - 7, p.neck[1] + 4];
const shoulderB = (p: BPose): Pt => [p.neck[0] + 6, p.neck[1] + 3];

function wristOf(a: BArm, d: number): Pt {
  const dx = a.e[0] - a.h[0], dy = a.e[1] - a.h[1], L = Math.hypot(dx, dy) || 1;
  return [a.h[0] + (dx / L) * d, a.h[1] + (dy / L) * d];
}

function drawArm(P: Painter, s: Pt, arm: BArm, far: boolean): void {
  const { upper, fore, hand } = armShapes(P, s, arm, ARM);
  shade(P, upper.clone().union(fore).union(hand), OUTLINE, { sep: 'outline' });
  // 毛皮のそで
  fillFur(P, upper.clone().union(P.mask().ellipse(s[0], s[1] + 0.5, 4.6, 4.2)), far, 'none', far ? 2 : 0);
  fillFur(P, fore, far, 'dark', far ? 3 : 1);
  // 手(肌)と、金の腕輪
  const sk: Ramp4 = far ? [SKIN[1], SKIN[2], SKIN[2]] : [SKIN[0], SKIN[1], SKIN[2]];
  shadeBall(P, hand, sk, arm.h[0] - 1, arm.h[1] - 1, 3.5, 3.5, { sep: 'outline', cut: [0.5, -0.1, -9] });
  const w = wristOf(arm, 2.6);
  const cuff = furMask(P.mask().ellipse(w[0], w[1], 2.7, 2.7), 0.8);
  fillFur(P, cuff, far, 'outline');
  if (!far) {
    const g = wristOf(arm, 1.2);
    P.px(g[0], g[1], GOLD[0]).px(g[0] + 1, g[1], GOLD[1]);
  }
}

/** 赤いハイヒール。つま先立ちで、かかとの細いヒールが地面まで */
function heelShoe(P: Painter, a: Pt, toe: number, far: boolean): void {
  const r: Ramp4 = far ? [HAIR[1], HAIR[2], HAIR[2]] : [HAIR[0], HAIR[1], HAIR[2]];
  const c = Math.cos(toe), s = Math.sin(toe);
  const pts: Pt[] = [[-1.8, -1.8], [1.5, -1.2], [5.6, 1.5], [6.4, 3], [1.5, 2.2], [-1.8, 1.2]];
  const m = P.mask().poly(pts.map(([x, y]) => [a[0] + x * c - y * s, a[1] + x * s + y * c] as Pt));
  shade(P, m, r, { sep: 'outline', hi: 0.3, lo: 0.65 });
  let yb = 0;
  m.each((_x, y) => { yb = Math.max(yb, y); });
  // ヒール:かかとの下から地面まで
  const hx = Math.round(a[0] - 1.5), hy = Math.round(a[1] + 1.5);
  if (toe > 0.2 && toe < 0.8) for (let y = hy; y <= yb; y++) P.px(hx, y, r[2]);
}

function drawLeg(P: Painter, hipJ: Pt, leg: BLeg, far: boolean): void {
  const sk: Ramp4 = far ? [SKIN[1], SKIN[2], SKIN[2]] : [SKIN[0], SKIN[1], SKIN[2]];
  const { thigh, shin } = legShapes(P, hipJ, leg, 3.9, 3.1, 1.7);
  shade(P, thigh.clone().union(shin), sk, { sep: 'outline', hi: 0.3, lo: 0.66 });
  heelShoe(P, leg.a, leg.toe ?? 0.45, far);
}

function drawBoss(pose: BPose, face: BossFace, scraps = 0): PixelGrid {
  const P = new Painter(96, 96);
  // 切れはしは体より奥に(顔にかからないように)
  if (scraps) drawScraps(P, pose, scraps, SCRAPS);
  const n = pose.neck, p = pose.hip;
  const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
  const T = (dx: number, dy: number): Pt => [n[0] + dx + lean * dy, n[1] + dy];
  const sF = shoulderF(pose), sB = shoulderB(pose);
  const hipF: Pt = [p[0] - 3, p[1]], hipB: Pt = [p[0] + 3, p[1]];
  const hemY = p[1] + 15;
  // コートの背中(いちばん奥)。すそは広がる
  const back = furMask(P.mask().poly([
    [sB[0] + 2, sB[1] - 3], [sB[0] + 7, sB[1] + 8], [p[0] + 13, hemY], [p[0] - 15, hemY + 1], [sF[0] - 7, sF[1] + 8], [sF[0] - 2, sF[1] - 3]
  ]), 1.8);
  fillFur(P, back, true, 'none', 1);
  for (let y = Math.round(sB[1] + 10); y < hemY; y++) {
    const x = Math.round(sB[0] + 4 + (y - sB[1] - 10) * 0.25);
    if (back.has(x, y) && back.has(x + 1, y)) P.px(x, y, OUTLINE);
  }
  // 奥の腕と脚
  drawArm(P, sB, pose.aB, true);
  drawLeg(P, hipB, pose.lB, true);
  drawLeg(P, hipF, pose.lF, false);
  // ドレス:胴と、脚にそったタイトなスカート
  const body = P.mask().poly([T(-5, -1), T(5, -2), T(8, 2), T(10, 8), T(8, 13), [p[0] + 6, p[1] - 7], [p[0] + 9, p[1] - 1], [p[0] - 9, p[1] - 1], [p[0] - 6, p[1] - 7], T(-7, 12), T(-8, 4)]);
  const skirt = P.mask().capsule(hipF, [hipF[0] + (pose.lF.k[0] - hipF[0]) * 0.55, hipF[1] + (pose.lF.k[1] - hipF[1]) * 0.55], 5, 4.4)
    .union(P.mask().capsule(hipB, [hipB[0] + (pose.lB.k[0] - hipB[0]) * 0.55, hipB[1] + (pose.lB.k[1] - hipB[1]) * 0.55], 5, 4.4))
    .union(P.mask().poly([[p[0] - 9, p[1] - 2], [p[0] + 9, p[1] - 2], [p[0] + 6, p[1] + 4], [p[0] - 6, p[1] + 4]]));
  shade(P, body.clone().union(skirt), [DRESS[0], DRESS[1], DRESS[2]], { sep: 'outline', hi: 0.3, lo: 0.64 });
  // 胸元(肌)と、金の首飾り
  const neckline = P.mask().poly([T(-3, -1), T(4, -2), T(3, 5), T(1, 7), T(-1, 4)]);
  neckline.intersect(body);
  shade(P, neckline, [SKIN[0], SKIN[1], SKIN[2]], { sep: 'none', hi: 0.3, lo: 0.75 });
  for (let i = 0; i <= 6; i++) {
    const q = T(-2 + i, 2 + Math.round(Math.sin((i / 6) * Math.PI) * 3));
    P.px(q[0], q[1], i % 2 ? GOLD[1] : GOLD[0]);
  }
  // 金のベルト
  const bl = Math.round(p[1] - 7);
  body.each((x, y) => { if (y === bl && body.has(x, y - 1)) P.px(x, y, GOLD[1]); });
  const bq = T(1.5, bl - n[1]);
  P.px(bq[0], bl, GOLD[0]).px(bq[0] + 1, bl, GOLD[0]);
  // コートの手前の身ごろ(左)。開いたふちは明るい毛皮
  const front = furMask(P.mask().poly([
    [sF[0] - 3, sF[1] - 3], T(-1, 1), T(-1, 10), [p[0] - 2, p[1] - 3], [p[0] - 1, hemY - 1], [p[0] - 16, hemY + 1], [sF[0] - 8, sF[1] + 9]
  ]), 1.8);
  fillFur(P, front, false, 'outline', 0);
  front.each((x, y) => { if (!front.has(x + 1, y) && y > n[1] + 3) P.px(x, y, FUR[0]); });
  // 毛皮の重いひだ(肩からすそへ)
  const fold = (a: Pt, b: Pt, m: Mask) => {
    const k = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let i = 0; i <= k; i++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * i) / k), y = Math.round(a[1] + ((b[1] - a[1]) * i) / k);
      if (m.has(x, y) && m.has(x - 1, y) && m.has(x + 1, y)) P.px(x, y, FUR[2]);
    }
  };
  fold([sF[0] - 2, sF[1] + 8], [p[0] - 9, hemY], front);
  fold([sF[0] - 6, sF[1] + 12], [p[0] - 14, hemY], front);
  // 大きな毛皮のえり
  const collar = furMask(P.mask().ellipse(sF[0] + 1, sF[1] - 1, 5.2, 4.4).union(P.mask().ellipse(n[0] - 3, n[1] + 1, 4.5, 4))
    .union(P.mask().ellipse(sB[0] - 1, sB[1] - 1, 4.2, 3.8)).union(P.mask().ellipse(n[0] - 5, n[1] + 6, 4, 4)), 1.2);
  shade(P, collar, OUTLINE, { sep: 'outline' });
  shadeBall(P, collar, [FUR[0], FUR[1], FUR[2]], n[0] - 3, n[1] - 1, 11, 9, { sep: 'none', cut: [0.3, -0.25, -9] });
  furTufts(P, collar, FUR[2], 2);
  drawNeckAndHead(P, pose, bossHead(face), 2.2, [SKIN[0], SKIN[1], SKIN[2]]);
  drawArm(P, sF, pose.aF, false);
  P.outline();
  return P.g;
}

const STAND: BPose = {
  head: [53, 28], neck: [50, 31], hip: [47, 58],
  aB: { e: [60, 44], h: [62, 55] },
  aF: { e: [41, 44], h: [42, 55] },
  lB: { k: [52, 73], a: [53, 85], toe: 0.45 },
  lF: { k: [44, 73], a: [41, 85], toe: 0.45 }
};

/** 化けていた服の切れはし */
const SCRAPS: ScrapStyle = { dy: 20, spread: 0.42, xMax: 91, yMin: 1, colors: [FUR[1], DRESS[1], DRESS[2], FUR[2]] };

const pose = (edit: (p: BPose) => void, from: BPose = STAND): BPose => { const p = cloneB(from); edit(p); return p; };

export function buildBoss2(): PixelGrid[][] {
  // 0 正体を現す:しゃがんで変装を脱ぎすて、立ち上がって決める
  const r0 = pose((p) => {
    p.hip = [47, 66]; p.neck = [52, 38]; p.head = [55, 35];
    p.aF = { e: [51, 52], h: [59, 46] }; p.aB = { e: [63, 50], h: [62, 42] };
    p.lF = { k: [53, 76], a: [42, 85], toe: 0.45 }; p.lB = { k: [60, 78], a: [58, 85], toe: 0.45 };
  });
  const r1 = pose((p) => {
    p.hip = [47, 60]; p.neck = [49, 33]; p.head = [52, 30];
    p.aF = { e: [35, 40], h: [28, 33], hand: 'open' }; p.aB = { e: [65, 38], h: [74, 32], hand: 'open' };
  });
  const r2 = pose((p) => {
    p.aB = { e: [63, 34], h: [60, 21], hand: 'open' };
    p.aF = { e: [38, 46], h: [40, 57] };
  });
  const r3 = pose((p) => {
    p.aF = { e: [39, 46], h: [44, 56] };
    p.aB = { e: [63, 38], h: [74, 36], hand: 'point' };
    p.lF = { k: [45, 73], a: [45, 85], toe: 0.45 };
  });
  const reveal = [
    drawBoss(r0, 'smirk', 1), drawBoss(r1, 'shout', 2), drawBoss(r2, 'grin', 3), drawBoss(r3, 'smirk', 4)
  ].map((g) => alignFeet(g));

  // 1 待機:腕を組んで見下ろす
  const i0 = pose((p) => {
    p.aF = { e: [41, 47], h: [55, 45] };
    p.aB = { e: [61, 46], h: [50, 43] };
  });
  const idle = [alignFeet(drawBoss(i0, 'smirk')), alignFeet(drawBoss(moveUpperB(i0, 0, 1), 'smirk'))];

  // 2 暴れる:物を投げる、前をさして手下をけしかける、ヒールで踏み鳴らす
  const a0 = pose((p) => {
    p.neck = [48, 31]; p.head = [51, 28];
    p.aF = { e: [37, 36], h: [34, 25], hand: 'open' }; p.aB = { e: [61, 42], h: [66, 50] };
  });
  const a1 = pose((p) => {
    p.neck = [54, 32]; p.head = [57, 29];
    p.aF = { e: [60, 38], h: [72, 35], hand: 'open' }; p.aB = { e: [66, 44], h: [70, 53] };
    p.lF = { k: [50, 73], a: [53, 85], toe: 0.45 }; p.lB = { k: [47, 74], a: [39, 85], toe: 0.6 };
  });
  const a2 = pose((p) => {
    p.neck = [52, 31]; p.head = [55, 28];
    p.aF = { e: [58, 38], h: [70, 32], hand: 'point' }; p.aB = { e: [62, 45], h: [57, 54] };
  });
  const a3 = pose((p) => {
    p.aF = { e: [39, 44], h: [45, 53] }; p.aB = { e: [63, 36], h: [70, 28] };
    p.lF = { k: [52, 67], a: [51, 79], toe: 0.3 };
  });
  const rampage = [
    alignFeet(drawBoss(a0, 'shout')), alignFeet(drawBoss(a1, 'shout')), alignFeet(drawBoss(a2, 'shout')), alignFeet(drawBoss(a3, 'grin'))
  ];

  // 3 ラッシュを受ける
  const h0 = pose((p) => {
    p.neck = [45, 32]; p.head = [44, 29]; p.hip = [46, 58]; p.tilt = -0.3;
    p.aF = { e: [42, 42], h: [50, 36], hand: 'open' }; p.aB = { e: [58, 38], h: [66, 32], hand: 'open' };
    p.lB = { k: [55, 71], a: [60, 83], toe: 0.6 };
  });
  const h1 = pose((p) => {
    p.neck = [44, 34]; p.head = [44, 31]; p.hip = [45, 59]; p.tilt = -0.2;
    p.aF = { e: [35, 44], h: [33, 54], hand: 'open' }; p.aB = { e: [60, 40], h: [70, 38], hand: 'open' };
    p.lF = { k: [41, 73], a: [37, 85], toe: 0.45 };
  });
  const hit = [alignFeet(drawBoss(h0, 'hurt')), alignFeet(drawBoss(h1, 'hurt'))];

  // 4 やられる:よろけて、ひざをつき、目を回して倒れる
  const d0 = pose((p) => {
    p.neck = [44, 32]; p.head = [43, 29]; p.hip = [46, 58]; p.tilt = -0.35;
    p.aF = { e: [37, 44], h: [34, 53], hand: 'open' }; p.aB = { e: [58, 40], h: [66, 34], hand: 'open' };
    p.lB = { k: [55, 71], a: [60, 83], toe: 0.6 };
  });
  const d1 = pose((p) => {
    p.hip = [44, 70]; p.neck = [48, 43]; p.head = [51, 40];
    p.aF = { e: [43, 57], h: [47, 67], hand: 'open' }; p.aB = { e: [60, 56], h: [64, 66], hand: 'open' };
    p.lF = { k: [55, 77], a: [52, 86], toe: 0.45 }; p.lB = { k: [48, 87], a: [36, 87], toe: -0.2 };
  });
  const d2 = pose((p) => {
    p.aF = { e: [43, 40], h: [47, 32], hand: 'open' }; p.aB = { e: [62, 36], h: [70, 32], hand: 'open' };
    p.lB = { k: [58, 70], a: [66, 80], toe: 0.6 };
  });
  const d3 = pose((p) => {
    p.aF = { e: [43, 38], h: [41, 28], hand: 'open' }; p.aB = { e: [60, 46], h: [62, 57], hand: 'open' };
    p.lF = { k: [58, 70], a: [50, 84], toe: 0.3 };
  });
  const defeat = [
    alignFeet(drawBoss(d0, 'hurt')),
    alignFeet(drawBoss(d1, 'hurt')),
    rotateGrid(drawBoss(d2, 'ko'), -1.0, 48, 52, 48, 58),
    alignFeet(rotateGrid(drawBoss(d3, 'ko'), -Math.PI / 2, 48, 48, 48, 48))
  ];

  // 5 車に飛び乗る:しゃがむ → 跳ぶ → 空中で脚をたたむ → 屋根に着地
  const j0 = pose((p) => {
    p.hip = [45, 66]; p.neck = [50, 40]; p.head = [53, 37];
    p.aF = { e: [40, 50], h: [34, 57], hand: 'open' }; p.aB = { e: [58, 50], h: [54, 60], hand: 'open' };
    p.lF = { k: [54, 74], a: [44, 85], toe: 0.45 }; p.lB = { k: [60, 77], a: [55, 85], toe: 0.45 };
  });
  const j1 = pose((p) => {
    p.hip = [47, 56]; p.neck = [51, 28]; p.head = [54, 25];
    p.aF = { e: [39, 20], h: [41, 8], hand: 'open' }; p.aB = { e: [64, 20], h: [70, 10], hand: 'open' };
    p.lF = { k: [45, 72], a: [42, 86], toe: 1.0 }; p.lB = { k: [48, 71], a: [46, 85], toe: 1.1 };
  });
  const j2 = pose((p) => {
    p.hip = [47, 56]; p.neck = [51, 29]; p.head = [54, 26];
    p.aF = { e: [58, 38], h: [66, 32], hand: 'open' }; p.aB = { e: [40, 34], h: [34, 26], hand: 'open' };
    p.lF = { k: [58, 64], a: [50, 74], toe: 0.6 }; p.lB = { k: [55, 68], a: [44, 76], toe: 0.8 };
  });
  const j3 = pose((p) => {
    p.hip = [46, 64]; p.neck = [51, 37]; p.head = [54, 34];
    p.aF = { e: [41, 50], h: [45, 60] }; p.aB = { e: [62, 42], h: [72, 36], hand: 'open' };
    p.lF = { k: [54, 74], a: [44, 85], toe: 0.45 }; p.lB = { k: [58, 78], a: [58, 85], toe: 0.45 };
  });
  const jump = [
    alignFeet(drawBoss(j0, 'smirk')),
    alignCenter(drawBoss(j1, 'grin')),
    alignCenter(drawBoss(j2, 'grin')),
    alignFeet(drawBoss(j3, 'smirk'))
  ];
  return [reveal, idle, rampage, hit, defeat, jump];
}
