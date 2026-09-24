// フリープレイ(docs/FREEPLAY.md)の3つの波を、開発用の入口から通しで遊ぶ。落ちないか、最後に結果画面へ行くか、数が合うかを見る。
// 使い方: npx vite --port 5151 --strictPort を動かしてから
//   node tools/free_play.mjs <URL(例 http://localhost:5151/)> <出力フォルダ> [押し方] [種] [開いているステージ]
// 押し方(書かなければ both):
//   good  市民への待てのマークと、行けのマーク(悪さのワル、ギャングの組、UFO)だけを、出たらすぐ押す。
//         波1の始めに1回だけ、マークのないときに待てを押す(空押し。ヒーローが振り向き、空押しに1回数えるか)
//   none  何も押さない(ヒーローにまかせる)
//   both  good と none を続けて
// 開いているステージは alley,garage,mall のように書く(書かなければ3つとも)。
// 場面ごとに画面を撮る(波の始めの決めつけ、最初の待てと行けのマーク、波3の言い直し、結果画面)。
// エラーが出たとき、結果画面まで行けなかったとき、数が合わないときは exit code 1 で終わる。
import { mkdirSync } from 'node:fs';
import { checker, openBrowser, openPage, touchPad } from './lib.mjs';

const [url, outDir, policyArg = 'both', seed = '7', unlocked = 'alley,garage,mall'] = process.argv.slice(2);
if (!url || !outDir) { console.error('usage: node tools/free_play.mjs <url> <outDir> [good|none|both] [seed] [unlocked]'); process.exit(2); }
const policies = policyArg === 'both' ? ['good', 'none'] : [policyArg];
if (policies.some((p) => !['good', 'none'].includes(p))) { console.error(`押し方は good、none、both のどれか(${policyArg})`); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const browser = await openBrowser();
const { check, done } = checker();

/** 画面の中のいまの様子(フリープレイの通り) */
const peek = () => {
  const g = window.__game;
  const keys = g.scene.getScenes(true).map((s) => s.scene.key).filter((k) => !k.startsWith('Ui'));
  const run = g.registry.get('run');
  const sd = window.streetDev;
  const st = { keys, wave: run?.waveIndex ?? -1, street: null };
  if (!sd || !keys.includes('Street') || !sd.free) return st;
  const f = sd.free;
  const marked = sd.queue.find((a) => a.markKind === 'stop' && a.standing);
  const btn = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  st.street = {
    open: f.inputOpen,
    stopMark: sd.stopHandler !== null,
    stopCiv: !!marked && marked.civ,
    stopId: marked?.person?.id ?? null,
    go: f.goTarget() !== null,
    stopLocked: f.dryStop.locked(sd.time.now),
    goLocked: f.dryGo.locked(sd.time.now),
    redeclared: f.redeclared,
    heroFlip: sd.hero.sprite.flipX,
    stopBtn: btn(sd.stopBtn),
    goBtn: btn(sd.goBtn),
    clock: run.free.clockMs,
    leaving: sd.leaving
  };
  return st;
};

/** その回で出てくる人から、数の答えを出す(待てのチャンス、行けの場面、行けで逃げうるワルの人数) */
const expected = () => {
  const run = window.__game.registry.get('run');
  const plan = run.free.plan;
  let stop = 0, goScenes = 0, goPeople = 0;
  plan.stage.waves.forEach((w, i) => {
    const fw = plan.waves[i];
    for (const p of w.people) {
      const rule = fw.redeclare && p.index >= fw.redeclare.after ? fw.redeclare.rule : fw.rule;
      const attack = rule.kind === 'allBad' || (rule.kind === 'item' && p.item === rule.item);
      if (p.truth === 'civ' && attack) stop++;
      if (p.truth === 'bad' && !attack) {
        goPeople++;
        const g = p.group ? w.groups.find((x) => x.id === p.group) : null;
        if (!g || g.memberIds[0] === p.id) goScenes++;
      }
    }
  });
  return { stop, goScenes, goPeople, chances: plan.chances };
};

async function play(policy) {
  const errors = [];
  const page = await openPage(browser, { errors });
  // 読みこめなかったファイル(外への通信が止められている環境など)はゲームのエラーに数えず、名前だけ出す
  const failed = new Set();
  page.on('response', (r) => { if (r.status() >= 400) failed.add(`${r.status()} ${r.url()}`); });
  const u = new URL(url);
  u.search = '';
  u.searchParams.set('scene', 'Street');
  u.searchParams.set('free', '1');
  u.searchParams.set('wave', '1');
  u.searchParams.set('seed', seed);
  u.searchParams.set('unlocked', unlocked);
  await page.goto(u.toString());
  await page.waitForFunction(() => window.streetDev && window.streetDev.free, null, { timeout: 30000 });
  const pad = await touchPad(page);
  const exp = await page.evaluate(expected);
  console.log(`[${policy}] 待てのチャンス ${exp.stop}、行けの場面 ${exp.goScenes}(ワル ${exp.goPeople}人)、場面 ${exp.chances.scenes}`);
  const shots = new Set();
  const shot = async (name) => {
    if (shots.has(name)) return;
    shots.add(name);
    await page.screenshot({ path: `${outDir}/${policy}_${name}.png` });
  };
  const t0 = Date.now();
  let lastWave = -1;
  let pressedStop = null;
  let pressedGoAt = 0;
  let dryDone = false;
  let dryTurned = null;
  let reached = false;
  let declareShotAt = 0;
  while (Date.now() - t0 < 360000) {
    const st = await page.evaluate(peek);
    if (st.keys.includes('Result')) { reached = true; break; }
    const s = st.street;
    if (!s) { await page.waitForTimeout(100); continue; }
    if (st.wave !== lastWave) { lastWave = st.wave; declareShotAt = Date.now() + 2300; pressedStop = null; }
    // 決めつけの吹き出しが出ているところを撮る
    if (declareShotAt && Date.now() >= declareShotAt) { declareShotAt = 0; await shot(`w${st.wave + 1}_declare`); }
    if (s.stopMark) await shot(`w${st.wave + 1}_stopmark`);
    if (s.go) await shot(`w${st.wave + 1}_gomark`);
    if (s.redeclared) await shot('w3_redeclare');
    if (policy === 'good' && s.open && !s.leaving) {
      // 波1の始め、マークのないときに1回だけ空押し
      if (!dryDone && st.wave === 0 && !s.stopMark && !s.go && s.clock > 800) {
        dryDone = true;
        await pad.tap(s.stopBtn.x, s.stopBtn.y);
        await page.waitForTimeout(60);
        dryTurned = await page.evaluate(() => window.streetDev.hero.sprite.flipX);
        await shot('w1_drypress');
        continue;
      }
      if (s.stopMark && s.stopCiv && pressedStop !== s.stopId && !s.stopLocked) {
        pressedStop = s.stopId;
        await pad.tap(s.stopBtn.x, s.stopBtn.y);
        continue;
      }
      if (s.go && !s.goLocked && Date.now() - pressedGoAt > 250) {
        pressedGoAt = Date.now();
        await pad.tap(s.goBtn.x, s.goBtn.y);
        continue;
      }
    }
    await page.waitForTimeout(40);
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  check(`[${policy}] 結果画面まで行く`, reached, `${secs}秒`);
  await page.waitForTimeout(1500);
  await shot('result');
  const snap = await page.evaluate(() => window.__game.registry.get('run').stats.snapshot());
  const f = snap.free;
  check(`[${policy}] フリープレイの数がある`, !!f);
  if (f) {
    console.log(`[${policy}] 待てで守った ${f.stopSaved}/${f.stopChances}、行けで決めた ${f.goScenes}/${f.goChances}、取り返し ${f.recovered}、` +
      `空押し ${f.dryPresses}、逃がした ${snap.escaped}、けが ${snap.civHurt}(ヒーロー ${snap.civHurtByHero})、` +
      `当たり ${f.heroRight}→${f.fixedRight}/${f.units}、時計 ${f.rawSec?.toFixed(1)}秒、クリア ${f.clearSec?.toFixed(1)}秒${f.slow ? '(ゆっくり)' : ''}`);
    check(`[${policy}] チャンスの数(待て9、行け8、場面27)`, f.stopChances === 9 && f.goChances === 8 && f.units === 27 && exp.stop === 9 && exp.goScenes === 8);
    check(`[${policy}] 時計が進んで止まった`, f.rawSec !== null && f.rawSec > 30 && f.rawSec < 400, String(f.rawSec));
    check(`[${policy}] クリアの時間は、逃がしたワルと市民のけが1人につき3秒を足す`, Math.abs(f.clearSec - (f.rawSec + (snap.escaped + snap.civHurt) * 3)) < 1e-6);
    if (policy === 'good') {
      check('[good] 待てで市民を全員守った', f.stopSaved === 9, String(f.stopSaved));
      check('[good] 行けを全部決めた', f.goScenes === 8, String(f.goScenes));
      check('[good] 空押しは1回(波1の始め)', f.dryPresses === 1, String(f.dryPresses));
      check('[good] 空押しでヒーローが振り向いた', dryTurned === true);
      check('[good] ヒーローが殴った市民はいない', snap.civHurtByHero === 0, String(snap.civHurtByHero));
      check('[good] 逃がしたワルはいない', snap.escaped === 0, String(snap.escaped));
      check('[good] 直したあとは全部当たり(巻きぞえのほかは)', f.fixedRight === f.units, `${f.fixedRight}/${f.units}`);
    } else {
      check('[none] 待ても行けも効いていない', f.effectiveStops === 0 && f.effectiveGos === 0 && f.stopSaved === 0 && f.goScenes === 0);
      check('[none] 空押しはない', f.dryPresses === 0);
      check('[none] 待てのチャンスの市民は全員殴られた', snap.civHurtByHero === 9, String(snap.civHurtByHero));
      check('[none] 素通りされたワルは全員逃げた', snap.escaped === exp.goPeople, `${snap.escaped}/${exp.goPeople}`);
      check('[none] 直したあとの当たりはヒーローだけと同じ', f.fixedRight === f.heroRight, `${f.fixedRight}/${f.heroRight}`);
    }
  }
  if (failed.size) console.log(`[${policy}] 読みこめなかったファイル: ${[...failed].slice(0, 5).join(', ')}`);
  const real = errors.filter((e) => !e.startsWith('console: Failed to load resource'));
  check(`[${policy}] エラーが出ない`, real.length === 0, real.slice(0, 3).join(' / '));
  await page.close();
}

for (const p of policies) await play(p);
await browser.close();
done();
