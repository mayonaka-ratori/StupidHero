import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(`http://localhost:5603/?scene=Boss&seed=12345&sorts=truth&stage=garage`);
await page.waitForFunction(() => window.bossScene && window.bossScene.phase, null, { timeout: 30000 });
await S(() => { window.__t = performance.now(); window.bossScene.game.loop.sleep(); });
const adv = (ms) => S((ms) => { const g = window.bossScene.game; for (let t = 0; t < ms; t += 1000 / 60) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } }, ms);
while (await S(() => window.bossScene.phase) === 'intro') { await adv(200); await S(() => window.bossScene.cut.skip()); }
while (await S(() => window.bossScene.phase) === 'fight') { await S(() => window.bossScene.onPress({ x: 0, y: 0 })); await adv(100); }
const log = await S(() => { const g = window.bossScene.game; const s = window.bossScene; const c = s.car.sprite; const out = []; for (let i = 0; i < 150; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); if (i % 4 === 0) out.push(`${(i * 16.7) | 0}ms car(${c.x},${c.y},${c.angle}) boss(${s.boss.x},${s.boss.y},${s.boss.visible}) ts=${s.tweens.timeScale}`); } return out; });
console.log(log.join('\n'));
await browser.close();
