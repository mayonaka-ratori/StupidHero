// 仕分けに出てくる1人を作る部品(stage.ts と garage.ts で使う。index.ts からは書き出さない)。

import { AGES, BOSS_HINTS, BOSS_PROFILE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import { BOSS2_AGES } from './garageContent';
import { pickFresh } from './pick';
import type { Rng } from './rng';
import { MISCHIEF_BY_LOOK } from './rules';
import { sheetKeyFor } from './stages';
import type { DisguiseLook, Look, OperatorHint, Person, StageId, Truth, WaveNo } from './types';

/** 名前と文の使い回しを避けるための記録(ステージ全体で1つ) */
export interface UsedTexts {
  names: Set<string>;
  texts: Set<string>;
}

export type PersonDraft = Omit<Person, 'id' | 'index'>;

/** 2つの年齢の幅の重なり(重ならなければ後ろの幅) */
function ageOverlap(a: readonly [number, number], b: readonly [number, number]): [number, number] {
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return lo <= hi ? [lo, hi] : [b[0], b[1]];
}

/** 1人を作る(名前、年齢、プロフィール、一言、絵のキー)。ボスなら disguise に化けた姿 */
export function makePerson(
  rng: Rng, used: UsedTexts, stageId: StageId, wave: WaveNo, look: Look, truth: Truth, disguise?: DisguiseLook
): PersonDraft {
  // 地下駐車場の女ボスは、化けた姿の市民と同じ名前の一覧から偽名を選ぶ(名前で分からないように)。
  // 年齢は女ボスの幅と化けた姿の幅の重なりから(化けた姿の市民の幅からはみ出さないように)
  const boss2 = truth === 'boss' && stageId === 'garage';
  const name = pickFresh(rng, NAMES[look], used.names, (n) => n);
  const [minAge, maxAge] = boss2 ? ageOverlap(BOSS2_AGES, AGES[look]) : AGES[look];
  const age = rng.int(minAge, maxAge);
  let lines: readonly string[];
  let hints: readonly OperatorHint[];
  if (truth === 'boss') {
    const d = disguise ?? (look as DisguiseLook);
    lines = BOSS_PROFILE_LINES[d];
    hints = BOSS_HINTS[d];
  } else {
    const t = truth === 'bad' ? 'bad' : 'civ';
    lines = PROFILE_LINES[look][t] ?? [];
    hints = OPERATOR_HINTS[look][t] ?? [];
  }
  const line = pickFresh(rng, lines, used.texts, (s) => s);
  const hint = pickFresh(rng, hints, used.texts, (h) => h.text);
  const person: PersonDraft = {
    wave, look, truth, sheetKey: sheetKeyFor(look, truth, stageId),
    profile: { name, age, line },
    hint: { ...hint }
  };
  if (truth === 'boss') person.disguise = disguise ?? (look as DisguiseLook);
  if (truth === 'bad') person.mischief = MISCHIEF_BY_LOOK[look];
  return person;
}
