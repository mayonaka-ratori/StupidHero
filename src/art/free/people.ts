// フリープレイの一目で分かるワル(docs/FREEPLAY.md の「人」)。今のワルの絵をもとに、目印を丸出しにする。
//   fp_mohawk:ナイフを頭の上に振りかざしたモヒカン(路地裏のモヒカンの見た目。髪を高くした)
//   fp_gang:顔をバンダナで隠し、金属バットを持ったギャング(地下駐車場の派手な若者の見た目)
//   fp_alien:頭から触角が出て、肌が緑の宇宙人(ショッピングモールのロボットダンスの学生の見た目)
// 行はふつうのワルと同じ7行。武器は顔の向き(右)の側に、波3の小物(風船、帽子)は頭の上と後ろ(左)に来るので、
// 小物を重ねても目印は隠れない。赤紫(KEY_ACCESSORY)は使わない(塗り替えないため)。
import { md, OUTLINE, type PixelGrid } from '../lib';
import { type HairStyle, type Look, type Pose, clonePose, dark, drawPerson, moveUpper } from '../world/figure';
import { BLADE, SKIN, WHITE } from '../world/palette';
import { MOHAWK, mohawkLook } from '../world/people';
import type { Painter, Pt, Ramp } from '../world/pix';
import { STAND, civRows, walkFrames, withFace } from '../world/poses';
import { type P2, HAIR_SPIKE, clubLook, whistleRow } from '../world2/people';
import { GLITCH } from '../world3/palette';
import { dancerLook, signalRow, withSignal } from '../world3/people';


/** 武器の向き(ラジアン)をポーズに持たせる */
interface PW extends P2 { weapon?: number | null }
const W = (p: Pose): PW => p as PW;
const arm = (p: Pose, e: Pt, h: Pt, weapon: number | null): PW => {
  const q = W(clonePose(p));
  q.aB = { e, h };
  q.weapon = weapon;
  return q;
};
/** 体のずれに合わせて、base の奥の腕(武器を持つ腕)を付け直す */
const keepArm = (base: Pose, p: Pose, weapon: number | null): PW => {
  const dx = p.neck[0] - base.neck[0], dy = p.neck[1] - base.neck[1];
  return arm(p, [base.aB.e[0] + dx, base.aB.e[1] + dy], [base.aB.h[0] + dx, base.aB.h[1] + dy], weapon);
};

// =====================================================================
// モヒカン:大きなナイフを頭の上に振りかざす
// =====================================================================

/** 高く立てたモヒカン(ふつうのモヒカンより3ドット高い)。上の端をぎざぎざにして、とんがり帽子と見分ける */
const HAIR_MOHAWK_TALL: HairStyle = {
  top: 6,
  ear: true,
  rows: [
    '..H..H..H....',
    '..HH.HH.HH...',
    '.hHHhHHhHHh..',
    '.hHHHHHHHhh..',
    '.hhHHHhhhhh..',
    '.hHHhhhhhhh..',
    '.hHhhhhhhhh..',
    '.shhhhhhhhs..',
    '.sss.........',
    '.ss..........',
    '.s...........'
  ]
};

/** 大きなナイフ。h は手、ang は刃の向き。刃は10ドット、つばは金 */
function bigKnife(P: Painter, h: Pt, ang: number): void {
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (d: number): Pt => [h[0] + c * d, h[1] + s * d];
  // 柄(手の後ろ)
  P.fill(P.mask().capsule(at(-3.5), at(-1), 0.9), [MOHAWK[2], MOHAWK[2], OUTLINE], { sep: 'outline', flat: true });
  // 刃:根元が太く、先がとがる。背の側に光の線(色の数を15に収めるため、影は2段)
  const m = P.mask().capsule(at(2), at(11), 1.5, 0.3);
  P.fill(m, [BLADE[0], BLADE[1], BLADE[1]], { sep: 'outline', hi: 0.45, lo: 0.8 });
  P.line(at(2.5), at(10), BLADE[0]);
  // つば(刃と直角の短い線)
  const n: Pt = [-s, c];
  const g0 = at(1.4);
  P.line([g0[0] - n[0] * 2.2, g0[1] - n[1] * 2.2], [g0[0] + n[0] * 2.2, g0[1] + n[1] * 2.2], OUTLINE);
  // 手を上に描き直す(柄をにぎる)
  const hand = P.mask().ellipse(h[0], h[1], 1.7, 1.7);
  P.fill(hand, dark(SKIN), { sep: 'outline' });
}

function fpMohawkLook(): Look {
  const base = mohawkLook(null);
  const top = HAIR_MOHAWK_TALL.top;
  return {
    ...base,
    hairStyle: HAIR_MOHAWK_TALL,
    headExtra(g, pose) {
      // 傷とサングラス(ふつうのモヒカンと同じ。髪が高いぶん下へずらす)
      const t = top + (pose.down ? 1 : 0);
      if (pose.face !== 'ko' && pose.face !== 'hurt') {
        for (let x = 7; x <= 11; x++) g.px(x, t + 4, OUTLINE);
        g.px(9, t + 5, OUTLINE); g.px(10, t + 5, OUTLINE); g.px(8, t + 4, MOHAWK[0]);
      }
      g.px(7, t + 7, SKIN[2]); g.px(8, t + 8, SKIN[2]);
    },
    front(P, pose) {
      base.front?.(P, pose);
      const w = W(pose).weapon;
      if (w !== undefined && w !== null) bigKnife(P, pose.aB.h, w);
    }
  };
}

function fpMohawkSheets(): PixelGrid[][] {
  const look = fpMohawkLook();
  // 少しがに股で前かがみ。奥の手でナイフを頭の上に振りかざす
  const body = withFace(STAND, 'angry');
  body.lB = { k: [37, 47], a: [37, 56] }; body.lF = { k: [28, 47], a: [27, 56] };
  body.hip = [32, 38]; body.head = [34, 19]; body.neck = [33, 20];
  body.aF = { e: [30, 30], h: [35, 33] };
  const UP = -1.45;
  const base = arm(body, [44, 19], [46, 12], UP);
  // 仕分けの動き:ナイフを頭の上で振って見せる
  const sort = [
    arm(body, [44, 19], [46, 12], UP),
    arm(withFace(moveUpper(body, 0, 1), 'angry'), [45, 20], [48, 14], -1.1),
    arm(withFace(body, 'grin'), [44, 19], [46, 12], UP),
    arm(withFace(moveUpper(body, 0, 1), 'grin'), [43, 19], [44, 12], -1.75)
  ];
  const walk = walkFrames(body).map((p) => keepArm(base, p, UP));
  const noKnife: Look = { ...look, front: mohawkLook(null).front };
  // 驚くと、ナイフは手放す(両手を上げると顔に重なるので)
  const rows = civRows(look, base, sort, {
    walk,
    lookFor: (_p, row) => (row >= 3 ? noKnife : look)
  });
  // 悪さ:ナイフで脅す(振りかぶる → 踏みこむ → 前へ突き出す(当たり) → 突きつけたまま)
  const f0 = arm(withFace(clonePose(body), 'angry'), [41, 16], [41, 9], -1.75);
  f0.head = [33, 19]; f0.neck = [32, 20];
  const f1 = arm(withFace(clonePose(body), 'angry'), [45, 19], [50, 17], -0.6);
  f1.head = [37, 19]; f1.neck = [35, 20];
  f1.lF = { k: [33, 47], a: [33, 56] };
  const f2 = arm(withFace(clonePose(body), 'grin'), [45, 25], [50, 25], 0);
  f2.head = [40, 20]; f2.neck = [38, 21]; f2.hip = [34, 38];
  f2.lB = { k: [42, 47], a: [45, 56] }; f2.lF = { k: [30, 48], a: [26, 55], toe: 0.3 };
  const f3 = arm(withFace(clonePose(body), 'grin'), [44, 25], [49, 24], -0.15);
  f3.head = [38, 19]; f3.neck = [36, 20]; f3.hip = [33, 38];
  f3.lB = { k: [41, 47], a: [43, 56] };
  rows.push([f0, f1, f2, f3].map((p) => drawPerson(look, p)));
  return rows;
}

// =====================================================================
// ギャング:顔をバンダナで隠し、金属バットを持つ
// =====================================================================

/**
 * バンダナ(青に白の水玉)。赤はヒーローの光と、赤紫は塗り替えとまぎれるので使わない。
 * 暗い色だと目がバンダナにまぎれるので、明るめの青にする。上の折り目は上着の銀と同じ色(15色に収める)
 */
const BANDANA: Ramp = [md(5, 5, 6), md(2, 2, 6), md(1, 1, 4)];
/** 金属バット(銀)とにぎりのテープ */
const BAT: Ramp = [WHITE[0], md(5, 5, 6), md(3, 3, 5)];
const GRIP = md(1, 1, 2);

/** 顔の下半分(鼻から下)をおおうバンダナと、後ろの結び目 */
function bandana(g: PixelGrid, pose: Pose): void {
  const t = HAIR_SPIKE.top + (pose.down ? 1 : 0);
  const rows = [
    // 行は顔の6行目(鼻の下)から、あごの下まで。列は頭の格子の0〜13。k は後ろの結び目
    '.k...o0000000.',
    'kkk.o111w11112',
    '.kk.o111111w12',
    'k...o1w1111112',
    '.....o11w1112.',
    '......o2112o..'
  ];
  rows.forEach((r, j) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      const c = ch === '0' ? BANDANA[0] : ch === '1' ? BANDANA[1] : ch === '2' || ch === 'k' ? BANDANA[2]
        : ch === 'w' ? WHITE[0] : ch === 'o' ? OUTLINE : null;
      if (c) g.px(x, t + 6 + j, c);
    }
  });
}

/** 金属バット。h はにぎる手、ang は先の向き */
function metalBat(P: Painter, h: Pt, ang: number, far: boolean): void {
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (d: number): Pt => [h[0] + c * d, h[1] + s * d];
  const m = P.mask().capsule(at(-2.5), at(5), 0.8, 0.9).union(P.mask().capsule(at(5), at(18), 0.9, 1.7));
  P.fill(m, BAT, { sep: 'outline', hi: 0.4, lo: 0.75 });
  P.line(at(6), at(17), BAT[0]);
  // にぎりのテープと、根元のこぶ
  P.line(at(-2), at(3.5), GRIP);
  P.fill(P.mask().ellipse(at(-3)[0], at(-3)[1], 1.2, 1.2), GRIP, { sep: 'outline', flat: true });
  // 手を上に描き直す
  P.fill(P.mask().ellipse(h[0], h[1], 1.7, 1.7), far ? dark(SKIN) : SKIN, { sep: 'outline' });
}

function fpGangLook(): Look {
  return clubLook({
    headExtra(g, pose) { bandana(g, pose); },
    farHand(P, pose) {
      const w = W(pose).weapon;
      if (w !== undefined && w !== null) metalBat(P, pose.aB.h, w, true);
    }
  });
}

function fpGangSheets(): PixelGrid[][] {
  const look = fpGangLook();
  const body = withFace(STAND, 'angry');
  body.aF = { e: [30, 29], h: [33, 35] };
  // 奥の手で、バットを前へ立てて持つ
  const B = -1.2;
  const base = arm(body, [41, 29], [44, 32], B);
  const sort = [
    arm(body, [41, 29], [44, 32], B),
    arm(withFace(moveUpper(body, 0, 1), 'angry'), [41, 29], [45, 31], -1.0),
    arm(withFace(body, 'sly'), [41, 28], [44, 31], B),
    arm(withFace(moveUpper(body, 0, 1), 'angry'), [41, 29], [44, 32], -1.4)
  ];
  const walk = walkFrames(body).map((p) => keepArm(base, p, B));
  const noBat: Look = { ...look, farHand: undefined };
  const rows = civRows(look, base, sort, { walk, lookFor: (_p, row) => (row >= 3 ? noBat : look) });
  // 悪さ:口笛で仲間を呼ぶ(地下駐車場のギャングと同じ動き)。手まねきする奥の手でバットを振り上げる
  const wr = whistleRow(base);
  const ms: PW[] = [
    keepArm(base, wr[0], B),
    keepArm(base, wr[1], B),
    arm(wr[2], [44, 18], [48, 15], -0.95),
    arm(wr[3], [45, 20], [49, 17], -0.8)
  ];
  rows.push(ms.map((p) => drawPerson(look, p)));
  return rows;
}

// =====================================================================
// 宇宙人:頭から触角が出て、肌が緑
// =====================================================================

/** 宇宙人の緑の肌。明るい緑(R0 G255 B0)と、くずれの黄緑とはちがう色 */
const ALIEN_SKIN: Ramp = [md(4, 7, 5), md(2, 6, 3), md(1, 4, 2)];
/** 髪はない。頭の上に触角を描くところを6行空けておく */
const HAIR_NONE_ANTENNA: HairStyle = { top: 6, ear: true, rows: [] };

/** 触角(頭の格子に描く)と、黒い大きな目 */
function antennae(g: PixelGrid, pose: Pose): void {
  const t = HAIR_NONE_ANTENNA.top;
  const d = pose.down ? 1 : 0;
  // 奥の触角と手前の触角。根元から外へ開いて立つ
  const stalk = ALIEN_SKIN[2];
  g.px(5, t, stalk).px(5, t - 1, stalk).px(4, t - 2, stalk).px(4, t - 3, stalk);
  g.px(9, t, stalk).px(9, t - 1, stalk).px(10, t - 2, stalk).px(10, t - 3, stalk);
  // 先の玉(黄緑に光る)
  for (const [x, y] of [[3, t - 5], [10, t - 5]] as const) {
    g.px(x, y, GLITCH[1]).px(x + 1, y, GLITCH[1]).px(x, y + 1, GLITCH[1]).px(x + 1, y + 1, GLITCH[2]).px(x, y, GLITCH[0]);
  }
  // 目:黒くて大きい(ふつうの目より1ドット広く、1ドット長い)。気を失ったときはそのまま
  if (pose.face === 'ko' || pose.face === 'hurt' || pose.face === 'shut') return;
  const y = t + d;
  for (let r = 3; r <= 5; r++) g.px(9, y + r, OUTLINE).px(10, y + r, OUTLINE);
  g.px(8, y + 4, OUTLINE);
  g.px(9, y + 3, WHITE[0]);
  // まゆのかわりの、目の上のくぼみ
  g.px(8, y + 2, ALIEN_SKIN[2]).px(9, y + 2, ALIEN_SKIN[2]).px(10, y + 2, ALIEN_SKIN[2]);
}

function fpAlienLook(): Look {
  return withSignal({
    ...dancerLook(),
    skin: ALIEN_SKIN,
    hair: [ALIEN_SKIN[1], ALIEN_SKIN[2], ALIEN_SKIN[2]],
    hairStyle: HAIR_NONE_ANTENNA,
    headExtra(g, pose) { antennae(g, pose); }
  }, ALIEN_SKIN[0]);
}

function fpAlienSheets(): PixelGrid[][] {
  const look = fpAlienLook();
  const base = withFace(STAND, 'sly');
  // 仕分けの動き:首をかしげて、手をかくかく動かす
  const n = base.neck;
  const s0 = withFace(base, 'sly');
  const s1 = withFace(moveUpper(base, 0, 1), 'grin');
  s1.aF = { e: [n[0] + 4, n[1] + 8], h: [n[0] + 9, n[1] + 8] };
  const s2 = withFace(base, 'sly', { look: -1 });
  s2.aF = { e: [n[0] + 4, n[1] + 8], h: [n[0] + 4, n[1] + 1] };
  const s3 = withFace(moveUpper(base, 0, 1), 'normal');
  const rows = civRows(look, base, [s0, s1, s2, s3]);
  // 悪さ:空へ合図を送る(ショッピングモールの宇宙人と同じ動き)
  rows.push(signalRow(base).map((p) => drawPerson(look, p)));
  return rows;
}

// ---------------------------------------------------------------------

export function buildFreePeople(skip: Set<string>): Record<string, PixelGrid[][]> {
  const out: Record<string, PixelGrid[][]> = {};
  if (!skip.has('fp_mohawk')) out.fp_mohawk = fpMohawkSheets();
  if (!skip.has('fp_gang')) out.fp_gang = fpGangSheets();
  if (!skip.has('fp_alien')) out.fp_alien = fpAlienSheets();
  return out;
}

