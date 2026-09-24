// タイトルから結果画面まで、自動で通しで遊ぶ。エラーが出ないかと、各場面の見た目を確かめる。
// 波ごとの答え合わせ(WaveReview)は、行が出そろうのを待って撮り、次へを押す(3回通ったかも確かめる)。
// 使い方: node tools/playthrough.mjs <URL> <出力フォルダ> [種] [ステージ(alley、garage、mall)] [仕分け]
// garage と mall のときは、前のステージのボスを倒した記録を先に入れておき、タイトルからステージを選ぶ画面を通って遊ぶ
// 仕分け(書かなければ random):
//   random  でたらめに仕分け、結果発表でもでたらめに待てと行けを押す(前からの動き)
//   truth   正しく仕分ける。結果発表では合図が出たら正しく押す(UFOは行けで落とす、ラッシュは市民にだけ待て)
//   ufo     truth と同じだが、波1のワル(宇宙人)を市民に仕分ける。1機目のUFOは行けで落とし、2機目からは押さない(さらわれる)
//   bossciv truth と同じだが、ボスを市民に仕分ける。ufo+bossciv のように + でつなげる
// エラーが出たとき、結果画面まで行けなかったときは exit code 1 で終わる。
import { mkdirSync, writeFileSync } from 'node:fs';
import { logicalHeight, openBrowser, openPage, touchPad, waitForGame } from './lib.mjs';

const [url, outDir, seed = '', stage = 'alley', policy = 'random'] = process.argv.slice(2);
if (!url || !outDir) { console.error('usage: node tools/playthrough.mjs <url> <outDir> [seed] [alley|garage|mall] [random|truth|ufo|bossciv]'); process.exit(2); }
const PREV = { alley: [], garage: ['alley'], mall: ['alley', 'garage'] }[stage];
if (!PREV) { console.error(`ステージは alley、garage、mall のどれか(${stage})`); process.exit(2); }
const random = policy === 'random';
const missWave1 = policy.split('+').includes('ufo');
const bossCiv = policy.split('+').includes('bossciv');
mkdirSync(outDir, { recursive: true });
const browser = await openBrowser();
const errors = [];
// 途中で Vite がページを読み直さないように、通知は切ってある
const page = await openPage(browser, { errors });
// 前のステージのボスを倒した記録(src/logic/records.ts の形)。開いていないと選べないので先に入れておく
if (PREV.length) {
  const rec = { plays: 1, clears: 1, mostDefeated: null, fewestHurt: null, highestDamage: null, fastestBossSec: null, titles: [] };
  const records = { version: 2, stages: Object.fromEntries(PREV.map((id) => [id, rec])), titles: [], introSeen: PREV, rushSeen: [] };
  await page.addInitScript((r) => { if (!sessionStorage.getItem('pt')) { sessionStorage.setItem('pt', '1'); localStorage.setItem('stupidhero.records.v2', r); } }, JSON.stringify(records));
}
const q = new URLSearchParams();
if (seed) q.set('seed', seed);
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
let sortPresses = 0, stopTaps = 0, goTaps = 0, bossTaps = 0, ufoSeen = 0, ufoGo = 0, rushStops = 0;
let lastUfo = null;
const reviews = [];
while (Date.now() - t0 < 300000) {
  const keys = await active();
  // 切り替えの途中は2つのシーンが同時に動いているので、結果画面があればそちらを優先する
  const k = keys.includes('Result') ? 'Result' : keys[keys.length - 1] ?? '';
  if (k !== last) { await page.waitForTimeout(400); await shot(k); last = k; console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', k); }
  if (k === 'Result') {
    await page.waitForTimeout(7000); await shot('result_end');
    // 共有カードの画像と、結果発表で撮った「いちばんひどい場面」の写真も書き出す
    const img = await page.evaluate(() => ({ card: window.resultDev?.card?.small?.toDataURL('image/png') ?? null, worst: window.__game.registry.get('run')?.worstShot?.src ?? null }));
    if (img.card) writeFileSync(`${outDir}/${String(n++).padStart(2, '0')}_card.png`, Buffer.from(img.card.split(',')[1], 'base64'));
    if (img.worst?.startsWith('data:')) writeFileSync(`${outDir}/${String(n++).padStart(2, '0')}_worstshot.png`, Buffer.from(img.worst.split(',')[1], 'base64'));
    break;
  }
  if (k === 'StageSelect') { await page.evaluate((id) => window.__sh?.select?.(id), stage); await page.waitForTimeout(800); continue; }
  if (k === 'Intro') { await tap(108, H - 80); await page.waitForTimeout(250); continue; }
  if (k === 'Sort') {
    await page.waitForTimeout(700);
    let key = Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight';
    if (!random) {
      // 今の人の正体を見て決める(ワルとボスは左、市民は右)
      const p = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Sort'); const r = window.__game.registry.get('run');
        const q = s.people?.[s.idx]; return q ? { truth: q.truth, wave: r.waveIndex + 1 } : null;
      });
      if (!p) { await page.waitForTimeout(200); continue; }
      const bad = p.truth === 'boss' ? !bossCiv : p.truth === 'bad' && !(missWave1 && p.wave === 1);
      key = bad ? 'ArrowLeft' : 'ArrowRight';
    }
    await page.keyboard.press(key); sortPresses++;
    if (sortPresses % 4 === 1) await shot('sort');
    continue;
  }
  if (k === 'Street' && !random) {
    // 合図を見て押す。UFOは1機目だけ行けで落とす。ラッシュは市民にだけ待て。帯の説明はタップで送る
    const st = await page.evaluate(() => {
      const d = window.streetDev; if (!d) return null;
      const u = d.ufoPart.ufos.current; const m = d.rushPart.rushMen.find((x) => x.state === 'mark');
      const b = (x) => ({ x: x.x + x.w / 2, y: x.y + x.h / 2 });
      return { ufo: u ? u.alienId + ':' + u.phase : null, beam: u?.phase === 'beam' && !!d.goHandler, rushIntro: d.rushPart.rushOn && !d.rushPart.rushRunning,
        rushCiv: d.rushPart.rushRunning && !!d.stopHandler && m?.r.truth === 'civ', go: b(d.goBtn), stop: b(d.stopBtn) };
    });
    if (st?.ufo && st.ufo.split(':')[0] !== lastUfo) { lastUfo = st.ufo.split(':')[0]; ufoSeen++; }
    if (st?.beam && ufoSeen === 1 && ufoGo === 0) { await page.waitForTimeout(500); await shot('ufo_beam'); await tap(st.go.x, st.go.y); ufoGo++; goTaps++; await page.waitForTimeout(1200); await shot('ufo_down'); }
    else if (st?.ufo?.endsWith(':leave')) { await shot('ufo_abduct'); await page.waitForTimeout(1500); }
    else if (st?.rushCiv) { await tap(st.stop.x, st.stop.y); rushStops++; stopTaps++; }
    else if (st?.rushIntro) { await page.waitForTimeout(1500); if (!rushStops) await shot('rush_band'); await tap(108, 110); }
    await page.waitForTimeout(80);
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
const finalStats = await page.evaluate(() => window.__game.registry.get('run')?.stats.snapshot() ?? null);
console.log('taps', { sortPresses, stopTaps, goTaps, bossTaps, ufoSeen, ufoGo, rushStops }, 'total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
const ng = [];
if (errors.length) ng.push(`エラー ${errors.length} 件`);
if (!reached) ng.push(`結果画面まで行けなかった(最後は ${last || 'なし'})`);
if (playedStage !== stage) ng.push(`遊んだステージが ${playedStage}`);
if (reviews.join(',') !== '1,2,3') ng.push(`答え合わせが波 ${reviews.join(',') || 'なし'} だけ`);
if (missWave1 && ufoSeen === 0) ng.push('UFOが来なかった');
const final = finalStats;
if (final && !random && stage === 'mall' && !final.rush) ng.push('タイムセールラッシュがなかった');
console.log('stats', JSON.stringify(final && { stage: final.stageId, defeated: final.defeated, hurt: final.civHurt, damage: final.damage, ufosDowned: final.ufosDowned, abducted: final.civHurtByAbduction, rush: final.rush, bossSortedCiv: final.bossSortedCiv, bossDefeated: final.bossDefeated, worst: final.worstScene, propsBroken: final.propsBroken }));
console.log(ng.length ? `NG ${ng.join('、')}` : `OK ${stage} を結果画面まで遊んだ`);
process.exit(ng.length ? 1 : 0);
