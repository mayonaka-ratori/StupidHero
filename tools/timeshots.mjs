// 画面を開いて、決めた時間ごとにスクリーンショットを撮る(仕分け、結果発表、ボス戦など、どの場面でも)。
// 使い方: node tools/timeshots.mjs <URL> <出力の頭> <時間> [オプション...]
//   時間:ゲームができてからのミリ秒。「1000,3000,5200」のように並べるか、「2500+150x3」(2500ミリ秒から150ミリ秒ごとに3枚)
//   オプション:
//     press=stop|go|both  結果発表(Street)で合図が出たら、その瞬間に待て/行けを押す
//     dpr=2               画素の倍率(既定1)
//     h=844               画面の高さ(既定844。幅は390)
//     sheet               撮ったものを横に並べた1枚 <出力の頭>.png も作る
// 撮ったものは <出力の頭>00.png、<出力の頭>01.png …。1枚ごとに、動いているシーンと数字(撃破、負傷、被害額など)を出す。
// 例: node tools/timeshots.mjs "http://localhost:5173/?scene=Street&wave=1&sorts=random&seed=1" /tmp/s 1000,3000 press=stop dpr=2
//     node tools/timeshots.mjs "http://localhost:5173/?scene=Sort&stage=garage" /tmp/sort 2500+150x3 sheet
import { contactSheet, openBrowser, openPage, waitForGame } from './lib.mjs';

const [url, prefix, times = '2000', ...rest] = process.argv.slice(2);
if (!url || !prefix) { console.error('usage: node tools/timeshots.mjs <url> <outPrefix> <times> [press=stop|go|both] [dpr=N] [h=N] [sheet]'); process.exit(2); }
const opt = Object.fromEntries(rest.map((a) => { const [k, v = 'true'] = a.split('='); return [k, v]; }));
const h = Number(opt.h ?? 844);
const at = /^(\d+)\+(\d+)x(\d+)$/.exec(times);
const list = at ? Array.from({ length: Number(at[3]) }, (_, i) => Number(at[1]) + i * Number(at[2])) : times.split(',').map(Number);

const browser = await openBrowser();
const page = await openPage(browser, { height: h, dpr: Number(opt.dpr ?? 1) });
page.on('console', (m) => { if (m.text().startsWith('[shots]')) console.log(m.text()); });
await page.goto(url);
await waitForGame(page);
if (opt.press) {
  await page.waitForFunction(() => window.streetDev, null, { timeout: 15000 });
  await page.evaluate((mode) => {
    setInterval(() => {
      const s = window.streetDev;
      if (!s?.sys || !s.sys.isActive()) return;
      if ((mode === 'stop' || mode === 'both') && s.stopHandler) { console.log('[shots] press stop'); s.stopHandler(); }
      if ((mode === 'go' || mode === 'both') && s.goHandler) { console.log('[shots] press go'); s.goHandler(); }
    }, 250);
  }, opt.press);
}
const t0 = Date.now();
const bufs = [];
for (const [i, t] of list.entries()) {
  const dt = t - (Date.now() - t0);
  if (dt > 0) await page.waitForTimeout(dt);
  const out = `${prefix}${String(i).padStart(2, '0')}.png`;
  bufs.push(await page.screenshot({ path: out }));
  const info = await page.evaluate(() => {
    const g = window.__game ?? window.uiDev?.game;
    const active = g ? g.scene.getScenes(true).map((s) => s.scene.key).join(',') : '';
    const st = g?.registry.get('run')?.stats?.snapshot?.();
    return st ? `${active} 撃破=${st.defeated} 負傷=${st.civHurt} 被害=${st.damage} 逃がした=${st.escaped} ひどい=${st.worstScene}` : active;
  });
  console.log(out, t, info);
}
if (opt.sheet) await contactSheet(browser, bufs, `${prefix}.png`, h);
await browser.close();
