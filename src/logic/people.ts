// 仕分けに出てくる1人を作る部品(stage.ts と garage.ts で使う。index.ts からは書き出さない)。

import { AGES, BOSS_HINTS, BOSS_PROFILE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import { BOSS2_AGES, BOSS2_NAMES } from './garageContent';
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

/** 1人を作る(名前、年齢、プロフィール、一言、絵のキー)。ボスなら disguise に化けた姿 */
export function makePerson(
  rng: Rng, used: UsedTexts, stageId: StageId, wave: WaveNo, look: Look, truth: Truth, disguise?: DisguiseLook
): PersonDraft {
  // 地下駐車場の女ボスは、化けた姿にかかわらず女性の名前
  const boss2 = truth === 'boss' && stageId === 'garage';
  const name = pickFresh(rng, boss2 ? BOSS2_NAMES : NAMES[look], used.names, (n) => n);
  const [minAge, maxAge] = boss2 ? BOSS2_AGES : AGES[look];
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
