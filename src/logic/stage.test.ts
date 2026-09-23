import { describe, expect, it } from 'vitest';
import { sheetByKey } from '../art/sheets';
import { createStage, findBoss } from './stage';
import { STAGES } from './stages';
import type { Person, Stage } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
// ステージは最初に1回だけ作り、どのテストでも使い回す
const stages: Stage[] = SEEDS.map((s) => createStage(s));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage', () => {
  it('同じ種なら同じステージ', () => {
    expect(createStage(123)).toEqual(createStage(123));
    expect(createStage('abc')).toEqual(createStage('abc'));
  });

  it('波の人数と時間がSPECの表の通り', () => {
    for (const s of stages) {
      expect(s.waves.map((w) => w.no)).toEqual([1, 2, 3]);
      expect(s.waves.map((w) => w.seconds)).toEqual([20, 15, 18]);
      expect(s.waves.map((w) => w.people.length)).toEqual([5, 5, 6]);
      expect(s.peopleTotal).toBe(16);
      expect(s.name).toBe('路地裏');
    }
  });

  it('1つの波のワルは2〜3人(ボスは別)で、どちらも出る', () => {
    const counts = new Set<number>();
    for (const s of stages) {
      for (const w of s.waves) {
        const bad = w.people.filter((p) => p.truth === 'bad').length;
        expect(bad).toBe(w.badCount);
        expect(bad).toBeGreaterThanOrEqual(2);
        expect(bad).toBeLessThanOrEqual(3);
        counts.add(bad);
      }
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });

  it('モヒカンは波1にちょうど1人、ほかの波にはいない', () => {
    for (const s of stages) {
      const mohawks = s.waves.map((w) => w.people.filter((p) => p.look === 'mohawk').length);
      expect(mohawks).toEqual([1, 0, 0]);
      const m = s.waves[0].people.find((p) => p.look === 'mohawk')!;
      expect(m.truth).toBe('bad');
      expect(m.sheetKey).toBe('villain_mohawk');
    }
  });

  it('ボスは波3にちょうど1人。化けた姿は3種類から', () => {
    const disguises = new Set<string>();
    for (const s of stages) {
      const bosses = s.waves.map((w) => w.people.filter((p) => p.truth === 'boss').length);
      expect(bosses).toEqual([0, 0, 1]);
      expect(s.waves.map((w) => w.hasBoss)).toEqual([false, false, true]);
      const boss = findBoss(s)!;
      expect(['suit', 'granny', 'shopper']).toContain(boss.disguise);
      expect(boss.look).toBe(boss.disguise);
      expect(boss.sheetKey).toBe(`boss_disguise_${boss.disguise}`);
      disguises.add(boss.disguise!);
      expect(s.villainTotal).toBe(s.waves.reduce((n, w) => n + w.badCount, 0) + 1);
    }
    expect(disguises.size).toBe(3);
  });

  it('名前もプロフィールの文も一言も、同じものは2回出ない', () => {
    for (const s of stages) {
      const people = everyone(s);
      expect(new Set(people.map((p) => p.profile.name)).size).toBe(people.length);
      expect(new Set(people.map((p) => p.profile.line)).size).toBe(people.length);
      expect(new Set(people.map((p) => p.hint.text)).size).toBe(people.length);
      expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
    }
  });

  it('絵のキーは全部 sheets.ts にある。見た目と正体の組み合わせも正しい', () => {
    for (const s of stages.slice(0, 50)) {
      for (const p of everyone(s)) {
        expect(() => sheetByKey(p.sheetKey)).not.toThrow();
        if (p.look === 'granny' && p.truth !== 'boss') expect(p.truth).toBe('civ');
        if (p.truth === 'bad') expect(p.mischief).toBeDefined();
        else expect(p.mischief).toBeUndefined();
        expect(p.profile.age).toBeGreaterThan(0);
      }
    }
  });

  it('ワルと同じ見た目の市民がなるべく同じ波に出る。おばあさんはステージに必ずいる', () => {
    for (const s of stages) {
      for (const w of s.waves) {
        const pairBads = w.people.filter((p) => p.truth === 'bad' && p.look !== 'mohawk').map((p) => p.look);
        const civLooks = new Set(w.people.filter((p) => p.truth === 'civ').map((p) => p.look));
        if (pairBads.length > 0) expect(pairBads.some((l) => civLooks.has(l))).toBe(true);
      }
      const grannies = s.waves.flatMap((w) => w.people).filter((p) => p.look === 'granny' && p.truth === 'civ');
      expect(grannies.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('組の見た目は、ステージ全体で市民としてもワルとしてもほぼ出る', () => {
    let both = 0;
    let total = 0;
    for (const s of stages) {
      const people = everyone(s);
      for (const look of ['hoodie', 'suit', 'shopper'] as const) {
        total++;
        const civ = people.some((p) => p.look === look && p.truth === 'civ');
        const bad = people.some((p) => p.look === look && p.truth === 'bad');
        if (civ && bad) both++;
      }
    }
    expect(both / total).toBeGreaterThan(0.9);
  });
});

describe('路地裏は今まで通り(ステージ2を足したあと)', () => {
  it('stageId を省略すると路地裏。組も小物もつながりもない', () => {
    const s = createStage(123);
    expect(s.id).toBe('alley');
    expect(s.def).toBe(STAGES.alley);
    for (const w of s.waves) {
      expect(w.groups).toEqual([]);
      for (const p of w.people) {
        expect(p.group).toBeUndefined();
        expect(p.accessory).toBeUndefined();
        expect(p.link).toBeUndefined();
      }
    }
  });
});
