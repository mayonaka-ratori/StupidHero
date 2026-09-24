// ショッピングモール(ステージ3)の3つの波と、タイムセールラッシュの並びを作る(createStage(seed, 'mall') から呼ぶ)。
// 決まりは docs/STAGE3.md。
//
// - 波の人数と時間は MALL_WAVES(5人30秒、6人28秒、6人と親玉30秒)
// - 1つの波の宇宙人は2〜3人。見た目は4種類(着ぐるみのバイト、寝不足の店員、ロボットダンスの学生、買い物客のおじさん)。
//   宇宙人と同じ見た目の市民をなるべく同じ波に出す(ぎこちない動きだけでは分からないように)
// - 宇宙人には人ごとのくずれの時間(person.glitch)をつける。初めてくずれるまで3〜6秒を0.5秒きざみ、そのあと3秒おきに0.2秒。
//   波1には練習用の宇宙人を1人(1.5秒で初めてくずれ、そのあと2秒おきに0.3秒)。市民と親玉にはつけない(親玉はくずれない)
// - 親玉は波3に1人。化けた姿は寝不足の店員、買い物客のおじさん、着ぐるみのバイトから
// - タイムセールラッシュ(stage.rush):8人、宇宙人は3人か4人(半々)。最初の2人は市民1人と宇宙人1人(順はランダム)
//
// 画面の担当が使うもの:
//   仕分け:glitchShowing(person.glitch, sec)   // sec はその人が出てから進んだ仕分けの時計(文字送りと一時停止の間は進めない)
//   ラッシュ:stage.rush.runners を spawnSec の順に出す。ゆっくりモードは rushSpawnSec(i, true)
//            宇宙人のくずれは rushGlitchShowing(sec)(0.3秒に1回。sec はラッシュが始まってからの秒数でよい)

import { makePerson, type PersonDraft, type UsedTexts } from './people';
import { leastUsed } from './pick';
import type { Rng } from './rng';
import { ALIENS_PER_WAVE, GLITCH, RUSH } from './rules';
import { STAGES, sheetKeyFor } from './stages';
import type { GlitchTiming, MallDisguise, MallLook, Person, RushPlan, RushRunner, Wave } from './types';

export const MALL_LOOKS: readonly MallLook[] = ['mascot', 'clerk', 'dancer', 'uncle'];
/** 親玉の化けた姿 */
export const BOSS3_DISGUISES: readonly MallDisguise[] = ['clerk', 'uncle', 'mascot'];

// ─── 動きのくずれ ─────────────────────────────────

/** 宇宙人1人のくずれの時間を決める。practice なら練習用(波1) */
export function rollGlitch(rng: Rng, practice = false): GlitchTiming {
  if (practice) return { ...GLITCH.practice, practice: true };
  const { min, max, step } = GLITCH.firstSec;
  const steps = Math.round((max - min) / step);
  return { firstSec: min + rng.int(0, steps) * step, everySec: GLITCH.everySec, showSec: GLITCH.showSec, practice: false };
}

/**
 * 仕分けの時計で sec 秒たったときに、くずれが出ているか。glitch がなければ(市民と親玉)いつも false。
 * 1回目は firstSec から showSec の間、そのあとは everySec ごと
 */
export function glitchShowing(glitch: GlitchTiming | undefined, sec: number): boolean {
  if (!glitch || sec < glitch.firstSec) return false;
  return (sec - glitch.firstSec) % glitch.everySec < glitch.showSec;
}

/** sec 秒までに、くずれが何回始まったか(0なら、まだ一度もくずれていない) */
export function glitchCount(glitch: GlitchTiming | undefined, sec: number): number {
  if (!glitch || sec < glitch.firstSec) return 0;
  return Math.floor((sec - glitch.firstSec) / glitch.everySec) + 1;
}

/** sec 秒より後で、次にくずれが始まる時刻(秒)。くずれない人は null */
export function nextGlitchAt(glitch: GlitchTiming | undefined, sec: number): number | null {
  if (!glitch) return null;
  if (sec < glitch.firstSec) return glitch.firstSec;
  return glitch.firstSec + glitchCount(glitch, sec) * glitch.everySec;
}

// ─── 3つの波 ──────────────────────────────────────

export function buildMallWaves(rng: Rng, used: UsedTexts): Wave[] {
  const def = STAGES.mall;
  const badCount: Record<MallLook, number> = { mascot: 0, clerk: 0, dancer: 0, uncle: 0 };
  const civCount: Record<MallLook, number> = { mascot: 0, clerk: 0, dancer: 0, uncle: 0 };
  const bossDisguise = rng.pick(BOSS3_DISGUISES);

  return def.waves.map((plan) => {
    const [aMin, aMax] = plan.aliens ?? [ALIENS_PER_WAVE.min, ALIENS_PER_WAVE.max];
    const alienTotal = rng.int(aMin, aMax);
    const civSlots = plan.people - alienTotal;

    // 宇宙人の見た目:使った回数の少ない順(1つの波の中では重ならない。見た目は4つで、宇宙人は3人まで)
    const alienLooks = leastUsed(rng, MALL_LOOKS, badCount).slice(0, alienTotal);
    for (const l of alienLooks) badCount[l]++;

    // 市民の見た目:宇宙人と同じ見た目 → (波3)親玉の化けた姿と同じ見た目 → 残りは偏らないように
    const civLooks: MallLook[] = [];
    for (const l of rng.shuffle(alienLooks)) if (civLooks.length < civSlots) civLooks.push(l);
    if (plan.boss && !civLooks.includes(bossDisguise)) {
      // 親玉と同じ見た目の市民がいないなら、足すか最後の1人を入れかえる
      if (civLooks.length < civSlots) civLooks.push(bossDisguise);
      else if (civLooks.length > 0) civLooks[civLooks.length - 1] = bossDisguise;
    }
    while (civLooks.length < civSlots) {
      const fresh = leastUsed(rng, MALL_LOOKS, civCount).filter((l) => !civLooks.includes(l));
      civLooks.push(fresh[0] ?? rng.pick(MALL_LOOKS));
    }
    for (const l of civLooks) civCount[l]++;

    // 宇宙人:波1は1人目を練習用にする(並びはあとで混ぜるので、何番目に出るかはランダム)
    const drafts: PersonDraft[] = alienLooks.map((look, i) => {
      const p = makePerson(rng, used, 'mall', plan.no, look, 'bad');
      p.glitch = rollGlitch(rng, plan.practiceAlien === true && i === 0);
      return p;
    });
    for (const look of civLooks) drafts.push(makePerson(rng, used, 'mall', plan.no, look, 'civ'));
    if (plan.boss) drafts.push(makePerson(rng, used, 'mall', plan.no, bossDisguise, 'boss', bossDisguise));

    const people: Person[] = rng.shuffle(drafts).map((p, index) => ({
      id: `w${plan.no}-${index + 1}`, index, ...p
    }));
    return { no: plan.no, seconds: plan.seconds, people, badCount: alienTotal, hasBoss: plan.boss, groups: [] };
  });
}

// ─── タイムセールラッシュ ─────────────────────────

/**
 * index 番目(0始まり)の人が画面の右に出てくる時刻(ラッシュが始まってからの秒数)。
 * 最初の2人のあとは2.4秒、そのあとは1.8秒おき。slow(ゆっくりモード)なら間隔を1.5倍にする
 */
export function rushSpawnSec(index: number, slow = false): number {
  let t = 0;
  for (let i = 0; i < index; i++) t += i < RUSH.openingPair ? RUSH.firstGapSec : RUSH.gapSec;
  if (slow) t *= RUSH.slowGapScale;
  return Math.round(t * 1000) / 1000;
}

/** ラッシュの宇宙人のくずれが出ているか(0.3秒に1回)。sec はラッシュが始まってからの秒数 */
export function rushGlitchShowing(sec: number): boolean {
  return sec >= 0 && sec % RUSH.glitchEverySec < RUSH.glitchShowSec;
}

/**
 * タイムセールラッシュの並びを作る(rng はステージと同じもの。同じ種なら同じ並び)。
 * 宇宙人は3人か4人(半々)。最初の2人は市民1人と宇宙人1人(順はランダム)、残りは混ぜる。
 * 見た目は4種類から、前の人と続けて同じにならないように選ぶ
 */
export function buildRush(rng: Rng): RushPlan {
  const alienCount = rng.chance(0.5) ? RUSH.aliens[0] : RUSH.aliens[1];
  const civCount = RUSH.people - alienCount;
  const opening = rng.shuffle<'bad' | 'civ'>(['civ', 'bad']);
  const rest = rng.shuffle<'bad' | 'civ'>([
    ...Array.from({ length: alienCount - 1 }, () => 'bad' as const),
    ...Array.from({ length: civCount - 1 }, () => 'civ' as const)
  ]);
  let prev: MallLook | null = null;
  const runners: RushRunner[] = [...opening, ...rest].map((truth, index) => {
    const look = rng.pick(MALL_LOOKS.filter((l) => l !== prev));
    prev = look;
    return { index, look, truth, sheetKey: sheetKeyFor(look, truth, 'mall'), spawnSec: rushSpawnSec(index) };
  });
  return { runners, alienCount, civCount };
}
