// 壊れる物(2コマ:ふつう、壊れた)。
import { md, OUTLINE, PixelGrid } from '../lib';
import { Painter, type Pt, type Ramp } from './pix';

const METAL: Ramp = [md(6, 6, 6), md(4, 4, 5), md(3, 3, 4)];
const METAL_D = md(2, 2, 3);
const WHITE = md(7, 7, 7);

// ---------------------------------------------------------------------
// ゴミ箱 32×32(基準:下の真ん中)
// ---------------------------------------------------------------------
function trash(broken: boolean): PixelGrid {
  const P = new Painter(32, 32);
  const BANANA = md(7, 6, 1), BANANA_D = md(5, 4, 0), CAN = md(6, 1, 1), BAG: Ramp = [md(2, 3, 2), md(1, 2, 1), md(1, 1, 1)];
  if (!broken) {
    const body = P.mask().poly([[8, 12], [24, 12], [23, 31], [9, 31]]);
    P.fill(body, METAL, { hi: 0.28, lo: 0.7 });
    for (const y of [16, 21, 26]) {
      for (let x = 8; x <= 24; x++) if (body.has(x, y)) { P.px(x, y, METAL_D); if (body.has(x, y + 1)) P.px(x, y + 1, METAL[0]); }
    }
    for (let y = 13; y <= 29; y++) if (body.has(23, y)) P.px(23, y, METAL_D);
    // ふた
    const lid = P.mask().poly([[7, 9], [25, 9], [26, 12], [6, 12]]);
    P.fill(lid, METAL, { sep: 'outline', hi: 0.4, lo: 0.8 });
    P.rect(8, 9, 16, 1, WHITE);
    const handle = P.mask().rect(13, 6, 6, 3).subtract(P.mask().rect(14, 7, 4, 2));
    P.fill(handle, METAL, { sep: 'outline', flat: true });
    // ふたのすき間からのぞくゴミ
    P.px(20, 12, BANANA); P.px(21, 12, BANANA);
  } else {
    // へこんで横に倒れた本体
    const body = P.mask().poly([[3, 19], [19, 17], [22, 21], [21, 30], [4, 30], [2, 25]]);
    body.subtract(P.mask().ellipse(12, 17, 3, 2));
    P.fill(body, METAL, { hi: 0.25, lo: 0.7 });
    for (let x = 3; x <= 21; x++) for (const y of [23, 27]) if (body.has(x, y + (x > 12 ? 1 : 0))) P.px(x, y + (x > 12 ? 1 : 0), METAL_D);
    P.line([10, 20], [13, 24], METAL_D).line([13, 24], [15, 21], METAL[0]);
    // 口から出たゴミ
    const bag = P.mask().ellipse(24, 26, 4, 3.5);
    P.fill(bag, BAG, { sep: 'outline', hi: 0.35, lo: 0.65 });
    P.px(22, 24, BAG[0]).px(23, 23, BAG[0]);
    // バナナの皮
    const ban = P.mask().capsule([26, 30], [30, 29], 0.8).union(P.mask().capsule([27, 30], [29, 27], 0.6));
    P.fill(ban, BANANA, { sep: 'outline', flat: true });
    P.px(29, 27, BANANA_D).px(30, 29, BANANA_D);
    // 空き缶
    const can = P.mask().rect(15, 28, 4, 2);
    P.fill(can, CAN, { sep: 'outline', flat: true });
    P.px(15, 28, WHITE);
    // 紙くず
    const paper = P.mask().ellipse(8, 14, 2, 1.5);
    P.fill(paper, [WHITE, WHITE, METAL[1]], { sep: 'outline' });
    // 飛んだふた
    const lid = P.mask().poly([[21, 8], [29, 12], [28, 14], [20, 10]]);
    P.fill(lid, METAL, { sep: 'outline', hi: 0.4, lo: 0.7 });
    P.px(25, 9, METAL[0]).px(26, 9, METAL[0]);
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// 窓 24×32(基準:真ん中)。背景の壁の窓もこの絵を使う
// ---------------------------------------------------------------------
const WIN_FRAME: Ramp = [md(5, 4, 4), md(4, 3, 3), md(2, 2, 2)];
const WIN_LIT: Ramp = [md(7, 7, 5), md(7, 6, 3), md(6, 4, 2)];
const WIN_DARK: Ramp = [md(3, 3, 5), md(2, 2, 4), md(1, 1, 3)];
const CURTAIN = md(5, 2, 2);

export function windowGrid(state: 'lit' | 'dark' | 'broken', seed = 0): PixelGrid {
  const P = new Painter(24, 32);
  // 上のまぐさと下の窓台
  P.fill(P.mask().rect(1, 0, 22, 3), WIN_FRAME, { sep: 'none', hi: 0.5, lo: 0.8 });
  P.fill(P.mask().rect(0, 28, 24, 4), WIN_FRAME, { sep: 'none', hi: 0.4, lo: 0.8 });
  P.rect(0, 28, 24, 1, WIN_FRAME[0]);
  // 窓わく
  P.fill(P.mask().rect(2, 3, 20, 25), WIN_FRAME[2], { sep: 'none', flat: true });
  const glass = P.mask().rect(3, 4, 18, 23);
  if (state === 'lit') {
    P.fill(glass, WIN_LIT, { sep: 'none', flat: true });
    // カーテンと部屋の中の影
    P.rect(3, 4, 4 + (seed % 2), 23, CURTAIN).rect(4, 4, 1, 23, WIN_LIT[2]);
    P.rect(3, 4, 18, 2, WIN_LIT[2]);
    P.rect(15, 18, 5, 9, WIN_LIT[2]);
    P.rect(16, 16, 3, 3, WIN_LIT[2]);
  } else if (state === 'dark') {
    P.fill(glass, WIN_DARK, { sep: 'none', flat: true });
    P.line([5, 25], [12, 9], WIN_DARK[0]).line([7, 25], [14, 9], WIN_DARK[0]);
    P.px(16, 7, WIN_DARK[0]).px(17, 6, WIN_DARK[0]);
  } else {
    P.fill(glass, md(1, 0, 1), { sep: 'none', flat: true });
    P.rect(3, 22, 18, 5, md(1, 1, 2));
    // 残ったガラスのとげ
    const shards: Pt[][] = [
      [[3, 4], [10, 4], [3, 12]], [[13, 4], [21, 4], [21, 9], [17, 7]], [[3, 27], [3, 19], [8, 27]],
      [[21, 27], [21, 15], [18, 22], [15, 27]], [[10, 4], [12, 4], [11, 7]]
    ];
    for (const s of shards) {
      const m = P.mask().poly(s);
      P.fill(m, WIN_DARK[0], { sep: 'none', flat: true });
    }
    P.line([3, 12], [10, 4], WHITE).line([17, 7], [21, 9], WHITE).line([3, 19], [8, 27], WHITE).line([18, 22], [21, 15], WHITE);
  }
  // さん(十字)
  if (state !== 'broken') {
    P.rect(11, 4, 2, 23, WIN_FRAME[2]).rect(3, 15, 18, 1, WIN_FRAME[2]);
    P.rect(11, 4, 1, 23, WIN_FRAME[1]);
  } else {
    P.rect(11, 4, 2, 8, WIN_FRAME[2]).rect(11, 20, 2, 7, WIN_FRAME[2]).rect(3, 15, 6, 1, WIN_FRAME[2]);
    P.line([13, 12], [15, 14], WIN_FRAME[2]);
  }
  return P.g;
}

// ---------------------------------------------------------------------
// 看板 32×24(基準:真ん中)。ネオンの記号(文字なし)
// ---------------------------------------------------------------------
function sign(broken: boolean): PixelGrid {
  const W = 32, H = 24;
  const P = new Painter(W, H);
  const BOX: Ramp = [md(4, 2, 5), md(2, 1, 3), md(1, 0, 2)];
  const PINK = md(7, 3, 6), PINK_C = md(7, 6, 7), CYAN = md(3, 7, 7), CYAN_C = WHITE, DEAD = md(3, 3, 4), SPARK = md(7, 7, 2);
  // 金具
  P.fill(P.mask().rect(6, 0, 2, 3).union(P.mask().rect(24, 0, 2, 3)), METAL, { sep: 'none', flat: true });
  const box = P.mask().rect(1, 3, 30, 19);
  P.fill(box, BOX, { sep: 'none', hi: 0.12, lo: 0.9 });
  P.rect(1, 3, 30, 1, BOX[0]).rect(1, 3, 1, 19, BOX[0]);
  P.rect(3, 5, 26, 15, md(1, 0, 1));
  const tube = (pts: Pt[], c: string, core: string, dead: boolean) => {
    for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i], pts[i + 1], dead ? DEAD : c);
    if (!dead) for (let i = 0; i + 1 < pts.length; i += 2) P.px(Math.round((pts[i][0] + pts[i + 1][0]) / 2), Math.round((pts[i][1] + pts[i + 1][1]) / 2), core);
  };
  // カクテルグラス(水色)
  const glass: Pt[] = [[5, 7], [15, 7], [10, 12], [5, 7]];
  tube(glass, CYAN, CYAN_C, broken);
  tube([[10, 12], [10, 17]], CYAN, CYAN_C, broken);
  tube([[7, 17], [13, 17]], CYAN, CYAN_C, false && broken);
  P.px(12, 6, PINK).px(13, 5, PINK); // さしてある実
  // 星(ピンク)
  const star: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.6 : 6;
    star.push([22.5 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
  }
  tube(star, PINK, PINK_C, false);
  P.px(22, 12, PINK_C).px(23, 12, PINK_C);
  // 下のふち飾り
  for (let x = 4; x < 28; x += 3) P.px(x, 19, broken && x > 16 ? DEAD : PINK);
  if (!broken) return P.g;
  // 壊れた:割れて斜めにずり落ち、ネオンが切れて火花
  P.line([17, 3], [14, 10], OUTLINE).line([14, 10], [18, 15], OUTLINE).line([18, 15], [15, 22], OUTLINE);
  for (const [x, y] of [[20, 9], [24, 13], [21, 16]] as const) P.px(x, y, DEAD);
  const tilted = new PixelGrid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = P.g.get(x, y);
    if (!c) continue;
    const dy = Math.round((x - 4) * 0.12);
    if (y < 3) { tilted.px(x, y, x < 16 ? c : null); continue; }
    tilted.px(x, y + dy, c);
  }
  // 右の金具が外れて、欠けた角
  tilted.px(28, 21, null).px(29, 21, null).px(30, 21, null).px(30, 20, null).px(29, 22, null).px(30, 22, null).px(28, 22, null);
  tilted.px(26, 0, SPARK).px(27, 1, SPARK).px(29, 0, SPARK).px(28, 3, WHITE).px(24, 2, SPARK);
  tilted.px(12, 18, SPARK).px(13, 19, WHITE);
  return tilted;
}

// ---------------------------------------------------------------------
// 自販機 32×64(基準:下の真ん中)
// ---------------------------------------------------------------------
function vending(broken: boolean): PixelGrid {
  const P = new Painter(32, 64);
  const BODY: Ramp = [md(3, 5, 7), md(1, 3, 6), md(1, 1, 4)];
  const LIGHT = WHITE, LIGHT2 = md(5, 6, 7), DARK = md(1, 1, 2);
  const DRINKS = [md(7, 2, 2), md(7, 6, 1), md(2, 6, 3), LIGHT, md(7, 4, 1)];
  const body = P.mask().rect(3, 3, 26, 60);
  P.fill(body, BODY, { hi: 0.18, lo: 0.85 });
  P.rect(3, 3, 26, 1, BODY[0]);
  // 屋根
  P.fill(P.mask().rect(2, 1, 28, 3), METAL, { sep: 'outline', hi: 0.5, lo: 0.9 });
  // 見本の窓
  const win = P.mask().rect(5, 6, 22, 27);
  P.fill(win, broken ? DARK : LIGHT2, { sep: 'none', flat: true });
  if (!broken) P.rect(5, 6, 22, 2, LIGHT);
  for (let row = 0; row < 3; row++) {
    const y = 9 + row * 8;
    P.rect(5, y + 6, 22, 1, METAL[2]);
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 4;
      const c = DRINKS[(i + row * 2) % DRINKS.length];
      if (broken && (i + row) % 3 === 0) continue;
      P.rect(x, y + 1, 3, 5, c).px(x + 1, y, c).px(x, y + 1, LIGHT);
      if (!broken) P.px(x + 1, y + 7, i % 2 ? md(7, 2, 2) : md(2, 6, 3));
    }
  }
  // お金を入れるところ
  P.fill(P.mask().rect(19, 36, 8, 10), METAL, { sep: 'outline', hi: 0.3, lo: 0.8 });
  P.rect(21, 38, 1, 3, OUTLINE).rect(23, 42, 3, 1, OUTLINE).rect(23, 38, 3, 2, broken ? DARK : md(2, 6, 3));
  // 取り出し口
  P.fill(P.mask().rect(6, 50, 20, 7), METAL, { sep: 'outline', hi: 0.2, lo: 0.8 });
  P.rect(7, 52, 18, 4, DARK);
  P.rect(7, 52, 18, 1, METAL[2]);
  // 足元
  P.rect(3, 59, 26, 4, BODY[2]).rect(3, 59, 26, 1, OUTLINE);
  // 側面の線
  for (let y = 36; y < 58; y += 4) P.px(5, y, BODY[0]).px(6, y, BODY[0]);
  if (broken) {
    // ひびとガラスの残り、へこみ、転がった缶
    P.line([6, 7], [12, 16], LIGHT).line([12, 16], [9, 24], LIGHT).line([12, 16], [20, 12], LIGHT).line([20, 12], [26, 18], LIGHT).line([16, 32], [20, 22], LIGHT);
    P.fill(P.mask().poly([[5, 6], [11, 6], [5, 12]]), LIGHT2, { sep: 'none', flat: true });
    P.fill(P.mask().poly([[27, 26], [27, 33], [21, 33]]), LIGHT2, { sep: 'none', flat: true });
    const dent = P.mask().ellipse(10, 42, 3, 4);
    P.recolor(dent, BODY[2]);
    P.px(8, 40, BODY[0]).px(9, 39, BODY[0]);
    // ふたが外れかけ
    P.rect(19, 46, 8, 1, OUTLINE);
  }
  P.outline();
  if (broken) {
    // 床に転がった缶(外側に)
    const cans: [number, number, string][] = [[0, 60, DRINKS[0]], [27, 61, DRINKS[1]], [23, 62, DRINKS[2]]];
    for (const [x, y, c] of cans) {
      P.rect(x, y, 4, 2, c).px(x, y, LIGHT);
      P.px(x - 1, y, OUTLINE).px(x + 4, y, OUTLINE).px(x - 1, y + 1, OUTLINE).px(x + 4, y + 1, OUTLINE);
      P.rect(x, y - 1, 4, 1, OUTLINE);
    }
  }
  return P.g;
}

// ---------------------------------------------------------------------
// 止めてある小さい車 128×56(基準:下の真ん中)
// ---------------------------------------------------------------------
function car(broken: boolean): PixelGrid {
  const P = new Painter(128, 56);
  const BODY: Ramp = [md(4, 7, 6), md(2, 5, 4), md(1, 3, 3)];
  const GLASS: Ramp = [md(4, 5, 7), md(2, 3, 5), md(1, 1, 3)];
  const TIRE = md(1, 1, 1), HUB = METAL, RED = md(7, 1, 1), HEAD = md(7, 7, 4), DARK = md(1, 0, 1);
  const dent = (x: number, y: number): Pt => {
    if (!broken) return [x, y];
    // 屋根の真ん中と、前のボンネットをへこませる
    let dy = 0;
    if (y < 20) dy += Math.max(0, 6 - Math.abs(x - 56) / 5);
    if (x > 98 && y < 36) dy += (x - 98) * 0.22;
    return [x, y + dy];
  };
  const poly = (pts: Pt[]) => pts.map(([x, y]) => dent(x, y));
  // 車体
  const roof: Pt[] = [];
  for (let x = 24; x <= 80; x += 4) roof.push([x, 4]);
  const outlinePts = poly([[7, 16], [11, 6], ...roof, [88, 6], [101, 22], [114, 25], [121, 30], [122, 44], [5, 44], [4, 28]]);
  const body = P.mask().poly(outlinePts);
  P.fill(body, BODY[1], { sep: 'none', flat: true });
  body.each((x, y) => {
    if (!body.has(x, y - 1)) P.px(x, y, BODY[0]);
    else if (y >= 37) P.px(x, y, BODY[2]);
    else if (!body.has(x + 1, y)) P.px(x, y, BODY[2]);
    else if (!body.has(x - 1, y) || !body.has(x - 2, y)) P.px(x, y, BODY[0]);
  });
  // 窓
  const glassM = P.mask().poly(poly([[13, 18], [17, 8], [44, 7], [44, 21], [13, 21]]))
    .union(P.mask().poly(poly([[49, 7], [81, 7], [86, 9], [96, 22], [49, 22]])));
  if (!broken) {
    P.fill(glassM, GLASS, { sep: 'outline', hi: 0.3, lo: 0.75 });
    P.line([62, 8], [54, 21], GLASS[0]).line([66, 8], [58, 21], GLASS[0]).line([24, 9], [18, 19], GLASS[0]);
  } else {
    P.fill(glassM, DARK, { sep: 'outline', flat: true });
    const shards: Pt[][] = [[[49, 7], [58, 7], [49, 16]], [[81, 7], [92, 16], [86, 17]], [[13, 21], [16, 14], [21, 21]], [[36, 7], [44, 7], [44, 14]]];
    for (const s of shards) P.fill(P.mask().poly(poly(s)).intersect(glassM), GLASS[1], { sep: 'none', flat: true });
    P.line(dent(52, 18), dent(58, 12), WHITE).line(dent(88, 16), dent(84, 13), WHITE).line(dent(14, 21), dent(17, 17), WHITE);
  }
  // 柱とドアの線
  P.line(dent(46, 7), dent(46, 43), OUTLINE).line(dent(47, 7), dent(47, 21), BODY[2]);
  P.line(dent(99, 24), dent(99, 43), OUTLINE);
  P.line(dent(4, 29), dent(122, 30), BODY[0]);
  for (const x of [38, 90]) P.rect(x, Math.round(dent(x, 27)[1]), 5, 1, OUTLINE);
  // バンパーと下まわり
  P.fill(P.mask().rect(2, 40, 124, 5), METAL, { sep: 'outline', hi: 0.4, lo: 0.8 });
  // ライト
  if (!broken) {
    P.rect(118, 31, 5, 3, HEAD).px(122, 31, WHITE);
    P.rect(4, 26, 3, 5, RED).px(4, 26, WHITE);
  } else {
    P.rect(118, 33, 5, 3, DARK).px(119, 34, HEAD);
    P.rect(4, 26, 3, 5, RED);
    // ボンネットのしわと、ドアのへこみ
    P.line([104, 27], [110, 31], BODY[2]).line([110, 31], [115, 29], BODY[0]).line([115, 29], [120, 33], BODY[2]);
    P.fill(P.mask().ellipse(70, 34, 7, 4), BODY[2], { sep: 'none', flat: true });
    P.line([64, 32], [72, 37], BODY[0]).line([66, 36], [75, 31], OUTLINE);
    P.line(dent(20, 34), dent(30, 38), OUTLINE);
  }
  // 車輪(壊れたときは前がパンク)
  const wheel = (cx: number, flat: boolean) => {
    const cy = 46;
    const tire = P.mask().ellipse(cx, cy + (flat ? 2 : 0), flat ? 10.5 : 9.5, flat ? 7.5 : 9.5);
    P.fill(tire, [md(2, 2, 2), TIRE, TIRE], { sep: 'outline', hi: 0.25, lo: 0.5 });
    const hub = P.mask().ellipse(cx, cy + (flat ? 2 : 0), 4.5, flat ? 3.5 : 4.5);
    P.fill(hub, HUB, { sep: 'none', hi: 0.35, lo: 0.7 });
    P.px(cx, cy + (flat ? 2 : 0), OUTLINE);
  };
  // 車輪のまわりの切り欠き
  for (const cx of [26, 100]) P.fill(P.mask().ellipse(cx, 44, 11.5, 10.5).intersect(P.mask().rect(0, 30, 128, 16)), DARK, { sep: 'none', flat: true });
  wheel(26, false);
  wheel(100, broken);
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------

function pair(a: PixelGrid, b: PixelGrid): PixelGrid[][] {
  return [[a, b]];
}

export function buildProps(): Record<string, PixelGrid[][]> {
  return {
    prop_trash: pair(trash(false), trash(true)),
    prop_window: pair(windowGrid('lit'), windowGrid('broken')),
    prop_sign: pair(sign(false), sign(true)),
    prop_vending: pair(vending(false), vending(true)),
    prop_car: pair(car(false), car(true))
  };
}
