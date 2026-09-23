// 共有用の画像 public/og.png(1200×630)を、ゲームの絵で描き出す(result 担当)。
// 使い方: npx vite --port 5204 --strictPort を動かしてから
//   node tools/result_og.mjs [出力PNG(ふつう public/og.png)] [ポート(ふつう 5204)]
// 中身は src/scenes/result/og.ts。そのファイルを読みこむだけのページをこのスクリプトの中で作って開く。
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const [out = 'public/og.png', port = '5204'] = process.argv.slice(2);
const origin = `http://localhost:${port}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.route(`${origin}/__result_og.html`, (route) => route.fulfill({
  contentType: 'text/html',
  body: '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/src/scenes/result/og.ts"></script></body></html>'
}));
await page.goto(`${origin}/__result_og.html`);
await page.waitForFunction(() => window.__og, null, { timeout: 20000 });
const url = await page.evaluate(() => window.__og);
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
console.log('saved', out);
