// 結果画面の撮影(result 担当)。途中の何枚かと、共有カードのPNGを書き出す。
// 使い方: npm run dev を動かしてから
//   node tools/result_shot.mjs [出力フォルダ] [URLの後ろ(例 "sample=demolition")] [幅] [高さ] [待つms,待つms,...] [サーバー]
//   出力フォルダとサーバーは、省くか - にすると shots/ と http://localhost:5173/
// 例: node tools/result_shot.mjs /tmp/out "sample=granny" 390 844 300,1200,4500
//     node tools/result_shot.mjs - "stage=mall"
import { openBrowser, openPage, serverUrl, shotsDir } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const [outArg, extra = '', w = '390', h = '844', waits = '400,1300,5000', server] = process.argv.slice(2);
const outDir = shotsDir(outArg);
const tag = (extra || 'default').replace(/[^a-z0-9]+/gi, '_');
const browser = await openBrowser();
const page = await openPage(browser, { width: Number(w), height: Number(h), dpr: 3 });
await page.goto(`${serverUrl(server)}?scene=Result&${extra}`);
await page.waitForFunction(() => window.resultDev && window.resultDev.scene, null, { timeout: 10000 });
const t0 = Date.now();
for (const ms of waits.split(',').map(Number)) {
  const left = ms - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
  const canvas = await page.$('#game canvas');
  await canvas.screenshot({ path: `${outDir}/result_${tag}_${w}x${h}_${ms}.png` });
}
await page.waitForFunction(() => window.resultDev.card, null, { timeout: 8000 });
const card = await page.evaluate(() => ({ small: window.resultDev.card.small.toDataURL('image/png'), big: window.resultDev.card.dataUrl, log: window.resultDev.log, text: window.resultDev.shareText }));
writeFileSync(`${outDir}/card_${tag}.png`, Buffer.from(card.small.split(',')[1], 'base64'));
writeFileSync(`${outDir}/card_${tag}_1080.png`, Buffer.from(card.big.split(',')[1], 'base64'));
console.log(card.log.join(' '));
console.log(card.text);
await browser.close();
