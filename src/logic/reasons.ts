// 答え合わせの画面で出す「決め手」の文。その人がワルか市民かを見分けられた手がかりを、短く1行で言う。
// 手がかりの中身は、絵(src/art/world/people.ts、world2/people.ts)の小物と、content.ts / garageContent.ts /
// mallContent.ts のプロフィールと一言に合わせてある(絵や文を変えたら、ここも合わせる)。
// ショッピングモールの宇宙人は動きのくずれ、市民はぎこちない動きの理由、親玉は化けた姿のおかしい所を言う。
// 高層ビルのヴィランはもれの出方、紛らわしい市民はもれに見えたものの理由、ほかの市民は見た目ごとの文、
// 親玉は化けた姿のおかしい所を言う(docs/STAGE4.md「答え合わせ」)。
// 1行は全角14文字まで(答え合わせの画面の幅)。半角スペースとエムダッシュは使わない。
//
// 使い方:reasonFor(person, wave)   // 地下駐車場は同じ波の組を見て、小物の色の文を作る
//        rushSummary(stats.rush)   // タイムセールラッシュのまとめ(波2の答え合わせの最後の1行と、結果画面)
//        liftSummary(stats.rush)   // エレベーターラッシュのまとめ(着いたときと結果画面。答え合わせには出さない)
// 返す文には {#rrggbb}…{/} の色の書き方が入ることがある(小物の色)。字の数は stripReasonMarkup で数える。

import { ACCESSORY_COLORS } from './rules';
import type {
  AlleyDisguise, AlleyLook, GarageDisguise, MallDisguise, MallLook, Person, RushTally, TowerDecoy, TowerDisguise, TowerLook, Truth, Wave
} from './types';

/** 1行に入る字の数(全角) */
export const REASON_MAX = 14;

/** 路地裏の見た目と正体ごとの決め手(出てこない組み合わせは書かない) */
const ALLEY_REASONS: Readonly<Record<AlleyLook, Partial<Record<'bad' | 'civ', string>>>> = {
  // ワル:後ろのポケットから黄色いナイフの柄。市民:同じ場所に茶色い財布
  hoodie: { bad: 'ポケットに黄色いナイフの柄', civ: 'ポケットの茶色い物は財布' },
  // ワル:赤い女物のバッグを抱える。市民:金色の腕時計を見てあせる
  suit: { bad: '赤い女物のバッグを抱えていた', civ: '金色は腕時計。会議に遅れそう' },
  // ワル:袋から金色の財布と腕時計。市民:袋から白い米袋
  shopper: { bad: '袋に金色の財布。人の物だった', civ: 'のぞいていたのは白い米袋' },
  mohawk: { bad: 'ナイフを回していた。見たまま' },
  granny: { civ: '杖をついたふつうのおばあさん' }
};

/** 路地裏のボス:少し背が高く、腕に水色の入れ墨 */
const ALLEY_BOSS_REASONS: Readonly<Record<AlleyDisguise, string>> = {
  suit: 'スーツがぱつぱつ。腕に入れ墨',
  granny: '肩幅が広い。腕に水色の入れ墨',
  shopper: '重い袋を小指で。腕に入れ墨'
};

/** 地下駐車場の女ボス:どこか1か所おかしい所(docs/STAGE2.md)と、金色の小物 */
const GARAGE_BOSS_REASONS: Readonly<Record<GarageDisguise, string>> = {
  guard: '夜なのにサングラス。金の腕章',
  mechanic: 'つなぎにヒール。金のタオル',
  officelady: 'ギラギラの金の腕輪とスカーフ'
};

/** ショッピングモールの見た目と正体ごとの決め手。宇宙人はくずれ、市民はぎこちない動きの理由 */
export const MALL_REASONS: Readonly<Record<MallLook, Record<'bad' | 'civ', string>>> = {
  mascot: { bad: '着ぐるみの首が一回転', civ: '前が見えずにふらついた' },
  clerk: { bad: 'まばたきが横に閉じた', civ: '寝不足でかくっとなった' },
  dancer: { bad: '腕がのびて戻った', civ: 'ダンスの練習でカクカク' },
  uncle: { bad: '体の色がちらついた', civ: '腰をさすっていただけ' }
};

/** ショッピングモールの親玉:化けた姿のどこか1か所おかしい所(docs/STAGE3.md) */
const MALL_BOSS_REASONS: Readonly<Record<MallDisguise, string>> = {
  clerk: '店員なのに名札が逆さ',
  uncle: 'おじさんの耳がとがっていた',
  mascot: '着ぐるみから触角'
};

/** 高層ビルの、もれに見えるものがなかった市民の決め手(見た目ごと。docs/STAGE4_TEXT.md) */
export const TOWER_CIV_REASONS: Readonly<Record<TowerLook, string>> = {
  florist: '花を運んでいただけ',
  courier: '荷物を届けていただけ',
  newbie: '新人でそわそわしていた',
  janitor: '掃除をしていただけ',
  chef: '味見をしていただけ',
  waiter: '給仕をしていただけ',
  lady: 'パーティのお客さん',
  magician: 'ただの手品師'
};

/** 高層ビルの紛らわしい市民の決め手(もれに見えたものの理由) */
export const TOWER_DECOY_REASONS: Readonly<Record<TowerDecoy, string>> = {
  flicker: '蛍光灯が切れかけだった',
  thread: '手品の糸で吊っていた',
  balloon: '風船がのっていただけ'
};

/** 高層ビルのヴィランの決め手(もれの出方) */
export const TOWER_LEAK_REASONS = {
  both: '照明と小物が両方変',
  light: '照明が紫に光っていた',
  item: '机の小物が浮いていた'
} as const;

/** 高層ビルの親玉:化けた姿のどこか1か所おかしい所(docs/STAGE4.md) */
const TOWER_BOSS_REASONS: Readonly<Record<TowerDisguise, string>> = {
  lady: '羽の飾りが金色だった',
  magician: 'つえの先がビルの形',
  waiter: '蝶ネクタイが金色だった'
};

/** ボスの決め手(全部のステージ。化けた姿の名前はステージの間で重ならない) */
const BOSS_REASONS: Readonly<Record<string, string>> = {
  ...ALLEY_BOSS_REASONS,
  ...GARAGE_BOSS_REASONS,
  ...MALL_BOSS_REASONS,
  ...TOWER_BOSS_REASONS
};

/** 高層ビルの人の決め手。ヴィランはもれの出方、紛らわしい市民はその理由、ほかの市民は見た目ごと */
function towerReason(p: Person): string {
  if (p.truth === 'bad') {
    const leak = p.leak ?? { light: true, item: true };
    if (leak.light && leak.item) return TOWER_LEAK_REASONS.both;
    return leak.light ? TOWER_LEAK_REASONS.light : TOWER_LEAK_REASONS.item;
  }
  if (p.decoy) return TOWER_DECOY_REASONS[p.decoy];
  return TOWER_CIV_REASONS[p.look as TowerLook];
}

/** 色の書き方。暗い地(はずれの行の赤黒)でも読めるように、小物の色を少し白に寄せる */
function colorTag(c: number): string {
  const ch = (sh: number): number => Math.round(((c >> sh) & 255) * 0.7 + 255 * 0.3) << sh;
  return `{#${(ch(16) | ch(8) | ch(0)).toString(16).padStart(6, '0')}}`;
}

/**
 * 地下駐車場の決め手。ギャングは組の仲間とおそろいの色。
 * 市民は、同じ波のどこかの組と色がたまたま同じなら「偶然」、ちがえば「その色の仲間も合図もない」
 */
function garageReason(p: Person, wave: Pick<Wave, 'groups'> | undefined): string {
  const acc = p.accessory;
  if (!acc) return p.truth === 'bad' ? '指で仲間に合図していた' : '合図はしていなかった';
  // 色の名前は小物の色で書く
  const tag = colorTag(ACCESSORY_COLORS[acc.id]?.color ?? acc.color);
  const color = `${tag}${acc.name}{/}`;
  if (p.truth === 'bad') {
    // 長くなるとき(オレンジのヘアバンド)は色の名前を省き、小物の名前をその色で書く
    const text = `仲間と同じ${color}の${acc.item}`;
    return stripReasonMarkup(text).length <= REASON_MAX ? text : `${tag}${acc.item}{/}が仲間と同じ色`;
  }
  const sameAsGang = (wave?.groups ?? []).some((g) => g.accessory.id === acc.id);
  return sameAsGang ? `${color}は偶然。合図なし` : `${color}の仲間も合図もない`;
}

/** その人の決め手の文 */
export function reasonFor(p: Person, wave?: Pick<Wave, 'groups'>): string {
  if (p.truth === 'boss') return BOSS_REASONS[p.disguise ?? p.look] ?? '背が高く、どこかおかしい';
  const alley = (ALLEY_REASONS as Record<string, Partial<Record<Truth, string>>>)[p.look];
  if (alley) return alley[p.truth] ?? '';
  const mall = (MALL_REASONS as Record<string, Partial<Record<Truth, string>>>)[p.look];
  if (mall) return mall[p.truth] ?? '';
  if (p.look in TOWER_CIV_REASONS) return towerReason(p);
  return garageReason(p, wave);
}

/**
 * タイムセールラッシュのまとめの1行。例:'セール：撃破3/4・守った2/4'
 * (撃破は倒した宇宙人/宇宙人の数、守ったは待てで守った市民/市民の数)
 */
export function rushSummary(t: Pick<RushTally, 'aliens' | 'aliensDefeated' | 'civs' | 'civsSaved'>): string {
  return `セール：撃破${t.aliensDefeated}/${t.aliens}・守った${t.civsSaved}/${t.civs}`;
}

/**
 * エレベーターラッシュのまとめの1行。例:'エレベーター：撃破2/3・守った3/3'
 * (撃破は倒したヴィラン/ヴィランの数、守ったは待てで守った市民/市民の数)。
 * 数は StatsTracker のラッシュの数を使う(aliens はヴィランの数として数える。stats.startRush({ alienCount: plan.villainCount, civCount }))。
 * 答え合わせには出さないので、14文字の決まりの外(着いたときの帯と結果画面の数字の窓に出す)
 */
export function liftSummary(t: Pick<RushTally, 'aliens' | 'aliensDefeated' | 'civs' | 'civsSaved'>): string {
  return `エレベーター：撃破${t.aliensDefeated}/${t.aliens}・守った${t.civsSaved}/${t.civs}`;
}

/** 色の書き方を取りのぞく(字の数を数えるとき用) */
export const stripReasonMarkup = (s: string): string => s.replace(/\{(\/|#[0-9a-fA-F]{6})\}/g, '');
