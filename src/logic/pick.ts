// ステージを作るときの選び方の部品(stage.ts、garage.ts、mall.ts、tower.ts、people.ts、freeplay.ts で使う。index.ts からは書き出さない)。

import type { Rng } from './rng';

/** まだ使っていないものから選ぶ。全部使っていたら一覧全体から選ぶ */
export function pickFresh<T>(rng: Rng, list: readonly T[], used: Set<string>, key: (x: T) => string): T {
  const fresh = list.filter((x) => !used.has(key(x)));
  const chosen = rng.pick(fresh.length > 0 ? fresh : list);
  used.add(key(chosen));
  return chosen;
}

/** 見た目ごとの使った回数の表を、どれも0で作る */
export function zeroCounts<L extends string>(looks: readonly L[]): Record<L, number> {
  const count = {} as Record<L, number>;
  for (const l of looks) count[l] = 0;
  return count;
}

/**
 * ボスの化けた姿と同じ見た目の市民を入れる(乱数は使わない)。まだいなければ、空きがあれば足し、
 * 空きがなければ最後の1人を入れかえる
 */
export function includeLook<L extends string>(civLooks: L[], look: L, civSlots: number): void {
  if (civLooks.includes(look)) return;
  if (civLooks.length < civSlots) civLooks.push(look);
  else if (civLooks.length > 0) civLooks[civLooks.length - 1] = look;
}

/** 使った回数が少ない順に並べる(同じ回数なら順番はランダム) */
export function leastUsed<L extends string>(rng: Rng, looks: readonly L[], count: Record<L, number>): L[] {
  const withKey = rng.shuffle(looks).map((l, i) => ({ l, i }));
  withKey.sort((a, b) => count[a.l] - count[b.l] || a.i - b.i);
  return withKey.map((x) => x.l);
}

/**
 * ラッシュ(タイムセールとエレベーター)に並ぶ人の正体と見た目。
 * 最初の2人は市民1人とワル1人(順はランダム)、残りは混ぜる。見た目は looks から、前の人と続けて同じにならないように選ぶ
 */
export function rushLineup<L extends string>(
  rng: Rng, badCount: number, civCount: number, looks: readonly L[]
): { truth: 'bad' | 'civ'; look: L }[] {
  const opening = rng.shuffle<'bad' | 'civ'>(['civ', 'bad']);
  const rest = rng.shuffle<'bad' | 'civ'>([
    ...Array.from({ length: badCount - 1 }, () => 'bad' as const),
    ...Array.from({ length: civCount - 1 }, () => 'civ' as const)
  ]);
  let prev: L | null = null;
  return [...opening, ...rest].map((truth) => {
    const look = rng.pick(looks.filter((l) => l !== prev));
    prev = look;
    return { truth, look };
  });
}
