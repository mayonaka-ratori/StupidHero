// ホーム画面のアイコン(public/icon-192.png、public/icon-512.png、public/apple-touch-icon.png)を、
// ヒーローの顔のカットインの絵(src/art/hero/faces.ts のドヤ顔)から書き出す。ブラウザなしで動く。
// 使い方: node tools/icons.mjs [出力フォルダ(ふつう public)]
// 顔(48×48ドット)を整数の倍率で拡大し、左右のまん中、下の端にそろえて置く(胸から上の写真のように)。
// 地の色は UI の窓の青(src/config.ts の UI.winFill)。顔の絵を描き直したら、これを動かして作り直す。
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { parseColor, writePng } from './png.mjs';

const [outDir = 'public'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

/** 地の色(UI.winFill) */
const BG = [0x0e, 0x16, 0x46, 255];
/** 地の色に重ねる、少し明るい丸(UI.winInner)。顔の後ろに置く */
const RING = [0x2f, 0x4c, 0xc0, 255];

/**
 * 書き出すアイコン。size は1辺のドット数、scale は顔の倍率。
 * apple-touch-icon は iPhone が角を丸めるので、ほかと同じ置き方でよい
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 3 },
  { file: 'icon-512.png', size: 512, scale: 9 },
  { file: 'apple-touch-icon.png', size: 180, scale: 3 }
];

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { drawFaceSheet } = await server.ssrLoadModule('/src/art/hero/faces.ts');
  // 1行目がドヤ顔、1コマ目が口を閉じた顔
  const face = drawFaceSheet('hero')[0][0];
  for (const { file, size, scale } of ICONS) {
    const fw = face.w * scale, fh = face.h * scale;
    const ox = Math.floor((size - fw) / 2), oy = size - fh;
    const cx = size / 2, cy = size * 0.48, r = size * 0.36;
    const px = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => {
      const fx = Math.floor((x - ox) / scale), fy = Math.floor((y - oy) / scale);
      const c = x >= ox && y >= oy && fx < face.w && fy < face.h ? face.cells[fy][fx] : null;
      if (c) return parseColor(c);
      // 顔の後ろの丸(ドット絵に合わせて、倍率ごとのかたまりで判定する)
      const bx = (Math.floor(x / scale) + 0.5) * scale, by = (Math.floor(y / scale) + 0.5) * scale;
      return (bx - cx) ** 2 + (by - cy) ** 2 <= r * r ? RING : BG;
    }));
    writePng(`${outDir}/${file}`, { w: size, h: size, px });
    console.log(`${outDir}/${file}`);
  }
} finally {
  await server.close();
}
