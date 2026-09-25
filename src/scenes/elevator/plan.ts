// エレベーターラッシュ(Elevator.ts)の、画面に頼らない部品。立つ位置、1人ずつの時間の並び、階の数字、扉の開き。
// 決まりは docs/STAGE4.md「エレベーターラッシュ」。座標は bg_lift(216×214)の上のドット。y は足の位置。
//
// 時間の並び(1人ぶん。liftTiming(slow) の数字):
//   [閉じる 0.5秒:扉が閉まる(0.2秒)→ 階の数字が進む] → [扉が開く 0.3秒] → [乗ってきて止まる 0.5秒]
//   → [待てのマーク 1秒] → [殴る、または待てで奥へ 0.6秒]
// 1人目の「閉じる」は、扉が閉まったまま35階から上がる。6人で 2.9秒 × 6 = 17.4秒。
// 待てを早く押しても、次の人の時刻は変えない(全体の長さはいつも同じ)。

import { LIFT, type LiftTiming } from '../../logic';
import { LIFT_LAYOUT } from '../../art/world4/backgrounds';

/** 立つ位置 */
export const LIFT_SPOT = {
  /** ヒーロー(まん中より少し左。扉の方を向いて構える) */
  hero: { x: 100, y: 196 },
  /** 殴るときにヒーローが踏みこむ所(止まった人の何ドット手前か) */
  punchGap: 30,
  /** 扉の口の足もと(乗ってくる人が出てくる所。扉の口のまん中) */
  door: { x: LIFT_LAYOUT.door.x + LIFT_LAYOUT.door.w / 2, y: LIFT_LAYOUT.floorY + 2 },
  /** 乗ってきた人が止まる所(扉の内側) */
  stop: { x: 160, y: 190 },
  /** 奥の1列目(左から詰める) */
  back: { x: 16, y: 186, dx: 24, perRow: 3, rowDx: 12, rowDy: -10 }
} as const;

/** 奥に立つ n 人目(0始まり)の位置。左から詰め、4人目からは2列目(少し後ろで、横に半分ずらす) */
export function liftSlot(n: number): { x: number; y: number } {
  const b = LIFT_SPOT.back;
  const row = Math.floor(n / b.perRow);
  const col = n % b.perRow;
  return { x: b.x + (row % 2) * b.rowDx + col * b.dx, y: b.y + row * b.rowDy };
}

/** 閉じる時間のうち、扉が動いている長さ(残りで階の数字が進む) */
export const DOOR_MOVE_SEC = 0.2;

/** 1人ぶんの時刻(ラッシュの時計の秒) */
export interface LiftBeat {
  index: number;
  /** 前に止まった階(1人目は35) */
  fromFloor: number;
  /** 扉が開く階 */
  floor: number;
  /** この人の番の始まり(扉が閉まり始める) */
  start: number;
  /** 階の数字が進み始める(扉が閉まりきった) */
  travelAt: number;
  /** 扉が開き始める(チン) */
  openAt: number;
  /** 乗ってき始める(扉が開ききった) */
  stepInAt: number;
  /** 待てのマークが出る(扉の内側で止まった) */
  markAt: number;
  /** 待てを押していなければ殴る */
  punchAt: number;
  /** この人の番の終わり(次の人の start) */
  endAt: number;
}

export interface LiftSchedule {
  beats: LiftBeat[];
  /** 最後の人の番が終わる時刻(6人で約17秒) */
  totalSec: number;
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** floors(扉が開く階の並び)と、1人ぶんの時間から、全員の時刻を決める */
export function liftSchedule(floors: readonly number[], t: LiftTiming): LiftSchedule {
  let prev: number = LIFT.fromFloor;
  const beats = floors.map((floor, index): LiftBeat => {
    const start = r3(index * t.cycleSec);
    const travelAt = r3(start + DOOR_MOVE_SEC);
    const openAt = r3(start + t.closeSec);
    const stepInAt = r3(openAt + t.doorSec);
    const markAt = r3(stepInAt + t.stepInSec);
    const punchAt = r3(markAt + t.markSec);
    const endAt = r3(punchAt + t.actSec);
    const b = { index, fromFloor: prev, floor, start, travelAt, openAt, stepInAt, markAt, punchAt, endAt };
    prev = floor;
    return b;
  });
  return { beats, totalSec: beats.length ? beats[beats.length - 1].endAt : 0 };
}

/** その時刻の番(始まる前は最初、終わったあとは最後) */
function beatAt(beats: readonly LiftBeat[], sec: number): LiftBeat | null {
  if (beats.length === 0) return null;
  for (const b of beats) if (sec < b.endAt) return b;
  return beats[beats.length - 1];
}

/** 右上に出す階の数字。扉が閉まりきってから開くまでの間に、前の階から次の階へ1つずつ進む */
export function liftFloorAt(beats: readonly LiftBeat[], sec: number): number {
  const b = beatAt(beats, sec);
  if (!b) return LIFT.fromFloor;
  if (sec < b.travelAt) return b.fromFloor;
  if (sec >= b.openAt) return b.floor;
  const p = (sec - b.travelAt) / (b.openAt - b.travelAt);
  return Math.min(b.floor, b.fromFloor + Math.floor(p * (b.floor - b.fromFloor + 1)));
}

/** 階の数字が進んでいる間(夜景を速く流す) */
export function liftMoving(beats: readonly LiftBeat[], sec: number): boolean {
  const b = beatAt(beats, sec);
  return b !== null && sec >= b.travelAt && sec < b.openAt;
}

/** 扉の開き(0で閉まっている、1で開いている)。1人目の前は閉まったまま。最後の人のあとは開いたまま */
export function liftDoorOpen(beats: readonly LiftBeat[], sec: number): number {
  const b = beatAt(beats, sec);
  if (!b || sec < 0) return 0;
  if (sec >= b.endAt) return 1;
  if (sec < b.travelAt) return b.index === 0 ? 0 : 1 - (sec - b.start) / DOOR_MOVE_SEC;
  if (sec < b.openAt) return 0;
  if (sec < b.stepInAt) return (sec - b.openAt) / (b.stepInAt - b.openAt);
  return 1;
}

/** 1人の今の段階。wait:まだ / door:扉が開いている途中 / step:乗ってくる / mark:マーク / act:殴るか奥へ / done:済んだ */
export type LiftPhase = 'wait' | 'door' | 'step' | 'mark' | 'act' | 'done';

export function liftPhase(b: LiftBeat, sec: number): LiftPhase {
  if (sec < b.openAt) return 'wait';
  if (sec < b.stepInAt) return 'door';
  if (sec < b.markAt) return 'step';
  if (sec < b.punchAt) return 'mark';
  if (sec < b.endAt) return 'act';
  return 'done';
}

/** ボタンの板の、(x, y) にいちばん近いボタンの番号(上から0) */
export function nearestButton(x: number, y: number, buttons: readonly { x: number; y: number; w: number; h: number }[] = LIFT_LAYOUT.buttons): number {
  let best = 0;
  let bestD = Infinity;
  buttons.forEach((b, i) => {
    const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
