// ステージ3(ショッピングモール、宇宙人)の日本語の文章。文の元は docs/STAGE3_TEXT.md。
// 決まりは content.ts と同じ(1行は全角12文字まで、2行まで。半角スペースとエムダッシュは使わない。名前は呼ばない)。
// ヒーローは元気で大げさで自信満々、オペレーターはため口でツッコむ幼なじみ。
//
// 画面の担当は、ふつうは content.ts の関数から使う(ステージの id を渡すとここの文が出る):
//   introFor('mall') / waveIntroFor('mall', no) / say('ufoBeam', rng, 'mall') / mischiefLine('clerk')
//   rushIntroFor(seen) / rushEndLine(tally, rng) / streetTextsFor('mall')
// 名前、年齢、プロフィール、一言は content.ts の NAMES などに入っている(createStage が選ぶ)。

import type {
  HeroFace, MallDisguise, MallLook, OperatorFace, OperatorHint, Speech, WaveNo
} from './types';

const hero = (face: HeroFace, text: string): Speech => ({ who: 'hero', face, text });
const op = (face: OperatorFace, text: string): Speech => ({ who: 'operator', face, text });
const hint = (face: OperatorFace, text: string): OperatorHint => ({ face, text });

// ─── プロフィール ─────────────────────────────────

/** 見た目ごとの名前。市民と宇宙人で同じ一覧(名前で見分けられないように)。親玉の偽名もここから */
export const MALL_NAMES: Readonly<Record<MallLook, readonly string[]>> = {
  mascot: ['山口ハルト', '佐野ユウキ', '石井ソラ', '小林カナタ', '吉田ヒナ', '藤井コウ', '森ミサキ', '加藤リン', '斎藤ユイ', '高木レン'],
  clerk: ['田村まゆ', '中川健太', '井上さやか', '木村翔', '松本あかり', '林大輔', '清水なつみ', '山崎拓也', '池田ゆかり', '橋本亮'],
  dancer: ['秋山ダイチ', '宮田コウタ', '杉本ユウマ', '大野ハヤト', '佐藤ミオ', '新井リコ', '菊地カイ', '村上セナ', '石川トワ', '堀ルカ'],
  uncle: ['鈴木正男', '渡辺茂', '伊藤和夫', '中村博', '山本勝', '小川昭', '長谷川実', '近藤修', '後藤武', '岡田清']
};

/** 見た目ごとの年齢の幅(両端を含む)。市民と宇宙人で同じ(宇宙人は化けた姿の幅)。親玉も化けた姿の幅から */
export const MALL_AGES: Readonly<Record<MallLook, readonly [number, number]>> = {
  mascot: [18, 28],
  clerk: [20, 45],
  dancer: [15, 21],
  uncle: [45, 65]
};

/**
 * プロフィールの一文。嘘は書かないが、どちらとも取れる。市民と宇宙人で似た言い回しを並べ、
 * どちらにも出る文も2つずつ入れる。宇宙人の文は「人間のことを少しだけ知らない」くらいにとどめる
 */
export const MALL_PROFILE_LINES: Readonly<Record<MallLook, { civ: readonly string[]; bad: readonly string[] }>> = {
  mascot: {
    // 市民:前が見えずにふらつく。宇宙人:同じふらつきに、ときどき着ぐるみの首が一回転する
    civ: [
      '風船を配るバイト\n三日目',
      '着ぐるみの中は\nとても暑い',
      '前がほとんど\n見えない',
      '子どもに\nよく抱きつかれる',
      '休みの時間は\n水ばかり飲む',
      'このクマの名前は\nモルくん',
      '中の人は\nひみつ',
      'バイトは\n閉店まで'
    ],
    bad: [
      '風船を配るバイト\n始めたばかり',
      '着ぐるみの中は\nとても快適',
      '前が見えなくても\n平気',
      '子どもに\nじっと見られる',
      '休みの時間は\nとらない',
      'このクマの名前は\nまだ覚えていない',
      '中の人は\nひみつ',
      'バイトは\n閉店まで'
    ]
  },
  clerk: {
    // 市民:かくっと船をこぐ。宇宙人:同じ動きに、ときどきまばたきが横に閉じる
    civ: [
      '三日続けて\n閉店まで働いた',
      '夜はつい\nうとうとしてしまう',
      'レジ打ちは\n目をつぶってもできる',
      'コーヒーを\n一日五杯飲む',
      '売り場の場所なら\n全部言える',
      '名札の写真は\n入社したとき',
      '閉店のあとは\nすぐ寝たい',
      '店長には\nいつも怒られる'
    ],
    bad: [
      '三日続けて\n寝ていない',
      '夜になると\n目がさえてくる',
      'レジ打ちは\n見て覚えた',
      'コーヒーは\n飲んだことがない',
      '売り場の場所を\n調べている',
      '名札は\n最近もらった',
      '閉店のあとは\nすぐ寝たい',
      '店長には\nいつも怒られる'
    ]
  },
  dancer: {
    // 市民:カクカク踊る。宇宙人:同じ動きに、ときどき腕がのびて戻る
    civ: [
      'ロボットダンスの\n大会に出る',
      '練習はいつも\nモールの前',
      'カクカクなのは\nわざと',
      'ダンス動画を\n毎日あげている',
      '筋肉痛で\n体がかたい',
      '友だちと\n待ち合わせ中',
      '人間ばなれした動きと\nよくほめられる',
      'ダンス歴は\n一年'
    ],
    bad: [
      '大会には\n出たことがない',
      '練習はいつも\n夜中のモール',
      'カクカクなのは\n生まれつき',
      'ダンス動画を\n見て覚えた',
      '体はとても\nやわらかい',
      '友だちが\nもうすぐ迎えに来る',
      '人間ばなれした動きと\nよくほめられる',
      'ダンス歴は\n一年'
    ]
  },
  uncle: {
    // 市民:腰をさする。宇宙人:同じ動きに、ときどき体の色がちらつく
    civ: [
      '家族にたのまれて\n買い物中',
      '腰が痛くて\n休み休み歩く',
      '閉店セールを\nねらっている',
      '荷物持ちは\nいつも自分',
      '健康のために\nよく歩く',
      'ポイントカードを\n五枚持っている',
      'このモールには\nよく来る',
      '家族には\nやさしい'
    ],
    bad: [
      'たのまれて\n買い物中',
      '腰の使い方が\nまだ分からない',
      '閉店セールに\n興味がある',
      '荷物は\n持ったことがない',
      '歩くのには\nまだ慣れない',
      'ポイントカードは\nまだ持っていない',
      'このモールには\nよく来る',
      '家族には\nやさしい'
    ]
  }
};

/**
 * オペレーターの一言。嘘はつかないが、どちらとも取れる。同じ見た目の市民と宇宙人で、
 * あわてた顔(panic)とあきれ顔(deadpan)の数をそろえる。宇宙人にだけある一言は、くずれのことを小さく言う。
 * 市民にだけある一言も同じ数だけ入れる
 */
export const MALL_OPERATOR_HINTS: Readonly<Record<MallLook, { civ: readonly OperatorHint[]; bad: readonly OperatorHint[] }>> = {
  mascot: {
    civ: [
      hint('normal', '着ぐるみの\nバイトさんだ'),
      hint('normal', 'ふらふらしてる…'),
      hint('normal', '風船を\n持ってる'),
      hint('deadpan', '中、暑そう…'),
      hint('normal', '子どもに\n手をふってる'),
      hint('panic', 'こっちを\nじっと見てる')
    ],
    bad: [
      hint('normal', '着ぐるみの\nバイトさんだ'),
      hint('normal', 'ふらふらしてる…'),
      hint('normal', '風船を\n持ってる'),
      hint('deadpan', '中、涼しそう…？'),
      hint('normal', '首のあたりが\n気になる…'),
      hint('panic', 'こっちを\nじっと見てる')
    ]
  },
  clerk: {
    civ: [
      hint('normal', '店員さんだ'),
      hint('deadpan', '眠そう…\n船をこいでる'),
      hint('normal', '名札をつけてる'),
      hint('normal', 'あくびしてる'),
      hint('normal', 'レジの方を\n見てる'),
      hint('panic', '目つきが\nちょっと変…？')
    ],
    bad: [
      hint('normal', '店員さんだ'),
      hint('deadpan', '眠そう…\n船をこいでる'),
      hint('normal', '名札をつけてる'),
      hint('normal', 'まばたき…\nしてる？'),
      hint('normal', 'レジの方を\n見てる'),
      hint('panic', '目つきが\nちょっと変…？')
    ]
  },
  dancer: {
    civ: [
      hint('normal', 'ロボットダンス\nしてる'),
      hint('normal', 'カクカクだ…'),
      hint('deadpan', '練習熱心だね…'),
      hint('normal', 'イヤホンしてる'),
      hint('normal', 'スマホで\n撮ってる？'),
      hint('panic', '動きが\n人間ばなれしてる')
    ],
    bad: [
      hint('normal', 'ロボットダンス\nしてる'),
      hint('normal', 'カクカクだ…'),
      hint('deadpan', '練習熱心…\nなのかな'),
      hint('normal', 'イヤホンしてる'),
      hint('normal', '腕…\n長くない？'),
      hint('panic', '動きが\n人間ばなれしてる')
    ]
  },
  uncle: {
    civ: [
      hint('normal', '買い物袋が\nいっぱい'),
      hint('normal', '腰が痛そう'),
      hint('deadpan', 'おつかい\n中かな…'),
      hint('normal', 'チラシを\n見てる'),
      hint('normal', 'ベンチを\nさがしてる'),
      hint('panic', '顔色が\n悪くない？')
    ],
    bad: [
      hint('normal', '買い物袋が\nいっぱい'),
      hint('normal', '腰が痛そう'),
      hint('deadpan', 'おつかい\n中かな…'),
      hint('normal', 'チラシを\n見てる'),
      hint('normal', '今、色が…？\n気のせい？'),
      hint('panic', '顔色が\n悪くない？')
    ]
  }
};

/**
 * 宇宙人だけに出る動きのくずれ(STAGE3「見た目」の表)。絵(行7)と答え合わせの決め手に合わせる。
 * 「持ち物」の窓に映す場所も書いておく(同じ見た目の人は市民でも宇宙人でも親玉でも同じ場所を映す)
 */
export const MALL_GLITCH_KIND: Readonly<Record<MallLook, { glitch: string; awkward: string; clueSpot: string }>> = {
  mascot: { glitch: '着ぐるみの首が一回転する', awkward: '前が見えずにふらつく', clueSpot: '頭' },
  clerk: { glitch: 'まばたきが横に閉じる', awkward: 'かくっと船をこぐ', clueSpot: '目' },
  dancer: { glitch: '腕がのびて戻る', awkward: 'カクカク踊る', clueSpot: '腕のつけね' },
  uncle: { glitch: '一瞬、体の色がちらつく', awkward: '腰をさする', clueSpot: '胴' }
};

// ─── 親玉(化けた姿) ───────────────────────────────

/**
 * 親玉の化けた姿の「どこか1か所おかしい」ところ(絵の担当と合わせる)。
 * 親玉は化けた姿の市民と同じぎこちない動きをするが、くずれは出ない
 */
export const BOSS3_ODD_POINT: Readonly<Record<MallDisguise, string>> = {
  clerk: '名札が逆さ',
  uncle: '耳がとがっている',
  mascot: '着ぐるみから触角がのぞく'
};

/** 親玉の化けた姿のプロフィール。「どこか1か所おかしい」と気づける一文にする */
export const BOSS3_PROFILE_LINES: Readonly<Record<MallDisguise, readonly string[]>> = {
  clerk: [
    '名札は\nさかさまが好き',
    'この店で一番\nえらい…らしい',
    '部下が大勢\n迎えに来る',
    '空を見るのが\n好き'
  ],
  uncle: [
    '耳の形を\nよくほめられる',
    '家族は\nとても遠くにいる',
    '部下が大勢\n迎えに来る',
    '空を見るのが\n好き'
  ],
  mascot: [
    '頭の上が\nいつもむずむずする',
    '着ぐるみは\n自分用に作らせた',
    '部下が大勢\n迎えに来る',
    '空を見るのが\n好き'
  ]
};

/** 親玉の化けた姿の一言。どれも「どこか1か所おかしい」ところを指す */
export const BOSS3_HINTS: Readonly<Record<MallDisguise, readonly OperatorHint[]>> = {
  clerk: [
    hint('panic', '名札が\nさかさま…？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', '名札の字が\n読めない'),
    hint('deadpan', '店員にしては\n貫禄がありすぎ')
  ],
  uncle: [
    hint('panic', '耳が…\nとがってる？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', '買い物袋が\n空っぽ？'),
    hint('deadpan', 'おじさんにしては\n貫禄がありすぎ')
  ],
  mascot: [
    hint('panic', '頭から何か\n出てる…？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', '風船を\n持ってない'),
    hint('deadpan', 'バイトにしては\n貫禄がありすぎ')
  ]
};

// ─── ステージ前の掛け合い ─────────────────────────

/**
 * ショッピングモールを最初に遊ぶときの掛け合い(5枚)。くずれ、ぎこちない市民、UFO、全員は待てないこと、を教える。
 * UFOを行けで落とすことは、初めて行けのマークが出たときに教える(teachUfo)。タイムセールラッシュのことは言わない
 */
export const MALL_INTRO: readonly Speech[] = [
  hero('smug', '次はショッピングモール！\n宇宙人退治だ！'),
  op('normal', '宇宙人は人間に化けてる。\nときどき動きがくずれる'),
  op('deadpan', 'ぎこちない市民もいるよ。\n少し待って、よく見てね'),
  op('panic', '見逃すとUFOを呼んで、\n人を連れていく'),
  op('normal', '全員は待てないから、\nほかの手がかりも見てね')
];

/** ショッピングモールの波の始まりの一言。上から順に出す */
export const MALL_WAVE_INTRO: Readonly<Record<WaveNo, readonly Speech[]>> = {
  1: [
    op('normal', 'まずは練習。\n5人来るよ'),
    op('normal', '少し待つと\n動きがくずれるかも')
  ],
  2: [
    op('normal', '次は6人。\n全員は待てないよ'),
    hero('smug', 'どんと来い！')
  ],
  3: [
    op('panic', '最後の波！\n親玉がまぎれてる'),
    op('normal', '親玉はくずれない。\n見た目をよく見て')
  ]
};

// ─── 結果発表とボス戦 ─────────────────────────────

/**
 * ショッピングモールで足したセリフの種類。
 * UFO:ufoSignal → ufoArrive →(その回で初めてなら teachUfo)→ ufoBeam →
 *   行けを押したら ufoGo と ufoDowned、押さなかったら ufoAbducted。
 * タイムセールラッシュ:rushMark(マークが出た)、rushCivHit(市民を殴った)、rushEndGood / rushEndBad(終わった)。
 *   始まりの説明は rushIntroFor(seen)
 */
export type MallReactionKey =
  | 'ufoSignal'    // 見逃した宇宙人が空へ合図を送った(オペレーター)
  | 'ufoArrive'    // UFOが下りてきた(オペレーター)
  | 'teachUfo'     // その回で初めてUFOの上に行けのマークが出た:行けの使い方(オペレーター)
  | 'ufoBeam'      // 買い物客を吸い上げている(オペレーター)
  | 'ufoGo'        // 行けを押した:UFOに跳びかかる(ヒーロー)
  | 'ufoDowned'    // UFOを落とした(オペレーター)
  | 'ufoAbducted'  // 買い物客を連れていかれた(オペレーター)
  | 'rushMark'     // ラッシュで待てのマークが出た。全員に同じ一言(ヒーロー)
  | 'rushCivHit'   // ラッシュで市民を殴った(ヒーロー。短い反応だけ)
  | 'rushEndGood'  // ラッシュが終わった:市民を全員守れた(オペレーター)
  | 'rushEndBad';  // ラッシュが終わった:守れなかった市民がいた(オペレーター)

/** ショッピングモールで足したセリフ */
export const MALL_REACTIONS: Readonly<Record<MallReactionKey, readonly Speech[]>> = {
  ufoSignal: [op('panic', '空に合図してる！'), op('panic', 'あっ！\n空が光った！')],
  ufoArrive: [op('panic', 'UFOが来た！'), op('panic', 'UFOだ！\n本物だ！')],
  teachUfo: [op('hype', 'UFOが来た！\n行けで落として！')],
  ufoBeam: [op('panic', '人が吸われてる！\n行けを押して！'), op('panic', '連れていかれる！\n今なら行け！')],
  ufoGo: [hero('smug', 'UFOごと\nぶっ飛ばす！'), hero('smug', '空まで\n届けーっ！')],
  ufoDowned: [op('deadpan', '落ちた…けど\n床がへこんだ'), op('deadpan', 'ナイス…\nUFOは弁償？')],
  ufoAbducted: [op('deadpan', '連れていかれた…'), op('deadpan', 'あーあ、\n空に消えた')],
  rushMark: [hero('smug', 'セールを荒らすなーっ！')],
  rushCivHit: [hero('smile', 'あれ？')],
  rushEndGood: [op('hype', 'セール終了！\nばっちり！')],
  rushEndBad: [op('deadpan', 'セール終了…\nつかれた')]
};

/**
 * ショッピングモールで言い方を変える、路地裏と同じ種類のセリフ(content.ts の ReactionKey)。
 * ここにない種類は、路地裏と同じ文を使う
 */
export const MALL_OVERRIDES = {
  pass: [
    hero('smile', 'いらっしゃいませ！'),
    hero('smile', 'お買い物\n楽しんでね！'),
    hero('smile', '閉店まで\nごゆっくり！'),
    hero('smile', 'モールの平和は\n任せて！')
  ],
  bossReveal: [op('panic', '正体を現した！\n宇宙人の親玉！'), op('panic', '出た！\n宇宙人の親玉！')],
  bossRampage: [op('panic', '親玉だった！\n母艦を呼んでる！'), op('panic', '素通りした人が\n親玉だった！')],
  bossIdle: [op('panic', '手を止めないで！\n床が焼けてる！'), op('panic', '連打して！\n被害が増えてる！')],
  bossDefeated: [hero('smug', '正義は勝つ！'), hero('smug', '見たか！\n母艦ごと一発！')],
  bossDefeatedOp: [op('hype', 'やったー！\n親玉を倒した！'), op('hype', 'モール、\n平和になった！')]
} as const satisfies Readonly<Record<string, readonly Speech[]>>;

/**
 * ショッピングモールで言い方を変える、地下駐車場と同じ種類のセリフ(garageContent.ts の GarageReactionKey)。
 * ボス戦の母艦は、女ボスの車と同じ仕組みなので同じ種類で出す(bossCar は母艦が来た、bossWreck は倒した)。
 * unlocked は地下駐車場をクリアしてモールが開いたとき(say('unlocked', rng, 'mall'))
 */
export const MALL_GARAGE_OVERRIDES = {
  bossCar: [op('panic', '天井が！\n母艦が来た！'), op('panic', '母艦に\n乗りこんだ！')],
  bossCarHero: [hero('smug', '母艦ごと\nぶっ飛ばす！'), hero('smug', '逃がさないよ！\n連打、連打！')],
  bossCarIdle: [op('panic', '床が焼けてる！\n連打して！'), op('panic', '光線が！\n手を止めないで！')],
  bossWreck: [op('panic', '母艦が噴水に…\n親玉は無事？'), op('deadpan', '目を回して\n出てきた…')],
  unlocked: [op('hype', 'モールに行ける\nようになった！'), op('hype', '次のステージが\n開いたよ！')]
} as const satisfies Readonly<Record<string, readonly Speech[]>>;

/**
 * ワルにした人に向かうときのヒーローの決めつけ(ショッピングモールの見た目)。
 * 市民か宇宙人かでは変えない。ステージ3では「ワル」ではなく「宇宙人」と決めつける
 */
export const MALL_JUDGE_LINES: Readonly<Record<MallLook, readonly Speech[]>> = {
  mascot: [
    hero('smug', '着ぐるみがあやしい！\n宇宙人に決まってる！'),
    hero('smug', '中の人があやしい！\n宇宙人に決まってる！'),
    hero('smug', 'ふらふらしてる！\n宇宙人に決まってる！')
  ],
  clerk: [
    hero('smug', '居眠りしてる！\n宇宙人に決まってる！'),
    hero('smug', '名札があやしい！\n宇宙人に決まってる！'),
    hero('smug', 'あくびがあやしい！\n宇宙人に決まってる！')
  ],
  dancer: [
    hero('smug', 'カクカクしてる！\n宇宙人に決まってる！'),
    hero('smug', 'ダンスがあやしい！\n宇宙人に決まってる！'),
    hero('smug', 'イヤホンがあやしい！\n宇宙人に決まってる！')
  ],
  uncle: [
    hero('smug', '買いすぎ！\n宇宙人に決まってる！'),
    hero('smug', '腰のさすり方が変！\n宇宙人に決まってる！'),
    hero('smug', 'チラシを見すぎ！\n宇宙人に決まってる！')
  ]
};

/** 結果発表の画面に出る短い文(ショッピングモール)。宇宙人の本性ちらりは「ピピッ…」、市民は今までと同じ */
export const MALL_STREET_TEXTS = {
  band: '出動！待て・行けの出番',
  peekBad: 'ピピッ…',
  peekCiv: 'ぺこり'
} as const;

// ─── タイムセールラッシュ ─────────────────────────

/** タイムセールラッシュの帯 */
export const RUSH_BAND = 'タイムセール開始！';

/** 初めてのラッシュの説明(オペレーター、2つ続けて) */
export const RUSH_INTRO_FIRST: readonly Speech[] = [
  op('panic', '人がどっと来る！\n全員殴られちゃう！'),
  op('normal', 'くずれてたら宇宙人！\n市民にだけ待て！')
];

/** 2回目からのラッシュの説明(オペレーター、1つ) */
export const RUSH_INTRO_AGAIN: readonly Speech[] = [
  op('panic', 'タイムセール！\n市民にだけ待て！')
];

// ─── 称号のひとこと ───────────────────────────────

/**
 * ショッピングモールで言い方を変える称号のひとこと(路地裏の文に「街」が入っているもの)。
 * content.ts の titleCommentFor(id, 'mall') で出る
 */
export const MALL_TITLE_COMMENT_OVERRIDES = {
  demolition: op('deadpan', 'モールの修理代、\n誰が払うの…')
} as const;

/** 称号のひとこと(ステージ3の3つ) */
export const MALL_TITLE_COMMENTS = {
  ufoGuide: op('deadpan', 'UFOの前で\n手をふってたよね'),
  saleGuardian: op('hype', 'セールの人ごみで\n一人も間違えなかった！'),
  ufoHunter: op('hype', 'UFO落とすの、\nくせになってない？')
} as const;
