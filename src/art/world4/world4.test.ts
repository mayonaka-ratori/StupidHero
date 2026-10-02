// ステージ4の絵の決まり(docs/STAGE4.md、docs/ART_SPEC.md)を確かめる。絵は PixelGrid のまま調べる。
// 色の数や8段階の色、紫を使ってよい絵など、どのステージにもある決まりは src/art/artRules.test.ts で確かめる。
import { describe, expect, it } from 'vitest';
import { type PixelGrid } from '../lib';
import { bbox } from '../world/pix';
import { WHITE } from '../world/palette';
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
  // 行とコマの数がシートの表と合うかは artRules.test.ts で確かめる
  it('人は8種類とも、見た目のくせ(行2)と念力(行6)が4コマとも動く', () => {
    for (const look of LOOKS) {
      const rows = sheets[`tw_${look}`];
      for (const r of [2, 6]) for (let i = 1; i < 4; i++) expect(diff(rows[r][0], rows[r][i]), `${look} 行${r} コマ${i}`).toBeGreaterThan(4);
    }
  });

  it('化けた姿は、同じ見た目の市民と違う絵(おかしな所がある)', () => {
    for (const look of ['lady', 'magician', 'waiter']) {
      const d = sheets[`tw_boss_${look}`];
      expect(diff(d[0][0], sheets[`tw_${look}`][0][0]), look).toBeGreaterThan(20);
    }
  });

  it('照明:ふつうと切れかけは紫を使わず、もれと紫のセロハンが紫。セロハンは、もれと違う所(めくれ)がある', () => {
    const [normal, leak, weak, weak2, cellophane] = sheets.fx_psy_lamp[0];
    expect(hasPsy(leak)).toBe(true);
    expect(hasPsy(cellophane)).toBe(true);
    for (const g of [normal, weak, weak2]) expect(hasPsy(g)).toBe(false);
    // めくれ(管の下にたれる紫)と、管の両端の白が、見てわかる大きさで違う
    expect(diff(leak, cellophane)).toBeGreaterThan(20);
  });

  it('照明:スマホでも見分けられる大きさ。セロハンは管の両端の4列が白く、めくれは6×5。もれは本体の左右を紫のもやが包む', () => {
    const [normal, leak, , , cellophane] = sheets.fx_psy_lamp[0];
    const W = normal.w;
    // 管(6〜7段目)の左の端の4列(x=4〜7)と右の端の4列(x=32〜35)が白
    for (const x of [4, 5, 6, 7, 32, 33, 34, 35]) for (const y of [6, 7]) expect(cellophane.get(x, y), `x=${x} y=${y}`).toBe(WHITE[0]);
    // めくれたセロハン:管の下(8段目から)の右の端に、紫が横6ドット、縦5段以上
    const flap: [number, number][] = [];
    for (let y = 8; y < 14; y++) for (let x = 28; x < W; x++) if (psy.has(cellophane.get(x, y) ?? '')) flap.push([x, y]);
    const fx = flap.map(([x]) => x), fy = flap.map(([, y]) => y);
    expect(Math.max(...fx) - Math.min(...fx) + 1).toBeGreaterThanOrEqual(6);
    expect(Math.max(...fy) - Math.min(...fy) + 1).toBeGreaterThanOrEqual(5);
    // もれのもや:左右の端の2列(1〜11段目)に紫がある。紫のセロハンにはない
    const sidePsy = (g: PixelGrid): number => {
      let n = 0;
      for (let y = 1; y < 12; y++) for (const x of [0, 1, W - 2, W - 1]) if (psy.has(g.get(x, y) ?? '')) n++;
      return n;
    };
    expect(sidePsy(leak)).toBeGreaterThanOrEqual(16);
    expect(sidePsy(cellophane)).toBe(0);
  });

  it('火花:仕分けの画面で使うコマ(0〜2)は十字で、2は縦横7ドットの十字', () => {
    const sparks = sheets.fx_psy_spark[0];
    const c = Math.floor(sparks[0].w / 2);
    const arm = (g: PixelGrid): number => { let r = 0; while (g.get(c + r + 1, c) && g.get(c, c + r + 1)) r++; return r; };
    expect([0, 1, 2].map((i) => arm(sparks[i]))).toEqual([1, 2, 3]);
  });

  it('仕分けの画面の小さな机は26×20で、天板の高さは tw_desk と同じ(ふちが2段目、上の面が3〜4段目)', () => {
    const [[d]] = sheets.tw_desk_s;
    expect([d.w, d.h]).toEqual([26, 20]);
    expect(bbox(d)!.y0).toBe(2);
    expect(bbox(sheets.tw_desk[0][0])!.y0).toBe(2);
  });

  it('机と会場の小物は8つとも3×3ドット以上で、紫を使わない(もやはコードで重ねる)', () => {
    const items = sheets.fx_psy_items[0];
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
