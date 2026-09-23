import { describe, expect, it } from 'vitest';
import { BossFight } from './boss';

/** 時計を細かく進める。途中で倒したら止める */
function run(f: BossFight, sec: number, stepMs = 16): number {
  let damage = 0;
  for (let t = 0; t < sec * 1000 && !f.isOver; t += stepMs) damage += f.update(stepMs).damageYen;
  return damage;
}

describe('BossFight', () => {
  it('時間で減らないなら、ちょうど40回で倒れる', () => {
    const f = new BossFight({ maxSec: Infinity });
    for (let i = 0; i < 39; i++) {
      expect(f.tap().defeated).toBe(false);
      f.update(150);
    }
    expect(f.hp).toBe(1);
    expect(f.tap()).toEqual({ counted: true, defeated: true });
    expect(f.isOver).toBe(true);
    expect(f.tap().counted).toBe(false);
  });

  it('1秒に10回を超えた分は数えない', () => {
    const f = new BossFight({ maxSec: Infinity });
    const counted = Array.from({ length: 15 }, () => f.tap().counted).filter(Boolean).length;
    expect(counted).toBe(10);
    expect(f.tapsCounted).toBe(10);
    expect(f.tapsPerSec).toBe(10);
    f.update(500);
    expect(f.tap().counted).toBe(false);
    f.update(501);
    expect(f.tap().counted).toBe(true);
  });

  it('1秒に10回の速さで押し続けても、10回/秒ぶんしか効かない', () => {
    const f = new BossFight();
    let t = 0;
    while (!f.isOver) {
      for (let i = 0; i < 3; i++) f.tap(); // 1フレームに3回(1秒に約90回)押す
      f.update(33);
      t += 33;
    }
    // 10回/秒 と 時間の減りで倒れるのは3秒台。10回/秒を超えて効いていればもっと速い
    expect(f.seconds!).toBeGreaterThan(3);
    expect(f.seconds!).toBeLessThan(4);
    expect(f.damageYen).toBe(0);
  });

  it('何もしなくても15秒ちょうどで倒れる', () => {
    const f = new BossFight();
    run(f, 20);
    expect(f.isOver).toBe(true);
    expect(f.seconds!).toBeCloseTo(15, 5);
    expect(f.hp).toBe(0);
  });

  it('大きく時間を進めても15秒を超えない', () => {
    const f = new BossFight();
    const r = f.update(60_000);
    expect(r.defeated).toBe(true);
    expect(f.seconds).toBeCloseTo(15, 5);
  });

  it('体力は時間でも少しずつ減る', () => {
    const f = new BossFight();
    f.tap();
    f.update(3000);
    expect(f.hp).toBeLessThan(39);
    expect(f.hp).toBeGreaterThan(36);
  });

  it('手が止まっている間は1秒ごとに¥50万', () => {
    const f = new BossFight();
    // 0.6秒で止まったとみなし、そこから1秒ごと。3秒たつと 2.4秒ぶん → 2回
    expect(run(f, 3)).toBe(1_000_000);
    expect(f.isIdle).toBe(true);
    // 連打すれば止まる
    f.tap();
    expect(f.isIdle).toBe(false);
    for (let i = 0; i < 5; i++) {
      f.update(300);
      expect(f.tap().counted).toBe(true);
    }
    expect(f.damageYen).toBe(1_000_000);
  });

  it('何もしないと、被害額は14回ぶん(0.6秒から15秒まで)', () => {
    const f = new BossFight();
    const r = f.update(15_000);
    expect(r.idleTicks).toBe(14);
    expect(f.damageYen).toBe(7_000_000);
  });

  it('ふつうの速さ(1秒に6回)なら5秒前後', () => {
    const f = new BossFight();
    let ms = 0;
    while (!f.isOver) {
      if (ms % 167 < 16) f.tap();
      f.update(16);
      ms += 16;
    }
    expect(f.seconds!).toBeGreaterThan(4);
    expect(f.seconds!).toBeLessThan(6.5);
  });
});
