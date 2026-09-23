// 結果発表(Street)を途中でもう一度始めて、2回目も正しく作られるかを見る(担当 street 用)。
// 使い方: node tools/street_restart.mjs <URL> <出力PNG>
import { chromium } from 'playwright-core';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.streetDev, null, { timeout: 10000 });
await page.waitForTimeout(4000);
await page.evaluate(() => { window.streetDev.run.waveIndex = 1; window.streetDev.scene.restart(); });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => `cameras=${window.streetDev.cameras.cameras.length} queue=${window.streetDev.queue.length}`));
await page.screenshot({ path: out });
await browser.close();
