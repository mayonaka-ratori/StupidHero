// 種(シード)から決まる乱数。同じ種なら同じステージ、同じ結果になるので、テストや不具合の再現に使える。
// 中身は mulberry32。文字列の種は数に直してから使う。

export interface Rng {
  /** 使った種(数に直したもの) */
  readonly seed: number;
  /** 0以上1未満の数 */
  next(): number;
  /** min以上max以下の整数(両端を含む) */
  int(min: number, max: number): number;
  /** min以上max未満の小数 */
  float(min: number, max: number): number;
  /** 確率pで true(p は0〜1) */
  chance(p: number): boolean;
  /** 配列から1つ選ぶ(空の配列は投げる) */
  pick<T>(list: readonly T[]): T;
  /** 並べかえた新しい配列を返す(元の配列は変えない) */
  shuffle<T>(list: readonly T[]): T[];
  /** 重みつきで1つ選ぶ。例:weighted({ a: 30, b: 70 }) */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K;
}

/** 文字列を32ビットの数に直す(FNV-1a) */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 毎回ちがう種を作る(画面の担当が「もう一回」のたびに呼ぶ) */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 0x100000000) ^ (Date.now() & 0xffffffff)) >>> 0;
}

export function createRng(seed: number | string): Rng {
  const s0 = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  let state = s0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed: s0,
    next,
    int: (min, max) => {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (list) => {
      if (list.length === 0) throw new Error('pick: 空の配列');
      return list[Math.floor(next() * list.length)];
    },
    shuffle: (list) => {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    weighted: (weights) => {
      const keys = Object.keys(weights) as (keyof typeof weights & string)[];
      const total = keys.reduce((sum, k) => sum + Math.max(0, weights[k]), 0);
      if (total <= 0) throw new Error('weighted: 重みがすべて0');
      let r = next() * total;
      for (const k of keys) {
        r -= Math.max(0, weights[k]);
        if (r < 0) return k;
      }
      return keys[keys.length - 1];
    }
  };
  return rng;
}
