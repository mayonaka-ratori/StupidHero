// 見分ける手がかりの出し分けの絵(sheets.ts の TELL_SHEETS)を確かめる。どれを出すかの決まりは src/logic/tells.test.ts。
// 絵は PixelGrid のまま調べる(キャンバスは使わない)。
import { describe, expect, it } from 'vitest';
import { tellSheetKeys } from '../logic/tells';
import type { PixelGrid } from './lib';
import { CLUE_SPOTS, type ClueRect } from './clueSpots';
import { KEY_ACCESSORY, SHEETS, TELL_BASE, TELL_SHEETS, sheetByKey } from './sheets';
import { ART_SETS } from './sets';
import { buildItemlessPeople } from './world/people';

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

/** ステージ1の、小物を描かない絵(小物のドットを取り出すのに使う) */
const ITEMLESS = buildItemlessPeople();
/** 小物を窓のふちから何ドット離すか */
const MARGIN = 1;
/** 2つのコマで違うドットを囲む四角(違いがなければ null) */
const boxOfDiff = (a: PixelGrid, b: PixelGrid): { x0: number; y0: number; x1: number; y1: number } | null => {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    if (a.cells[y][x] === b.cells[y][x]) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
};

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

  it('ステージ1:小物(ふちの線まで)は、仕分けの4コマのどれでも、窓のふちから1ドット以上内側にある(切れて形が変わらない)', () => {
    // 小物のドットは、小物を描かない絵(buildItemlessPeople)と比べて取り出す
    const bad: string[] = [];
    for (const [base, rows] of Object.entries(ITEMLESS)) {
      const r = CLUE_SPOTS[base];
      for (const key of [base, ...Object.keys(TELL_BASE).filter((k) => TELL_BASE[k] === base)]) {
        drawn[key][2].forEach((g, i) => {
          const b = boxOfDiff(g, rows[2][i]);
          expect(b, `${key} コマ${i}`).not.toBeNull();
          // 路地裏のボスが化けた買い物袋の女性は、袋を高く持ち上げる(化けた姿のおかしな所)ので、上だけははみ出してよい
          const top = base === 'boss_disguise_shopper' ? -Infinity : r.y + MARGIN;
          if (b!.x0 < r.x + MARGIN || b!.y0 < top || b!.x1 > r.x + r.w - 1 - MARGIN || b!.y1 > r.y + r.h - 1 - MARGIN) {
            bad.push(`${key} コマ${i}: 小物 x${b!.x0}-${b!.x1} y${b!.y0}-${b!.y1}、窓 x${r.x}-${r.x + r.w - 1} y${r.y}-${r.y + r.h - 1}`);
          }
        });
      }
    }
    expect(bad).toEqual([]);
  });

  it('ステージ1:ボスの買い物袋の女性の小物も、半分より多くが窓に入る', () => {
    const base = 'boss_disguise_shopper', r = CLUE_SPOTS[base];
    for (const key of [base, ...Object.keys(TELL_BASE).filter((k) => TELL_BASE[k] === base)]) {
      drawn[key][2].forEach((g, i) => {
        let all = 0, inside = 0;
        const itemless = ITEMLESS[base][2][i];
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
          if (g.cells[y][x] === itemless.cells[y][x]) continue;
          all++;
          if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) inside++;
        }
        expect(inside / all, `${key} コマ${i}`).toBeGreaterThan(0.5);
      });
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
