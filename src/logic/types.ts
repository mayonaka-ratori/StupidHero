// ルールの部品で共通に使う型。Phaser にも画面にも頼らない。
// 数字やルールの出どころは docs/SPEC.md(ステージ1)、docs/STAGE2.md(ステージ2)、docs/STAGE3.md(ステージ3)。

import type { StageDef } from './stages';

/** ステージ1(路地裏)の見た目 */
export type AlleyLook = 'hoodie' | 'suit' | 'shopper' | 'mohawk' | 'granny';
/** ステージ2(地下駐車場)の見た目。どれも市民とギャングの組(警備員、整備士、派手な若者、会社員の女性) */
export type GangLook = 'guard' | 'mechanic' | 'clubber' | 'officelady';
/**
 * ステージ3(ショッピングモール)の見た目。どれも市民と宇宙人の組
 * (着ぐるみのバイト、寝不足の店員、ロボットダンスの学生、買い物客のおじさん)
 */
export type MallLook = 'mascot' | 'clerk' | 'dancer' | 'uncle';
/**
 * ステージ4(高層ビル)の見た目。どれも市民とヴィラン(超能力者)の組で、絵も同じ(docs/STAGE4.md「見た目」)。
 * 1階:花屋の店員、配達員。18階:新人の会社員、清掃員。35階:シェフ、ウェイター。最上階:ドレスの女性、手品師
 */
export type TowerLook = 'florist' | 'courier' | 'newbie' | 'janitor' | 'chef' | 'waiter' | 'lady' | 'magician';
/**
 * フリープレイの、一目で分かるワルの見た目(docs/FREEPLAY.md)。
 * ナイフを振りかざしたモヒカン、バンダナで顔を隠して金属バットを持ったギャング、触角の出た緑の宇宙人
 */
export type FreeVillainLook = 'fp_mohawk' | 'fp_gang' | 'fp_alien';
/** 見た目の種類(全部のステージと、フリープレイのワル) */
export type Look = AlleyLook | GangLook | MallLook | TowerLook | FreeVillainLook;
/** フリープレイの波3の小物(風船、とんがり帽子、大きな紙袋) */
export type FreeItem = 'balloon' | 'hat' | 'bag';
/**
 * フリープレイのヒーローの決めつけ。
 * allBad:「ここはワルだらけだな!」(全員に殴りかかる)、allCiv:「ここにはワルはいなさそうだ!」(全員素通り)、
 * item:「〇〇の人はワル!」(その小物の人にだけ殴りかかる)
 */
export type FreeRule = { kind: 'allBad' } | { kind: 'allCiv' } | { kind: 'item'; item: FreeItem };
/** 同じ見た目の市民とワルがいる組(パーカーの男、スーツの男、買い物袋の女性) */
export type PairLook = 'hoodie' | 'suit' | 'shopper';
/** ステージ1のボスの化けた姿(会社員、おばあさん、買い物袋の女性) */
export type AlleyDisguise = 'suit' | 'granny' | 'shopper';
/** ステージ2の女ボスの化けた姿(警備員、整備士、会社員の女性) */
export type GarageDisguise = 'guard' | 'mechanic' | 'officelady';
/** ステージ3の宇宙人の親玉の化けた姿(寝不足の店員、買い物客のおじさん、着ぐるみのバイト) */
export type MallDisguise = 'clerk' | 'uncle' | 'mascot';
/** ステージ4の親玉(ビルのオーナー)の化けた姿(ドレスの女性、手品師、ウェイター) */
export type TowerDisguise = 'lady' | 'magician' | 'waiter';
/** ボスの化けた姿(全部のステージ) */
export type DisguiseLook = AlleyDisguise | GarageDisguise | MallDisguise | TowerDisguise;
/** 本当の正体 */
export type Truth = 'bad' | 'civ' | 'boss';
/** プレイヤーの仕分け(左スワイプでワル、右スワイプで市民) */
export type SortChoice = 'bad' | 'civ';

/** ヒーローの顔(face_hero の行の名前) */
export type HeroFace = 'smug' | 'oops' | 'smile';
/** オペレーターの顔(face_operator の行の名前) */
export type OperatorFace = 'normal' | 'panic' | 'deadpan' | 'hype';

/** セリフ1つ。text は1行が全角12文字まで、2行まで(改行は \n) */
export type Speech =
  | { who: 'hero'; face: HeroFace; text: string }
  | { who: 'operator'; face: OperatorFace; text: string };

/** 仕分け中に下に出すプロフィール */
export interface Profile {
  name: string;
  age: number;
  /** 短い一文。嘘は書かないが、どちらとも取れる */
  line: string;
}

/** 仕分け中にオペレーターが右上のカットインでつぶやく一言 */
export interface OperatorHint {
  text: string;
  face: OperatorFace;
}

/**
 * ワルの悪さの種類(bad のシートの 'mischief' の動き)。
 * 'whistle' はステージ2のギャング:悪さの代わりに口笛で仲間を呼ぶ(被害額も市民負傷も増えない)。
 * 'signal' はステージ3の宇宙人:悪さの代わりに空へ合図を送ってUFOを呼ぶ(合図そのものの被害額は0)。
 * 'psychic' はステージ4のヴィラン:悪さの代わりに、念力で物を持ち上げて通りがかりの市民の上へ運ぶ
 * (持ち上げること自体の被害額は0。落ちた先で決まる)
 */
export type MischiefKind = 'shove' | 'snatch' | 'pickpocket' | 'threaten' | 'whistle' | 'signal' | 'psychic';

/** 小物の色の id(ステージ2)。gold は女ボスだけ */
export type AccessoryColorId = 'red' | 'green' | 'yellow' | 'aqua' | 'purple' | 'orange' | 'gold';

/** ステージ2の小物(腕章、タオル、バンダナ、ヘアバンド、スカーフ)。絵のキーの色(KEY_ACCESSORY)を color に塗り替える */
export interface Accessory {
  id: AccessoryColorId;
  /** 色の名前(例 '赤') */
  name: string;
  /** 塗る色(0xRRGGBB) */
  color: number;
  /** 小物の名前(例 '腕章')。見た目と正体で決まる(整備士は市民がタオル、ギャングがバンダナ) */
  item: string;
}

/**
 * 前の人とのつながり(ステージ2)。この人のプロフィールか一言が、前に出てきた人との共通点を言っている。
 * 文はもう profile.line か hint.text に入っているので、画面はふつうに出すだけでよい
 */
export interface PersonLink {
  /** つながっている前の人の id(同じ波の、先に出てきた人) */
  toId: string;
  /** どちらの文をつながりの文にしたか */
  where: 'profile' | 'hint';
}

/**
 * ステージ3の宇宙人の、動きのくずれの時間(STAGE3「動きのくずれ」)。数えるのは仕分けの時計だけ
 * (その人が出ている間で、時計が進んでいる時間。文字送りと一時停止の間は進まない)。
 * firstSec で初めてくずれ、そのあと everySec ごとに showSec の間くずれる。glitchShowing(glitch, sec) で調べる
 */
export interface GlitchTiming {
  /** 初めてくずれるまでの秒数(3〜6秒を0.5秒きざみ。練習用は1.5秒) */
  firstSec: number;
  /** 2回目からの間隔(3秒。練習用は2秒) */
  everySec: number;
  /** 1回のくずれの長さ(0.2秒。練習用は0.3秒) */
  showSec: number;
  /** 波1の練習用の宇宙人か */
  practice: boolean;
}

/**
 * ステージ4のヴィランのもれ(docs/STAGE4.md「もれ」)。仕分けの画面の決まった2か所に出る。
 * light は左上の照明が紫になる、item は左下の机の小物が浮く。2か所とも出るか、どちらか1か所だけ(半々)。
 * 波1の練習用のヴィランは2か所とも
 */
export interface Leak {
  light: boolean;
  item: boolean;
}

/**
 * ステージ4の紛らわしい市民(周りのせいで、もれに見える)。もれと同じ場所の1か所だけに出る。
 * flicker:切れかけの蛍光灯(左上の照明がうすい黄色。どの見た目でも)。
 * thread:手品の糸(左下の小物が糸で吊られて浮く。手品師だけ)。
 * balloon:風船(左下の小物に風船がのっている。花屋の店員、配達員、ウェイター)
 */
export type TowerDecoy = 'flicker' | 'thread' | 'balloon';

/** 波の番号。ステージ1〜3は3つ、ステージ4は4つ */
export type WaveNo = 1 | 2 | 3 | 4;
/** フリープレイの波の番号(いつも3つ) */
export type FreeWaveNo = 1 | 2 | 3;

/** 仕分けに出てくる1人 */
export interface Person {
  /** ステージの中で重ならない id(例 'w2-3') */
  id: string;
  wave: WaveNo;
  /** 波の中で何番目に出てくるか(0始まり) */
  index: number;
  /** 見た目。ボスなら化けた姿の見た目 */
  look: Look;
  truth: Truth;
  /** 使う絵のキー(src/art/sheets.ts)。例 'hoodie_bad'、'boss_disguise_granny' */
  sheetKey: string;
  profile: Profile;
  hint: OperatorHint;
  /** ボスのときだけ:化けた姿の種類 */
  disguise?: DisguiseLook;
  /** ワルのときだけ:結果発表で見逃したときにする悪さ(ギャングは 'whistle') */
  mischief?: MischiefKind;
  /** ステージ2のギャングだけ:組の id(例 'w2-g1')。wave.groups の id と同じ */
  group?: string;
  /** ステージ2だけ:小物の色。組の仲間は同じ色。女ボスは金色 */
  accessory?: Accessory;
  /** ステージ2だけ:前の人とのつながり(ない人もいる) */
  link?: PersonLink;
  /** ステージ3の宇宙人だけ:動きのくずれの時間。市民と親玉にはない(親玉はくずれない) */
  glitch?: GlitchTiming;
  /** フリープレイの波3の人だけ:持っている小物(風船、とんがり帽子、大きな紙袋)。持っていない人もいる */
  item?: FreeItem;
  /** ステージ4のヴィランだけ:もれが出る場所(練習用のヴィランは両方)。市民と親玉にはない(親玉はもれない) */
  leak?: Leak;
  /** ステージ4の紛らわしい市民だけ:もれに見えるものの種類 */
  decoy?: TowerDecoy;
}

/** ステージ2のギャングの組 */
export interface GangGroup {
  /** 例 'w2-g1' */
  id: string;
  wave: WaveNo;
  /** 組の人の id(出てくる順) */
  memberIds: string[];
  /** 組の小物の色(組ごとにステージの中で違う色) */
  accessory: Omit<Accessory, 'item'>;
}

/** 1回の波 */
export interface Wave {
  no: WaveNo;
  /** 制限時間(秒) */
  seconds: number;
  /** 出てくる順に並んだ人(ボスを含む) */
  people: Person[];
  /** ワルの数(ボスは含まない)。路地裏は2〜3、地下駐車場はギャングの人数で2〜4 */
  badCount: number;
  hasBoss: boolean;
  /** ギャングの組(地下駐車場だけ。路地裏は空) */
  groups: GangGroup[];
}

/**
 * ステージの id。'alley' は路地裏(ステージ1)、'garage' は地下駐車場(ステージ2)、'mall' はショッピングモール(ステージ3)、
 * 'tower' は高層ビル(ステージ4)
 */
export type StageId = 'alley' | 'garage' | 'mall' | 'tower';
/** フリープレイの背景に使えるステージ(高層ビルは、はじめは入れない。docs/STAGE4.md「作るときに気をつけること」) */
export type FreeStageId = Exclude<StageId, 'tower'>;

/** タイムセールラッシュで走ってくる1人(ステージ3。STAGE3「タイムセールラッシュ」) */
export interface RushRunner {
  /** 来る順(0始まり) */
  index: number;
  look: MallLook;
  /** 'bad' は宇宙人 */
  truth: 'bad' | 'civ';
  /** 絵のキー(仕分けと同じ 'mascot_bad' など) */
  sheetKey: string;
  /** ラッシュが始まってから画面の右に出てくるまでの秒数(ふつうの速さ。ゆっくりモードは rushSpawnSec で) */
  spawnSec: number;
}

/** タイムセールラッシュの並び(ステージ3の stage.rush。ラッシュのないステージは null) */
export interface RushPlan {
  kind: 'sale';
  runners: RushRunner[];
  /** 宇宙人の数(3か4) */
  alienCount: number;
  /** 市民の数 */
  civCount: number;
}

/** エレベーターラッシュで乗ってくる1人(ステージ4。STAGE4「エレベーターラッシュ」) */
export interface LiftRider {
  /** 乗ってくる順(0始まり) */
  index: number;
  look: TowerLook;
  /** 'bad' はヴィラン。ヴィランのもれはいつも2か所(頭の上の小物とボタン) */
  truth: 'bad' | 'civ';
  /** 絵のキー(仕分けと同じ 'tw_florist' など。市民とヴィランで同じ) */
  sheetKey: string;
  /** 扉が開く階(35と50の間。上がっていく順) */
  floor: number;
}

/** エレベーターラッシュの並び(ステージ4の stage.rush) */
export interface LiftPlan {
  kind: 'elevator';
  riders: LiftRider[];
  /** ヴィランの数(2か3) */
  villainCount: number;
  /** 市民の数 */
  civCount: number;
}

/** 1ステージぶん */
export interface Stage {
  /** どのステージか(stageId)。STAGES[stage.id] と stage.def は同じ */
  id: StageId;
  /** ステージの定義(背景、曲、ボスの絵など。stages.ts の STAGES) */
  def: StageDef;
  /** 表示用の名前(例 '路地裏') */
  name: string;
  /** 作ったときの種(数に直したもの) */
  seed: number;
  waves: Wave[];
  /** 倒すべき相手の総数(ワル全員とボス)。「全員撃破」はこれと比べる */
  villainTotal: number;
  /** 出てくる人の総数(ボスを含む。路地裏16、地下駐車場18、ショッピングモール18) */
  peopleTotal: number;
  /**
   * ラッシュの並び(def.rush のあるステージだけ。ほかは null)。ラッシュの人は villainTotal と peopleTotal に入れない。
   * kind が 'sale' ならタイムセールラッシュ(ステージ3)、'elevator' ならエレベーターラッシュ(ステージ4)
   */
  rush: RushPlan | LiftPlan | null;
}

/** ヒーローの攻撃 */
export type AttackKind = 'charge' | 'punch' | 'stomp' | 'special';
/**
 * 壊れる物。路地裏:ゴミ箱、窓、看板、自販機、止めてある車。
 * 地下駐車場:ギャングのワゴン、女ボスの高級車、柱、料金所のバー、三角コーン、消火器の箱(止めてある車も置く)。
 * ショッピングモール:ガチャガチャ、マネキン、ショーケース、噴水、エスカレーター、UFO(行けで落としたとき)、母艦(ボス戦だけ)。
 * 高層ビル:ソファ(壊れない)、観葉植物、花のかざり、コピー機、水槽、ワインの棚、シャンパンタワー、ピアノ、
 * シャンデリア(ボス戦だけ)
 */
export type PropKind =
  | 'trash' | 'window' | 'sign' | 'vending' | 'car'
  | 'van' | 'bosscar' | 'pillar' | 'barrier' | 'cone' | 'extinguisher'
  | 'gacha' | 'mannequin' | 'showcase' | 'fountain' | 'escalator' | 'ufo' | 'mothership'
  | 'sofa' | 'plant' | 'flowers' | 'copier' | 'tank' | 'wine' | 'champagne' | 'piano' | 'chandelier';

/**
 * 結果発表でヒーローがその人の前に来たときに起きること。
 * - hitBad:ワルをワルに仕分けた。殴って撃破
 * - hitCiv:市民をワルに仕分けた。全力で殴る(待てで止められる)
 * - passCiv:市民を市民に仕分けた。手を振って素通り
 * - passBad:ワルを市民に仕分けた。素通りのあと悪さを始める(行けで追い打ち)
 * - bossFight:ボスをワルに仕分けた。殴りかかると正体を現してボス戦(待ては効かない)
 * - bossRampage:ボスを市民に仕分けた。素通りのあと正体を現して暴れ、そのあとボス戦
 */
export type Encounter = 'hitBad' | 'hitCiv' | 'passCiv' | 'passBad' | 'bossFight' | 'bossRampage';

/**
 * 市民がけがをした理由。'abducted' はステージ3でUFOに連れ去られた買い物客、
 * 'dropped' はステージ4で念力で運ばれた物が落ちてきた市民(どちらも称号では「ワルにやられた」 'villain' と同じに扱う)
 */
export type HurtCause = 'hero' | 'collateral' | 'villain' | 'abducted' | 'dropped';

/**
 * いちばんひどかった場面の種類。SPECの1〜5の順に、ステージ3の「市民がさらわれた」を足した。上ほどひどい。
 * 1 grannyHit:おばあさんを殴った / 2 specialOnCiv:市民に必殺技を当てた /
 * 3 civHit:市民を殴った(巻きぞえ、タイムセールラッシュで殴ったのを含む) / 4 abducted:市民がUFOにさらわれた /
 * 5 bigPropBroken:車や自販機が壊れた / 6 bossDefeated:ボスを倒した
 */
export type WorstScene = 'grannyHit' | 'specialOnCiv' | 'civHit' | 'abducted' | 'bigPropBroken' | 'bossDefeated';

/** 称号の id */
export type TitleId =
  | 'flawless'
  | 'civNemesis'
  | 'demolition'
  | 'bossBuddy'
  | 'grannyFoe'
  | 'runawayTrain'
  | 'realHero'
  | 'tapProdigy'
  | 'stopMaster'
  | 'chaseDemon'
  | 'tooKind'
  | 'soSo'
  // ステージ2だけで取れる
  | 'roundUp'
  | 'gangDriver'
  // ステージ3だけで取れる
  | 'ufoGuide'
  | 'saleGuardian'
  | 'ufoHunter'
  // フリープレイだけで取れる
  | 'heroSitter'
  | 'heroInterpreter'
  | 'letItBe';

/** 勝利ポーズ(hero のアニメの名前) */
export type WinPose = 'win_pose' | 'win_arms' | 'win_fist' | 'win_shy';

/** 1ステージを遊び終えたときの数字(StatsTracker.snapshot() が返す) */
export interface StageStats {
  /** どのステージの数字か */
  stageId: StageId;
  /** 悪党撃破数(仕分けで殴った + 行けで追い打ち + まとめて吹き飛ばした + ワゴンごと止めた + ボス) */
  defeated: number;
  defeatedBySort: number;
  /** 行けで倒したワルの数(UFOごと倒した宇宙人を含む) */
  defeatedByGo: number;
  /** UFOごと倒した宇宙人の数(ステージ3。defeatedByGo に入っている) */
  defeatedByUfo: number;
  /** 行けで落としたUFOの数(ステージ3。「UFOハンター」) */
  ufosDowned: number;
  /** UFOに乗って去った宇宙人の数(ステージ3。escaped に入っている) */
  escapedByUfo: number;
  /** まとめて吹き飛ばした人数(ステージ2) */
  defeatedByWipe: number;
  /** ワゴンごと止めた人数(ステージ2) */
  defeatedByVan: number;
  /** まとめて吹き飛ばした組の数(ステージ2。「一網打尽」) */
  groupsWiped: number;
  /** 車で逃げられた組の数(ステージ2。「ギャングの見送り係」) */
  groupsEscaped: number;
  /** 車で逃げられた人数(escaped に入っている) */
  escapedByVan: number;
  /** ワゴンを止めた回数(ステージ2) */
  vansStopped: number;
  bossDefeated: boolean;
  /** 市民負傷数(ヒーローが殴った + 巻きぞえ + ワルに襲われた + UFOにさらわれた + 物が落ちた) */
  civHurt: number;
  civHurtByHero: number;
  civHurtByCollateral: number;
  civHurtByVillain: number;
  /** UFOにさらわれた買い物客の数(ステージ3。「宇宙人の案内係」) */
  civHurtByAbduction: number;
  /** 念力で運ばれた物が落ちてきた市民の数(ステージ4。内わけは「物が落ちた」) */
  civHurtByDrop: number;
  /** 被害額(円) */
  damage: number;
  damageByProps: number;
  damageByMischief: number;
  damageByBoss: number;
  /** 壊れた物の数 */
  propsBroken: Record<PropKind, number>;
  /** 逃がした数(画面の右から逃げた + 待てで止めたワル + 車で逃げた組の人数 + UFOで去った宇宙人) */
  escaped: number;
  /** 待てで守った市民の数 */
  civSavedByStop: number;
  /** 待てで止めたワルの数(参考) */
  badSparedByStop: number;
  /** おばあさんを殴ったか(巻きぞえを含む) */
  grannyHit: boolean;
  /** おばあさんをワルに仕分けて殴ったか(巻きぞえは含まない。「おばあちゃんの敵」) */
  grannyPunched: boolean;
  /** ボスを市民に仕分けたか */
  bossSortedCiv: boolean;
  /** ボス戦にかかった秒数。ボス戦をしていなければ null */
  bossFightSec: number | null;
  /** 倒すべき相手の総数(ワル全員とボス) */
  villainTotal: number;
  /** 全員撃破したか */
  allDefeated: boolean;
  /** いちばんひどかった場面。何もなければ null */
  worstScene: WorstScene | null;
  /** その場面を起こした技(説明の文を変えるため)。技でなければ null */
  worstAttack: AttackKind | null;
  /** 自分で仕分けて当たった人数(時間切れでヒーローが決めた人は入れない) */
  sortCorrect: number;
  /** 自分で仕分けた人数(時間切れでヒーローが決めた人は入れない) */
  sortTotal: number;
  /** 時間切れでヒーローの勘で決まった人数 */
  sortByHero: number;
  /** ヒーローの勘が当たった人数 */
  sortByHeroCorrect: number;
  /** 波ごとの仕分けの数(答え合わせが済んだ波だけ。波1から順) */
  sortWaves: SortTally[];
  /** タイムセールラッシュの数(ステージ3。ラッシュをしていなければ null)。ほかの数字には入れない */
  rush: RushTally | null;
  /** フリープレイの数(フリープレイでなければ null) */
  free: FreeTally | null;
}

/**
 * フリープレイだけの、いちばんひどい場面の候補(ボスがいないので足した)。
 * ステージの場面(WorstScene)のどれよりも弱い。上ほどひどい。
 * waveKnife:ナイフ男に笑顔で手を振った / waveGang:ギャングの車に手を振って見送った / waveUfo:UFOに手を振った /
 * closeCall:拳が当たる寸前に待てで止めた(ギリギリセーフ)
 */
export type FreeWorstScene = 'waveKnife' | 'waveGang' | 'waveUfo' | 'closeCall';

/** フリープレイの数(docs/FREEPLAY.md「数え方」)。StageStats.free に入る */
export interface FreeTally {
  /** 待てで守った市民(殴りかかったヒーローを待てで止めた人数。stopChances まで) */
  stopSaved: number;
  /** 待てのチャンスの数(殴りかかられる市民。9) */
  stopChances: number;
  /** 行けで決めた場面の数(ギャングの組をまとめて吹き飛ばしても、UFOを落としても1回。取り返しは入れない) */
  goScenes: number;
  /** 行けのチャンスの数(素通りされるワルの場面。ギャングの組は1場面。8) */
  goChances: number;
  /** ワルに待てを押したあと、行けで倒して取り返した数(行けで決めたには入れない) */
  recovered: number;
  /** マークがないときに待てか行けを押した回数(効かない間に押し直した分も数える) */
  dryPresses: number;
  /** 効いた待ての数(市民でもワルでも) */
  effectiveStops: number;
  /** 効いた行けの数(取り返しも入れる) */
  effectiveGos: number;
  /** 当たりを数える場面の数(人。ただしギャングの組は1つ。27) */
  units: number;
  /** ヒーローだけならいくつ当たっていたか(10) */
  heroRight: number;
  /** プレイヤーが直したあと、いくつ当たったか */
  fixedRight: number;
  /** クリアまでの時間(秒)。足す秒を入れない。まだ終わっていなければ null */
  rawSec: number | null;
  /** クリアまでの時間(秒)。逃がしたワル、市民のけが、ワルへの待ての分を足した記録。まだ終わっていなければ null */
  clearSec: number | null;
  /** ゆっくりモードで遊んだか(途中で一度でもオンにしたら true) */
  slow: boolean;
  /** フリープレイだけの、いちばんひどい場面(ステージの場面 worstScene があればそちらが先) */
  worst: FreeWorstScene | null;
  /** いちばんひどい場面(worstScene か worst)が起きたときのルール。共有の文の1行目に使う */
  worstRule: FreeRule | null;
}

/**
 * タイムセールラッシュの数(STAGE3「数え方」)。悪党を倒した、市民のけが、逃がした、仕分け正解、
 * 「全員倒した」のもとの悪党の数には入れない。ラッシュだけの数
 */
export interface RushTally {
  /** 走ってきた宇宙人の数 */
  aliens: number;
  /** セールで倒した宇宙人(待てを押さなかった) */
  aliensDefeated: number;
  /** セールで逃がした宇宙人(待てを押した) */
  aliensSpared: number;
  /** 走ってきた市民の数 */
  civs: number;
  /** セールで守った市民(待てを押した) */
  civsSaved: number;
  /** セールで殴った市民(待てを押さなかった) */
  civsHit: number;
}

/** 1つの波の仕分けの当たり外れ(答え合わせの画面と結果画面で使う) */
export interface SortTally {
  wave: WaveNo;
  /** 自分で仕分けて当たった人数 */
  correct: number;
  /** 自分で仕分けた人数 */
  total: number;
  /** ヒーローの勘で決まった人数 */
  byHero: number;
  /** ヒーローの勘が当たった人数 */
  byHeroCorrect: number;
}

/** 称号1つ */
export interface TitleDef {
  id: TitleId;
  name: string;
  pose: WinPose;
  /** 条件の説明(日本語。称号の一覧で、取った称号に出す) */
  condition: string;
  /** まだ取っていない称号のヒント(称号の一覧で「ヒント:」のあとに出す。短く、ふだんの言葉で) */
  hint: string;
  /** 取れるステージ(省略するとどのステージでも取れる) */
  stages?: readonly StageId[];
  /**
   * 取れる遊び方('stage' はステージ1〜3、'free' はフリープレイ)。省略するとどちらでも取れる。
   * フリープレイだけの称号は ['free']、フリープレイで調べない称号は ['stage']
   */
  modes?: readonly ('stage' | 'free')[];
  /** 条件に当てはまるか */
  test: (s: StageStats) => boolean;
}
