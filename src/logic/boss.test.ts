import { describe, expect, it } from 'vitest';
import { BossFight } from './boss';
import { STAGES } from './stages';

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
    expect(f.tap()).toEqual({ counted: true, defeated: true, boardedCar: false });
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

  it('何もしなくても15秒ちょうどで倒れ、被害額は14回ぶん(0.6秒から15秒まで)。細かく進めても一度に進めても同じ', () => {
    const f = new BossFight();
    expect(run(f, 20)).toBe(7_000_000);
    expect(f.isOver).toBe(true);
    expect(f.seconds!).toBeCloseTo(15, 5);
    expect(f.hp).toBe(0);
    // 大きく時間を進めても15秒を超えず、手が止まった回数も14回のまま
    const g = new BossFight();
    const r = g.update(60_000);
    expect(r.defeated).toBe(true);
    expect(r.idleTicks).toBe(14);
    expect(g.seconds).toBeCloseTo(15, 5);
    expect(g.damageYen).toBe(7_000_000);
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

describe('BossFight(女ボス:車に乗る)', () => {
  const opts = STAGES.garage.bossFight;

  it('ステージ1の設定では車に乗らない', () => {
    const f = new BossFight(STAGES.alley.bossFight);
    for (let i = 0; i < 30; i++) expect(f.tap().boardedCar).toBe(false);
    expect(f.inCar).toBe(false);
    expect(f.update(20_000).boardedCar).toBe(false);
  });

  it('連打で体力が半分を切った瞬間に車に乗る(1回だけ)', () => {
    const f = new BossFight({ ...opts, maxSec: Infinity });
    for (let i = 0; i < 20; i++) {
      expect(f.tap().boardedCar).toBe(false);
      f.update(150);
    }
    expect(f.hp).toBe(20); // ちょうど半分はまだ
    expect(f.inCar).toBe(false);
    const r = f.tap();
    expect(r.boardedCar).toBe(true);
    expect(f.inCar).toBe(true);
    f.update(150);
    expect(f.tap().boardedCar).toBe(false);
  });

  it('何もしなくても時間で半分を切ると乗る(15秒×√0.5 ≒ 10.6秒)', () => {
    const f = new BossFight(opts);
    let boardedAt = -1;
    for (let t = 0; t < 20_000 && !f.isOver; t += 16) {
      if (f.update(16).boardedCar) boardedAt = f.elapsedSec;
    }
    expect(boardedAt).toBeGreaterThan(10.5);
    expect(boardedAt).toBeLessThan(10.7);
    expect(f.carBoardedAt!).toBeCloseTo(15 * Math.sqrt(0.5), 5);
    expect(f.seconds!).toBeCloseTo(15, 5);
  });

  it('手が止まっている間の被害額は、車に乗る前は¥50万、乗ったあとは¥100万', () => {
    // 何もしないと、0.6秒から1秒ごと。1.6〜10.6秒の10回は乗る前、11.6〜14.6秒の4回は乗ったあと
    const f = new BossFight(opts);
    const r = f.update(15_000);
    expect(r.idleTicks).toBe(14);
    expect(r.boardedCar).toBe(true);
    expect(f.damageYen).toBe(10 * 500_000 + 4 * 1_000_000);
    // 細かく進めても同じ
    const g = new BossFight(opts);
    let sum = 0;
    for (let t = 0; t < 16_000 && !g.isOver; t += 16) sum += g.update(16).damageYen;
    expect(sum).toBe(9_000_000);
  });

  it('連打し続ければ、車に乗っても被害はゼロ', () => {
    const f = new BossFight(opts);
    while (!f.isOver) {
      f.tap();
      f.update(100);
    }
    expect(f.inCar).toBe(true);
    expect(f.damageYen).toBe(0);
  });

  it('全力で連打しても、車に乗ってから1.3秒は体力が減らず、そのあと最低1.5秒は倒れない', () => {
    const f = new BossFight(opts);
    let boardAt = -1;
    let hpAtBoard = 0;
    const holdHp: number[] = [];
    while (!f.isOver) {
      const r = f.tap();
      if (r.boardedCar) {
        boardAt = f.elapsedSec;
        hpAtBoard = f.hp;
      }
      f.update(100);
      if (boardAt >= 0 && !f.isOver && f.elapsedSec <= boardAt + 1.3 + 1e-9) holdHp.push(f.hp);
    }
    expect(boardAt).toBeGreaterThan(1.7);
    expect(boardAt).toBeLessThan(2.1);
    // 車が手前に出てくるまでは体力がそのまま
    expect(holdHp.length).toBeGreaterThan(10);
    for (const hp of holdHp) expect(hp).toBeCloseTo(hpAtBoard, 9);
    // 手前に来てから1.5秒たつまで倒れない。それでも5秒以内(連打の申し子)には入る
    expect(f.seconds!).toBeGreaterThanOrEqual(boardAt + 1.3 + 1.5 - 1e-9);
    expect(f.seconds!).toBeLessThanOrEqual(5);
  });

  it('体力の下限の線は、手前に来てから1.5秒かけてなめらかに0まで下がる', () => {
    const f = new BossFight(opts);
    let boardAt = -1;
    let prev = Infinity;
    while (!f.isOver) {
      if (f.tap().boardedCar) boardAt = f.elapsedSec;
      f.update(50);
      if (boardAt >= 0 && f.elapsedSec > boardAt + 1.3) {
        expect(f.hp).toBeLessThanOrEqual(prev + 1e-9);
        // 1回の update(0.05秒)で減るのは、線の傾き(約20÷1.5秒)の分まで
        if (prev !== Infinity) expect(prev - f.hp).toBeLessThan(1);
      }
      prev = f.hp;
    }
    expect(f.hp).toBe(0);
  });

  it('連打をやめると下限の線は関係なく、時間で減って倒れる', () => {
    const f = new BossFight(opts);
    for (let i = 0; i < 21; i++) {
      f.tap();
      f.update(100);
    }
    expect(f.inCar).toBe(true);
    f.update(20_000);
    expect(f.isOver).toBe(true);
    // 連打のあとは時間で減る分だけ(15×√(残り÷40))。下限の線(乗ってから2.8秒)よりあと
    expect(f.seconds!).toBeCloseTo(15 * Math.sqrt((40 - f.tapsCounted) / 40), 5);
    expect(f.carBoardedAt! + 2.8).toBeLessThan(f.seconds!);
  });

  it('遅く車に乗っても15秒をこえない', () => {
    const f = new BossFight({ ...opts, carAtHpRatio: 0.05 });
    for (let t = 0; t < 20_000 && !f.isOver; t += 16) {
      f.update(16);
      if (t % 200 === 0) f.tap();
    }
    expect(f.inCar).toBe(true);
    expect(f.seconds!).toBeLessThanOrEqual(15 + 1e-9);
  });
});
