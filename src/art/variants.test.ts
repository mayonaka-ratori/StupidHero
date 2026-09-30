// 服の色ちがい(variants.ts)の表が、絵の決まりを守っているかを確かめる。
// 絵は PixelGrid のまま調べる(キャンバスは使わない)。ゲームの中の塗り替え(recolor.ts)も同じ recolorPixels を使う。
import { describe, expect, it } from 'vitest';
import { ACCESSORY_COLORS, COLOR_VARIANT_COUNT, STAGES, STAGE_IDS, sheetKeyFor, type Look, type StageId } from '../logic';
import { LEVELS, type PixelGrid, md } from './lib';
import { KEY_ACCESSORY, sheetByKey } from './sheets';
import { ART_SETS } from './sets';
import { colorsOf, rgbOf } from './testColors';
import { COLOR_VARIANTS, VARIANTS_PER_LOOK, hasVariants, recolorGrid, rgbInt, variantSwap } from './variants';
import { BAG_RED, BLADE, GOLD, KNIFE_YELLOW, TATTOO, WALLET_BROWN } from './world/palette';
import { GLITCH } from './world3/palette';
import { PSY, WEAK } from './world4/palette';

const SHEETS_BUILT: Record<string, PixelGrid[][]> = Object.assign({}, ...Object.values(ART_SETS).map((s) => s.sheets()));

const hex = (n: number): string => `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;

/**
 * 服に使ってはいけない色(docs/ART_SPEC.md の「決まった所にしか使わない色」と、手がかりの色)。
 * 女ボスの赤いハイヒール(world2/people.ts の HEELS)、店員の名札のオレンジ(world3/people.ts の TAG_BAND)、
 * 女ボスの金の小物の光と影(recolor.ts の GOLD_HI、GOLD_LO)は、ファイルの中だけの色なので、ここに値を書く
 */
const FORBIDDEN: readonly string[] = [
  'rgb(0,255,0)', KEY_ACCESSORY, ...GLITCH, ...PSY, ...WEAK,
  ...KNIFE_YELLOW, ...WALLET_BROWN, ...BAG_RED, ...GOLD, ...TATTOO, ...BLADE,
  ...Object.values(ACCESSORY_COLORS).map((c) => hex(c.color)), hex(0xffff92), hex(0x926d00),
  md(7, 2, 2), md(6, 0, 1), md(3, 0, 1), md(7, 4, 1)
];

/** 色の色あい(0〜360)とあざやかさ(0〜1) */
function hueSat(c: string): { hue: number; sat: number } {
  const [r, g, b] = rgbOf(c)!;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const sat = max === 0 ? 0 : d / max;
  if (d === 0) return { hue: 0, sat };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (h * 60 + 360) % 360, sat };
}

/** 見た目 → そのステージ(ボスの化けた姿も入れる) */
const stageOfLook = new Map<string, StageId>();
for (const id of STAGE_IDS) for (const l of STAGES[id].looks) stageOfLook.set(l, id);

const entries = Object.entries(COLOR_VARIANTS);
const variants = Array.from({ length: VARIANTS_PER_LOOK - 1 }, (_, i) => i + 1);

describe('服の色ちがい', () => {
  it('色ちがいの数は logic と同じ', () => {
    expect(VARIANTS_PER_LOOK).toBe(COLOR_VARIANT_COUNT);
  });

  it('ステージ1〜4の見た目は全部、市民、ワル、ボスの化けた姿のシートまで表に入っている', () => {
    for (const id of STAGE_IDS) {
      const def = STAGES[id];
      for (const look of def.looks) {
        const v = COLOR_VARIANTS[look];
        expect(v, look).toBeDefined();
        for (const truth of ['civ', 'bad'] as const) {
          if (look === 'granny' && truth === 'bad') continue;
          if (look === 'mohawk' && truth === 'civ') continue;
          expect(v.sheets, `${look} ${truth}`).toContain(sheetKeyFor(look, truth, id));
        }
        if (def.disguises.includes(look as never)) expect(v.sheets, `${look} boss`).toContain(sheetKeyFor(look as Look, 'boss', id));
      }
    }
  });

  it('表の形:色ちがいは3つずつ、置きかえの前とあとの色の数が同じ', () => {
    for (const [look, v] of entries) {
      for (const s of v.swaps) {
        expect(s.to.length, look).toBe(VARIANTS_PER_LOOK - 1);
        for (const t of s.to) expect(t.length, look).toBe(s.from.length);
      }
      for (const c of v.shared ?? []) expect(v.swaps.some((s) => s.from.includes(c)), `${look} ${c}`).toBe(true);
    }
  });

  it('色ちがい0と、表にない番号とシートは、塗り替えない(いまの絵のまま)', () => {
    for (const [, v] of entries) for (const key of v.sheets) {
      expect(variantSwap(key, 0)).toBeNull();
      expect(variantSwap(key, undefined)).toBeNull();
      expect(variantSwap(key, VARIANTS_PER_LOOK)).toBeNull();
      expect(hasVariants(key)).toBe(true);
    }
    for (const key of ['hero', 'fp_mohawk', 'fp_gang', 'fp_alien', 'boss', 'prop_car']) {
      expect(hasVariants(key), key).toBe(false);
      expect(variantSwap(key, 2), key).toBeNull();
    }
  });

  it('置きかえる色は、その見た目の絵(全部のシート)に本当にある(絵の色を変えたら表も直す)', () => {
    for (const [look, v] of entries) for (const key of v.sheets) {
      const cs = colorsOf(SHEETS_BUILT[key].flat());
      for (const s of v.swaps) for (const c of s.from) expect(cs.has(c), `${look} ${key} ${c}`).toBe(true);
    }
  });

  it('新しい色は8段階の色で、決まった所にしか使わない色と手がかりの色を使わない', () => {
    const bad = new Set(FORBIDDEN);
    for (const [look, v] of entries) for (const s of v.swaps) for (const t of s.to) for (const c of t) {
      expect(rgbOf(c)!.every((x) => (LEVELS as readonly number[]).includes(x)), `${look} ${c}`).toBe(true);
      expect(bad.has(c), `${look} ${c}`).toBe(false);
    }
    // 置きかえる前の色にも、小物の赤紫と、決まった所にしか使わない色を入れない(入れると小物やくずれの光まで塗り替わる)。
    // 切れかけの蛍光灯のうすい黄色は照明の絵だけの色で、整備士のつなぎに前から同じ色があるので、ここでは見ない。
    // ほかのステージの手がかりの色(赤など)は、その見た目の服の色として前から使っていることがあるので、ここでは見ない
    // (その見た目の手がかりは、下の「ワルのシートにだけある色」で見る)
    const reserved = new Set<string>(['rgb(0,255,0)', KEY_ACCESSORY, ...GLITCH, ...PSY]);
    for (const [look, v] of entries) for (const s of v.swaps) for (const c of s.from) expect(reserved.has(c), `${look} ${c}`).toBe(false);
  });

  it('新しい色は、その絵の服のほかの所の色(肌、髪、ふち、小物など)とかぶらない', () => {
    for (const [look, v] of entries) {
      const shared = new Set(v.shared ?? []);
      const swapped = new Set(v.swaps.flatMap((s) => s.from.filter((c) => !shared.has(c))));
      for (const key of v.sheets) {
        const others = [...colorsOf(SHEETS_BUILT[key].flat())].filter((c) => !swapped.has(c));
        for (const s of v.swaps) for (const t of s.to) for (const c of t) expect(others, `${look} ${key} ${c}`).not.toContain(c);
      }
    }
  });

  it('ワルのシートにだけある色(手がかりの小物)は、置きかえの前にもあとにも入れない', () => {
    for (const [look, v] of entries) {
      const civ = v.sheets.find((k) => k.endsWith('_civ'));
      const bad = v.sheets.find((k) => k.endsWith('_bad'));
      if (!civ || !bad) continue;
      const civColors = colorsOf(SHEETS_BUILT[civ].flat());
      const tell = [...colorsOf(SHEETS_BUILT[bad].flat())].filter((c) => !civColors.has(c));
      const used = v.swaps.flatMap((s) => [...s.from, ...s.to.flat()]);
      for (const c of tell) expect(used, `${look} ${c}`).not.toContain(c);
    }
  });

  it('ステージ2の服は、小物の6色と金に見えない色(あざやかでない色か、青)だけ(こげ茶のいちばん暗い色まではよい)', () => {
    for (const look of STAGES.garage.looks) for (const s of COLOR_VARIANTS[look].swaps) for (const t of s.to) for (const c of t) {
      const { hue, sat } = hueSat(c);
      expect(sat <= 0.55 || (hue >= 215 && hue <= 255), `${look} ${c}`).toBe(true);
    }
  });

  it('ステージ3の服は、くずれの黄緑に見えない(黄緑から黄の色あいのあざやかな色を使わない)', () => {
    for (const look of STAGES.mall.looks) for (const s of COLOR_VARIANTS[look].swaps) for (const t of s.to) for (const c of t) {
      const { hue, sat } = hueSat(c);
      expect(sat > 0.3 && hue >= 50 && hue <= 150, `${look} ${c}`).toBe(false);
    }
  });

  it('ステージ4の服は、もれの紫に見えない(紫から赤紫の色あいのあざやかな色を使わない)', () => {
    for (const look of STAGES.tower.looks) for (const s of COLOR_VARIANTS[look].swaps) for (const t of s.to) for (const c of t) {
      const { hue, sat } = hueSat(c);
      expect(sat > 0.3 && hue >= 255 && hue <= 340, `${look} ${c}`).toBe(false);
    }
  });

  describe.each(entries)('%s', (_look, v) => {
    it.each(variants)('色ちがい%i:服の色のドットだけが表の通りに変わり、1枚15色まで', (variant) => {
      const shared = new Set(v.shared ?? []);
      for (const key of v.sheets) {
        const swap = variantSwap(key, variant)!;
        const rows = SHEETS_BUILT[key];
        const def = sheetByKey(key);
        const out = rows.map((frames) => frames.map((g) => recolorGrid(g, swap)));
        expect(colorsOf(out.flat()).size, key).toBeLessThanOrEqual(15);
        let changed = 0, keptShared = 0;
        rows.forEach((frames, r) => frames.forEach((g, i) => {
          const o = out[r][i];
          expect([o.w, o.h]).toEqual([def.frameW, def.frameH]);
          for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
            const a = g.cells[y][x], b = o.cells[y][x];
            if (a === b) {
              // 置きかえる色なのに残ってよいのは shared の色だけ(色ちがいで同じ色にしたときをのぞく)
              if (a && swap.map.has(rgbInt(a)) && swap.map.get(rgbInt(a)) !== rgbInt(a)) {
                expect(shared.has(a), `${key} 行${r} (${x},${y}) ${a}`).toBe(true);
                keptShared++;
              }
              continue;
            }
            expect(a, `${key} 行${r} (${x},${y})`).not.toBeNull();
            expect(swap.map.get(rgbInt(a!)), `${key} 行${r} (${x},${y}) ${a}`).toBe(rgbInt(b!));
            changed++;
          }
        }));
        expect(changed, key).toBeGreaterThan(0);
        if (shared.size === 0) expect(keptShared, key).toBe(0);
      }
    });
  });
});
