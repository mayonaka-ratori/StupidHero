// 音を数字で確かめる。先に `npx vite --port 5103 --strictPort` を動かしておくこと。
// 使い方: node tools/audioCheck.mjs [URL]   (URLの省略時は http://localhost:5103/dev/audio.html)
// 1) 各曲の数秒と各効果音を OfflineAudioContext で描き出し、最大音量が1.0以下で無音でないことを見る
// 2) unlock 前の呼び出し、画面が隠れたとき/戻ったとき、消音の保存 をブラウザで動かして見る
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5103/dev/audio.html';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(url);
await page.waitForFunction(() => typeof window.__audioCheck === 'function');

let fail = 0;
const ng = (msg) => { fail++; console.log('  NG ' + msg); };
const ok = (msg) => console.log('  ok ' + msg);

// ---------------------------------------------------------------- 1) 描き出して測る
console.log('== 描き出して測る(最大=リミッター後, 制限前=コンプとクリップなし)');
const res = await page.evaluate(() => window.__audioCheck());
const pad = (s, n) => String(s).padEnd(n);
const num = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : String(x));
console.log(pad('種類', 5) + pad('名前', 11) + pad('最大', 8) + pad('平均dB', 9) + pad('長さ秒', 8) + '制限前の最大');
for (const r of res.rows) {
  console.log(pad(r.kind, 5) + pad(r.name, 11) + pad(num(r.final.peak), 8) + pad(num(r.final.rmsDb, 1), 9) + pad(num(r.final.lastSound, 2), 8) + num(r.raw.peak));
  if (!(r.final.peak <= 1.0)) ng(`${r.name}: 最大 ${r.final.peak} が 1.0 を超えた`);
  if (!(r.final.peak > 0.01)) ng(`${r.name}: ほぼ無音 (最大 ${r.final.peak})`);
  if (r.kind === 'sfx' && r.final.lastSound > 1.0) ng(`${r.name}: 効果音が長すぎる (${r.final.lastSound.toFixed(2)}秒)`);
}
if (res.backlog > 4) ng(`遅れたときに ${res.backlog} マスをまとめて予約した`);
else ok(`遅れたときに一度に予約したマス: ${res.backlog}(たまった音は鳴らさない)`);

// ---------------------------------------------------------------- 2) エンジンの動き
console.log('== エンジンの動き');
const dbg = () => page.evaluate(() => window.__audioDebug());
const expect = async (label, pred) => {
  const d = await dbg();
  if (pred(d)) ok(`${label} ${JSON.stringify(d)}`);
  else ng(`${label} ${JSON.stringify(d)}`);
};
await page.evaluate(() => { localStorage.removeItem('stupidHero.muted'); });
await page.evaluate(() => { window.__audio.sfx('hit'); window.__audio.playBgm('title'); window.__audio.stopBgm(); window.__audio.playBgm('title'); });
await expect('unlock 前:落ちずに曲を覚えている', (d) => d.state === 'none' && d.want === 'title' && d.playing === null);
await page.mouse.click(200, 700);
await page.waitForTimeout(400);
await expect('タップで unlock → title が流れる', (d) => d.state === 'running' && d.playing === 'title');
await page.evaluate(() => { window.__audio.playBgm('title'); window.__audio.sfx('button'); window.__audio.sfx('rush', { pitch: 1.2, volume: 0.5 }); });
await expect('同じ曲なら何もしない', (d) => d.playing === 'title');
await page.evaluate(() => window.__audio.playBgm('boss'));
await expect('違う曲に切り替え', (d) => d.playing === 'boss');
// 画面が隠れたことにする
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(300);
await expect('隠れたら止めて suspend(曲は覚えている)', (d) => d.state === 'suspended' && d.playing === null && d.want === 'boss');
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(300);
await expect('戻っただけではまだ鳴らさず、タップを待つ', (d) => d.state === 'suspended' && d.armed && d.playing === null);
await page.touchscreen.tap(200, 700);
await page.waitForTimeout(400);
await expect('タップで resume して boss を再開', (d) => d.state === 'running' && d.playing === 'boss' && !d.armed);
const muted = await page.evaluate(() => window.__audio.toggleMuted());
const stored = await page.evaluate(() => localStorage.getItem('stupidHero.muted'));
if (muted === true && stored === '1') ok('消音を localStorage に保存'); else ng(`消音の保存 muted=${muted} stored=${stored}`);
await page.reload();
await page.waitForFunction(() => typeof window.__audio === 'object');
const mutedAfter = await page.evaluate(() => window.__audio.isMuted());
if (mutedAfter) ok('読み直しても消音のまま'); else ng('読み直したら消音が戻った');
await page.evaluate(() => { window.__audio.setMuted(false); });
await page.mouse.click(200, 700);
await page.evaluate(() => { window.__audio.playBgm('street'); window.__audio.stopBgm(200); });
await expect('stopBgm で止まる', (d) => d.playing === null && d.want === null);

for (const e of errors) ng(e);
await browser.close();
console.log(fail ? `== NG ${fail} 件` : '== すべて ok');
process.exit(fail ? 1 : 0);
