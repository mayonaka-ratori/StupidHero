// 数字の書き方。金額(¥3万、¥2,400万、¥1億2,000万)と、被害額のたとえ(「自販機30台分」)。

import { PROP_COST } from './rules';

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

export type AnalogyUnit = 'vending' | 'car' | 'house';

/**
 * たとえに使う物の値段と数え方。自販機と車は壊れる物の表と同じ値段。
 * 一軒家は¥3,000万とした(自販機や車と同じく、ざっくり分かりやすい額)。
 */
export const ANALOGY_UNITS: Readonly<Record<AnalogyUnit, { name: string; price: number; counter: string }>> = {
  vending: { name: '自販機', price: PROP_COST.vending, counter: '台' },
  car: { name: '車', price: PROP_COST.car, counter: '台' },
  house: { name: '一軒家', price: 30_000_000, counter: '軒' }
};

/**
 * どの物でたとえるか。数が10〜40くらいに収まるように切りかえる。
 * ¥3,000万未満は自販機(〜37台)、¥3億未満は車(10〜100台)、それより上は一軒家(10軒〜)。
 */
export function analogyUnitFor(yen: number): AnalogyUnit {
  if (yen < 30_000_000) return 'vending';
  if (yen < 300_000_000) return 'car';
  return 'house';
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

/** 被害額のたとえ。例:24000000 → { unit: 'vending', count: 30, text: '自販機30台分' } */
export function damageAnalogy(yen: number): DamageAnalogy {
  if (yen <= 0) return { unit: null, count: 0, text: '被害ゼロ' };
  const unit = analogyUnitFor(yen);
  const def = ANALOGY_UNITS[unit];
  const raw = yen / def.price;
  const countText = formatCount(raw);
  return { unit, count: Number(countText.replace(/,/g, '')), text: `${def.name}${countText}${def.counter}分` };
}

/** 被害額とたとえをまとめて書く。例:'¥2,400万(自販機30台分)' */
export function formatDamage(yen: number): string {
  return `${formatYen(yen)}(${damageAnalogy(yen).text})`;
}

/**
 * 秒数を書く(小数1けた、切り上げ)。例:4.23 → '4.3秒'、5 → '5.0秒'。
 * 切り上げにしておくと「5.0秒」と出たときは必ず「5秒以内」の称号の条件に入る
 */
export function formatSeconds(sec: number): string {
  return `${(Math.ceil(sec * 10 - 1e-9) / 10).toFixed(1)}秒`;
}
