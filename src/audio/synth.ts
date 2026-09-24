// 音を作る部品。AudioContext でも OfflineAudioContext でも動くように BaseAudioContext だけを使う。
// メガドライブの YM2612(FM音源)と SN76489(PSG:矩形波とノイズ)をまねた音を作る。

export type Ctx = BaseAudioContext;

/** MIDIの音の番号を周波数にする(69 = A4 = 440Hz) */
export const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** 音の大きさの形。a=立ち上がり d=減衰(時定数の3倍) s=持続の割合(0〜1) r=離してから消えるまで。単位は秒 */
export interface Env { a: number; d: number; s: number; r: number }

/**
 * AudioParam に ADSR を書きこむ。gate 秒たったら離す。消え終わる時刻を返す。
 * 減衰は setTargetAtTime(指数カーブ)で、離す瞬間の値は計算で出してつなぐ。
 */
function adsr(p: AudioParam, t: number, peak: number, e: Env, gate: number): number {
  const a = Math.max(0.001, e.a);
  const r = Math.max(0.005, e.r);
  const gEnd = t + Math.max(0.002, gate);
  p.setValueAtTime(0, t);
  if (gEnd <= t + a) {
    p.linearRampToValueAtTime(peak * ((gEnd - t) / a), gEnd);
  } else {
    p.linearRampToValueAtTime(peak, t + a);
    const sus = peak * e.s;
    const tc = Math.max(0.001, e.d / 3);
    p.setTargetAtTime(sus, t + a, tc);
    p.setValueAtTime(sus + (peak - sus) * Math.exp(-(gEnd - t - a) / tc), gEnd);
  }
  p.linearRampToValueAtTime(0, gEnd + r);
  return gEnd + r;
}

// ---------------------------------------------------------------- FM

/** オペレーター1つ。ratio=基本の周波数に対する倍率。lvl=キャリアなら音量、モジュレーターなら変調指数 */
export interface Op {
  ratio: number;
  /** 周波数を固定したいとき(Hz) */
  fixed?: number;
  /** セント単位のずれ */
  det?: number;
  lvl: number;
  env: Env;
  wave?: OscillatorType;
}

/** FMの音色。mods=[変調する側, される側] の組、out=音として出すオペレーター */
export interface FmPatch {
  ops: Op[];
  mods: [number, number][];
  out: number[];
  /** ビブラート [速さHz, 深さセント, 始まるまでの秒] */
  vib?: [number, number, number];
}

export interface Bend {
  /** 始まりの音程のずれ(セント) */
  from: number;
  /** 終わりの音程のずれ(セント) */
  to: number;
  /** 何秒かけて変えるか */
  time: number;
}

/** FM音源の音を1つ鳴らす。消え終わる時刻を返す */
export function fm(ctx: Ctx, out: AudioNode, t: number, freq: number, gate: number, patch: FmPatch, vel = 1, bend?: Bend): number {
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  let end = t;
  const isCarrier = patch.ops.map((_, i) => patch.out.includes(i));
  patch.ops.forEach((op, i) => {
    const o = ctx.createOscillator();
    o.type = op.wave ?? 'sine';
    const f = op.fixed ?? freq * op.ratio;
    o.frequency.setValueAtTime(f, t);
    if (op.det) o.detune.setValueAtTime(op.det, t);
    if (bend) {
      const base = op.det ?? 0;
      o.detune.setValueAtTime(base + bend.from, t);
      o.detune.linearRampToValueAtTime(base + bend.to, t + bend.time);
    }
    const g = ctx.createGain();
    // モジュレーターは「周波数を何Hz揺らすか」= 変調指数 × 自分の周波数
    const peak = isCarrier[i] ? op.lvl * vel : op.lvl * f;
    end = Math.max(end, adsr(g.gain, t, peak, op.env, gate));
    o.connect(g);
    oscs.push(o);
    gains.push(g);
  });
  for (const [from, to] of patch.mods) gains[from].connect(oscs[to].frequency);
  for (const i of patch.out) gains[i].connect(out);
  let lfo: OscillatorNode | null = null;
  if (patch.vib) {
    const [rate, depth, delay] = patch.vib;
    lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(0, t + delay);
    lg.gain.linearRampToValueAtTime(depth, t + delay + 0.15);
    lfo.connect(lg);
    for (const i of patch.out) lg.connect(oscs[i].detune);
    lfo.start(t);
    lfo.stop(end + 0.02);
  }
  for (const o of oscs) {
    o.start(t);
    o.stop(end + 0.02);
  }
  const last = oscs[0];
  last.onended = () => {
    for (const g of gains) g.disconnect();
    lfo?.disconnect();
  };
  return end;
}

// ---------------------------------------------------------------- PSG(矩形波)

export interface ToneOpts {
  f: number;
  /** ここまで周波数を動かす(指数カーブ) */
  f2?: number;
  /** f2 までにかける秒。省略時は gate */
  slide?: number;
  gate: number;
  env: Env;
  vol: number;
  wave?: OscillatorType;
  /** ビブラート [速さHz, 深さセント] */
  vib?: [number, number];
}

export function tone(ctx: Ctx, out: AudioNode, t: number, o: ToneOpts): number {
  const osc = ctx.createOscillator();
  osc.type = o.wave ?? 'square';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.slide ?? o.gate));
  const g = ctx.createGain();
  const end = adsr(g.gain, t, o.vol, o.env, o.gate);
  osc.connect(g).connect(out);
  let lfo: OscillatorNode | null = null;
  if (o.vib) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib[0];
    const lg = ctx.createGain();
    lg.gain.value = o.vib[1];
    lfo.connect(lg).connect(osc.detune);
    lfo.start(t);
    lfo.stop(end + 0.02);
  }
  osc.start(t);
  osc.stop(end + 0.02);
  osc.onended = () => {
    g.disconnect();
    lfo?.disconnect();
  };
  return end;
}

// ---------------------------------------------------------------- ノイズ

const noiseCache = new WeakMap<Ctx, AudioBuffer>();

/** 1秒ぶんの白いノイズ。毎回同じ中身(確かめるときに結果がぶれないように) */
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 0x2545f491;
    for (let i = 0; i < len; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      d[i] = ((s >>> 0) / 4294967296) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

let noiseOffset = 0;

export interface NoiseOpts {
  gate: number;
  env: Env;
  vol: number;
  type?: BiquadFilterType;
  f?: number;
  /** フィルターの周波数をここまで動かす */
  f2?: number;
  q?: number;
  /** 再生速度。1より小さいとザラザラした低いノイズになる(PSGのノイズっぽく) */
  rate?: number;
}

export function noise(ctx: Ctx, out: AudioNode, t: number, o: NoiseOpts): number {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.playbackRate.value = o.rate ?? 1;
  const g = ctx.createGain();
  const end = adsr(g.gain, t, o.vol, o.env, o.gate);
  let node: AudioNode = src;
  let filt: BiquadFilterNode | null = null;
  if (o.type) {
    filt = ctx.createBiquadFilter();
    filt.type = o.type;
    filt.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.f2 !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.gate);
    filt.Q.value = o.q ?? 0.7;
    node.connect(filt);
    node = filt;
  }
  node.connect(g).connect(out);
  noiseOffset = (noiseOffset + 0.137) % 0.9;
  src.start(t, noiseOffset);
  src.stop(end + 0.02);
  src.onended = () => {
    g.disconnect();
    filt?.disconnect();
  };
  return end;
}

/** 音程が下がっていくサイン波(キックやパンチの芯) */
export function drop(ctx: Ctx, out: AudioNode, t: number, f1: number, f2: number, time: number, vol: number, decay: number, wave: OscillatorType = 'sine'): number {
  return tone(ctx, out, t, { f: f1, f2, slide: time, gate: decay, env: { a: 0.002, d: decay, s: 0, r: 0.02 }, vol, wave });
}
