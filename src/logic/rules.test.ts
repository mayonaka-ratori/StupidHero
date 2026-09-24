import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  ATTACKS, canStop, civHitChanceAt, isAttacked, propBreakChanceAt, resolveEncounter, rollPropsBroken
} from './rules';

describe('rules', () => {
  it('巻きぞえの届く範囲', () => {
    expect(civHitChanceAt('charge', 20)).toBe(0);
    expect(civHitChanceAt('punch', 0)).toBe(0);
    expect(civHitChanceAt('punch', 100)).toBe(ATTACKS.punch.civHitChance);
    expect(civHitChanceAt('punch', -10)).toBe(0);
    expect(civHitChanceAt('stomp', -30)).toBe(ATTACKS.stomp.civHitChance);
    expect(civHitChanceAt('stomp', 60)).toBe(0);
    expect(civHitChanceAt('special', 200)).toBe(ATTACKS.special.civHitChance);
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
});
