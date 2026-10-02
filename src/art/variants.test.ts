// 服の色ちがい(variants.ts)の表が、絵の決まりを守っているかを確かめる。
// 絵は PixelGrid のまま調べる(キャンバスは使わない)。ゲームの中の塗り替え(recolor.ts)も同じ recolorPixels を使う。
import { describe, expect, it } from 'vitest';
import { ACCESSORY_COLORS, COLOR_VARIANT_COUNT, STAGES, STAGE_IDS, sheetKeyFor, type Look, type StageId } from '../logic';
import { LEVELS, type PixelGrid, md } from './lib';
import { KEY_ACCESSORY, TELL_BASE, sheetByKey } from './sheets';
import { ART_SETS } from './sets';
import { colorsOf, rgbOf } from './testColors';
import { COLOR_VARIANTS, VARIANTS_PER_LOOK, hasVariants, recolorGrid, recolorPixels, rgbInt, variantSwap, type VariantSwap } from './variants';
import { BAG_RED, BLADE, GOLD, KNIFE_YELLOW, TATTOO, WALLET_BROWN } from './world/palette';
import { buildItemlessPeople } from './world/people';
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

const entries = Object.entries(COLOR_VARIANTS);

/**
 * 小物のドットを比べるときに見ない行(吹っ飛ぶ、のびている)。このコマは絵全体の置き場所を人の形から決めるので、
 * 小物の大きさで絵全体がずれ、服のドットまで違って見える。小物は同じ描き方なので、ほかの行を見れば色がわかる
 */
const SHIFTED_ROWS: readonly number[] = [4, 5];
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

  it('表の形:置きかえの前とあとの色の数が同じ。shared の色は置きかえる色の中にある', () => {
    // 色ちがいが3つずつなのは、表の型(to は3つの組)で決まる
    for (const [look, v] of entries) {
      for (const s of v.swaps) for (const t of s.to) expect(t.length, look).toBe(s.from.length);
      for (const c of v.shared ?? []) expect(v.swaps.some((s) => s.from.includes(c)), `${look} ${c}`).toBe(true);
    }
  });

  it('色ちがい0と、表にない番号とシートは、塗り替えない(いまの絵のまま)', () => {
    // 番号の確かめはシートによらないので、1枚で見る
    const key = entries[0][1].sheets[0];
    for (const n of [0, undefined, VARIANTS_PER_LOOK]) expect(variantSwap(key, n), `${key} ${n}`).toBeNull();
    expect(variantSwap(key, 1), key).not.toBeNull();
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

  it('ステージ2〜4の服の新しい色は、そのステージの手がかりの色に見えない', () => {
    const rules: { stage: StageId; rule: string; ok: (hue: number, sat: number) => boolean }[] = [
      // 小物の6色と金に見えない色(あざやかでない色か、青)だけ(こげ茶のいちばん暗い色まではよい)
      { stage: 'garage', rule: '小物の6色と金に見える', ok: (hue, sat) => sat <= 0.55 || (hue >= 215 && hue <= 255) },
      // くずれの黄緑に見えない(黄緑から黄の色あいのあざやかな色を使わない)
      { stage: 'mall', rule: 'くずれの黄緑に見える', ok: (hue, sat) => !(sat > 0.3 && hue >= 50 && hue <= 150) },
      // もれの紫に見えない(紫から赤紫の色あいのあざやかな色を使わない)
      { stage: 'tower', rule: 'もれの紫に見える', ok: (hue, sat) => !(sat > 0.3 && hue >= 255 && hue <= 340) }
    ];
    const bad: string[] = [];
    for (const { stage, rule, ok } of rules) {
      for (const look of STAGES[stage].looks) for (const s of COLOR_VARIANTS[look].swaps) for (const t of s.to) for (const c of t) {
        const { hue, sat } = hueSat(c);
        if (!ok(hue, sat)) bad.push(`${stage} ${look} ${c}:${rule}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('手がかりの出し分けの絵も塗り替え、出し分けの小物だけの色は置きかえない', () => {
    // 出し分けの絵だけいまの色のままだと、色でワルが分かってしまう。
    // 出し分けの絵は元の絵と同じ表を使う(variants.ts の lookOfSheet)。置きかえる前の色は色ちがい1〜3で同じなので、1つで見る
    for (const [tellKey, base] of Object.entries(TELL_BASE)) {
      const baseColors = colorsOf(SHEETS_BUILT[base].flat());
      const own = [...colorsOf(SHEETS_BUILT[tellKey].flat())].filter((c) => !baseColors.has(c));
      const swap = variantSwap(tellKey, 1);
      expect(swap, tellKey).not.toBeNull();
      for (const c of own) expect(swap!.map.has(rgbInt(c)), `${tellKey} ${c}`).toBe(false);
    }
  });

  it('ステージ1の手がかりの小物のドットは、服の置きかえる色を、置きかえの前もあとも使わない(小物が塗り替わったり、服の色ちがいにとけこんだりしない)', () => {
    // 小物のドットは、小物を描かない絵と比べて取り出す(小物が服と同じ色だと、出し分けの絵だけの色を見てもわからない)
    const itemless = buildItemlessPeople();
    const bad: string[] = [];
    for (const [base, bare] of Object.entries(itemless)) {
      const v = entries.find(([, e]) => e.sheets.includes(base))![1];
      const cloth = new Set(v.swaps.flatMap((s) => [...s.from, ...s.to.flat()]));
      for (const key of [base, ...Object.keys(TELL_BASE).filter((k) => TELL_BASE[k] === base)]) {
        const found = new Set<string>();
        SHEETS_BUILT[key].forEach((frames, r) => frames.forEach((g, i) => {
          if (SHIFTED_ROWS.includes(r)) return;
          for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
            const c = g.cells[y][x];
            if (c && c !== bare[r][i].cells[y][x] && cloth.has(c)) found.add(c);
          }
        }));
        for (const c of found) bad.push(`${key} ${c}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('手がかりの出し分けの絵で元の絵と違うドットは、服の置きかえる色で服の上に描いていない(小物が塗り替わらない)', () => {
    // 元の絵で服(置きかえる色)か何もない所に、置きかえる色のドットがあれば、小物を服の色で描いている。
    // 元の小物があった所に服が見えるのはよい(元の絵のドットは服の色でない)。
    // ステージ3の宇宙人のくずれ(浮いた頭、3本目の腕、開いたおなか)は体の一部なので、服といっしょに塗り替わってよい。見ない
    const bad: string[] = [];
    for (const [tellKey, base] of Object.entries(TELL_BASE)) {
      if (sheetByKey(base).rows.length === 8) continue;
      const from = new Set(entries.find(([, e]) => e.sheets.includes(base))![1].swaps.flatMap((s) => s.from));
      const found = new Set<string>();
      SHEETS_BUILT[tellKey].forEach((frames, r) => frames.forEach((g, i) => {
        if (SHIFTED_ROWS.includes(r)) return;
        const b = SHEETS_BUILT[base][r][i];
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
          const c = g.cells[y][x], o = b.cells[y][x];
          if (c && c !== o && from.has(c) && (o === null || from.has(o))) found.add(`行${r} ${c}`);
        }
      }));
      for (const c of found) bad.push(`${tellKey} ${c}`);
    }
    expect(bad).toEqual([]);
  });

  it('色ちがいのあとも1枚15色まで(手がかりの出し分けの絵も)', () => {
    const over: string[] = [];
    for (const [look, v] of entries) {
      const keys = [...v.sheets, ...Object.keys(TELL_BASE).filter((k) => v.sheets.includes(TELL_BASE[k]))];
      for (const variant of variants) for (const key of keys) {
        const swap = variantSwap(key, variant)!;
        const rows = SHEETS_BUILT[key];
        let n: number;
        if (swap.shared.size > 0) {
          // shared の色は、となりの色やかたまりの大きさで残ることがあるので、ドットを塗り替えて数える
          n = colorsOf(rows.flatMap((frames) => frames.map((g) => recolorGrid(g, swap)))).size;
        } else {
          // shared がなければ、置きかえる色はいつも全部変わる(下の recolorPixels のテストで確かめる)ので、色の組だけで数える
          const out = new Set<number>();
          for (const c of colorsOf(rows.flat())) out.add(swap.map.get(rgbInt(c)) ?? rgbInt(c));
          n = out.size;
        }
        if (n > 15) over.push(`${look} ${key} 色ちがい${variant}:${n}色`);
      }
    }
    expect(over).toEqual([]);
  });
});

describe('ドットの塗り替え(recolorPixels)', () => {
  // 小さな絵で決まりを確かめる。a は服の色、s と t は shared の色(靴の影などにも使う色)、x は表にない色、. は透明。
  // 大文字は塗り替えたあとの色(A、S、T)
  const CODE: Record<string, number> = { '.': -1, a: 1, s: 2, t: 4, x: 3, A: 10, S: 20, T: 40 };
  const SWAP: VariantSwap = { map: new Map([[1, 10], [2, 20], [4, 40]]), shared: new Set([2, 4]) };
  const toPx = (rows: string[]): Int32Array => Int32Array.from(rows.join('').split('').map((c) => CODE[c]));
  // 16×8 の絵。コマは 8×4 で、横に2つ、縦に2つ
  const SHEET = [
    'aas.....' + 'tsa.....',
    '....ss..' + '........',
    'x.......' + '....ssss',
    '........' + 'a...ssss',
    'ssss....' + 's...ssss',
    'ssss...a' + 's...ssss',
    'ssss....' + '........',
    'ssss....' + '........'
  ];

  it('shared の色は、服のドットにとなり合うかたまりと16ドット以上のかたまりだけ変わり、コマの境目をまたいでつながらない', () => {
    // 左上のコマ:服にとなり合う s は変わり、はなれた2ドットの s は残る。表にない x は変わらない。
    // 右上のコマ:t は s をはさんで服につながるので、s と t の両方が変わる。
    // 左下のコマ:16ドットの s のかたまりは、服にとなり合わなくても変わる。
    // 右下のコマ:左のコマの a と上のコマの a のすぐとなりの s も、上のコマの s とつながると16ドットになる s も、コマが違うので残る
    const out = recolorPixels(toPx(SHEET), 16, 8, 8, 4, SWAP);
    expect(Array.from(out)).toEqual(Array.from(toPx([
      'AAS.....' + 'TSA.....',
      '....ss..' + '........',
      'x.......' + '....ssss',
      '........' + 'A...ssss',
      'SSSS....' + 's...ssss',
      'SSSS...A' + 's...ssss',
      'SSSS....' + '........',
      'SSSS....' + '........'
    ])));
  });

  it('1枚のコマとして見れば、コマの境目で残っていた s もつながって変わる(上のテストで残ったのはコマの境目のため)', () => {
    const out = recolorPixels(toPx(SHEET), 16, 8, 16, 8, SWAP);
    expect(Array.from(out)).toEqual(Array.from(toPx([
      'AAS.....' + 'TSA.....',
      '....ss..' + '........',
      'x.......' + '....SSSS',
      '........' + 'A...SSSS',
      'SSSS....' + 'S...SSSS',
      'SSSS...A' + 'S...SSSS',
      'SSSS....' + '........',
      'SSSS....' + '........'
    ])));
  });
});
