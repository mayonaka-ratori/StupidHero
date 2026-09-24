// ステージ3のUFOの決まり(STAGE3「UFOで連れ去る」「行けで殴り落とす」「連れ去られる」)。
// 時計は外から進める(update に経った時間を渡す)ので、テストしやすい。
//
// 流れ:
//   見逃した宇宙人(passBad)がヒーローに素通りされる → 空へ合図(UFO.signalSec。bad のシートの 'mischief' の動き)
//   → UFOが下りてくる(UFO.descendSec)。ヒーローの少し先に、通りがかりの買い物客を1人歩かせる
//     (仕分けに出てこない人。仕分けた人から選ぶと、その人が市民だと分かってしまうため)
//   → 買い物客を光で吸い上げる(UFO.beamSec)。UFOの上に行けのマーク。行けでヒーローが跳んで殴り落とす
//   → 行けを押さなかったら、買い物客と宇宙人を乗せて去る(UFO.leaveSec)
//   UFOは1機ずつ来る。前のUFOが終わるまで、次の宇宙人は合図を送らずに待つ(UfoQueue)
//
// 使い方(1機ずつ来るように UfoQueue を使う):
//   const ufos = new UfoQueue();
//   if (encounter === 'passBad' && stage.def.mechanic === 'ufo') ufos.add(person.id);   // 素通りしたあと
//   // 毎フレーム
//   for (const e of ufos.update(deltaMs)) {
//     if (e.phase === 'signal') { /* e.alienId が空へ合図を送る。say('ufoSignal', rng, 'mall') */ }
//     if (e.phase === 'descend') { /* UFOが下りてくる。買い物客を歩かせる。say('ufoArrive', ...) */ }
//     if (e.phase === 'beam') { /* 吸い上げる(fx_ufobeam)。UFOの上に行けのマーク。初めてなら say('teachUfo')、ほかは say('ufoBeam') */ }
//     if (e.phase === 'leave') { /* 行けを押さなかった。買い物客と宇宙人を乗せて去る */ }
//     if (e.phase === 'abducted') { stats.ufoEscaped(); stats.reportScene('abducted'); say('ufoAbducted') }
//   }
//   // 行けが押されたら(マークが出ているのは ufos.current?.markOn のときだけ)
//   const id = ufos.go();
//   if (id) { stats.ufoDowned(); /* 真下の物を1つ壊す:stats.breakProp(kind) と sceneForProp(kind) */ say('ufoGo'); say('ufoDowned') }
//
// 決まり:
// - 行けで落とすと、宇宙人も一緒に倒れる(撃破。行けで倒したにも数える)。被害額にUFOの¥300万を足す
// - 落ちたUFOは市民を巻きこまない。真下に物があれば1つ壊す(画面が決める)
// - 待てと行けは押しても回数は減らないが、ここだけは行けを押すと被害額が増える(迷わせるための例外)

import { UFO } from './rules';

/**
 * UFOの今の段階。
 * signal:宇宙人が空へ合図を送っている / descend:UFOが下りてくる / beam:買い物客を吸い上げている(行けで落とせる)/
 * leave:乗せて去る途中 / downed:殴り落とした / abducted:連れ去られた(去りきった)
 */
export type UfoPhase = 'signal' | 'descend' | 'beam' | 'leave' | 'downed' | 'abducted';

/** 時間を変えるとき(フリープレイのゆっくりモード)。省くと UFO の秒数 */
export interface UfoCallOptions {
  beamSec?: number;
}

type TimedPhase = 'signal' | 'descend' | 'beam' | 'leave';

/** UFO1機ぶん(合図を送った宇宙人1人ぶん) */
export class UfoCall {
  readonly alienId: string;
  private readonly sec: Record<TimedPhase, number>;
  private p: UfoPhase = 'signal';
  /** 今の段階に入ってからの秒数 */
  private t = 0;

  constructor(alienId: string, opts: UfoCallOptions = {}) {
    this.alienId = alienId;
    this.sec = { signal: UFO.signalSec, descend: UFO.descendSec, beam: opts.beamSec ?? UFO.beamSec, leave: UFO.leaveSec };
  }

  get phase(): UfoPhase {
    return this.p;
  }

  /** 終わったか(殴り落とした、連れ去られた) */
  get isOver(): boolean {
    return this.p === 'downed' || this.p === 'abducted';
  }

  /** UFOの上に行けのマークを出すか(吸い上げている間だけ) */
  get markOn(): boolean {
    return this.p === 'beam';
  }

  /** 今の段階の進み具合(0〜1)。descend は下りる高さ、beam は買い物客の浮く高さ、leave は去る高さに使える */
  get progress(): number {
    if (this.isOver) return 1;
    return Math.min(1, this.t / this.sec[this.p as TimedPhase]);
  }

  /** 行けが押された。吸い上げている間なら殴り落として true。それ以外は何も起きない(false) */
  go(): boolean {
    if (this.p !== 'beam') return false;
    this.enter('downed');
    return true;
  }

  /** 時計を進める。この間に入った段階を順に返す('descend'、'beam'、'leave'、'abducted') */
  update(deltaMs: number): UfoPhase[] {
    return this.run(deltaMs).entered;
  }

  /** 時計を進め、入った段階と、終わったあとに余った時間(ミリ秒)を返す(UfoQueue が次のUFOに回す) */
  run(deltaMs: number): { entered: UfoPhase[]; leftMs: number } {
    const entered: UfoPhase[] = [];
    let left = Math.max(0, deltaMs) / 1000;
    const next: Record<TimedPhase, UfoPhase> = { signal: 'descend', descend: 'beam', beam: 'leave', leave: 'abducted' };
    while (!this.isOver && left > 0) {
      const phase = this.p as TimedPhase;
      const need = this.sec[phase] - this.t;
      // 小数の足し算のずれ(0.799 + 0.001 など)で段階が進まないことがないよう、ごくわずかな差は着いたことにする
      if (left < need - 1e-9) {
        this.t += left;
        left = 0;
        break;
      }
      left = Math.max(0, left - need);
      this.enter(next[phase]);
      entered.push(this.p);
    }
    return { entered, leftMs: this.isOver ? left * 1000 : 0 };
  }

  private enter(p: UfoPhase): void {
    this.p = p;
    this.t = 0;
  }
}

/** UfoQueue.update が返す出来事(その宇宙人のUFOが、その段階に入った) */
export interface UfoEvent {
  alienId: string;
  phase: UfoPhase;
}

/**
 * UFOを1機ずつ呼ぶための順番待ち。見逃した宇宙人を add で並べると、前のUFOが終わってから次の宇宙人が合図を送る。
 * 宇宙人が合図を送り始めた瞬間も、update の出来事に { phase: 'signal' } として入る
 */
export class UfoQueue {
  private waiting: string[] = [];
  private cur: UfoCall | null = null;

  constructor(private readonly opts: UfoCallOptions = {}) {}

  /** 見逃した宇宙人を並べる(ヒーローが素通りしたとき)。同じ人は1回だけ */
  add(alienId: string): void {
    if (this.cur?.alienId === alienId || this.waiting.includes(alienId)) return;
    this.waiting.push(alienId);
  }

  /** 今来ているUFO(なければ null)。markOn、phase、progress を画面に使う */
  get current(): UfoCall | null {
    return this.cur;
  }

  /** まだ合図を送っていない宇宙人の id(並んだ順) */
  get queued(): readonly string[] {
    return this.waiting;
  }

  /** 来ているUFOも、待っている宇宙人もいないか(波の結果発表を終えてよいか) */
  get idle(): boolean {
    return this.cur === null && this.waiting.length === 0;
  }

  /** 行けが押された。吸い上げている間なら殴り落として、その宇宙人の id を返す。それ以外は null */
  go(): string | null {
    const c = this.cur;
    if (!c || !c.go()) return null;
    this.cur = null;
    return c.alienId;
  }

  /** 時計を進める。この間に起きた出来事を順に返す */
  update(deltaMs: number): UfoEvent[] {
    const events: UfoEvent[] = [];
    let left = Math.max(0, deltaMs);
    for (;;) {
      if (!this.cur) {
        const next = this.waiting.shift();
        if (next === undefined) break;
        this.cur = new UfoCall(next, this.opts);
        events.push({ alienId: next, phase: 'signal' });
      }
      const c = this.cur;
      const r = c.run(left);
      for (const phase of r.entered) events.push({ alienId: c.alienId, phase });
      if (!c.isOver) break;
      // 連れ去られた(去りきった)。余った時間で次の宇宙人が合図を送る
      this.cur = null;
      left = r.leftMs;
      if (left <= 0) break;
    }
    return events;
  }
}
