// コードで描いた絵のシートを、ブラウザなしでPNGに書き出す(絵を描き直すときに見比べる用)。
// 使い方: node tools/artsheet.mjs [キー(カンマ区切り。all で全部)] [倍率] [出力フォルダ]
//   例: node tools/artsheet.mjs hero 4 shots/art
//       node tools/artsheet.mjs civ_hoodie,bad_hoodie,bg_alley_far 3
//       node tools/artsheet.mjs tw_,bg_tower 3   (表にないキーは、その頭で始まるキーを全部書き出す)
// キーは src/art/sheets.ts のシートと背景の名前。省くと all、倍率は 4、出力フォルダは shots/art。
// コマの境目には細い線を引く(絵の外の色なので、絵とまぎれない)。
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { parseColor, writePng as writePngShared } from './png.mjs';

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
  const want = keysArg === 'all' ? allKeys : keysArg.split(',').flatMap((k) => (sheets[k] || images[k] ? [k] : byHead(k)));
  for (const key of want) {
    if (sheets[key]) writePng(`${outDir}/${key}.png`, sheetPixels(sheets[key]));
    else if (images[key]) writePng(`${outDir}/${key}.png`, gridPixels(images[key]()));
    else { console.warn(`ない: ${key}`); continue; }
    console.log(`${outDir}/${key}.png`);
  }
} finally {
  await server.close();
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

function writePng(path, { w, h, px }) {
  writePngShared(path, { w, h, px, scale });
}
