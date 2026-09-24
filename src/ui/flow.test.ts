import { describe, expect, it } from 'vitest';
import { curl, hermite, noise, smooth } from './flow';

describe('hermite', () => {
  it('両端で p0 と p1 を通り、向きが m0 と m1 になる', () => {
    const [p0, m0, p1, m1] = [3, -40, 10, 25];
    expect(hermite(p0, m0, p1, m1, 0)).toBeCloseTo(p0);
    expect(hermite(p0, m0, p1, m1, 1)).toBeCloseTo(p1);
    const e = 1e-5;
    expect((hermite(p0, m0, p1, m1, e) - hermite(p0, m0, p1, m1, 0)) / e).toBeCloseTo(m0, 2);
    expect((hermite(p0, m0, p1, m1, 1) - hermite(p0, m0, p1, m1, 1 - e)) / e).toBeCloseTo(m1, 2);
  });

  it('smooth は向きが0のエルミート曲線と同じ', () => {
    for (let t = 0; t <= 1; t += 0.125) expect(smooth(t)).toBeCloseTo(hermite(0, 0, 1, 0, t));
  });
});

describe('noise', () => {
  it('-1〜1に収まり、格子のさかいめでもとぎれない', () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.137 - 20, y = i * 0.291 - 40;
      const n = noise(x, y, 7).v;
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
    }
    const e = 1e-6;
    for (const [x, y] of [[3, 0.4], [0.7, -2], [-5, -5]]) {
      expect(noise(x - e, y, 1).v).toBeCloseTo(noise(x + e, y, 1).v, 4);
      expect(noise(x, y - e, 1).v).toBeCloseTo(noise(x, y + e, 1).v, 4);
    }
  });

  it('dx と dy は、少し動かしたときの値の変わり方と合う', () => {
    const e = 1e-5;
    for (const [x, y] of [[0.3, 0.8], [4.6, -1.2], [-7.1, 2.9]]) {
      const n = noise(x, y, 3);
      expect((noise(x + e, y, 3).v - noise(x - e, y, 3).v) / (2 * e)).toBeCloseTo(n.dx, 3);
      expect((noise(x, y + e, 3).v - noise(x, y - e, 3).v) / (2 * e)).toBeCloseTo(n.dy, 3);
    }
  });

  it('種が違えば違う並び', () => {
    expect(noise(1.5, 2.5, 1).v).not.toBeCloseTo(noise(1.5, 2.5, 2).v, 3);
  });
});

describe('curl', () => {
  it('流れがどこにも集まらず、どこからも湧かない(広がり方の合計が0)', () => {
    const e = 1e-4;
    for (let i = 0; i < 40; i++) {
      const x = i * 0.53 - 9, y = i * 0.37 - 4, t = i * 0.1;
      const div = (curl(x + e, y, t).x - curl(x - e, y, t).x + curl(x, y + e, t).y - curl(x, y - e, t).y) / (2 * e);
      expect(Math.abs(div)).toBeLessThan(1e-3);
    }
  });

  it('向きの長さは、まん中あたりが0.5くらいで、3.5をこえない', () => {
    const lens: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const v = curl(i * 0.211, i * -0.173, i * 0.05, 9);
      lens.push(Math.hypot(v.x, v.y));
    }
    lens.sort((a, b) => a - b);
    expect(lens[1000]).toBeGreaterThan(0.3);
    expect(lens[1000]).toBeLessThan(0.8);
    expect(lens[lens.length - 1]).toBeLessThan(3.5);
  });
});
