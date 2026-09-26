// PNGを書き出す共通の部品(tools/artsheet.mjs、mocks/stage4_src/build.mjs で使う)。
// ブラウザもPlaywrightも読み込まない。node だけで動く。
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/** 32bitのCRC(PNGのチャンクにつける) */
export function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}

/** `rgb(r,g,b)` の文字を `[r,g,b,255]` にする。読めない文字は fallback(省くと透明) */
export function parseColor(c, fallback = [0, 0, 0, 0]) {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c ?? '');
  return m ? [+m[1], +m[2], +m[3], 255] : fallback;
}

/**
 * 画素の表(px[y][x] が [r,g,b,a])を、倍率 scale(省くと1倍)で拡大したPNGファイルに書き出す。
 * フィルタなし・RGBA・1つのIDATチャンクという、もとの2つのスクリプトと同じ書き方にしてある。
 */
export function writePng(path, { w, h, px, scale = 1 }) {
  const W = w * scale, H = h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const o = y * (W * 4 + 1);
    raw[o] = 0;
    for (let x = 0; x < W; x++) raw.set(px[(y / scale) | 0][(x / scale) | 0], o + 1 + x * 4);
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
