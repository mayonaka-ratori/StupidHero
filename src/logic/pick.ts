// ステージを作るときの選び方の小さな道具(stage.ts と garage.ts で使う。index.ts からは書き出さない)。

import type { Rng } from './rng';

/** まだ使っていないものから選ぶ。全部使っていたら一覧全体から選ぶ */
export function pickFresh<T>(rng: Rng, list: readonly T[], used: Set<string>, key: (x: T) => string): T {
  const fresh = list.filter((x) => !used.has(key(x)));
  const chosen = rng.pick(fresh.length > 0 ? fresh : list);
  used.add(key(chosen));
  return chosen;
}

/** 使った回数が少ない順に並べる(同じ回数なら順番はランダム) */
export function leastUsed<L extends string>(rng: Rng, looks: readonly L[], count: Record<L, number>): L[] {
  const withKey = rng.shuffle(looks).map((l, i) => ({ l, i }));
  withKey.sort((a, b) => count[a.l] - count[b.l] || a.i - b.i);
  return withKey.map((x) => x.l);
}
