// 粒の動きに使う計算だけ(Phaser を使わないので、テストで確かめられる)。
//   hermite(p0, m0, p1, m1, t)   // 3次のエルミート曲線。始まりの位置と向き、終わりの位置と向きで決まる曲線の、t(0〜1)の所
//   smooth(t)                    // 0〜1をなめらかにつなぐ(hermite(0, 0, 1, 0, t) と同じ)
//   noise(x, y, seed)            // なめらかにつながる乱数(-1〜1)と、その坂の向き
//   curl(x, y, t, seed)          // 渦を巻く流れの向き。煙を乗せると、うねりながら広がる
// curl の流れは、noise の坂を90度回した向きなので、どこかに集まったり、どこかから湧いたりしない。
// 煙の粒を乗せても1か所に固まらず、渦の形のまま流れていく。

/** 3次のエルミート曲線:p0 から向き m0 で出て、p1 に向き m1 で着く曲線の、t(0〜1)の所 */
export function hermite(p0: number, m0: number, p1: number, m1: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}

/** 0〜1をなめらかにつなぐ(両端で向きが0になるエルミート曲線) */
export const smooth = (t: number): number => t * t * (3 - 2 * t);

/** smooth の坂 */
const smoothSlope = (t: number): number => 6 * t * (1 - t);

/** 格子の点ごとに決まる乱数(-1〜1) */
function lattice(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x7fffffff - 1;
}

export interface NoiseSample { v: number; dx: number; dy: number }

/**
 * なめらかにつながる乱数。格子の点の乱数を、smooth(エルミート曲線)で間をつなぐ。
 * v は値(-1〜1)、dx と dy はその場所の坂(x、y の向きに1進んだときに v がどれだけ変わるか)
 */
export function noise(x: number, y: number, seed = 0): NoiseSample {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = lattice(ix, iy, seed), b = lattice(ix + 1, iy, seed);
  const c = lattice(ix, iy + 1, seed), d = lattice(ix + 1, iy + 1, seed);
  const u = smooth(fx), v = smooth(fy);
  const k = a - b - c + d;
  return {
    v: a + (b - a) * u + (c - a) * v + k * u * v,
    dx: smoothSlope(fx) * (b - a + k * v),
    dy: smoothSlope(fy) * (c - a + k * u)
  };
}

/**
 * 渦を巻く流れの向き(x、y は格子のます目で数える。t は秒)。
 * 大きな渦と小さな渦を重ね、それぞれ違う向きにゆっくりずらして、形が少しずつ変わるようにする。
 * 向きの長さは、たいてい0.5くらい。長くても2くらい(どうやっても3.5はこえない)
 */
export function curl(x: number, y: number, t: number, seed = 0): { x: number; y: number } {
  // 小さな渦は、ます目を2.03倍に細かくして、強さを半分にしたもの(坂はその分だけ 0.5 × 2.03 倍になる)
  const f = 2.03;
  const a = noise(x + t * 0.31, y - t * 0.17, seed);
  const b = noise(x * f - t * 0.43, y * f + t * 0.29, seed + 101);
  const dx = a.dx + 0.5 * f * b.dx;
  const dy = a.dy + 0.5 * f * b.dy;
  // 長さをならす(何もしないと、たいてい1.3くらいで、長いと5くらいになる)
  return { x: dy * 0.4, y: -dx * 0.4 };
}
