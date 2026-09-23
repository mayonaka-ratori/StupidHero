import { describe, expect, it } from 'vitest';
import { GangCall, gatherMembers } from './gang';
import { GANG, GROUP_WIPE, rollGroupWipeProps } from './rules';
import { createRng } from './rng';

describe('ギャングの組(仲間を呼ぶ、まとめて吹き飛ばす、車で逃げる)', () => {
  it('数字:車に乗るまで3秒、走り出してから消えるまで約2秒', () => {
    expect(GANG.escapeSec).toBe(3);
    expect(GANG.driveSec).toBe(2);
    expect(GANG.groupSize).toEqual({ min: 2, max: 3 });
  });

  it('集まるのは、まだ倒していない仲間(待てで止めた仲間は来ない)', () => {
    const gone = new Set(['b']);
    expect(gatherMembers(['a', 'b', 'c'], (id) => gone.has(id))).toEqual(['a', 'c']);
  });

  it('集まる → 3秒待つ → 乗りこむ → 2秒走る → 逃げきられる', () => {
    const c = new GangCall(['a', 'b', 'c']);
    expect(c.size).toBe(3);
    expect(c.phase).toBe('gather');
    expect(c.markOn).toBeNull();
    expect(c.go()).toBeNull(); // 集まる途中の行けは何も起きない
    expect(c.update(GANG.gatherSec * 1000)).toEqual(['wait']);
    expect(c.markOn).toBe('group');
    expect(c.secondsToBoard).toBeCloseTo(3);
    expect(c.update(2999)).toEqual([]);
    expect(c.update(1)).toEqual(['board']);
    expect(c.markOn).toBe('van');
    expect(c.update(GANG.boardSec * 1000)).toEqual(['drive']);
    c.update(1000);
    expect(c.progress).toBeCloseTo(0.5);
    expect(c.update(1000)).toEqual(['escaped']);
    expect(c.isOver).toBe(true);
    expect(c.go()).toBeNull();
  });

  it('大きく時間を進めても、段階を順に返す', () => {
    const c = new GangCall(['a', 'b']);
    expect(c.update(60_000)).toEqual(['wait', 'board', 'drive', 'escaped']);
  });

  it('集まったあとの行けは、まとめて吹き飛ばす', () => {
    const c = new GangCall(['a', 'b']);
    expect(c.gathered()).toBe(true);
    expect(c.gathered()).toBe(false);
    c.update(2500);
    expect(c.go()).toBe('wipe');
    expect(c.phase).toBe('wiped');
    expect(c.update(10_000)).toEqual([]);
  });

  it('乗りこむところと走っている間の行けは、車ごと止める', () => {
    const a = new GangCall(['a', 'b']);
    a.gathered();
    a.update(3100);
    expect(a.phase).toBe('board');
    expect(a.go()).toBe('vanStop');
    const b = new GangCall(['a', 'b']);
    b.gathered();
    b.update(3000 + 500 + 1900);
    expect(b.phase).toBe('drive');
    expect(b.go()).toBe('vanStop');
    expect(b.phase).toBe('stopped');
  });

  it('まとめて吹き飛ばすときは物だけ壊れる。ワゴンと高級車は壊れない', () => {
    const rng = createRng(2);
    const props = [
      { kind: 'cone' as const, x: 110 }, { kind: 'van' as const, x: 100 }, { kind: 'extinguisher' as const, x: 60 },
      { kind: 'cone' as const, x: 200 }
    ];
    const broken = rollGroupWipeProps(props, 100, rng);
    expect(broken.map((p) => p.x).sort()).toEqual([110, 60]);
    expect(GROUP_WIPE.propBreakChance.van).toBe(0);
    expect(GROUP_WIPE.propBreakChance.bosscar).toBe(0);
  });
});
