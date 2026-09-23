// タイトルから結果画面まで、自動で通しで遊ぶ。エラーが出ないかと、各場面の見た目を確かめる。
// 使い方: node tools/playthrough.mjs <URL> <出力フォルダ> [種]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [url, outDir, seed = ''] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(url + (seed ? `?seed=${seed}` : ''));
await page.waitForTimeout(2500);

const active = () => page.evaluate(() => {
  const g = window.__game;
  return g ? g.scene.getScenes(true).map((s) => s.scene.key).filter((k) => !k.startsWith('Ui')) : [];
});
const H = await page.evaluate(() => window.__game.config.height);
const tap = async (x, y) => {
  const r = await page.evaluate(() => { const b = window.__game.canvas.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
  const cx = r.l + (x * r.w) / 216, cy = r.t + (y * r.h) / H;
  await page.touchscreen.tap(cx, cy);
};
let n = 0;
const shot = async (name) => { await page.screenshot({ path: `${outDir}/${String(n++).padStart(2, '0')}_${name}.png` }); };

await shot('title');
await tap(108, H - 100);
const t0 = Date.now();
let last = '';
let sortPresses = 0, stopTaps = 0, goTaps = 0, bossTaps = 0;
while (Date.now() - t0 < 300000) {
  const keys = await active();
  const k = keys[keys.length - 1] ?? '';
  if (k !== last) { await page.waitForTimeout(400); await shot(k); last = k; console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', k); }
  if (k === 'Result') { await page.waitForTimeout(7000); await shot('result_end'); break; }
  if (k === 'Intro') { await tap(108, H - 80); await page.waitForTimeout(250); continue; }
  if (k === 'Sort') {
    await page.waitForTimeout(700);
    await page.keyboard.press(Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight'); sortPresses++;
    if (sortPresses % 4 === 1) await shot('sort');
    continue;
  }
  if (k === 'Street') {
    await page.waitForTimeout(500);
    const r = Math.random();
    if (r < 0.15) { await tap(56, H - 50); stopTaps++; } else if (r < 0.3) { await tap(160, H - 50); goTaps++; }
    if (Math.random() < 0.08) await shot('street');
    continue;
  }
  if (k === 'Boss') {
    for (let i = 0; i < 6; i++) { await tap(108, H - 60); bossTaps++; await page.waitForTimeout(70); }
    if (bossTaps % 60 === 0) await shot('boss');
    continue;
  }
  await page.waitForTimeout(300);
}
console.log('taps', { sortPresses, stopTaps, goTaps, bossTaps }, 'total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
