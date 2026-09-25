// ステージ2の人(警備員、整備士、派手な若者、会社員の女性)と、女ボスの化けた姿。
// 組の市民とギャングは同じ Look と同じポーズから作り、違うのは行2(sortIdle)の手の動きと行6だけ。
// 小物(腕章、首の布、ヘアバンド、スカーフ)は KEY_ACCESSORY の1色で、市民もギャングも同じ場所に同じ形で描く。
import { md, type PixelGrid } from '../lib';
import { KEY_ACCESSORY } from '../sheets';
import {
  type Build, type HairStyle, HAIR_SHORT, type Look, type Pose,
  clonePose, drawPerson, moveUpper, shoulders
} from '../world/figure';
import { GOLD, HAIR, OUTLINE, SKIN, WHITE } from '../world/palette';
import { type Painter, type Pt, type Ramp } from '../world/pix';
import { STAND, civRows, withFace } from '../world/poses';
import { disguiseRows } from '../world/bossKit';

const KEY = KEY_ACCESSORY;
const R = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];
/** スマホの本体(どの人のシートにもある暗い色) */
const PHONE = md(1, 1, 2);
/** スマホの画面の字の線 */
const PHONE_LINE = md(5, 5, 6);

/** 手の動きの印(ポーズに持たせる) */
type Gesture = 'v' | 'thumb' | 'tap' | 'beckon0' | 'beckon1' | 'whistle' | 'phone0' | 'phone1';
export interface P2 extends Pose {
  gest?: Gesture;
  /** 口:あくび、口笛 */
  mouth?: 'yawn' | 'whistle';
  /** 口笛の音の線 */
  waves?: 0 | 1 | 2;
}
const P = (p: Pose): P2 => p as P2;
const tag = (p: Pose, extra: Partial<P2>): P2 => Object.assign(clonePose(p), extra) as P2;

/** ギャングの6行。仕分けの行(2)だけが市民とちがうので、ほかの行は市民の絵を使い回す */
function badRows(look: Look, civ: PixelGrid[][], badSort: Pose[]): PixelGrid[][] {
  return [civ[0], civ[1], badSort.map((p) => drawPerson(look, p)), ...civ.slice(3)];
}

// ---------------------------------------------------------------------
// 共通の小さな道具
// ---------------------------------------------------------------------

/** 指を描く。fingers は指ごとのドットの列。手のまわり以外にふちを付ける */
function drawFingers(Pn: Painter, hand: Pt, fingers: Pt[][]): void {
  const on = new Set<string>();
  for (const f of fingers) for (const [x, y] of f) on.add(`${x},${y}`);
  for (const f of fingers) for (const [x, y] of f) Pn.px(x, y, SKIN[0]);
  const nb: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const f of fingers) for (const [x, y] of f) for (const [dx, dy] of nb) {
    const X = x + dx, Y = y + dy;
    if (on.has(`${X},${Y}`)) continue;
    if ((X - hand[0]) ** 2 + (Y - hand[1]) ** 2 <= 3.3) continue;
    Pn.px(X, Y, OUTLINE);
  }
}

/** ポーズの印に合わせて、手前の手の指を描く */
function drawGesture(Pn: Painter, pose: P2): void {
  const g = pose.gest;
  if (!g) return;
  const [hx, hy] = R(pose.aF.h);
  const h: Pt = [hx, hy];
  switch (g) {
    case 'v': // 人差し指と中指を立てる
      drawFingers(Pn, h, [[[hx - 1, hy - 2], [hx - 1, hy - 3], [hx - 1, hy - 4], [hx - 2, hy - 5]], [[hx + 1, hy - 2], [hx + 1, hy - 3], [hx + 2, hy - 4], [hx + 2, hy - 5]]]);
      break;
    case 'thumb': // 親指で後ろ(左)をさす
      drawFingers(Pn, h, [[[hx - 2, hy - 1], [hx - 3, hy - 1], [hx - 4, hy - 1], [hx - 5, hy - 1], [hx - 6, hy - 2]]]);
      break;
    case 'tap': // 人差し指を立ててヘアバンドをたたく
      drawFingers(Pn, h, [[[hx - 1, hy - 2], [hx - 1, hy - 3], [hx - 2, hy - 4], [hx - 2, hy - 5]]]);
      break;
    case 'beckon0': // 人差し指をまっすぐ前へ
      drawFingers(Pn, h, [[[hx + 2, hy - 1], [hx + 3, hy - 1], [hx + 4, hy - 1]]]);
      break;
    case 'beckon1': // 人差し指を曲げて手まねき
      drawFingers(Pn, h, [[[hx + 2, hy - 1], [hx + 3, hy - 2], [hx + 3, hy - 3], [hx + 2, hy - 4]]]);
      break;
    case 'phone0': // スマホを持って画面を見る(黒い本体と白く光る画面)
    case 'phone1': { // 親指で画面をなぞる
      const x0 = hx - 1, y0 = hy - 6;
      for (let y = y0 - 1; y <= y0 + 5; y++) for (let x = x0 - 1; x <= x0 + 3; x++) Pn.px(x, y, OUTLINE);
      for (let y = y0; y <= y0 + 4; y++) for (let x = x0; x <= x0 + 2; x++) Pn.px(x, y, WHITE[0]);
      Pn.px(x0, y0 + 4, PHONE).px(x0 + 1, y0 + 4, PHONE).px(x0 + 2, y0 + 4, PHONE);
      Pn.px(x0, y0 + (g === 'phone1' ? 1 : 2), PHONE_LINE).px(x0 + 1, y0 + (g === 'phone1' ? 1 : 2), PHONE_LINE);
      // 親指(手の上に出す)
      Pn.px(x0 + (g === 'phone1' ? 2 : 3), y0 + 3, SKIN[0]);
      break;
    }
    case 'whistle': // 指を口に当てる(人差し指と親指で輪)
      drawFingers(Pn, h, [[[hx + 1, hy - 2], [hx + 2, hy - 2]], [[hx + 2, hy], [hx + 3, hy]]]);
      break;
  }
}

/** 口笛の音の線(白) */
function drawWaves(Pn: Painter, pose: P2): void {
  if (!pose.waves) return;
  const mx = Math.round(pose.head[0] + 9), my = Math.round(pose.head[1] - 4);
  const c = WHITE[0];
  Pn.px(mx, my - 3, c).px(mx + 1, my - 4, c);
  Pn.px(mx + 1, my, c).px(mx + 2, my, c);
  Pn.px(mx, my + 3, c).px(mx + 1, my + 4, c);
  if (pose.waves === 2) {
    Pn.px(mx + 3, my - 6, c).px(mx + 4, my - 7, c);
    Pn.px(mx + 4, my, c).px(mx + 5, my, c);
    Pn.px(mx + 3, my + 6, c).px(mx + 4, my + 7, c);
  }
}

/** 顔に足す:あくびの口、口笛の口 */
function mouthExtra(g: PixelGrid, pose: P2, top: number): void {
  const y = top + 8 + (pose.down ? 1 : 0);
  if (pose.mouth === 'yawn') {
    g.px(9, y, OUTLINE).px(10, y, OUTLINE).px(9, y + 1, OUTLINE).px(10, y + 1, OUTLINE).px(10, y - 1, SKIN[2]);
  } else if (pose.mouth === 'whistle') {
    g.px(9, y, SKIN[1]).px(10, y, SKIN[1]).px(11, y, OUTLINE).px(11, y - 1, SKIN[1]);
  }
}

/** 手前の手と、口笛の線を描く(Look.front の最後に呼ぶ) */
function finish(Pn: Painter, pose: Pose): void {
  drawGesture(Pn, P(pose));
  drawWaves(Pn, P(pose));
}

// ---------------------------------------------------------------------
// 小物(KEY_ACCESSORY の1色)
// ---------------------------------------------------------------------

/**
 * 腕章:手前の腕の、肩から少し下。水色の制服に溶けないように、袖より少し太く長くして、
 * まわりに塗り替えない暗いふち(紺)をつける
 */
function drawArmband(Pn: Painter, pose: Pose, look: Look): void {
  const k = look.build.scale ?? 1;
  const { sF } = shoulders(pose, k);
  const e = pose.aF.e;
  const dx = e[0] - sF[0], dy = e[1] - sF[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const tops = new Set<string>(look.top);
  const r = look.build.arm + 0.4;
  const m = Pn.mask();
  const rim = Pn.mask();
  const a0 = Math.min(1.2, L * 0.2);
  const len = Math.min(5, Math.max(3, L * 0.6));
  for (let y = Math.floor(Math.min(sF[1], e[1]) - 5); y <= Math.max(sF[1], e[1]) + 5; y++)
    for (let x = Math.floor(Math.min(sF[0], e[0]) - 5); x <= Math.max(sF[0], e[0]) + 5; x++) {
      const along = (x - sF[0]) * ux + (y - sF[1]) * uy;
      const perp = -(x - sF[0]) * uy + (y - sF[1]) * ux;
      const c = Pn.g.get(x, y);
      if (c && !tops.has(c) && c !== OUTLINE) continue;
      // 袖の上か、袖のすぐ外(少しふくらませる)
      const onSleeve = !!c && tops.has(c);
      if (along >= a0 && along <= a0 + len && Math.abs(perp) <= r + (onSleeve ? 0 : 0.9)) m.set(x, y);
      else if (along >= a0 - 1.2 && along <= a0 + len + 1.2 && Math.abs(perp) <= r + 1.9) rim.set(x, y);
    }
  // ふち:腕章のまわりを紺で囲む(塗り替えない色)
  m.each((x, y) => {
    for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + ddx, Y = y + ddy;
      if (m.has(X, Y) || !rim.has(X, Y)) continue;
      Pn.px(X, Y, NAVY[2]);
    }
  });
  Pn.fill(m, KEY, { sep: 'none', flat: true });
}

/** 首の布:整備士のタオル/バンダナ('towel')と、会社員の女性のスカーフ('scarf') */
function drawNeckCloth(Pn: Painter, pose: Pose, kind: 'towel' | 'scarf'): void {
  const [nx, ny] = R(pose.neck);
  const m = Pn.mask();
  if (kind === 'towel') {
    m.ellipse(nx + 1, ny + 0.6, 4.8, 1.7);
    m.rect(nx + 3, ny + 1, 3, 7);
    m.rect(nx - 4, ny + 1, 2, 3);
  } else {
    m.ellipse(nx + 1, ny + 0.4, 4.2, 1.5);
    m.rect(nx + 3, ny + 1, 3, 3);
    m.set(nx + 3, ny + 4).set(nx + 2, ny + 5).set(nx + 5, ny + 4).set(nx + 6, ny + 5);
  }
  // 手前の前腕と手は布より前。上腕は布の後ろ(布が隠れすぎないように)
  const a = pose.aF;
  m.subtract(Pn.mask().capsule(a.e, a.h, 2.1));
  if (!a.noHand) m.subtract(Pn.mask().ellipse(a.h[0], a.h[1], 2.6, 2.6));
  Pn.fill(m, KEY, { sep: 'outline', flat: true });
  // 結び目の影(ふち色の線。塗り替える面は KEY 一色のまま)
  if (kind === 'towel') { if (m.has(nx + 3, ny + 2)) Pn.px(nx + 3, ny + 2, OUTLINE); }
  else if (m.has(nx + 4, ny + 1)) Pn.px(nx + 4, ny + 1, OUTLINE);
}

// ---------------------------------------------------------------------
// 共通の動き
// ---------------------------------------------------------------------

/** 手前の腕を、手が h に来るように曲げる */
function armTo(p: Pose, h: Pt, e: Pt): Pose {
  const q = clonePose(p);
  q.aF = { e, h };
  return q;
}

/** 口の位置(ポーズの座標) */
const mouthAt = (p: Pose): Pt => [p.head[0] + 5, p.head[1] - 3];

/** 行6:口笛で仲間を呼ぶ(指を口に当てる → ピーッ(当たり) → 奥の手で手まねき) */
export function whistleRow(base: Pose): P2[] {
  const f0 = withFace(base, 'sly');
  f0.aF = { e: [base.neck[0] + 4, base.neck[1] + 7], h: [base.neck[0] + 6, base.neck[1] + 2] };
  const b1 = moveUpper(base, -1, 0);
  const m1 = mouthAt(b1);
  const f1 = tag(withFace(b1, 'shut'), { gest: 'whistle', mouth: 'whistle' });
  f1.aF = { e: [b1.neck[0] + 8, b1.neck[1] + 7], h: [m1[0], m1[1] + 1] };
  const b2 = moveUpper(base, 1, -1);
  const m2 = mouthAt(b2);
  const f2 = tag(withFace(b2, 'shut'), { gest: 'whistle', mouth: 'whistle', waves: 2 });
  f2.aF = { e: [b2.neck[0] + 8, b2.neck[1] + 7], h: [m2[0], m2[1] + 1] };
  f2.aB = { e: [b2.neck[0] + 8, b2.neck[1] - 3], h: [b2.neck[0] + 10, b2.neck[1] - 10] };
  const f3 = tag(withFace(b2, 'sly'), { gest: 'whistle', mouth: 'whistle', waves: 1 });
  f3.aF = { e: [b2.neck[0] + 8, b2.neck[1] + 7], h: [m2[0], m2[1] + 1] };
  f3.aB = { e: [b2.neck[0] + 9, b2.neck[1] - 2], h: [b2.neck[0] + 13, b2.neck[1] - 6] };
  f3.lB = { k: [base.hip[0] + 4, 46], a: [base.hip[0] + 5, 54], toe: 0.5 };
  return [P(f0), f1, f2, f3];
}

// ---------------------------------------------------------------------
// 警備員
// ---------------------------------------------------------------------
const G_SHIRT: Ramp = [md(5, 6, 7), md(4, 5, 6), md(2, 3, 5)];
const NAVY: Ramp = [md(2, 2, 4), md(1, 1, 3), md(1, 1, 2)];
const GUARD_BUILD: Build = { sh: 8, wa: 6.5, arm: 2.4, thigh: 3.1, shin: 2.5, hem: 0, chest: 1.5 };
/** 帽子の下からのぞく後ろ髪だけ */
const HAIR_UNDER_CAP: HairStyle = {
  top: 2, ear: true,
  rows: ['.............', '.............', '...hhhhh.....', '..hhhhhhhh...', '.hhhhhhhhhh..', '.hhhh........', '.hhh.........', '.hh..........', '.h...........']
};

/**
 * 警備員の帽子(右向き)。上が平らで広い山、紺の濃い帯、帯の前の金の記章、前へ下がるつば。
 * 光は左上から当てる(山の左上を明るく)。つばは黒で、上の面に1ドットの光
 */
function guardCap(g: PixelGrid): void {
  const rows = [
    '...bbbbbba....',
    '..bbaaaayaa...',
    '.baaaaaayaaa..',
    '.cccccccccvvv.',
    '..........vvvv'
  ];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      const c = ch === 'a' ? NAVY[1] : ch === 'b' ? NAVY[0] : ch === 'c' ? NAVY[2] : ch === 'y' ? GOLD[0] : ch === 'v' ? OUTLINE : null;
      if (c) g.px(x, y, c);
    }
  });
  g.px(9, 2, GOLD[1]).px(11, 3, NAVY[0]);
}

function guardLook(extra: Partial<Look> = {}, headMore?: (g: PixelGrid, p: Pose) => void): Look {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_UNDER_CAP,
    top: G_SHIRT, sleeve: 'long', bottom: NAVY, legs: 'pants', shoes: [NAVY[2], OUTLINE, OUTLINE], sole: OUTLINE,
    build: GUARD_BUILD,
    headExtra(g, pose) {
      guardCap(g);
      mouthExtra(g, P(pose), HAIR_UNDER_CAP.top);
      headMore?.(g, pose);
    },
    torso(Pn, pose) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // えりとネクタイ
      Pn.px(X(2, 0), n[1], G_SHIRT[0]).px(X(4, 0), n[1], G_SHIRT[0]).px(X(2, 1), n[1] + 1, G_SHIRT[2]);
      for (let dy = 0; dy <= 8; dy++) Pn.px(X(3, dy), n[1] + dy, NAVY[dy === 0 ? 2 : 1]);
      Pn.px(X(4, 7), n[1] + 7, NAVY[2]);
      // 胸のバッジと、ポケット
      Pn.px(X(-1, 5), n[1] + 5, GOLD[0]).px(X(0, 5), n[1] + 5, GOLD[1]).px(X(-1, 6), n[1] + 6, GOLD[1]).px(X(0, 6), n[1] + 6, GOLD[1]);
      for (let dx = 5; dx <= 7; dx++) Pn.px(X(dx, 6), n[1] + 6, G_SHIRT[2]);
      // 肩章
      Pn.px(X(-5, 1), n[1] + 1, NAVY[1]).px(X(-4, 1), n[1] + 1, NAVY[1]).px(X(-3, 1), n[1] + 1, NAVY[1]);
      // ベルトとバックル
      for (let x = -7; x <= 7; x++) {
        const c = Pn.g.get(Math.round(p[0] + x), Math.round(p[1] - 3));
        if (c && c !== OUTLINE) Pn.px(p[0] + x, p[1] - 3, x === 2 || x === 3 ? GOLD[1] : OUTLINE);
      }
    },
    ...extra
  };
  const prev = look.front;
  look.front = (Pn, pose) => {
    drawArmband(Pn, pose, look);
    prev?.(Pn, pose);
    finish(Pn, pose);
  };
  return look;
}

function guardSheets(): { civ: PixelGrid[][]; bad: PixelGrid[][]; civSort: Pose[] } {
  const look = guardLook();
  const base = STAND;
  const n = base.neck;
  // 市民:あくび(手を口に当てて、体をのばす)
  const m = mouthAt(base);
  // 手は口の前(顔の外)に置き、目と大きく開けた口が見えるようにする
  const yawnArm = (p: Pose): Pose => armTo(p, [m[0] + 4 + (p.head[0] - base.head[0]), m[1] + 2 + (p.head[1] - base.head[1])], [n[0] + 4 + (p.neck[0] - n[0]), n[1] + 7 + (p.neck[1] - n[1])]);
  const civSort: Pose[] = [
    withFace(base, 'normal'),
    tag(yawnArm(withFace(base, 'shut')), { mouth: 'yawn' }),
    tag(yawnArm(withFace(moveUpper(base, -1, -1), 'shut')), { mouth: 'yawn' }),
    armTo(withFace(base, 'shut'), [n[0] + 3, n[1] + 11], [n[0] + 1, n[1] + 9])
  ];
  // ギャング:胸の前で指を2本立てる(横目で合図)
  const vArm = (p: Pose): Pose => armTo(p, [n[0] + 9 + (p.neck[0] - n[0]), n[1] + 9 + (p.neck[1] - n[1])], [n[0] + 2, n[1] + 10]);
  const badSort: Pose[] = [
    withFace(base, 'sly'),
    armTo(withFace(base, 'sly'), [n[0] + 4, n[1] + 11], [n[0] - 1, n[1] + 10]),
    tag(vArm(withFace(base, 'sly', { look: -1 })), { gest: 'v' }),
    tag(vArm(withFace(moveUpper(base, 0, 1), 'sly')), { gest: 'v' })
  ];
  const civ = civRows(look, base, civSort);
  const bad = badRows(look, civ, badSort);
  bad.push(whistleRow(base).map((p) => drawPerson(look, p)));
  return { civ, bad, civSort };
}

// ---------------------------------------------------------------------
// 整備士(つなぎ)
// ---------------------------------------------------------------------
const OVERALL: Ramp = [md(5, 5, 3), md(4, 4, 2), md(3, 2, 1)];
const BOOTS: Ramp = [SKIN[2], HAIR[1], OUTLINE];
const MECH_BUILD: Build = { sh: 8.5, wa: 6.5, arm: 2.5, thigh: 3.2, shin: 2.6, hem: 1, chest: 1 };

function mechLook(extra: Partial<Look> = {}): Look {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: OVERALL, sleeve: 'rolled', bottom: OVERALL, legs: 'pants', shoes: BOOTS, sole: OUTLINE,
    build: MECH_BUILD,
    headExtra(g, pose) {
      mouthExtra(g, P(pose), HAIR_SHORT.top);
      // ほおの油よごれ(横に2ドット)
      const y = HAIR_SHORT.top + 6 + (pose.down ? 1 : 0);
      g.px(6, y, SKIN[2]).px(7, y, SKIN[2]);
    },
    torso(Pn, pose) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // 前のファスナー
      for (let dy = 2; dy <= 19; dy++) Pn.px(X(3, dy), n[1] + dy, OVERALL[2]);
      Pn.px(X(3, 2), n[1] + 2, WHITE[0]);
      // 胸ポケットと名札(白、文字なし)
      for (let dx = -2; dx <= 1; dx++) Pn.px(X(dx, 6), n[1] + 6, OVERALL[2]);
      Pn.px(X(-2, 7), n[1] + 7, OVERALL[2]).px(X(1, 7), n[1] + 7, OVERALL[2]);
      Pn.px(X(5, 5), n[1] + 5, WHITE[0]).px(X(6, 5), n[1] + 5, WHITE[0]).px(X(7, 5), n[1] + 5, WHITE[0]);
      // 腰のベルト(同じ布)
      for (let x = -7; x <= 7; x++) {
        const c = Pn.g.get(Math.round(p[0] + x), Math.round(p[1] - 4));
        if (c && c !== OUTLINE) Pn.px(p[0] + x, p[1] - 4, OVERALL[2]);
      }
    },
    ...extra
  };
  const prev = look.front;
  look.front = (Pn, pose) => {
    // ひざの油じみ
    const k = R(pose.lF.k);
    Pn.px(k[0] - 1, k[1] + 1, OVERALL[2]).px(k[0], k[1] + 2, OVERALL[2]);
    drawNeckCloth(Pn, pose, 'towel');
    prev?.(Pn, pose);
    finish(Pn, pose);
  };
  return look;
}

function mechSheets(): { civ: PixelGrid[][]; bad: PixelGrid[][]; civSort: Pose[] } {
  const look = mechLook();
  const base = STAND;
  // 市民:腰の後ろに手を当てて、背中をのばす
  const back = (p: Pose, up = 0): Pose => armTo(p, [p.hip[0] - 7, p.hip[1] - 6 - up], [p.neck[0] - 6, p.neck[1] + 8]);
  const civSort: Pose[] = [
    back(withFace(base, 'normal')),
    back(withFace(moveUpper(base, -1, 0), 'shut')),
    back(withFace(moveUpper(base, -1, 0), 'shut'), 2),
    back(withFace(base, 'normal'), 1)
  ];
  // ギャング:腰の横で、親指で後ろをさす
  const side = (p: Pose, dx = 0): Pose => armTo(p, [p.hip[0] - 3 + dx, p.hip[1] - 4], [p.neck[0] - 3, p.neck[1] + 9]);
  const badSort: Pose[] = [
    side(withFace(base, 'sly')),
    tag(side(withFace(base, 'sly')), { gest: 'thumb' }),
    tag(side(withFace(base, 'sly', { look: -1 }), -1), { gest: 'thumb' }),
    tag(side(withFace(moveUpper(base, 0, 1), 'grin')), { gest: 'thumb' })
  ];
  const civ = civRows(look, base, civSort);
  const bad = badRows(look, civ, badSort);
  bad.push(whistleRow(base).map((p) => drawPerson(look, p)));
  return { civ, bad, civSort };
}

// ---------------------------------------------------------------------
// 派手な若者
// ---------------------------------------------------------------------
const SILVER: Ramp = [WHITE[0], md(5, 5, 6), md(3, 3, 5)];
const BLACK: Ramp = [md(2, 2, 3), md(1, 1, 2), md(1, 1, 2)];
const KICKS: Ramp = [md(6, 1, 1), md(6, 1, 1), md(6, 1, 1)];
const CLUB_BUILD: Build = { sh: 8, wa: 5.5, arm: 2.3, thigh: 2.8, shin: 2.3, hem: -1, chest: 1 };
/** 逆立てた髪。ヘアバンドは headExtra で上に重ねる */
export const HAIR_SPIKE: HairStyle = {
  top: 4, ear: true,
  rows: [
    '....H...H....',
    '...hH.hHh.H..',
    '..hHHhHHhhHh.',
    '.hHHHHhhhhhh.',
    '.hhhhhhhhhhh.',
    '.hhhhhhhhhhh.',
    '.hhhhhhhhhhh.',
    '.hhhhhhhh....',
    '.hhhh........',
    '.hhh.........',
    '.hh..........',
    '.h...........'
  ]
};

function headband(g: PixelGrid): void {
  const t = HAIR_SPIKE.top;
  for (let x = 1; x <= 11; x++) g.px(x, t + 1, KEY).px(x, t + 2, KEY);
  for (let x = 2; x <= 10; x++) g.px(x, t, KEY);
  // 後ろの結び目
  g.px(0, t + 1, KEY).px(0, t + 2, KEY).px(0, t + 3, KEY);
}

export function clubLook(extra: Partial<Look> = {}): Look {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SPIKE,
    top: SILVER, sleeve: 'long', bottom: BLACK, legs: 'pants', shoes: KICKS, sole: WHITE[0],
    build: CLUB_BUILD,
    headExtra(g, pose) {
      headband(g);
      mouthExtra(g, P(pose), HAIR_SPIKE.top);
      // 金のピアス(耳たぶから下がる輪)
      const t = HAIR_SPIKE.top;
      g.px(5, t + 7, GOLD[0]).px(5, t + 8, GOLD[1]);
    },
    torso(Pn, pose) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // 前を開けたジャケットの中の黒いシャツ
      for (let dy = 0; dy <= 16; dy++) for (let dx = 1; dx <= 4; dx++) {
        const x = X(dx, dy), y = n[1] + dy, c = Pn.g.get(x, y);
        if (c && c !== OUTLINE) Pn.px(x, y, dx === 1 ? SILVER[2] : BLACK[dx === 4 ? 1 : 0]);
      }
      // 金の鎖
      for (let i = 0; i <= 4; i++) Pn.px(X(1 + i, 2 + Math.round(Math.sin((i / 4) * Math.PI) * 3)), n[1] + 2 + Math.round(Math.sin((i / 4) * Math.PI) * 3), i % 2 ? GOLD[1] : GOLD[0]);
      // 胸の線とすそ
      for (let x = -6; x <= 6; x++) {
        const y = Math.round(p[1] - 2), c = Pn.g.get(Math.round(p[0] + x), y);
        if (c === SILVER[1] || c === SILVER[0]) Pn.px(p[0] + x, y, SILVER[2]);
      }
    },
    ...extra
  };
  const prev = look.front;
  look.front = (Pn, pose) => {
    prev?.(Pn, pose);
    finish(Pn, pose);
  };
  return look;
}

function clubSheets(): { civ: PixelGrid[][]; bad: PixelGrid[][] } {
  const look = clubLook();
  const base = STAND;
  // 市民:うつむいてスマホを見る(手は胸の前。ギャングの「頭の横で指をトントン」とは形がまったく違う)
  const phone = (p: Pose, d: number): Pose => armTo(p, [p.neck[0] + 8, p.neck[1] + 8 - d], [p.neck[0] + 2, p.neck[1] + 12]);
  const civSort: Pose[] = [
    tag(phone(withFace(base, 'normal', { down: true }), 0), { gest: 'phone0' }),
    tag(phone(withFace(base, 'normal', { down: true }), 0), { gest: 'phone1' }),
    tag(phone(withFace(moveUpper(base, 0, 1), 'grin', { down: true }), 1), { gest: 'phone0' }),
    tag(phone(withFace(base, 'grin', { down: true }), 0), { gest: 'phone1' })
  ];
  // ギャング:人差し指でヘアバンドをトントン(おそろいだろ)
  const tap = (p: Pose, d: number): Pose => armTo(p, [p.head[0] + 10, p.head[1] - 3 + d], [p.neck[0] + 5, p.neck[1] + 6]);
  const badSort: Pose[] = [
    tag(tap(withFace(base, 'sly'), 1), { gest: 'tap' }),
    tag(tap(withFace(base, 'grin'), 0), { gest: 'tap' }),
    tag(tap(withFace(base, 'sly'), 1), { gest: 'tap' }),
    tag(tap(withFace(moveUpper(base, 0, 1), 'grin'), 0), { gest: 'tap' })
  ];
  const civ = civRows(look, base, civSort);
  const bad = badRows(look, civ, badSort);
  bad.push(whistleRow(base).map((p) => drawPerson(look, p)));
  return { civ, bad };
}

// ---------------------------------------------------------------------
// 会社員の女性
// ---------------------------------------------------------------------
const BLAZER: Ramp = [md(4, 4, 5), md(3, 3, 4), md(2, 2, 3)];
const SKIRT: Ramp = [BLAZER[1], BLAZER[2], BLAZER[2]];
const PUMPS: Ramp = [HAIR[1], OUTLINE, OUTLINE];
const OL_BUILD: Build = { sh: 6.5, wa: 5, arm: 2, thigh: 2.4, shin: 1.9, hem: 0, chest: 1.5 };
const HAIR_BOB: HairStyle = {
  top: 1, ear: false,
  rows: [
    '...hHHhh.....',
    '..hHHHHhhh...',
    '.hHHhhhhhhhh.',
    '.hHhhhhhhhhhh',
    '.hhhhhhhhh.h.',
    '.hhhhhh......',
    '.hhhhh.......',
    '.hhhhh.......',
    '.hhhhh.......',
    '.hhhhh.......',
    '.hhhhh.......',
    '..hhhh.......',
    '...hh........'
  ]
};

function olLook(extra: Partial<Look> = {}, headMore?: (g: PixelGrid, p: Pose) => void): Look {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_BOB,
    top: BLAZER, sleeve: 'long', bottom: SKIN, legs: 'pants', shoes: PUMPS,
    build: OL_BUILD, cuff: WHITE[0],
    headExtra(g, pose) {
      mouthExtra(g, P(pose), HAIR_BOB.top);
      headMore?.(g, pose);
    },
    torso(Pn, pose) {
      const n = pose.neck;
      const lean = (pose.hip[0] - n[0]) / Math.max(1, pose.hip[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // ブラウスのV字と、上着の合わせ
      for (let dy = 0; dy <= 6; dy++) {
        const w = Math.max(0, 3 - Math.floor(dy / 2));
        for (let dx = 0; dx <= w; dx++) Pn.px(X(2 + dx, dy), n[1] + dy, WHITE[0]);
        Pn.px(X(1, dy), n[1] + dy, BLAZER[2]);
      }
      for (let dy = 7; dy <= 16; dy++) Pn.px(X(3, dy), n[1] + dy, BLAZER[2]);
      Pn.px(X(4, 10), n[1] + 10, OUTLINE);
    },
    mid(Pn, pose) {
      // タイトスカート(ひざの上まで)
      const p = pose.hip, b = look.build;
      const ky = Math.min(pose.lF.k[1], pose.lB.k[1]) - 2;
      const kx = [pose.lF.k[0], pose.lB.k[0]];
      const m = Pn.mask().poly([[p[0] - b.wa, p[1] - 4], [p[0] + b.wa, p[1] - 4], [p[0] + b.wa + 0.5, p[1]], [Math.max(...kx) + 3, ky], [Math.min(...kx) - 3, ky], [p[0] - b.wa - 0.5, p[1]]]);
      Pn.fill(m, SKIRT, { sep: 'outline', hi: 0.2, lo: 0.7, clean: true });
    },
    ...extra
  };
  const prev = look.front;
  look.front = (Pn, pose) => {
    // 腕時計(金)
    const a = pose.aF;
    const dx = a.e[0] - a.h[0], dy = a.e[1] - a.h[1], L = Math.hypot(dx, dy) || 1;
    const w = R([a.h[0] + (dx / L) * 2.4, a.h[1] + (dy / L) * 2.4]);
    Pn.px(w[0], w[1], GOLD[1]);
    drawNeckCloth(Pn, pose, 'scarf');
    prev?.(Pn, pose);
    finish(Pn, pose);
  };
  return look;
}

function olSheets(): { civ: PixelGrid[][]; bad: PixelGrid[][]; civSort: Pose[] } {
  const look = olLook();
  const base = STAND;
  const n = base.neck;
  // 市民:腕時計を見る
  const watch = (p: Pose, hi = 0): Pose => armTo(p, [n[0] + 5, n[1] + 7 - hi], [n[0] - 2, n[1] + 9]);
  const civSort: Pose[] = [
    withFace(base, 'normal'),
    watch(withFace(base, 'normal', { down: true })),
    watch(withFace(base, 'worried', { down: true }), 1),
    watch(withFace(moveUpper(base, 0, 1), 'worried', { down: true }))
  ];
  // ギャング:胸の前で人差し指の手まねき
  const beck = (p: Pose): Pose => armTo(p, [n[0] + 8 + (p.neck[0] - n[0]), n[1] + 9 + (p.neck[1] - n[1])], [n[0] + 1, n[1] + 11]);
  const badSort: Pose[] = [
    withFace(base, 'sly'),
    tag(beck(withFace(base, 'sly')), { gest: 'beckon0' }),
    tag(beck(withFace(base, 'sly', { look: -1 })), { gest: 'beckon1' }),
    tag(beck(withFace(moveUpper(base, 0, 1), 'sly')), { gest: 'beckon1' })
  ];
  const civ = civRows(look, base, civSort);
  const bad = badRows(look, civ, badSort);
  bad.push(whistleRow(base).map((p) => drawPerson(look, p)));
  return { civ, bad, civSort };
}

// ---------------------------------------------------------------------
// 女ボスの化けた姿:市民の絵を伸ばして、どこか1か所だけおかしくする
// ---------------------------------------------------------------------

const disguise = (look: Look, sort: Pose[], tweak?: (p: Pose) => Pose): PixelGrid[][] =>
  disguiseRows(look, STAND, sort, { sx: 1.04, tweak });

/** 警備員 + サングラス */
function disguiseGuard(civSort: Pose[]): PixelGrid[][] {
  const look = guardLook({}, (g, pose) => {
    const y = HAIR_UNDER_CAP.top + 4 + (pose.down ? 1 : 0);
    // 横長のサングラス(3段)とつる
    for (let x = 6; x <= 12; x++) g.px(x, y, OUTLINE);
    for (let x = 8; x <= 12; x++) g.px(x, y + 1, OUTLINE);
    g.px(8, y + 2, OUTLINE).px(9, y + 2, OUTLINE).px(11, y + 2, OUTLINE).px(12, y + 2, OUTLINE);
    g.px(9, y + 1, WHITE[0]);
  });
  return disguise(look, civSort);
}

/** 整備士 + 赤いハイヒール */
const HEELS: Ramp = [md(7, 2, 2), md(6, 0, 1), md(3, 0, 1)];
function disguiseMech(civSort: Pose[]): PixelGrid[][] {
  const look = mechLook({
    shoes: HEELS, sole: undefined,
    farHand(Pn, pose) { heel(Pn, pose.lB.a, true); }
  });
  const prev = look.front!;
  look.front = (Pn, pose) => { heel(Pn, pose.lF.a, false); prev(Pn, pose); };
  function heel(Pn: Painter, a: Pt, far: boolean): void {
    const [x, y] = R(a);
    for (let j = 2; j <= 4; j++) Pn.px(x - 2, y + j, HEELS[far ? 2 : 1]).px(x - 3, y + j, OUTLINE).px(x - 1, y + j, OUTLINE);
    Pn.px(x - 2, y + 5, OUTLINE);
  }
  // つま先立ち(ヒールの分だけ足首を上げる)
  const tweak = (p: Pose): Pose => {
    const q = clonePose(p);
    for (const l of [q.lF, q.lB]) { l.toe = (l.toe ?? 0) + 0.45; }
    return q;
  };
  return disguise(look, civSort, tweak);
}

/** 会社員の女性 + 金の太い腕輪 */
function disguiseOL(civSort: Pose[]): PixelGrid[][] {
  const look = olLook();
  const prev = look.front!;
  look.front = (Pn, pose) => {
    prev(Pn, pose);
    const a = pose.aF;
    const dx = a.e[0] - a.h[0], dy = a.e[1] - a.h[1], L = Math.hypot(dx, dy) || 1;
    const w = R([a.h[0] + (dx / L) * 3, a.h[1] + (dy / L) * 3]);
    const m = Pn.mask().ellipse(w[0], w[1], 2, 2);
    Pn.fill(m, [GOLD[0], GOLD[1], GOLD[1]], { sep: 'outline' });
    Pn.px(w[0] - 1, w[1] - 1, GOLD[0]);
  };
  return disguise(look, civSort);
}

// ---------------------------------------------------------------------

export function buildPeople2(skip: Set<string>): Record<string, PixelGrid[][]> {
  const out: Record<string, PixelGrid[][]> = {};
  const need = (...k: string[]) => k.some((x) => !skip.has(x));
  if (need('guard_civ', 'guard_bad', 'boss2_disguise_guard')) {
    const s = guardSheets();
    out.guard_civ = s.civ; out.guard_bad = s.bad;
    out.boss2_disguise_guard = disguiseGuard(s.civSort);
  }
  if (need('mechanic_civ', 'mechanic_bad', 'boss2_disguise_mechanic')) {
    const s = mechSheets();
    out.mechanic_civ = s.civ; out.mechanic_bad = s.bad;
    out.boss2_disguise_mechanic = disguiseMech(s.civSort);
  }
  if (need('clubber_civ', 'clubber_bad')) {
    const s = clubSheets();
    out.clubber_civ = s.civ; out.clubber_bad = s.bad;
  }
  if (need('officelady_civ', 'officelady_bad', 'boss2_disguise_officelady')) {
    const s = olSheets();
    out.officelady_civ = s.civ; out.officelady_bad = s.bad;
    out.boss2_disguise_officelady = disguiseOL(s.civSort);
  }
  return out;
}
