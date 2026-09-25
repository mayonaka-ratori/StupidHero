// ステージ4の人8種類(花屋の店員、配達員、新人の会社員、清掃員、シェフ、ウェイター、ドレスの女性、手品師)と、
// 親玉の化けた姿3つ。見本(mocks/stage4_src/people.ts)をもとにした。
// 市民とヴィランは同じシート。もれ(紫の照明、浮いた小物)は人の周りにコードで重ねるので、人の絵には紫を使わない。
// 行0〜5は市民の形(行2は見た目のくせ)、行6は「念力で物を持ち上げる」(片手を前に出して指を広げる)。
import { md, PixelGrid } from '../lib';
import {
  type Build, HAIR_BUN, HAIR_SHORT, HAIR_SLICK, type Look, type Pose, clonePose, drawPerson, moveUpper
} from '../world/figure';
import { GOLD, HAIR, OUTLINE, SKIN, WHITE } from '../world/palette';
import { type Painter, type Pt, type Ramp } from '../world/pix';
import { STAND, civRows, idleFrames, withFace } from '../world/poses';
import { disguiseRows } from '../world/bossKit';

const R = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];

/** ポーズに持たせる印(見た目のくせと念力の行で使う) */
interface P4 extends Pose {
  /** 念力の行(手に持った物を描かない) */
  psy?: boolean;
  /** 念力の行:指を広げる */
  open?: boolean;
  /** 花びら(花屋)の場所 */
  petal?: Pt;
  /** 書類がずれ落ちかけている(新人)。1:少し、2:大きく */
  slip?: 1 | 2;
  /** モップの先の横のずれ(清掃員) */
  mop?: number;
  /** 湯気(シェフ)。1:出はじめ、2:上へのびる */
  steam?: 1 | 2;
  /** グラスの傾き(ウェイター)。-1:左へ、1:右へ */
  tip?: -1 | 1;
  /** 羽が手でさわられて曲がる(ドレスの女性) */
  bend?: boolean;
  /** つえの向き(手品師。ラジアン、0で右上) */
  cane?: number;
}
const P = (p: Pose): P4 => p as P4;
const tag = (p: Pose, extra: Partial<P4>): P4 => Object.assign(clonePose(p), extra) as P4;

/** 手に持った物を描かないコマ(驚く、吹っ飛ぶ、のびている、念力) */
const handsFree = (pose: Pose): boolean =>
  pose.face === 'surprised' || pose.face === 'hurt' || pose.face === 'ko' || !!P(pose).psy;

/** ふちで囲んだ小さな絵を置く。rows の文字は map で色にする('.' は塗らない) */
export function sprite(Pn: Painter, x: number, y: number, rows: string[], map: Record<string, string>): void {
  const m = Pn.mask();
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') m.set(x + i, y + j); });
  Pn.fill(m, OUTLINE, { sep: 'outline', flat: true });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = map[r[i]]; if (c) Pn.px(x + i, y + j, c); } });
}

const lean = (pose: Pose): number => (pose.hip[0] - pose.neck[0]) / Math.max(1, pose.hip[1] - pose.neck[1]);

/** 念力の行の、前に出した手の広げた指(腕の向きに3本) */
function spreadFingers(Pn: Painter, pose: Pose): void {
  if (!P(pose).open) return;
  const a = pose.aF;
  const dx = a.h[0] - a.e[0], dy = a.h[1] - a.e[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, px = -uy, py = ux;
  for (const k of [-1.8, 0, 1.8]) {
    for (const d of [2, 3]) {
      const x = a.h[0] + ux * (d + (k === 0 ? 0.6 : 0)) + px * k * (0.8 + d * 0.2);
      const y = a.h[1] + uy * (d + (k === 0 ? 0.6 : 0)) + py * k * (0.8 + d * 0.2);
      Pn.px(x, y, SKIN[d === 2 ? 1 : 0]);
    }
  }
}

const SLIM: Build = { sh: 7.5, wa: 6, arm: 2.2, thigh: 2.9, shin: 2.4, hem: 1, chest: 1 };
const WIDE: Build = { sh: 8.5, wa: 7, arm: 2.5, thigh: 3.1, shin: 2.6, hem: 1, chest: 2 };
const LADY: Build = { sh: 6.5, wa: 5.5, arm: 1.9, thigh: 2.6, shin: 2.2, hem: 0, chest: 2 };

const BLACK: Ramp = [md(2, 2, 3), md(1, 1, 2), OUTLINE];
const SHOE: Ramp = [HAIR[1], OUTLINE, OUTLINE];
const SHIRT: Ramp = [WHITE[0], WHITE[0], WHITE[2]];

/** 念力の行(行6):前を見る → 手を上げる → 指を広げる(当たり) → 手を突き出したまま */
function psychicRow(base: Pose): P4[] {
  const n = base.neck;
  const f0 = tag(withFace(base, 'normal'), { psy: true });
  f0.aF = { e: [n[0] + 3, n[1] + 8], h: [n[0] + 8, n[1] + 8] };
  const f1 = tag(withFace(base, 'sly'), { psy: true });
  f1.aF = { e: [n[0] + 5, n[1] + 6], h: [n[0] + 11, n[1] + 5] };
  const b2 = moveUpper(base, 1, 0);
  const f2 = tag(withFace(b2, 'grin'), { psy: true, open: true });
  f2.aF = { e: [n[0] + 7, n[1] + 6], h: [n[0] + 13, n[1] + 4] };
  f2.lB = { k: [base.hip[0] + 5, 47], a: [base.hip[0] + 7, 56] };
  const f3 = tag(withFace(b2, 'sly'), { psy: true, open: true });
  f3.aF = { e: [n[0] + 7, n[1] + 5], h: [n[0] + 13, n[1] + 2] };
  f3.lB = f2.lB;
  return [f0, f1, f2, f3];
}

/** 7行(市民の6行と念力の行) */
function towerRows(look: Look, base: Pose, sort: Pose[]): PixelGrid[][] {
  return [...civRows(look, base, sort), psychicRow(base).map((p) => drawPerson(look, p))];
}

// =====================================================================
// 1階:花屋の店員(クリーム色のシャツ、緑のエプロン、花束)
// 見た目のくせ:花束を持ち直す。花びらが1枚舞う
// =====================================================================
const APRON_G: Ramp = [md(3, 5, 3), md(2, 4, 2), md(1, 2, 1)];
/** クリーム色のシャツ(影は肌の影と同じ色にして、色を節約する) */
const CREAM: Ramp = [md(7, 7, 6), md(6, 6, 5), SKIN[2]];
const FLOWER = [md(7, 3, 4), md(7, 6, 2), WHITE[0], md(5, 4, 7)];

function floristLook(): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_BUN,
    top: CREAM, sleeve: 'rolled', bottom: [APRON_G[2], OUTLINE, OUTLINE], legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: LADY,
    torso(Pn, pose, top) {
      const n = pose.neck, l = lean(pose);
      const apron = Pn.mask();
      top.each((x, y) => { if (y >= n[1] + 4) apron.set(x, y); });
      Pn.fill(apron, APRON_G, { sep: 'none', hi: 0.3, lo: 0.7 });
      for (let dy = 0; dy <= 4; dy++) Pn.px(Math.round(n[0] - 2 + l * dy), n[1] + dy, APRON_G[2]);
      // エプロンのポケットから出たはさみ(銀)
      Pn.px(Math.round(n[0] + 5 + l * 11), n[1] + 11, WHITE[2]).px(Math.round(n[0] + 5 + l * 11), n[1] + 12, WHITE[0]);
    },
    front(Pn, pose) {
      spreadFingers(Pn, pose);
      const pt = P(pose).petal;
      if (pt) Pn.px(pt[0], pt[1], FLOWER[0]).px(pt[0] + 1, pt[1], FLOWER[0]).px(pt[0], pt[1] + 1, APRON_G[2]);
      if (handsFree(pose)) return;
      // 花束(胸の前)。茎は下へ、花は上
      const [hx, hy] = R(pose.aF.h);
      // 葉と茎はエプロンの緑を使う(色を節約する)
      sprite(Pn, hx - 1, hy - 1, ['gg', 'gg', 'g.'], { g: APRON_G[1] });
      sprite(Pn, hx - 3, hy - 7, [
        '.pyp.',
        'pwpyl',
        'ylpwp',
        '.pgl.',
        '..gg.'
      ], { p: FLOWER[0], y: FLOWER[1], w: FLOWER[2], l: FLOWER[3], g: APRON_G[0] });
    }
  };
}

function florist(): { look: Look; base: Pose; sort: Pose[] } {
  const base = withFace(STAND, 'grin');
  base.aF = { e: [31, 29], h: [36, 30] };
  const f0 = tag(base, {});
  // 花束を下げて持ち直す。花びらが1枚、頭の横から舞い落ちる
  const f1 = tag(withFace(base, 'normal', { down: true }), { petal: [42, 12] });
  f1.aF = { e: [31, 30], h: [35, 33] };
  const f2 = tag(moveUpper(base, 0, -1), { petal: [44, 17] });
  f2.aF = { e: [31, 28], h: [36, 28] };
  const f3 = tag(base, { petal: [43, 23] });
  return { look: floristLook(), base, sort: [f0, f1, f2, f3] };
}

// =====================================================================
// 1階:配達員(帽子、青い上着とズボン、段ボール)
// 見た目のくせ:段ボールをかかえ直す。帽子をかぶり直す
// =====================================================================
const COURIER: Ramp = [md(3, 5, 6), md(2, 3, 5), md(1, 2, 3)];
const BOX: Ramp = [md(6, 5, 3), md(5, 4, 2), md(3, 2, 1)];
/** つばが前(右)にある帽子。c:ふつう、L:光、d:影、b:つば */
const CAP_ROWS = [
  '..ccccccc....',
  '.cLLcccccc...',
  '.cLccccccccbb',
  'dddddddddbbbb'
];
function capOn(g: PixelGrid, ramp: Ramp, dy = 0): void {
  CAP_ROWS.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const c = { c: ramp[1], L: ramp[0], d: ramp[2], b: ramp[2] }[r[x]];
      if (c) g.px(x, y + dy, c);
    }
  });
}

function courierLook(): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: COURIER, sleeve: 'short', bottom: COURIER, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: WIDE,
    headExtra(g) { capOn(g, COURIER); },
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      // 胸の白い線(反射材)
      for (let dx = -5; dx <= 6; dx++) Pn.px(Math.round(n[0] + dx + l * 9), n[1] + 9, WHITE[0]);
    },
    front(Pn, pose) {
      spreadFingers(Pn, pose);
      if (handsFree(pose)) return;
      // 両手で持った段ボール(ガムテープは白)
      const [hx, hy] = R(pose.aF.h);
      sprite(Pn, hx - 3, hy - 9, [
        'LLLLLLLLLLL',
        'LbbbbTbbbbd',
        'bbbbbTbbbbd',
        'bbbbbbbbbbd',
        'bbbbbbbbbbd',
        'bbbbbbbbbbd',
        'bbbbbbbbbbd',
        'dddddddddd.'
      ], { L: BOX[0], b: BOX[1], d: BOX[2], T: WHITE[2] });
      Pn.rect(hx - 2, hy - 2, 2, 2, SKIN[0]);
    }
  };
}

function courier(): { look: Look; base: Pose; sort: Pose[] } {
  const base = clonePose(STAND);
  base.aF = { e: [31, 29], h: [35, 34] };
  base.aB = { e: [38, 29], h: [42, 33] };
  const f0 = tag(base, {});
  // 段ボールをはずませてかかえ直す
  const f1 = tag(moveUpper(base, 0, 1), {});
  f1.aF = { e: [31, 30], h: [35, 32] };
  f1.aB = { e: [38, 30], h: [42, 31] };
  // 奥の手で帽子のつばをつまんで、かぶり直す
  const f2 = tag(withFace(base, 'shut'), {});
  f2.aB = { e: [41, 24], h: [42, 13] };
  const f3 = tag(withFace(base, 'grin'), {});
  f3.aB = { e: [41, 25], h: [42, 15] };
  return { look: courierLook(), base, sort: [f0, f1, f2, f3] };
}

// =====================================================================
// 18階:新人の会社員(明るい紺のスーツ、社員証、書類の束)
// 見た目のくせ:書類の束を落としかけて、あわててかかえ直す
// =====================================================================
const NAVY: Ramp = [md(3, 4, 6), md(2, 3, 5), md(1, 2, 3)];
const LANYARD = md(6, 2, 1);
const MEMO = md(7, 6, 2);

function newbieLook(): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: NAVY, sleeve: 'long', bottom: NAVY, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: SLIM, cuff: WHITE[0],
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + l * dy);
      for (let dy = 0; dy <= 5; dy++) for (let dx = 1; dx <= 4 - Math.floor(dy / 2); dx++) Pn.px(X(dx, dy), n[1] + dy, WHITE[0]);
      // 首から下げた社員証
      for (let dy = 0; dy <= 6; dy++) Pn.px(X(0, dy), n[1] + dy, LANYARD);
      Pn.rect(X(-1, 7), n[1] + 7, 3, 3, WHITE[0]).px(X(0, 8), n[1] + 8, NAVY[1]);
    },
    front(Pn, pose) {
      spreadFingers(Pn, pose);
      if (handsFree(pose)) return;
      // 胸にかかえた書類の束(手前の手でおさえる)。ずれると上の紙が前へすべる
      const [hx, hy] = R(pose.aF.h);
      const slip = P(pose).slip ?? 0;
      const rows = ['wwwwwww', 'wgggggw', 'wwwwwww', 'ywwwwwW', 'wwwwwwW'];
      sprite(Pn, hx - 3, hy - 5, rows, { w: WHITE[0], W: WHITE[2], g: WHITE[2], y: MEMO });
      if (slip) {
        // すべり出た紙(前へ飛び出して、下へたれる)
        const sx = hx + 3 + slip, sy = hy - 5 + slip * 2;
        sprite(Pn, sx, sy, slip === 2 ? ['wwww', 'wggw', '.www'] : ['wwww', 'wggw'], { w: WHITE[0], g: WHITE[2] });
      }
      Pn.rect(hx - 1, hy + 1, 2, 2, SKIN[0]);
    }
  };
}

function newbie(): { look: Look; base: Pose; sort: Pose[] } {
  const base = withFace(STAND, 'worried');
  base.aF = { e: [31, 30], h: [36, 32] };
  const f0 = tag(base, {});
  // 束がずれて前へすべり出す → 大きくずれて、あわてる → 胸に押しつけて、ほっとする
  const f1 = tag(moveUpper(base, 1, 0), { slip: 1 });
  f1.aF = { e: [32, 31], h: [37, 34] };
  const f2 = tag(withFace(moveUpper(base, 1, 1), 'worried', { sweat: true }), { slip: 2 });
  f2.aF = { e: [32, 32], h: [38, 35] };
  const f3 = tag(withFace(base, 'shut'), {});
  f3.aF = { e: [31, 29], h: [35, 30] };
  return { look: newbieLook(), base, sort: [f0, f1, f2, f3] };
}

// =====================================================================
// 18階:清掃員(水色のつなぎ、帽子、モップ)
// 見た目のくせ:モップを左右にかける
// =====================================================================
const JANI: Ramp = [md(4, 6, 6), md(3, 5, 5), md(2, 3, 4)];
const MOP_HEAD: Ramp = [md(7, 7, 6), md(6, 6, 5), md(4, 4, 4)];
const STICK = md(5, 3, 1);

function janitorLook(): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: JANI, sleeve: 'long', bottom: JANI, legs: 'pants', shoes: [JANI[2], OUTLINE, OUTLINE], sole: OUTLINE,
    build: WIDE,
    headExtra(g) { capOn(g, JANI); },
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      // 胸当てのポケットとボタン
      Pn.rect(Math.round(n[0] + 1 + l * 6), n[1] + 6, 4, 3, JANI[2]).px(Math.round(n[0] + 2 + l * 6), n[1] + 6, JANI[0]);
    },
    front(Pn, pose) {
      spreadFingers(Pn, pose);
      if (handsFree(pose)) return;
      // モップ(手前の手でにぎり、体の前で床に当てる)。mop で先を左右にずらす
      const [hx, hy] = R(pose.aF.h);
      const mx = hx + 7 + (P(pose).mop ?? 0);
      const foot = Math.round(Math.max(pose.lF.a[1], pose.lB.a[1]));
      // 柄の上のはしは、あごより下(顔にかからないように)
      Pn.line([hx - 1, hy - 8], [mx, foot - 2], STICK);
      Pn.line([hx, hy - 8], [mx + 1, foot - 2], MOP_HEAD[2]);
      sprite(Pn, mx - 4, foot - 1, ['.mmmmmmmm.', 'mMmMmMmMmM'], { m: MOP_HEAD[0], M: MOP_HEAD[2] });
      Pn.rect(hx, hy - 1, 3, 3, SKIN[0]);
    }
  };
}

function janitor(): { look: Look; base: Pose; sort: Pose[] } {
  const base = withFace(STAND, 'shut');
  base.aF = { e: [31, 28], h: [35, 31] };
  // 手を左右に動かして、モップの先を床の上ですべらせる
  const sweep = (dx: number, mop: number, face: Pose['face']): P4 => {
    const p = tag(withFace(moveUpper(base, dx > 0 ? 1 : 0, 0), face), { mop });
    p.aF = { e: [31 + dx, 28], h: [35 + dx, 31] };
    return p;
  };
  return { look: janitorLook(), base, sort: [sweep(0, 0, 'shut'), sweep(2, 5, 'normal'), sweep(-1, -1, 'shut'), sweep(-2, -5, 'normal')] };
}

// =====================================================================
// 35階:シェフ(白いコック服、高いコック帽、赤いスカーフ、おたま)
// 見た目のくせ:おたまで味見をする。湯気が上がる
// =====================================================================
const CHEF: Ramp = [WHITE[0], md(6, 6, 7), md(5, 5, 6)];
const SCARF = md(6, 1, 1);
const PANTS: Ramp = [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)];
const LADLE = md(3, 3, 4);

function chefLook(): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: CHEF, sleeve: 'long', bottom: PANTS, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: WIDE, cuff: CHEF[2],
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      // 首のスカーフと、2列のボタン
      Pn.rect(Math.round(n[0] - 1), n[1], 5, 2, SCARF).px(Math.round(n[0] + 4), n[1] + 2, SCARF);
      for (const dy of [5, 9, 13]) Pn.px(Math.round(n[0] + 1 + l * dy), n[1] + dy, CHEF[2]).px(Math.round(n[0] + 5 + l * dy), n[1] + dy, CHEF[2]);
    },
    front(Pn, pose) {
      // コック帽(頭の上)。頭が下を向いても、かぶったまま
      const [hx, hy] = R(pose.head);
      sprite(Pn, hx - 4, hy - 17 + (pose.down ? 1 : 0), [
        '.wwwWWw..',
        'wwwwwwwW.',
        'wwwwwwwWw',
        'wwwwwwwWW',
        '.wwwwwwW.',
        '.wwwwwwW.',
        '.ssssssS.',
        '.ssssssS.'
      ], { w: CHEF[0], W: CHEF[2], s: CHEF[1], S: CHEF[2] });
      spreadFingers(Pn, pose);
      if (handsFree(pose)) return;
      // おたま(手前の手)。柄は手から右上へ、お皿は柄の先。白い服にとけないように暗い銀にする
      const [ax, ay] = R(pose.aF.h);
      Pn.line([ax, ay - 1], [ax + 1, ay - 6], LADLE);
      sprite(Pn, ax - 1, ay - 9, ['.sss.', 'sWWWs', '.sss.'], { s: LADLE, W: WHITE[0] });
      // 湯気(白いくねった線)
      const st = P(pose).steam;
      if (st) {
        const sx = ax + 1, sy = ay - 11;
        const pts: Pt[] = st === 1 ? [[0, 0], [1, -1], [0, -2]] : [[1, -1], [0, -2], [1, -3], [2, -4], [1, -5]];
        for (const [dx, dy] of pts) Pn.px(sx + dx, sy + dy, WHITE[0]);
      }
    }
  };
}

function chef(): { look: Look; base: Pose; sort: Pose[] } {
  const base = withFace(STAND, 'grin');
  base.aF = { e: [31, 29], h: [37, 31] };
  const f0 = tag(base, { steam: 1 });
  // おたまを口もとへ上げて味見 → うなずく(目を閉じる)。湯気が上へのびる
  const f1 = tag(withFace(base, 'normal'), { steam: 2 });
  f1.aF = { e: [32, 28], h: [38, 27] };
  const f2 = tag(withFace(base, 'shut'), {});
  f2.aF = { e: [32, 27], h: [37, 25] };
  const f3 = tag(withFace(base, 'grin'), { steam: 2 });
  f3.aF = { e: [31, 28], h: [38, 29] };
  return { look: chefLook(), base, sort: [f0, f1, f2, f3] };
}

// =====================================================================
// 35階:ウェイター(黒いベスト、白いシャツ、蝶ネクタイ、グラスをのせたお盆)
// 見た目のくせ:お盆のグラスのかたむきを直す
// =====================================================================
const GLASS = md(6, 7, 7);
const WINE_Y = md(7, 6, 2);
const BOWTIE_RED = md(4, 0, 1);

function waiterLook(goldTie = false): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SLICK,
    top: SHIRT, sleeve: 'long', bottom: BLACK, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: SLIM,
    torso(Pn, pose, top) {
      const n = pose.neck, l = lean(pose);
      const vest = Pn.mask();
      top.each((x, y) => {
        const cx = n[0] + 2 + l * (y - n[1]);
        const open = Math.max(0, 3 - (y - n[1]) / 2.5);
        if (y >= n[1] + 1 && Math.abs(x - cx) > open) vest.set(x, y);
      });
      Pn.fill(vest, BLACK, { sep: 'none', hi: 0.3, lo: 0.7 });
      // 蝶ネクタイ(親玉は金色で、ひとまわり大きい)
      const bx = Math.round(n[0] + 2), by = n[1];
      if (goldTie) {
        sprite(Pn, bx - 2, by - 1, ['gg.gg', 'gGoGg', 'gg.gg'], { g: GOLD[1], G: GOLD[0], o: GOLD[2] });
      } else {
        Pn.rect(bx - 2, by, 2, 2, OUTLINE).rect(bx + 1, by, 2, 2, OUTLINE).px(bx, by, BOWTIE_RED);
      }
    },
    front(Pn, pose) {
      spreadFingers(Pn, pose);
      if (pose.face === 'surprised' || pose.face === 'hurt' || pose.face === 'ko') return;
      // 上げた奥の手のお盆とグラス(顔の右上)。念力の行でも、奥の手のお盆はそのまま
      const [hx, hy] = R(pose.aB.h);
      sprite(Pn, hx - 6, hy - 2, ['ssssssssssss'], { s: WHITE[2] });
      const tip = P(pose).tip ?? 0;
      [hx - 4, hx, hx + 4].forEach((gx, i) => {
        // まん中のグラスだけが傾く
        const rows = i === 1 && tip ? (tip > 0 ? ['.gg', 'yy.', '.g.', '.g.'] : ['gg.', '.yy', '.g.', '.g.']) : ['gg', 'yy', '.g', '.g'];
        sprite(Pn, gx - (i === 1 && tip ? 1 : 0), hy - 7, rows, { g: GLASS, y: WINE_Y });
      });
    }
  };
}

function waiter(): { look: Look; base: Pose; sort: Pose[] } {
  const base = clonePose(STAND);
  base.aB = { e: [43, 25], h: [46, 19] };
  const f0 = tag(base, {});
  // まん中のグラスが傾く → 見上げて、手前の手をのばす → 直して、すまし顔
  const f1 = tag(withFace(base, 'worried'), { tip: 1 });
  const f2 = tag(withFace(base, 'normal'), { tip: -1 });
  f2.aF = { e: [36, 23], h: [42, 17] };
  const f3 = tag(withFace(base, 'sly'), {});
  f3.aF = { e: [34, 25], h: [39, 22] };
  return { look: waiterLook(), base, sort: [f0, f1, f2, f3] };
}

// =====================================================================
// 最上階:ドレスの女性(ワイン色のドレス、羽の髪飾り、金のバッグ)
// 見た目のくせ:髪飾りの羽をさわる
// =====================================================================
const WINE: Ramp = [md(6, 2, 3), md(4, 1, 2), md(3, 0, 1)];

function ladyLook(goldFeather = false): Look {
  const F = goldFeather ? [GOLD[0], GOLD[1], GOLD[2]] : [WHITE[0], WHITE[2], GOLD[1]];
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_BUN,
    top: WINE, sleeve: 'none', bottom: WINE, legs: 'longskirt', shoes: [GOLD[1], GOLD[2], GOLD[2]], sole: GOLD[2],
    build: LADY,
    headExtra(g, pose) {
      // 髪飾りの羽(頭の後ろ上に2本)。さわると先が下へ曲がる
      if (P(pose).bend) g.px(0, 2, F[0]).px(0, 3, F[0]).px(1, 2, F[1]).px(2, 1, F[1]).px(1, 3, F[1]).px(3, 2, F[2]).px(2, 3, F[2]);
      else g.px(1, 0, F[0]).px(0, 1, F[0]).px(1, 1, F[1]).px(2, 1, F[1]).px(1, 2, F[1]).px(3, 2, F[2]).px(2, 3, F[2]);
    },
    torso(Pn, pose) {
      const n = pose.neck;
      // 首かざり
      Pn.px(Math.round(n[0] + 1), n[1] + 1, GOLD[0]).px(Math.round(n[0] + 2), n[1] + 2, GOLD[1]).px(Math.round(n[0] + 3), n[1] + 1, GOLD[0]);
    },
    front(Pn, pose) {
      spreadFingers(Pn, pose);
      if (handsFree(pose)) return;
      // 小さな金のバッグ(手前の手が下にあるときだけ)
      const [hx, hy] = R(pose.aF.h);
      if (hy < 30) return;
      sprite(Pn, hx - 2, hy, ['.o.', 'ggg', 'gGg'], { o: GOLD[2], g: GOLD[1], G: GOLD[2] });
    }
  };
}

function lady(): { look: Look; base: Pose; sort: Pose[] } {
  const base = withFace(STAND, 'sly');
  base.aF = { e: [30, 28], h: [31, 35] };
  const f0 = tag(base, {});
  // 手前の手を頭の後ろ(左上)へ上げて、羽の先をつまむ(奥の手だと顔にかかるので)
  const f1 = tag(withFace(base, 'normal'), {});
  f1.aF = { e: [26, 22], h: [28, 12] };
  const f2 = tag(withFace(base, 'shut'), { bend: true });
  f2.aF = { e: [26, 21], h: [29, 10] };
  const f3 = tag(withFace(base, 'grin'), {});
  f3.aF = { e: [26, 24], h: [28, 15] };
  return { look: ladyLook(), base, sort: [f0, f1, f2, f3] };
}

// =====================================================================
// 最上階:手品師(えんび服、シルクハット、つえ)
// 見た目のくせ:つえをくるりと回す。糸で吊ったカードは、紛らわしい市民のときにコードで重ねる
// =====================================================================
const HAT_BAND = md(6, 1, 1);
const CANE = WHITE[2];
/** 親玉のつえの先のビルの灰色 */
const TOWER = md(3, 3, 4);
/** つえの長さ */
const CANE_LEN = 12;

/** つえの先の点(64×64のコマの中) */
function caneTip(pose: Pose): Pt {
  const [ax, ay] = R(pose.aF.h);
  const ang = P(pose).cane ?? -0.7;
  return [Math.round(ax + Math.cos(ang) * CANE_LEN), Math.round(ay + Math.sin(ang) * CANE_LEN)];
}

function magicianLook(tower = false): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SLICK,
    top: BLACK, sleeve: 'long', bottom: BLACK, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: SLIM, cuff: WHITE[0],
    behind(Pn, pose) {
      // えんび服のすそ(後ろにのびる)
      const p = pose.hip;
      sprite(Pn, Math.round(p[0] + 3), Math.round(p[1] - 2), ['bb.', 'bbb', 'bbb', '.bb', '.bb', '..b'], { b: BLACK[1] });
    },
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + l * dy);
      for (let dy = 0; dy <= 8; dy++) for (let dx = 1; dx <= 4 - Math.floor(dy / 3); dx++) Pn.px(X(dx, dy), n[1] + dy, WHITE[0]);
      Pn.rect(X(1, 0), n[1], 4, 1, OUTLINE).px(X(3, 1), n[1] + 1, OUTLINE);
      Pn.px(X(3, 10), n[1] + 10, HAT_BAND);
    },
    front(Pn, pose) {
      // シルクハット(頭が下を向いても、かぶったまま)
      const [hx, hy] = R(pose.head);
      sprite(Pn, hx - 5, hy - 16 + (pose.down ? 1 : 0), [
        '..hhhhhhh...',
        '..hHhhhhh...',
        '..hHhhhhh...',
        '..rrrrrrr...',
        'bbbbbbbbbbbb'
      ], { h: BLACK[1], H: BLACK[0], r: HAT_BAND, b: OUTLINE });
      spreadFingers(Pn, pose);
      if (handsFree(pose)) return;
      // つえ(黒い棒、白い先)。親玉は先がビルの形
      const [ax, ay] = R(pose.aF.h);
      const ang = P(pose).cane ?? -0.7;
      const tip = caneTip(pose);
      const butt: Pt = [Math.round(ax - Math.cos(ang) * 3), Math.round(ay - Math.sin(ang) * 3)];
      // 黒い服にとけないように、棒は銀、両はしは白
      Pn.line(butt, tip, CANE);
      if (tower) {
        // ビルの形(灰色の細長い四角、とがった屋根、黄色い窓)。先の点の上に立てる
        sprite(Pn, tip[0] - 1, tip[1] - 6, ['.t.', 'www', 'wyw', 'www', 'wyw', 'www'], { t: TOWER, w: TOWER, y: GOLD[0] });
      } else {
        Pn.px(tip[0], tip[1], WHITE[0]).px(butt[0], butt[1], WHITE[0]);
      }
      // にぎった手を、つえの上に
      Pn.rect(ax - 1, ay - 1, 2, 2, SKIN[0]);
    }
  };
}

function magician(): { look: Look; base: Pose; sort: Pose[] } {
  const base = withFace(STAND, 'sly');
  base.aF = { e: [31, 28], h: [35, 31] };
  // つえをくるりと回す(右上 → 右下 → 左下 → 左。角度は右回りに増える。顔にはかからない)
  const spin = (cane: number, face: Pose['face']): P4 => tag(withFace(base, face), { cane });
  return { look: magicianLook(), base, sort: [spin(-0.7, 'sly'), spin(0.6, 'grin'), spin(1.9, 'grin'), spin(3.3, 'sly')] };
}

/**
 * tw_magician の待機(行0)と仕分けの動き(行2)の、つえの先の点(右向きのコマの中のドット)。
 * 紛らわしい市民の「手品の糸」を、コードでここから引くときに使う
 */
export function magicianCaneTips(): { idle: Pt[]; sortIdle: Pt[] } {
  const { base, sort } = magician();
  return { idle: idleFrames(base).map(caneTip), sortIdle: sort.map(caneTip) };
}

// =====================================================================
// 親玉の化けた姿:市民の絵を少し大きくして、1か所だけおかしくする(もれは出さない)
// =====================================================================

export function buildPeople4(skip: Set<string>): Record<string, PixelGrid[][]> {
  const out: Record<string, PixelGrid[][]> = {};
  const makers: [string, () => { look: Look; base: Pose; sort: Pose[] }][] = [
    ['tw_florist', florist], ['tw_courier', courier], ['tw_newbie', newbie], ['tw_janitor', janitor],
    ['tw_chef', chef], ['tw_waiter', waiter], ['tw_lady', lady], ['tw_magician', magician]
  ];
  for (const [key, make] of makers) {
    if (skip.has(key)) continue;
    const { look, base, sort } = make();
    out[key] = towerRows(look, base, sort);
  }
  const dis = (key: string, make: () => { base: Pose; sort: Pose[] }, look: Look) => {
    if (skip.has(key)) return;
    const { base, sort } = make();
    out[key] = disguiseRows(look, base, sort, { sx: 1.05 });
  };
  dis('tw_boss_lady', lady, ladyLook(true));
  dis('tw_boss_magician', magician, magicianLook(true));
  dis('tw_boss_waiter', waiter, waiterLook(true));
  return out;
}
