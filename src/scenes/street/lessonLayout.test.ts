import { describe, expect, it } from 'vitest';
import { clipRect, coverRects, unionRect, type Rect } from './lessonLayout';

/** 四角の並びが、点 (x, y) を何回覆うか */
const coverCount = (rs: Rect[], x: number, y: number): number => rs.filter((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h).length;
const inside = (rs: Rect[], x: number, y: number): boolean => coverCount(rs, x, y) > 0;

describe('止めて教えるときの暗くする所', () => {
  const W = 216, H = 384;

  it('穴がなければ画面全体を1つで覆う', () => {
    expect(coverRects(W, H, [])).toEqual([{ x: 0, y: 0, w: W, h: H }]);
  });

  it('穴の中は覆わず、穴の外はちょうど1回だけ覆う(重なった穴、画面からはみ出す穴も)', () => {
    const holes: Rect[] = [
      { x: 30.4, y: 20.6, w: 90, h: 80 },   // 相手とヒーロー
      { x: 100, y: 60, w: 60, h: 30 },      // 重なる吹き出し
      { x: 4, y: 270, w: 208, h: 60 },      // カットイン
      { x: -2, y: 336, w: 110, h: 60 }      // 下の端からはみ出すボタン
    ];
    const rs = coverRects(W, H, holes);
    const clipped = holes.map((h) => clipRect(h, W, H)!);
    // 点ごとに expect を呼ぶと遅いので、合わない点を集めて最後に1回だけ確かめる
    const bad: string[] = [];
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const want = inside(clipped, x, y) ? 0 : 1;
        const got = coverCount(rs, x, y);
        if (got !== want) bad.push(`${x},${y}: ${got}回`);
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
    // どの四角も画面の中で、幅と高さがある
    for (const r of rs) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H).toBe(true);
    }
  });

  it('clipRect は外に出た分を切り、全部外なら null。unionRect は全部を囲む', () => {
    expect(clipRect({ x: -5, y: 380, w: 20, h: 20 }, W, H)).toEqual({ x: 0, y: 380, w: 15, h: 4 });
    expect(clipRect({ x: 220, y: 0, w: 5, h: 5 }, W, H)).toBeNull();
    expect(unionRect([{ x: 10, y: 20, w: 5, h: 5 }, { x: 0, y: 30, w: 4, h: 10 }])).toEqual({ x: 0, y: 20, w: 15, h: 20 });
  });
});
