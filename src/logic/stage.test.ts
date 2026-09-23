import { describe, expect, it } from 'vitest';
import { sheetByKey } from '../art/sheets';
import { createStage, findBoss } from './stage';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);

describe('createStage', () => {
  it('同じ種なら同じステージ', () => {
    expect(createStage(123)).toEqual(createStage(123));
    expect(createStage('abc')).toEqual(createStage('abc'));
  });

  it('波の人数と時間がSPECの表の通り', () => {
    for (const seed of SEEDS) {
      const s = createStage(seed);
      expect(s.waves.map((w) => w.no)).toEqual([1, 2, 3]);
      expect(s.waves.map((w) => w.seconds)).toEqual([20, 15, 18]);
      expect(s.waves.map((w) => w.people.length)).toEqual([5, 5, 6]);
      expect(s.peopleTotal).toBe(16);
      expect(s.name).toBe('路地裏');
    }
  });

  it('1つの波のワルは2〜3人(ボスは別)で、どちらも出る', () => {
    const counts = new Set<number>();
    for (const seed of SEEDS) {
      for (const w of createStage(seed).waves) {
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
    for (const seed of SEEDS) {
      const s = createStage(seed);
      const mohawks = s.waves.map((w) => w.people.filter((p) => p.look === 'mohawk').length);
      expect(mohawks).toEqual([1, 0, 0]);
      const m = s.waves[0].people.find((p) => p.look === 'mohawk')!;
      expect(m.truth).toBe('bad');
      expect(m.sheetKey).toBe('villain_mohawk');
    }
  });

  it('ボスは波3にちょうど1人。化けた姿は3種類から', () => {
    const disguises = new Set<string>();
    for (const seed of SEEDS) {
      const s = createStage(seed);
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
    for (const seed of SEEDS) {
      const people = createStage(seed).waves.flatMap((w) => w.people);
      expect(new Set(people.map((p) => p.profile.name)).size).toBe(people.length);
      expect(new Set(people.map((p) => p.profile.line)).size).toBe(people.length);
      expect(new Set(people.map((p) => p.hint.text)).size).toBe(people.length);
      expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
    }
  });

  it('絵のキーは全部 sheets.ts にある。見た目と正体の組み合わせも正しい', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      for (const p of createStage(seed).waves.flatMap((w) => w.people)) {
        expect(() => sheetByKey(p.sheetKey)).not.toThrow();
        if (p.look === 'granny' && p.truth !== 'boss') expect(p.truth).toBe('civ');
        if (p.truth === 'bad') expect(p.mischief).toBeDefined();
        else expect(p.mischief).toBeUndefined();
        expect(p.profile.age).toBeGreaterThan(0);
      }
    }
  });

  it('ワルと同じ見た目の市民がなるべく同じ波に出る。おばあさんはステージに必ずいる', () => {
    for (const seed of SEEDS) {
      const s = createStage(seed);
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
    for (const seed of SEEDS) {
      const people = createStage(seed).waves.flatMap((w) => w.people);
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
