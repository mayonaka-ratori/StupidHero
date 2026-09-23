import { open } from './fix1_common.mjs';
const { browser, page, errors, tap, active, H } = await open('?scene=Sort&wave=1&seed=3');
await page.waitForFunction(() => window.__sh && window.__sh.key === 'Sort', null, { timeout: 20000 });
await tap(108, 20);  // unlock + skip intro
await page.waitForTimeout(800);
const dbg = () => page.evaluate(async () => (await import('/src/audio/index.ts')).audio.debug());
console.log('playing', await dbg());
await tap(13, 76);   // 中断ボタン
await page.waitForTimeout(400);
console.log('paused', await active(), await dbg());
await tap(108, H / 2);
await page.waitForTimeout(600);
console.log('resumed', await active(), await dbg());
console.log(errors.filter(e => !e.includes('WebGL') && !e.includes('GPU')).join('\n') || 'no errors');
await browser.close();
