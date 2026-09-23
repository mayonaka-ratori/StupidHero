// 結果発表(Street)をタップで試す(担当 street 用)。中断ボタン、待て、行けを指で押して、止まるか、反応するかを見る。
// 使い方: node tools/street_tap.mjs <URL> [出力フォルダ]
import { chromium } from 'playwright-core';

const [url, outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
const cdp = await page.context().newCDPSession(page);
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK ' : 'NG '} ${name} ${extra}`); if (!ok) failed++; };
const wait = (ms) => page.waitForTimeout(ms);
async function css(lx, ly) {
  return page.evaluate(([x, y]) => {
    const g = window.streetDev.game; const r = g.canvas.getBoundingClientRect();
    return { x: r.left + (x * r.width) / 216, y: r.top + (y * r.height) / g.scale.height };
  }, [lx, ly]);
}
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
async function tap(lx, ly) {
  const p = await css(lx, ly);
  await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
  await wait(40);
  await touch('touchEnd', []);
  await wait(40);
}
const heroX = () => page.evaluate(() => window.streetDev.hero.x);
const btn = (n) => page.evaluate((k) => { const b = window.streetDev[k]; return { x: b.x + b.w / 2, y: b.y + b.h / 2, en: b.isEnabled }; }, n);

await page.goto(url);
await page.waitForFunction(() => window.streetDev, null, { timeout: 10000 });
await wait(1500);
// 1. 中断
await tap(204, 12);
await wait(200);
check('中断ボタンで止まる', await page.evaluate(() => window.streetDev.scene.isPaused()));
const x1 = await heroX();
await wait(1200);
check('止まっている間ヒーローは動かない', (await heroX()) === x1);
await page.screenshot({ path: `${outDir}/tap_pause.png` });
await tap(108, 200);
await wait(300);
check('タップで再開', !(await page.evaluate(() => window.streetDev.scene.isPaused())));
// 2. 合図がないときの待ては暗く、押しても何も起きない
let s = await btn('stopBtn');
check('合図がないとき待ては使えない', !s.en);
// 3. 合図が出るまで待って、指で待てを押す
await page.waitForFunction(() => window.streetDev.stopHandler || window.streetDev.goHandler, null, { timeout: 30000 });
const t0 = Date.now();
if (await page.evaluate(() => !!window.streetDev.stopHandler)) {
  await wait(60);
  s = await btn('stopBtn');
  check('合図が出たら待てが使える', s.en);
  const before = await page.evaluate(() => window.streetDev.stats.snapshot());
  await wait(500);
  await tap(s.x, s.y);
  await wait(200);
  const after = await page.evaluate(() => window.streetDev.stats.snapshot());
  check('待てで止まる(数える)', after.civSavedByStop + after.badSparedByStop === before.civSavedByStop + before.badSparedByStop + 1, `${Date.now() - t0}ms`);
  await page.screenshot({ path: `${outDir}/tap_stop.png` });
}
// 4. 行け
await page.waitForFunction(() => window.streetDev.goHandler, null, { timeout: 40000 }).catch(() => null);
if (await page.evaluate(() => !!window.streetDev.goHandler)) {
  const g = await btn('goBtn');
  const before = await page.evaluate(() => window.streetDev.stats.snapshot().defeatedByGo);
  await wait(800);
  await page.screenshot({ path: `${outDir}/tap_gomark.png` });
  await tap(g.x, g.y);
  await wait(2500);
  const after = await page.evaluate(() => window.streetDev.stats.snapshot().defeatedByGo);
  check('行けで追い打ち', after === before + 1);
  await page.screenshot({ path: `${outDir}/tap_go.png` });
} else console.log('(行けの場面なし)');
await browser.close();
process.exit(failed ? 1 : 0);
