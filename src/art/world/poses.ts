// 共通の動き(待機、歩く、驚く、吹っ飛ぶ、のびている)の関節の位置。
import type { PixelGrid } from '../lib';
import { type Face, type Look, type Pose, clonePose, drawPerson, movePose, moveUpper } from './figure';
import { bbox, rotateGrid } from './pix';

/** 立っているときの基本の形 */
export const STAND: Pose = {
  head: [33, 18], face: 'normal',
  neck: [32, 19], hip: [32, 37],
  aB: { e: [38, 28], h: [39, 35] },
  aF: { e: [30, 28], h: [31, 35] },
  lB: { k: [35, 47], a: [36, 56] },
  lF: { k: [30, 47], a: [28, 56] }
};

export const withFace = (p: Pose, face: Face, extra: Partial<Pose> = {}): Pose => ({ ...clonePose(p), face, ...extra });

export function idleFrames(base: Pose): Pose[] {
  const b = moveUpper(base, 0, 1);
  b.aB.h[1] += 0; b.aF.h[1] += 0;
  return [clonePose(base), b];
}

/** 歩く4コマ。base の腕と脚を振る */
export function walkFrames(base: Pose, opts: { swing?: number; armSwing?: number } = {}): Pose[] {
  const s = opts.swing ?? 1, as = opts.armSwing ?? 1;
  const f0 = clonePose(base);
  const hx = base.hip[0];
  f0.lF = { k: [hx + 3 * s, 47], a: [hx + 5 * s, 56] };
  f0.lB = { k: [hx - 2 * s, 47], a: [hx - 6 * s, 54], toe: 0.6 };
  f0.aF = { e: [base.aF.e[0] - 2 * as, base.aF.e[1]], h: [base.aF.h[0] - 4 * as, base.aF.h[1] - 1], noHand: base.aF.noHand };
  f0.aB = { e: [base.aB.e[0] + 1 * as, base.aB.e[1]], h: [base.aB.h[0] + 3 * as, base.aB.h[1] - 2], noHand: base.aB.noHand };
  const f1 = movePose(base, 0, -1);
  f1.lF = { k: [hx + 1, 46], a: [hx - 1, 56] };
  f1.lB = { k: [hx + 3 * s, 45], a: [hx + 0, 53], toe: 0.3 };
  const f2 = clonePose(base);
  f2.lB = { k: [hx + 4 * s, 47], a: [hx + 6 * s, 56] };
  f2.lF = { k: [hx - 3 * s, 47], a: [hx - 6 * s, 54], toe: 0.6 };
  f2.aF = { e: [base.aF.e[0] + 1 * as, base.aF.e[1]], h: [base.aF.h[0] + 3 * as, base.aF.h[1] - 2], noHand: base.aF.noHand };
  f2.aB = { e: [base.aB.e[0] - 2 * as, base.aB.e[1]], h: [base.aB.h[0] - 3 * as, base.aB.h[1]], noHand: base.aB.noHand };
  const f3 = movePose(base, 0, -1);
  f3.lB = { k: [hx + 2, 46], a: [hx + 2, 56] };
  f3.lF = { k: [hx + 2 * s, 45], a: [hx - 2, 53], toe: 0.3 };
  return [f0, f1, f2, f3];
}

/** 驚く:のけぞって両手を上げる */
export function surprisedPose(base: Pose): Pose {
  const p = moveUpper(base, -2, 0);
  p.head = [base.head[0] - 3, base.head[1] - 1];
  p.neck = [base.neck[0] - 2, base.neck[1]];
  p.face = 'surprised';
  p.sweat = true;
  p.aF = { e: [p.neck[0] - 5, p.neck[1] + 6], h: [p.neck[0] - 3, p.neck[1] - 1] };
  p.aB = { e: [p.neck[0] + 7, p.neck[1] + 5], h: [p.neck[0] + 9, p.neck[1] - 1] };
  p.lF = { k: [base.hip[0] - 3, 47], a: [base.hip[0] - 4, 56] };
  p.lB = { k: [base.hip[0] + 4, 46], a: [base.hip[0] + 6, 54], toe: -0.3 };
  return p;
}

/** 吹っ飛ぶ1コマ目:のけぞる */
export function knockedPose0(base: Pose): Pose {
  const p = clonePose(base);
  p.face = 'hurt';
  p.head = [base.head[0] - 6, base.head[1] + 1];
  p.neck = [base.neck[0] - 5, base.neck[1] + 1];
  p.hip = [base.hip[0] - 1, base.hip[1]];
  p.aF = { e: [p.neck[0] + 2, p.neck[1] + 8], h: [p.neck[0] + 7, p.neck[1] + 10] };
  p.aB = { e: [p.neck[0] + 8, p.neck[1] + 4], h: [p.neck[0] + 13, p.neck[1] + 5] };
  p.lF = { k: [p.hip[0] + 2, 47], a: [p.hip[0] + 1, 56] };
  p.lB = { k: [p.hip[0] + 5, 46], a: [p.hip[0] + 9, 53], toe: 0.4 };
  return p;
}

/** 吹っ飛ぶ2コマ目:手足を投げ出して宙を舞う(あとで回す) */
export function knockedPose1(base: Pose): Pose {
  const p = clonePose(base);
  p.face = 'ko';
  p.aF = { e: [p.neck[0] + 4, p.neck[1] + 7], h: [p.neck[0] + 9, p.neck[1] + 12] };
  p.aB = { e: [p.neck[0] + 7, p.neck[1] + 3], h: [p.neck[0] + 13, p.neck[1] + 4] };
  p.lF = { k: [p.hip[0] + 5, 46], a: [p.hip[0] + 5, 55], toe: 0.5 };
  p.lB = { k: [p.hip[0] + 8, 44], a: [p.hip[0] + 13, 50], toe: 0.8 };
  return p;
}

/** のびている:あおむけ(あとで回す)。片ひざを立てる */
export function downPose(base: Pose): Pose {
  const p = clonePose(base);
  p.face = 'ko';
  p.aF = { e: [p.neck[0] - 3, p.neck[1] - 4], h: [p.neck[0] - 3, p.neck[1] - 11] };
  p.aB = { e: [p.neck[0] + 5, p.neck[1] + 6], h: [p.neck[0] + 6, p.neck[1] + 13] };
  p.lF = { k: [p.hip[0] + 8, 45], a: [p.hip[0] + 2, 54], toe: 0.1 };
  p.lB = { k: [p.hip[0] + 1, 47], a: [p.hip[0] + 1, 56] };
  return p;
}

/** 立ち姿を回して、宙に浮いたコマにする(体の真ん中を (32, 33) にそろえる) */
export function airborne(g: PixelGrid, angle: number): PixelGrid {
  return rotateGrid(g, angle, 32, 33, 32, 33);
}

/** あおむけに倒す:左へ90度回して、体の下側を足の裏の線(y=59)にそろえる */
export function lieDown(g: PixelGrid): PixelGrid {
  const r = rotateGrid(g, -Math.PI / 2, 32, 32, 32, 32);
  const b = bbox(r);
  if (!b) return r;
  const out = rotateGrid(g, -Math.PI / 2, 32, 32, 32 - Math.round((b.x0 + b.x1) / 2 - 32), 32 + (59 - b.y1));
  return out;
}

/** 行0〜5(市民と同じ動き)を描く。rows[2] は sortIdle */
export function civRows(look: Look, base: Pose, sortIdle: Pose[], opts: { walk?: Pose[]; lookFor?: (p: Pose, row: number) => Look } = {}): PixelGrid[][] {
  const L = (p: Pose, row: number) => (opts.lookFor ? opts.lookFor(p, row) : look);
  const draw = (p: Pose, row: number) => drawPerson(L(p, row), p);
  const idle = idleFrames(base).map((p) => draw(p, 0));
  const walk = (opts.walk ?? walkFrames(base)).map((p) => draw(p, 1));
  const sort = sortIdle.map((p) => draw(p, 2));
  const surprised = [draw(surprisedPose(base), 3)];
  const k0 = draw(knockedPose0(base), 4);
  const k1 = airborne(draw(knockedPose1(base), 4), -1.15);
  const down = [lieDown(draw(downPose(base), 5))];
  return [idle, walk, sort, surprised, [k0, k1], down];
}
