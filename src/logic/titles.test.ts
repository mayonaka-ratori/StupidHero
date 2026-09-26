import { describe, expect, it } from 'vitest';
import { titleCommentFor } from './content';
import { TITLES, decideTitle, titleById, titlesFor, titlesForFree } from './titles';
import { makeStats } from './testHelpers';
import type { StageStats } from './types';

// 市民のけがは1人、被害額は¥800万、逃がしたワルは1人
const base = (over: Partial<StageStats> = {}): StageStats =>
  makeStats({ civHurt: 1, civHurtByHero: 1, damage: 8_000_000, damageByProps: 8_000_000, escaped: 1 }, over);

describe('称号', () => {
  it('24個、順番と名前とポーズがSPECとSTAGE2とSTAGE3とSTAGE4とFREEPLAYの通り', () => {
    expect(TITLES).toHaveLength(24);
    expect(TITLES.map((t) => t.name)).toEqual([
      '完全無欠のヒーロー', '最上階のヒーロー', '市民の天敵', '歩く解体工事', 'ボスの親友', 'ギャングの見送り係', '宇宙人の案内係',
      '空飛ぶ家具の見送り係', 'おばあちゃんの敵', '正義の暴走機関車', '街のほんものヒーロー', 'タイムセールの守り神',
      'エレベーターの守り神', '連打の申し子', '待ての達人', 'UFOハンター', 'ソファの名人', '一網打尽',
      '追い打ちの鬼', 'やさしすぎるヒーロー', 'まあまあヒーロー', 'ヒーローのお守り役', 'ヒーローの通訳', 'なすがまま'
    ]);
    expect(TITLES.map((t) => t.pose)).toEqual([
      'win_pose', 'win_pose', 'win_shy', 'win_fist', 'win_shy', 'win_shy', 'win_shy', 'win_shy', 'win_shy', 'win_arms',
      'win_pose', 'win_pose', 'win_pose', 'win_fist', 'win_pose', 'win_fist', 'win_arms', 'win_arms', 'win_arms', 'win_pose',
      'win_arms', 'win_pose', 'win_arms', 'win_shy'
    ]);
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(24);
    expect(titleById('demolition').name).toBe('歩く解体工事');
  });

  it('完全無欠は全員撃破、負傷0、¥500万未満。¥500万ちょうどなら ほんものヒーロー', () => {
    const perfect = base({ allDefeated: true, civHurt: 0, civHurtByHero: 0, damage: 4_990_000, bossFightSec: 3, civSavedByStop: 5 });
    expect(decideTitle(perfect).id).toBe('flawless');
    expect(decideTitle({ ...perfect, damage: 5_000_000 }).id).toBe('realHero');
  });

  it('解体工事 → ボスの親友 → おばあちゃんの敵 → 暴走機関車 の順', () => {
    const s = base({ damage: 50_000_000, bossSortedCiv: true, grannyHit: true, grannyPunched: true, allDefeated: true, civHurt: 3, civHurtByHero: 3, defeated: 9 });
    expect(decideTitle(s).id).toBe('demolition');
    expect(decideTitle({ ...s, damage: 49_990_000 }).id).toBe('bossBuddy');
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
    expect(titleById('tooKind').hint).toBe('市民をなぐらず3人逃がす');
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
  it('ギャングの見送り係は ボスの親友 のすぐあと、一網打尽は 追い打ちの鬼 のすぐ前。おばあちゃんの敵は路地裏だけ、一網打尽は地下駐車場だけ', () => {
    const ids = TITLES.map((t) => t.id);
    expect(ids.indexOf('gangDriver')).toBe(ids.indexOf('bossBuddy') + 1);
    expect(ids.indexOf('roundUp')).toBe(ids.indexOf('chaseDemon') - 1);
    // おばあさんは地下駐車場に出ないので、おばあちゃんの敵は路地裏だけ(ステージごとの数は ステージ3 の称号で確かめる)
    expect(titlesFor('garage').map((t) => t.id)).not.toContain('grannyFoe');
    expect(titlesFor('alley').map((t) => t.id)).not.toContain('roundUp');
    // どれかのステージかフリープレイでは必ず取れる
    for (const t of TITLES) {
      expect(titlesFor('alley').includes(t) || titlesFor('garage').includes(t) || titlesFor('mall').includes(t)
        || titlesFor('tower').includes(t) || titlesForFree().includes(t), t.id).toBe(true);
    }
  });

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
  const perfectRush = { aliens: 4, aliensDefeated: 4, aliensSpared: 0, civs: 4, civsSaved: 4, civsHit: 0 };

  it('宇宙人の案内係は ギャングの見送り係 のすぐあと、タイムセールの守り神は 街のほんものヒーロー のすぐあと、UFOハンターは 待ての達人 のすぐあと', () => {
    const ids = TITLES.map((t) => t.id);
    expect(ids.indexOf('ufoGuide')).toBe(ids.indexOf('gangDriver') + 1);
    expect(ids.indexOf('saleGuardian')).toBe(ids.indexOf('realHero') + 1);
    expect(ids.indexOf('ufoHunter')).toBe(ids.indexOf('stopMaster') + 1);
    for (const id of ['ufoGuide', 'saleGuardian', 'ufoHunter'] as const) expect(titleById(id).stages).toEqual(['mall']);
    expect(titleById('ufoGuide').pose).toBe('win_shy');
    expect(titleById('saleGuardian').pose).toBe('win_pose');
    expect(titleById('ufoHunter').pose).toBe('win_fist');
  });

  it('ステージごとに取れる数:路地裏12、地下駐車場13、ショッピングモール14', () => {
    expect(titlesFor('alley')).toHaveLength(12);
    expect(titlesFor('garage')).toHaveLength(13);
    expect(titlesFor('mall')).toHaveLength(14);
    const mallIds = titlesFor('mall').map((t) => t.id);
    for (const id of ['grannyFoe', 'roundUp', 'gangDriver'] as const) expect(mallIds).not.toContain(id);
    for (const id of ['ufoGuide', 'saleGuardian', 'ufoHunter'] as const) {
      expect(titlesFor('alley').map((t) => t.id)).not.toContain(id);
      expect(titlesFor('garage').map((t) => t.id)).not.toContain(id);
    }
  });

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

  it('タイムセールの守り神:市民を全員守り、宇宙人を全員倒した。ラッシュをしていなければ入らない', () => {
    expect(decideTitle(mall({ rush: perfectRush })).id).toBe('saleGuardian');
    expect(decideTitle(mall({ rush: { ...perfectRush, civsSaved: 3, civsHit: 1 } })).id).toBe('soSo');
    expect(decideTitle(mall({ rush: { ...perfectRush, aliensDefeated: 3, aliensSpared: 1 } })).id).toBe('soSo');
    expect(decideTitle(mall({ rush: null })).id).toBe('soSo');
    // 街のほんものヒーローより後、連打の申し子より先
    expect(decideTitle(mall({ rush: perfectRush, bossFightSec: 5 })).id).toBe('saleGuardian');
    const real = mall({ rush: perfectRush, allDefeated: true, civHurt: 0, civHurtByHero: 0, damage: 6_000_000 });
    expect(decideTitle(real).id).toBe('realHero');
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
  const perfectLift = { aliens: 3, aliensDefeated: 3, aliensSpared: 0, civs: 3, civsSaved: 3, civsHit: 0 };
  const TOWER_ONLY = ['topHero', 'furnitureGuide', 'liftGuardian', 'sofaMaster'] as const;

  it('入れる場所:最上階のヒーローは完全無欠のすぐあと、空飛ぶ家具の見送り係は宇宙人の案内係のすぐあと、'
    + 'エレベーターの守り神はタイムセールの守り神のすぐあと、ソファの名人はUFOハンターのすぐあと', () => {
    const ids = TITLES.map((t) => t.id);
    expect(ids.indexOf('topHero')).toBe(ids.indexOf('flawless') + 1);
    expect(ids.indexOf('furnitureGuide')).toBe(ids.indexOf('ufoGuide') + 1);
    expect(ids.indexOf('liftGuardian')).toBe(ids.indexOf('saleGuardian') + 1);
    expect(ids.indexOf('sofaMaster')).toBe(ids.indexOf('ufoHunter') + 1);
    expect(titleById('topHero')).toMatchObject({ name: '最上階のヒーロー', pose: 'win_pose', hint: '最後のボスを倒す' });
    expect(titleById('furnitureGuide')).toMatchObject({ name: '空飛ぶ家具の見送り係', pose: 'win_shy', hint: '念力で市民が2人けがをする' });
    expect(titleById('liftGuardian')).toMatchObject({ name: 'エレベーターの守り神', pose: 'win_pose', hint: 'エレベーターで1人も間違えない' });
    expect(titleById('sofaMaster')).toMatchObject({ name: 'ソファの名人', pose: 'win_arms', hint: 'ソファの上に2回落とす' });
    for (const id of TOWER_ONLY) {
      expect(titleById(id).stages).toEqual(['tower']);
      expect(titleById(id).modes).toEqual(['stage']);
    }
  });

  it('ステージごとに取れる数:高層ビルは15(どこでも取れる11と4つ)。ほかのステージとフリープレイでは4つは取れない', () => {
    expect(titlesFor('tower')).toHaveLength(15);
    const ids = titlesFor('tower').map((t) => t.id);
    for (const id of TOWER_ONLY) expect(ids).toContain(id);
    for (const id of ['grannyFoe', 'roundUp', 'gangDriver', 'ufoGuide', 'saleGuardian', 'ufoHunter'] as const) expect(ids).not.toContain(id);
    for (const id of TOWER_ONLY) {
      for (const st of ['alley', 'garage', 'mall'] as const) expect(titlesFor(st).map((t) => t.id)).not.toContain(id);
      expect(titlesForFree().map((t) => t.id)).not.toContain(id);
    }
  });

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

  it('やさしすぎるヒーローの見のがした数に、念力のあとに逃げたヴィランは入れない', () => {
    const s = tower({ civHurt: 0, civHurtByHero: 0, escaped: 4, escapedByPsy: 2 });
    expect(decideTitle(s).id).toBe('soSo');
    expect(decideTitle({ ...s, escaped: 5 }).id).toBe('tooKind');
  });

  it('エレベーターの守り神:市民を全員守り、ヴィランを全員倒した。タイムセールラッシュの数では取れない', () => {
    expect(decideTitle(tower({ lift: perfectLift })).id).toBe('liftGuardian');
    expect(decideTitle(tower({ lift: { ...perfectLift, civsSaved: 2, civsHit: 1 } })).id).toBe('soSo');
    expect(decideTitle(tower({ lift: { ...perfectLift, aliensDefeated: 2, aliensSpared: 1 } })).id).toBe('soSo');
    expect(decideTitle(tower({ lift: null })).id).toBe('soSo');
    expect(decideTitle(tower({ rush: perfectLift })).id).not.toBe('liftGuardian');
    // 街のほんものヒーローより後、連打の申し子より先
    expect(decideTitle(tower({ lift: perfectLift, bossFightSec: 5 })).id).toBe('liftGuardian');
    const real = tower({ lift: perfectLift, allDefeated: true, civHurt: 0, civHurtByHero: 0, damage: 16_000_000 });
    expect(decideTitle(real).id).toBe('realHero');
  });

  it('ソファの名人:2回以上ソファの上で落とした。待ての達人より後、追い打ちの鬼より先', () => {
    const s = tower({ sofaSaves: 2, defeatedByPsy: 3, defeatedByGo: 3 });
    expect(decideTitle(s).id).toBe('sofaMaster');
    expect(decideTitle({ ...s, sofaSaves: 1 }).id).toBe('chaseDemon');
    expect(decideTitle({ ...s, civSavedByStop: 3 }).id).toBe('stopMaster');
  });

  it('ひとことは高層ビルの文(STAGE4_TEXT「称号のひとこと」)', () => {
    expect(titleCommentFor('topHero', 'tower').text).toBe('全部のステージ、\nクリアだよ！');
    expect(titleCommentFor('furnitureGuide', 'tower').text).toBe('家具が飛ぶのを\n見てたよね');
    expect(titleCommentFor('liftGuardian', 'tower').text).toBe('満員のエレベーターで\n一人も間違えなかった！');
    expect(titleCommentFor('sofaMaster', 'tower').text).toBe('ソファの上に\nぴったり落とした！');
  });
});
