// 音の入り口。ゲームからはここの audio だけを使う。
// Web Audio でメガドライブ風の音(FM音源とPSG)をその場で作って鳴らす。Phaser の音の仕組みは使わない。
import { Engine } from './engine';

export type BgmName = 'title' | 'sort' | 'street' | 'boss' | 'result';
export type SfxName =
  | 'button' | 'swipeBad' | 'swipeCiv' | 'tick' | 'timeUp' | 'blip'
  | 'charge' | 'punch' | 'stomp' | 'beam' | 'hit' | 'bigHit' | 'break'
  | 'mark' | 'stop' | 'go' | 'oops' | 'okay' | 'sparkle'
  | 'reveal' | 'rampage' | 'rush' | 'bossDown' | 'explosion' | 'fanfare' | 'stamp';
export interface AudioEngine {
  /** 最初のタップの中で呼ぶ。AudioContextを作り、iPhoneでも鳴るようにする。何度呼んでもよい */
  unlock(): void;
  playBgm(name: BgmName): void;   // 同じ曲なら何もしない。違う曲なら切り替える
  stopBgm(fadeMs?: number): void;
  pauseBgm(): void;                // 一時停止:曲を止める(流したい曲は覚えておく)
  resumeBgm(): void;               // 再開:止めた曲をまた流す
  sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  toggleMuted(): boolean;          // 切り替えたあとの値を返す
}
export const audio: AudioEngine = new Engine();
