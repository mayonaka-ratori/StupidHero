// フリープレイ(docs/FREEPLAY.md)の3つの波を、開発用の入口から通しで遊ぶ。落ちないか、最後に結果画面へ行くか、数が合うかを見る。
// 使い方: npm run dev を動かしてから
//   node tools/free_play.mjs [サーバーかURL] [出力フォルダ] [押し方] [種] [開いているステージ]
// サーバーと出力フォルダは、省くか - にすると http://localhost:5173/ と shots/(例 node tools/free_play.mjs - - good 7 alley)
// 押し方(書かなければ both):
//   good  市民への待てのマークと、行けのマーク(悪さのワル、ギャングの組、UFO)だけを、出たらすぐ押す。
//         波1の始めに1回だけ、マークのないときに待てを押す(空押し。ヒーローが振り向き、空押しに1回数えるか)
//   none  何も押さない(ヒーローにまかせる)
//   late  市民への待ては、ためのいちばん最後(ギリギリセーフ)に押す。最初に殴りかかられるワルにも1回だけ待てを押し、
//         悪さを始めたら行けで取り返す。行けのマークは出たらすぐ指で押す(待ては、遅れないようにページの中から押す)
//   two   行けのマークが2つ同時に出る場面をわざと作る。波3から始め、モヒカンが逃げるまでを開発用に8秒にのばす(?threat=8)。
//         種は、波3で素通りされるモヒカンのすぐあと(3人以内)に、もう1つ行けの場面がある種を、指定した種から探す。
//         (a) 行けのマークが2つあるときに行けを押し、先に出たほうだけに効くか
//         (b) 待てのマークのため(前半)の最中に行けを押し、その場から光の拳が飛んで、ためが続くか
//         (c) 言い直しで止めている間に行けのマークがあれば行けを押し、止めが終わってから効くか(空押しに数えないか)
//   both  good と none を続けて(all は good、none、late、two)
// 開いているステージは alley,garage,mall のように書く(書かなければ3つとも)。
// 環境変数 SLOW=1 でゆっくりモード、REDUCE=1 で「光と揺れを弱くする」をオンにして始める(設定を先に入れておく)。
// 場面ごとに画面を撮る(波の始めの決めつけ、最初の待てと行けのマーク、波3の言い直し、結果画面)。
// エラーが出たとき、結果画面まで行けなかったとき、数が合わないときは exit code 1 で終わる。
import { checker, openBrowser, openPage, serverUrl, shotsDir, touchPad } from './lib.mjs';

const [urlArg, outArg, policyArg = 'both', seed = '7', unlocked = 'alley,garage,mall'] = process.argv.slice(2);
const url = serverUrl(urlArg);
const outDir = shotsDir(outArg);
const policies = policyArg === 'both' ? ['good', 'none'] : policyArg === 'all' ? ['good', 'none', 'late', 'two'] : [policyArg];
if (policies.some((p) => !['good', 'none', 'late', 'two'].includes(p))) { console.error(`押し方は good、none、late、two、both、all のどれか(${policyArg})`); process.exit(2); }
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
  const marked = sd.queue.find((a) => a.mark?.texture.key === 'fx_mark_stop' && a.standing);
  const btn = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  st.street = {
    open: f.inputOpen,
    stopMark: sd.stopHandler !== null,
    stopCiv: !!marked && marked.civ,
    stopId: marked?.person?.id ?? null,
    windup: f.windupProgress,
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

/**
 * late の待て:ページの中で毎コマ見張り、市民へのためがいちばん最後(0.85より先)まで進んだら待てを押す。
 * 指で押すと、ブラウザとのやりとりの遅れで間に合わないことがあるので、ボタンを押したときと同じ pressStop を呼ぶ。
 * 最初に殴りかかられるワルにも1回だけ待てを押す(取り返しを見る)
 */
const lateWatcher = () => {
  const done = new Set();
  let villain = false;
  const tick = () => {
    const sd = window.streetDev;
    const f = sd?.free;
    if (f && sd.sys.isActive() && sd.stopHandler) {
      const a = sd.queue.find((q) => q.mark?.texture.key === 'fx_mark_stop' && q.standing);
      const id = a?.person?.id;
      if (a && !done.has(id)) {
        if (!a.civ && !villain) { villain = true; done.add(id); f.pressStop(); }
        else if (a.civ && f.windupProgress !== null && f.windupProgress >= 0.85) { done.add(id); f.pressStop(); }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function play(policy) {
  const errors = [];
  const page = await openPage(browser, { errors });
  const slow = process.env.SLOW === '1';
  const reduce = process.env.REDUCE === '1';
  if (slow || reduce) {
    await page.addInitScript((v) => localStorage.setItem('stupidhero.settings.v1', v), JSON.stringify({ slowMode: slow, reduceFx: reduce }));
  }
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
  if (policy === 'late') await page.evaluate(lateWatcher);
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
  let villainStopped = false;
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
    if (policy === 'late' && s.open && !s.leaving) {
      // 待ては、ページの中の見張り(lateWatcher)が押す。行けのマークは出たらすぐ指で押す
      if (s.stopMark && !s.stopCiv) await shot('late_villainstop');
      if (s.go && !s.goLocked && Date.now() - pressedGoAt > 250) {
        pressedGoAt = Date.now();
        await pad.tap(s.goBtn.x, s.goBtn.y);
        continue;
      }
      await page.waitForTimeout(30);
      continue;
    }
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
  const seen = await page.evaluate(() => window.__game.registry.get('run') && window.streetDev?.free?.seen);
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
    console.log(`[${policy}] 起きた場面: ${JSON.stringify(seen)}`);
    check(`[${policy}] チャンスの数(待て9、行け8、場面27)`, f.stopChances === 9 && f.goChances === 8 && f.units === 27 && exp.stop === 9 && exp.goScenes === 8);
    check(`[${policy}] ゆっくりモードの印`, f.slow === slow, String(f.slow));
    check(`[${policy}] 時計が進んで止まった`, f.rawSec !== null && f.rawSec > 30 && f.rawSec < 400, String(f.rawSec));
    check(`[${policy}] クリアの時間は、逃がしたワル、市民のけが、ワルへの待て1つにつき3秒を足す`,
      Math.abs(f.clearSec - (f.rawSec + (snap.escaped + snap.civHurt + snap.badSparedByStop) * 3)) < 1e-6);
    check(`[${policy}] 待てと行けのチャンスは巻きぞえで消えない(ヒーローが殴った市民と守った市民で9人)`,
      policy === 'two' || snap.civHurtByHero + f.stopSaved === 9, `${snap.civHurtByHero}+${f.stopSaved}`);
    if (policy === 'good') {
      check('[good] 待てで市民を全員守った', f.stopSaved === 9, String(f.stopSaved));
      check('[good] 行けを全部決めた', f.goScenes === 8, String(f.goScenes));
      check('[good] 空押しは1回(波1の始め)', f.dryPresses === 1, String(f.dryPresses));
      check('[good] 空押しでヒーローが振り向いた', dryTurned === true);
      check('[good] ヒーローが殴った市民はいない', snap.civHurtByHero === 0, String(snap.civHurtByHero));
      check('[good] 逃がしたワルはいない', snap.escaped === 0, String(snap.escaped));
      check('[good] 直したあとは全部当たり(巻きぞえのほかは)', f.fixedRight === f.units, `${f.fixedRight}/${f.units}`);
    } else if (policy === 'late') {
      check('[late] ワルに待てを押して、取り返しを数えた', f.recovered >= 1 || snap.escaped >= 1, `取り返し ${f.recovered}`);
      check('[late] 空押しはない', f.dryPresses === 0, String(f.dryPresses));
      check('[late] ギリギリセーフが起きた', (seen?.closeCall ?? 0) >= 1, String(seen?.closeCall));
      check('[late] ギリギリで待てを押した市民も全員守れた', f.stopSaved === 9, String(f.stopSaved));
      check('[late] ギリギリセーフが待てのチャンスの数だけ起きた', seen?.closeCall === 9, String(seen?.closeCall));
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

/**
 * two の見張り(ページの中で毎コマ)。kind が 'ab' なら (a) と (b)、'c' なら (c) を試す。
 * 市民への待ては、ためが6割まで進んだら押す(前半は (b) を試すため)。
 * 行けは、(a) と (b) を試し終わるまでは、2つそろうか、ための前半になるまで待つ(モヒカンは6秒まで)。試し終わったら、すぐ押す
 */
const twoWatcher = (kind) => {
  const r = { a: null, b: null, c: null };
  const skipAB = kind === 'c';
  window.__two = r;
  const stopped = new Set();
  const targets = (sd, f) => [...f.threats.map((t) => t.since), ...(sd.goHandler ? [sd.goSince] : [])];
  const tick = () => {
    const sd = window.streetDev;
    const f = sd?.free;
    // (c) 言い直しで止めている間に行けを押す:止めが終わったら効き、空押しに数えない
    if (kind === 'c' && f && sd.sys.isActive() && f.held && f.threats.length > 0 && !r.c) {
      const run = window.__game.registry.get('run');
      const dry0 = run.stats.snapshot().free.dryPresses;
      const n0 = f.threats.length;
      const oldest = Math.min(...f.threats.map((t) => t.since));
      f.pressGo();
      r.c = { pending: true, n0, dry0, oldest, heldAfterPress: f.threats.some((t) => t.since === oldest) };
    } else if (f && r.c?.pending && !f.held) {
      const run = window.__game.registry.get('run');
      r.c = { ...r.c, pending: false, n1: f.threats.length, hit: !f.threats.some((t) => t.since === r.c.oldest), dry1: run.stats.snapshot().free.dryPresses };
    }
    if (f && sd.sys.isActive() && f.inputOpen && !f.held) {
      const now = sd.time.now;
      const marked = sd.queue.find((q) => q.mark?.texture.key === 'fx_mark_stop' && q.standing);
      const w = f.windupProgress;
      if (marked && marked.civ && w !== null && w >= 0.6 && !stopped.has(marked.person.id)) { stopped.add(marked.person.id); f.pressStop(); }
      const list = targets(sd, f);
      if (list.length >= 2 && !r.a && !skipAB) {
        const before = [...list];
        const oldest = Math.min(...before);
        f.pressGo();
        const after = targets(sd, f);
        r.a = { before, after, oldest, ok: !after.includes(oldest) && after.length === before.length - 1 };
      } else if (list.length >= 1 && !r.b && !skipAB && marked && w !== null && w < 0.5 && f.threats.length > 0
        && (r.a || now - Math.min(...list) > 5000)) {
        // (b) は (a) のあと(先にためで行けを使うと、2つそろう前にモヒカンを倒してしまうため)
        const fist0 = f.seen.fist;
        const p0 = w;
        f.pressGo();
        const probe = (n) => {
          if (n > 0) { requestAnimationFrame(() => probe(n - 1)); return; }
          r.b = { p0, p1: f.windupProgress, mode: f.heroMode, fist: f.seen.fist - fist0, stillMarked: marked.mark?.texture.key === 'fx_mark_stop' };
        };
        probe(6);
      } else if (list.length >= 1) {
        const oldest = Math.min(...list);
        const threat = f.threats.some((t) => t.since === oldest);
        // (c) では、言い直しまでモヒカンを残しておく(試し終わったら、すぐ押す)
        const tested = skipAB ? !!r.c : r.a && r.b;
        const wait = tested ? 150 : threat ? 6000 : 800;
        if (now - oldest > wait) f.pressGo();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** 波3で、素通りされるモヒカンのすぐあと(3人以内)に、もう1つ行けの場面があるか */
const twoReady = () => {
  const run = window.__game.registry.get('run');
  const fw = run.free.plan.waves[2];
  const people = run.free.plan.stage.waves[2].people;
  const goAt = people.filter((p) => {
    const rule = fw.redeclare && p.index >= fw.redeclare.after ? fw.redeclare.rule : fw.rule;
    const attack = rule.kind === 'item' && p.item === rule.item;
    return p.truth === 'bad' && !attack && (!p.group || run.free.plan.stage.waves[2].groups.find((g) => g.id === p.group)?.memberIds[0] === p.id);
  }).map((p) => ({ i: p.index, look: p.look }));
  const a = goAt.some((g, k) => g.look === 'fp_mohawk' && goAt[k + 1] && goAt[k + 1].i - g.i <= 3);
  // (c) 言い直しの直前(2人以内)に、素通りされるモヒカンがいる
  const after = fw.redeclare?.after ?? 99;
  const c = goAt.some((g) => g.look === 'fp_mohawk' && g.i < after && after - g.i <= 2);
  return { a, c };
};

/** two を1回遊ぶ。kind 'ab' は (a) と (b)、'c' は (c) を試せる種を探して遊ぶ */
async function playTwo(kind) {
  const tag = `[two ${kind}]`;
  const errors = [];
  const page = await openPage(browser, { errors });
  let found = null;
  for (let sd = Number(seed); sd < Number(seed) + 60 && found === null; sd++) {
    const u = new URL(url);
    u.search = '';
    for (const [k, v] of Object.entries({ scene: 'Street', free: '1', wave: '3', seed: String(sd), unlocked, threat: '8' })) u.searchParams.set(k, v);
    await page.goto(u.toString());
    await page.waitForFunction(() => window.streetDev && window.streetDev.free, null, { timeout: 30000 });
    const ready = await page.evaluate(twoReady);
    if (kind === 'ab' ? ready.a : ready.c) found = sd;
  }
  if (!check(`${tag} 試せる並びの種がある`, found !== null)) { await page.close(); return; }
  console.log(`${tag} 種 ${found}`);
  await page.evaluate(twoWatcher, kind);
  const t0 = Date.now();
  let reached = false;
  let shotA = false;
  while (Date.now() - t0 < 200000) {
    const st = await page.evaluate(() => ({ keys: window.__game.scene.getScenes(true).map((x) => x.scene.key), two: window.__two }));
    if (st.keys.includes('Result')) { reached = true; break; }
    if (st.two.a && !shotA) { shotA = true; await page.screenshot({ path: `${outDir}/two_a.png` }); }
    await page.waitForTimeout(100);
  }
  const two = await page.evaluate(() => window.__two);
  check(`${tag} 結果画面まで行く`, reached);
  if (kind === 'ab') {
    console.log(`${tag} (a) ${JSON.stringify(two.a)}`);
    console.log(`${tag} (b) ${JSON.stringify(two.b)}`);
    check(`${tag} (a) 行けのマークが2つ出た`, !!two.a);
    check(`${tag} (a) 行けは先に出たほうだけに効いた`, !!two.a?.ok);
    check(`${tag} (b) ためのときに行けを押した`, !!two.b);
    check(`${tag} (b) その場から光の拳が飛んだ`, two.b?.fist === 1, String(two.b?.fist));
    check(`${tag} (b) ためは続いた(待てのマークのまま、ためが進む)`, !!two.b && two.b.mode === 'mark' && two.b.stillMarked && two.b.p1 !== null && two.b.p1 > two.b.p0,
      JSON.stringify(two.b));
  } else {
    console.log(`${tag} (c) ${JSON.stringify(two.c)}`);
    check(`${tag} (c) 言い直しの間に行けのマークが出ていて、行けを押した`, !!two.c);
    check(`${tag} (c) 押した行けは止めている間は効かず、止めが終わってから先に出たマークに効き、空押しに数えない`,
      !!two.c && two.c.heldAfterPress && two.c.hit && two.c.dry1 === two.c.dry0, JSON.stringify(two.c));
  }
  const real = errors.filter((e) => !e.startsWith('console: Failed to load resource'));
  check(`${tag} エラーが出ない`, real.length === 0, real.slice(0, 3).join(' / '));
  await page.close();
}

for (const p of policies) {
  if (p === 'two') { await playTwo('ab'); await playTwo('c'); } else await play(p);
}
await browser.close();
done();
