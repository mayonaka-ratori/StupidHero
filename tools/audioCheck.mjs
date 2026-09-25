// 音を数字で確かめる。先に npm run dev を動かしておくこと。
// 使い方: node tools/audioCheck.mjs [サーバー]   (省くと http://localhost:5173/。その dev/audio.html を開く)
// 1) 各曲の数秒と各効果音を OfflineAudioContext で描き出し、最大音量が1.0以下で無音でないことを見る
//    ステージ4の曲は、平均の大きさがほかの曲とそろっているかも見る
// 2) unlock 前の呼び出し、画面が隠れたとき/戻ったとき、消音の保存 をブラウザで動かして見る
import { checker, openBrowser, openPage, serverUrl } from './lib.mjs';

const url = `${serverUrl(process.argv[2])}dev/audio.html`;
const browser = await openBrowser();
const errors = [];
const page = await openPage(browser, { errors });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(url);
await page.waitForFunction(() => typeof window.__audioCheck === 'function');

const { check, done } = checker();
const ng = (msg) => check(msg, false);
const ok = (msg) => check(msg, true);

// ---------------------------------------------------------------- 1) 描き出して測る
console.log('== 描き出して測る(最大=リミッター後, 制限前=コンプとクリップなし)');
const res = await page.evaluate(() => window.__audioCheck());
const pad = (s, n) => String(s).padEnd(n);
const num = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : String(x));
console.log(pad('種類', 5) + pad('名前', 13) + pad('最大', 8) + pad('平均dB', 9) + pad('長さ秒', 8) + '制限前の最大');
for (const r of res.rows) {
  console.log(pad(r.kind, 5) + pad(r.name, 13) + pad(num(r.final.peak), 8) + pad(num(r.final.rmsDb, 1), 9) + pad(num(r.final.lastSound, 2), 8) + num(r.raw.peak));
  if (!(r.final.peak <= 1.0)) ng(`${r.name}: 最大 ${r.final.peak} が 1.0 を超えた`);
  if (!(r.final.peak > 0.01)) ng(`${r.name}: ほぼ無音 (最大 ${r.final.peak})`);
  // 館内放送のチャイムは、ゲームを止めている間に鳴らすので少し長くてよい
  if (r.kind === 'sfx' && r.final.lastSound > (r.name === 'chime' ? 1.5 : 1.0)) ng(`${r.name}: 効果音が長すぎる (${r.final.lastSound.toFixed(2)}秒)`);
}
// ステージ2の音がそろっているか
const names = new Set(res.rows.map((r) => r.name));
for (const n of ['street2', 'boss2', 'whistle', 'engine', 'skid', 'horn', 'crash', 'whistle×', 'engine×', 'skid×', 'horn×', 'crash×', 'boss2+sfx', 'street2+sfx']) {
  if (!names.has(n)) ng(`${n} が測れていない`);
}
// ステージ3の音がそろっているか
for (const n of ['street3', 'boss3', 'sale3', 'chime', 'ufoDown', 'tractor', 'ufoFall', 'beep', 'glitch', 'shipBeam', 'tractor×', 'shipBeam×', 'boss3+sfx', 'street3+sfx', 'sale3+sfx']) {
  if (!names.has(n)) ng(`${n} が測れていない`);
}
// ステージ4の音がそろっているか
for (const n of ['street4', 'boss4', 'lift4', 'ding', 'door', 'psy', 'thud', 'buzzer', 'smash', 'ding×', 'door×', 'psy×', 'thud×', 'buzzer×', 'smash×', 'boss4+sfx', 'street4+sfx', 'lift4+sfx']) {
  if (!names.has(n)) ng(`${n} が測れていない`);
}
// ステージ4の曲の大きさが、ほかの曲とそろっているか(ほかの曲の平均dBの幅から2dBまではみ出してよい)
const others = res.rows.filter((r) => r.kind === 'bgm' && !/4$/.test(r.name)).map((r) => r.final.rmsDb);
const [lo, hi] = [Math.min(...others) - 2, Math.max(...others) + 2];
for (const r of res.rows.filter((r) => r.kind === 'bgm' && /4$/.test(r.name))) {
  if (r.final.rmsDb < lo || r.final.rmsDb > hi) ng(`${r.name}: 平均 ${r.final.rmsDb.toFixed(1)}dB がほかの曲(${(lo + 2).toFixed(1)}〜${(hi - 2).toFixed(1)}dB)とそろっていない`);
  else ok(`${r.name}: 平均 ${r.final.rmsDb.toFixed(1)}dB(ほかの曲は ${(lo + 2).toFixed(1)}〜${(hi - 2).toFixed(1)}dB)`);
}
// エレベーターラッシュの曲は、前奏(速く高くなるところ)が17〜20秒
if (!(res.lift4Intro >= 17 && res.lift4Intro <= 20)) ng(`lift4 の前奏が ${res.lift4Intro} 秒`);
else ok(`lift4 の前奏 ${res.lift4Intro} 秒`);
// フリープレイの音がそろっているか
for (const n of ['free1', 'free2', 'free3', 'declareBad', 'declarePass', 'dryPress', 'dryPress×', 'free3+sfx']) {
  if (!names.has(n)) ng(`${n} が測れていない`);
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
// ステージ2の曲(エコーつき)の切り替えと停止
await page.evaluate(() => { window.__audio.playBgm('street2'); });
await page.waitForTimeout(300);
await expect('street2 が流れる', (d) => d.playing === 'street2');
await page.evaluate(() => { window.__audio.sfx('whistle'); window.__audio.sfx('engine'); window.__audio.sfx('skid'); window.__audio.sfx('horn'); window.__audio.sfx('crash'); window.__audio.playBgm('boss2'); });
await page.waitForTimeout(300);
await expect('boss2 に切り替え', (d) => d.playing === 'boss2');
await page.evaluate(() => { window.__audio.stopBgm(200); });
await page.waitForTimeout(1000);
await expect('boss2 も stopBgm で止まる', (d) => d.playing === null && d.want === null);
// ステージ3の曲の切り替え(結果発表 → タイムセール → ボス戦)
await page.evaluate(() => { window.__audio.playBgm('street3'); });
await page.waitForTimeout(300);
await expect('street3 が流れる', (d) => d.playing === 'street3');
await page.evaluate(() => { window.__audio.sfx('chime'); window.__audio.sfx('tractor'); window.__audio.sfx('glitch'); window.__audio.playBgm('sale3'); });
await page.waitForTimeout(300);
await expect('sale3 に切り替え', (d) => d.playing === 'sale3');
await page.evaluate(() => { window.__audio.sfx('shipBeam'); window.__audio.playBgm('boss3'); });
await page.waitForTimeout(300);
await expect('boss3 に切り替え', (d) => d.playing === 'boss3');
await page.evaluate(() => { window.__audio.stopBgm(200); });
await page.waitForTimeout(1000);
await expect('boss3 も stopBgm で止まる', (d) => d.playing === null && d.want === null);
// ステージ4の曲の切り替え(結果発表 → エレベーターラッシュ → ボス戦)
await page.evaluate(() => { window.__audio.playBgm('street4'); window.__audio.sfx('psy'); window.__audio.sfx('smash'); window.__audio.sfx('thud'); });
await page.waitForTimeout(300);
await expect('street4 が流れる', (d) => d.playing === 'street4');
await page.evaluate(() => { window.__audio.sfx('ding'); window.__audio.sfx('door'); window.__audio.sfx('buzzer'); window.__audio.playBgm('lift4'); });
await page.waitForTimeout(300);
await expect('lift4 に切り替え', (d) => d.playing === 'lift4');
await page.evaluate(() => { window.__audio.playBgm('boss4'); });
await page.waitForTimeout(300);
await expect('boss4 に切り替え', (d) => d.playing === 'boss4');
await page.evaluate(() => { window.__audio.stopBgm(200); });
await page.waitForTimeout(1000);
await expect('boss4 も stopBgm で止まる', (d) => d.playing === null && d.want === null);
// フリープレイの曲(波ごとに少しずつ速い曲に切り替える)
await page.evaluate(() => { window.__audio.playBgm('free1'); window.__audio.sfx('declareBad'); });
await page.waitForTimeout(300);
await expect('free1 が流れる', (d) => d.playing === 'free1');
await page.evaluate(() => { window.__audio.sfx('dryPress'); window.__audio.sfx('dryPress'); window.__audio.playBgm('free2'); });
await page.waitForTimeout(300);
await expect('free2 に切り替え', (d) => d.playing === 'free2');
await page.evaluate(() => { window.__audio.sfx('declarePass'); window.__audio.playBgm('free3'); });
await page.waitForTimeout(300);
await expect('free3 に切り替え', (d) => d.playing === 'free3');
await page.evaluate(() => { window.__audio.stopBgm(200); });
await page.waitForTimeout(1000);
await expect('free3 も stopBgm で止まる', (d) => d.playing === null && d.want === null);

for (const e of errors) ng(e);
await browser.close();
done();
