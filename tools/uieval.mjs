// dev/ui.html を開いて、ページの中で式を評価して結果を出す(UIの部品のテスト用)。
// 使い方: node tools/uieval.mjs <URL> '<式>' [待つミリ秒] [撮るPNG] [画素の倍率]
// 式を評価したあと0.3秒待って撮る。
import { chromium } from 'playwright-core';

const [url, expr, wait = '3000', out, dpr = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(dpr), hasTouch: true, isMobile: true });
// ほかの担当がファイルを書きかえるとViteがページを読み直すので、Viteの通知を切っておく
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url);
await page.waitForTimeout(Number(wait));
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
if (out) { await page.waitForTimeout(300); await page.screenshot({ path: out }); console.log('saved', out); }
await browser.close();
