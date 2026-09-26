// 段階を順に進む出来事と、その順番待ち(timedCall.ts)の共通の決まり。
// UFO(ufo.ts)と念力(psychic.ts)の両方で同じように動くことを確かめる。それぞれだけの決まりは ufo.test.ts と psychic.test.ts にある。

import { describe, expect, it } from 'vitest';
import { PsyCall, PsyQueue } from './psychic';
import { PSY, UFO } from './rules';
import { UfoCall, UfoQueue } from './ufo';

/** 出来事1つぶん(UfoCall と PsyCall の共通の形) */
interface Call {
  phase: string;
  isOver: boolean;
  go(): boolean;
  update(ms: number): string[];
}

/** 順番待ち(UfoQueue と PsyQueue の形の違いをそろえる) */
interface Queue {
  add(id: string): void;
  update(ms: number): { id: string; phase: string }[];
  go(): string | null;
  current: { id: string; markOn: boolean; progress: number } | null;
  queued: readonly string[];
  idle: boolean;
}

function ufoQueue(): Queue {
  const q = new UfoQueue();
  return {
    add: (id) => q.add(id),
    update: (ms) => q.update(ms).map((e) => ({ id: e.alienId, phase: e.phase })),
    go: () => q.go(),
    get current() { return q.current; },
    get queued() { return q.queued; },
    get idle() { return q.idle; }
  };
}

function psyQueue(): Queue {
  const q = new PsyQueue();
  return {
    add: (id) => q.add(id),
    update: (ms) => q.update(ms).map((e) => ({ id: e.villainId, phase: e.phase })),
    go: () => q.go()?.villainId ?? null,
    get current() { return q.current; },
    get queued() { return q.queued; },
    get idle() { return q.idle; }
  };
}

describe.each([
  {
    name: 'UFO',
    call: (id: string): Call => new UfoCall(id),
    queue: ufoQueue,
    steps: [['signal', UFO.signalSec], ['descend', UFO.descendSec], ['beam', UFO.beamSec], ['leave', UFO.leaveSec]] as const,
    goPhase: 'beam', goEnd: 'downed', timeoutEnd: 'abducted'
  },
  {
    name: '念力',
    call: (id: string): Call => new PsyCall(id),
    queue: psyQueue,
    steps: [['raise', PSY.raiseSec], ['lift', PSY.liftSec], ['carry', PSY.carrySec], ['fall', PSY.dropSec]] as const,
    goPhase: 'carry', goEnd: 'downed', timeoutEnd: 'hit'
  }
])('$name の段階の進み方と順番待ち', ({ call, queue, steps, goPhase, goEnd, timeoutEnd }) => {
  const phases = steps.map(([p]) => p as string);
  const totalMs = steps.reduce((n, [, sec]) => n + sec * 1000, 0);
  /** goPhase に入るまでの時間(ミリ秒) */
  const goStartMs = steps.slice(0, phases.indexOf(goPhase)).reduce((n, [, sec]) => n + sec * 1000, 0);
  const firstMs = steps[0][1] * 1000;

  it('大きく時間が飛んでも、入った段階を順に返す', () => {
    expect(call('x').update(10_000)).toEqual([...phases.slice(1), timeoutEnd]);
  });

  it('行けが効くのは決まった段階の間だけ。効いたら終わり、そのあとは何も起きない', () => {
    const c = call('x');
    for (const p of phases.slice(0, phases.indexOf(goPhase))) {
      expect(c.phase).toBe(p);
      expect(c.go()).toBe(false);
      c.update(steps[phases.indexOf(p)][1] * 1000);
    }
    expect(c.phase).toBe(goPhase);
    expect(c.go()).toBe(true);
    expect(c.phase).toBe(goEnd);
    expect(c.isOver).toBe(true);
    expect(c.go()).toBe(false);
    expect(c.update(5000)).toEqual([]);
  });

  it('1回ずつ。同じ人は1回だけ並び、前の出来事が終わるまで次の人は待つ。余った時間で次が始まる', () => {
    const q = queue();
    q.add('a');
    q.add('b');
    q.add('a'); // 同じ人は1回だけ
    expect(q.queued).toEqual(['a', 'b']);
    expect(q.update(0)).toEqual([{ id: 'a', phase: phases[0] }]);
    expect(q.current?.id).toBe('a');
    expect(q.queued).toEqual(['b']);
    // a が終わる 0.1秒前まで、b は待つ
    const ev = q.update(totalMs - 100);
    expect(ev.map((e) => e.phase)).toEqual(phases.slice(1));
    expect(ev.every((e) => e.id === 'a')).toBe(true);
    // 余った 0.1秒で b が始まる
    expect(q.update(200)).toEqual([{ id: 'a', phase: timeoutEnd }, { id: 'b', phase: phases[0] }]);
    expect(q.current?.id).toBe('b');
    expect(q.current?.progress).toBeCloseTo(100 / firstMs);
  });

  it('行けが効くと、その人の id が返り、次の人の番になる', () => {
    const q = queue();
    q.add('a');
    q.add('b');
    q.update(0);
    expect(q.go()).toBeNull(); // まだ最初の段階
    q.update(goStartMs + 100);
    expect(q.current?.markOn).toBe(true);
    expect(q.go()).toBe('a');
    expect(q.current).toBeNull();
    expect(q.idle).toBe(false);
    expect(q.update(16)).toEqual([{ id: 'b', phase: phases[0] }]);
    q.update(100_000);
    expect(q.idle).toBe(true);
  });
});
