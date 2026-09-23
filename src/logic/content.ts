// ゲームに出る日本語の文章をまとめたもの。
// 決まり:1行は全角12文字まで、1つのセリフは2行まで(改行は \n)。半角スペースとエムダッシュは使わない。
// 2人の名前はまだ決まっていないので、文の中で名前を呼ばない。
// ヒーローは元気で大げさで自信満々、オペレーターはため口でツッコむ幼なじみ。

import type { Rng } from './rng';
import type {
  AttackKind, DisguiseLook, HeroFace, Look, OperatorFace, OperatorHint, Speech, TitleId, WaveNo
} from './types';

const hero = (face: HeroFace, text: string): Speech => ({ who: 'hero', face, text });
const op = (face: OperatorFace, text: string): Speech => ({ who: 'operator', face, text });
const hint = (face: OperatorFace, text: string): OperatorHint => ({ face, text });

// ─── プロフィール ─────────────────────────────────

/** 見た目ごとの名前。市民とワルで同じ一覧を使う(名前で見分けられないように) */
export const NAMES: Readonly<Record<Look, readonly string[]>> = {
  hoodie: ['山本タクミ', '木村リョウ', '林ユウキ', '清水ダイチ', '森カズヤ', '池田ショウ', '石井レン', '斉藤ハヤト', '松田コウ', '前田ソウタ'],
  suit: ['田中誠', '鈴木健一', '高橋修', '渡辺浩二', '伊藤隆', '中村聡', '小林徹', '加藤正樹', '吉田稔', '山下亮'],
  shopper: ['松本由美', '井上恵子', '佐々木陽子', '山口直美', '岡田久美', '長谷川幸', '藤田真理', '後藤明美', '村田京子', '原田里香'],
  mohawk: ['鬼塚リュウジ', '権田ゴウ', '黒岩ダン', '毒島ケン', '赤城トオル', '牙野ジン'],
  granny: ['梅田ハナ', '松井トメ', '竹内キヨ', '菊池フミ', '小川ウメ', '杉山チヨ', '野口タマ', '村上シズ', '大野スエ', '今井キク']
};

/** 見た目ごとの年齢の幅(両端を含む)。市民とワルで同じ */
export const AGES: Readonly<Record<Look, readonly [number, number]>> = {
  hoodie: [17, 28],
  suit: [28, 54],
  shopper: [32, 61],
  mohawk: [19, 27],
  granny: [71, 89]
};

/**
 * プロフィールの一文。嘘は書かないが、どちらとも取れる。
 * 市民とワルで似た言い回しを並べ、どちらの一覧にも見た目や動きの手がかりに合う言葉を混ぜる。
 */
export const PROFILE_LINES: Readonly<Record<Look, { civ?: readonly string[]; bad?: readonly string[] }>> = {
  hoodie: {
    // 市民:ポケットに財布。ポケットに手を入れて待つ
    civ: [
      'ポケットの中身は\n今月の全財産',
      '人を待っている。\n相手はまだ来ない',
      '夜の散歩が好き。\n路地裏は近道',
      '手ぶらに見えるが\n持つ物は持っている',
      '最近、財布を\n新しくした',
      'バイト帰り。\n今日は給料日'
    ],
    // ワル:ポケットからナイフの柄。ポケットを押さえてキョロキョロ
    bad: [
      'ポケットの中身は\n見せたくない',
      '待ち合わせ中。\n相手は決めてない',
      '夜の路地裏に\nくわしい',
      '手ぶらに見えるが\nそうでもない',
      '最近、よく\n後ろをふり返る',
      '今日は\n稼ぎどきらしい'
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
      '路地裏は近道。\n急いでいる'
    ],
    // ワル:女物のバッグを抱えている。バッグを抱え直して後ろを気にする
    bad: [
      '急ぐ理由は\n人に言えない',
      '後ろが\n気になる性分',
      '大事な物を\n運んでいるところ',
      '今日は朝から\n走りっぱなし',
      '赤い物が好き。\n最近手に入れた',
      '荷物が多いのは\n慣れている'
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
      '袋は二重にする派'
    ],
    // ワル:袋から財布や腕時計がのぞく。袋の口を手でふさぐ
    bad: [
      '今日は大漁。\n持ちきれない',
      '袋の中身は\nひみつ',
      'キラキラした物が\n好き',
      'この辺の人は\nだいたい知ってる',
      '財布はいくつ\nあっても困らない',
      '人ごみが好き。\n用事はすぐ済む'
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
  }
};

/**
 * ボスの化けた姿のプロフィール。どれも「どこか1か所おかしい」と気づける一文にする
 * (絵では、少し背が高く、腕に水色の入れ墨がのぞく)。
 */
export const BOSS_PROFILE_LINES: Readonly<Record<DisguiseLook, readonly string[]>> = {
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

// ─── オペレーターの一言(仕分け中) ────────────────

/**
 * オペレーターの一言。嘘はつかないが、どちらとも取れる言い方にする。
 * SPECの表の一言(「ポケットがふくらんでる…」など)は市民にもワルにも入れる。
 */
export const OPERATOR_HINTS: Readonly<Record<Look, { civ?: readonly OperatorHint[]; bad?: readonly OperatorHint[] }>> = {
  hoodie: {
    civ: [
      hint('normal', 'ポケットが\nふくらんでる…'),
      hint('normal', 'ずっと手を\nポケットに入れてる'),
      hint('normal', '誰かを\n待ってるみたい'),
      hint('deadpan', '落ち着いてる…\nように見える'),
      hint('normal', '茶色い物が\nちらっと見えた')
    ],
    bad: [
      hint('normal', 'ポケットが\nふくらんでる…'),
      hint('normal', 'ポケットを\n押さえてるね'),
      hint('panic', 'さっきから\nキョロキョロしてる'),
      hint('deadpan', '落ち着きが\nないような…'),
      hint('normal', '黄色い物が\nちらっと見えた')
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
      hint('deadpan', '袋、\nはち切れそう')
    ],
    bad: [
      hint('normal', '袋がやけに\n重そう'),
      hint('normal', '袋の口を\n押さえてるね'),
      hint('normal', '金色の物が\nのぞいてる'),
      hint('deadpan', '買い物帰り…\nなのかな？'),
      hint('panic', '袋、\nはち切れそう')
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
  }
};

/** ボスの化けた姿の一言。どれも「どこか1か所おかしい」ところを指す */
export const BOSS_HINTS: Readonly<Record<DisguiseLook, readonly OperatorHint[]>> = {
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

// ─── ステージ前の掛け合い ─────────────────────────

/** 最初に遊ぶときの掛け合い。遊び方もここで伝える。上から順に出す */
export const INTRO: readonly Speech[] = [
  hero('smug', '今日も街の平和は\nこのヒーローが守る！'),
  op('deadpan', 'ワルと市民の区別も\nつかないくせに'),
  hero('smile', 'そこは相棒の出番！\n頼りにしてるよ！'),
  op('normal', 'はいはい。\nじゃあいつものやつ'),
  op('normal', '左にスワイプでワル\n右にスワイプで市民'),
  op('normal', '下のボタンでも\n仕分けできるよ'),
  op('normal', '見た目と動きと\nプロフィールを見て'),
  op('hype', 'あと私の一言も\nヒントにしてね'),
  op('normal', '時間切れだと\nこの子が勝手に決める'),
  hero('smug', '半々で当たる！\nたぶん！'),
  op('deadpan', 'それ、ただの運'),
  op('normal', '結果発表で、殴る前に\n待てで止められる'),
  op('normal', '逃げるワルには\n行けで追い打ち！'),
  hero('smug', '任せて！\n全員ぶっ飛ばす！'),
  op('panic', '全員は\nぶっ飛ばさないで！')
];

/** 2回目からの短い掛け合い(もう一回のとき) */
export const INTRO_REPLAY: readonly Speech[] = [
  hero('smug', 'もう一回！\n今度こそ完ぺき！'),
  op('deadpan', '左がワル、\n右が市民だからね'),
  op('normal', '待てと行けも\n忘れないで'),
  hero('smile', '任せて！')
];

/** 波の始まりの一言。上から順に出す */
export const WAVE_INTRO: Readonly<Record<WaveNo, readonly Speech[]>> = {
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
  | 'timeUpOp'       // 時間切れへのツッコミ(オペレーター)
  | 'sortDone'       // 仕分けが終わって結果発表へ(ヒーロー)
  | 'streetWatch'    // 結果発表の始まりの一言のあと、少ししてから(オペレーター)
  | 'hitBad'         // ワルを倒した(オペレーター)
  | 'hitBadHero'     // ワルを倒した(ヒーロー)
  | 'oops'           // 市民を殴ってしまった:やっちまったー(ヒーロー)
  | 'okay'           // 立ち直る:まあいいか(ヒーロー)
  | 'tsukkomi'       // まあいいか、へのツッコミ。そのステージで1回目(オペレーター)
  | 'tsukkomiShort'  // 同じステージの2回目から(オペレーター)
  | 'hitCiv'         // ヒーローが市民を直接殴った瞬間(オペレーター)
  | 'collateral'     // 巻きぞえで市民に当たった(オペレーター)
  | 'grannyHit'      // おばあさんに当たった(オペレーター)
  | 'specialOnCiv'   // 必殺技が市民に当たった(オペレーター)
  | 'stop'           // 待てで止まった:了解(ヒーロー)
  | 'stopOp'         // 待てで止まったあと(オペレーター)
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
  timeUpOp: [op('panic', '勘はやめて！'), op('deadpan', 'せめて考えて')],
  sortDone: [hero('smug', '仕分け完了！\n行ってくる！'), hero('smug', 'よーし、\n出動！')],
  streetWatch: [op('normal', '殴る前なら\n待てで止められる'), op('normal', '悪さをされたら\n行けで追いかけて')],
  hitBad: [op('hype', 'ナイス！'), op('hype', 'いいね！\nその調子！'), op('hype', 'よし、\n1人片付いた！')],
  hitBadHero: [hero('smug', '正義の勝利！'), hero('smug', '悪は許さない！')],
  oops: [
    hero('oops', 'やっちまったー！'),
    hero('oops', 'あっ…\nやっちまったー！'),
    hero('oops', 'しまったーっ！\n市民だった！')
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
    op('panic', '巻きぞえ！\n関係ない人！'),
    op('panic', '今の、奥の人に\n当たったよ！')
  ],
  grannyHit: [op('panic', 'おばあちゃん\nだったのに！'), op('panic', 'よりによって\nおばあちゃん！')],
  specialOnCiv: [op('panic', '必殺技を市民に\n当てないで！'), op('panic', '光線が市民に！\n何してんの！')],
  stop: [hero('smile', '了解！'), hero('smile', '了解！\n止まります！'), hero('smile', 'おっと、了解！')],
  stopOp: [op('normal', '了解、次！'), op('normal', 'はい、次に\n行こう！'), op('normal', 'よし、先へ！')],
  stopFailBoss: [hero('oops', 'えっ、止まれ…\nないっ！'), hero('smug', 'こいつは\n止まれない！')],
  go: [hero('smug', '行ってくる！'), hero('smug', '逃がすかーっ！'), hero('smug', '待てーっ！\n悪党ーっ！')],
  goOp: [op('hype', '行け！'), op('hype', '追いかけて！')],
  pass: [
    hero('smile', 'こんにちは！'),
    hero('smile', '気をつけて\n帰ってね！'),
    hero('smile', 'いい夜だね！'),
    hero('smile', '街の平和は\n任せて！')
  ],
  mischiefHero: [hero('oops', 'あれっ！？\nいい人だと思ったのに！'), hero('oops', 'えっ、\nワルだったの！？')],
  escaped: [op('deadpan', '逃げられた…'), op('deadpan', 'あーあ、\n行っちゃった'), op('deadpan', '逃がしたね…')],
  bossReveal: [op('panic', '正体を現した！\nこいつがボスだ！'), op('panic', '出た！\n路地裏のボス！')],
  bossRevealHero: [hero('smug', 'やっぱりね！\n最初から分かってた！'), hero('smug', '見破ったり！')],
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
  soSo: op('normal', 'まあまあ…\nだったかな')
};

// ─── 選ぶための関数 ───────────────────────────────

/** 一覧から1つ選ぶ。rng を渡さなければ Math.random で選ぶ */
export function pickSpeech(list: readonly Speech[], rng?: Rng): Speech {
  if (list.length === 0) throw new Error('pickSpeech: 空の一覧');
  return rng ? rng.pick(list) : list[Math.floor(Math.random() * list.length)];
}

/** 結果発表とボス戦のセリフを1つ選ぶ。例:say('oops', rng) */
export function say(key: ReactionKey, rng?: Rng): Speech {
  return pickSpeech(REACTIONS[key], rng);
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

/** ワルが悪さを始めたときの一言 */
export function mischiefLine(look: Look, rng?: Rng): Speech {
  const key = look === 'granny' ? 'hoodie' : look;
  return pickSpeech(MISCHIEF_LINES[key], rng);
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
  addList(INTRO_REPLAY);
  for (const w of [1, 2, 3] as WaveNo[]) addList(WAVE_INTRO[w]);
  for (const k of Object.keys(ATTACK_SHOUTS) as AttackKind[]) addList(ATTACK_SHOUTS[k]);
  for (const k of Object.keys(REACTIONS) as ReactionKey[]) addList(REACTIONS[k]);
  for (const k of Object.keys(MISCHIEF_LINES) as (keyof typeof MISCHIEF_LINES)[]) addList(MISCHIEF_LINES[k]);
  addList(Object.values(TITLE_COMMENTS));
  return out;
}
