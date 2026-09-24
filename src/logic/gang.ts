// ステージ2のギャングの組の決まり(STAGE2「仲間を呼ぶ」「まとめて吹き飛ばす」「車で逃げる」)。
// 時計は外から進める(update に経った時間を渡す)ので、テストしやすい。
//
// 流れ:
//   見逃したギャング(passBad)がヒーローに素通りされる → 口笛(GANG.whistleSec)
//   → 同じ組のまだ倒されていない仲間が走ってきて1か所に集まる(最長 GANG.gatherSec)
//   → 組の頭の上に行けのマーク(fx_mark_go)が1つ。行けで、まとめて吹き飛ばす
//   → 3秒(GANG.escapeSec)たつとワゴンに乗りこむ(GANG.boardSec)→ 走り出す(GANG.driveSec)
//     乗りこむところと走っている間の行けは、車ごと止める
//   → 画面の右に消えたら、逃げきられた
//
// 使い方:
//   if (encounter === 'passBad' && person.group) {
//     const group = wave.groups.find((g) => g.id === person.group)!;
//     const comers = gatherMembers(group.memberIds, (id) => defeated.has(id) || stoppedIds.has(id));
//     if (comers.length < 2) {
//       // 仲間が誰も来ない(ほかの仲間はもう倒した、または待てで止めた)。組にならないので、
//       // ステージ1の見逃したワルと同じ流れ:say('alone', rng, 'garage') と say('aloneHero', rng, 'garage')、
//       // 行けで追い打ちなら stats.defeatBad('go')、押さずに逃げたら stats.escaped()
//     } else {
//       const call = new GangCall(comers);    // 口笛を吹いた人を含む、集まる人の id
//     }
//   }
//   // 仲間が着いたら call.gathered()(呼ばなくても GANG.gatherSec で集まったことになる。
//   //  gathered() で集まったときは update から 'wait' は来ないので、その場でマークを出す)
//   // 毎フレーム
//   for (const e of call.update(deltaMs)) {
//     if (e === 'wait') { /* マークを組の頭の上に出す。say('gathered', rng, 'garage') */ }
//     if (e === 'board') { /* ワゴンに乗りこむ。say('board', ...) */ }
//     if (e === 'drive') { /* ワゴンが走り出す(prop_van の 1〜2 コマ)。say('drive', ...) */ }
//     if (e === 'escaped') stats.groupEscaped(call.size);
//   }
//   // 行けが押されたら
//   const r = call.go();
//   if (r === 'wipe') stats.groupWiped(call.size);        // rollGroupWipeProps で物も壊す
//   if (r === 'vanStop') stats.vanStopped(call.size);     // ワゴンが壊れる(¥500万)
//
// 決まり:
// - 仲間は、通りのどこにいても走ってくる。まだ殴りに行っていない仲間(ワルに仕分けてある人も)も来る。
//   ワルに仕分けていてもう倒した仲間と、待てで止めた仲間(もう「逃がした」に数えてある)は来ない
// - 同じ組が2回集まることはない。組の2人目を見逃したときには、その人はもう集まりに行っている
// - 巻きぞえは組の中だけ(まわりの市民は巻きこまない)。組が市民を襲うこともない

import { GANG } from './rules';

/** 組の中で、集まりに来る人(口笛を吹いた人を含む)。gone は「もう倒した、または待てで止めた」 */
export function gatherMembers(memberIds: readonly string[], gone: (id: string) => boolean): string[] {
  return memberIds.filter((id) => !gone(id));
}

/**
 * 組の今の段階。
 * gather:集まっている途中 / wait:集まった(行けでまとめて吹き飛ばせる)/ board:ワゴンに乗りこむ /
 * drive:ワゴンが走っている / wiped:まとめて吹き飛ばした / stopped:ワゴンを止めた / escaped:逃げきられた
 */
export type GangPhase = 'gather' | 'wait' | 'board' | 'drive' | 'wiped' | 'stopped' | 'escaped';

export class GangCall {
  readonly members: readonly string[];
  private readonly sec: Record<'gather' | 'wait' | 'board' | 'drive', number>;
  private p: GangPhase = 'gather';
  /** 今の段階に入ってからの秒数 */
  private t = 0;

  constructor(memberIds: readonly string[]) {
    this.members = [...memberIds];
    this.sec = { gather: GANG.gatherSec, wait: GANG.escapeSec, board: GANG.boardSec, drive: GANG.driveSec };
  }

  /** 組の人数(まとめて吹き飛ばした人数、逃げた人数に使う) */
  get size(): number {
    return this.members.length;
  }

  /** 1人だけ(仲間が誰も来ない)か。そのときは組ではなく、ステージ1の見逃したワルと同じ流れにする */
  get alone(): boolean {
    return this.members.length < GANG.groupSize.min;
  }

  get phase(): GangPhase {
    return this.p;
  }

  /** 終わったか(吹き飛ばした、止めた、逃げきられた) */
  get isOver(): boolean {
    return this.p === 'wiped' || this.p === 'stopped' || this.p === 'escaped';
  }

  /** 行けのマークをどこに出すか。'group' は集まった組の頭の上、'van' はワゴン、null は出さない */
  get markOn(): 'group' | 'van' | null {
    if (this.p === 'wait') return 'group';
    if (this.p === 'board' || this.p === 'drive') return 'van';
    return null;
  }

  /** 今の段階の進み具合(0〜1)。drive ではワゴンが画面の右に消えるまでの進み具合に使える */
  get progress(): number {
    if (this.isOver) return 1;
    return Math.min(1, this.t / this.sec[this.p as 'gather' | 'wait' | 'board' | 'drive']);
  }

  /** 車に乗りこむまでの残り秒数(wait のときだけ。ほかは null) */
  get secondsToBoard(): number | null {
    return this.p === 'wait' ? Math.max(0, this.sec.wait - this.t) : null;
  }

  /** 仲間が集まり終わった(画面の動きに合わせて早めに呼んでよい)。gather のときだけ効く */
  gathered(): boolean {
    if (this.p !== 'gather') return false;
    this.enter('wait');
    return true;
  }

  /**
   * 行けが押された。wait ならまとめて吹き飛ばす('wipe')、board か drive なら車ごと止める('vanStop')。
   * それ以外(集まる途中、終わったあと)は何も起きない(null)
   */
  go(): 'wipe' | 'vanStop' | null {
    if (this.p === 'wait') {
      this.enter('wiped');
      return 'wipe';
    }
    if (this.p === 'board' || this.p === 'drive') {
      this.enter('stopped');
      return 'vanStop';
    }
    return null;
  }

  /** 時計を進める。この間に入った段階を順に返す('wait'、'board'、'drive'、'escaped') */
  update(deltaMs: number): GangPhase[] {
    const entered: GangPhase[] = [];
    if (deltaMs <= 0) return entered;
    let left = deltaMs / 1000;
    const next: Partial<Record<GangPhase, GangPhase>> = { gather: 'wait', wait: 'board', board: 'drive', drive: 'escaped' };
    while (!this.isOver && left > 0) {
      const limit = this.sec[this.p as 'gather' | 'wait' | 'board' | 'drive'];
      const need = limit - this.t;
      if (left < need) {
        this.t += left;
        break;
      }
      left -= need;
      const to = next[this.p]!;
      this.enter(to);
      entered.push(to);
    }
    return entered;
  }

  private enter(p: GangPhase): void {
    this.p = p;
    this.t = 0;
  }
}
