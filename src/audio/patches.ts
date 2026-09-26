// 曲で使う楽器(FMの音色、PSGの矩形波)とドラム。
import { type Ctx, E, type FmPatch, drop, fm, hz, noise, tone } from './synth';

// ---------------------------------------------------------------- FMの音色

/** スラップ気味のFMベース(3オペレーターの直列) */
const BASS: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.5, env: E(0.002, 0.35, 0.55, 0.04) },
    { ratio: 1, lvl: 2.4, env: E(0.001, 0.12, 0.3, 0.04) },
    { ratio: 3, lvl: 0.9, env: E(0.001, 0.05, 0.1, 0.04) }
  ],
  mods: [[2, 1], [1, 0]],
  out: [0]
};

/** ブラス(2組の2オペレーターを少しずらして重ねる=アルゴリズム4の形) */
const BRASS: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.22, env: E(0.02, 0.3, 0.75, 0.07) },
    { ratio: 1, lvl: 1.7, env: E(0.05, 0.3, 0.55, 0.07) },
    { ratio: 1, det: 8, lvl: 0.16, env: E(0.02, 0.3, 0.75, 0.07) },
    { ratio: 2, lvl: 0.6, env: E(0.03, 0.2, 0.4, 0.07) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2],
  vib: [5.5, 14, 0.2]
};

/** 硬いリード(ボス用。変調を強めて持続させ、ノコギリ波っぽく) */
const HARD: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.22, env: E(0.004, 0.25, 0.8, 0.05) },
    { ratio: 1, lvl: 2.6, env: E(0.004, 0.2, 0.7, 0.05) },
    { ratio: 2, det: -6, lvl: 0.12, env: E(0.004, 0.25, 0.7, 0.05) },
    { ratio: 1, lvl: 1.2, env: E(0.004, 0.15, 0.5, 0.05) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2],
  vib: [6.5, 18, 0.15]
};

/** はじくようなリード(仕分け用。偶数倍の変調でうつろな音) */
const PLUCK: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.34, env: E(0.002, 0.25, 0.35, 0.05) },
    { ratio: 2, lvl: 1.5, env: E(0.002, 0.12, 0.25, 0.05) },
    { ratio: 3, lvl: 0.6, env: E(0.001, 0.06, 0.0, 0.05) }
  ],
  mods: [[2, 1], [1, 0]],
  out: [0]
};

/** クラビっぽい音(結果発表のドタバタ用) */
const CLAV: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.3, env: E(0.002, 0.2, 0.3, 0.04) },
    { ratio: 3, lvl: 1.4, env: E(0.001, 0.08, 0.2, 0.04) },
    { ratio: 1, det: 5, lvl: 0.12, env: E(0.002, 0.2, 0.3, 0.04) },
    { ratio: 1, lvl: 1.0, env: E(0.001, 0.1, 0.3, 0.04) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2]
};

/** エレピ/ベル(結果画面の落ち着いたループ) */
const BELL: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.24, env: E(0.002, 1.2, 0.0, 0.25) },
    { ratio: 1, lvl: 0.9, env: E(0.002, 0.6, 0.15, 0.25) },
    { ratio: 1, det: 4, lvl: 0.1, env: E(0.002, 0.5, 0.0, 0.2) },
    { ratio: 14, lvl: 0.25, env: E(0.001, 0.08, 0.0, 0.05) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2]
};

/** やわらかいパッド */
const PAD: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.13, env: E(0.25, 0.6, 0.8, 0.35) },
    { ratio: 2, lvl: 0.5, env: E(0.3, 0.6, 0.6, 0.35) },
    { ratio: 1, det: 9, lvl: 0.1, env: E(0.3, 0.6, 0.8, 0.35) }
  ],
  mods: [[1, 0], [1, 2]],
  out: [0, 2],
  vib: [4.5, 8, 0.3]
};

/** オケヒット風の和音のスタブ(1オクターブと5度をキャリアで重ねる) */
const STAB: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.22, env: E(0.002, 0.3, 0.0, 0.05) },
    { ratio: 0.5, lvl: 3.0, env: E(0.001, 0.2, 0.1, 0.05) },
    { ratio: 1.5, lvl: 0.14, env: E(0.002, 0.25, 0.0, 0.05) },
    { ratio: 2, lvl: 0.12, env: E(0.002, 0.2, 0.0, 0.05) }
  ],
  mods: [[1, 0], [1, 2], [1, 3]],
  out: [0, 2, 3]
};

/** 低く太いベース(ステージ2用。のびが長く、半分の周波数の変調で少しうなる) */
const DEEP: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.5, env: E(0.003, 0.7, 0.45, 0.08) },
    { ratio: 1, lvl: 1.8, env: E(0.002, 0.2, 0.3, 0.08) },
    { ratio: 0.5, lvl: 0.7, env: E(0.002, 0.4, 0.2, 0.08) }
  ],
  mods: [[2, 1], [1, 0]],
  out: [0]
};

/** 木琴/ビブラフォン風のマレット(地下駐車場の少し不気味なリード。エコーと合わせる) */
const MALLET: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.28, env: E(0.002, 0.45, 0.08, 0.12) },
    { ratio: 4, lvl: 1.1, env: E(0.001, 0.12, 0.0, 0.08) },
    { ratio: 1, det: 7, lvl: 0.12, env: E(0.002, 0.4, 0.05, 0.12) },
    { ratio: 7, lvl: 0.35, env: E(0.001, 0.05, 0.0, 0.05) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2],
  vib: [5, 9, 0.12]
};

/** 宇宙っぽいふわふわしたパッド(ステージ3用。ゆっくり立ち上がり、ずらした2つの音がゆれる) */
const SPACE: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.11, env: E(0.35, 0.8, 0.8, 0.45) },
    { ratio: 3, det: 7, lvl: 0.45, env: E(0.5, 1.0, 0.5, 0.45) },
    { ratio: 2, det: -10, lvl: 0.06, env: E(0.45, 0.8, 0.8, 0.45) }
  ],
  mods: [[1, 0], [1, 2]],
  out: [0, 2],
  vib: [5, 22, 0.15]
};

/** 鼻にかかったラッパ風のリード(フリープレイ用。持続する強めの変調でブーッとした、少しまぬけな音) */
const TOOT: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.24, env: E(0.008, 0.2, 0.7, 0.04) },
    { ratio: 1, lvl: 2.0, env: E(0.01, 0.15, 0.6, 0.04) },
    { ratio: 2, lvl: 0.08, env: E(0.008, 0.2, 0.6, 0.04) },
    { ratio: 3, lvl: 0.7, env: E(0.005, 0.1, 0.3, 0.04) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2],
  vib: [6, 16, 0.12]
};

/** エレピ(ステージ4用)。BELL より変調を弱くした丸い音に、たたいた瞬間の小さな「コン」を足す */
const EPIANO: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.26, env: E(0.003, 1.4, 0.15, 0.3) },
    { ratio: 1, lvl: 0.55, env: E(0.002, 0.5, 0.1, 0.25) },
    { ratio: 1, det: 5, lvl: 0.08, env: E(0.003, 0.9, 0.1, 0.25) },
    { ratio: 7, lvl: 0.35, env: E(0.001, 0.05, 0.0, 0.05) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2],
  vib: [4.5, 5, 0.2]
};

/** ウッドベース(ステージ4用)。はじいた「ボン」がすぐ丸くなる、木の胴っぽい低い音 */
const UPRIGHT: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.55, env: E(0.004, 0.55, 0.25, 0.06) },
    { ratio: 1, lvl: 1.3, env: E(0.002, 0.07, 0.15, 0.05) },
    { ratio: 2, lvl: 0.06, env: E(0.004, 0.3, 0.1, 0.05) }
  ],
  mods: [[1, 0]],
  out: [0, 2]
};

/** 紫のうなり(ステージ4用のパッド)。ゆっくり立ち上がり、少しずらした音がゆっくりうねる */
const PSYPAD: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.1, env: E(0.5, 1.0, 0.8, 0.5) },
    { ratio: 1.5, det: 4, lvl: 0.6, env: E(0.6, 1.0, 0.6, 0.5) },
    { ratio: 1, det: -12, lvl: 0.07, env: E(0.6, 1.0, 0.8, 0.5) },
    { ratio: 0.5, lvl: 0.3, env: E(0.6, 1.0, 0.6, 0.5) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2],
  vib: [3.2, 26, 0.3]
};

/** 重いオルガン(ステージ4のボス戦)。倍音を足し重ねた音に、少しの変調でざらつきと、ゆれを足す */
const ORGAN: FmPatch = {
  ops: [
    { ratio: 0.5, lvl: 0.08, env: E(0.004, 0.2, 1, 0.05) },
    { ratio: 1, lvl: 0.12, env: E(0.004, 0.2, 1, 0.05) },
    { ratio: 2, lvl: 0.07, env: E(0.004, 0.2, 1, 0.05) },
    { ratio: 3, lvl: 0.05, env: E(0.002, 0.15, 0.4, 0.05) },
    { ratio: 1, lvl: 0.7, env: E(0.004, 0.2, 0.8, 0.05) }
  ],
  mods: [[4, 1]],
  out: [0, 1, 2, 3],
  vib: [6.5, 10, 0]
};

/** ビブラフォン(ステージ4のエレベーターの曲) */
const VIBES: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.26, env: E(0.002, 1.1, 0.05, 0.2) },
    { ratio: 4, lvl: 0.5, env: E(0.001, 0.2, 0, 0.1) },
    { ratio: 1, det: 6, lvl: 0.08, env: E(0.002, 0.9, 0.05, 0.2) }
  ],
  mods: [[1, 0]],
  out: [0, 2],
  vib: [5.5, 7, 0]
};

// ---------------------------------------------------------------- 楽器

export type Instrument = (ctx: Ctx, out: AudioNode, t: number, midi: number, gate: number, vol: number) => void;

const fmInst = (p: FmPatch): Instrument => (ctx, out, t, midi, gate, vol) => {
  fm(ctx, out, t, hz(midi), gate, p, vol);
};

export const INSTRUMENTS: Record<string, Instrument> = {
  bass: fmInst(BASS),
  brass: fmInst(BRASS),
  hard: fmInst(HARD),
  pluck: fmInst(PLUCK),
  clav: fmInst(CLAV),
  bell: fmInst(BELL),
  pad: fmInst(PAD),
  stab: fmInst(STAB),
  deep: fmInst(DEEP),
  mallet: fmInst(MALLET),
  space: fmInst(SPACE),
  epiano: fmInst(EPIANO),
  /** ウッドベース。少し下からすべりこむ */
  upright: (ctx, out, t, midi, gate, vol) => {
    fm(ctx, out, t, hz(midi), gate, UPRIGHT, vol, { from: -35, to: 0, time: 0.04 });
  },
  psypad: fmInst(PSYPAD),
  organ: fmInst(ORGAN),
  vibes: fmInst(VIBES),
  /** PSGの短い矩形波(アルペジオ用) */
  sq: (ctx, out, t, midi, gate, vol) => {
    tone(ctx, out, t, { f: hz(midi), gate: Math.min(gate, 0.09), env: E(0.001, 0.08, 0.4, 0.03), vol: 0.1 * vol });
  },
  /** ラッパ風のリード(フリープレイ用)。半音より少し下からすくい上げて、とぼけた感じに */
  toot: (ctx, out, t, midi, gate, vol) => {
    fm(ctx, out, t, hz(midi), gate, TOOT, vol, { from: -70, to: 0, time: 0.05 });
  },
  /** スライドホイッスル(フリープレイの合いの手)。1オクターブ下から音の高さまでヒューイッと上がる */
  slide: (ctx, out, t, midi, gate, vol) => {
    tone(ctx, out, t, { f: hz(midi - 12), f2: hz(midi), slide: gate * 0.8, gate, env: E(0.02, 0.3, 0.8, 0.05), vol: 0.12 * vol, wave: 'triangle', vib: [7, 20] });
  },
  /** テルミン風(ステージ3用)。半音下からすくい上げ、ゆっくりふくらむ三角波に深いビブラート */
  theremin: (ctx, out, t, midi, gate, vol) => {
    tone(ctx, out, t, { f: hz(midi - 1), f2: hz(midi), slide: 0.1, gate, env: E(0.07, 0.4, 0.8, 0.14), vol: 0.14 * vol, wave: 'triangle', vib: [5.5, 32] });
  }
};

// ---------------------------------------------------------------- ドラム

export type Drum = (ctx: Ctx, out: AudioNode, t: number, vol: number) => void;

export const DRUMS: Record<string, Drum> = {
  // キック:音程が下がるサイン波 + 短いクリック
  k: (ctx, out, t, v) => {
    drop(ctx, out, t, 170, 42, 0.09, 0.9 * v, 0.22);
    noise(ctx, out, t, { gate: 0.012, env: E(0.001, 0.01, 0, 0.005), vol: 0.25 * v, type: 'lowpass', f: 2500 });
  },
  // スネア:ノイズ + 胴鳴りの三角波
  s: (ctx, out, t, v) => {
    noise(ctx, out, t, { gate: 0.14, env: E(0.001, 0.12, 0, 0.03), vol: 0.45 * v, type: 'bandpass', f: 2200, q: 0.6 });
    drop(ctx, out, t, 220, 160, 0.05, 0.35 * v, 0.08, 'triangle');
  },
  // クローズハイハット
  h: (ctx, out, t, v) => {
    noise(ctx, out, t, { gate: 0.03, env: E(0.001, 0.03, 0, 0.01), vol: 0.16 * v, type: 'highpass', f: 7500 });
  },
  // オープンハイハット
  o: (ctx, out, t, v) => {
    noise(ctx, out, t, { gate: 0.16, env: E(0.001, 0.16, 0.1, 0.04), vol: 0.14 * v, type: 'highpass', f: 6500 });
  },
  // クラッシュ
  c: (ctx, out, t, v) => {
    noise(ctx, out, t, { gate: 0.7, env: E(0.001, 0.7, 0, 0.1), vol: 0.2 * v, type: 'highpass', f: 4200 });
  },
  // タム(高・中・低)
  T: (ctx, out, t, v) => { drop(ctx, out, t, 330, 200, 0.12, 0.5 * v, 0.16); },
  t: (ctx, out, t, v) => { drop(ctx, out, t, 240, 140, 0.12, 0.5 * v, 0.18); },
  l: (ctx, out, t, v) => { drop(ctx, out, t, 170, 95, 0.14, 0.55 * v, 0.2); },
  // 木魚/ウッドブロック:ポクッ(フリープレイ用。とぼけた合いの手)
  b: (ctx, out, t, v) => {
    drop(ctx, out, t, 1250, 1100, 0.02, 0.28 * v, 0.05, 'triangle');
    drop(ctx, out, t, 1900, 1800, 0.01, 0.07 * v, 0.025);
    noise(ctx, out, t, { gate: 0.01, env: E(0.001, 0.01, 0, 0.005), vol: 0.1 * v, type: 'bandpass', f: 2200, q: 3 });
  },
  // 指パッチン/リム(静かな曲用)
  r: (ctx, out, t, v) => {
    noise(ctx, out, t, { gate: 0.03, env: E(0.001, 0.03, 0, 0.01), vol: 0.3 * v, type: 'bandpass', f: 3200, q: 2 });
    drop(ctx, out, t, 600, 500, 0.02, 0.15 * v, 0.03, 'triangle');
  }
};
