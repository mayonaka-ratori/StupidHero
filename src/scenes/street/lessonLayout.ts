// 待てと行けを止めて教えるときの、暗くする所の計算(Phaser を使わない。lessonLayout.test.ts で確かめる)。
//   coverRects(W, H, holes)   画面(0,0,W,H)から、穴(明るく残す四角)を除いた所を、重ならない四角の並びにする

export interface Rect { x: number; y: number; w: number; h: number }

/** 四角を画面の中に収め、ドットにそろえる(外へはみ出す分は切る)。何も残らなければ null */
export function clipRect(r: Rect, W: number, H: number): Rect | null {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(W, Math.ceil(r.x + r.w));
  const y1 = Math.min(H, Math.ceil(r.y + r.h));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** いくつかの四角を囲む、いちばん小さい四角 */
export function unionRect(rs: readonly Rect[]): Rect {
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * 画面(0,0,W,H)から穴を除いた所を、重ならない四角に分ける。
 * 穴の上と下の端で横の帯に切り、帯ごとに穴のない区間を四角にする。穴どうしは重なっていてもよい
 */
export function coverRects(W: number, H: number, holes: readonly Rect[]): Rect[] {
  const hs = holes.map((h) => clipRect(h, W, H)).filter((h): h is Rect => h !== null);
  const ys = [...new Set([0, H, ...hs.flatMap((h) => [h.y, h.y + h.h])])].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    // この帯にかかる穴の横の区間(帯の切れ目は穴の端なので、かかる穴は帯の上から下まで続いている)
    const spans = hs.filter((h) => h.y < y1 && h.y + h.h > y0).map((h) => [h.x, h.x + h.w] as const).sort((a, b) => a[0] - b[0]);
    let x = 0;
    for (const [a, b] of spans) {
      if (a > x) out.push({ x, y: y0, w: a - x, h: y1 - y0 });
      x = Math.max(x, b);
    }
    if (x < W) out.push({ x, y: y0, w: W - x, h: y1 - y0 });
  }
  return out;
}
