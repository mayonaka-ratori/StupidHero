// 仕分けに出てくる1人を作る部品(stage.ts、garage.ts、mall.ts、tower.ts、freeplay.ts で使う。index.ts からは書き出さない)。

import { AGES, BOSS_HINTS, BOSS_PROFILE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import { pickFresh } from './pick';
import type { Rng } from './rng';
import { MISCHIEF_BY_LOOK } from './rules';
import { STAGES, sheetKeyFor } from './stages';
import { bossItemRng, bossItemsFor, fitsTell, tellSheetKey, tellsFor, type TellDef } from './tells';
import type { DisguiseLook, Look, OperatorHint, Person, StageId, Truth, WaveNo } from './types';

/** 名前と文の使い回しを避けるための記録(ステージ全体で1つ) */
export interface UsedTexts {
  names: Set<string>;
  texts: Set<string>;
}

export type PersonDraft = Omit<Person, 'id' | 'index'>;

/** 1つの波の下書きを混ぜて、並んだ順に id('w<波>-<1からの番号>')と index(0から)を付ける */
export function shufflePeople(rng: Rng, wave: WaveNo, drafts: readonly PersonDraft[]): Person[] {
  return rng.shuffle(drafts).map((p, index) => ({ id: `w${wave}-${index + 1}`, index, ...p }));
}

/** 2つの年齢の幅の重なり(重ならなければ後ろの幅) */
function ageOverlap(a: readonly [number, number], b: readonly [number, number]): [number, number] {
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return lo <= hi ? [lo, hi] : [b[0], b[1]];
}

/** 1人を作る(名前、年齢、プロフィール、一言、絵のキー)。ボスなら look に化けた姿を渡す(disguise にも入る) */
export function makePerson(
  rng: Rng, used: UsedTexts, stageId: StageId, wave: WaveNo, look: Look, truth: Truth
): PersonDraft {
  // ボスは、化けた姿の市民と同じ名前の一覧から偽名を選ぶ(名前で分からないように)。
  // ボスの年齢の幅があるステージ(地下駐車場の女ボス)は、その幅と化けた姿の幅の重なりから
  // (化けた姿の市民の幅からはみ出さないように)
  const bossAges = truth === 'boss' ? STAGES[stageId].bossAges : null;
  const name = pickFresh(rng, NAMES[look], used.names, (n) => n);
  const [minAge, maxAge] = bossAges ? ageOverlap(bossAges, AGES[look]) : AGES[look];
  const age = rng.int(minAge, maxAge);
  let lines: readonly string[];
  let hints: readonly OperatorHint[];
  if (truth === 'boss') {
    const d = look as DisguiseLook;
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
  if (truth === 'boss') person.disguise = look as DisguiseLook;
  if (truth === 'bad') person.mischief = MISCHIEF_BY_LOOK[look];
  return person;
}

/**
 * 手がかりの出し分けを選んで、tell と絵のキーを入れる(tells.ts)。出し分けのない人(モヒカン、おばあさん、
 * ステージ4の人など)は何もしない。rng は tellRngFor で作った、ステージとは別の乱数。
 * プロフィールと一言はもう選んであるので、その文と食いちがわない手がかりから選ぶ
 * (「黄色い物がちらっと見えた」の人は、黄色い物を持っている)。どれとも合わないときは一言に合わせ、
 * プロフィールを合う文から選び直す。
 * 路地裏のボスの化けた姿(スーツと買い物袋)は、市民と同じ小物から1つ選んで、絵のキーだけを変える
 * (tell は入れない。ボスの文と決め手は小物に関係ないので)。ボスの小物は、さらに別の乱数(bossItemRng)で選ぶ
 * (rng を引かないので、ほかの人の手がかりは、ボスの小物を足す前と同じ)
 */
export function giveTell(rng: Rng, used: UsedTexts, p: PersonDraft): TellDef | undefined {
  if (p.truth === 'boss') {
    const items = bossItemsFor(p.sheetKey);
    if (items.length === 0) return undefined;
    const item = bossItemRng(rng).pick(items);
    p.sheetKey = tellSheetKey(p.sheetKey, item);
    return item;
  }
  const defs = tellsFor(p.look, p.truth);
  if (defs.length === 0) return undefined;
  const fits = (d: TellDef, text: string) => fitsTell(text, p.look, p.truth, d.id);
  let ok = defs.filter((d) => fits(d, p.profile.line) && fits(d, p.hint.text));
  if (ok.length === 0) {
    ok = defs.filter((d) => fits(d, p.hint.text));
    if (ok.length === 0) ok = [...defs];
  }
  const def = rng.pick(ok);
  if (!fits(def, p.profile.line)) {
    const t = p.truth === 'bad' ? 'bad' : 'civ';
    const lines = (PROFILE_LINES[p.look][t] ?? []).filter((l) => fits(def, l));
    if (lines.length > 0) p.profile = { ...p.profile, line: pickFresh(rng, lines, used.texts, (l) => l) };
  }
  p.tell = def.id;
  p.sheetKey = tellSheetKey(p.sheetKey, def);
  return def;
}
