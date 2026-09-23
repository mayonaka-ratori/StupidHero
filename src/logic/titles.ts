// 称号の表と、称号を決める関数。SPECの12の称号に、ステージ2だけで取れる2つ(STAGE2「称号」)を足した14個。
// 上から順に調べ、最初に当てはまったものを出す。ステージ2の2つは
// 「ボスの親友」のすぐあとに「ギャングの運転手」、「追い打ちの鬼」のすぐ前に「一網打尽」。
// 条件の数字は遊びながら直すので、ここの TITLE_THRESHOLDS にまとめておく。
//
// 市民のけがの数え方は称号ごとに分ける(けがの理由は StageStats の civHurtByHero / ByCollateral / ByVillain)。
// - 完全無欠、街のほんものヒーロー:なぐった + ワルにやられた。巻きぞえは数えない
//   (巻きぞえは技の当たり方で運で起きる。仕分けが全部正しくても運で取れなくなるのを防ぐ)。
//   ただし巻きぞえでもおばあさんに当たったら完全無欠にはしない(おばあちゃんの敵のほうが先に出る)。
//   ボスを市民に仕分けたときも完全無欠にはしない(ふつうは暴れた分の被害額で入らないが、念のため)。
//   巻きぞえが3人以上(暴走機関車の数)なら完全無欠にはせず、暴走機関車のほうを出す
//   (ほんものヒーローは暴走機関車より後に調べるので、同じことになる)
// - 市民の天敵、正義の暴走機関車:なぐった + 巻きぞえ(ヒーローの攻撃が当たった人。暴れっぷりの称号なので巻きぞえも入れる)
// - やさしすぎるヒーロー:なぐった市民だけ(逃がしたワルが市民を襲うのは逃がした結果なので入れない。巻きぞえは運なので入れない)
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
  /** 正義の暴走機関車:ヒーローが傷つけた市民(殴った、巻きぞえ)がこれ以上 */
  runawayHurt: 3,
  /** 連打の申し子:ボス戦がこの秒数以内 */
  tapProdigySec: 7,
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
/** 仕分けのまちがいでけがをした市民の数(殴った、ワルに襲われた)。運で起きる巻きぞえは入れない */
const mistakeHurt = (s: StageStats): number => s.civHurtByHero + s.civHurtByVillain;

/** 称号の一覧(調べる順) */
export const TITLES: readonly TitleDef[] = [
  {
    id: 'flawless', order: 1, name: '完全無欠のヒーロー', pose: 'win_pose',
    condition: '全員倒して、市民のけが0、被害額¥500万未満(まきぞえは2人まで)',
    hint: '全員倒して、市民のけが0、被害額¥500万未満',
    comment: TITLE_COMMENTS.flawless,
    test: (s) => s.allDefeated && mistakeHurt(s) === 0 && heroHurt(s) < T.runawayHurt && !s.grannyHit && !s.bossSortedCiv
      && s.damage < T.flawlessDamageBelow
  },
  {
    id: 'civNemesis', order: 2, name: '市民の天敵', pose: 'win_shy',
    condition: 'けがさせた市民が4人以上で、倒したワルの数以上(まきぞえも)',
    hint: '市民をたくさん…',
    comment: TITLE_COMMENTS.civNemesis,
    test: (s) => heroHurt(s) >= T.civNemesisHurt && heroHurt(s) >= s.defeated
  },
  {
    id: 'demolition', order: 3, name: '歩く解体工事', pose: 'win_fist',
    condition: '被害額¥5,000万以上',
    hint: '街をこわしまくる',
    comment: TITLE_COMMENTS.demolition,
    test: (s) => s.damage >= T.demolitionDamage
  },
  {
    id: 'bossBuddy', order: 4, name: 'ボスの親友', pose: 'win_shy',
    condition: 'ボスを市民に仕分けた',
    hint: 'ボスを見のがす',
    comment: TITLE_COMMENTS.bossBuddy,
    test: (s) => s.bossSortedCiv
  },
  {
    id: 'gangDriver', order: 5, name: 'ギャングの運転手', pose: 'win_shy',
    condition: 'ギャングの組を2組以上、車で逃がした',
    hint: '地下駐車場で車に2回逃げられる',
    comment: TITLE_COMMENTS.gangDriver,
    stages: ['garage'],
    test: (s) => s.groupsEscaped >= T.gangDriverGroups
  },
  {
    id: 'grannyFoe', order: 6, name: 'おばあちゃんの敵', pose: 'win_shy',
    condition: 'おばあさんをなぐった(まきぞえも)',
    hint: 'おばあさんを…',
    comment: TITLE_COMMENTS.grannyFoe,
    // 地下駐車場にはおばあさんが出ないので、路地裏だけ
    stages: ['alley'],
    test: (s) => s.grannyHit
  },
  {
    id: 'runawayTrain', order: 7, name: '正義の暴走機関車', pose: 'win_arms',
    condition: '全員倒して、市民を3人以上けがさせた(まきぞえも)',
    hint: '全員倒すけど、市民も3人以上',
    comment: TITLE_COMMENTS.runawayTrain,
    test: (s) => s.allDefeated && heroHurt(s) >= T.runawayHurt
  },
  {
    id: 'realHero', order: 8, name: '街のほんものヒーロー', pose: 'win_pose',
    condition: '全員倒して、市民のけが0(まきぞえは2人まで)',
    hint: '全員倒して、市民のけが0',
    comment: TITLE_COMMENTS.realHero,
    test: (s) => s.allDefeated && mistakeHurt(s) === 0
  },
  {
    id: 'tapProdigy', order: 9, name: '連打の申し子', pose: 'win_fist',
    condition: 'ボス戦を7秒以内で終えた',
    hint: 'ボスを7秒以内に倒す',
    comment: TITLE_COMMENTS.tapProdigy,
    test: (s) => s.bossFightSec !== null && s.bossFightSec <= T.tapProdigySec
  },
  {
    id: 'stopMaster', order: 10, name: '待ての達人', pose: 'win_pose',
    condition: '待てで市民を3人以上守った',
    hint: '待てで市民を3人守る',
    comment: TITLE_COMMENTS.stopMaster,
    test: (s) => s.civSavedByStop >= T.stopMasterSaved
  },
  {
    id: 'roundUp', order: 11, name: '一網打尽', pose: 'win_arms',
    condition: 'ギャングの組を2組以上、まとめて吹き飛ばした',
    hint: 'ギャングの組を2回まとめて倒す',
    comment: TITLE_COMMENTS.roundUp,
    stages: ['garage'],
    test: (s) => s.groupsWiped >= T.roundUpGroups
  },
  {
    id: 'chaseDemon', order: 12, name: '追い打ちの鬼', pose: 'win_arms',
    condition: '行けでワルを3人以上倒した',
    hint: '行けでワルを3人倒す',
    comment: TITLE_COMMENTS.chaseDemon,
    test: (s) => s.defeatedByGo >= T.chaseDemonGo
  },
  {
    id: 'tooKind', order: 13, name: 'やさしすぎるヒーロー', pose: 'win_pose',
    condition: '市民を一度もなぐらず、ワルを3人以上逃がした',
    hint: 'だれもなぐらず3人逃がす',
    comment: TITLE_COMMENTS.tooKind,
    test: (s) => s.civHurtByHero === 0 && s.escaped >= T.tooKindEscaped
  },
  {
    id: 'soSo', order: 14, name: 'まあまあヒーロー', pose: 'win_arms',
    condition: 'どれにも当てはまらない',
    hint: 'どれにも当てはまらない',
    comment: TITLE_COMMENTS.soSo,
    test: () => true
  }
];

/**
 * 称号の全体の数(全部のステージを合わせて14)。
 * 路地裏で取れるのは12(一網打尽、ギャングの運転手を除く)、地下駐車場は13(おばあちゃんの敵を除く)
 */
export const TITLE_COUNT = TITLES.length;

/** そのステージで取れる称号 */
export function titlesFor(stageId: StageId): TitleDef[] {
  return TITLES.filter((t) => !t.stages || t.stages.includes(stageId));
}

/**
 * 数字から称号を決める(上から順に調べ、最初に当てはまったもの)。
 * 結果画面のひとことは titleCommentFor(title.id, stage.id)(content.ts)でステージに合った言い方にする
 */
export function decideTitle(stats: StageStats): TitleDef {
  return TITLES.find((t) => t.test(stats)) ?? TITLES[TITLES.length - 1];
}

/** id から称号を引く */
export function titleById(id: TitleId): TitleDef {
  const t = TITLES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown title: ${id}`);
  return t;
}
