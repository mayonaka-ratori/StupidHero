import { describe, expect, it } from 'vitest';
import { TITLES, collectTitles, decideTitle, titleById } from './titles';
import { makeStats } from './testHelpers';
import type { StageStats } from './types';

// 市民のけがは1人、被害額は¥800万、逃がしたワルは1人
const base = (over: Partial<StageStats> = {}): StageStats =>
  makeStats({ civHurt: 1, civHurtByHero: 1, damage: 8_000_000, damageByProps: 8_000_000, escaped: 1 }, over);

describe('称号', () => {
  it('24個、順番と名前がSPECとSTAGE2とSTAGE3とSTAGE4とFREEPLAYの通り(大きな称号を調べる順)', () => {
    expect(TITLES).toHaveLength(24);
    expect(TITLES.map((t) => t.name)).toEqual([
      '完全無欠のヒーロー', '最上階のヒーロー', '市民の天敵', 'ボスの親友', 'ギャングの見送り係', '宇宙人の案内係',
      '空飛ぶ家具の見送り係', '歩く解体工事', 'おばあちゃんの敵', '正義の暴走機関車', '街のほんものヒーロー', 'タイムセールの守り神',
      'エレベーターの守り神', '連打の申し子', '待ての達人', 'UFOハンター', 'ソファの名人', '一網打尽',
      '追い打ちの鬼', 'やさしすぎるヒーロー', 'まあまあヒーロー', 'ヒーローのお守り役', 'ヒーローの通訳', 'なすがまま'
    ]);
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(24);
    expect(titleById('demolition').name).toBe('歩く解体工事');
  });

  it('完全無欠は全員撃破、負傷0、¥500万未満。¥500万ちょうどなら ほんものヒーロー', () => {
    const perfect = base({ allDefeated: true, civHurt: 0, civHurtByHero: 0, damage: 4_990_000, bossFightSec: 3, civSavedByStop: 5 });
    expect(decideTitle(perfect).id).toBe('flawless');
    expect(decideTitle({ ...perfect, damage: 5_000_000 }).id).toBe('realHero');
  });

  it('ボスの親友 → 解体工事 → おばあちゃんの敵 → 暴走機関車 の順', () => {
    // 路地裏の歩く解体工事は¥1,500万以上。ボスを市民に仕分けた暴れ(¥1,000万)で届いても、大きな称号はボスの親友
    const s = base({ damage: 15_000_000, bossSortedCiv: true, grannyHit: true, grannyPunched: true, allDefeated: true, civHurt: 3, civHurtByHero: 3, defeated: 9 });
    expect(decideTitle(s).id).toBe('bossBuddy');
    expect(collectTitles(s).map((t) => t.id)).toContain('demolition');
    expect(decideTitle({ ...s, bossSortedCiv: false }).id).toBe('demolition');
    expect(decideTitle({ ...s, bossSortedCiv: false, damage: 14_990_000 }).id).toBe('grannyFoe');
    expect(decideTitle({ ...s, damage: 0, bossSortedCiv: false }).id).toBe('grannyFoe');
    expect(decideTitle({ ...s, damage: 0, bossSortedCiv: false, grannyHit: false, grannyPunched: false }).id).toBe('runawayTrain');
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
    // 巻きぞえでおばあさんに当たったら、完全無欠にはしないが、おばあちゃんの敵にもしない(運なので)
    expect(decideTitle(allDown({ civHurt: 1, civHurtByCollateral: 1, grannyHit: true })).id).toBe('realHero');
    // 直接なぐったら、おばあちゃんの敵
    expect(decideTitle(allDown({ civHurt: 1, civHurtByHero: 1, grannyHit: true, grannyPunched: true })).id).toBe('grannyFoe');
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

  it('やさしすぎるヒーローは、車で逃げた組とUFOで去った宇宙人を数えない(見のがしたワルだけ)', () => {
    // 3人組が1回車で逃げただけ
    const van = base({ stageId: 'garage', civHurt: 0, civHurtByHero: 0, escaped: 3, escapedByVan: 3, groupsEscaped: 1 });
    expect(decideTitle(van).id).toBe('soSo');
    expect(decideTitle({ ...van, escaped: 6, badSparedByStop: 3 }).id).toBe('tooKind');
    // UFOで宇宙人が去った分
    const ufo = base({ stageId: 'mall', civHurt: 1, civHurtByHero: 0, civHurtByAbduction: 1, escaped: 3, escapedByUfo: 1 });
    expect(decideTitle(ufo).id).toBe('soSo');
    expect(decideTitle({ ...ufo, escaped: 4 }).id).toBe('tooKind');
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
  it('一網打尽:まとめて吹き飛ばした組が2組以上', () => {
    const s = base({ stageId: 'garage', groupsWiped: 2 });
    expect(decideTitle(s).id).toBe('roundUp');
    expect(decideTitle({ ...s, groupsWiped: 1 }).id).toBe('soSo');
    // 待ての達人より後、追い打ちの鬼より先
    expect(decideTitle({ ...s, civSavedByStop: 3 }).id).toBe('stopMaster');
    expect(decideTitle({ ...s, defeatedByGo: 3 }).id).toBe('roundUp');
  });

  it('ギャングの見送り係:車で逃げられた組が2組以上。ボスの親友より後、おばあちゃんの敵より先', () => {
    const s = base({ stageId: 'garage', groupsEscaped: 2, escaped: 5 });
    expect(decideTitle(s).id).toBe('gangDriver');
    expect(decideTitle({ ...s, groupsEscaped: 1 }).id).not.toBe('gangDriver');
    expect(decideTitle({ ...s, bossSortedCiv: true }).id).toBe('bossBuddy');
    expect(decideTitle({ ...s, grannyHit: true, grannyPunched: true }).id).toBe('gangDriver');
    expect(decideTitle({ ...s, groupsWiped: 2 }).id).toBe('gangDriver');
  });
});

describe('称号(ステージ3)', () => {
  const mall = (over: Partial<StageStats> = {}): StageStats => base({ stageId: 'mall', ...over });

  it('宇宙人の案内係:連れ去られた買い物客が2人以上。ボスの親友より後', () => {
    const s = mall({ civHurt: 2, civHurtByHero: 0, civHurtByAbduction: 2, escaped: 2 });
    expect(decideTitle(s).id).toBe('ufoGuide');
    expect(decideTitle({ ...s, civHurtByAbduction: 1, civHurt: 1 }).id).not.toBe('ufoGuide');
    expect(decideTitle({ ...s, bossSortedCiv: true }).id).toBe('bossBuddy');
  });

  it('さらわれた市民は「ワルにやられた」と同じ:完全無欠とほんものヒーローが取れず、天敵と暴走機関車とやさしすぎるには入れない', () => {
    const allDown = mall({ allDefeated: true, defeated: 9, damage: 1_000_000, bossFightSec: 9, escaped: 0, civHurt: 0, civHurtByHero: 0 });
    expect(decideTitle(allDown).id).toBe('flawless');
    expect(decideTitle({ ...allDown, civHurt: 1, civHurtByAbduction: 1 }).id).toBe('soSo');
    // 市民の天敵には数えない(ヒーローがけがさせた市民だけ)
    const nemesis = mall({ civHurt: 5, civHurtByHero: 3, civHurtByAbduction: 2, defeated: 3, bossDefeated: false, bossFightSec: null });
    expect(decideTitle(nemesis).id).not.toBe('civNemesis');
    // やさしすぎるヒーローは、なぐった市民だけを見る
    const kind = mall({ civHurt: 1, civHurtByHero: 0, civHurtByAbduction: 1, escaped: 3 });
    expect(decideTitle(kind).id).toBe('tooKind');
  });

  it('UFOハンター:UFOを2機以上落とした。待ての達人より後、一網打尽と追い打ちの鬼より先', () => {
    const s = mall({ ufosDowned: 2, defeatedByUfo: 2, defeatedByGo: 3 });
    expect(decideTitle(s).id).toBe('ufoHunter');
    expect(decideTitle({ ...s, ufosDowned: 1 }).id).toBe('chaseDemon');
    expect(decideTitle({ ...s, civSavedByStop: 3 }).id).toBe('stopMaster');
  });
});

describe('称号(ステージ4)', () => {
  const tower = (over: Partial<StageStats> = {}): StageStats => base({ stageId: 'tower', ...over });

  it('完全無欠:高層ビルでボスを倒したときは、かならず壊れるシャンパンタワー(¥1,000万)を被害額に数えない', () => {
    // 実際の高層ビルでは、全員倒すとシャンパンタワーの¥1,000万がかならず入る
    const allDown = (damage: number) => tower({ allDefeated: true, civHurt: 0, civHurtByHero: 0, damage });
    expect(decideTitle(allDown(10_000_000), { firstClear: false }).id).toBe('flawless');
    expect(decideTitle(allDown(14_999_999), { firstClear: false }).id).toBe('flawless');
    expect(decideTitle(allDown(15_000_000), { firstClear: false }).id).not.toBe('flawless');
    // ほかのステージは前のまま¥500万未満
    const alley = base({ allDefeated: true, civHurt: 0, civHurtByHero: 0, bossDefeated: true, damage: 5_000_000 });
    expect(decideTitle(alley).id).not.toBe('flawless');
  });

  it('最上階のヒーロー:高層ビルのボスを初めて倒した回だけ。完全無欠にも当たるときは最上階のヒーローが先', () => {
    const s = tower();
    expect(decideTitle(s, { firstClear: true }).id).toBe('topHero');
    expect(decideTitle(s, { firstClear: false }).id).toBe('soSo');
    expect(decideTitle(s).id).toBe('soSo');
    expect(decideTitle({ ...s, bossDefeated: false }, { firstClear: true }).id).toBe('soSo');
    // ほかのステージのボスを初めて倒したときは出ない
    expect(decideTitle(base(), { firstClear: true }).id).toBe('soSo');
    // 初めて倒した回は、完全無欠にも当たっても最上階のヒーロー(2回目からは取れないので)。2回目からは完全無欠
    const perfect = tower({ allDefeated: true, civHurt: 0, civHurtByHero: 0, damage: 10_000_000 });
    expect(decideTitle(perfect, { firstClear: true }).id).toBe('topHero');
    expect(decideTitle(perfect, { firstClear: false }).id).toBe('flawless');
    // 歩く解体工事などより先
    expect(decideTitle(tower({ damage: 60_000_000 }), { firstClear: true }).id).toBe('topHero');
  });

  it('空飛ぶ家具の見送り係:念力の物で市民が2人以上けが。ボスの親友より後、おばあちゃんの敵より先', () => {
    const s = tower({ civHurt: 2, civHurtByHero: 0, civHurtByDrop: 2, escaped: 2, escapedByPsy: 2 });
    expect(decideTitle(s).id).toBe('furnitureGuide');
    expect(decideTitle({ ...s, civHurtByDrop: 1, civHurt: 1 }).id).not.toBe('furnitureGuide');
    expect(decideTitle({ ...s, bossSortedCiv: true }).id).toBe('bossBuddy');
    expect(decideTitle({ ...s, grannyHit: true, grannyPunched: true }).id).toBe('furnitureGuide');
  });

  it('念力の物が落ちた市民は「ワルにやられた」と同じ:完全無欠とほんものヒーローが取れず、天敵と暴走機関車とやさしすぎるには入れない', () => {
    // 高層ビルでボスを倒した回は、シャンパンタワーの¥1,000万がかならず入っている
    const allDown = tower({ allDefeated: true, defeated: 9, damage: 11_000_000, bossFightSec: 9, escaped: 0, civHurt: 0, civHurtByHero: 0 });
    expect(decideTitle(allDown).id).toBe('flawless');
    expect(decideTitle({ ...allDown, civHurt: 1, civHurtByDrop: 1 }).id).toBe('soSo');
    expect(decideTitle({ ...allDown, damage: 16_000_000 }).id).toBe('realHero');
    expect(decideTitle({ ...allDown, damage: 16_000_000, civHurt: 1, civHurtByDrop: 1 }).id).toBe('soSo');
    const nemesis = tower({ civHurt: 5, civHurtByHero: 3, civHurtByDrop: 2, defeated: 3, bossDefeated: false, bossFightSec: null });
    expect(decideTitle(nemesis).id).not.toBe('civNemesis');
    const runaway = tower({ allDefeated: true, civHurt: 3, civHurtByHero: 2, civHurtByDrop: 1 });
    expect(decideTitle(runaway).id).not.toBe('runawayTrain');
    const kind = tower({ civHurt: 1, civHurtByHero: 0, civHurtByDrop: 1, escaped: 3 });
    expect(decideTitle(kind).id).toBe('tooKind');
  });

  it('ソファの名人:2回以上ソファの上で落とした。待ての達人より後、追い打ちの鬼より先', () => {
    const s = tower({ sofaSaves: 2, defeatedByPsy: 3, defeatedByGo: 3 });
    expect(decideTitle(s).id).toBe('sofaMaster');
    expect(decideTitle({ ...s, sofaSaves: 1 }).id).toBe('chaseDemon');
    expect(decideTitle({ ...s, civSavedByStop: 3 }).id).toBe('stopMaster');
  });
});

describe('ラッシュの守り神(タイムセールとエレベーター)', () => {
  it.each([
    { id: 'saleGuardian', stageId: 'mall', key: 'rush', other: 'lift', n: 4, realDamage: 6_000_000 },
    { id: 'liftGuardian', stageId: 'tower', key: 'lift', other: 'rush', n: 3, realDamage: 16_000_000 }
  ] as const)('$id:市民を全員守り、悪党を全員倒した。ラッシュをしていないときと、もう片方のラッシュの数では取れない', ({ id, stageId, key, other, n, realDamage }) => {
    const st = (over: Partial<StageStats> = {}): StageStats => base({ stageId, ...over });
    const perfect = { aliens: n, aliensDefeated: n, aliensSpared: 0, civs: n, civsSaved: n, civsHit: 0 };
    expect(decideTitle(st({ [key]: perfect })).id).toBe(id);
    expect(decideTitle(st({ [key]: { ...perfect, civsSaved: n - 1, civsHit: 1 } })).id).toBe('soSo');
    expect(decideTitle(st({ [key]: { ...perfect, aliensDefeated: n - 1, aliensSpared: 1 } })).id).toBe('soSo');
    expect(decideTitle(st({ [key]: null })).id).toBe('soSo');
    // タイムセールとエレベーターを取り違えない
    expect(decideTitle(st({ [other]: perfect })).id).not.toBe(id);
    // 街のほんものヒーローより後、連打の申し子より先
    expect(decideTitle(st({ [key]: perfect, bossFightSec: 5 })).id).toBe(id);
    const real = st({ [key]: perfect, allDefeated: true, civHurt: 0, civHurtByHero: 0, damage: realDamage });
    expect(decideTitle(real).id).toBe('realHero');
  });
});
