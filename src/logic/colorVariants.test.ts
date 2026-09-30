// 服の色ちがい(colorVariants.ts)の決まり方を確かめる。
// 同じ種なら同じ色、ワルか市民かボスかで色の出方がかたよらない(色が手がかりにならない)こと。
import { describe, expect, it } from 'vitest';
import { COLOR_VARIANT_COUNT, colorVariantCount, rollColorVariants } from './colorVariants';
import { createFreePlay } from './freeplay';
import { createStage } from './stage';
import { STAGE_IDS } from './stages';
import type { Stage, StageId, Truth } from './types';

/** ステージの全員の色ちがい(波の順、出てくる順)と、ラッシュの人の色ちがい */
const variantsOf = (s: Stage): number[] => [
  ...s.waves.flatMap((w) => w.people.map((p) => p.colorVariant!)),
  ...(s.rush?.kind === 'sale' ? s.rush.runners.map((r) => r.colorVariant!) : []),
  ...(s.rush?.kind === 'elevator' ? s.rush.riders.map((r) => r.colorVariant!) : [])
];

/** colorVariant をのぞいた中身(人の並び、名前、文など) */
const withoutVariants = (s: Stage): unknown => JSON.parse(JSON.stringify(s, (k, v) => (k === 'colorVariant' ? undefined : v)));

describe('服の色ちがい', () => {
  it.each(STAGE_IDS)('%s:同じ種なら同じ色ちがい。全員とラッシュの人に 0〜3 が入る', (id: StageId) => {
    for (const seed of [1, 42, 12345, 'abc']) {
      const a = createStage(seed, id), b = createStage(seed, id);
      expect(variantsOf(a)).toEqual(variantsOf(b));
      for (const v of variantsOf(a)) expect(v >= 0 && v < COLOR_VARIANT_COUNT && Number.isInteger(v)).toBe(true);
      expect(variantsOf(a).length).toBe(a.peopleTotal + (a.rush?.kind === 'sale' ? a.rush.runners.length : a.rush?.kind === 'elevator' ? a.rush.riders.length : 0));
    }
  });

  it.each(STAGE_IDS)('%s:種がちがえば色ちがいもちがう(何回か遊ぶと同じ見た目がちがう色で出る)', (id: StageId) => {
    const lists = new Set([1, 2, 3, 4, 5].map((seed) => variantsOf(createStage(seed, id)).join(',')));
    expect(lists.size).toBe(5);
  });

  it.each(STAGE_IDS)('%s:色ちがいを決めても、人の並びや名前を決める乱数は変わらない', (id: StageId) => {
    const s = createStage(777, id);
    const again = createStage(777, id);
    // 色ちがいを決め直しても(別の乱数なので)ほかの中身は同じ
    rollColorVariants(again);
    expect(withoutVariants(again)).toEqual(withoutVariants(s));
    expect(variantsOf(again)).toEqual(variantsOf(s));
  });

  it.each(STAGE_IDS)('%s:ワル、市民、ボスで、色ちがいの出方がかたよらない', (id: StageId) => {
    const count: Record<Truth, number[]> = { bad: [0, 0, 0, 0], civ: [0, 0, 0, 0], boss: [0, 0, 0, 0] };
    for (let seed = 0; seed < 600; seed++) {
      for (const w of createStage(seed, id).waves) for (const p of w.people) count[p.truth][p.colorVariant!]++;
    }
    for (const truth of ['bad', 'civ', 'boss'] as const) {
      const n = count[truth].reduce((a, b) => a + b, 0);
      // ボスは1回に1人なので数が少ない(600人)。ゆれの幅を広めにとる
      const tol = truth === 'boss' ? 0.07 : 0.03;
      for (const c of count[truth]) expect(Math.abs(c / n - 0.25), `${truth} ${count[truth]}`).toBeLessThan(tol);
    }
    // ワルと市民で、どの色ちがいの割合もほとんど同じ
    const nb = count.bad.reduce((a, b) => a + b, 0), nc = count.civ.reduce((a, b) => a + b, 0);
    for (let v = 0; v < COLOR_VARIANT_COUNT; v++) expect(Math.abs(count.bad[v] / nb - count.civ[v] / nc)).toBeLessThan(0.04);
  });

  it('同じ見た目の市民とワルの組(ステージ1、2)でも、見た目ごとにかたよらない', () => {
    for (const id of ['alley', 'garage'] as const) {
      const count = new Map<string, number[]>();
      for (let seed = 0; seed < 600; seed++) {
        for (const w of createStage(seed, id).waves) for (const p of w.people) {
          const k = `${p.look} ${p.truth}`;
          if (!count.has(k)) count.set(k, [0, 0, 0, 0]);
          count.get(k)![p.colorVariant!]++;
        }
      }
      for (const [k, c] of count) {
        const n = c.reduce((a, b) => a + b, 0);
        if (n < 400) continue;
        for (const x of c) expect(Math.abs(x / n - 0.25), `${id} ${k} ${c}`).toBeLessThan(0.07);
      }
    }
  });

  it('フリープレイ:市民は色ちがいがあり、一目で分かるワルはいつも0。同じ種なら同じ', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const a = createFreePlay(seed, ['alley', 'garage', 'mall']).stage;
      const b = createFreePlay(seed, ['alley', 'garage', 'mall']).stage;
      expect(variantsOf(a)).toEqual(variantsOf(b));
      for (const w of a.waves) for (const p of w.people) {
        if (p.look.startsWith('fp_')) expect(p.colorVariant).toBe(0);
        else seen.add(p.colorVariant!);
      }
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(colorVariantCount('fp_gang')).toBe(1);
    expect(colorVariantCount('hoodie')).toBe(COLOR_VARIANT_COUNT);
  });
});
