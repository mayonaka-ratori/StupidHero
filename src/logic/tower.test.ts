import { describe, expect, it } from 'vitest';
import { AGES, NAMES } from './content';
import { createRng, hashSeed } from './rng';
import { DECOY_LOOKS, LIFT } from './rules';
import { createStage, findBoss, liftRushOf, saleRushOf } from './stage';
import { TOWER_LOOKS, sheetKeyFor } from './stages';
import { FLOOR_LOOKS, buildLift, canDecoy, leakSpots, rollLeak, spotHintsFor } from './tower';
import { TOWER_SPOT_HINTS } from './towerContent';
import type { LiftPlan, Person, Stage, StageId, TowerLook } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 5);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'tower'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "tower")', () => {
  // id と名前、波の人数と時間、波ごとのヴィランの数と悪さ、ボスの共通の決まり、同じ見た目の市民の割合は stage.test.ts でまとめて確かめる

  it('同じ種なら同じステージ(ラッシュの並びも)', () => {
    expect(createStage(55, 'tower')).toEqual(createStage(55, 'tower'));
  });

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

  it('ヴィランにだけもれがある。2か所とも出るか1か所だけ(だいたい半々)。市民と親玉にはない', () => {
    let both = 0;
    let light = 0;
    let item = 0;
    for (const s of stages) {
      for (const p of everyone(s)) {
        if (p.truth !== 'bad') {
          expect(p.leak, p.id).toBeUndefined();
          continue;
        }
        const l = p.leak!;
        expect(l.light || l.item, p.id).toBe(true);
        if (l.light && l.item) both++;
        else if (l.light) light++;
        else item++;
      }
    }
    const total = both + light + item;
    // 練習用のヴィランが波1に1人ずついるぶん、2か所の方が少し多い
    expect(both / total).toBeGreaterThan(0.45);
    expect(both / total).toBeLessThan(0.65);
    expect(light).toBeGreaterThan(0);
    expect(item).toBeGreaterThan(0);
    expect(Math.abs(light - item) / (light + item)).toBeLessThan(0.15);
  });

  it('波1には2か所とももれる練習用のヴィランがかならずいる', () => {
    for (const s of stages) {
      const bad = s.waves[0].people.filter((p) => p.truth === 'bad');
      expect(bad.some((p) => p.leak!.light && p.leak!.item)).toBe(true);
    }
  });

  it('紛らわしい市民は、波1は0人、波2から1〜2人ずつ(どちらも出る)。1つの波で種類は重ならない。種類ごとに出せる見た目が決まっている(5種類とも出る)', () => {
    const kinds = new Set<string>();
    const counts = new Set<number>();
    for (const s of stages) {
      s.waves.forEach((w, i) => {
        const decoys = w.people.filter((p) => p.decoy).map((p) => p.decoy);
        const at = `seed ${s.seed} 波${i + 1}`;
        if (i === 0) expect(decoys, at).toEqual([]);
        else {
          expect(decoys.length >= 1 && decoys.length <= 2, at).toBe(true);
          expect(new Set(decoys).size, at).toBe(decoys.length);
          counts.add(decoys.length);
        }
      });
      for (const p of everyone(s)) {
        if (!p.decoy) continue;
        expect(p.truth, p.id).toBe('civ');
        expect(canDecoy(p.look as TowerLook, p.decoy), `${p.look} ${p.decoy}`).toBe(true);
        kinds.add(p.decoy);
      }
    }
    expect([...kinds].sort()).toEqual(['balloon', 'cellophane', 'flicker', 'smoke', 'thread']);
    expect([...counts].sort()).toEqual([1, 2]);
    expect(DECOY_LOOKS.thread).toEqual(['magician']);
    expect(DECOY_LOOKS.smoke).toEqual(['magician']);
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
    for (const s of stages) {
      for (const p of everyone(s)) {
        const has = spotTexts.has(p.hint.text);
        const allowed = spotHintsFor(leakSpots(p)).map((h) => h.text);
        if (allowed.length === 0) { expect(has, p.id).toBe(false); continue; }
        if (has) expect(allowed, p.id).toContain(p.hint.text);
        const r = p.truth === 'bad' ? rate.bad : rate.decoy;
        r[1]++;
        if (has) r[0]++;
      }
    }
    for (const [n, total] of Object.values(rate)) {
      expect(n / total).toBeGreaterThan(0.4);
      expect(n / total).toBeLessThan(0.6);
    }
    // 紫の照明はもれにもセロハンにも、浮いた小物はもれにも手品にも風船にも、同じ一言が出る
    expect(spotHintsFor({ light: 'leak', item: null })).toEqual(spotHintsFor({ light: 'cellophane', item: null }));
    expect(spotHintsFor({ light: null, item: 'leak' })).toEqual(spotHintsFor({ light: null, item: 'balloon' }));
    expect(spotHintsFor({ light: null, item: 'leak' })).toEqual(spotHintsFor({ light: null, item: 'smoke' }));
    expect(spotHintsFor({ light: null, item: null })).toEqual([]);
  });

  it('親玉にはもれも紛らわしさもない。年齢と名前は化けた姿の幅と一覧から', () => {
    for (const s of stages) {
      const boss = findBoss(s)!;
      expect(boss.leak).toBeUndefined();
      expect(boss.decoy).toBeUndefined();
      const [lo, hi] = AGES[boss.look];
      expect(boss.profile.age).toBeGreaterThanOrEqual(lo);
      expect(boss.profile.age).toBeLessThanOrEqual(hi);
      expect(NAMES[boss.look]).toContain(boss.profile.name);
    }
  });

  it('絵のキーは、市民もヴィランも同じ tw_<見た目>(正体を見ない)', () => {
    for (const s of stages.slice(0, 50)) {
      for (const p of everyone(s)) if (p.truth !== 'boss') expect(p.sheetKey).toBe(`tw_${p.look}`);
    }
    for (const look of TOWER_LOOKS) expect(sheetKeyFor(look, 'bad', 'tower')).toBe(sheetKeyFor(look, 'civ', 'tower'));
  });
});

describe('エレベーターラッシュ', () => {
  const plans: LiftPlan[] = stages.map((s) => liftRushOf(s)!);

  it('6人、ヴィランは2人か3人(どちらも出る)。最初の2人は市民1人とヴィラン1人(どちらが先かも両方ある)', () => {
    const counts = new Set<number>();
    const firsts = new Set<string>();
    for (const p of plans) {
      expect(p.riders).toHaveLength(LIFT.people);
      const v = p.riders.filter((r) => r.truth === 'bad').length;
      expect(v).toBe(p.villainCount);
      expect(p.civCount).toBe(LIFT.people - v);
      counts.add(v);
      expect(p.riders.slice(0, 2).map((r) => r.truth).sort()).toEqual(['bad', 'civ']);
      firsts.add(p.riders[0].truth);
    }
    expect([...counts].sort()).toEqual([2, 3]);
    expect([...firsts].sort()).toEqual(['bad', 'civ']);
  });

  it('見た目は8種類から(どれも出る)、前の人と続けて同じにならない。絵のキーは仕分けと同じ。階は上がっていく', () => {
    const looks = new Set<string>();
    const bad: string[] = [];
    plans.forEach((p, k) => {
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
    expect(looks.size).toBe(8);
  });

  it('同じ種なら同じ並び', () => {
    expect(buildLift(createRng(9))).toEqual(buildLift(createRng(9)));
  });
});

describe('ステージ1〜3は高層ビルを足す前と同じ', () => {
  // 高層ビルを足す前の src/logic で作ったステージの中身(波とラッシュの並び)の指紋。
  // ラッシュの並びに足した kind: 'sale' は、比べるときに取りのぞく。
  // mall の1と42は、プロフィールの文(休けい)を直したので値を新しくした。人の並びは変わっていない
  const BEFORE: Record<string, number> = {
    'alley:1': 2685216828, 'alley:2': 3493231757, 'alley:42': 3638732984, 'alley:777': 11974905, 'alley:abc': 826437894,
    'garage:1': 374104378, 'garage:2': 3777662317, 'garage:42': 2916663510, 'garage:777': 3075065602, 'garage:abc': 3502866635,
    'mall:1': 2670062653, 'mall:2': 1004497666, 'mall:42': 2065314688, 'mall:777': 2956719208, 'mall:abc': 3138895308
  };

  it('同じ種なら、人の並び、名前、文、ラッシュの並びが変わらない', () => {
    for (const key of Object.keys(BEFORE)) {
      const [id, raw] = key.split(':');
      const seed = /^\d+$/.test(raw) ? Number(raw) : raw;
      const s = createStage(seed, id as StageId);
      const sale = saleRushOf(s);
      const rush = sale ? (({ kind: _kind, ...rest }) => rest)(sale) : s.rush;
      // あとから足した服の色ちがい(colorVariant)は別の乱数で決めるので、ここでは取りのぞいて比べる
      const noVariant = (k: string, v: unknown): unknown => (k === 'colorVariant' ? undefined : v);
      expect(hashSeed(JSON.stringify({ waves: s.waves, rush, seed: s.seed }, noVariant)), key).toBe(BEFORE[key]);
    }
  });
});
