// 絵の色の決まり(docs/ART_SPEC.md の「全体の決まり」)を、コードで描いた絵の全部で確かめる。
// 絵は PixelGrid のまま調べる(キャンバスは使わない)。ステージごとの決まりは world3/world3.test.ts などにある。
import { describe, expect, it } from 'vitest';
import { LEVELS, type PixelGrid } from './lib';
import { IMAGES, KEY_ACCESSORY, SHEETS, sheetByKey } from './sheets';
import { buildHeroSheets } from './heroSet';
import { WORLD_BGS, buildWorldSheets } from './worldSet';
import { drawLogo } from './world/logo';
import { WORLD2_IMAGES, buildWorld2Sheets } from './world2';
import { WORLD3_IMAGES, buildWorld3Sheets } from './world3';
import { GLITCH } from './world3/palette';
import { WORLD4_BG_SETS, WORLD4_IMAGES, buildWorld4Sheets } from './world4';
import { PSY } from './world4/palette';

/**
 * 超能力の紫のうち、決まった所にしか使わない2色(R219 G109 B255、R146 G36 B219)。
 * いちばん明るい R255 G219 B255 は、前から路地裏の看板のネオンにも使っているので確かめない
 */
const PSY_ONLY = [PSY[1], PSY[2]];
import { buildFreeSheets } from './free';

/** 担当ごとのシート(ヒーローと顔とエフェクト、ステージ1〜3、フリープレイ) */
const SETS: Record<string, Record<string, PixelGrid[][]>> = {
  hero: buildHeroSheets(),
  world: buildWorldSheets(),
  world2: buildWorld2Sheets(),
  world3: buildWorld3Sheets(),
  world4: buildWorld4Sheets(),
  free: buildFreeSheets()
};
/** 背景の1枚絵(キー → 描く関数) */
const IMAGE_DRAW: Record<string, () => PixelGrid> = { ...WORLD_BGS, ...WORLD2_IMAGES, ...WORLD3_IMAGES, ...WORLD4_IMAGES };
/**
 * 色の数を確かめる背景の組(奥の絵1枚と、それに組む壁と床で45色まで)。1枚目は奥の絵で、透明なし。
 * ステージ1〜3は1組ずつ、高層ビルは階ごとの4組とエレベーター
 */
const BG_SETS: Record<string, string[]> = {
  alley: Object.keys(WORLD_BGS), garage: Object.keys(WORLD2_IMAGES), mall: Object.keys(WORLD3_IMAGES), ...WORLD4_BG_SETS
};

const GREEN = 'rgb(0,255,0)';

const colorsOf = (grids: PixelGrid[]): Set<string> => {
  const s = new Set<string>();
  for (const g of grids) for (const row of g.cells) for (const c of row) if (c) s.add(c);
  return s;
};
const okLevel = (c: string): boolean => {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);
  return !!m && [m[1], m[2], m[3]].every((v) => (LEVELS as readonly number[]).includes(Number(v)));
};

/** 赤紫(小物の塗り替え用の色)を使ってよいのは、ステージ2の人と、その見た目に化けた女ボスだけ */
/** 超能力の紫を使ってよい絵(もれと念力のエフェクト、親玉の光、念力で浮くシャンデリア) */
const mayUsePsy = (key: string): boolean => key.startsWith('fx_psy_') || key === 'boss4' || key === 'prop_chandelier';

const mayUseAccessory = (key: string): boolean =>
  /^(guard|mechanic|clubber|officelady)_(civ|bad)$/.test(key) || key.startsWith('boss2_disguise_');

describe('絵の色の決まり', () => {
  for (const [set, sheets] of Object.entries(SETS)) {
    describe(set, () => {
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
            expect(c, key).not.toBe(GREEN);
          }
        }
      });

      it('赤紫(R255 G0 B255)はステージ2の人の小物だけ', () => {
        for (const [key, rows] of Object.entries(sheets)) {
          if (!mayUseAccessory(key)) expect(colorsOf(rows.flat()).has(KEY_ACCESSORY), key).toBe(false);
        }
      });

      it('超能力の紫(濃いほうの2色)は、ステージ4のもれ、念力、親玉の光だけ', () => {
        for (const [key, rows] of Object.entries(sheets)) {
          if (mayUsePsy(key)) continue;
          const cs = colorsOf(rows.flat());
          for (const c of PSY_ONLY) expect(cs.has(c), `${key} ${c}`).toBe(false);
        }
      });

      if (set !== 'world3') {
        it('黄緑の3色(くずれと合図の色)はステージ3だけ(フリープレイの宇宙人の触角と合図はよい)', () => {
          for (const [key, rows] of Object.entries(sheets)) {
            if (key === 'fp_alien') continue;
            const cs = colorsOf(rows.flat());
            for (const c of GLITCH) expect(cs.has(c), `${key} ${c}`).toBe(false);
          }
        });
      }
    });
  }

  for (const [name, keys] of Object.entries(BG_SETS)) {
    it(`${name}の背景(奥の絵1枚と、組む壁と床)は45色まで、8段階の色だけ、明るい緑と赤紫と超能力の紫なし、奥の絵に透明なし`, () => {
      const grids = keys.map((key) => {
        const g = IMAGE_DRAW[key]();
        const def = IMAGES.find((d) => d.key === key)!;
        expect([g.w, g.h], key).toEqual([def.w, def.h]);
        return g;
      });
      const cs = colorsOf(grids);
      expect(cs.size).toBeLessThanOrEqual(45);
      const psy = new Set<string>(PSY_ONLY);
      for (const c of cs) expect(okLevel(c) && c !== GREEN && c !== KEY_ACCESSORY && !psy.has(c), c).toBe(true);
      expect(grids[0].cells.every((row) => row.every((c) => c !== null))).toBe(true);
    });
  }

  it('背景の1枚絵は全部、どれかの組に入っている', () => {
    const inSet = new Set(Object.values(BG_SETS).flat());
    expect(IMAGES.map((d) => d.key).filter((k) => k !== 'logo' && !inSet.has(k))).toEqual([]);
  });

  it('ロゴは15色まで、8段階の色だけ、明るい緑と赤紫なし', () => {
    const g = drawLogo();
    const def = IMAGES.find((d) => d.key === 'logo')!;
    expect([g.w, g.h]).toEqual([def.w, def.h]);
    const cs = colorsOf([g]);
    expect(cs.size).toBeLessThanOrEqual(15);
    for (const c of cs) expect(okLevel(c) && c !== GREEN && c !== KEY_ACCESSORY, c).toBe(true);
  });

  it('表の絵は全部どれかの担当が描いている(仮の四角がない)', () => {
    const drawn = new Set(Object.values(SETS).flatMap((s) => Object.keys(s)));
    expect(SHEETS.map((d) => d.key).filter((k) => !drawn.has(k))).toEqual([]);
  });
});
