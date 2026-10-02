// 結果発表で、待てと行けを止めて教える(docs/SPEC.md の「待てと行けを止めて教える」)。
// そのスマホで初めて、市民に待てのマークが出たとき(行けは、悪さを始めたワルに行けのマークが出たとき)に、
// 動きを止めて画面を暗くし、オペレーターが短く教えて、そのボタンを押すまで待つ。教えるのは端末で一度だけ
// (records.ts の needsLesson / markLessonSeen)。フリープレイでは止めない(時間を数えるモードで、教え方も別にあるため)。
//
// 使い方:
//   lessonDue({ kind: 'stop', enc, free: !!this.free, seen: !needsLesson('stop') })  // この合図で止めて教えるか
//   LESSON_LINES.stop / LESSON_HINTS.stop                                         // 教える一言と、8秒押さないときの一言

import { op } from './speech';
import type { Encounter, Speech } from './types';

/** 止めて教える種類:待て('stop')と行け('go') */
export type LessonKind = 'stop' | 'go';
export const LESSON_KINDS: readonly LessonKind[] = ['stop', 'go'];

/** 止めたときのオペレーターの一言(1行12字まで、2行まで) */
export const LESSON_LINES: Record<LessonKind, Speech> = {
  stop: op('panic', '殴ろうとしてる！\n市民なら待てで止めて！'),
  go: op('panic', '見逃したワルが悪さ！\n行けで倒して！')
};

/** 止めてから8秒たっても押さないときの一言 */
export const LESSON_HINTS: Record<LessonKind, Speech> = {
  stop: op('normal', '下の「待て」のボタンを\n押してみて！'),
  go: op('normal', '下の「行け」のボタンを\n押してみて！')
};

/** 止めてから、押さないときの一言に替えるまで(ミリ秒。止めている間の時間) */
export const LESSON_HINT_MS = 8000;

export interface LessonChance {
  kind: LessonKind;
  /** フリープレイか */
  free: boolean;
  /** その人に何が起きるところか(待てのとき) */
  enc?: Encounter;
  /** その端末で、もう教えたか */
  seen: boolean;
}

/**
 * この合図で止めて教えるか。教えたことがなく、フリープレイでないときだけ。
 * 待ては、市民をワルにした人(hitCiv)に向かったときだけ(本当のワルやボスに待てを教えると、まちがった押し方を教えるため)。
 * 行けのマークは、ステージではいつもワルに出るので、そのまま教える
 */
export function lessonDue(c: LessonChance): boolean {
  if (c.free || c.seen) return false;
  if (c.kind === 'stop') return c.enc === 'hitCiv';
  return true;
}

/** 教える文の全部。content.ts の allTexts() に入れてある(文の決まりの確かめと、フォントの読みこみのため) */
export function allLessonTexts(): string[] {
  return LESSON_KINDS.flatMap((k) => [LESSON_LINES[k].text, LESSON_HINTS[k].text]);
}
