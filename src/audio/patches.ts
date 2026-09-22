// 曲で使う楽器(FMの音色、PSGの矩形波)とドラム。
import { type Ctx, type FmPatch, drop, fm, hz, noise, tone } from './synth';

const E = (a: number, d: number, s: number, r: number) => ({ a, d, s, r });

// ---------------------------------------------------------------- FMの音色

/** スラップ気味のFMベース(3オペレーターの直列) */
export const BASS: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.5, env: E(0.002, 0.35, 0.55, 0.04) },
    { ratio: 1, lvl: 2.4, env: E(0.001, 0.12, 0.3, 0.04) },
    { ratio: 3, lvl: 0.9, env: E(0.001, 0.05, 0.1, 0.04) }
  ],
  mods: [[2, 1], [1, 0]],
  out: [0]
};

/** ブラス(2組の2オペレーターを少しずらして重ねる=アルゴリズム4の形) */
export const BRASS: FmPatch = {
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
export const HARD: FmPatch = {
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
export const PLUCK: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.34, env: E(0.002, 0.25, 0.35, 0.05) },
    { ratio: 2, lvl: 1.5, env: E(0.002, 0.12, 0.25, 0.05) },
    { ratio: 3, lvl: 0.6, env: E(0.001, 0.06, 0.0, 0.05) }
  ],
  mods: [[2, 1], [1, 0]],
  out: [0]
};

/** クラビっぽい音(結果発表のドタバタ用) */
export const CLAV: FmPatch = {
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
export const BELL: FmPatch = {
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
export const PAD: FmPatch = {
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
export const STAB: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.22, env: E(0.002, 0.3, 0.0, 0.05) },
    { ratio: 0.5, lvl: 3.0, env: E(0.001, 0.2, 0.1, 0.05) },
    { ratio: 1.5, lvl: 0.14, env: E(0.002, 0.25, 0.0, 0.05) },
    { ratio: 2, lvl: 0.12, env: E(0.002, 0.2, 0.0, 0.05) }
  ],
  mods: [[1, 0], [1, 2], [1, 3]],
  out: [0, 2, 3]
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
  /** PSGの短い矩形波(アルペジオ用) */
  sq: (ctx, out, t, midi, gate, vol) => {
    tone(ctx, out, t, { f: hz(midi), gate: Math.min(gate, 0.09), env: E(0.001, 0.08, 0.4, 0.03), vol: 0.1 * vol });
  },
  /** PSGののばす矩形波(ビブラートつき) */
  sqlong: (ctx, out, t, midi, gate, vol) => {
    tone(ctx, out, t, { f: hz(midi), gate, env: E(0.004, 0.3, 0.7, 0.06), vol: 0.09 * vol, vib: [5.5, 10] });
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
  // 指パッチン/リム(静かな曲用)
  r: (ctx, out, t, v) => {
    noise(ctx, out, t, { gate: 0.03, env: E(0.001, 0.03, 0, 0.01), vol: 0.3 * v, type: 'bandpass', f: 3200, q: 2 });
    drop(ctx, out, t, 600, 500, 0.02, 0.15 * v, 0.03, 'triangle');
  }
};
