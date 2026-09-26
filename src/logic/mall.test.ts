import { describe, expect, it } from 'vitest';
import { OPERATOR_HINTS, PROFILE_LINES } from './content';
import {
  BOSS3_DISGUISES, MALL_LOOKS, buildRush, glitchCount, glitchShowing, rollGlitch, rushGlitchShowing, rushSpawnSec
} from './mall';
import { createRng } from './rng';
import { GLITCH, RUSH } from './rules';
import { createStage } from './stage';
import { STAGES } from './stages';
import type { GlitchTiming, MallLook, Person, Stage } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 3);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'mall'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "mall")', () => {
  // id と名前、波の人数と時間、ボスの共通の決まり、同じ見た目の市民の割合は stage.test.ts でまとめて確かめる

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
    const bad: string[] = [];
    for (const s of stages) {
      for (const p of everyone(s)) {
        if (!MALL_LOOKS.includes(p.look as MallLook)) bad.push(`${s.seed} ${p.id} 見た目 ${p.look}`);
        seen.add(p.look);
        const key = p.truth === 'boss' ? `boss3_disguise_${p.disguise}` : `${p.look}_${p.truth}`;
        if (p.sheetKey !== key) bad.push(`${s.seed} ${p.id} 絵のキー ${p.sheetKey}`);
      }
    }
    expect(bad).toEqual([]);
    expect([...seen].sort()).toEqual([...MALL_LOOKS].sort());
    // 親玉の化けた姿の一覧(親玉がどれに化けるかは stage.test.ts で確かめる)
    expect([...BOSS3_DISGUISES].sort()).toEqual(['clerk', 'mascot', 'uncle']);
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
    const bad: string[] = [];
    plans.forEach((r, k) => {
      expect(r.runners).toHaveLength(RUSH.people);
      const aliens = r.runners.filter((x) => x.truth === 'bad').length;
      expect(aliens).toBe(r.alienCount);
      expect(r.civCount).toBe(8 - r.alienCount);
      expect([3, 4]).toContain(aliens);
      if (aliens === 3) three++;
      r.runners.forEach((x, i) => {
        if (!MALL_LOOKS.includes(x.look)) bad.push(`${k}番目の並びの${i}人目 見た目 ${x.look}`);
        if (x.sheetKey !== `${x.look}_${x.truth}`) bad.push(`${k}番目の並びの${i}人目 絵のキー ${x.sheetKey}`);
        if (x.index !== i) bad.push(`${k}番目の並びの${i}人目 index`);
      });
    });
    expect(bad).toEqual([]);
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
