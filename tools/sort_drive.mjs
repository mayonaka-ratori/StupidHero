// sort担当:ゲームをタッチで動かしながら撮る。
// 使い方: node tools/sort_drive.mjs <URL> <出力の頭> <手順...>
//   手順: wait:ms / tap:x,y(論理座標) / swipe:x,y,dx[,ms] / drag:x,y,dx(離さない) / up / shot(撮る)
//         eval:式(window.__sh を使える。結果を表示) / key:ArrowLeft
// 撮ったものは <出力の頭>-<番号>.png と、横に並べた <出力の頭>.png。
import { chromium } from 'playwright-core';

const [url, out, ...steps] = process.argv.slice(2);
const H = Number(process.env.VH ?? 693);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.error('console:', m.text()); });
const cdp = await page.context().newCDPSession(page);
await page.goto(url);
await page.waitForFunction(() => window.__sh && window.__sh.game, null, { timeout: 10000 });

async function css(lx, ly) {
  return page.evaluate(([x, y]) => {
    const g = window.__sh.game;
    const r = g.canvas.getBoundingClientRect();
    return { x: r.left + (x * r.width) / g.scale.width, y: r.top + (y * r.height) / g.scale.height };
  }, [lx, ly]);
}
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const bufs = [];
let held = null;
for (const s of steps) {
  const [cmd, argStr = ''] = s.split(/:(.*)/s);
  const a = argStr.split(',').map(Number);
  if (cmd === 'wait') await page.waitForTimeout(a[0]);
  else if (cmd === 'tap') {
    const p = await css(a[0], a[1]);
    await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    await page.waitForTimeout(40);
    await touch('touchEnd', []);
  } else if (cmd === 'swipe' || cmd === 'drag') {
    const p = await css(a[0], a[1]);
    const q = await css(a[0] + a[2], a[1]);
    const ms = a[3] ?? 160;
    const n = 8;
    await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    for (let i = 1; i <= n; i++) {
      await page.waitForTimeout(ms / n);
      await touch('touchMove', [{ x: p.x + ((q.x - p.x) * i) / n, y: p.y, id: 1 }]);
    }
    if (cmd === 'swipe') { await page.waitForTimeout(16); await touch('touchEnd', []); } else held = q;
  } else if (cmd === 'up') { await touch('touchEnd', []); held = null; }
  else if (cmd === 'shot') { bufs.push(await page.screenshot()); }
  else if (cmd === 'key') { await page.keyboard.press(argStr); }
  else if (cmd === 'eval') { console.log('eval', argStr, '=>', JSON.stringify(await page.evaluate(argStr))); }
}
void held;
const fs = await import('node:fs');
bufs.forEach((b, i) => fs.writeFileSync(`${out}-${i}.png`, b));
if (bufs.length) {
  const imgs = bufs.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}" style="width:195px;margin-right:4px">`).join('');
  const sheet = await browser.newPage({ viewport: { width: Math.min(200 * bufs.length, 1600), height: Math.ceil(H / 2) * Math.ceil(bufs.length / 8) } });
  await sheet.setContent(`<body style="margin:0;background:#888;display:flex;flex-wrap:wrap">${imgs}</body>`);
  await sheet.waitForTimeout(200);
  await sheet.screenshot({ path: `${out}.png` });
}
await browser.close();
console.log('shots', bufs.length);
