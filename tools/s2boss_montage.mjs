// 画像をならべて1枚にする(s2boss の一時ファイル)。node tools/s2boss_montage.mjs <out.png> <cols> <scale> <crop y0> <crop y1> files...
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [out, cols, scale, y0, y1, ...files] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
const urls = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
const data = await page.evaluate(async ([urls, cols, scale, y0, y1, names]) => {
  const imgs = await Promise.all(urls.map((u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; })));
  const w = imgs[0].width * scale, h = (y1 - y0) * scale;
  const c = document.createElement('canvas'); c.width = w * cols; c.height = (h + 14) * Math.ceil(imgs.length / cols);
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = true;
  imgs.forEach((im, k) => { const x = (k % cols) * w, y = Math.floor(k / cols) * (h + 14); g.drawImage(im, 0, y0, im.width, y1 - y0, x, y + 14, w, h); g.fillStyle = '#ff0'; g.font = '12px monospace'; g.fillText(names[k], x + 4, y + 11); });
  return c.toDataURL('image/png');
}, [urls, Number(cols), Number(scale), Number(y0), Number(y1), files.map((f) => f.split('/').pop())]);
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
