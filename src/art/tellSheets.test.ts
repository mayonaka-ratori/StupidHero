// 見分ける手がかりの出し分けの絵(sheets.ts の TELL_SHEETS)を確かめる。どれを出すかの決まりは src/logic/tells.test.ts。
// 絵は PixelGrid のまま調べる(キャンバスは使わない)。
import { describe, expect, it } from 'vitest';
import { tellSheetKeys } from '../logic/tells';
import type { PixelGrid } from './lib';
import { CLUE_SPOTS, type ClueRect } from './clueSpots';
import { KEY_ACCESSORY, SHEETS, TELL_BASE, TELL_SHEETS, sheetByKey } from './sheets';
import { ART_SETS } from './sets';

const drawn: Record<string, PixelGrid[][]> = Object.assign({}, ...Object.values(ART_SETS).map((set) => set.sheets()));

/** 四角の中で、2つのコマの違うドットの数 */
const diffIn = (a: PixelGrid, b: PixelGrid, r: ClueRect): number => {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (a.cells[y][x] !== b.cells[y][x]) n++;
  return n;
};
const countIn = (g: PixelGrid, r: ClueRect, c: string): number => {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (g.cells[y][x] === c) n++;
  return n;
};
const same = (a: PixelGrid, b: PixelGrid): boolean => a.cells.every((row, y) => row.every((c, x) => c === b.cells[y][x]));

describe('手がかりの出し分けの絵', () => {
  it('絵の表(TELL_SHEETS)は、ルールの出し分け(logic/tells.ts)と同じ', () => {
    const fromLogic = tellSheetKeys().map((t) => t.key).sort();
    expect(Object.keys(TELL_BASE).sort()).toEqual(fromLogic);
  });

  it('どれも SHEETS にあり、元の絵と同じ行の並び。コードで描いてあり、コマの数も表と合う', () => {
    for (const [key, base] of Object.entries(TELL_BASE)) {
      const d = sheetByKey(key), b = sheetByKey(base);
      expect(d.rows.map((r) => [r.name, r.frames])).toEqual(b.rows.map((r) => [r.name, r.frames]));
      expect(d.anchor).toBe(b.anchor);
      const rows = drawn[key];
      expect(rows, key).toBeDefined();
      expect(rows.map((r) => r.length), key).toEqual(d.rows.map((r) => r.frames));
    }
    expect(SHEETS.filter((d) => d.key in TELL_BASE)).toHaveLength(Object.keys(TELL_BASE).length);
  });

  it('「持ち物」の窓の四角は元の絵と同じ', () => {
    for (const [key, base] of Object.entries(TELL_BASE)) expect(CLUE_SPOTS[key], key).toEqual(CLUE_SPOTS[base]);
  });

  it('ステージ1と2:仕分けの動きの4コマのどれでも、窓の中で元の絵と見てわかるほど違う(小物が窓に入っている)', () => {
    for (const [key, base] of Object.entries(TELL_BASE)) {
      if (sheetByKey(key).rows.length === 8) continue; // 宇宙人は下で見る
      const r = CLUE_SPOTS[key];
      drawn[key][2].forEach((g, i) => expect(diffIn(g, drawn[base][2][i], r), `${key} コマ${i}`).toBeGreaterThanOrEqual(4));
    }
  });

  it('ステージ2:小物の形を変えても、仕分けの4コマのどれでも、塗り替える色(赤紫)が窓に入っている', () => {
    for (const base of ['guard', 'mechanic', 'clubber', 'officelady']) {
      for (const truth of ['civ', 'bad']) {
        for (const n of TELL_SHEETS[`${base}_${truth}`] ?? []) {
          const key = `${base}_${truth}_${n}`;
          drawn[key][2].forEach((g, i) => expect(countIn(g, CLUE_SPOTS[key], KEY_ACCESSORY), `${key} コマ${i}`).toBeGreaterThanOrEqual(6));
        }
      }
    }
  });

  it('ステージ3:くずれの2つ目の宇宙人は、行0〜6が元の宇宙人と同じで、くずれ(行7)だけが違い、出はじめが窓に見える', () => {
    for (const look of ['mascot', 'clerk', 'dancer', 'uncle']) {
      for (const n of TELL_SHEETS[`${look}_bad`]) {
        const key = `${look}_bad_${n}`;
        const alt = drawn[key], bad = drawn[`${look}_bad`];
        for (let r = 0; r < 7; r++) alt[r].forEach((g, i) => expect(same(g, bad[r][i]), `${key} 行${r} コマ${i}`).toBe(true));
        const r = CLUE_SPOTS[key];
        for (const g of alt[2]) expect(diffIn(g, alt[7][0], r), key).toBeGreaterThan(4);
        alt[7].forEach((g, i) => expect(same(g, bad[7][i]), `${key} くずれ${i}`).toBe(false));
      }
    }
  });
});
