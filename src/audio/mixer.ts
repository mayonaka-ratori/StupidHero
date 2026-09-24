// 音の出口。BGMと効果音を1つにまとめ、コンプレッサーとリミッター(ソフトクリップ)を通して出す。
//
//  bgm ─┐
//       ├─ master(消音) ─ lowpass ─ compressor ─ post ─ clip ─ destination
//  sfx ─┘
import type { Ctx } from './synth';

/** 全体の音量。控えめにしてある */
const BGM_VOL = 0.4;
const SFX_VOL = 0.8;
/** コンプレッサーが自動で足す音量(メイクアップゲイン、約+6dB)をおおよそ打ち消す */
const POST_GAIN = 0.6;

export interface Mixer {
  bgm: GainNode;
  sfx: GainNode;
  master: GainNode;
}

/** |x| が 1 を超えても 0.98 を超えない、ゆるいクリップの形(0.6 までは素通し) */
function clipCurve(): Float32Array<ArrayBuffer> {
  const n = 2049;
  const c = new Float32Array(n);
  const knee = 0.6;
  const ceil = 0.98;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/** limit=false にすると、コンプレッサーとクリップを通さない(確かめる用。音量はほぼ同じになる) */
export function createMixer(ctx: Ctx, dest: AudioNode = ctx.destination, limit = true): Mixer {
  const bgm = ctx.createGain();
  bgm.gain.value = BGM_VOL;
  const sfx = ctx.createGain();
  sfx.gain.value = SFX_VOL;
  const master = ctx.createGain();
  bgm.connect(master);
  sfx.connect(master);
  // メガドライブの出力のように高いところを少し丸める(スマホのスピーカーで耳に痛くならないように)
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9000;
  lp.Q.value = 0.5;
  master.connect(lp);
  const post = ctx.createGain();
  post.gain.value = POST_GAIN;
  if (!limit) {
    lp.connect(post).connect(dest);
    return { bgm, sfx, master };
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 8;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const clip = ctx.createWaveShaper();
  clip.curve = clipCurve();
  lp.connect(comp).connect(post).connect(clip).connect(dest);
  return { bgm, sfx, master };
}
