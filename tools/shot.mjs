// 開発用のスクリーンショット(ゲームの画面も、dev/ の開発用ページも)。
// 使い方: node tools/shot.mjs <URL> <出力PNG> [幅] [高さ] [待つミリ秒] [画素の倍率]
// スマホの大きさで開きたいときは幅390、高さ844(タッチは有効にしてある)。
// 例: node tools/shot.mjs "http://localhost:5173/dev/ui.html?page=text" /tmp/a.png 390 844 2500 3
//   (iPhoneと同じ倍率3で撮ると、ゲームの画面は細かく描かれる)
// ほかの担当がファイルを書きかえると Vite がページを読み直すので、Vite の通知は切ってある。
import { openBrowser, openPage } from './lib.mjs';

const [url, out, w = '390', h = '844', wait = '1500', dpr = '1'] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node tools/shot.mjs <url> <out.png> [w] [h] [waitMs] [dpr]'); process.exit(1); }
const browser = await openBrowser();
const page = await openPage(browser, { width: Number(w), height: Number(h), dpr: Number(dpr) });
await page.goto(url);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
