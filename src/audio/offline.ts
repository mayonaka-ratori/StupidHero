// 確かめる用:OfflineAudioContext で曲や効果音を描き出し、音の大きさを数字で見る。ゲームからは使わない。
import type { BgmName, SfxName } from './index';
import { createMixer } from './mixer';
import { BgmPlayer, compile } from './sequencer';
import { SFX } from './sfx';
import { SONGS } from './songs';

const RATE = 44100;

export interface Level {
  /** 最大の振れ幅(1.0を超えると音割れ) */
  peak: number;
  /** 平均の大きさ(dBFS) */
  rmsDb: number;
  /** -50dB を超えている最後の時刻(秒) */
  lastSound: number;
  /** 0.95 を超えたサンプルの数 */
  hot: number;
}

/** start 秒より前は数えない(コンプレッサーが落ち着くまでの間) */
export function analyze(buf: AudioBuffer, start = 0): Level {
  let peak = 0;
  let sum = 0;
  let last = 0;
  let hot = 0;
  const th = Math.pow(10, -50 / 20);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = Math.floor(start * buf.sampleRate); i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (a > 0.95) hot++;
      if (a > th && i > last) last = i;
      sum += d[i] * d[i];
    }
  }
  const n = buf.length - Math.floor(start * buf.sampleRate);
  const rms = Math.sqrt(sum / (n * buf.numberOfChannels));
  return { peak, rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity, lastSound: Math.max(0, last / buf.sampleRate - start), hot };
}

/** 曲を seconds 秒描き出す。limit=false でコンプレッサーとクリップを通さない */
export async function renderBgm(name: BgmName, seconds: number, limit = true): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS[name]), name, 0.01);
  player.pump(seconds, 0, false, 1e6);
  return ctx.startRendering();
}

/** 効果音を鳴らし始める時刻。コンプレッサーが落ち着いてから鳴らす(analyze にもこの値を渡す) */
export const SFX_START = 0.3;

/** 効果音を1つ描き出す */
export async function renderSfx(name: SfxName, limit = true, seconds = 2): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil((SFX_START + seconds) * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  SFX[name](ctx, mix.sfx, SFX_START, 1);
  return ctx.startRendering();
}

/** BGMの上に効果音をたくさん重ねた、いちばんうるさい場面(ボス戦の連打+爆発など) */
export async function renderWorstCase(limit = true): Promise<AudioBuffer> {
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.boss), 'boss', 0.01);
  player.pump(seconds, 0, false, 1e6);
  for (let t = 0.1; t < 3; t += 0.08) SFX.rush(ctx, mix.sfx, t, 1);
  SFX.bigHit(ctx, mix.sfx, 1.0, 1);
  SFX.beam(ctx, mix.sfx, 1.2, 1);
  SFX.bossDown(ctx, mix.sfx, 2.0, 1);
  SFX.explosion(ctx, mix.sfx, 2.1, 1);
  SFX.stamp(ctx, mix.sfx, 2.2, 1);
  return ctx.startRendering();
}

/** ルックアヘッドが遅れたとき、たまった音をまとめて鳴らさないことを確かめる。遅れて1回呼んだときに予約したマスの数を返す */
export function backlogSteps(): number {
  const ctx = new OfflineAudioContext(1, RATE, RATE);
  const mix = createMixer(ctx);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.boss), 'boss', 0);
  player.pump(0.15, 0, true);
  // 10秒タイマーが止まっていたことにする
  return player.pump(10.15, 10, true);
}

export const BGM_NAMES: BgmName[] = ['title', 'sort', 'street', 'boss', 'result'];
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
