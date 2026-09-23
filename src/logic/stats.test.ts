import { describe, expect, it } from 'vitest';
import { StatsTracker, sceneForCivHit, sceneForProp } from './stats';

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
    expect(r.escaped).toBe(1);
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
    expect(new StatsTracker(1).snapshot().worstScene).toBeNull();
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
