// ゲーム(または dev/ui.html)を指で動かしながら、撮ったり式を調べたりする(sort 担当など)。
// 使い方: node tools/sort_drive.mjs <URL> <出力の頭> <手順...>
//   手順: wait:ms / tap:x,y(論理ドット) / swipe:x,y,dx[,ms] / drag:x,y,dx(離さない) / up / shot(撮る)
//         eval:式(結果を表示。仕分けの画面では window.__sh を使える)/ expect:式(うそなら NG)/ key:ArrowLeft
//   環境変数: VH=画面の高さ(既定693) DPR=画素の倍率(既定1)
// 撮ったものは <出力の頭>-<番号>.png と、横に並べた <出力の頭>.png。expect が1つでも NG なら exit code 1。
// 例(仕分けを左にスワイプ):
//   node tools/sort_drive.mjs "http://localhost:5201/?scene=Sort&stage=garage" /tmp/s wait:2500 shot swipe:108,120,-80 wait:400 shot \
//     "expect:Object.keys(window.__sh.scene.run.sorts).length === 1"
// 例(dev/ui.html の式を調べて撮る):
//   node tools/sort_drive.mjs "http://localhost:5201/dev/ui.html?page=parts" /tmp/u wait:3000 "eval:window.uiDev.log" wait:300 shot
import { writeFileSync } from 'node:fs';
import { checker, contactSheet, openBrowser, openPage, touchPad, waitForGame } from './lib.mjs';

const [url, out, ...steps] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node tools/sort_drive.mjs <url> <outPrefix> <steps...>'); process.exit(2); }
const H = Number(process.env.VH ?? 693);
const dpr = Number(process.env.DPR ?? 1);
const browser = await openBrowser();
const page = await openPage(browser, { height: H, dpr });
const { check, done } = checker();
await page.goto(url);
await waitForGame(page);
const pad = await touchPad(page);

const bufs = [];
for (const s of steps) {
  const [cmd, argStr = ''] = s.split(/:(.*)/s);
  const a = argStr.split(',').map(Number);
  if (cmd === 'wait') await page.waitForTimeout(a[0]);
  else if (cmd === 'tap') await pad.tap(a[0], a[1]);
  else if (cmd === 'swipe' || cmd === 'drag') {
    const p = await pad.css(a[0], a[1]);
    const q = await pad.css(a[0] + a[2], a[1]);
    const ms = a[3] ?? 160;
    const n = 8;
    await pad.touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    for (let i = 1; i <= n; i++) {
      await page.waitForTimeout(ms / n);
      await pad.touch('touchMove', [{ x: p.x + ((q.x - p.x) * i) / n, y: p.y, id: 1 }]);
    }
    if (cmd === 'swipe') { await page.waitForTimeout(16); await pad.touch('touchEnd', []); }
  } else if (cmd === 'up') await pad.touch('touchEnd', []);
  else if (cmd === 'shot') bufs.push(await page.screenshot());
  else if (cmd === 'key') await page.keyboard.press(argStr);
  else if (cmd === 'eval') console.log('eval', argStr, '=>', JSON.stringify(await page.evaluate(argStr)));
  else if (cmd === 'expect') check(argStr, !!(await page.evaluate(argStr)));
  else { console.error('知らない手順:', s); process.exit(2); }
}
bufs.forEach((b, i) => writeFileSync(`${out}-${i}.png`, b));
await contactSheet(browser, bufs, `${out}.png`, H);
await browser.close();
console.log('shots', bufs.length);
done();
