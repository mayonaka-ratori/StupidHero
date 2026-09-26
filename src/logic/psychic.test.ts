import { describe, expect, it } from 'vitest';
import { PROP_COST } from './rules';
import { createRng } from './rng';
import { PSY_LAYOUT, PsyCall, PsyQueue, planPsychic, psyCarryX, resolvePsyDrop, type PsyPlan } from './psychic';
import { StatsTracker } from './stats';
import { STAGES, propsForWave } from './stages';
import { decideTitle } from './titles';
import type { PropKind, WaveNo } from './types';

describe('PsyCall', () => {
  it('手を出す → 浮く → 運ぶ → 落ちる → 市民に当たった、の順に進む。行けのマークは運ぶ間だけ', () => {
    const c = new PsyCall('w1-2');
    expect(c.phase).toBe('raise');
    expect(c.villainId).toBe('w1-2');
    expect(c.markOn).toBe(false);
    expect(c.update(599)).toEqual([]);
    expect(c.update(1)).toEqual(['lift']);
    expect(c.markOn).toBe(false);
    expect(c.update(800)).toEqual(['carry']);
    expect(c.markOn).toBe(true);
    expect(c.update(1500)).toEqual([]);
    expect(c.progress).toBeCloseTo(0.5);
    expect(c.update(1500)).toEqual(['fall']);
    expect(c.markOn).toBe(false);
    expect(c.update(400)).toEqual(['hit']);
    expect(c.isOver).toBe(true);
    expect(c.progress).toBe(1);
    expect(c.update(1000)).toEqual([]);
  });

  it('行けが効いたときの、運ぶ段階の進み具合を覚える(効く段階は timedCall.test.ts で確かめる)', () => {
    const c = new PsyCall('x');
    c.update(600 + 800 + 750);
    expect(c.phase).toBe('carry');
    expect(c.goProgress).toBeNull();
    expect(c.go()).toBe(true);
    expect(c.goProgress).toBeCloseTo(0.25);
  });

  it('写真は運ぶ時間が95%まで進んだら撮る(落ちている間も)', () => {
    const c = new PsyCall('x');
    c.update(1400 + 2800);
    expect(c.phase).toBe('carry');
    expect(c.photoDue).toBe(false);
    c.update(100);
    expect(c.photoDue).toBe(true);
    c.update(200);
    expect(c.phase).toBe('fall');
    expect(c.photoDue).toBe(true);
  });

  it('長さは外から変えられる(ゆっくりモードなど)', () => {
    const c = new PsyCall('x', { carrySec: 4.5 });
    expect(c.update(1400)).toEqual(['lift', 'carry']);
    expect(c.update(4400)).toEqual([]);
    expect(c.update(100)).toEqual(['fall']);
  });
});

describe('PsyQueue', () => {
  // 1回ずつ順に来ることと、行けのあとに次の番になることは timedCall.test.ts で確かめる
  it('行けで倒すと、そのヴィランの id と、押したときの運ぶ進み具合が返る', () => {
    const q = new PsyQueue();
    q.add('a');
    q.update(0);
    q.update(1_400 + 1_500);
    const hit = q.go();
    expect(hit?.villainId).toBe('a');
    expect(hit?.at).toBeCloseTo(0.5);
  });
});

describe('planPsychic(並べ方)', () => {
  const floors: WaveNo[] = [1, 2, 3, 4];

  it('持ち上げる物はヴィランのすぐ前、市民は90ドット先。間にソファがかならず1つ、もう1つは7割くらい', () => {
    let extra = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const no = floors[i % 4];
      const props = propsForWave(STAGES.tower, no);
      const plan = planPsychic(300, props, createRng(`psy-${i}`));
      expect(plan.villainX).toBe(300);
      expect(plan.victimX).toBe(390);
      expect(plan.lift.x).toBe(300 + PSY_LAYOUT.liftDx);
      // 持ち上げる物は、その階の壊れる物(ソファではない)
      expect(plan.lift.kind).not.toBe('sofa');
      expect(props).toContain(plan.lift.kind);
      expect(plan.floor.filter((p) => p.kind === 'sofa')).toHaveLength(1);
      expect(plan.floor.length === 1 || plan.floor.length === 2).toBe(true);
      // 間の物は、持ち上げた物と市民の間に、左から並ぶ
      for (const p of plan.floor) {
        expect(p.x).toBeGreaterThan(plan.lift.x);
        expect(p.x).toBeLessThan(plan.victimX);
      }
      expect([...plan.floor].sort((a, b) => a.x - b.x)).toEqual(plan.floor);
      if (plan.floor.length === 2) {
        extra++;
        const other = plan.floor.find((p) => p.kind !== 'sofa')!;
        expect(props).toContain(other.kind);
        // その階に壊れる物が2種類あるので、持ち上げた物と違う物にする
        expect(other.kind).not.toBe(plan.lift.kind);
      }
    }
    expect(extra / N).toBeGreaterThan(0.6);
    expect(extra / N).toBeLessThan(0.8);
  });

  it('ソファともう1つの順番は決めない(どちらが先の場合もある)。同じ種なら同じ並べ方', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const plan = planPsychic(200, ['sofa', 'tank', 'wine'], createRng(i));
      if (plan.floor.length === 2) firsts.add(plan.floor[0].kind === 'sofa' ? 'sofa' : 'other');
    }
    expect([...firsts].sort()).toEqual(['other', 'sofa']);
    const a = planPsychic(123, ['sofa', 'champagne', 'piano'], createRng('same'));
    const b = planPsychic(123, ['sofa', 'champagne', 'piano'], createRng('same'));
    expect(a).toEqual(b);
  });

  it('運ばれている物は、持ち上げた所から市民の上までまっすぐ進む', () => {
    const plan = planPsychic(100, ['sofa', 'plant', 'copier'], createRng(1));
    expect(psyCarryX(plan, 0)).toBe(plan.lift.x);
    expect(psyCarryX(plan, 1)).toBe(plan.victimX);
    expect(psyCarryX(plan, 0.5)).toBeCloseTo((plan.lift.x + plan.victimX) / 2);
    expect(psyCarryX(plan, 2)).toBe(plan.victimX);
  });
});

describe('resolvePsyDrop(落ちた所)', () => {
  const plan = (floor: { kind: PropKind; x: number }[], lift: PropKind = 'wine'): PsyPlan =>
    ({ villainX: 0, lift: { kind: lift, x: 8 }, floor, victimX: 90 });
  const two = plan([{ kind: 'sofa', x: 36 }, { kind: 'tank', x: 62 }]);

  it('ソファの上なら何も壊れない。ほかの物の上なら両方、床なら落ちた物だけ壊れる。市民の上なら物は壊れない', () => {
    expect(resolvePsyDrop(two, 36)).toEqual({ on: 'sofa', target: { kind: 'sofa', x: 36 }, broken: [] });
    expect(resolvePsyDrop(two, 62)).toEqual({ on: 'prop', target: { kind: 'tank', x: 62 }, broken: ['wine', 'tank'] });
    expect(resolvePsyDrop(two, 10)).toEqual({ on: 'floor', target: null, broken: ['wine'] });
    expect(resolvePsyDrop(two, 90)).toEqual({ on: 'citizen', target: null, broken: [] });
  });

  it('真下は落ちた物の真ん中から左右20ドットまで(ちょうど20は入る)', () => {
    const sofaOnly = plan([{ kind: 'sofa', x: 36 }]);
    expect(resolvePsyDrop(sofaOnly, 16).on).toBe('sofa');
    expect(resolvePsyDrop(sofaOnly, 15.9).on).toBe('floor');
    expect(resolvePsyDrop(sofaOnly, 56).on).toBe('sofa');
    expect(resolvePsyDrop(sofaOnly, 56.1).on).toBe('floor');
    expect(resolvePsyDrop(sofaOnly, 70).on).toBe('citizen');
    expect(resolvePsyDrop(sofaOnly, 69.9).on).toBe('floor');
    // 幅は外から変えられる
    expect(resolvePsyDrop(sofaOnly, 50, 10).on).toBe('floor');
  });

  it('2つ以上が真下に入るときは、真ん中がいちばん近いもの。同じ近さなら床の物が先', () => {
    expect(resolvePsyDrop(two, 48).on).toBe('sofa');
    expect(resolvePsyDrop(two, 50).on).toBe('prop');
    expect(resolvePsyDrop(two, 75).on).toBe('prop');
    expect(resolvePsyDrop(two, 77).on).toBe('citizen');
    expect(resolvePsyDrop(two, 76).on).toBe('prop');
    expect(resolvePsyDrop(plan([{ kind: 'sofa', x: 40 }, { kind: 'plant', x: 60 }]), 50).on).toBe('sofa');
  });

  it('押さなかったとき(市民の上まで運ばれた)は、かならず市民に当たる', () => {
    for (let i = 0; i < 50; i++) {
      const p = planPsychic(0, ['sofa', 'champagne', 'piano'], createRng(i));
      expect(resolvePsyDrop(p, p.victimX).on).toBe('citizen');
    }
  });

  it('ピアノは念力で落としたらかならず壊れる', () => {
    const r = resolvePsyDrop(plan([{ kind: 'sofa', x: 36 }], 'piano'), 8);
    expect(r.broken).toEqual(['piano']);
  });
});

describe('念力を通しで数える', () => {
  it('早く押すと床(落ちた物だけ)、ソファで押すと0、ほかの物の上は両方、押さないと市民がけがしてヴィランは逃げる', () => {
    const p: PsyPlan = { villainX: 0, lift: { kind: 'plant', x: 8 }, floor: [{ kind: 'sofa', x: 36 }, { kind: 'copier', x: 62 }], victimX: 90 };
    const stats = new StatsTracker(4, 'tower');
    const q = new PsyQueue();
    for (const id of ['a', 'b', 'c', 'd']) q.add(id);
    const dropAt = (carryMs: number): number => {
      q.update(0);
      q.update(1400 + carryMs);
      const hit = q.go()!;
      return stats.psyDowned(resolvePsyDrop(p, psyCarryX(p, hit.at)));
    };
    // a:すぐ押す → 床。観葉植物だけ
    expect(dropAt(50)).toBe(PROP_COST.plant);
    // b:ソファの上(x=36 は運ぶ時間の 28/82)
    expect(dropAt(Math.round((28 / 82) * 3000))).toBe(0);
    // c:コピー機の上 → 両方
    expect(dropAt(Math.round((54 / 82) * 3000))).toBe(PROP_COST.plant + PROP_COST.copier);
    // d:押さない
    const ev = q.update(100_000);
    expect(ev.map((e) => e.phase)).toEqual(['raise', 'lift', 'carry', 'fall', 'hit']);
    stats.psyEscaped();
    expect(stats.reportScene('dropped')).toBe(true);
    const s = stats.snapshot();
    expect(s.defeated).toBe(3);
    expect(s.defeatedByGo).toBe(3);
    expect(s.defeatedByPsy).toBe(3);
    expect(s.sofaSaves).toBe(1);
    expect(s.escaped).toBe(1);
    expect(s.escapedByPsy).toBe(1);
    expect(s.civHurt).toBe(1);
    expect(s.civHurtByDrop).toBe(1);
    expect(s.damage).toBe(PROP_COST.plant * 2 + PROP_COST.copier);
    expect(s.propsBroken.plant).toBe(2);
    expect(s.propsBroken.copier).toBe(1);
    expect(s.propsBroken.sofa).toBe(0);
    expect(s.worstScene).toBe('dropped');
    // 念力のあとに逃げたヴィランは、やさしすぎるヒーローの見のがした数に入れない
    expect(decideTitle({ ...s, escaped: 3, badSparedByStop: 2, civHurt: 0, civHurtByDrop: 0, defeatedByGo: 0 }).id).not.toBe('tooKind');
    expect(decideTitle({ ...s, escaped: 4, badSparedByStop: 3, civHurt: 0, civHurtByDrop: 0, defeatedByGo: 0 }).id).toBe('tooKind');
  });
});
