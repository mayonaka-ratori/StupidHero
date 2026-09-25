// 数字の書き方。金額(¥3万、¥2,400万、¥1億2,000万)と、被害額のたとえ
// (路地裏「自販機30台分」、地下駐車場「ワゴン2台分」、ショッピングモール「噴水5基分」、高層ビル「シャンパンタワー2基分」)と、
// 市民のけがの内わけ。

import { PROP_COST } from './rules';
import type { StageId, StageStats } from './types';

/** 3けたごとにカンマを入れる */
export function withCommas(n: number): string {
  const s = String(Math.floor(Math.abs(n)));
  const body = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-${body}` : body;
}

/**
 * 金額を書く。1万円以上は万と億で書き、万より下は切り捨てる。
 * 例:30000 → '¥3万'、24000000 → '¥2,400万'、120000000 → '¥1億2,000万'、100000000 → '¥1億'、5000 → '¥5,000'
 */
export function formatYen(yen: number): string {
  const y = Math.max(0, Math.floor(yen));
  if (y < 10_000) return `¥${withCommas(y)}`;
  const man = Math.floor(y / 10_000);
  const oku = Math.floor(man / 10_000);
  const rest = man % 10_000;
  if (oku === 0) return `¥${withCommas(man)}万`;
  return rest === 0 ? `¥${withCommas(oku)}億` : `¥${withCommas(oku)}億${withCommas(rest)}万`;
}

export type AnalogyUnit =
  | 'trash' | 'vending' | 'car' | 'house' | 'cone' | 'van' | 'bosscar'
  | 'gacha' | 'fountain' | 'escalator'
  | 'plant' | 'champagne' | 'piano';

/**
 * たとえに使う物の値段と数え方。一軒家のほかは壊れる物の表(PROP_COST)と同じ値段。
 * 一軒家は¥3,000万とした(自販機や車と同じく、ざっくり分かりやすい額)。
 * cone、van、bosscar は地下駐車場のたとえ(三角コーン、ギャングのワゴン、女ボスの高級車)。
 * gacha、fountain、escalator はショッピングモールのたとえ(ガチャガチャ、噴水、エスカレーター)。
 * plant、champagne、piano は高層ビルのたとえ(観葉植物、シャンパンタワー、ピアノ。STAGE4「共有」)
 */
export const ANALOGY_UNITS: Readonly<Record<AnalogyUnit, { name: string; price: number; counter: string }>> = {
  trash: { name: 'ゴミ箱', price: PROP_COST.trash, counter: '個' },
  vending: { name: '自販機', price: PROP_COST.vending, counter: '台' },
  car: { name: '車', price: PROP_COST.car, counter: '台' },
  house: { name: '一軒家', price: 30_000_000, counter: '軒' },
  cone: { name: '三角コーン', price: PROP_COST.cone, counter: '個' },
  van: { name: 'ワゴン', price: PROP_COST.van, counter: '台' },
  bosscar: { name: '高級車', price: PROP_COST.bosscar, counter: '台' },
  gacha: { name: 'ガチャガチャ', price: PROP_COST.gacha, counter: '台' },
  fountain: { name: '噴水', price: PROP_COST.fountain, counter: '基' },
  escalator: { name: 'エスカレーター', price: PROP_COST.escalator, counter: '基' },
  plant: { name: '観葉植物', price: PROP_COST.plant, counter: '鉢' },
  champagne: { name: 'シャンパンタワー', price: PROP_COST.champagne, counter: '基' },
  piano: { name: 'ピアノ', price: PROP_COST.piano, counter: '台' }
};

/**
 * ステージごとのたとえの切りかえ。上から順に見て、被害額が below 未満なら unit(最後は below が Infinity)。
 * 決め方は analogyUnitFor の説明
 */
const ANALOGY_TIERS: Readonly<Record<StageId, readonly { below: number; unit: AnalogyUnit }[]>> = {
  alley: [
    { below: PROP_COST.vending, unit: 'trash' },
    { below: 30_000_000, unit: 'vending' },
    { below: 300_000_000, unit: 'car' },
    { below: Infinity, unit: 'house' }
  ],
  garage: [
    { below: 500_000, unit: 'cone' },
    { below: 200_000_000, unit: 'van' },
    { below: Infinity, unit: 'bosscar' }
  ],
  mall: [
    { below: 500_000, unit: 'gacha' },
    { below: 200_000_000, unit: 'fountain' },
    { below: Infinity, unit: 'escalator' }
  ],
  tower: [
    { below: 500_000, unit: 'plant' },
    { below: 200_000_000, unit: 'champagne' },
    { below: Infinity, unit: 'piano' }
  ]
};

/**
 * どの物でたとえるか。
 * 路地裏:数が10〜40くらいに収まるように切りかえる。自販機1台に満たないときはゴミ箱(〜26個)、
 * ¥3,000万未満は自販機(1〜37台)、¥3億未満は車(10〜100台)、それより上は一軒家(10軒〜)。
 * 地下駐車場:¥50万未満は三角コーン(〜49個)、¥2億未満はワゴン(0.1〜39台)、それより上は高級車(10台〜)。
 * ショッピングモール:¥50万未満はガチャガチャ(〜9.9台)、¥2億未満は噴水(0.3〜133基)、それより上はエスカレーター(25基〜)。
 * 高層ビル:¥50万未満は観葉植物(〜9.9鉢)、¥2億未満はシャンパンタワー(0.1〜19基)、それより上はピアノ(6.7台〜)
 */
function analogyUnitFor(yen: number, stageId: StageId = 'alley'): AnalogyUnit {
  const tiers = ANALOGY_TIERS[stageId];
  return (tiers.find((t) => yen < t.below) ?? tiers[tiers.length - 1]).unit;
}

/** 数の書き方:10以上は整数、10未満は小数1けた(.0 は書かない)。0より大きければ最低0.1 */
function formatCount(n: number): string {
  if (n >= 10) return withCommas(Math.round(n));
  const r = Math.max(0.1, Math.round(n * 10) / 10);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export interface DamageAnalogy {
  unit: AnalogyUnit | null;
  count: number;
  /** 例:'自販機30台分'。被害額が0なら '被害ゼロ' */
  text: string;
}

/**
 * 被害額のたとえ。例:damageAnalogy(24000000) → { unit: 'vending', count: 30, text: '自販機30台分' }。
 * ステージを渡すとそのステージの物でたとえる:damageAnalogy(8060000, 'garage').text → 'ワゴン1.6台分'
 */
export function damageAnalogy(yen: number, stageId: StageId = 'alley'): DamageAnalogy {
  if (yen <= 0) return { unit: null, count: 0, text: '被害ゼロ' };
  const unit = analogyUnitFor(yen, stageId);
  const def = ANALOGY_UNITS[unit];
  const raw = yen / def.price;
  const countText = formatCount(raw);
  return { unit, count: Number(countText.replace(/,/g, '')), text: `${def.name}${countText}${def.counter}分` };
}

/** 被害額とたとえをまとめて書く。例:'¥2,400万(自販機30台分)'。stageId は damageAnalogy と同じ */
export function formatDamage(yen: number, stageId: StageId = 'alley'): string {
  return `${formatYen(yen)}(${damageAnalogy(yen, stageId).text})`;
}

/**
 * 秒数を書く(小数1けた、切り上げ)。例:4.23 → '4.3秒'、5 → '5.0秒'。
 * 切り上げにしておくと「5.0秒」と出たときは必ず「5秒以内」の称号の条件に入る
 */
export function formatSeconds(sec: number): string {
  return `${(Math.ceil(sec * 10 - 1e-9) / 10).toFixed(1)}秒`;
}

/**
 * 市民のけがの内わけ(結果画面の小さな1行)。0の理由は書かない。
 * 例:['なぐった1', 'まきぞえ2', 'ワルにやられた1', 'さらわれた1', '物が落ちた1'] を '・' でつなぐ
 */
export function hurtBreakdown(
  s: Pick<StageStats, 'civHurtByHero' | 'civHurtByCollateral' | 'civHurtByVillain'>
    & Partial<Pick<StageStats, 'civHurtByAbduction' | 'civHurtByDrop'>>
): string[] {
  return [
    s.civHurtByHero > 0 ? `なぐった${s.civHurtByHero}` : '',
    s.civHurtByCollateral > 0 ? `まきぞえ${s.civHurtByCollateral}` : '',
    s.civHurtByVillain > 0 ? `ワルにやられた${s.civHurtByVillain}` : '',
    (s.civHurtByAbduction ?? 0) > 0 ? `さらわれた${s.civHurtByAbduction}` : '',
    (s.civHurtByDrop ?? 0) > 0 ? `物が落ちた${s.civHurtByDrop}` : ''
  ].filter(Boolean);
}
