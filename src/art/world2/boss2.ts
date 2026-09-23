// ギャングの女ボス(正体)。96×96、足の裏は y=91、体の真ん中は x=48。
// 白い毛皮のコート、紫のドレス、サングラス、赤い大きな髪、赤いハイヒール。
// 人の仕組み(figure.ts)を大きな体つきで使い、頭だけ自分で描く。
import { md, PixelGrid } from '../lib';
import { type Look, type Pose, clonePose, drawPerson, moveUpper, shoulders } from '../world/figure';
import { GOLD, OUTLINE, SKIN } from '../world/palette';
import { Mask, type Painter, type Pt, type Ramp, bbox, rotateGrid, shadeT } from '../world/pix';

const HAIR2: Ramp = [md(7, 3, 2), md(6, 1, 1), md(3, 0, 1)];
const FUR: Ramp = [md(7, 7, 6), md(6, 5, 6), md(4, 3, 5)];
const COAT: Ramp = [md(5, 2, 6), md(4, 1, 5), md(2, 0, 3)];
/** 中の黒いドレス */
const DRESS: Ramp = [COAT[2], OUTLINE, OUTLINE];
const G0 = GOLD[0], G1 = GOLD[1];

type BossFace = 'smirk' | 'grin' | 'shout' | 'hurt' | 'ko';

const HEAD = [
  '..........hHHHHh...........',
  '.......hhHHHHHHHHh.........',
  '.....hhHHHHhhhHHHHh........',
  '...hhHHHHhhhhHHHHhhh.......',
  '..hHHHhhhHHHHhhhhhhhh......',
  '.hHHhhhHHHhhhhhhhhhhhh.....',
  'hHHhhhhhhhhhhhhhhhhhhhh....',
  'hHhhhhhhhhhhhhSSSShhhhhh...',
  'hhhhhhhhhhhhSSSSSSSShhhhh..',
  'hhhhhhhhhhhSSSSSSSSSSShhh..',
  'hhkhhhhhhhSSSSSSSSSSSSSh...',
  'hhkhhhhhhSooooooooooooooo..',
  'hhkhhhhhSSSSooowwooooowooo.',
  '.hkhhhhhSsSSSooooo.SSooooo.',
  '.hkhhhhhSsSSSSSSSSSSSSSSSs.',
  'hhkkhhhhhdSSSSSSSSSSSSSSSs.',
  'hhhkhhhhgSSSSSSSSSSSSSSSSs.',
  '.hhkhhhhgsSSSSSSSSSSSSSSSs.',
  '.hhkhhhgggsSSSSSSSSSSLLLs..',
  '..hhkhhhhssSSSSSSSSSSSs....',
  '..hhkkhhhhssSSSSSSSSSs.....',
  '...hhkkhhhhsssSSSSSss......',
  '...hhhkkhhh..sssssss.......',
  '....hhhkhhh................',
  '....hhhhkh.................',
  '.....hhhk..................',
  '......hh...................'
];
/** 顔の格子を左へずらした量(髪を広げた分) */
const O = 3;
const CHIN = 23;

function bossHead(face: BossFace): { g: PixelGrid; nx: number; ny: number } {
  const rows = HEAD.slice();
  const set = (r: number, c0: number, s: string) => { const c = c0 + O; rows[r] = rows[r].slice(0, c) + s + rows[r].slice(c + s.length); };
  if (face === 'grin') { set(18, 16, 'oooooL'); set(19, 16, 'Lwwwo'); }
  if (face === 'shout') { set(17, 16, 'oooooo'); set(18, 16, 'owwwwo'); set(19, 16, 'oLLLLo'); set(20, 17, 'oooo'); }
  if (face === 'hurt') {
    // サングラスがずれて、片目がのぞく
    set(11, 6, 'SSSSooooooooooo'); set(12, 6, 'SSSSooowwooooow'); set(13, 6, 'SSSSSooooo.oooo'); set(14, 10, 'SSSSSSoo');
    set(11, 18, 'SSSS'); set(12, 21, 'SSS'); set(13, 20, 'SSSS');
    set(12, 19, 'o'); set(11, 19, 'o');
    set(17, 16, 'oooooo'); set(18, 16, 'oLLLLo'); set(19, 17, 'oooo');
  }
  if (face === 'ko') {
    // サングラスが飛んで、目を回している
    set(11, 6, 'SSSSSSSSSSSSSSSS'); set(12, 5, 'SSSSSSSSSSSSSSSSSS'); set(13, 5, 'SsSSSSSSSSSSSSSSSS');
    set(10, 11, 'dd'); set(10, 18, 'dd');
    set(11, 11, 'o.o'); set(12, 12, 'o'); set(13, 11, 'o.o');
    set(11, 18, 'o.o'); set(12, 19, 'o'); set(13, 18, 'o.o');
    for (const r of [11, 13]) { rows[r] = rows[r].replace(/o\.o/g, 'oSo'); }
    set(18, 16, 'ooooo'); set(19, 16, 'oLLLo');
  }
  const g = new PixelGrid(27, rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      const c = ch === 'S' ? SKIN[0] : ch === 's' ? SKIN[1] : ch === 'd' ? SKIN[2] : ch === 'o' ? OUTLINE
        : ch === 'w' ? FUR[0] : ch === 'h' ? HAIR2[1] : ch === 'H' ? HAIR2[0] : ch === 'k' ? HAIR2[2]
          : ch === 'L' ? HAIR2[1] : ch === 'g' ? G1 : null;
      if (c) g.px(x, y, c);
    }
  });
  // 顔の丸みの影(右下を暗く)
  const m = new Mask(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x] === SKIN[0]) m.set(x, y);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.cells[y][x] !== SKIN[0]) continue;
    const t = shadeT(m, x, y);
    if (t > 0.82 && y > 15 && y < CHIN) g.px(x, y, SKIN[1]);
  }
  // 髪のつや
  for (let y = 1; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x] === HAIR2[1] && (x + y * 2) % 9 === 0) g.px(x, y, HAIR2[2]);
  g.px(6 + O, 17, G0);
  return { g, nx: 13 + O, ny: CHIN };
}

/** 化けていた服の切れはし */
function drawScraps(Pn: Painter, pose: Pose, step: number): void {
  const c: Pt = [pose.neck[0], pose.neck[1] + 20];
  const cols = [FUR[1], COAT[1], COAT[2], FUR[2]];
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
    Pn.fill(m, cols[i % cols.length], { sep: 'outline', flat: true });
  });
}

/** 毛皮のふわふわ(形のふちを波打たせ、中に短い毛の線) */
function furTexture(Pn: Painter, m: Mask, seed = 0): void {
  m.each((x, y) => {
    const c = Pn.g.get(x, y);
    if (c !== FUR[1] && c !== FUR[0]) return;
    if ((x * 3 + y * 5 + seed) % 11 === 0) { Pn.px(x, y, FUR[2]); if (m.has(x + 1, y + 1)) Pn.px(x + 1, y + 1, FUR[2]); }
  });
}

function furBlob(Pn: Painter, pts: Pt[], r: number): Mask {
  const m = Pn.mask();
  pts.forEach(([x, y], i) => m.ellipse(x, y, r + (i % 2 ? 0.6 : 0), r - (i % 2 ? 0.3 : 0)));
  Pn.fill(m, FUR, { sep: 'outline', hi: 0.4, lo: 0.75 });
  furTexture(Pn, m, 3);
  return m;
}

function wristOf(a: { e: Pt; h: Pt }, d: number): Pt {
  const dx = a.e[0] - a.h[0], dy = a.e[1] - a.h[1], L = Math.hypot(dx, dy) || 1;
  return [a.h[0] + (dx / L) * d, a.h[1] + (dy / L) * d];
}

function heel(Pn: Painter, a: Pt, toe: number, far: boolean): void {
  if (toe < 0.2) return;
  const x = Math.round(a[0] - 2.5), y = Math.round(a[1] + 2);
  for (let j = 0; j < 4; j++) { Pn.px(x, y + j, far ? HAIR2[2] : HAIR2[1]); Pn.px(x - 1, y + j, OUTLINE); Pn.px(x + 1, y + j, OUTLINE); }
  Pn.px(x, y + 4, OUTLINE);
}

const K = 1.5;

function bossLook(face: BossFace, scraps = 0): Look {
  return {
    skin: SKIN, hair: HAIR2, hairStyle: { rows: [], top: 0 },
    top: COAT, sleeve: 'long', bottom: DRESS, legs: 'pants', shoes: HAIR2,
    build: { sh: 14, wa: 13, arm: 3.8, thigh: 3.8, shin: 3, hem: 17, chest: 4, scale: K },
    sweat: null,
    customHead: () => bossHead(face),
    torso(Pn, pose, top) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      let hemY = 0;
      top.each((_x, y) => { hemY = Math.max(hemY, y); });
      const fur = Pn.mask();
      // 前の開き:黒いドレス、両側に毛皮のふち
      for (let dy = 2; n[1] + dy <= hemY; dy++) {
        const y = n[1] + dy;
        const w = dy < 12 ? 1 + Math.floor(dy / 3) : dy < 28 ? 4 : 4 + Math.floor((dy - 28) / 3);
        const x0 = X(3, dy);
        for (let dx = -2; dx < w + 2; dx++) {
          const x = x0 + dx;
          if (!top.has(x, y)) continue;
          if (dx < 0 || dx >= w) fur.set(x, y);
          else Pn.px(x, y, dx === 0 ? OUTLINE : COAT[2]);
        }
      }
      // すその毛皮
      top.each((x, y) => { if (y > hemY - 3) fur.set(x, y); });
      // 毛皮の面を塗る(ふちは波打たせる)
      fur.each((x, y) => {
        const edge = !fur.has(x - 1, y) || !fur.has(x, y + 1);
        Pn.px(x, y, edge && (x + y) % 3 === 0 ? FUR[2] : (x + y) % 5 === 0 ? FUR[0] : FUR[1]);
      });
      furTexture(Pn, fur, 1);
      // 胸元(肌)と金の首飾り
      for (let dy = 2; dy <= 7; dy++) for (let dx = 0; dx < 4 - Math.floor(dy / 3); dx++) Pn.px(X(4 + dx, dy), n[1] + dy, SKIN[dx === 0 ? 1 : 0]);
      for (let i = 0; i <= 5; i++) {
        const yy = 3 + Math.round(Math.sin((i / 5) * Math.PI) * 3);
        Pn.px(X(2 + i, yy), n[1] + yy, i % 2 ? G1 : G0);
      }
      Pn.rect(X(4, 7), n[1] + 7, 2, 2, G1).px(X(4, 7), n[1] + 7, G0);
      // 金のベルト
      for (let dx = 0; dx <= 5; dx++) { const x = X(3 + dx, p[1] - n[1] - 3); if (top.has(x, p[1] - 3) && !fur.has(x, p[1] - 3)) Pn.px(x, p[1] - 3, G1); }
      Pn.px(X(4, p[1] - n[1] - 3), p[1] - 3, G0);
    },
    mid(Pn, pose) {
      // 大きな毛皮のえり
      const n = pose.neck;
      const { sB, sF } = shoulders(pose, K);
      furBlob(Pn, [[sB[0] + 3, sB[1]], [n[0] + 3, n[1] + 1], [sF[0] - 2, sF[1]], [sF[0] - 6, sF[1] + 5], [sB[0] + 4, sB[1] + 6], [n[0] + 8, n[1] + 8]], 5.2);
    },
    farHand(Pn, pose) {
      furBlob(Pn, [wristOf(pose.aB, 3.2)], 2.8);
      heel(Pn, pose.lB.a, pose.lB.toe ?? 0, true);
    },
    front(Pn, pose) {
      furBlob(Pn, [wristOf(pose.aF, 3.2)], 2.8);
      heel(Pn, pose.lF.a, pose.lF.toe ?? 0, false);
      // 金の腕輪と指輪
      const w = wristOf(pose.aF, 1.2);
      Pn.px(Math.round(w[0]), Math.round(w[1]), G0);
      if (scraps) drawScraps(Pn, pose, scraps);
    }
  };
}

const STAND: Pose = {
  head: [53, 28], face: 'normal',
  neck: [50, 30], hip: [47, 58],
  aB: { e: [60, 44], h: [62, 55] },
  aF: { e: [42, 44], h: [43, 55] },
  lB: { k: [52, 73], a: [53, 85], toe: 0.45 },
  lF: { k: [44, 73], a: [41, 85], toe: 0.45 }
};

const P96 = (look: Look, p: Pose) => drawPerson(look, p, 96, 96);

/** 足の裏(y=91)にそろえる。cx で体の真ん中(x=48)にもそろえる */
function ground(g: PixelGrid, cx = false): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  const dy = 91 - b.y1;
  const dx = cx ? 48 - Math.round((b.x0 + b.x1) / 2) : 0;
  const o = new PixelGrid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) o.px(x + dx, y + dy, g.cells[y][x]);
  return o;
}

/** 空中のコマ:体の真ん中を (48, 48) にそろえる */
function center(g: PixelGrid): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  const dx = 48 - Math.round((b.x0 + b.x1) / 2), dy = 46 - Math.round((b.y0 + b.y1) / 2);
  const o = new PixelGrid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) o.px(x + dx, y + dy, g.cells[y][x]);
  return o;
}

const pose = (edit: (p: Pose) => void, from: Pose = STAND): Pose => { const p = clonePose(from); edit(p); return p; };

export function buildBoss2(): PixelGrid[][] {

  // 0 正体を現す:しゃがんで変装を脱ぎすて、立ち上がって決める
  const r0 = pose((p) => {
    p.hip = [47, 66]; p.neck = [52, 38]; p.head = [56, 36];
    p.aF = { e: [52, 52], h: [60, 46] }; p.aB = { e: [63, 50], h: [62, 42] };
    p.lF = { k: [53, 76], a: [42, 85], toe: 0.45 }; p.lB = { k: [60, 78], a: [58, 85], toe: 0.45 };
  });
  const r1 = pose((p) => {
    p.hip = [47, 60]; p.neck = [49, 32]; p.head = [52, 30];
    p.aF = { e: [36, 40], h: [28, 33] }; p.aB = { e: [65, 38], h: [74, 32] };
  });
  const r2 = pose((p) => {
    p.aB = { e: [63, 34], h: [60, 20] };
    p.aF = { e: [38, 46], h: [40, 57] };
  });
  const r3 = pose((p) => {
    p.aF = { e: [40, 46], h: [44, 56] };
    p.aB = { e: [63, 38], h: [74, 36] };
    p.lF = { k: [45, 73], a: [45, 85], toe: 0.45 };
  });
  const reveal = [
    P96(bossLook('smirk', 1), r0), P96(bossLook('shout', 2), r1), P96(bossLook('grin', 3), r2), P96(bossLook('smirk', 4), r3)
  ].map((g) => ground(g));

  // 1 待機:腕を組んで見下ろす
  const i0 = pose((p) => {
    p.aF = { e: [42, 47], h: [56, 45] };
    p.aB = { e: [61, 46], h: [50, 43] };
  });
  const idle = [ground(P96(bossLook('smirk'), i0)), ground(P96(bossLook('smirk'), moveUpper(i0, 0, 1)))];

  // 2 暴れる:物を投げる、前をさして手下をけしかける、ヒールで踏み鳴らす
  const a0 = pose((p) => {
    p.neck = [48, 30]; p.head = [51, 28];
    p.aF = { e: [38, 36], h: [34, 25] }; p.aB = { e: [61, 42], h: [66, 50] };
  });
  const a1 = pose((p) => {
    p.neck = [54, 31]; p.head = [58, 30];
    p.aF = { e: [60, 38], h: [72, 35] }; p.aB = { e: [66, 44], h: [70, 53] };
    p.lF = { k: [50, 73], a: [53, 85], toe: 0.45 }; p.lB = { k: [47, 74], a: [39, 85], toe: 0.6 };
  });
  const a2 = pose((p) => {
    p.neck = [52, 30]; p.head = [56, 29];
    p.aF = { e: [58, 38], h: [70, 32] }; p.aB = { e: [62, 45], h: [57, 54] };
  });
  const a3 = pose((p) => {
    p.aF = { e: [40, 44], h: [45, 53] }; p.aB = { e: [63, 36], h: [70, 28] };
    p.lF = { k: [52, 67], a: [51, 79], toe: 0.3 };
  });
  const rampage = [
    ground(P96(bossLook('shout'), a0)), ground(P96(bossLook('shout'), a1)), ground(P96(bossLook('shout'), a2)), ground(P96(bossLook('grin'), a3))
  ];

  // 3 ラッシュを受ける
  const h0 = pose((p) => {
    p.neck = [45, 31]; p.head = [45, 30]; p.hip = [46, 58];
    p.aF = { e: [44, 42], h: [52, 36] }; p.aB = { e: [58, 38], h: [66, 32] };
    p.lB = { k: [55, 71], a: [60, 83], toe: 0.6 };
  });
  const h1 = pose((p) => {
    p.neck = [44, 33]; p.head = [45, 33]; p.hip = [45, 59];
    p.aF = { e: [36, 44], h: [34, 54] }; p.aB = { e: [60, 40], h: [70, 38] };
    p.lF = { k: [41, 73], a: [37, 85], toe: 0.45 };
  });
  const hit = [ground(P96(bossLook('hurt'), h0)), ground(P96(bossLook('hurt'), h1))];

  // 4 やられる:よろけて、ひざをつき、目を回して倒れる
  const d0 = pose((p) => {
    p.neck = [44, 31]; p.head = [44, 30]; p.hip = [46, 58];
    p.aF = { e: [38, 44], h: [34, 53] }; p.aB = { e: [58, 40], h: [66, 34] };
    p.lB = { k: [55, 71], a: [60, 83], toe: 0.6 };
  });
  const d1 = pose((p) => {
    p.hip = [44, 70]; p.neck = [48, 42]; p.head = [52, 41];
    p.aF = { e: [44, 57], h: [48, 67] }; p.aB = { e: [60, 56], h: [64, 66] };
    p.lF = { k: [55, 77], a: [52, 86], toe: 0.45 }; p.lB = { k: [48, 87], a: [36, 87], toe: -0.2 };
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

  // 5 車に飛び乗る:しゃがむ → 跳ぶ → 空中で脚をたたむ → 屋根に着地
  const j0 = pose((p) => {
    p.hip = [45, 66]; p.neck = [50, 39]; p.head = [54, 38];
    p.aF = { e: [40, 50], h: [34, 57] }; p.aB = { e: [58, 50], h: [54, 60] };
    p.lF = { k: [54, 74], a: [44, 85], toe: 0.45 }; p.lB = { k: [60, 77], a: [55, 85], toe: 0.45 };
  });
  const j1 = pose((p) => {
    p.hip = [47, 56]; p.neck = [51, 27]; p.head = [55, 25];
    p.aF = { e: [56, 18], h: [60, 8] }; p.aB = { e: [62, 22], h: [68, 14] };
    p.lF = { k: [45, 72], a: [42, 86], toe: 1.0 }; p.lB = { k: [48, 71], a: [46, 85], toe: 1.1 };
  });
  const j2 = pose((p) => {
    p.hip = [47, 56]; p.neck = [51, 28]; p.head = [55, 27];
    p.aF = { e: [58, 38], h: [66, 32] }; p.aB = { e: [40, 34], h: [34, 26] };
    p.lF = { k: [58, 64], a: [50, 74], toe: 0.6 }; p.lB = { k: [55, 68], a: [44, 76], toe: 0.8 };
  });
  const j3 = pose((p) => {
    p.hip = [46, 64]; p.neck = [51, 36]; p.head = [55, 35];
    p.aF = { e: [42, 50], h: [46, 60] }; p.aB = { e: [62, 42], h: [72, 36] };
    p.lF = { k: [54, 74], a: [44, 85], toe: 0.45 }; p.lB = { k: [58, 78], a: [58, 85], toe: 0.45 };
  });
  const jump = [
    ground(P96(bossLook('smirk'), j0)),
    center(P96(bossLook('grin'), j1)),
    center(P96(bossLook('grin'), j2)),
    ground(P96(bossLook('smirk'), j3))
  ];
  return [reveal, idle, rampage, hit, defeat, jump];
}
