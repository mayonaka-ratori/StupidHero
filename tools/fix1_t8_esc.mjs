// タイトルで Enter → すぐ ESC(とばす)を押すと、掛け合いから先へ進めなくなるか
import { open, OUT } from './fix1_common.mjs';
const { browser, page, errors, active } = await open('?seed=77');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('Intro'), null, { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForTimeout(6000);
console.log('6s later', await active());
await page.keyboard.press('Escape');
for (let i = 0; i < 20; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
await page.waitForTimeout(3000);
console.log('after more keys', await active(), await page.evaluate(() => window.__sh.state()));
await page.screenshot({ path: OUT + '/t8_intro_stuck.png' });
await browser.close();
