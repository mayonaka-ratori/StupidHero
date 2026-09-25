import { describe, expect, it } from 'vitest';
import { AGES, BOSS_HINTS, BOSS_PROFILE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import { hashSeed } from './rng';
import { createRng } from './rng';
import { DECOY_LOOKS, LIFT } from './rules';
import { createStage, findBoss, liftRushOf, saleRushOf } from './stage';
import { STAGES, TOWER_LOOKS, sheetKeyFor } from './stages';
import {
  BOSS4_DISGUISES, FLOOR_LOOKS, buildLift, canDecoy, leakSpots, liftFloor, liftTiming, rollLeak
} from './tower';
import type { LiftPlan, Person, Stage, StageId, TowerLook } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 5);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'tower'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "tower")', () => {
  it('同じ種なら同じステージ(ラッシュの並びも)。定義と名前は高層ビル', () => {
    expect(createStage(55, 'tower')).toEqual(createStage(55, 'tower'));
    const s = stages[0];
    expect(s.id).toBe('tower');
    expect(s.def).toBe(STAGES.tower);
    expect(s.name).toBe('高層ビル');
  });

  it('波は4つ。人数と時間がSTAGE4の表の通り(4人26秒、5人24秒、6人26秒、6人と親玉30秒)', () => {
    for (const s of stages) {
      expect(s.waves.map((w) => w.no)).toEqual([1, 2, 3, 4]);
      expect(s.waves.map((w) => w.seconds)).toEqual([26, 24, 26, 30]);
      expect(s.waves.map((w) => w.people.length)).toEqual([4, 5, 6, 7]);
      expect(s.waves.map((w) => w.hasBoss)).toEqual([false, false, false, true]);
      expect(s.peopleTotal).toBe(22);
      expect(s.villainTotal).toBe(s.waves.reduce((n, w) => n + w.badCount, 0) + 1);
      for (const w of s.waves) {
        expect(w.groups).toEqual([]);
        for (const p of w.people) expect(p.wave).toBe(w.no);
      }
    }
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
    for (const s of stages) {
      s.waves.forEach((w, i) => {
        for (const p of w.people) {
          if (p.truth !== 'boss') expect(FLOOR_LOOKS[i], `${p.id} ${p.look}`).toContain(p.look);
          seen[i].add(p.look);
        }
      });
      const top = s.waves[3].people.filter((p) => p.truth !== 'boss').map((p) => p.look);
      expect(top).toContain('lady');
      expect(top).toContain('magician');
    }
    expect(seen.map((x) => x.size)).toEqual([2, 4, 6, 8]);
  });

  it('ヴィランと同じ見た目の市民が、なるべく同じ波にいる', () => {
    let villains = 0;
    let paired = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        for (const v of w.people.filter((p) => p.truth === 'bad')) {
          villains++;
          if (w.people.some((p) => p.truth === 'civ' && p.look === v.look)) paired++;
        }
      }
    }
    expect(paired / villains).toBeGreaterThan(0.9);
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

  it('親玉は波4に1人。化けた姿はドレスの女性、手品師、ウェイターの3つ(どれも出る)。もれはなく、同じ見た目の市民が波4にいる', () => {
    const seen = new Set<string>();
    for (const s of stages) {
      const boss = findBoss(s)!;
      expect(boss.wave).toBe(4);
      expect(BOSS4_DISGUISES).toContain(boss.disguise);
      expect(boss.look).toBe(boss.disguise);
      expect(boss.leak).toBeUndefined();
      expect(boss.decoy).toBeUndefined();
      expect(boss.mischief).toBeUndefined();
      expect(boss.sheetKey).toBe(`tw_boss_${boss.disguise}`);
      expect(BOSS_PROFILE_LINES[boss.disguise!]).toContain(boss.profile.line);
      expect(BOSS_HINTS[boss.disguise!]).toContainEqual(boss.hint);
      const [lo, hi] = AGES[boss.look];
      expect(boss.profile.age).toBeGreaterThanOrEqual(lo);
      expect(boss.profile.age).toBeLessThanOrEqual(hi);
      expect(NAMES[boss.look]).toContain(boss.profile.name);
      expect(s.waves[3].people.some((p) => p.truth === 'civ' && p.look === boss.look)).toBe(true);
      seen.add(boss.disguise!);
    }
    expect([...seen].sort()).toEqual(['lady', 'magician', 'waiter']);
  });

  it('絵のキーは、市民もヴィランも同じ tw_<見た目>(正体を見ない)', () => {
    for (const s of stages.slice(0, 50)) {
      for (const p of everyone(s)) if (p.truth !== 'boss') expect(p.sheetKey).toBe(`tw_${p.look}`);
    }
    for (const look of TOWER_LOOKS) expect(sheetKeyFor(look, 'bad', 'tower')).toBe(sheetKeyFor(look, 'civ', 'tower'));
  });

  it('名前、年齢、文、一言はその見た目と正体の一覧から。名前はステージの中で重ならない', () => {
    for (const s of stages.slice(0, 200)) {
      const names = everyone(s).map((p) => p.profile.name);
      expect(new Set(names).size).toBe(names.length);
      const ids = everyone(s).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of everyone(s)) {
        expect(NAMES[p.look]).toContain(p.profile.name);
        const [lo, hi] = AGES[p.look];
        expect(p.profile.age).toBeGreaterThanOrEqual(lo);
        expect(p.profile.age).toBeLessThanOrEqual(hi);
        if (p.truth === 'boss') continue;
        expect(PROFILE_LINES[p.look][p.truth]).toContain(p.profile.line);
        expect(OPERATOR_HINTS[p.look][p.truth]).toContainEqual(p.hint);
      }
    }
  });
});

describe('エレベーターラッシュ', () => {
  const plans: LiftPlan[] = stages.map((s) => liftRushOf(s)!);

  it('高層ビルだけにある。タイムセールラッシュとは別の種類', () => {
    for (const p of plans) expect(p.kind).toBe('elevator');
    expect(saleRushOf(stages[0])).toBeNull();
    expect(liftRushOf(createStage(1, 'mall'))).toBeNull();
    expect(saleRushOf(createStage(1, 'mall'))).not.toBeNull();
    expect(createStage(1, 'alley').rush).toBeNull();
  });

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
    for (const p of plans) {
      p.riders.forEach((r, i) => {
        expect(r.index).toBe(i);
        expect(TOWER_LOOKS).toContain(r.look);
        expect(r.sheetKey).toBe(`tw_${r.look}`);
        looks.add(r.look);
        if (i > 0) {
          expect(r.look).not.toBe(p.riders[i - 1].look);
          expect(r.floor).toBeGreaterThan(p.riders[i - 1].floor);
        }
        expect(r.floor).toBeGreaterThan(LIFT.fromFloor);
        expect(r.floor).toBeLessThan(LIFT.toFloor);
      });
    }
    expect(looks.size).toBe(8);
    expect(liftFloor(0)).toBe(37);
  });

  it('同じ種なら同じ並び', () => {
    expect(buildLift(createRng(9))).toEqual(buildLift(createRng(9)));
  });

  it('1人ぶんの時間は約2.9秒で、6人で約17秒。ゆっくりモードでは乗ってくる時間とマークが1.5倍', () => {
    const t = liftTiming();
    expect(t.cycleSec).toBeCloseTo(2.9);
    expect(t.cycleSec * LIFT.people).toBeGreaterThan(16);
    expect(t.cycleSec * LIFT.people).toBeLessThan(18);
    const slow = liftTiming(true);
    expect(slow.stepInSec).toBeCloseTo(0.75);
    expect(slow.markSec).toBeCloseTo(1.5);
    expect(slow.doorSec).toBe(t.doorSec);
  });
});

describe('ステージ1〜3は高層ビルを足す前と同じ', () => {
  // 高層ビルを足す前の src/logic で作ったステージの中身(波とラッシュの並び)の指紋。
  // ラッシュの並びに足した kind: 'sale' は、比べるときに取りのぞく
  const BEFORE: Record<string, number> = {
    'alley:1': 2685216828, 'alley:2': 3493231757, 'alley:42': 3638732984, 'alley:777': 11974905, 'alley:abc': 826437894,
    'garage:1': 374104378, 'garage:2': 3777662317, 'garage:42': 2916663510, 'garage:777': 3075065602, 'garage:abc': 3502866635,
    'mall:1': 3620326527, 'mall:2': 1004497666, 'mall:42': 4232634613, 'mall:777': 2956719208, 'mall:abc': 3138895308
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
