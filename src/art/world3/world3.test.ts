// ステージ3の絵の決まり(ART_SPEC)を確かめる。絵は PixelGrid のまま調べる(キャンバスは使わない)。
// 色の数や8段階の色など、どのステージにもある決まりは src/art/artRules.test.ts で確かめる。
import { describe, expect, it } from 'vitest';
import { type PixelGrid } from '../lib';
import { CLUE_SPOTS, type ClueRect } from '../clueSpots';
import { GLITCH } from './palette';
import { buildWorld3Sheets } from './index';

const sheets = buildWorld3Sheets();
const LOOKS = ['mascot', 'clerk', 'dancer', 'uncle'] as const;

const colorsOf = (grids: PixelGrid[]): Set<string> => {
  const s = new Set<string>();
  for (const g of grids) for (const row of g.cells) for (const c of row) if (c) s.add(c);
  return s;
};
const same = (a: PixelGrid, b: PixelGrid): boolean => a.cells.every((row, y) => row.every((c, x) => c === b.cells[y][x]));
/** 四角の中で、2つのコマの違うドットの数 */
const diffIn = (a: PixelGrid, b: PixelGrid, r: ClueRect): number => {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (a.cells[y][x] !== b.cells[y][x]) n++;
  return n;
};
const countIn = (g: PixelGrid, r: ClueRect, colors: Set<string>): number => {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (g.cells[y][x] && colors.has(g.cells[y][x]!)) n++;
  return n;
};

describe('ステージ3の絵', () => {
  it('宇宙人の行0〜5は市民とまったく同じ絵(ぎこちない動きも同じ)', () => {
    for (const look of LOOKS) {
      const civ = sheets[`${look}_civ`], bad = sheets[`${look}_bad`];
      for (let r = 0; r < 6; r++) civ[r].forEach((g, i) => expect(same(g, bad[r][i]), `${look} 行${r} コマ${i}`).toBe(true));
    }
  });

  it('「持ち物」の窓:ぎこちない動きと、くずれの出はじめが四角に入る', () => {
    for (const look of LOOKS) {
      // 市民とワルと親玉で同じ四角かは clueSpots.test.ts で確かめる
      const r = CLUE_SPOTS[`${look}_civ`];
      const bad = sheets[`${look}_bad`];
      const sort = bad[2];
      // 仕分けの動きの4コマは、四角の中で動いて見える
      let moved = 0;
      for (let i = 1; i < 4; i++) moved += diffIn(sort[0], sort[i], r);
      expect(moved, look).toBeGreaterThan(20);
      // くずれの1コマ目は、仕分けの動きのどのコマとも四角の中で違う
      for (const g of sort) expect(diffIn(g, bad[7][0], r), look).toBeGreaterThan(4);
    }
    // 着ぐるみの親玉の触角(黄緑)は四角に入る
    const glitch = new Set<string>(GLITCH);
    for (const g of sheets.boss3_disguise_mascot[2]) expect(countIn(g, CLUE_SPOTS.mascot_civ, glitch)).toBeGreaterThan(0);
  });

  it('市民の絵には黄緑を使わない(くずれと合図だけの色)', () => {
    const glitch = new Set<string>(GLITCH);
    for (const look of LOOKS) {
      const cs = colorsOf(sheets[`${look}_civ`].flat());
      for (const c of glitch) expect(cs.has(c), look).toBe(false);
    }
  });
});
