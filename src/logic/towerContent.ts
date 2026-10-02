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
 * 1つの見た目のプロフィールの文(docs/STAGE4_TEXT.md「プロフィール」)。嘘は書かないが、どちらとも取れる。
 *   civOdd と badOdd:ふしぎに聞こえる文(「なぜか」「いつの間にか」「片手で軽々」など)。市民の文には、ふつうの理由がある。
 *     市民とヴィランの両方に3つずつ入れ、ふしぎに聞こえる文だけでは決められないようにする
 *   civPlain と badPlain:ふつうに聞こえる文(3つずつ)
 *   shared:市民にもヴィランにも出る文(2つ)
 * もれを隠すヴィランは badOdd から選び、一言はいつも疑う一言(TOWER_DOUBT_HINTS)にする。
 * 市民は、ふしぎに聞こえる文と疑う一言が、同じ人にそろわない(tower.ts)。「両方あやしい人」だけがヴィランになる
 */
interface ProfileSet {
  civOdd: readonly string[];
  civPlain: readonly string[];
  badOdd: readonly string[];
  badPlain: readonly string[];
  shared: readonly string[];
}

const PROFILES: Readonly<Record<TowerLook, ProfileSet>> = {
  florist: {
    civOdd: ['花びらが\nなぜか髪につく', '重い鉢も\n片手で軽々', '店の電球が\nちかちかする'],
    civPlain: ['重いバケツで\n腕がパンパン', '朝は市場で\n花を仕入れる', '好きな花は\nひまわり'],
    badOdd: ['重いバケツも\n苦にならない', '近くの電球が\nちかちかする', '花の向きが\nいつの間にか変わる'],
    badPlain: ['花びらが\nよく床に散る', '朝は市場で\n花を選ぶ', '好きな花は\nかすみ草'],
    shared: ['花束を作るのが\n得意', '店は1階の\n入口のそば']
  },
  courier: {
    civOdd: ['エレベーターは\nなぜか空いている', '重い荷物も\n片手でひょい', '階段を\n一気に駆け上がる'],
    civPlain: ['この辺りの担当に\nなって三年', 'ハンコを\nもらい忘れがち', '好物は\nおにぎり'],
    badOdd: ['荷物は\n手で運ぶことが多い', '食事は\nあまりとらない', '重い荷物も\n慣れっこ'],
    badPlain: ['この辺りの担当に\nなって三日', 'エレベーターは\nあまり使わない', 'ハンコは\nすぐにもらえる'],
    shared: ['帽子は\n会社の支給', '配達は\n時間通り']
  },
  newbie: {
    civOdd: ['コピー機が\nなぜか動かない', '朝は\nいつの間にか着いている', '机の上の物が\nよく動いている'],
    civPlain: ['書類が\nよく机から落ちる', '緊張すると\n手がふるえる', '昼は\n社員食堂'],
    badOdd: ['コピー機とは\n相性がいい', '緊張すると\nペンがふるえる', '昼は\n屋上でひとり'],
    badPlain: ['書類は\nあまり落とさない', '朝は\n誰よりも早く来る', '席は\n窓ぎわ'],
    shared: ['入社して\nまだ一か月', '先輩に\nよく怒られる']
  },
  janitor: {
    civOdd: ['行く先の電球が\nなぜかよく切れる', '夜中のビルは\n物音がよくする', '重い機械も\nひとりで運ぶ'],
    civPlain: ['このビルで\n二十年働いている', 'モップは\n自分で選んだ', '休みは\n家族と過ごす'],
    badOdd: ['モップは\nあまり使わない', '夜中のビルは\n静かで好き', '電球の交換は\n苦手'],
    badPlain: ['このビルで\n働き始めたばかり', '腰は\n痛くない', '休みは\nひとりで過ごす'],
    shared: ['床みがきは\n誰にも負けない', '全部の階を\n回っている']
  },
  chef: {
    civOdd: ['なべは\n片手で軽々', '火加減は\n思いのまま', '包丁が\nいつの間にか研いである'],
    civPlain: ['湯気で\nめがねがくもる', '休みの日は\n料理の研究', '得意料理は\nオムライス'],
    badOdd: ['なべは\n自分で運ばない', '火加減は\n目を閉じても分かる', '休みの日は\nビルをながめる'],
    badPlain: ['包丁は\nめったに研がない', '湯気は\nあまり気にしない', '得意料理は\nふわふわのスフレ'],
    shared: ['この店の\n料理長', '味見は\n何度もする']
  },
  waiter: {
    civOdd: ['お盆は\n片手で持てる', 'お客さんの注文は\nなぜか先に分かる', '静かに\n歩くのが得意'],
    civPlain: ['グラスを\n割ったことがある', '立ちっぱなしで\n足が痛い', '夢は\n自分の店を持つこと'],
    badOdd: ['お盆は\n指一本で持てる', '夢は\nこのビルを持つこと', '足音が\nほとんどしない'],
    badPlain: ['グラスを\n割ったことがない', 'お客さんの顔は\nすぐ覚える', '立ちっぱなしでも\n足は痛くない'],
    shared: ['このレストランで\n三年目', '蝶ネクタイは\n自分で結ぶ']
  },
  lady: {
    civOdd: ['グラスが\nいつの間にか空', '羽の髪飾りが\nよくゆれる', 'ヒールでも\n足音がしない'],
    civPlain: ['ヒールで\n足が痛い', '夜景が\n大好き', 'お酒は\n弱い'],
    badOdd: ['夜景を\n見下ろすのが好き', 'グラスは\n手にしていない', 'オーナーとは\n古い知り合い'],
    badPlain: ['ヒールには\n慣れている', '羽の髪飾りは\nお気に入り', 'お酒は\n飲まない'],
    shared: ['パーティには\nよく招かれる', 'ドレスは\n今日のために買った']
  },
  magician: {
    civOdd: ['物を浮かせる\n手品が得意', 'ハトが\nいつの間にか増える', '糸はいつも\nポケットに'],
    civPlain: ['カードを\nよく落とす', '失敗すると\n笑ってごまかす', 'つえは\n手作り'],
    badOdd: ['糸は\nたまに使う', '失敗は\nしたことがない', 'カードを\n落としたことがない'],
    badPlain: ['タネは\n教えない', 'シルクハットから\nハトを出す', 'つえは\nもらい物'],
    shared: ['手品歴は\nけっこう長い', 'パーティに\n呼ばれて来た']
  }
};

/** 見た目ごとの表の中身を f で作りかえる */
const mapLooks = <A, B>(table: Readonly<Record<TowerLook, A>>, f: (a: A) => B): Record<TowerLook, B> =>
  Object.fromEntries(Object.entries(table).map(([look, a]) => [look, f(a as A)])) as Record<TowerLook, B>;

/**
 * プロフィールの一文(見た目ごと、市民とヴィラン)。どちらにも出る文は、それぞれの一覧の最後の2つ。
 * 中身と決まりは上の PROFILES
 */
export const TOWER_PROFILE_LINES: Readonly<Record<TowerLook, { civ: readonly string[]; bad: readonly string[] }>> =
  mapLooks(PROFILES, (p) => ({ civ: [...p.civOdd, ...p.civPlain, ...p.shared], bad: [...p.badOdd, ...p.badPlain, ...p.shared] }));

/** ふしぎに聞こえるプロフィールの文(見た目ごと、市民とヴィラン)。もれを隠すヴィランは bad から選ぶ */
export const TOWER_ODD_LINES: Readonly<Record<TowerLook, { civ: readonly string[]; bad: readonly string[] }>> =
  mapLooks(PROFILES, (p) => ({ civ: p.civOdd, bad: p.badOdd }));

/**
 * オペレーターの一言(見た目ごと)。市民とヴィランで同じ一覧にする(一言だけでは決められない)。
 * 並びは、ふつうの顔(normal)が4つ、あきれ顔(deadpan)が2つ、あわてた顔(panic)が1つ。
 * 4つ目は「周りを見て」と言う一言。あきれ顔の2つ目は、疑う一言(TOWER_DOUBT_HINTS)。
 * 前は疑う一言がヴィランにだけあり、それだけで決まってしまったので、市民にも出るようにした。
 * 照明や小物に見えている物のことは、この一覧ではなく TOWER_SPOT_HINTS で言う(tower.ts が、もれのあるヴィランと
 * 紛らわしい市民に同じ確率で出す)
 */
const OPERATOR_LINES: Readonly<Record<TowerLook, readonly OperatorHint[]>> = {
  florist: [
    hint('normal', '花屋さんだ'),
    hint('normal', '花束を\n持ってる'),
    hint('normal', '机の上も\n見ておいて'),
    hint('normal', '花びらが\n舞ってる'),
    hint('deadpan', 'いい香り…'),
    hint('deadpan', 'いい香り…？'),
    hint('panic', 'こっちを\n見てる！')
  ],
  courier: [
    hint('normal', '配達の人だ'),
    hint('normal', '段ボールを\nかかえてる'),
    hint('normal', '周りも\nよく見てね'),
    hint('normal', '帽子を\n直してる'),
    hint('deadpan', '重そう…'),
    hint('deadpan', '軽そう…？'),
    hint('panic', '段ボールが\n落ちそう！')
  ],
  newbie: [
    hint('normal', '新人さんだ'),
    hint('normal', '書類が\nいっぱい'),
    hint('normal', '明かりと机、\n見比べて'),
    hint('normal', '時計を\n気にしてる'),
    hint('deadpan', '緊張してる…'),
    hint('deadpan', '緊張…\nしてるのかな'),
    hint('panic', '書類、\n落としそう！')
  ],
  janitor: [
    hint('normal', '清掃員さんだ'),
    hint('normal', 'モップを\nかけてる'),
    hint('normal', '上の明かりも\n忘れずに'),
    hint('normal', '休まず\n働いてる'),
    hint('deadpan', 'ていねい…'),
    hint('deadpan', 'ていねい…\nかな？'),
    hint('panic', 'こっちに\n来る！')
  ],
  chef: [
    hint('normal', 'シェフだ'),
    hint('normal', '味見してる'),
    hint('normal', '机のあたり、\n見てみて'),
    hint('normal', 'コック帽が\n高い'),
    hint('deadpan', 'おいしそう…'),
    hint('deadpan', 'おいしそう…？'),
    hint('panic', 'おたまを\nふり回してる！')
  ],
  waiter: [
    hint('normal', 'ウェイターさんだ'),
    hint('normal', 'お盆に\nグラス'),
    hint('normal', '明かりも\n見ておいてね'),
    hint('normal', '蝶ネクタイ、\n決まってる'),
    hint('deadpan', '手なれてる…'),
    hint('deadpan', '手なれすぎ…？'),
    hint('panic', 'こっち見て\nにやっとした！')
  ],
  lady: [
    hint('normal', 'ドレスの\nお客さんだ'),
    hint('normal', '羽の髪飾り'),
    hint('normal', '周りに\n気をつけて'),
    hint('normal', '香水の\nにおいがする'),
    hint('deadpan', 'セレブだ…'),
    hint('deadpan', 'セレブ…\nなのかな'),
    hint('panic', '目が合った！')
  ],
  magician: [
    hint('normal', '手品師さんだ'),
    hint('normal', 'つえを\n持ってる'),
    hint('normal', '机の上、\nちゃんと見た？'),
    hint('normal', 'シルクハットが\nおしゃれ'),
    hint('deadpan', 'すごい手品…'),
    hint('deadpan', '手品…\nだよね？'),
    hint('panic', 'つえを\nふり回してる！')
  ]
};

/** オペレーターの一言(見た目ごと、市民とヴィラン)。市民とヴィランで同じ一覧(中身は上の OPERATOR_LINES) */
export const TOWER_OPERATOR_HINTS: Readonly<Record<TowerLook, { civ: readonly OperatorHint[]; bad: readonly OperatorHint[] }>> =
  mapLooks(OPERATOR_LINES, (l) => ({ civ: l, bad: l }));

/**
 * 疑う一言(見た目ごとに1つ。あきれ顔で「…？」「かな」と言う)。市民にもヴィランにも出る。
 * もれを隠すヴィランはいつもこの一言で、プロフィールはふしぎに聞こえる文(TOWER_ODD_LINES)。
 * 市民は、ふしぎに聞こえる文のときはこの一言にならない(tower.ts)
 */
export const TOWER_DOUBT_HINTS: Readonly<Record<TowerLook, OperatorHint>> = mapLooks(OPERATOR_LINES, (l) => l[5]);

/**
 * 照明と小物に見えている物のことを言う一言(docs/STAGE4_TEXT.md「見えている物のことを言う一言」)。
 * もれのあるヴィランと紛らわしい市民に、同じ確率(LEAK.spotHintChance)で、見た目ごとの一言の代わりに出す。
 * どれも見えている物をそのまま言うだけで、もれか紛らわしい市民の理由かは言わない(tower.ts の spotHintsFor)。
 *   lightOdd:照明に何か出ている(もれ、切れかけの蛍光灯、紫のセロハン)
 *   lightPurple:照明が紫(もれ、紫のセロハン)
 *   itemFloat:小物が浮いている(もれ、手品の糸、手品の紫の煙、紫の風船)
 *   itemPurple:小物のあたりが紫(もれ、手品の紫の煙、紫の風船)
 *   glassFloat:浮いている小物がグラス(35階と最上階。rules.ts の TOWER_SPOT_ITEMS)
 */
export const TOWER_SPOT_HINTS: Readonly<Record<'lightOdd' | 'lightPurple' | 'itemFloat' | 'itemPurple' | 'glassFloat', readonly OperatorHint[]>> = {
  lightOdd: [hint('normal', '明かり、なんか\n変じゃない？'), hint('normal', '明かりの色、\nいつもと違う？')],
  lightPurple: [hint('normal', '明かりが…\n紫っぽい？')],
  itemFloat: [hint('normal', '今、何か\n浮かなかった？'), hint('normal', '机の上の物、\n浮いてない？')],
  itemPurple: [hint('normal', '机のあたりが\n紫っぽい？')],
  glassFloat: [hint('panic', 'グラスが\n浮いてる！？')]
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
    hint('normal', '招待状、\n持ってなくない？'),
    hint('deadpan', 'お客にしては\nオーラがありすぎ')
  ],
  magician: [
    hint('panic', 'つえの先が…\nビル？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', 'ハトが\n出てこない'),
    hint('deadpan', '手品師にしては\nオーラがありすぎ')
  ],
  waiter: [
    hint('panic', '蝶ネクタイが\n金色…？'),
    hint('normal', 'なんか…\n偉そうじゃない？'),
    hint('normal', 'お盆を\n持ってない'),
    hint('deadpan', 'ウェイターにしては\nオーラがありすぎ')
  ]
};

// ─── ステージ前の掛け合い ─────────────────────────

/**
 * 高層ビルを最初に遊ぶときの掛け合い(5枚。docs/STAGE4.md「ステージ前の掛け合い」)。
 * 念力で運ばれた物を行けで落とすことは、初めて行けのマークが出たときに教える(teachPsy)。エレベーターラッシュのことは言わない
 */
export const TOWER_INTRO: readonly Speech[] = [
  hero('smug', '最後は高層ビル！\nヴィラン退治だ！'),
  op('normal', '見た目は普通の人。\n周りをよく見て'),
  op('deadpan', '明かりが紫になったり、\n物が浮いたりする'),
  op('normal', '手品や風船の紫には\n火花が出ないよ'),
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
    op('normal', '紫でも、火花が\nなければ市民だよ'),
    hero('smug', 'どんと来い！')
  ],
  // 波3から、もれを隠すヴィランが出る(rules.ts の LEAK.hiddenPerWave)
  3: [
    op('normal', '35階は\nレストラン街'),
    op('deadpan', '明かりも机も変えない\nヴィランもいる'),
    op('normal', 'プロフィールと一言、\n両方あやしい人に注意')
  ],
  4: [
    op('panic', '最上階！\n親玉がまぎれてる'),
    op('normal', '親玉は明かりも物も\n変えない。姿を見て')
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
  liftEndBad: [op('deadpan', '最上階に\n着いたけど…')],
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
    hero('smile', 'お仕事\nお疲れさま！'),
    hero('smile', 'いい夜だね！'),
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
  op('panic', '乗ってくる人、\n全員殴られちゃう！'),
  op('normal', '光ったらヴィラン！\n市民だけ待てを押して')
];

/** 2回目からのラッシュの説明(オペレーター、1つ) */
export const LIFT_INTRO_AGAIN: readonly Speech[] = [
  op('panic', '最上階へ！\n市民だけ待てを押して')
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
  liftGuardian: op('hype', '満員のエレベーターで\n1人も間違えなかった！'),
  sofaMaster: op('hype', 'ソファの上に\nぴったり落とした！')
} as const;
