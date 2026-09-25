// 路地裏のボス(正体)。96×96、足の裏は y=91、体の真ん中は x=48。
// はげ頭の大男。はだけた赤い革のベストから胸板と腹筋、金の鎖。両腕に水色の入れ墨、黒いズボンと長靴。
// 体は bossKit の道具で組み立てる(人の仕組み figure.ts は使わない)。
import { OUTLINE, PixelGrid, md } from '../lib';
import { Mask, type Pt, Painter, rotateGrid } from './pix';
import {
  type ArmDims, type BArm, type BPose, type HeadArt, type Ramp4, type ScrapStyle,
  alignFeet, armShapes, chevronMask, cloneB, drawNeckAndHead, drawScraps, farRamp, footShape, legShapes, moveUpperB, shade, shadeBall
} from './bossKit';

// ---------- 色(15色) ----------
/** 肌(市民とそろえた3色に、いちばん暗い色を足す) */
const SKIN = [md(7, 6, 5), md(7, 5, 4), md(5, 3, 3), md(3, 1, 2)] as const;
const VEST = [md(6, 1, 1), md(4, 0, 1), md(2, 0, 1), OUTLINE] as const;
const PANTS = [md(3, 3, 4), md(2, 2, 3), md(1, 1, 2), OUTLINE] as const;
/** 長靴(ベストと同じ赤い革) */
const BOOTS: Ramp4 = [VEST[0], VEST[1], VEST[2], OUTLINE];
const INK = [md(1, 5, 6), md(0, 3, 5)] as const;
const GOLD: Ramp4 = [md(7, 7, 3), md(7, 5, 1), VEST[1]];

type BossFace = 'grim' | 'grin' | 'shout' | 'hurt' | 'ko';

// ---------- 頭 ----------

/** 頭の格子の大きさと、首がつながる点 */
const HW = 22, HH = 22, NX = 9, NY = 18;

function bossHead(face: BossFace): HeadArt {
  const P = new Painter(HW, HH);
  // はげ頭(後ろに大きい丸)と、角ばった太いあご、前に出た鼻
  const head = P.mask().ellipse(10, 8.5, 7.6, 7.8)
    .union(P.mask().poly([[3.5, 9], [16.5, 8], [18.2, 12.5], [18, 16.5], [15, 19.4], [7, 19.4], [3.6, 15]]))
    .union(P.mask().poly([[16.5, 8.5], [20.3, 13.2], [17, 14.2]]));
  shadeBall(P, head, SKIN, 11.5, 7, 12, 13, { sep: 'none', cut: [0.52, -0.12, -0.45] });
  // 耳(ふちは影の色で、目に見えないように明るく)
  const ear = P.mask().ellipse(6.2, 11.8, 1.6, 2.4);
  shadeBall(P, ear, [SKIN[0], SKIN[1], SKIN[2]], 5.5, 10.5, 3, 3, { sep: 'dark', cut: [0.4, -0.2, -0.9] });
  P.px(7, 11, SKIN[2]).px(7, 12, SKIN[2]);
  const o = OUTLINE, dk = SKIN[3], sh = SKIN[2], wt = SKIN[0];
  const put = (pts: [number, number][], c: string) => { for (const [x, y] of pts) P.px(x, y, c); };
  const bd = VEST[2];
  // 首の後ろの肉のしわ
  put([[4, 16], [5, 17]], dk);
  // 濃いあごひげ(あごの線にそって、口のまわりまで)
  const beard = P.mask().poly([[8.5, 16.5], [12.5, 14.6], [15, 13.6], [18.8, 13.6], [18.6, 17], [15.4, 19.6], [8, 19.6]]).intersect(head);
  beard.each((x, y) => { P.px(x, y, bd); });
  // 眉(太く濃い)と目(くぼみの中に白い光)
  put([[16, 12], [17, 12]], sh);
  if (face === 'hurt') {
    // 目をぎゅっとつぶる(しわを寄せる)
    put([[12, 8], [13, 8], [16, 8], [17, 8]], o);
    put([[13, 10], [14, 10], [15, 10], [16, 10]], o);
    put([[14, 9], [15, 9], [13, 11], [14, 11], [15, 11]], dk);
  } else if (face === 'ko') {
    // 目を回す(×)
    put([[11, 8], [12, 8], [13, 8], [14, 8], [15, 8], [16, 8], [17, 8]], dk);
    put([[13, 9], [16, 9], [14, 10], [15, 10], [13, 11], [16, 11]], o);
  } else {
    // 怒った眉:前へ下がる、2段の太さ。その下のくぼみに目
    put([[11, 7], [12, 7], [13, 7], [12, 8], [13, 8], [14, 8], [15, 8], [14, 9], [15, 9], [16, 9], [17, 9], [16, 8]], o);
    put([[13, 9], [13, 10], [13, 11], [14, 11], [15, 11], [16, 11]], dk);
    put([[14, 10]], wt);
    put([[15, 10], [16, 10]], o);
    if (face === 'shout') put([[14, 10], [15, 10]], wt);
    put([[17, 10]], sh);
  }
  // 口(ひげの中。唇は明るく)
  if (face === 'grim') { put([[14, 15], [15, 15], [16, 15], [17, 15], [18, 15]], o); put([[15, 16], [16, 16], [17, 16]], sh); }
  if (face === 'grin') {
    put([[13, 14], [14, 15], [18, 15], [19, 14], [14, 16], [15, 17], [16, 17], [17, 17], [18, 16]], o);
    put([[15, 15], [16, 15], [17, 15]], wt);
    put([[15, 16], [16, 16], [17, 16]], o);
  }
  if (face === 'shout' || face === 'hurt') {
    put([[14, 14], [15, 14], [16, 14], [17, 14], [18, 14], [14, 15], [14, 16], [14, 17], [15, 18], [16, 18], [17, 18], [18, 17]], o);
    put([[15, 15], [16, 15], [17, 15], [18, 15]], wt);
    put([[15, 16], [16, 16], [17, 16], [18, 16], [15, 17], [16, 17], [17, 17]], o);
    put([[16, 17], [17, 17]], VEST[0]);
  }
  if (face === 'ko') {
    put([[14, 15], [15, 15], [16, 15], [17, 15], [14, 16], [15, 17], [16, 17]], o);
    put([[15, 16], [16, 16]], VEST[0]);
  }
  // 金の耳飾り
  P.px(6, 14, GOLD[1]).px(6, 15, GOLD[0]);
  return { g: P.g, nx: NX, ny: NY };
}

// ---------- 体 ----------

const ARM: ArmDims = { up: 5, fore: 4.6, wrist: 3.6, fist: 3.8, bulge: 1.2 };
const THIGH = 6.2, SHIN = 5, ANKLE = 4;

/** 肩(腕のつけ根)。手前は左、奥は右 */
const shoulderF = (p: BPose): Pt => [p.neck[0] - 10, p.neck[1] + 6];
const shoulderB = (p: BPose): Pt => [p.neck[0] + 9, p.neck[1] + 5];

/** 腕の入れ墨(水色のやじり模様)。肌の上だけに描き、影のところは暗い水色。はみ出た1ドットは描かない */
function armTattoo(P: Painter, a: Pt, b: Pt, t0: number, t1: number, count: number, r: number, far: boolean): void {
  const m = chevronMask(P, a, b, t0, t1, count, r, 2.2);
  m.each((x, y) => {
    const cur = P.g.get(x, y);
    if (cur !== SKIN[0] && cur !== SKIN[1] && cur !== SKIN[2]) m.set(x, y, false);
  });
  const keep: Pt[] = [];
  m.each((x, y) => {
    let k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && m.has(x + dx, y + dy)) k++;
    if (k >= 2) keep.push([x, y]);
  });
  for (const [x, y] of keep) P.px(x, y, far || P.g.get(x, y) === SKIN[2] ? INK[1] : INK[0]);
}

function drawArm(P: Painter, s: Pt, arm: BArm, far: boolean): void {
  const sk = far ? farRamp(SKIN) : SKIN;
  const { upper, fore, hand } = armShapes(P, s, arm, ARM);
  const all = upper.clone().union(fore).union(hand);
  // 腕全体を、前に描いた物からふちで分ける
  shade(P, all, OUTLINE, { sep: 'outline' });
  // 肩の丸み(三角筋)
  const delt = P.mask().ellipse(s[0], s[1] + 0.5, 5.6, 5.2);
  shade(P, upper.clone().union(delt), sk, { sep: 'none', hi: 0.34, lo: 0.62 });
  shade(P, fore, sk, { sep: 'dark', hi: 0.34, lo: 0.62 });
  armTattoo(P, s, arm.e, 0.3, 0.78, 2, 3.6, far);
  armTattoo(P, arm.e, arm.h, 0.3, 0.3, 1, 3.2, far);
  // こぶし:玉のように塗り、指の境目に影の線
  const hx = arm.h[0], hy = arm.h[1];
  shadeBall(P, hand, sk, hx - 1, hy - 1, ARM.fist + 1.5, ARM.fist + 1.5, { sep: 'outline', cut: [0.5, 0.05, -0.4] });
  const dx = arm.h[0] - arm.e[0], dy = arm.h[1] - arm.e[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  if ((arm.hand ?? 'fist') === 'fist') {
    for (let q = -2; q <= 2; q++) {
      const x = Math.round(hx + ux * 1.2 - uy * q), y = Math.round(hy + uy * 1.2 + ux * q);
      if (hand.has(x, y) && hand.has(x + Math.round(ux), y + Math.round(uy))) P.px(x, y, sk[2]);
    }
  }
}

function drawLeg(P: Painter, hipJ: Pt, leg: BPose['lF'], far: boolean, extra?: Mask): void {
  const pr = far ? farRamp(PANTS) : PANTS;
  const { thigh, shin } = legShapes(P, hipJ, leg, THIGH, SHIN, ANKLE);
  const m = thigh.clone().union(shin);
  if (extra) m.union(extra);
  shade(P, m, pr, { sep: 'outline', hi: 0.22, lo: 0.6, deep: 0.93 });
  // ひざ:明るい点と、裏のしわ
  const k: Pt = [Math.round(leg.k[0]), Math.round(leg.k[1])];
  if (m.has(k[0] - 2, k[1] - 1)) P.px(k[0] - 2, k[1] - 1, pr[0]).px(k[0] - 1, k[1] - 1, pr[0]);
  P.px(k[0] + 2, k[1], pr[2]).px(k[0] + 3, k[1] + 1, pr[2]);
  // 長靴:すねの下と足。はき口は少し広い
  const toe = leg.toe ?? 0;
  const bootTop: Pt = [leg.k[0] + (leg.a[0] - leg.k[0]) * 0.56, leg.k[1] + (leg.a[1] - leg.k[1]) * 0.56];
  const boot = P.mask().capsule(bootTop, leg.a, SHIN + 0.4, ANKLE).union(footShape(P, leg.a, toe, 11, 4, 3.6));
  const br = far ? farRamp(BOOTS) : BOOTS;
  shade(P, boot, br, { sep: 'outline', hi: 0.28, lo: 0.62, deep: 0.9 });
  // はき口の明るい線と、底
  boot.each((x, y) => { if (!boot.has(x, y - 1) && y < leg.a[1] - 3) P.px(x, y, br[0]); });
  if (Math.abs(toe) < 0.25) {
    let yb = 0;
    boot.each((_x, y) => { yb = Math.max(yb, y); });
    boot.each((x, y) => { if (y === yb) P.px(x, y, OUTLINE); });
    // つま先のつや
    const tx = Math.round(leg.a[0] + 6), ty = Math.round(leg.a[1] + 1);
    if (boot.has(tx, ty)) P.px(tx, ty, br[0]).px(tx + 1, ty, br[0]);
  }
}

/** 胴:革のベストと、はだけた胸板と腹筋 */
function drawTorso(P: Painter, pose: BPose): void {
  const n = pose.neck, p = pose.hip;
  const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
  const X = (dx: number, dy: number): number => n[0] + dx + lean * dy;
  const Y = (dy: number): number => n[1] + dy;
  const T = (dx: number, dy: number): Pt => [X(dx, dy), Y(dy)];
  const H = p[1] - n[1];
  // 胴の形(逆三角)
  const body = P.mask().poly([
    T(-6, -2), T(6, -3), T(12, 1), T(15, 7), T(14, 15), [p[0] + 10, p[1] - 5], [p[0] - 10, p[1] - 5], T(-14, 16), T(-16, 8), T(-12, 1)
  ]);
  shade(P, body, VEST, { sep: 'outline', hi: 0.3, lo: 0.66 });
  // はだけた前:胸板と腹筋
  const open = P.mask().poly([T(-5, -1), T(8, -2), T(9, 8), T(7, 16), [p[0] + 5, p[1] - 5], [p[0] - 2, p[1] - 5], T(-3, 16), T(-5, 8)]);
  open.intersect(body);
  shade(P, open, SKIN, { sep: 'none', hi: 0.28, lo: 0.68, deep: 0.95 });
  // ベストのふち(開いたところに明るい線)
  open.each((x, y) => {
    if (!open.has(x - 1, y) && body.has(x - 1, y)) P.px(x - 1, y, VEST[0]);
    if (!open.has(x + 1, y) && body.has(x + 1, y)) P.px(x + 1, y, VEST[2]);
  });
  // 胸の下の線(左右の胸)と、みぞおちから下の線
  const c = 2;
  const put = (dx: number, dy: number, col: string) => { const x = Math.round(X(dx, dy)), y = Math.round(Y(dy)); if (open.has(x, y)) P.px(x, y, col); };
  // 左右の胸:下のふちに影と暗い線、左上に明るいところ
  for (const [x0, x1] of [[-4, 1], [3, 8]] as const) {
    for (let dx = x0; dx <= x1; dx++) { put(dx, 10, SKIN[3]); if (dx > x0) put(dx, 9, SKIN[2]); }
    put(x0, 9, SKIN[3]);
    for (let dx = x0 + 1; dx <= x0 + 2; dx++) { put(dx, 3, SKIN[0]); put(dx, 4, SKIN[0]); }
  }
  // 胸の間と、腹筋の線
  for (let dy = 2; dy <= 9; dy++) put(c, dy, SKIN[2]);
  for (let dy = 11; dy < H - 6; dy++) put(c, dy, SKIN[2]);
  for (const dy of [15, 19, 23]) {
    if (dy >= H - 7) continue;
    for (const dx of [-1, 0, 1, 3, 4, 5]) put(dx, dy, SKIN[2]);
    put(-1, dy + 1, SKIN[0]); put(3, dy + 1, SKIN[0]);
  }
  // 立てたえり
  const col = P.mask().poly([T(-8, -3), T(-4, -5), T(-2, 1), T(-6, 3)]).union(P.mask().poly([T(5, -5), T(9, -3), T(9, 2), T(6, 0)]));
  shade(P, col, VEST, { sep: 'outline', hi: 0.4, lo: 0.7 });
  // 金の鎖と飾り
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    const dx = -3 + i * 1.1, dy = 1 + Math.round(Math.sin(a) * 6);
    put(dx, dy, i % 2 ? GOLD[1] : GOLD[0]);
  }
  const mx = Math.round(X(2, 8)), my = Math.round(Y(8));
  P.rect(mx - 1, my, 3, 3, GOLD[1]).px(mx - 1, my, GOLD[0]).px(mx, my, GOLD[0]).px(mx + 1, my + 2, GOLD[2]);
  // ベルトと金のバックル
  const by = Math.round(p[1] - 5);
  for (let x = Math.round(p[0] - 12); x <= Math.round(p[0] + 12); x++) {
    if (P.g.get(x, by) && P.g.get(x, by) !== OUTLINE) { P.px(x, by, OUTLINE); P.px(x, by + 1, PANTS[2]); }
  }
  const bx = Math.round(p[0] + 1);
  P.rect(bx, by - 1, 5, 4, GOLD[1]).px(bx, by - 1, GOLD[0]).px(bx + 1, by - 1, GOLD[0]).px(bx, by, GOLD[0])
    .px(bx + 2, by + 1, OUTLINE).px(bx + 4, by + 2, GOLD[2]);
}

function drawBoss(pose0: BPose, face: BossFace, scraps = 0): PixelGrid {
  const P = new Painter(96, 96);
  // 脚を長く見せるため、腰を2ドット上げる
  const pose: BPose = { ...pose0, hip: [pose0.hip[0], pose0.hip[1] - 2] };
  // 切れはしは体より奥に(顔にかからないように)
  if (scraps) drawScraps(P, pose, scraps, SCRAPS);
  const p = pose.hip;
  // 奥の腕と脚
  drawArm(P, shoulderB(pose), pose.aB, true);
  drawLeg(P, [p[0] + 4, p[1]], pose.lB, true);
  // 手前の脚は、腰まわりと1つの形で塗る
  const pelvis = P.mask().poly([[p[0] - 10, p[1] - 6], [p[0] + 10, p[1] - 6], [p[0] + 9.5, p[1] + 2], [p[0] + 3, p[1] + 6], [p[0] - 4, p[1] + 6], [p[0] - 10, p[1] + 2]]);
  drawLeg(P, [p[0] - 4, p[1]], pose.lF, false, pelvis);
  drawTorso(P, pose);
  drawNeckAndHead(P, pose, bossHead(face), 5, [SKIN[1], SKIN[2], SKIN[3]], false, SKIN[3]);
  drawArm(P, shoulderF(pose), pose.aF, false);
  P.outline();
  return P.g;
}

/** 化けていた服の切れはし(黒いズボン、白いシャツ、ピンクの服) */
const SCRAPS: ScrapStyle = {
  dy: 14, spread: 0.4, xMax: 93, yMin: -Infinity,
  colors: [PANTS[2], SKIN[0], VEST[0], PANTS[1], VEST[0], SKIN[0], VEST[0], PANTS[2]]
};

const STAND: BPose = {
  head: [52, 24], neck: [49, 26], hip: [47, 57],
  aB: { e: [62, 42], h: [65, 52] },
  aF: { e: [39, 44], h: [44, 54] },
  lB: { k: [54, 73], a: [57, 86] },
  lF: { k: [42, 73], a: [39, 86] }
};

const pose = (edit: (p: BPose) => void, from: BPose = STAND): BPose => { const p = cloneB(from); edit(p); return p; };

export function buildBoss(): PixelGrid[][] {
  // 0 正体を現す:しゃがんで服を裂き、両腕を広げて立ち、こぶしを鳴らす
  const r0 = pose((p) => {
    p.hip = [47, 63]; p.neck = [51, 33]; p.head = [54, 31];
    p.aF = { e: [46, 50], h: [56, 44] }; p.aB = { e: [64, 46], h: [60, 38] };
    p.lF = { k: [50, 76], a: [42, 86] }; p.lB = { k: [60, 77], a: [58, 86] };
  });
  const r1 = pose((p) => {
    p.hip = [47, 59]; p.neck = [48, 28]; p.head = [51, 26];
    p.aF = { e: [34, 38], h: [27, 30] }; p.aB = { e: [66, 36], h: [74, 29] };
  });
  const r2 = pose((p) => {
    p.aF = { e: [33, 34], h: [36, 22] }; p.aB = { e: [67, 32], h: [65, 20] };
  });
  const r3 = pose((p) => {
    p.aF = { e: [42, 42], h: [51, 37] }; p.aB = { e: [63, 38], h: [56, 36], hand: 'open' };
  });
  const reveal = [
    drawBoss(r0, 'grim', 1), drawBoss(r1, 'shout', 2), drawBoss(r2, 'shout', 3), drawBoss(r3, 'grin', 4)
  ].map((g) => alignFeet(g));

  // 1 待機:こぶしを構えて、肩で息をする
  const i0 = pose((p) => {
    p.aF = { e: [40, 44], h: [49, 47] }; p.aB = { e: [62, 42], h: [68, 46] };
  });
  const idle = [alignFeet(drawBoss(i0, 'grim')), alignFeet(drawBoss(moveUpperB(i0, 0, 1), 'grim'))];

  // 2 暴れる:両こぶしを振り上げる → たたきつける → 奥の腕でなぎ払う → 足を踏み鳴らす
  const a0 = pose((p) => {
    p.head = [51, 24];
    p.aF = { e: [35, 21], h: [38, 9] }; p.aB = { e: [63, 18], h: [61, 7] };
  });
  const a1 = pose((p) => {
    p.hip = [49, 58]; p.neck = [55, 30]; p.head = [58, 28];
    p.aF = { e: [60, 46], h: [70, 55] }; p.aB = { e: [69, 42], h: [78, 51] };
    p.lF = { k: [52, 73], a: [54, 86] }; p.lB = { k: [48, 74], a: [41, 86] };
  });
  const a2 = pose((p) => {
    p.neck = [51, 27]; p.head = [54, 25];
    p.aB = { e: [70, 32], h: [81, 33] }; p.aF = { e: [37, 40], h: [34, 49] };
  });
  const a3 = pose((p) => {
    p.hip = [46, 58];
    p.lF = { k: [52, 66], a: [53, 78] };
    p.aF = { e: [33, 38], h: [29, 30] }; p.aB = { e: [66, 37], h: [72, 30] };
  });
  const rampage = [
    alignFeet(drawBoss(a0, 'shout')), alignFeet(drawBoss(a1, 'shout')), alignFeet(drawBoss(a2, 'grin')), alignFeet(drawBoss(a3, 'shout'))
  ];

  // 3 ラッシュを受ける:顔をそらす
  const h0 = pose((p) => {
    p.neck = [45, 27]; p.head = [44, 25]; p.hip = [46, 57]; p.tilt = -0.3;
    p.aF = { e: [42, 42], h: [50, 36] }; p.aB = { e: [58, 38], h: [66, 32] };
    p.lB = { k: [55, 71], a: [60, 84], toe: 0.3 };
  });
  const h1 = pose((p) => {
    p.neck = [44, 30]; p.head = [44, 28]; p.hip = [45, 58]; p.tilt = -0.2;
    p.aF = { e: [34, 43], h: [33, 53] }; p.aB = { e: [60, 38], h: [70, 36] };
    p.lF = { k: [40, 73], a: [37, 86] };
  });
  const hit = [alignFeet(drawBoss(h0, 'hurt')), alignFeet(drawBoss(h1, 'hurt'))];

  // 4 やられる:よろけて、ひざをつき、あおむけに倒れる
  const d0 = pose((p) => {
    p.neck = [44, 27]; p.head = [43, 25]; p.hip = [46, 57]; p.tilt = -0.35;
    p.aF = { e: [36, 42], h: [33, 52] }; p.aB = { e: [58, 38], h: [66, 32] };
    p.lB = { k: [55, 71], a: [60, 84], toe: 0.3 };
  });
  const d1 = pose((p) => {
    p.hip = [44, 70]; p.neck = [48, 39]; p.head = [51, 37];
    p.aF = { e: [42, 55], h: [46, 65] }; p.aB = { e: [61, 54], h: [64, 64] };
    p.lF = { k: [55, 76], a: [52, 86] }; p.lB = { k: [48, 87], a: [36, 87], toe: -0.2 };
  });
  const d2 = pose((p) => {
    p.aF = { e: [42, 38], h: [46, 29] }; p.aB = { e: [62, 34], h: [70, 30] };
    p.lB = { k: [58, 70], a: [66, 80], toe: 0.6 };
  });
  const d3 = pose((p) => {
    p.aF = { e: [42, 36], h: [40, 26] }; p.aB = { e: [60, 45], h: [62, 56] };
    p.lF = { k: [58, 70], a: [50, 85] };
  });
  const defeat = [
    alignFeet(drawBoss(d0, 'hurt')),
    alignFeet(drawBoss(d1, 'hurt')),
    rotateGrid(drawBoss(d2, 'ko'), -1.0, 48, 52, 48, 58),
    alignFeet(rotateGrid(drawBoss(d3, 'ko'), -Math.PI / 2, 48, 48, 48, 48), true)
  ];
  return [reveal, idle, rampage, hit, defeat];
}
