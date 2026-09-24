// ステージ3の絵の決まり(ART_SPEC)を確かめる。絵は PixelGrid のまま調べる(キャンバスは使わない)。
import { describe, expect, it } from 'vitest';
import { LEVELS, type PixelGrid } from '../lib';
import { CLUE_SPOTS, type ClueRect } from '../clueSpots';
import { IMAGES, sheetByKey } from '../sheets';
import { GLITCH } from './palette';
import { WORLD3_IMAGES, buildWorld3Sheets } from './index';

const sheets = buildWorld3Sheets();
const LOOKS = ['mascot', 'clerk', 'dancer', 'uncle'] as const;

const colorsOf = (grids: PixelGrid[]): Set<string> => {
  const s = new Set<string>();
  for (const g of grids) for (const row of g.cells) for (const c of row) if (c) s.add(c);
  return s;
};
const okLevel = (c: string): boolean => {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);
  return !!m && [m[1], m[2], m[3]].every((v) => (LEVELS as readonly number[]).includes(Number(v)));
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
  it('シートの行とコマ数、大きさが表と合う', () => {
    for (const [key, rows] of Object.entries(sheets)) {
      const def = sheetByKey(key);
      expect(rows.length, key).toBe(def.rows.length);
      rows.forEach((frames, r) => {
        expect(frames.length, `${key} 行${r}`).toBe(def.rows[r].frames);
        for (const g of frames) expect([g.w, g.h], key).toEqual([def.frameW, def.frameH]);
      });
    }
  });

  it('1枚15色まで、8段階の色だけ、明るい緑(R0 G255 B0)なし', () => {
    for (const [key, rows] of Object.entries(sheets)) {
      const cs = colorsOf(rows.flat());
      expect(cs.size, key).toBeLessThanOrEqual(15);
      for (const c of cs) {
        expect(okLevel(c), `${key} ${c}`).toBe(true);
        expect(c, key).not.toBe('rgb(0,255,0)');
      }
    }
  });

  it('背景は3枚で45色まで', () => {
    const grids = Object.entries(WORLD3_IMAGES).map(([key, draw]) => {
      const g = draw();
      const def = IMAGES.find((d) => d.key === key)!;
      expect([g.w, g.h], key).toEqual([def.w, def.h]);
      return g;
    });
    const cs = colorsOf(grids);
    expect(cs.size).toBeLessThanOrEqual(45);
    for (const c of cs) expect(okLevel(c) && c !== 'rgb(0,255,0)', c).toBe(true);
    // 奥の絵は透明なし
    expect(grids[0].cells.every((row) => row.every((c) => c !== null))).toBe(true);
  });

  it('宇宙人の行0〜5は市民とまったく同じ絵(ぎこちない動きも同じ)', () => {
    for (const look of LOOKS) {
      const civ = sheets[`${look}_civ`], bad = sheets[`${look}_bad`];
      for (let r = 0; r < 6; r++) civ[r].forEach((g, i) => expect(same(g, bad[r][i]), `${look} 行${r} コマ${i}`).toBe(true));
    }
  });

  it('「持ち物」の窓:同じ見た目は同じ四角。ぎこちない動きと、くずれの出はじめが四角に入る', () => {
    for (const look of LOOKS) {
      const r = CLUE_SPOTS[`${look}_civ`];
      expect(CLUE_SPOTS[`${look}_bad`], look).toBe(r);
      if (CLUE_SPOTS[`boss3_disguise_${look}`]) expect(CLUE_SPOTS[`boss3_disguise_${look}`], look).toBe(r);
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
