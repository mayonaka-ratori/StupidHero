// 曲のデータを音符の予定表にし、ルックアヘッド方式で少し先まで予約して鳴らす。
import { type Ctx } from './synth';
import { DRUMS, INSTRUMENTS } from './patches';
import { type SectionDef, type SongDef, midiOf } from './songs';

interface Ev {
  inst: string;
  /** 音の番号。ドラムなら -1 */
  midi: number;
  /** ドラムの種類 */
  hit?: string;
  /** 何マスのばすか */
  len: number;
  vol: number;
}
interface Section {
  steps: number;
  at: Ev[][];
}
export interface CompiledSong {
  bpm: number;
  intro: Section | null;
  loop: Section;
}

function compileSection(def: SectionDef): Section {
  const steps = def.bars * 16;
  const at: Ev[][] = Array.from({ length: steps }, () => []);
  for (const tr of def.tracks) {
    const toks = tr.notes.trim().split(/\s+/);
    const tok = (i: number) => toks[i % toks.length];
    const vol = tr.vol ?? 1;
    for (let i = 0; i < steps; i++) {
      const tk = tok(i);
      if (tk === '.' || tk === '-') continue;
      if (tr.inst === 'drums') {
        at[i].push({ inst: 'drums', midi: -1, hit: tk, len: 1, vol });
        continue;
      }
      const midi = midiOf(tk);
      if (midi === null) throw new Error(`bad note "${tk}"`);
      let len = 1;
      while (i + len < steps && tok(i + len) === '-') len++;
      at[i].push({ inst: tr.inst, midi, len, vol });
    }
  }
  return { steps, at };
}

const cache = new Map<SongDef, CompiledSong>();
export function compile(song: SongDef): CompiledSong {
  let c = cache.get(song);
  if (!c) {
    c = { bpm: song.bpm, intro: song.intro ? compileSection(song.intro) : null, loop: compileSection(song.loop) };
    cache.set(song, c);
  }
  return c;
}

/** 1曲ぶんの再生係。pump() を何度も呼んで少し先まで予約していく */
export class BgmPlayer {
  readonly out: GainNode;
  private p = 0;
  private next: number;
  private readonly stepDur: number;
  private stopped = false;

  constructor(private readonly ctx: Ctx, dest: AudioNode, private readonly song: CompiledSong, readonly name: string, start: number) {
    this.out = ctx.createGain();
    this.out.connect(dest);
    this.stepDur = 60 / song.bpm / 4;
    this.next = start;
  }

  /**
   * until の時刻より前に始まるマスを予約する。now は今の時刻。
   * タブが裏に回ってタイマーが遅れたときは、遅れたぶんを鳴らさずに飛ばす(音がたまらない)。
   * 予約したマスの数を返す。
   */
  pump(until: number, now: number, silent = false, maxSteps = 32): number {
    if (this.stopped) return 0;
    if (this.next < now - 0.05) {
      const skip = Math.ceil((now + 0.02 - this.next) / this.stepDur);
      this.p += skip;
      this.next += skip * this.stepDur;
    }
    let n = 0;
    while (this.next < until && n < maxSteps) {
      if (!silent) this.playStep(this.p, this.next);
      this.p++;
      this.next += this.stepDur;
      n++;
    }
    return n;
  }

  private playStep(p: number, t: number): void {
    const { intro, loop } = this.song;
    let evs: Ev[];
    if (intro && p < intro.steps) evs = intro.at[p];
    else evs = loop.at[(p - (intro?.steps ?? 0)) % loop.steps];
    for (const e of evs) {
      if (e.hit) {
        for (const ch of e.hit) DRUMS[ch]?.(this.ctx, this.out, t, e.vol);
      } else {
        INSTRUMENTS[e.inst]?.(this.ctx, this.out, t, e.midi, e.len * this.stepDur - 0.012, e.vol);
      }
    }
  }

  /** fade 秒かけて小さくして止める */
  stop(fade: number): void {
    if (this.stopped) return;
    this.stopped = true;
    const g = this.out.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    if (fade > 0) g.linearRampToValueAtTime(0, now + fade);
    else g.setValueAtTime(0, now);
    setTimeout(() => this.out.disconnect(), fade * 1000 + 600);
  }
}
