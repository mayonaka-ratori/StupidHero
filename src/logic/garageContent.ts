// ステージ2(地下駐車場、ギャング)の日本語の文章。決まりは content.ts と同じ
// (1行は全角12文字まで、2行まで。半角スペースとエムダッシュは使わない。名前は呼ばない)。
// ヒーローは元気で大げさで自信満々、オペレーターはため口でツッコむ幼なじみ。
//
// 画面の担当は、ふつうは content.ts の関数から使う(ステージの id を渡すとここの文が出る):
//   introFor('garage') / waveIntroFor('garage', no) / say('gathered', rng, 'garage') / mischiefLine('guard')
// 名前、年齢、プロフィール、一言は content.ts の NAMES などに入っている(createStage が選ぶ)。
// 前の人とのつながりの文は、createStage が並び順を決めてから linkText() で作る。

import type {
  GangLook, GarageDisguise, OperatorFace, OperatorHint, Speech, WaveNo
} from './types';
import { hero, hint, op } from './speech';


// ─── プロフィール ─────────────────────────────────

/** 見た目ごとの名前。市民とギャングで同じ一覧(名前で見分けられないように) */
export const GARAGE_NAMES: Readonly<Record<GangLook, readonly string[]>> = {
  guard: ['大森剛', '北村勇', '島田力也', '宮本守', '坂本厚志', '平野進', '内田雄三', '横山巌', '荒木鉄男', '上野堅'],
  mechanic: ['工藤ケンジ', '安田マサル', '菅原トシ', '千葉ゴロウ', '久保テツ', '野村ジロー', '岩田ユウジ', '松尾カツ', '桑原シゲル', '服部ノボル'],
  clubber: ['星野ルイ', '桜井キラ', '白石ジュン', '天野レオ', '夏川ミク', '神田ユナ', '南ケイ', '早瀬アオイ', '朝倉リク', '柏木ノア'],
  officelady: ['青木美穂', '西田沙織', '中島綾', '福田香織', '小野寺瞳', '森本麻衣', '関口舞', '三浦千尋', '水野彩花', '河合玲奈']
};

/**
 * 女ボスの年齢の幅。化けているときの名前は、化けた姿の市民と同じ一覧(GARAGE_NAMES)から選ぶ偽名
 * (女性の名前だとすぐ分かってしまうので)。年齢もこの幅と化けた姿の幅の重なりから選ぶ
 */
export const BOSS2_AGES: readonly [number, number] = [34, 46];

/** 見た目ごとの年齢の幅(両端を含む)。市民とギャングで同じ */
export const GARAGE_AGES: Readonly<Record<GangLook, readonly [number, number]>> = {
  guard: [35, 63],
  mechanic: [20, 52],
  clubber: [18, 26],
  officelady: [24, 44]
};

/**
 * プロフィールの一文。嘘は書かないが、どちらとも取れる。市民とギャングで似た言い回しを並べ、
 * どちらにも出る文も入れる(文だけで決まらないように。小物の名前(タオルとバンダナ)でも言い分けない)。
 * 仕分けの画面の動き(sortIdle):ギャングは指で小さな合図、市民は頭をかく、あくび、指を鳴らす など
 */
export const GARAGE_PROFILE_LINES: Readonly<Record<GangLook, { civ: readonly string[]; bad: readonly string[] }>> = {
  guard: {
    civ: [
      '夜勤は十年目。\n眠いのは慣れた',
      '駐車場の見回りが\n仕事',
      '車の持ち主は\nだいたい覚えている',
      '懐中電灯は\n三本持っている',
      '休みの日も\nつい見回りをする',
      '腕章は\n毎朝アイロンがけ',
      '夜の駐車場は\n静かで好き',
      '無線の相手は\nいつも同じ人'
    ],
    bad: [
      '夜勤の日は\nなぜか知り合いが多い',
      '駐車場の出入り口に\nくわしい',
      '車の持ち主は\nだいたい調べてある',
      '無線の相手は\n会社の人…らしい',
      '見回りの道順を\nよく変える',
      '腕章は最近\nもらったばかり',
      '夜の駐車場は\n静かで好き',
      '無線の相手は\nいつも同じ人'
    ]
  },
  mechanic: {
    civ: [
      'この駐車場の車は\nだいたい直した',
      '油のにおいが\nとれない',
      'エンジンの音で\n車の調子が分かる',
      '工具箱は\nいつも持ち歩く',
      '夜中の呼び出しにも\nすぐ来る',
      '首に巻いた布は\n手放せない',
      '車のカギなら\n何本も持っている',
      '夜中の駐車場が\n仕事場'
    ],
    bad: [
      'この駐車場の車は\nだいたい開けられる',
      '油のにおいには\n慣れている',
      'エンジンのかけ方を\n何通りも知っている',
      '工具箱の中身は\n工具だけじゃない',
      '夜中の仕事が\n多い',
      '首に巻いた布は\n手放せない',
      '夜中の駐車場が\n仕事場'
    ]
  },
  clubber: {
    civ: [
      'クラブ帰り。\nまだ耳がキーンとする',
      '車は持ってない。\n友だちの迎え待ち',
      '派手な服は\n目立ちたいから',
      '夜はこれから。\n朝まで遊ぶ',
      'ダンスの大会で\n三位になった',
      '友だちが多い。\nみんな派手',
      'スマホの充電が\nもう切れそう',
      '朝まで\n帰るつもりはない'
    ],
    bad: [
      'クラブ帰り…\nということにしている',
      '車は持ってない。\n乗る車はある',
      '派手な服は\n目立たないため',
      '夜はこれから。\n朝まで仕事',
      'ダンスで\n指先をきたえている',
      '友だちが多い。\nみんな無口',
      'スマホの充電が\nもう切れそう',
      '朝まで\n帰るつもりはない'
    ]
  },
  officelady: {
    civ: [
      '残業帰り。\n車で帰る',
      '手帳は予定で\nびっしり',
      'スカーフは\n母のおさがり',
      '会社では\n経理を担当',
      '駐車場の場所を\nまた忘れた',
      '運転は\nちょっと苦手',
      '駐車場の場所は\nぜんぶ覚えている',
      '今夜は\n大事な約束がある'
    ],
    bad: [
      '残業帰り。\n車は待たせてある',
      '手帳の予定は\n暗号で書く',
      'スカーフは\n最近そろえた',
      '会社では\nお金の係',
      '駐車場の場所は\nぜんぶ覚えている',
      '運転は\n人にまかせる',
      '今夜は\n大事な約束がある'
    ]
  }
};

/**
 * オペレーターの一言。嘘はつかないが、どちらとも取れる言い方にする。
 * 見た目の一言は市民にもギャングにも入れる。ギャングの合図(指)と、市民の似た動き(頭をかく、あくび、指を鳴らす)を言い分ける。
 * あわてた顔(panic)は市民にもギャングにも同じくらい入れ、同じ文はいつも同じ顔にする(顔だけで分からないように)
 */
export const GARAGE_OPERATOR_HINTS: Readonly<Record<GangLook, { civ: readonly OperatorHint[]; bad: readonly OperatorHint[] }>> = {
  guard: {
    civ: [
      hint('normal', '警備員さん…\nだよね？'),
      hint('normal', '腕章をつけてる'),
      hint('deadpan', '眠そう。\nあくびしてる'),
      hint('normal', '頭をかいてる…'),
      hint('normal', 'カギの束を\n持ってる'),
      hint('normal', '無線で\n誰かと話してる'),
      hint('panic', 'あっちの車を\nじっと見てる')
    ],
    bad: [
      hint('normal', '警備員さん…\nだよね？'),
      hint('normal', '腕章をつけてる'),
      hint('normal', '指を動かしてる…？'),
      hint('panic', 'あっちの車を\nじっと見てる'),
      hint('normal', 'カギの束を\n持ってる'),
      hint('normal', '無線で\n誰かと話してる')
    ]
  },
  mechanic: {
    civ: [
      hint('normal', 'つなぎが\n油で真っ黒'),
      hint('normal', '首に何か\n巻いてる'),
      hint('normal', 'スパナを\n持ってる'),
      hint('deadpan', 'あくびしてる…\n夜勤かな'),
      hint('normal', '手をふいてる…？'),
      hint('panic', '車を\nじっと見てる')
    ],
    bad: [
      hint('normal', 'つなぎが\n油で真っ黒'),
      hint('normal', '首に何か\n巻いてる'),
      hint('normal', 'スパナを\n持ってる'),
      hint('normal', '指で何か\nやってる…？'),
      hint('panic', '車を\nじっと見てる'),
      hint('deadpan', '手ぶくろ、\n新品だね')
    ]
  },
  clubber: {
    civ: [
      hint('normal', 'すごく\n派手な服…'),
      hint('normal', 'ヘアバンド\nしてるね'),
      hint('normal', '音楽に合わせて\n指を鳴らしてる'),
      hint('deadpan', 'ノリノリだね…'),
      hint('normal', 'スマホばっかり\n見てる'),
      hint('normal', '誰かを\n探してるみたい'),
      hint('panic', 'まわりを\n気にしてる')
    ],
    bad: [
      hint('normal', 'すごく\n派手な服…'),
      hint('normal', 'ヘアバンド\nしてるね'),
      hint('normal', '指で何か\n合図してる…？'),
      hint('deadpan', 'ノリノリ…\nでもないか'),
      hint('normal', 'スマホばっかり\n見てる'),
      hint('panic', 'まわりを\n気にしてる')
    ]
  },
  officelady: {
    civ: [
      hint('normal', 'スカーフが\nおしゃれ'),
      hint('normal', 'バッグを\n大事そうに持ってる'),
      hint('normal', 'カギを探してる…'),
      hint('deadpan', 'つかれた顔…\n残業かな'),
      hint('normal', '時計を\n気にしてる'),
      hint('normal', '髪をさわってる'),
      hint('panic', '出口の方を\n何度も見てる')
    ],
    bad: [
      hint('normal', 'スカーフが\nおしゃれ'),
      hint('normal', 'バッグを\n大事そうに持ってる'),
      hint('normal', '指先で何か\nしてる…？'),
      hint('panic', '出口の方を\n何度も見てる'),
      hint('normal', '時計を\n気にしてる'),
      hint('deadpan', '落ち着いてる…\nように見える')
    ]
  }
};

/** 女ボスの化けた姿のプロフィール。「どこか1か所おかしい」と気づける一文にする */
export const BOSS2_PROFILE_LINES: Readonly<Record<GarageDisguise, readonly string[]>> = {
  guard: [
    '夜の駐車場でも\nまぶしいのは苦手',
    'この駐車場の\n持ち主の知り合い',
    '人を使うのが\nうまいと言われる',
    '金色の物に\n目がない'
  ],
  mechanic: [
    'つなぎでも\nヒールはゆずれない',
    '車の修理は…\n人にやらせる',
    '油の汚れは\n大きらい',
    '金色の物に\n目がない'
  ],
  officelady: [
    '会社では\n一番えらい…らしい',
    '腕輪は純金。\n安物は着けない',
    '部下が車で\n迎えに来る',
    '金色の物に\n目がない'
  ]
};

/** 女ボスの化けた姿の一言。どれも「どこか1か所おかしい」ところか、金色の小物を指す */
export const BOSS2_HINTS: Readonly<Record<GarageDisguise, readonly OperatorHint[]>> = {
  guard: [
    hint('panic', '夜なのに\nサングラス…？'),
    hint('normal', '腕章が金色…？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('deadpan', '警備員にしては\n貫禄がありすぎ')
  ],
  mechanic: [
    hint('panic', 'つなぎに\nハイヒール…？'),
    hint('normal', 'タオルが\n金色…？'),
    hint('normal', '手がぜんぜん\n汚れてない'),
    hint('deadpan', '整備士にしては\n貫禄がありすぎ')
  ],
  officelady: [
    hint('panic', '腕輪が\nギラギラしてる'),
    hint('normal', 'スカーフが\n金色…？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('deadpan', '会社員にしては\n貫禄がありすぎ')
  ]
};

// ─── 前の人とのつながり ───────────────────────────

/**
 * つながりの文で、その人の小物を指す言葉({item})。整備士は市民がタオル、ギャングがバンダナなので、
 * 名前で正体が分からないように「首の布」とまとめて呼ぶ
 */
const LINK_ITEM_NOUN: Readonly<Record<GangLook, string>> = {
  guard: '腕章',
  mechanic: '首の布',
  clubber: 'ヘアバンド',
  officelady: 'スカーフ'
};

/** 1つの波に出る人数の上限(つながる相手は、その波の何人目か。仕分けの画面の「見た小物」の番号と同じ) */
const MAX_ORDINAL = 7;

/**
 * つながりの文のひな形。{n} に前の人が波の何人目か(「2人目」)、{item} にその人の小物の呼び名が入る。
 * 「さっきの警備員」のような呼び方だと、同じ見た目の人が前に2人いるとどちらか分からないので、番号で呼ぶ。
 * どの文も市民にもギャングにも出す(文だけではどちらか決まらないように)。
 * sameColor:true の文は、前の人と小物の色が本当に同じときだけ使う(嘘にならないように)
 */
export interface LinkTemplate {
  text: string;
  face: OperatorFace;
  sameColor?: boolean;
}

/**
 * オペレーターの一言に出すつながり。文だけで決まらないように、どれも市民にもギャングにも出す
 * (ちがいは相手:ギャングは同じ組の前の仲間、市民は前の誰か)
 */
export const LINK_HINTS: readonly LinkTemplate[] = [
  { face: 'normal', text: '{n}と\n目で合図した？' },
  { face: 'panic', text: '{n}を\n目で追ってる' },
  { face: 'normal', text: '{n}に\nうなずいた…？' },
  { face: 'normal', text: '{n}と\n同じ指輪…？' },
  { face: 'normal', text: '{n}と\n同じ時計してる…' },
  { face: 'normal', text: '{n}と\n同じ車のカギ…？' },
  { face: 'normal', text: '{n}と同じ色の\n{item}…？', sameColor: true },
  { face: 'normal', text: '{n}と\n目が合った？' },
  { face: 'normal', text: '{n}を\nちらっと見た' },
  { face: 'deadpan', text: '{n}と\n同じ駐車券…？' },
  { face: 'panic', text: '{n}から\n目をそらした！' }
];

/** プロフィールに出すつながり(どれも市民にもギャングにも出す) */
export const LINK_PROFILES: readonly LinkTemplate[] = [
  { face: 'normal', text: '{n}とは\n古い付き合い' },
  { face: 'normal', text: '{n}と\n同じ車で来た' },
  { face: 'normal', text: '{n}と\n同じ店の常連' },
  { face: 'normal', text: '{n}とは\n同じマンション' },
  { face: 'normal', text: '{n}と\n同じ会社…らしい' },
  { face: 'normal', text: '{n}とは\n前に会った気がする' }
];

/** 波の中の番号(0始まり)を「2人目」のような呼び方に */
export const ordinalName = (index: number): string => `${index + 1}人目`;

/**
 * つながりの文を作る。targetIndex は相手の波の中の番号(0始まり)、look はこの文が出る人の見た目(小物の呼び名に使う)。
 * 例:linkText(LINK_HINTS[6].text, 0, 'clubber') → '1人目と同じ色の\nヘアバンド…？'
 */
export function linkText(template: string, targetIndex: number, look: GangLook): string {
  return template.replace('{n}', ordinalName(targetIndex)).replace('{item}', LINK_ITEM_NOUN[look]);
}

/** ひな形に番号と見た目を全部入れた文(文字数の確かめとフォントの読みこみ用) */
export function allLinkTexts(): string[] {
  const out = new Set<string>();
  for (const t of [...LINK_HINTS, ...LINK_PROFILES]) {
    for (let i = 0; i < MAX_ORDINAL; i++) {
      for (const look of Object.keys(LINK_ITEM_NOUN) as GangLook[]) out.add(linkText(t.text, i, look));
    }
  }
  return [...out];
}

// ─── ステージ前の掛け合い ─────────────────────────

/** 地下駐車場を最初に遊ぶときの掛け合い(5枚)。新しい手がかり、仲間を呼ぶ、車で逃げる、を教える */
export const GARAGE_INTRO: readonly Speech[] = [
  hero('smug', '次は地下駐車場！\nギャング退治だ！'),
  op('normal', '前の人とおそろいの色\nならギャングの仲間かも'),
  op('deadpan', '色が同じでも市民かも。\n指の合図も見てね'),
  op('normal', '見逃すと口笛で仲間を\n呼ぶ。集まったら行け！'),
  op('panic', '3秒で車に乗って逃げる。\n行けを押せばすぐ止まる！')
];

/** 地下駐車場の波の始まりの一言。上から順に出す */
export const GARAGE_WAVE_INTRO: Readonly<Record<WaveNo, readonly Speech[]>> = {
  1: [
    op('normal', 'まずは練習。\n5人来るよ'),
    op('normal', 'ギャングの組が\n1組まぎれてる')
  ],
  2: [
    op('normal', '次は6人。\n組は1つか2つ'),
    hero('smug', 'どんと来い！')
  ],
  3: [
    op('panic', '最後の波！\n女ボスがまぎれてる'),
    op('normal', '小物の色も\nよく見てね')
  ]
};

// ─── 結果発表とボス戦 ─────────────────────────────

/** 地下駐車場で足したセリフの種類 */
export type GarageReactionKey =
  | 'whistle'      // 見逃したギャングが口笛で仲間を呼んだ(オペレーター)
  | 'gather'       // 仲間が走ってくる(オペレーター)
  | 'gathered'     // 集まった。行けでまとめて吹き飛ばせる(オペレーター)
  | 'wipe'         // まとめて吹き飛ばす(ヒーロー)
  | 'wipeOp'       // まとめて吹き飛ばした(オペレーター)
  | 'board'        // 組が車に乗りこんだ(オペレーター)
  | 'drive'        // 車が走り出した。今なら行けで止まる(オペレーター)
  | 'vanStop'      // 車ごと止める(ヒーロー)
  | 'vanStopOp'    // 車を止めた(オペレーター)
  | 'vanEscaped'   // 車で逃げられた(オペレーター)
  | 'alone'        // 口笛を吹いたが仲間が誰も来ない(オペレーター)。このあとはステージ1の見逃したワルと同じ流れ
  | 'aloneHero'    // 同じ場面(ヒーロー)
  | 'bossCar'      // ボス戦:女ボスが車に飛び乗った(オペレーター)
  | 'bossCarHero'  // 同じ場面(ヒーロー)
  | 'bossCarIdle'  // 車に乗ったあと、手が止まって車が暴れている(オペレーター)
  | 'bossWreck'    // 倒した:車がひっくり返って爆発、女ボスが目を回して出てくる(オペレーター)
  | 'unlocked';    // 路地裏をクリアして地下駐車場が開いた(オペレーター。結果画面かステージを選ぶ画面で)

/** 地下駐車場で足したセリフ */
export const GARAGE_REACTIONS: Readonly<Record<GarageReactionKey, readonly Speech[]>> = {
  whistle: [op('panic', '口笛！\n仲間を呼んでる！'), op('panic', 'あっ！\n仲間を呼んだ！')],
  gather: [op('panic', '仲間が\n集まってくる！'), op('panic', 'どこにいたの！？\n集まってきた！')],
  gathered: [op('hype', '集まった！\n行けでまとめて！'), op('hype', '今だ！\n行けを押して！')],
  wipe: [hero('smug', 'まとめて\n吹っ飛べーっ！'), hero('smug', '全員まとめて\nかかってこい！'), hero('smug', '一気に\n片付ける！')],
  wipeOp: [op('hype', '一網打尽！'), op('hype', 'まとめて\n片付いた！')],
  board: [op('panic', '車に乗った！\n逃げる気だ！'), op('panic', 'ワゴンに\n乗りこんだ！')],
  drive: [op('panic', '走り出した！\n今なら行け！'), op('panic', '逃げる！\n行けを押して！')],
  vanStop: [hero('smug', '車ごと\n止めてやる！'), hero('smug', '逃がすかーっ！\n車ごと行く！')],
  vanStopOp: [op('deadpan', '止めた…けど\n車がぺしゃんこ'), op('deadpan', 'ナイス…\n車は弁償ね')],
  vanEscaped: [op('deadpan', '組ごと車で\n逃げられた…'), op('deadpan', 'あーあ、\n車で逃げられた')],
  alone: [op('normal', '誰も来ない！\n今なら行け！'), op('deadpan', '仲間、来ないね…\n行けで追いかけて')],
  aloneHero: [hero('smug', 'ひとりなら\n楽勝だね！'), hero('smug', '呼んでも無駄！\n待てーっ！')],
  bossCar: [op('panic', '車に飛び乗った！\n逃げる気だ！'), op('panic', '高級車で\n逃げる気だ！')],
  bossCarHero: [hero('smug', '車ごと\nぶっ飛ばす！'), hero('smug', '逃がさないよ！\n連打、連打！')],
  bossCarIdle: [op('panic', '車が暴れてる！\n連打して！'), op('panic', '柱にぶつかった！\n手を止めないで！')],
  bossWreck: [op('panic', '車が爆発した！\n…ボスは無事？'), op('deadpan', '目を回して\n出てきた…')],
  unlocked: [op('hype', '地下駐車場に\n行けるようになった！'), op('hype', '次のステージが\n開いたよ！')]
};

/**
 * ワルにした人に向かうときのヒーローの決めつけ(地下駐車場の見た目。路地裏の分は content.ts の JUDGE_LINES)。
 * 市民かギャングかでは変えない。小物の名前(タオルとバンダナ)でも言い分けない
 */
export const GARAGE_JUDGE_LINES: Readonly<Record<GangLook, readonly Speech[]>> = {
  guard: [
    hero('smug', '腕章があやしい！\nワルで間違いない！'),
    hero('smug', 'カギを持ちすぎ！\nワルで間違いない！'),
    hero('smug', '見回りがあやしい！\nワルで間違いない！')
  ],
  mechanic: [
    hero('smug', '首に何か巻いてる！\nワルで間違いない！'),
    hero('smug', 'つなぎが油っぽい！\nワルで間違いない！'),
    hero('smug', '手が真っ黒！\nワルで間違いない！')
  ],
  clubber: [
    hero('smug', '服がハデすぎる！\nワルで間違いない！'),
    hero('smug', 'ヘアバンドがハデ！\nワルで間違いない！'),
    hero('smug', 'ノリが軽そう！\nワルで間違いない！')
  ],
  officelady: [
    hero('smug', 'スカーフがあやしい！\nワルで間違いない！'),
    hero('smug', 'ヒールの音があやしい！\nワルで間違いない！'),
    hero('smug', '目つきが鋭い！\nワルで間違いない！')
  ]
};

/**
 * 地下駐車場で言い方を変える、路地裏と同じ種類のセリフ(content.ts の ReactionKey)。
 * ここにない種類は、路地裏と同じ文を使う
 */
export const GARAGE_OVERRIDES = {
  pass: [
    hero('smile', 'こんばんは！'),
    hero('smile', '気をつけて\n帰ってね！'),
    hero('smile', '安全運転でね！'),
    hero('smile', '駐車場の平和は\n任せて！')
  ],
  escaped: [op('deadpan', '逃げられた…'), op('deadpan', 'あーあ、\n逃げられた'), op('deadpan', '逃がしたね…')],
  bossReveal: [op('panic', '正体を現した！\nギャングの女ボス！'), op('panic', '出た！\n駐車場の女ボス！')],
  bossRampage: [op('panic', '女ボスだった！\n手下の車が来る！'), op('panic', '素通りした人が\n女ボスだった！')],
  bossIdle: [op('panic', '手を止めないで！\n駐車場が壊れてく！'), op('panic', '連打して！\n被害が増えてる！')],
  bossDefeated: [hero('smug', '正義は勝つ！'), hero('smug', '見たか！\n車ごと一発！')],
  bossDefeatedOp: [op('hype', 'やったー！\n女ボスを倒した！'), op('hype', '駐車場、\n平和になった！')]
} as const satisfies Readonly<Record<string, readonly Speech[]>>;

/**
 * 地下駐車場で言い方を変える称号のひとこと(路地裏の文に「街」が入っているもの)。
 * content.ts の titleCommentFor(id, 'garage') で出る
 */
export const GARAGE_TITLE_COMMENT_OVERRIDES = {
  demolition: op('deadpan', '駐車場の修理代、\n誰が払うの…')
} as const;

/** 称号のひとこと(ステージ2の2つ) */
export const GARAGE_TITLE_COMMENTS = {
  roundUp: op('hype', '組ごとまとめて！\n気持ちいいね！'),
  gangDriver: op('deadpan', 'ギャングの車、\n見送ってたよね')
} as const;
