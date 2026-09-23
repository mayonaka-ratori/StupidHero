import { describe, expect, it } from 'vitest';
import { TITLES, decideTitle, titleById, titlesFor } from './titles';
import type { StageStats } from './types';

const base = (over: Partial<StageStats> = {}): StageStats => ({
  stageId: 'alley', defeated: 5, defeatedBySort: 5, defeatedByGo: 0, bossDefeated: true,
  civHurt: 1, civHurtByHero: 1, civHurtByCollateral: 0, civHurtByVillain: 0,
  damage: 8_000_000, damageByProps: 8_000_000, damageByMischief: 0, damageByBoss: 0,
  propsBroken: {
    trash: 0, window: 0, sign: 0, vending: 0, car: 0, van: 0, bosscar: 0, pillar: 0, barrier: 0, cone: 0, extinguisher: 0
  },
  defeatedByWipe: 0, defeatedByVan: 0, groupsWiped: 0, groupsEscaped: 0, escapedByVan: 0, vansStopped: 0,
  escaped: 1, civSavedByStop: 0, badSparedByStop: 0,
  grannyHit: false, bossSortedCiv: false, bossFightSec: 8,
  villainTotal: 9, allDefeated: false, worstScene: null, worstAttack: null,
  sortCorrect: 0, sortTotal: 0, sortByHero: 0, sortByHeroCorrect: 0, sortWaves: [],
  ...over
});

describe('称号', () => {
  it('14個、順番と名前とポーズがSPECとSTAGE2の通り', () => {
    expect(TITLES).toHaveLength(14);
    expect(TITLES.map((t) => t.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(TITLES.map((t) => t.name)).toEqual([
      '完全無欠のヒーロー', '市民の天敵', '歩く解体工事', 'ボスの親友', 'ギャングの運転手', 'おばあちゃんの敵', '正義の暴走機関車',
      '街のほんものヒーロー', '連打の申し子', '待ての達人', '一網打尽', '追い打ちの鬼', 'やさしすぎるヒーロー', 'まあまあヒーロー'
    ]);
    expect(TITLES.map((t) => t.pose)).toEqual([
      'win_pose', 'win_shy', 'win_fist', 'win_shy', 'win_shy', 'win_shy', 'win_arms',
      'win_pose', 'win_fist', 'win_pose', 'win_arms', 'win_arms', 'win_pose', 'win_arms'
    ]);
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(14);
    expect(titleById('demolition').name).toBe('歩く解体工事');
  });

  it('どれにも当てはまらなければ まあまあヒーロー', () => {
    expect(decideTitle(base()).id).toBe('soSo');
  });

  it('完全無欠は全員撃破、負傷0、¥500万未満。¥500万ちょうどなら ほんものヒーロー', () => {
    const perfect = base({ allDefeated: true, civHurt: 0, civHurtByHero: 0, damage: 4_990_000, bossFightSec: 3, civSavedByStop: 5 });
    expect(decideTitle(perfect).id).toBe('flawless');
    expect(decideTitle({ ...perfect, damage: 5_000_000 }).id).toBe('realHero');
  });

  it('市民の天敵は、ヒーローが傷つけた市民が4人以上かつ撃破数以上。解体工事やボスの親友より先', () => {
    const s = base({ civHurt: 5, civHurtByHero: 3, civHurtByCollateral: 2, defeated: 5, damage: 60_000_000, bossSortedCiv: true, grannyHit: true });
    expect(decideTitle(s).id).toBe('civNemesis');
    expect(decideTitle({ ...s, defeated: 6 }).id).toBe('demolition');
    expect(decideTitle({ ...s, civHurt: 3, civHurtByHero: 2, civHurtByCollateral: 1, defeated: 2 }).id).toBe('demolition');
  });

  it('ワルに襲われた市民は、市民の天敵に数えない(ヒーローが誰も殴っていないとき)', () => {
    const s = base({ civHurt: 5, civHurtByHero: 0, civHurtByCollateral: 0, civHurtByVillain: 5, defeated: 1, bossDefeated: false, bossFightSec: null });
    expect(decideTitle(s).id).not.toBe('civNemesis');
    expect(decideTitle({ ...s, civHurtByHero: 2, civHurtByCollateral: 1, civHurtByVillain: 2 }).id).not.toBe('civNemesis');
    expect(decideTitle({ ...s, civHurtByHero: 2, civHurtByCollateral: 2, civHurtByVillain: 1 }).id).toBe('civNemesis');
  });

  it('解体工事 → ボスの親友 → おばあちゃんの敵 → 暴走機関車 の順', () => {
    const s = base({ damage: 50_000_000, bossSortedCiv: true, grannyHit: true, allDefeated: true, civHurt: 3, civHurtByHero: 3, defeated: 9 });
    expect(decideTitle(s).id).toBe('demolition');
    expect(decideTitle({ ...s, damage: 49_990_000 }).id).toBe('bossBuddy');
    expect(decideTitle({ ...s, damage: 0, bossSortedCiv: false }).id).toBe('grannyFoe');
    expect(decideTitle({ ...s, damage: 0, bossSortedCiv: false, grannyHit: false }).id).toBe('runawayTrain');
  });

  it('全員撃破で負傷1〜2人はどちらにも入らない', () => {
    const s = base({ allDefeated: true, civHurt: 2, bossFightSec: 9 });
    expect(decideTitle(s).id).toBe('soSo');
  });

  it('連打の申し子は7秒以内(ちょうど7秒を含む)。ボス戦がなければ入らない', () => {
    expect(decideTitle(base({ bossFightSec: 7 })).id).toBe('tapProdigy');
    expect(decideTitle(base({ bossFightSec: 5.5 })).id).toBe('tapProdigy');
    expect(decideTitle(base({ bossFightSec: 7.01 })).id).toBe('soSo');
    expect(decideTitle(base({ bossFightSec: null })).id).toBe('soSo');
    expect(decideTitle(base({ bossFightSec: 4, civSavedByStop: 3 })).id).toBe('tapProdigy');
  });

  it('待ての達人 → 追い打ちの鬼 → やさしすぎるヒーロー', () => {
    const s = base({ civSavedByStop: 3, defeatedByGo: 3, civHurt: 0, civHurtByHero: 0, escaped: 3 });
    expect(decideTitle(s).id).toBe('stopMaster');
    expect(decideTitle({ ...s, civSavedByStop: 2 }).id).toBe('chaseDemon');
    expect(decideTitle({ ...s, civSavedByStop: 2, defeatedByGo: 2 }).id).toBe('tooKind');
    expect(decideTitle({ ...s, civSavedByStop: 2, defeatedByGo: 2, civHurt: 1, civHurtByHero: 1 }).id).toBe('soSo');
  });
});

describe('称号の市民のけがの数え方', () => {
  const allDown = (over: Partial<StageStats> = {}): StageStats =>
    base({ allDefeated: true, defeated: 9, damage: 1_000_000, bossFightSec: 9, escaped: 0, civHurt: 0, civHurtByHero: 0, ...over });

  it('完全無欠と ほんものヒーロー は巻きぞえを数えない(仕分けが全部正しければ運で落ちない)', () => {
    expect(decideTitle(allDown()).id).toBe('flawless');
    expect(decideTitle(allDown({ civHurt: 2, civHurtByCollateral: 2 })).id).toBe('flawless');
    expect(decideTitle(allDown({ civHurt: 2, civHurtByCollateral: 2, damage: 6_000_000 })).id).toBe('realHero');
    // なぐった市民やワルに襲われた市民がいれば入らない
    expect(decideTitle(allDown({ civHurt: 1, civHurtByHero: 1 })).id).toBe('soSo');
    expect(decideTitle(allDown({ civHurt: 1, civHurtByVillain: 1 })).id).toBe('soSo');
    // 巻きぞえでもおばあさんに当たったら、おばあちゃんの敵
    expect(decideTitle(allDown({ civHurt: 1, civHurtByCollateral: 1, grannyHit: true })).id).toBe('grannyFoe');
    // ボスを市民に仕分けたら完全無欠にはしない
    expect(decideTitle(allDown({ bossSortedCiv: true })).id).toBe('bossBuddy');
  });

  it('正義の暴走機関車は、なぐった市民と巻きぞえの合計(ワルに襲われた市民は数えない)', () => {
    expect(decideTitle(allDown({ civHurt: 3, civHurtByHero: 1, civHurtByCollateral: 2 })).id).toBe('runawayTrain');
    // 仕分けが全部正しくても、巻きぞえが3人以上なら完全無欠ではなく暴走機関車
    expect(decideTitle(allDown({ civHurt: 3, civHurtByCollateral: 3 })).id).toBe('runawayTrain');
    expect(decideTitle(allDown({ civHurt: 3, civHurtByHero: 1, civHurtByVillain: 2 })).id).toBe('soSo');
  });

  it('やさしすぎるヒーローは、なぐった市民がいないこと(逃がしたワルが襲った市民と巻きぞえは数えない)', () => {
    const kind = base({ civHurt: 2, civHurtByHero: 0, civHurtByVillain: 2, escaped: 3 });
    expect(decideTitle(kind).id).toBe('tooKind');
    expect(decideTitle({ ...kind, civHurt: 3, civHurtByCollateral: 1 }).id).toBe('tooKind');
    expect(decideTitle({ ...kind, civHurt: 3, civHurtByHero: 1 }).id).toBe('soSo');
  });

  it('どの称号にも、条件とヒントの文がある', () => {
    for (const t of TITLES) {
      expect(t.condition.length, t.id).toBeGreaterThan(0);
      expect(t.hint.length, t.id).toBeGreaterThan(0);
      expect(t.hint, t.id).not.toMatch(/[ —]/);
      expect(t.condition, t.id).not.toMatch(/[ —]/);
    }
  });
});

describe('称号(ステージ2)', () => {
  it('ギャングの運転手は ボスの親友 のすぐあと、一網打尽は 追い打ちの鬼 のすぐ前', () => {
    const ids = TITLES.map((t) => t.id);
    expect(ids.indexOf('gangDriver')).toBe(ids.indexOf('bossBuddy') + 1);
    expect(ids.indexOf('roundUp')).toBe(ids.indexOf('chaseDemon') - 1);
    expect(titleById('roundUp').name).toBe('一網打尽');
    expect(titleById('gangDriver').pose).toBe('win_shy');
    expect(titleById('roundUp').stages).toEqual(['garage']);
    expect(titlesFor('alley')).toHaveLength(12);
    expect(titlesFor('garage')).toHaveLength(13);
    // おばあさんは地下駐車場に出ないので、おばあちゃんの敵は路地裏だけ
    expect(titleById('grannyFoe').stages).toEqual(['alley']);
    expect(titlesFor('garage').map((t) => t.id)).not.toContain('grannyFoe');
    expect(titlesFor('alley').map((t) => t.id)).toContain('grannyFoe');
    // どちらかのステージでは必ず取れる
    for (const t of TITLES) expect(titlesFor('alley').includes(t) || titlesFor('garage').includes(t), t.id).toBe(true);
  });

  it('一網打尽:まとめて吹き飛ばした組が2組以上', () => {
    const s = base({ stageId: 'garage', groupsWiped: 2 });
    expect(decideTitle(s).id).toBe('roundUp');
    expect(decideTitle({ ...s, groupsWiped: 1 }).id).toBe('soSo');
    // 待ての達人より後、追い打ちの鬼より先
    expect(decideTitle({ ...s, civSavedByStop: 3 }).id).toBe('stopMaster');
    expect(decideTitle({ ...s, defeatedByGo: 3 }).id).toBe('roundUp');
  });

  it('ギャングの運転手:車で逃げられた組が2組以上。ボスの親友より後、おばあちゃんの敵より先', () => {
    const s = base({ stageId: 'garage', groupsEscaped: 2, escaped: 5 });
    expect(decideTitle(s).id).toBe('gangDriver');
    expect(decideTitle({ ...s, groupsEscaped: 1 }).id).not.toBe('gangDriver');
    expect(decideTitle({ ...s, bossSortedCiv: true }).id).toBe('bossBuddy');
    expect(decideTitle({ ...s, grannyHit: true }).id).toBe('gangDriver');
    expect(decideTitle({ ...s, groupsWiped: 2 }).id).toBe('gangDriver');
  });
});
