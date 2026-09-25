// 高層ビル(ステージ4)の4つの波と、エレベーターラッシュの並びを作る(createStage(seed, 'tower') から呼ぶ)。
// 決まりは docs/STAGE4.md。
//
// - 波の人数と時間は TOWER_WAVES(4人26秒、5人24秒、6人26秒、6人と親玉30秒)
// - 出る見た目は階ごとに2種類ずつ増える(1階は2種類、18階は4種類、35階は6種類、最上階は8種類)。
//   最上階では、最上階の2種類(ドレスの女性、手品師)をかならず入れる
// - 1つの波のヴィランは、波1が1〜2人、波2と3が2〜3人、波4が2人。見た目は波の中で重ならない。
//   ヴィランと同じ見た目の市民を、なるべく同じ波に出す
// - ヴィランにはもれ(person.leak)をつける。2か所とも出るか1か所だけか(半々)。波1の1人目は練習用で2か所とも
// - 波2から、紛らわしい市民(person.decoy)を1人ずつ入れる。種類ごとに出せる見た目が決まっている(DECOY_LOOKS)
// - 親玉は波4に1人。化けた姿はドレスの女性、手品師、ウェイターから。同じ見た目の市民を波4に入れる。親玉はもれない
// - エレベーターラッシュ(stage.rush、kind は 'elevator'):6人、ヴィランは2人か3人(半々)。
//   最初の2人は市民1人とヴィラン1人(順はランダム)。見た目は8種類から、前の人と続けて同じにしない
//
// 画面の担当が使うもの:
//   仕分け:leakSpots(person)   // 照明と机の小物に、何を出すか('leak' は紫のもれ、ほかは紛らわしい市民の理由)
//   ラッシュ:stage.rush.riders を順に。1人ぶんの時間は liftTiming(slow)

import { makePerson, type PersonDraft, type UsedTexts } from './people';
import { leastUsed } from './pick';
import type { Rng } from './rng';
import { DECOY_LOOKS, LEAK, LIFT } from './rules';
import { STAGES, TOWER_LOOKS, sheetKeyFor } from './stages';
import type { Leak, LiftPlan, LiftRider, Person, TowerDecoy, TowerDisguise, TowerLook, Wave } from './types';

/** 波ごと(階ごと)に出る見た目。上の階には下の階の人も上がってくる */
export const FLOOR_LOOKS: readonly (readonly TowerLook[])[] = [
  ['florist', 'courier'],
  ['florist', 'courier', 'newbie', 'janitor'],
  ['florist', 'courier', 'newbie', 'janitor', 'chef', 'waiter'],
  TOWER_LOOKS
];

/** 最上階(波4)にかならず入れる見た目 */
export const TOP_FLOOR_LOOKS: readonly TowerLook[] = ['lady', 'magician'];

/** 親玉の化けた姿 */
export const BOSS4_DISGUISES: readonly TowerDisguise[] = ['lady', 'magician', 'waiter'];

/** 紛らわしい市民の種類 */
export const TOWER_DECOYS: readonly TowerDecoy[] = ['flicker', 'thread', 'balloon'];

// ─── もれと紛らわしい市民 ─────────────────────────

/** ヴィラン1人のもれを決める。practice なら練習用(2か所とも) */
export function rollLeak(rng: Rng, practice = false): Leak {
  if (practice && LEAK.practiceBoth) return { light: true, item: true };
  if (rng.chance(LEAK.bothChance)) return { light: true, item: true };
  return rng.chance(LEAK.lightOnlyChance) ? { light: true, item: false } : { light: false, item: true };
}

/** その見た目の市民を、この種類の紛らわしい市民にできるか */
export function canDecoy(look: TowerLook, decoy: TowerDecoy): boolean {
  const looks = DECOY_LOOKS[decoy];
  return looks === 'any' || looks.includes(look);
}

/** 仕分けの画面の決まった2か所(左上の照明、左下の机の小物)に出すもの */
export interface LeakSpots {
  /** 'leak' は紫の光と火花、'flicker' は切れかけの蛍光灯(うすい黄色)。null はふつう */
  light: 'leak' | 'flicker' | null;
  /** 'leak' は浮いて紫のもやに包まれる、'thread' は手品の糸で吊られて浮く、'balloon' は風船がのっている。null はふつう */
  item: 'leak' | 'thread' | 'balloon' | null;
}

/** その人が出ている間、照明と机の小物に何を出すか(ヴィランはもれ、紛らわしい市民はもれに見えるもの、親玉と市民は何もなし) */
export function leakSpots(p: Pick<Person, 'leak' | 'decoy'>): LeakSpots {
  const out: LeakSpots = { light: null, item: null };
  if (p.leak?.light) out.light = 'leak';
  if (p.leak?.item) out.item = 'leak';
  if (p.decoy === 'flicker') out.light = 'flicker';
  if (p.decoy === 'thread' || p.decoy === 'balloon') out.item = p.decoy;
  return out;
}

/** 波の市民の見た目から、紛らわしい市民の種類と、なる人(civLooks の中の番号)を選ぶ。出せなければ null */
function pickDecoy(rng: Rng, civLooks: readonly TowerLook[]): { decoy: TowerDecoy; index: number } | null {
  const kinds = TOWER_DECOYS.filter((d) => civLooks.some((l) => canDecoy(l, d)));
  if (kinds.length === 0) return null;
  const decoy = rng.pick(kinds);
  const candidates = civLooks.map((l, i) => ({ l, i })).filter(({ l }) => canDecoy(l, decoy));
  return { decoy, index: rng.pick(candidates).i };
}

// ─── 4つの波 ──────────────────────────────────────

const zeroCount = (): Record<TowerLook, number> =>
  ({ florist: 0, courier: 0, newbie: 0, janitor: 0, chef: 0, waiter: 0, lady: 0, magician: 0 });

export function buildTowerWaves(rng: Rng, used: UsedTexts): Wave[] {
  const def = STAGES.tower;
  const badCount = zeroCount();
  const civCount = zeroCount();
  const bossDisguise = rng.pick(BOSS4_DISGUISES);

  return def.waves.map((plan, wi) => {
    if (!plan.villains) throw new Error(`tower の波${plan.no}に villains がない`);
    const pool = FLOOR_LOOKS[wi] ?? TOWER_LOOKS;
    const [vMin, vMax] = plan.villains;
    const villainTotal = Math.min(rng.int(vMin, vMax), pool.length);
    const civSlots = plan.people - villainTotal;

    // ヴィランの見た目:使った回数の少ない順(1つの波の中では重ならない)
    const villainLooks = leastUsed(rng, pool, badCount).slice(0, villainTotal);
    for (const l of villainLooks) badCount[l]++;

    // 市民の見た目:かならず入れる見た目(最上階の2種類、親玉の化けた姿)→ ヴィランと同じ見た目 → 残りは偏らないように
    const civLooks: TowerLook[] = [];
    const need: TowerLook[] = [];
    if (plan.no === 4) for (const l of TOP_FLOOR_LOOKS) if (!villainLooks.includes(l)) need.push(l);
    if (plan.boss) need.push(bossDisguise);
    for (const l of need) if (!civLooks.includes(l) && civLooks.length < civSlots) civLooks.push(l);
    for (const l of rng.shuffle(villainLooks)) if (!civLooks.includes(l) && civLooks.length < civSlots) civLooks.push(l);
    while (civLooks.length < civSlots) {
      const order = leastUsed(rng, pool, civCount);
      // 見た目を使い切ったら(波1は2種類しかない)、同じ見た目の2人目
      civLooks.push(order.find((l) => !civLooks.includes(l)) ?? order[0]);
    }
    for (const l of civLooks) civCount[l]++;

    // ヴィラン:波1は1人目を練習用にする(並びはあとで混ぜるので、何番目に出るかはランダム)
    const drafts: PersonDraft[] = villainLooks.map((look, i) => {
      const p = makePerson(rng, used, 'tower', plan.no, look, 'bad');
      p.leak = rollLeak(rng, plan.practiceLeak === true && i === 0);
      return p;
    });
    const civDrafts = civLooks.map((look) => makePerson(rng, used, 'tower', plan.no, look, 'civ'));
    for (let n = 0; n < (plan.decoys ?? 0); n++) {
      const free = civDrafts.filter((d) => !d.decoy);
      const chosen = pickDecoy(rng, free.map((d) => d.look as TowerLook));
      if (chosen) free[chosen.index].decoy = chosen.decoy;
    }
    drafts.push(...civDrafts);
    if (plan.boss) drafts.push(makePerson(rng, used, 'tower', plan.no, bossDisguise, 'boss', bossDisguise));

    const people: Person[] = rng.shuffle(drafts).map((p, index) => ({
      id: `w${plan.no}-${index + 1}`, index, ...p
    }));
    return { no: plan.no, seconds: plan.seconds, people, badCount: villainTotal, hasBoss: plan.boss, groups: [] };
  });
}

// ─── エレベーターラッシュ ─────────────────────────

/** エレベーターラッシュの1人ぶんの時間(秒)。slow(ゆっくりモード)なら、乗ってくる時間とマークの長さを1.5倍 */
export interface LiftTiming {
  doorSec: number;
  stepInSec: number;
  markSec: number;
  actSec: number;
  closeSec: number;
  /** 1人ぶんの合計 */
  cycleSec: number;
}

export function liftTiming(slow = false): LiftTiming {
  const k = slow ? LIFT.slowScale : 1;
  const t = {
    doorSec: LIFT.doorSec,
    stepInSec: LIFT.stepInSec * k,
    markSec: LIFT.markSec * k,
    actSec: LIFT.actSec,
    closeSec: LIFT.closeSec
  };
  const cycleSec = Math.round((t.doorSec + t.stepInSec + t.markSec + t.actSec + t.closeSec) * 1000) / 1000;
  return { ...t, cycleSec };
}

/** index 番目(0始まり)の人のために扉が開く階。35階と50階の間を、上がっていく順に同じくらいの間で */
export function liftFloor(index: number): number {
  const span = LIFT.toFloor - LIFT.fromFloor;
  return LIFT.fromFloor + Math.round(((index + 1) * span) / (LIFT.people + 1));
}

/**
 * エレベーターラッシュの並びを作る(rng はステージと同じもの。同じ種なら同じ並び)。
 * ヴィランは2人か3人(半々)。最初の2人は市民1人とヴィラン1人(順はランダム)、残りは混ぜる。
 * 見た目は8種類から、前の人と続けて同じにならないように選ぶ。ヴィランのもれはいつも2か所(ここでは持たない)
 */
export function buildLift(rng: Rng): LiftPlan {
  const villainCount = rng.chance(0.5) ? LIFT.villains[0] : LIFT.villains[1];
  const civCount = LIFT.people - villainCount;
  const opening = rng.shuffle<'bad' | 'civ'>(['civ', 'bad']);
  const rest = rng.shuffle<'bad' | 'civ'>([
    ...Array.from({ length: villainCount - 1 }, () => 'bad' as const),
    ...Array.from({ length: civCount - 1 }, () => 'civ' as const)
  ]);
  let prev: TowerLook | null = null;
  const riders: LiftRider[] = [...opening, ...rest].map((truth, index) => {
    const look = rng.pick(TOWER_LOOKS.filter((l) => l !== prev));
    prev = look;
    return { index, look, truth, sheetKey: sheetKeyFor(look, truth, 'tower'), floor: liftFloor(index) };
  });
  return { kind: 'elevator', riders, villainCount, civCount };
}
