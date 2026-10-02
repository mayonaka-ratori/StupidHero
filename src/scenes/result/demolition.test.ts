// 歩く解体工事の金額が、遊び方で届くかの見積もり(src/logic/titles.ts の DEMOLITION_DAMAGE)。
// 通りの並べ方(src/scenes/street/plan.ts)と、攻撃で物が壊れる確率(rules.ts の rollPropsBroken)をそのまま使い、
// 決めた遊び方でヒーローが殴る場面ごとに、画面に見えている物が壊れるかを引く。種を変えて何回も通し、届いた割合を見る。
// 画面の動き(巻きぞえの市民、ボスが暴れている間に壊れる物など)は入れないので、本当より少し安く出る。
//
// 路地裏:
// - 正しく仕分ける、でたらめに仕分ける、ボスを市民にする(暴れの¥1,000万)、全員をワルに仕分けて壊しにいく、を通す
// - ボスを市民にした暴れ(¥1,000万)に車や自販機を足すと¥1,500万に届くことがある。そのときも大きな称号がボスの親友に
//   なるように、調べる順はボスの親友を先にした(titles.test.ts)。金額を¥2,000万に上げると、壊しにいっても届かない
// フリープレイ(ボスがいない):
// - 何も押さない、待てと行けをすぐ押す(good)、ギャングのワゴンとUFOが来るのを待ってから行けで止める(smash)を通す
// - 行けで止めたワゴンは¥500万、落としたUFOは¥300万。地下駐車場が開いていれば、smash で¥800万に届く
// - ふつうに遊ぶ(何も押さない、すぐ押す)と、¥800万にはたいてい届かない(¥500万だと1〜2割が届いていた)

import { describe, expect, it } from 'vitest';
import {
  BOSS, BOSS_RAMPAGE_COST, DEMOLITION_DAMAGE, MISCHIEF_COST, PROP_COST, STAGES, createFreePlay, createRng, createStage, freeRoleOf,
  freeTiming, pickAttack, rollPropsBroken, type StageId
} from '../../logic';
import { planFree, planStreet, type PropSpot } from '../street/plan';

/** 殴る相手の x のまわりで、画面に見えている物(ヒーローは相手の少し左に立つ) */
const visibleAt = <T extends PropSpot & { broken: boolean }>(props: T[], x: number): T[] =>
  props.filter((p) => !p.broken && p.x >= x - 100 && p.x <= x + 116);

type AlleyPlay = 'truth' | 'random' | 'bossCiv' | 'smashBossCiv' | 'smashIdle';

/** 路地裏を1回通した被害額 */
function alleyRun(seed: number, play: AlleyPlay): number {
  const stage = createStage(seed, 'alley');
  const rng = createRng(seed * 7 + 1);
  let damage = 0;
  let bossCiv = false;
  for (const w of stage.waves) {
    const sortBad = new Map(w.people.map((p) => {
      const smash = play === 'smashBossCiv' || play === 'smashIdle';
      let bad = play === 'random' ? rng.chance(0.5) : smash ? true : p.truth !== 'civ';
      if ((play === 'bossCiv' || play === 'smashBossCiv') && p.truth === 'boss') bad = false;
      return [p.id, bad] as const;
    }));
    const passBad = new Set(w.people.filter((p) => p.truth === 'bad' && !sortBad.get(p.id)).map((p) => p.id));
    const plan = planStreet(w.people, passBad, rng);
    const props = plan.props.map((p) => ({ ...p, broken: false }));
    for (const s of plan.people) {
      const bad = sortBad.get(s.person.id);
      if (s.person.truth === 'boss') { bossCiv = !bad; continue; }
      if (!bad) { if (s.person.truth === 'bad') damage += MISCHIEF_COST; continue; }
      for (const p of rollPropsBroken(pickAttack(rng), visibleAt(props, s.x), s.x, rng)) { p.broken = true; damage += PROP_COST[p.kind]; }
    }
  }
  // ボス:市民にしたら暴れる。倒すときは、ふつうは手が止まるのは少し。smashIdle はわざと止めて14秒待つ
  if (bossCiv) damage += BOSS_RAMPAGE_COST;
  else damage += play === 'smashIdle' ? 14 * BOSS.idleCostPerSec : rng.int(0, 2) * BOSS.idleCostPerSec;
  return damage;
}

type FreePlay = 'none' | 'good' | 'smash';

/** フリープレイを1回通した被害額 */
function freeRun(seed: number, play: FreePlay, unlocked: StageId[]): number {
  const plan = createFreePlay(seed, unlocked);
  const rng = createRng(seed * 13 + 5);
  let damage = 0;
  plan.waves.forEach((fw, i) => {
    const people = plan.stage.waves[i].people;
    const victims = new Map<string, 'threat' | 'ufo'>();
    for (const p of people) {
      if (freeRoleOf(fw, p) !== 'go') continue;
      if (p.look === 'fp_mohawk') victims.set(p.id, 'threat');
      else if (p.look === 'fp_alien') victims.set(p.id, 'ufo');
    }
    const sp = planFree(people, { gap: freeTiming(fw.no).gapPx, bg: fw.bgStage, props: STAGES[fw.bgStage].props, victims, passerLooks: [] }, rng);
    const props = sp.props.map((p) => ({ ...p, broken: false }));
    const hit = (x: number): void => {
      for (const p of rollPropsBroken(pickAttack(rng), visibleAt(props, x), x, rng)) { p.broken = true; damage += PROP_COST[p.kind]; }
    };
    const groups = new Set<string>();
    for (const s of sp.people) {
      const role = freeRoleOf(fw, s.person);
      // ヒーローが殴りかかる:市民なら good だけ待てで止める
      if (role === 'heroBad' || (role === 'stop' && play !== 'good')) { hit(s.x); continue; }
      if (role !== 'go' || play === 'none') continue;
      const g = s.person.group;
      if (g) {
        // ギャングの組は1場面。good は集まったところで倒す(まわりの物が壊れる)、smash はワゴンが来てから止める
        if (groups.has(g)) continue;
        groups.add(g);
        if (play === 'smash') damage += PROP_COST.van;
        else hit(s.x + 40);
        continue;
      }
      // 宇宙人:good は合図の前に倒す、smash はUFOが来てから落とす
      if (s.person.look === 'fp_alien' && play === 'smash') { damage += PROP_COST.ufo; continue; }
      hit(s.x);
    }
  });
  return damage;
}

/** 届いた割合 */
const rate = (xs: readonly number[], line: number): number => xs.filter((x) => x >= line).length / xs.length;
const seeds = (from: number, n: number): number[] => Array.from({ length: n }, (_, i) => from + i);

describe('歩く解体工事:路地裏の¥1,500万', () => {
  const line = DEMOLITION_DAMAGE.alley;
  const runs = (play: AlleyPlay): number[] => seeds(1000, 300).map((s) => alleyRun(s, play));

  it('正しく仕分けて、ふつうにボスを倒すと届かない', () => {
    expect(rate(runs('truth'), line)).toBe(0);
  });

  it('ボスを市民にした暴れに、ふつうに壊れた物を足すと、ときどき届く(だから大きな称号はボスの親友を先にした)', () => {
    const r = rate(runs('bossCiv'), line);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(0.2);
  });

  it('全員をワルに仕分けて、ボスを市民にすると、わざと壊しにいけば届く。¥2,000万にすると、それでもほとんど届かない', () => {
    const xs = runs('smashBossCiv');
    expect(rate(xs, line)).toBeGreaterThan(0.15);
    expect(rate(xs, 20_000_000)).toBeLessThan(0.05);
  });
});

describe('歩く解体工事:フリープレイの¥800万', () => {
  const line = DEMOLITION_DAMAGE.free;
  // 同じ遊び方と開いたステージの組は1回だけ通して、テストの間で使い回す
  const memo = new Map<string, number[]>();
  const runs = (play: FreePlay, unlocked: StageId[], n = 200): number[] => {
    const key = `${play} ${unlocked.join(',')} ${n}`;
    if (!memo.has(key)) memo.set(key, seeds(500, n).map((s) => freeRun(s, play, unlocked)));
    return memo.get(key)!;
  };
  const opened: StageId[][] = [['alley'], ['alley', 'garage'], ['alley', 'garage', 'mall']];

  it('待てを押さずに殴らせ、ワゴンとUFOが来るのを待って行けで止めると、地下駐車場が開いていれば届き、路地裏だけでもまれに届く', () => {
    // 地下駐車場が開いていれば200回とも届いていたので、50回で足りる
    expect(rate(runs('smash', ['alley', 'garage'], 50), line)).toBeGreaterThan(0.9);
    expect(rate(runs('smash', ['alley', 'garage', 'mall'], 50), line)).toBeGreaterThan(0.9);
    // 路地裏だけは200回で9回くらいしか届かないので、回数を減らさない
    expect(rate(runs('smash', ['alley']), line)).toBeGreaterThan(0);
  });

  it('ふつうに遊ぶ(何も押さない、待てと行けをすぐ押す)と、たいてい届かない。¥500万だと1割をこえて届く', () => {
    for (const u of opened) {
      for (const play of ['none', 'good'] as const) expect(rate(runs(play, u), line), `${play} ${u.join(',')}`).toBeLessThan(0.2);
    }
    const all = opened.flatMap((u) => [...runs('none', u), ...runs('good', u)]);
    expect(rate(all, line)).toBeLessThan(0.1);
    expect(rate(all, 5_000_000)).toBeGreaterThan(0.1);
  });
});
