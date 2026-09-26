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

/** 曲の前奏の長さ(秒)。前奏のない曲は0 */
export function introSeconds(name: BgmName): number {
  const s = compile(SONGS[name]);
  return (s.intro?.steps ?? 0) * (60 / s.bpm / 4);
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

/** 効果音 name を t 秒に鳴らす(p は音程の倍率。省くと1) */
type Play = (name: SfxName, t: number, p?: number) => void;

/** いちばんうるさい場面の組み立て。曲と、その上に重ねる効果音の並び */
interface WorstCase {
  song: BgmName;
  /** 曲を始める時刻(省くと0.01秒) */
  start?: number;
  sfx: (play: Play) => void;
}

/** BGMの上に効果音をたくさん重ねた、いちばんうるさい場面。キーは確かめる表の行の名前 */
const WORST_CASES: Record<string, WorstCase> = {
  // ボス戦の連打+爆発など
  'boss+sfx': {
    song: 'boss',
    sfx: (play) => {
      for (let t = 0.1; t < 3; t += 0.08) play('rush', t);
      play('bigHit', 1.0);
      play('beam', 1.2);
      play('bossDown', 2.0);
      play('explosion', 2.1);
      play('stamp', 2.2);
    }
  },
  // ステージ2のボス戦:連打 + エンジン + きしみ + クラクション + 車がひっくり返って爆発
  'boss2+sfx': {
    song: 'boss2',
    sfx: (play) => {
      for (let t = 0.1; t < 3; t += 0.08) play('rush', t);
      for (let t = 0.1; t < 2; t += 0.25) play('engine', t);
      play('skid', 0.5);
      play('horn', 0.7);
      play('crash', 1.0);
      play('bigHit', 1.0);
      play('crash', 1.6);
      play('bossDown', 2.0);
      play('explosion', 2.1);
      play('crash', 2.1);
      play('stamp', 2.2);
    }
  },
  // ステージ2の結果発表:口笛で仲間が集まり、まとめて吹き飛ばす/車が逃げて止められる
  'street2+sfx': {
    song: 'street2',
    sfx: (play) => {
      play('whistle', 0.2);
      play('whistle', 0.5, 1.1);
      play('mark', 0.9);
      play('go', 1.0);
      play('charge', 1.1);
      play('bigHit', 1.5);
      play('hit', 1.55);
      play('hit', 1.6);
      play('break', 1.6);
      play('engine', 2.0);
      play('skid', 2.2);
      play('horn', 2.3);
      play('punch', 2.6);
      play('crash', 2.65);
      play('bigHit', 2.65);
      play('break', 2.7);
    }
  },
  // ステージ3のボス戦:連打 + 母艦の光線 + 母艦が落ちて爆発
  'boss3+sfx': {
    song: 'boss3',
    sfx: (play) => {
      for (let t = 0.1; t < 3; t += 0.08) play('rush', t);
      for (let t = 0.1; t < 2; t += 0.6) play('shipBeam', t);
      play('ufoFall', 1.5);
      play('bigHit', 1.5);
      play('bossDown', 2.0);
      play('explosion', 2.1);
      play('break', 2.1);
      play('stamp', 2.2);
    }
  },
  // ステージ3の結果発表:ピピッ → UFOが下りて吸い上げる → 行けで殴り落として店の物が壊れる。
  // 吸い上げる光はゲームと同じく0.5秒ごとに鳴らす
  'street3+sfx': {
    song: 'street3',
    sfx: (play) => {
      play('beep', 0.1);
      play('ufoDown', 0.3);
      for (let t = 1.2; t < 2.6; t += 0.5) play('tractor', t);
      play('mark', 1.2);
      play('go', 2.0);
      play('charge', 2.1);
      play('punch', 2.5);
      play('ufoFall', 2.5);
      play('break', 3.0);
      play('bigHit', 3.0);
    }
  },
  // タイムセールラッシュ:走ってくる宇宙人のくずれ(0.3秒ごと)の中で、パンチと待てが続く
  'sale3+sfx': {
    song: 'sale3',
    sfx: (play) => {
      play('chime', 0.05);
      for (let t = 0.2; t < 3.5; t += 0.3) play('glitch', t);
      for (const t of [0.8, 1.6, 2.4, 3.2]) {
        play('mark', t - 0.4);
        play('punch', t);
        play('hit', t + 0.02);
      }
      play('stop', 2.0);
    }
  },
  // ステージ4のボス戦:連打 + 念力 + シャンデリアが落ちて割れる + 親玉が倒れて爆発
  'boss4+sfx': {
    song: 'boss4',
    sfx: (play) => {
      for (let t = 0.1; t < 3; t += 0.08) play('rush', t);
      for (let t = 0.1; t < 1.5; t += 0.4) play('psy', t);
      play('smash', 1.2);
      play('bigHit', 1.5);
      play('smash', 1.8);
      play('bossDown', 2.0);
      play('explosion', 2.1);
      play('stamp', 2.2);
    }
  },
  // ステージ4の結果発表:本性ちらり → 念力で物が浮いて運ばれる → 行けで殴り、
  // 浮いていたピアノが落ちて割れる。ソファに落ちる音と、扉とチンも重ねる
  'street4+sfx': {
    song: 'street4',
    sfx: (play) => {
      play('psy', 0.1);
      play('psy', 0.6);
      play('mark', 1.0);
      play('go', 1.6);
      play('charge', 1.7);
      play('punch', 2.1);
      play('bigHit', 2.1);
      play('smash', 2.4);
      play('break', 2.45);
      play('thud', 2.5);
      play('door', 2.9);
      play('ding', 3.0);
    }
  },
  // エレベーターラッシュ(いちばん速いところ):チンと扉のあと、パンチと待てが続き、定員オーバーのブザー
  'lift4+sfx': {
    song: 'lift4',
    // 前奏のぶんだけ前に始めたことにする(pump が遅れたぶんを飛ばすので、いちばん速いくり返しのところから鳴る)
    start: 0.03 - introSeconds('lift4'),
    sfx: (play) => {
      play('ding', 0.05);
      play('door', 0.2);
      for (const t of [0.8, 1.5, 2.2, 2.9]) {
        play('mark', t - 0.3);
        play('punch', t);
        play('hit', t + 0.02);
      }
      play('stop', 1.9);
      play('buzzer', 3.2);
    }
  },
  // フリープレイ(波3の速い曲):決めつけのドン → 空押しの連打(何度も振り向く)→
  // 行けで殴りかかって倒す → 言い直しのポワン。空押しはゲームで鳴らせるいちばん短い間隔で鳴らす
  'free3+sfx': {
    song: 'free3',
    sfx: (play) => {
      play('declareBad', 0.1);
      for (let t = 0.6; t < 1.6; t += SFX_GAP.dryPress ?? SFX_GAP_DEFAULT) play('dryPress', t);
      play('mark', 1.6);
      play('go', 1.8);
      play('charge', 1.9);
      play('punch', 2.3);
      play('hit', 2.32);
      play('bigHit', 2.35);
      play('declarePass', 2.6);
      play('stop', 3.0);
    }
  }
};

/** いちばんうるさい場面の名前(確かめる表に並べる順) */
export const WORST_CASE_NAMES = Object.keys(WORST_CASES);

/** いちばんうるさい場面を4秒描き出す。limit=false でコンプレッサーとクリップを通さない */
export async function renderWorstCase(name: string, limit = true): Promise<AudioBuffer> {
  const w = WORST_CASES[name];
  const seconds = 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, ctx.destination, limit);
  const player = new BgmPlayer(ctx, mix.bgm, compile(SONGS[w.song]), w.song, w.start ?? 0.01);
  player.pump(seconds, 0, false, 1e6);
  w.sfx((n, t, p = 1) => { SFX[n](ctx, mix.sfx, t, p); });
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

/** 曲の名前(SONGS に書いた順) */
export const BGM_NAMES = Object.keys(SONGS) as BgmName[];
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
