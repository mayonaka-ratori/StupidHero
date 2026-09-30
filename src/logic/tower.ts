// 高層ビル(ステージ4)の4つの波と、エレベーターラッシュの並びを作る(createStage(seed, 'tower') から呼ぶ)。
// 決まりは docs/STAGE4.md。
//
// - 波の人数と時間は TOWER_WAVES(4人26秒、5人24秒、6人26秒、6人と親玉30秒)
// - 出る見た目は階ごとに2種類ずつ増える(1階は2種類、18階は4種類、35階は6種類、最上階は8種類)。
//   最上階では、最上階の2種類(ドレスの女性、手品師)をかならず入れる
// - 1つの波のヴィランは、波1が1〜2人、波2と3が2〜3人、波4が2人。見た目は波の中で重ならない。
//   ヴィランと同じ見た目の市民を、なるべく同じ波に出す
// - ヴィランにはもれ(person.leak)をつける。2か所とも出るか1か所だけか(半々)。波1の1人目は練習用で2か所とも
// - 波3と波4には、もれを隠すヴィランを1人ずつ入れる(LEAK.hiddenPerWave。leak は { light: false, item: false })。
//   プロフィールはふしぎに聞こえる文(TOWER_ODD_LINES)、一言は疑う一言(TOWER_DOUBT_HINTS)にする。
//   市民は、ふしぎに聞こえる文と疑う一言が同じ人にそろわない。そのため「両方あやしい人」はヴィランと決められる
// - 波2から、紛らわしい市民(person.decoy)を1〜2人ずつ入れる(TOWER_WAVES の decoys)。1つの波の中では種類を重ねない。
//   種類ごとに出せる見た目が決まっている(DECOY_LOOKS)
// - 照明か小物に何か出ている人(もれのあるヴィランと紛らわしい市民)は、半々で、オペレーターの一言を
//   見えている物のことを言う一言(TOWER_SPOT_HINTS)に替える。ヴィランと紛らわしい市民で同じ確率にする。
//   「グラスが浮いてる!?」は、浮いている小物がグラスの階(35階と最上階)だけ
// - 親玉は波4に1人。化けた姿はドレスの女性、手品師、ウェイターから。同じ見た目の市民を波4に入れる。親玉はもれない
// - エレベーターラッシュ(stage.rush、kind は 'elevator'):6人、ヴィランは2人か3人(半々)。
//   最初の2人は市民1人とヴィラン1人(順はランダム)。見た目は8種類から、前の人と続けて同じにしない
//
// 画面の担当が使うもの:
//   仕分け:leakSpots(person)   // 照明と机の小物に、何を出すか('leak' は火花の出るもれ、ほかは紛らわしい市民の理由)
//   ラッシュ:stage.rush.riders を順に。1人ぶんの時間は liftTiming(slow)

import { makePerson, shufflePeople, type PersonDraft, type UsedTexts } from './people';
import { leastUsed, pickFresh, rushLineup, zeroCounts } from './pick';
import type { Rng } from './rng';
import { DECOY_LOOKS, LEAK, LIFT, TOWER_SPOT_ITEMS } from './rules';
import { BOSS4_DISGUISES, STAGES, TOWER_LOOKS, sheetKeyFor } from './stages';
import { TOWER_DOUBT_HINTS, TOWER_ODD_LINES, TOWER_OPERATOR_HINTS, TOWER_SPOT_HINTS } from './towerContent';
import type { Leak, LiftPlan, LiftRider, OperatorHint, Person, TowerDecoy, TowerLook, Wave, WaveNo } from './types';

/** 波ごと(階ごと)に出る見た目。上の階には下の階の人も上がってくる */
export const FLOOR_LOOKS: readonly (readonly TowerLook[])[] = [
  ['florist', 'courier'],
  ['florist', 'courier', 'newbie', 'janitor'],
  ['florist', 'courier', 'newbie', 'janitor', 'chef', 'waiter'],
  TOWER_LOOKS
];

/** 最上階(波4)にかならず入れる見た目 */
const TOP_FLOOR_LOOKS: readonly TowerLook[] = ['lady', 'magician'];

/** 紛らわしい市民の種類 */
const TOWER_DECOYS: readonly TowerDecoy[] = ['flicker', 'cellophane', 'thread', 'smoke', 'balloon'];

// ─── もれと紛らわしい市民 ─────────────────────────

/** ヴィラン1人のもれを決める。practice なら練習用(2か所とも) */
export function rollLeak(rng: Rng, practice = false): Leak {
  if (practice) return { light: true, item: true };
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
  /**
   * 'leak' は紫の光と火花、'flicker' は切れかけの蛍光灯(うすい黄色)、'cellophane' は紫のセロハンを貼った照明
   * (紫の光だが火花はない)。null はふつう
   */
  light: 'leak' | 'flicker' | 'cellophane' | null;
  /**
   * 'leak' は浮いて紫のもやと火花に包まれる、'thread' は手品の糸で吊られて浮く、'smoke' は手品の糸で吊られて浮き、
   * そばに紫の煙が出る、'balloon' は紫の風船がひもで結ばれて浮く。null はふつう
   */
  item: 'leak' | 'thread' | 'smoke' | 'balloon' | null;
}

/** 紛らわしい市民の種類が、照明と小物のどちらに出るか */
const DECOY_SPOT: Readonly<Record<TowerDecoy, 'light' | 'item'>> = {
  flicker: 'light', cellophane: 'light', thread: 'item', smoke: 'item', balloon: 'item'
};

/** その人が出ている間、照明と机の小物に何を出すか(ヴィランはもれ、紛らわしい市民はもれに見えるもの、親玉と市民は何もなし) */
export function leakSpots(p: Pick<Person, 'leak' | 'decoy'>): LeakSpots {
  const out: LeakSpots = { light: null, item: null };
  if (p.leak?.light) out.light = 'leak';
  if (p.leak?.item) out.item = 'leak';
  if (p.decoy && DECOY_SPOT[p.decoy] === 'light') out.light = p.decoy as LeakSpots['light'];
  if (p.decoy && DECOY_SPOT[p.decoy] === 'item') out.item = p.decoy as LeakSpots['item'];
  return out;
}

/**
 * 照明と小物に見えている物のことを言う一言の候補(TOWER_SPOT_HINTS から、その人に本当に当てはまるものだけ)。
 * 何も出ていなければ空。もれか紛らわしい市民の理由かは言わない(どちらにも同じ文が出る)
 */
export function spotHintsFor(s: LeakSpots, wave: WaveNo | null = null): OperatorHint[] {
  const out: OperatorHint[] = [];
  if (s.light) out.push(...TOWER_SPOT_HINTS.lightOdd);
  if (s.light === 'leak' || s.light === 'cellophane') out.push(...TOWER_SPOT_HINTS.lightPurple);
  if (s.item) out.push(...TOWER_SPOT_HINTS.itemFloat);
  if (s.item === 'leak' || s.item === 'smoke' || s.item === 'balloon') out.push(...TOWER_SPOT_HINTS.itemPurple);
  // 浮いている小物がグラスの階(35階と最上階)だけ
  if (s.item && wave !== null && TOWER_SPOT_ITEMS[wave - 1] === 'glass') out.push(...TOWER_SPOT_HINTS.glassFloat);
  return out;
}

/** 見た目ごとの一言のうち、疑う一言か */
export function isDoubtHint(look: TowerLook, h: Pick<OperatorHint, 'text'>): boolean {
  return TOWER_DOUBT_HINTS[look].text === h.text;
}

/** ふしぎに聞こえるプロフィールの文か(市民とヴィランのどちらの文も見る) */
export function isOddLine(look: TowerLook, line: string): boolean {
  const odd = TOWER_ODD_LINES[look];
  return odd.civ.includes(line) || odd.bad.includes(line);
}

/**
 * ヴィランのもれを隠す(もれを隠すヴィランにする)。もれはどこにも出ない。
 * プロフィールはふしぎに聞こえる文、一言は疑う一言にする(市民にはこの2つがそろわないので、合わせると決められる)
 */
function hideLeak(rng: Rng, used: UsedTexts, p: PersonDraft): void {
  const look = p.look as TowerLook;
  p.leak = { light: false, item: false };
  p.profile = { ...p.profile, line: pickFresh(rng, TOWER_ODD_LINES[look].bad, used.texts, (l) => l) };
  p.hint = { ...TOWER_DOUBT_HINTS[look] };
  used.texts.add(p.hint.text);
}

/**
 * 市民の一言を決め直す。ふしぎに聞こえるプロフィールの文と疑う一言は、同じ人にそろわないようにする
 * (そろっていたら、一言を疑う一言でないものに選び直す)。ふつうに聞こえる文の市民は、LEAK.civDoubtChance で
 * 疑う一言にする(もれを隠すヴィランと同じくらい出して、疑う一言だけでは決められないように)
 */
function fairCivHint(rng: Rng, used: UsedTexts, p: PersonDraft): void {
  const look = p.look as TowerLook;
  const doubt = isDoubtHint(look, p.hint);
  if (isOddLine(look, p.profile.line)) {
    if (!doubt) return;
    const others = TOWER_OPERATOR_HINTS[look].civ.filter((h) => !isDoubtHint(look, h));
    p.hint = { ...pickFresh(rng, others, used.texts, (h) => h.text) };
  } else if (!doubt && rng.chance(LEAK.civDoubtChance)) {
    p.hint = { ...TOWER_DOUBT_HINTS[look] };
    used.texts.add(p.hint.text);
  }
}

/**
 * 波の市民の見た目から、紛らわしい市民の種類と、なる人(civLooks の中の番号)を選ぶ。出せなければ null。
 * skip に入れた種類は選ばない(1つの波の中で同じ種類を重ねないため)
 */
function pickDecoy(
  rng: Rng, civLooks: readonly TowerLook[], skip: ReadonlySet<TowerDecoy>
): { decoy: TowerDecoy; index: number } | null {
  const kinds = TOWER_DECOYS.filter((d) => !skip.has(d) && civLooks.some((l) => canDecoy(l, d)));
  if (kinds.length === 0) return null;
  const decoy = rng.pick(kinds);
  const candidates = civLooks.map((l, i) => ({ l, i })).filter(({ l }) => canDecoy(l, decoy));
  return { decoy, index: rng.pick(candidates).i };
}

// ─── 4つの波 ──────────────────────────────────────

export function buildTowerWaves(rng: Rng, used: UsedTexts): Wave[] {
  const def = STAGES.tower;
  const badCount = zeroCounts(TOWER_LOOKS);
  const civCount = zeroCounts(TOWER_LOOKS);
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
    const practice = (i: number): boolean => plan.practiceLeak === true && i === 0;
    const drafts: PersonDraft[] = villainLooks.map((look, i) => {
      const p = makePerson(rng, used, 'tower', plan.no, look, 'bad');
      p.leak = rollLeak(rng, practice(i));
      return p;
    });
    // もれを隠すヴィラン(波3と波4に1人ずつ。練習用のヴィランはしない)
    const hideable = drafts.map((_, i) => i).filter((i) => !practice(i));
    const hiddenTotal = Math.min(LEAK.hiddenPerWave[wi] ?? 0, hideable.length);
    for (const i of rng.shuffle(hideable).slice(0, hiddenTotal)) hideLeak(rng, used, drafts[i]);
    const civDrafts = civLooks.map((look) => {
      const p = makePerson(rng, used, 'tower', plan.no, look, 'civ');
      fairCivHint(rng, used, p);
      return p;
    });
    const [dMin, dMax] = plan.decoys ?? [0, 0];
    const decoyTotal = rng.int(dMin, dMax);
    const kindsUsed = new Set<TowerDecoy>();
    for (let n = 0; n < decoyTotal; n++) {
      const free = civDrafts.filter((d) => !d.decoy);
      const chosen = pickDecoy(rng, free.map((d) => d.look as TowerLook), kindsUsed);
      if (!chosen) break;
      free[chosen.index].decoy = chosen.decoy;
      kindsUsed.add(chosen.decoy);
    }
    drafts.push(...civDrafts);
    // 照明か小物に何か出ている人は、半々で一言を「見えている物」のことにする(ヴィランも紛らわしい市民も同じ)
    for (const d of drafts) {
      const spotHints = spotHintsFor(leakSpots(d), plan.no);
      if (spotHints.length === 0 || !rng.chance(LEAK.spotHintChance)) continue;
      d.hint = { ...pickFresh(rng, spotHints, used.texts, (h) => h.text) };
    }
    if (plan.boss) drafts.push(makePerson(rng, used, 'tower', plan.no, bossDisguise, 'boss'));

    const people = shufflePeople(rng, plan.no, drafts);
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
  const riders: LiftRider[] = rushLineup(rng, villainCount, civCount, TOWER_LOOKS).map(({ truth, look }, index) =>
    ({ index, look, truth, sheetKey: sheetKeyFor(look, truth, 'tower'), floor: liftFloor(index) }));
  return { kind: 'elevator', riders, villainCount, civCount };
}
