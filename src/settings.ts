// 遊ぶ人が一時停止の画面で切りかえる設定。そのスマホの中に覚える(localStorage)。
// 使い方:
//   import { settings } from '../settings';
//   if (settings.reduceFx) { ... }        // 光と揺れを弱くする
//   const sec = base * settings.timeScale; // ゆっくりモードなら仕分けの時間が1.5倍
//   settings.set('slowMode', true);
// localStorage が使えないときも落ちない(その場では覚えている)。
// 「光と揺れを弱くする」は、端末の「視差効果を減らす」(prefers-reduced-motion)がオンなら最初からオン。

export interface Settings {
  /** 画面全体の光と、画面の揺れをひかえめにする */
  reduceFx: boolean;
  /** 仕分けの時間を1.5倍にする。称号は変わらない */
  slowMode: boolean;
}

const KEY = 'stupidhero.settings.v1';
/** ゆっくりモードのときの仕分けの時間の倍率 */
const SLOW_MODE_SCALE = 1.5;

function prefersReducedMotion(): boolean {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function load(): Settings {
  const base: Settings = { reduceFx: prefersReducedMotion(), slowMode: false };
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return base;
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      reduceFx: typeof v.reduceFx === 'boolean' ? v.reduceFx : base.reduceFx,
      slowMode: typeof v.slowMode === 'boolean' ? v.slowMode : base.slowMode
    };
  } catch { return base; }
}

let cur = load();
const listeners = new Set<(s: Readonly<Settings>) => void>();

export const settings = {
  get reduceFx(): boolean { return cur.reduceFx; },
  get slowMode(): boolean { return cur.slowMode; },
  /** 仕分けの時間にかける倍率 */
  get timeScale(): number { return cur.slowMode ? SLOW_MODE_SCALE : 1; },
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    cur = { ...cur, [key]: value };
    try { globalThis.localStorage?.setItem(KEY, JSON.stringify(cur)); } catch { /* 覚えられなくても、その場では使える */ }
    for (const fn of listeners) fn(cur);
  },
  /** 変わったときに呼ばれる(フリープレイの途中でゆっくりモードにしたとき)。戻り値を呼ぶと止まる */
  onChange(fn: (s: Readonly<Settings>) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};
