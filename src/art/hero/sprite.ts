// 手で打つ小さな絵(文字の表)を格子に書き写す道具。
import type { PixelGrid } from '../lib';

/**
 * rows の1文字が1ドット。'.' と ' ' は透明。keys で文字を色に置き換える。
 * flip で左右反転。
 */
export function stamp(g: PixelGrid, rows: readonly string[], keys: Record<string, string>, x: number, y: number, flip = false): void {
  const w = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const c = keys[ch];
      if (!c) throw new Error(`stamp: unknown key '${ch}'`);
      g.px(x + (flip ? w - 1 - i : i), y + j, c);
    }
  });
}

/** 同じ幅の行を上書きで重ねた新しい表を作る(表情の差し替え用) */
export function patch(base: readonly string[], over: Record<number, string>): string[] {
  return base.map((row, j) => {
    const o = over[j];
    if (o === undefined) return row;
    let out = '';
    for (let i = 0; i < row.length; i++) out += o[i] === undefined || o[i] === '_' ? row[i] : o[i];
    return out;
  });
}
