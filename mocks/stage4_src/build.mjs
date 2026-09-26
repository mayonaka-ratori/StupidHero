// ステージ4の見本の絵を mocks/stage4/ にPNGで書き出す。
// 使い方: node mocks/stage4_src/build.mjs
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { parseColor, writePng as writePngShared } from '../../tools/png.mjs';

const outDir = 'mocks/stage4';
mkdirSync(outDir, { recursive: true });
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { buildImages } = await server.ssrLoadModule('/mocks/stage4_src/scenes.ts');
  for (const [name, { grid, scale }] of Object.entries(buildImages())) {
    writePng(`${outDir}/${name}.png`, grid, scale);
    console.log(`${outDir}/${name}.png ${grid.w}x${grid.h} x${scale}`);
  }
} finally {
  await server.close();
}

function writePng(path, g, scale) {
  const px = g.cells.map((r) => r.map(parseColor));
  writePngShared(path, { w: g.w, h: g.h, px, scale });
}
