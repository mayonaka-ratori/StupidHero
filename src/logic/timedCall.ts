// 決まった長さの段階を順に進む出来事と、それを1つずつ順に呼ぶための順番待ち。
// ステージ3のUFO(ufo.ts の UfoCall と UfoQueue)と、ステージ4の念力(psychic.ts の PsyCall と PsyQueue)で共通に使う。
// 時計は外から進める(update に経った時間を渡す)ので、テストしやすい。
//
// 決まり:
// - 段階は steps の順に進む。最後の段階の時間が終わると timeoutEnd に入って終わる
// - goPhase の間だけ go() が効き、goEnd に入って終わる(行けのマークを出すのもこの間だけ)
// - 段階の長さは作るときに渡す(ゆっくりモードで変えられるように、数字の表に決め打ちしない)

/** 1つの段階と、その長さ(秒) */
export interface TimedStep<P extends string> {
  phase: P;
  sec: number;
}

/** 段階の並び方 */
export interface TimedCallSpec<P extends string> {
  /** 時間で進む段階(この順に進む) */
  steps: readonly TimedStep<P>[];
  /** 行けが効く段階(steps のどれか) */
  goPhase: P;
  /** 行けが効いたときに入る段階(ここで終わり) */
  goEnd: P;
  /** 最後の段階の時間が終わったときに入る段階(ここで終わり) */
  timeoutEnd: P;
}

/** 1つぶんの出来事(UFO1機、念力1回) */
export class TimedCall<P extends string> {
  readonly id: string;
  private readonly spec: TimedCallSpec<P>;
  private p: P;
  /** 今の段階に入ってからの秒数 */
  private t = 0;
  private goAt: number | null = null;

  constructor(id: string, spec: TimedCallSpec<P>) {
    if (spec.steps.length === 0) throw new Error('TimedCall needs at least one step');
    this.id = id;
    this.spec = spec;
    this.p = spec.steps[0].phase;
  }

  get phase(): P {
    return this.p;
  }

  /** 終わったか(行けが効いた、または最後の段階の時間が終わった) */
  get isOver(): boolean {
    return this.p === this.spec.goEnd || this.p === this.spec.timeoutEnd;
  }

  /** 行けのマークを出すか(goPhase の間だけ) */
  get markOn(): boolean {
    return this.p === this.spec.goPhase;
  }

  /** 今の段階の進み具合(0〜1)。終わっていれば1 */
  get progress(): number {
    if (this.isOver) return 1;
    const sec = this.secOf(this.p);
    return sec <= 0 ? 1 : Math.min(1, this.t / sec);
  }

  /** 行けが効いたときの、goPhase の進み具合(0〜1)。まだ効いていなければ null */
  get goProgress(): number | null {
    return this.goAt;
  }

  /** 行けが押された。goPhase の間なら goEnd に入って true。それ以外は何も起きない(false) */
  go(): boolean {
    if (this.p !== this.spec.goPhase) return false;
    this.goAt = this.progress;
    this.enter(this.spec.goEnd);
    return true;
  }

  /** 時計を進める。この間に入った段階を順に返す */
  update(deltaMs: number): P[] {
    return this.run(deltaMs).entered;
  }

  /** 時計を進め、入った段階と、終わったあとに余った時間(ミリ秒)を返す(順番待ちが次に回す) */
  run(deltaMs: number): { entered: P[]; leftMs: number } {
    const entered: P[] = [];
    let left = Math.max(0, deltaMs) / 1000;
    while (!this.isOver && left > 0) {
      const need = this.secOf(this.p) - this.t;
      // 小数の足し算のずれ(0.799 + 0.001 など)で段階が進まないことがないよう、ごくわずかな差は着いたことにする
      if (left < need - 1e-9) {
        this.t += left;
        left = 0;
        break;
      }
      left = Math.max(0, left - need);
      this.enter(this.nextOf(this.p));
      entered.push(this.p);
    }
    return { entered, leftMs: this.isOver ? left * 1000 : 0 };
  }

  private secOf(p: P): number {
    return this.spec.steps.find((s) => s.phase === p)?.sec ?? 0;
  }

  private nextOf(p: P): P {
    const i = this.spec.steps.findIndex((s) => s.phase === p);
    return this.spec.steps[i + 1]?.phase ?? this.spec.timeoutEnd;
  }

  private enter(p: P): void {
    this.p = p;
    this.t = 0;
  }
}

/** CallQueue.update が返す出来事(その id の出来事が、その段階に入った) */
export interface CallEvent<P extends string> {
  id: string;
  phase: P;
}

/**
 * 出来事を1つずつ順に呼ぶための順番待ち。add で並べると、前の出来事が終わってから次が始まる。
 * 始まった瞬間も、update の出来事に最初の段階として入る
 */
export class CallQueue<P extends string, C extends TimedCall<P>> {
  private waiting: string[] = [];
  private cur: C | null = null;

  /** @param make id から出来事1つを作る */
  constructor(private readonly make: (id: string) => C) {}

  /** 並べる。同じ id は1回だけ */
  add(id: string): void {
    if (this.cur?.id === id || this.waiting.includes(id)) return;
    this.waiting.push(id);
  }

  /** 今の出来事(なければ null) */
  get current(): C | null {
    return this.cur;
  }

  /** まだ始まっていない id(並んだ順) */
  get queued(): readonly string[] {
    return this.waiting;
  }

  /** 今の出来事も、待っている id もないか */
  get idle(): boolean {
    return this.cur === null && this.waiting.length === 0;
  }

  /** 行けが押された。効いたら、その出来事を返して次の番にする。効かなければ null */
  go(): C | null {
    const c = this.cur;
    if (!c || !c.go()) return null;
    this.cur = null;
    return c;
  }

  /** 時計を進める。この間に起きた出来事を順に返す */
  update(deltaMs: number): CallEvent<P>[] {
    const events: CallEvent<P>[] = [];
    let left = Math.max(0, deltaMs);
    for (;;) {
      if (!this.cur) {
        const next = this.waiting.shift();
        if (next === undefined) break;
        this.cur = this.make(next);
        events.push({ id: next, phase: this.cur.phase });
      }
      const c = this.cur;
      const r = c.run(left);
      for (const phase of r.entered) events.push({ id: c.id, phase });
      if (!c.isOver) break;
      // 時間で終わった。余った時間で次を始める
      this.cur = null;
      left = r.leftMs;
      if (left <= 0) break;
    }
    return events;
  }
}
