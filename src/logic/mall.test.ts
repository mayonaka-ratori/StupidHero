import { describe, expect, it } from 'vitest';
import { OPERATOR_HINTS, PROFILE_LINES } from './content';
import { buildRush, glitchCount, glitchShowing, rushGlitchShowing, rushSpawnSec } from './mall';
import { createRng } from './rng';
import { RUSH } from './rules';
import { createStage } from './stage';
import { MALL_LOOKS, STAGES } from './stages';
import type { GlitchTiming, MallLook, Person, Stage } from './types';

// 外れは配列に集めて最後に1回だけ確かめる(1人ずつ expect を呼ぶと遅い)

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 3);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'mall'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "mall")', () => {
  // id と名前、波の人数と時間、波ごとの宇宙人の数と悪さ、ボスの共通の決まり、同じ見た目の市民の割合は stage.test.ts でまとめて確かめる
  // 絵のキーとくずれの出し分け(tell)は tells.test.ts と stages.test.ts で確かめる

  it('見た目は4種類', () => {
    const looks = new Set(stages.flatMap(everyone).map((p) => p.look));
    expect([...looks].sort()).toEqual([...MALL_LOOKS].sort());
  });

  it('宇宙人にだけくずれの時間がある(市民と親玉はくずれない)。初めては3〜6秒の0.5秒きざみ、そのあと3秒おきに0.2秒。波1にだけ練習用の宇宙人が1人(1.5秒で初めてくずれ、そのあと2秒おきに0.3秒)', () => {
    const firsts = new Set<number>();
    const practiceAt = new Set<number>();
    const bad: string[] = [];
    for (const s of stages) {
      for (const w of s.waves) {
        const practice = w.people.filter((p) => p.glitch?.practice);
        if (practice.length !== (w.no === 1 ? 1 : 0)) bad.push(`${s.seed} 波${w.no} 練習用が ${practice.length}人`);
        for (const p of practice) {
          practiceAt.add(p.index);
          if (JSON.stringify(p.glitch) !== JSON.stringify({ firstSec: 1.5, everySec: 2, showSec: 0.3, practice: true })) bad.push(`${p.id} 練習用 ${JSON.stringify(p.glitch)}`);
        }
        for (const p of w.people) {
          const g = p.glitch;
          if (p.truth !== 'bad') {
            if (g) bad.push(`${s.seed} ${p.id} 宇宙人でないのにくずれる`);
            continue;
          }
          if (!g) { bad.push(`${s.seed} ${p.id} くずれがない`); continue; }
          if (g.practice) continue;
          if (g.everySec !== 3 || g.showSec !== 0.2 || g.firstSec < 3 || g.firstSec > 6 || (g.firstSec * 2) % 1 !== 0) bad.push(`${s.seed} ${p.id} ${JSON.stringify(g)}`);
          firsts.add(g.firstSec);
        }
      }
    }
    expect(bad).toEqual([]);
    expect([...firsts].sort((a, b) => a - b)).toEqual([3, 3.5, 4, 4.5, 5, 5.5, 6]);
    // 練習用の宇宙人が何番目に出るかは決まっていない
    expect(practiceAt.size).toBeGreaterThanOrEqual(3);
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

  it('初めてくずれるまでは出ない。そのあとは everySec ごとに showSec の間だけ出る。ラッシュの宇宙人は0.3秒に1回くずれる', () => {
    expect(glitchShowing(g, 0)).toBe(false);
    expect(glitchShowing(g, 3.99)).toBe(false);
    expect(glitchShowing(g, 4)).toBe(true);
    expect(glitchShowing(g, 4.19)).toBe(true);
    expect(glitchShowing(g, 4.21)).toBe(false);
    expect(glitchShowing(g, 6.9)).toBe(false);
    expect(glitchShowing(g, 7.05)).toBe(true);
    expect(glitchShowing(undefined, 5)).toBe(false);
    expect(rushGlitchShowing(0)).toBe(true);
    expect(rushGlitchShowing(0.2)).toBe(false);
    expect(rushGlitchShowing(0.31)).toBe(true);
  });

  it('何回くずれたか', () => {
    expect(glitchCount(g, 3)).toBe(0);
    expect(glitchCount(g, 4)).toBe(1);
    expect(glitchCount(g, 9.5)).toBe(2);
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

  it('8人。宇宙人は3人か4人(半々くらい)。最初の2人は市民1人と宇宙人1人(どちらが先かはランダム)。同じ見た目が続けて来ない。絵のキーは仕分けと同じ', () => {
    let three = 0;
    const firsts = new Set<string>();
    const bad: string[] = [];
    plans.forEach((r, k) => {
      const aliens = r.runners.filter((x) => x.truth === 'bad').length;
      if (r.runners.length !== RUSH.people || aliens !== r.alienCount || r.civCount !== 8 - aliens || (aliens !== 3 && aliens !== 4)) {
        bad.push(`${k}番目の並び ${r.runners.length}人 宇宙人${aliens} ${r.alienCount} 市民${r.civCount}`);
      }
      if (aliens === 3) three++;
      const two = r.runners.slice(0, 2).map((x) => x.truth);
      if ([...two].sort().join() !== 'bad,civ') bad.push(`${k}番目の並びの最初の2人 ${two}`);
      firsts.add(two[0]);
      r.runners.forEach((x, i) => {
        if (!MALL_LOOKS.includes(x.look as MallLook)) bad.push(`${k}番目の並びの${i}人目 見た目 ${x.look}`);
        if (x.sheetKey !== `${x.look}_${x.truth}`) bad.push(`${k}番目の並びの${i}人目 絵のキー ${x.sheetKey}`);
        if (x.index !== i) bad.push(`${k}番目の並びの${i}人目 index`);
        if (i > 0 && x.look === r.runners[i - 1].look) bad.push(`${k}番目の並びの${i}人目 前と同じ見た目`);
      });
    });
    expect(bad).toEqual([]);
    expect(three / plans.length).toBeGreaterThan(0.4);
    expect(three / plans.length).toBeLessThan(0.6);
    expect([...firsts].sort()).toEqual(['bad', 'civ']);
  });

  it('来る時刻:最初の2人のあとは2秒、そのあとは1.7秒。ゆっくりモードは1.5倍', () => {
    expect(plans[0].runners.map((x) => x.spawnSec)).toEqual([0, 2, 4, 5.7, 7.4, 9.1, 10.8, 12.5]);
    expect(rushSpawnSec(2, true)).toBe(6);
    expect(rushSpawnSec(7, true)).toBe(18.75);
    // 間隔は、マーク(約1秒)と急ブレーキのポーズを足した長さより長い(マークは一度に1人だけ)
    expect(RUSH.gapSec).toBeGreaterThan(RUSH.markSec + RUSH.brakeSec);
  });

  it('全体の長さは8人で約16秒', () => {
    // 右の端の外(ヒーローの180ドット先)から、マークの出る48ドット手前まで走る時間
    const approach = (180 - RUSH.markDistance) / RUSH.runSpeed;
    const total = rushSpawnSec(RUSH.people - 1) + approach + RUSH.markSec + RUSH.settleSec;
    expect(total).toBeGreaterThan(15.5);
    expect(total).toBeLessThan(16.5);
  });
});
