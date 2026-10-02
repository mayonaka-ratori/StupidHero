import { describe, expect, it } from 'vitest';
import { AGES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import { createStage, findBoss, liftRushOf, saleRushOf } from './stage';
import { STAGES } from './stages';
import { leakSpots, spotHintsFor } from './tower';
import type { Person, Stage, StageId } from './types';

// 外れは配列に集めて最後に1回だけ確かめる(1人ずつ expect を呼ぶと遅い)

/** count 個の種(ずらし方は、前にそれぞれのファイルで作っていたときと同じ) */
const seedsFrom = (offset: number, count: number): number[] => Array.from({ length: count }, (_, i) => i * 7919 + offset);
// ステージは最初に1回だけ作り、どのテストでも使い回す
const stages: Stage[] = seedsFrom(1, 400).map((s) => createStage(s));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage', () => {
  it('モヒカンは波1にちょうど1人、ほかの波にはいない', () => {
    const bad: string[] = [];
    for (const s of stages) {
      const mohawks = s.waves.map((w) => w.people.filter((p) => p.look === 'mohawk'));
      if (mohawks.map((m) => m.length).join() !== '1,0,0') bad.push(`seed ${s.seed} モヒカンの数`);
      const m = mohawks[0][0];
      if (m && (m.truth !== 'bad' || m.sheetKey !== 'villain_mohawk')) bad.push(`seed ${s.seed} ${m.id} ${m.truth} ${m.sheetKey}`);
    }
    expect(bad).toEqual([]);
  });

  it('名前もプロフィールの文も一言も、同じものは2回出ない', () => {
    const bad: string[] = [];
    for (const s of stages) {
      const people = everyone(s);
      if (new Set(people.map((p) => p.profile.name)).size !== people.length) bad.push(`seed ${s.seed} 名前が重なる`);
      if (new Set(people.map((p) => p.profile.line)).size !== people.length) bad.push(`seed ${s.seed} 文が重なる`);
      if (new Set(people.map((p) => p.hint.text)).size !== people.length) bad.push(`seed ${s.seed} 一言が重なる`);
    }
    expect(bad).toEqual([]);
  });

  it('ワルと同じ見た目の市民がなるべく同じ波に出る。おばあさんはステージに必ずいる', () => {
    const bad: string[] = [];
    for (const s of stages) {
      for (const w of s.waves) {
        const pairBads = w.people.filter((p) => p.truth === 'bad' && p.look !== 'mohawk').map((p) => p.look);
        const civLooks = new Set(w.people.filter((p) => p.truth === 'civ').map((p) => p.look));
        if (pairBads.length > 0 && !pairBads.some((l) => civLooks.has(l))) bad.push(`seed ${s.seed} 波${w.no} 同じ見た目の市民がいない`);
      }
      if (!everyone(s).some((p) => p.look === 'granny' && p.truth === 'civ')) bad.push(`seed ${s.seed} おばあさんがいない`);
    }
    expect(bad).toEqual([]);
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

const BY_ID: Readonly<Record<StageId, readonly Stage[]>> = {
  alley: stages,
  garage: seedsFrom(1, 200).map((s) => createStage(s, 'garage')),
  mall: seedsFrom(3, 200).map((s) => createStage(s, 'mall')),
  tower: seedsFrom(5, 200).map((s) => createStage(s, 'tower'))
};

describe('createStage:どのステージにも共通の決まり', () => {
  it('ラッシュの並びは、ラッシュのあるステージだけ(モールはタイムセール、高層ビルはエレベーター)', () => {
    const kinds = (['alley', 'garage', 'mall', 'tower'] as const).map((id) => {
      const s = createStage(1, id);
      return [id, s.rush?.kind ?? null, saleRushOf(s) !== null, liftRushOf(s) !== null];
    });
    expect(kinds).toEqual([
      ['alley', null, false, false], ['garage', null, false, false], ['mall', 'sale', true, false], ['tower', 'elevator', false, true]
    ]);
  });

  it.each(['alley', 'garage', 'mall', 'tower'] as const)('%s:波の人数と時間がステージの表(STAGES の waves)の通り。ボスは最後の波に1人ぶん足す', (id) => {
    const plans = STAGES[id].waves;
    const want = {
      no: plans.map((p) => p.no), seconds: plans.map((p) => p.seconds),
      people: plans.map((p) => p.people + (p.boss ? 1 : 0)), hasBoss: plans.map((_, i) => i === plans.length - 1),
      total: plans.reduce((n, p) => n + p.people + (p.boss ? 1 : 0), 0)
    };
    const bad: string[] = [];
    for (const s of BY_ID[id]) {
      const got = {
        no: s.waves.map((w) => w.no), seconds: s.waves.map((w) => w.seconds), people: s.waves.map((w) => w.people.length),
        hasBoss: s.waves.map((w) => w.hasBoss), total: s.peopleTotal
      };
      if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`seed ${s.seed} ${JSON.stringify(got)}`);
      for (const w of s.waves) {
        // 組があるのは地下駐車場だけ
        if (id !== 'garage' && w.groups.length > 0) bad.push(`seed ${s.seed} 波${w.no}に組がある`);
        for (const p of w.people) if (p.wave !== w.no) bad.push(`seed ${s.seed} ${p.id} の wave`);
      }
    }
    expect(bad).toEqual([]);
  });

  it.each([
    // pairedCiv:ボスと同じ見た目の市民が、かならず最後の波にいるステージ
    { id: 'alley', disguises: ['granny', 'shopper', 'suit'], pairedCiv: false },
    { id: 'garage', disguises: ['guard', 'mechanic', 'officelady'], pairedCiv: false },
    { id: 'mall', disguises: ['clerk', 'mascot', 'uncle'], pairedCiv: true },
    { id: 'tower', disguises: ['lady', 'magician', 'waiter'], pairedCiv: true }
  ] as const)('$id:ボスは最後の波にちょうど1人。化けた姿は $disguises(どれも出る)', ({ id, disguises, pairedCiv }) => {
    // ボスの文と一言はボスの一覧から選ぶ作り(people.ts の makePerson)。ワルの合計(villainTotal)は stage.ts の createStage が数える。
    // ボスの絵のキーは stages.test.ts と tells.test.ts で確かめる
    const seen = new Set<string>();
    const bad: string[] = [];
    for (const s of BY_ID[id]) {
      const last = s.waves.length;
      const counts = s.waves.map((w) => w.people.filter((p) => p.truth === 'boss').length);
      if (counts.join() !== s.waves.map((w) => (w.no === last ? 1 : 0)).join()) bad.push(`seed ${s.seed} ボスの数 ${counts}`);
      const boss = findBoss(s);
      if (!boss) continue;
      if (!(disguises as readonly string[]).includes(boss.disguise!)) bad.push(`seed ${s.seed} 化けた姿 ${boss.disguise}`);
      if (pairedCiv && !s.waves[last - 1].people.some((p) => p.truth === 'civ' && p.look === boss.look)) bad.push(`seed ${s.seed} 同じ見た目の市民がいない`);
      seen.add(boss.disguise!);
    }
    expect(bad).toEqual([]);
    expect([...seen].sort()).toEqual(disguises);
  });

  it.each([
    // 悪さ:路地裏は見た目ごとに違う(null。あることだけ確かめる)
    { id: 'alley', counts: [[2, 3], [2, 3], [2, 3]], mischief: null },
    { id: 'garage', counts: [[2], [2, 3, 4], [2, 3, 4]], mischief: 'whistle' },
    { id: 'mall', counts: [[2, 3], [2, 3], [2, 3]], mischief: 'signal' },
    { id: 'tower', counts: [[1, 2], [2, 3], [2, 3], [2]], mischief: 'psychic' }
  ] as const)('$id:波ごとのワルの数は $counts(ボスは別。どれも出る)。badCount と同じ。見た目は波の中で重ならない。悪さは $mischief', ({ id, counts, mischief }) => {
    const seen = counts.map(() => new Set<number>());
    const bad: string[] = [];
    for (const s of BY_ID[id]) {
      s.waves.forEach((w, i) => {
        const at = `seed ${s.seed} 波${w.no}`;
        const bads = w.people.filter((p) => p.truth === 'bad');
        seen[i].add(bads.length);
        if (bads.length !== w.badCount) bad.push(`${at} badCount`);
        if (new Set(bads.map((p) => p.look)).size !== bads.length) bad.push(`${at} 見た目が重なる`);
        for (const p of bads) if (mischief ? p.mischief !== mischief : p.mischief === undefined) bad.push(`${at} ${p.id} 悪さ ${p.mischief}`);
      });
    }
    expect(bad).toEqual([]);
    expect(seen.map((c) => [...c].sort())).toEqual(counts);
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
    { id: 'alley', count: 200 },
    { id: 'mall', count: 100 },
    { id: 'tower', count: 200 }
  ] as const)('$id:名前、年齢、文、一言はその見た目と正体の一覧から(高層ビルは、照明と小物に見えている物のことを言う一言もある)。名前はステージの中で重ならない(はじめの $count 個の種)', ({ id, count }) => {
    const bad: string[] = [];
    for (const s of BY_ID[id].slice(0, count)) {
      const people = everyone(s);
      if (new Set(people.map((p) => p.profile.name)).size !== people.length) bad.push(`seed ${s.seed} 名前が重なる`);
      for (const p of people) {
        const [lo, hi] = AGES[p.look];
        if (!NAMES[p.look].includes(p.profile.name)) bad.push(`${p.id} 名前 ${p.profile.name}`);
        if (p.profile.age < lo || p.profile.age > hi) bad.push(`${p.id} 年齢 ${p.profile.age}`);
        if (p.truth === 'boss') continue;
        if (!PROFILE_LINES[p.look][p.truth]!.includes(p.profile.line)) bad.push(`${p.id} 文 ${p.profile.line}`);
        const hints = [...OPERATOR_HINTS[p.look][p.truth]!, ...(id === 'tower' ? spotHintsFor(leakSpots(p), p.wave) : [])];
        if (!hints.some((h) => h.text === p.hint.text && h.face === p.hint.face)) bad.push(`${p.id} 一言 ${p.hint.text}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
