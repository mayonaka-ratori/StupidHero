// コードで描いた絵のシートを、ブラウザなしでPNGに書き出す(絵を描き直すときに見比べる用)。
// 使い方: node tools/artsheet.mjs [キー(カンマ区切り。all で全部)] [倍率] [出力フォルダ]
//   例: node tools/artsheet.mjs hero 4 shots/art
//       node tools/artsheet.mjs civ_hoodie,bad_hoodie,bg_alley_far 3
//       node tools/artsheet.mjs tw_,bg_tower 3   (表にないキーは、その頭で始まるキーを全部書き出す)
//       node tools/artsheet.mjs variants 3       (服の色ちがいの見本。見た目ごとに variants_<見た目>.png)
//       node tools/artsheet.mjs variants:hoodie,guard 3
// キーは src/art/sheets.ts のシートと背景の名前。省くと all、倍率は 4、出力フォルダは shots/art。
// コマの境目には細い線を引く(絵の外の色なので、絵とまぎれない)。
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { parseColor, writePng } from './png.mjs';

const [keysArg = 'all', scaleArg = '4', outDir = 'shots/art'] = process.argv.slice(2);
const scale = Math.max(1, Number(scaleArg) | 0);
mkdirSync(outDir, { recursive: true });
const BG = [58, 52, 82, 255];
const LINE = [90, 84, 120, 255];
const parse = (c) => parseColor(c, [255, 0, 255, 255]);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const load = (p) => server.ssrLoadModule(p);
  const { buildHeroSheets } = await load('/src/art/heroSet.ts');
  const { buildWorldSheets, WORLD_BGS } = await load('/src/art/worldSet.ts');
  const { buildWorld2Sheets, WORLD2_IMAGES } = await load('/src/art/world2/index.ts');
  const { buildWorld3Sheets, WORLD3_IMAGES } = await load('/src/art/world3/index.ts');
  const { buildWorld4Sheets, WORLD4_IMAGES } = await load('/src/art/world4/index.ts');
  const { buildFreeSheets } = await load('/src/art/free/index.ts');
  const sheets = { ...buildHeroSheets(), ...buildWorldSheets(), ...buildWorld2Sheets(), ...buildWorld3Sheets(), ...buildWorld4Sheets(), ...buildFreeSheets() };
  const images = { ...WORLD_BGS, ...WORLD2_IMAGES, ...WORLD3_IMAGES, ...WORLD4_IMAGES };
  const allKeys = [...Object.keys(sheets), ...Object.keys(images)];
  const byHead = (k) => { const hit = allKeys.filter((x) => x.startsWith(k)); return hit.length ? hit : [k]; };
  if (keysArg.startsWith('variants')) await writeVariants(keysArg.split(':')[1]?.split(','), sheets, await load('/src/art/variants.ts'), (await load('/src/art/sheets.ts')).TELL_BASE);
  const want = keysArg.startsWith('variants') ? [] : keysArg === 'all' ? allKeys : keysArg.split(',').flatMap((k) => (sheets[k] || images[k] ? [k] : byHead(k)));
  for (const key of want) {
    if (sheets[key]) writePng(`${outDir}/${key}.png`, { ...sheetPixels(sheets[key]), scale });
    else if (images[key]) writePng(`${outDir}/${key}.png`, { ...gridPixels(images[key]()), scale });
    else { console.warn(`ない: ${key}`); continue; }
    console.log(`${outDir}/${key}.png`);
  }
} finally {
  await server.close();
}

/**
 * 服の色ちがい(src/art/variants.ts)の見本。見た目ごとに1枚で、行が色ちがい0〜3、
 * 列はシートごとに、待機、歩く、仕分けの動き、驚く、吹っ飛ぶ、のびている(ボスの化けた姿は待機と仕分けの動き2コマ)。
 * そのあとに、手がかりの出し分けの絵(sheets.ts の TELL_BASE)の仕分けの動き1コマを並べる(小物の色が変わらないかを見る)
 */
function writeVariants(looks, sheets, V, tellBase) {
  for (const name of looks ?? Object.keys(V.COLOR_VARIANTS)) {
    const def = V.COLOR_VARIANTS[name];
    if (!def) { console.warn(`ない: ${name}`); continue; }
    const rows = [];
    for (let v = 0; v < V.VARIANTS_PER_LOOK; v++) {
      const row = [];
      for (const key of def.sheets) {
        const s = sheets[key];
        const pick = s.length > 3 ? [[0, 0], [1, 1], [2, 0], [3, 0], [4, 1], [5, 0]] : [[0, 0], [2, 0], [2, 2]];
        const swap = V.variantSwap(key, v);
        for (const [r, i] of pick) row.push(swap ? V.recolorGrid(s[r][i], swap) : s[r][i]);
      }
      for (const [tell, base] of Object.entries(tellBase)) {
        if (!def.sheets.includes(base)) continue;
        const swap = V.variantSwap(tell, v);
        const g = sheets[tell][2][0];
        row.push(swap ? V.recolorGrid(g, swap) : g);
      }
      rows.push(row);
    }
    const path = `${outDir}/variants_${name}.png`;
    writePng(path, { ...sheetPixels(rows), scale });
    console.log(path);
  }
}

/** 1枚の格子を、背景の色で埋めた画素の表にする */
function gridPixels(g) {
  const px = Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => (g.cells[y][x] ? parse(g.cells[y][x]) : BG)));
  return { w: g.w, h: g.h, px };
}

/** コマを行ごとに並べ、境目に1ドットの線を入れる */
function sheetPixels(rows) {
  const fw = rows[0][0].w, fh = rows[0][0].h;
  const cols = Math.max(...rows.map((r) => r.length));
  const w = cols * (fw + 1) + 1, h = rows.length * (fh + 1) + 1;
  const px = Array.from({ length: h }, () => Array.from({ length: w }, () => LINE));
  rows.forEach((row, r) => row.forEach((g, i) => {
    const p = gridPixels(g).px;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) px[1 + r * (fh + 1) + y][1 + i * (fw + 1) + x] = p[y][x];
  }));
  return { w, h, px };
}
