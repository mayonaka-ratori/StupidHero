// フリープレイの絵の決まり(docs/FREEPLAY.md の「絵」「波3」)を確かめる。絵は PixelGrid のまま調べる。
// 色の数や8段階の色など、どの絵にもある決まりは src/art/artRules.test.ts で確かめる。
import { describe, expect, it } from 'vitest';
import type { PixelGrid } from '../lib';
import { KEY_ACCESSORY, SHEETS, originFor, sheetByKey } from '../sheets';
import { BLADE } from '../world/palette';
import { GLITCH } from '../world3/palette';
import { FREE_ITEMS } from '../../logic/freeNames';
import { buildFreeSheets } from './index';
import { FREE_ITEM_ICONS, FREE_ITEM_SHEETS, FREE_LOOK_SHEETS, itemAnchor } from './items';
import { buildWorldSheets } from '../worldSet';
import { buildWorld2Sheets } from '../world2';
import { buildWorld3Sheets } from '../world3';

const free = buildFreeSheets();
const people: Record<string, PixelGrid[][]> = { ...buildWorldSheets(), ...buildWorld2Sheets(), ...buildWorld3Sheets(), ...free };

const rgb = (c: string): [number, number, number] => {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c)!;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
/** 色あい(0〜360)、あざやかさ、明るさ(0〜1) */
const hsv = (c: string): [number, number, number] => {
  const [r, g, b] = rgb(c).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max];
};
/** 小物に使ってはいけない色(赤、水色、赤紫、黄緑)か */
const forbidden = (c: string): string | null => {
  if (c === KEY_ACCESSORY) return '赤紫(塗り替え)';
  if ((GLITCH as readonly string[]).includes(c)) return '黄緑(くずれ)';
  const [h, s, v] = hsv(c);
  if (s < 0.45 || v < 0.45) return null;
  if (h < 15 || h >= 340) return '赤';
  if (h >= 170 && h < 205) return '水色';
  if (h >= 280 && h < 340) return '赤紫';
  if (h >= 70 && h < 100 && v > 0.6) return '黄緑';
  return null;
};
const colorsOf = (grids: PixelGrid[]): Set<string> => {
  const s = new Set<string>();
  for (const g of grids) for (const row of g.cells) for (const c of row) if (c) s.add(c);
  return s;
};

/** 人の待機の1コマ目に、小物を itemAnchor の場所で置いたときの、小物のドット(コマの中の座標) */
function itemPixels(sheetKey: string, item: (typeof FREE_ITEMS)[number]): { x: number; y: number }[] {
  const a = itemAnchor(sheetKey, item)!;
  const key = FREE_ITEM_SHEETS[item];
  const g = free[key][0][0];
  const [ox, oy] = originFor(key);
  const out: { x: number; y: number }[] = [];
  for (let iy = 0; iy < g.h; iy++) for (let ix = 0; ix < g.w; ix++) {
    if (!g.cells[iy][ix]) continue;
    out.push({ x: 32 + a.dx + ix - ox * g.w, y: 60 + a.dy + iy - oy * g.h });
  }
  return out;
}

/** ワルの目印のドット(ナイフの刃、バンダナとバット、触角) */
const MARK: Record<string, (c: string, x: number, y: number) => boolean> = {
  fp_mohawk: (c, _x, y) => (BLADE as readonly string[]).includes(c) && y < 16,
  fp_gang: (c, x) => c === 'rgb(73,73,219)' || (x >= 44 && c !== 'rgb(36,0,36)'),
  fp_alien: (c) => (GLITCH as readonly string[]).includes(c)
};

describe('フリープレイの絵', () => {
  it('一目で分かるワルは、ふつうのワルと同じ7行で、悪さの当たりは3コマ目', () => {
    for (const key of ['fp_mohawk', 'fp_gang', 'fp_alien']) {
      const d = sheetByKey(key);
      expect(d.rows.map((r) => r.name), key).toEqual(['idle', 'walk', 'sortIdle', 'surprised', 'knocked', 'down', 'mischief']);
      expect(d.rows[6].hits, key).toEqual([3]);
      expect(free[key].length, key).toBe(7);
    }
  });

  it('ワルの目印がはっきり出ている(ナイフの刃が頭の上、バンダナとバット、黄緑の触角)', () => {
    for (const key of Object.keys(MARK)) {
      const g = free[key][0][0];
      let n = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const c = g.cells[y][x]; if (c && MARK[key](c, x, y)) n++; }
      expect(n, key).toBeGreaterThanOrEqual(8);
    }
  });

  it('小物とルールの札は、赤、水色、赤紫、黄緑を使わない', () => {
    const keys = [...Object.values(FREE_ITEM_SHEETS), ...Object.values(FREE_ITEM_ICONS)];
    for (const key of keys) for (const c of colorsOf(free[key].flat())) expect(forbidden(c), `${key} ${c}`).toBeNull();
  });

  it('小物のいちばん多い色(白と灰色、ふちを除く)は、風船が黄色、帽子が緑、紙袋が茶色', () => {
    const main = (key: string): [number, number, number] => {
      const n = new Map<string, number>();
      for (const row of free[key][0][0].cells) for (const c of row) if (c && hsv(c)[1] > 0.3 && hsv(c)[2] > 0.2) n.set(c, (n.get(c) ?? 0) + 1);
      return hsv([...n.entries()].sort((p, q) => q[1] - p[1])[0][0]);
    };
    const [hb] = main('fp_item_balloon'), [hh, , vh] = main('fp_item_hat'), [hg, , vg] = main('fp_item_bag');
    expect(hb >= 40 && hb < 65, `風船 ${hb}`).toBe(true);
    expect(hh >= 100 && hh < 160 && vh < 0.6, `帽子 ${hh}`).toBe(true);
    expect(hg >= 15 && hg < 40 && vg < 0.9, `紙袋 ${hg}`).toBe(true);
  });

  it('紙袋は6×8ドット以上', () => {
    const g = free.fp_item_bag[0][0];
    const paper = new Set<string>();
    for (const row of g.cells) for (const c of row) if (c && c !== 'rgb(36,0,36)') paper.add(c);
    let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
    g.cells.forEach((row, y) => row.forEach((c, x) => {
      if (!c || !paper.has(c) || y < 4) return;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }));
    expect(x1 - x0 + 1).toBeGreaterThanOrEqual(6);
    expect(y1 - y0 + 1).toBeGreaterThanOrEqual(8);
  });

  it('付ける場所の表:フリープレイに出る全部の見た目にあり、紙袋は買い物袋の女性とおじさんだけ付けない', () => {
    const civ = SHEETS.map((d) => d.key).filter((k) => k.endsWith('_civ'));
    expect([...FREE_LOOK_SHEETS].sort()).toEqual([...civ, 'fp_mohawk', 'fp_gang', 'fp_alien'].sort());
    for (const key of FREE_LOOK_SHEETS) for (const item of FREE_ITEMS) {
      const a = itemAnchor(key, item);
      if (item === 'bag' && (key === 'shopper_civ' || key === 'uncle_civ')) expect(a, key).toBeNull();
      else expect(a, `${key} ${item}`).not.toBeNull();
    }
    expect(itemAnchor('guard_civ#ff8000', 'hat')).toEqual(itemAnchor('guard_civ', 'hat'));
    expect(itemAnchor('hero', 'hat')).toBeNull();
  });

  it('付ける場所が絵と合う:風船のひもと紙袋の持ち手は手の上、帽子は頭の上に乗る', () => {
    for (const key of FREE_LOOK_SHEETS) {
      const g = people[key][0][0];
      for (const item of ['balloon', 'bag'] as const) {
        const a = itemAnchor(key, item);
        if (!a) continue;
        const x = 32 + a.dx, y = (item === 'balloon' ? 59 : 60) + a.dy;
        expect(g.cells[y][x], `${key} ${item} (${x},${y})`).not.toBeNull();
      }
      // 帽子のいちばん下の段のすぐ下(3段まで)に、頭か髪がある
      const hat = itemAnchor(key, 'hat')!;
      const by = 59 + hat.dy, cx = 32 + hat.dx;
      let under = 0;
      for (let y = by; y <= by + 3; y++) for (let x = cx - 2; x <= cx + 1; x++) if (g.cells[y]?.[x]) under++;
      expect(under, `${key} 帽子`).toBeGreaterThan(4);
    }
  });

  it('小物を重ねても、ワルの目印(ナイフ、バンダナ、バット、触角)は隠れない', () => {
    for (const key of Object.keys(MARK)) {
      const g = people[key][0][0];
      for (const item of FREE_ITEMS) {
        const a = itemAnchor(key, item)!;
        if (!a.front) continue;
        const hidden = itemPixels(key, item).filter(({ x, y }) => {
          const c = g.cells[y]?.[x];
          return !!c && MARK[key](c, x, y);
        });
        expect(hidden.length, `${key} ${item}`).toBe(0);
      }
    }
  });

  it('ヒーローの光は形で見分けられる:殴りかかるほうはトゲトゲ、素通りのほうは丸', () => {
    /** 真ん中から外へたどって最初に当たる輪の、外の端までの距離の、いちばん大きいものと小さいものの差(泡は数えない) */
    const spread = (g: PixelGrid): number => {
      const ds: number[] = [];
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        let last = 0, inRing = false;
        for (let r = 0; r < 40; r += 0.25) {
          const x = Math.floor(32 + Math.cos(a) * r), y = Math.floor(33 + Math.sin(a) * r * 1.5);
          if (x < 0 || y < 0 || x > 63 || y > 63) break;
          if (g.cells[y][x]) { last = r; inRing = true; } else if (inRing) break;
        }
        ds.push(last);
      }
      const inner = ds.slice().sort((p, q) => p - q)[48];
      return (Math.max(...ds) - Math.min(...ds)) / inner;
    };
    for (const key of ['fx_aura_attack', 'fx_aura_attack_line']) for (const g of free[key][0]) expect(spread(g), key).toBeGreaterThan(0.18);
    for (const key of ['fx_aura_pass', 'fx_aura_pass_line']) expect(spread(free[key][0][0]), key).toBeLessThan(0.12);
    expect(free.fx_aura_attack_line[0].length).toBe(1);
    expect(free.fx_aura_pass_line[0].length).toBe(1);
    // 大きさは fx_aura と同じ
    for (const key of ['fx_aura_attack', 'fx_aura_pass', 'fx_aura_attack_line', 'fx_aura_pass_line']) {
      expect([sheetByKey(key).frameW, sheetByKey(key).frameH]).toEqual([sheetByKey('fx_aura').frameW, sheetByKey('fx_aura').frameH]);
    }
  });
});
