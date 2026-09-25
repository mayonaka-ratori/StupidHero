// ステージ4のボス戦の「念力の選択」(docs/STAGE4.md「念力の選択」)。時計は外から進める(update に経った時間を渡す)。
//
// 決まり:
// - 体力が半分を切ると1回だけ、親玉が客とシャンデリアを浮かせる。この間はボス戦の時計を止める
//   (画面は BossFight.update を呼ばない。BossFight の体力の下限の線で、戻ってから倒れるまで最短1.5秒になる)
// - 3秒の間に、待てと行けを1回ずつ押す(順番は自由)。同じボタンの2回目と、連打は数えない
// - ボタンが出た直後(CHOICE_GUARD_SEC)の押しは数えない。連打していた指が、出てきたボタンをそのまま押してしまわないように
// - 両方押すか3秒たったら終わり。押さなかった分は、客が落ちる(市民のけが、ワルにやられた)、
//   シャンデリアが落ちる(被害額に¥3,000万)
//
// 使い方:
//   const choice = new PsyChoice();
//   choice.press('stop');                 // 待て。受け付けたら true(2回目や終わったあとは false)
//   const r = choice.update(deltaMs);     // r.ended が true になった update で終わり
//   if (choice.done) { const o = choice.outcome; applyChoice(stats, o, guestLook); }

import { BOSS4 } from './rules';
import type { StatsTracker } from './stats';
import type { Look } from './types';

/** 待て(客を下ろす)と行け(シャンデリアを押し返す) */
export type ChoicePress = 'stop' | 'go';

export interface ChoiceOutcome {
  /** 待てを押して、客が床に下りて逃げた */
  guestSaved: boolean;
  /** 行けを押して、シャンデリアを天井へ押し返した */
  chandelierSaved: boolean;
}

/** ボタンが出てから、押しを受け付けるまでの秒数(連打の指がそのまま当たらないように) */
export const CHOICE_GUARD_SEC = 0.3;

export class PsyChoice {
  readonly limitSec: number;
  readonly guardSec: number;
  private t = 0;
  private stopAt: number | null = null;
  private goAt: number | null = null;
  private endedAt: number | null = null;

  constructor(limitSec: number = BOSS4.choiceSec, guardSec: number = CHOICE_GUARD_SEC) {
    this.limitSec = limitSec;
    this.guardSec = guardSec;
  }

  /** ボタンが押された。受け付けたら true(終わったあと、同じボタンの2回目、出た直後の押しは false) */
  press(p: ChoicePress): boolean {
    if (this.done || this.t < this.guardSec) return false;
    if (p === 'stop') {
      if (this.stopAt !== null) return false;
      this.stopAt = this.t;
    } else {
      if (this.goAt !== null) return false;
      this.goAt = this.t;
    }
    if (this.stopAt !== null && this.goAt !== null) this.endedAt = this.t;
    return true;
  }

  /** 時計を進める(ミリ秒)。ended はこの update で終わったとき true */
  update(deltaMs: number): { ended: boolean } {
    if (this.done || deltaMs <= 0) return { ended: false };
    this.t = Math.min(this.limitSec, this.t + deltaMs / 1000);
    if (this.t >= this.limitSec) {
      this.endedAt = this.limitSec;
      return { ended: true };
    }
    return { ended: false };
  }

  /** 終わったか(両方押したか、時間切れ) */
  get done(): boolean {
    return this.endedAt !== null;
  }

  /** そのボタンを押したか */
  pressed(p: ChoicePress): boolean {
    return (p === 'stop' ? this.stopAt : this.goAt) !== null;
  }

  /** 残りの時間の割合(1〜0)。時間のバーに使う */
  get leftRatio(): number {
    return Math.max(0, 1 - this.t / this.limitSec);
  }

  /** 始まってからの秒数 */
  get elapsedSec(): number {
    return this.t;
  }

  /** 今の答え(終わる前に見ると、まだ押していない分は助けていない扱い) */
  get outcome(): ChoiceOutcome {
    return { guestSaved: this.stopAt !== null, chandelierSaved: this.goAt !== null };
  }
}

/**
 * 念力の選択の答えを数に入れる。客が落ちたら市民のけが(ワルにやられた)、シャンデリアが落ちたら被害額。
 * 足した被害額を返す(画面に飛ばす数字)
 */
export function applyChoice(stats: Pick<StatsTracker, 'hurtCiv' | 'breakProp'>, o: ChoiceOutcome, guestLook?: Look): number {
  if (!o.guestSaved) stats.hurtCiv('villain', guestLook);
  return o.chandelierSaved ? 0 : stats.breakProp('chandelier');
}
