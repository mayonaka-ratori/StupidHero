import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  ATTACKS, ATTACK_KINDS, BOSS_NO_ATTACKS, canStop, civHitChanceAt, isAttacked, pickAttack, propBreakChanceAt, resolveEncounter, rollPropsBroken
} from './rules';
import type { AttackKind } from './types';

describe('rules', () => {
  it('巻きぞえの届く範囲(技ごと。投げは落ちる先、ヒップアタックはしりもちをつく後ろ、飛び蹴りは前)', () => {
    // [技, 殴る相手からの距離, 届くか]。相手自身(0)の市民は巻きぞえに数えない
    const cases: [AttackKind, number, boolean][] = [
      ['charge', 20, false], ['punch', 0, false], ['punch', 100, true], ['punch', -10, false],
      ['stomp', -30, true], ['stomp', 60, false], ['special', 200, true],
      ['throw', 20, false], ['throw', 72, true], ['hip', 20, false], ['hip', -30, true],
      ['flykick', -10, false], ['flykick', 50, true], ['flykick', 90, false]
    ];
    for (const [k, dx, hit] of cases) expect(civHitChanceAt(k, dx), `${k} ${dx}`).toBe(hit ? ATTACKS[k].civHitChance : 0);
    expect(propBreakChanceAt('special', 'car', 150)).toBe(1);
    expect(propBreakChanceAt('charge', 'trash', -40)).toBe(1);
    expect(propBreakChanceAt('charge', 'trash', 40)).toBe(0);
  });

  it('光のパンチと飛び蹴りは近い物1つだけ(飛び蹴りはすべっていく相手が最初の物に当たって止まる)、必殺技は全部壊す', () => {
    const props = [{ kind: 'trash' as const, x: 150 }, { kind: 'window' as const, x: 120 }, { kind: 'car' as const, x: 200 }];
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const broken = rollPropsBroken('punch', props, 100, rng);
      expect(broken.length).toBeLessThanOrEqual(1);
      if (broken.length) expect(broken[0].kind).toBe('window');
    }
    expect(rollPropsBroken('special', props, 100, rng)).toHaveLength(3);
    // ゴミ箱は飛び蹴りでかならず壊れるので、1回で決まる
    const ground = [{ kind: 'cone' as const, x: 160 }, { kind: 'trash' as const, x: 130 }];
    expect(rollPropsBroken('flykick', ground, 100, rng).map((p) => p.kind)).toEqual(['trash']);
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
    expect(ATTACKS.uppercut.civHitChance).toBe(0);
    for (const p of ['window', 'sign', 'extinguisher'] as const) expect(propBreakChanceAt('uppercut', p, 10), p).toBe(1);
    // 壁の物(窓、看板、地下駐車場の消火器の箱)は、壊れる確率の表にかかわらず数えない
    const wallProps = [
      { kind: 'window' as const, x: 60, wall: true }, { kind: 'sign' as const, x: 80, wall: true },
      { kind: 'extinguisher' as const, x: 90, wall: true }, { kind: 'extinguisher' as const, x: 150, wall: true },
      { kind: 'extinguisher' as const, x: 170, wall: true }
    ];
    const rng = createRng(5);
    for (const k of ['flykick', 'throw', 'hip'] as const) {
      for (let i = 0; i < 30; i++) expect(rollPropsBroken(k, wallProps, 100, rng), k).toEqual([]);
    }
    // 飛び蹴りは、いちばん近いのが壁の物でも、その先の地面の物に当たる
    const mixed = [{ kind: 'window' as const, x: 110, wall: true }, { kind: 'trash' as const, x: 140, wall: false }];
    expect(rollPropsBroken('flykick', mixed, 100, rng).map((p) => p.kind)).toEqual(['trash']);
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
