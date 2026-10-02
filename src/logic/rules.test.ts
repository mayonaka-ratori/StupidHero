import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  ATTACKS, ATTACK_KINDS, BOSS_NO_ATTACKS, canStop, civHitChanceAt, isAttacked, pickAttack, propBreakChanceAt, resolveEncounter, rollPropsBroken
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

  it('技の選ばれる割合は合わせて100で、必殺技は5%のまま', () => {
    expect(ATTACK_KINDS.reduce((s, k) => s + ATTACKS[k].weight, 0)).toBe(100);
    expect(ATTACKS.special.weight).toBe(5);
    const rng = createRng(7);
    const seen = new Set(Array.from({ length: 400 }, () => pickAttack(rng)));
    expect([...seen].sort()).toEqual([...ATTACK_KINDS].sort());
  });

  it('ボスが正体を現す場面では投げを選ばない', () => {
    const rng = createRng(11);
    const seen = new Set(Array.from({ length: 400 }, () => pickAttack(rng, BOSS_NO_ATTACKS)));
    expect(seen.has('throw')).toBe(false);
    expect(seen.size).toBe(ATTACK_KINDS.length - 1);
  });

  it('アッパーは市民に当たらず、上の壁の物は必ず壊す。投げとヒップアタックと飛び蹴りは壁の物を壊さない', () => {
    for (let dx = -30; dx <= 30; dx += 5) expect(civHitChanceAt('uppercut', dx)).toBe(0);
    expect(propBreakChanceAt('uppercut', 'window', 10)).toBe(1);
    expect(propBreakChanceAt('uppercut', 'sign', -10)).toBe(1);
    expect(propBreakChanceAt('uppercut', 'extinguisher', 0)).toBe(1);
    // 壁の物(窓、看板、地下駐車場の消火器の箱)は、壊れる確率の表にかかわらず数えない
    const wallProps = [
      { kind: 'window' as const, x: 60, wall: true }, { kind: 'sign' as const, x: 80, wall: true },
      { kind: 'extinguisher' as const, x: 90, wall: true }, { kind: 'extinguisher' as const, x: 150, wall: true },
      { kind: 'extinguisher' as const, x: 170, wall: true }
    ];
    const rng = createRng(5);
    for (const k of ['flykick', 'throw', 'hip'] as const) {
      expect(ATTACKS[k].groundOnly, k).toBe(true);
      for (let i = 0; i < 30; i++) expect(rollPropsBroken(k, wallProps, 100, rng), k).toEqual([]);
    }
    // 飛び蹴りは、いちばん近いのが壁の物でも、その先の地面の物に当たる
    const mixed = [{ kind: 'window' as const, x: 110, wall: true }, { kind: 'trash' as const, x: 140, wall: false }];
    expect(rollPropsBroken('flykick', mixed, 100, rng).map((p) => p.kind)).toEqual(['trash']);
  });

  it('投げは落ちる先、ヒップアタックはしりもちをつく後ろ、飛び蹴りは前に当たる', () => {
    expect(civHitChanceAt('throw', 20)).toBe(0);
    expect(civHitChanceAt('throw', 72)).toBe(ATTACKS.throw.civHitChance);
    expect(civHitChanceAt('hip', 20)).toBe(0);
    expect(civHitChanceAt('hip', -30)).toBe(ATTACKS.hip.civHitChance);
    expect(civHitChanceAt('flykick', -10)).toBe(0);
    expect(civHitChanceAt('flykick', 50)).toBe(ATTACKS.flykick.civHitChance);
    expect(civHitChanceAt('flykick', 90)).toBe(0);
    // 飛び蹴りは、すべっていく相手が最初の物に当たって止まる
    const props = [{ kind: 'cone' as const, x: 160 }, { kind: 'trash' as const, x: 130 }];
    const rng = createRng(3);
    for (let i = 0; i < 30; i++) {
      const broken = rollPropsBroken('flykick', props, 100, rng);
      expect(broken.map((p) => p.kind)).toEqual(['trash']);
    }
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
