// 路地裏のボス(正体)。96×96、足の裏は y=91、体の真ん中は x=48。
// 人の仕組み(figure.ts)を大きな体つきで使い、頭だけ自分で描く。
import { md, PixelGrid } from '../lib';
import { type Look, type Pose, clonePose, drawPerson, movePose, moveUpper } from './figure';
import { GOLD, HAIR, OUTLINE, SKIN, TATTOO, WHITE } from './palette';
import { Mask, type Painter, type Pt, type Ramp, bbox, rotateGrid, shadeT } from './pix';

const JACKET: Ramp = [md(6, 1, 1), md(4, 0, 1), md(2, 0, 1)];
const PANTS: Ramp = [md(2, 2, 3), md(2, 2, 3), md(1, 1, 2)];
const BOOTS: Ramp = [PANTS[1], PANTS[2], OUTLINE];
const CLOTH_PINK = JACKET[0];

type BossFace = 'grim' | 'grin' | 'shout' | 'hurt' | 'ko';

const HEAD = [
  '.......SSSSSS......',
  '.....SSwwSSSSSS....',
  '...SSSwSSSSSSSSSS..',
  '..SSSSSSSSSSSSSSSS.',
  '.SSSSSSSSSSSSSSSSs.',
  '.sSSSSSSSSSSSSSSSs.',
  '.sSSSSSSSSSSddddddd',
  '.sSSSSsdSSooooooooo',
  '.sSSSSddSSoowoooooo',
  '.ssSSSsdSSSoooSSSSs',
  '.ssSSSSSSSSSSSSSSSS',
  '..ssSSSSSSSSSSSSSSs',
  '..sssSSSSSSSSSSSs..',
  '..sssSSSSSSggggggs.',
  '...sssSSSSgggoogg..',
  '...ssssSSSSggggg...',
  '....sssssggggg.....',
  '......sssssgg......'
];

function bossHead(face: BossFace): { g: PixelGrid; nx: number; ny: number } {
  const rows = HEAD.slice();
  const set = (r: number, c: number, s: string) => { rows[r] = rows[r].slice(0, c) + s + rows[r].slice(c + s.length); };
  if (face === 'grin') { set(13, 11, 'gowwwwo'); set(14, 10, 'ggggggg'); }
  if (face === 'shout' || face === 'hurt') { set(13, 11, 'gooooog'); set(14, 10, 'ggowwwog'); set(15, 11, 'gooog'); }
  if (face === 'hurt') { set(6, 12, 'SSddddd'); set(7, 10, 'ooooooooo'); set(8, 10, 'Sooowoooo'); set(9, 10, 'SSSooooS'); }
  if (face === 'ko') {
    set(6, 10, 'SSddSSdd');
    set(7, 10, 'SoSoSSoSo'); set(8, 10, 'SSoSSSSoS'); set(9, 10, 'SoSoSSoSo');
    set(13, 11, 'gooooog'); set(14, 10, 'ggooooog');
  }
  const g = new PixelGrid(19, rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      const c = ch === 'S' ? SKIN[0] : ch === 's' ? SKIN[1] : ch === 'd' ? SKIN[2] : ch === 'o' ? OUTLINE
        : ch === 'w' ? WHITE[0] : ch === 'g' ? HAIR[1] : null;
      if (c) g.px(x, y, c);
    }
  });
  // 丸みの影(右下を暗く)
  const m = new Mask(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) m.set(x, y);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.cells[y][x] !== SKIN[0]) continue;
    const t = shadeT(m, x, y);
    if (t > 0.8 && y > 9) g.px(x, y, SKIN[2]);
    else if (t > 0.6) g.px(x, y, SKIN[1]);
  }
  return { g, nx: 8, ny: rows.length };
}

/** 腕の入れ墨(水色のやじり模様) */
function armTattoo(P: Painter, a: Pt, b: Pt, t0: number, t1: number, r: number): void {
  const skin = new Set<string>(SKIN);
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  for (let y = Math.floor(Math.min(a[1], b[1]) - r - 1); y <= Math.max(a[1], b[1]) + r + 1; y++)
    for (let x = Math.floor(Math.min(a[0], b[0]) - r - 1); x <= Math.max(a[0], b[0]) + r + 1; x++) {
      const along = (x - a[0]) * ux + (y - a[1]) * uy;
      const perp = -(x - a[0]) * uy + (y - a[1]) * ux;
      if (along < L * t0 || along > L * t1 || Math.abs(perp) > r) continue;
      const cur = P.g.get(x, y);
      if (!cur || !skin.has(cur)) continue;
      const k = ((Math.round(along - Math.abs(perp) * 0.9) % 5) + 5) % 5;
      if (k === 0) P.px(x, y, TATTOO[2]);
      else if (k === 1) P.px(x, y, TATTOO[1]);
    }
}

function bossLook(face: BossFace, scraps = 0): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: { rows: [], top: 0 },
    top: JACKET, sleeve: 'none', bottom: PANTS, legs: 'pants', shoes: BOOTS, sole: OUTLINE,
    build: { sh: 15, wa: 10.5, arm: 4.5, thigh: 5.8, shin: 4.8, hem: -3, chest: 3, scale: 1.7 },
    sweat: null,
    customHead: () => bossHead(face),
    torso(P, pose) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // はだけた胸(胸板と腹筋)
      for (let dy = 1; dy <= 27; dy++) {
        const w = dy < 16 ? 7 - Math.floor(dy / 4) : 3;
        for (let dx = 0; dx < w; dx++) {
          const x = X(3 + dx, dy), y = n[1] + dy;
          if (!P.g.get(x, y) || P.g.get(x, y) === OUTLINE) continue;
          P.px(x, y, dx < 2 ? SKIN[1] : SKIN[0]);
        }
        P.px(X(2, dy), n[1] + dy, OUTLINE);
      }
      for (let dx = 3; dx <= 8; dx++) P.px(X(dx, 12), n[1] + 12, SKIN[2]);
      for (const dy of [17, 21]) { P.px(X(4, dy), n[1] + dy, SKIN[2]); P.px(X(5, dy), n[1] + dy, SKIN[2]); }
      // 襟
      for (let dy = 0; dy <= 6; dy++) P.px(X(1 - Math.floor(dy / 3), dy), n[1] + dy, JACKET[0]);
      // 金の鎖
      for (let i = 0; i <= 8; i++) {
        const x = X(2 + i, 2 + Math.round(Math.sin((i / 8) * Math.PI) * 5));
        P.px(x, n[1] + 2 + Math.round(Math.sin((i / 8) * Math.PI) * 5), i % 2 ? GOLD[1] : GOLD[0]);
      }
      P.rect(X(6, 8), n[1] + 8, 2, 3, GOLD[1]); P.px(X(6, 8), n[1] + 8, GOLD[0]);
      // ベルトと金のバックル
      for (let x = -10; x <= 10; x++) {
        const cx = Math.round(p[0] + x), y = Math.round(p[1] - 6);
        if (P.g.get(cx, y)) { P.px(cx, y, OUTLINE); P.px(cx, y + 1, OUTLINE); }
      }
      P.rect(Math.round(p[0] + 3), Math.round(p[1] - 7), 4, 4, GOLD[1]);
      P.px(Math.round(p[0] + 3), Math.round(p[1] - 7), GOLD[0]); P.px(Math.round(p[0] + 4), Math.round(p[1] - 6), OUTLINE);
      // 肩のびょう
      for (const [dx, dy] of [[-8, 2], [-10, 5], [-6, 1]] as const) P.px(X(dx, dy), n[1] + dy, GOLD[0]);
    },
    front(P, pose) {
      const k = 1.7;
      armTattoo(P, [pose.neck[0] - 1 * k, pose.neck[1] + 2.5 * k], pose.aF.e, 0.35, 1, 4);
      armTattoo(P, pose.aF.e, pose.aF.h, 0.1, 0.7, 4);
      if (scraps) drawScraps(P, pose, scraps);
    },
    farHand(P, pose) {
      armTattoo(P, [pose.neck[0] + 4 * 1.7, pose.neck[1] + 2.5 * 1.7], pose.aB.e, 0.35, 1, 4);
      armTattoo(P, pose.aB.e, pose.aB.h, 0.1, 0.7, 4);
    }
  };
}

/** 化けていた服の切れはし。step が大きいほど遠くへ飛ぶ */
function drawScraps(P: Painter, pose: Pose, step: number): void {
  const c: Pt = [pose.neck[0], pose.neck[1] + 14];
  const pieces: [number, number, string, number][] = [
    [-2.4, 14, PANTS[2], 0], [-0.5, 18, WHITE[0], 1], [0.4, 16, CLOTH_PINK, 2], [1.4, 17, PANTS[1], 1],
    [2.3, 15, CLOTH_PINK, 0], [3.0, 19, WHITE[0], 2], [-1.4, 20, CLOTH_PINK, 1], [4.2, 16, PANTS[2], 2]
  ];
  const shapes = [['111.', '.111', '..1.'], ['.11', '111', '1..'], ['11..', '.111', '.11.', '..1.']];
  pieces.forEach(([ang, d, col, sh], i) => {
    const r = d * (0.35 + step * 0.4) + (i % 3);
    const x = Math.round(c[0] + Math.cos(ang) * r * 1.4), y = Math.round(c[1] + Math.sin(ang) * r - step * 3);
    if (y > 88 || x < 1 || x > 93) return;
    const m = P.mask();
    const s = shapes[(sh + step) % shapes.length];
    s.forEach((row, j) => { for (let q = 0; q < row.length; q++) if (row[q] === '1') m.set(x + q, y + j); });
    P.fill(m, col, { sep: 'outline', flat: true });
  });
}

const STAND: Pose = {
  head: [52, 23], face: 'normal',
  neck: [49, 25], hip: [47, 57],
  aB: { e: [61, 41], h: [65, 51] },
  aF: { e: [43, 42], h: [46, 53] },
  lB: { k: [54, 73], a: [57, 86] },
  lF: { k: [43, 73], a: [40, 86] }
};

const P96 = (look: Look, p: Pose) => drawPerson(look, p, 96, 96);

/** 足の裏(y=91)と体の真ん中(x=48)に合わせてずらす */
function ground(g: PixelGrid, cx = true): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  const dy = 91 - b.y1;
  const dx = cx ? 48 - Math.round((b.x0 + b.x1) / 2) : 0;
  const o = new PixelGrid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x]) o.px(x + dx, y + dy, g.cells[y][x]);
  return o;
}

export function buildBoss(): PixelGrid[][] {
  const S = STAND;
  // 0 正体を現す
  const r0 = clonePose(S);
  r0.hip = [47, 63]; r0.neck = [51, 33]; r0.head = [55, 32];
  r0.aF = { e: [52, 49], h: [58, 40] }; r0.aB = { e: [62, 46], h: [60, 37] };
  r0.lF = { k: [52, 76], a: [42, 86] }; r0.lB = { k: [60, 77], a: [58, 86] };
  const r1 = clonePose(S);
  r1.hip = [47, 59]; r1.neck = [48, 27]; r1.head = [51, 25];
  r1.aF = { e: [36, 38], h: [30, 30] }; r1.aB = { e: [64, 36], h: [72, 30] };
  const r2 = clonePose(S);
  r2.aF = { e: [34, 34], h: [38, 22] }; r2.aB = { e: [66, 32], h: [64, 20] };
  const r3 = clonePose(S);
  r3.aF = { e: [45, 41], h: [53, 36] }; r3.aB = { e: [63, 38], h: [70, 32] };
  const reveal = [
    P96(bossLook('grim', 1), r0), P96(bossLook('shout', 2), r1), P96(bossLook('shout', 3), r2), P96(bossLook('grin', 4), r3)
  ].map((g) => ground(g, false));

  // 1 待機
  const i0 = clonePose(S);
  i0.aF = { e: [43, 42], h: [50, 48] }; i0.aB = { e: [61, 41], h: [67, 47] };
  const i1 = moveUpper(i0, 0, 1);
  const idle = [P96(bossLook('grim'), i0), P96(bossLook('grim'), i1)];

  // 2 暴れる
  const a0 = clonePose(S);
  a0.aF = { e: [42, 20], h: [48, 9] }; a0.aB = { e: [60, 18], h: [58, 8] };
  const a1 = movePose(S, 2, 0);
  a1.neck = [55, 30]; a1.head = [59, 29];
  a1.aF = { e: [60, 46], h: [70, 56] }; a1.aB = { e: [68, 42], h: [77, 52] };
  a1.lF = { k: [50, 73], a: [52, 86] }; a1.lB = { k: [47, 74], a: [40, 86] };
  const a2 = clonePose(S);
  a2.neck = [51, 26]; a2.head = [55, 25];
  a2.aB = { e: [68, 32], h: [81, 33] }; a2.aF = { e: [38, 38], h: [33, 47] };
  const a3 = clonePose(S);
  a3.hip = [46, 58];
  a3.lF = { k: [52, 66], a: [53, 78] };
  a3.aF = { e: [34, 38], h: [30, 30] }; a3.aB = { e: [65, 37], h: [72, 30] };
  const rampage = [P96(bossLook('shout'), a0), P96(bossLook('shout'), a1), P96(bossLook('grin'), a2), P96(bossLook('shout'), a3)];

  // 3 ラッシュを受ける
  const h0 = clonePose(S);
  h0.neck = [43, 27]; h0.head = [42, 27]; h0.hip = [46, 57];
  h0.aF = { e: [44, 40], h: [52, 34] }; h0.aB = { e: [58, 36], h: [66, 30] };
  h0.lB = { k: [55, 71], a: [60, 84], toe: 0.3 };
  const h1 = clonePose(S);
  h1.neck = [44, 30]; h1.head = [45, 31]; h1.hip = [45, 58];
  h1.aF = { e: [36, 42], h: [36, 52] }; h1.aB = { e: [60, 38], h: [70, 36] };
  h1.lF = { k: [41, 73], a: [37, 86] };
  const hit = [P96(bossLook('hurt'), h0), P96(bossLook('hurt'), h1)];

  // 4 やられる
  const d0 = clonePose(S);
  d0.neck = [44, 27]; d0.head = [44, 27]; d0.hip = [46, 57];
  d0.aF = { e: [38, 42], h: [35, 52] }; d0.aB = { e: [58, 38], h: [66, 32] };
  d0.lB = { k: [55, 71], a: [60, 84], toe: 0.3 };
  const d1 = clonePose(S);
  d1.hip = [44, 70]; d1.neck = [48, 39]; d1.head = [52, 38];
  d1.aF = { e: [44, 55], h: [48, 66] }; d1.aB = { e: [60, 54], h: [64, 65] };
  d1.lF = { k: [55, 76], a: [52, 86] }; d1.lB = { k: [48, 87], a: [36, 87], toe: -0.2 };
  const d2 = clonePose(S);
  d2.aF = { e: [44, 38], h: [48, 30] }; d2.aB = { e: [62, 34], h: [70, 30] };
  d2.lB = { k: [58, 70], a: [66, 80], toe: 0.6 };
  const d3 = clonePose(S);
  d3.aF = { e: [44, 36], h: [42, 26] }; d3.aB = { e: [60, 45], h: [62, 56] };
  d3.lF = { k: [58, 70], a: [50, 85] };
  const defeat = [
    ground(P96(bossLook('hurt'), d0), false),
    ground(P96(bossLook('hurt'), d1), false),
    rotateGrid(P96(bossLook('ko'), d2), -1.0, 48, 52, 48, 58),
    ground(rotateGrid(P96(bossLook('ko'), d3), -Math.PI / 2, 48, 48, 48, 48))
  ];
  return [reveal, idle, rampage, hit, defeat];
}
