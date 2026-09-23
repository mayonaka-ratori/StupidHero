import { open, OUT } from './fix1_common.mjs';
const { browser, page, errors, H, tap, top, active } = await open('?scene=Result&seed=5');
for (let i = 0; i < 4; i++) {
  await page.waitForFunction(() => window.__game.scene.isActive('Result') && window.resultDev.scene.tl, null, { timeout: 20000 });
  const ts = Date.now();
  await page.waitForFunction(() => window.resultDev.scene.tl.done, null, { timeout: 20000 });
  const n = await page.evaluate(() => window.__game.scene.getScene('Result').sys.events.listenerCount('update'));
  console.log(`visit ${i + 1}: update listeners=${n}, count-up took ${Date.now() - ts}ms`);
  // もう一回 → Intro、そこから(テストのため)結果画面へ戻す
  const b = await page.evaluate(() => { const a = window.resultDev.buttons.again; return { x: a.x + a.w / 2, y: a.y + a.h / 2 }; });
  await page.waitForTimeout(500);
  await tap(b.x, b.y);
  await page.waitForFunction(() => window.__game.scene.isActive('Intro'), null, { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.scene.getScene('Intro').scene.start('Result'));
}
console.log(errors.filter(e => !e.includes('WebGL') && !e.includes('GPU')).join('\n') || 'no errors');
await browser.close();
