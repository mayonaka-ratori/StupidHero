// 1ステージぶん(波3回)の人の並びを、種から作る。同じ種なら毎回同じステージになる。
// 決まり:SPECの波の表の通り。1つの波のワルは2〜3人。波1にはモヒカンを必ず1人。波3にはボスが1人紛れる。
// 同じ見た目の市民とワルがなるべく同じ波に両方出るようにし、名前と文は同じものを2回出さない。

import { AGES, BOSS_HINTS, BOSS_PROFILE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import { createRng, randomSeed, type Rng } from './rng';
import { BAD_PER_WAVE, MISCHIEF_BY_LOOK, WAVES } from './rules';
import type {
  DisguiseLook, Look, OperatorHint, PairLook, Person, Stage, Truth, Wave, WaveNo
} from './types';

export const PAIR_LOOKS: readonly PairLook[] = ['hoodie', 'suit', 'shopper'];
export const DISGUISE_LOOKS: readonly DisguiseLook[] = ['suit', 'granny', 'shopper'];

export const STAGE_NAME = '路地裏';

/** 見た目と正体から絵のキーを決める(src/art/sheets.ts のキー) */
export function sheetKeyFor(look: Look, truth: Truth): string {
  if (truth === 'boss') return `boss_disguise_${look}`;
  if (look === 'mohawk') return 'villain_mohawk';
  if (look === 'granny') return 'granny_civ';
  return `${look}_${truth}`;
}

/** 使い回しを避けるための記録 */
interface Used {
  names: Set<string>;
  texts: Set<string>;
  /** その見た目をワル/市民として何回使ったか(ステージ全体で偏らないように) */
  badCount: Record<PairLook, number>;
  civCount: Record<PairLook, number>;
}

/** まだ使っていないものから選ぶ。全部使っていたら一覧全体から選ぶ */
function pickFresh<T>(rng: Rng, list: readonly T[], used: Set<string>, key: (x: T) => string): T {
  const fresh = list.filter((x) => !used.has(key(x)));
  const chosen = rng.pick(fresh.length > 0 ? fresh : list);
  used.add(key(chosen));
  return chosen;
}

/** 使った回数が少ない順に並べる(同じ回数なら順番はランダム) */
function leastUsed(rng: Rng, looks: readonly PairLook[], count: Record<PairLook, number>): PairLook[] {
  const withKey = rng.shuffle(looks).map((l, i) => ({ l, i }));
  withKey.sort((a, b) => count[a.l] - count[b.l] || a.i - b.i);
  return withKey.map((x) => x.l);
}

function makePerson(
  rng: Rng, used: Used, wave: WaveNo, look: Look, truth: Truth, disguise?: DisguiseLook
): Omit<Person, 'id' | 'index'> {
  const name = pickFresh(rng, NAMES[look], used.names, (n) => n);
  const [minAge, maxAge] = AGES[look];
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
  const person: Omit<Person, 'id' | 'index'> = {
    wave, look, truth, sheetKey: sheetKeyFor(look, truth),
    profile: { name, age, line },
    hint: { ...hint }
  };
  if (truth === 'boss') person.disguise = disguise ?? (look as DisguiseLook);
  if (truth === 'bad') person.mischief = MISCHIEF_BY_LOOK[look];
  return person;
}

/**
 * 1ステージぶんの3つの波を作る。
 * @param seed 種。省略すると毎回ちがうステージ。数でも文字列でもよい
 */
export function createStage(seed: number | string = randomSeed()): Stage {
  const rng = createRng(seed);
  const used: Used = {
    names: new Set(), texts: new Set(),
    badCount: { hoodie: 0, suit: 0, shopper: 0 },
    civCount: { hoodie: 0, suit: 0, shopper: 0 }
  };
  // おばあさんをステージのどこかに必ず1人入れる(「おばあちゃんの敵」を取れるように)
  const grannyWave = rng.int(1, WAVES.length) as WaveNo;
  const bossDisguise = rng.pick(DISGUISE_LOOKS);

  const waves: Wave[] = WAVES.map((plan) => {
    const badCount = rng.int(BAD_PER_WAVE.min, BAD_PER_WAVE.max);
    const civSlots = plan.people - badCount;

    // ワル:モヒカン(波1だけ)と、組の見た目から重ならないように
    const bads: Look[] = plan.mohawk ? ['mohawk'] : [];
    const pairBads = leastUsed(rng, PAIR_LOOKS, used.badCount).slice(0, badCount - bads.length);
    for (const l of pairBads) used.badCount[l]++;
    bads.push(...pairBads);

    // 市民:おばあさん → ワルと同じ見た目 → (波3)ボスの化けた姿と同じ見た目 → 残りは偏らないように
    const civs: Look[] = [];
    if (plan.no === grannyWave) civs.push('granny');
    for (const l of rng.shuffle(pairBads)) if (civs.length < civSlots) civs.push(l);
    if (plan.boss && civs.length < civSlots && !civs.includes(bossDisguise)) civs.push(bossDisguise);
    while (civs.length < civSlots) {
      const fresh = leastUsed(rng, PAIR_LOOKS, used.civCount).filter((l) => !civs.includes(l));
      // 組の見た目を使い切ったら、おばあさん(1つの波に1人まで)か、組の見た目の2人目
      if (fresh.length > 0 && !(rng.chance(0.15) && !civs.includes('granny'))) civs.push(fresh[0]);
      else if (!civs.includes('granny')) civs.push('granny');
      else civs.push(rng.pick(PAIR_LOOKS));
    }
    for (const l of civs) if (l !== 'granny' && l !== 'mohawk') used.civCount[l as PairLook]++;

    const drafts: Omit<Person, 'id' | 'index'>[] = [
      ...bads.map((l) => makePerson(rng, used, plan.no, l, 'bad')),
      ...civs.map((l) => makePerson(rng, used, plan.no, l, 'civ'))
    ];
    if (plan.boss) drafts.push(makePerson(rng, used, plan.no, bossDisguise, 'boss', bossDisguise));

    const people: Person[] = rng.shuffle(drafts).map((p, index) => ({
      id: `w${plan.no}-${index + 1}`, index, ...p
    }));
    return { no: plan.no, seconds: plan.seconds, people, badCount, hasBoss: plan.boss };
  });

  const badTotal = waves.reduce((sum, w) => sum + w.badCount, 0);
  const bossTotal = waves.filter((w) => w.hasBoss).length;
  return {
    id: 'alley',
    name: STAGE_NAME,
    seed: rng.seed,
    waves,
    villainTotal: badTotal + bossTotal,
    peopleTotal: waves.reduce((sum, w) => sum + w.people.length, 0)
  };
}

/** ステージの中のボス(いなければ null) */
export function findBoss(stage: Stage): Person | null {
  for (const w of stage.waves) for (const p of w.people) if (p.truth === 'boss') return p;
  return null;
}
