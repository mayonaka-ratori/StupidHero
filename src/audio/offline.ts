// 確かめる用:OfflineAudioContext で曲や効果音を描き出し、音の大きさを数字で見る。ゲームからは使わない。
import type { BgmName, SfxName } from './index';
import { SFX_GAP, SFX_GAP_DEFAULT } from './engine';
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

/** 曲の前奏とくり返し1回ぶんの長さ(秒)。これに少し足して描き出すと、くり返しのつなぎ目とエコーの残りまで測れる */
export function songSeconds(name: BgmName): number {
  const s = compile(SONGS[name]);
  return ((s.intro?.steps ?? 0) + s.loop.steps) * (60 / s.bpm / 4);
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

/**
 * 同じ効果音を、ゲームで鳴らせるいちばん短い間隔(SFX_GAP)で seconds 秒のあいだ鳴らし続ける。
 * 何度も鳴ったときに重なって大きくなりすぎないかを見る
 */
export async function renderSfxRepeat(name: SfxName, limit = true, seconds = 2): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil((SFX_START + seconds + 1) * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const gap = Math.max(SFX_GAP[name] ?? SFX_GAP_DEFAULT, 0.005);
  for (let t = SFX_START; t < SFX_START + seconds; t += gap) SFX[name](ctx, mix.sfx, t, 1);
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

/** ステージ2のボス戦でいちばんうるさい場面:連打 + エンジン + きしみ + クラクション + 車がひっくり返って爆発 */
export async function renderWorstCaseBoss2(limit = true): Promise<AudioBuffer> {
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.boss2), 'boss2', 0.01);
  player.pump(seconds, 0, false, 1e6);
  for (let t = 0.1; t < 3; t += 0.08) SFX.rush(ctx, mix.sfx, t, 1);
  for (let t = 0.1; t < 2; t += 0.25) SFX.engine(ctx, mix.sfx, t, 1);
  SFX.skid(ctx, mix.sfx, 0.5, 1);
  SFX.horn(ctx, mix.sfx, 0.7, 1);
  SFX.crash(ctx, mix.sfx, 1.0, 1);
  SFX.bigHit(ctx, mix.sfx, 1.0, 1);
  SFX.crash(ctx, mix.sfx, 1.6, 1);
  SFX.bossDown(ctx, mix.sfx, 2.0, 1);
  SFX.explosion(ctx, mix.sfx, 2.1, 1);
  SFX.crash(ctx, mix.sfx, 2.1, 1);
  SFX.stamp(ctx, mix.sfx, 2.2, 1);
  return ctx.startRendering();
}

/** ステージ2の結果発表でいちばんうるさい場面:口笛で仲間が集まり、まとめて吹き飛ばす/車が逃げて止められる */
export async function renderWorstCaseStreet2(limit = true): Promise<AudioBuffer> {
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.street2), 'street2', 0.01);
  player.pump(seconds, 0, false, 1e6);
  SFX.whistle(ctx, mix.sfx, 0.2, 1);
  SFX.whistle(ctx, mix.sfx, 0.5, 1.1);
  SFX.mark(ctx, mix.sfx, 0.9, 1);
  SFX.go(ctx, mix.sfx, 1.0, 1);
  SFX.charge(ctx, mix.sfx, 1.1, 1);
  SFX.bigHit(ctx, mix.sfx, 1.5, 1);
  SFX.hit(ctx, mix.sfx, 1.55, 1);
  SFX.hit(ctx, mix.sfx, 1.6, 1);
  SFX.break(ctx, mix.sfx, 1.6, 1);
  SFX.engine(ctx, mix.sfx, 2.0, 1);
  SFX.skid(ctx, mix.sfx, 2.2, 1);
  SFX.horn(ctx, mix.sfx, 2.3, 1);
  SFX.punch(ctx, mix.sfx, 2.6, 1);
  SFX.crash(ctx, mix.sfx, 2.65, 1);
  SFX.bigHit(ctx, mix.sfx, 2.65, 1);
  SFX.break(ctx, mix.sfx, 2.7, 1);
  return ctx.startRendering();
}

/**
 * ステージ3の結果発表でいちばんうるさい場面:ピピッ → UFOが下りて吸い上げる → 行けで殴り落として店の物が壊れる。
 * 吸い上げる光はゲームと同じく0.5秒ごとに鳴らす
 */
export async function renderWorstCaseStreet3(limit = true): Promise<AudioBuffer> {
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.street3), 'street3', 0.01);
  player.pump(seconds, 0, false, 1e6);
  SFX.beep(ctx, mix.sfx, 0.1, 1);
  SFX.ufoDown(ctx, mix.sfx, 0.3, 1);
  for (let t = 1.2; t < 2.6; t += 0.5) SFX.tractor(ctx, mix.sfx, t, 1);
  SFX.mark(ctx, mix.sfx, 1.2, 1);
  SFX.go(ctx, mix.sfx, 2.0, 1);
  SFX.charge(ctx, mix.sfx, 2.1, 1);
  SFX.punch(ctx, mix.sfx, 2.5, 1);
  SFX.ufoFall(ctx, mix.sfx, 2.5, 1);
  SFX.break(ctx, mix.sfx, 3.0, 1);
  SFX.bigHit(ctx, mix.sfx, 3.0, 1);
  return ctx.startRendering();
}

/** タイムセールラッシュでいちばんうるさい場面:走ってくる宇宙人のくずれ(0.3秒ごと)の中で、パンチと待てが続く */
export async function renderWorstCaseSale3(limit = true): Promise<AudioBuffer> {
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.sale3), 'sale3', 0.01);
  player.pump(seconds, 0, false, 1e6);
  SFX.chime(ctx, mix.sfx, 0.05, 1);
  for (let t = 0.2; t < 3.5; t += 0.3) SFX.glitch(ctx, mix.sfx, t, 1);
  for (const t of [0.8, 1.6, 2.4, 3.2]) {
    SFX.mark(ctx, mix.sfx, t - 0.4, 1);
    SFX.punch(ctx, mix.sfx, t, 1);
    SFX.hit(ctx, mix.sfx, t + 0.02, 1);
  }
  SFX.stop(ctx, mix.sfx, 2.0, 1);
  return ctx.startRendering();
}

/** ステージ3のボス戦でいちばんうるさい場面:連打 + 母艦の光線(1秒ごと)+ 母艦が落ちて爆発 */
export async function renderWorstCaseBoss3(limit = true): Promise<AudioBuffer> {
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.boss3), 'boss3', 0.01);
  player.pump(seconds, 0, false, 1e6);
  for (let t = 0.1; t < 3; t += 0.08) SFX.rush(ctx, mix.sfx, t, 1);
  for (let t = 0.1; t < 2; t += 0.6) SFX.shipBeam(ctx, mix.sfx, t, 1);
  SFX.ufoFall(ctx, mix.sfx, 1.5, 1);
  SFX.bigHit(ctx, mix.sfx, 1.5, 1);
  SFX.bossDown(ctx, mix.sfx, 2.0, 1);
  SFX.explosion(ctx, mix.sfx, 2.1, 1);
  SFX.break(ctx, mix.sfx, 2.1, 1);
  SFX.stamp(ctx, mix.sfx, 2.2, 1);
  return ctx.startRendering();
}

/**
 * フリープレイでいちばんうるさい場面(波3の速い曲):決めつけのドン → 空押しの連打(何度も振り向く)→
 * 行けで殴りかかって倒す → 言い直しのポワン。空押しはゲームで鳴らせるいちばん短い間隔で鳴らす
 */
export async function renderWorstCaseFree(limit = true): Promise<AudioBuffer> {
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS.free3), 'free3', 0.01);
  player.pump(seconds, 0, false, 1e6);
  SFX.declareBad(ctx, mix.sfx, 0.1, 1);
  for (let t = 0.6; t < 1.6; t += SFX_GAP.dryPress ?? SFX_GAP_DEFAULT) SFX.dryPress(ctx, mix.sfx, t, 1);
  SFX.mark(ctx, mix.sfx, 1.6, 1);
  SFX.go(ctx, mix.sfx, 1.8, 1);
  SFX.charge(ctx, mix.sfx, 1.9, 1);
  SFX.punch(ctx, mix.sfx, 2.3, 1);
  SFX.hit(ctx, mix.sfx, 2.32, 1);
  SFX.bigHit(ctx, mix.sfx, 2.35, 1);
  SFX.declarePass(ctx, mix.sfx, 2.6, 1);
  SFX.stop(ctx, mix.sfx, 3.0, 1);
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

export const BGM_NAMES: BgmName[] = ['title', 'sort', 'street', 'boss', 'result', 'street2', 'boss2', 'street3', 'boss3', 'sale3', 'free1', 'free2', 'free3'];
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
