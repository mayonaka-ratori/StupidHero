// ステージ2の物:ギャングのワゴン、女ボスの高級車(4コマずつ)と、柱、料金所のバー、三角コーン、消火器の箱(ふつうと壊れた)。
import { md, OUTLINE, PixelGrid } from '../lib';
import { Painter, type Pt, type Ramp } from '../world/pix';

const METAL: Ramp = [md(6, 6, 6), md(4, 4, 5), md(3, 3, 4)];
const WHITE = md(7, 7, 7);
const HEAD = md(7, 7, 4);
const TAIL = md(7, 1, 1);
const TIRE: Ramp = [md(2, 2, 3), md(1, 1, 1), md(1, 1, 1)];
const DARK = md(1, 0, 1);

/** 車輪。spin でホイールの模様を回す、flat でパンク */
function wheel(P: Painter, cx: number, cy: number, r: number, spin: number, flat: boolean, hub: Ramp): void {
  const ry = flat ? r * 0.72 : r;
  const oy = flat ? r - ry : 0;
  P.fill(P.mask().ellipse(cx, cy + oy, flat ? r * 1.1 : r, ry), TIRE, { sep: 'outline', hi: 0.25, lo: 0.5 });
  const hr = r * 0.48;
  P.fill(P.mask().ellipse(cx, cy + oy, hr, flat ? hr * 0.8 : hr), hub, { sep: 'none', hi: 0.35, lo: 0.7 });
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    P.px(Math.round(cx + Math.cos(a) * hr * 0.7), Math.round(cy + oy + Math.sin(a) * hr * 0.7), hub[2]);
  }
  P.px(cx, cy + oy, OUTLINE);
}

/** 排気の煙(灰色の丸) */
function puff(P: Painter, x: number, y: number, r: number): void {
  P.fill(P.mask().ellipse(x, y, r, r * 0.8), METAL, { sep: 'none', hi: 0.4, lo: 0.8 });
}

// ---------------------------------------------------------------------
// ギャングのワゴン 128×64(基準:下の真ん中)
// ---------------------------------------------------------------------
const VAN: Ramp = [md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)];
const TINT: Ramp = [md(3, 4, 5), md(1, 2, 3), md(1, 1, 2)];
const STRIPE = md(6, 1, 1);

function van(state: 0 | 1 | 2 | 3): PixelGrid {
  if (state === 3) return vanWreck();
  const P = new Painter(128, 64);
  const bob = state === 1 ? -1 : 0;
  const Y = (y: number) => y + bob;
  const at = (x: number, y: number): Pt => [x, Y(y)];
  const poly = (pts: Pt[]) => pts.map(([x, y]) => at(x, y));
  const body = P.mask().poly(poly([[5, 11], [9, 6], [100, 6], [106, 8], [116, 25], [122, 28], [124, 33], [124, 53], [4, 53], [4, 15]]));
  P.fill(body, VAN[1], { sep: 'none', flat: true });
  body.each((x, y) => {
    if (!body.has(x, y - 1)) P.px(x, y, VAN[0]);
    else if (y >= 46) P.px(x, y, VAN[2]);
    else if (!body.has(x + 1, y)) P.px(x, y, VAN[2]);
    else if (!body.has(x - 1, y)) P.px(x, y, VAN[0]);
  });
  // 窓(スモーク)
  const glass = P.mask().poly(poly([[92, 11], [102, 11], [111, 25], [92, 25]]))
    .union(P.mask().poly(poly([[38, 11], [86, 11], [86, 24], [38, 24]])))
    .union(P.mask().poly(poly([[9, 11], [30, 11], [30, 24], [8, 24]])));
  P.fill(glass, TINT, { sep: 'outline', hi: 0.2, lo: 0.6 });
  for (const x0 of [46, 70, 14, 96]) P.line(at(x0 + 4, 12), at(x0, 23), TINT[0]);
  // 横の赤い線と、スライドドア
  for (let x = 5; x <= 123; x++) { const [px, py] = at(x, 30); if (body.has(px, py)) { P.px(px, py, STRIPE); P.px(px, py + 1, STRIPE); } }
  P.line(at(34, 8), at(34, 52), OUTLINE).line(at(89, 8), at(89, 52), OUTLINE);
  P.line(at(35, 9), at(35, 45), VAN[0]);
  for (const x of [82, 96]) P.rect(x, Y(34), 4, 1, OUTLINE);
  // ライト
  P.rect(120, Y(34), 4, 4, HEAD).px(123, Y(34), WHITE);
  P.rect(4, Y(32), 2, 6, TAIL).px(4, Y(32), WHITE);
  // バンパー
  P.fill(P.mask().rect(2, Y(48), 8, 5).union(P.mask().rect(117, Y(48), 9, 5)), METAL, { sep: 'outline', hi: 0.4, lo: 0.8 });
  // 車輪のまわりの切り欠き
  for (const cx of [26, 101]) P.fill(P.mask().ellipse(cx, Y(53), 11.5, 10.5).intersect(P.mask().rect(0, Y(40), 128, 14)), DARK, { sep: 'none', flat: true });
  const spin = state === 1 ? 0 : state === 2 ? Math.PI / 3 : 0.4;
  wheel(P, 26, 54, 9, spin, false, METAL);
  wheel(P, 101, 54, 9, spin, false, METAL);
  P.outline();
  // 走る:後ろから排気の煙
  if (state === 1) { puff(P, 2, 50, 3); P.outline(); }
  if (state === 2) { puff(P, 3, 47, 2.5); puff(P, 1, 43, 1.5); P.outline(); }
  return P.g;
}

/**
 * 壊れたワゴン:一目で壊れたと分かるように、屋根がV字にへこみ、窓は全部割れ、
 * 後ろがつぶれ、前のタイヤがパンクして前のめりに傾き、バンパーが落ちかけている
 */
function vanWreck(): PixelGrid {
  const P = new Painter(128, 64);
  // 前のめり(前のタイヤがパンク)+ 屋根のへこみ + 後ろのつぶれ
  const bend = (x: number, y: number): Pt => {
    let dx = 0, dy = 0;
    dy += Math.max(0, x - 26) * 0.05;
    const roof = clamp((24 - y) / 18, 0, 1);
    dy += Math.max(0, 11 - Math.abs(x - 60) / 2.6) * roof;
    if (x < 18) dx += (18 - x) * 0.55 * clamp(1 - Math.abs(y - 32) / 20, 0, 1);
    return [Math.round(x + dx), Math.round(y + dy)];
  };
  const poly = (pts: Pt[]) => pts.map(([x, y]) => bend(x, y));
  const edge: Pt[] = [];
  const addEdge = (a: Pt, b: Pt, n: number) => { for (let i = 0; i < n; i++) edge.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]); };
  // 形の点を細かくして、曲げたときに屋根がなめらかに折れるようにする
  addEdge([5, 11], [9, 6], 2); addEdge([9, 6], [100, 6], 24); addEdge([100, 6], [106, 8], 1); addEdge([106, 8], [116, 25], 3);
  addEdge([116, 25], [124, 33], 2); addEdge([124, 33], [124, 53], 2); addEdge([124, 53], [4, 53], 4); addEdge([4, 53], [4, 15], 8); addEdge([4, 15], [5, 11], 1);
  const body = P.mask().poly(poly(edge));
  P.fill(body, VAN[1], { sep: 'none', flat: true });
  body.each((x, y) => {
    if (!body.has(x, y - 1)) P.px(x, y, VAN[0]);
    else if (y >= 47) P.px(x, y, VAN[2]);
    else if (!body.has(x + 1, y)) P.px(x, y, VAN[2]);
    else if (!body.has(x - 1, y)) P.px(x, y, VAN[0]);
  });
  // 屋根の折れ目(深い影)
  for (let x = 44; x <= 76; x++) { const [px, py] = bend(x, 7); P.px(px, py + 1, VAN[2]); }
  P.line(bend(60, 7), bend(60, 22), VAN[2]);
  // 窓は全部割れて真っ暗。ふちにガラスのかけらが残り、白いひびが走る
  const winPolys: Pt[][] = [[[92, 11], [102, 11], [111, 25], [92, 25]], [[38, 11], [86, 11], [86, 24], [38, 24]], [[10, 11], [30, 11], [30, 24], [9, 24]]];
  const glass = P.mask();
  for (const w of winPolys) {
    const pts: Pt[] = [];
    for (let i = 0; i < w.length; i++) { const a = w[i], b = w[(i + 1) % w.length]; for (let k = 0; k < 6; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / 6, a[1] + ((b[1] - a[1]) * k) / 6]); }
    glass.union(P.mask().poly(poly(pts)));
  }
  P.fill(glass, DARK, { sep: 'outline', flat: true });
  const shards: Pt[][] = [
    [[38, 24], [38, 15], [44, 24]], [[86, 24], [86, 17], [80, 24]], [[62, 24], [58, 19], [66, 24]],
    [[92, 25], [92, 18], [97, 25]], [[111, 25], [104, 25], [107, 19]], [[30, 24], [30, 17], [25, 24]], [[9, 24], [9, 19], [14, 24]]
  ];
  for (const sh of shards) P.fill(P.mask().poly(poly(sh)).intersect(glass), TINT[1], { sep: 'none', flat: true });
  // ひび(割れた星)
  const star = (cx: number, cy: number, arms: Pt[]) => { const c = bend(cx, cy); for (const [ax, ay] of arms) { const e = bend(cx + ax, cy + ay); P.line(c, e, WHITE); } };
  star(50, 20, [[-6, -3], [5, -5], [7, 3], [-4, 4]]);
  star(76, 19, [[-5, -4], [6, -3], [4, 5]]);
  star(99, 20, [[-4, -4], [4, -2], [2, 4]]);
  star(20, 19, [[-5, -3], [5, -4], [3, 4]]);
  // 横の赤い線(曲がって切れる)
  for (let x = 5; x <= 123; x++) {
    if (x > 58 && x < 66) continue;
    const [px, py] = bend(x, 30);
    if (body.has(px, py)) { P.px(px, py, STRIPE); if (body.has(px, py + 1)) P.px(px, py + 1, STRIPE); }
  }
  // スライドドアが外れかけて、すき間が開いている
  P.line(bend(34, 8), bend(34, 52), OUTLINE);
  const gap = P.mask().poly(poly([[86, 12], [90, 12], [91, 52], [86, 50]]));
  P.fill(gap.intersect(body), DARK, { sep: 'none', flat: true });
  P.line(bend(85, 12), bend(85, 50), VAN[0]);
  // 横腹の大きなへこみと焦げ
  P.fill(P.mask().ellipse(54, 40, 10, 6).intersect(body), VAN[2], { sep: 'none', flat: true });
  P.line(bend(46, 37), bend(58, 45), OUTLINE).line(bend(50, 45), bend(62, 36), OUTLINE).line(bend(46, 38), bend(52, 34), VAN[0]);
  for (const [x, y, r] of [[18, 42, 4], [110, 40, 3.5], [72, 46, 3]] as const) {
    const [cx, cy] = bend(x, y);
    P.fill(P.mask().ellipse(cx, cy, r, r * 0.7).intersect(body), TIRE[1], { sep: 'none', flat: true });
  }
  // 後ろがつぶれてしわ
  P.line(bend(8, 20), bend(14, 26), OUTLINE).line(bend(8, 34), bend(15, 40), OUTLINE).line(bend(9, 27), bend(15, 32), VAN[0]);
  // ライトは割れる
  const hl = bend(120, 34);
  P.rect(hl[0], hl[1], 4, 4, DARK).px(hl[0] + 1, hl[1] + 1, HEAD);
  // 後ろのバンパーは落ちて斜め、前のバンパーは地面に垂れる
  P.fill(P.mask().poly([[1, 55], [10, 50], [12, 53], [3, 58]]), METAL, { sep: 'outline', hi: 0.4, lo: 0.8 });
  P.fill(P.mask().poly([[114, 55], [124, 57], [125, 61], [113, 60]]), METAL, { sep: 'outline', hi: 0.4, lo: 0.8 });
  // 車輪のまわりの切り欠き
  for (const cx of [26, 101]) {
    const [wx, wy] = bend(cx, 53);
    P.fill(P.mask().ellipse(wx, wy, 11.5, 10.5).intersect(P.mask().rect(0, wy - 13, 128, 14)), DARK, { sep: 'none', flat: true });
  }
  wheel(P, 26, 54, 9, 0.4, false, METAL);
  // 前のタイヤはパンクしてつぶれ、少し外れる
  wheel(P, 103, 55, 9, 1.1, true, METAL);
  P.outline();
  return P.g;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------
// 女ボスの高級車 128×56(基準:下の真ん中)。真珠色の車体に金の線、紫のスモーク
// ---------------------------------------------------------------------
const PEARL: Ramp = [md(7, 7, 7), md(6, 6, 6), md(4, 4, 5)];
const GOLD2: Ramp = [md(7, 7, 3), md(7, 5, 1), md(5, 3, 0)];
const PTINT: Ramp = [md(4, 3, 5), md(2, 1, 3), md(1, 0, 2)];

function bosscar(state: 0 | 1 | 2 | 3): PixelGrid {
  const P = new Painter(128, 56);
  const broken = state === 3;
  const shake: Pt = state === 1 ? [-1, -1] : state === 2 ? [1, 0] : [0, 0];
  const dent = (x: number, y: number): Pt => {
    let dy = 0;
    if (broken) {
      if (y < 20) dy += Math.max(0, 5 - Math.abs(x - 58) / 6);
      if (x > 104 && y < 34) dy += (x - 104) * 0.25;
    }
    return [x + shake[0], y + dy + shake[1]];
  };
  const poly = (pts: Pt[]) => pts.map(([x, y]) => dent(x, y));
  // 低くて長い車体
  const body = P.mask().poly(poly([[3, 26], [8, 22], [30, 20], [42, 8], [80, 7], [94, 19], [118, 23], [125, 28], [125, 41], [3, 42]]));
  P.fill(body, PEARL[1], { sep: 'none', flat: true });
  body.each((x, y) => {
    if (!body.has(x, y - 1) || !body.has(x, y - 2)) P.px(x, y, PEARL[0]);
    else if (y >= 36) P.px(x, y, PEARL[2]);
    else if (!body.has(x + 1, y)) P.px(x, y, PEARL[2]);
  });
  // 窓
  const glass = P.mask().poly(poly([[44, 10], [60, 10], [60, 20], [34, 20]])).union(P.mask().poly(poly([[63, 10], [79, 10], [90, 20], [63, 20]])));
  if (!broken) {
    P.fill(glass, PTINT, { sep: 'outline', hi: 0.25, lo: 0.65 });
    P.line(dent(52, 11), dent(47, 19), PTINT[0]).line(dent(72, 11), dent(67, 19), PTINT[0]);
  } else {
    P.fill(glass, DARK, { sep: 'outline', flat: true });
    P.fill(P.mask().poly(poly([[44, 10], [52, 10], [40, 18]])).intersect(glass), PTINT[1], { sep: 'none', flat: true });
    P.fill(P.mask().poly(poly([[90, 20], [80, 12], [82, 20]])).intersect(glass), PTINT[1], { sep: 'none', flat: true });
    P.line(dent(66, 18), dent(72, 12), WHITE);
  }
  P.line(dent(61, 9), dent(61, 40), OUTLINE);
  // 金の線と飾り
  for (let x = 4; x <= 124; x++) { const [px, py] = dent(x, 28); if (body.has(Math.round(px), Math.round(py))) P.px(px, py, GOLD2[1]); }
  for (const x of [52, 74]) { const [hx, hy] = dent(x, 25); P.rect(Math.round(hx), Math.round(hy), 4, 1, GOLD2[2]); }
  const orn = dent(121, 22);
  P.px(orn[0], orn[1], GOLD2[0]).px(orn[0], orn[1] - 1, GOLD2[1]);
  // 金のバンパー
  P.fill(P.mask().rect(1 + shake[0], 38 + shake[1], 9, 4).union(P.mask().rect(118 + shake[0], 38 + shake[1], 9, 4)), GOLD2, { sep: 'outline', hi: 0.4, lo: 0.8 });
  // ライト
  const hl = dent(121, 30);
  if (!broken) P.rect(Math.round(hl[0]), Math.round(hl[1]), 4, 3, HEAD).px(Math.round(hl[0]) + 3, Math.round(hl[1]), WHITE);
  else P.rect(Math.round(hl[0]), Math.round(hl[1]), 4, 3, DARK);
  const tl = dent(3, 29);
  P.rect(tl[0], tl[1], 2, 4, TAIL);
  if (broken) {
    P.fill(P.mask().ellipse(40, 33, 7, 4), PEARL[2], { sep: 'none', flat: true });
    P.line([34, 31], [44, 36], OUTLINE).line([100, 26], [108, 30], OUTLINE).line([108, 30], [114, 27], PEARL[0]).line([114, 27], [122, 32], OUTLINE);
    // 開いたボンネット
    P.fill(P.mask().poly([[96, 16], [118, 14], [119, 17], [98, 20]]), PEARL, { sep: 'outline', hi: 0.4, lo: 0.8 });
  }
  for (const cx of [24, 104]) P.fill(P.mask().ellipse(cx + shake[0], 41 + shake[1], 10.5, 9.5).intersect(P.mask().rect(0, 28, 128, 14)), DARK, { sep: 'none', flat: true });
  wheel(P, 24, 46, 8.5, state * 0.9, broken, GOLD2);
  wheel(P, 104, 46, 8.5, state * 0.9, false, GOLD2);
  P.outline();
  // エンジンをふかす:後ろの煙
  if (state === 1) { puff(P, 3, 36, 3); P.outline(); }
  if (state === 2) { puff(P, 2, 33, 2.4); puff(P, 5, 28, 1.6); P.outline(); }
  return P.g;
}

// ---------------------------------------------------------------------
// 柱 32×96(基準:下の真ん中)
// ---------------------------------------------------------------------
const CONC: Ramp = [md(5, 5, 5), md(4, 4, 4), md(3, 3, 3)];
const CONC_D = md(2, 2, 3);
const HAZ_Y = md(7, 6, 1), HAZ_K = md(1, 1, 1);
const PLATE = md(2, 3, 6);

function pillar(broken: boolean): PixelGrid {
  const P = new Painter(32, 96);
  const x0 = 5, w = 22;
  P.fill(P.mask().rect(x0, 0, w, 96), CONC[1], { sep: 'none', flat: true });
  P.rect(x0, 0, 3, 96, CONC[0]).rect(x0 + w - 5, 0, 5, 96, CONC[2]).rect(x0 + w - 5, 0, 1, 96, CONC_D);
  // 型わくの跡
  for (const y of [20, 46]) P.rect(x0, y, w, 1, CONC[2]);
  for (let i = 0; i < 18; i++) P.px(x0 + 4 + ((i * 7) % 12), (i * 13) % 70, CONC[2]);
  // 番号の板(文字なし)
  P.rect(x0 + 4, 26, 12, 12, WHITE).rect(x0 + 5, 27, 10, 10, PLATE);
  P.rect(x0 + 7, 29, 6, 1, WHITE).rect(x0 + 7, 34, 6, 1, WHITE);
  // 下のしま模様
  for (let y = 76; y < 94; y++) for (let x = x0; x < x0 + w; x++) {
    const c = Math.floor((x - y + 200) / 4) % 2 ? HAZ_Y : HAZ_K;
    P.px(x, y, c);
  }
  P.rect(x0, 75, w, 1, OUTLINE);
  for (let y = 76; y < 94; y++) if (P.g.get(x0 + w - 1, y) === HAZ_Y) P.px(x0 + w - 1, y, md(5, 4, 0));
  P.rect(x0, 94, w, 2, CONC[2]);
  if (broken) {
    // 欠けたかどとひび、むき出しの鉄筋、足元のがれき
    const bite = P.mask().poly([[x0 - 1, 40], [x0 + 9, 44], [x0 + 6, 56], [x0 + 11, 62], [x0 - 1, 68]])
      .union(P.mask().poly([[x0 + w + 1, 10], [x0 + w - 7, 16], [x0 + w - 4, 24], [x0 + w + 1, 28]]));
    bite.each((x, y) => P.px(x, y, null));
    P.line([x0 + 9, 44], [x0 + 14, 50], CONC_D).line([x0 + 14, 50], [x0 + 12, 58], CONC_D).line([x0 + 6, 56], [x0 + 16, 64], CONC_D);
    P.line([x0 + w - 7, 16], [x0 + 10, 22], CONC_D);
    P.line([x0 + 2, 46], [x0 + 2, 64], md(4, 2, 1)).line([x0 + 5, 48], [x0 + 5, 62], md(4, 2, 1));
    P.line([x0 + w - 3, 12], [x0 + w - 3, 26], md(4, 2, 1));
    for (const [x, y, r] of [[3, 93, 2.2], [9, 94, 1.6], [27, 93, 2], [22, 95, 1.2]] as const) P.fill(P.mask().ellipse(x, y, r, r * 0.8), CONC, { sep: 'outline', hi: 0.4, lo: 0.7 });
    P.rect(x0 + 1, 74, 6, 2, CONC_D);
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// 料金所のバー 64×32(基準:下の真ん中)
// ---------------------------------------------------------------------
const BOX: Ramp = [md(6, 6, 3), md(5, 5, 2), md(3, 3, 1)];

function barrier(broken: boolean): PixelGrid {
  const P = new Painter(64, 32);
  // 台の箱
  const box = P.mask().rect(3, 10, 12, 21);
  P.fill(box, BOX, { sep: 'outline', hi: 0.3, lo: 0.75 });
  P.rect(3, 10, 12, 1, BOX[0]).rect(5, 14, 8, 5, OUTLINE).rect(6, 15, 6, 3, broken ? DARK : md(2, 6, 3));
  P.rect(3, 29, 12, 2, METAL[2]);
  // 上の回る明かり
  P.fill(P.mask().rect(7, 6, 4, 4), broken ? METAL : [md(7, 5, 1), md(7, 4, 0), md(5, 2, 0)], { sep: 'outline', hi: 0.4, lo: 0.8 });
  const bar = (a: Pt, b: Pt) => {
    const m = P.mask().capsule(a, b, 1.3);
    P.fill(m, WHITE, { sep: 'outline', flat: true });
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    m.each((x, y) => {
      const t = ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / L;
      if (Math.floor(t / 5) % 2 === 0) P.px(x, y, TAIL);
    });
  };
  if (!broken) {
    bar([14, 16], [62, 16]);
    P.fill(P.mask().ellipse(14, 16, 2.5, 2.5), METAL, { sep: 'outline' });
  } else {
    // 折れて、先が床に落ちた
    bar([14, 16], [34, 18]);
    bar([36, 29], [62, 26]);
    P.fill(P.mask().ellipse(14, 16, 2.5, 2.5), METAL, { sep: 'outline' });
    P.px(35, 18, WHITE).px(36, 17, TAIL).px(35, 28, WHITE).px(34, 27, WHITE);
    // へこんだ箱
    P.line([12, 22], [14, 26], OUTLINE).line([11, 23], [13, 27], BOX[0]);
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// 三角コーン 16×16(基準:下の真ん中)
// ---------------------------------------------------------------------
const ORANGE: Ramp = [md(7, 5, 1), md(7, 3, 0), md(5, 1, 0)];

function cone(broken: boolean): PixelGrid {
  const P = new Painter(16, 16);
  if (!broken) {
    P.fill(P.mask().rect(2, 13, 12, 2), ORANGE, { sep: 'outline', hi: 0.2, lo: 0.6 });
    P.fill(P.mask().poly([[7, 2], [9, 2], [12, 13], [4, 13]]), ORANGE, { sep: 'outline', hi: 0.35, lo: 0.7 });
    for (let x = 5; x <= 11; x++) if (P.g.get(x, 8)) { P.px(x, 7, WHITE); P.px(x, 8, WHITE); }
    P.px(10, 8, METAL[0]).px(10, 7, METAL[0]);
  } else {
    // 倒れてつぶれた
    P.fill(P.mask().poly([[2, 11], [12, 9], [13, 14], [3, 14]]), ORANGE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.fill(P.mask().poly([[13, 9], [15, 10], [14, 14], [13, 14]]), ORANGE[2], { sep: 'outline', flat: true });
    for (let y = 10; y <= 14; y++) if (P.g.get(7, y) && P.g.get(7, y) !== OUTLINE) { P.px(7, y, WHITE); P.px(8, y, WHITE); }
    P.line([4, 12], [7, 13], ORANGE[2]);
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// 消火器の箱 16×24(壁につく。基準:真ん中)
// ---------------------------------------------------------------------
const RED: Ramp = [md(7, 2, 2), md(6, 0, 1), md(4, 0, 1)];

function extinguisher(broken: boolean): PixelGrid {
  const P = new Painter(16, 24);
  P.fill(P.mask().rect(1, 1, 14, 22), RED, { sep: 'none', hi: 0.2, lo: 0.85 });
  P.rect(1, 1, 14, 1, RED[0]);
  // 中の窓
  P.rect(3, 4, 10, 16, OUTLINE);
  if (!broken) {
    P.rect(4, 5, 8, 14, md(2, 2, 3));
    // 中の消火器
    P.fill(P.mask().rect(6, 8, 4, 10).union(P.mask().ellipse(8, 8, 2, 1.5)), RED, { sep: 'outline', hi: 0.35, lo: 0.7 });
    P.rect(7, 5, 2, 2, METAL[1]).px(9, 6, OUTLINE).px(10, 7, OUTLINE);
    P.px(7, 12, WHITE).px(8, 12, WHITE);
    // ガラスの光
    P.line([5, 16], [9, 6], md(4, 4, 5)).px(10, 6, md(4, 4, 5));
  } else {
    P.rect(4, 5, 8, 14, DARK);
    // 割れたガラスのとげと、ふき出した白い泡
    P.fill(P.mask().poly([[4, 5], [8, 5], [4, 10]]), md(4, 4, 5), { sep: 'none', flat: true });
    P.fill(P.mask().poly([[11, 18], [11, 13], [8, 18]]), md(4, 4, 5), { sep: 'none', flat: true });
    P.fill(P.mask().ellipse(7, 18, 4, 3).union(P.mask().ellipse(11, 20, 3, 2.5)).union(P.mask().ellipse(4, 21, 2.5, 2)), [WHITE, WHITE, METAL[0]], { sep: 'outline' });
    P.line([2, 3], [5, 1], RED[2]);
  }
  P.outline();
  return P.g;
}

export function buildProps2(): Record<string, PixelGrid[][]> {
  const four = (f: (s: 0 | 1 | 2 | 3) => PixelGrid): PixelGrid[][] => [[f(0), f(1), f(2), f(3)]];
  return {
    prop_van: four(van),
    prop_bosscar: four(bosscar),
    prop_pillar: [[pillar(false), pillar(true)]],
    prop_barrier: [[barrier(false), barrier(true)]],
    prop_cone: [[cone(false), cone(true)]],
    prop_extinguisher: [[extinguisher(false), extinguisher(true)]]
  };
}
