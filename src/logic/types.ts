// ルールの部品で共通に使う型。Phaser にも画面にも頼らない。
// 数字やルールの出どころは docs/SPEC.md。

/** 見た目の種類 */
export type Look = 'hoodie' | 'suit' | 'shopper' | 'mohawk' | 'granny';
/** 同じ見た目の市民とワルがいる組(パーカーの男、スーツの男、買い物袋の女性) */
export type PairLook = 'hoodie' | 'suit' | 'shopper';
/** ボスの化けた姿(会社員、おばあさん、買い物袋の女性) */
export type DisguiseLook = 'suit' | 'granny' | 'shopper';
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

/** ワルの悪さの種類(bad のシートの 'mischief' の動き) */
export type MischiefKind = 'shove' | 'snatch' | 'pickpocket' | 'threaten';

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
  /** ワルのときだけ:結果発表で見逃したときにする悪さ */
  mischief?: MischiefKind;
}

/** 1回の波 */
export interface Wave {
  no: WaveNo;
  /** 制限時間(秒) */
  seconds: number;
  /** 出てくる順に並んだ人(ボスを含む) */
  people: Person[];
  /** ワルの数(ボスは含まない)。2〜3 */
  badCount: number;
  hasBoss: boolean;
}

export type StageId = 'alley';

/** 1ステージぶん */
export interface Stage {
  id: StageId;
  /** 表示用の名前(例 '路地裏') */
  name: string;
  /** 作ったときの種(数に直したもの) */
  seed: number;
  waves: Wave[];
  /** 倒すべき相手の総数(ワル全員とボス)。「全員撃破」はこれと比べる */
  villainTotal: number;
  /** 出てくる人の総数(ボスを含む。16) */
  peopleTotal: number;
}

/** ヒーローの攻撃 */
export type AttackKind = 'charge' | 'punch' | 'stomp' | 'special';
/** 壊れる物 */
export type PropKind = 'trash' | 'window' | 'sign' | 'vending' | 'car';

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
  | 'soSo';

/** 勝利ポーズ(hero のアニメの名前) */
export type WinPose = 'win_pose' | 'win_arms' | 'win_fist' | 'win_shy';

/** 1ステージを遊び終えたときの数字(StatsTracker.snapshot() が返す) */
export interface StageStats {
  /** 悪党撃破数(仕分けで殴った + 行けで追い打ち + ボス) */
  defeated: number;
  defeatedBySort: number;
  /** 行けで倒したワルの数 */
  defeatedByGo: number;
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
  /** 逃がした数 */
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
}

/** 称号1つ */
export interface TitleDef {
  id: TitleId;
  /** 調べる順(1〜12) */
  order: number;
  name: string;
  pose: WinPose;
  /** 条件の説明(日本語。称号の一覧を見せるとき用) */
  condition: string;
  /** 結果画面のひとこと */
  comment: Speech;
  /** 条件に当てはまるか */
  test: (s: StageStats) => boolean;
}
