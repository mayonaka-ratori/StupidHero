// 段階を順に進む出来事と、その順番待ち(timedCall.ts)の共通の決まり。
// UFO(ufo.ts)と念力(psychic.ts)の両方で同じように動くことを確かめる。念力だけの決まりは psychic.test.ts にある。

import { describe, expect, it } from 'vitest';
import { PsyCall, PsyQueue } from './psychic';
import { UfoCall, UfoQueue } from './ufo';

/** 出来事1つぶん(UfoCall と PsyCall の共通の形) */
interface Call {
  phase: string;
  isOver: boolean;
  markOn: boolean;
  progress: number;
  go(): boolean;
  update(ms: number): string[];
}

/** 順番待ち(UfoQueue と PsyQueue の形の違いをそろえる) */
interface Queue {
  add(id: string): void;
  update(ms: number): { id: string; phase: string }[];
  go(): string | null;
  current: { id: string; markOn: boolean; progress: number } | null;
  idle: boolean;
}

/** 行けが効く段階をゆっくりモードでのばしたときの秒数 */
const SLOW_SEC = 4.5;

function ufoQueue(slow = false): Queue {
  const q = new UfoQueue(slow ? { beamSec: SLOW_SEC } : {});
  return {
    add: (id) => q.add(id),
    update: (ms) => q.update(ms).map((e) => ({ id: e.alienId, phase: e.phase })),
    go: () => q.go(),
    get current() { return q.current; },
    get idle() { return q.idle; }
  };
}

function psyQueue(slow = false): Queue {
  const q = new PsyQueue(slow ? { carrySec: SLOW_SEC } : {});
  return {
    add: (id) => q.add(id),
    update: (ms) => q.update(ms).map((e) => ({ id: e.villainId, phase: e.phase })),
    go: () => q.go()?.villainId ?? null,
    get current() { return q.current; },
    get idle() { return q.idle; }
  };
}

describe.each([
  {
    // 合図0.8秒、下りる1秒、吸い上げ3秒、去る1秒
    name: 'UFO',
    call: (id: string): Call => new UfoCall(id),
    queue: ufoQueue,
    steps: [['signal', 0.8], ['descend', 1], ['beam', 3], ['leave', 1]] as const,
    goPhase: 'beam', goEnd: 'downed', timeoutEnd: 'abducted'
  },
  {
    // 手を出す0.6秒、浮く0.8秒、運ぶ3秒、落ちる0.4秒
    name: '念力',
    call: (id: string): Call => new PsyCall(id),
    queue: psyQueue,
    steps: [['raise', 0.6], ['lift', 0.8], ['carry', 3], ['fall', 0.4]] as const,
    goPhase: 'carry', goEnd: 'downed', timeoutEnd: 'hit'
  }
])('$name の段階の進み方と順番待ち', ({ call, queue, steps, goPhase, goEnd, timeoutEnd }) => {
  const phases = steps.map(([p]) => p as string);
  const totalMs = steps.reduce((n, [, sec]) => n + sec * 1000, 0);
  /** goPhase に入るまでの時間(ミリ秒) */
  const goStartMs = steps.slice(0, phases.indexOf(goPhase)).reduce((n, [, sec]) => n + sec * 1000, 0);
  const firstMs = steps[0][1] * 1000;

  it('段階を決まった秒数で順に進む。行けのマークは行けが効く段階の間だけ', () => {
    const c = call('w1-2');
    steps.forEach(([p, sec], i) => {
      const next = phases[i + 1] ?? timeoutEnd;
      expect(c.phase).toBe(p);
      expect(c.markOn).toBe(p === goPhase);
      if (p === goPhase) {
        expect(c.update(sec * 500)).toEqual([]);
        expect(c.progress).toBeCloseTo(0.5);
        expect(c.update(sec * 500)).toEqual([next]);
      } else {
        expect(c.update(sec * 1000 - 1)).toEqual([]);
        expect(c.update(1)).toEqual([next]);
      }
    });
    expect(c.markOn).toBe(false);
    expect(c.isOver).toBe(true);
    expect(c.progress).toBe(1);
    expect(c.update(1000)).toEqual([]);
  });

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
    expect(q.update(0)).toEqual([{ id: 'a', phase: phases[0] }]);
    expect(q.current?.id).toBe('a');
    // a が終わる 0.1秒前まで、b は待つ
    const ev = q.update(totalMs - 100);
    expect(ev.map((e) => e.phase)).toEqual(phases.slice(1));
    expect(ev.every((e) => e.id === 'a')).toBe(true);
    // 余った 0.1秒で b が始まる
    expect(q.update(200)).toEqual([{ id: 'a', phase: timeoutEnd }, { id: 'b', phase: phases[0] }]);
    expect(q.current?.id).toBe('b');
    expect(q.current?.progress).toBeCloseTo(100 / firstMs);
    // b のあとは誰も来ない(a は2回目を並んでいない)
    const rest = q.update(100_000);
    expect(rest.map((e) => e.phase)).toEqual([...phases.slice(1), timeoutEnd]);
    expect(rest.every((e) => e.id === 'b')).toBe(true);
    expect(q.idle).toBe(true);
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

  it('フリープレイのゆっくりモード:行けが効く段階の長さを順番待ちに渡して変えられる', () => {
    const q = queue(true);
    const after = phases[phases.indexOf(goPhase) + 1];
    q.add('a');
    q.update(0);
    expect(q.update(goStartMs).map((e) => e.phase)).toEqual(phases.slice(1, phases.indexOf(goPhase) + 1));
    expect(q.update(SLOW_SEC * 1000 - 100)).toEqual([]);
    expect(q.update(200).map((e) => e.phase)).toEqual([after]);
  });
});
