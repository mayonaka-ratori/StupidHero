// 市民と悪党。組の市民とワルは同じ Look と同じポーズをもとにして、小物と行2(sortIdle)だけ変える。
// ボスの化けた姿も、ここの市民の Look とポーズを伸ばして作る。
import { md, type PixelGrid } from '../lib';
import {
  type Build, HAIR_BUN, HAIR_GRANNY, HAIR_MOHAWK, HAIR_SHORT, HAIR_SLICK, type Look, type Pose,
  clonePose, drawPerson, movePose, moveUpper
} from './figure';
import {
  BAG_RED, BLADE, GOLD, HAIR, KNIFE_YELLOW, OUTLINE, SKIN, TATTOO, WALLET_BROWN, WHITE
} from './palette';
import type { Painter, Pt, Ramp } from './pix';
import { STAND, civRows, walkFrames, withFace } from './poses';
import { disguiseRows } from './bossKit';

const pick = (P: Painter, x: number, y: number, c: string) => P.px(Math.round(x), Math.round(y), c);
const R = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];

/** 手首のあたり(手の真ん中からひじの方へ d ドット) */
function wristOf(pose: Pose, arm: 'aF' | 'aB', d = 2.6): Pt {
  const a = pose[arm];
  const dx = a.e[0] - a.h[0], dy = a.e[1] - a.h[1];
  const L = Math.hypot(dx, dy) || 1;
  return [a.h[0] + (dx / L) * d, a.h[1] + (dy / L) * d];
}

/** 塗った物の上に、ふちで囲んだ小さな絵を置く。rows の文字: 0,1,2=ramp、o=ふち、w=白 */
function sprite(P: Painter, x: number, y: number, rows: string[], ramp: Ramp, extra: Record<string, string> = {}): void {
  const m = P.mask();
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') m.set(x + i, y + j); });
  P.fill(m, OUTLINE, { sep: 'outline', flat: true });
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      const c = ch === '0' ? ramp[0] : ch === '1' ? ramp[1] : ch === '2' ? ramp[2] : ch === 'o' ? OUTLINE : extra[ch];
      if (c) P.px(x + i, y + j, c);
    }
  });
}

// =====================================================================
// パーカーの男
// =====================================================================
const HOODIE_TOP: Ramp = [md(5, 5, 6), md(4, 4, 5), md(3, 3, 4)];
const JEANS: Ramp = [md(2, 3, 5), md(1, 2, 4), md(1, 1, 3)];
const SNEAKER: Ramp = [WHITE[0], WHITE[0], WHITE[2]];
const HOODIE_BUILD: Build = { sh: 8, wa: 6.5, arm: 2.4, thigh: 3.1, shin: 2.5, hem: -1, chest: 1 };

function hoodieLook(extra: Partial<Look> = {}): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: HOODIE_TOP, sleeve: 'long', bottom: JEANS, legs: 'pants', shoes: SNEAKER, sole: HOODIE_TOP[2],
    build: HOODIE_BUILD,
    torso(P, pose) {
      const n = pose.neck, p = pose.hip;
      // フードのかたまり(首の後ろ)
      const hood = P.mask().ellipse(n[0] - 4, n[1] + 1.5, 3.2, 2.4);
      P.fill(hood, HOODIE_TOP, { sep: 'outline', hi: 0.45, lo: 0.7 });
      // ひも
      pick(P, n[0] + 2, n[1] + 2, WHITE[0]); pick(P, n[0] + 2, n[1] + 3, WHITE[0]); pick(P, n[0] + 2, n[1] + 4, WHITE[2]);
      pick(P, n[0] + 4, n[1] + 2, WHITE[0]); pick(P, n[0] + 4, n[1] + 3, WHITE[2]);
      // おなかのポケット
      const dx = (p[0] - n[0]) * 0.8;
      for (let i = 0; i < 6; i++) pick(P, n[0] + dx + i, p[1] - 8, HOODIE_TOP[2]);
      for (let j = 5; j <= 7; j++) pick(P, n[0] + dx - 1, p[1] - j, HOODIE_TOP[2]);
      // すそのリブ
      for (let x = -7; x <= 7; x++) {
        const y = p[1] - 2, c = P.g.get(Math.round(p[0] + x), y);
        if (c === HOODIE_TOP[1] || c === HOODIE_TOP[0]) pick(P, p[0] + x, y, HOODIE_TOP[2]);
      }
    },
    ...extra
  };
}

/** 後ろのポケットの位置 */
const backPocket = (pose: Pose): Pt => R([pose.hip[0] - 7, pose.hip[1] - 1]);

function drawWallet(P: Painter, pose: Pose): void {
  const [x, y] = backPocket(pose);
  sprite(P, x - 1, y - 3, ['0000', '1112', '2222', '1112', '1112'], WALLET_BROWN, { w: SKIN[0] });
  P.px(x, y - 3, SKIN[0]);
}

function drawKnifeHandle(P: Painter, pose: Pose): void {
  const [x, y] = backPocket(pose);
  sprite(P, x - 1, y - 6, ['.0.', '0o2', '012', '012', '012', '012', 'ooo'], KNIFE_YELLOW);
}

/** 突き飛ばす:ため → 踏みこむ → 両手で突く(当たり) → 残心 */
function pushMischief(): Pose[] {
  const f0 = withFace(movePose(STAND, -1, 0), 'angry');
  f0.head = [30, 19]; f0.neck = [30, 20];
  f0.aF = { e: [26, 29], h: [30, 27] };
  f0.aB = { e: [34, 29], h: [37, 26] };
  f0.lF = { k: [31, 47], a: [31, 56] };
  f0.lB = { k: [27, 47], a: [25, 56] };
  const f1 = withFace(movePose(STAND, 2, 0), 'angry');
  f1.head = [37, 19]; f1.neck = [36, 20];
  f1.aF = { e: [33, 28], h: [38, 27] };
  f1.aB = { e: [40, 27], h: [44, 26] };
  f1.lF = { k: [38, 46], a: [40, 56] };
  f1.lB = { k: [30, 48], a: [27, 55], toe: 0.3 };
  const f2 = withFace(movePose(STAND, 3, 0), 'grin');
  f2.head = [41, 20]; f2.neck = [39, 21];
  f2.aF = { e: [42, 25], h: [48, 24] };
  f2.aB = { e: [46, 25], h: [52, 24] };
  f2.lF = { k: [40, 47], a: [43, 56] };
  f2.lB = { k: [30, 49], a: [25, 55], toe: 0.3 };
  const f3 = withFace(movePose(STAND, 2, 0), 'grin');
  f3.head = [37, 19]; f3.neck = [36, 20];
  f3.aF = { e: [38, 27], h: [44, 26] };
  f3.aB = { e: [41, 27], h: [47, 25] };
  f3.lF = { k: [38, 47], a: [40, 56] };
  f3.lB = { k: [30, 48], a: [27, 56] };
  return [f0, f1, f2, f3];
}

function hoodieSheets(): { civ: PixelGrid[][]; bad: PixelGrid[][] } {
  const civLook = hoodieLook({ front: drawWallet });
  const badLook = hoodieLook({ front: drawKnifeHandle });
  const base = STAND;
  // 市民:おなかのポケットに手を入れて待つ(体をゆらし、つま先でリズム)
  const inPocket = (p: Pose): Pose => {
    const q = clonePose(p);
    q.aF = { e: [q.neck[0] - 3, q.neck[1] + 9], h: [q.hip[0] + 1, q.hip[1] - 6], noHand: true };
    q.aB = { e: [q.neck[0] + 5, q.neck[1] + 9], h: [q.hip[0] + 5, q.hip[1] - 6], noHand: true };
    return q;
  };
  const c1 = inPocket(moveUpper(base, 0, 1));
  const c2 = inPocket(moveUpper(base, 0, 1)); c2.lF.toe = -0.5; c2.lF.a = [28, 55];
  const c3 = inPocket(base); c3.face = 'shut';
  const civSort = [inPocket(base), c1, c2, c3];
  // ワル:後ろのポケットを押さえてキョロキョロ
  const press = (p: Pose): Pose => {
    const q = clonePose(p);
    q.aF = { e: [q.neck[0] - 7, q.neck[1] + 9], h: [q.hip[0] - 6, q.hip[1] + 2] };
    return q;
  };
  const badSort = [
    press(withFace(base, 'sly')),
    press(withFace(base, 'worried', { look: -1 })),
    press(withFace(moveUpper(base, 0, 1), 'sly', { look: -1 })),
    press(withFace(base, 'worried'))
  ];
  const civ = civRows(civLook, base, civSort);
  const bad = civRows(badLook, base, badSort);
  bad.push(pushMischief().map((p) => drawPerson(badLook, p)));
  return { civ, bad };
}

// =====================================================================
// スーツの男
// =====================================================================
const SUIT: Ramp = [md(3, 3, 5), md(2, 2, 4), md(1, 1, 3)];
const TIE = md(1, 4, 4);
const LEATHER: Ramp = [SKIN[2], HAIR[1], OUTLINE];
const SUIT_BUILD: Build = { sh: 8, wa: 6, arm: 2.3, thigh: 3, shin: 2.5, hem: 2, chest: 1 };

function suitLook(extra: Partial<Look> = {}): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SLICK,
    top: SUIT, sleeve: 'long', bottom: SUIT, legs: 'pants', shoes: LEATHER,
    build: SUIT_BUILD, cuff: WHITE[0],
    torso(P, pose) {
      const n = pose.neck;
      const lean = (pose.hip[0] - n[0]) / Math.max(1, pose.hip[1] - n[1]);
      const X = (dx: number, dy: number) => n[0] + dx + lean * dy;
      // シャツのV字とネクタイ
      for (let dy = 0; dy <= 7; dy++) {
        const w = Math.max(0, 3 - Math.floor(dy / 2.5));
        for (let dx = 0; dx <= w; dx++) pick(P, X(2 + dx, dy), n[1] + dy, WHITE[dx === w ? 1 : 0]);
        pick(P, X(1, dy), n[1] + dy, SUIT[2]);
        if (w > 0) pick(P, X(3 + w, dy), n[1] + dy, SUIT[2]);
      }
      pick(P, X(3, 0), n[1], TIE); pick(P, X(3, 1), n[1] + 1, OUTLINE);
      for (let dy = 2; dy <= 8; dy++) pick(P, X(3, dy), n[1] + dy, TIE);
      pick(P, X(4, 3), n[1] + 3, TIE); pick(P, X(4, 4), n[1] + 4, TIE);
      // ボタンと前の合わせ
      pick(P, X(4, 11), n[1] + 11, OUTLINE);
      for (let dy = 9; dy <= 19; dy++) pick(P, X(3, dy), n[1] + dy, SUIT[2]);
    },
    ...extra
  };
}

/** 腕時計(金色) */
function drawWatch(P: Painter, pose: Pose): void {
  const [x, y] = R(wristOf(pose, 'aF', 2.4));
  sprite(P, x - 1, y - 1, ['010', '101', '212'], GOLD, {});
  P.px(x, y, WHITE[0]);
}

/** 女物のバッグ(赤)を手前の脇に抱える */
function drawBag(P: Painter, pose: Pose, at?: Pt): void {
  const [x, y] = R(at ?? [pose.hip[0] - 2, pose.hip[1] - 8]);
  sprite(P, x - 4, y - 3, [
    '..oooo..',
    '.o....o.',
    '00000000',
    '01111112',
    '1111w112',
    '11111112',
    '.222222.'
  ], BAG_RED, { w: WHITE[0] });
  // 抱えている手を上に描き直す
  const h = pose.aF.h;
  if (Math.abs(h[0] - x) < 6 && Math.abs(h[1] - y) < 6) P.fill(P.mask().ellipse(h[0], h[1], 1.7, 1.7), SKIN, { sep: 'outline' });
}

const holdBag = (p: Pose): Pose => {
  const q = clonePose(p);
  q.aF = { e: [q.neck[0] - 5, q.neck[1] + 8], h: [q.hip[0] + 1, q.hip[1] - 10] };
  return q;
};

function snatchMischief(): Pose[] {
  const f0 = withFace(movePose(STAND, 0, 1), 'sly');
  f0.head = [37, 20]; f0.neck = [35, 21];
  f0.aB = { e: [39, 30], h: [36, 36] };
  f0.lF = { k: [36, 47], a: [38, 56] };
  f0.lB = { k: [29, 48], a: [25, 55], toe: 0.4 };
  const f1 = withFace(movePose(STAND, 2, 1), 'grin');
  f1.head = [40, 21]; f1.neck = [38, 22];
  f1.aB = { e: [44, 27], h: [49, 25] };
  f1.lF = { k: [39, 47], a: [42, 56] };
  f1.lB = { k: [31, 48], a: [26, 55], toe: 0.4 };
  const f2 = withFace(movePose(STAND, 4, 1), 'grin');
  f2.head = [43, 21]; f2.neck = [41, 22];
  f2.aB = { e: [48, 27], h: [54, 27] };
  f2.lF = { k: [42, 47], a: [46, 56] };
  f2.lB = { k: [32, 49], a: [27, 55], toe: 0.4 };
  const f3 = withFace(movePose(STAND, 1, 0), 'grin');
  f3.head = [37, 19]; f3.neck = [35, 20];
  f3.aB = { e: [40, 27], h: [37, 31] };
  f3.lF = { k: [30, 47], a: [28, 56] };
  f3.lB = { k: [37, 46], a: [39, 54], toe: 0.3 };
  return [f0, f1, f2, f3].map(holdBag);
}

/** ひったくったバッグ(奥の手に持つ) */
function snatchedBag(P: Painter, pose: Pose, i: number): void {
  if (i < 2) return;
  const [x, y] = R(pose.aB.h);
  sprite(P, x - 2, y, ['.oo..', 'o..o.', '00000', '11112', '11112', '22222'], BAG_RED);
}

function suitSheets(): { civ: PixelGrid[][]; bad: PixelGrid[][]; civSort: Pose[] } {
  const civLook = suitLook({ front: drawWatch });
  const badLook = suitLook({ front: (P, p) => drawBag(P, p) });
  const base = STAND;
  // 市民:腕時計を見てあせる
  const watch = (p: Pose, raise = true): Pose => {
    const q = clonePose(p);
    q.aF = raise
      ? { e: [q.neck[0] - 2, q.neck[1] + 10], h: [q.neck[0] + 5, q.neck[1] + 6] }
      : { e: [q.neck[0] - 2, q.neck[1] + 10], h: [q.neck[0] + 4, q.neck[1] + 12] };
    return q;
  };
  const civSort = [
    watch(withFace(base, 'worried', { down: true })),
    watch(withFace(moveUpper(base, 0, 1), 'worried', { down: true, sweat: true })),
    watch(withFace(base, 'surprised', { sweat: true }), false),
    watch(withFace(base, 'worried', { down: true, sweat: true }))
  ];
  civSort[3].lF.toe = -0.5; civSort[3].lF.a = [28, 55];
  // ワル:バッグを抱え直して、後ろを気にする
  const badSort = [
    holdBag(withFace(base, 'sly')),
    movePose(holdBag(withFace(moveUpper(base, 0, 1), 'normal')), 0, 0),
    holdBag(withFace(base, 'worried', { look: -1 })),
    holdBag(withFace(moveUpper(base, 0, 1), 'sly', { look: -1 }))
  ];
  const badHitch: Look[] = [
    badLook,
    suitLook({ front: (P, p) => drawBag(P, p, [p.hip[0] - 2, p.hip[1] - 10]) }),
    badLook, badLook
  ];
  const civ = civRows(civLook, base, civSort);
  const bad = civRows(badLook, holdBag(base), badSort, {
    walk: walkFrames(holdBag(base)).map(holdBag),
    lookFor: (p, row) => (row === 2 ? badHitch[badSort.indexOf(p)] ?? badLook : badLook)
  });
  // 吹っ飛ぶコマではバッグを抱えたまま
  const snatch = snatchMischief();
  bad.push(snatch.map((p, i) => drawPerson(suitLook({
    front: (P, q) => { drawBag(P, q); snatchedBag(P, q, i); }
  }), p)));
  return { civ, bad, civSort };
}

// =====================================================================
// 買い物袋の女性
// =====================================================================
const CARDIGAN: Ramp = [md(7, 4, 4), md(6, 2, 3), md(4, 1, 2)];
const SKIRT: Ramp = [md(1, 2, 3), md(1, 2, 3), md(1, 1, 2)];
const TOTE: Ramp = [md(3, 5, 3), md(2, 4, 2), md(1, 1, 2)];
const SHOPPER_BUILD: Build = { sh: 6.5, wa: 5, arm: 2, thigh: 2.6, shin: 2, hem: 1, chest: 1.5 };

function shopperLook(extra: Partial<Look> = {}): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_BUN,
    top: CARDIGAN, sleeve: 'long', bottom: SKIRT, legs: 'longskirt', shoes: LEATHER,
    build: SHOPPER_BUILD, sweat: null,
    torso(P, pose) {
      const n = pose.neck;
      const lean = (pose.hip[0] - n[0]) / Math.max(1, pose.hip[1] - n[1]);
      // カーディガンの前の合わせとボタン
      for (let dy = 1; dy <= 16; dy++) pick(P, n[0] + 3 + lean * dy, n[1] + dy, CARDIGAN[2]);
      for (const dy of [5, 9, 13]) pick(P, n[0] + 4 + lean * dy, n[1] + dy, SKIN[0]);
    },
    ...extra
  };
}

/** 買い物袋。奥の手に下げる。中身 kind を口からのぞかせる */
function drawTote(P: Painter, pose: Pose, kind: 'rice' | 'loot', cover = false): void {
  const [hx, hy] = R(pose.aB.h);
  const x = hx - 5, y = hy + 3;
  // 中身(袋のうしろから上へ出す)
  if (kind === 'rice') {
    sprite(P, x + 2, y - 5, ['00000', '00100', '01110', '11111', '12121', '11111'], WHITE, {});
    P.px(x + 3, y - 3, OUTLINE); P.px(x + 4, y - 3, OUTLINE); P.px(x + 5, y - 3, OUTLINE);
  } else {
    sprite(P, x + 1, y - 4, ['.000.', '0o1o0', '01111', '01111', '11111'], GOLD, {});
    sprite(P, x + 6, y - 3, ['010', '1o1', '010'], GOLD);
  }
  // 持ち手
  P.line([hx - 3, hy + 3], [hx - 1, hy], OUTLINE).line([hx + 3, hy + 3], [hx + 1, hy], OUTLINE);
  const m = P.mask().poly([[x, y], [x + 11, y], [x + 12, y + 11], [x - 1, y + 11]]);
  P.fill(m, TOTE, { sep: 'outline', hi: 0.25, lo: 0.7 });
  P.line([x, y + 1], [x + 11, y + 1], TOTE[0]);
  // 持ち手をにぎる奥の手(胴に隠れないように描き直す)
  P.fill(P.mask().ellipse(hx, hy, 1.7, 1.7).union(P.mask().capsule([hx - 1, hy - 4], [hx, hy - 1], 1.4)), [SKIN[1], SKIN[1], SKIN[2]], { sep: 'outline' });
  P.fill(P.mask().capsule([hx - 1.5, hy - 7], [hx - 1, hy - 4], 1.8), [CARDIGAN[1], CARDIGAN[2], CARDIGAN[2]], { sep: 'outline' });
  if (cover) void 0;
}

function pickpocketMischief(): Pose[] {
  const bag = (p: Pose): Pose => { const q = clonePose(p); q.aB = { e: [39, 28], h: [40, 35] }; return q; };
  const f0 = bag(withFace(moveUpper(STAND, 0, 1), 'sly'));
  f0.head = [36, 20]; f0.neck = [34, 21];
  f0.aF = { e: [33, 30], h: [38, 33] };
  const f1 = bag(withFace(moveUpper(movePose(STAND, 2, 0), 0, 1), 'sly'));
  f1.head = [38, 20]; f1.neck = [36, 21];
  f1.aF = { e: [38, 30], h: [45, 35] };
  f1.lF = { k: [36, 47], a: [39, 56] };
  const f2 = bag(withFace(moveUpper(movePose(STAND, 3, 0), 0, 1), 'grin'));
  f2.head = [40, 20]; f2.neck = [37, 21];
  f2.aF = { e: [41, 30], h: [49, 34] };
  f2.lF = { k: [37, 47], a: [41, 56] };
  const f3 = bag(withFace(movePose(STAND, 0, 0), 'grin'));
  f3.aF = { e: [30, 30], h: [37, 30] };
  return [f0, f1, f2, f3];
}

function shopperSheets(): { civ: PixelGrid[][]; bad: PixelGrid[][]; civSort: Pose[]; civLook: Look } {
  const withBag = (p: Pose): Pose => { const q = clonePose(p); q.aB = { e: [q.neck[0] + 7, q.neck[1] + 9], h: [q.neck[0] + 8, q.neck[1] + 16] }; return q; };
  const base = withBag(STAND);
  const civLook = shopperLook({ mid: (P, p) => drawTote(P, p, 'rice') });
  const badLook = shopperLook({ mid: (P, p) => drawTote(P, p, 'loot') });
  // 市民:袋を持ち直す
  const lift = (p: Pose, dy: number): Pose => { const q = clonePose(p); q.aB.h[1] -= dy; q.aB.e[1] -= Math.ceil(dy / 2); q.aB.h[0] -= 1; return q; };
  const civSort = [
    base,
    lift(moveUpper(base, 0, 1), 3),
    (() => { const q = lift(base, 4); q.aF = { e: [q.neck[0] + 1, q.neck[1] + 10], h: [q.aB.h[0] - 2, q.aB.h[1] + 2] }; return q; })(),
    lift(withFace(base, 'shut'), 1)
  ];
  // ワル:袋の口を手でふさぐ
  const cover = (p: Pose, dx = 0): Pose => {
    const q = clonePose(p);
    q.aF = { e: [q.neck[0] + 2, q.neck[1] + 11], h: [q.aB.h[0] - 1 + dx, q.aB.h[1] + 3] };
    return q;
  };
  const badSort = [
    cover(withFace(base, 'sly')),
    cover(withFace(moveUpper(base, 0, 1), 'sly', { down: true }), 1),
    cover(withFace(base, 'worried', { look: -1 }), 3),
    cover(withFace(base, 'sly'), 2)
  ];
  // 驚く、吹っ飛ぶ、のびているコマでは袋を手放す
  const noBag = shopperLook();
  const civ = civRows(civLook, base, civSort, { walk: walkFrames(base).map(withBag), lookFor: (_p, row) => (row >= 3 ? noBag : civLook) });
  const bad = civRows(badLook, base, badSort, { walk: walkFrames(base).map(withBag), lookFor: (_p, row) => (row >= 3 ? noBag : badLook) });
  const pp = pickpocketMischief();
  bad.push(pp.map((p, i) => drawPerson(shopperLook({
    mid: (P, q) => drawTote(P, q, 'loot'),
    front: i >= 2 ? (P, q) => sprite(P, Math.round(q.aF.h[0]) - 1, Math.round(q.aF.h[1]) - 3, ['0000', '0o11', '1111'], GOLD) : undefined
  }), p)));
  return { civ, bad, civSort, civLook };
}

// =====================================================================
// モヒカン
// =====================================================================
const MOHAWK: Ramp = [md(7, 3, 6), md(6, 1, 5), md(3, 0, 3)];
const VEST: Ramp = [md(3, 2, 4), md(2, 1, 3), md(1, 1, 2)];
const RIPPED: Ramp = [md(3, 4, 5), md(2, 3, 4), md(1, 2, 3)];
const MOHAWK_BUILD: Build = { sh: 9, wa: 6.5, arm: 2.8, thigh: 3.3, shin: 2.7, hem: -1, chest: 2 };

function knife(P: Painter, h: Pt, ang: number): void {
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (d: number): Pt => [h[0] + c * d, h[1] + s * d];
  // 柄(手の後ろ)
  P.line(at(-3), at(-1), VEST[1]);
  const m = P.mask().capsule(at(2), at(8), 0.9, 0.4);
  P.fill(m, BLADE, { sep: 'outline', flat: true });
  P.line(at(2), at(8), BLADE[0]);
  P.px(Math.round(at(1.5)[0]), Math.round(at(1.5)[1]), OUTLINE);
}

function mohawkLook(knifeAng: number | null): Look {
  return {
    skin: SKIN, hair: MOHAWK, hairStyle: HAIR_MOHAWK,
    top: VEST, sleeve: 'none', bottom: RIPPED, legs: 'pants', shoes: VEST, sole: OUTLINE,
    build: MOHAWK_BUILD,
    headExtra(g, pose) {
      // 傷とサングラス
      const top = HAIR_MOHAWK.top + (pose.down ? 1 : 0);
      if (pose.face !== 'ko' && pose.face !== 'hurt') {
        for (let x = 7; x <= 11; x++) g.px(x, top + 4, OUTLINE);
        g.px(9, top + 5, OUTLINE); g.px(10, top + 5, OUTLINE); g.px(8, top + 4, MOHAWK[0]);
      }
      g.px(7, top + 7, SKIN[2]); g.px(8, top + 8, SKIN[2]);
    },
    torso(P, pose) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      // えりもとの V と、前のジッパー
      for (let dy = 0; dy <= 4; dy++) for (let dx = 0; dx <= 3 - Math.floor(dy * 0.7); dx++) pick(P, n[0] + 2 + dx + lean * dy, n[1] + dy, dx === 0 ? SKIN[1] : SKIN[0]);
      for (let dy = 5; dy <= 16; dy++) pick(P, n[0] + 3 + lean * dy, n[1] + dy, dy % 2 ? BLADE[1] : VEST[2]);
      // 肩のびょう
      pick(P, n[0] - 4, n[1] + 1, BLADE[0]); pick(P, n[0] - 6, n[1] + 3, BLADE[0]); pick(P, n[0] - 2, n[1] + 2, BLADE[0]);
      // ベルト
      for (let x = -6; x <= 6; x++) pick(P, p[0] + x, p[1] - 3, x === 2 ? BLADE[0] : OUTLINE);
    },
    front(P, pose) {
      // 破れたひざ
      const k = R(pose.lF.k);
      P.px(k[0], k[1], SKIN[0]).px(k[0] + 1, k[1], SKIN[1]).px(k[0], k[1] + 1, SKIN[1]);
      // 手首のトゲ
      const w = R(wristOf(pose, 'aF', 2.2));
      P.px(w[0], w[1], OUTLINE).px(w[0] - 1, w[1], OUTLINE).px(w[0] + 1, w[1], OUTLINE);
      if (knifeAng !== null) knife(P, pose.aB.h, knifeAng);
    }
  };
}

function mohawkSheets(): PixelGrid[][] {
  // 少しがに股で前かがみ
  const base = withFace(STAND, 'angry');
  base.lB = { k: [37, 47], a: [37, 56] }; base.lF = { k: [28, 47], a: [27, 56] };
  base.hip = [32, 38]; base.head = [34, 19]; base.neck = [33, 20];
  base.aB = { e: [41, 28], h: [45, 32] };
  base.aF = { e: [30, 30], h: [36, 33] };
  const K = -0.6;
  const look = mohawkLook(K);
  // ナイフをくるくる回す
  const twirl = [-1.4, -0.2, 1.2, 2.6];
  const sort = twirl.map((_, i) => {
    const q = withFace(i % 2 ? moveUpper(base, 0, 1) : base, i === 3 ? 'grin' : 'angry');
    q.aB = { e: [41, 28], h: [45, 30] };
    return q;
  });
  const rows = civRows(look, base, sort, {
    walk: walkFrames(base),
    lookFor: (p, row) => (row === 2 ? mohawkLook(twirl[sort.indexOf(p)]) : row >= 4 ? mohawkLook(null) : look)
  });
  // ナイフで脅す
  const f0 = withFace(movePose(base, -1, 0), 'angry');
  f0.aB = { e: [38, 24], h: [37, 17] };
  const f1 = withFace(movePose(base, 1, 0), 'angry');
  f1.head = [37, 19]; f1.neck = [35, 20];
  f1.aB = { e: [42, 25], h: [43, 20] };
  f1.lF = { k: [33, 47], a: [33, 56] };
  const f2 = withFace(movePose(base, 3, 0), 'grin');
  f2.head = [40, 20]; f2.neck = [38, 21];
  f2.aB = { e: [46, 27], h: [51, 27] };
  f2.lB = { k: [42, 47], a: [45, 56] }; f2.lF = { k: [30, 48], a: [26, 55], toe: 0.3 };
  const f3 = withFace(movePose(base, 2, 0), 'grin');
  f3.head = [38, 19]; f3.neck = [36, 20];
  f3.aB = { e: [44, 28], h: [48, 25] };
  f3.lB = { k: [41, 47], a: [43, 56] };
  const angs = [-1.9, -1.2, 0, -0.5];
  rows.push([f0, f1, f2, f3].map((p, i) => drawPerson(mohawkLook(angs[i]), p)));
  return rows;
}

// =====================================================================
// おばあさん
// =====================================================================
const GRAY_HAIR: Ramp = [md(7, 7, 7), md(5, 5, 6), md(3, 3, 4)];
const SHAWL: Ramp = [md(5, 3, 6), md(4, 2, 5), md(2, 1, 3)];
const LONGSKIRT: Ramp = [md(3, 3, 2), md(3, 3, 2), md(2, 2, 1)];
const CANE: Ramp = [md(4, 2, 1), md(4, 2, 1), md(4, 2, 1)];
const GRANNY_BUILD: Build = { sh: 7, wa: 5.5, arm: 2, thigh: 2.6, shin: 2, hem: 1, chest: 0 };

function grannyLook(extra: Partial<Look> = {}): Look {
  return {
    skin: SKIN, hair: GRAY_HAIR, hairStyle: HAIR_GRANNY,
    top: SHAWL, sleeve: 'long', bottom: LONGSKIRT, legs: 'longskirt', shoes: [SKIN[2], OUTLINE, OUTLINE],
    build: GRANNY_BUILD,
    headExtra(g, pose) {
      const top = HAIR_GRANNY.top + (pose.down ? 1 : 0);
      // めがね(縁)としわ
      if (pose.face !== 'ko') {
        g.px(8, top + 4, OUTLINE); g.px(10, top + 4, OUTLINE); g.px(9, top + 6, OUTLINE); g.px(11, top + 4, OUTLINE);
        g.px(10, top + 5, GRAY_HAIR[0]);
      }
      g.px(8, top + 7, SKIN[1]);
    },
    torso(P, pose) {
      const n = pose.neck;
      // ショールのふさ
      const lean = (pose.hip[0] - n[0]) / Math.max(1, pose.hip[1] - n[1]);
      for (let i = -5; i <= 6; i += 2) pick(P, n[0] + i + lean * 9, n[1] + 9 + (i % 4 === 1 ? 1 : 0), SHAWL[2]);
    },
    ...extra
  };
}

function drawCane(P: Painter, pose: Pose): void {
  const [hx, hy] = R(pose.aB.h);
  const foot: Pt = [hx + 3, 58];
  const m = P.mask().capsule([hx, hy - 1], foot, 0.6).union(P.mask().capsule([hx - 2, hy - 2], [hx + 1, hy - 2], 0.6)).union(P.mask().rect(hx - 3, hy - 2, 1, 2));
  P.fill(m, CANE, { sep: 'outline', flat: true });
  P.line([hx, hy - 1], foot, CANE[1]);
  P.line([hx - 2, hy - 2], [hx, hy - 2], CANE[0]);
  // 手を上に描き直す
  P.fill(P.mask().ellipse(hx, hy, 1.6, 1.6), SKIN, { sep: 'outline' });
}

function grannyBase(): Pose {
  const b: Pose = {
    head: [38, 23], face: 'normal',
    neck: [35, 24], hip: [30, 39],
    aB: { e: [40, 32], h: [43, 37] },
    aF: { e: [31, 32], h: [34, 38] },
    lB: { k: [34, 48], a: [34, 56] },
    lF: { k: [29, 48], a: [27, 56] }
  };
  return b;
}

function grannySheets(): { civ: PixelGrid[][]; civSort: Pose[]; look: Look } {
  const look = grannyLook({ front: drawCane });
  const base = grannyBase();
  // 腰をたたく
  const tap = (p: Pose, up: boolean): Pose => {
    const q = clonePose(p);
    q.aF = { e: [q.neck[0] - 7, q.neck[1] + 5], h: [q.hip[0] - 6, q.hip[1] - (up ? 7 : 4)] };
    return q;
  };
  const civSort = [
    tap(withFace(base, 'shut'), true),
    tap(withFace(moveUpper(base, 0, 1), 'hurt'), false),
    tap(withFace(base, 'shut'), true),
    tap(withFace(moveUpper(base, 0, 1), 'normal'), false)
  ];
  const walk = walkFrames(base, { swing: 0.6, armSwing: 0.4 }).map((q, i) => {
    q.aB = { e: [40, 32], h: [43 + (i === 0 ? 1 : i === 2 ? -1 : 0), 37 + (i % 2 ? -1 : 0)] };
    return q;
  });
  const civ = civRows(look, base, civSort, {
    walk,
    lookFor: (_p, row) => (row >= 4 ? grannyLook() : look)
  });
  return { civ, civSort, look };
}

// =====================================================================
// ボスの化けた姿:市民の絵を伸ばして、腕に水色の入れ墨を足す
// =====================================================================
function tattoo(P: Painter, pose: Pose): void {
  // 手前の前腕の、袖から出た肌のところに入れ墨(水色1色と、ふち色の線)
  const a = pose.aF;
  const c = R([a.e[0] + (a.h[0] - a.e[0]) * 0.2, a.e[1] + (a.h[1] - a.e[1]) * 0.2 + 1]);
  const pat = ['.11.', '1o11', '11o1', '.11.'];
  const skin = new Set<string>(SKIN);
  pat.forEach((r, j) => {
    for (let i = 0; i < 4; i++) {
      const x = c[0] - 2 + i, y = c[1] - 2 + j;
      const cur = P.g.get(x, y);
      if (r[i] === '.' || !cur || !skin.has(cur)) continue;
      P.px(x, y, r[i] === '1' ? TATTOO[1] : OUTLINE);
    }
  });
}

function disguiseLook(base: Look): Look {
  const b = base.build;
  const prev = base.front;
  return {
    ...base,
    sleeve: 'short',
    build: { ...b, sh: b.sh + 1, arm: b.arm + 0.4, thigh: b.thigh + 0.2 },
    front(P, pose) {
      tattoo(P, pose);
      prev?.(P, pose);
    }
  };
}

/** 化けた姿の3行(待機、歩く、sortIdle) */
const disguise = (look: Look, base: Pose, sort: Pose[], walk?: Pose[], sy?: number): PixelGrid[][] =>
  disguiseRows(disguiseLook(look), base, sort, { sx: 1.06, sy, walk });

// =====================================================================

export function buildPeople(skip: Set<string>): Record<string, PixelGrid[][]> {
  const out: Record<string, PixelGrid[][]> = {};
  const need = (...k: string[]) => k.some((x) => !skip.has(x));
  if (need('hoodie_civ', 'hoodie_bad')) {
    const h = hoodieSheets();
    out.hoodie_civ = h.civ; out.hoodie_bad = h.bad;
  }
  if (need('suit_civ', 'suit_bad', 'boss_disguise_suit')) {
    const s = suitSheets();
    out.suit_civ = s.civ; out.suit_bad = s.bad;
    out.boss_disguise_suit = disguise(suitLook({ front: drawWatch }), STAND, s.civSort);
  }
  if (need('shopper_civ', 'shopper_bad', 'boss_disguise_shopper')) {
    const s = shopperSheets();
    out.shopper_civ = s.civ; out.shopper_bad = s.bad;
    const withBag = (p: Pose): Pose => { const q = clonePose(p); q.aB = { e: [q.neck[0] + 7, q.neck[1] + 9], h: [q.neck[0] + 8, q.neck[1] + 16] }; return q; };
    out.boss_disguise_shopper = disguise(s.civLook, s.civSort[0], s.civSort, walkFrames(s.civSort[0]).map(withBag));
  }
  if (need('villain_mohawk')) out.villain_mohawk = mohawkSheets();
  if (need('granny_civ', 'boss_disguise_granny')) {
    const g = grannySheets();
    out.granny_civ = g.civ;
    const base = grannyBase();
    const walk = walkFrames(base, { swing: 0.6, armSwing: 0.4 }).map((q) => { q.aB = { e: [40, 32], h: [43, 37] }; return q; });
    out.boss_disguise_granny = disguise(g.look, base, g.civSort, walk, 1.15);
  }
  return out;
}
