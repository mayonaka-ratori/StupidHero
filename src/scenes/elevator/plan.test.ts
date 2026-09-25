// エレベーターラッシュの立つ位置と時間の並び(elevator/plan.ts)。

import { describe, expect, it } from 'vitest';
import { LIFT, createStage, liftFloor, liftRushOf, liftTiming } from '../../logic';
import { LIFT_LAYOUT } from '../../art/world4/backgrounds';
import {
  DOOR_MOVE_SEC, LIFT_SPOT, liftDoorOpen, liftFloorAt, liftMoving, liftPhase, liftSchedule, liftSlot, nearestButton
} from './plan';

const floors = Array.from({ length: LIFT.people }, (_, i) => liftFloor(i));

describe('奥に立つ位置', () => {
  it('左から詰め、4人目からは2列目(少し後ろで、横に半分ずらす)', () => {
    const s = Array.from({ length: 6 }, (_, i) => liftSlot(i));
    expect(s.slice(0, 3).map((p) => p.y)).toEqual([186, 186, 186]);
    expect(s.slice(3).map((p) => p.y)).toEqual([176, 176, 176]);
    // 左から右へ
    for (let i = 1; i < 3; i++) expect(s[i].x).toBeGreaterThan(s[i - 1].x);
    // 2列目は1列目の間に入る(前の人に隠れない)
    expect(s[3].x).toBeGreaterThan(s[0].x);
    expect(s[3].x).toBeLessThan(s[1].x);
  });

  it('奥の人は、ヒーローと乗ってきた人より奥で、ヒーローより左(次に乗ってくる人を隠さない)', () => {
    for (let i = 0; i < 6; i++) {
      const p = liftSlot(i);
      expect(p.y).toBeLessThan(LIFT_SPOT.hero.y);
      expect(p.y).toBeLessThan(LIFT_SPOT.stop.y);
      // 人の絵の横はばは24ドットくらい。ヒーローの体とは重ならない
      expect(p.x + 12).toBeLessThan(LIFT_SPOT.hero.x - 10);
      expect(p.y).toBeGreaterThan(LIFT_LAYOUT.floorY);
    }
  });

  it('ヒーローはまん中より少し左、止まる所は扉の内側', () => {
    expect(LIFT_SPOT.hero.x).toBeLessThan(108);
    expect(LIFT_SPOT.hero.x).toBeGreaterThan(80);
    expect(LIFT_SPOT.stop.x).toBeLessThan(LIFT_LAYOUT.door.x + LIFT_LAYOUT.door.w);
    expect(LIFT_SPOT.stop.x - LIFT_SPOT.punchGap).toBeGreaterThan(LIFT_SPOT.hero.x);
  });
});

describe('時間の並び', () => {
  it('6人で約17秒。1人ぶんは 閉じる0.5 + 開く0.3 + 乗る0.5 + マーク1 + 殴る0.6', () => {
    const { beats, totalSec } = liftSchedule(floors, liftTiming(false));
    expect(beats).toHaveLength(6);
    expect(totalSec).toBeCloseTo(17.4, 5);
    const b = beats[0];
    expect([b.start, b.travelAt, b.openAt, b.stepInAt, b.markAt, b.punchAt, b.endAt]).toEqual([0, DOOR_MOVE_SEC, 0.5, 0.8, 1.3, 2.3, 2.9]);
    // 次の人は前の人の番が終わってから
    for (let i = 1; i < 6; i++) expect(beats[i].start).toBeCloseTo(beats[i - 1].endAt, 5);
    // マークは一度に1人だけ
    for (let i = 1; i < 6; i++) expect(beats[i].markAt).toBeGreaterThan(beats[i - 1].punchAt);
  });

  it('ゆっくりモードでは、乗ってくる時間とマークの長さが1.5倍', () => {
    const fast = liftSchedule(floors, liftTiming(false)).beats[0];
    const slow = liftSchedule(floors, liftTiming(true)).beats[0];
    expect(slow.markAt - slow.stepInAt).toBeCloseTo((fast.markAt - fast.stepInAt) * 1.5, 5);
    expect(slow.punchAt - slow.markAt).toBeCloseTo((fast.punchAt - fast.markAt) * 1.5, 5);
    expect(slow.openAt - slow.start).toBeCloseTo(fast.openAt - fast.start, 5);
    expect(slow.endAt - slow.punchAt).toBeCloseTo(fast.endAt - fast.punchAt, 5);
  });

  it('段階は wait → door → step → mark → act → done', () => {
    const b = liftSchedule(floors, liftTiming(false)).beats[1];
    const at = (t: number): string => liftPhase(b, b.start + t);
    expect([at(0.1), at(0.6), at(1.0), at(1.5), at(2.5), at(3.0)]).toEqual(['wait', 'door', 'step', 'mark', 'act', 'done']);
  });
});

describe('階の数字と扉', () => {
  const { beats, totalSec } = liftSchedule(floors, liftTiming(false));

  it('階は35から、扉が開く階(37、39、41、44、46、48)へ1つずつ進み、戻らない', () => {
    expect(floors).toEqual([37, 39, 41, 44, 46, 48]);
    expect(liftFloorAt(beats, 0)).toBe(35);
    let prev = 35;
    for (let t = 0; t <= totalSec; t += 0.01) {
      const f = liftFloorAt(beats, t);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f - prev).toBeLessThanOrEqual(1);
      prev = f;
    }
    for (const b of beats) expect(liftFloorAt(beats, b.openAt)).toBe(b.floor);
    expect(liftFloorAt(beats, totalSec + 1)).toBe(48);
  });

  it('数字が進むのは扉が閉まっている間だけ', () => {
    for (let t = 0; t < totalSec; t += 0.01) {
      if (liftMoving(beats, t)) expect(liftDoorOpen(beats, t)).toBe(0);
    }
    expect(liftMoving(beats, beats[2].travelAt + 0.01)).toBe(true);
    expect(liftMoving(beats, beats[2].markAt)).toBe(false);
  });

  it('扉は1人目の前は閉まったまま、乗ってくる間と殴る間は開いている', () => {
    expect(liftDoorOpen(beats, 0)).toBe(0);
    expect(liftDoorOpen(beats, beats[0].openAt + 0.15)).toBeCloseTo(0.5, 5);
    for (const b of beats) {
      expect(liftDoorOpen(beats, b.stepInAt)).toBe(1);
      expect(liftDoorOpen(beats, b.punchAt + 0.5)).toBe(1);
    }
    // 2人目からは、前の人のあとに閉まる
    expect(liftDoorOpen(beats, beats[1].start + DOOR_MOVE_SEC / 2)).toBeCloseTo(0.5, 5);
    expect(liftDoorOpen(beats, totalSec + 1)).toBe(1);
  });
});

describe('ボタンの板', () => {
  it('いちばん近いボタンを1つだけ選ぶ', () => {
    const bs = LIFT_LAYOUT.buttons;
    expect(nearestButton(bs[0].x, bs[0].y)).toBe(0);
    expect(nearestButton(bs[3].x + 1, bs[3].y + 2)).toBe(3);
    // 扉の内側で止まった人(頭の横)は、板の下のほう
    expect(nearestButton(LIFT_SPOT.stop.x, LIFT_SPOT.stop.y - 50)).toBe(bs.length - 1);
  });
});

describe('ステージ4の並びと合わせる', () => {
  it('並びの扉の階は、時間の並びの階と同じ', () => {
    const plan = liftRushOf(createStage(5, 'tower'))!;
    const { beats } = liftSchedule(plan.riders.map((r) => r.floor), liftTiming(false));
    expect(beats.map((b) => b.floor)).toEqual(floors);
  });
});
