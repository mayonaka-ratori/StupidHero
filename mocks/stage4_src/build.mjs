// ステージ4の見本の絵を mocks/stage4/ にPNGで書き出す。
// 使い方: node mocks/stage4_src/build.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

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

function parse(c) {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c ?? '');
  return m ? [+m[1], +m[2], +m[3], 255] : [0, 0, 0, 0];
}

function writePng(path, g, scale) {
  const W = g.w * scale, H = g.h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  const rows = g.cells.map((r) => r.map(parse));
  for (let y = 0; y < H; y++) {
    const o = y * (W * 4 + 1);
    raw[o] = 0;
    for (let x = 0; x < W; x++) raw.set(rows[(y / scale) | 0][(x / scale) | 0], o + 1 + x * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]));
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
