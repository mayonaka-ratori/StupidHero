// 宇宙人の親玉(正体)。96×96、足の裏は y=91、体の真ん中は x=48。
// 大きな頭に黒い大きな目と触角、銀の宇宙服、紫のえりとマント。目と触角の玉は黄緑(くずれと同じ色)。
// 人の仕組み(figure.ts)を大きな体つきで使い、頭だけ自分で描く。
import { md, PixelGrid } from '../lib';
import { type Look, type Pose, clonePose, drawPerson, moveUpper, shoulders } from '../world/figure';
import { OUTLINE } from '../world/palette';
import { Painter, type Pt, type Ramp, bbox, rotateGrid } from '../world/pix';
import { GLITCH } from './palette';

/** 宇宙人の肌(うすい青緑) */
const ASKIN: Ramp = [md(5, 7, 6), md(3, 6, 5), md(2, 4, 4)];
const SUIT: Ramp = [md(7, 7, 7), md(5, 5, 6), md(3, 3, 4)];
const CAPE: Ramp = [md(5, 2, 6), md(3, 1, 4), md(2, 0, 3)];
/** 化けていた服の切れはし(おじさんのカーディガン、着ぐるみ、店員のシャツ、灰色のズボン) */
const SCRAP = [md(5, 4, 1), md(7, 5, 1), md(7, 7, 7), md(3, 3, 4)];

type BossFace = 'smirk' | 'grin' | 'shout' | 'hurt' | 'ko';

/** 頭の格子の大きさと、あごの点 */
const HW = 28, HH = 32, CHIN_X = 13, CHIN_Y = 30;

function bossHead(face: BossFace): { g: PixelGrid; nx: number; ny: number } {
  const P = new Painter(HW, HH);
  // 触角(後ろへしなる2本)と黄緑の玉
  const ant = P.mask().capsule([11, 8], [7, 2], 0.7).union(P.mask().capsule([16, 7], [19, 1], 0.7));
  P.fill(ant, ASKIN, { sep: 'outline', flat: true });
  P.fill(P.mask().ellipse(6.5, 2, 1.8, 1.8).union(P.mask().ellipse(19.5, 1.5, 1.8, 1.8)), GLITCH, { sep: 'outline', hi: 0.4, lo: 0.8 });
  // 大きな頭(後ろにふくらんだ卵形)と、細いあご
  const head = P.mask().ellipse(12.5, 15, 11.5, 10.5).union(P.mask().poly([[6, 18], [23, 16], [19, 27], [15, 30], [11, 29]]));
  P.fill(head, ASKIN, { sep: 'outline', hi: 0.32, lo: 0.7 });
  // 額のしわ
  P.line([8, 9], [12, 8], ASKIN[2]).line([6, 12], [10, 11], ASKIN[2]);
  // 目:手前は大きなアーモンド形、奥は細い
  const near: Pt[] = [[15, 16], [19, 14], [23, 15], [22, 19], [18, 20]];
  const far: Pt[] = [[9, 16], [11, 15], [12, 18], [10, 19]];
  if (face === 'ko') {
    for (const [cx, cy] of [[19, 17], [10, 17]] as const) {
      P.px(cx - 1, cy - 1, OUTLINE).px(cx + 1, cy - 1, OUTLINE).px(cx, cy, OUTLINE).px(cx - 1, cy + 1, OUTLINE).px(cx + 1, cy + 1, OUTLINE);
    }
  } else if (face === 'hurt') {
    P.line([15, 18], [22, 16], OUTLINE).line([16, 19], [21, 18], OUTLINE).line([9, 18], [12, 17], OUTLINE);
  } else {
    P.fill(P.mask().poly(near), OUTLINE, { sep: 'none', flat: true });
    P.fill(P.mask().poly(far), OUTLINE, { sep: 'none', flat: true });
    // 黄緑の光
    P.px(20, 15, GLITCH[1]).px(21, 15, GLITCH[0]).px(10, 16, GLITCH[1]);
    if (face === 'shout' || face === 'grin') P.px(19, 16, GLITCH[1]).px(20, 16, GLITCH[1]);
  }
  // 口
  if (face === 'grin') P.line([15, 24], [20, 23], OUTLINE).px(15, 23, OUTLINE).px(19, 24, GLITCH[0]);
  else if (face === 'shout') P.rect(16, 23, 4, 3, OUTLINE).px(17, 24, CAPE[1]).px(18, 24, CAPE[1]);
  else if (face === 'hurt' || face === 'ko') P.line([16, 25], [19, 24], OUTLINE).px(17, 24, OUTLINE);
  else P.line([16, 24], [19, 24], OUTLINE);
  return { g: P.g, nx: CHIN_X, ny: CHIN_Y };
}

/** 化けていた服の切れはし。step が大きいほど遠くへ飛ぶ */
function drawScraps(Pn: Painter, pose: Pose, step: number): void {
  const c: Pt = [pose.neck[0], pose.neck[1] + 18];
  const pieces: [number, number, number][] = [
    [-2.4, 14, 0], [-0.5, 18, 1], [0.4, 16, 2], [1.4, 17, 1], [2.3, 15, 0], [3.0, 19, 2], [-1.4, 20, 1], [4.2, 16, 2]
  ];
  const shapes = [['111.', '.111', '..1.'], ['.11', '111', '1..'], ['11..', '.111', '.11.', '..1.']];
  pieces.forEach(([ang, d, sh], i) => {
    const r = d * (0.35 + step * 0.42) + (i % 3);
    const x = Math.round(c[0] + Math.cos(ang) * r * 1.4), y = Math.round(c[1] + Math.sin(ang) * r - step * 3);
    if (y > 88 || y < 1 || x < 1 || x > 91) return;
    const m = Pn.mask();
    shapes[(sh + step) % shapes.length].forEach((row, j) => { for (let q = 0; q < row.length; q++) if (row[q] === '1') m.set(x + q, y + j); });
    Pn.fill(m, SCRAP[i % SCRAP.length], { sep: 'outline', flat: true });
  });
}

const K = 1.5;

function bossLook(face: BossFace, scraps = 0): Look {
  return {
    skin: ASKIN, hair: ASKIN, hairStyle: { rows: [], top: 0 },
    top: SUIT, sleeve: 'long', bottom: SUIT, legs: 'pants', shoes: CAPE, sole: OUTLINE,
    build: { sh: 13, wa: 9.5, arm: 3.4, thigh: 3.8, shin: 3.2, hem: 2, chest: 3, scale: K },
    sweat: null, cuff: CAPE[1],
    customHead: () => bossHead(face),
    behind(Pn, pose) {
      // 背中のマント(すそがとがる)
      const n = pose.neck, p = pose.hip;
      const m = Pn.mask().poly([[n[0] - 9, n[1] + 1], [n[0] + 3, n[1]], [p[0] - 2, p[1] + 20], [p[0] - 8, p[1] + 26], [p[0] - 14, p[1] + 22], [p[0] - 18, p[1] + 26]]);
      Pn.fill(m, CAPE, { sep: 'outline', hi: 0.25, lo: 0.6 });
    },
    torso(Pn, pose, top) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // 胸の紫のV字と、黄緑の宝石
      for (let dy = 1; dy <= 12; dy++) {
        const w = Math.max(0, 5 - Math.floor(dy / 2.5));
        for (let dx = 0; dx <= w; dx++) { const x = X(1 + dx, dy); if (top.has(x, n[1] + dy)) Pn.px(x, n[1] + dy, dx === w ? CAPE[2] : CAPE[1]); }
      }
      Pn.rect(X(2, 7), n[1] + 7, 2, 2, GLITCH[1]).px(X(2, 7), n[1] + 7, GLITCH[0]);
      // 胴の線とベルト
      for (let dy = 13; dy <= p[1] - n[1] - 4; dy++) Pn.px(X(4, dy), n[1] + dy, SUIT[2]);
      for (let x = -12; x <= 12; x++) {
        const cx = Math.round(p[0] + x), y = Math.round(p[1] - 6);
        if (top.has(cx, y)) { Pn.px(cx, y, CAPE[1]); Pn.px(cx, y + 1, CAPE[2]); }
      }
      Pn.rect(Math.round(p[0] + 2), Math.round(p[1] - 7), 3, 3, GLITCH[1]);
    },
    mid(Pn, pose) {
      // 大きな肩当て
      const { sB, sF } = shoulders(pose, K);
      for (const s of [sB, sF]) Pn.fill(Pn.mask().ellipse(s[0], s[1] - 0.5, 4.2, 3.2), CAPE, { sep: 'outline', hi: 0.4, lo: 0.75 });
      // えり(首の後ろに立てる)
      const n = pose.neck;
      Pn.fill(Pn.mask().poly([[n[0] - 7, n[1] - 5], [n[0] - 2, n[1] + 1], [n[0] - 7, n[1] + 3], [n[0] - 10, n[1]]]), CAPE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    },
    front(Pn, pose) {
      if (scraps) drawScraps(Pn, pose, scraps);
    }
  };
}

const STAND: Pose = {
  head: [52, 30], face: 'normal',
  neck: [50, 30], hip: [47, 58],
  aB: { e: [60, 44], h: [62, 55] },
  aF: { e: [42, 44], h: [43, 55] },
  lB: { k: [52, 73], a: [54, 85] },
  lF: { k: [44, 73], a: [41, 85] }
};

const P96 = (look: Look, p: Pose) => drawPerson(look, p, 96, 96);

/** 足の裏(y=91)にそろえる */
function ground(g: PixelGrid): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  const dy = 91 - b.y1;
  const o = new PixelGrid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) o.px(x, y + dy, g.cells[y][x]);
  return o;
}

/** 空中のコマ:体の真ん中を (48, 46) にそろえる */
function center(g: PixelGrid): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  const dx = 48 - Math.round((b.x0 + b.x1) / 2), dy = 46 - Math.round((b.y0 + b.y1) / 2);
  const o = new PixelGrid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) o.px(x + dx, y + dy, g.cells[y][x]);
  return o;
}

const pose = (edit: (p: Pose) => void, from: Pose = STAND): Pose => { const p = clonePose(from); edit(p); return p; };

export function buildBoss3(): PixelGrid[][] {
  // 0 正体を現す:しゃがんで化けた服を裂き、両手を広げて立ち上がる
  const r0 = pose((p) => {
    p.hip = [47, 66]; p.neck = [52, 38]; p.head = [54, 38];
    p.aF = { e: [52, 52], h: [60, 46] }; p.aB = { e: [63, 50], h: [62, 42] };
    p.lF = { k: [53, 76], a: [42, 85] }; p.lB = { k: [60, 78], a: [58, 85] };
  });
  const r1 = pose((p) => {
    p.hip = [47, 60]; p.neck = [49, 32]; p.head = [51, 32];
    p.aF = { e: [36, 40], h: [28, 33] }; p.aB = { e: [65, 38], h: [74, 32] };
  });
  const r2 = pose((p) => {
    p.aF = { e: [36, 36], h: [30, 26] }; p.aB = { e: [64, 36], h: [72, 26] };
  });
  const r3 = pose((p) => {
    p.aF = { e: [40, 46], h: [44, 56] };
    p.aB = { e: [63, 38], h: [74, 36] };
  });
  const reveal = [
    P96(bossLook('smirk', 1), r0), P96(bossLook('shout', 2), r1), P96(bossLook('shout', 3), r2), P96(bossLook('grin', 4), r3)
  ].map(ground);

  // 1 待機:腕を組んで、ゆっくり揺れる
  const i0 = pose((p) => {
    p.aF = { e: [42, 47], h: [56, 45] };
    p.aB = { e: [61, 46], h: [50, 43] };
  });
  const idle = [ground(P96(bossLook('smirk'), i0)), ground(P96(bossLook('smirk'), moveUpper(i0, 0, 1)))];

  // 2 暴れる:両手を振り上げる、前へ突き出す、振り下ろす、ふんぞり返る
  const a0 = pose((p) => { p.aF = { e: [42, 24], h: [48, 12] }; p.aB = { e: [60, 22], h: [58, 11] }; });
  const a1 = pose((p) => {
    p.neck = [54, 31]; p.head = [57, 31];
    p.aF = { e: [62, 40], h: [75, 38] }; p.aB = { e: [66, 44], h: [78, 46] };
    p.lF = { k: [50, 73], a: [53, 85] }; p.lB = { k: [47, 74], a: [39, 85] };
  });
  const a2 = pose((p) => {
    p.neck = [52, 32]; p.head = [55, 32];
    p.aF = { e: [58, 46], h: [66, 56] }; p.aB = { e: [66, 42], h: [74, 52] };
  });
  const a3 = pose((p) => {
    p.aF = { e: [36, 40], h: [30, 32] }; p.aB = { e: [63, 36], h: [70, 28] };
    p.lF = { k: [52, 67], a: [51, 79] };
  });
  const rampage = [
    ground(P96(bossLook('shout'), a0)), ground(P96(bossLook('shout'), a1)), ground(P96(bossLook('grin'), a2)), ground(P96(bossLook('shout'), a3))
  ];

  // 3 ラッシュを受ける
  const h0 = pose((p) => {
    p.neck = [45, 31]; p.head = [44, 31]; p.hip = [46, 58];
    p.aF = { e: [44, 42], h: [52, 36] }; p.aB = { e: [58, 38], h: [66, 32] };
    p.lB = { k: [55, 71], a: [60, 83], toe: 0.3 };
  });
  const h1 = pose((p) => {
    p.neck = [44, 33]; p.head = [44, 34]; p.hip = [45, 59];
    p.aF = { e: [36, 44], h: [34, 54] }; p.aB = { e: [60, 40], h: [70, 38] };
    p.lF = { k: [41, 73], a: [37, 85] };
  });
  const hit = [ground(P96(bossLook('hurt'), h0)), ground(P96(bossLook('hurt'), h1))];

  // 4 やられる:よろけて、ひざをつき、目を回して倒れる
  const d0 = pose((p) => {
    p.neck = [44, 31]; p.head = [43, 31]; p.hip = [46, 58];
    p.aF = { e: [38, 44], h: [34, 53] }; p.aB = { e: [58, 40], h: [66, 34] };
    p.lB = { k: [55, 71], a: [60, 83], toe: 0.3 };
  });
  const d1 = pose((p) => {
    p.hip = [44, 70]; p.neck = [48, 42]; p.head = [51, 42];
    p.aF = { e: [44, 57], h: [48, 67] }; p.aB = { e: [60, 56], h: [64, 66] };
    p.lF = { k: [55, 77], a: [52, 86] }; p.lB = { k: [48, 87], a: [36, 87], toe: -0.2 };
  });
  const d2 = pose((p) => {
    p.aF = { e: [44, 40], h: [48, 32] }; p.aB = { e: [62, 36], h: [70, 32] };
    p.lB = { k: [58, 70], a: [66, 80], toe: 0.6 };
  });
  const d3 = pose((p) => {
    p.aF = { e: [44, 38], h: [42, 28] }; p.aB = { e: [60, 46], h: [62, 57] };
    p.lF = { k: [58, 70], a: [50, 84], toe: 0.3 };
  });
  const defeat = [
    ground(P96(bossLook('hurt'), d0)),
    ground(P96(bossLook('hurt'), d1)),
    rotateGrid(P96(bossLook('ko'), d2), -1.0, 48, 52, 48, 58),
    ground(rotateGrid(P96(bossLook('ko'), d3), -Math.PI / 2, 48, 48, 48, 48))
  ];

  // 5 母艦に乗りこむ:天をさして呼ぶ → しゃがむ → 両手を上げて浮き上がる → ひざをかかえて吸いこまれる
  const b0 = pose((p) => {
    p.head = [53, 29];
    p.aF = { e: [56, 26], h: [60, 12] }; p.aB = { e: [60, 46], h: [58, 56] };
  });
  const b1 = pose((p) => {
    p.hip = [45, 66]; p.neck = [50, 39]; p.head = [53, 39];
    p.aF = { e: [40, 50], h: [34, 57] }; p.aB = { e: [58, 50], h: [54, 60] };
    p.lF = { k: [54, 74], a: [44, 85] }; p.lB = { k: [60, 77], a: [55, 85] };
  });
  const b2 = pose((p) => {
    p.hip = [47, 56]; p.neck = [50, 27]; p.head = [53, 26];
    p.aF = { e: [62, 24], h: [70, 14] }; p.aB = { e: [66, 26], h: [76, 18] };
    p.lF = { k: [48, 70], a: [45, 82], toe: 1.0 }; p.lB = { k: [51, 69], a: [50, 81], toe: 1.1 };
  });
  const b3 = pose((p) => {
    p.hip = [47, 56]; p.neck = [50, 28]; p.head = [53, 28];
    p.aF = { e: [42, 40], h: [50, 46] }; p.aB = { e: [62, 40], h: [56, 48] };
    p.lF = { k: [56, 64], a: [48, 74], toe: 0.6 }; p.lB = { k: [55, 68], a: [46, 77], toe: 0.8 };
  });
  const board = [
    ground(P96(bossLook('grin'), b0)),
    ground(P96(bossLook('smirk'), b1)),
    center(P96(bossLook('grin'), b2)),
    center(P96(bossLook('smirk'), b3))
  ];
  return [reveal, idle, rampage, hit, defeat, board];
}
