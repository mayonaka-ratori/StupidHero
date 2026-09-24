// フリープレイの日本語の文章(docs/FREEPLAY.md の「掛け合い」「3回の波」「ヒーロー」「オペレーター」)。
// 決まりは content.ts と同じ(1行は全角12文字まで、2行まで。半角スペースとエムダッシュは使わない。名前は呼ばない)。
// ヒーローは元気でおバカで自信満々、謝らない。オペレーターはため口で、ヒーローの思いこみにツッコむ。
// フリープレイでは仕分けをしないので、オペレーターが自分の仕分けを責める一言(「…ワルにしたの、私だけど」)は出さない。
//
// 使い方:
//   const lines = createFreeLines(rng);          // 1回のフリープレイで1つ作る(同じ文を続けて出さない仕組みを持つ)
//   FREE_INTRO                                   // 初回だけの掛け合い3枚
//   lines.declare(wave.bgStage, wave.rule)       // 波の始めの決めつけと、オペレーターのツッコミ
//   lines.redeclare(from, to)                    // 波3のルールの言い直し
//   lines.heroAttack(person.look, rule)          // 殴りかかるときの一言(波3は小物の名前が入る)
//   lines.heroPass(person.look)                  // 素通りするときの一言(ワルには、おバカな見落とし)
//   lines.heroStubborn() / heroToldYou() / heroDryPress()
//   lines.op(key, count)                         // オペレーターの一言。count はその場面が何回目か(1始まり)
// 文字の確かめとフォントの読みこみ用に、全部の文を allFreeTexts() で返す(content.ts の allTexts() に入れてある)。

import { FREE_ITEMS, FREE_ITEM_NAME, FREE_NAME, ruleSignText } from './freeNames';
import type { Rng } from './rng';
import type { FreeItem, FreeRule, FreeVillainLook, HeroFace, Look, OperatorFace, Speech, StageId } from './types';

const hero = (face: HeroFace, text: string): Speech => ({ who: 'hero', face, text });
const op = (face: OperatorFace, text: string): Speech => ({ who: 'operator', face, text });

/** フリープレイに出る見た目(今の見た目と、一目で分かるワル) */
type FreeLook = Look | FreeVillainLook;

/** 文の中の {item}、{from}、{to} を小物の名前に置きかえる */
function fillItems(text: string, names: { item?: FreeItem; from?: FreeItem; to?: FreeItem }): string {
  let out = text;
  if (names.item) out = out.split('{item}').join(FREE_ITEM_NAME[names.item]);
  if (names.from) out = out.split('{from}').join(FREE_ITEM_NAME[names.from]);
  if (names.to) out = out.split('{to}').join(FREE_ITEM_NAME[names.to]);
  return out;
}

const fillSpeech = (s: Speech, names: { item?: FreeItem; from?: FreeItem; to?: FreeItem }): Speech =>
  ({ ...s, text: fillItems(s.text, names) });

// ─── 掛け合い ─────────────────────────────────────

/** 初めてフリープレイを遊ぶときの掛け合い。上から順に出す */
export const FREE_INTRO: readonly Speech[] = [
  op('normal', '今日は仕分けなし！\n好きにやらせてみる'),
  hero('smug', 'まかせて！\n見れば分かるもん！'),
  op('deadpan', '…絶対まちがえる。\n待てと行けで直してね')
];

// ─── 波の始めの決めつけ ───────────────────────────

/** 決めつけ1つ。ヒーローの見た目だけのこじつけと、オペレーターのツッコミの組 */
export interface FreeDeclare {
  hero: Speech;
  op: Speech;
}

const pair = (heroText: string, opText: string, opFace: OperatorFace = 'deadpan'): FreeDeclare =>
  ({ hero: hero('smug', heroText), op: op(opFace, opText) });

/** 背景ごとの決めつけ。小物のルールは小物ごと({item} に小物の名前が入る) */
export interface FreeDeclareSet {
  allBad: readonly FreeDeclare[];
  allCiv: readonly FreeDeclare[];
  item: Readonly<Record<FreeItem, readonly FreeDeclare[]>>;
}

/**
 * 波の始めの決めつけ。理由は、その背景の見た目だけのこじつけ(路地裏は暗い、ゴミ箱、自販機、看板。
 * 地下駐車場は地下、灰色の柱、コーン、車、白い線。ショッピングモールは明るい、人が多い、マネキン、ガチャ、噴水)
 */
export const FREE_DECLARES: Readonly<Record<StageId, FreeDeclareSet>> = {
  alley: {
    allBad: [
      pair('暗いから\nワルだらけ！', '暗いってだけで！？', 'panic'),
      pair('ゴミ箱が多い！\nここはワルの巣だ！', 'ゴミ箱は\n関係ないでしょ'),
      pair('路地裏だよ？\nみんなワルに決まってる', 'その決め方、\n雑すぎ！')
    ],
    allCiv: [
      pair('自販機が光ってる！\nみんないい人！', '自販機で\n決めないで！'),
      pair('静かだから\nワルはいなさそう！', '静かなのが\nいちばんあやしいの！', 'panic'),
      pair('看板がかわいい！\nここはいい人ばかり！', '看板は\n人じゃないよ！')
    ],
    item: {
      balloon: [
        pair('暗い所に風船！\n{item}の人はワル！', '{item}は\n悪くないって！'),
        pair('空へ逃げる気だ！\n{item}の人はワル！', 'そんなに\n飛ばないよ！')
      ],
      hat: [
        pair('暗いのに帽子！\n{item}の人はワル！', '{item}くらい\nかぶるでしょ！'),
        pair('とんがってる！\n{item}の人はワル！', 'とがってるのは\n{item}だけ！')
      ],
      bag: [
        pair('中身が見えない！\n{item}の人はワル！', '{item}は\nそういう物なの！'),
        pair('路地裏に紙袋！\n{item}の人はワル！', 'お買い物\nしただけでしょ！')
      ]
    }
  },
  garage: {
    allBad: [
      pair('地下だから\nワルだらけ！', '地下ってだけで！？', 'panic'),
      pair('灰色の柱ばっかり！\nみんなワルだ！', '柱の色で\n決めないで！'),
      pair('コーンが並んでる！\nここはワルだらけ！', 'コーンは\nただのコーン！')
    ],
    allCiv: [
      pair('車がピカピカ！\nみんないい人！', '車しか\n見てないじゃん！'),
      pair('ひんやり涼しい！\nワルはいなさそう！', '涼しいのと\n関係ある！？', 'panic'),
      pair('白い線がまっすぐ！\nまっすぐないい人ばかり！', '線がまっすぐでも\nワルはいるよ')
    ],
    item: {
      balloon: [
        pair('地下に風船！\n{item}の人はワル！', '{item}の何が\nダメなの！？', 'panic'),
        pair('天井に引っかける気だ！\n{item}の人はワル！', '何のために！？', 'panic')
      ],
      hat: [
        pair('地下で帽子！\n{item}の人はワル！', '地下でも\nかぶるよ！'),
        pair('天井に刺さりそう！\n{item}の人はワル！', '刺さらないよ！')
      ],
      bag: [
        pair('車があるのに紙袋！\n{item}の人はワル！', '車に乗る前でしょ！'),
        pair('紙袋がガサガサ！\n{item}の人はワル！', '音で決めないで！')
      ]
    }
  },
  mall: {
    allBad: [
      pair('人が多すぎる！\nワルだらけに違いない！', '多いのは\nお客さんだよ！'),
      pair('マネキンがにらんでる！\nここはワルだらけ！', 'マネキンは\nにらまないよ'),
      pair('ガチャが多い！\nみんなワルだ！', 'ガチャで\n決めないで！')
    ],
    allCiv: [
      pair('明るいから\nいい人ばかり！', '明るいってだけで！？', 'panic'),
      pair('噴水がきれい！\nワルはいなさそう！', '噴水、\n見てただけでしょ'),
      pair('音楽が楽しい！\nみんないい人！', 'のんきすぎ！')
    ],
    item: {
      balloon: [
        pair('勝手に取った顔！\n{item}の人はワル！', 'もらったんでしょ！'),
        pair('明るい所で風船！\n{item}の人はワル！', 'ここ、{item}\nいっぱいあるよ！')
      ],
      hat: [
        pair('パーティー気分！\n{item}の人はワル！', 'パーティーは\n悪くない！'),
        pair('マネキンと同じ帽子！\n{item}の人はワル！', 'マネキンも\nワルなの！？', 'panic')
      ],
      bag: [
        pair('買いすぎの顔！\n{item}の人はワル！', 'ここ、お店だよ！\n{item}持つでしょ！'),
        pair('中身が重そう！\n{item}の人はワル！', '重いのは\n買ったから！')
      ]
    }
  }
};

/** 波の始めの決めつけの一覧(小物の名前を入れたあと) */
export function declareList(bgStage: StageId, rule: FreeRule): readonly FreeDeclare[] {
  const set = FREE_DECLARES[bgStage];
  if (rule.kind === 'allBad') return set.allBad;
  if (rule.kind === 'allCiv') return set.allCiv;
  const item = rule.item;
  return set.item[item].map((d) => ({ hero: fillSpeech(d.hero, { item }), op: fillSpeech(d.op, { item }) }));
}

// ─── ルールの言い直し(波3) ────────────────────────

/** 言い直すときのヒーロー({from} は前の小物、{to} は新しい小物) */
export const FREE_REDECLARE_HERO: readonly Speech[] = [
  hero('smug', 'やっぱりやめた！\n{to}の人がワル！'),
  hero('smug', '{from}はもう古い！\n{to}の人がワル！'),
  hero('smug', 'ひらめいた！\n本当は{to}の人がワル！'),
  hero('smug', '{from}じゃなかった！\n{to}の人がワル！'),
  hero('smug', 'よく見たら\nやっぱり{to}の人がワル！')
];

/** 言い直しへのツッコミ(オペレーター) */
export const FREE_REDECLARE_OP: readonly Speech[] = [
  op('panic', 'また変えた！？'),
  op('panic', 'さっきと\n違うじゃん！'),
  op('panic', '{from}の人は\nもういいの！？'),
  op('deadpan', 'ルール、\nそんなに軽いの！？'),
  op('deadpan', 'ころころ\n変えないで！')
];

// ─── 殴りかかるときと素通りするときの一言 ─────────

/**
 * 殴りかかるときの一言(ワルだらけの波)。見た目だけのこじつけ。
 * 市民の見た目も、一目で分かるワルも同じ言い方にする(ヒーローはどちらも自信満々)
 */
export const FREE_ATTACK: Readonly<Record<FreeLook, readonly Speech[]>> = {
  // 路地裏
  hoodie: [
    hero('smug', 'フードがあやしい！'),
    hero('smug', 'ポケットに\n何か入ってる！'),
    hero('smug', '手を隠してる！\nワルだ！'),
    hero('smug', 'パーカーは\nワルの服！'),
    hero('smug', '目つきが悪い！'),
    hero('smug', 'ポケットの中は\nきっと悪い物！')
  ],
  suit: [
    hero('smug', '走ってる！\n逃げる気だ！'),
    hero('smug', 'ネクタイが\nあやしい！'),
    hero('smug', '時計ばっかり見てる！\nワルだ！'),
    hero('smug', 'スーツで\nごまかしてもムダ！'),
    hero('smug', 'あせってる！\nワルの顔だ！')
  ],
  shopper: [
    hero('smug', 'その袋、あやしい！'),
    hero('smug', '買いすぎ！\nワルに決まってる！'),
    hero('smug', '袋の中身は\nきっと盗んだ物！'),
    hero('smug', '米袋が\n武器っぽい！'),
    hero('smug', 'おつりを\nごまかした顔！')
  ],
  mohawk: [
    hero('smug', 'トゲトゲ頭！\nワルだ！'),
    hero('smug', 'どう見ても\nワル！'),
    hero('smug', 'ナイフ持ってる！\nワルだ！'),
    hero('smug', 'サングラスが\n悪そう！'),
    hero('smug', '髪型がとがってる！')
  ],
  granny: [
    hero('smug', '杖が武器っぽい！'),
    hero('smug', 'にこにこしすぎ！\nワルだ！'),
    hero('smug', '腰のたたき方が\nあやしい！'),
    hero('smug', 'ゆっくり歩くのは\n作戦だ！'),
    hero('smug', 'おばあちゃんに\n化けたワルだ！')
  ],
  // 地下駐車場
  guard: [
    hero('smug', '腕章があやしい！'),
    hero('smug', '見回りのふりだ！'),
    hero('smug', '帽子で目を\n隠してる！'),
    hero('smug', 'キョロキョロしすぎ！'),
    hero('smug', 'ピシッとしすぎ！\nあやしい！')
  ],
  mechanic: [
    hero('smug', 'つなぎが油っぽい！'),
    hero('smug', '手が真っ黒！\nワルだ！'),
    hero('smug', 'カギを持ちすぎ！'),
    hero('smug', 'タオルを首に！\nあやしい！'),
    hero('smug', '車をいじる気だ！')
  ],
  clubber: [
    hero('smug', '服がハデすぎる！'),
    hero('smug', 'ヘアバンドが\nあやしい！'),
    hero('smug', 'ノリが軽そう！\nワルだ！'),
    hero('smug', 'ステップが\n悪そう！'),
    hero('smug', 'キラキラしすぎ！')
  ],
  officelady: [
    hero('smug', 'スカーフがあやしい！'),
    hero('smug', 'ヒールの音が\nワルっぽい！'),
    hero('smug', '目つきが鋭い！'),
    hero('smug', 'バッグを\n抱えすぎ！'),
    hero('smug', '早歩きが\nあやしい！')
  ],
  // ショッピングモール
  mascot: [
    hero('smug', '着ぐるみがあやしい！'),
    hero('smug', '中の人が\nワルだ！'),
    hero('smug', 'クマはワル！'),
    hero('smug', 'ふらふらしてる！\nワルだ！'),
    hero('smug', '顔が動かない！\nあやしい！')
  ],
  clerk: [
    hero('smug', '名札があやしい！'),
    hero('smug', 'あくびした！\nワルだ！'),
    hero('smug', '居眠りのふりだ！'),
    hero('smug', 'ねむそうな顔は\nワルの顔！'),
    hero('smug', '目の下が黒い！\nワルだ！')
  ],
  dancer: [
    hero('smug', 'カクカクしてる！'),
    hero('smug', 'ダンスがあやしい！'),
    hero('smug', 'イヤホンで\n指令を聞いてる！'),
    hero('smug', '帽子が\n悪そう！'),
    hero('smug', 'ロボットみたい！\nワルだ！')
  ],
  uncle: [
    hero('smug', 'チラシを見すぎ！'),
    hero('smug', '袋が\nあやしい！'),
    hero('smug', '腰のさすり方が\nあやしい！'),
    hero('smug', 'セールに\n本気すぎ！'),
    hero('smug', '買い物が\n早すぎる！')
  ],
  // 一目で分かるワル(ヒーローが正しいとき)
  fp_mohawk: [
    hero('smug', 'ナイフ持ってる！\nワルだ！'),
    hero('smug', 'トゲトゲ頭！\nどう見てもワル！'),
    hero('smug', '分かりやすい！\nワルだ！'),
    hero('smug', '今日いちばんの\nワル顔！'),
    hero('smug', 'ナイフを\nふり回すな！')
  ],
  fp_gang: [
    hero('smug', 'バンダナで\n顔を隠してる！'),
    hero('smug', 'バットを持ってる！\nワルだ！'),
    hero('smug', 'どう見ても\nギャング！'),
    hero('smug', '顔が見えない！\nワルだ！'),
    hero('smug', 'バットは\n野球でどうぞ！')
  ],
  fp_alien: [
    hero('smug', '触角がある！\n宇宙人だ！'),
    hero('smug', '緑色！\nワルに決まってる！'),
    hero('smug', 'どう見ても\n宇宙人！'),
    hero('smug', '地球の平和は\nぼくが守る！'),
    hero('smug', 'ピピッて言った！\nワルだ！')
  ]
};

/** 波3で殴りかかるときの一言。どれも小物の名前({item})が入る */
export const FREE_ITEM_ATTACK: Readonly<Record<FreeItem, readonly Speech[]>> = {
  balloon: [
    hero('smug', '{item}だからワル！'),
    hero('smug', '{item}を持ってる！\nワルだ！'),
    hero('smug', 'フワフワしてる！\n{item}はワルの印！'),
    hero('smug', '{item}で逃げる気だ！'),
    hero('smug', '{item}の人は\nワル！決まり！'),
    hero('smug', 'ルール通り！\n{item}はワル！')
  ],
  hat: [
    hero('smug', '{item}だからワル！'),
    hero('smug', 'とんがり{item}！\nワルだ！'),
    hero('smug', '{item}がとがってる！\nワルだ！'),
    hero('smug', '{item}で\n何か隠してる！'),
    hero('smug', '{item}の人は\nワル！決まり！'),
    hero('smug', 'ルール通り！\n{item}はワル！')
  ],
  bag: [
    hero('smug', '{item}だからワル！'),
    hero('smug', '{item}を持ってる！\nワルだ！'),
    hero('smug', '{item}の中身は\nきっと悪い物！'),
    hero('smug', '{item}がガサガサ！\nワルだ！'),
    hero('smug', '{item}の人は\nワル！決まり！'),
    hero('smug', 'ルール通り！\n{item}はワル！')
  ]
};

/**
 * 素通りするときの一言。市民にはほめ言葉やあいさつ。
 * 一目で分かるワルには、おバカな見落とし(「そのバット、野球だよね!」)
 */
export const FREE_PASS: Readonly<Record<FreeLook, readonly Speech[]>> = {
  // 路地裏
  hoodie: [
    hero('smile', 'いいパーカー！'),
    hero('smile', 'こんばんは！'),
    hero('smile', 'あったかそう！'),
    hero('smile', 'ポケットに手、\n寒いの？'),
    hero('smile', '夜道に\n気をつけてね！')
  ],
  suit: [
    hero('smile', 'お仕事\nお疲れさま！'),
    hero('smile', 'いってらっしゃい！'),
    hero('smile', 'ネクタイ、\n決まってる！'),
    hero('smile', '急いでるね！\nがんばって！'),
    hero('smile', '会議に\n間に合うといいね！')
  ],
  shopper: [
    hero('smile', '買い物上手！'),
    hero('smile', '重そうだね！\n気をつけて！'),
    hero('smile', 'お米、\nおいしそう！'),
    hero('smile', '今日は\n何作るの？'),
    hero('smile', 'いい笑顔！')
  ],
  mohawk: [
    hero('smile', 'その髪型、\nおしゃれだね！'),
    hero('smile', 'かっこいい！'),
    hero('smile', 'サングラス、\n似合ってる！'),
    hero('smile', 'こんにちは！'),
    hero('smile', 'トゲトゲ、\n決まってる！')
  ],
  granny: [
    hero('smile', 'おばあちゃん、\nこんにちは！'),
    hero('smile', 'ゆっくりでいいよ！'),
    hero('smile', '腰、お大事に！'),
    hero('smile', 'いい笑顔！'),
    hero('smile', '長生きしてね！')
  ],
  // 地下駐車場
  guard: [
    hero('smile', '見回り、\nお疲れさま！'),
    hero('smile', '帽子、\n似合ってる！'),
    hero('smile', '安全は\nまかせたよ！'),
    hero('smile', 'いつもありがとう！'),
    hero('smile', 'ピシッとしてる！')
  ],
  mechanic: [
    hero('smile', 'お仕事\nお疲れさま！'),
    hero('smile', '車の修理、\nがんばって！'),
    hero('smile', 'タオル、\n似合ってる！'),
    hero('smile', '手が黒いのは\n働き者の手！'),
    hero('smile', 'いい笑顔！')
  ],
  clubber: [
    hero('smile', 'ノリがいいね！'),
    hero('smile', '服、ハデで\nかっこいい！'),
    hero('smile', '気をつけて\n帰ってね！'),
    hero('smile', 'ヘアバンド、\n似合ってる！'),
    hero('smile', '楽しそう！')
  ],
  officelady: [
    hero('smile', 'お仕事\nお疲れさま！'),
    hero('smile', 'スカーフ、\nすてき！'),
    hero('smile', '安全運転でね！'),
    hero('smile', 'ヒールの音、\nかっこいい！'),
    hero('smile', 'いってらっしゃい！')
  ],
  // ショッピングモール
  mascot: [
    hero('smile', 'クマさん、\nこんにちは！'),
    hero('smile', 'モルくんだ！'),
    hero('smile', '暑そう！\nがんばって！'),
    hero('smile', 'かわいい！'),
    hero('smile', '風船ちょうだい！')
  ],
  clerk: [
    hero('smile', 'いつも\nありがとう！'),
    hero('smile', 'ねむそう！\nがんばって！'),
    hero('smile', 'お仕事\nお疲れさま！'),
    hero('smile', '名札、\nいい名前！'),
    hero('smile', 'あくび、\nうつりそう！')
  ],
  dancer: [
    hero('smile', 'ダンス、\nかっこいい！'),
    hero('smile', 'ノリがいいね！'),
    hero('smile', 'ロボットみたい！\nすごい！'),
    hero('smile', '帽子、\n似合ってる！'),
    hero('smile', '練習がんばって！')
  ],
  uncle: [
    hero('smile', 'いい買い物した？'),
    hero('smile', 'セール、\nやってるね！'),
    hero('smile', '腰、お大事に！'),
    hero('smile', 'こんにちは！'),
    hero('smile', '袋、重そう！\n気をつけて！')
  ],
  // 一目で分かるワル(おバカな見落とし)
  fp_mohawk: [
    hero('smile', 'そのナイフ、\nおもちゃだよね！'),
    hero('smile', 'ナイフで\nリンゴむくの？'),
    hero('smile', 'お料理の帰り？'),
    hero('smile', 'トゲトゲ、\nおしゃれだね！'),
    hero('smile', '怖い顔だけど\nいい人だよね！')
  ],
  fp_gang: [
    hero('smile', 'そのバット、\n野球だよね！'),
    hero('smile', 'バンダナ、\nかっこいい！'),
    hero('smile', 'かぜ？\nお大事にね！'),
    hero('smile', 'ホームラン\nねらってね！'),
    hero('smile', '練習がんばって！')
  ],
  fp_alien: [
    hero('smile', '緑の服、\nおしゃれだね！'),
    hero('smile', 'その触角、\nカチューシャだよね！'),
    hero('smile', '顔色悪いよ？\nお大事にね！'),
    hero('smile', 'どこから来たの？\n遠くから？'),
    hero('smile', 'コスプレ上手！')
  ]
};

/** 見た目の一覧にない見た目のとき(ふつうは使わない。見た目が増えても止まらないように) */
const FREE_FALLBACK_ATTACK: readonly Speech[] = [
  hero('smug', '悪そうな顔！'),
  hero('smug', 'ピンときた！\nワルだ！'),
  hero('smug', '見れば分かる！\nワルだ！')
];
const FREE_FALLBACK_PASS: readonly Speech[] = [
  hero('smile', 'いい笑顔！'),
  hero('smile', 'こんにちは！'),
  hero('smile', '気をつけて\n帰ってね！')
];

// ─── ヒーローのそのほかの一言 ─────────────────────

/** 市民を殴っても謝らない一言 */
export const FREE_STUBBORN: readonly Speech[] = [
  hero('smug', 'でもルール通りだし！'),
  hero('smug', 'ルールは\nルールだもん！'),
  hero('smug', '決めたことは\n決めたこと！'),
  hero('smug', 'ぼくは\nまちがってない！'),
  hero('smug', 'だって\nそう見えたし！'),
  hero('smug', '見た目で\n決めたもん！')
];

/** ワルに待てを押したあと、そのワルが悪さを始めたとき */
export const FREE_TOLD_YOU: readonly Speech[] = [
  hero('smug', 'ほら、やっぱり\nワルじゃん！'),
  hero('smug', 'ほらね！\nぼくの言った通り！'),
  hero('smug', 'だから言ったのに！'),
  hero('smug', 'ほら！\nワルだったでしょ！'),
  hero('smug', '止めなくて\nよかったのに！')
];

/** 空押しで振り向いたとき */
export const FREE_DRY_PRESS: readonly Speech[] = [
  hero('smile', '？'),
  hero('smile', 'ん？'),
  hero('smile', 'なに？'),
  hero('smile', '呼んだ？'),
  hero('smile', '…？')
];

// ─── オペレーターの一言 ───────────────────────────

export type FreeOpKey =
  | 'hitCivRule'   // ルールに当てはまる市民に殴りかかる(待てのマークが出たとき)
  | 'passBadRule'  // ルールに当てはまらないワルを素通り
  | 'redeclare'    // ルールを言い直した
  | 'saved'        // 待てで市民を守った
  | 'hitCiv'       // 市民を殴ってしまった
  | 'idle'         // 押さない時間が続く(だんだんあきらめる)
  | 'goDone'       // 行けで決めた
  | 'escaped'      // 逃がした
  | 'recovered';   // ワルに待てを押したあと、行けで倒した

export const FREE_OP_KEYS: readonly FreeOpKey[] = [
  'hitCivRule', 'passBadRule', 'redeclare', 'saved', 'hitCiv', 'idle', 'goDone', 'escaped', 'recovered'
];

/**
 * オペレーターの一言。場面ごとに3段:1回目、2回目から、何度も(ふつうは5回目から、idle は4回目から)。
 * 回数が増えるほど、あきれたり慣れたりした言い方にする
 */
export const FREE_OP: Readonly<Record<FreeOpKey, readonly [readonly Speech[], readonly Speech[], readonly Speech[]]>> = {
  hitCivRule: [
    [op('panic', 'その人、市民！\n待てで止めて！'), op('panic', '市民だよ！？\n待て！')],
    [op('panic', 'また市民！\n待てを押して！'), op('panic', '見た目で分かる！\n市民だってば！'), op('deadpan', 'ルールしか\n見てない…')],
    [op('deadpan', 'もうわざとでしょ'), op('deadpan', 'ルールより\n人を見て！'), op('deadpan', '学ばないね…')]
  ],
  passBadRule: [
    [op('panic', 'どう見ても\nワルだよ！？'), op('panic', 'なんで今\nスルーした！？')],
    [op('panic', 'また素通り！？'), op('deadpan', '悪そうなのに\n手を振ってる…'), op('deadpan', '見た目どおりの\nワルなのに！')],
    [op('deadpan', 'もう慣れた…'), op('normal', '悪さを始めたら\n行けね'), op('deadpan', 'はいはい、\n素通りね')]
  ],
  redeclare: [
    [op('panic', 'また変えた！？'), op('panic', 'さっきと\n違うじゃん！')],
    [op('deadpan', 'ルール、\n軽すぎない？'), op('deadpan', 'ころころ\n変えないで！'), op('deadpan', 'もう変えないでね')],
    [op('deadpan', '札の意味、\nなくない？'), op('deadpan', '好きにして…'), op('deadpan', 'はいはい、\n次のルールね')]
  ],
  saved: [
    [op('hype', 'セーフ！'), op('normal', 'あぶなかった…')],
    [op('hype', 'ナイス待て！'), op('hype', 'よく止めた！'), op('normal', '市民、無事！')],
    [op('hype', '止めるの、\nうまくなったね'), op('hype', 'もう手慣れてる！'), op('hype', 'さすが！\n慣れてきたね')]
  ],
  hitCiv: [
    [op('panic', '見れば分かるって\n言ったよね！？'), op('panic', '今の、市民！\nなんで殴ったの！？')],
    [op('panic', 'また市民を！？'), op('deadpan', 'ルール通りでも\nダメなものはダメ！'), op('deadpan', '謝って！\n…謝らないか')],
    [op('deadpan', 'もうわざとでしょ'), op('deadpan', '…待ても押してね'), op('deadpan', 'あとで一緒に\n謝りに行くよ')]
  ],
  idle: [
    [op('normal', '…押して？'), op('normal', 'ねえ、\n待てと行けは？')],
    [op('deadpan', 'ねえ、見てる？'), op('deadpan', 'おーい'), op('deadpan', '…寝てる？')],
    [op('deadpan', 'もう知らない'), op('deadpan', '好きにすれば…'), op('deadpan', '…お茶いれよ')]
  ],
  goDone: [
    [op('hype', 'ナイス行け！'), op('hype', 'いいね！\n決まった！')],
    [op('hype', 'その調子！'), op('hype', 'よく見てる！'), op('hype', 'ばっちり！')],
    [op('hype', 'もう完ぺき！'), op('hype', '行けの名人！'), op('hype', '見てて\n気持ちいい！')]
  ],
  escaped: [
    [op('deadpan', '逃げられた…'), op('deadpan', 'あーあ、\n逃げてった')],
    [op('deadpan', 'また逃げた…'), op('deadpan', '手を振って\n見送ってる…'), op('deadpan', '行けを押せば\n間に合ったのに')],
    [op('deadpan', 'ワル、\n逃げ放題だね'), op('deadpan', 'もう見送り係だね'), op('deadpan', '…手、振ってる\n場合？')]
  ],
  recovered: [
    [op('hype', '取り返した！\nセーフ！'), op('hype', 'ギリギリ\n間に合った！')],
    [op('hype', 'ナイスフォロー！'), op('hype', 'よく見てた！'), op('hype', '待てのあとの行け、\nうまい！')],
    [op('normal', '止めてから\n倒すの、得意だね'), op('deadpan', 'もう作戦でしょ'), op('hype', '取り返しの名人！')]
  ]
};

/** 何回目から2段目、3段目の言い方にするか */
const OP_TIER_FROM: Readonly<Record<FreeOpKey, readonly [number, number]>> = {
  hitCivRule: [2, 5],
  passBadRule: [2, 5],
  redeclare: [2, 5],
  saved: [2, 5],
  hitCiv: [2, 5],
  idle: [2, 4],
  goDone: [2, 5],
  escaped: [2, 5],
  recovered: [2, 5]
};

/** その場面の count 回目は何段目か(0、1、2) */
export function freeOpTier(key: FreeOpKey, count: number): 0 | 1 | 2 {
  const [second, third] = OP_TIER_FROM[key];
  if (count >= third) return 2;
  if (count >= second) return 1;
  return 0;
}

// ─── 選ぶ仕組み ───────────────────────────────────

export interface FreeLines {
  declare(bgStage: StageId, rule: FreeRule): { hero: Speech; op: Speech };
  redeclare(from: FreeItem, to: FreeItem): { hero: Speech; op: Speech };
  /** 殴りかかるときの一言。波3は小物の名前を入れる(「風船だからワル!」) */
  heroAttack(look: Look | FreeVillainLook, rule: FreeRule): Speech;
  heroPass(look: Look | FreeVillainLook): Speech;
  /** 市民を殴っても謝らない一言(「でもルール通りだし!」) */
  heroStubborn(): Speech;
  /** ワルに待てを押したあと、そのワルが悪さを始めたとき(「ほら、やっぱりワルじゃん!」) */
  heroToldYou(): Speech;
  /** 空押しで振り向いたとき(「?」) */
  heroDryPress(): Speech;
  /** count はその場面が何回目か(1始まり)。回数で言い方を変える */
  op(key: FreeOpKey, count: number): Speech;
}

/**
 * フリープレイのセリフを選ぶものを作る。1回のフリープレイで1つ作って使う。
 * 同じ種類のセリフで、直前と同じ文は選ばない(ヒーローとオペレーターのどちらかが直前に言った文も避ける)
 */
export function createFreeLines(rng: Rng): FreeLines {
  const lastBy = new Map<string, string>();
  let lastText = '';

  /** 直前と同じ文を除いてから選ぶ。text は選ぶ候補を見分ける文 */
  function chooseBy<T>(channel: string, list: readonly T[], text: (x: T) => string): T {
    if (list.length === 0) throw new Error(`freeLines: 空の一覧 ${channel}`);
    const prev = lastBy.get(channel);
    let pool = list.filter((x) => text(x) !== prev && text(x) !== lastText);
    if (pool.length === 0) pool = list.filter((x) => text(x) !== prev);
    if (pool.length === 0) pool = [...list];
    const chosen = rng.pick(pool);
    lastBy.set(channel, text(chosen));
    return chosen;
  }
  const say = (channel: string, list: readonly Speech[]): Speech => {
    const s = chooseBy(channel, list, (x) => x.text);
    lastText = s.text;
    return s;
  };

  return {
    declare(bgStage, rule) {
      const d = chooseBy('declare', declareList(bgStage, rule), (x) => x.hero.text);
      lastText = d.op.text;
      return { hero: d.hero, op: d.op };
    },
    redeclare(from, to) {
      const h = say('redeclareHero', FREE_REDECLARE_HERO.map((s) => fillSpeech(s, { from, to })));
      const o = say('redeclareOp', FREE_REDECLARE_OP.map((s) => fillSpeech(s, { from, to })));
      return { hero: h, op: o };
    },
    heroAttack(look, rule) {
      if (rule.kind === 'item') {
        const item = rule.item;
        return say('heroAttack', FREE_ITEM_ATTACK[item].map((s) => fillSpeech(s, { item })));
      }
      return say('heroAttack', FREE_ATTACK[look] ?? FREE_FALLBACK_ATTACK);
    },
    heroPass(look) {
      return say('heroPass', FREE_PASS[look] ?? FREE_FALLBACK_PASS);
    },
    heroStubborn() {
      return say('heroStubborn', FREE_STUBBORN);
    },
    heroToldYou() {
      return say('heroToldYou', FREE_TOLD_YOU);
    },
    heroDryPress() {
      return say('heroDryPress', FREE_DRY_PRESS);
    },
    op(key, count) {
      return say(`op:${key}`, FREE_OP[key][freeOpTier(key, count)]);
    }
  };
}

/** 小物の名前を入れたあとの全部の組み合わせ(from と to は違う小物) */
function itemPairs(): { from: FreeItem; to: FreeItem }[] {
  const out: { from: FreeItem; to: FreeItem }[] = [];
  for (const from of FREE_ITEMS) for (const to of FREE_ITEMS) if (from !== to) out.push({ from, to });
  return out;
}

/**
 * フリープレイのすべてのセリフの文(小物の名前を入れたあと)。文字数の確かめとフォントの読みこみ用。
 * content.ts の allTexts() に入れてある
 */
export function allFreeSpeechTexts(): string[] {
  const out: string[] = [];
  const add = (l: readonly Speech[]): void => { for (const s of l) out.push(s.text); };
  add(FREE_INTRO);
  const stages = Object.keys(FREE_DECLARES) as StageId[];
  for (const id of stages) {
    const rules: FreeRule[] = [{ kind: 'allBad' }, { kind: 'allCiv' }, ...FREE_ITEMS.map((item) => ({ kind: 'item', item }) as FreeRule)];
    for (const rule of rules) for (const d of declareList(id, rule)) out.push(d.hero.text, d.op.text);
  }
  for (const names of itemPairs()) {
    for (const s of [...FREE_REDECLARE_HERO, ...FREE_REDECLARE_OP]) out.push(fillItems(s.text, names));
  }
  for (const look of Object.keys(FREE_ATTACK) as FreeLook[]) add(FREE_ATTACK[look]);
  for (const item of FREE_ITEMS) for (const s of FREE_ITEM_ATTACK[item]) out.push(fillItems(s.text, { item }));
  for (const look of Object.keys(FREE_PASS) as FreeLook[]) add(FREE_PASS[look]);
  add(FREE_FALLBACK_ATTACK);
  add(FREE_FALLBACK_PASS);
  add(FREE_STUBBORN);
  add(FREE_TOLD_YOU);
  add(FREE_DRY_PRESS);
  for (const key of FREE_OP_KEYS) for (const tier of FREE_OP[key]) add(tier);
  return out;
}

/**
 * フリープレイの文と、画面に出る名前(フリープレイ、ルールの札)。フォントの読みこみ用
 */
export function allFreeTexts(): string[] {
  const signs = [ruleSignText({ kind: 'allBad' }), ruleSignText({ kind: 'allCiv' }),
    ...FREE_ITEMS.map((item) => ruleSignText({ kind: 'item', item }))];
  return [...allFreeSpeechTexts(), FREE_NAME, ...signs, ...FREE_ITEMS.map((i) => FREE_ITEM_NAME[i])];
}
