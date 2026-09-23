// 結果画面が出てすぐ「共有する」を押したとき
import { open, OUT } from './fix1_common.mjs';
const { browser, page, errors, H, tap } = await open('?scene=Result&seed=9');
await page.waitForFunction(() => window.resultDev && window.resultDev.buttons, null, { timeout: 20000 });
const t0 = Date.now();
const b = await page.evaluate(() => { const a = window.resultDev.buttons.share; return { x: a.x + a.w / 2, y: a.y + a.h / 2, log: [...window.resultDev.log] }; });
console.log('log at press', b.log);
await tap(b.x, b.y);
await page.waitForTimeout(300);
const o = await page.evaluate(() => { const i = document.querySelector('#share-overlay img'); return i ? { src: i.getAttribute('src').slice(0, 40), w: i.naturalWidth } : null; });
console.log('overlay img', o, 'log', await page.evaluate(() => window.resultDev.log));
await page.screenshot({ path: OUT + '/t6_share_early.png' });
await page.waitForTimeout(3000);
console.log('log later', await page.evaluate(() => window.resultDev.log), 'img still', await page.evaluate(() => document.querySelector('#share-overlay img')?.getAttribute('src').slice(0, 30)));
await browser.close();
