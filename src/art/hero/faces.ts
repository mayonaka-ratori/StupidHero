// 顔のカットイン(32×32、胸から上)。各行が表情、左が口を閉じ、右が口を開ける。
import { md, OUTLINE, PixelGrid } from '../lib';
import { BLUE, HAIR, RED, SKIN, WHITE, type Ramp } from './palette';
import { ellipse, line, poly, type Pt } from './shapes';
import { stamp } from './sprite';

const S = 32;

// ---------- 目と口の部品(文字の表) ----------
// o=ふち、w=白、I=瞳の明るい色、i=瞳の色、a=肌、b=肌の影、d=口の中、t=舌、s=汗

type Parts = Record<string, readonly string[]>;

const EYES: Parts = {
  // 4×4(1行目はまつ毛)
  open: ['oooo', 'wIio', 'wiow', '.ww.'],
  look: ['oooo', 'wwIi', 'wwio', '.ww.'],
  wide: ['oooo', 'wwww', 'wwow', '.ww.'],
  half: ['....', 'oooo', 'wIio', '.ww.'],
  flat: ['....', 'oooo', 'owwo', '....'],
  happy: ['....', '.oo.', 'o..o', '....'],
  squeezeL: ['oo..', '..oo', 'oo..', '....'],
  squeezeR: ['..oo', 'oo..', '..oo', '....'],
  shine: ['oooo', 'wIwo', 'wiIw', '.ww.']
};

const MOUTHS: Parts = {
  smile: ['o...o', '.ooo.'],
  grin: ['ooooo', 'owwwo', '.odo.', '..o..'],
  smirk: ['....o', '.ooo.'],
  smirkOpen: ['...oo', 'oooo.', 'odwo.', '.oo..'],
  wavy: ['.o.o.', 'o.o.o'],
  wail: ['.ooo.', 'odddo', 'oddto', '.ooo.'],
  flat: ['.ooo.'],
  flatOpen: ['.ooo.', 'oddo.', '.oo..'],
  small: ['.oo.'],
  talk: ['.ooo.', 'oddo', '.oo.'],
  yell: ['ooooo', 'owwwo', 'odddo', 'oddto', '.ooo.'],
  bigSmile: ['ooooo', 'owwwo', 'odddo', '.ooo.']
};

type FaceKeys = Record<'o' | 'w' | 'I' | 'i' | 'a' | 'b' | 'd' | 't' | 's', string> & Record<string, string>;

// ---------- ヒーロー ----------

const HERO_KEYS = (): FaceKeys => ({ o: OUTLINE, w: WHITE, I: BLUE[0], i: BLUE[1], a: SKIN[0], b: SKIN[1], d: RED[2], t: RED[0], s: WHITE });

interface Expr {
  eyeL: string;
  eyeR: string;
  mouth: [string, string];
  /** マスクの上のふちの傾き(+でつり上がる、-で困り眉) */
  brow: number;
  sweat?: boolean;
  /** 頭のずらし(ノリノリで弾むなど) */
  dy?: number;
  blush?: boolean;
  /** こぶしを上げる(ノリノリ) */
  fist?: boolean;
}

const HERO_EXPR: Expr[] = [
  { eyeL: 'smug', eyeR: 'smug', mouth: ['smirk', 'smirkOpen'], brow: 1 }, // ドヤ顔
  { eyeL: 'squeeze', eyeR: 'squeeze', mouth: ['wavy', 'wail'], brow: -2, sweat: true }, // やっちまった
  { eyeL: 'happy', eyeR: 'happy', mouth: ['smile', 'bigSmile'], brow: 0, blush: true } // 笑顔
];

/** ヒーローのマスクの白いレンズ(5×4)。[左目, 右目] */
const LENS: Record<string, [string[], string[]]> = {
  normal: [['.www.', 'wwwww', 'wwww.', '.ww..'], ['.www.', 'wwwww', '.wwww', '..ww.']],
  smug: [['.....', 'wwww.', 'wwwww', '..ww.'], ['.....', '.wwww', 'wwwww', '.ww..']],
  squeeze: [['ww...', '.www.', '...ww', '.www.'], ['...ww', '.www.', 'ww...', '.www.']],
  happy: [['.....', '.www.', 'ww.ww', 'w...w'], ['.....', '.www.', 'ww.ww', 'w...w']]
};

function shade(r: Ramp, x: number, y: number, cx: number, cy: number, rx: number, ry: number): string {
  // 左上が明るく、右下が暗い
  const k = ((x + 0.5 - cx) / rx) * 0.7 + ((y + 0.5 - cy) / ry) * 0.7;
  return k < -0.45 ? r[0] : k > 0.55 ? r[2] : r[1];
}

function drawHeroFace(e: Expr, open: boolean): PixelGrid {
  const g = new PixelGrid(S, S);
  const K = HERO_KEYS();
  const dy = e.dy ?? 0;

  // ポニーテール(奥)
  const tail: Pt[] = [[8, 6], [5, 7], [3, 10], [2, 14], [2.5, 18], [4, 21]];
  tail.forEach((p, i) => {
    if (i === 0) return;
    const r = 3.2 - i * 0.4;
    line(g, [tail[i - 1][0], tail[i - 1][1] + dy], [p[0], p[1] + dy], r, (x, y) => shade(HAIR, x, y, 4, 12 + dy, 4, 8));
  });
  // マントの肩(奥)
  poly(g, [[0, 32], [0, 27], [4, 24], [9, 24], [7, 32]], (x, y) => shade(RED, x, y, 3, 28, 5, 5));
  poly(g, [[32, 32], [32, 27], [28, 24], [23, 24], [25, 32]], (x, y) => shade(RED, x, y, 29, 27, 5, 5));
  // 胴
  poly(g, [[3, 32], [4, 28], [8, 25.5], [14, 24.5], [22, 24.5], [26, 25.5], [29, 28], [30, 32]],
    (x, y) => shade(BLUE, x, y, 16, 29, 12, 5));
  // 首
  poly(g, [[14.5, 20], [21, 20], [20.5, 26.5], [18, 27.5], [15, 26.5]], (x, y) => (y < 23 + dy ? SKIN[2] : x < 16 ? SKIN[1] : SKIN[1]));
  // 胸の星
  stamp(g, ['..1..', '11111', '.121.', '.2.2.'], { 1: HAIR[0], 2: HAIR[1] }, 15, 28);
  // マントの留め金
  ellipse(g, 7.5, 26.5, 1.3, 1.3, HAIR[1]);
  ellipse(g, 25.5, 26.5, 1.3, 1.3, HAIR[2]);
  g.px(7, 26, HAIR[0]);

  // 後ろ髪
  ellipse(g, 16, 12 + dy, 10.5, 10.5, (x, y) => (y > 19 + dy ? null : shade(HAIR, x, y, 15, 10 + dy, 10, 10)));
  // 顔
  const face: Pt[] = [[10, 9], [25, 9], [25.5, 15], [24.5, 19.5], [21.8, 23], [18.5, 24.3], [15, 22.8], [11.5, 19], [10, 14]]
    .map(([x, y]) => [x, y + dy] as Pt);
  poly(g, face, (x, y) => {
    if (x >= 24 || (y > 19 + dy && x > 19)) return SKIN[1];
    if (y > 20 + dy && x < 16) return SKIN[1];
    return SKIN[0];
  });
  // 耳
  ellipse(g, 10.6, 15.5 + dy, 1.6, 2.1, SKIN[1]);
  g.px(10, 15 + dy, SKIN[2]);
  // 横の髪
  poly(g, [[7.5, 8], [11, 8], [10.5, 12], [9.5, 19], [7.5, 20]].map(([x, y]) => [x, y + dy] as Pt), (x, y) => shade(HAIR, x, y, 9, 12 + dy, 3, 8));
  poly(g, [[23.5, 8], [26.5, 8], [26.8, 14], [26, 18], [24.8, 13]].map(([x, y]) => [x, y + dy] as Pt), (_x, y) => (y > 13 + dy ? HAIR[2] : HAIR[1]));
  // 髪を結ぶ赤いゴム
  ellipse(g, 7, 6.5 + dy, 1.4, 1.4, RED[1]);

  // マスク
  const mY = 11 + dy;
  const b = e.brow;
  poly(g, [[7, mY - 0.5 + b * 0.3], [11, mY - b * 0.5], [16, mY + 1], [18.5, mY + 1], [23.5, mY - b * 0.5], [28.5, mY - 1 + b * 0.3], [26.5, mY + 5.5], [20, mY + 6], [17.3, mY + 4.6], [15, mY + 6], [9, mY + 5.5]],
    BLUE[2]);
  // マスクのつや(左上)
  for (const [x, y] of [[9, 1], [10, 1], [11, 1], [8, 2]] as Pt[]) if (g.get(x, mY + y) === BLUE[2]) g.px(x, mY + y, BLUE[1]);
  // 目:マスクの白いレンズ。形で表情を出す
  stamp(g, LENS[e.eyeL][0], { w: WHITE, o: OUTLINE }, 10, mY + 1);
  stamp(g, LENS[e.eyeR][1], { w: WHITE, o: OUTLINE }, 19, mY + 1);

  // 前髪(ぎざぎざのすそ)。マスクの上にかぶせる
  const zig: Pt[] = [[7, 12], [9.6, 15.5], [13, 11], [17.2, 15], [21.2, 11], [26, 14.5], [28, 11]];
  const bangBottom = (px: number): number => {
    for (let i = 0; i < zig.length - 1; i++) {
      const [x0, y0] = zig[i], [x1, y1] = zig[i + 1];
      if (px >= x0 && px < x1) return y0 + ((y1 - y0) * (px - x0)) / (x1 - x0);
    }
    return 9;
  };
  for (let x = 8; x <= 27; x++) {
    const bt = bangBottom(x + 0.5);
    const rising = bangBottom(x + 1.5) < bt;
    for (let y = 3; y + 0.5 < bt + dy; y++) {
      if (!g.get(x, y)) continue;
      const sy = y - dy;
      let c = sy < 5 || (x < 14 && sy < 7) || (x + sy < 19) || (x - 11 === sy && sy < 10) || (x - 17 === sy - 3 && sy < 9) ? HAIR[0] : HAIR[1];
      if (sy + 1.5 >= bt && rising) c = HAIR[2];
      g.px(x, y, c);
    }
  }
  // 髪のつや(左上の弧)
  for (const [x, y] of [[9, 4], [10, 3], [11, 3], [12, 2], [13, 2], [14, 2], [8, 5], [8, 6]] as Pt[]) g.px(x, y + dy, HAIR[0]);

  // 鼻
  g.px(22, 18 + dy, SKIN[1]);
  g.px(22, 19 + dy, SKIN[2]);
  // ほお
  if (e.blush) { g.px(12, 18 + dy, RED[0]); g.px(13, 18 + dy, RED[0]); g.px(23, 18 + dy, RED[0]); }
  // 口
  const m = MOUTHS[e.mouth[open ? 1 : 0]];
  const mw = m[0].length;
  stamp(g, m, K, Math.round(19.5 - mw / 2), 20 + dy);
  // 汗
  if (e.sweat) {
    stamp(g, ['.s.', 'sws', 'sws', '.s.'], { s: BLUE[0], w: WHITE }, 26, 9 + dy);
  }
  g.outline(OUTLINE);
  return g;
}

// ---------- オペレーター ----------

const NAVY: Ramp = [md(2, 2, 5), md(1, 1, 3), md(0, 0, 2)];
const TEAL: Ramp = [md(2, 5, 5), md(1, 3, 4), md(0, 2, 3)];
const SET_L = md(4, 4, 5);
const SET_D = md(2, 2, 3);
const RIBBON = md(6, 1, 1);

const OP_EXPR: Expr[] = [
  { eyeL: 'open', eyeR: 'open', mouth: ['small', 'talk'], brow: 0 }, // ふつう
  { eyeL: 'wide', eyeR: 'wide', mouth: ['wavy', 'yell'], brow: -2, sweat: true }, // あせり
  { eyeL: 'flat', eyeR: 'flat', mouth: ['flat', 'flatOpen'], brow: -1 }, // あきれ
  { eyeL: 'happy', eyeR: 'happy', mouth: ['smile', 'bigSmile'], brow: 1, dy: -1, blush: true, fist: true } // ノリノリ
];

function drawOperatorFace(e: Expr, open: boolean): PixelGrid {
  const g = new PixelGrid(S, S);
  const dy = e.dy ?? 0;
  const K: FaceKeys = { o: OUTLINE, w: WHITE, I: NAVY[0], i: NAVY[1], a: SKIN[0], b: SKIN[1], d: RIBBON, t: md(7, 4, 3), s: WHITE };

  // 制服
  poly(g, [[2, 32], [3, 28], [8, 25.5], [14, 24.5], [22, 24.5], [27, 25.5], [30, 28], [31, 32]], (x, y) => shade(TEAL, x, y, 16, 29, 12, 5));
  // ブラウスのえり
  poly(g, [[13.5, 24], [18, 29], [22.5, 24], [21, 23], [18, 26], [15, 23]], WHITE);
  // 首
  poly(g, [[15, 20], [21, 20], [20.5, 25], [18, 27], [15.5, 25]], (_x, y) => (y < 22.5 + dy ? SKIN[2] : SKIN[1]));
  // リボン
  stamp(g, ['rr.rr', '.rRr.', 'rr.rr'], { r: RIBBON, R: md(7, 4, 3) }, 16, 27);
  // えりのふち
  poly(g, [[8, 26], [13.5, 24.5], [16, 32], [11, 32]], (x, y) => shade(TEAL, x, y, 10, 26, 4, 4));
  poly(g, [[28, 26], [22.5, 24.5], [20, 32], [25, 32]], TEAL[2]);

  // 後ろ髪(ボブ)
  const hairC = (x: number, y: number): string => shade(NAVY, x, y, 15, 10 + dy, 10, 11);
  poly(g, [[6, 12], [8, 5], [12, 2], [19, 1.5], [24, 3.5], [27.5, 8], [28, 14], [27.5, 21], [25, 23], [23, 21], [12, 21], [9, 23.5], [6, 22], [5.5, 17]]
    .map(([x, y]) => [x, y + dy] as Pt), hairC);
  // 顔
  const face: Pt[] = [[10, 9], [25, 9], [25.5, 15], [24.3, 19], [21.5, 22.3], [18.5, 23.5], [15, 22], [11.5, 18.5], [10, 14]]
    .map(([x, y]) => [x, y + dy] as Pt);
  poly(g, face, (x, y) => (x >= 24 || (y > 19 + dy && x > 19) || (y > 20 + dy && x < 16) ? SKIN[1] : SKIN[0]));
  // 横の髪(顔の両側を包む)
  poly(g, [[6.5, 10], [11, 8], [11.8, 14], [11.5, 20], [10, 23.5], [7.5, 22]].map(([x, y]) => [x, y + dy] as Pt), hairC);
  poly(g, [[23.8, 8], [27.5, 9], [28, 16], [27, 22], [25, 23], [24.5, 17]].map(([x, y]) => [x, y + dy] as Pt), (_x, y) => (y > 17 + dy ? NAVY[2] : NAVY[1]));
  // 前髪(まっすぐ切りそろえ)
  for (let x = 9; x <= 26; x++) {
    const bottom = 10 + ((x === 13 || x === 19 || x === 23) ? 1 : 0) + (x > 24 ? 1 : 0);
    for (let y = 3; y < bottom + dy; y++) if (g.get(x, y)) g.px(x, y, (y - dy < 5 && x < 18) ? NAVY[0] : NAVY[1]);
    g.px(x, bottom + dy - 1, NAVY[2]);
  }
  for (const [x, y] of [[10, 5], [11, 4], [12, 4], [13, 3], [14, 3], [9, 6]] as Pt[]) g.px(x, y + dy, NAVY[0]);
  // 眉(前髪の下すぐ)
  const brow = (x0: number, dir: number): void => {
    for (let i = 0; i < 3; i++) g.px(x0 + i, 11 + dy - Math.round(((i - 1) * e.brow * dir) / 2), NAVY[1]);
  };
  brow(11, -1);
  brow(20, 1);
  // 目
  const eye = (ex: number, name: string): void => stamp(g, EYES[name], K, ex, 12 + dy);
  eye(11, e.eyeL);
  eye(20, e.eyeR);
  // 鼻
  g.px(22, 17 + dy, SKIN[1]);
  g.px(22, 18 + dy, SKIN[2]);
  if (e.blush) { g.px(12, 17 + dy, md(7, 4, 3)); g.px(13, 17 + dy, md(7, 4, 3)); g.px(24, 17 + dy, md(7, 4, 3)); }
  // 口
  const m = MOUTHS[e.mouth[open ? 1 : 0]];
  stamp(g, m, K, Math.round(19.5 - m[0].length / 2), 19 + dy);
  // ヘッドセット:頭の上のバンド、耳あて、マイク
  for (let x = 6; x <= 25; x++) {
    const t = (x - 6) / 19;
    const y = Math.round(10 + dy - Math.sin(t * Math.PI) * 9.5);
    g.px(x, y, SET_D);
    g.px(x, y - 1, t < 0.5 ? SET_L : SET_D);
  }
  ellipse(g, 8, 15 + dy, 2.6, 3.3, (x, y) => (x + y < 8 + 14 + dy ? SET_L : SET_D));
  g.px(8, 15 + dy, RIBBON);
  // マイクの腕
  const mic: Pt = [16, 21.5 + dy];
  line(g, [9, 18 + dy], mic, 0.75, SET_D);
  ellipse(g, mic[0], mic[1], 1.2, 1.0, SET_L);
  // 汗
  if (e.sweat) {
    stamp(g, ['.s.', 'sws', 'sws', '.s.'], { s: TEAL[0], w: WHITE }, 26, 10 + dy);
  }
  if (e.fist) {
    // 袖とこぶし(画面の右下から突き上げる)
    const fg = new PixelGrid(S, S);
    poly(fg, [[23.5, 32], [30.5, 32], [29.5, 24], [25.5, 23.5]], (x, y) => shade(TEAL, x, y, 27, 27, 3, 4));
    poly(fg, [[25, 24.5], [29.8, 24.5], [29.6, 23], [25.3, 22.8]], WHITE);
    stamp(fg, ['.bbbb.', 'aaaaab', 'accccb', 'aaaaab', 'accccb', '.aaab.'], { a: SKIN[0], b: SKIN[1], c: SKIN[2] }, 24, 17);
    fg.outline(OUTLINE);
    g.outline(OUTLINE);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (fg.cells[y][x]) g.cells[y][x] = fg.cells[y][x];
    return g;
  }
  g.outline(OUTLINE);
  return g;
}

export function drawFaceSheet(kind: 'hero' | 'operator'): PixelGrid[][] {
  const list = kind === 'hero' ? HERO_EXPR : OP_EXPR;
  const draw = kind === 'hero' ? drawHeroFace : drawOperatorFace;
  return list.map((e) => [draw(e, false), draw(e, true)]);
}
