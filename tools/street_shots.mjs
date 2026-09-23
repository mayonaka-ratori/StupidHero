// 結果発表(Street)を開いて、決めた時間ごとにスクリーンショットを撮る(担当 street 用)。
// 使い方: node tools/street_shots.mjs <URL> <出力の頭> <ミリ秒,ミリ秒,...> [stop|go|both|none] [倍率]
//   stop/go/both:合図が出たらその瞬間にボタンを押す(待て/行け)
// 例: node tools/street_shots.mjs "http://localhost:5202/?scene=Street&wave=1&sorts=random&seed=1" /tmp/s 1000,3000 none 2
import { chromium } from 'playwright-core';

const [url, prefix, times = '2000', press = 'none', dpr = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(dpr), hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.error('console:', m.text()); if (m.text().startsWith('[street]')) console.log(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.streetDev, null, { timeout: 10000 });
const t0 = Date.now();
if (press !== 'none') {
  await page.evaluate((mode) => {
    const s = window.streetDev;
    const iv = setInterval(() => {
      if (!s.sys || !s.sys.isActive()) return;
      if ((mode === 'stop' || mode === 'both') && s.stopHandler) { console.log('[street] press stop'); s.stopHandler(); }
      if ((mode === 'go' || mode === 'both') && s.goHandler) { console.log('[street] press go'); s.goHandler(); }
    }, 250);
    window.__iv = iv;
  }, press);
}
for (const [i, t] of times.split(',').map(Number).entries()) {
  const dt = t - (Date.now() - t0);
  if (dt > 0) await page.waitForTimeout(dt);
  const out = `${prefix}${String(i).padStart(2, '0')}.png`;
  await page.screenshot({ path: out });
  const info = await page.evaluate(() => {
    const g = window.streetDev.game;
    const active = g.scene.getScenes(true).map((s) => s.scene.key).join(',');
    const st = window.streetDev.stats?.snapshot?.();
    return `${active} defeated=${st?.defeated} hurt=${st?.civHurt} dmg=${st?.damage} esc=${st?.escaped} worst=${st?.worstScene}`;
  });
  console.log(out, t, info);
}
await browser.close();
