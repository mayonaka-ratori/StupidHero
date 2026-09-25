// ステージ4(高層ビル、超能力のヴィラン)の日本語の文章。文の元は docs/STAGE4_TEXT.md と docs/STAGE4.md。
// 決まりは content.ts と同じ(1行は全角12文字まで、2行まで。半角スペースとエムダッシュは使わない。名前は呼ばない)。
// ステージ4では、ヒーローの決めつけやセリフで「ワル」ではなく「ヴィラン」と言う。
//
// 画面の担当は、ふつうは content.ts の関数から使う(ステージの id を渡すとここの文が出る):
//   introFor('tower') / waveIntroFor('tower', no) / say('psyCarry', rng, 'tower') / mischiefLine('chef')
//   liftIntroFor(seen) / liftEndLine(tally, rng) / streetTextsFor('tower') / towerFloorLabel(no)
// 名前、年齢、プロフィール、一言は content.ts の NAMES などに入っている(createStage が選ぶ)。

import type { OperatorHint, Speech, TowerDisguise, TowerLook, WaveNo } from './types';
import { hero, hint, op } from './speech';

// ─── プロフィール ─────────────────────────────────

/** 見た目ごとの名前。市民とヴィランで同じ一覧(名前で見分けられないように)。親玉の偽名もここから */
export const TOWER_NAMES: Readonly<Record<TowerLook, readonly string[]>> = {
  florist: ['春日みどり', '園田ゆり', '立花かおり', '若林はるな', '小松すみれ', '桐谷あや', '宮下ももこ', '深町なお', '片山ことね', '野田あおい'],
  courier: ['荻原タケシ', '竹田リョウタ', '浜口ユウスケ', '大橋カズキ', '岸本ジュンペイ', '西村ケイタ', '丸山ダイスケ', '川口シンヤ', '吉川トモヤ', '永井ヒロキ'],
  newbie: ['相沢しおり', '早川ゆうと', '三上あおば', '関根はると', '瀬戸ひなた', '古川そうま', '久野まな', '須藤れん', '奥村いつき', '松岡のぞみ'],
  janitor: ['今村節子', '土屋和子', '武田忠', '酒井孝', '栗原房子', '市川勉', '大塚静江', '増田正', '小山悦子', '石原保'],
  chef: ['石田浩之', '片岡誠司', '矢野拓郎', '竹中秀樹', '桑田雅人', '松下剛史', '堤一郎', '富田康介', '樋口大輔', '野上健'],
  waiter: ['真田ユウト', '黒木ショウ', '芦田ハルキ', '高森リョウ', '水谷カイト', '氷室シン', '藤原タクマ', '菅野アキラ', '宇野セイヤ', '成田ユウゴ'],
  lady: ['綾小路れいか', '西園寺まどか', '一条さえこ', '白鳥きょうこ', '花園ゆりえ', '鳳えりか', '桜庭みちる', '月島るりこ', '九条あかね', '如月しのぶ'],
  magician: ['天城ミサオ', '霧島ジン', '不破マコト', '月影ハヤテ', '神谷マジロウ', '夢野ケイスケ', '星川ルイジ', '雲井トオル', '早乙女ユキオ', '風間テンマ']
};

/** 見た目ごとの年齢の幅(両端を含む)。市民とヴィランで同じ。親玉も化けた姿の幅から */
export const TOWER_AGES: Readonly<Record<TowerLook, readonly [number, number]>> = {
  florist: [20, 35],
  courier: [20, 40],
  newbie: [22, 25],
  janitor: [40, 65],
  chef: [30, 55],
  waiter: [20, 35],
  lady: [25, 50],
  magician: [25, 60]
};

/**
 * プロフィールの一文。嘘は書かないが、どちらとも取れる。市民とヴィランで似た言い回しを並べ、
 * どちらにも出る文も2つずつ入れる(それぞれの一覧の最後の2つ)。ヴィランの文は「力をかくしきれていない」くらいにとどめる
 */
export const TOWER_PROFILE_LINES: Readonly<Record<TowerLook, { civ: readonly string[]; bad: readonly string[] }>> = {
  florist: {
    civ: [
      '重いバケツで\n腕がパンパン',
      '花びらが\nよく服につく',
      '朝は市場で\n花を仕入れる',
      '好きな花は\nひまわり',
      '店の電球が\nちかちかする',
      '休みの日は\n植物園',
      '花束を作るのが\n得意',
      '店は1階の\n入口のそば'
    ],
    bad: [
      '重いバケツも\nまったく平気',
      '花びらが\nよく宙に舞う',
      '朝は市場で\n花を選ぶ',
      '好きな花は\nかすみ草',
      '近くの電球が\nちかちかする',
      '休みの日は\nビルの屋上',
      '花束を作るのが\n得意',
      '店は1階の\n入口のそば'
    ]
  },
  courier: {
    civ: [
      'この辺りの担当に\nなって三年',
      '荷物は\n両手で運ぶ',
      'エレベーターが\nいつも混んでいる',
      '重い荷物で\n腰が痛い',
      'ハンコを\nもらい忘れがち',
      '好物は\nおにぎり',
      '帽子は\n会社の支給',
      '配達は\n時間通り'
    ],
    bad: [
      'この辺りの担当に\nなって三日',
      '荷物は\n手で運ぶことが多い',
      'エレベーターは\nなぜか空いている',
      '重い荷物も\n軽く感じる',
      'ハンコは\nいつの間にかもらえる',
      '食事は\nあまりとらない',
      '帽子は\n会社の支給',
      '配達は\n時間通り'
    ]
  },
  newbie: {
    civ: [
      '書類を\nよく落とす',
      'コピー機の\n使い方を覚えた',
      '朝は\n満員電車で来る',
      '緊張すると\n手がふるえる',
      '昼は\n社員食堂',
      '席は\n窓ぎわ',
      '入社して\nまだ一か月',
      '先輩に\nよく怒られる'
    ],
    bad: [
      '書類が\nよく机から落ちる',
      'コピー機が\nなぜか言うことを聞く',
      '朝は\nいつの間にか着いている',
      '緊張すると\nペンがふるえる',
      '昼は\n屋上で一人',
      '席は\n照明の真下',
      '入社して\nまだ一か月',
      '先輩に\nよく怒られる'
    ]
  },
  janitor: {
    civ: [
      'このビルで\n二十年働いている',
      '夜中のビルは\n少しこわい',
      '切れた電球を\nよく取りかえる',
      'モップは\n自分で選んだ',
      '腰が\n少し痛い',
      '休みは\n孫と遊ぶ',
      '床みがきは\n誰にも負けない',
      '全部の階を\n回っている'
    ],
    bad: [
      'このビルで\n働き始めた',
      '夜中のビルは\n静かで好き',
      '電球が\nよく切れる所にいる',
      'モップは\nあまり使わない',
      '腰は\n痛くない',
      '休みは\nひとりで過ごす',
      '床みがきは\n誰にも負けない',
      '全部の階を\n回っている'
    ]
  },
  chef: {
    civ: [
      'なべは\n両手で持つ',
      '包丁を\n毎日研ぐ',
      '湯気で\nめがねがくもる',
      '火加減が\nむずかしい',
      '休みの日は\n料理の研究',
      '得意料理は\nオムライス',
      'この店の\n料理長',
      '味見は\n何度もする'
    ],
    bad: [
      'なべは\n片手で軽々',
      '包丁は\n研がなくても切れる',
      '湯気が\nまわりをよける',
      '火加減は\n思いのまま',
      '休みの日は\nビルをながめる',
      '得意料理は\nふわふわのスフレ',
      'この店の\n料理長',
      '味見は\n何度もする'
    ]
  },
  waiter: {
    civ: [
      'お盆は\n片手で持てる',
      'グラスを\n割ったことがある',
      'お客さんの顔は\nすぐ覚える',
      '立ちっぱなしで\n足が痛い',
      '夢は\n自分の店を持つこと',
      '静かに\n歩くのが得意',
      'このレストランで\n三年目',
      '蝶ネクタイは\n自分で結ぶ'
    ],
    bad: [
      'お盆は\n手を放しても平気',
      'グラスを\n割ったことがない',
      'お客さんの考えは\nすぐ分かる',
      '立ちっぱなしでも\n足は痛くない',
      '夢は\nこのビルを持つこと',
      '足音が\nほとんどしない',
      'このレストランで\n三年目',
      '蝶ネクタイは\n自分で結ぶ'
    ]
  },
  lady: {
    civ: [
      'ヒールで\n足が痛い',
      'グラスは\nしっかり持つ',
      '夜景が\n大好き',
      '羽の髪飾りは\n祖母の形見',
      'お酒は\n弱い',
      'オーナーとは\n初対面',
      'パーティには\nよく招かれる',
      'ドレスは\n今日のために新調'
    ],
    bad: [
      'ヒールでも\nまったく疲れない',
      'グラスは\n持たなくても平気',
      '夜景を\n見下ろすのが好き',
      '羽の髪飾りは\nひとりでにゆれる',
      'お酒は\n飲まない',
      'オーナーとは\n古い知り合い',
      'パーティには\nよく招かれる',
      'ドレスは\n今日のために新調'
    ]
  },
  magician: {
    civ: [
      'タネも\nしかけもある',
      'カードを\nよく落とす',
      'シルクハットから\nハトを出す',
      '糸はいつも\nポケットに',
      '失敗すると\n笑ってごまかす',
      'つえは\n手作り',
      '手品歴は\n二十年',
      'パーティに\n呼ばれて来た'
    ],
    bad: [
      'タネも\nしかけもない',
      'カードを\n落としたことがない',
      'シルクハットから\n何でも出せる',
      '糸は\n持っていない',
      '失敗は\nしたことがない',
      'つえは\nもらい物',
      '手品歴は\n二十年',
      'パーティに\n呼ばれて来た'
    ]
  }
};

/**
 * オペレーターの一言。嘘はつかないが、どちらとも取れる。同じ見た目の市民とヴィランで、
 * あわてた顔(panic)とあきれ顔(deadpan)の数をそろえる。ヴィランにだけある一言は、もれのことを小さく言う。
 * 市民にだけある一言も同じ数だけ入れる。手品師の「カードが浮いてる!?」は、市民にもヴィランにも出す
 */
export const TOWER_OPERATOR_HINTS: Readonly<Record<TowerLook, { civ: readonly OperatorHint[]; bad: readonly OperatorHint[] }>> = {
  florist: {
    civ: [
      hint('normal', '花屋さんだ'),
      hint('normal', '花束を\n持ってる'),
      hint('deadpan', 'いい香り…'),
      hint('normal', 'バケツが\n重そう'),
      hint('normal', '花びらが\n舞ってる'),
      hint('panic', 'こっちを\n見てる！')
    ],
    bad: [
      hint('normal', '花屋さんだ'),
      hint('normal', '花束を\n持ってる'),
      hint('deadpan', 'いい香り…？'),
      hint('normal', '周り、なんか\n変じゃない？'),
      hint('normal', '花びらが\n舞ってる'),
      hint('panic', 'こっちを\n見てる！')
    ]
  },
  courier: {
    civ: [
      hint('normal', '配達の人だ'),
      hint('normal', '段ボールを\nかかえてる'),
      hint('deadpan', '重そう…'),
      hint('normal', '伝票を\n見てる'),
      hint('normal', '帽子を\n直してる'),
      hint('panic', '急いでる？')
    ],
    bad: [
      hint('normal', '配達の人だ'),
      hint('normal', '段ボールを\nかかえてる'),
      hint('deadpan', '軽そう…？'),
      hint('normal', '今、何か\n浮かなかった？'),
      hint('normal', '帽子を\n直してる'),
      hint('panic', '急いでる？')
    ]
  },
  newbie: {
    civ: [
      hint('normal', '新人さんかな'),
      hint('normal', '書類が\nいっぱい'),
      hint('deadpan', '緊張してる…'),
      hint('normal', '社員証を\nさげてる'),
      hint('normal', '時計を\n気にしてる'),
      hint('panic', '書類、\n落としそう！')
    ],
    bad: [
      hint('normal', '新人さんかな'),
      hint('normal', '書類が\nいっぱい'),
      hint('deadpan', '緊張…\nしてるのかな'),
      hint('normal', '机のペン、\n動いた？'),
      hint('normal', '時計を\n気にしてる'),
      hint('panic', '書類、\n落としそう！')
    ]
  },
  janitor: {
    civ: [
      hint('normal', '清掃員さんだ'),
      hint('normal', 'モップを\nかけてる'),
      hint('deadpan', 'ていねい…'),
      hint('normal', '蛍光灯を\n見上げてる'),
      hint('normal', '休まず\n働いてる'),
      hint('panic', 'こっちに\n来る！')
    ],
    bad: [
      hint('normal', '清掃員さんだ'),
      hint('normal', 'モップを\nかけてる'),
      hint('deadpan', 'ていねい…\nかな？'),
      hint('normal', '照明が…\n紫っぽい？'),
      hint('normal', '休まず\n働いてる'),
      hint('panic', 'こっちに\n来る！')
    ]
  },
  chef: {
    civ: [
      hint('normal', 'シェフだ'),
      hint('normal', '味見してる'),
      hint('deadpan', 'おいしそう…'),
      hint('normal', '湯気が\n出てる'),
      hint('normal', 'コック帽が\n高い'),
      hint('panic', 'おたまを\nふり回してる！')
    ],
    bad: [
      hint('normal', 'シェフだ'),
      hint('normal', '味見してる'),
      hint('deadpan', 'おいしそう…？'),
      hint('normal', '湯気が…\nよけてる？'),
      hint('normal', 'コック帽が\n高い'),
      hint('panic', 'おたまを\nふり回してる！')
    ]
  },
  waiter: {
    civ: [
      hint('normal', 'ウェイターさんだ'),
      hint('normal', 'お盆に\nグラス'),
      hint('deadpan', '手なれてる…'),
      hint('normal', '注文を\n聞いてる'),
      hint('normal', '蝶ネクタイ、\n決まってる'),
      hint('panic', 'こっち見て\nにやっとした！')
    ],
    bad: [
      hint('normal', 'ウェイターさんだ'),
      hint('normal', 'お盆に\nグラス'),
      hint('deadpan', '手なれすぎ…？'),
      hint('normal', 'グラスが\n浮いてない？'),
      hint('normal', '蝶ネクタイ、\n決まってる'),
      hint('panic', 'こっち見て\nにやっとした！')
    ]
  },
  lady: {
    civ: [
      hint('normal', 'ドレスの\nお客さんだ'),
      hint('normal', '羽の髪飾り'),
      hint('deadpan', 'セレブだ…'),
      hint('normal', '夜景を\n見てる'),
      hint('normal', '香水の\nにおいがする'),
      hint('panic', '目が合った！')
    ],
    bad: [
      hint('normal', 'ドレスの\nお客さんだ'),
      hint('normal', '羽の髪飾り'),
      hint('deadpan', 'セレブ…\nなのかな'),
      hint('normal', 'まわりの物、\n動いてない？'),
      hint('normal', '香水の\nにおいがする'),
      hint('panic', '目が合った！')
    ]
  },
  magician: {
    civ: [
      hint('normal', '手品師さんだ'),
      hint('normal', 'つえを\n持ってる'),
      hint('deadpan', '手品かな…'),
      hint('normal', 'ハトが\n出てきた'),
      hint('normal', 'シルクハットが\nおしゃれ'),
      hint('panic', 'カードが\n浮いてる！？')
    ],
    bad: [
      hint('normal', '手品師さんだ'),
      hint('normal', 'つえを\n持ってる'),
      hint('deadpan', '手品…\nだよね？'),
      hint('normal', '糸、\n見えないけど…'),
      hint('normal', 'シルクハットが\nおしゃれ'),
      hint('panic', 'カードが\n浮いてる！？')
    ]
  }
};

// ─── 親玉(化けた姿) ───────────────────────────────

/**
 * 親玉の化けた姿のプロフィール。「どこか1か所おかしい」と気づける一文にする
 * (ドレスの女性は髪飾りの羽が金色、手品師はつえの先がビルの形、ウェイターは蝶ネクタイが金色)
 */
export const BOSS4_PROFILE_LINES: Readonly<Record<TowerDisguise, readonly string[]>> = {
  lady: [
    '羽の飾りは\n特注の金細工',
    'このパーティは\n自分のため',
    'このビルの\nことなら何でも',
    '最上階が\nいちばん好き'
  ],
  magician: [
    'つえは\nこのビルの形',
    '手品より\nすごい力がある',
    'このビルの\nことなら何でも',
    '最上階が\nいちばん好き'
  ],
  waiter: [
    '蝶ネクタイは\n特注の金色',
    '給料は\nもらっていない',
    'このビルの\nことなら何でも',
    '最上階が\nいちばん好き'
  ]
};

/** 親玉の化けた姿の一言。どれも「どこか1か所おかしい」ところを指す */
export const BOSS4_HINTS: Readonly<Record<TowerDisguise, readonly OperatorHint[]>> = {
  lady: [
    hint('panic', '羽が\n金色…？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', '招待状を\n持ってない？'),
    hint('deadpan', 'お客にしては\n貫禄がありすぎ')
  ],
  magician: [
    hint('panic', 'つえの先が…\nビル？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', 'ハトが\n出てこない'),
    hint('deadpan', '手品師にしては\n貫禄がありすぎ')
  ],
  waiter: [
    hint('panic', '蝶ネクタイが\n金色…？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', 'お盆を\n持ってない'),
    hint('deadpan', 'ウェイターにしては\n貫禄がありすぎ')
  ]
};

// ─── ステージ前の掛け合い ─────────────────────────

/**
 * 高層ビルを最初に遊ぶときの掛け合い(5枚。docs/STAGE4.md「ステージ前の掛け合い」)。
 * 念力で運ばれた物を行けで落とすことは、初めて行けのマークが出たときに教える(teachPsy)。エレベーターラッシュのことは言わない
 */
export const TOWER_INTRO: readonly Speech[] = [
  hero('smug', '最後は高層ビル！\n超能力者退治だ！'),
  op('normal', '見た目は普通の人。\n周りをよく見て'),
  op('deadpan', '明かりが紫になったり、\n物が浮いたりする'),
  op('normal', '手品や風船の人も\nいるよ。よく見て'),
  op('panic', '見逃すと念力で\n物を運んでくる！')
];

/** 高層ビルの波の始まりの一言。上から順に出す(波は4つ) */
export const TOWER_WAVE_INTRO: Readonly<Partial<Record<WaveNo, readonly Speech[]>>> = {
  1: [
    op('normal', 'まずは1階。\n4人来るよ'),
    op('normal', '明かりと机の上を\nよく見てね')
  ],
  2: [
    op('normal', '18階のオフィス。\n5人だよ'),
    hero('smug', 'どんと来い！')
  ],
  3: [
    op('normal', '35階は\nレストラン街'),
    op('deadpan', '蛍光灯や風船にも\nだまされないで')
  ],
  4: [
    op('panic', '最上階！\n親玉がまぎれてる'),
    op('normal', '親玉はもれない。\n見た目をよく見て')
  ]
};

/**
 * 波と波の間(波1と2、波2と3)に黒い画面に出す階の数字。エレベーターラッシュの右上の数字はコードで出す
 * (LIFT.fromFloor から LIFT.toFloor)。最上階は50階
 */
export const TOWER_FLOOR_LABELS: Readonly<Record<WaveNo, string>> = {
  1: '1F',
  2: '18F',
  3: '35F',
  4: '50F'
};

// ─── 結果発表とボス戦 ─────────────────────────────

/**
 * 高層ビルで足したセリフの種類。
 * 念力:psyLift(持ち上げた)→(その回で初めてなら teachPsy)→ psyCarry(運ばれている)→
 *   行けを押したら psyGo と、落ちた先で psySofa / psyBroke、押さなかったら psyHit。
 * エレベーターラッシュ:liftMark(マークが出た)、liftCivHit(市民を殴った)、liftMissed(見逃したヴィランがいた)、
 *   liftFullHero と liftFull(定員オーバー)、liftEndGood / liftEndBad(着いた)。始まりの説明は liftIntroFor(seen)
 * ボス戦:bossChoice(念力の選択、初めてのとき)、bossGuestSaved(客を助けた)、bossChandelierGo(シャンデリアを押し返した)、
 *   bossChandelierFell(シャンデリアが落ちた)
 */
export type TowerReactionKey =
  | 'psyLift'            // 見逃したヴィランが物を持ち上げた(オペレーター)
  | 'teachPsy'           // その回で初めて行けのマークが出た:行けの使い方(オペレーター)
  | 'psyCarry'           // 物が運ばれている(オペレーター)
  | 'psyGo'              // 行けを押した(ヒーロー)
  | 'psySofa'            // ソファの上に落ちた(オペレーター)
  | 'psyBroke'           // 物が壊れた(オペレーター)
  | 'psyHit'             // 市民に落ちた(オペレーター)
  | 'liftMark'           // ラッシュでマークが出た。全員に同じ一言(ヒーロー)
  | 'liftCivHit'         // ラッシュで市民を殴った(ヒーロー。短い反応だけ)
  | 'liftMissed'         // 見逃したヴィランが奥にいた(オペレーター)
  | 'liftFullHero'       // 定員オーバー(ヒーロー)
  | 'liftFull'           // 定員オーバー(オペレーター。liftFullHero のあと)
  | 'liftEndGood'        // 最上階に着いた:市民を全員守れた(オペレーター)
  | 'liftEndBad'         // 最上階に着いた:守れなかった市民がいた(オペレーター)
  | 'bossChoice'         // 念力の選択の場面(オペレーター、初めてのとき)
  | 'bossGuestSaved'     // 客を助けた(オペレーター)
  | 'bossChandelierGo'   // シャンデリアを押し返した(ヒーロー)
  | 'bossChandelierFell';// シャンデリアが落ちた(オペレーター)

/** 高層ビルで足したセリフ */
export const TOWER_REACTIONS: Readonly<Record<TowerReactionKey, readonly Speech[]>> = {
  psyLift: [op('panic', '何か浮いてる！'), op('panic', 'あっ！\n物が持ち上がった！')],
  teachPsy: [op('hype', '物が運ばれてる！\n行けで落として！')],
  psyCarry: [op('panic', '人の上に来る！\n行けを押して！'), op('normal', 'ソファの上なら\nこわれないかも')],
  psyGo: [hero('smug', '念力なんか\n効かないよ！'), hero('smug', '落ちろーっ！')],
  psySofa: [op('hype', 'ソファで\nセーフ！'), op('deadpan', 'ふかふかで\n助かった…')],
  psyBroke: [op('deadpan', '落ちた…けど\n割れたね…'), op('deadpan', 'ナイス…\n弁償は？')],
  psyHit: [op('panic', '当たっちゃった！'), op('deadpan', 'あーあ、\n当たった…')],
  liftMark: [hero('smug', '乗ってくるなーっ！')],
  liftCivHit: [hero('smile', 'あれ？')],
  liftMissed: [op('panic', 'あっ！\nヴィランが乗ってた！')],
  liftFullHero: [hero('smile', 'あれ？')],
  liftFull: [op('deadpan', '定員オーバー…')],
  liftEndGood: [op('hype', 'ばっちり！\n最上階だよ')],
  liftEndBad: [op('deadpan', '最上階に\n着いたよ…')],
  bossChoice: [op('panic', '客は待て！\nシャンデリアは行け！')],
  bossGuestSaved: [op('hype', 'お客さん、\n無事！')],
  bossChandelierGo: [hero('smug', '天井へ\nおかえりーっ！')],
  bossChandelierFell: [op('deadpan', '床が…\n抜けた…')]
};

/**
 * 高層ビルで言い方を変える、路地裏と同じ種類のセリフ(content.ts の ReactionKey)。
 * ここにない種類は、路地裏と同じ文を使う
 */
export const TOWER_OVERRIDES = {
  pass: [
    hero('smile', 'お仕事\nおつかれさま！'),
    hero('smile', 'よい夜を！'),
    hero('smile', '最上階まで\nごゆっくり！'),
    hero('smile', 'ビルの平和は\n任せて！')
  ],
  bossReveal: [op('panic', '正体を現した！\nビルのオーナー！'), op('panic', '出た！\n念力の親玉！')],
  bossRampage: [op('panic', '親玉だった！\n家具が飛んでる！'), op('panic', '素通りした人が\n親玉だった！')],
  bossIdle: [op('panic', '手を止めないで！\n窓が割れてる！'), op('panic', '連打して！\n被害が増えてる！')],
  bossDefeated: [hero('smug', '正義は勝つ！'), hero('smug', '見たか！\n最上階の一撃！')],
  bossDefeatedOp: [op('hype', 'やったー！\n親玉を倒した！'), op('hype', 'ビル、\n平和になった！')]
} as const satisfies Readonly<Record<string, readonly Speech[]>>;

/**
 * 高層ビルで言い方を変える、地下駐車場と同じ種類のセリフ(garageContent.ts の GarageReactionKey)。
 * bossWreck は親玉を倒してシャンパンタワーに倒れこんだとき、
 * unlocked はショッピングモールをクリアして高層ビルが開いたとき(say('unlocked', rng, 'tower'))
 */
export const TOWER_GARAGE_OVERRIDES = {
  bossWreck: [op('panic', 'シャンパンタワーに…\n大丈夫？'), op('deadpan', '高いお酒が…')],
  unlocked: [op('hype', '高層ビルに行ける\nようになった！'), op('hype', '最後のステージが\n開いたよ！')]
} as const satisfies Readonly<Record<string, readonly Speech[]>>;

/**
 * ワルにした人に向かうときのヒーローの決めつけ(高層ビルの見た目)。
 * 市民かヴィランかでは変えない。ステージ4では「ヴィランに決まってる!」と決めつける
 */
export const TOWER_JUDGE_LINES: Readonly<Record<TowerLook, readonly Speech[]>> = {
  florist: [
    hero('smug', '花束があやしい！\nヴィランに決まってる！'),
    hero('smug', '花びらが多すぎ！\nヴィランに決まってる！'),
    hero('smug', 'エプロンがあやしい！\nヴィランに決まってる！')
  ],
  courier: [
    hero('smug', '箱があやしい！\nヴィランに決まってる！'),
    hero('smug', '帽子が深すぎ！\nヴィランに決まってる！'),
    hero('smug', '急ぎすぎ！\nヴィランに決まってる！')
  ],
  newbie: [
    hero('smug', '書類があやしい！\nヴィランに決まってる！'),
    hero('smug', '緊張しすぎ！\nヴィランに決まってる！'),
    hero('smug', '社員証があやしい！\nヴィランに決まってる！')
  ],
  janitor: [
    hero('smug', 'モップがあやしい！\nヴィランに決まってる！'),
    hero('smug', '床がきれいすぎ！\nヴィランに決まってる！'),
    hero('smug', '夜に働いてる！\nヴィランに決まってる！')
  ],
  chef: [
    hero('smug', '帽子が高すぎ！\nヴィランに決まってる！'),
    hero('smug', 'おたまがあやしい！\nヴィランに決まってる！'),
    hero('smug', '味見しすぎ！\nヴィランに決まってる！')
  ],
  waiter: [
    hero('smug', 'グラスがあやしい！\nヴィランに決まってる！'),
    hero('smug', '笑顔があやしい！\nヴィランに決まってる！'),
    hero('smug', '蝶ネクタイが変！\nヴィランに決まってる！')
  ],
  lady: [
    hero('smug', 'ドレスが派手すぎ！\nヴィランに決まってる！'),
    hero('smug', '羽があやしい！\nヴィランに決まってる！'),
    hero('smug', '香水が強すぎ！\nヴィランに決まってる！')
  ],
  magician: [
    hero('smug', '手品師はあやしい！\nヴィランに決まってる！'),
    hero('smug', '帽子から何か出る！\nヴィランに決まってる！'),
    hero('smug', 'つえがあやしい！\nヴィランに決まってる！')
  ]
};

/** 結果発表の画面に出る短い文(高層ビル)。ヴィランの本性ちらりは指先に紫の火花で「フッ…」、市民は今までと同じ */
export const TOWER_STREET_TEXTS = {
  band: '出動！待て・行けの出番',
  peekBad: 'フッ…',
  peekCiv: 'ぺこり'
} as const;

// ─── エレベーターラッシュ ─────────────────────────

/** エレベーターラッシュの帯 */
export const LIFT_BAND = '最上階へ！';

/** 初めてのラッシュの説明(オペレーター、2つ続けて) */
export const LIFT_INTRO_FIRST: readonly Speech[] = [
  op('panic', '乗ってくる人、\n全員殴っちゃう！'),
  op('normal', '周りが光ったらヴィラン！\n市民にだけ待て！')
];

/** 2回目からのラッシュの説明(オペレーター、1つ) */
export const LIFT_INTRO_AGAIN: readonly Speech[] = [
  op('panic', '最上階へ！\n市民にだけ待て！')
];

// ─── 終わりの場面 ─────────────────────────────────

/** 高層ビルのボスを初めて倒したときだけ出す、終わりの場面(朝日の差しこむパーティ会場。3枚) */
export const TOWER_ENDING: readonly Speech[] = [
  op('hype', '朝だ…\n親玉を倒したよ！'),
  hero('smug', '見たか！\n街もビルも守った！'),
  op('deadpan', '修理代の請求書も\n届いてるけどね')
];

/** 終わりの場面の右上に出すボタンの字 */
export const TOWER_ENDING_SKIP = 'とばす▶';

// ─── 称号のひとこと ───────────────────────────────

/**
 * 高層ビルで言い方を変える称号のひとこと(路地裏の文に「街」が入っているもの)。
 * content.ts の titleCommentFor(id, 'tower') で出る
 */
export const TOWER_TITLE_COMMENT_OVERRIDES = {
  demolition: op('deadpan', 'ビルの修理代、\n誰が払うの…')
} as const;

/**
 * 称号のひとこと(ステージ4の4つ。docs/STAGE4_TEXT.md「称号のひとこと」)。content.ts の TITLE_COMMENTS に入る。
 * topHero:最上階のヒーロー、furnitureGuide:空飛ぶ家具の見送り係、liftGuardian:エレベーターの守り神、sofaMaster:ソファの名人
 */
export const TOWER_TITLE_COMMENTS = {
  topHero: op('hype', '全部のステージ、\nクリアだよ！'),
  furnitureGuide: op('deadpan', '家具が飛ぶのを\n見てたよね'),
  liftGuardian: op('hype', '満員のエレベーターで\n一人も間違えなかった！'),
  sofaMaster: op('hype', 'ソファの上に\nぴったり落とした！')
} as const;
