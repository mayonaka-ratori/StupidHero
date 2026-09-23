// 称号の表と、称号を決める関数。SPECの12の称号に、ステージ2だけで取れる2つ(STAGE2「称号」)を足した14個。
// 上から順に調べ、最初に当てはまったものを出す。ステージ2の2つは
// 「ボスの親友」のすぐあとに「ギャングの運転手」、「追い打ちの鬼」のすぐ前に「一網打尽」。
// 条件の数字は遊びながら直すので、ここの TITLE_THRESHOLDS にまとめておく。
//
// 使い方:const title = decideTitle(stats.snapshot());  // どのステージでも同じ関数

import { TITLE_COMMENTS } from './content';
import type { StageId, StageStats, TitleDef, TitleId } from './types';

export const TITLE_THRESHOLDS = {
  /** 完全無欠のヒーロー:被害額がこれ未満 */
  flawlessDamageBelow: 5_000_000,
  /** 市民の天敵:ヒーローが傷つけた市民(殴った、巻きぞえ)がこれ以上(かつ撃破数以上) */
  civNemesisHurt: 4,
  /** 歩く解体工事:被害額がこれ以上 */
  demolitionDamage: 50_000_000,
  /** 正義の暴走機関車:市民負傷がこれ以上 */
  runawayHurt: 3,
  /** 連打の申し子:ボス戦がこの秒数以内 */
  tapProdigySec: 5,
  /** 待ての達人:待てで守った市民がこれ以上 */
  stopMasterSaved: 3,
  /** 追い打ちの鬼:行けで倒したワルがこれ以上 */
  chaseDemonGo: 3,
  /** やさしすぎるヒーロー:逃がした数がこれ以上 */
  tooKindEscaped: 3,
  /** 一網打尽:まとめて吹き飛ばした組がこれ以上 */
  roundUpGroups: 2,
  /** ギャングの運転手:車で逃げられた組がこれ以上 */
  gangDriverGroups: 2
} as const;

const T = TITLE_THRESHOLDS;

/** ヒーローの攻撃でけがをした市民の数(殴った、巻きぞえ)。ワルに襲われた人は入れない */
const heroHurt = (s: StageStats): number => s.civHurtByHero + s.civHurtByCollateral;

/** 称号の一覧(調べる順) */
export const TITLES: readonly TitleDef[] = [
  {
    id: 'flawless', order: 1, name: '完全無欠のヒーロー', pose: 'win_pose',
    condition: '全員撃破、市民負傷0、被害額¥500万未満',
    comment: TITLE_COMMENTS.flawless,
    test: (s) => s.allDefeated && s.civHurt === 0 && s.damage < T.flawlessDamageBelow
  },
  {
    id: 'civNemesis', order: 2, name: '市民の天敵', pose: 'win_shy',
    condition: 'ヒーローが傷つけた市民が4人以上で、撃破数以上',
    comment: TITLE_COMMENTS.civNemesis,
    test: (s) => heroHurt(s) >= T.civNemesisHurt && heroHurt(s) >= s.defeated
  },
  {
    id: 'demolition', order: 3, name: '歩く解体工事', pose: 'win_fist',
    condition: '被害額¥5,000万以上',
    comment: TITLE_COMMENTS.demolition,
    test: (s) => s.damage >= T.demolitionDamage
  },
  {
    id: 'bossBuddy', order: 4, name: 'ボスの親友', pose: 'win_shy',
    condition: 'ボスを市民に仕分けた',
    comment: TITLE_COMMENTS.bossBuddy,
    test: (s) => s.bossSortedCiv
  },
  {
    id: 'gangDriver', order: 5, name: 'ギャングの運転手', pose: 'win_shy',
    condition: '車で逃げられた組が2組以上',
    comment: TITLE_COMMENTS.gangDriver,
    stages: ['garage'],
    test: (s) => s.groupsEscaped >= T.gangDriverGroups
  },
  {
    id: 'grannyFoe', order: 6, name: 'おばあちゃんの敵', pose: 'win_shy',
    condition: 'おばあさんを殴った',
    comment: TITLE_COMMENTS.grannyFoe,
    test: (s) => s.grannyHit
  },
  {
    id: 'runawayTrain', order: 7, name: '正義の暴走機関車', pose: 'win_arms',
    condition: '全員撃破、市民負傷3人以上',
    comment: TITLE_COMMENTS.runawayTrain,
    test: (s) => s.allDefeated && s.civHurt >= T.runawayHurt
  },
  {
    id: 'realHero', order: 8, name: '街のほんものヒーロー', pose: 'win_pose',
    condition: '全員撃破、市民負傷0',
    comment: TITLE_COMMENTS.realHero,
    test: (s) => s.allDefeated && s.civHurt === 0
  },
  {
    id: 'tapProdigy', order: 9, name: '連打の申し子', pose: 'win_fist',
    condition: 'ボス戦を5秒以内で終えた',
    comment: TITLE_COMMENTS.tapProdigy,
    test: (s) => s.bossFightSec !== null && s.bossFightSec <= T.tapProdigySec
  },
  {
    id: 'stopMaster', order: 10, name: '待ての達人', pose: 'win_pose',
    condition: '待てで市民を3人以上守った',
    comment: TITLE_COMMENTS.stopMaster,
    test: (s) => s.civSavedByStop >= T.stopMasterSaved
  },
  {
    id: 'roundUp', order: 11, name: '一網打尽', pose: 'win_arms',
    condition: 'まとめて吹き飛ばした組が2組以上',
    comment: TITLE_COMMENTS.roundUp,
    stages: ['garage'],
    test: (s) => s.groupsWiped >= T.roundUpGroups
  },
  {
    id: 'chaseDemon', order: 12, name: '追い打ちの鬼', pose: 'win_arms',
    condition: '行けでワルを3人以上倒した',
    comment: TITLE_COMMENTS.chaseDemon,
    test: (s) => s.defeatedByGo >= T.chaseDemonGo
  },
  {
    id: 'tooKind', order: 13, name: 'やさしすぎるヒーロー', pose: 'win_pose',
    condition: '市民負傷0、逃がした数3人以上',
    comment: TITLE_COMMENTS.tooKind,
    test: (s) => s.civHurt === 0 && s.escaped >= T.tooKindEscaped
  },
  {
    id: 'soSo', order: 14, name: 'まあまあヒーロー', pose: 'win_arms',
    condition: 'どれにも当てはまらない',
    comment: TITLE_COMMENTS.soSo,
    test: () => true
  }
];

/** 称号の全体の数(全部のステージを合わせて14) */
export const TITLE_COUNT = TITLES.length;

/** そのステージで取れる称号 */
export function titlesFor(stageId: StageId): TitleDef[] {
  return TITLES.filter((t) => !t.stages || t.stages.includes(stageId));
}

/** 数字から称号を決める(上から順に調べ、最初に当てはまったもの) */
export function decideTitle(stats: StageStats): TitleDef {
  return TITLES.find((t) => t.test(stats)) ?? TITLES[TITLES.length - 1];
}

/** id から称号を引く */
export function titleById(id: TitleId): TitleDef {
  const t = TITLES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown title: ${id}`);
  return t;
}
