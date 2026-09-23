// UIの部品を見るためのスクリーンショット(dev/ui.html 用)。
// 使い方: node tools/uishot.mjs <URL> <出力PNG> [幅] [高さ] [待つミリ秒] [画素の倍率]
// 例: node tools/uishot.mjs "http://localhost:5104/dev/ui.html?page=text" /tmp/a.png 390 844 2500 3
//   (iPhoneと同じ倍率3で撮ると、ゲームの画面は5倍の整数倍で拡大される)
import { chromium } from 'playwright-core';

const [url, out, w = '390', h = '844', wait = '2000', dpr = '1'] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node tools/uishot.mjs <url> <out.png> [w] [h] [waitMs] [dpr]'); process.exit(1); }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(dpr), hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.error('console:', m.text()); });
await page.goto(url);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
