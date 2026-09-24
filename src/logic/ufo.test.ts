import { describe, expect, it } from 'vitest';
import { UFO } from './rules';
import { UfoCall, UfoQueue } from './ufo';

describe('UFOの数字', () => {
  it('合図0.8秒、下りる1秒、吸い上げ3秒、去る1秒。被害額¥300万', () => {
    expect([UFO.signalSec, UFO.descendSec, UFO.beamSec, UFO.leaveSec]).toEqual([0.8, 1, 3, 1]);
  });
});

describe('UfoCall', () => {
  it('合図 → 下りる → 吸い上げる → 去る → 連れ去られた、の順に進む', () => {
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

  it('大きく時間が飛んでも、入った段階を順に返す', () => {
    const c = new UfoCall('x');
    expect(c.update(10_000)).toEqual(['descend', 'beam', 'leave', 'abducted']);
  });

  it('行けで落とせるのは吸い上げている間だけ', () => {
    const c = new UfoCall('x');
    expect(c.go()).toBe(false);
    c.update(800);
    expect(c.phase).toBe('descend');
    expect(c.go()).toBe(false);
    c.update(1000);
    expect(c.phase).toBe('beam');
    expect(c.go()).toBe(true);
    expect(c.phase).toBe('downed');
    expect(c.isOver).toBe(true);
    expect(c.go()).toBe(false);
    expect(c.update(5000)).toEqual([]);
  });
});

describe('UfoQueue', () => {
  it('UFOは1機ずつ。前のUFOが終わるまで、次の宇宙人は合図を送らない', () => {
    const q = new UfoQueue();
    q.add('a');
    q.add('b');
    q.add('a'); // 同じ人は1回だけ
    expect(q.queued).toEqual(['a', 'b']);
    expect(q.update(0)).toEqual([{ alienId: 'a', phase: 'signal' }]);
    expect(q.current?.alienId).toBe('a');
    expect(q.queued).toEqual(['b']);
    // a が連れ去られるまで(5.8秒)、b は合図を送らない
    const ev = q.update(5_700);
    expect(ev.map((e) => e.phase)).toEqual(['descend', 'beam', 'leave']);
    expect(ev.every((e) => e.alienId === 'a')).toBe(true);
    // 余った時間で b が合図を送る
    const ev2 = q.update(200);
    expect(ev2).toEqual([{ alienId: 'a', phase: 'abducted' }, { alienId: 'b', phase: 'signal' }]);
    expect(q.current?.alienId).toBe('b');
    expect(q.current?.progress).toBeCloseTo(0.1 / 0.8);
  });

  it('行けで落とすと、その宇宙人の id が返り、次の宇宙人の番になる', () => {
    const q = new UfoQueue();
    q.add('a');
    q.add('b');
    q.update(0);
    expect(q.go()).toBeNull(); // まだ合図の途中
    q.update(1_900);
    expect(q.current?.markOn).toBe(true);
    expect(q.go()).toBe('a');
    expect(q.current).toBeNull();
    expect(q.idle).toBe(false);
    expect(q.update(16)).toEqual([{ alienId: 'b', phase: 'signal' }]);
    q.update(100_000);
    expect(q.idle).toBe(true);
  });
});
