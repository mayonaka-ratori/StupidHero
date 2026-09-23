import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from './rng';

describe('rng', () => {
  it('同じ種なら同じ並び', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
    expect(createRng('abc').seed).toBe(hashSeed('abc'));
  });

  it('int は両端を含む範囲に収まる', () => {
    const r = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 4);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(4);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('shuffle は並べかえるだけで元の配列を変えない', () => {
    const src = [1, 2, 3, 4, 5];
    const out = createRng(7).shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(src);
  });

  it('weighted と chance はおおよそ重みの通り', () => {
    const r = createRng(99);
    let a = 0;
    let c = 0;
    for (let i = 0; i < 10000; i++) {
      if (r.weighted({ a: 30, b: 70 }) === 'a') a++;
      if (r.chance(0.25)) c++;
    }
    expect(a / 10000).toBeCloseTo(0.3, 1);
    expect(c / 10000).toBeCloseTo(0.25, 1);
  });
});
