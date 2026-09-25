// ステージ4の物:ソファ(階ごとの色の4コマ。壊れない)、観葉植物、花のかざり、コピー機、水槽、ワインの棚、
// シャンパンタワー、ピアノ(ふつうと壊れた)、シャンデリア(ふつう、念力で浮く、落ちて壊れた)と、仕分けの画面の机。
// 置くときの基準はコマの下の真ん中(シャンデリアだけは上の真ん中)。見本は mocks/stage4_src/scenes.ts。
import { md, OUTLINE, PixelGrid } from '../lib';
import { Painter, type Pt, type Ramp, rotateGrid } from '../world/pix';
import { GOLD, WHITE } from '../world/palette';
import { hash } from '../world/wrap';
import { sprite } from './people';
import { PSY } from './palette';

const W0 = WHITE[0];
const GOLDR: Ramp = [GOLD[0], GOLD[1], GOLD[2]];
const LEAF: Ramp = [md(3, 6, 2), md(2, 4, 1), md(1, 2, 1)];
const WOOD: Ramp = [md(6, 4, 2), md(5, 3, 1), md(3, 2, 1)];
const STONE: Ramp = [md(6, 6, 6), md(5, 5, 6), md(4, 4, 5)];
const GLASS = md(6, 7, 7);
const FIZZ = md(7, 6, 2);
const LIT = md(7, 7, 6), FLAME = md(7, 6, 2);

/** ふちを付けて、格子を返す */
const done = (P: Painter): PixelGrid => { P.outline(); return P.g; };

/** 床に散らばる小さなかけら(2ドット) */
function shards(P: Painter, pts: [number, number][], c: string, c2 = c): void {
  for (const [x, y] of pts) P.px(x, y, c).px(x + 1, y, c2);
}

// ---------------------------------------------------------------------
// ソファ 48×24。4コマは階ごとの色(灰色、紺、茶色、赤)。壊れない
// ---------------------------------------------------------------------
const SOFA: Ramp[] = [
  [md(5, 5, 5), md(4, 4, 4), md(3, 3, 3)],
  [md(2, 3, 5), md(1, 2, 4), md(1, 1, 3)],
  [md(5, 3, 2), md(4, 2, 1), md(2, 1, 1)],
  [md(6, 1, 2), md(5, 0, 1), md(3, 0, 1)]
];
const SOFA_LEG = md(2, 1, 0);

function sofa(k: number): PixelGrid {
  const P = new Painter(48, 24);
  const c = SOFA[k];
  // 脚
  for (const x of [5, 40]) P.rect(x, 21, 3, 2, SOFA_LEG);
  // 背もたれ(奥)、座面、ひじかけ(両はし)
  P.fill(P.mask().rect(6, 4, 36, 10), c, { sep: 'outline', hi: 0.3, lo: 0.8 });
  // 背もたれのボタン(ふかふかのくぼみ)
  for (let x = 11; x < 40; x += 8) P.px(x, 8, c[2]).px(x + 4, 11, c[2]);
  P.fill(P.mask().rect(6, 13, 36, 8), c, { sep: 'outline', hi: 0.35, lo: 0.75 });
  P.rect(7, 13, 34, 1, c[0]);
  // 座面のクッションの切れ目
  P.line([18, 14], [18, 20], c[2]).line([30, 14], [30, 20], c[2]);
  for (const x0 of [1, 40]) {
    const arm = P.mask().rect(x0, 9, 7, 12).union(P.mask().ellipse(x0 + 3, 9, 3.5, 2.5));
    P.fill(arm, c, { sep: 'outline', hi: 0.35, lo: 0.7 });
  }
  return done(P);
}

// ---------------------------------------------------------------------
// 観葉植物 24×44(1階、18階)
// ---------------------------------------------------------------------
const POT: Ramp = [STONE[0], STONE[1], STONE[2]];

function leaves(P: Painter, cx: number, cy: number, n: number, seed: number, spread = 1): void {
  for (let i = 0; i < n; i++) {
    const a = hash(i, 1, seed) * Math.PI - Math.PI;
    const r = 4 + hash(i, 2, seed) * 11 * spread;
    const x = cx + Math.cos(a) * r * 0.8, y = cy + Math.sin(a) * r * 1.3;
    P.fill(P.mask().ellipse(x, y, 2.4, 1.5), LEAF, { sep: 'dark', hi: 0.4, lo: 0.7 });
  }
}

function plant(broken: boolean): PixelGrid {
  const P = new Painter(24, 44);
  if (!broken) {
    P.fill(P.mask().poly([[4, 30], [19, 30], [17, 43], [6, 43]]), POT, { hi: 0.3, lo: 0.7 });
    P.rect(4, 30, 16, 2, POT[0]);
    leaves(P, 12, 22, 40, 7);
    P.line([12, 30], [12, 18], WOOD[2]);
    return done(P);
  }
  // 鉢が割れて横に倒れ、土がこぼれる
  P.fill(P.mask().poly([[2, 43], [5, 34], [9, 36], [8, 43]]), POT, { hi: 0.3, lo: 0.7 });
  P.fill(P.mask().poly([[13, 43], [15, 37], [21, 39], [22, 43]]), POT, { hi: 0.3, lo: 0.7 });
  P.fill(P.mask().ellipse(12, 42, 6, 1.6), WOOD[2], { sep: 'none', flat: true });
  leaves(P, 12, 38, 16, 9, 0.5);
  P.line([7, 40], [17, 36], WOOD[2]);
  shards(P, [[0, 43], [22, 42]], POT[1]);
  return done(P);
}

// ---------------------------------------------------------------------
// 花のかざり 26×50(1階)。金の台に白い花びん、色とりどりの花
// ---------------------------------------------------------------------
const FLOWERS = [md(7, 3, 4), md(7, 6, 2), W0, md(5, 4, 7), LEAF[1]];

function flowerBunch(P: Painter, cx: number, cy: number, w: number, h: number, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + hash(i, 1, seed) * w, y = cy - h / 2 + hash(i, 2, seed) * h;
    P.fill(P.mask().ellipse(x, y, 1.6, 1.6), FLOWERS[i % 5], { sep: 'outline' });
  }
}

function flowers(broken: boolean): PixelGrid {
  const P = new Painter(26, 50);
  if (!broken) {
    P.fill(P.mask().rect(10, 26, 6, 22).union(P.mask().rect(6, 46, 14, 3)), GOLDR, { hi: 0.3, lo: 0.7 });
    P.fill(P.mask().ellipse(13, 22, 6, 5), [W0, STONE[1], STONE[2]], { hi: 0.35, lo: 0.7 });
    flowerBunch(P, 13, 10, 20, 16, 30, 3);
    return done(P);
  }
  // 台が曲がって倒れ、花びんが割れて、花が床に散る
  P.fill(P.mask().poly([[6, 46], [20, 46], [20, 49], [6, 49]]), GOLDR, { hi: 0.3, lo: 0.7 });
  P.fill(P.mask().poly([[10, 46], [15, 46], [21, 30], [17, 29]]), GOLDR, { hi: 0.3, lo: 0.7 });
  P.fill(P.mask().poly([[1, 49], [3, 43], [7, 45], [6, 49]]), [W0, STONE[1], STONE[2]], { hi: 0.35, lo: 0.7 });
  P.fill(P.mask().poly([[20, 49], [22, 44], [25, 47], [25, 49]]), [W0, STONE[1], STONE[2]], { hi: 0.35, lo: 0.7 });
  flowerBunch(P, 13, 45, 22, 6, 12, 5);
  shards(P, [[9, 49], [16, 49]], W0, STONE[2]);
  return done(P);
}

// ---------------------------------------------------------------------
// コピー機 32×32(18階)。灰色の箱、ふた、紙の出口、操作の板
// ---------------------------------------------------------------------
const COPIER: Ramp = [md(6, 6, 6), md(5, 5, 5), md(3, 3, 4)];
const PANEL = md(2, 3, 5), SCREEN = md(4, 6, 7), GO_BTN = md(3, 6, 2);

function copier(broken: boolean): PixelGrid {
  const P = new Painter(32, 32);
  // 本体と引き出し
  P.fill(P.mask().rect(3, 12, 24, 19), COPIER, { hi: 0.25, lo: 0.8 });
  for (const y of [20, 25]) P.rect(4, y, 22, 1, COPIER[2]).rect(13, y + 2, 4, 1, COPIER[2]);
  // 足の車
  P.rect(4, 30, 2, 1, OUTLINE).rect(24, 30, 2, 1, OUTLINE);
  if (!broken) {
    // ふた(上)と、左の紙の出口の受け皿と紙
    P.fill(P.mask().rect(3, 8, 24, 4), COPIER, { hi: 0.4, lo: 0.8 });
    P.fill(P.mask().rect(27, 14, 4, 2), COPIER, { flat: true });
    P.fill(P.mask().rect(27, 12, 4, 2), W0, { sep: 'outline', flat: true });
    // 操作の板(画面とボタン)
    P.fill(P.mask().rect(16, 5, 10, 3), PANEL, { sep: 'outline', flat: true });
    P.rect(17, 6, 4, 1, SCREEN).px(23, 6, GO_BTN).px(24, 6, W0);
    // 中からのぞく光(コピーの光)
    P.rect(5, 12, 20, 1, LIT);
    return done(P);
  }
  // ふたが外れて横へずれ、中から紙が飛び散り、煙が出る
  P.fill(P.mask().poly([[0, 11], [16, 5], [18, 8], [2, 14]]), COPIER, { hi: 0.4, lo: 0.8 });
  P.fill(P.mask().rect(17, 8, 9, 3), PANEL, { sep: 'outline', flat: true });
  P.rect(18, 9, 3, 1, OUTLINE);
  P.fill(P.mask().ellipse(22, 4, 4, 3).union(P.mask().ellipse(26, 2, 3, 2)), [COPIER[0], COPIER[1], COPIER[2]], { sep: 'none', hi: 0.4, lo: 0.8 });
  for (const [x, y, t] of [[1, 24, 0], [27, 27, 1], [28, 18, 0]] as const) sprite(P, x, y, t ? ['www', 'ww.'] : ['ww', 'ww'], { w: W0 });
  P.line([8, 16], [12, 22], OUTLINE).line([12, 22], [10, 28], OUTLINE);
  return done(P);
}

// ---------------------------------------------------------------------
// 水槽 40×32(35階)。黒い台の上のガラスの箱。水、魚、水草、泡
// ---------------------------------------------------------------------
const WATER: Ramp = [md(4, 6, 7), md(2, 4, 6), md(1, 2, 4)];
const FISH = [md(7, 4, 1), md(7, 6, 2)];
const CABINET: Ramp = [md(2, 2, 3), md(1, 1, 2), OUTLINE];

function tank(broken: boolean): PixelGrid {
  const P = new Painter(40, 32);
  // 台
  P.fill(P.mask().rect(3, 22, 34, 9), CABINET, { hi: 0.2, lo: 0.8 });
  P.rect(3, 22, 34, 1, WATER[2]).line([20, 24], [20, 29], OUTLINE);
  if (!broken) {
    // ガラスの箱と水
    P.fill(P.mask().rect(2, 3, 36, 18), WATER, { hi: 0.2, lo: 0.8 });
    P.rect(2, 3, 36, 2, WATER[0]);
    P.rect(2, 3, 36, 1, GLASS);
    // 水草と石
    for (const x of [6, 9, 31]) P.line([x, 20], [x + (x % 2 ? 1 : -1), 12], LEAF[1]).px(x, 14, LEAF[0]);
    P.rect(14, 19, 5, 2, STONE[2]).rect(15, 18, 3, 1, STONE[1]);
    // 魚(オレンジと黄色)
    sprite(P, 18, 9, ['.oo.o', 'oWooo', '.oo.o'], { o: FISH[0], W: OUTLINE });
    sprite(P, 26, 14, ['yy.y', 'yyyy', 'yy.y'], { y: FISH[1] });
    // 泡とガラスの光
    P.px(12, 8, GLASS).px(13, 6, GLASS).px(12, 11, GLASS);
    P.line([4, 16], [8, 6], GLASS);
    // ふた
    P.fill(P.mask().rect(1, 1, 38, 2), CABINET, { flat: true });
    return done(P);
  }
  // ガラスが割れて、水が台と床に流れ、魚がはねる
  P.fill(P.mask().poly([[2, 21], [2, 10], [6, 14], [9, 21]]).union(P.mask().poly([[38, 21], [38, 6], [33, 13], [31, 21]])), WATER, { hi: 0.2, lo: 0.8 });
  P.line([2, 10], [6, 14], GLASS).line([38, 6], [33, 13], GLASS);
  P.fill(P.mask().rect(9, 18, 22, 3), WATER[2], { sep: 'outline', flat: true });
  P.line([12, 20], [14, 20], LEAF[1]);
  // 床の水たまり
  P.fill(P.mask().ellipse(20, 31, 19, 1.4), WATER[1], { sep: 'none', flat: true });
  P.fill(P.mask().rect(35, 23, 3, 8), WATER[1], { sep: 'none', flat: true });
  sprite(P, 6, 28, ['.oo.o', 'ooooo', '.oo.o'], { o: FISH[0] });
  sprite(P, 28, 26, ['y.yy.', 'yyyyy'], { y: FISH[1] });
  shards(P, [[12, 16], [26, 17], [34, 30]], GLASS, WATER[0]);
  return done(P);
}

// ---------------------------------------------------------------------
// ワインの棚 32×48(35階)。木の棚に、横に寝かせたびんが並ぶ
// ---------------------------------------------------------------------
const BOTTLE = [md(2, 4, 2), md(4, 1, 1)];
const WINE_RED = md(5, 0, 1);

function wine(broken: boolean): PixelGrid {
  const P = new Painter(32, 48);
  if (!broken) {
    P.fill(P.mask().rect(2, 2, 28, 45), WOOD, { hi: 0.15, lo: 0.85 });
    // 中の暗いところと、ます目の棚
    P.rect(4, 4, 24, 41, OUTLINE);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      const x = 5 + c * 6, y = 5 + r * 8;
      P.rect(x, y, 5, 7, WOOD[2]);
      // びんの底(丸)。色は緑と赤をまぜる
      const col = BOTTLE[(r + c) % 2];
      if (hash(r, c, 3) > 0.12) P.rect(x + 1, y + 2, 3, 3, col).px(x + 1, y + 2, GLASS);
    }
    for (let r = 0; r <= 5; r++) P.rect(4, 4 + r * 8, 24, 1, WOOD[1]);
    for (let c = 0; c <= 4; c++) P.rect(4 + c * 6, 4, 1, 41, WOOD[1]);
    P.rect(2, 2, 28, 1, WOOD[0]);
    return done(P);
  }
  // 棚が傾いて崩れ、びんが割れて赤いワインが床に広がる
  const rack = new Painter(32, 48);
  rack.fill(rack.mask().rect(2, 2, 28, 45), WOOD, { hi: 0.15, lo: 0.85 });
  rack.rect(4, 4, 24, 41, OUTLINE);
  for (let r = 0; r <= 5; r++) rack.rect(4, 4 + r * 8, 24, 1, WOOD[1]);
  for (let c = 0; c <= 4; c++) rack.rect(4 + c * 6, 4, 1, 41, WOOD[1]);
  rack.px(10, 30, BOTTLE[0]).px(11, 30, BOTTLE[0]).px(22, 38, BOTTLE[1]);
  P.blit(rack.g, 0, 0);
  // 棚板が折れて、ななめにずり落ちる(びんは床に落ちて空っぽ)
  P.line([5, 14], [27, 30], WOOD[0]).line([5, 15], [27, 31], WOOD[2]);
  P.line([4, 30], [14, 44], WOOD[0]);
  P.line([20, 4], [23, 12], OUTLINE).line([23, 12], [21, 18], OUTLINE);
  P.fill(P.mask().ellipse(16, 46, 15, 1.6), WINE_RED, { sep: 'none', flat: true });
  for (const [x, y, c] of [[3, 44, 0], [22, 45, 1], [27, 43, 0]] as const) sprite(P, x, y, ['bbb.', '.bbg'], { b: BOTTLE[c], g: GLASS });
  return done(P);
}

// ---------------------------------------------------------------------
// シャンパンタワー 40×48(最上階)。白いクロスのテーブルに、グラスの4段のピラミッド
// ---------------------------------------------------------------------
function glass(P: Painter, x: number, y: number): void {
  sprite(P, Math.round(x), Math.round(y), ['g.g', 'ygy', '.g.', 'ggg'], { g: GLASS, y: FIZZ });
}

function champagne(broken: boolean): PixelGrid {
  const P = new Painter(40, 48);
  const cloth = P.mask().poly([[2, 28], [37, 28], [39, 47], [0, 47]]);
  P.fill(cloth, [W0, STONE[1], STONE[2]], { hi: 0.25, lo: 0.75 });
  for (let x = 3; x < 38; x += 6) P.line([x, 30], [x - 1, 46], STONE[1]);
  P.rect(1, 28, 38, 1, W0);
  if (!broken) {
    for (let row = 0; row < 4; row++) {
      const n = 4 - row;
      for (let i = 0; i < n; i++) glass(P, 20 - n * 2.5 + i * 5 - 1, 23 - row * 5);
    }
    // いちばん上のあふれる泡
    P.px(19, 6, FIZZ).px(21, 5, W0);
    return done(P);
  }
  // グラスが崩れて、下の段だけ残る。テーブルに割れたかけらとこぼれた泡
  for (let i = 0; i < 3; i++) glass(P, 9 + i * 8, 23);
  shards(P, [[4, 27], [14, 26], [26, 27], [33, 26], [8, 46], [30, 46]], GLASS, FIZZ);
  P.fill(P.mask().ellipse(20, 29, 12, 1), FIZZ, { sep: 'none', flat: true });
  P.line([6, 34], [12, 40], STONE[2]);
  return done(P);
}

// ---------------------------------------------------------------------
// ピアノ 62×44(最上階)。黒いグランドピアノ。ふたが開いている
// ---------------------------------------------------------------------
const PIANO: Ramp = [md(3, 3, 4), md(1, 1, 2), OUTLINE];
const PIANO_HI = md(4, 4, 5);

function pianoBody(P: Painter, lidOpen: boolean): void {
  const body = P.mask().poly([[2, 14], [44, 10], [58, 16], [58, 26], [2, 28]]);
  P.fill(body, [md(2, 2, 3), PIANO[1], OUTLINE], { hi: 0.25, lo: 0.8 });
  if (lidOpen) {
    P.fill(P.mask().poly([[6, 12], [40, 0], [44, 2], [48, 11]]), PIANO, { hi: 0.4, lo: 0.8 });
    P.line([20, 13], [30, 5], GOLD[2]);
  }
  // けん盤
  P.rect(3, 24, 20, 3, W0);
  for (let x = 4; x < 23; x += 2) P.px(x, 24, OUTLINE);
  P.rect(4, 26, 50, 1, GOLD[1]);
  P.line([46, 18], [54, 18], PIANO_HI);
}

function piano(broken: boolean): PixelGrid {
  const P = new Painter(62, 44);
  if (!broken) {
    pianoBody(P, true);
    for (const x of [6, 30, 52]) P.fill(P.mask().rect(x, 28, 3, 14), [md(2, 2, 3), PIANO[1], OUTLINE]);
    P.rect(28, 42, 7, 1, GOLD[2]);
    return done(P);
  }
  // 脚が折れて前へ傾き、ふたが割れて落ち、けん盤が飛び散る
  const B = new Painter(62, 44);
  pianoBody(B, false);
  for (const x of [30, 52]) B.fill(B.mask().rect(x, 28, 3, 14), [md(2, 2, 3), PIANO[1], OUTLINE]);
  B.outline();
  P.blit(rotateGrid(B.g, -0.22, 54, 42, 56, 43), 0, 0);
  P.fill(P.mask().poly([[26, 43], [30, 37], [48, 35], [46, 43]]), PIANO, { hi: 0.4, lo: 0.8 });
  P.line([34, 39], [40, 43], GOLD[2]);
  P.fill(P.mask().rect(2, 40, 3, 3), [md(2, 2, 3), PIANO[1], OUTLINE]);
  for (const [x, y] of [[8, 42], [14, 43], [19, 41], [55, 43]] as const) P.px(x, y, W0).px(x + 1, y, W0);
  return done(P);
}

// ---------------------------------------------------------------------
// シャンデリア 56×34。0:ふつう、1:念力で浮く(炎が紫)、2:落ちて壊れた
// ---------------------------------------------------------------------
function chandelierArt(psy: boolean): PixelGrid {
  const P = new Painter(56, 34);
  if (!psy) P.rect(27, 0, 2, 8, GOLD[2]);
  else P.rect(27, 2, 2, 6, GOLD[2]);
  // 3段の輪
  for (const [y, rx] of [[10, 10], [17, 18], [24, 25]] as const) {
    P.fill(P.mask().ellipse(28, y, rx, 2.2), GOLDR, { hi: 0.4, lo: 0.7 });
    // ろうそくと炎
    for (let x = 28 - rx + 2; x <= 28 + rx - 2; x += 6) {
      P.rect(x, y - 5, 2, 4, W0);
      const [a, b] = psy ? [PSY[1], PSY[0]] : [FLAME, LIT];
      P.px(x, y - 7, a).px(x + 1, y - 6, b).px(x, y - 6, b);
    }
    // しずくのかざり
    for (let x = 28 - rx; x <= 28 + rx; x += 4) P.px(x, y + 3, GLASS).px(x, y + 4, W0);
  }
  P.fill(P.mask().ellipse(28, 30, 3, 3), GOLDR);
  P.outline();
  if (psy) {
    // 念力:形のまわりを紫で1ドットふちどる(ふち色の外側)
    const g = P.g;
    const add: Pt[] = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.get(x, y)) continue;
      if (g.get(x - 1, y) || g.get(x + 1, y) || g.get(x, y - 1) || g.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) g.px(x, y, (x + y) % 3 === 0 ? PSY[0] : PSY[1]);
  }
  return P.g;
}

function chandelierBroken(): PixelGrid {
  const P = new Painter(56, 34);
  // 床にくずれ落ちた輪(平たくつぶれる)。上の真ん中を基準に置くので、落ちた場所ではコードで下へずらす
  P.fill(P.mask().ellipse(28, 29, 25, 2.4), GOLDR, { hi: 0.4, lo: 0.7 });
  P.fill(P.mask().poly([[10, 27], [22, 20], [26, 22], [14, 29]]), GOLDR, { hi: 0.4, lo: 0.7 });
  P.fill(P.mask().poly([[34, 22], [46, 24], [44, 27], [33, 25]]), GOLDR, { hi: 0.4, lo: 0.7 });
  for (const [x, y] of [[16, 25], [24, 21], [38, 24]] as const) P.rect(x, y, 2, 3, W0);
  shards(P, [[3, 32], [12, 32], [20, 33], [31, 33], [40, 32], [50, 33], [8, 30], [46, 30]], GLASS, W0);
  // 折れた鎖が横に落ちている
  P.line([30, 26], [36, 23], GOLD[2]);
  return done(P);
}

// ---------------------------------------------------------------------
// 仕分けの画面の机 40×32(天板と前の板)
// ---------------------------------------------------------------------
function desk(): PixelGrid {
  const P = new Painter(40, 32);
  P.fill(P.mask().rect(1, 3, 38, 5), WOOD, { hi: 0.3, lo: 0.8 });
  P.rect(1, 3, 38, 1, WOOD[0]);
  P.fill(P.mask().rect(3, 8, 34, 23), WOOD[2], { flat: true });
  P.rect(3, 8, 34, 1, md(2, 1, 1)).rect(3, 9, 1, 22, WOOD[1]).rect(36, 9, 1, 22, md(2, 1, 1));
  // 引き出しと取っ手
  for (const y of [11, 19]) {
    P.rect(22, y, 13, 7, WOOD[1]).rect(22, y, 13, 1, WOOD[0]).rect(22, y + 6, 13, 1, md(2, 1, 1));
    P.rect(27, y + 3, 3, 1, GOLD[1]);
  }
  return done(P);
}

// ---------------------------------------------------------------------
// エレベーターの扉の1枚 15×114(銀の板。右はしに合わせ目の影、上下に細い溝)
// ---------------------------------------------------------------------
const STEEL: Ramp = [md(6, 6, 6), md(5, 5, 5), md(3, 3, 4)];

function liftDoor(): PixelGrid {
  const g = new PixelGrid(15, 114);
  g.rect(0, 0, 15, 114, STEEL[1]);
  g.rect(0, 0, 2, 114, STEEL[0]).rect(13, 0, 1, 114, STEEL[2]).rect(14, 0, 1, 114, OUTLINE);
  g.rect(0, 0, 15, 1, OUTLINE).rect(0, 113, 15, 1, OUTLINE);
  // 映りこみ(ななめの光)と、腰の高さの溝
  for (let i = 0; i < 8; i++) g.px(4 + i * 0.6, 30 - i, STEEL[0]).px(5 + i * 0.6, 34 - i, STEEL[0]);
  g.rect(2, 86, 11, 1, STEEL[2]).rect(2, 87, 11, 1, STEEL[0]);
  return g;
}

export function buildProps4(): Record<string, PixelGrid[][]> {
  const two = (f: (b: boolean) => PixelGrid): PixelGrid[][] => [[f(false), f(true)]];
  return {
    prop_sofa: [[sofa(0), sofa(1), sofa(2), sofa(3)]],
    prop_plant: two(plant),
    prop_flowers: two(flowers),
    prop_copier: two(copier),
    prop_tank: two(tank),
    prop_wine: two(wine),
    prop_champagne: two(champagne),
    prop_piano: two(piano),
    prop_chandelier: [[chandelierArt(false), chandelierArt(true), chandelierBroken()]],
    tw_desk: [[desk()]],
    tw_lift_door: [[liftDoor()]]
  };
}
