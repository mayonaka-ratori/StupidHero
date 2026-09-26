// 宇宙人の親玉(正体)。96×96、足の裏は y=91、体の真ん中は x=48。
// 大きな頭に黒い大きな目と触角、銀の宇宙服、紫のえりと肩当てとマント。目と触角の玉と胸の宝石は黄緑(くずれと同じ色)。
// 体は bossKit の道具で組み立てる(人の仕組み figure.ts は使わない)。
import { OUTLINE, PixelGrid, md } from '../lib';
import { Painter, type Pt, rotateGrid } from '../world/pix';
import {
  type ArmDims, type BArm, type BLeg, type BPose, type HeadArt, type Ramp4,
  alignCenter, alignFeet, armShapes, drawNeckAndHead, drawScraps, footShape, legShapes, limbRamp, moveUpperB, poseMaker, shade, shadeBall,
  TALL_STAND, tallBossPoses
} from '../world/bossKit';
import { GLITCH } from './palette';

// ---------- 色(15色) ----------
/** 宇宙人の肌(うすい青緑) */
const ASKIN = [md(5, 7, 6), md(3, 6, 5), md(2, 4, 4)] as const;
const SUIT = [md(7, 7, 7), md(5, 5, 6), md(3, 3, 4)] as const;
const CAPE = [md(5, 2, 6), md(3, 1, 4), md(2, 0, 3)] as const;
/** 化けていた服の切れはし(おじさんのカーディガン、着ぐるみ、店員のシャツ、灰色のズボン) */
const SCRAP = [md(5, 4, 1), md(7, 5, 1), SUIT[0], SUIT[2]];

type BossFace = 'smirk' | 'grin' | 'shout' | 'hurt' | 'ko';

// ---------- 頭 ----------

/** 頭の格子の大きさと、首がつながる点 */
const HW = 30, HH = 31, NX = 15, NY = 28, AY = 4;

function bossHead(face: BossFace): HeadArt {
  const P = new Painter(HW, HH);
  const sk: Ramp4 = [ASKIN[0], ASKIN[1], ASKIN[2]];
  const glow: Ramp4 = [GLITCH[0], GLITCH[1], GLITCH[2]];
  // 大きな頭(後ろにふくらんだ卵形)と、細いあご
  const head = P.mask().ellipse(14, 13.5, 11.5, 10)
    .union(P.mask().poly([[5.5, 16], [25, 14.5], [23.5, 22], [19, 27.5], [15.5, 28.4], [11, 25.5]]));
  shade(P, head, OUTLINE, { sep: 'outline' });
  shadeBall(P, head, sk, 11, 10, 14, 15, { sep: 'none', cut: [0.5, 0.0, -9] });
  const put = (pts: [number, number][], c: string) => { for (const [x, y] of pts) P.px(x, y, c); };
  // 目:手前は大きなつり上がったアーモンド形、奥は細い
  if (face === 'ko') {
    // 目を回す(大きな×)
    P.line([16, 14], [20, 18], OUTLINE).line([20, 14], [16, 18], OUTLINE);
    P.line([23, 14], [25, 16], OUTLINE).line([25, 14], [23, 16], OUTLINE);
  } else if (face === 'hurt') {
    // ぎゅっとつぶる
    P.line([14, 17], [21, 15], OUTLINE).line([15, 18], [20, 18], OUTLINE).line([23, 16], [25, 15], OUTLINE);
    put([[15, 14], [16, 14], [17, 13]], ASKIN[2]);
  } else {
    const near = P.mask().poly([[13.5, 17], [17, 14], [22, 13.6], [21.8, 17.6], [17.5, 20.5]]);
    const far = P.mask().poly([[23.2, 14.2], [25, 13.8], [24.8, 17], [23.6, 18.4]]);
    shade(P, near.union(far), OUTLINE, { sep: 'none' });
    // 黄緑の照り返し
    put([[19, 15], [20, 15]], GLITCH[1]); P.px(20, 15, GLITCH[0]);
    put([[24, 15]], GLITCH[1]);
    if (face === 'shout' || face === 'grin') put([[18, 16], [19, 16], [20, 16]], GLITCH[1]);
    if (face === 'shout') { P.px(19, 15, GLITCH[0]); put([[24, 16]], GLITCH[1]); }
    // 目の上のまぶた(にらむ)
    P.line([15, 14], [21, 12], ASKIN[2]);
  }
  // 口(小さい)
  if (face === 'smirk') { P.line([18, 24], [20, 24], OUTLINE); P.px(21, 23, OUTLINE); }
  else if (face === 'grin') { P.line([17, 23], [21, 24], OUTLINE); P.line([18, 25], [20, 25], OUTLINE); put([[18, 24], [19, 24], [20, 24]], GLITCH[0]); }
  else if (face === 'shout') { P.rect(18, 23, 3, 3, OUTLINE); put([[19, 24]], CAPE[1]); }
  else if (face === 'hurt') { P.rect(18, 23, 3, 2, OUTLINE); P.px(19, 25, OUTLINE); }
  else { P.line([18, 24], [20, 25], OUTLINE); }
  // あごの影
  put([[16, 27], [17, 27], [18, 26]], ASKIN[2]);
  // 触角(後ろへしなる2本)と黄緑の玉。頭の上に AY ドット足した格子に、頭より奥に描く
  const A = new Painter(HW, HH + AY);
  const ant = A.mask().capsule([12, 9 + AY], [8, 2.6], 0.8).union(A.mask().capsule([18, 8 + AY], [21.5, 2.4], 0.8));
  shade(A, ant, sk, { sep: 'outline', hi: 0.4, lo: 0.7 });
  for (const [x, y] of [[7.2, 2.4], [22.2, 2.2]] as const) {
    const b = A.mask().ellipse(x, y, 1.8, 1.8);
    shadeBall(A, b, glow, x - 0.5, y - 0.5, 2.2, 2.2, { sep: 'outline', cut: [0.5, -0.1, -9] });
  }
  A.blit(P.g, 0, AY, 'outline');
  return { g: A.g, nx: NX, ny: NY + AY };
}

// ---------- 体 ----------

const ARM: ArmDims = { up: 3.4, fore: 3.2, wrist: 2.4, fist: 2.6 };
const shoulderF = (p: BPose): Pt => [p.neck[0] - 7, p.neck[1] + 5];
const shoulderB = (p: BPose): Pt => [p.neck[0] + 7, p.neck[1] + 4];

/** 腕(銀のそで、紫の袖口、青緑の長い指の手) */
function drawArm(P: Painter, s: Pt, arm: BArm, far: boolean): void {
  const su = limbRamp(SUIT, far);
  const cp = limbRamp(CAPE, far);
  const sk = limbRamp(ASKIN, far);
  const { upper, fore, hand, wrist } = armShapes(P, s, arm, ARM);
  shade(P, upper.clone().union(fore).union(hand), OUTLINE, { sep: 'outline' });
  shade(P, upper, su, { sep: 'none', hi: 0.34, lo: 0.64 });
  shade(P, fore, su, { sep: 'dark', hi: 0.34, lo: 0.64 });
  // 手:指を3本のばす(握るときは丸く)
  const kind = arm.hand ?? 'fist';
  const dx = arm.h[0] - arm.e[0], dy = arm.h[1] - arm.e[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  if (kind === 'fist') shadeBall(P, hand, sk, arm.h[0] - 1, arm.h[1] - 1, 3.4, 3.4, { sep: 'outline', cut: [0.5, -0.1, -9] });
  else {
    const m = P.mask().ellipse(arm.h[0] - ux, arm.h[1] - uy, 2.2, 2.2);
    for (const q of kind === 'point' ? [0] : [-1.6, 0, 1.6]) {
      const len = kind === 'point' ? 5 : 3.6;
      m.capsule([arm.h[0] - uy * q, arm.h[1] + ux * q], [arm.h[0] + ux * len - uy * q * 1.3, arm.h[1] + uy * len + ux * q * 1.3], 0.5);
    }
    shade(P, m, sk, { sep: 'outline', hi: 0.4, lo: 0.7 });
  }
  // 紫の袖口
  const cuff = P.mask().capsule(wrist, [wrist[0] - ux * 1.5, wrist[1] - uy * 1.5], 2.1);
  shade(P, cuff, cp, { sep: 'outline', hi: 0.35, lo: 0.7 });
}

function drawLeg(P: Painter, hipJ: Pt, leg: BLeg, far: boolean): void {
  const su = limbRamp(SUIT, far);
  const cp = limbRamp(CAPE, far);
  const { thigh, shin } = legShapes(P, hipJ, leg, 4.4, 3.6, 2.8);
  shade(P, thigh.clone().union(shin), su, { sep: 'outline', hi: 0.3, lo: 0.62 });
  // ひざの線
  P.px(leg.k[0] + 2, leg.k[1], su[2]).px(leg.k[0] + 3, leg.k[1] + 1, su[2]);
  // 紫の長靴(先がとがる)
  const toe = leg.toe ?? 0;
  const top: Pt = [leg.k[0] + (leg.a[0] - leg.k[0]) * 0.55, leg.k[1] + (leg.a[1] - leg.k[1]) * 0.55];
  const boot = P.mask().capsule(top, leg.a, 4, 3).union(footShape(P, leg.a, toe, 8.5, 3.6, 3));
  shade(P, boot, cp, { sep: 'outline', hi: 0.3, lo: 0.62 });
  boot.each((x, y) => { if (!boot.has(x, y - 1) && y < leg.a[1] - 3) P.px(x, y, cp[0]); });
}

/** 目から出る黄緑の光線(暴れるコマ)。from から向き ang へ。先はコマの中で細くとがらせて終える */
function eyeBeam(P: Painter, from: Pt, ang: number): void {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const L = Math.min((88 - from[0]) / Math.max(0.01, ux), (84 - from[1]) / Math.max(0.01, uy));
  const at = (t: number): Pt => [from[0] + ux * L * t, from[1] + uy * L * t];
  const outer = P.mask().capsule(from, at(0.6), 1.2, 3.2).union(P.mask().capsule(at(0.6), at(1), 3.2, 0.4));
  const inner = P.mask().capsule(from, at(0.6), 0.3, 1.4).union(P.mask().capsule(at(0.6), at(0.9), 1.4, 0.2));
  shade(P, outer, GLITCH[1], { sep: 'none' });
  shade(P, inner, GLITCH[0], { sep: 'none' });
  outer.each((x, y) => { if (!outer.has(x, y - 1) || !outer.has(x, y + 1)) P.px(x, y, GLITCH[2]); });
}

function drawBoss(pose: BPose, face: BossFace, o: { scraps?: number; beam?: number } = {}): PixelGrid {
  const P = new Painter(96, 96);
  // 切れはしは体より奥に(顔にかからないように)
  if (o.scraps) drawScraps(P, pose, o.scraps, { dy: 18, spread: 0.42, xMax: 91, yMin: 1, colors: SCRAP });
  const n = pose.neck, p = pose.hip;
  const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
  const T = (dx: number, dy: number): Pt => [n[0] + dx + lean * dy, n[1] + dy];
  const sF = shoulderF(pose), sB = shoulderB(pose);
  // 背中のマント(すそがとがる)
  const foot = Math.max(pose.lF.a[1], pose.lB.a[1]);
  const hem = Math.min(foot - 2, p[1] + 26);
  const cape = P.mask().poly([
    [sF[0] - 1, sF[1] - 4], [sB[0] + 1, sB[1] - 4], [sB[0] + 3, sB[1] + 4], [p[0] - 2, hem - 6],
    [p[0] - 7, hem], [p[0] - 12, hem - 4], [p[0] - 17, hem + 1], [sF[0] - 8, sF[1] + 10]
  ]);
  shade(P, cape, [CAPE[0], CAPE[1], CAPE[2]], { sep: 'outline', hi: 0.18, lo: 0.5 });
  // マントのひだ
  P.line([sF[0] - 4, sF[1] + 10], [p[0] - 12, hem - 5], CAPE[2]);
  // 奥の腕と脚
  drawArm(P, sB, pose.aB, true);
  drawLeg(P, [p[0] + 3, p[1]], pose.lB, true);
  drawLeg(P, [p[0] - 3, p[1]], pose.lF, false);
  // 胴(銀)
  const body = P.mask().poly([
    T(-5, -1), T(5, -1), T(11, 3), T(12, 8), T(8, 15), [p[0] + 6, p[1] - 6], [p[0] + 8, p[1] + 2], [p[0] - 8, p[1] + 2], [p[0] - 6, p[1] - 6], T(-9, 15), T(-12, 6)
  ]);
  shade(P, body, [SUIT[0], SUIT[1], SUIT[2]], { sep: 'outline', hi: 0.3, lo: 0.64 });
  // 胸の紫のV字と、黄緑の宝石
  const vee = P.mask().poly([T(-4, 0), T(6, -1), T(2.5, 11), T(1, 11)]).intersect(body);
  shade(P, vee, [CAPE[0], CAPE[1], CAPE[2]], { sep: 'none', hi: 0.3, lo: 0.7 });
  const gem = T(1.5, 7);
  shadeBall(P, P.mask().ellipse(gem[0], gem[1], 1.6, 1.6), [GLITCH[0], GLITCH[1], GLITCH[2]], gem[0] - 0.5, gem[1] - 0.5, 2, 2, { sep: 'outline', cut: [0.4, -0.2, -9] });
  // 胴の線(胸と腹を分ける)とベルト
  for (let dy = 13; dy <= p[1] - n[1] - 7; dy++) { const q = T(3, dy); if (body.has(Math.round(q[0]), Math.round(q[1]))) P.px(q[0], q[1], SUIT[2]); }
  const by = Math.round(p[1] - 5);
  body.each((x, y) => { if (y === by || y === by + 1) P.px(x, y, y === by ? CAPE[1] : CAPE[2]); });
  const bx = Math.round(p[0] + 1);
  P.rect(bx, by - 1, 3, 3, GLITCH[1]).px(bx, by - 1, GLITCH[0]).px(bx + 2, by + 1, GLITCH[2]);
  // 大きな肩当て
  for (const [s, far] of [[sB, true], [sF, false]] as const) {
    const m = P.mask().ellipse(s[0], s[1] - 1, 5.4, 3.8).union(P.mask().poly([[s[0] - 5, s[1] - 1], [s[0] + (far ? 7 : -8), s[1] - 7], [s[0] + 4, s[1] - 2]]));
    shade(P, m, limbRamp(CAPE, far), { sep: 'outline', hi: 0.4, lo: 0.72 });
  }
  // えり(首の後ろに高く立てる)
  const col = P.mask().poly([[n[0] - 9, n[1] - 9], [n[0] - 2, n[1] + 1], [n[0] - 7, n[1] + 3], [n[0] - 11, n[1] - 1]]);
  shade(P, col, [CAPE[0], CAPE[1], CAPE[2]], { sep: 'outline', hi: 0.3, lo: 0.7 });
  // 頭は2ドット下げて、高いえりに首を半分うめる
  drawNeckAndHead(P, { ...pose, head: [pose.head[0], pose.head[1] + 2] }, bossHead(face), 2.2, [ASKIN[0], ASKIN[1], ASKIN[2]]);
  drawArm(P, sF, pose.aF, false);
  if (o.beam !== undefined) eyeBeam(P, [pose.head[0] + 5, pose.head[1] - 11], o.beam);
  P.outline();
  return P.g;
}

const pose = poseMaker(TALL_STAND);

export function buildBoss3(): PixelGrid[][] {
  // ボス4と同じポーズは bossKit の tallBossPoses から
  const { r0, r1, r2, r3, i0, a1, a3, h0, h1, d0, d1, d2, d3 } = tallBossPoses();
  // 0 正体を現す:しゃがんで化けた服を裂き、両手を広げて立ち上がる
  const reveal = [
    drawBoss(r0, 'smirk', { scraps: 1 }), drawBoss(r1, 'shout', { scraps: 2 }), drawBoss(r2, 'shout', { scraps: 3 }), drawBoss(r3, 'grin', { scraps: 4 })
  ].map((g) => alignFeet(g));

  // 1 待機:腕を組んで、ゆっくり揺れる
  const idle = [alignFeet(drawBoss(i0, 'smirk')), alignFeet(drawBoss(moveUpperB(i0, 0, 1), 'smirk'))];

  // 2 暴れる:両手を振り上げる、前へ突き出す、目から光を出して振り下ろす、ふんぞり返る
  const a0 = pose((p) => { p.aF = { e: [36, 23], h: [37, 11], hand: 'open' }; p.aB = { e: [63, 21], h: [64, 9], hand: 'open' }; });
  const a2 = pose((p) => {
    p.neck = [52, 32]; p.head = [55, 30];
    p.aF = { e: [42, 46], h: [38, 56] }; p.aB = { e: [66, 42], h: [74, 52] };
  });
  const rampage = [
    alignFeet(drawBoss(a0, 'shout')), alignFeet(drawBoss(a1, 'shout')), alignFeet(drawBoss(a2, 'grin', { beam: 0.45 })), alignFeet(drawBoss(a3, 'shout'))
  ];

  // 3 ラッシュを受ける
  const hit = [alignFeet(drawBoss(h0, 'hurt')), alignFeet(drawBoss(h1, 'hurt'))];

  // 4 やられる:よろけて、ひざをつき、目を回して倒れる
  const defeat = [
    alignFeet(drawBoss(d0, 'hurt')),
    alignFeet(drawBoss(d1, 'hurt')),
    rotateGrid(drawBoss(d2, 'ko'), -1.0, 48, 52, 48, 58),
    alignFeet(rotateGrid(drawBoss(d3, 'ko'), -Math.PI / 2, 48, 48, 48, 48), true)
  ];

  // 5 母艦に乗りこむ:天をさして呼ぶ → しゃがむ → 両手を上げて浮き上がる → ひざをかかえて吸いこまれる
  const b0 = pose((p) => {
    p.head = [53, 29];
    p.aF = { e: [41, 46], h: [43, 56] }; p.aB = { e: [64, 25], h: [68, 12], hand: 'point' };
  });
  const b1 = pose((p) => {
    p.hip = [45, 66]; p.neck = [50, 39]; p.head = [52, 37];
    p.aF = { e: [40, 50], h: [34, 57], hand: 'open' }; p.aB = { e: [58, 50], h: [54, 60], hand: 'open' };
    p.lF = { k: [54, 74], a: [44, 86] }; p.lB = { k: [60, 77], a: [55, 86] };
  });
  const b2 = pose((p) => {
    p.hip = [47, 56]; p.neck = [50, 28]; p.head = [52, 26];
    p.aF = { e: [36, 26], h: [34, 14], hand: 'open' }; p.aB = { e: [65, 24], h: [72, 14], hand: 'open' };
    p.lF = { k: [49, 68], a: [45, 78], toe: 0.9 }; p.lB = { k: [53, 67], a: [51, 77], toe: 1.0 };
  });
  const b3 = pose((p) => {
    p.hip = [47, 56]; p.neck = [50, 29]; p.head = [52, 27];
    p.aF = { e: [42, 40], h: [50, 46] }; p.aB = { e: [62, 40], h: [56, 48] };
    p.lF = { k: [56, 64], a: [48, 74], toe: 0.6 }; p.lB = { k: [55, 68], a: [46, 77], toe: 0.8 };
  });
  const board = [
    alignFeet(drawBoss(b0, 'grin')),
    alignFeet(drawBoss(b1, 'smirk')),
    alignCenter(drawBoss(b2, 'grin')),
    alignCenter(drawBoss(b3, 'smirk'))
  ];
  return [reveal, idle, rampage, hit, defeat, board];
}
