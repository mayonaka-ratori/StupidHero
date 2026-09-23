// 結果画面の撮影(result 担当)。途中の何枚かと、共有カードのPNGを書き出す。
// 使い方: npx vite --port 5204 --strictPort を動かしてから
//   node tools/result_shot.mjs <出力フォルダ> [URLの後ろ(例 "sample=demolition")] [幅] [高さ] [待つms,待つms,...]
// 例: node tools/result_shot.mjs /tmp/out "sample=granny" 390 844 300,1200,4500
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const [outDir = '.', extra = '', w = '390', h = '844', waits = '400,1300,5000'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const tag = (extra || 'default').replace(/[^a-z0-9]+/gi, '_');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.error('console:', m.text()); });
await page.goto(`http://localhost:5204/?scene=Result&${extra}`);
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
