import { describe, expect, it } from 'vitest';
import { UfoCall, UfoQueue } from './ufo';

// 大きく時間が飛んだとき、行けが効く段階、順番待ちの決まりは timedCall.test.ts で確かめる

describe('UfoCall', () => {
  it('合図 → 下りる → 吸い上げる → 去る → 連れ去られた、の順に進む(合図0.8秒、下りる1秒、吸い上げ3秒、去る1秒)', () => {
    const c = new UfoCall('w1-2');
    expect(c.phase).toBe('signal');
    expect(c.markOn).toBe(false);
    expect(c.update(799)).toEqual([]);
    expect(c.update(1)).toEqual(['descend']);
    expect(c.update(1000)).toEqual(['beam']);
    expect(c.markOn).toBe(true);
    expect(c.update(1500)).toEqual([]);
    expect(c.progress).toBeCloseTo(0.5);
    expect(c.update(1500)).toEqual(['leave']);
    expect(c.markOn).toBe(false);
    expect(c.update(1000)).toEqual(['abducted']);
    expect(c.isOver).toBe(true);
    expect(c.update(1000)).toEqual([]);
  });
});

describe('UfoQueue', () => {
  it('フリープレイのゆっくりモード:吸い上げの長さを変えられる', () => {
    const q = new UfoQueue({ beamSec: 4.5 });
    q.add('a');
    q.update(0);
    expect(q.update(1800).map((e) => e.phase)).toEqual(['descend', 'beam']);
    expect(q.update(4400)).toEqual([]);
    expect(q.update(200).map((e) => e.phase)).toEqual(['leave']);
  });
});
