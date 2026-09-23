// AudioEngine の中身。AudioContext はここで1つだけ作る。
import type { AudioEngine, BgmName, SfxName } from './index';
import { type Mixer, createMixer } from './mixer';
import { BgmPlayer, compile } from './sequencer';
import { SFX } from './sfx';
import { SONGS } from './songs';

const STORE_KEY = 'stupidHero.muted';
/** 何秒先まで予約するか */
const LOOKAHEAD = 0.15;
/** 予約の見回りの間隔(ミリ秒) */
const TICK_MS = 25;
/** 同じ効果音を続けて鳴らせる最短の間隔(秒) */
const SFX_GAP: Partial<Record<SfxName, number>> = { rush: 0.04, blip: 0.03, tick: 0.05 };
const SFX_GAP_DEFAULT = 0.03;
/** 同時に鳴らす効果音の上限 */
const SFX_MAX_VOICES = 12;

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeMuted(m: boolean): void {
  try {
    localStorage.setItem(STORE_KEY, m ? '1' : '0');
  } catch {
    /* 保存できなくても遊べる */
  }
}

type AudioContextCtor = typeof AudioContext;

export class Engine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private mix: Mixer | null = null;
  private broken = false;
  private muted = readMuted();
  /** 流したい曲(unlock前、画面が隠れている間も覚えておく) */
  private want: BgmName | null = null;
  private player: BgmPlayer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  /** 一時停止中(pauseBgm から resumeBgm まで)は曲を流さない */
  private paused = false;
  private armed = false;
  private lastSfx = new Map<SfxName, number>();
  private voiceEnds: number[] = [];

  constructor() {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
  }

  unlock(): void {
    if (this.broken) return;
    try {
      if (!this.ctx) {
        const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) {
          this.broken = true;
          return;
        }
        let ctx: AudioContext;
        try {
          ctx = new Ctor({ latencyHint: 'interactive' });
        } catch {
          ctx = new Ctor();
        }
        this.ctx = ctx;
        this.mix = createMixer(ctx);
        this.mix.master.gain.value = this.muted ? 0 : 1;
        ctx.onstatechange = () => {
          // iPhoneで電話などに割りこまれたとき('interrupted')は、次のタップで戻す
          if (ctx.state !== 'running' && !this.hidden) this.arm();
        };
      }
      const ctx = this.ctx;
      if (ctx.state !== 'running') {
        ctx.resume().then(
          () => {
            if (ctx.state === 'running') this.disarm();
          },
          () => {}
        );
        // 今のタップで鳴らせなかったとき(古いiPhoneは touchend でないと鳴らない等)は、次のタップでもう一度試す
        if (!this.hidden) this.arm();
      }
      // 無音の短いバッファを鳴らす(古いiPhoneはこれで鳴るようになる)
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      if (!this.hidden) this.startWanted();
    } catch {
      this.broken = true;
    }
  }

  playBgm(name: BgmName): void {
    this.want = name;
    if (!this.ctx || this.hidden) return;
    if (this.player?.name === name) return;
    if (this.player) {
      this.player.stop(0.12);
      this.player = null;
    }
    this.startWanted();
  }

  stopBgm(fadeMs = 400): void {
    this.want = null;
    this.killPlayer(fadeMs / 1000);
  }

  pauseBgm(): void {
    this.paused = true;
    this.killPlayer(0.05);
  }

  resumeBgm(): void {
    if (!this.paused) return;
    this.paused = false;
    this.startWanted();
  }

  sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void {
    const ctx = this.ctx;
    const mix = this.mix;
    if (!ctx || !mix || this.muted || this.hidden || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = ctx.currentTime;
    const last = this.lastSfx.get(name);
    if (last !== undefined && now - last < (SFX_GAP[name] ?? SFX_GAP_DEFAULT) && now >= last) return;
    this.voiceEnds = this.voiceEnds.filter((e) => e > now);
    if (this.voiceEnds.length >= SFX_MAX_VOICES) return;
    this.lastSfx.set(name, now);
    try {
      const vol = Math.max(0, Math.min(2, opts?.volume ?? 1));
      const g = ctx.createGain();
      g.gain.value = vol;
      g.connect(mix.sfx);
      const end = fn(ctx, g, now + 0.005, Math.max(0.25, Math.min(4, opts?.pitch ?? 1)));
      this.voiceEnds.push(end);
      setTimeout(() => g.disconnect(), (end - now) * 1000 + 300);
    } catch {
      /* 鳴らなくても遊べる */
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeMuted(muted);
    if (this.ctx && this.mix) {
      const g = this.mix.master.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(muted ? 0 : 1, now + 0.05);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 開発用:中の様子 */
  debug(): { state: string; want: BgmName | null; playing: string | null; muted: boolean; hidden: boolean; armed: boolean } {
    return { state: this.ctx?.state ?? 'none', want: this.want, playing: this.player?.name ?? null, muted: this.muted, hidden: this.hidden, armed: this.armed };
  }

  // ------------------------------------------------------------ 中の仕組み

  private startWanted(): void {
    const ctx = this.ctx;
    if (!ctx || !this.mix || !this.want || this.player || this.hidden || this.paused) return;
    this.player = new BgmPlayer(ctx, this.mix.bgm, compile(SONGS[this.want]), this.want, ctx.currentTime + 0.06);
    this.pump();
    if (this.timer === null) this.timer = setInterval(this.pump, TICK_MS);
  }

  private pump = (): void => {
    const ctx = this.ctx;
    if (!ctx || !this.player) {
      this.clearTimer();
      return;
    }
    if (ctx.state !== 'running') return;
    try {
      this.player.pump(ctx.currentTime + LOOKAHEAD, ctx.currentTime, this.muted);
    } catch {
      this.killPlayer(0);
    }
  };

  private killPlayer(fade: number): void {
    this.player?.stop(fade);
    this.player = null;
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private onVisibility = (): void => {
    this.hidden = document.visibilityState === 'hidden';
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.hidden) {
      // 曲は覚えたまま止める
      this.killPlayer(0);
      ctx.suspend().catch(() => {});
    } else {
      this.arm();
    }
  };

  /** 次のタップで音を戻すように待つ */
  private arm(): void {
    if (this.armed) return;
    this.armed = true;
    for (const t of GESTURES) document.addEventListener(t, this.onGesture, { capture: true, passive: true });
  }

  private disarm(): void {
    this.armed = false;
    for (const t of GESTURES) document.removeEventListener(t, this.onGesture, { capture: true });
  }

  private onGesture = (): void => {
    const ctx = this.ctx;
    if (!ctx || this.hidden) return;
    this.unlock();
    if (ctx.state === 'running') {
      this.disarm();
      return;
    }
    ctx.resume().then(
      () => {
        if (ctx.state === 'running') this.disarm();
      },
      () => {}
    );
  };
}

/** 音を戻すきっかけにするタップ。pointerdown が基本で、古いiPhoneのために touchend と click も待つ */
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
