import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  ATTACKS, ATTACK_KINDS, BOSS, MARK, PROP_COST, WAVES, canStop, civHitChanceAt, decideUnsorted, isAttacked,
  pickAttack, pickMarkTarget, propBreakChanceAt, resolveEncounter, rollPropsBroken
} from './rules';

describe('rules', () => {
  it('SPECの数字', () => {
    expect(WAVES.map((w) => [w.people, w.seconds])).toEqual([[5, 20], [5, 15], [5, 18]]);
    expect(PROP_COST).toEqual({ trash: 30000, window: 80000, sign: 150000, vending: 800000, car: 3000000 });
    expect(MARK.showDistance).toBe(48);
    expect(MARK.slowmo).toBe(0.6);
    expect(MARK.escapeSec).toBe(3);
    expect(BOSS.hpTaps).toBe(40);
    expect(BOSS.maxTapsPerSec).toBe(10);
    expect(BOSS.maxSec).toBe(15);
  });

  it('攻撃の割合は 30/35/30/5', () => {
    expect(ATTACK_KINDS.map((k) => ATTACKS[k].weight)).toEqual([30, 35, 30, 5]);
    const rng = createRng(3);
    const n: Record<string, number> = { charge: 0, punch: 0, stomp: 0, special: 0 };
    for (let i = 0; i < 20000; i++) n[pickAttack(rng)]++;
    expect(n.charge / 20000).toBeCloseTo(0.3, 1);
    expect(n.punch / 20000).toBeCloseTo(0.35, 1);
    expect(n.special / 20000).toBeGreaterThan(0.03);
    expect(n.special / 20000).toBeLessThan(0.07);
  });

  it('時間切れは半々', () => {
    const rng = createRng(5);
    let bad = 0;
    for (let i = 0; i < 10000; i++) if (decideUnsorted(rng) === 'bad') bad++;
    expect(bad / 10000).toBeCloseTo(0.5, 1);
  });

  it('巻きぞえの届く範囲', () => {
    expect(civHitChanceAt('charge', 20)).toBe(0);
    expect(civHitChanceAt('punch', 0)).toBe(0);
    expect(civHitChanceAt('punch', 100)).toBe(0.35);
    expect(civHitChanceAt('punch', -10)).toBe(0);
    expect(civHitChanceAt('stomp', -30)).toBe(0.5);
    expect(civHitChanceAt('stomp', 60)).toBe(0);
    expect(civHitChanceAt('special', 200)).toBe(0.8);
    expect(propBreakChanceAt('special', 'car', 150)).toBe(1);
    expect(propBreakChanceAt('charge', 'trash', -40)).toBe(1);
    expect(propBreakChanceAt('charge', 'trash', 40)).toBe(0);
  });

  it('光のパンチは近い物1つだけ、必殺技は全部壊す', () => {
    const props = [{ kind: 'trash' as const, x: 150 }, { kind: 'window' as const, x: 120 }, { kind: 'car' as const, x: 200 }];
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const broken = rollPropsBroken('punch', props, 100, rng);
      expect(broken.length).toBeLessThanOrEqual(1);
      if (broken.length) expect(broken[0].kind).toBe('window');
    }
    expect(rollPropsBroken('special', props, 100, rng)).toHaveLength(3);
  });

  it('仕分けと正体の組み合わせ', () => {
    expect(resolveEncounter('bad', 'bad')).toBe('hitBad');
    expect(resolveEncounter('bad', 'civ')).toBe('passBad');
    expect(resolveEncounter('civ', 'bad')).toBe('hitCiv');
    expect(resolveEncounter('civ', 'civ')).toBe('passCiv');
    expect(resolveEncounter('boss', 'bad')).toBe('bossFight');
    expect(resolveEncounter('boss', 'civ')).toBe('bossRampage');
    expect(isAttacked('bossFight')).toBe(true);
    expect(canStop('bossFight')).toBe(false);
    expect(canStop('hitCiv')).toBe(true);
    expect(isAttacked('passCiv')).toBe(false);
  });

  it('マークが2人に出ているときはヒーローに近い方', () => {
    expect(pickMarkTarget([{ x: 150, id: 'a' }, { x: 90, id: 'b' }], 60)?.id).toBe('b');
    expect(pickMarkTarget([], 60)).toBeNull();
  });
});
