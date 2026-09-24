// 共有用の画像 public/og.png(1200×630)を、ゲームの絵で描き出す(result 担当)。
// 使い方: npm run dev を動かしてから
//   node tools/result_og.mjs [出力PNG(ふつう public/og.png)] [サーバー(ふつう http://localhost:5173/)]
// 中身は src/scenes/result/og.ts。そのファイルを読みこむだけのページをこのスクリプトの中で作って開く。
import { openBrowser, openPage, serverUrl } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const [out = 'public/og.png', server] = process.argv.slice(2);
const origin = new URL(serverUrl(server)).origin;
const browser = await openBrowser();
const page = await openPage(browser, { width: 400, height: 300, mobile: false });
await page.route(`${origin}/__result_og.html`, (route) => route.fulfill({
  contentType: 'text/html',
  body: '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/src/scenes/result/og.ts"></script></body></html>'
}));
await page.goto(`${origin}/__result_og.html`);
await page.waitForFunction(() => window.__og, null, { timeout: 20000 });
const url = await page.evaluate(() => window.__og);
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
console.log('saved', out);
