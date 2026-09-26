// 1ステージぶん(波3回)の人の並びを、種から作る。同じ種なら毎回同じステージになる。
//
// 使い方:
//   const stage = createStage(seed);            // 路地裏(ステージ1)
//   const stage = createStage(seed, 'garage');  // 地下駐車場(ステージ2)
//   const stage = createStage(seed, 'mall');    // ショッピングモール(ステージ3)。stage.rush にタイムセールラッシュの並び
//   const stage = createStage(seed, 'tower');   // 高層ビル(ステージ4。波は4つ)。stage.rush にエレベーターラッシュの並び
//   stage.id、stage.def(STAGES の定義)、stage.waves[i].people、stage.waves[i].groups(ギャングの組)
//
// 路地裏の決まり:SPECの波の表の通り。1つの波のワルは2〜3人。波1にはモヒカンを必ず1人。波3にはボスが1人紛れる。
// 同じ見た目の市民とワルがなるべく同じ波に両方出るようにし、名前と文は同じものを2回出さない。
// 地下駐車場の決まりは garage.ts、ショッピングモールの決まりは mall.ts、高層ビルの決まりは tower.ts。

import { buildGarageWaves } from './garage';
import { buildMallWaves, buildRush } from './mall';
import { buildLift, buildTowerWaves } from './tower';
import { makePerson, shufflePeople, type PersonDraft, type UsedTexts } from './people';
import { leastUsed } from './pick';
import { createRng, randomSeed, type Rng } from './rng';
import { BAD_PER_WAVE, WAVES } from './rules';
import { BOSS1_DISGUISES, STAGES } from './stages';
import type { LiftPlan, Look, PairLook, Person, RushPlan, Stage, StageId, Wave, WaveNo } from './types';

const PAIR_LOOKS: readonly PairLook[] = ['hoodie', 'suit', 'shopper'];

/**
 * 1ステージぶんの波(ステージ1〜3は3つ、ステージ4は4つ)を作る。
 * @param seed 種。省略すると毎回ちがうステージ。数でも文字列でもよい
 * @param stageId どのステージか。省略すると路地裏
 */
export function createStage(seed: number | string = randomSeed(), stageId: StageId = 'alley'): Stage {
  const rng = createRng(seed);
  const used: UsedTexts = { names: new Set(), texts: new Set() };
  const waves = WAVE_BUILDERS[stageId](rng, used);
  const def = STAGES[stageId];
  const badTotal = waves.reduce((sum, w) => sum + w.badCount, 0);
  const bossTotal = waves.filter((w) => w.hasBoss).length;
  // ラッシュの並びは波を作ったあとに決める(ラッシュのないステージの乱数の引き方は変わらない)
  const rush = def.rush?.kind === 'sale' ? buildRush(rng) : def.rush?.kind === 'elevator' ? buildLift(rng) : null;
  return {
    id: stageId,
    def,
    name: def.name,
    seed: rng.seed,
    waves,
    villainTotal: badTotal + bossTotal,
    peopleTotal: waves.reduce((sum, w) => sum + w.people.length, 0),
    rush
  };
}

/** ステージごとの波の作り方 */
const WAVE_BUILDERS: Readonly<Record<StageId, (rng: Rng, used: UsedTexts) => Wave[]>> = {
  alley: buildAlleyWaves,
  garage: buildGarageWaves,
  mall: buildMallWaves,
  tower: buildTowerWaves
};

/** 路地裏の3つの波 */
function buildAlleyWaves(rng: Rng, used: UsedTexts): Wave[] {
  // その見た目をワル/市民として何回使ったか(ステージ全体で偏らないように)
  const badCount: Record<PairLook, number> = { hoodie: 0, suit: 0, shopper: 0 };
  const civCount: Record<PairLook, number> = { hoodie: 0, suit: 0, shopper: 0 };
  // おばあさんをステージのどこかに必ず1人入れる(「おばあちゃんの敵」を取れるように)
  const grannyWave = rng.int(1, WAVES.length) as WaveNo;
  const bossDisguise = rng.pick(BOSS1_DISGUISES);

  return WAVES.map((plan) => {
    const waveBad = rng.int(BAD_PER_WAVE.min, BAD_PER_WAVE.max);
    const civSlots = plan.people - waveBad;

    // ワル:モヒカン(波1だけ)と、組の見た目から重ならないように
    const bads: Look[] = plan.mohawk ? ['mohawk'] : [];
    const pairBads = leastUsed(rng, PAIR_LOOKS, badCount).slice(0, waveBad - bads.length);
    for (const l of pairBads) badCount[l]++;
    bads.push(...pairBads);

    // 市民:おばあさん → ワルと同じ見た目 → (波3)ボスの化けた姿と同じ見た目 → 残りは偏らないように
    const civs: Look[] = [];
    if (plan.no === grannyWave) civs.push('granny');
    for (const l of rng.shuffle(pairBads)) if (civs.length < civSlots) civs.push(l);
    if (plan.boss && civs.length < civSlots && !civs.includes(bossDisguise)) civs.push(bossDisguise);
    while (civs.length < civSlots) {
      const fresh = leastUsed(rng, PAIR_LOOKS, civCount).filter((l) => !civs.includes(l));
      // 組の見た目を使い切ったら、おばあさん(1つの波に1人まで)か、組の見た目の2人目
      if (fresh.length > 0 && !(rng.chance(0.15) && !civs.includes('granny'))) civs.push(fresh[0]);
      else if (!civs.includes('granny')) civs.push('granny');
      else civs.push(rng.pick(PAIR_LOOKS));
    }
    for (const l of civs) if (l !== 'granny' && l !== 'mohawk') civCount[l as PairLook]++;

    const drafts: PersonDraft[] = [
      ...bads.map((l) => makePerson(rng, used, 'alley', plan.no, l, 'bad')),
      ...civs.map((l) => makePerson(rng, used, 'alley', plan.no, l, 'civ'))
    ];
    if (plan.boss) drafts.push(makePerson(rng, used, 'alley', plan.no, bossDisguise, 'boss', bossDisguise));

    const people = shufflePeople(rng, plan.no, drafts);
    return { no: plan.no, seconds: plan.seconds, people, badCount: waveBad, hasBoss: plan.boss, groups: [] };
  });
}

/** タイムセールラッシュの並び(ステージ3)。ほかのステージやラッシュのないステージは null */
export function saleRushOf(stage: Pick<Stage, 'rush'>): RushPlan | null {
  return stage.rush?.kind === 'sale' ? stage.rush : null;
}

/** エレベーターラッシュの並び(ステージ4)。ほかのステージは null */
export function liftRushOf(stage: Pick<Stage, 'rush'>): LiftPlan | null {
  return stage.rush?.kind === 'elevator' ? stage.rush : null;
}

/** ステージの中のボス(いなければ null) */
export function findBoss(stage: Stage): Person | null {
  for (const w of stage.waves) for (const p of w.people) if (p.truth === 'boss') return p;
  return null;
}
