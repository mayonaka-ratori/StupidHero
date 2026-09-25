// ステージ4の絵の決まり(docs/STAGE4.md、docs/ART_SPEC.md)を確かめる。絵は PixelGrid のまま調べる。
// 色の数や8段階の色、紫を使ってよい絵など、どのステージにもある決まりは src/art/artRules.test.ts で確かめる。
import { describe, expect, it } from 'vitest';
import { type PixelGrid } from '../lib';
import { bbox } from '../world/pix';
import { PSY } from './palette';
import { magicianCaneTips } from './people';
import { buildWorld4Sheets } from './index';

const sheets = buildWorld4Sheets();
const LOOKS = ['florist', 'courier', 'newbie', 'janitor', 'chef', 'waiter', 'lady', 'magician'] as const;
const psy = new Set<string>(PSY);
const hasPsy = (g: PixelGrid): boolean => g.cells.some((row) => row.some((c) => !!c && psy.has(c)));
const diff = (a: PixelGrid, b: PixelGrid): number => {
  let n = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.cells[y][x] !== b.cells[y][x]) n++;
  return n;
};

describe('ステージ4の絵', () => {
  it('人は8種類とも7行(市民の6行と念力の行)。見た目のくせと念力は4コマとも動く', () => {
    for (const look of LOOKS) {
      const rows = sheets[`tw_${look}`];
      expect(rows.length, look).toBe(7);
      for (const r of [2, 6]) for (let i = 1; i < 4; i++) expect(diff(rows[r][0], rows[r][i]), `${look} 行${r} コマ${i}`).toBeGreaterThan(4);
    }
  });

  it('化けた姿は、同じ見た目の市民と違う絵(おかしな所がある)', () => {
    for (const look of ['lady', 'magician', 'waiter']) {
      const d = sheets[`tw_boss_${look}`];
      expect(d.length).toBe(3);
      expect(diff(d[0][0], sheets[`tw_${look}`][0][0]), look).toBeGreaterThan(20);
    }
  });

  it('照明:ふつうと切れかけは紫を使わず、もれだけが紫', () => {
    const [normal, leak, weak, weak2] = sheets.fx_psy_lamp[0];
    expect(hasPsy(leak)).toBe(true);
    for (const g of [normal, weak, weak2]) expect(hasPsy(g)).toBe(false);
  });

  it('机の小物は6つとも3×3ドット以上で、紫を使わない(もやはコードで重ねる)', () => {
    const items = sheets.fx_psy_items[0];
    expect(items.length).toBe(6);
    for (const g of items) {
      const b = bbox(g)!;
      expect(b.x1 - b.x0 + 1).toBeGreaterThanOrEqual(3);
      expect(b.y1 - b.y0 + 1).toBeGreaterThanOrEqual(3);
      expect(hasPsy(g)).toBe(false);
    }
  });

  it('シャンデリアは念力のコマだけ紫。ソファは4コマとも違う色', () => {
    const [c0, c1, c2] = sheets.prop_chandelier[0];
    expect([hasPsy(c0), hasPsy(c1), hasPsy(c2)]).toEqual([false, true, false]);
    const sofas = sheets.prop_sofa[0];
    for (let i = 1; i < 4; i++) expect(diff(sofas[0], sofas[i])).toBeGreaterThan(100);
  });

  it('手品師のつえの先は、コマの中にあって、つえの絵が描いてある', () => {
    const { idle, sortIdle } = magicianCaneTips();
    const rows = sheets.tw_magician;
    idle.forEach(([x, y], i) => expect(rows[0][i].get(x, y), `待機 ${i}`).not.toBeNull());
    sortIdle.forEach(([x, y], i) => expect(rows[2][i].get(x, y), `仕分け ${i}`).not.toBeNull());
  });
});
