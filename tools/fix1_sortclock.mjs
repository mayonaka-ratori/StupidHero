import { open } from './fix1_common.mjs';
const { browser, page, errors } = await open('?scene=Sort&wave=1&seed=3');
await page.waitForFunction(() => window.__sh && window.__sh.key === 'Sort', null, { timeout: 20000 });
await page.evaluate(() => window.__sh.skipIntro());
const ready = () => page.waitForFunction(() => { const s = window.__sh.state(); return s.state === 'play' && !s.locked; }, null, { timeout: 10000 });
await ready();
const total = await page.evaluate(() => window.__sh.state().total);
for (let i = 0; i < total - 1; i++) { await page.evaluate(() => window.__sh.press('bad')); await ready(); }
await page.evaluate(() => { window.__sh.setLeft(60); window.__sh.press('civ'); });
await page.waitForTimeout(150);
const s1 = await page.evaluate(() => window.__sh.state());
await page.waitForTimeout(250);
const s2 = await page.evaluate(() => window.__sh.state());
console.log('150ms', s1.state, s1.leftMs, 'random', s1.random.length, '| 400ms', s2.state, s2.leftMs, 'random', s2.random.length, 'name', await page.evaluate(() => window.__sh.scene.nameText.text));
console.log(errors.filter(e => !e.includes('WebGL') && !e.includes('GPU')).join('\n') || 'no errors');
await browser.close();
