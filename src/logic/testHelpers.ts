// テストだけで使う部品。ゲームの中からは読みこまない。

import type { RecordStorage } from './records';
import { StatsTracker } from './stats';
import type { StageStats } from './types';

/** localStorage の代わり(記録の読み書きを確かめるときに使う) */
export class MemStorage implements RecordStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
}

/**
 * 路地裏を1回遊んだあとの数字(ワルを5人倒し、ボスも倒した。市民のけがと被害額は defaults で決める)。
 * 何も起きていない StatsTracker の snapshot を土台にし、defaults、over の順に上書きする
 */
export function makeStats(defaults: Partial<StageStats>, over: Partial<StageStats> = {}): StageStats {
  return {
    ...new StatsTracker(9, 'alley').snapshot(),
    defeated: 5, defeatedBySort: 5, bossDefeated: true, bossFightSec: 8,
    ...defaults,
    ...over
  };
}
