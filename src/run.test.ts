// 1回のプレイの状態と場面の流れ(run.ts)。Phaser は読みこまない(scene は registry だけの偽物を使う)。

import { describe, expect, it, vi } from 'vitest';
import { SCENES } from './config';
import { createStage } from './logic';
import { currentWave, fillUnsorted, getRun, nextAfterStreet, setSort, startRun } from './run';
import type Phaser from 'phaser';

vi.mock('phaser', () => {
  throw new Error('run.ts のテストで Phaser を読みこんだ');
});

/** registry だけの偽のシーン */
function fakeScene(): Phaser.Scene {
  const data = new Map<string, unknown>();
  return { registry: { get: (k: string) => data.get(k), set: (k: string, v: unknown) => data.set(k, v) } } as unknown as Phaser.Scene;
}

describe('startRun と getRun', () => {
  it('選んだステージで始まり、同じシーンの registry で受け渡す。もう一回で playCount が増える', () => {
    const scene = fakeScene();
    expect(() => getRun(scene)).toThrow();
    const a = startRun(scene, 42, false, 'garage');
    expect(getRun(scene)).toBe(a);
    expect(a.stage).toEqual(createStage(42, 'garage'));
    expect(a.stats.stageId).toBe('garage');
    expect(a.stats.villainTotal).toBe(a.stage.villainTotal);
    expect([a.waveIndex, a.playCount, a.debug]).toEqual([0, 1, false]);
    const b = startRun(scene, 43);
    expect(b.stage.id).toBe('alley');
    expect(b.playCount).toBe(2);
    expect(b.sorts).toEqual({});
  });
});

describe('場面の流れ', () => {
  it('Street のあとは、波1と波2なら次の波の Sort、波3なら Boss', () => {
    for (const stageId of ['alley', 'garage'] as const) {
      const run = startRun(fakeScene(), 7, false, stageId);
      const seen: string[] = [];
      for (let i = 0; i < 3; i++) {
        expect(currentWave(run).no).toBe(i + 1);
        seen.push(nextAfterStreet(run));
      }
      expect(seen).toEqual([SCENES.sort, SCENES.sort, SCENES.boss]);
      expect(run.waveIndex).toBe(2);
      // 波3のあとにもう一度呼んでも、波は進まない
      expect(nextAfterStreet(run)).toBe(SCENES.boss);
      expect(run.waveIndex).toBe(2);
    }
  });

  it('fillUnsorted は、今の波で仕分けていない人だけをヒーローの気まぐれで決める', () => {
    const run = startRun(fakeScene(), 99, false, 'garage');
    const [first, second, ...rest] = currentWave(run).people;
    setSort(run, first, 'bad');
    setSort(run, second, 'civ');
    const filled = fillUnsorted(run);
    expect(filled.map((p) => p.id)).toEqual(rest.map((p) => p.id));
    expect(run.randomSorted).toEqual(rest.map((p) => p.id));
    expect(run.sorts[first.id]).toBe('bad');
    expect(run.sorts[second.id]).toBe('civ');
    for (const p of rest) expect(['bad', 'civ']).toContain(run.sorts[p.id]);
    // ほかの波の人には触らない。もう一度呼んでも何も増えない
    expect(Object.keys(run.sorts)).toHaveLength(currentWave(run).people.length);
    expect(fillUnsorted(run)).toEqual([]);
    // 次の波に進むと、その波の人を決める
    nextAfterStreet(run);
    expect(fillUnsorted(run)).toHaveLength(currentWave(run).people.length);
  });

  it('同じ種なら、気まぐれの決め方も同じ', () => {
    const pick = () => {
      const run = startRun(fakeScene(), 5);
      fillUnsorted(run);
      return run.sorts;
    };
    expect(pick()).toEqual(pick());
  });
});
