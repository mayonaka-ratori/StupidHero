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
//   段階を進める仕組みと順番待ちは timedCall.ts(ステージ4の念力と共通)。長さは UfoCallOptions で変えられる
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
import { CallQueue, TimedCall } from './timedCall';

/**
 * UFOの今の段階。
 * signal:宇宙人が空へ合図を送っている / descend:UFOが下りてくる / beam:買い物客を吸い上げている(行けで落とせる)/
 * leave:乗せて去る途中 / downed:殴り落とした / abducted:連れ去られた(去りきった)
 */
export type UfoPhase = 'signal' | 'descend' | 'beam' | 'leave' | 'downed' | 'abducted';

/** 時間を変えるとき(フリープレイのゆっくりモード)。省いた段階は UFO の秒数 */
export interface UfoCallOptions {
  signalSec?: number;
  descendSec?: number;
  beamSec?: number;
  leaveSec?: number;
}

/** UFO1機ぶん(合図を送った宇宙人1人ぶん) */
export class UfoCall extends TimedCall<UfoPhase> {
  constructor(alienId: string, opts: UfoCallOptions = {}) {
    super(alienId, {
      steps: [
        { phase: 'signal', sec: opts.signalSec ?? UFO.signalSec },
        { phase: 'descend', sec: opts.descendSec ?? UFO.descendSec },
        { phase: 'beam', sec: opts.beamSec ?? UFO.beamSec },
        { phase: 'leave', sec: opts.leaveSec ?? UFO.leaveSec }
      ],
      goPhase: 'beam',
      goEnd: 'downed',
      timeoutEnd: 'abducted'
    });
  }

  /** 合図を送った宇宙人の id */
  get alienId(): string {
    return this.id;
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
  private readonly q: CallQueue<UfoPhase, UfoCall>;

  constructor(opts: UfoCallOptions = {}) {
    this.q = new CallQueue((id) => new UfoCall(id, opts));
  }

  /** 見逃した宇宙人を並べる(ヒーローが素通りしたとき)。同じ人は1回だけ */
  add(alienId: string): void {
    this.q.add(alienId);
  }

  /** 今来ているUFO(なければ null)。markOn、phase、progress を画面に使う */
  get current(): UfoCall | null {
    return this.q.current;
  }

  /** まだ合図を送っていない宇宙人の id(並んだ順) */
  get queued(): readonly string[] {
    return this.q.queued;
  }

  /** 来ているUFOも、待っている宇宙人もいないか(波の結果発表を終えてよいか) */
  get idle(): boolean {
    return this.q.idle;
  }

  /** 行けが押された。吸い上げている間なら殴り落として、その宇宙人の id を返す。それ以外は null */
  go(): string | null {
    return this.q.go()?.alienId ?? null;
  }

  /** 時計を進める。この間に起きた出来事を順に返す */
  update(deltaMs: number): UfoEvent[] {
    return this.q.update(deltaMs).map((e) => ({ alienId: e.id, phase: e.phase }));
  }
}
