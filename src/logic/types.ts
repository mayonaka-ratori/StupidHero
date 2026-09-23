// ルールの部品で共通に使う型。Phaser にも画面にも頼らない。
// 数字やルールの出どころは docs/SPEC.md(ステージ1)と docs/STAGE2.md(ステージ2)。

import type { StageDef } from './stages';

/** ステージ1(路地裏)の見た目 */
export type AlleyLook = 'hoodie' | 'suit' | 'shopper' | 'mohawk' | 'granny';
/** ステージ2(地下駐車場)の見た目。どれも市民とギャングの組(警備員、整備士、派手な若者、会社員の女性) */
export type GangLook = 'guard' | 'mechanic' | 'clubber' | 'officelady';
/** 見た目の種類(全部のステージ) */
export type Look = AlleyLook | GangLook;
/** 同じ見た目の市民とワルがいる組(パーカーの男、スーツの男、買い物袋の女性) */
export type PairLook = 'hoodie' | 'suit' | 'shopper';
/** ステージ1のボスの化けた姿(会社員、おばあさん、買い物袋の女性) */
export type AlleyDisguise = 'suit' | 'granny' | 'shopper';
/** ステージ2の女ボスの化けた姿(警備員、整備士、会社員の女性) */
export type GarageDisguise = 'guard' | 'mechanic' | 'officelady';
/** ボスの化けた姿(全部のステージ) */
export type DisguiseLook = AlleyDisguise | GarageDisguise;
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
 * 'whistle' はステージ2のギャング:悪さの代わりに口笛で仲間を呼ぶ(被害額も市民負傷も増えない)
 */
export type MischiefKind = 'shove' | 'snatch' | 'pickpocket' | 'threaten' | 'whistle';

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

export type WaveNo = 1 | 2 | 3;

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

/** ステージの id。'alley' は路地裏(ステージ1)、'garage' は地下駐車場(ステージ2) */
export type StageId = 'alley' | 'garage';

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
  /** 出てくる人の総数(ボスを含む。路地裏16、地下駐車場18) */
  peopleTotal: number;
}

/** ヒーローの攻撃 */
export type AttackKind = 'charge' | 'punch' | 'stomp' | 'special';
/**
 * 壊れる物。路地裏:ゴミ箱、窓、看板、自販機、止めてある車。
 * 地下駐車場:ギャングのワゴン、女ボスの高級車、柱、料金所のバー、三角コーン、消火器の箱(止めてある車も置く)
 */
export type PropKind =
  | 'trash' | 'window' | 'sign' | 'vending' | 'car'
  | 'van' | 'bosscar' | 'pillar' | 'barrier' | 'cone' | 'extinguisher';

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

/** 市民がけがをした理由 */
export type HurtCause = 'hero' | 'collateral' | 'villain';

/**
 * いちばんひどかった場面の種類。SPECの1〜5の順で、上ほどひどい。
 * 1 grannyHit:おばあさんを殴った / 2 specialOnCiv:市民に必殺技を当てた /
 * 3 civHit:市民を殴った(巻きぞえを含む) / 4 bigPropBroken:車や自販機が壊れた / 5 bossDefeated:ボスを倒した
 */
export type WorstScene = 'grannyHit' | 'specialOnCiv' | 'civHit' | 'bigPropBroken' | 'bossDefeated';

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
  | 'gangDriver';

/** 勝利ポーズ(hero のアニメの名前) */
export type WinPose = 'win_pose' | 'win_arms' | 'win_fist' | 'win_shy';

/** 1ステージを遊び終えたときの数字(StatsTracker.snapshot() が返す) */
export interface StageStats {
  /** どのステージの数字か */
  stageId: StageId;
  /** 悪党撃破数(仕分けで殴った + 行けで追い打ち + まとめて吹き飛ばした + ワゴンごと止めた + ボス) */
  defeated: number;
  defeatedBySort: number;
  /** 行けで倒したワルの数 */
  defeatedByGo: number;
  /** まとめて吹き飛ばした人数(ステージ2) */
  defeatedByWipe: number;
  /** ワゴンごと止めた人数(ステージ2) */
  defeatedByVan: number;
  /** まとめて吹き飛ばした組の数(ステージ2。「一網打尽」) */
  groupsWiped: number;
  /** 車で逃げられた組の数(ステージ2。「ギャングの運転手」) */
  groupsEscaped: number;
  /** 車で逃げられた人数(escaped に入っている) */
  escapedByVan: number;
  /** ワゴンを止めた回数(ステージ2) */
  vansStopped: number;
  bossDefeated: boolean;
  /** 市民負傷数(ヒーローが殴った + 巻きぞえ + ワルに襲われた) */
  civHurt: number;
  civHurtByHero: number;
  civHurtByCollateral: number;
  civHurtByVillain: number;
  /** 被害額(円) */
  damage: number;
  damageByProps: number;
  damageByMischief: number;
  damageByBoss: number;
  /** 壊れた物の数 */
  propsBroken: Record<PropKind, number>;
  /** 逃がした数(画面の右から逃げた + 待てで止めたワル + 車で逃げた組の人数) */
  escaped: number;
  /** 待てで守った市民の数 */
  civSavedByStop: number;
  /** 待てで止めたワルの数(参考) */
  badSparedByStop: number;
  /** おばあさんを殴ったか(巻きぞえを含む) */
  grannyHit: boolean;
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
  /** 調べる順(1〜14) */
  order: number;
  name: string;
  pose: WinPose;
  /** 条件の説明(日本語。称号の一覧で、取った称号に出す) */
  condition: string;
  /** まだ取っていない称号のヒント(称号の一覧で「ヒント:」のあとに出す。短く、ふだんの言葉で) */
  hint: string;
  /** 結果画面のひとこと */
  comment: Speech;
  /** 取れるステージ(省略するとどのステージでも取れる) */
  stages?: readonly StageId[];
  /** 条件に当てはまるか */
  test: (s: StageStats) => boolean;
}
