// sort担当:画面を何枚か続けて撮る。
// 横に並べた1枚を <出力の頭>.png に置く。
// 使い方: node tools/sort_shots.mjs <URL> <出力の頭(例 /tmp/a)> [枚数] [間隔ms] [最初に待つms] [高さ] [画素の倍率]
import { chromium } from 'playwright-core';

const [url, out, n = '3', every = '150', first = '2500', h = '844', dpr = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: Number(h) }, deviceScaleFactor: Number(dpr), hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.error('console:', m.text()); });
await page.goto(url);
await page.waitForTimeout(Number(first));
const bufs = [];
for (let i = 0; i < Number(n); i++) {
  bufs.push(await page.screenshot());
  await page.waitForTimeout(Number(every));
}
// 横に並べた1枚にする(半分の大きさ)
const imgs = bufs.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}" style="width:195px;margin-right:4px">`).join('');
const sheet = await browser.newPage({ viewport: { width: 200 * bufs.length, height: Math.ceil(Number(h) / 2) } });
await sheet.setContent(`<body style="margin:0;background:#888;display:flex">${imgs}</body>`);
await sheet.waitForTimeout(200);
await sheet.screenshot({ path: `${out}.png` });
await browser.close();
console.log('saved', n);
