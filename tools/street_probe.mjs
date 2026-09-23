// 結果発表(Street)の中身を調べる(担当 street 用)。見えている絵の一覧と、撮った「いちばんひどい場面」を保存する。
// 使い方: node tools/street_probe.mjs <URL> <待つミリ秒> [worstShotの保存先PNG]
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
await page.goto(process.argv[2]);
await page.waitForFunction(() => window.streetDev, null, { timeout: 10000 });
await page.waitForTimeout(Number(process.argv[3]));
const shot = await page.evaluate(() => window.streetDev.run.worstShot?.src ?? null);
if (shot && process.argv[4]) { (await import('node:fs')).writeFileSync(process.argv[4], Buffer.from(shot.split(',')[1], 'base64')); console.log('worstShot saved', process.argv[4]); }
console.log(await page.evaluate(() => {
  const s = window.streetDev; const L = s.L.world.scrollX;
  return s.children.list.filter(o => o.texture && o.visible && o.x > L - 10 && o.x < L + 226 && o.y < 214).map(o => `${o.texture.key} ${Math.round(o.x - L)},${Math.round(o.y)} d${Math.round(o.depth)} f${o.frame.name}`).join('\n');
}));
await browser.close();
