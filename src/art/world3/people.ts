// ステージ3の人(着ぐるみのバイト、寝不足の店員、ロボットダンスの学生、買い物客のおじさん)と、親玉の化けた姿。
// 宇宙人は同じ見た目の市民とまったく同じ絵(行0〜5)で、ぎこちない動き(sortIdle)も同じ。
// 違うのは、行6の「空へ合図を送る」と、行7の「くずれ」だけ。くずれの色は黄緑(GLITCH)。
import { md, PixelGrid } from '../lib';
import {
  type Build, type HairStyle, HAIR_SHORT, type Look, type Pose,
  clonePose, drawPerson, moveUpper, shoulders, stretchPose
} from '../world/figure';
import { HAIR, OUTLINE, SKIN, WHITE } from '../world/palette';
import { Painter, type Pt, type Ramp, mix, rotateGrid } from '../world/pix';
import { STAND, civRows, idleFrames, walkFrames, withFace } from '../world/poses';
import { GLITCH } from './palette';

const R = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];

/** ポーズに持たせる印 */
export interface P3 extends Pose {
  /** くずれのコマ(0〜3)。ないときはふつう */
  glitch?: number;
  /** 着ぐるみの頭の傾き(ラジアン、正で時計回り) */
  spin?: number;
  /** 合図の光(1:小さい、2:大きい) */
  flash?: 1 | 2;
}
const P = (p: Pose): P3 => p as P3;
const tag = (p: Pose, extra: Partial<P3>): P3 => Object.assign(clonePose(p), extra) as P3;

/** 塗った物の上に、ふちで囲んだ小さな絵を置く。rows の文字は map で色にする('.' は塗らない) */
function sprite(Pn: Painter, x: number, y: number, rows: string[], map: Record<string, string>): void {
  const m = Pn.mask();
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') m.set(x + i, y + j); });
  Pn.fill(m, OUTLINE, { sep: 'outline', flat: true });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = map[r[i]]; if (c) Pn.px(x + i, y + j, c); } });
}

// ---------------------------------------------------------------------
// 宇宙人に共通の動き
// ---------------------------------------------------------------------

/** 合図の光(黄緑の十字)。指の先に出す */
function drawFlash(Pn: Painter, pose: P3, finger: string): void {
  if (!pose.flash) return;
  const [hx, hy] = R(pose.aF.h);
  // 立てた人差し指
  Pn.px(hx, hy - 2, finger).px(hx, hy - 3, finger);
  const cx = hx, cy = hy - 6;
  const r = pose.flash === 2 ? 3 : 2;
  for (let i = -r; i <= r; i++) { Pn.px(cx + i, cy, GLITCH[1]); Pn.px(cx, cy + i, GLITCH[1]); }
  if (pose.flash === 2) for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) Pn.px(cx + dx, cy + dy, GLITCH[2]);
  Pn.px(cx, cy, GLITCH[0]).px(cx - 1, cy, GLITCH[0]).px(cx + 1, cy, GLITCH[0]).px(cx, cy - 1, GLITCH[0]).px(cx, cy + 1, GLITCH[0]);
}

/** 行6:空へ合図を送る(見上げる → 腕を上げる → 指の先が光る(当たり) → 光が消えかける) */
function signalRow(base: Pose): P3[] {
  const n = base.neck;
  const s: Pt = [n[0] - 1, n[1] + 2.5];
  const onHip = (p: Pose): Pose => { p.aB = { e: [p.neck[0] + 8, p.neck[1] + 9], h: [p.hip[0] + 5, p.hip[1] - 5] }; return p; };
  const f0 = P(onHip(withFace(base, 'normal')));
  f0.head = [base.head[0] + 1, base.head[1] - 1];
  f0.aF = { e: [s[0] + 5, s[1] + 3], h: [s[0] + 8, s[1] - 3] };
  const f1 = P(onHip(withFace(base, 'sly')));
  f1.aF = { e: [s[0] + 7, s[1] - 4], h: [s[0] + 11, s[1] - 10] };
  const b2 = moveUpper(base, 0, -1);
  const f2 = tag(onHip(withFace(b2, 'grin')), { flash: 2 });
  f2.aF = { e: [s[0] + 7, s[1] - 5], h: [s[0] + 11, s[1] - 12] };
  f2.lB = { k: [base.hip[0] + 4, 46], a: [base.hip[0] + 5, 54], toe: 0.5 };
  const f3 = tag(onHip(withFace(base, 'sly')), { flash: 1 });
  f3.aF = { e: [s[0] + 7, s[1] - 4], h: [s[0] + 11, s[1] - 10] };
  return [f0, f1, f2, f3];
}

/** 市民の6行、宇宙人の8行 */
interface Pair { civ: PixelGrid[][]; bad: PixelGrid[][]; civSort: Pose[]; base: Pose }

function pairSheets(look: Look, base: Pose, civSort: Pose[], glitch: PixelGrid[], opts: { walk?: Pose[] } = {}): Pair {
  const civ = civRows(look, base, civSort, { walk: opts.walk });
  // 宇宙人の行0〜5は市民と同じ絵
  const bad = [...civ, signalRow(base).map((p) => drawPerson(look, p)), glitch];
  return { civ, bad, civSort, base };
}

/** 見た目の Look に、合図の光を足す */
function withSignal(look: Look, finger: string): Look {
  const prev = look.front;
  return { ...look, front(Pn, pose) { prev?.(Pn, pose); drawFlash(Pn, P(pose), finger); } };
}

// =====================================================================
// 着ぐるみのバイト
// =====================================================================
const FUR: Ramp = [md(7, 6, 2), md(7, 5, 1), md(5, 3, 1)];
const CREAM: Ramp = [md(7, 7, 6), md(6, 6, 4), md(5, 4, 3)];
const PINK = md(7, 4, 4);
const BOW = md(6, 1, 2);
const MASCOT_BUILD: Build = { sh: 9, wa: 8, arm: 3, thigh: 3.6, shin: 3.2, hem: 1, chest: 3 };
/** 頭の格子の中の、頭の真ん中と首の点 */
const MH_CX = 8.5, MH_CY = 10, MH_NX = 8, MH_NY = 17;

/** 着ぐるみの頭(まるい耳、大きな黒い目、クリーム色の口もと)。antenna で触角をのぞかせる(親玉) */
function mascotHead(pose: P3, antenna: boolean): { g: PixelGrid; nx: number; ny: number } {
  const Pn = new Painter(18, 18);
  const ears = Pn.mask().ellipse(4, 3.6, 2.6, 2.6).union(Pn.mask().ellipse(12.6, 3.2, 2.6, 2.6));
  Pn.fill(ears, FUR, { sep: 'outline', hi: 0.4, lo: 0.75 });
  Pn.fill(Pn.mask().ellipse(4, 3.6, 1.1, 1.1).union(Pn.mask().ellipse(12.6, 3.2, 1.1, 1.1)), PINK, { sep: 'none', flat: true });
  const head = Pn.mask().ellipse(MH_CX, MH_CY, 8.2, 6.8);
  Pn.fill(head, FUR, { sep: 'outline', hi: 0.34, lo: 0.72 });
  const muzzle = Pn.mask().ellipse(13.6, 12.2, 3.6, 2.5).intersect(head);
  Pn.fill(muzzle, CREAM, { sep: 'none', hi: 0.45, lo: 0.85 });
  // 目(奥の目は細く、手前の目は大きく)と光
  Pn.rect(12, 7, 2, 3, OUTLINE).px(12, 7, CREAM[0]);
  Pn.rect(7, 7, 1, 3, OUTLINE).px(7, 7, CREAM[0]);
  // 鼻と口とほっぺ
  Pn.rect(16, 10, 1, 2, OUTLINE).px(15, 10, OUTLINE);
  Pn.px(14, 13, OUTLINE).px(15, 14, OUTLINE).px(16, 13, OUTLINE);
  Pn.px(9, 12, PINK).px(10, 12, PINK);
  if (antenna) {
    // 耳のあいだから、黄緑の玉のついた触角が2本のぞく
    Pn.line([7, 5], [7, 3], OUTLINE).line([10, 5], [10, 3], OUTLINE);
    Pn.rect(6, 1, 2, 2, GLITCH[1]).px(6, 1, GLITCH[0]).rect(10, 1, 2, 2, GLITCH[1]).px(10, 1, GLITCH[0]);
  }
  const spin = pose.spin ?? 0;
  if (!spin) return { g: Pn.g, nx: MH_NX, ny: MH_NY };
  // 首の上で頭だけ回す(頭の真ん中は動かさない)
  const S = 26, c = 13;
  const g = rotateGrid(Pn.g, spin, MH_CX, MH_CY, c, c, S, S);
  return { g, nx: Math.round(c - (MH_CX - MH_NX)), ny: Math.round(c + (MH_NY - MH_CY)) };
}

function mascotLook(antenna = false): Look {
  return {
    skin: FUR, hair: HAIR, hairStyle: { rows: [], top: 0 },
    top: FUR, sleeve: 'none', bottom: FUR, legs: 'pants', shoes: CREAM, sole: CREAM[2],
    build: MASCOT_BUILD, sweat: CREAM[0],
    customHead: (pose) => mascotHead(P(pose), antenna),
    torso(Pn, pose, top) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      // おなかのクリーム色
      const belly = Pn.mask().ellipse(n[0] + 3 + lean * 10, n[1] + 10, 4.5, 6).intersect(top);
      Pn.fill(belly, CREAM, { sep: 'none', hi: 0.4, lo: 0.8 });
      // 首の蝶ネクタイ
      const bx = Math.round(n[0] + 2), by = Math.round(n[1] + 1);
      Pn.rect(bx - 2, by, 2, 3, BOW).rect(bx + 1, by, 2, 3, BOW).px(bx, by + 1, OUTLINE);
      Pn.px(bx - 2, by, PINK).px(bx + 1, by, PINK);
    },
    front(Pn, pose) {
      // くずれ:首の継ぎ目から黄緑がもれる
      const k = P(pose).glitch;
      if (k === undefined || k > 2) return;
      const [hx, hy] = R(pose.head);
      for (let i = -3 + k; i <= 3 - k; i += 2) Pn.px(hx + i, hy, GLITCH[1]);
      Pn.px(hx, hy, GLITCH[0]);
    }
  };
}

/** 着ぐるみは首が短く、脚も短い */
const MASCOT_STAND: Pose = {
  head: [33, 21], face: 'normal',
  neck: [32, 21], hip: [32, 38],
  aB: { e: [39, 29], h: [41, 35] },
  aF: { e: [29, 29], h: [30, 36] },
  lB: { k: [35, 48], a: [36, 56] },
  lF: { k: [29, 48], a: [28, 56] }
};

function mascotSheets(): Pair {
  const look = withSignal(mascotLook(), FUR[0]);
  const base = MASCOT_STAND;
  // 市民も宇宙人も:前が見えずに、両手で手さぐりしてふらつく(頭が左右に傾く)
  const grope = (p: Pose, dx: number): Pose => {
    const q = clonePose(p);
    q.aF = { e: [q.neck[0] + 4, q.neck[1] + 7], h: [q.neck[0] + 10 + dx, q.neck[1] + 6] };
    q.aB = { e: [q.neck[0] + 9, q.neck[1] + 6], h: [q.neck[0] + 14 + dx, q.neck[1] + 4] };
    return q;
  };
  const f0 = tag(grope(moveUpper(base, -2, 0), 0), { spin: -0.2 });
  const f1 = tag(grope(moveUpper(base, 0, 1), 1), {});
  f1.lF = { k: [31, 46], a: [33, 53], toe: 0.3 };
  const f2 = tag(grope(moveUpper(base, 2, 0), 0), { spin: 0.2 });
  const f3 = tag(grope(moveUpper(base, 0, 1), -1), {});
  f3.lB = { k: [38, 46], a: [39, 53], toe: 0.3 };
  const civSort = [f0, f1, f2, f3];
  // くずれ:着ぐるみの首が一回転する(90度ずつ回り、4コマ目はほぼ戻る)
  const glitch = [Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 1.85].map((spin, k) =>
    drawPerson(look, tag(f1, { spin, glitch: k })));
  return pairSheets(look, base, civSort, glitch);
}

// =====================================================================
// 寝不足の店員
// =====================================================================
const APRON: Ramp = [md(3, 4, 6), md(2, 3, 5), md(1, 2, 3)];
const SHIRT: Ramp = [WHITE[0], WHITE[0], WHITE[2]];
const TAG_BAND = md(7, 4, 1);
const CLERK_BUILD: Build = { sh: 7.5, wa: 6, arm: 2.2, thigh: 2.9, shin: 2.4, hem: 1, chest: 1 };
/** 寝ぐせの立った短い髪 */
const HAIR_BED: HairStyle = {
  top: 2, ear: true,
  rows: ['.....h..h....', '...hhHh.hh...', ...HAIR_SHORT.rows.slice(1)]
};

/** 店員の目。くずれのコマでは、まぶたが左右から閉じる(人のまばたきは上下なので、横の線、縦の線で見分ける) */
function clerkEyes(g: PixelGrid, pose: P3, top: number): void {
  const d = pose.down ? 1 : 0;
  const y = (r: number) => top + r + d;
  // 目の下のくま
  if (pose.face !== 'ko' && pose.face !== 'surprised') g.px(9, y(6), SKIN[1]).px(10, y(6), SKIN[1]);
  const k = pose.glitch;
  if (k === undefined) return;
  for (let r = 2; r <= 5; r++) for (let x = 8; x <= 11; x++) g.px(x, y(r), SKIN[0]);
  const W = WHITE[0], O = OUTLINE, L = SKIN[2], S1 = SKIN[1];
  // 左から右へ 8〜11 の4列、上から3段
  const cols: string[][] = [
    [W, W, O, W], // 0:大きく開いた目。ひとみは縦の細い線
    [L, W, O, L], // 1:まぶたが左右から閉じてくる
    [S1, L, O, S1], // 2:縦の線になって閉じる
    [L, GLITCH[1], O, L] // 3:開きかけて、ひとみが黄緑に光る
  ];
  for (let r = 3; r <= 5; r++) cols[k].forEach((c, i) => g.px(8 + i, y(r), c));
  // まゆは上へ離す
  g.px(8, y(1), HAIR[1]).px(9, y(1), HAIR[1]).px(10, y(1), HAIR[1]);
  if (k === 2) g.px(10, y(2), S1).px(10, y(6), S1);
}

/** 名札(白い札に店の色の帯)。flip で逆さ(親玉) */
function nameTag(Pn: Painter, pose: Pose, flip: boolean): void {
  const n = pose.neck;
  const lean = (pose.hip[0] - n[0]) / Math.max(1, pose.hip[1] - n[1]);
  const x = Math.round(n[0] + 4 + lean * 5), y = Math.round(n[1] + 4);
  // ふつうは上に帯、左上に顔写真、右下に名前の線。逆さはこれを180度回した形
  const rows = flip ? ['ggww', 'wwwo', 'bbbb'] : ['bbbb', 'owww', 'wwgg'];
  sprite(Pn, x, y, rows, { b: TAG_BAND, w: WHITE[0], g: WHITE[2], o: OUTLINE });
}

function clerkLook(flipTag = false): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_BED,
    top: SHIRT, sleeve: 'rolled', bottom: [APRON[2], OUTLINE, OUTLINE], legs: 'pants', shoes: [HAIR[1], OUTLINE, OUTLINE], sole: OUTLINE,
    build: CLERK_BUILD,
    headExtra(g, pose) { clerkEyes(g, P(pose), HAIR_BED.top); },
    torso(Pn, pose, top) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      // エプロン(胸から下)
      const apron = Pn.mask();
      top.each((x, y) => { if (y >= n[1] + 3 && x >= Math.round(n[0] - 4 + lean * (y - n[1]))) apron.set(x, y); });
      Pn.fill(apron, APRON, { sep: 'none', hi: 0.3, lo: 0.7 });
      // えりと、エプロンのひも
      Pn.px(Math.round(n[0] + 1), n[1], WHITE[0]).px(Math.round(n[0] + 3), n[1], WHITE[0]);
      for (let dy = 0; dy <= 3; dy++) Pn.px(Math.round(n[0] - 3 + lean * dy), n[1] + dy, APRON[2]);
      // 前のポケット
      for (let dx = 0; dx <= 5; dx++) Pn.px(Math.round(n[0] + dx + lean * 12), n[1] + 12, APRON[2]);
      nameTag(Pn, pose, flipTag);
    }
  };
}

function clerkSheets(): Pair {
  const look = withSignal(clerkLook(), SKIN[0]);
  const base = STAND;
  // 市民も宇宙人も:かくっと船をこぐ(まぶたが重い → 首が落ちる → さらに落ちる → はっと起きる)
  const f0 = withFace(base, 'shut', { down: true });
  const f1 = withFace(moveUpper(base, 1, 1), 'shut', { down: true });
  f1.head = [36, 21];
  const f2 = withFace(moveUpper(base, 1, 2), 'shut', { down: true });
  f2.head = [38, 24]; f2.neck = [34, 21];
  f2.aF = { e: [32, 31], h: [35, 38] };
  const f3 = withFace(moveUpper(base, 0, -1), 'surprised');
  const civSort = [f0, f1, f2, f3];
  // くずれ:まばたきが横に閉じる。体はまぶたの重いコマのまま
  const glitch = [0, 1, 2, 3].map((k) => drawPerson(look, tag(withFace(base, 'normal'), { glitch: k })));
  return pairSheets(look, base, civSort, glitch);
}

// =====================================================================
// ロボットダンスの学生
// =====================================================================
const JACKET: Ramp = [md(7, 3, 2), md(6, 1, 1), md(4, 0, 1)];
const TRACK: Ramp = [md(2, 2, 3), md(1, 1, 2), md(1, 1, 2)];
const KICKS: Ramp = [WHITE[0], WHITE[0], WHITE[2]];
const DANCER_BUILD: Build = { sh: 7.5, wa: 5.5, arm: 2.2, thigh: 2.8, shin: 2.3, hem: 0, chest: 1 };

/** 後ろ向きにかぶった帽子(つばが後ろ) */
function backwardsCap(g: PixelGrid): void {
  const rows = [
    '....cccccc...',
    '..cLLccccccc.',
    '.cLLcccccccd.',
    'bbbcccccccdd.'
  ];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      const c = ch === 'c' ? JACKET[1] : ch === 'L' ? JACKET[0] : ch === 'd' ? JACKET[2] : ch === 'b' ? JACKET[2] : null;
      if (c) g.px(x, y, c);
    }
  });
}

/** 腕のつけねの黄緑の継ぎ目(腕がのびるくずれ) */
function armSeam(Pn: Painter, pose: Pose): void {
  const { sF } = shoulders(pose);
  const e = pose.aF.e;
  const m = mix(sF, e, 0.4);
  const dx = e[0] - sF[0], dy = e[1] - sF[1], L = Math.hypot(dx, dy) || 1;
  const px = -dy / L, py = dx / L;
  for (let k = -2; k <= 2; k++) Pn.px(Math.round(m[0] + px * k), Math.round(m[1] + py * k), k === 0 ? GLITCH[0] : GLITCH[1]);
  const m2 = mix(sF, e, 0.75);
  for (let k = -1; k <= 1; k++) Pn.px(Math.round(m2[0] + px * k), Math.round(m2[1] + py * k), GLITCH[2]);
}

function dancerLook(thinArm = false): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: JACKET, sleeve: 'long', bottom: TRACK, legs: 'pants', shoes: KICKS, sole: JACKET[2],
    build: thinArm ? { ...DANCER_BUILD, arm: 1.6 } : DANCER_BUILD, cuff: WHITE[0],
    headExtra(g) { backwardsCap(g); },
    torso(Pn, pose) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // 前のファスナーと白いえり
      for (let dy = 1; dy <= 16; dy++) Pn.px(X(3, dy), n[1] + dy, dy === 1 ? WHITE[0] : JACKET[2]);
      Pn.px(X(2, 0), n[1], WHITE[0]).px(X(4, 0), n[1], WHITE[0]);
      // 肩の白い線
      Pn.px(X(-5, 2), n[1] + 2, WHITE[0]).px(X(-4, 1), n[1] + 1, WHITE[0]);
    },
    front(Pn, pose) {
      // ジャージの脚の白い線
      Pn.line(R([pose.hip[0] - 1, pose.hip[1] + 0.5]), R([pose.lF.k[0] + 1, pose.lF.k[1]]), WHITE[0]);
      if (P(pose).glitch !== undefined) armSeam(Pn, pose);
    }
  };
}

function dancerSheets(): Pair {
  const look = withSignal(dancerLook(), SKIN[0]);
  const base = STAND;
  const n = base.neck;
  // 市民も宇宙人も:カクカク踊る(ひじを直角に曲げたロボットの形を、1コマずつ切りかえる)
  const f0 = withFace(base, 'normal');
  f0.aF = { e: [n[0] + 5, n[1] + 3], h: [n[0] + 5, n[1] - 4] };
  f0.aB = { e: [n[0] + 8, n[1] + 9], h: [n[0] + 14, n[1] + 9] };
  const f1 = withFace(moveUpper(base, 1, 0), 'shut');
  f1.aF = { e: [n[0] + 6, n[1] + 3], h: [n[0] + 13, n[1] + 3] };
  f1.aB = { e: [n[0] + 9, n[1] + 3], h: [n[0] + 9, n[1] - 4] };
  const f2 = withFace(base, 'normal');
  f2.aF = { e: [n[0] - 1, n[1] + 10], h: [n[0] + 6, n[1] + 10] };
  f2.aB = { e: [n[0] + 9, n[1] + 3], h: [n[0] + 14, n[1] + 3] };
  f2.lF = { k: [30, 46], a: [30, 55], toe: 0 };
  const f3 = withFace(moveUpper(base, 0, 1), 'grin');
  f3.aF = { e: [n[0] + 5, n[1] + 4], h: [n[0] + 5, n[1] + 11] };
  f3.aB = { e: [n[0] + 8, n[1] + 4], h: [n[0] + 8, n[1] - 3] };
  const civSort = [f0, f1, f2, f3];
  // くずれ:手前の腕がのびて戻る(つけねに黄緑の継ぎ目。のびた腕は細くなる)
  const thin = withSignal(dancerLook(true), SKIN[0]);
  const reach = (e: Pt, h: Pt, k: number) => { const q = tag(f1, { glitch: k }); q.aF = { e, h }; return q; };
  const glitch = [
    drawPerson(thin, reach([n[0] + 8, n[1] + 3], [n[0] + 17, n[1] + 3], 0)),
    drawPerson(thin, reach([n[0] + 14, n[1] + 3], [n[0] + 29, n[1] + 3], 1)),
    drawPerson(thin, reach([n[0] + 13, n[1] + 4], [n[0] + 28, n[1] + 1], 2)),
    drawPerson(thin, reach([n[0] + 9, n[1] + 3], [n[0] + 19, n[1] + 3], 3))
  ];
  return pairSheets(look, base, civSort, glitch);
}

// =====================================================================
// 買い物客のおじさん
// =====================================================================
const CARDI: Ramp = [md(6, 5, 2), md(5, 4, 1), md(3, 2, 1)];
const SLACKS: Ramp = [md(4, 4, 4), md(3, 3, 4), md(2, 2, 3)];
const LEATHER: Ramp = [SKIN[2], HAIR[1], OUTLINE];
const UNCLE_BUILD: Build = { sh: 8, wa: 7.5, arm: 2.4, thigh: 3.1, shin: 2.5, hem: 1, chest: 3 };
/** 頭のてっぺんがうすい髪(横と後ろだけ) */
const HAIR_THIN: HairStyle = {
  top: 0, ear: true,
  rows: ['.............', '.............', '..h..........', '.hh..........', '.hhh.........', '.hhh.........', '.hh..........', '.h...........']
};

function uncleLook(pointyEar = false): Look {
  return {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_THIN,
    top: CARDI, sleeve: 'long', bottom: SLACKS, legs: 'pants', shoes: LEATHER, sole: OUTLINE,
    build: UNCLE_BUILD,
    headExtra(g, pose) {
      const d = pose.down ? 1 : 0;
      // 口ひげ
      if (pose.face !== 'surprised') g.px(9, 7 + d, HAIR[1]).px(10, 7 + d, HAIR[1]).px(11, 7 + d, HAIR[1]);
      // 頭のつや
      g.px(6, 1, SKIN[0]).px(7, 1, WHITE[0]);
      if (pointyEar) {
        // 親玉:耳の先が上へとがっている
        g.px(5, 3, SKIN[1]).px(4, 3, SKIN[0]).px(4, 2, SKIN[1]).px(3, 1, SKIN[1]).px(4, 4, SKIN[1]);
      }
    },
    torso(Pn, pose) {
      const n = pose.neck, p = pose.hip;
      const lean = (p[0] - n[0]) / Math.max(1, p[1] - n[1]);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + lean * dy);
      // ポロシャツの白いえりと、カーディガンの前の合わせとボタン
      Pn.px(X(1, 0), n[1], WHITE[0]).px(X(2, 1), n[1] + 1, WHITE[0]).px(X(4, 0), n[1], WHITE[0]).px(X(3, 1), n[1] + 1, SLACKS[0]);
      for (let dy = 2; dy <= 17; dy++) Pn.px(X(3, dy), n[1] + dy, CARDI[2]);
      for (const dy of [5, 9, 13]) Pn.px(X(4, dy), n[1] + dy, WHITE[0]);
    },
    mid(Pn, pose) {
      // 奥の手に下げた白いレジ袋
      const [hx, hy] = R(pose.aB.h);
      if (hy > 44) return;
      const m = Pn.mask().ellipse(hx + 1, hy + 7, 4, 5).union(Pn.mask().rect(hx - 2, hy + 2, 6, 4));
      Pn.fill(m, [WHITE[0], WHITE[0], SLACKS[0]], { sep: 'outline', hi: 0.5, lo: 0.7 });
      Pn.px(hx - 1, hy + 1, OUTLINE).px(hx + 2, hy + 1, OUTLINE);
      Pn.px(hx + 1, hy + 6, SLACKS[0]).px(hx + 2, hy + 7, SLACKS[0]);
      Pn.fill(Pn.mask().ellipse(hx, hy, 1.6, 1.6), [SKIN[1], SKIN[1], SKIN[2]], { sep: 'outline' });
    }
  };
}

/** 色 → 黄緑の段 */
function toGlitch(ramps: Ramp[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of ramps) r.forEach((c, i) => { if (!m.has(c)) m.set(c, GLITCH[i]); });
  return m;
}

/**
 * くずれ:一瞬、体の色がちらつく。k=0 横じま、1 全身、2 胴が横にずれる、3 名残りの細いしま。
 * 絵を描いたあとで色を置きかえる
 */
function flicker(g: PixelGrid, k: number): PixelGrid {
  const clothes = toGlitch([CARDI, SLACKS]);
  const all = toGlitch([CARDI, SLACKS, SKIN, [WHITE[0], WHITE[0], WHITE[0]]]);
  const o = new PixelGrid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    // 2コマ目は胴の高さの帯を右へ3ドットずらす
    const sx = k === 2 && y >= 24 && y <= 31 ? x - 3 : x;
    const c = g.get(sx, y);
    if (!c) continue;
    let out = c;
    if (k === 0 && (y >> 1) % 3 === 0) out = clothes.get(c) ?? c;
    else if (k === 1) out = all.get(c) ?? c;
    else if (k === 2 && (y >> 1) % 2 === 0) out = clothes.get(c) ?? c;
    else if (k === 3 && y % 5 === 0) out = clothes.get(c) ?? c;
    o.px(x, y, out);
  }
  return o;
}

function uncleSheets(): Pair {
  const look = withSignal(uncleLook(), SKIN[0]);
  const withBag = (p: Pose): Pose => { const q = clonePose(p); q.aB = { e: [q.neck[0] + 7, q.neck[1] + 9], h: [q.neck[0] + 9, q.neck[1] + 15] }; return q; };
  const base = withBag(STAND);
  // 市民も宇宙人も:腰をさする(少し前かがみで、手前の手を腰の後ろで上下させる)
  const rub = (p: Pose, up: number): Pose => {
    const q = clonePose(p);
    q.aF = { e: [q.neck[0] - 6, q.neck[1] + 9], h: [q.hip[0] - 7, q.hip[1] - 4 - up] };
    return q;
  };
  const civSort = [
    rub(withFace(moveUpper(base, 1, 1), 'shut'), 0),
    rub(withFace(moveUpper(base, 1, 1), 'hurt'), 3),
    rub(withFace(moveUpper(base, 1, 2), 'shut'), 1),
    rub(withFace(moveUpper(base, 0, 1), 'normal'), 4)
  ];
  const glitch = [0, 1, 2, 3].map((k) => flicker(drawPerson(look, civSort[0]), k));
  return pairSheets(look, base, civSort, glitch, { walk: walkFrames(base).map(withBag) });
}

// =====================================================================
// 親玉の化けた姿:市民の絵を伸ばして、どこか1か所だけおかしくする(くずれは出ない)
// =====================================================================

function disguiseRows(look: Look, base: Pose, sort: Pose[], sy = 1.1, walk?: Pose[]): PixelGrid[][] {
  const st = (p: Pose) => stretchPose(p, sy, 1.05);
  return [
    idleFrames(base).map((p) => drawPerson(look, st(p))),
    (walk ?? walkFrames(base)).map((p) => drawPerson(look, st(p))),
    sort.map((p) => drawPerson(look, st(p)))
  ];
}

// ---------------------------------------------------------------------

export function buildPeople3(skip: Set<string>): Record<string, PixelGrid[][]> {
  const out: Record<string, PixelGrid[][]> = {};
  const need = (...k: string[]) => k.some((x) => !skip.has(x));
  if (need('mascot_civ', 'mascot_bad', 'boss3_disguise_mascot')) {
    const s = mascotSheets();
    out.mascot_civ = s.civ; out.mascot_bad = s.bad;
    out.boss3_disguise_mascot = disguiseRows(mascotLook(true), s.base, s.civSort, 1.02);
  }
  if (need('clerk_civ', 'clerk_bad', 'boss3_disguise_clerk')) {
    const s = clerkSheets();
    out.clerk_civ = s.civ; out.clerk_bad = s.bad;
    out.boss3_disguise_clerk = disguiseRows(clerkLook(true), s.base, s.civSort);
  }
  if (need('dancer_civ', 'dancer_bad')) {
    const s = dancerSheets();
    out.dancer_civ = s.civ; out.dancer_bad = s.bad;
  }
  if (need('uncle_civ', 'uncle_bad', 'boss3_disguise_uncle')) {
    const s = uncleSheets();
    out.uncle_civ = s.civ; out.uncle_bad = s.bad;
    const withBag = (p: Pose): Pose => { const q = clonePose(p); q.aB = { e: [q.neck[0] + 7, q.neck[1] + 9], h: [q.neck[0] + 9, q.neck[1] + 15] }; return q; };
    out.boss3_disguise_uncle = disguiseRows(uncleLook(true), s.base, s.civSort, 1.1, walkFrames(s.base).map(withBag));
  }
  return out;
}
