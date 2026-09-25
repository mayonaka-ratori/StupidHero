import { describe, expect, it } from 'vitest';
import { TITLES, decideTitle, titleById, titlesFor, titlesForFree } from './titles';
import type { StageStats } from './types';

const base = (over: Partial<StageStats> = {}): StageStats => ({
  stageId: 'alley', defeated: 5, defeatedBySort: 5, defeatedByGo: 0, bossDefeated: true,
  civHurt: 1, civHurtByHero: 1, civHurtByCollateral: 0, civHurtByVillain: 0,
  damage: 8_000_000, damageByProps: 8_000_000, damageByMischief: 0, damageByBoss: 0,
  propsBroken: {
    trash: 0, window: 0, sign: 0, vending: 0, car: 0, van: 0, bosscar: 0, pillar: 0, barrier: 0, cone: 0, extinguisher: 0,
    gacha: 0, mannequin: 0, showcase: 0, fountain: 0, escalator: 0, ufo: 0, mothership: 0,
    sofa: 0, plant: 0, flowers: 0, copier: 0, tank: 0, wine: 0, champagne: 0, piano: 0, chandelier: 0
  },
  defeatedByWipe: 0, defeatedByVan: 0, groupsWiped: 0, groupsEscaped: 0, escapedByVan: 0, vansStopped: 0,
  defeatedByUfo: 0, ufosDowned: 0, escapedByUfo: 0, civHurtByAbduction: 0, civHurtByDrop: 0, rush: null, free: null,
  escaped: 1, civSavedByStop: 0, badSparedByStop: 0,
  grannyHit: false, grannyPunched: false, bossSortedCiv: false, bossFightSec: 8,
  villainTotal: 9, allDefeated: false, worstScene: null, worstAttack: null,
  sortCorrect: 0, sortTotal: 0, sortByHero: 0, sortByHeroCorrect: 0, sortWaves: [],
  ...over
});

describe('称号', () => {
  it('20個、順番と名前とポーズがSPECとSTAGE2とSTAGE3とFREEPLAYの通り', () => {
    expect(TITLES).toHaveLength(20);
    expect(TITLES.map((t) => t.name)).toEqual([
      '完全無欠のヒーロー', '市民の天敵', '歩く解体工事', 'ボスの親友', 'ギャングの見送り係', '宇宙人の案内係', 'おばあちゃんの敵',
      '正義の暴走機関車', '街のほんものヒーロー', 'タイムセールの守り神', '連打の申し子', '待ての達人', 'UFOハンター', '一網打尽',
      '追い打ちの鬼', 'やさしすぎるヒーロー', 'まあまあヒーロー', 'ヒーローのお守り役', 'ヒーローの通訳', 'なすがまま'
    ]);
    expect(TITLES.map((t) => t.pose)).toEqual([
      'win_pose', 'win_shy', 'win_fist', 'win_shy', 'win_shy', 'win_shy', 'win_shy', 'win_arms',
      'win_pose', 'win_pose', 'win_fist', 'win_pose', 'win_fist', 'win_arms', 'win_arms', 'win_pose', 'win_arms',
      'win_pose', 'win_arms', 'win_shy'
    ]);
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(20);
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
        || titlesForFree().includes(t), t.id).toBe(true);
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
