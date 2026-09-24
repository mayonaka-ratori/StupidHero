// 効果音。どれも短く、FMと矩形波とノイズで作る。p は音程の倍率(1=そのまま)。終わる時刻を返す。
import type { SfxName } from './index';
import { type Ctx, type FmPatch, drop, fm, hz, noise, tone } from './synth';

type Sfx = (ctx: Ctx, out: AudioNode, t: number, p: number) => number;

const E = (a: number, d: number, s: number, r: number) => ({ a, d, s, r });
const max = (...xs: number[]) => Math.max(...xs);

/** 短いピコッという矩形波 */
const blipTone = (ctx: Ctx, out: AudioNode, t: number, f: number, len: number, vol: number, wave: OscillatorType = 'square') =>
  tone(ctx, out, t, { f, gate: len, env: E(0.001, len, 0.5, 0.015), vol, wave });

/** 金属っぽいベル(ratio 3.5 の変調) */
const BELL_FX: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.25, env: E(0.001, 0.35, 0, 0.08) },
    { ratio: 3.5, lvl: 1.4, env: E(0.001, 0.25, 0, 0.08) }
  ],
  mods: [[1, 0]],
  out: [0]
};

/** 低いガーン(不協和なFM) */
const GAAN: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.3, env: E(0.002, 0.6, 0.1, 0.12) },
    { ratio: 1.41, lvl: 3.0, env: E(0.001, 0.5, 0.2, 0.12) },
    { ratio: 0.5, lvl: 0.18, env: E(0.002, 0.6, 0.1, 0.12) }
  ],
  mods: [[1, 0], [1, 2]],
  out: [0, 2]
};

/** ブラスの短い音(合図やジングル) */
const HORN: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.26, env: E(0.012, 0.25, 0.7, 0.06) },
    { ratio: 1, lvl: 1.8, env: E(0.03, 0.25, 0.55, 0.06) },
    { ratio: 1, det: 9, lvl: 0.16, env: E(0.012, 0.25, 0.7, 0.06) },
    { ratio: 2, lvl: 0.5, env: E(0.02, 0.2, 0.4, 0.06) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2]
};

/** 低くうなる音(ボスの正体、暴れる) */
const GROWL: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.3, env: E(0.02, 0.5, 0.6, 0.15) },
    { ratio: 0.5, lvl: 4.0, env: E(0.02, 0.4, 0.7, 0.15) },
    { ratio: 1.01, lvl: 0.2, env: E(0.02, 0.5, 0.6, 0.15) },
    { ratio: 3.02, lvl: 1.5, env: E(0.01, 0.3, 0.4, 0.15) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2]
};

/** レーザー(下がっていく強いFM) */
const LASER: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.24, env: E(0.002, 0.5, 0.5, 0.08) },
    { ratio: 0.5, lvl: 2.5, env: E(0.002, 0.4, 0.4, 0.08) },
    { ratio: 1.005, lvl: 0.14, env: E(0.002, 0.5, 0.4, 0.08) }
  ],
  mods: [[1, 0], [1, 2]],
  out: [0, 2]
};

/** エンジンのうなり(半分の周波数の変調で、ブロロロとざらつかせる) */
const MOTOR: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.3, env: E(0.02, 0.4, 0.7, 0.1) },
    { ratio: 0.5, lvl: 3.2, env: E(0.01, 0.3, 0.8, 0.1) },
    { ratio: 2.01, lvl: 0.12, env: E(0.02, 0.4, 0.6, 0.1) },
    { ratio: 0.25, lvl: 1.4, env: E(0.01, 0.3, 0.7, 0.1) }
  ],
  mods: [[1, 0], [3, 2]],
  out: [0, 2]
};

/** ビブラフォン風のやわらかいベル(館内放送のチャイム) */
const VIBE: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.24, env: E(0.002, 1.0, 0, 0.15) },
    { ratio: 4, lvl: 0.45, env: E(0.001, 0.2, 0, 0.1) },
    { ratio: 1, det: 6, lvl: 0.08, env: E(0.002, 0.8, 0, 0.15) }
  ],
  mods: [[1, 0]],
  out: [0, 2]
};

/** UFOのうなり(少しずらした2倍の変調で、ゆれる低い音) */
const HUM: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.3, env: E(0.3, 0.8, 0.8, 0.12) },
    { ratio: 2.01, lvl: 1.0, env: E(0.3, 0.8, 0.7, 0.12) }
  ],
  mods: [[1, 0]],
  out: [0]
};

/** 宇宙人の声(整数倍でない変調で、どこかよその星っぽいピッ) */
const ALIEN: FmPatch = {
  ops: [
    { ratio: 1, lvl: 0.2, env: E(0.001, 0.1, 0.8, 0.02) },
    { ratio: 2.5, lvl: 0.7, env: E(0.001, 0.08, 0.5, 0.02) }
  ],
  mods: [[1, 0]],
  out: [0]
};

export const SFX: Record<SfxName, Sfx> = {
  // ボタン:ピコッ(2音)
  button: (c, o, t, p) => max(blipTone(c, o, t, 1047 * p, 0.035, 0.15), blipTone(c, o, t + 0.035, 1568 * p, 0.05, 0.13)),

  // ワルに決めた:下がる「ブン」+ シュッ
  swipeBad: (c, o, t, p) =>
    max(
      fm(c, o, t, 220 * p, 0.12, HORN, 0.9, { from: 0, to: -900, time: 0.16 }),
      noise(c, o, t, { gate: 0.12, env: E(0.005, 0.1, 0, 0.03), vol: 0.22, type: 'bandpass', f: 1800, f2: 500, q: 1 })
    ),

  // 市民に決めた:上がる「ポロン」+ シュッ
  swipeCiv: (c, o, t, p) =>
    max(
      fm(c, o, t, hz(76) * p, 0.07, BELL_FX, 0.8),
      fm(c, o, t + 0.06, hz(81) * p, 0.12, BELL_FX, 0.8),
      noise(c, o, t, { gate: 0.1, env: E(0.005, 0.08, 0, 0.03), vol: 0.18, type: 'bandpass', f: 1200, f2: 4000, q: 1 })
    ),

  // 残り時間のカウント:カッ
  tick: (c, o, t, p) => max(blipTone(c, o, t, 1760 * p, 0.018, 0.14), noise(c, o, t, { gate: 0.012, env: E(0.001, 0.01, 0, 0.005), vol: 0.16, type: 'highpass', f: 5000 })),

  // 時間切れ:ブブー
  timeUp: (c, o, t, p) =>
    max(
      tone(c, o, t, { f: 196 * p, gate: 0.14, env: E(0.002, 0.2, 0.9, 0.02), vol: 0.16, wave: 'square' }),
      tone(c, o, t, { f: 207 * p, gate: 0.14, env: E(0.002, 0.2, 0.9, 0.02), vol: 0.11, wave: 'sawtooth' }),
      tone(c, o, t + 0.18, { f: 147 * p, gate: 0.3, env: E(0.002, 0.3, 0.8, 0.05), vol: 0.16, wave: 'square' }),
      tone(c, o, t + 0.18, { f: 155 * p, gate: 0.3, env: E(0.002, 0.3, 0.8, 0.05), vol: 0.11, wave: 'sawtooth' })
    ),

  // セリフの文字送り:とても短く小さく
  blip: (c, o, t, p) => blipTone(c, o, t, 880 * p, 0.022, 0.05),

  // 光の突撃:上がっていくうなり + ノイズ
  charge: (c, o, t, p) =>
    max(
      fm(c, o, t, 180 * p, 0.38, LASER, 0.7, { from: 0, to: 2600, time: 0.38 }),
      noise(c, o, t, { gate: 0.38, env: E(0.15, 0.3, 0.8, 0.05), vol: 0.16, type: 'bandpass', f: 600, f2: 6000, q: 1.5 })
    ),

  // 光のパンチ:ドッ + シャッ
  punch: (c, o, t, p) =>
    max(
      drop(c, o, t, 260 * p, 70 * p, 0.08, 0.7, 0.14),
      noise(c, o, t, { gate: 0.08, env: E(0.001, 0.07, 0, 0.02), vol: 0.35, type: 'bandpass', f: 2500 * p, f2: 800, q: 0.8 }),
      tone(c, o, t, { f: 1400 * p, f2: 2600 * p, gate: 0.08, env: E(0.001, 0.08, 0, 0.02), vol: 0.05, wave: 'square' })
    ),

  // 踏みつぶし:ズシン
  stomp: (c, o, t, p) =>
    max(
      drop(c, o, t, 130 * p, 32 * p, 0.2, 0.95, 0.32),
      noise(c, o, t, { gate: 0.18, env: E(0.001, 0.15, 0, 0.05), vol: 0.45, type: 'lowpass', f: 900, f2: 150 }),
      noise(c, o, t, { gate: 0.04, env: E(0.001, 0.03, 0, 0.01), vol: 0.2, type: 'bandpass', f: 1800 })
    ),

  // 必殺技の光線:ビーーッ(下がる)
  beam: (c, o, t, p) =>
    max(
      fm(c, o, t, 1500 * p, 0.42, LASER, 0.75, { from: 0, to: -1400, time: 0.45 }),
      tone(c, o, t, { f: 3000 * p, f2: 1400 * p, gate: 0.42, env: E(0.002, 0.3, 0.5, 0.06), vol: 0.035, wave: 'square', vib: [30, 40] }),
      noise(c, o, t, { gate: 0.42, env: E(0.01, 0.4, 0.4, 0.06), vol: 0.14, type: 'highpass', f: 3000 })
    ),

  // 殴った:バシッ
  hit: (c, o, t, p) =>
    max(
      noise(c, o, t, { gate: 0.07, env: E(0.001, 0.06, 0, 0.02), vol: 0.45, type: 'bandpass', f: 1400 * p, q: 0.9 }),
      drop(c, o, t, 330 * p, 90 * p, 0.07, 0.45, 0.1, 'square')
    ),

  // 大きく殴った:ドカッ
  bigHit: (c, o, t, p) =>
    max(
      noise(c, o, t, { gate: 0.2, env: E(0.001, 0.18, 0, 0.05), vol: 0.5, type: 'lowpass', f: 4000 * p, f2: 400 }),
      drop(c, o, t, 200 * p, 40 * p, 0.14, 0.9, 0.3),
      drop(c, o, t, 420 * p, 110 * p, 0.1, 0.25, 0.14, 'square')
    ),

  // 物が壊れた:ガシャーン
  break: (c, o, t, p) => {
    let end = noise(c, o, t, { gate: 0.3, env: E(0.001, 0.3, 0, 0.08), vol: 0.35, type: 'highpass', f: 2500 * p });
    end = max(end, drop(c, o, t, 180 * p, 60 * p, 0.08, 0.5, 0.12));
    const pings = [2637, 3520, 2960, 4186, 3136];
    pings.forEach((f, i) => {
      end = max(end, tone(c, o, t + 0.02 + i * 0.045, { f: f * p, gate: 0.04, env: E(0.001, 0.06, 0, 0.03), vol: 0.05, wave: 'triangle' }));
    });
    return end;
  },

  // 待て/行けの合図が出た:ピコン!
  mark: (c, o, t, p) => max(blipTone(c, o, t, 988 * p, 0.05, 0.16), blipTone(c, o, t + 0.06, 1319 * p, 0.12, 0.16)),

  // 待て:ブッブ(下がる2音)
  stop: (c, o, t, p) => max(fm(c, o, t, hz(67) * p, 0.1, HORN, 0.9), fm(c, o, t + 0.12, hz(62) * p, 0.18, HORN, 0.9)),

  // 行け:パッパー(上がる2音)
  go: (c, o, t, p) => max(fm(c, o, t, hz(72) * p, 0.08, HORN, 0.9), fm(c, o, t + 0.1, hz(79) * p, 0.22, HORN, 1)),

  // やっちまったー(ガーン)
  oops: (c, o, t, p) =>
    max(
      fm(c, o, t, hz(48) * p, 0.35, GAAN, 1, { from: 0, to: -300, time: 0.5 }),
      fm(c, o, t, hz(54) * p, 0.35, GAAN, 0.7, { from: 0, to: -300, time: 0.5 }),
      noise(c, o, t, { gate: 0.06, env: E(0.001, 0.05, 0, 0.02), vol: 0.3, type: 'lowpass', f: 1500 })
    ),

  // まあいいか(キラーン)
  okay: (c, o, t, p) => {
    let end = 0;
    [88, 92, 95, 100].forEach((m, i) => {
      end = max(end, fm(c, o, t + i * 0.05, hz(m) * p, i === 3 ? 0.25 : 0.05, BELL_FX, i === 3 ? 0.9 : 0.6));
    });
    return max(end, tone(c, o, t + 0.15, { f: hz(100) * p, gate: 0.25, env: E(0.01, 0.3, 0.3, 0.1), vol: 0.03, wave: 'square', vib: [9, 30] }));
  },

  // キラキラ
  sparkle: (c, o, t, p) => {
    let end = 0;
    [96, 103, 100, 108, 105].forEach((m, i) => {
      end = max(end, fm(c, o, t + i * 0.055, hz(m) * p, 0.03, BELL_FX, 0.45));
    });
    return end;
  },

  // ボスが正体を現す:ズゴゴ…ジャーン
  reveal: (c, o, t, p) =>
    max(
      fm(c, o, t, hz(38) * p, 0.55, GROWL, 1, { from: 300, to: -200, time: 0.6 }),
      fm(c, o, t, hz(44) * p, 0.55, GROWL, 0.7, { from: 300, to: -200, time: 0.6 }),
      noise(c, o, t, { gate: 0.55, env: E(0.2, 0.4, 0.6, 0.15), vol: 0.22, type: 'lowpass', f: 300, f2: 2500 }),
      drop(c, o, t + 0.45, 120 * p, 40 * p, 0.2, 0.7, 0.3)
    ),

  // ボスが暴れる:ゴゴゴッ
  rampage: (c, o, t, p) => {
    let end = fm(c, o, t, hz(33) * p, 0.4, GROWL, 0.9, { from: 0, to: 200, time: 0.4 });
    for (let i = 0; i < 3; i++) end = max(end, drop(c, o, t + i * 0.13, 110 * p, 40 * p, 0.1, 0.55, 0.14));
    return max(end, noise(c, o, t, { gate: 0.42, env: E(0.01, 0.4, 0.6, 0.06), vol: 0.25, type: 'lowpass', f: 700, rate: 0.35 }));
  },

  // ボス戦の連打1回ぶん:トッ(小さく短く、少しだけ高さをばらす)
  rush: (c, o, t, p) => {
    const q = p * (0.94 + Math.random() * 0.12);
    return max(
      drop(c, o, t, 180 * q, 90 * q, 0.04, 0.38, 0.06),
      noise(c, o, t, { gate: 0.025, env: E(0.001, 0.02, 0, 0.01), vol: 0.1, type: 'bandpass', f: 1600 * q, q: 1.2 })
    );
  },

  // ボスを倒した:ドーン…と下がっていく
  bossDown: (c, o, t, p) =>
    max(
      drop(c, o, t, 150 * p, 28 * p, 0.6, 1, 0.8),
      noise(c, o, t, { gate: 0.8, env: E(0.001, 0.8, 0, 0.15), vol: 0.5, type: 'lowpass', f: 5000, f2: 120 }),
      fm(c, o, t, hz(55) * p, 0.5, GAAN, 0.6, { from: 0, to: -1200, time: 0.8 })
    ),

  // 勝利ポーズの爆発:ボカーン
  explosion: (c, o, t, p) =>
    max(
      drop(c, o, t, 110 * p, 35 * p, 0.3, 0.9, 0.5),
      noise(c, o, t, { gate: 0.55, env: E(0.001, 0.5, 0, 0.1), vol: 0.5, type: 'lowpass', f: 3000 * p, f2: 200, rate: 0.5 })
    ),

  // 結果発表のジングル:パパパ・パーン
  fanfare: (c, o, t, p) => {
    const b = 0.1;
    const lead: [number, number, number][] = [[72, 0, 0.07], [72, 1, 0.07], [72, 2, 0.07], [79, 3, 0.5]];
    const low: [number, number, number][] = [[64, 0, 0.07], [64, 1, 0.07], [64, 2, 0.07], [71, 3, 0.5]];
    let end = 0;
    for (const [m, i, g] of lead) end = max(end, fm(c, o, t + i * b, hz(m) * p, g, HORN, 1));
    for (const [m, i, g] of low) end = max(end, fm(c, o, t + i * b, hz(m) * p, g, HORN, 0.6));
    end = max(end, fm(c, o, t + 3 * b, hz(43) * p, 0.5, HORN, 0.7));
    end = max(end, noise(c, o, t + 3 * b, { gate: 0.5, env: E(0.001, 0.5, 0, 0.1), vol: 0.18, type: 'highpass', f: 4200 }));
    return max(end, drop(c, o, t + 3 * b, 170, 42, 0.09, 0.8, 0.22));
  },

  // 称号がドンと出る:ドン!
  stamp: (c, o, t, p) =>
    max(
      drop(c, o, t, 150 * p, 40 * p, 0.12, 1, 0.25),
      fm(c, o, t, hz(36) * p, 0.1, GAAN, 0.6),
      noise(c, o, t, { gate: 0.08, env: E(0.001, 0.07, 0, 0.03), vol: 0.35, type: 'bandpass', f: 1200, q: 0.7 })
    ),

  // ---------------------------------------------------------------- ステージ2

  // 口笛で仲間を呼ぶ:ピュッ・ピューイ(上がる2つ。やわらかい三角波と息の音)
  whistle: (c, o, t, p) =>
    max(
      tone(c, o, t, { f: 1250 * p, f2: 1900 * p, slide: 0.07, gate: 0.08, env: E(0.012, 0.1, 0.8, 0.03), vol: 0.13, wave: 'triangle' }),
      tone(c, o, t + 0.14, { f: 1150 * p, f2: 2150 * p, slide: 0.16, gate: 0.26, env: E(0.015, 0.3, 0.8, 0.07), vol: 0.14, wave: 'triangle', vib: [9, 25] }),
      noise(c, o, t, { gate: 0.4, env: E(0.02, 0.3, 0.4, 0.06), vol: 0.035, type: 'bandpass', f: 1600 * p, f2: 2400 * p, q: 3 })
    ),

  // 車のエンジンをふかす:ブォンッ(上がってから落ちる。ざらざらした低い音)
  engine: (c, o, t, p) =>
    max(
      fm(c, o, t, 70 * p, 0.42, MOTOR, 0.75, { from: -200, to: 1000, time: 0.3 }),
      tone(c, o, t, { f: 38 * p, f2: 95 * p, slide: 0.3, gate: 0.42, env: E(0.01, 0.4, 0.6, 0.1), vol: 0.05, wave: 'sawtooth' }),
      noise(c, o, t, { gate: 0.42, env: E(0.02, 0.35, 0.5, 0.1), vol: 0.16, type: 'lowpass', f: 350, f2: 1100, rate: 0.3 })
    ),

  // タイヤのきしみ:キキーッ(少しずれた2つの高い音をふるわせる + こすれるノイズ)
  skid: (c, o, t, p) =>
    max(
      tone(c, o, t, { f: 1900 * p, f2: 1500 * p, gate: 0.42, env: E(0.02, 0.35, 0.7, 0.08), vol: 0.06, wave: 'triangle', vib: [22, 45] }),
      tone(c, o, t, { f: 1960 * p, f2: 1560 * p, gate: 0.42, env: E(0.02, 0.35, 0.6, 0.08), vol: 0.035, wave: 'square', vib: [17, 60] }),
      noise(c, o, t, { gate: 0.42, env: E(0.01, 0.35, 0.5, 0.08), vol: 0.14, type: 'bandpass', f: 2600 * p, f2: 1800 * p, q: 2.5 })
    ),

  // クラクション:プッ・プー(長3度で2つ重ねた、鼻にかかった音)
  horn: (c, o, t, p) => {
    let end = 0;
    for (const [at, gate] of [[0, 0.08], [0.13, 0.26]] as const) {
      end = max(
        end,
        tone(c, o, t + at, { f: 392 * p, gate, env: E(0.004, 0.2, 0.85, 0.03), vol: 0.07, wave: 'square' }),
        tone(c, o, t + at, { f: 494 * p, gate, env: E(0.004, 0.2, 0.85, 0.03), vol: 0.05, wave: 'sawtooth' }),
        fm(c, o, t + at, 392 * p, gate, HORN, 0.35)
      );
    }
    return end;
  },

  // 車がぶつかる、ひっくり返る:ドガシャーン(重い音 + 金属のガン + ガラスのかけら)
  crash: (c, o, t, p) => {
    let end = max(
      drop(c, o, t, 120 * p, 30 * p, 0.25, 0.9, 0.4),
      noise(c, o, t, { gate: 0.45, env: E(0.001, 0.4, 0, 0.1), vol: 0.45, type: 'lowpass', f: 3500 * p, f2: 250, rate: 0.6 }),
      fm(c, o, t, hz(40) * p, 0.18, GAAN, 0.5, { from: 0, to: -500, time: 0.3 }),
      noise(c, o, t + 0.04, { gate: 0.3, env: E(0.001, 0.28, 0, 0.08), vol: 0.18, type: 'highpass', f: 3000 * p })
    );
    const pings = [3136, 2489, 3729, 2794];
    pings.forEach((f, i) => {
      end = max(end, tone(c, o, t + 0.06 + i * 0.06, { f: f * p, gate: 0.04, env: E(0.001, 0.06, 0, 0.03), vol: 0.04, wave: 'triangle' }));
    });
    return end;
  },

  // ---------------------------------------------------------------- ステージ3

  // 館内放送のチャイム:ピンポンパンポン(上がる4つのやわらかいベル。約1.3秒)
  chime: (c, o, t, p) => {
    let end = 0;
    [72, 76, 79, 84].forEach((m, i) => {
      const gate = i === 3 ? 0.55 : 0.2;
      end = max(end, fm(c, o, t + i * 0.2, hz(m) * p, gate, VIBE, 0.75), fm(c, o, t + i * 0.2, hz(m - 12) * p, gate, VIBE, 0.3));
    });
    return end;
  },

  // UFOが下りてくる:ヒュイイーン(ふるえながら下がる高い音 + だんだん大きくなる低いうなり。約1秒)
  ufoDown: (c, o, t, p) =>
    max(
      tone(c, o, t, { f: 1500 * p, f2: 520 * p, gate: 0.85, env: E(0.05, 0.8, 0.7, 0.12), vol: 0.1, wave: 'triangle', vib: [11, 70] }),
      tone(c, o, t, { f: 750 * p, f2: 260 * p, gate: 0.85, env: E(0.1, 0.8, 0.6, 0.12), vol: 0.025, wave: 'square', vib: [11, 70] }),
      fm(c, o, t, 70 * p, 0.85, HUM, 0.6)
    ),

  // UFOの吸い上げる光:ウィン(上がるうなり + シュワー)。0.5秒ごとに鳴らし続けると、つながって「ウィンウィン…」とふるえる
  tractor: (c, o, t, p) =>
    max(
      tone(c, o, t, { f: 420 * p, f2: 640 * p, gate: 0.45, env: E(0.06, 0.4, 0.8, 0.1), vol: 0.09, wave: 'sine', vib: [14, 40] }),
      tone(c, o, t, { f: 840 * p, f2: 1280 * p, gate: 0.45, env: E(0.06, 0.4, 0.8, 0.1), vol: 0.03, wave: 'triangle', vib: [14, 40] }),
      noise(c, o, t, { gate: 0.45, env: E(0.1, 0.3, 0.7, 0.1), vol: 0.08, type: 'bandpass', f: 800 * p, f2: 2400 * p, q: 2 })
    ),

  // UFOが殴り落とされる:ヒュルルル…ドガシャン(ふるえながら下がる音のあと、0.5秒で地面にぶつかる)
  ufoFall: (c, o, t, p) => {
    let end = max(
      tone(c, o, t, { f: 1300 * p, f2: 180 * p, gate: 0.5, env: E(0.005, 0.5, 0.8, 0.05), vol: 0.1, wave: 'triangle', vib: [16, 90] }),
      tone(c, o, t, { f: 650 * p, f2: 90 * p, gate: 0.5, env: E(0.005, 0.5, 0.7, 0.05), vol: 0.025, wave: 'square', vib: [16, 90] })
    );
    const hitAt = t + 0.5;
    end = max(
      end,
      drop(c, o, hitAt, 120 * p, 30 * p, 0.2, 0.8, 0.3),
      noise(c, o, hitAt, { gate: 0.3, env: E(0.001, 0.28, 0, 0.06), vol: 0.35, type: 'lowpass', f: 3000 * p, f2: 250, rate: 0.6 }),
      fm(c, o, hitAt, hz(40) * p, 0.15, GAAN, 0.4, { from: 0, to: -500, time: 0.25 })
    );
    [2794, 3520, 2349].forEach((f, i) => {
      end = max(end, tone(c, o, hitAt + 0.03 + i * 0.05, { f: f * p, gate: 0.04, env: E(0.001, 0.06, 0, 0.03), vol: 0.035, wave: 'triangle' }));
    });
    return end;
  },

  // 宇宙人の本性ちらり:ピピッ(よその星っぽい短い2つ)
  beep: (c, o, t, p) =>
    max(fm(c, o, t, 1319 * p, 0.04, ALIEN, 0.7, { from: 0, to: -60, time: 0.04 }), fm(c, o, t + 0.08, 1319 * p, 0.07, ALIEN, 0.7, { from: 0, to: -120, time: 0.07 })),

  // 動きのくずれ:ジジッ(とても小さい0.2秒のノイズ。仕分けの画面で何度も鳴るので目立たせない)
  glitch: (c, o, t, p) =>
    max(
      noise(c, o, t, { gate: 0.05, env: E(0.002, 0.05, 0.6, 0.01), vol: 0.07, type: 'bandpass', f: 1800 * p, q: 1.2, rate: 0.3 }),
      noise(c, o, t + 0.1, { gate: 0.08, env: E(0.002, 0.07, 0.5, 0.02), vol: 0.06, type: 'bandpass', f: 2600 * p, q: 1.2, rate: 0.3 }),
      tone(c, o, t, { f: 180 * p, gate: 0.18, env: E(0.002, 0.15, 0.5, 0.02), vol: 0.012, wave: 'square', vib: [40, 300] })
    ),

  // 母艦の光線:ブィーーン + ジュワー(床を焼く太い光線。1秒ごとに鳴らし続けてよい)
  shipBeam: (c, o, t, p) =>
    max(
      fm(c, o, t, 330 * p, 0.72, LASER, 0.6, { from: 0, to: -500, time: 0.8 }),
      tone(c, o, t, { f: 660 * p, f2: 520 * p, gate: 0.72, env: E(0.01, 0.6, 0.6, 0.1), vol: 0.025, wave: 'square', vib: [25, 60] }),
      noise(c, o, t, { gate: 0.72, env: E(0.05, 0.6, 0.6, 0.1), vol: 0.1, type: 'highpass', f: 2500, rate: 0.8 }),
      drop(c, o, t, 160 * p, 60 * p, 0.1, 0.35, 0.15)
    )
};
