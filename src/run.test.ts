// 1回のプレイの状態と場面の流れ(run.ts)。Phaser は読みこまない(scene は registry だけの偽物を使う)。

import { describe, expect, it, vi } from 'vitest';
import { SCENES } from './config';
import { createStage } from './logic';
import {
  currentFreeWave, currentWave, fillUnsorted, getRun, nextAfterFreeStreet, nextAfterReview, nextAfterStreet, recordAllSorts, setSort,
  startFreeRun, startRun
} from './run';
import { createFreePlay } from './logic/freeplay';
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
  it('選んだステージで始まり、同じシーンの registry で受け渡す。もう一回で新しいプレイになる', () => {
    const scene = fakeScene();
    expect(() => getRun(scene)).toThrow();
    const a = startRun(scene, 42, false, 'garage');
    expect(getRun(scene)).toBe(a);
    expect(a.stage).toEqual(createStage(42, 'garage'));
    expect(a.stats.stageId).toBe('garage');
    expect(a.stats.villainTotal).toBe(a.stage.villainTotal);
    expect([a.waveIndex, a.debug]).toEqual([0, false]);
    const b = startRun(scene, 43);
    expect(b.stage.id).toBe('alley');
    expect(b.sorts).toEqual({});
  });
});

describe('場面の流れ', () => {
  it('Street のあと、波1と波2は答え合わせを通って次の波の Sort、波3は Boss → 答え合わせ → Result', () => {
    for (const stageId of ['alley', 'garage'] as const) {
      const run = startRun(fakeScene(), 7, false, stageId);
      const seen: string[] = [];
      for (let i = 0; i < 3; i++) {
        expect(currentWave(run).no).toBe(i + 1);
        fillUnsorted(run);
        const next = nextAfterStreet(run);
        seen.push(next);
        // Street のあとでは波は進まない(答え合わせでその波を見せるため)
        expect(run.waveIndex).toBe(i);
        if (next === SCENES.waveReview) seen.push(nextAfterReview(run));
      }
      expect(seen).toEqual([SCENES.waveReview, SCENES.sort, SCENES.waveReview, SCENES.sort, SCENES.boss]);
      expect(run.waveIndex).toBe(2);
      // ボス戦のあと(Boss は SCENES.waveReview へ行く)
      expect(nextAfterReview(run)).toBe(SCENES.result);
      // 波3のあとにもう一度呼んでも、波は進まない
      expect(nextAfterReview(run)).toBe(SCENES.result);
      expect(run.waveIndex).toBe(2);
      // 答え合わせのたびに、その波の当たり外れが残る
      const s = run.stats.snapshot();
      expect(s.sortWaves.map((w) => w.wave)).toEqual([1, 2, 3]);
      expect(s.sortTotal + s.sortByHero).toBe(run.stage.peopleTotal);
    }
  });

  it('波が4つのステージ(ステージ4)は、波3のあとも答え合わせを通って波4の Sort へ行き、波4のあとに Boss', () => {
    const run = startRun(fakeScene(), 7, false, 'mall');
    // ステージ4はまだないので、ショッピングモールの並びに波4を足して流れだけを確かめる
    const w3 = run.stage.waves[2];
    run.stage.waves.push({ ...w3, no: 4, people: w3.people.map((p) => ({ ...p, id: `w4-${p.index}`, wave: 4 })) });
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      expect(currentWave(run).no).toBe(i + 1);
      fillUnsorted(run);
      const next = nextAfterStreet(run);
      seen.push(next);
      if (next === SCENES.waveReview) seen.push(nextAfterReview(run));
    }
    expect(seen).toEqual([
      SCENES.waveReview, SCENES.sort, SCENES.waveReview, SCENES.sort, SCENES.waveReview, SCENES.sort, SCENES.boss
    ]);
    expect(run.waveIndex).toBe(3);
    expect(nextAfterReview(run)).toBe(SCENES.result);
  });

  it('答え合わせを通らずに結果画面へ来ても、仕分けの済んだ波は recordAllSorts で数える', () => {
    const run = startRun(fakeScene(), 3);
    for (const w of run.stage.waves.slice(0, 2)) for (const p of w.people) setSort(run, p, p.truth === 'civ' ? 'civ' : 'bad');
    recordAllSorts(run);
    const s = run.stats.snapshot();
    expect(s.sortWaves.map((w) => w.wave)).toEqual([1, 2]);
    expect(s.sortCorrect).toBe(s.sortTotal);
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
    nextAfterReview(run);
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

describe('フリープレイ', () => {
  it('startFreeRun:mode は free、run.stage はフリープレイの並び。ステージの startRun は mode が stage', () => {
    const scene = fakeScene();
    const stageRun = startRun(scene, 1);
    expect([stageRun.mode, stageRun.free]).toEqual(['stage', null]);
    const run = startFreeRun(scene, 42, { unlocked: ['alley', 'garage'], slow: true });
    expect(getRun(scene)).toBe(run);
    expect(run.mode).toBe('free');
    const plan = createFreePlay(42, ['alley', 'garage']);
    expect(run.stage).toEqual(plan.stage);
    expect(run.free!.plan).toEqual(plan);
    expect(run.free!.slow).toBe(true);
    expect(run.free!.clockMs).toBe(0);
    expect(run.stage.id).toBe(plan.waves[0].bgStage);
    const s = run.stats.snapshot();
    expect(s.free).toMatchObject({ stopChances: 9, goChances: 8, units: 27, heroRight: 10, slow: true });
  });

  it('Street のあと、波1と波2は次の波の Street、波3は Result(時計を stats に渡す)', () => {
    const run = startFreeRun(fakeScene(), 7, { unlocked: ['alley'] });
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      expect(currentWave(run).no).toBe(i + 1);
      expect(currentFreeWave(run).no).toBe(i + 1);
      run.free!.clockMs += 30_000;
      seen.push(nextAfterFreeStreet(run));
    }
    expect(seen).toEqual([SCENES.street, SCENES.street, SCENES.result]);
    expect(run.waveIndex).toBe(2);
    expect(run.stats.snapshot().free).toMatchObject({ rawSec: 90, clearSec: 90 });
    // もう一度呼んでも、波は進まない
    expect(nextAfterFreeStreet(run)).toBe(SCENES.result);
    expect(run.waveIndex).toBe(2);
    // ステージの run でフリープレイの波を聞くと投げる
    expect(() => currentFreeWave(startRun(fakeScene(), 1))).toThrow();
  });
});
