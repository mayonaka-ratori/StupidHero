import { describe, expect, it } from 'vitest';
import { sheetByKey } from '../art/sheets';
import { AGES, BOSS_HINTS, BOSS_PROFILE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import { createStage, findBoss, liftRushOf, saleRushOf } from './stage';
import { STAGES } from './stages';
import type { Person, Stage, StageId } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
// ステージは最初に1回だけ作り、どのテストでも使い回す
const stages: Stage[] = SEEDS.map((s) => createStage(s));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage', () => {
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

// ─── どのステージにも共通の決まり ───
// ステージごとにコピーしていた createStage の確かめを、ここに集めた。
// そのステージだけの決まりは garage.test.ts、mall.test.ts、tower.test.ts に残してある。

/** 400個の種(ずらし方は、前にそれぞれのファイルで作っていたときと同じ) */
const seedsFrom = (offset: number): number[] => Array.from({ length: 400 }, (_, i) => i * 7919 + offset);
const BY_ID: Readonly<Record<StageId, readonly Stage[]>> = {
  alley: stages,
  garage: seedsFrom(1).map((s) => createStage(s, 'garage')),
  mall: seedsFrom(3).map((s) => createStage(s, 'mall')),
  tower: seedsFrom(5).map((s) => createStage(s, 'tower'))
};

describe('createStage:どのステージにも共通の決まり', () => {
  it.each([
    { id: 'garage', name: '地下駐車場' },
    { id: 'mall', name: 'ショッピングモール' },
    { id: 'tower', name: '高層ビル' }
  ] as const)('$id:id と定義と名前($name)', ({ id, name }) => {
    const s = BY_ID[id][0];
    expect(s.id).toBe(id);
    expect(s.def).toBe(STAGES[id]);
    expect(s.name).toBe(name);
  });

  it.each([
    { id: 'alley', kind: null },
    { id: 'garage', kind: null },
    { id: 'mall', kind: 'sale' },
    { id: 'tower', kind: 'elevator' }
  ] as const)('$id:ラッシュの並びは、ラッシュのあるステージだけ($kind)', ({ id, kind }) => {
    const s = createStage(1, id);
    expect(s.rush?.kind ?? null).toBe(kind);
    expect(saleRushOf(s) !== null).toBe(kind === 'sale');
    expect(liftRushOf(s) !== null).toBe(kind === 'elevator');
  });

  it.each([
    { id: 'garage', seconds: [30, 26, 28], people: [5, 6, 7], total: 18, noGroups: false },
    { id: 'mall', seconds: [30, 28, 30], people: [5, 6, 7], total: 18, noGroups: true },
    { id: 'tower', seconds: [26, 24, 26, 30], people: [4, 5, 6, 7], total: 22, noGroups: true }
  ] as const)('$id:波の人数と時間が表の通り(人数 $people、秒 $seconds、ボスは最後の波)', ({ id, seconds, people, total, noGroups }) => {
    const n = seconds.length;
    const bad: string[] = [];
    for (const s of BY_ID[id]) {
      const got = {
        no: s.waves.map((w) => w.no), seconds: s.waves.map((w) => w.seconds), people: s.waves.map((w) => w.people.length),
        hasBoss: s.waves.map((w) => w.hasBoss), total: s.peopleTotal
      };
      const want = {
        no: Array.from({ length: n }, (_, i) => i + 1), seconds, people,
        hasBoss: Array.from({ length: n }, (_, i) => i === n - 1), total
      };
      if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`seed ${s.seed} ${JSON.stringify(got)}`);
      for (const w of s.waves) {
        if (noGroups && w.groups.length > 0) bad.push(`seed ${s.seed} 波${w.no}に組がある`);
        for (const p of w.people) if (p.wave !== w.no) bad.push(`seed ${s.seed} ${p.id} の wave`);
      }
    }
    expect(bad).toEqual([]);
  });

  it.each([
    // pairedCiv:ボスと同じ見た目の市民が、かならず最後の波にいるステージ
    { id: 'alley', disguises: ['granny', 'shopper', 'suit'], sheet: 'boss_disguise_', pairedCiv: false },
    { id: 'garage', disguises: ['guard', 'mechanic', 'officelady'], sheet: 'boss2_disguise_', pairedCiv: false },
    { id: 'mall', disguises: ['clerk', 'mascot', 'uncle'], sheet: 'boss3_disguise_', pairedCiv: true },
    { id: 'tower', disguises: ['lady', 'magician', 'waiter'], sheet: 'tw_boss_', pairedCiv: true }
  ] as const)('$id:ボスは最後の波にちょうど1人。化けた姿は $disguises(どれも出る)。絵のキーと、ワルの合計(ボスを入れる)', ({ id, disguises, sheet, pairedCiv }) => {
    const seen = new Set<string>();
    for (const s of BY_ID[id]) {
      const last = s.waves.length;
      expect(s.waves.map((w) => w.people.filter((p) => p.truth === 'boss').length)).toEqual(s.waves.map((w) => (w.no === last ? 1 : 0)));
      const boss = findBoss(s)!;
      expect(boss.wave).toBe(last);
      expect(disguises).toContain(boss.disguise);
      expect(boss.look).toBe(boss.disguise);
      expect(boss.sheetKey).toBe(`${sheet}${boss.disguise}`);
      expect(boss.mischief).toBeUndefined();
      // 文と一言は、その化けた姿のボスの一覧から
      expect(BOSS_PROFILE_LINES[boss.disguise!]).toContain(boss.profile.line);
      expect(BOSS_HINTS[boss.disguise!]).toContainEqual(boss.hint);
      expect(s.villainTotal).toBe(s.waves.reduce((n, w) => n + w.badCount, 0) + 1);
      if (pairedCiv) expect(s.waves[last - 1].people.some((p) => p.truth === 'civ' && p.look === boss.look)).toBe(true);
      seen.add(boss.disguise!);
    }
    expect([...seen].sort()).toEqual(disguises);
  });

  it.each([
    { id: 'garage', ratio: 0.6 },
    { id: 'mall', ratio: 0.8 },
    { id: 'tower', ratio: 0.9 }
  ] as const)('$id:ワルと同じ見た目の市民が、なるべく同じ波にいる(ワルの $ratio より多く)', ({ id, ratio }) => {
    let bads = 0;
    let paired = 0;
    for (const s of BY_ID[id]) {
      for (const w of s.waves) {
        for (const b of w.people.filter((p) => p.truth === 'bad')) {
          bads++;
          if (w.people.some((p) => p.truth === 'civ' && p.look === b.look)) paired++;
        }
      }
    }
    expect(paired / bads).toBeGreaterThan(ratio);
  });

  it.each([
    { id: 'mall', count: 100 },
    { id: 'tower', count: 200 }
  ] as const)('$id:名前、年齢、文、一言はその見た目と正体の一覧から。名前と id はステージの中で重ならない(はじめの $count 個の種)', ({ id, count }) => {
    const bad: string[] = [];
    for (const s of BY_ID[id].slice(0, count)) {
      const people = everyone(s);
      if (new Set(people.map((p) => p.profile.name)).size !== people.length) bad.push(`seed ${s.seed} 名前が重なる`);
      if (new Set(people.map((p) => p.id)).size !== people.length) bad.push(`seed ${s.seed} id が重なる`);
      for (const p of people) {
        const [lo, hi] = AGES[p.look];
        if (!NAMES[p.look].includes(p.profile.name)) bad.push(`${p.id} 名前 ${p.profile.name}`);
        if (p.profile.age < lo || p.profile.age > hi) bad.push(`${p.id} 年齢 ${p.profile.age}`);
        if (p.truth === 'boss') continue;
        if (!PROFILE_LINES[p.look][p.truth]!.includes(p.profile.line)) bad.push(`${p.id} 文 ${p.profile.line}`);
        if (!OPERATOR_HINTS[p.look][p.truth]!.some((h) => h.text === p.hint.text && h.face === p.hint.face)) bad.push(`${p.id} 一言 ${p.hint.text}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
