import { describe, expect, it } from 'vitest';
import { AGES, BOSS_HINTS, BOSS_PROFILE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES } from './content';
import {
  BOSS3_DISGUISES, MALL_LOOKS, buildRush, glitchCount, glitchShowing, rollGlitch, rushGlitchShowing, rushSpawnSec
} from './mall';
import { createRng } from './rng';
import { GLITCH, RUSH } from './rules';
import { createStage, findBoss } from './stage';
import { STAGES } from './stages';
import type { GlitchTiming, Person, Stage } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 3);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'mall'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "mall")', () => {
  it('同じ種なら同じステージ(ラッシュの並びも)。定義と名前はショッピングモール', () => {
    expect(createStage(55, 'mall')).toEqual(createStage(55, 'mall'));
    expect(createStage('abc', 'mall').rush).toEqual(createStage('abc', 'mall').rush);
    const s = stages[0];
    expect(s.id).toBe('mall');
    expect(s.def).toBe(STAGES.mall);
    expect(s.name).toBe('ショッピングモール');
  });

  it('ラッシュの並びは、ラッシュのあるステージだけ', () => {
    expect(createStage(1, 'mall').rush).not.toBeNull();
    expect(createStage(1, 'alley').rush).toBeNull();
    expect(createStage(1, 'garage').rush).toBeNull();
  });

  it('波の人数と時間がSTAGE3の表の通り(5人30秒、6人28秒、6人と親玉30秒)', () => {
    for (const s of stages) {
      expect(s.waves.map((w) => w.seconds)).toEqual([30, 28, 30]);
      expect(s.waves.map((w) => w.people.length)).toEqual([5, 6, 7]);
      expect(s.waves.map((w) => w.hasBoss)).toEqual([false, false, true]);
      expect(s.peopleTotal).toBe(18);
      expect(s.villainTotal).toBe(s.waves.reduce((n, w) => n + w.badCount, 0) + 1);
      for (const w of s.waves) expect(w.groups).toEqual([]);
    }
  });

  it('1つの波の宇宙人は2〜3人(どちらも出る)。宇宙人の見た目は波の中で重ならない。悪さは空への合図', () => {
    const counts = new Set<number>();
    for (const s of stages) {
      for (const w of s.waves) {
        const aliens = w.people.filter((p) => p.truth === 'bad');
        expect(aliens.length).toBe(w.badCount);
        expect(aliens.length).toBeGreaterThanOrEqual(2);
        expect(aliens.length).toBeLessThanOrEqual(3);
        counts.add(aliens.length);
        expect(new Set(aliens.map((a) => a.look)).size).toBe(aliens.length);
        for (const a of aliens) expect(a.mischief).toBe('signal');
      }
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });

  it('見た目は4種類。絵のキーは *_civ / *_bad、親玉は boss3_disguise_*', () => {
    const seen = new Set<string>();
    for (const s of stages) {
      for (const p of everyone(s)) {
        expect(MALL_LOOKS).toContain(p.look);
        seen.add(p.look);
        if (p.truth === 'boss') expect(p.sheetKey).toBe(`boss3_disguise_${p.disguise}`);
        else expect(p.sheetKey).toBe(`${p.look}_${p.truth}`);
      }
    }
    expect([...seen].sort()).toEqual([...MALL_LOOKS].sort());
  });

  it('宇宙人にだけくずれの時間がある(市民と親玉はくずれない)。初めては3〜6秒の0.5秒きざみ、そのあと3秒おきに0.2秒', () => {
    const firsts = new Set<number>();
    for (const s of stages) {
      for (const p of everyone(s)) {
        if (p.truth !== 'bad') {
          expect(p.glitch, p.id).toBeUndefined();
          continue;
        }
        const g = p.glitch!;
        expect(g, p.id).toBeDefined();
        if (g.practice) continue;
        expect(g.everySec).toBe(3);
        expect(g.showSec).toBe(0.2);
        expect(g.firstSec).toBeGreaterThanOrEqual(3);
        expect(g.firstSec).toBeLessThanOrEqual(6);
        expect((g.firstSec * 2) % 1).toBe(0);
        firsts.add(g.firstSec);
      }
    }
    expect([...firsts].sort((a, b) => a - b)).toEqual([3, 3.5, 4, 4.5, 5, 5.5, 6]);
  });

  it('波1に練習用の宇宙人が1人だけ(1.5秒で初めてくずれ、そのあと2秒おきに0.3秒)。波2と波3にはいない', () => {
    const at = new Set<number>();
    for (const s of stages) {
      const practice = (w: number) => s.waves[w].people.filter((p) => p.glitch?.practice);
      expect(practice(0)).toHaveLength(1);
      expect(practice(1)).toHaveLength(0);
      expect(practice(2)).toHaveLength(0);
      expect(practice(0)[0].glitch).toEqual({ firstSec: 1.5, everySec: 2, showSec: 0.3, practice: true });
      at.add(practice(0)[0].index);
    }
    // 練習用の宇宙人が何番目に出るかは決まっていない
    expect(at.size).toBeGreaterThanOrEqual(3);
  });

  it('宇宙人と同じ見た目の市民が、なるべく同じ波にいる(ぎこちない動きだけでは分からない)', () => {
    let aliens = 0;
    let paired = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        for (const a of w.people.filter((p) => p.truth === 'bad')) {
          aliens++;
          if (w.people.some((p) => p.truth === 'civ' && p.look === a.look)) paired++;
        }
      }
    }
    expect(paired / aliens).toBeGreaterThan(0.8);
  });

  it('親玉は波3に1人。化けた姿は店員、おじさん、着ぐるみの3つ(どれも出る)。同じ見た目の市民が波3にいる', () => {
    const seen = new Set<string>();
    for (const s of stages) {
      const boss = findBoss(s)!;
      expect(boss.wave).toBe(3);
      expect(BOSS3_DISGUISES).toContain(boss.disguise);
      expect(boss.look).toBe(boss.disguise);
      expect(boss.mischief).toBeUndefined();
      expect(BOSS_PROFILE_LINES[boss.disguise!]).toContain(boss.profile.line);
      expect(BOSS_HINTS[boss.disguise!]).toContainEqual(boss.hint);
      expect(s.waves[2].people.some((p) => p.truth === 'civ' && p.look === boss.look)).toBe(true);
      seen.add(boss.disguise!);
    }
    expect([...seen].sort()).toEqual(['clerk', 'mascot', 'uncle']);
  });

  it('名前、年齢、文、一言はその見た目と正体の一覧から。名前はステージの中で重ならない', () => {
    for (const s of stages.slice(0, 100)) {
      const names = everyone(s).map((p) => p.profile.name);
      expect(new Set(names).size).toBe(names.length);
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

  it('くずれを待たなくても、文か一言で決められる人が1つの波にだいたい2人以上いる', () => {
    // 文か一言が、同じ見た目の相手の一覧にないなら、それだけで決められる
    const telling = (p: Person): boolean => {
      if (p.truth === 'boss') return true;
      const other = p.truth === 'bad' ? 'civ' : 'bad';
      return !PROFILE_LINES[p.look][other]!.includes(p.profile.line)
        || !OPERATOR_HINTS[p.look][other]!.some((h) => h.text === p.hint.text);
    };
    let waves = 0;
    let enough = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        waves++;
        if (w.people.filter(telling).length >= 2) enough++;
      }
    }
    expect(enough / waves).toBeGreaterThan(0.9);
  });
});

describe('動きのくずれの時間', () => {
  const g: GlitchTiming = { firstSec: 4, everySec: 3, showSec: 0.2, practice: false };

  it('初めてくずれるまでは出ない。そのあとは everySec ごとに showSec の間だけ出る', () => {
    expect(glitchShowing(g, 0)).toBe(false);
    expect(glitchShowing(g, 3.99)).toBe(false);
    expect(glitchShowing(g, 4)).toBe(true);
    expect(glitchShowing(g, 4.19)).toBe(true);
    expect(glitchShowing(g, 4.21)).toBe(false);
    expect(glitchShowing(g, 6.9)).toBe(false);
    expect(glitchShowing(g, 7.05)).toBe(true);
    expect(glitchShowing(undefined, 5)).toBe(false);
  });

  it('何回くずれたか', () => {
    expect(glitchCount(g, 3)).toBe(0);
    expect(glitchCount(g, 4)).toBe(1);
    expect(glitchCount(g, 9.5)).toBe(2);
  });

  it('練習用は1.5秒で初めて出て、2秒おきに0.3秒', () => {
    const p = rollGlitch(createRng(1), true);
    expect(p).toEqual({ firstSec: GLITCH.practice.firstSec, everySec: 2, showSec: 0.3, practice: true });
    expect(glitchShowing(p, 1.4)).toBe(false);
    expect(glitchShowing(p, 1.7)).toBe(true);
    expect(glitchShowing(p, 1.85)).toBe(false);
    expect(glitchShowing(p, 3.6)).toBe(true);
  });

  it('全員のくずれを待つと、波2と波3は時間が足りない(1人あたり初めてのくずれとスワイプ1秒)。波1は間に合う', () => {
    // STAGE3「時間の見積もり」:平均4.5秒 + 1秒
    const waitAll = (people: number) => people * (4.5 + 1);
    const w = STAGES.mall.waves;
    expect(waitAll(w[0].people)).toBeLessThanOrEqual(w[0].seconds);
    expect(waitAll(w[1].people)).toBeGreaterThan(w[1].seconds);
    expect(waitAll(w[2].people + 1)).toBeGreaterThan(w[2].seconds);
  });
});

describe('タイムセールラッシュの並び', () => {
  const plans = SEEDS.map((s) => buildRush(createRng(s)));

  it('8人。宇宙人は3人か4人(半々くらい)。絵のキーは仕分けと同じ', () => {
    let three = 0;
    for (const r of plans) {
      expect(r.runners).toHaveLength(RUSH.people);
      const aliens = r.runners.filter((x) => x.truth === 'bad').length;
      expect(aliens).toBe(r.alienCount);
      expect(r.civCount).toBe(8 - r.alienCount);
      expect([3, 4]).toContain(aliens);
      if (aliens === 3) three++;
      for (const x of r.runners) {
        expect(MALL_LOOKS).toContain(x.look);
        expect(x.sheetKey).toBe(`${x.look}_${x.truth}`);
      }
      r.runners.forEach((x, i) => expect(x.index).toBe(i));
    }
    expect(three / plans.length).toBeGreaterThan(0.4);
    expect(three / plans.length).toBeLessThan(0.6);
  });

  it('最初の2人は市民1人と宇宙人1人。どちらが先かはランダム', () => {
    const firsts = new Set<string>();
    for (const r of plans) {
      const two = r.runners.slice(0, 2).map((x) => x.truth);
      expect([...two].sort()).toEqual(['bad', 'civ']);
      firsts.add(two[0]);
    }
    expect([...firsts].sort()).toEqual(['bad', 'civ']);
  });

  it('同じ見た目が続けて来ない', () => {
    for (const r of plans) {
      for (let i = 1; i < r.runners.length; i++) expect(r.runners[i].look).not.toBe(r.runners[i - 1].look);
    }
  });

  it('来る時刻:最初の2人のあとは2秒、そのあとは1.7秒。ゆっくりモードは1.5倍', () => {
    expect(plans[0].runners.map((x) => x.spawnSec)).toEqual([0, 2, 4, 5.7, 7.4, 9.1, 10.8, 12.5]);
    expect(rushSpawnSec(2, true)).toBe(6);
    expect(rushSpawnSec(7, true)).toBe(18.75);
    // 間隔は、マーク(約1秒)と急ブレーキのポーズを足した長さより長い(マークは一度に1人だけ)
    expect(RUSH.gapSec).toBeGreaterThan(RUSH.markSec + RUSH.brakeSec);
    // 殴る動き(拳が飛ぶ0.08秒、ヒットストップ0.08秒、構えを解くまで0.26秒)も急ブレーキより短い
    expect(0.08 + 0.08 + 0.26).toBeLessThan(RUSH.brakeSec);
  });

  it('全体の長さは8人で約16秒', () => {
    // 右の端の外(ヒーローの180ドット先)から、マークの出る48ドット手前まで走る時間
    const approach = (180 - RUSH.markDistance) / RUSH.runSpeed;
    const total = rushSpawnSec(RUSH.people - 1) + approach + RUSH.markSec + RUSH.settleSec;
    expect(total).toBeCloseTo(16.3, 5);
    expect(total).toBeGreaterThan(15.5);
    expect(total).toBeLessThan(16.5);
  });

  it('走る速さとマークの数字、ラッシュの宇宙人は0.3秒に1回くずれる', () => {
    expect(RUSH.runSpeed).toBe(60);
    expect(RUSH.markDistance).toBe(48);
    expect(RUSH.tapLockSec).toBe(0.3);
    expect(rushGlitchShowing(0)).toBe(true);
    expect(rushGlitchShowing(0.2)).toBe(false);
    expect(rushGlitchShowing(0.31)).toBe(true);
  });
});
