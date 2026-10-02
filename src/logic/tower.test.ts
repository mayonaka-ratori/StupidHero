import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { LEAK, LIFT } from './rules';
import { createStage, liftRushOf } from './stage';
import { TOWER_LOOKS } from './stages';
import { FLOOR_LOOKS, canDecoy, isDoubtHint, isOddLine, leakSpots, rollLeak, spotHintsFor } from './tower';
import { TOWER_DOUBT_HINTS, TOWER_ODD_LINES, TOWER_OPERATOR_HINTS, TOWER_SPOT_HINTS } from './towerContent';
import type { LiftPlan, Person, Stage, TowerLook } from './types';

// 外れは配列に集めて最後に1回だけ確かめる(1人ずつ expect を呼ぶと遅い)

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 5);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'tower'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);
/** もれを隠すヴィラン(照明にも小物にも出ない) */
const isHidden = (p: Person): boolean => p.truth === 'bad' && !p.leak!.light && !p.leak!.item;

describe('createStage(seed, "tower")', () => {
  // id と名前、波の人数と時間、波ごとのヴィランの数と悪さ、ボスの共通の決まり、同じ見た目の市民の割合、
  // 親玉の名前と年齢は stage.test.ts でまとめて確かめる。同じ種なら同じステージになることは colorVariants.test.ts で確かめる

  it('出る見た目は階ごと(1階は2種類、18階は4種類、35階は6種類、最上階は8種類)。最上階にはドレスの女性と手品師がかならずいる', () => {
    const seen: Set<string>[] = [new Set(), new Set(), new Set(), new Set()];
    const bad: string[] = [];
    for (const s of stages) {
      s.waves.forEach((w, i) => {
        for (const p of w.people) {
          if (p.truth !== 'boss' && !FLOOR_LOOKS[i].includes(p.look as TowerLook)) bad.push(`${p.id} ${p.look}`);
          seen[i].add(p.look);
        }
      });
      const top = s.waves[3].people.filter((p) => p.truth !== 'boss').map((p) => p.look);
      if (!top.includes('lady') || !top.includes('magician')) bad.push(`seed ${s.seed} 最上階 ${top}`);
    }
    expect(bad).toEqual([]);
    expect(seen.map((x) => x.size)).toEqual([2, 4, 6, 8]);
  });

  it('ヴィランにだけもれがある。2か所とも出るか1か所だけ(だいたい半々)。市民と親玉にはない。波1には2か所とももれる練習用のヴィランがかならずいる', () => {
    let both = 0;
    let light = 0;
    let item = 0;
    const bad: string[] = [];
    for (const s of stages) {
      for (const p of everyone(s)) {
        if (p.truth !== 'bad') {
          if (p.leak !== undefined) bad.push(`${s.seed} ${p.id} ヴィランでないのにもれがある`);
          continue;
        }
        const l = p.leak!;
        if (isHidden(p)) continue;
        if (l.light && l.item) both++;
        else if (l.light) light++;
        else item++;
      }
      if (!s.waves[0].people.some((p) => p.truth === 'bad' && p.leak!.light && p.leak!.item)) bad.push(`${s.seed} 波1に練習用のヴィランがいない`);
    }
    expect(bad).toEqual([]);
    const total = both + light + item;
    // 練習用のヴィランが波1に1人ずついるぶん、2か所の方が少し多い
    expect(both / total).toBeGreaterThan(0.45);
    expect(both / total).toBeLessThan(0.65);
    expect(light).toBeGreaterThan(0);
    expect(item).toBeGreaterThan(0);
    expect(Math.abs(light - item) / (light + item)).toBeLessThan(0.15);
  });

  it('もれを隠すヴィランは、波3と波4に1人ずつ(親玉は数えない)。ほかにもれのあるヴィランが1人以上いる', () => {
    const bad: string[] = [];
    for (const s of stages) {
      s.waves.forEach((w, i) => {
        const at = `seed ${s.seed} 波${i + 1}`;
        const hidden = w.people.filter(isHidden).length;
        if (hidden !== LEAK.hiddenPerWave[i]) bad.push(`${at} 隠すヴィラン ${hidden}人`);
        // 波4は2人のうち1人、波3は2〜3人のうち1〜2人
        if (w.people.filter((p) => p.truth === 'bad').length - hidden < 1) bad.push(`${at} もれのあるヴィランがいない`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('もれを隠すヴィランは、プロフィールがふしぎに聞こえる文で、一言は疑う一言。市民はこの2つがそろわない(両方あやしい人だけがヴィラン)', () => {
    let civOdd = 0;
    let civDoubt = 0;
    const bad: string[] = [];
    for (const s of stages) {
      for (const p of everyone(s)) {
        if (p.truth === 'boss') continue;
        const look = p.look as TowerLook;
        const odd = isOddLine(look, p.profile.line);
        const doubt = isDoubtHint(look, p.hint);
        if (isHidden(p)) {
          if (!TOWER_ODD_LINES[look].bad.includes(p.profile.line)) bad.push(`${p.id} 文 ${p.profile.line}`);
          if (JSON.stringify(p.hint) !== JSON.stringify(TOWER_DOUBT_HINTS[look])) bad.push(`${p.id} 一言 ${p.hint.text}`);
        }
        if (p.truth === 'civ') {
          if (odd && doubt) bad.push(`${p.id} ${p.profile.line} ${p.hint.text}`);
          if (odd) civOdd++;
          if (doubt) civDoubt++;
        }
      }
    }
    expect(bad).toEqual([]);
    // 市民にも、ふしぎに聞こえる文と疑う一言が、それぞれ出る(片方だけでは決められない)
    expect(civOdd).toBeGreaterThan(100);
    expect(civDoubt).toBeGreaterThan(100);
  });

  it('あきれ顔の一言は、どれも市民にも出る(ヴィランにだけ出る一言はない)。疑う一言も市民に出る', () => {
    const seen = new Map<string, { civ: number; bad: number }>();
    for (const s of stages) {
      for (const p of everyone(s)) {
        if (p.truth === 'boss' || p.hint.face !== 'deadpan') continue;
        const c = seen.get(p.hint.text) ?? { civ: 0, bad: 0 };
        c[p.truth === 'bad' ? 'bad' : 'civ']++;
        seen.set(p.hint.text, c);
      }
    }
    const deadpan = new Set(TOWER_LOOKS.flatMap((l) => TOWER_OPERATOR_HINTS[l].bad.filter((h) => h.face === 'deadpan').map((h) => h.text)));
    for (const text of deadpan) {
      const c = seen.get(text);
      expect(c, text).toBeDefined();
      expect(c!.civ, text).toBeGreaterThan(0);
    }
    // 疑う一言を聞いた人のうち、市民の割合(1つだけで決まらないように、半分くらいが市民。2000の種で0.497だった)
    let civ = 0;
    let all = 0;
    for (const look of TOWER_LOOKS) {
      const c = seen.get(TOWER_DOUBT_HINTS[look].text)!;
      civ += c.civ;
      all += c.civ + c.bad;
    }
    expect(civ / all).toBeGreaterThan(0.4);
    expect(civ / all).toBeLessThan(0.6);
  });

  it('紛らわしい市民は、波1は0人、波2から1〜2人ずつ(どちらも出る)。1つの波で種類は重ならない。種類ごとに出せる見た目が決まっている(5種類とも出る)', () => {
    const kinds = new Set<string>();
    const counts = new Set<number>();
    const bad: string[] = [];
    for (const s of stages) {
      s.waves.forEach((w, i) => {
        const decoys = w.people.filter((p) => p.decoy).map((p) => p.decoy);
        const at = `seed ${s.seed} 波${i + 1}`;
        if (i === 0) {
          if (decoys.length > 0) bad.push(`${at} 波1に ${decoys}`);
        } else {
          if (decoys.length < 1 || decoys.length > 2) bad.push(`${at} ${decoys.length}人`);
          if (new Set(decoys).size !== decoys.length) bad.push(`${at} 種類が重なる ${decoys}`);
          counts.add(decoys.length);
        }
      });
      for (const p of everyone(s)) {
        if (!p.decoy) continue;
        if (p.truth !== 'civ') bad.push(`${p.id} ${p.truth} が紛らわしい`);
        if (!canDecoy(p.look as TowerLook, p.decoy)) bad.push(`${p.id} ${p.look} は ${p.decoy} にならない`);
        kinds.add(p.decoy);
      }
    }
    expect(bad).toEqual([]);
    expect([...kinds].sort()).toEqual(['balloon', 'cellophane', 'flicker', 'smoke', 'thread']);
    expect([...counts].sort()).toEqual([1, 2]);
  });

  it('照明と机の小物に出すもの(leakSpots)', () => {
    expect(leakSpots({ leak: { light: true, item: true } })).toEqual({ light: 'leak', item: 'leak' });
    expect(leakSpots({ leak: { light: true, item: false } })).toEqual({ light: 'leak', item: null });
    expect(leakSpots({ leak: { light: false, item: true } })).toEqual({ light: null, item: 'leak' });
    expect(leakSpots({ decoy: 'flicker' })).toEqual({ light: 'flicker', item: null });
    expect(leakSpots({ decoy: 'thread' })).toEqual({ light: null, item: 'thread' });
    expect(leakSpots({ decoy: 'balloon' })).toEqual({ light: null, item: 'balloon' });
    expect(leakSpots({ decoy: 'cellophane' })).toEqual({ light: 'cellophane', item: null });
    expect(leakSpots({ decoy: 'smoke' })).toEqual({ light: null, item: 'smoke' });
    expect(leakSpots({})).toEqual({ light: null, item: null });
    expect(rollLeak(createRng(1), true)).toEqual({ light: true, item: true });
  });

  it('見えている物のことを言う一言は、照明か小物に何か出ている人にだけ、本当に見えている物のことを言う。ヴィランと紛らわしい市民で同じくらい出る', () => {
    const spotTexts = new Set(Object.values(TOWER_SPOT_HINTS).flat().map((h) => h.text));
    const rate = { bad: [0, 0], decoy: [0, 0] };
    const bad: string[] = [];
    for (const s of stages) {
      for (const p of everyone(s)) {
        const has = spotTexts.has(p.hint.text);
        const allowed = spotHintsFor(leakSpots(p), p.wave).map((h) => h.text);
        if (allowed.length === 0) {
          if (has) bad.push(`${s.seed} ${p.id} 何も出ていないのに ${p.hint.text}`);
          continue;
        }
        if (has && !allowed.includes(p.hint.text)) bad.push(`${s.seed} ${p.id} 見えていない物 ${p.hint.text}`);
        const r = p.truth === 'bad' ? rate.bad : rate.decoy;
        r[1]++;
        if (has) r[0]++;
      }
    }
    expect(bad).toEqual([]);
    for (const [n, total] of Object.values(rate)) {
      expect(n / total).toBeGreaterThan(0.4);
      expect(n / total).toBeLessThan(0.6);
    }
    // 紫の照明はもれにもセロハンにも、浮いた小物はもれにも手品にも風船にも、同じ一言が出る
    expect(spotHintsFor({ light: 'leak', item: null })).toEqual(spotHintsFor({ light: 'cellophane', item: null }));
    expect(spotHintsFor({ light: null, item: 'leak' })).toEqual(spotHintsFor({ light: null, item: 'balloon' }));
    expect(spotHintsFor({ light: null, item: 'leak' })).toEqual(spotHintsFor({ light: null, item: 'smoke' }));
    expect(spotHintsFor({ light: null, item: null })).toEqual([]);
    // 「グラスが浮いてる!?」は、浮いている小物がグラスの階(波3と波4)だけ
    const glass = TOWER_SPOT_HINTS.glassFloat[0];
    for (const [wave, has] of [[1, false], [2, false], [3, true], [4, true]] as const) {
      expect(spotHintsFor({ light: null, item: 'thread' }, wave).includes(glass), `波${wave}`).toBe(has);
      expect(spotHintsFor({ light: 'leak', item: null }, wave).includes(glass), `波${wave}`).toBe(false);
    }
  });

  it('絵のキーは、市民もヴィランも同じ tw_<見た目>(正体を見ない)', () => {
    const wrong = stages.slice(0, 50).flatMap(everyone).filter((p) => p.truth !== 'boss' && p.sheetKey !== `tw_${p.look}`);
    expect(wrong.map((p) => `${p.id} ${p.truth} ${p.sheetKey}`)).toEqual([]);
  });
});

describe('エレベーターラッシュ', () => {
  const plans: LiftPlan[] = stages.map((s) => liftRushOf(s)!);

  it('6人、ヴィランは2人か3人(どちらも出る)。最初の2人は市民1人とヴィラン1人(どちらが先かも両方ある)。見た目は8種類から(どれも出る)、前の人と続けて同じにならない。絵のキーは仕分けと同じ。階は上がっていく', () => {
    const counts = new Set<number>();
    const firsts = new Set<string>();
    const looks = new Set<string>();
    const bad: string[] = [];
    plans.forEach((p, k) => {
      const v = p.riders.filter((r) => r.truth === 'bad').length;
      if (p.riders.length !== LIFT.people || v !== p.villainCount || p.civCount !== LIFT.people - v) bad.push(`${k}番目の並び ${p.riders.length}人 ヴィラン${v} ${p.villainCount} 市民${p.civCount}`);
      counts.add(v);
      const two = p.riders.slice(0, 2).map((r) => r.truth);
      if ([...two].sort().join() !== 'bad,civ') bad.push(`${k}番目の並びの最初の2人 ${two}`);
      firsts.add(two[0]);
      p.riders.forEach((r, i) => {
        const at = `${k}番目の並びの${i}人目`;
        if (r.index !== i) bad.push(`${at} index`);
        if (!TOWER_LOOKS.includes(r.look)) bad.push(`${at} 見た目 ${r.look}`);
        if (r.sheetKey !== `tw_${r.look}`) bad.push(`${at} 絵のキー ${r.sheetKey}`);
        looks.add(r.look);
        if (i > 0 && r.look === p.riders[i - 1].look) bad.push(`${at} 前と同じ見た目`);
        if (i > 0 && r.floor <= p.riders[i - 1].floor) bad.push(`${at} 階が上がらない`);
        if (r.floor <= LIFT.fromFloor || r.floor >= LIFT.toFloor) bad.push(`${at} 階 ${r.floor}`);
      });
    });
    expect(bad).toEqual([]);
    expect([...counts].sort()).toEqual([2, 3]);
    expect([...firsts].sort()).toEqual(['bad', 'civ']);
    expect(looks.size).toBe(8);
  });
});
