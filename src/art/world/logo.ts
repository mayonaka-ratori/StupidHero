// タイトルのロゴ「STUPID HERO」200×64。ドット文字を太く組んで、金色と水色でハデに。
import { md, OUTLINE, PixelGrid } from '../lib';
import { Mask } from './pix';

const FONT: Record<string, string[]> = {
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.']
};

/** 文字列を大きさ k のブロックで Mask に描く。shear で斜体 */
function word(m: Mask, text: string, x0: number, y0: number, k: number, gap: number, shear: number): void {
  let x = x0;
  for (const ch of text) {
    const f = FONT[ch];
    const fw = f[0].length;
    for (let r = 0; r < 7; r++) for (let c = 0; c < fw; c++) {
      if (f[r][c] !== '#') continue;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        const yy = r * k + j;
        // 角を丸める
        const up = r > 0 && f[r - 1][c] === '#', dn = r < 6 && f[r + 1][c] === '#';
        const lf = c > 0 && f[r][c - 1] === '#', rt = c < fw - 1 && f[r][c + 1] === '#';
        const corner = (i === 0 && j === 0 && !up && !lf) || (i === k - 1 && j === 0 && !up && !rt)
          || (i === 0 && j === k - 1 && !dn && !lf) || (i === k - 1 && j === k - 1 && !dn && !rt);
        if (corner && k > 2) continue;
        const sx = Math.round((7 * k - yy) * shear);
        m.set(x + c * k + i + sx, y0 + yy);
      }
    }
    x += fw * k + gap;
  }
}

function paintWord(g: PixelGrid, m: Mask, y0: number, h: number, bands: string[], shine: string, side: string[]): void {
  // 押し出し(右下へ厚み)
  const ext = new Mask(m.w, m.h);
  for (let d = 1; d <= side.length; d++) m.each((x, y) => ext.set(x + d, y + d));
  ext.subtract(m);
  const all = ext.clone().union(m);
  // 2重のふち
  const o1 = new Mask(m.w, m.h), o2 = new Mask(m.w, m.h);
  all.each((x, y) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!all.has(x + dx, y + dy)) o1.set(x + dx, y + dy); });
  const a2 = all.clone().union(o1);
  a2.each((x, y) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (!a2.has(x + dx, y + dy)) o2.set(x + dx, y + dy); });
  o2.each((x, y) => g.px(x, y, side[side.length - 1]));
  o1.each((x, y) => g.px(x, y, OUTLINE));
  ext.each((x, y) => {
    // 押し出しの面は、上の面を明るく
    g.px(x, y, m.has(x - 1, y) ? side[0] : side[1] ?? side[0]);
  });
  m.each((x, y) => {
    const t = (y - y0) / h;
    let c = bands[Math.min(bands.length - 1, Math.floor(t * bands.length))];
    // 帯の境目はディザっぽく1段ずらす
    const tb = t * bands.length, fr = tb - Math.floor(tb);
    if (fr < 0.12 && (x + y) % 2 === 0 && Math.floor(tb) > 0) c = bands[Math.floor(tb) - 1];
    if (!m.has(x, y - 1) || !m.has(x - 1, y)) c = shine;
    g.px(x, y, c);
  });
}

function sparkle(g: PixelGrid, x: number, y: number, r: number, c: string, core: string): void {
  for (let i = -r; i <= r; i++) { g.px(x + i, y, c); g.px(x, y + i, c); }
  g.px(x, y, core);
  if (r > 2) { g.px(x - 1, y, core).px(x + 1, y, core).px(x, y - 1, core).px(x, y + 1, core); }
}

export function drawLogo(): PixelGrid {
  const W = 200, H = 64;
  const g = new PixelGrid(W, H);
  // 後ろの稲妻のような光(ピンク)
  const burst = new Mask(W, H);
  burst.poly([[18, 40], [70, 24], [60, 33], [150, 18], [120, 30], [190, 26], [128, 44], [140, 38], [40, 52], [56, 44]]);
  const bo = new Mask(W, H);
  burst.each((x, y) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!burst.has(x + dx, y + dy)) bo.set(x + dx, y + dy); });
  bo.each((x, y) => g.px(x, y, OUTLINE));
  burst.each((x, y) => g.px(x, y, (x + y) % 2 === 0 ? md(7, 2, 5) : md(5, 0, 4)));
  burst.each((x, y) => { if (!burst.has(x, y - 1)) g.px(x, y, md(7, 7, 7)); });

  // STUPID(水色、小さめ)
  const m1 = new Mask(W, H);
  word(m1, 'STUPID', 36, 2, 3, 7, 0.22);
  paintWord(g, m1, 2, 21, [md(7, 7, 7), md(4, 7, 7), md(4, 7, 7), md(2, 4, 7)], md(7, 7, 7), [md(2, 0, 4), md(1, 0, 2)]);
  // HERO(金、大きく)
  const m2 = new Mask(W, H);
  word(m2, 'HERO', 32, 24, 5, 8, 0.22);
  paintWord(g, m2, 24, 35, [md(7, 7, 5), md(7, 6, 0), md(7, 6, 0), md(7, 4, 0), md(6, 2, 0)], md(7, 7, 7), [md(5, 0, 1), md(5, 0, 1), md(2, 0, 1)]);
  // キラキラ
  sparkle(g, 188, 10, 4, md(7, 6, 0), md(7, 7, 7));
  sparkle(g, 14, 30, 3, md(4, 7, 7), md(7, 7, 7));
  sparkle(g, 184, 56, 2, md(7, 6, 0), md(7, 7, 7));
  sparkle(g, 22, 8, 2, md(7, 6, 0), md(7, 7, 7));
  return g;
}
