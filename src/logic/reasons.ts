// 答え合わせの画面で出す「決め手」の文。その人がワルか市民かを見分けられた手がかりを、短く1行で言う。
// 手がかりの中身は、絵(src/art/world/people.ts、world2/people.ts)の小物と、content.ts / garageContent.ts の
// プロフィールと一言に合わせてある(絵や文を変えたら、ここも合わせる)。
// 1行は全角14文字まで(答え合わせの画面の幅)。半角スペースとエムダッシュは使わない。
//
// 使い方:reasonFor(person, wave)   // 地下駐車場は同じ波の組を見て、小物の色の文を作る
// 返す文には {#rrggbb}…{/} の色の書き方が入ることがある(小物の色)。字の数は stripReasonMarkup で数える。

import { ACCESSORY_COLORS } from './rules';
import type { AlleyDisguise, AlleyLook, GarageDisguise, Person, Truth, Wave } from './types';

/** 1行に入る字の数(全角) */
export const REASON_MAX = 14;

/** 路地裏の見た目と正体ごとの決め手(出てこない組み合わせは書かない) */
export const ALLEY_REASONS: Readonly<Record<AlleyLook, Partial<Record<'bad' | 'civ', string>>>> = {
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
export const ALLEY_BOSS_REASONS: Readonly<Record<AlleyDisguise, string>> = {
  suit: 'スーツがぱつぱつ。腕に入れ墨',
  granny: '肩幅が広い。腕に水色の入れ墨',
  shopper: '重い袋を小指で。腕に入れ墨'
};

/** 地下駐車場の女ボス:どこか1か所おかしい(garageContent の BOSS2_ODD_POINT)と、金色の小物 */
export const GARAGE_BOSS_REASONS: Readonly<Record<GarageDisguise, string>> = {
  guard: '夜なのにサングラス。金の腕章',
  mechanic: 'つなぎにヒール。金のタオル',
  officelady: 'ギラギラの金の腕輪とスカーフ'
};

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
  if (p.truth === 'boss') {
    const d = p.disguise ?? p.look;
    return (ALLEY_BOSS_REASONS as Record<string, string>)[d] ?? (GARAGE_BOSS_REASONS as Record<string, string>)[d] ?? '背が高く、どこかおかしい';
  }
  const alley = (ALLEY_REASONS as Record<string, Partial<Record<Truth, string>>>)[p.look];
  if (alley) return alley[p.truth] ?? '';
  return garageReason(p, wave);
}

/** 色の書き方を取りのぞく(字の数を数えるとき用) */
export const stripReasonMarkup = (s: string): string => s.replace(/\{(\/|#[0-9a-fA-F]{6})\}/g, '');
