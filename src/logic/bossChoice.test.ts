// ステージ4のボス戦の「念力の選択」(bossChoice.ts)と、高層ビルのボス戦の設定(STAGES.tower.bossFight)
import { describe, expect, it } from 'vitest';
import { BossFight } from './boss';
import { CHOICE_GUARD_SEC, PsyChoice, applyChoice } from './bossChoice';
import { BOSS, BOSS4, PROP_COST } from './rules';
import { STAGES } from './stages';
import { StatsTracker } from './stats';

describe('PsyChoice(念力の選択)', () => {
  it('3秒の間に待てと行けを1回ずつ押せば、その場で終わって両方助かる(順番は自由)', () => {
    for (const order of [['stop', 'go'], ['go', 'stop']] as const) {
      const c = new PsyChoice();
      expect(c.limitSec).toBe(BOSS4.choiceSec);
      c.update(500);
      expect(c.press(order[0])).toBe(true);
      expect(c.done).toBe(false);
      c.update(400);
      expect(c.press(order[1])).toBe(true);
      expect(c.done).toBe(true);
      expect(c.outcome).toEqual({ guestSaved: true, chandelierSaved: true });
      // 終わったあとの時計と押しは何もしない
      expect(c.update(5000).ended).toBe(false);
      expect(c.press('stop')).toBe(false);
    }
  });

  it('同じボタンの2回目は数えない(連打しても片方だけでは終わらない)', () => {
    const c = new PsyChoice();
    c.update(400);
    expect(c.press('go')).toBe(true);
    for (let i = 0; i < 10; i++) expect(c.press('go')).toBe(false);
    expect(c.done).toBe(false);
    expect(c.pressed('go')).toBe(true);
    expect(c.pressed('stop')).toBe(false);
  });

  it('ボタンが出た直後は押しを数えない(連打の指がそのまま当たらないように)', () => {
    const c = new PsyChoice();
    expect(c.press('stop')).toBe(false);
    c.update(CHOICE_GUARD_SEC * 1000 - 50);
    expect(c.press('go')).toBe(false);
    c.update(60);
    expect(c.press('go')).toBe(true);
  });

  it('3秒たつと終わる。押さなかった分は助からない', () => {
    const c = new PsyChoice();
    c.update(1000);
    c.press('stop');
    expect(c.update(1500).ended).toBe(false);
    expect(c.leftRatio).toBeCloseTo(0.5 / 3);
    const r = c.update(600);
    expect(r.ended).toBe(true);
    expect(c.done).toBe(true);
    expect(c.leftRatio).toBe(0);
    expect(c.outcome).toEqual({ guestSaved: true, chandelierSaved: false });
    // 何も押さなければ両方落ちる
    const none = new PsyChoice();
    for (let i = 0; i < 40; i++) none.update(100);
    expect(none.outcome).toEqual({ guestSaved: false, chandelierSaved: false });
  });

  it('applyChoice:客が落ちたら市民のけが(ワルにやられた)、シャンデリアが落ちたら被害額に¥3,000万', () => {
    const s = new StatsTracker(9, 'tower');
    expect(applyChoice(s, { guestSaved: true, chandelierSaved: true }, 'chef')).toBe(0);
    expect([s.civHurt, s.damage]).toEqual([0, 0]);
    expect(applyChoice(s, { guestSaved: false, chandelierSaved: false }, 'chef')).toBe(BOSS4.chandelierCost);
    const snap = s.snapshot();
    expect([snap.civHurt, snap.civHurtByVillain, snap.civHurtByHero]).toEqual([1, 1, 0]);
    expect(snap.damage).toBe(PROP_COST.chandelier);
    expect(snap.propsBroken.chandelier).toBe(1);
  });
});

describe('高層ビルのボス戦(STAGES.tower.bossFight)', () => {
  const opts = STAGES.tower.bossFight;

  it('体力が半分を切ったときに1回だけ知らせる(念力の選択)。手が止まったときの被害額はずっと¥50万', () => {
    expect(opts).toEqual({ carAtHpRatio: BOSS4.choiceAtHpRatio, carMinSec: BOSS4.afterChoiceMinSec });
    const f = new BossFight({ ...opts, maxSec: Infinity });
    let fired = 0;
    for (let i = 0; i < 30; i++) {
      if (f.tap().boardedCar) fired++;
      f.update(150);
    }
    expect(fired).toBe(1);
    // 押さずに2秒:¥50万が2回
    const r = f.update(2600);
    expect(r.damageYen).toBe(2 * BOSS.idleCostPerSec);
  });

  it('選択の間は時計を止める(update を呼ばない)。戻ってからどんなに連打しても、倒れるまで最短1.5秒', () => {
    const f = new BossFight(opts);
    let at: number | null = null;
    for (let i = 0; i < 40 && at === null; i++) {
      if (f.tap().boardedCar) at = f.elapsedSec;
      else f.update(100);
    }
    expect(at).not.toBeNull();
    // 選択の3秒の間は、画面が時計を進めない。戻ったら1秒に10回の連打
    let ms = 0;
    while (!f.isOver && ms < 20_000) {
      f.tap();
      f.update(100);
      ms += 100;
    }
    expect(f.isOver).toBe(true);
    expect(f.seconds! - at!).toBeGreaterThanOrEqual(BOSS4.afterChoiceMinSec - 1e-9);
    expect(f.seconds! - at!).toBeLessThan(BOSS4.afterChoiceMinSec + 0.6);
  });

  it('押さなくても15秒で倒せる(選択で止めた時間は数えない)', () => {
    const f = new BossFight(opts);
    let ms = 0;
    while (!f.isOver && ms < 30_000) { f.update(16); ms += 16; }
    expect(f.seconds!).toBeCloseTo(15, 5);
    expect(f.inCar).toBe(true);
    expect(f.damageYen).toBe(14 * BOSS.idleCostPerSec);
  });
});
