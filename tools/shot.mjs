// 開発用のスクリーンショット。
// 使い方: node tools/shot.mjs <URL> <出力PNG> [幅] [高さ] [待つミリ秒]
// スマホの大きさで開きたいときは幅390、高さ844、?mobile=1 は不要(タッチは有効にしてある)。
import { chromium } from 'playwright-core';

const [url, out, w = '390', h = '844', wait = '1500'] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node tools/shot.mjs <url> <out.png> [w] [h] [waitMs]'); process.exit(1); }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1, hasTouch: true });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(url);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
