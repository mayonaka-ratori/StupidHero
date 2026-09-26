// タイトルから結果画面まで、自動で通しで遊ぶ。エラーが出ないかと、各場面の見た目を確かめる。
// 波ごとの答え合わせ(WaveReview)は、行が出そろうのを待って撮り、次へを押す(波の数だけ通ったかも確かめる)。
// 使い方: npm run dev を動かしてから node tools/playthrough.mjs [サーバーかURL] [出力フォルダ] [種] [ステージ(alley、garage、mall、tower)] [仕分け]
// サーバーと出力フォルダは、省くか - にすると http://localhost:5173/ と shots/(例 node tools/playthrough.mjs - - 5 mall truth)
// garage、mall、tower のときは、前のステージのボスを倒した記録を先に入れておき、タイトルからステージを選ぶ画面を通って遊ぶ
// tower は4つの波。ステージを選ぶ画面では NEW! の高層ビルのカードが見えているかを見て、指でタップする。
// 波の間の階の数字(Floor)、波3のあとのエレベーターラッシュ(Elevator)、ボス戦の念力の選択、終わりの場面(Ending)も通る
// 仕分け(書かなければ random):
//   random  でたらめに仕分け、結果発表でもでたらめに待てと行けを押す(前からの動き)
//   truth   正しく仕分ける。結果発表では合図が出たら正しく押す(UFOは行けで落とす、ラッシュとエレベーターは市民にだけ待て、
//           念力の選択は待てと行けの両方)。random ではエレベーターと念力の選択もでたらめに押す
//   ufo     truth と同じだが、波1のワル(宇宙人)を市民に仕分ける。1機目のUFOは行けで落とし、2機目からは押さない(さらわれる)
//   bossciv truth と同じだが、ボスを市民に仕分ける。ufo+bossciv のように + でつなげる
// エラーが出たとき、結果画面まで行けなかったときは exit code 1 で終わる。
import { writeFileSync } from 'node:fs';
import { clearedRecords, logicalHeight, openBrowser, openPage, serverUrl, shotsDir, touchPad, waitForGame } from './lib.mjs';

const [urlArg, outArg, seed = '', stage = 'alley', policy = 'random'] = process.argv.slice(2);
const url = serverUrl(urlArg);
const outDir = shotsDir(outArg);
const PREV = { alley: [], garage: ['alley'], mall: ['alley', 'garage'], tower: ['alley', 'garage', 'mall'] }[stage];
if (!PREV) { console.error(`ステージは alley、garage、mall、tower のどれか(${stage})`); process.exit(2); }
const WAVES = stage === 'tower' ? 4 : 3;
const random = policy === 'random';
const missWave1 = policy.split('+').includes('ufo');
const bossCiv = policy.split('+').includes('bossciv');
const browser = await openBrowser();
const errors = [];
// 途中で Vite がページを読み直さないように、通知は切ってある
const page = await openPage(browser, { errors });
// 前のステージのボスを倒した記録(src/logic/records.ts の形)。開いていないと選べないので先に入れておく
if (PREV.length) {
  const records = clearedRecords(PREV);
  await page.addInitScript((r) => { if (!sessionStorage.getItem('pt')) { sessionStorage.setItem('pt', '1'); localStorage.setItem('stupidhero.records.v2', r); } }, JSON.stringify(records));
}
// 階の数字の場面(Floor)は1秒しかなく、重い端末では外から見のがすので、ページの中で見張って覚えておく
await page.addInitScript(() => {
  window.__floorsSeen = [];
  setInterval(() => {
    const g = window.__game; const f = g?.scene?.isActive('Floor') ? g.scene.getScene('Floor') : null;
    const w = g?.registry?.get('run')?.waveIndex;
    if (f?.to && w !== undefined && !window.__floorsSeen.some((x) => x.wave === w + 1)) window.__floorsSeen.push({ wave: w + 1, to: `${f.to}F` });
  }, 30);
});
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
// 高層ビル:見た階の数字、エレベーターで待てを押した人、念力の選択、終わりの場面のセリフの数、ステージを選ぶ画面で見えていたか
const floors = [];
const liftHandled = new Set();
// 答え合わせで次へを押した時刻(押したあとは波が1つ進むので、押し直すまでは波を読まない)
let reviewTapAt = 0;
let liftStops = 0, liftLog = [], choiceSeen = 0, choicePress = [], endingLines = 0, endingSeen = 0, cardVisible = null;
while (Date.now() - t0 < (stage === 'tower' ? 600000 : 300000)) {
  const keys = await active();
  // 切り替えの途中は2つのシーンが同時に動いているので、結果画面があればそちらを優先する
  const k = keys.includes('Result') ? 'Result' : keys[keys.length - 1] ?? '';
  if (k !== last) { reviewTapAt = 0; await page.waitForTimeout(k === 'Floor' ? 250 : 400); await shot(k); last = k; console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', k); }
  if (k === 'Result') {
    await page.waitForTimeout(7000); await shot('result_end');
    // 共有カードの画像と、結果発表で撮った「いちばんひどい場面」の写真も書き出す
    const img = await page.evaluate(() => ({ card: window.resultDev?.card?.small?.toDataURL('image/png') ?? null, worst: window.__game.registry.get('run')?.worstShot?.src ?? null }));
    if (img.card) writeFileSync(`${outDir}/${String(n++).padStart(2, '0')}_card.png`, Buffer.from(img.card.split(',')[1], 'base64'));
    if (img.worst?.startsWith('data:')) writeFileSync(`${outDir}/${String(n++).padStart(2, '0')}_worstshot.png`, Buffer.from(img.worst.split(',')[1], 'base64'));
    break;
  }
  if (k === 'StageSelect' && stage === 'tower') {
    // NEW! の高層ビルのカードが開いたときに見えているかを見て、指でタップする
    await page.waitForTimeout(1200);
    const c = await page.evaluate(() => { const s = window.__sh?.scroll?.(); const c = window.__sh?.cards?.().find((x) => x.id === 'tower'); return s && c ? { s, c } : null; });
    if (!c) { await page.waitForTimeout(300); continue; }
    if (cardVisible === null) { cardVisible = c.c.y - c.c.h / 2 >= c.s.viewTop && c.c.y + c.c.h / 2 <= c.s.viewTop + c.s.viewH; await shot('stageselect_tower'); }
    await tap(c.c.x, c.c.y);
    await page.waitForTimeout(1500);
    continue;
  }
  if (k === 'StageSelect') { await page.evaluate((id) => window.__sh?.select?.(id), stage); await page.waitForTimeout(800); continue; }
  if (k === 'Floor') { await page.waitForTimeout(150); continue; }
  if (k === 'Elevator') {
    const st = await page.evaluate(() => {
      const s = window.liftDev?.scene; if (!s) return null;
      const m = s.men.find((x) => x.state === 'mark'); const b = s.stopBtn;
      return { phase: s.phase, running: s.running, mark: s.stopHandler && m ? { i: m.r.index, civ: m.r.truth === 'civ' } : null,
        stop: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, log: [...window.liftDev.log] };
    });
    if (!st) { await page.waitForTimeout(200); continue; }
    liftLog = st.log;
    if (st.phase === 'intro' && !st.running && st.log.some((l) => l.startsWith('intro:'))) {
      await page.waitForTimeout(1200); if (!liftHandled.size) await shot('lift_intro'); await tap(108, 110); await page.waitForTimeout(500);
    } else if (st.mark && !liftHandled.has(st.mark.i)) {
      liftHandled.add(st.mark.i);
      await page.waitForTimeout(200);
      if (st.mark.i === 0 || st.mark.i === 5) await shot(`lift_mark${st.mark.i}`);
      if (random ? Math.random() < 0.5 : st.mark.civ) { await tap(st.stop.x, st.stop.y); liftStops++; }
    } else if (st.log.some((l) => l.startsWith('summary:')) && !liftHandled.has('sum')) {
      liftHandled.add('sum'); await page.waitForTimeout(300); await shot('lift_arrive');
    }
    await page.waitForTimeout(60);
    continue;
  }
  if (k === 'Ending') {
    const e = await page.evaluate(() => (window.__sh?.key === 'Ending' ? window.__sh.state() : null));
    if (e && e.index >= 0 && !e.typing && e.index + 1 > endingLines) {
      if (!endingLines) endingSeen++;
      endingLines = e.index + 1; await page.waitForTimeout(300); await shot(`ending${endingLines}`);
    }
    if (e && e.index >= 0 && !e.typing) await tap(108, H - 100);
    await page.waitForTimeout(400);
    continue;
  }
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
    if (reviewTapAt && Date.now() - reviewTapAt < 8000) { await page.waitForTimeout(300); continue; }
    await page.waitForTimeout(2600);
    const info = await page.evaluate(() => {
      const d = window.reviewDev;
      const r = window.__game.registry.get('run');
      return { wave: r.waveIndex + 1, rows: d.rows.length, done: d.scene.tl.done, btn: { x: d.next.x + d.next.w / 2, y: d.next.y + d.next.h / 2 } };
    });
    if (!reviews.includes(info.wave)) { reviews.push(info.wave); await shot(`review${info.wave}`); console.log('review', JSON.stringify(info)); }
    await tap(info.btn.x, info.btn.y);
    reviewTapAt = Date.now();
    await page.waitForTimeout(900);
    continue;
  }
  if (k === 'Boss') {
    // 高層ビル:念力の選択が出たら、連打を止めて待てと行けを押す(random はそれぞれ半々で押す)
    const choice = () => page.evaluate(() => {
      const s = window.__game.scene.getScene('Boss'); if (!s || s.phase !== 'choice') return null;
      const r = (x) => ({ x: x.x + x.w / 2, y: x.y + x.h / 2 });
      return { open: s.choiceOpen, stop: s.choiceStop && r(s.choiceStop), go: s.choiceGo && r(s.choiceGo) };
    });
    const c = await choice();
    if (c) {
      if (c.open && choiceSeen === 0) {
        choiceSeen++;
        await page.waitForTimeout(450); await shot('boss_choice');
        for (const [name, b] of [['stop', c.stop], ['go', c.go]]) {
          if (random && Math.random() < 0.5) continue;
          await tap(b.x, b.y); choicePress.push(name); await page.waitForTimeout(150);
        }
        await page.waitForTimeout(600); await shot('boss_choice_after');
      }
      await page.waitForTimeout(100);
      continue;
    }
    for (let i = 0; i < 6; i++) {
      if ((await active()).includes('WaveReview')) break;
      if (await choice()) break;
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
floors.push(...await page.evaluate(() => window.__floorsSeen ?? []));
const recordsAfter = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('stupidhero.records.v2')); } catch { return null; } });
const resultTitle = await page.evaluate(() => window.__game.registry.get('run')?.title ?? window.resultDev?.title ?? null).catch(() => null);
console.log('taps', { sortPresses, stopTaps, goTaps, bossTaps, ufoSeen, ufoGo, rushStops }, 'total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
if (stage === 'tower') {
  console.log('tower', JSON.stringify({ cardVisible, floors, liftStops, liftLog, choicePress, endingSeen, endingLines, endingSeenRecord: recordsAfter?.endingSeen, titles: recordsAfter?.titles }));
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
const ng = [];
if (errors.length) ng.push(`エラー ${errors.length} 件`);
if (!reached) ng.push(`結果画面まで行けなかった(最後は ${last || 'なし'})`);
if (playedStage !== stage) ng.push(`遊んだステージが ${playedStage}`);
if (reviews.join(',') !== Array.from({ length: WAVES }, (_, i) => i + 1).join(',')) ng.push(`答え合わせが波 ${reviews.join(',') || 'なし'} だけ`);
if (missWave1 && ufoSeen === 0) ng.push('UFOが来なかった');
const final = finalStats;
if (final && !random && stage === 'mall' && !final.rush) ng.push('タイムセールラッシュがなかった');
if (stage === 'tower') {
  if (cardVisible !== true) ng.push('ステージを選ぶ画面で NEW! の高層ビルのカードが見えていなかった');
  if (floors.map((f) => `${f.wave}:${f.to}`).join(',') !== '2:18F,3:35F') ng.push(`階の数字が ${JSON.stringify(floors)}`);
  if (!liftLog.some((l) => l.startsWith('summary:'))) ng.push('エレベーターラッシュのまとめが出なかった');
  if (liftHandled.size < 6) ng.push(`エレベーターのマークが ${liftHandled.size} 人`);
  if (!final?.lift) ng.push('エレベーターの数がない');
  if (final?.bossDefeated && !bossCiv && choiceSeen === 0) ng.push('念力の選択が出なかった');
  if (final?.bossDefeated && endingSeen !== 1) ng.push(`終わりの場面が ${endingSeen} 回`);
  if (final?.bossDefeated && recordsAfter?.endingSeen !== true) ng.push('終わりの場面を見た記録がない');
}
console.log('stats', JSON.stringify(final && { stage: final.stageId, defeated: final.defeated, hurt: final.civHurt, damage: final.damage, ufosDowned: final.ufosDowned, abducted: final.civHurtByAbduction, rush: final.rush, bossSortedCiv: final.bossSortedCiv, bossDefeated: final.bossDefeated, worst: final.worstScene, propsBroken: final.propsBroken, lift: final.lift }));
console.log(ng.length ? `NG ${ng.join('、')}` : `OK ${stage} を結果画面まで遊んだ`);
process.exit(ng.length ? 1 : 0);
