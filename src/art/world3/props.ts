// ステージ3の物:UFO、母艦(4コマずつ)と、ガチャガチャ、マネキン、ショーケース、噴水、エスカレーター(ふつうと壊れた)。
// 置くときの基準はどれもコマの下の真ん中。飛んでいるUFOと母艦は、コマの中の上寄りに描く。
import { md, OUTLINE, PixelGrid } from '../lib';
import { type Mask, Painter, type Pt, type Ramp, rotateGrid } from '../world/pix';
import { GLITCH } from './palette';

const METAL: Ramp = [md(7, 7, 7), md(5, 5, 6), md(3, 3, 4)];
const DARKM: Ramp = [md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)];
const DOME: Ramp = [md(6, 7, 7), md(3, 5, 6), md(2, 3, 5)];
const WHITE = md(7, 7, 7);
const LAMP_Y = md(7, 7, 3), LAMP_R = md(7, 2, 2);
const SMOKE: Ramp = [METAL[1], METAL[2], DARKM[1]];
const DARK = md(1, 0, 1);

/** 平たい円盤を、横の帯で塗る(上の面は明るく、ふちの下は暗い。左は明るく、右は暗い) */
function shadeDisc(P: Painter, m: Mask, r: Ramp, cx: number, top: number, rim: number, rx: number): void {
  m.each((x, y) => {
    const u = (x - cx) / rx;
    let c: string;
    const v = (y - top) / Math.max(1, rim - top);
    if (y < rim) c = u + v * 0.9 < 0.45 ? r[0] : r[1];
    else if (y === rim) c = r[1];
    else c = !m.has(x - 2, y) || !m.has(x, y + 1) && u < -0.3 ? r[1] : r[2];
    if (y === top + 1 && u > -0.7 && u < -0.2) c = WHITE;
    P.px(x, y, c);
  });
}

/** 煙の丸 */
function puff(P: Painter, x: number, y: number, r: number, ramp: Ramp = SMOKE): void {
  P.fill(P.mask().ellipse(x, y, r, r * 0.8), ramp, { sep: 'none', hi: 0.4, lo: 0.8 });
}

/** 格子を傾ける(落ちたUFOと母艦)。(cx, cy) のまわりで回して、(qx, qy) に置く */
function tilt(g: PixelGrid, angle: number, cx: number, cy: number, qx: number, qy: number): PixelGrid {
  return rotateGrid(g, angle, cx, cy, qx, qy);
}

// ---------------------------------------------------------------------
// UFO 64×32。0〜1:飛ぶ(ふちの灯りが回る)、2:吸い上げる、3:落ちた
// ---------------------------------------------------------------------
function ufoBody(P: Painter, y0: number, lights: number, open: boolean, broken: boolean): void {
  const cx = 32;
  // 上のまるい窓(中に宇宙人の影)
  const dome = P.mask().ellipse(cx, y0 + 7, 9, 7).intersect(P.mask().rect(0, 0, 64, y0 + 9));
  P.fill(dome, broken ? DARKM : DOME, { sep: 'outline', hi: 0.3, lo: 0.75 });
  if (!broken) {
    P.fill(P.mask().ellipse(cx + 1, y0 + 6, 2.5, 2.5).union(P.mask().rect(cx - 2, y0 + 7, 6, 2)), DOME[2], { sep: 'none', flat: true });
    P.px(cx + 2, y0 + 5, GLITCH[1]);
    P.line([cx - 6, y0 + 4], [cx - 4, y0 + 2], WHITE);
  } else {
    P.line([cx - 5, y0 + 2], [cx - 1, y0 + 6], WHITE).line([cx - 1, y0 + 6], [cx + 4, y0 + 3], WHITE).line([cx - 1, y0 + 6], [cx - 2, y0 + 8], WHITE);
  }
  // 円盤
  const disc = P.mask().ellipse(cx, y0 + 12, 29, 5.5);
  P.fill(disc, METAL[1], { sep: 'outline', flat: true });
  shadeDisc(P, disc, METAL, cx, y0 + 6, y0 + 12, 29);
  // 下のふくらみ
  const belly = P.mask().ellipse(cx, y0 + 16, 12, 3.5).intersect(P.mask().rect(0, y0 + 15, 64, 10));
  P.fill(belly, DARKM, { sep: 'outline', hi: 0.3, lo: 0.7 });
  // ふちの帯と灯り
  for (let x = 4; x <= 60; x++) if (disc.has(x, y0 + 12)) P.px(x, y0 + 12, METAL[2]);
  for (let i = 0; i < 7; i++) {
    const x = 7 + i * 8 + (lights % 2) * 4;
    if (x > 58) continue;
    const c = broken ? DARKM[1] : i % 2 === (lights % 2) ? LAMP_Y : LAMP_R;
    P.px(x, y0 + 12, c).px(x + 1, y0 + 12, c);
  }
  // 吸い上げる口
  if (open) {
    P.fill(P.mask().ellipse(cx, y0 + 18, 7, 2), [WHITE, GLITCH[0], GLITCH[1]], { sep: 'outline', hi: 0.5, lo: 0.9 });
  } else if (!broken) {
    P.rect(cx - 3, y0 + 18, 6, 1, DARKM[2]);
  }
  if (broken) {
    // へこみと裂け目
    P.fill(P.mask().ellipse(cx + 12, y0 + 11, 6, 2.5).intersect(disc), DARKM[1], { sep: 'none', flat: true });
    P.line([cx + 8, y0 + 9], [cx + 14, y0 + 13], OUTLINE).line([cx + 14, y0 + 13], [cx + 18, y0 + 10], OUTLINE);
    P.line([cx - 20, y0 + 12], [cx - 14, y0 + 15], OUTLINE);
  }
}

function ufo(state: 0 | 1 | 2 | 3): PixelGrid {
  const P = new Painter(64, 32);
  if (state < 3) {
    ufoBody(P, state === 1 ? 3 : 2, state, state === 2, false);
    P.outline();
    return P.g;
  }
  // 落ちた:傾いて下に落ち、煙を上げる
  ufoBody(P, 9, 0, false, true);
  const g = tilt(P.g, 0.2, 32, 20, 32, 19);
  const Q = new Painter(64, 32);
  Q.blit(g, 0, 0);
  puff(Q, 44, 7, 3); puff(Q, 48, 3, 2.2); puff(Q, 20, 9, 2);
  // 地面の破片
  Q.fill(Q.mask().rect(4, 29, 3, 2).union(Q.mask().rect(56, 30, 4, 1)), METAL, { sep: 'outline', flat: true });
  Q.outline();
  return Q.g;
}

// ---------------------------------------------------------------------
// 母艦 160×64。0〜1:浮かぶ、2:光線(下の砲口が光る)、3:落ちた
// ---------------------------------------------------------------------
const HULL: Ramp = [md(4, 4, 6), md(3, 3, 5), md(2, 2, 3)];
const HULL_TRIM: Ramp = [md(5, 2, 6), md(3, 1, 4), md(2, 0, 3)];

function mothershipBody(P: Painter, y0: number, lights: number, firing: boolean, broken: boolean): void {
  const cx = 80;
  // 上の塔
  const tower = P.mask().ellipse(cx, y0 + 10, 22, 10).intersect(P.mask().rect(0, 0, 160, y0 + 14));
  P.fill(tower, HULL, { sep: 'outline', hi: 0.3, lo: 0.75 });
  // 塔の窓
  for (let i = -3; i <= 3; i++) {
    const x = cx + i * 5;
    P.rect(x - 1, y0 + 6, 3, 3, broken ? DARK : GLITCH[i === lights % 3 - 1 ? 0 : 1]).px(x - 1, y0 + 6, broken ? DARK : GLITCH[0]);
  }
  P.fill(P.mask().ellipse(cx, y0 + 2, 6, 3).intersect(P.mask().rect(0, 0, 160, y0 + 3)), DOME, { sep: 'outline', hi: 0.4, lo: 0.8 });
  // 大きな円盤
  const disc = P.mask().ellipse(cx, y0 + 20, 76, 10);
  P.fill(disc, HULL[1], { sep: 'outline', flat: true });
  shadeDisc(P, disc, HULL, cx, y0 + 9, y0 + 20, 76);
  // 上の面のいちばん明るい帯
  disc.each((x, y) => { if (y === y0 + 12 && x > cx - 60 && x < cx - 10) P.px(x, y, DOME[0]); });
  // ふちの紫の帯と灯り
  for (let x = 6; x <= 154; x++) { if (disc.has(x, y0 + 20)) P.px(x, y0 + 20, HULL_TRIM[1]); if (disc.has(x, y0 + 21)) P.px(x, y0 + 21, HULL_TRIM[2]); }
  for (let i = 0; i < 14; i++) {
    const x = 10 + i * 11 + (lights % 2) * 5;
    if (!disc.has(x, y0 + 20)) continue;
    const c = broken ? HULL[2] : i % 2 === (lights % 2) ? LAMP_Y : GLITCH[1];
    P.px(x, y0 + 20, c).px(x + 1, y0 + 20, c);
  }
  // 板の継ぎ目
  for (const x of [30, 55, 105, 130]) P.line([x, y0 + 13], [x + (x < cx ? -3 : 3), y0 + 19], HULL[2]);
  // 下の砲口
  const gun = P.mask().ellipse(cx, y0 + 30, 14, 5).intersect(P.mask().rect(0, y0 + 28, 160, 10));
  P.fill(gun, HULL_TRIM, { sep: 'outline', hi: 0.3, lo: 0.7 });
  const mouth = P.mask().ellipse(cx, y0 + 33, 6, 2);
  if (firing && !broken) {
    P.fill(mouth, [WHITE, GLITCH[0], GLITCH[1]], { sep: 'outline', hi: 0.5, lo: 0.9 });
    // 光線の出はじめ(下へ広がる。つづきは fx で伸ばす)
    const beam = P.mask().poly([[cx - 5, y0 + 35], [cx + 5, y0 + 35], [cx + 9, 63], [cx - 9, 63]]);
    P.fill(beam, GLITCH[1], { sep: 'none', flat: true });
    P.fill(P.mask().poly([[cx - 2, y0 + 35], [cx + 2, y0 + 35], [cx + 4, 63], [cx - 4, 63]]), WHITE, { sep: 'none', flat: true });
    for (let y = y0 + 38; y < 63; y += 5) { P.px(cx - 7 - (y - y0) / 8, y, GLITCH[0]); P.px(cx + 7 + (y - y0) / 8, y, GLITCH[0]); }
  } else {
    P.fill(mouth, DARK, { sep: 'outline', flat: true });
    if (!broken) P.px(cx - 2, y0 + 33, GLITCH[2]).px(cx + 2, y0 + 33, GLITCH[2]);
  }
  if (broken) {
    // 大きな裂け目と、折れた塔
    P.fill(P.mask().poly([[52, y0 + 14], [60, y0 + 18], [56, y0 + 26], [48, y0 + 22]]), DARK, { sep: 'outline', flat: true });
    P.line([60, y0 + 18], [70, y0 + 22], OUTLINE).line([100, y0 + 16], [112, y0 + 24], OUTLINE).line([112, y0 + 24], [118, y0 + 19], OUTLINE);
    P.fill(P.mask().ellipse(118, y0 + 20, 8, 3).intersect(disc), HULL[2], { sep: 'none', flat: true });
  }
}

function mothership(state: 0 | 1 | 2 | 3): PixelGrid {
  const P = new Painter(160, 64);
  if (state < 3) {
    mothershipBody(P, state === 1 ? 5 : 4, state, state === 2, false);
    P.outline();
    return P.g;
  }
  mothershipBody(P, 22, 0, false, true);
  const g = tilt(P.g, 0.12, 80, 42, 80, 38);
  const Q = new Painter(160, 64);
  Q.blit(g, 0, 0);
  for (const [x, y, r] of [[56, 18, 4], [60, 12, 3], [64, 7, 2.2], [116, 20, 3.4], [112, 14, 2.4]] as const) puff(Q, x, y, r, HULL);
  Q.outline();
  return Q.g;
}

// ---------------------------------------------------------------------
// ガチャガチャ 24×32
// ---------------------------------------------------------------------
const GRED: Ramp = [md(7, 3, 3), md(6, 1, 1), md(4, 0, 1)];
const GLASS: Ramp = [md(6, 7, 7), md(4, 5, 6), md(3, 3, 5)];
const CAPS = [md(7, 6, 1), md(3, 5, 7), md(7, 3, 5), WHITE];

function capsule(P: Painter, x: number, y: number, i: number): void {
  P.px(x, y, CAPS[i % 4]).px(x + 1, y, CAPS[i % 4]).px(x, y + 1, WHITE).px(x + 1, y + 1, CAPS[(i + 3) % 4]);
}

function gacha(broken: boolean): PixelGrid {
  const P = new Painter(24, 32);
  // 台
  P.fill(P.mask().rect(3, 15, 18, 16), GRED, { sep: 'outline', hi: 0.25, lo: 0.75 });
  P.rect(3, 15, 18, 1, GRED[0]);
  // つまみと出口
  P.fill(P.mask().ellipse(11, 20, 3, 3), METAL, { sep: 'outline', hi: 0.4, lo: 0.8 });
  P.line([9, 20], [13, 20], METAL[2]);
  P.rect(8, 25, 7, 4, DARK).rect(8, 25, 7, 1, OUTLINE);
  if (!broken) {
    // まるいガラスの中のカプセル
    const glass = P.mask().ellipse(12, 8, 8, 7.5).intersect(P.mask().rect(0, 0, 24, 15));
    P.fill(glass, GLASS, { sep: 'outline', hi: 0.25, lo: 0.8 });
    for (const [x, y, i] of [[7, 10, 0], [10, 11, 1], [13, 10, 2], [16, 11, 3], [9, 8, 2], [12, 7, 0], [15, 8, 1], [6, 12, 1], [11, 13, 3], [14, 13, 0], [17, 13, 2]] as const) capsule(P, x, y, i);
    P.line([7, 4], [9, 2], WHITE).px(6, 6, WHITE);
    P.rect(4, 14, 16, 1, METAL[1]);
    P.px(12, 27, CAPS[1]).px(13, 27, CAPS[0]);
  } else {
    // ガラスが割れて、カプセルが床にちらばる
    P.rect(4, 14, 16, 1, METAL[1]);
    P.fill(P.mask().poly([[4, 14], [5, 8], [8, 11], [10, 6], [12, 10]]).union(P.mask().poly([[20, 14], [19, 9], [16, 12]])), GLASS, { sep: 'outline', hi: 0.3, lo: 0.8 });
    capsule(P, 9, 12, 0); capsule(P, 13, 12, 2);
    P.line([17, 8], [15, 5], WHITE);
    P.line([4, 20], [7, 23], OUTLINE).line([18, 17], [20, 21], OUTLINE);
    capsule(P, 0, 30, 1); capsule(P, 21, 30, 2);
    P.rect(8, 25, 7, 4, DARK);
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// マネキン 24×56(服を着た、顔のないマネキン)
// ---------------------------------------------------------------------
const MANNE: Ramp = [md(7, 7, 7), md(6, 6, 6), md(4, 4, 5)];
const DRESS: Ramp = [md(4, 5, 7), md(3, 3, 6), md(2, 2, 4)];

function mannequin(broken: boolean): PixelGrid {
  const P = new Painter(24, 56);
  // 台と棒
  P.fill(P.mask().ellipse(12, 53, 8, 2), DARKM, { sep: 'outline', hi: 0.3, lo: 0.7 });
  P.fill(P.mask().rect(11, 38, 2, 14), METAL, { sep: 'outline', flat: true });
  if (!broken) {
    // 頭と首
    P.fill(P.mask().ellipse(12, 5, 3.5, 4.2), MANNE, { sep: 'outline', hi: 0.4, lo: 0.75 });
    P.fill(P.mask().rect(11, 9, 2, 3), MANNE, { sep: 'outline', flat: true });
    // ワンピース
    P.fill(P.mask().poly([[7, 12], [17, 12], [16, 20], [19, 38], [5, 38], [8, 20]]), DRESS, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.line([9, 21], [15, 21], DRESS[2]);
    // 腕(片手を腰に)
    P.fill(P.mask().capsule([7, 14], [5, 24], 1.2).union(P.mask().capsule([5, 24], [6, 31], 1)), MANNE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.fill(P.mask().capsule([17, 14], [20, 20], 1.2).union(P.mask().capsule([20, 20], [16, 23], 1)), MANNE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.px(11, 3, WHITE);
  } else {
    // 倒れかけて、頭と腕が床に落ちた
    P.fill(P.mask().poly([[9, 26], [17, 22], [20, 30], [21, 40], [8, 40], [9, 32]]), DRESS, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.line([10, 32], [18, 29], DRESS[2]);
    P.fill(P.mask().rect(15, 20, 2, 3), MANNE, { sep: 'outline', flat: true });
    P.fill(P.mask().ellipse(4, 49, 3.5, 3.2), MANNE, { sep: 'outline', hi: 0.4, lo: 0.75 });
    P.fill(P.mask().capsule([14, 50], [22, 48], 1.1), MANNE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.line([4, 47], [5, 50], MANNE[2]);
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// ショーケース 32×32(ガラスの箱に、金の腕時計と指輪)
// ---------------------------------------------------------------------
const WOOD: Ramp = [md(5, 3, 2), md(4, 2, 1), md(2, 1, 1)];
const GOLDR: Ramp = [md(7, 7, 3), md(7, 5, 1), md(5, 3, 0)];

function showcase(broken: boolean): PixelGrid {
  const P = new Painter(32, 32);
  // 木の台
  P.fill(P.mask().rect(2, 18, 28, 13), WOOD[1], { sep: 'outline', flat: true });
  // 上の天板は明るく、右と下は暗い。前に2枚のへこんだ板(左上に影、右下に光)
  P.rect(2, 18, 28, 1, WOOD[0]).rect(2, 19, 1, 12, WOOD[0]).rect(29, 19, 1, 12, WOOD[2]).rect(2, 30, 28, 1, WOOD[2]);
  for (const px of [5, 17]) {
    P.rect(px, 21, 10, 7, WOOD[1]);
    P.rect(px, 21, 10, 1, WOOD[2]).rect(px, 21, 1, 7, WOOD[2]).rect(px, 28, 10, 1, WOOD[0]).rect(px + 10, 21, 1, 8, WOOD[0]);
  }
  // 中の台(紺のビロード)
  P.rect(3, 15, 26, 3, DRESS[2]);
  if (!broken) {
    // ガラスの箱
    P.fill(P.mask().rect(3, 4, 26, 11), GLASS[1], { sep: 'outline', flat: true });
    P.rect(3, 4, 26, 1, GLASS[0]);
    P.line([6, 13], [11, 6], GLASS[0]).line([8, 13], [12, 8], GLASS[0]).line([24, 12], [27, 7], GLASS[0]);
    // 金の腕時計と指輪
    P.rect(13, 12, 5, 3, GOLDR[1]).px(15, 13, WHITE).rect(14, 11, 3, 1, GOLDR[0]);
    P.fill(P.mask().ellipse(22, 13, 2, 1.6), GOLDR, { sep: 'outline', hi: 0.4, lo: 0.8 }).px(22, 13, DRESS[2]).px(22, 11, CAPS[2]);
    P.px(7, 14, GOLDR[0]).px(8, 14, GOLDR[1]);
  } else {
    // ガラスが割れて、とげだけ残る。時計は外へ落ちる
    P.fill(P.mask().poly([[3, 15], [3, 6], [7, 11], [9, 15]]).union(P.mask().poly([[29, 15], [29, 8], [24, 15]])).union(P.mask().poly([[14, 15], [17, 10], [19, 15]])), GLASS[1], { sep: 'outline', flat: true });
    P.line([4, 7], [6, 11], GLASS[0]);
    P.rect(3, 4, 3, 1, GLASS[0]).rect(26, 4, 3, 1, GLASS[0]);
    P.fill(P.mask().rect(20, 29, 5, 2), GOLDR, { sep: 'outline', flat: true });
    P.line([6, 20], [12, 25], OUTLINE).line([12, 25], [10, 29], OUTLINE);
    P.px(1, 30, GLASS[0]).px(29, 31, GLASS[0]).px(27, 30, GLASS[1]);
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// 噴水 64×40(まるい水盤と、まん中の柱から上がる水)
// ---------------------------------------------------------------------
const STONE: Ramp = [md(6, 6, 6), md(5, 5, 5), md(3, 3, 4)];
const WATER: Ramp = [md(6, 7, 7), md(3, 5, 7), md(2, 3, 6)];

function fountain(broken: boolean): PixelGrid {
  const P = new Painter(64, 40);
  // 水盤(ふちとへり)
  const basin = P.mask().ellipse(32, 30, 30, 8.5).intersect(P.mask().rect(0, 22, 64, 18)).union(P.mask().rect(2, 29, 60, 6));
  P.fill(basin, STONE, { sep: 'outline', hi: 0.25, lo: 0.7 });
  const pool = P.mask().ellipse(32, 29, 26, 5.5);
  if (!broken) {
    P.fill(pool, WATER, { sep: 'outline', hi: 0.3, lo: 0.8 });
    for (const x of [14, 26, 40, 50]) P.line([x, 28], [x + 3, 28], WATER[0]);
  } else {
    P.fill(pool, STONE[2], { sep: 'outline', flat: true });
    P.fill(P.mask().ellipse(24, 31, 8, 1.8), WATER[1], { sep: 'none', flat: true });
  }
  // へりの石の目地
  for (const x of [10, 22, 34, 46, 56]) P.line([x, 34], [x, 38], STONE[2]);
  if (!broken) {
    // 柱と上の皿
    P.fill(P.mask().rect(29, 12, 6, 16), STONE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.fill(P.mask().ellipse(32, 12, 9, 2.2), STONE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    // 上がる水としぶき
    P.fill(P.mask().capsule([32, 10], [32, 1], 1.2), WATER, { sep: 'outline', hi: 0.4, lo: 0.9 });
    const arc = (s: number) => { for (let i = 0; i <= 10; i++) { const x = 32 + s * (i * 1.6), y = 2 + (i * i) * 0.2; P.px(x, y, i % 3 ? WATER[1] : WATER[0]); } };
    arc(1); arc(-1);
    P.px(32, 0, WHITE);
    for (const [x, y] of [[14, 24], [50, 24], [20, 22], [44, 22]] as const) P.px(x, y, WATER[0]);
  } else {
    // 柱が折れて傾き、水がふき出して、水盤に割れ目
    P.fill(P.mask().rect(29, 20, 6, 8), STONE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.fill(P.mask().poly([[36, 14], [42, 12], [48, 24], [42, 26]]), STONE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    P.fill(P.mask().ellipse(49, 26, 7, 2), STONE, { sep: 'outline', hi: 0.3, lo: 0.7 });
    for (let i = 0; i < 9; i++) { P.px(31 - i, 18 - i + (i * i) * 0.12, WATER[1]); P.px(33 + (i % 3) - 1, 18 - i, WATER[0]); }
    P.line([12, 30], [16, 36], OUTLINE).line([16, 36], [14, 39], OUTLINE).line([52, 31], [48, 37], OUTLINE);
    P.fill(P.mask().rect(2, 38, 8, 2).union(P.mask().rect(54, 38, 9, 2)), WATER[1], { sep: 'none', flat: true });
  }
  P.outline();
  return P.g;
}

// ---------------------------------------------------------------------
// エスカレーター 96×64(左下から右上へ上がる。横から見た形)
// ---------------------------------------------------------------------
const RAIL = md(1, 1, 2);
const SIDE: Ramp = [md(6, 6, 7), md(4, 4, 5), md(3, 3, 4)];
const STEP: Ramp = [md(5, 5, 5), md(3, 3, 4), md(2, 2, 3)];

function escalator(broken: boolean): PixelGrid {
  const P = new Painter(96, 64);
  const lift = (x: number) => (x < 18 ? 0 : x > 78 ? 38 : (x - 18) * (38 / 60));
  const bend = (x: number, y: number): Pt => {
    if (!broken) return [x, y];
    // 真ん中が折れて下へたわむ
    const sag = Math.max(0, 14 - Math.abs(x - 50) * 0.5);
    return [x, y + sag];
  };
  // 下の本体(横の板)
  const body: Pt[] = [];
  for (let x = 2; x <= 94; x += 2) body.push(bend(x, 58 - lift(x)));
  for (let x = 94; x >= 2; x -= 2) body.push(bend(x, 62 - Math.max(0, lift(x) - 12)));
  const side = P.mask().poly(body);
  P.fill(side, SIDE[1], { sep: 'outline', flat: true });
  // 横の板:上のふちに光、下のふちの帯は影
  side.each((x, y) => {
    if (!side.has(x, y - 1) || !side.has(x, y - 2)) P.px(x, y, SIDE[0]);
    else if (!side.has(x, y + 1) || !side.has(x, y + 2) || !side.has(x, y + 3)) P.px(x, y, SIDE[2]);
  });
  // 段(上のふちのぎざぎざ)
  for (let x = 4; x < 92; x += 4) {
    const [px, py] = bend(x, 58 - lift(x));
    P.rect(px, py - 1, 4, 1, STEP[0]).rect(px, py, 4, 1, STEP[2]);
  }
  // ガラスの手すりの板
  const glass: Pt[] = [];
  for (let x = 6; x <= 90; x += 2) glass.push(bend(x, 57 - lift(x) - 1));
  for (let x = 90; x >= 6; x -= 2) glass.push(bend(x, 57 - lift(x) - 16));
  if (!broken) {
    P.fill(P.mask().poly(glass), GLASS[1], { sep: 'outline', flat: true });
    for (let x = 14; x < 86; x += 18) P.line(bend(x, 54 - lift(x)), bend(x + 6, 44 - lift(x + 6)), GLASS[0]);
  } else {
    // ガラスは割れて、両はしにぎざぎざに残る
    const m = P.mask().poly(glass);
    const keep = P.mask();
    m.each((x, y) => { if (x < 20 + (y % 5) * 2 || x > 80 - ((y * 3) % 7)) keep.set(x, y); });
    P.fill(keep, GLASS[1], { sep: 'outline', flat: true });
    // 床に落ちたガラスのかけら
    for (const [x, y] of [[26, 62], [37, 63], [58, 62], [70, 63]] as const) P.px(x, y, GLASS[0]).px(x + 1, y, GLASS[1]);
  }
  // 黒い手すり(上のふち)
  for (let x = 4; x <= 92; x++) {
    if (broken && x > 46 && x < 52) continue;
    const [px, py] = bend(x, 57 - lift(x) - 17);
    P.px(px, py, RAIL).px(px, py + 1, RAIL);
  }
  // 乗り口と降り口の床の板
  P.fill(P.mask().rect(0, 58, 14, 4), METAL, { sep: 'outline', hi: 0.3, lo: 0.7 });
  P.fill(P.mask().rect(82, 20, 14, 4), METAL, { sep: 'outline', hi: 0.3, lo: 0.7 });
  if (broken) {
    // 折れた手すりの先、落ちた段
    P.line(bend(46, 57 - lift(46) - 17), bend(44, 57 - lift(46) - 8), RAIL);
    P.line(bend(52, 57 - lift(52) - 17), bend(55, 57 - lift(52) - 9), RAIL);
    P.fill(P.mask().rect(30, 60, 5, 3).union(P.mask().rect(62, 61, 6, 2)), STEP, { sep: 'outline', flat: true });
    P.line(bend(40, 56 - lift(40)), bend(44, 62 - lift(44)), OUTLINE);
  }
  P.outline();
  return P.g;
}

export function buildProps3(): Record<string, PixelGrid[][]> {
  const four = (f: (s: 0 | 1 | 2 | 3) => PixelGrid): PixelGrid[][] => [[f(0), f(1), f(2), f(3)]];
  return {
    prop_ufo: four(ufo),
    prop_mothership: four(mothership),
    prop_gacha: [[gacha(false), gacha(true)]],
    prop_mannequin: [[mannequin(false), mannequin(true)]],
    prop_showcase: [[showcase(false), showcase(true)]],
    prop_fountain: [[fountain(false), fountain(true)]],
    prop_escalator: [[escalator(false), escalator(true)]]
  };
}
