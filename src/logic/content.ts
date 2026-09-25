// ゲームに出る日本語の文章をまとめたもの。
// 決まり:1行は全角12文字まで、1つのセリフは2行まで(改行は \n)。半角スペースとエムダッシュは使わない。
// 2人の名前はまだ決まっていないので、文の中で名前を呼ばない。
// ヒーローは元気で大げさで自信満々、オペレーターはため口でツッコむ幼なじみ。
// ステージ2(地下駐車場)の文は garageContent.ts、ステージ3(ショッピングモール)の文は mallContent.ts、
// ステージ4(高層ビル)の文は towerContent.ts にあり、ここの一覧と関数にまとめて入れている。
//
// 使い方(ステージの id を渡すと、そのステージの文が出る):
//   introFor(stage.id)                       // ステージ前の掛け合い(そのステージで1回だけ。見たか遊んだら出さない)
//   waveIntroFor(stage.id, wave.no)          // 波の始まりの一言
//   say('bossReveal', rng, stage.id)         // 結果発表とボス戦。地下駐車場だけの種類('gathered' など)、
//                                            // ショッピングモールだけの種類('ufoBeam' など)もこれで出す
//   mischiefLine(person.look, rng)           // 悪さを始めた一言(ギャングは口笛で仲間を呼ぶ一言、宇宙人は空へ合図する一言)
//   streetTextsFor(stage.id)                 // 結果発表の帯と本性ちらりの文(宇宙人は「ピピッ…」)
//   rushIntroFor(seen) / rushEndLine(tally)  // タイムセールラッシュの説明と終わりの一言(ステージ3)
//   liftIntroFor(seen) / liftEndLine(tally)  // エレベーターラッシュの説明と着いたときの一言(ステージ4)

import {
  BOSS2_HINTS, BOSS2_PROFILE_LINES, GARAGE_AGES, GARAGE_JUDGE_LINES, GARAGE_INTRO, GARAGE_NAMES,
  GARAGE_OPERATOR_HINTS, GARAGE_OVERRIDES, GARAGE_PROFILE_LINES, GARAGE_REACTIONS, GARAGE_TITLE_COMMENTS,
  GARAGE_TITLE_COMMENT_OVERRIDES, GARAGE_WAVE_INTRO, allLinkTexts, type GarageReactionKey
} from './garageContent';
import {
  BOSS3_HINTS, BOSS3_PROFILE_LINES, MALL_AGES, MALL_GARAGE_OVERRIDES, MALL_INTRO, MALL_JUDGE_LINES, MALL_NAMES,
  MALL_OPERATOR_HINTS, MALL_OVERRIDES, MALL_PROFILE_LINES, MALL_REACTIONS, MALL_STREET_TEXTS, MALL_TITLE_COMMENTS,
  MALL_TITLE_COMMENT_OVERRIDES, MALL_WAVE_INTRO, RUSH_BAND, RUSH_INTRO_AGAIN, RUSH_INTRO_FIRST, type MallReactionKey
} from './mallContent';
import {
  BOSS4_HINTS, BOSS4_PROFILE_LINES, LIFT_BAND, LIFT_INTRO_AGAIN, LIFT_INTRO_FIRST, TOWER_AGES, TOWER_ENDING, TOWER_ENDING_SKIP,
  TOWER_FLOOR_LABELS, TOWER_GARAGE_OVERRIDES, TOWER_INTRO, TOWER_JUDGE_LINES, TOWER_NAMES, TOWER_OPERATOR_HINTS, TOWER_OVERRIDES,
  TOWER_PROFILE_LINES, TOWER_REACTIONS, TOWER_STREET_TEXTS, TOWER_TITLE_COMMENTS, TOWER_TITLE_COMMENT_OVERRIDES, TOWER_WAVE_INTRO,
  type TowerReactionKey
} from './towerContent';
import { ANALOGY_UNITS } from './format';
import { allFreeTexts } from './freeContent';
import { ACCESSORY_COLORS, ACCESSORY_ITEM, MISCHIEF_BY_LOOK } from './rules';
import { STAGES } from './stages';
import type { Rng } from './rng';
import type {
  AlleyDisguise, AlleyLook, AttackKind, DisguiseLook, FreeVillainLook, Look, OperatorHint, RushTally, Speech, StageId,
  TitleId, WaveNo
} from './types';
import { hero, hint, op } from './speech';


// ─── フリープレイのワル ───────────────────────────
// フリープレイ(docs/FREEPLAY.md)は仕分けの画面を出さないので、プロフィールと一言は
// ほかの表の形を満たすためのかんたんなものにする(ワルの文だけ)。

/** フリープレイのワルの名前(ほかの見た目と重ならない) */
const FREE_VILLAIN_NAMES: Readonly<Record<FreeVillainLook, readonly string[]>> = {
  fp_mohawk: [
    '荒木ザン', '剛田バン', '鉄尾ギン', '猛田ライ', '骨川ドク', '爪田ガイ', '針山トゲオ', '刃金ジョウ', '棘本ガク', '鋼田ザック'
  ],
  fp_gang: ['黒田ジョー', '影山テツ', '夜野ダイ', '闇田ユウ', '裏木ケン', '墨田サブ'],
  fp_alien: ['ゾルグ', 'ピポパ', 'ズババ', 'ギギル', 'ノノモ', 'ワポポ', 'ベベロ', 'ムニョン']
};

/** フリープレイのワルの年齢の幅(宇宙人は地球の年齢ではない) */
const FREE_VILLAIN_AGES: Readonly<Record<FreeVillainLook, readonly [number, number]>> = {
  fp_mohawk: [19, 29],
  fp_gang: [20, 35],
  fp_alien: [120, 300]
};

/** フリープレイのワルのプロフィールの一文(見た目で分かるワルなので、かくさない) */
const FREE_VILLAIN_PROFILE_LINES: Readonly<Record<FreeVillainLook, { bad: readonly string[] }>> = {
  fp_mohawk: { bad: ['ナイフを\n見せびらかしたい', '今日も\nトゲトゲ頭', '財布を\nさがしている'] },
  fp_gang: { bad: ['バットは\n野球用ではない', '顔を見られたくない', '口笛で\n仲間を呼べる'] },
  fp_alien: { bad: ['地球の\n見学に来た', '触角は\n本物', 'UFOを\n近くに止めている'] }
};

/** フリープレイのワルのオペレーターの一言 */
const FREE_VILLAIN_HINTS: Readonly<Record<FreeVillainLook, { bad: readonly OperatorHint[] }>> = {
  fp_mohawk: { bad: [hint('panic', 'ナイフ持ってる！'), hint('deadpan', 'どう見ても\nワルだよね'), hint('panic', 'ナイフを\n振り回してる！')] },
  fp_gang: { bad: [hint('panic', 'バット持ってる！'), hint('deadpan', '顔を\n隠してるね'), hint('normal', '口笛の練習\nしてる…')] },
  fp_alien: { bad: [hint('panic', '触角が\n出てる！'), hint('deadpan', '肌、緑だよね'), hint('normal', '空ばかり\n見てる')] }
};

/** フリープレイのワルに向かうときの決めつけ(ほかの見た目と同じく「ワルで間違いない!」で終わる) */
const FREE_VILLAIN_JUDGE_LINES: Readonly<Record<FreeVillainLook, readonly Speech[]>> = {
  fp_mohawk: [hero('smug', 'ナイフを持ってる！\nワルで間違いない！'), hero('smug', 'トゲトゲ頭！\nワルで間違いない！')],
  fp_gang: [hero('smug', 'バットを持ってる！\nワルで間違いない！'), hero('smug', '顔を隠してる！\nワルで間違いない！')],
  fp_alien: [hero('smug', '触角が出てる！\nワルで間違いない！'), hero('smug', '肌が緑色！\nワルで間違いない！')]
};

// ─── プロフィール ─────────────────────────────────

/** 見た目ごとの名前。市民とワルで同じ一覧を使う(名前で見分けられないように) */
export const NAMES: Readonly<Record<Look, readonly string[]>> = {
  hoodie: ['山本タクミ', '木村リョウ', '林ユウキ', '清水ダイチ', '森カズヤ', '池田ショウ', '石井レン', '斉藤ハヤト', '松田コウ', '前田ソウタ'],
  suit: ['田中誠', '鈴木健一', '高橋修', '渡辺浩二', '伊藤隆', '中村聡', '小林徹', '加藤正樹', '吉田稔', '山下亮'],
  shopper: ['松本由美', '井上恵子', '佐々木陽子', '山口直美', '岡田久美', '長谷川幸', '藤田真理', '後藤明美', '村田京子', '原田里香'],
  mohawk: ['鬼塚リュウジ', '権田ゴウ', '黒岩ダン', '毒島ケン', '赤城トオル', '牙野ジン'],
  granny: ['梅田ハナ', '松井トメ', '竹内キヨ', '菊池フミ', '小川ウメ', '杉山チヨ', '野口タマ', '村上シズ', '大野スエ', '今井キク'],
  ...GARAGE_NAMES,
  ...MALL_NAMES,
  ...TOWER_NAMES,
  ...FREE_VILLAIN_NAMES
};

/** 見た目ごとの年齢の幅(両端を含む)。市民とワルで同じ */
export const AGES: Readonly<Record<Look, readonly [number, number]>> = {
  hoodie: [17, 28],
  suit: [28, 54],
  shopper: [32, 61],
  mohawk: [19, 27],
  granny: [71, 89],
  ...GARAGE_AGES,
  ...MALL_AGES,
  ...TOWER_AGES,
  ...FREE_VILLAIN_AGES
};

/**
 * 市民にもワルにも出るプロフィールの一文(どちらにも本当のこと)。
 * これが出た人は、文だけでは決められない。見た目、動き、一言、「持ち物」の窓と合わせて決める
 */
export const BOTH_PROFILE_LINES: Readonly<Record<'hoodie' | 'suit' | 'shopper', readonly string[]>> = {
  hoodie: [
    '路地裏は\nよく通る',
    'ポケットに\n手を入れるくせがある',
    'パーカーは\n三枚持っている'
  ],
  suit: [
    'スーツは\n毎日同じ',
    '今日は\n忙しい一日だった',
    'この辺の道は\nよく知っている'
  ],
  shopper: [
    '袋はいつも\nぱんぱん',
    '商店街には\n毎日来る',
    '重い袋にも\nもう慣れた'
  ]
};

/**
 * プロフィールの一文。嘘は書かないが、どちらとも取れる。
 * 市民とワルで似た言い回しを並べ、どちらの一覧にも見た目や動きの手がかりに合う言葉を混ぜる。
 * 組の見た目(パーカー、スーツ、買い物袋)には、どちらにも出る文(BOTH_PROFILE_LINES)も入れる
 */
export const PROFILE_LINES: Readonly<Record<Look, { civ?: readonly string[]; bad?: readonly string[] }>> = {
  hoodie: {
    // 市民:ポケットに財布。ポケットに手を入れて待つ
    civ: [
      'ポケットの中身は\n今月の全財産',
      '人を待っている。\n相手はまだ来ない',
      '夜の散歩が好き。\n路地裏は近道',
      '手ぶらに見えるが\n必要な物は持っている',
      '最近、財布を\n新しくした',
      'バイト帰り。\n今日は給料日',
      ...BOTH_PROFILE_LINES.hoodie
    ],
    // ワル:ポケットからナイフの柄。ポケットを押さえてキョロキョロ
    bad: [
      'ポケットの中身は\n見せたくない',
      '待ち合わせ中。\n相手は決めてない',
      '夜の路地裏に\nくわしい',
      '手ぶらに見えるが\nそうでもない',
      '最近、よく\n後ろをふり返る',
      '今日は\n稼ぎどきらしい',
      ...BOTH_PROFILE_LINES.hoodie
    ]
  },
  suit: {
    // 市民:腕時計を見てあせる
    civ: [
      '会議に遅れそう。\n走るしかない',
      '時間には\nうるさい方',
      '大事な物を\n届けるところ',
      '今日は朝から\n走りっぱなし',
      '家族には\n頭が上がらない',
      '路地裏は近道。\n急いでいる',
      ...BOTH_PROFILE_LINES.suit
    ],
    // ワル:女物のバッグを抱えている。バッグを抱え直して後ろを気にする
    bad: [
      '急ぐ理由は\n人に言えない',
      '後ろが\n気になる性分',
      '大事な物を\n運んでいるところ',
      '今日は朝から\n走りっぱなし',
      '赤い物が好き。\n最近手に入れた',
      '荷物が多いのは\n慣れている',
      ...BOTH_PROFILE_LINES.suit
    ]
  },
  shopper: {
    // 市民:袋から米袋がのぞく。袋を持ち直す
    civ: [
      '今日は特売日。\n買いすぎた',
      '袋の中身は\n家族の一週間分',
      '重い物を持つのは\n得意',
      'この辺の店は\nだいたい知ってる',
      '買い物は\n早い者勝ち',
      '袋は二重にする派',
      ...BOTH_PROFILE_LINES.shopper
    ],
    // ワル:袋から財布や腕時計がのぞく。袋の口を手でふさぐ
    bad: [
      '今日は大漁。\n持ちきれない',
      '袋の中身は\nひみつ',
      'キラキラした物が\n好き',
      'この辺の人は\nだいたい知ってる',
      '財布はいくつ\nあっても困らない',
      '人ごみが好き。\n用事はすぐ済む',
      ...BOTH_PROFILE_LINES.shopper
    ]
  },
  mohawk: {
    // 一目でワル(波1の練習用)
    bad: [
      'ナイフ集めが趣味',
      '好きな言葉は\n「よこせ」',
      'この辺で一番\n強い(自称)',
      '髪のセットに\n毎朝二時間',
      'ひったくり歴\n十年',
      '市民はカモだと\n思っている'
    ]
  },
  granny: {
    // 市民だけ。腰をたたく
    civ: [
      '腰は痛いが\n散歩は毎日',
      '孫にお小遣いを\n届けるところ',
      '杖は\n三本目',
      '若いころは\n町内の人気者',
      '路地裏の猫に\nエサをやっている',
      '最近、耳が遠い。\n目はいい'
    ]
  },
  // ステージ2(garageContent.ts)
  ...GARAGE_PROFILE_LINES,
  // ステージ3(mallContent.ts)
  ...MALL_PROFILE_LINES,
  // ステージ4(towerContent.ts)
  ...TOWER_PROFILE_LINES,
  ...FREE_VILLAIN_PROFILE_LINES
};

/**
 * ボスの化けた姿のプロフィール。どれも「どこか1か所おかしい」と気づける一文にする
 * (路地裏のボスは、少し背が高く、腕に水色の入れ墨がのぞく。地下駐車場の女ボスは garageContent.ts)。
 */
const ALLEY_BOSS_PROFILE_LINES: Readonly<Record<AlleyDisguise, readonly string[]>> = {
  suit: [
    'スーツが最近\nきつくなってきた',
    'この辺の店には\n顔がきく',
    '部下は\n多い方だ',
    '会社で一番\n背が高い'
  ],
  granny: [
    '若いころは\nこの辺で有名だった',
    '毎朝、腕立てを\n百回している',
    '孫みたいな子分…\nいや、孫が大勢いる',
    '杖は重い方が\n好き'
  ],
  shopper: [
    '買い物袋は\n片手で三つ持てる',
    'この辺の店は\nみんな言いなり',
    '最近、服が\n小さく感じる',
    '力仕事なら\nまかせてほしい'
  ]
};

/** ボスの化けた姿のプロフィール(全部のステージ) */
export const BOSS_PROFILE_LINES: Readonly<Record<DisguiseLook, readonly string[]>> = {
  ...ALLEY_BOSS_PROFILE_LINES,
  ...BOSS2_PROFILE_LINES,
  ...BOSS3_PROFILE_LINES,
  ...BOSS4_PROFILE_LINES
};

// ─── オペレーターの一言(仕分け中) ────────────────

/**
 * オペレーターの一言。嘘はつかないが、どちらとも取れる言い方にする。
 * SPECの表の一言(「ポケットがふくらんでる…」など)は市民にもワルにも入れる。
 * 顔は文だけで決める(同じ文はいつも同じ顔)。組の見た目は、市民とワルで顔の数をそろえる
 * (あわてた顔が出たらワル、のように顔だけで分からないように)
 */
export const OPERATOR_HINTS: Readonly<Record<Look, { civ?: readonly OperatorHint[]; bad?: readonly OperatorHint[] }>> = {
  hoodie: {
    civ: [
      hint('normal', 'ポケットが\nふくらんでる…'),
      hint('normal', 'ずっと手を\nポケットに入れてる'),
      hint('normal', '誰かを\n待ってるみたい'),
      hint('deadpan', '落ち着いてる…\nように見える'),
      hint('normal', '茶色い物が\nちらっと見えた'),
      hint('panic', 'ポケットの中、\n何が入ってるの！？')
    ],
    bad: [
      hint('normal', 'ポケットが\nふくらんでる…'),
      hint('normal', 'ポケットを\n押さえてるね'),
      hint('normal', 'さっきから\nキョロキョロしてる'),
      hint('deadpan', '落ち着きが\nないような…'),
      hint('normal', '黄色い物が\nちらっと見えた'),
      hint('panic', 'ポケットの中、\n何が入ってるの！？')
    ]
  },
  suit: {
    civ: [
      hint('normal', 'さっきから\nずっと走ってる'),
      hint('normal', '時計ばっかり\n見てる'),
      hint('panic', 'すごく\nあせってるね'),
      hint('normal', '金色の物が\nちらっと見えた'),
      hint('deadpan', '汗びっしょり…')
    ],
    bad: [
      hint('normal', 'さっきから\nずっと走ってる'),
      hint('normal', '後ろばっかり\n気にしてる'),
      hint('panic', 'すごく\nあせってるね'),
      hint('normal', '赤い物が\nちらっと見えた'),
      hint('deadpan', '荷物を\n大事そうに抱えてる')
    ]
  },
  shopper: {
    civ: [
      hint('normal', '袋がやけに\n重そう'),
      hint('normal', '袋を何度も\n持ち直してる'),
      hint('normal', '白い物が\nのぞいてる'),
      hint('normal', '買い物帰り\nかな？'),
      hint('deadpan', '袋、\nはち切れそう'),
      hint('panic', '袋から何か\n落ちそう！')
    ],
    bad: [
      hint('normal', '袋がやけに\n重そう'),
      hint('normal', '袋の口を\n押さえてるね'),
      hint('normal', '金色の物が\nのぞいてる'),
      hint('normal', '買い物帰り…\nなのかな？'),
      hint('deadpan', '袋、\nはち切れそう'),
      hint('panic', '袋から何か\n落ちそう！')
    ]
  },
  mohawk: {
    bad: [
      hint('deadpan', '見た目どおりだと\n思う'),
      hint('deadpan', '…あれは\n分かるよね？'),
      hint('hype', 'ナイフ回してる。\n練習にちょうどいい'),
      hint('normal', 'うん、あれは\n迷わなくていい')
    ]
  },
  granny: {
    civ: [
      hint('normal', '杖をついてる。\nゆっくりだね'),
      hint('normal', '腰をたたいてる…'),
      hint('normal', 'おばあちゃん…\nだよね？'),
      hint('normal', 'こっちを見て\nにこにこしてる'),
      hint('deadpan', '殴ったら\n一生言われるよ')
    ]
  },
  // ステージ2(garageContent.ts)
  ...GARAGE_OPERATOR_HINTS,
  // ステージ3(mallContent.ts)
  ...MALL_OPERATOR_HINTS,
  // ステージ4(towerContent.ts)
  ...TOWER_OPERATOR_HINTS,
  ...FREE_VILLAIN_HINTS
};

/** ボスの化けた姿の一言。どれも「どこか1か所おかしい」ところを指す */
const ALLEY_BOSS_HINTS: Readonly<Record<AlleyDisguise, readonly OperatorHint[]>> = {
  suit: [
    hint('normal', 'なんか…\n背、高くない？'),
    hint('panic', '腕に何か\n見えた気がする'),
    hint('normal', 'スーツが\nぱつぱつだね'),
    hint('normal', '水色の模様が\nちらっと見えた')
  ],
  granny: [
    hint('normal', 'なんか…\n背、高くない？'),
    hint('panic', '腕に何か\n見えた気がする'),
    hint('normal', 'おばあちゃんにしては\n肩幅が広い…'),
    hint('normal', '水色の模様が\nちらっと見えた')
  ],
  shopper: [
    hint('normal', 'なんか…\n背、高くない？'),
    hint('panic', '腕に何か\n見えた気がする'),
    hint('normal', '重そうな袋を\n小指で持ってる…'),
    hint('normal', '水色の模様が\nちらっと見えた')
  ]
};

/** ボスの化けた姿の一言(全部のステージ) */
export const BOSS_HINTS: Readonly<Record<DisguiseLook, readonly OperatorHint[]>> = {
  ...ALLEY_BOSS_HINTS,
  ...BOSS2_HINTS,
  ...BOSS3_HINTS,
  ...BOSS4_HINTS
};

// ─── ステージ前の掛け合い ─────────────────────────

/**
 * そのステージを初めて遊ぶときの掛け合い。仕分けのやり方だけを短く伝える。上から順に出す。
 * 待てと行けは、結果発表で初めてマークが出たときに教える(ここでは言わない)
 */
export const INTRO: readonly Speech[] = [
  op('normal', '1人ずつ来るよ。ワルは左\n市民は右にスワイプ！'),
  op('normal', '手がかりは見た目、動き\nプロフィール、私の一言'),
  hero('smug', '見分けるのは相棒！\n殴るのは任せて！')
];

/** 波の始まりの一言。上から順に出す */
const WAVE_INTRO: Readonly<Partial<Record<WaveNo, readonly Speech[]>>> = {
  1: [
    op('normal', 'まずは練習。\n5人来るよ'),
    op('normal', '一目で分かる\nワルもいるからね')
  ],
  2: [
    op('normal', '次の5人。\n時間は短めだよ'),
    hero('smug', 'どんと来い！')
  ],
  3: [
    op('panic', '最後の波！\nボスがまぎれてる'),
    op('normal', 'どこか1か所\nおかしい人を探して')
  ]
};

// ─── 結果発表とボス戦 ─────────────────────────────

/** 攻撃ごとの叫び(ヒーロー) */
export const ATTACK_SHOUTS: Readonly<Record<AttackKind, readonly Speech[]>> = {
  charge: [
    hero('smug', '光の突撃ーっ！'),
    hero('smug', '光になって\n突っこむよ！'),
    hero('smug', '突撃ーっ！\nどいてどいて！')
  ],
  punch: [
    hero('smug', '光のパンチ！'),
    hero('smug', '光のパンチ！\nもう一発！'),
    hero('smug', 'くらえっ！\n光のパンチ！')
  ],
  stomp: [
    hero('smug', '踏みつぶし！'),
    hero('smug', '高く跳んで…\n踏みつぶし！'),
    hero('smug', '上から失礼！\nどーん！')
  ],
  special: [
    hero('smug', '必殺技！\nいっけーっ！'),
    hero('smug', '出た！\n必殺技！'),
    hero('smug', '全部まとめて\n吹っ飛べーっ！')
  ]
};

/** 結果発表とボス戦で出るセリフの種類 */
export type ReactionKey =
  | 'sortHurry'      // 残り5秒(オペレーター)
  | 'timeUp'         // 時間切れ(ヒーロー)
  | 'sortDone'       // 仕分けが終わって結果発表へ(ヒーロー)
  | 'teachStop'      // その回で初めて待ての合図が出た:待ての使い方(オペレーター)
  | 'teachGo'        // その回で初めてワルが悪さを始めた:行けの使い方(オペレーター)
  | 'judge'          // ワルにした人に向かうときの決めつけ。見た目の一覧がないとき(ヒーロー。見た目ごとは JUDGE_LINES)
  | 'judgeRight'     // ワルにした人が本当にワルだった:最初から分かってた顔(ヒーロー)
  | 'stubborn'       // ワルにした人が市民だった:謝らずに言いはる(ヒーロー)
  | 'ownFault'       // 言いはるヒーローを見て、仕分けた自分に気づく(オペレーター)
  | 'hitBad'         // ワルを倒した(オペレーター)
  | 'hitBadHero'     // 行けで追いかけたワルを倒した(ヒーロー)
  | 'oops'           // 巻きぞえで市民に当ててしまった:やっちまったー(ヒーロー)
  | 'okay'           // 立ち直る:まあいいか(ヒーロー)
  | 'tsukkomi'       // まあいいか、へのツッコミ。そのステージで1回目(オペレーター)
  | 'tsukkomiShort'  // 同じステージの2回目から(オペレーター)
  | 'hitCiv'         // ヒーローが市民を直接殴った瞬間(オペレーター)
  | 'collateral'     // 巻きぞえで市民に当たった(オペレーター)
  | 'grannyHit'      // おばあさんに当たった(オペレーター)
  | 'specialOnCiv'   // 必殺技が市民に当たった(オペレーター)
  | 'stop'           // 待てで止まった:了解(ヒーロー)
  | 'stopOp'         // 待てで止まったあと(オペレーター)
  | 'stopBad'        // 待てで止めた人が本当はワルだった(オペレーター)
  | 'stopFailBoss'   // ボスに待てを押しても止まらない(ヒーロー)
  | 'go'             // 行けで追いかける(ヒーロー)
  | 'goOp'           // 行けを押したとき(オペレーター)
  | 'pass'           // 手を振って素通り(ヒーロー)
  | 'mischiefHero'   // 素通りした相手が悪さを始めた(ヒーロー)
  | 'escaped'        // ワルに逃げられた(オペレーター)
  | 'bossReveal'     // ワルに仕分けたボスが正体を現した(オペレーター)
  | 'bossRevealHero' // 同じ場面(ヒーロー)
  | 'bossRevealOp2'  // ヒーローの強がりへのツッコミ(オペレーター)
  | 'bossRampage'    // 市民に仕分けたボスが暴れ出した(オペレーター)
  | 'bossRampageHero'// 同じ場面(ヒーロー)
  | 'bossStart'      // ボス戦の始まり(オペレーター)
  | 'bossStartHero'  // ボス戦の始まり(ヒーロー)
  | 'bossIdle'       // 連打が止まってボスが暴れている(オペレーター)
  | 'bossRush'       // 速い連打(オペレーター)
  | 'bossDefeated'   // ボスを倒した(ヒーロー)
  | 'bossDefeatedOp';// ボスを倒した(オペレーター)

export const REACTIONS: Readonly<Record<ReactionKey, readonly Speech[]>> = {
  sortHurry: [op('panic', 'あと5秒！\n急いで！'), op('panic', '時間ないよ！')],
  timeUp: [hero('smug', '時間切れ！\nあとは勘で行く！'), hero('smug', '残りは\n気分で決める！')],
  sortDone: [hero('smug', '仕分け完了！\n行ってくる！'), hero('smug', 'よーし、\n出動！')],
  teachStop: [op('normal', 'ワルにした人だよ。\nちがうと思ったら待て！')],
  teachGo: [op('panic', '悪さを始めた！\n行けで追いかけて！')],
  judge: [
    hero('smug', '目つきが悪い！\nワルで間違いない！'),
    hero('smug', 'オーラが黒い！\nワルで間違いない！'),
    hero('smug', 'ピンときた！\nワルで間違いない！')
  ],
  judgeRight: [
    hero('smug', 'ほらね！\n顔に書いてあった！'),
    hero('smug', 'やっぱり！\n思ったとおり！'),
    hero('smug', 'ほらね！\nひと目で分かった！')
  ],
  stubborn: [
    hero('smug', '目つきは\n悪かった！'),
    hero('smug', 'でも怪しかった！'),
    hero('smug', '顔がワルっぽかった！')
  ],
  ownFault: [
    op('deadpan', '…ワルにしたの、\n私だけど'),
    op('deadpan', '…仕分けたの、\n私だった'),
    op('deadpan', '…ワルの札、\n私がつけたんだった')
  ],
  hitBad: [op('hype', 'ナイス！'), op('hype', 'いいね！\nその調子！'), op('hype', 'よし、\n1人片付いた！')],
  hitBadHero: [hero('smug', '正義の勝利！'), hero('smug', '悪は許さない！')],
  oops: [
    hero('oops', 'やっちまったー！'),
    hero('oops', 'あっ…\nやっちまったー！'),
    hero('oops', 'しまったーっ！\n巻きこんだ！')
  ],
  okay: [
    hero('smile', 'まあいいか！'),
    hero('smile', 'まあいいか！\n次いこ、次！'),
    hero('smile', 'まあいいか！\n元気出していこ！')
  ],
  tsukkomi: [
    op('deadpan', 'まあいいか、\nじゃない！'),
    op('deadpan', 'まあいいか、じゃない！\n市民だよ今の！'),
    op('deadpan', 'まあいいか、じゃない！\nあとで謝って！')
  ],
  tsukkomiShort: [op('deadpan', 'じゃない！'), op('deadpan', 'こら！'), op('deadpan', 'またか！'), op('deadpan', 'ちょっと！')],
  hitCiv: [
    op('panic', 'あっ！\nその人、市民！'),
    op('panic', 'ちょっと！\n市民だってば！'),
    op('panic', '待って！\n今の、市民だよ！')
  ],
  collateral: [
    op('panic', '後ろの人にも\n当たってる！'),
    op('panic', '巻きぞえ！\n関係ない人まで！'),
    op('panic', '今の、奥の人に\n当たったよ！')
  ],
  grannyHit: [op('panic', 'おばあちゃん\nだったのに！'), op('panic', 'よりによって\nおばあちゃん！')],
  specialOnCiv: [op('panic', '必殺技を市民に\n当てないで！'), op('panic', '光線が市民に！\n何してんの！')],
  stop: [hero('smile', '了解！'), hero('smile', '了解！\n止まります！'), hero('smile', 'おっと、了解！')],
  stopOp: [op('normal', 'オッケー、次！'), op('normal', 'はい、次に\n行こう！'), op('normal', 'よし、先に進もう！')],
  stopBad: [op('deadpan', 'あ、ワルだったかも…'), op('deadpan', 'あれ？今の人、\nワルだったかも…')],
  stopFailBoss: [hero('oops', 'えっ、止まれ…\nないっ！'), hero('smug', 'ボスだけは\n待てないよ！')],
  go: [hero('smug', '行ってくる！'), hero('smug', '逃がすかーっ！'), hero('smug', '待てーっ！\n悪党ーっ！')],
  goOp: [op('hype', '行け！'), op('hype', '追いかけて！')],
  pass: [
    hero('smile', 'こんにちは！'),
    hero('smile', '気をつけて\n帰ってね！'),
    hero('smile', 'いい夜だね！'),
    hero('smile', '街の平和は\n任せて！')
  ],
  mischiefHero: [hero('oops', 'あれっ！？\nいい人だと思ったのに！'), hero('oops', 'えっ、\nワルだったの！？')],
  escaped: [op('deadpan', '逃げられた…'), op('deadpan', 'あーあ、\n逃げてった'), op('deadpan', '逃がしたね…')],
  bossReveal: [op('panic', '正体を現した！\nこいつがボスだ！'), op('panic', '出た！\n路地裏のボス！')],
  bossRevealHero: [hero('smug', 'やっぱりね！\n最初から分かってた！'), hero('smug', 'お見通しだよ！')],
  bossRevealOp2: [op('deadpan', '絶対うそでしょ'), op('deadpan', '今気づいたよね')],
  bossRampage: [op('panic', 'ボスだったの！？\n街が壊れてく！'), op('panic', '素通りした人が\nボスだった！')],
  bossRampageHero: [hero('oops', 'えっ、ボス！？\n手を振っちゃった！'), hero('oops', 'いい人そう\nだったのに！')],
  bossStart: [op('hype', '行けを連打！\nぶっ飛ばせ！'), op('hype', '連打、連打！\n行けを押して！')],
  bossStartHero: [hero('smug', 'ラッシュで\n決めるよ！'), hero('smug', 'かかってこい！')],
  bossIdle: [op('panic', '手を止めないで！\n街が壊れてく！'), op('panic', '連打して！\n被害が増えてる！')],
  bossRush: [op('hype', 'いいぞ！\nもっと速く！'), op('hype', 'その調子！\n押しまくれ！')],
  bossDefeated: [hero('smug', '正義は勝つ！'), hero('smug', '見たか！\nこれがヒーロー！')],
  bossDefeatedOp: [op('hype', 'やったー！\nボスを倒した！'), op('hype', '路地裏、\n平和になった！')]
};

/**
 * ワルにした人に向かうときのヒーローの決めつけ。見た目ごと(ステージ2の見た目は garageContent.ts)。
 * 本当に市民かワルかでは変えない(文で分かってしまわないように)。どれも札に合わせた、あと付けの理由
 */
const ALLEY_JUDGE_LINES: Readonly<Record<AlleyLook, readonly Speech[]>> = {
  hoodie: [
    hero('smug', 'ポケットがふくらんでる！\nワルで間違いない！'),
    hero('smug', 'フードがあやしい！\nワルで間違いない！'),
    hero('smug', '手をポケットに入れてる！\nワルで間違いない！')
  ],
  suit: [
    hero('smug', 'すごくあせってる！\nワルで間違いない！'),
    hero('smug', 'ネクタイが曲がってる！\nワルで間違いない！'),
    hero('smug', '走り方があやしい！\nワルで間違いない！')
  ],
  shopper: [
    hero('smug', '袋がパンパン！\nワルで間違いない！'),
    hero('smug', '袋の中身があやしい！\nワルで間違いない！'),
    hero('smug', '買い物しすぎ！\nワルで間違いない！')
  ],
  mohawk: [
    hero('smug', 'トゲトゲ頭！\nワルで間違いない！'),
    hero('smug', 'どう見ても悪そう！\nワルで間違いない！'),
    hero('smug', '髪型がとがってる！\nワルで間違いない！')
  ],
  granny: [
    hero('smug', '杖が武器っぽい！\nワルで間違いない！'),
    hero('smug', '腰のたたき方があやしい！\nワルで間違いない！'),
    hero('smug', 'にこにこしすぎ！\nワルで間違いない！')
  ]
};

/** ワルにした人に向かうときの決めつけ(全部のステージの見た目) */
export const JUDGE_LINES: Readonly<Record<Look, readonly Speech[]>> = {
  ...ALLEY_JUDGE_LINES,
  ...GARAGE_JUDGE_LINES,
  ...MALL_JUDGE_LINES,
  ...TOWER_JUDGE_LINES,
  ...FREE_VILLAIN_JUDGE_LINES
};

/** 結果発表の画面に出る短い文(始まりの帯と、本性ちらりの小さな吹き出し) */
export const STREET_TEXTS = {
  /** 結果発表の始まりの帯 */
  band: '出動！待て・行けの出番',
  /** ワルにした人に向かったとき、本当はワル(ボスも)なら、何かをさっと隠す */
  peekBad: 'サッ…',
  /** 本当は市民なら、小さくおじぎ */
  peekCiv: 'ぺこり'
} as const;

/** ワルが悪さを始めたときの一言(オペレーター)。見た目ごと */
export const MISCHIEF_LINES: Readonly<Record<'hoodie' | 'suit' | 'shopper' | 'mohawk', readonly Speech[]>> = {
  hoodie: [op('panic', 'あっ！\n人を突き飛ばした！'), op('panic', '悪さを始めた！\n行けを押して！')],
  suit: [op('panic', 'あっ！\nバッグをひったくった！'), op('panic', '悪さを始めた！\n行けを押して！')],
  shopper: [op('panic', 'あっ！\n財布を抜き取った！'), op('panic', '悪さを始めた！\n行けを押して！')],
  mohawk: [op('panic', 'あっ！\nナイフで脅してる！'), op('panic', '悪さを始めた！\n行けを押して！')]
};

/** 称号ごとのひとこと(結果画面用) */
export const TITLE_COMMENTS: Readonly<Record<TitleId, Speech>> = {
  flawless: op('hype', '文句なし！\n今日は本物だった！'),
  civNemesis: op('deadpan', '倒れた市民の方が\n多いんだけど'),
  demolition: op('deadpan', '街の修理代、\n誰が払うの…'),
  bossBuddy: op('deadpan', 'ボスに笑顔で\n手を振ってたよね'),
  grannyFoe: op('deadpan', 'おばあちゃんに\n謝りに行くよ'),
  runawayTrain: op('deadpan', '全員倒したけど\n止まる気なかったね'),
  realHero: op('hype', '市民は無傷！\nやるじゃん！'),
  tapProdigy: op('hype', '連打、速すぎ！\n指、大丈夫？'),
  stopMaster: op('normal', '止まれてえらい！\n…私のおかげだけど'),
  chaseDemon: op('normal', '逃げても逃げても\n追いかけてたね'),
  tooKind: op('deadpan', 'やさしいのはいいけど\nワルは逃げたよ'),
  soSo: op('normal', 'まあまあ…\nだったかな'),
  ...GARAGE_TITLE_COMMENTS,
  ...MALL_TITLE_COMMENTS,
  ...TOWER_TITLE_COMMENTS,
  // フリープレイだけの称号(docs/FREEPLAY.md「称号」)。通訳はヒーローが言う
  heroSitter: op('hype', 'おバカ、全部止めたね！'),
  heroInterpreter: hero('smile', 'ぼくの言いたいこと、\n分かってたんだね！'),
  letItBe: op('deadpan', '…もう知らない')
};

// ─── ステージごとの文 ─────────────────────────────

/**
 * 結果発表とボス戦のセリフの種類(全部のステージ)。
 * GarageReactionKey は地下駐車場で足した種類、MallReactionKey はショッピングモールで足した種類、
 * TowerReactionKey は高層ビルで足した種類
 */
export type AnyReactionKey = ReactionKey | GarageReactionKey | MallReactionKey | TowerReactionKey;
export type { GarageReactionKey, MallReactionKey, TowerReactionKey };

/** ステージごとに、路地裏と違う文(stageTexts で引く) */
export interface StageTextSet {
  /** ステージ前の掛け合い */
  intro: readonly Speech[];
  /** 波の始まりの一言 */
  /** 波の始まりの一言。波が3つのステージは4がない */
  waveIntro: Readonly<Partial<Record<WaveNo, readonly Speech[]>>>;
  /** そのステージで足したセリフの種類と、言い方を変えた種類(ReactionKey)。ないものは路地裏の文 */
  reactions: Readonly<Partial<Record<AnyReactionKey, readonly Speech[]>>>;
  /** 言い方を変えた称号のひとこと。ないものは TITLE_COMMENTS */
  titleComments: Readonly<Partial<Record<TitleId, Speech>>>;
}

const GARAGE_TEXTS: StageTextSet = {
  intro: GARAGE_INTRO,
  waveIntro: GARAGE_WAVE_INTRO,
  reactions: { ...GARAGE_REACTIONS, ...GARAGE_OVERRIDES },
  titleComments: GARAGE_TITLE_COMMENT_OVERRIDES
};

const MALL_TEXTS: StageTextSet = {
  intro: MALL_INTRO,
  waveIntro: MALL_WAVE_INTRO,
  // 母艦は女ボスの車と同じ種類(bossCar など)で、言い方だけ変える
  reactions: { ...MALL_REACTIONS, ...MALL_OVERRIDES, ...MALL_GARAGE_OVERRIDES },
  titleComments: MALL_TITLE_COMMENT_OVERRIDES
};

const TOWER_TEXTS: StageTextSet = {
  intro: TOWER_INTRO,
  waveIntro: TOWER_WAVE_INTRO,
  // 親玉を倒してシャンパンタワーに倒れこむ一言(bossWreck)と、開いたときの一言(unlocked)は地下駐車場と同じ種類
  reactions: { ...TOWER_REACTIONS, ...TOWER_OVERRIDES, ...TOWER_GARAGE_OVERRIDES },
  titleComments: TOWER_TITLE_COMMENT_OVERRIDES
};

/** ステージごとの文の表 */
const STAGE_TEXTS: Readonly<Record<StageId, StageTextSet>> = {
  alley: { intro: INTRO, waveIntro: WAVE_INTRO, reactions: {}, titleComments: {} },
  garage: GARAGE_TEXTS,
  mall: MALL_TEXTS,
  tower: TOWER_TEXTS
};

/**
 * 称号のひとことを、ステージに合った言い方で返す(結果画面と共有カード用)。
 * 例:titleCommentFor('demolition', 'garage') は「駐車場の修理代、誰が払うの…」。
 * 言い方を変えていない称号は TITLE_COMMENTS と同じ
 */
export function titleCommentFor(id: TitleId, stageId: StageId = 'alley'): Speech {
  return STAGE_TEXTS[stageId].titleComments[id] ?? TITLE_COMMENTS[id];
}

// ─── 選ぶための関数 ───────────────────────────────

/** 一覧から1つ選ぶ。rng を渡さなければ Math.random で選ぶ */
function pickSpeech(list: readonly Speech[], rng?: Rng): Speech {
  if (list.length === 0) throw new Error('pickSpeech: 空の一覧');
  return rng ? rng.pick(list) : list[Math.floor(Math.random() * list.length)];
}

/**
 * そのステージで使うセリフの一覧。
 * そのステージの文 → 路地裏の文 → ほかのステージで足した種類(例:路地裏の結果画面で出す 'unlocked')の順に探す
 */
export function reactionList(key: AnyReactionKey, stageId: StageId = 'alley'): readonly Speech[] {
  const own = STAGE_TEXTS[stageId].reactions[key];
  if (own) return own;
  const base = (REACTIONS as Partial<Record<AnyReactionKey, readonly Speech[]>>)[key];
  if (base) return base;
  for (const id of Object.keys(STAGE_TEXTS) as StageId[]) {
    const other = STAGE_TEXTS[id].reactions[key];
    if (other) return other;
  }
  throw new Error(`reactionList: 文がない ${key}`);
}

/**
 * 結果発表とボス戦のセリフを1つ選ぶ。例:say('oops', rng)、say('bossReveal', rng, stage.id)。
 * stageId を渡すと、そのステージ用の言い方があればそちらを出す(省略すると路地裏)
 */
export function say(key: AnyReactionKey, rng?: Rng, stageId: StageId = 'alley'): Speech {
  return pickSpeech(reactionList(key, stageId), rng);
}

/** ステージ前の掛け合い */
export function introFor(stageId: StageId): readonly Speech[] {
  return STAGE_TEXTS[stageId].intro;
}

/** 波の始まりの一言 */
export function waveIntroFor(stageId: StageId, no: WaveNo): readonly Speech[] {
  return STAGE_TEXTS[stageId].waveIntro[no] ?? [];
}

/** 攻撃の叫びを1つ選ぶ */
export function shout(kind: AttackKind, rng?: Rng): Speech {
  return pickSpeech(ATTACK_SHOUTS[kind], rng);
}

/**
 * 「まあいいか!」へのツッコミ。nth はそのステージで何回目か(1始まり)。
 * 2回目からは短い版にしてテンポを落とさない。
 */
export function tsukkomi(nth: number, rng?: Rng): Speech {
  return say(nth <= 1 ? 'tsukkomi' : 'tsukkomiShort', rng);
}

/** ワルにした人に向かうときのヒーローの決めつけ。見た目が分からなければ say('judge') と同じ */
export function judgeLine(look: Look | undefined, rng?: Rng): Speech {
  const list = look ? JUDGE_LINES[look] : undefined;
  return list && list.length > 0 ? pickSpeech(list, rng) : say('judge', rng);
}

/**
 * ワルが悪さを始めたときの一言。ステージ2のギャングは口笛で仲間を呼ぶ一言、
 * ステージ3の宇宙人は空へ合図を送る一言、ステージ4のヴィランは念力で物を持ち上げた一言
 */
export function mischiefLine(look: Look, rng?: Rng): Speech {
  const kind = MISCHIEF_BY_LOOK[look];
  if (kind === 'whistle') return pickSpeech(GARAGE_REACTIONS.whistle, rng);
  if (kind === 'signal') return pickSpeech(MALL_REACTIONS.ufoSignal, rng);
  if (kind === 'psychic') return pickSpeech(TOWER_REACTIONS.psyLift, rng);
  // フリープレイのモヒカンは、路地裏のモヒカンと同じ「ナイフで脅す」
  const own = look === 'fp_mohawk' ? 'mohawk' : look;
  const key = own in MISCHIEF_LINES ? (own as keyof typeof MISCHIEF_LINES) : 'hoodie';
  return pickSpeech(MISCHIEF_LINES[key], rng);
}

/**
 * 結果発表の画面に出る短い文(始まりの帯と、本性ちらり)。宇宙人のステージ(仕組みが 'ufo'。ショッピングモール)は
 * 宇宙人のちらりが「ピピッ…」、超能力のステージ(仕組みが 'psychic'。高層ビル)はヴィランのちらりが「フッ…」
 */
export function streetTextsFor(stageId: StageId): { band: string; peekBad: string; peekCiv: string } {
  const mechanic = STAGES[stageId].mechanic;
  if (mechanic === 'ufo') return MALL_STREET_TEXTS;
  if (mechanic === 'psychic') return TOWER_STREET_TEXTS;
  return STREET_TEXTS;
}

/**
 * タイムセールラッシュの始まりの説明(オペレーターのカットイン)。
 * seen はこれまでにラッシュを見たことがあるか(records.ts の hasSeenRush)。初めては2つ、見たことがあれば1つ
 */
export function rushIntroFor(seen: boolean): readonly Speech[] {
  return seen ? RUSH_INTRO_AGAIN : RUSH_INTRO_FIRST;
}

/** タイムセールラッシュが終わったときの一言。市民を全員守れたら「ばっちり!」 */
export function rushEndLine(t: Pick<RushTally, 'civs' | 'civsSaved'>, rng?: Rng): Speech {
  return pickSpeech(t.civsSaved >= t.civs ? MALL_REACTIONS.rushEndGood : MALL_REACTIONS.rushEndBad, rng);
}

/**
 * エレベーターラッシュの始まりの説明(オペレーターのカットイン)。
 * seen はこれまでにエレベーターラッシュを見たことがあるか(records.ts の hasSeenRush('tower'))。初めては2つ、見たことがあれば1つ
 */
export function liftIntroFor(seen: boolean): readonly Speech[] {
  return seen ? LIFT_INTRO_AGAIN : LIFT_INTRO_FIRST;
}

/** エレベーターラッシュで最上階に着いたときの一言。市民を全員守れたら「ばっちり!」 */
export function liftEndLine(t: Pick<RushTally, 'civs' | 'civsSaved'>, rng?: Rng): Speech {
  return pickSpeech(t.civsSaved >= t.civs ? TOWER_REACTIONS.liftEndGood : TOWER_REACTIONS.liftEndBad, rng);
}

/** 高層ビルの波の間に出す階の数字(例 '18F')。towerFloorLabel(wave.no) */
export function towerFloorLabel(no: WaveNo): string {
  return TOWER_FLOOR_LABELS[no];
}

/** content.ts のすべてのセリフと一言の文(文字数の確かめ用) */
export function allTexts(): string[] {
  const out: string[] = [];
  const addList = (l: readonly { text: string }[]): void => { for (const s of l) out.push(s.text); };
  for (const look of Object.keys(PROFILE_LINES) as Look[]) {
    out.push(...(PROFILE_LINES[look].civ ?? []), ...(PROFILE_LINES[look].bad ?? []));
    addList(OPERATOR_HINTS[look].civ ?? []);
    addList(OPERATOR_HINTS[look].bad ?? []);
  }
  for (const d of Object.keys(BOSS_PROFILE_LINES) as DisguiseLook[]) {
    out.push(...BOSS_PROFILE_LINES[d]);
    addList(BOSS_HINTS[d]);
  }
  addList(INTRO);
  for (const list of Object.values(WAVE_INTRO)) addList(list);
  for (const k of Object.keys(ATTACK_SHOUTS) as AttackKind[]) addList(ATTACK_SHOUTS[k]);
  for (const k of Object.keys(REACTIONS) as ReactionKey[]) addList(REACTIONS[k]);
  for (const k of Object.keys(MISCHIEF_LINES) as (keyof typeof MISCHIEF_LINES)[]) addList(MISCHIEF_LINES[k]);
  for (const k of Object.keys(JUDGE_LINES) as Look[]) addList(JUDGE_LINES[k]);
  out.push(...Object.values(STREET_TEXTS));
  addList(Object.values(TITLE_COMMENTS));
  // ステージ2
  addList(GARAGE_INTRO);
  for (const list of Object.values(GARAGE_WAVE_INTRO)) addList(list);
  for (const k of Object.keys(GARAGE_REACTIONS) as GarageReactionKey[]) addList(GARAGE_REACTIONS[k]);
  for (const l of Object.values(GARAGE_OVERRIDES)) addList(l);
  out.push(...allLinkTexts());
  addList(Object.values(GARAGE_TITLE_COMMENT_OVERRIDES));
  // ステージ3
  addList(MALL_INTRO);
  for (const list of Object.values(MALL_WAVE_INTRO)) addList(list);
  for (const k of Object.keys(MALL_REACTIONS) as MallReactionKey[]) addList(MALL_REACTIONS[k]);
  for (const l of Object.values(MALL_OVERRIDES)) addList(l);
  for (const l of Object.values(MALL_GARAGE_OVERRIDES)) addList(l);
  addList(Object.values(MALL_TITLE_COMMENT_OVERRIDES));
  out.push(...Object.values(MALL_STREET_TEXTS), RUSH_BAND);
  addList(RUSH_INTRO_FIRST);
  addList(RUSH_INTRO_AGAIN);
  // ステージ4
  addList(TOWER_INTRO);
  for (const list of Object.values(TOWER_WAVE_INTRO)) addList(list);
  for (const k of Object.keys(TOWER_REACTIONS) as TowerReactionKey[]) addList(TOWER_REACTIONS[k]);
  for (const l of Object.values(TOWER_OVERRIDES)) addList(l);
  for (const l of Object.values(TOWER_GARAGE_OVERRIDES)) addList(l);
  addList(Object.values(TOWER_TITLE_COMMENT_OVERRIDES));
  out.push(...Object.values(TOWER_STREET_TEXTS), LIFT_BAND, ...Object.values(TOWER_FLOOR_LABELS), TOWER_ENDING_SKIP);
  addList(LIFT_INTRO_FIRST);
  addList(LIFT_INTRO_AGAIN);
  addList(TOWER_ENDING);
  // ラッシュのまとめ(rushSummary、liftSummary)と、市民のけがの内わけ(hurtBreakdown)の字(数字は別に読みこむ)
  out.push('セール：撃破・守った', 'エレベーター：', 'さらわれた', '物が落ちた');
  // 被害額のたとえの物の名前(フォントの読みこみ用。数字は別に読みこむ)
  for (const u of Object.values(ANALOGY_UNITS)) out.push(`${u.name}${u.counter}分`);
  // 小物の色と名前(プロフィールの横などに出すとき用)
  for (const c of Object.values(ACCESSORY_COLORS)) out.push(c.name);
  for (const i of Object.values(ACCESSORY_ITEM)) out.push(i.civ, i.bad);
  // フリープレイ(freeContent.ts)
  out.push(...allFreeTexts());
  return out;
}
