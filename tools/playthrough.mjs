// タイトルから結果画面まで、自動で通しで遊ぶ。エラーが出ないかと、各場面の見た目を確かめる。
// 波ごとの答え合わせ(WaveReview)は、行が出そろうのを待って撮り、次へを押す(3回通ったかも確かめる)。
// 使い方: node tools/playthrough.mjs <URL> <出力フォルダ> [種] [ステージ(alley か garage)]
// garage のときは、開発用の入口で掛け合いから始める(鍵が開いていなくても遊べる)
// エラーが出たとき、結果画面まで行けなかったときは exit code 1 で終わる。
import { mkdirSync } from 'node:fs';
import { logicalHeight, openBrowser, openPage, touchPad, waitForGame } from './lib.mjs';

const [url, outDir, seed = '', stage = 'alley'] = process.argv.slice(2);
if (!url || !outDir) { console.error('usage: node tools/playthrough.mjs <url> <outDir> [seed] [alley|garage]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const browser = await openBrowser();
const errors = [];
// 途中で Vite がページを読み直さないように、通知は切ってある
const page = await openPage(browser, { errors });
const q = new URLSearchParams();
if (seed) q.set('seed', seed);
if (stage === 'garage') { q.set('scene', 'Intro'); q.set('stage', 'garage'); }
await page.goto(url + (q.toString() ? `?${q}` : ''));
await waitForGame(page, 60000);
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, null, { timeout: 60000 });
await page.waitForTimeout(1500);

const active = () => page.evaluate(() => {
  const g = window.__game;
  return g ? g.scene.getScenes(true).map((s) => s.scene.key).filter((k) => !k.startsWith('Ui')) : [];
});
// 論理ドットでの画面の高さ。指の位置は lib.mjs で論理ドットから直す
const H = await logicalHeight(page);
const pad = await touchPad(page);
const tap = (x, y) => pad.tap(x, y);
let n = 0;
const shot = async (name) => { await page.screenshot({ path: `${outDir}/${String(n++).padStart(2, '0')}_${name}.png` }); };

await shot('title');
await tap(108, H - 100);
const t0 = Date.now();
let last = '';
let sortPresses = 0, stopTaps = 0, goTaps = 0, bossTaps = 0;
const reviews = [];
while (Date.now() - t0 < 300000) {
  const keys = await active();
  // 切り替えの途中は2つのシーンが同時に動いているので、結果画面があればそちらを優先する
  const k = keys.includes('Result') ? 'Result' : keys[keys.length - 1] ?? '';
  if (k !== last) { await page.waitForTimeout(400); await shot(k); last = k; console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', k); }
  if (k === 'Result') { await page.waitForTimeout(7000); await shot('result_end'); break; }
  if (k === 'StageSelect') { await page.evaluate(() => window.__sh?.select?.('alley')); await page.waitForTimeout(800); continue; }
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
  if (k === 'WaveReview') {
    await page.waitForTimeout(2600);
    const info = await page.evaluate(() => {
      const d = window.reviewDev;
      const r = window.__game.registry.get('run');
      return { wave: r.waveIndex + 1, rows: d.rows.length, done: d.scene.tl.done, btn: { x: d.next.x + d.next.w / 2, y: d.next.y + d.next.h / 2 } };
    });
    if (!reviews.includes(info.wave)) { reviews.push(info.wave); await shot(`review${info.wave}`); console.log('review', JSON.stringify(info)); }
    await tap(info.btn.x, info.btn.y);
    await page.waitForTimeout(900);
    continue;
  }
  if (k === 'Boss') {
    for (let i = 0; i < 6; i++) {
      if ((await active()).includes('WaveReview')) break;
      await tap(108, H - 60); bossTaps++; await page.waitForTimeout(70);
    }
    if (bossTaps % 60 === 0) await shot('boss');
    continue;
  }
  await page.waitForTimeout(300);
}
const reached = last === 'Result';
const playedStage = await page.evaluate(() => window.__game.registry.get('run')?.stage.id);
console.log('taps', { sortPresses, stopTaps, goTaps, bossTaps }, 'total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
const ng = [];
if (errors.length) ng.push(`エラー ${errors.length} 件`);
if (!reached) ng.push(`結果画面まで行けなかった(最後は ${last || 'なし'})`);
if (playedStage !== stage) ng.push(`遊んだステージが ${playedStage}`);
if (reviews.join(',') !== '1,2,3') ng.push(`答え合わせが波 ${reviews.join(',') || 'なし'} だけ`);
console.log(ng.length ? `NG ${ng.join('、')}` : `OK ${stage} を結果画面まで遊んだ`);
process.exit(ng.length ? 1 : 0);
