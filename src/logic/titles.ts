// 称号の表と、称号を決める関数。SPECの12の称号に、ステージ2だけで取れる2つ(STAGE2「称号」)と、
// ステージ3だけで取れる3つ(STAGE3「称号」)を足した17個。
// 上から順に調べ、最初に当てはまったものを出す。ステージ2の2つは
// 「ボスの親友」のすぐあとに「ギャングの見送り係」、「追い打ちの鬼」のすぐ前に「一網打尽」。
// ステージ3の3つは「ギャングの見送り係」のすぐあとに「宇宙人の案内係」、「街のほんものヒーロー」のすぐあとに
// 「タイムセールの守り神」、「待ての達人」のすぐあとに「UFOハンター」。
// 条件の数字は遊びながら直すので、ここの TITLE_THRESHOLDS にまとめておく。
//
// 市民のけがの数え方は称号ごとに分ける(けがの理由は StageStats の civHurtByHero / ByCollateral / ByVillain)。
// - 完全無欠、街のほんものヒーロー:なぐった + ワルにやられた + さらわれた。巻きぞえは数えない
//   (巻きぞえは技の当たり方で運で起きる。仕分けが全部正しくても運で取れなくなるのを防ぐ)。
//   ただし巻きぞえでもおばあさんに当たったら完全無欠にはしない(街のほんものヒーローにはなれる)。
//   ボスを市民に仕分けたときも完全無欠にはしない(ふつうは暴れた分の被害額で入らないが、念のため)。
//   巻きぞえが3人以上(暴走機関車の数)なら完全無欠にはせず、暴走機関車のほうを出す
//   (ほんものヒーローは暴走機関車より後に調べるので、同じことになる)
// - 市民の天敵、正義の暴走機関車:なぐった + 巻きぞえ(ヒーローの攻撃が当たった人。暴れっぷりの称号なので巻きぞえも入れる)
// - やさしすぎるヒーロー:なぐった市民だけ(逃がしたワルが市民を襲うのは逃がした結果なので入れない。巻きぞえは運なので入れない)。
//   逃がした数は、走って逃げたワルと待てで止めたワルだけ。車で逃げた組とUFOで去った宇宙人は、見のがしたのではないので入れない
// - おばあちゃんの敵:おばあさんを直接なぐったときだけ。巻きぞえは運なので入れない
// UFOにさらわれた買い物客(ステージ3)は「ワルにやられた」と同じに扱う(完全無欠と街のほんものヒーローが取れなくなり、
// 市民の天敵、正義の暴走機関車、やさしすぎるヒーローには入れない)。
// タイムセールラッシュの数(stats.rush)は、タイムセールの守り神のほかには使わない
//
// 使い方:const title = decideTitle(stats.snapshot());  // どのステージでも同じ関数

import type { StageId, StageStats, TitleDef, TitleId } from './types';

const TITLE_THRESHOLDS = {
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
  /** やさしすぎるヒーロー:見のがしたワル(車やUFOで逃げた分は除く)がこれ以上 */
  tooKindEscaped: 3,
  /** 一網打尽:まとめて吹き飛ばした組がこれ以上 */
  roundUpGroups: 2,
  /** ギャングの見送り係:車で逃げられた組がこれ以上 */
  gangDriverGroups: 2,
  /** 宇宙人の案内係:UFOに連れ去られた買い物客がこれ以上 */
  ufoGuideAbducted: 2,
  /** UFOハンター:行けで殴り落としたUFOがこれ以上 */
  ufoHunterDowned: 2
} as const;

const T = TITLE_THRESHOLDS;

/** ヒーローの攻撃でけがをした市民の数(殴った、巻きぞえ)。ワルに襲われた人は入れない */
const heroHurt = (s: StageStats): number => s.civHurtByHero + s.civHurtByCollateral;
/** 仕分けのまちがいでけがをした市民の数(殴った、ワルに襲われた、UFOにさらわれた)。運で起きる巻きぞえは入れない */
const mistakeHurt = (s: StageStats): number => s.civHurtByHero + s.civHurtByVillain + s.civHurtByAbduction;
/** 見のがしたワルの数(走って逃げた、待てで止めた)。車で逃げた組とUFOで去った宇宙人は入れない */
const sparedBad = (s: StageStats): number => s.escaped - s.escapedByVan - s.escapedByUfo;
/** タイムセールラッシュで、市民を全員守り、宇宙人を全員倒したか */
const perfectRush = (s: StageStats): boolean =>
  s.rush !== null && s.rush.aliens + s.rush.civs > 0
  && s.rush.civsSaved === s.rush.civs && s.rush.aliensDefeated === s.rush.aliens;

/** 称号の一覧(調べる順) */
export const TITLES: readonly TitleDef[] = [
  {
    id: 'flawless', name: '完全無欠のヒーロー', pose: 'win_pose',
    condition: '全員倒して、市民のけが0、被害額¥500万未満(まきぞえは2人まで)',
    hint: '全員倒して、市民のけが0、被害額¥500万未満',
    test: (s) => s.allDefeated && mistakeHurt(s) === 0 && heroHurt(s) < T.runawayHurt && !s.grannyHit && !s.bossSortedCiv
      && s.damage < T.flawlessDamageBelow
  },
  {
    id: 'civNemesis', name: '市民の天敵', pose: 'win_shy',
    condition: 'けがさせた市民が4人以上で、倒したワルの数以上(まきぞえも)',
    hint: '市民をたくさん…',
    test: (s) => heroHurt(s) >= T.civNemesisHurt && heroHurt(s) >= s.defeated
  },
  {
    id: 'demolition', name: '歩く解体工事', pose: 'win_fist',
    condition: '被害額¥5,000万以上',
    hint: '街をこわしまくる',
    test: (s) => s.damage >= T.demolitionDamage
  },
  {
    id: 'bossBuddy', name: 'ボスの親友', pose: 'win_shy',
    condition: 'ボスを市民に仕分けた',
    hint: 'ボスを見のがす',
    test: (s) => s.bossSortedCiv
  },
  {
    id: 'gangDriver', name: 'ギャングの見送り係', pose: 'win_shy',
    condition: 'ギャングの組を2組以上、車で逃がした',
    hint: '地下駐車場で車に2回逃げられる',
    stages: ['garage'],
    test: (s) => s.groupsEscaped >= T.gangDriverGroups
  },
  {
    id: 'ufoGuide', name: '宇宙人の案内係', pose: 'win_shy',
    condition: '買い物客を2人以上、UFOに連れ去られた',
    hint: 'UFOに2人連れていかれる',
    stages: ['mall'],
    test: (s) => s.civHurtByAbduction >= T.ufoGuideAbducted
  },
  {
    id: 'grannyFoe', name: 'おばあちゃんの敵', pose: 'win_shy',
    condition: 'おばあさんをワルに仕分けてなぐった',
    hint: 'おばあさんを…',
    // 地下駐車場とショッピングモールにはおばあさんが出ないので、路地裏だけ
    stages: ['alley'],
    test: (s) => s.grannyPunched
  },
  {
    id: 'runawayTrain', name: '正義の暴走機関車', pose: 'win_arms',
    condition: '全員倒して、市民を3人以上けがさせた(まきぞえも)',
    hint: '全員倒すけど、市民も3人以上',
    test: (s) => s.allDefeated && heroHurt(s) >= T.runawayHurt
  },
  {
    id: 'realHero', name: '街のほんものヒーロー', pose: 'win_pose',
    condition: '全員倒して、市民のけが0(まきぞえは2人まで)',
    hint: '全員倒して、市民のけが0',
    test: (s) => s.allDefeated && mistakeHurt(s) === 0
  },
  {
    id: 'saleGuardian', name: 'タイムセールの守り神', pose: 'win_pose',
    condition: 'タイムセールで、市民を全員守り、宇宙人を全員倒した',
    hint: 'タイムセールで1人も間違えない',
    stages: ['mall'],
    test: perfectRush
  },
  {
    id: 'tapProdigy', name: '連打の申し子', pose: 'win_fist',
    condition: 'ボス戦を7秒以内で終えた',
    hint: 'ボスを7秒以内に倒す',
    test: (s) => s.bossFightSec !== null && s.bossFightSec <= T.tapProdigySec
  },
  {
    id: 'stopMaster', name: '待ての達人', pose: 'win_pose',
    condition: '待てで市民を3人以上守った',
    hint: '待てで市民を3人守る',
    test: (s) => s.civSavedByStop >= T.stopMasterSaved
  },
  {
    id: 'ufoHunter', name: 'UFOハンター', pose: 'win_fist',
    condition: 'UFOを2機以上、行けで殴り落とした',
    hint: 'UFOを2機落とす',
    stages: ['mall'],
    test: (s) => s.ufosDowned >= T.ufoHunterDowned
  },
  {
    id: 'roundUp', name: '一網打尽', pose: 'win_arms',
    condition: 'ギャングの組を2組以上、まとめて吹き飛ばした',
    hint: 'ギャングの組を2回まとめて倒す',
    stages: ['garage'],
    test: (s) => s.groupsWiped >= T.roundUpGroups
  },
  {
    id: 'chaseDemon', name: '追い打ちの鬼', pose: 'win_arms',
    condition: '行けでワルを3人以上倒した',
    hint: '行けでワルを3人倒す',
    test: (s) => s.defeatedByGo >= T.chaseDemonGo
  },
  {
    id: 'tooKind', name: 'やさしすぎるヒーロー', pose: 'win_pose',
    condition: '市民を一度もなぐらず、ワルを3人以上見のがした(車やUFOで逃げた分は数えない)',
    hint: '市民をなぐらず3人逃がす',
    test: (s) => s.civHurtByHero === 0 && sparedBad(s) >= T.tooKindEscaped
  },
  {
    id: 'soSo', name: 'まあまあヒーロー', pose: 'win_arms',
    condition: 'どれにも当てはまらない',
    hint: 'どれにも当てはまらない',
    test: () => true
  }
];

/**
 * 称号の全体の数(全部のステージを合わせて17)。
 * 路地裏で取れるのは12(ステージ2と3だけの5つを除く)、地下駐車場は13(おばあちゃんの敵とステージ3だけの3つを除く)、
 * ショッピングモールは14(おばあちゃんの敵、一網打尽、ギャングの見送り係を除く)
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
