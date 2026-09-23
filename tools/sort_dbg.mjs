import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.log('pageerror:', e.message, e.stack));
page.on('console', (m) => console.log('console:', m.type(), m.text()));
await page.goto('http://localhost:5201/');
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__sh.begin(); });
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(200);
  console.log(await page.evaluate(() => window.__sh.game.scene.getScenes(false).map(s => s.scene.key + ':' + s.sys.settings.status).join(' ')));
}
await browser.close();
