import { describe, expect, it } from 'vitest';
import { AGES, NAMES } from './content';
import { hashSeed } from './rng';
import { createRng } from './rng';
import { DECOY_LOOKS, LIFT } from './rules';
import { createStage, findBoss, liftRushOf, saleRushOf } from './stage';
import { TOWER_LOOKS, sheetKeyFor } from './stages';
import {
  BOSS4_DISGUISES, FLOOR_LOOKS, buildLift, canDecoy, leakSpots, rollLeak
} from './tower';
import type { LiftPlan, Person, Stage, StageId, TowerLook } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 5);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'tower'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "tower")', () => {
  // id と名前、波の人数と時間、ボスの共通の決まり、同じ見た目の市民の割合は stage.test.ts でまとめて確かめる

  it('同じ種なら同じステージ(ラッシュの並びも)', () => {
    expect(createStage(55, 'tower')).toEqual(createStage(55, 'tower'));
  });

  it('ヴィランの数は、波1が1〜2人、波2と3が2〜3人、波4が2人(どれも出る)。見た目は波の中で重ならない。悪さは念力', () => {
    const counts: Set<number>[] = [new Set(), new Set(), new Set(), new Set()];
    for (const s of stages) {
      s.waves.forEach((w, i) => {
        const bad = w.people.filter((p) => p.truth === 'bad');
        expect(bad.length).toBe(w.badCount);
        counts[i].add(bad.length);
        expect(new Set(bad.map((p) => p.look)).size).toBe(bad.length);
        for (const p of bad) expect(p.mischief).toBe('psychic');
      });
    }
    expect(counts.map((c) => [...c].sort())).toEqual([[1, 2], [2, 3], [2, 3], [2]]);
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

  it('紛らわしい市民は、波1は0人、波2から1人ずつ。種類ごとに出せる見た目が決まっている(3種類とも出る)', () => {
    const kinds = new Set<string>();
    for (const s of stages) {
      expect(s.waves.map((w) => w.people.filter((p) => p.decoy).length)).toEqual([0, 1, 1, 1]);
      for (const p of everyone(s)) {
        if (!p.decoy) continue;
        expect(p.truth, p.id).toBe('civ');
        expect(canDecoy(p.look as TowerLook, p.decoy), `${p.look} ${p.decoy}`).toBe(true);
        kinds.add(p.decoy);
      }
    }
    expect([...kinds].sort()).toEqual(['balloon', 'flicker', 'thread']);
    expect(DECOY_LOOKS.thread).toEqual(['magician']);
  });

  it('照明と机の小物に出すもの(leakSpots)', () => {
    expect(leakSpots({ leak: { light: true, item: true } })).toEqual({ light: 'leak', item: 'leak' });
    expect(leakSpots({ leak: { light: true, item: false } })).toEqual({ light: 'leak', item: null });
    expect(leakSpots({ leak: { light: false, item: true } })).toEqual({ light: null, item: 'leak' });
    expect(leakSpots({ decoy: 'flicker' })).toEqual({ light: 'flicker', item: null });
    expect(leakSpots({ decoy: 'thread' })).toEqual({ light: null, item: 'thread' });
    expect(leakSpots({ decoy: 'balloon' })).toEqual({ light: null, item: 'balloon' });
    expect(leakSpots({})).toEqual({ light: null, item: null });
    expect(rollLeak(createRng(1), true)).toEqual({ light: true, item: true });
  });

  it('親玉にはもれも紛らわしさもない。化けた姿の一覧は BOSS4_DISGUISES。年齢と名前は化けた姿の幅と一覧から', () => {
    expect([...BOSS4_DISGUISES].sort()).toEqual(['lady', 'magician', 'waiter']);
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
      expect(hashSeed(JSON.stringify({ waves: s.waves, rush, seed: s.seed })), key).toBe(BEFORE[key]);
    }
  });
});
