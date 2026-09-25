// ヒーローのポーズの数字。行の順番は sheets.ts の hero と同じ。
// 角度は度。腕 a: 0=下 90=前 180=上 -90=後ろ、e: ひじの曲げ(前腕 = a + e)。
// 脚 a: +で前へ上げる、k: ひざの曲げ(すね = a - k)。
import type { Arm, Cape, Leg, Pose } from './rig';

/** 腰に手を当てる(手前の腕はひじを後ろへ、奥の腕はひじを前へ) */
const HIP_F: Arm = { a: -58, e: 96, hand: 'fist', fs: 0.8 };
const HIP_B: Arm = { a: 60, e: -110, hand: 'fist', fs: 0.8 };
const HANG_F: Arm = { a: -6, e: 10, hand: 'fist' };
const HANG_B: Arm = { a: 10, e: 8, hand: 'fist' };

const capeIdle = (ph: number): Cape => ({ a: -18, len: 29, ph, w: 8.5, bend: -2 });
const capeWind = (ph: number, a = -78): Cape => ({ a, len: 25, ph, w: 8.5, bend: Math.sin(ph) * 3, amp: 1.6 });

const base: Pose = {
  lean: 0,
  face: 'normal',
  af: HIP_F,
  ab: HIP_B,
  lf: { a: -12, k: 0 },
  lb: { a: 14, k: 0 },
  cape: capeIdle(0),
  tail: { a: -40, ph: 0 }
};

const P = (o: Partial<Pose>): Pose => ({ ...base, ...o });

// ---------- 0 待機:胸を張って足踏み ----------
const STAND_F: Leg = { a: -17, k: 0, f: -90 };
const STAND_B: Leg = { a: 19, k: 0 };
const idle: Pose[] = [
  P({ x: 30.5, lean: 0, lf: STAND_F, lb: STAND_B, cape: capeIdle(0), tail: { a: -40, ph: 0 } }),
  P({ x: 30.5, lean: 0, lf: { a: 8, k: 72 }, lb: { a: 15, k: 0 }, cape: capeIdle(1.6), tail: { a: -45, ph: 1.5 } }),
  P({ x: 30.5, lean: 0, lf: STAND_F, lb: STAND_B, cape: capeIdle(3.1), tail: { a: -40, ph: 3 } }),
  P({ x: 30.5, lean: 0, lf: { a: -8, k: 0, f: -90 }, lb: { a: 48, k: 80 }, cape: capeIdle(4.7), tail: { a: -45, ph: 4.5 } })
];

// ---------- 1 走る ----------
const runLegs: [number, number, number, number][] = [
  // lf.a, lf.k, lb.a, lb.k
  [42, 18, -38, 62],
  [18, 30, -6, 105],
  [-28, 30, 52, 85],
  [-38, 62, 42, 18],
  [-6, 105, 18, 30],
  [52, 85, -28, 30]
];
/** 走りの腕振り。k = 1 で前へ振る、-1 で後ろへ引く。前へ振ってもこぶしが顔にかからないようにする */
const runArm = (k: number): Arm => {
  const a = k * 62 + 5;
  return { a, e: a > 0 ? 95 - a * 0.55 : 92 };
};
const run: Pose[] = runLegs.map(([fa, fk, ba, bk], i) => {
  const s = Math.cos((i / 6) * Math.PI * 2); // 1 = 手前の脚が前
  return P({
    lean: 20,
    face: 'grin',
    af: runArm(-s),
    ab: runArm(s),
    lf: { a: fa, k: fk },
    lb: { a: ba, k: bk },
    cape: capeWind(i * 1.05),
    tail: { a: -95, ph: i * 1.05 }
  });
});

// ---------- 2 光の突撃 ----------
const dive = (ph: number, dy: number): Pose => P({
  ground: false, x: 30, y: 34 + dy, lean: 72, face: 'shout', hy: -3, hx: 0,
  af: { a: 80, e: 4, hand: 'fist' },
  ab: { a: -60, e: 20, hand: 'fist' },
  lf: { a: -58, k: 22 },
  lb: { a: -40, k: 58 },
  cape: { a: -100, len: 26, ph, w: 9, bend: Math.sin(ph) * 4, amp: 2 },
  tail: { a: -110, ph }
});
const charge: Pose[] = [
  P({ lean: 30, squash: 0.08, face: 'shout',
    af: { a: -110, e: 20 }, ab: { a: -80, e: 40 },
    lf: { a: -30, k: 50 }, lb: { a: 70, k: 110 },
    cape: capeWind(0, -40), tail: { a: -70, ph: 0 } }),
  dive(0.5, 0), dive(1.8, -1), dive(3.1, 0), dive(4.4, 1)
];

// ---------- 3 光のパンチ(右、左と2発) ----------
const punch: Pose[] = [
  P({ lean: 4, face: 'normal', af: { a: -80, e: 135 }, ab: { a: 50, e: 80 },
    lf: { a: -22, k: 5 }, lb: { a: 22, k: 12 }, cape: capeIdle(0.5), tail: { a: -50, ph: 0.5 } }),
  P({ lean: 10, face: 'shout', af: { a: 20, e: 100 }, ab: { a: 30, e: 90 },
    lf: { a: -30, k: 5 }, lb: { a: 30, k: 20 }, cape: capeWind(1, -40), tail: { a: -70, ph: 1 } }),
  P({ x: 34, lean: 7, face: 'shout', af: { a: 92, e: 0 }, ab: { a: -55, e: 110 },
    lf: { a: -38, k: 0 }, lb: { a: 38, k: 25 }, cape: capeWind(2, -60), tail: { a: -85, ph: 2 } }),
  P({ x: 33, lean: 8, face: 'shout', af: { a: 62, e: 36 }, ab: { a: -30, e: 120 },
    lf: { a: -32, k: 3 }, lb: { a: 32, k: 20 }, cape: capeWind(3, -45), tail: { a: -70, ph: 3 } }),
  P({ lean: 6, face: 'shout', af: { a: -40, e: 130 }, ab: { a: -60, e: 150 },
    lf: { a: -30, k: 3 }, lb: { a: 32, k: 18 }, cape: capeWind(4, -40), tail: { a: -60, ph: 4 } }),
  P({ x: 34, lean: 10, face: 'shout', af: { a: -55, e: 110 }, ab: { a: 92, e: 0 },
    lf: { a: -40, k: 0 }, lb: { a: 40, k: 28 }, cape: capeWind(5, -65), tail: { a: -90, ph: 5 } })
];

// ---------- 4 踏みつぶし ----------
const stomp: Pose[] = [
  P({ lean: 16, squash: 0.12, face: 'normal', af: { a: -45, e: 20 }, ab: { a: -25, e: 30 },
    lf: { a: 62, k: 105 }, lb: { a: 38, k: 100 }, cape: { a: -62, len: 20, ph: 0.3, w: 7 }, tail: { a: -60, ph: 0 } }),
  P({ ground: false, y: 32, lean: -4, face: 'grin', af: { a: -145, e: 25 }, ab: { a: 128, e: 72 },
    lf: { a: 6, k: 40, f: 60 }, lb: { a: 22, k: 55, f: 70 }, cape: { a: 10, len: 28, ph: 1, w: 8, amp: 2 }, tail: { a: -50, ph: 1 } }),
  P({ ground: false, y: 34, lean: 10, face: 'grin', af: { a: -120, e: 20 }, ab: { a: 120, e: 30 },
    lf: { a: 95, k: 150 }, lb: { a: 75, k: 140 }, cape: { a: -20, len: 26, ph: 2, w: 11, amp: 2 }, tail: { a: -10, ph: 2 } }),
  P({ ground: false, y: 34, lean: -6, face: 'shout', af: { a: -128, e: -34, hand: 'fist' }, ab: { a: 150, e: 10 },
    lf: { a: 25, k: 10, f: 100 }, lb: { a: 70, k: 130 }, cape: { a: -160, len: 14, ph: 3, w: 10, amp: 2 }, tail: { a: -60, ph: 3, len: 8 } }),
  P({ lean: 20, squash: 0.12, face: 'shout', af: { a: 50, e: 15 }, ab: { a: -70, e: 20 },
    lf: { a: 70, k: 105 }, lb: { a: -32, k: 82 }, cape: { a: -58, len: 22, ph: 4, w: 9, amp: 2 }, tail: { a: -70, ph: 4 } }),
  P({ lean: -2, face: 'grin', af: HIP_F, ab: { a: 150, e: 28, hand: 'fist' },
    lf: { a: -18, k: 0 }, lb: { a: 20, k: 5 }, cape: capeIdle(5), tail: { a: -40, ph: 5 } })
];

// ---------- 5 必殺技 ----------
// 両手を頭の上に上げて光をためる
const holdHands: Partial<Pose> = { af: { a: -158, e: -32, hand: 'open' }, ab: { a: 158, e: 32, hand: 'open' } };
const special: Pose[] = [
  P({ lean: 4, face: 'normal', af: { a: -40, e: 30, hand: 'open' }, ab: { a: 30, e: 20, hand: 'open' }, lf: { a: -26, k: 10 }, lb: { a: 30, k: 30 }, cape: capeIdle(0) }),
  P({ lean: -10, squash: 0.05, face: 'shout', ...holdHands, lf: { a: -30, k: 25 }, lb: { a: 34, k: 45 }, cape: capeWind(0.8, -30), tail: { a: -30, ph: 1 } }),
  P({ lean: -10, squash: 0.05, face: 'shout', ...holdHands, lf: { a: -30, k: 25 }, lb: { a: 34, k: 45 }, cape: capeWind(2.2, -20), tail: { a: -20, ph: 2 } }),
  P({ lean: -12, squash: 0.05, face: 'shout', ...holdHands, lf: { a: -30, k: 25 }, lb: { a: 34, k: 45 }, cape: capeWind(3.6, -10), tail: { a: -10, ph: 3 } }),
  P({ lean: 8, face: 'shout', af: { a: 50, e: 30, hand: 'open' }, ab: { a: 55, e: 25, hand: 'open' },
    lf: { a: -34, k: 10 }, lb: { a: 36, k: 30 }, cape: capeWind(4.4, -60), tail: { a: -70, ph: 4 } }),
  P({ lean: 16, face: 'shout', af: { a: 90, e: 0, hand: 'open', ha: 90 }, ab: { a: 86, e: 0, hand: 'open', ha: 90 },
    lf: { a: -40, k: 0 }, lb: { a: 40, k: 30 }, cape: capeWind(5.2, -95), tail: { a: -100, ph: 5 } }),
  P({ lean: 10, face: 'shout', af: { a: 92, e: -4, hand: 'open', ha: 90 }, ab: { a: 88, e: -4, hand: 'open', ha: 90 },
    lf: { a: -44, k: 0 }, lb: { a: 38, k: 36 }, cape: capeWind(6.4, -90), tail: { a: -95, ph: 6 } }),
  P({ lean: 2, face: 'grin', af: { a: 70, e: 20, hand: 'open' }, ab: { a: 60, e: 20, hand: 'open' },
    lf: { a: -30, k: 0 }, lb: { a: 30, k: 20 }, cape: capeWind(7.4, -45), tail: { a: -60, ph: 7 } })
];

// ---------- 6 素通り:笑顔で手を振る ----------
const walkLegs: [number, number, number, number][] = [
  [22, 5, -18, 20], [2, 20, 4, 5], [-18, 20, 22, 5], [4, 5, 2, 20]
];
const pass: Pose[] = walkLegs.map(([fa, fk, ba, bk], i) => P({
  lean: 2,
  face: (['grin', 'happy', 'grin', 'wink'] as const)[i],
  ab: { a: 150, e: i % 2 ? -30 : 25, hand: 'open' },
  af: { a: -20 + i * 10, e: 15, hand: 'fist' },
  lf: { a: fa, k: fk }, lb: { a: ba, k: bk },
  cape: capeIdle(i * 1.6), tail: { a: -45, ph: i * 1.5 }
}));

// ---------- 7 待てで止まる:急ブレーキ → 敬礼 ----------
/** 敬礼は奥の腕で。ひじを前に張り、手の先を額の前に出す(手前の腕だと顔が隠れる) */
const SALUTE: Arm = { a: 100, e: 90, hand: 'flat', ha: 250 };
const stop: Pose[] = [
  P({ lean: -26, face: 'shock', af: { a: -130, e: -20, hand: 'open' }, ab: { a: -112, e: -18, hand: 'open' },
    lf: { a: -22, k: 28 }, lb: { a: 50, k: 0, f: 125 }, cape: { a: 95, len: 22, ph: 0, w: 8, amp: 2 }, tail: { a: -70, ph: 0 } }),
  P({ lean: -32, squash: 0.06, face: 'shock', af: { a: -120, e: -30, hand: 'open' }, ab: { a: -104, e: -24, hand: 'open' },
    lf: { a: -26, k: 38 }, lb: { a: 56, k: 0, f: 130 }, cape: { a: 105, len: 24, ph: 1.5, w: 9, amp: 2 }, tail: { a: -75, ph: 1 } }),
  P({ lean: -4, face: 'normal', af: HANG_F, ab: HANG_B,
    lf: { a: -4, k: 0 }, lb: { a: 6, k: 0 }, cape: { a: 8, len: 30, ph: 3, w: 9 }, tail: { a: -25, ph: 2 } }),
  P({ lean: -4, face: 'grin', af: HANG_F, ab: SALUTE,
    lf: { a: -3, k: 0 }, lb: { a: 4, k: 0 }, cape: { a: -4, len: 30, ph: 4.5, w: 9 }, tail: { a: -30, ph: 3 } }),
  P({ lean: -4, face: 'wink', af: HANG_F, ab: SALUTE,
    lf: { a: -3, k: 0 }, lb: { a: 4, k: 0 }, cape: capeIdle(6), tail: { a: -40, ph: 4 } })
];

// ---------- 8 やっちまったー:両手で頭を抱えてのけぞる ----------
const HOLD_F: Arm = { a: -165, e: -60, hand: 'open', ha: 100 };
const HOLD_B: Arm = { a: 125, e: 88, hand: 'open', ha: 230 };
const oops: Pose[] = [
  P({ lean: -8, face: 'shock', af: { a: -125, e: -20, hand: 'open' }, ab: { a: 125, e: 20, hand: 'open' },
    lf: { a: -20, k: 10 }, lb: { a: 25, k: 10 }, cape: { a: 10, len: 28, ph: 0, w: 11, amp: 2 }, tail: { a: -20, ph: 0 } }),
  P({ lean: -12, face: 'oops', armRel: true, af: HOLD_F, ab: HOLD_B,
    lf: { a: -14, k: 5 }, lb: { a: 20, k: 10 }, cape: { a: 0, len: 30, ph: 1, w: 10 }, tail: { a: -25, ph: 1 } }),
  P({ lean: -24, face: 'oops', armRel: true, af: HOLD_F, ab: HOLD_B,
    lf: { a: -16, k: 8 }, lb: { a: 26, k: 18 }, cape: { a: -20, len: 30, ph: 2, w: 10 }, tail: { a: -20, ph: 2 } }),
  P({ lean: -34, face: 'oops', armRel: true, af: HOLD_F, ab: HOLD_B,
    lf: { a: -20, k: 10 }, lb: { a: 70, k: 90 }, cape: { a: -24, len: 27, ph: 3, w: 8 }, tail: { a: -40, ph: 3 } }),
  P({ lean: -30, face: 'oops', armRel: true, af: HOLD_F, ab: HOLD_B,
    lf: { a: -18, k: 10 }, lb: { a: 60, k: 80 }, cape: { a: -22, len: 27, ph: 4.5, w: 8 }, tail: { a: -35, ph: 4.5 } }),
  P({ lean: -34, face: 'oops', armRel: true, af: HOLD_F, ab: HOLD_B,
    lf: { a: -20, k: 10 }, lb: { a: 70, k: 90 }, cape: { a: -24, len: 27, ph: 6, w: 8 }, tail: { a: -40, ph: 6 } })
];

// ---------- 9 まあいいか:ケロッと立ち直ってガッツポーズ ----------
const okay: Pose[] = [
  P({ lean: 0, face: 'blank', af: HANG_F, ab: HANG_B, lf: { a: -4, k: 0 }, lb: { a: 5, k: 0 }, cape: capeIdle(0) }),
  P({ lean: -2, face: 'normal', af: { a: 35, e: 50, hand: 'open', ha: 150 }, ab: { a: 40, e: 40, hand: 'open' },
    lf: { a: -6, k: 0 }, lb: { a: 8, k: 0 }, cape: capeIdle(1.5) }),
  P({ lean: -6, face: 'grin', af: HIP_F, ab: { a: 140, e: 20, hand: 'fist' },
    lf: { a: -10, k: 0 }, lb: { a: 30, k: 40 }, cape: capeIdle(3) }),
  P({ lean: 4, face: 'happy', af: { a: 28, e: 100, hand: 'fist' }, ab: HIP_B,
    lf: { a: -14, k: 0 }, lb: { a: 55, k: 85 }, cape: { a: -35, len: 29, ph: 4.5, w: 11, amp: 2 }, tail: { a: -60, ph: 4 } })
];

// ---------- 10〜13 勝利ポーズ ----------
const winPose: Pose[] = [0, 1].map((i) => P({
  lean: -6, face: 'grin', hy: -1, af: { a: 94, e: 8, hand: 'point' }, ab: HIP_B,
  lf: { a: -26, k: 0 }, lb: { a: 28, k: 8 },
  cape: { a: -42, len: 27, ph: i * 3, w: 9, amp: 2 }, tail: { a: -70, ph: i * 3 }
}));
const winArms: Pose[] = [0, 1].map((i) => P({
  lean: -6, face: 'smug', hy: -1,
  af: { a: 53, e: -143, hand: 'fist' }, ab: { a: 42, e: -135, hand: 'fist' },
  lf: { a: -20, k: 0 }, lb: { a: 22, k: 0 },
  cape: { a: -30, len: 30, ph: i * 3, w: 11, amp: 1.6 }, tail: { a: -55, ph: i * 3 }
}));
const winFist: Pose[] = [0, 1].map((i) => P({
  lean: -4, face: 'shout', af: HIP_F, ab: { a: 158, e: 44, hand: 'fist' },
  lf: { a: -22, k: 0 }, lb: { a: 24, k: 4 },
  cape: { a: -36, len: 29, ph: i * 3, w: 10, amp: 2 }, tail: { a: -60, ph: i * 3 }
}));
const winShy: Pose[] = [0, 1].map((i) => P({
  lean: -3, face: 'happy', af: { a: -150, e: -58 - i * 10, hand: 'open', ha: 150 + i * 15 }, afBehindHead: true, ab: HIP_B,
  lf: { a: -8, k: 0 }, lb: { a: 16, k: 10 },
  cape: capeIdle(i * 3), tail: { a: -40, ph: i * 3 }
}));

// ---------- 14 蹴り:ひざを上げてから前へまっすぐ蹴る ----------
const GUARD_F: Arm = { a: 22, e: 98, hand: 'fist' };
const GUARD_B: Arm = { a: 50, e: 92, hand: 'fist' };
const kick: Pose[] = [
  P({ lean: -4, face: 'normal', af: GUARD_F, ab: GUARD_B,
    lf: { a: 70, k: 115 }, lb: { a: -4, k: 6 }, cape: capeWind(0.5, -30), tail: { a: -50, ph: 0.5 } }),
  P({ lean: -14, face: 'shout', af: { a: -40, e: 60, hand: 'fist' }, ab: { a: 75, e: 80, hand: 'fist' },
    lf: { a: 92, k: 20 }, lb: { a: -8, k: 4 }, cape: capeWind(1.5, -55), tail: { a: -75, ph: 1.5 } }),
  P({ lean: -22, face: 'shout', af: { a: -60, e: 40, hand: 'fist' }, ab: { a: 80, e: 70, hand: 'fist' },
    lf: { a: 100, k: 0 }, lb: { a: -10, k: 2 }, cape: capeWind(2.5, -75), tail: { a: -90, ph: 2.5 } }),
  P({ lean: -10, face: 'shout', af: GUARD_F, ab: GUARD_B,
    lf: { a: 65, k: 105 }, lb: { a: -6, k: 4 }, cape: capeWind(3.5, -45), tail: { a: -65, ph: 3.5 } }),
  P({ lean: 6, face: 'grin', af: GUARD_F, ab: GUARD_B,
    lf: { a: -24, k: 6 }, lb: { a: 26, k: 16 }, cape: capeIdle(4.5), tail: { a: -50, ph: 4.5 } })
];

// ---------- 15 アッパー:しゃがんで、跳び上がりながら拳を突き上げる ----------
const uppercut: Pose[] = [
  P({ lean: 22, squash: 0.1, face: 'normal', af: { a: -30, e: 110, hand: 'fist' }, ab: { a: 50, e: 90, hand: 'fist' },
    lf: { a: 45, k: 90 }, lb: { a: -15, k: 70 }, cape: capeWind(0.5, -35), tail: { a: -60, ph: 0.5 } }),
  P({ lean: 8, face: 'shout', af: { a: 60, e: 62, hand: 'fist' }, ab: { a: -40, e: 90, hand: 'fist' },
    lf: { a: 20, k: 40 }, lb: { a: -10, k: 30 }, cape: capeWind(1.5, -40), tail: { a: -70, ph: 1.5 } }),
  P({ ground: false, y: 34, lean: -6, face: 'shout', af: { a: -50, e: 100, hand: 'fist' }, ab: { a: 146, e: 12, hand: 'fist' },
    lf: { a: 30, k: 60 }, lb: { a: -8, k: 35 }, cape: { a: -10, len: 26, ph: 2.5, w: 10, amp: 2 }, tail: { a: -20, ph: 2.5 } }),
  P({ ground: false, y: 34, lean: -8, face: 'grin', af: { a: -40, e: 90, hand: 'fist' }, ab: { a: 152, e: 8, hand: 'fist' },
    lf: { a: 40, k: 80 }, lb: { a: 0, k: 45 }, cape: { a: 5, len: 24, ph: 3.5, w: 11, amp: 2 }, tail: { a: -30, ph: 3.5 } }),
  P({ lean: 4, squash: 0.05, face: 'grin', af: HIP_F, ab: { a: 138, e: 20, hand: 'fist' },
    lf: { a: -20, k: 20 }, lb: { a: 28, k: 30 }, cape: capeIdle(4.5), tail: { a: -45, ph: 4.5 } })
];

// ---------- 16 飛び蹴り:跳んで、脚を伸ばして突っこむ ----------
const flyKick: Pose[] = [
  P({ lean: 24, squash: 0.1, face: 'normal', af: { a: -60, e: 40, hand: 'fist' }, ab: { a: -30, e: 60, hand: 'fist' },
    lf: { a: 50, k: 100 }, lb: { a: -10, k: 70 }, cape: capeWind(0.5, -35), tail: { a: -60, ph: 0.5 } }),
  P({ ground: false, y: 31, lean: -6, face: 'shout', af: { a: -40, e: 70, hand: 'fist' }, ab: { a: 125, e: 20, hand: 'fist' },
    lf: { a: 70, k: 120 }, lb: { a: 30, k: 100 }, cape: { a: -40, len: 26, ph: 1.5, w: 10, amp: 2 }, tail: { a: -40, ph: 1.5 } }),
  P({ ground: false, y: 34, lean: -26, face: 'shout', af: { a: -80, e: 30, hand: 'fist' }, ab: { a: 110, e: 30, hand: 'fist' },
    lf: { a: 96, k: 4 }, lb: { a: 40, k: 115 }, cape: capeWind(2.5, -115), tail: { a: -98, ph: 2.5, len: 8 } }),
  P({ ground: false, x: 31, y: 34, lean: -30, face: 'shout', af: { a: -90, e: 34, hand: 'fist' }, ab: { a: 115, e: 25, hand: 'fist' },
    lf: { a: 102, k: 0 }, lb: { a: 45, k: 120 }, cape: capeWind(3.5, -120), tail: { a: -100, ph: 3.5, len: 8 } }),
  P({ ground: false, y: 31, lean: -10, face: 'grin', af: { a: -40, e: 50, hand: 'fist' }, ab: { a: 60, e: 60, hand: 'fist' },
    lf: { a: 40, k: 70 }, lb: { a: 10, k: 60 }, cape: { a: -20, len: 27, ph: 4.5, w: 10, amp: 2 }, tail: { a: -30, ph: 4.5 } }),
  P({ lean: 10, squash: 0.08, face: 'grin', af: GUARD_F, ab: GUARD_B,
    lf: { a: -26, k: 30 }, lb: { a: 30, k: 40 }, cape: capeIdle(5.5), tail: { a: -45, ph: 5.5 } })
];

export const HERO_ROWS: Pose[][] = [
  idle, run, charge, punch, stomp, special, pass, stop, oops, okay, winPose, winArms, winFist, winShy, kick, uppercut, flyKick
];
