// 絵のテストで使う、色を調べる小さな関数(テストからだけ使う)。
import type { PixelGrid } from './lib';

/** 絵に使われている色(透明を除く) */
export const colorsOf = (grids: PixelGrid[]): Set<string> => {
  const s = new Set<string>();
  for (const g of grids) for (const row of g.cells) for (const c of row) if (c) s.add(c);
  return s;
};

/** 'rgb(R,G,B)' と書いた色の R、G、B(0〜255)。この書き方でなければ null */
export const rgbOf = (c: string): [number, number, number] | null => {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
