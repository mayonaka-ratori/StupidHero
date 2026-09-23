// 通しで遊んで「もう一回」をくり返し、増えていくものを数える
import { chromium } from 'playwright-core';
import { OUT } from './fix1_common.mjs';
const LOOPS = Number(process.argv[2] ?? 3);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(() => {
  const cnt = window.__lc = {};
  for (const [name, tgt] of [['doc', Document.prototype], ['win', Window.prototype]]) {
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    void tgt;
  }
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) {
    if (this === window || this === document) { const k = (this === window ? 'win:' : 'doc:') + t; cnt[k] = (cnt[k] ?? 0) + 1; }
    return add.call(this, t, f, o);
  };
  EventTarget.prototype.removeEventListener = function (t, f, o) {
    if (this === window || this === document) { const k = (this === window ? 'win:' : 'doc:') + t; cnt[k] = (cnt[k] ?? 0) - 1; }
    return rem.call(this, t, f, o);
  };
  let iv = 0; const si = window.setInterval, ci = window.clearInterval; const live = new Set();
  window.setInterval = function (...a) { const id = si.apply(this, a); live.add(id); return id; };
  window.clearInterval = function (id) { live.delete(id); return ci.call(this, id); };
  window.__intervals = () => live.size;
});
await page.goto('http://localhost:5401/?seed=4242');
await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key === 'Title'), null, { timeout: 30000 });
const H = await page.evaluate(() => window.__game.config.height);
const tap = async (x, y) => {
  const r = await page.evaluate(() => { const b = window.__game.canvas.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
  await page.touchscreen.tap(r.l + (x * r.w) / 216, r.t + (y * r.h) / H);
};
const to = (p, n='op') => { let id; return Promise.race([p.finally(() => clearTimeout(id)), new Promise(r => { id = setTimeout(() => { console.log('  TIMEOUT', n); r('TIMEOUT'); }, 8000); })]); };
const top0 = () => page.evaluate(() => { const k = window.__game.scene.getScenes(true).map(s => s.scene.key).filter(k => !k.startsWith('Ui')); return k[k.length - 1] ?? ''; });
const top = () => to(top0(), 'top');
const probe = () => page.evaluate(() => {
  const g = window.__game;
  const upd = {};
  for (const s of g.scene.scenes) { const n = s.sys.events.listenerCount('update'); if (n) upd[s.scene.key] = n; }
  const lc = Object.fromEntries(Object.entries(window.__lc).filter(([k, v]) => v !== 0));
  return { tex: Object.keys(g.textures.list).length, upd, intervals: window.__intervals(), lc, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };
});
await page.waitForTimeout(800);
await tap(108, H - 60);
let loops = 0, last = '', t0 = Date.now();
const resultTimes = [];
while (Date.now() - t0 < 900000) {
  const k = await top(); if (Math.random() < 0.05) console.log("  .. at", k, ((Date.now()-t0)/1000).toFixed(0));
  if (k !== last) {
    console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', k, JSON.stringify(await probe()));
    last = k;
    if (k === 'Result') {
      // 数え上げの速さ:NEW/称号の数が出るまでの時間を測る
      const ts = Date.now();
      await page.waitForFunction(() => window.resultDev.scene.tl.done, null, { timeout: 20000 });
      resultTimes.push(Date.now() - ts);
      console.log('  result timeline ms', Date.now() - ts, 'update listeners on Result:', await page.evaluate(() => window.__game.scene.getScene('Result').sys.events.listenerCount('update')));
      await page.screenshot({ path: `${OUT}/t4_result_${loops}.png` });
      loops++;
      if (loops >= LOOPS) break;
      await page.waitForTimeout(1500);
      const b = await page.evaluate(() => { const a = window.resultDev.buttons.again; return { x: a.x + a.w / 2, y: a.y + a.h / 2 }; });
      await tap(b.x, b.y);
      continue;
    }
  }
  if (k === 'Intro') { await page.waitForTimeout(1200); await page.evaluate(() => window.__sh?.leave?.()); await page.waitForTimeout(300); continue; }
  if (k === 'Sort') { await page.waitForTimeout(400); await page.keyboard.press(Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight'); continue; }
  if (k === 'Street') { await page.waitForTimeout(400); if (Math.random() < 0.2) await tap(160, H - 40); continue; }
  if (k === 'Boss') { for (let i = 0; i < 6; i++) { await to(tap(108, H - 40), 'tap'); await page.waitForTimeout(60); } continue; }
  await page.waitForTimeout(250);
}
console.log('result timeline ms per loop', resultTimes);
console.log(errors.join('\n') || 'no errors');
await browser.close();
