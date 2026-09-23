import { describe, expect, it } from 'vitest';
import { StatsTracker, isGroup, sceneForCivHit, sceneForProp, sortIsCorrect, tallySorts } from './stats';

describe('StatsTracker', () => {
  it('撃破は仕分け、行け、ボスの合計', () => {
    const s = new StatsTracker(4);
    s.defeatBad('sort');
    s.defeatBad('sort');
    s.defeatBad('go');
    expect(s.snapshot().allDefeated).toBe(false);
    s.defeatBoss(6.5);
    const r = s.snapshot();
    expect(r.defeated).toBe(4);
    expect(r.defeatedBySort).toBe(2);
    expect(r.defeatedByGo).toBe(1);
    expect(r.bossDefeated).toBe(true);
    expect(r.bossFightSec).toBe(6.5);
    expect(r.allDefeated).toBe(true);
  });

  it('市民負傷は殴った、巻きぞえ、ワルに襲われたの合計。おばあさんはヒーローの攻撃だけ', () => {
    const s = new StatsTracker(8);
    s.hurtCiv('hero', 'suit');
    s.hurtCiv('villain', 'granny');
    expect(s.snapshot().grannyHit).toBe(false);
    s.hurtCiv('collateral', 'granny');
    expect(s.heroMistakes).toBe(2);
    const r = s.snapshot();
    expect(r.civHurt).toBe(3);
    expect([r.civHurtByHero, r.civHurtByCollateral, r.civHurtByVillain]).toEqual([1, 1, 1]);
    expect(r.grannyHit).toBe(true);
  });

  it('被害額は物、悪さ、ボスの合計', () => {
    const s = new StatsTracker(8);
    expect(s.breakProp('car')).toBe(3_000_000);
    s.breakProp('trash');
    expect(s.mischief('suit')).toBe(200_000); // ひったくりは市民負傷に数える
    s.mischief('shopper'); // 財布を抜くのは数えない
    expect(s.bossRampage()).toBe(10_000_000);
    s.addBossDamage(1_500_000);
    const r = s.snapshot();
    expect(r.damage).toBe(3_000_000 + 30_000 + 400_000 + 10_000_000 + 1_500_000);
    expect(r.damageByProps).toBe(3_030_000);
    expect(r.damageByMischief).toBe(400_000);
    expect(r.damageByBoss).toBe(11_500_000);
    expect(r.propsBroken.car).toBe(1);
    expect(r.civHurtByVillain).toBe(1);
    expect(r.bossSortedCiv).toBe(true);
  });

  it('逃がした数と待て', () => {
    const s = new StatsTracker(8);
    s.escaped();
    s.stopped('civ');
    s.stopped('civ');
    s.stopped('bad');
    const r = s.snapshot();
    expect(r.escaped).toBe(2); // 待てで止めた本物のワルも逃がしたに数える
    expect(r.civSavedByStop).toBe(2);
    expect(r.badSparedByStop).toBe(1);
  });

  it('いちばんひどかった場面は、ひどくなったときだけ true', () => {
    const s = new StatsTracker(8);
    expect(s.reportScene('bossDefeated')).toBe(true);
    expect(s.reportScene('bigPropBroken')).toBe(true);
    expect(s.reportScene('bigPropBroken')).toBe(false);
    expect(s.reportScene('civHit')).toBe(true);
    expect(s.reportScene('bossDefeated')).toBe(false);
    expect(s.reportScene('grannyHit')).toBe(true);
    expect(s.reportScene('specialOnCiv')).toBe(false);
    expect(s.snapshot().worstScene).toBe('grannyHit');
    expect(s.snapshot().worstAttack).toBeNull();
    expect(new StatsTracker(1).snapshot().worstScene).toBeNull();
  });

  it('いちばんひどかった場面の技も覚える(段階はそのまま)', () => {
    const s = new StatsTracker(8);
    expect(s.reportScene('civHit', 'punch')).toBe(true);
    expect(s.reportScene('grannyHit', 'special')).toBe(true);
    expect(s.reportScene('specialOnCiv', 'special')).toBe(false);
    const r = s.snapshot();
    expect(r.worstScene).toBe('grannyHit');
    expect(r.worstAttack).toBe('special');
  });

  it('場面の種類の決め方', () => {
    expect(sceneForCivHit('granny', 'special')).toBe('grannyHit');
    expect(sceneForCivHit('suit', 'special')).toBe('specialOnCiv');
    expect(sceneForCivHit('suit', 'punch')).toBe('civHit');
    expect(sceneForProp('vending')).toBe('bigPropBroken');
    expect(sceneForProp('window')).toBeNull();
  });

  it('snapshot はあとで変わらない', () => {
    const s = new StatsTracker(2);
    const a = s.snapshot();
    s.breakProp('car');
    expect(a.damage).toBe(0);
    expect(a.propsBroken.car).toBe(0);
  });
});

describe('StatsTracker(ステージ2)', () => {
  it('まとめて吹き飛ばした人数、車ごと止めた人数も撃破に入る。ワゴンは¥500万', () => {
    const s = new StatsTracker(9, 'garage');
    s.defeatBad('sort');
    s.groupWiped(3);
    s.groupWiped(2);
    expect(s.vanStopped(2)).toBe(5_000_000);
    const r = s.snapshot();
    expect(r.stageId).toBe('garage');
    expect(r.defeated).toBe(8);
    expect(r.defeatedByWipe).toBe(5);
    expect(r.defeatedByVan).toBe(2);
    expect(r.groupsWiped).toBe(2);
    expect(r.vansStopped).toBe(1);
    expect(r.damage).toBe(5_000_000);
    expect(r.propsBroken.van).toBe(1);
    expect(r.civHurt).toBe(0);
    expect(sceneForProp('van')).toBe('bigPropBroken');
    expect(sceneForProp('cone')).toBeNull();
  });

  it('車で逃げた組の人数は逃がした数に入る', () => {
    const s = new StatsTracker(9, 'garage');
    s.groupEscaped(3);
    s.escaped();
    s.groupEscaped(2);
    const r = s.snapshot();
    expect(r.escaped).toBe(6);
    expect(r.escapedByVan).toBe(5);
    expect(r.groupsEscaped).toBe(2);
    expect(r.civHurt).toBe(0);
  });

  it('1人だけの組は、人数は数えるが組の数(一網打尽、ギャングの運転手)には入れない', () => {
    const s = new StatsTracker(9, 'garage');
    s.groupWiped(1);
    s.groupWiped(2);
    s.groupEscaped(1);
    s.groupEscaped(3);
    s.vanStopped(1);
    const r = s.snapshot();
    expect(r.groupsWiped).toBe(1);
    expect(r.groupsEscaped).toBe(1);
    expect(r.defeatedByWipe).toBe(3);
    expect(r.defeatedByVan).toBe(1);
    expect(r.escaped).toBe(4);
    expect(r.escapedByVan).toBe(4);
    expect(isGroup(1)).toBe(false);
    expect(isGroup(2)).toBe(true);
    // 1人の組を3回吹き飛ばしても、逃げられても、称号の組の数は0のまま
    const t = new StatsTracker(9, 'garage');
    for (let i = 0; i < 3; i++) {
      t.groupWiped(1);
      t.groupEscaped(1);
    }
    expect(t.snapshot().groupsWiped).toBe(0);
    expect(t.snapshot().groupsEscaped).toBe(0);
  });

  it('1人だけのときの画面の流れ(行けで追い打ち、逃げたら escaped)は、ステージ1と同じ数え方', () => {
    const s = new StatsTracker(9, 'garage');
    s.defeatBad('go');
    s.escaped();
    const r = s.snapshot();
    expect(r.defeatedByGo).toBe(1);
    expect(r.escaped).toBe(1);
    expect(r.groupsWiped + r.groupsEscaped).toBe(0);
  });

  it('ギャングの口笛は悪さではない(被害額も市民負傷も増えない)', () => {
    const s = new StatsTracker(9, 'garage');
    expect(s.mischief('guard')).toBe(0);
    expect(s.snapshot().damage).toBe(0);
    expect(s.snapshot().civHurt).toBe(0);
  });

  it('ボスを市民に仕分けたときの額はステージごと', () => {
    expect(new StatsTracker(9).bossRampage()).toBe(10_000_000);
    expect(new StatsTracker(9, 'alley').bossRampage()).toBe(10_000_000);
    expect(new StatsTracker(9, 'garage').bossRampage()).toBe(15_000_000);
  });

  it('路地裏では増えた項目はずっと0', () => {
    const r = new StatsTracker(8).snapshot();
    expect(r.stageId).toBe('alley');
    expect([r.defeatedByWipe, r.defeatedByVan, r.groupsWiped, r.groupsEscaped, r.escapedByVan, r.vansStopped]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('仕分けの答え合わせ', () => {
  const people = [
    { id: 'a', wave: 2 as const, truth: 'bad' as const },
    { id: 'b', wave: 2 as const, truth: 'civ' as const },
    { id: 'c', wave: 2 as const, truth: 'boss' as const },
    { id: 'd', wave: 2 as const, truth: 'civ' as const },
    { id: 'e', wave: 2 as const, truth: 'bad' as const }
  ];

  it('ボスはワルに仕分ければ当たり。仕分けていない人ははずれ', () => {
    expect(sortIsCorrect('boss', 'bad')).toBe(true);
    expect(sortIsCorrect('boss', 'civ')).toBe(false);
    expect(sortIsCorrect('civ', 'civ')).toBe(true);
    expect(sortIsCorrect('bad', undefined)).toBe(false);
  });

  it('時間切れでヒーローが決めた人は、自分の仕分けとは別に数える', () => {
    const t = tallySorts(people, { a: 'bad', b: 'bad', c: 'bad', d: 'civ', e: 'bad' }, ['d', 'e']);
    expect(t).toEqual({ wave: 2, correct: 2, total: 3, byHero: 2, byHeroCorrect: 2 });
  });

  it('波ごとに残し、合計を snapshot に出す。同じ波は置きかえる', () => {
    const s = new StatsTracker(9);
    expect(s.snapshot()).toMatchObject({ sortCorrect: 0, sortTotal: 0, sortByHero: 0, sortByHeroCorrect: 0, sortWaves: [] });
    s.recordSorts({ wave: 2, correct: 3, total: 4, byHero: 1, byHeroCorrect: 0 });
    s.recordSorts({ wave: 1, correct: 5, total: 5, byHero: 0, byHeroCorrect: 0 });
    s.recordSorts({ wave: 2, correct: 4, total: 4, byHero: 1, byHeroCorrect: 1 });
    expect(s.hasSorts(2)).toBe(true);
    expect(s.hasSorts(3)).toBe(false);
    const r = s.snapshot();
    expect([r.sortCorrect, r.sortTotal, r.sortByHero, r.sortByHeroCorrect]).toEqual([9, 9, 1, 1]);
    expect(r.sortWaves.map((w) => w.wave)).toEqual([1, 2]);
  });
});
