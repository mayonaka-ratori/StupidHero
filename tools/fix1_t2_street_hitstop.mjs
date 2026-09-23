import { open, OUT } from './fix1_common.mjs';
const { browser, page, errors, H, tap, top, hide, active } = await open('?scene=Street&wave=1&sorts=truth&seed=11');
await page.waitForFunction(() => window.streetDev && window.streetDev.stats, null, { timeout: 20000 });
await page.evaluate(() => {
  const s = window.streetDev;
  const orig = s.stats.defeatBad.bind(s.stats);
  let done = false;
  s.stats.defeatBad = (how) => {
    orig(how);
    if (done) return; done = true;
    // 殴った瞬間(hitStop の最中)に画面が隠れた
    setTimeout(() => {
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.__hid = true;
    }, 20);
  };
});
await page.waitForFunction(() => window.__hid, null, { timeout: 30000 });
await page.waitForTimeout(400);
await hide(false);
await page.waitForTimeout(300);
await tap(108, 100);
await page.waitForTimeout(300);
const st = () => page.evaluate(() => { const s = window.streetDev; return { time: s.time.timeScale, tw: s.tweens.timeScale, heroX: Math.round(s.hero.x), defeated: s.stats.defeated, active: s.sys.isActive() }; });
console.log('after resume', await st());
await page.waitForTimeout(15000);
console.log('15s later', await st(), await top());
await page.screenshot({ path: OUT + '/t2_street_stuck.png' });
console.log(errors.filter(e => !e.includes('WebGL') && !e.includes('GPU stall')).join('\n') || 'no errors');
await browser.close();
