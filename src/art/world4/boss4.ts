// ビルのオーナー(親玉の正体)。96×96、足の裏は y=91、体の真ん中は x=48。
// 白いスーツに紫のマント、黒いシャツに紫のネクタイ。なでつけた黒髪に白い一筋。目が紫に光る(超能力の紫 PSY)。
// 体は bossKit の道具で組み立てる(人の仕組み figure.ts は使わない)。
import { OUTLINE, PixelGrid, md } from '../lib';
import { Painter, type Pt, rotateGrid } from '../world/pix';
import {
  type ArmDims, type BArm, type BLeg, type BPose, type HeadArt, type Ramp4,
  alignFeet, armShapes, cloneB, drawNeckAndHead, drawScraps, footShape, legShapes, moveUpperB, shade, shadeBall
} from '../world/bossKit';
import { PSY } from './palette';

// ---------- 色(15色) ----------
const SKIN = [md(7, 6, 5), md(7, 5, 4), md(5, 3, 3)] as const;
/** 白いスーツ(影は青みの灰色) */
const SUIT = [md(7, 7, 7), md(6, 6, 7), md(4, 4, 5)] as const;
/** 紫のマント(超能力の紫 PSY とは別の、暗い紫) */
const CAPE = [md(5, 2, 6), md(3, 1, 4), md(2, 0, 3)] as const;
/** 黒い髪、シャツ、靴 */
const DARK = md(2, 2, 3);
const GOLD = md(7, 5, 1);
/** 化けていた服の切れはし(ドレスの女性、ウェイター、手品師) */
const SCRAP = [CAPE[0], SUIT[0], DARK, GOLD];

type BossFace = 'smirk' | 'grin' | 'shout' | 'hurt' | 'ko';

// ---------- 頭 ----------

const HW = 26, HH = 28, NX = 12, NY = 25;

/**
 * 右向きの頭。なでつけた黒髪(後ろへ流れる)、白い一筋、細いあご。
 * 目は紫に光る(やられた顔では光が消える)
 */
function bossHead(face: BossFace): HeadArt {
  const P = new Painter(HW, HH);
  const sk: Ramp4 = [SKIN[0], SKIN[1], SKIN[2]];
  // 頭と顔(あごは前へとがる)
  const head = P.mask().ellipse(12, 11, 9, 9)
    .union(P.mask().poly([[5, 13], [20, 11], [21.5, 15], [20, 20], [16.5, 23.5], [12, 24], [8, 20]]));
  shadeBall(P, head, sk, 11, 8, 12, 14, { sep: 'outline', cut: [0.45, -0.15, -9] });
  // 鼻(前へ1ドット)
  P.px(22, 14, SKIN[1]).px(22, 15, SKIN[2]);
  // 髪:額から後ろへなでつける。額と顔は出す(前の生えぎわは高く、後ろはえりあしまで)
  const hair = P.mask().ellipse(9, 6, 8.5, 5).union(P.mask().poly([[1, 6], [7, 3], [6, 16], [2, 15]]))
    .subtract(P.mask().poly([[11, 8], [23, 4], [23, 14], [12, 13]]));
  shade(P, hair, [DARK, DARK, OUTLINE], { sep: 'outline', hi: 0.2, lo: 0.6 });
  // つや(なでつけた髪の流れ)
  P.line([12, 3], [6, 3], SUIT[2]);
  // 耳
  P.px(8, 13, SKIN[1]).px(8, 14, SKIN[2]).px(9, 14, SKIN[1]);
  // もみあげ
  P.px(9, 11, DARK).px(9, 12, DARK);
  const put = (pts: [number, number][], c: string) => { for (const [x, y] of pts) P.px(x, y, c); };
  const o = OUTLINE;
  // まゆ(つり上がる)
  put([[15, 9], [16, 8], [17, 8], [18, 8]], DARK); put([[20, 8], [21, 8]], DARK);
  if (face === 'ko') {
    put([[16, 11], [18, 13], [17, 12], [16, 13], [18, 11]], o);
    put([[20, 11], [21, 12], [20, 13]], o);
  } else if (face === 'hurt') {
    put([[15, 12], [16, 12], [17, 13], [18, 12]], o);
    put([[20, 12], [21, 12]], o);
  } else {
    // 光る目:手前は3×2、奥は2×2。まわりに紫の光がこぼれる
    put([[15, 10], [16, 10], [17, 10], [18, 10]], o);
    put([[16, 11], [17, 11], [16, 12]], PSY[1]); put([[18, 11], [17, 12]], PSY[0]); P.px(18, 12, PSY[1]);
    put([[20, 10], [21, 10]], o); put([[20, 11], [20, 12]], PSY[1]); put([[21, 11]], PSY[0]); P.px(21, 12, PSY[1]);
    if (face === 'shout' || face === 'grin') put([[19, 11], [15, 11], [22, 11]], PSY[2]);
  }
  // 口
  if (face === 'smirk') { put([[17, 19], [18, 19], [19, 19]], o); P.px(20, 18, o); }
  else if (face === 'grin') { put([[16, 18], [17, 19], [18, 19], [19, 19], [20, 18]], o); put([[17, 18], [18, 18], [19, 18]], SUIT[0]); }
  else if (face === 'shout') { P.rect(17, 18, 3, 3, o); P.px(18, 19, CAPE[1]); }
  else if (face === 'hurt') { put([[17, 19], [18, 18], [19, 19], [20, 18]], o); }
  else { put([[17, 19], [18, 19]], o); }
  // あごの影
  put([[13, 22], [14, 23], [15, 23]], SKIN[2]);
  return { g: P.g, nx: NX, ny: NY };
}

// ---------- 体 ----------

const ARM: ArmDims = { up: 3.4, fore: 3.2, wrist: 2.4, fist: 2.6 };
const shoulderF = (p: BPose): Pt => [p.neck[0] - 7, p.neck[1] + 5];
const shoulderB = (p: BPose): Pt => [p.neck[0] + 7, p.neck[1] + 4];

/** 腕(白いそで、金のカフス、手)。念力の手は指を広げる */
function drawArm(P: Painter, s: Pt, arm: BArm, far: boolean): void {
  const su: Ramp4 = far ? [SUIT[1], SUIT[2], SUIT[2]] : [SUIT[0], SUIT[1], SUIT[2]];
  const sk: Ramp4 = far ? [SKIN[1], SKIN[2], SKIN[2]] : [SKIN[0], SKIN[1], SKIN[2]];
  const { upper, fore, hand, wrist } = armShapes(P, s, arm, ARM);
  shade(P, upper.clone().union(fore).union(hand), OUTLINE, { sep: 'outline' });
  shade(P, upper, su, { sep: 'none', hi: 0.34, lo: 0.64 });
  shade(P, fore, su, { sep: 'dark', hi: 0.34, lo: 0.64 });
  const kind = arm.hand ?? 'fist';
  const dx = arm.h[0] - arm.e[0], dy = arm.h[1] - arm.e[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  if (kind === 'fist') shadeBall(P, hand, sk, arm.h[0] - 1, arm.h[1] - 1, 3.4, 3.4, { sep: 'outline', cut: [0.5, -0.1, -9] });
  else {
    const m = P.mask().ellipse(arm.h[0] - ux, arm.h[1] - uy, 2.2, 2.2);
    for (const q of kind === 'point' ? [0] : [-2, 0, 2]) {
      const len = kind === 'point' ? 5 : 4;
      m.capsule([arm.h[0] - uy * q * 0.6, arm.h[1] + ux * q * 0.6], [arm.h[0] + ux * len - uy * q * 1.4, arm.h[1] + uy * len + ux * q * 1.4], 0.5);
    }
    shade(P, m, sk, { sep: 'outline', hi: 0.4, lo: 0.7 });
  }
  // 袖口の黒いシャツと金のカフス
  const cuff = P.mask().capsule(wrist, [wrist[0] - ux * 0.8, wrist[1] - uy * 0.8], 1.6);
  shade(P, cuff, DARK, { sep: 'none' });
  P.px(wrist[0] - ux * 0.4, wrist[1] - uy * 0.4, GOLD);
}

function drawLeg(P: Painter, hipJ: Pt, leg: BLeg, far: boolean): void {
  const su: Ramp4 = far ? [SUIT[1], SUIT[2], SUIT[2]] : [SUIT[0], SUIT[1], SUIT[2]];
  const { thigh, shin } = legShapes(P, hipJ, leg, 4.4, 3.6, 2.8);
  shade(P, thigh.clone().union(shin), su, { sep: 'outline', hi: 0.3, lo: 0.62 });
  // ズボンの折り目
  P.px(leg.k[0] + 1, leg.k[1] + 2, su[2]).px(leg.k[0] + 1, leg.k[1] + 5, su[2]);
  // 黒い革靴
  const shoe = footShape(P, leg.a, leg.toe ?? 0, 7.5, 3.2, 2.5);
  shade(P, shoe, [DARK, DARK, OUTLINE], { sep: 'outline', hi: 0.3, lo: 0.7 });
}

/** 念力の光:手のまわりに紫の火花(十字) */
function psyHand(P: Painter, h: Pt, big: boolean): void {
  const spark = (x: number, y: number, r: number) => {
    for (let i = -r; i <= r; i++) { P.px(x + i, y, PSY[1]); P.px(x, y + i, PSY[1]); }
    P.px(x, y, PSY[0]);
    if (r > 1) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) P.px(x + dx, y + dy, PSY[2]);
  };
  spark(h[0] + 5, h[1] - 4, big ? 2 : 1);
  if (big) { spark(h[0] - 3, h[1] - 7, 1); spark(h[0] + 7, h[1] + 3, 1); }
}

interface BossOpts {
  /** 化けた服の切れはし(大きいほど遠くへ) */
  scraps?: number;
  /** 念力の光を出す手 */
  glow?: ('F' | 'B')[];
  /** 光を大きくする */
  big?: boolean;
}

function drawBoss(pose: BPose, face: BossFace, o: BossOpts = {}): PixelGrid {
  const P = new Painter(96, 96);
  if (o.scraps) drawScraps(P, pose, o.scraps, { dy: 18, spread: 0.42, xMax: 91, yMin: 1, colors: SCRAP });
  const n = pose.neck, p = pose.hip;
  const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
  const T = (dx: number, dy: number): Pt => [n[0] + dx + lean * dy, n[1] + dy];
  const sF = shoulderF(pose), sB = shoulderB(pose);
  // 背中のマント(ひざまで。すそはとがる)
  const foot = Math.max(pose.lF.a[1], pose.lB.a[1]);
  const hem = Math.min(foot - 4, p[1] + 22);
  const cape = P.mask().poly([
    [sF[0] - 1, sF[1] - 4], [sB[0] + 1, sB[1] - 4], [sB[0] + 3, sB[1] + 4], [p[0] - 2, hem - 6],
    [p[0] - 7, hem], [p[0] - 12, hem - 4], [p[0] - 18, hem + 1], [sF[0] - 9, sF[1] + 10]
  ]);
  shade(P, cape, [CAPE[0], CAPE[1], CAPE[2]], { sep: 'outline', hi: 0.18, lo: 0.5 });
  P.line([sF[0] - 4, sF[1] + 10], [p[0] - 12, hem - 5], CAPE[2]);
  P.line([sF[0] - 6, sF[1] + 14], [p[0] - 17, hem - 1], CAPE[2]);
  // 奥の腕と脚
  drawArm(P, sB, pose.aB, true);
  drawLeg(P, [p[0] + 3, p[1]], pose.lB, true);
  drawLeg(P, [p[0] - 3, p[1]], pose.lF, false);
  // 胴(白い上着。すそは腰の下まで)
  const body = P.mask().poly([
    T(-5, -1), T(5, -1), T(11, 3), T(12, 8), T(9, 15), [p[0] + 7, p[1] - 4], [p[0] + 8, p[1] + 4], [p[0] - 8, p[1] + 4], [p[0] - 7, p[1] - 4], T(-9, 15), T(-12, 6)
  ]);
  shade(P, body, [SUIT[0], SUIT[1], SUIT[2]], { sep: 'outline', hi: 0.3, lo: 0.64 });
  // 黒いシャツのV字と、紫のネクタイ
  const vee = P.mask().poly([T(-3, 0), T(6, -1), T(3, 13), T(1.5, 13)]).intersect(body);
  shade(P, vee, DARK, { sep: 'none' });
  const tie = P.mask().poly([T(1, 0), T(3.5, 0), T(3.2, 10), T(2.2, 12), T(1.3, 10)]).intersect(body);
  shade(P, tie, [CAPE[0], CAPE[1], CAPE[2]], { sep: 'none', hi: 0.3, lo: 0.7 });
  // えりの折り返し(影の線)とボタン
  P.line(T(-4, 1), T(1, 13), SUIT[2]).line(T(7, 0), T(3.6, 13), SUIT[2]);
  const bt = T(2.8, 18);
  P.px(bt[0], bt[1], SUIT[2]);
  // 胸ポケットの金のチーフ
  const pk = T(-5, 8);
  P.px(pk[0], pk[1], GOLD).px(pk[0] + 1, pk[1], GOLD);
  // 肩のマントの留め具(金)とえり(マントの紫を首の後ろに立てる)
  const col = P.mask().poly([[n[0] - 9, n[1] - 7], [n[0] - 2, n[1] + 1], [n[0] - 7, n[1] + 3], [n[0] - 11, n[1] - 1]]);
  shade(P, col, [CAPE[0], CAPE[1], CAPE[2]], { sep: 'outline', hi: 0.3, lo: 0.7 });
  P.rect(sF[0] + 1, sF[1] - 3, 2, 2, GOLD);
  drawNeckAndHead(P, { ...pose, head: [pose.head[0], pose.head[1] + 1] }, bossHead(face), 2.2, [SKIN[0], SKIN[1], SKIN[2]]);
  drawArm(P, sF, pose.aF, false);
  for (const h of o.glow ?? []) psyHand(P, h === 'F' ? pose.aF.h : pose.aB.h, !!o.big);
  P.outline();
  return P.g;
}

const STAND: BPose = {
  head: [52, 29], neck: [50, 31], hip: [47, 58],
  aB: { e: [60, 44], h: [62, 55] },
  aF: { e: [41, 45], h: [42, 56] },
  lB: { k: [52, 73], a: [54, 86] },
  lF: { k: [44, 73], a: [41, 86] }
};

const pose = (edit: (p: BPose) => void, from: BPose = STAND): BPose => { const p = cloneB(from); edit(p); return p; };

export function buildBoss4(): PixelGrid[][] {
  // 0 正体を現す:しゃがんで力をためる → 化けた服が念力で吹き飛ぶ → 両手を広げて立つ
  const r0 = pose((p) => {
    p.hip = [47, 66]; p.neck = [52, 38]; p.head = [54, 36];
    p.aF = { e: [51, 52], h: [59, 46] }; p.aB = { e: [63, 50], h: [62, 42] };
    p.lF = { k: [53, 76], a: [42, 86] }; p.lB = { k: [60, 78], a: [58, 86] };
  });
  const r1 = pose((p) => {
    p.hip = [47, 60]; p.neck = [49, 33]; p.head = [51, 31];
    p.aF = { e: [35, 40], h: [28, 33], hand: 'open' }; p.aB = { e: [65, 38], h: [74, 32], hand: 'open' };
  });
  const r2 = pose((p) => {
    p.aF = { e: [35, 36], h: [30, 26], hand: 'open' }; p.aB = { e: [64, 36], h: [72, 26], hand: 'open' };
  });
  const r3 = pose((p) => {
    p.aF = { e: [39, 46], h: [44, 56] };
    p.aB = { e: [63, 38], h: [74, 36], hand: 'open' };
  });
  const reveal = [
    drawBoss(r0, 'smirk', { scraps: 1 }),
    drawBoss(r1, 'shout', { scraps: 2, glow: ['F', 'B'] }),
    drawBoss(r2, 'shout', { scraps: 3, glow: ['F', 'B'], big: true }),
    drawBoss(r3, 'grin', { scraps: 4, glow: ['B'] })
  ].map((g) => alignFeet(g));

  // 1 待機:腕を組んで、見下ろす
  const i0 = pose((p) => {
    p.aF = { e: [41, 48], h: [55, 46] };
    p.aB = { e: [61, 46], h: [50, 43] };
  });
  const idle = [alignFeet(drawBoss(i0, 'smirk')), alignFeet(drawBoss(moveUpperB(i0, 0, 1), 'smirk'))];

  // 2 暴れる:手をかざして物を浮かせ、前へ投げつける
  const a0 = pose((p) => { p.aF = { e: [36, 30], h: [36, 18], hand: 'open' }; p.aB = { e: [63, 28], h: [66, 16], hand: 'open' }; });
  const a1 = pose((p) => {
    p.neck = [54, 32]; p.head = [57, 30];
    p.aF = { e: [62, 41], h: [75, 39], hand: 'open' }; p.aB = { e: [66, 45], h: [78, 47], hand: 'open' };
    p.lF = { k: [50, 73], a: [53, 86] }; p.lB = { k: [47, 74], a: [39, 86] };
  });
  const a2 = pose((p) => {
    p.neck = [52, 32]; p.head = [55, 30];
    p.aF = { e: [60, 38], h: [72, 32], hand: 'open' }; p.aB = { e: [66, 42], h: [74, 52] };
  });
  const a3 = pose((p) => {
    p.aF = { e: [35, 40], h: [30, 32], hand: 'open' }; p.aB = { e: [63, 36], h: [70, 28], hand: 'open' };
    p.lF = { k: [52, 67], a: [51, 79] };
  });
  const rampage = [
    alignFeet(drawBoss(a0, 'shout', { glow: ['F', 'B'] })),
    alignFeet(drawBoss(a1, 'shout', { glow: ['F'], big: true })),
    alignFeet(drawBoss(a2, 'grin', { glow: ['F'] })),
    alignFeet(drawBoss(a3, 'shout', { glow: ['B'] }))
  ];

  // 3 ラッシュを受ける
  const h0 = pose((p) => {
    p.neck = [45, 31]; p.head = [44, 29]; p.hip = [46, 58]; p.tilt = -0.25;
    p.aF = { e: [42, 42], h: [50, 36], hand: 'open' }; p.aB = { e: [58, 38], h: [66, 32], hand: 'open' };
    p.lB = { k: [55, 71], a: [60, 84], toe: 0.3 };
  });
  const h1 = pose((p) => {
    p.neck = [44, 33]; p.head = [44, 31]; p.hip = [45, 59]; p.tilt = -0.15;
    p.aF = { e: [35, 44], h: [33, 54], hand: 'open' }; p.aB = { e: [60, 40], h: [70, 38], hand: 'open' };
    p.lF = { k: [41, 73], a: [37, 86] };
  });
  const hit = [alignFeet(drawBoss(h0, 'hurt')), alignFeet(drawBoss(h1, 'hurt'))];

  // 4 やられる:よろけて、ひざをつき、目を回して倒れる
  const d0 = pose((p) => {
    p.neck = [44, 31]; p.head = [43, 29]; p.hip = [46, 58]; p.tilt = -0.3;
    p.aF = { e: [37, 44], h: [34, 53], hand: 'open' }; p.aB = { e: [58, 40], h: [66, 34], hand: 'open' };
    p.lB = { k: [55, 71], a: [60, 83], toe: 0.3 };
  });
  const d1 = pose((p) => {
    p.hip = [44, 70]; p.neck = [48, 42]; p.head = [50, 40];
    p.aF = { e: [43, 57], h: [47, 67], hand: 'open' }; p.aB = { e: [60, 56], h: [64, 66], hand: 'open' };
    p.lF = { k: [55, 77], a: [52, 86] }; p.lB = { k: [48, 87], a: [36, 87], toe: -0.2 };
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
    alignFeet(rotateGrid(drawBoss(d3, 'ko'), -Math.PI / 2, 48, 48, 48, 48), true)
  ];

  // 5 念力の選択:両手を上げて、客とシャンデリアを浮かせる(左上の客へ奥の手、真上のシャンデリアへ手前の手)
  const c0 = pose((p) => {
    p.aF = { e: [40, 40], h: [44, 32], hand: 'open' }; p.aB = { e: [61, 40], h: [66, 33], hand: 'open' };
  });
  const c1 = pose((p) => {
    p.neck = [49, 30]; p.head = [51, 28];
    p.aF = { e: [38, 30], h: [36, 18], hand: 'open' }; p.aB = { e: [62, 28], h: [67, 16], hand: 'open' };
  });
  const c2 = pose((p) => {
    p.neck = [49, 30]; p.head = [51, 28];
    p.aF = { e: [38, 28], h: [35, 15], hand: 'open' }; p.aB = { e: [62, 27], h: [68, 14], hand: 'open' };
    p.lF = { k: [43, 73], a: [39, 86] };
  });
  const c3 = pose((p) => {
    p.neck = [49, 31]; p.head = [51, 29];
    p.aF = { e: [38, 29], h: [36, 17], hand: 'open' }; p.aB = { e: [62, 28], h: [67, 15], hand: 'open' };
    p.lF = { k: [43, 73], a: [39, 86] };
  });
  const cast = [
    alignFeet(drawBoss(c0, 'smirk', { glow: ['F'] })),
    alignFeet(drawBoss(c1, 'shout', { glow: ['F', 'B'] })),
    alignFeet(drawBoss(c2, 'grin', { glow: ['F', 'B'], big: true })),
    alignFeet(drawBoss(c3, 'grin', { glow: ['F', 'B'] }))
  ];
  return [reveal, idle, rampage, hit, defeat, cast];
}
