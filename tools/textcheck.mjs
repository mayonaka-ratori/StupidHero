// 禁則のチェック。dev/text.html?set=check を開いて、ゲームの全部の文を、ゲームで使う折り返しの幅と字の大きさで
// 折り返し、行の頭に来てはいけない字が来ていないか(禁則)を確かめる。まちがいがあれば一覧を出して exit code 1。
// 使い方: npm run dev を動かしてから
//   node tools/textcheck.mjs [サーバー] [まちがいを並べた画像PNG]   (サーバーは、省くか - にすると http://localhost:5173/)
import { checker, openBrowser, openPage, serverUrl } from './lib.mjs';

const [server, out] = process.argv.slice(2);
const url = serverUrl(server);
const browser = await openBrowser();
const errors = [];
const page = await openPage(browser, { width: 800, height: 1000, errors });
const { check, done } = checker();
await page.goto(new URL('dev/text.html?set=check&zoom=2', url).toString());
const ready = await page.waitForFunction(() => window.textDev?.done, null, { timeout: 60000 }).then(() => true, () => false);
if (check('チェックのページが開く', ready)) {
  const r = await page.evaluate(() => ({
    texts: window.textDev.texts.length,
    info: document.getElementById('info')?.textContent ?? '',
    problems: window.textDev.problems.map((p) => `[${p.size}] ${p.kind} 行${p.line}: ${p.text.replace(/\n/g, '⏎')}`)
  }));
  console.log(r.info.split('\n')[0]);
  check('文がある', r.texts > 200, `${r.texts} 文`);
  const unique = [...new Set(r.problems)];
  check('禁則のまちがいがない', unique.length === 0, unique.length ? `${unique.length} 件\n  ${unique.join('\n  ')}` : '');
  if (out) { await page.screenshot({ path: out, fullPage: true }); console.log('saved', out); }
}
check('エラーが出ない', errors.length === 0, errors.join('\n'));
await browser.close();
done();
