// フリープレイ(docs/FREEPLAY.md)の3つの波を、開発用の入口から通しで遊ぶ。落ちないか、最後に結果画面へ行くか、数が合うかを見る。
// 使い方: npm run dev を動かしてから
//   node tools/free_play.mjs [サーバーかURL] [出力フォルダ] [押し方] [種] [開いているステージ]
// サーバーと出力フォルダは、省くか - にすると http://localhost:5173/ と shots/(例 node tools/free_play.mjs - - good 7 alley)
// 押し方(書かなければ both):
//   good  市民への待てのマークと、ワルへの行けのマークだけを、出たらすぐ押す。行けは、素通りしかけたワルのマーク
//         (悪さの前に倒す)と、悪さのマーク(悪さのワル、ギャングの組、UFO)。素通りしかけた市民のマークには押さない。
//         波1の始めに1回だけ、マークのないときに待てを押す(空押し。ヒーローが振り向き、空押しに1回数えるか)。
//         素通りしかけたワルが、どれも悪さの前に倒れたかも見る
//   civgo good と同じに押し、ほかに、最初に素通りしかけた市民のマークに1回だけ行けを押す。
//         市民のけが(なぐった)に1人数え、クリアまでの時間に3秒足すかを見る
//   none  何も押さない(ヒーローにまかせる)
//   late  市民への待ては、ためのいちばん最後(ギリギリセーフ)に押す。最初に殴りかかられるワルにも1回だけ待てを押し、
//         悪さを始めたら行けで取り返す。行けは悪さのマークだけに、出たらすぐ指で押す(素通りのマークには押さない。
//         待ては、遅れないようにページの中から押す)
//   two   行けのマークが2つ同時に出る場面をわざと作る。波3から始め、モヒカンが逃げるまでを開発用に8秒にのばす(?threat=8)。
//         種は、波3で素通りされるモヒカンのすぐあと(3人以内)に、もう1つ行けの場面がある種を、指定した種から探す。
//         (a) 行けのマークが2つあるときに行けを押し、先に出たほうだけに効くか
//         (b) 待てのマークのため(前半)の最中に行けを押し、その場から光の拳が飛んで、ためが続くか
//         (c) 言い直しで止めている間に行けのマークがあれば行けを押し、止めが終わってから効くか(空押しに数えないか)
//   early 行けを、マークが出る前の前ぶれで押す。モヒカンが相手の所へ走り出したら、ギャングの口笛が鳴ったら、
//         宇宙人がUFOに合図を送り始めたら、すぐ行けを押す(ページの中から、ボタンと同じ pressGo を呼ぶ)。
//         素通りのマークと悪さのマークが出てからは行けを押さない(素通りのマークで押すと、悪さが起きないため)。
//         市民への待ては good と同じに押す。
//         前ぶれの間に押した行けが覚えられ、悪さのマークが出た瞬間に全部効き、空押しが0かを見る
//         (波3で、素通りのマークが出ている間に前ぶれが始まっても、素通りの相手ではなく悪さに効くか)
//   gang1 good と同じに押すが、ギャングの組は、素通りしかけた1人目にだけ行けを押し、2人目には押さない。
//         2人目は1人で口笛を吹くので、その行けのマークで押す。組が1つの場面として数えられ、逃がしたワルがいないかを見る
//   gang1x gang1 と同じだが、1人で口笛を吹いた2人目にも押さない。組ごとに逃がしたワル1人と数え、
//         その組を「行けで決めた」に数えないか(行けで決めた場面が8から組の数だけ減るか)を見る。
//         1人で口笛を吹いた2人目が、行けのマークが出てからフリープレイの時間(ゆっくりモードは長い)で逃げるか、
//         逃げたときに「手を振って見送った」場面になるかも見る
//   wavego good と同じに押すが、素通りしかけたワルへの行けは、ヒーローが手を振り始めてから(通りすぎる間に)押す。
//         光の拳で倒れ、手を振った場面(いちばんひどい場面の候補)にならないか、ヒーローが歩きながら
//         待機や腕組みの格好ですべらないかを見る
//   both  good と none を続けて(all は good、civgo、none、late、two、early、gang1、gang1x、wavego)
// 開いているステージは alley,garage,mall のように書く(書かなければ3つとも)。
// 環境変数 SLOW=1 でゆっくりモード、REDUCE=1 で「光と揺れを弱くする」をオンにして始める(設定を先に入れておく)。
// 場面ごとに画面を撮る(波の始めの決めつけ、最初の待てと行けのマーク、波3の言い直し、結果画面)。
// エラーが出たとき、結果画面まで行けなかったとき、数が合わないときは exit code 1 で終わる。
import { checker, gameUrl, openBrowser, openPage, serverUrl, shotsDir, touchPad } from './lib.mjs';

const [urlArg, outArg, policyArg = 'both', seed = '7', unlocked = 'alley,garage,mall'] = process.argv.slice(2);
const url = serverUrl(urlArg);
const outDir = shotsDir(outArg);
const POLICIES = ['good', 'civgo', 'none', 'late', 'two', 'early', 'gang1', 'gang1x', 'wavego'];
const policies = policyArg === 'both' ? ['good', 'none'] : policyArg === 'all' ? POLICIES : [policyArg];
if (policies.some((p) => !POLICIES.includes(p))) { console.error(`押し方は ${POLICIES.join('、')}、both、all のどれか(${policyArg})`); process.exit(2); }
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
    // 行けのマークの種類:悪さ(mischief)、素通りしかけたワル(passBad)、素通りしかけた市民(passCiv)
    goKind: f.mischiefTarget() !== null ? 'mischief' : f.passTarget ? (f.passTarget.civ ? 'passCiv' : 'passBad') : null,
    passId: f.passTarget?.person?.id ?? null,
    passGroup: f.passTarget?.person?.group ?? null,
    stopLocked: f.dryStop.locked(sd.time.now),
    goLocked: f.dryGo.locked(sd.time.now),
    redeclared: f.redeclared,
    heroFlip: sd.hero.sprite.flipX,
    heroAnim: sd.hero.anim,
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

/**
 * early の行け:ページの中で毎コマ見張り、前ぶれが始まったらすぐ pressGo を呼ぶ。
 * 前ぶれは、相手の所へ走っているモヒカン(free.runners)、口笛を吹いたギャング(gangPart.whistler か、集まっている途中の組)、
 * 合図を送り始めた宇宙人(ufoPart の signal)。押したときに行けのマークが出ていないこと、押した結果覚えられたかを数える
 */
const earlyWatcher = () => {
  const r = { presses: 0, armed: 0, markUp: 0, kinds: {} };
  window.__early = r;
  const seen = new Set();
  const tick = () => {
    const sd = window.streetDev;
    const f = sd?.free;
    if (f && sd.sys.isActive() && f.inputOpen) {
      const starts = [];
      for (const a of f.runners) if (a.standing) starts.push([a, 'mohawk']);
      const g = sd.gangPart;
      if (g.whistler?.standing) starts.push([g.whistler, 'gang']);
      else if (g.gang?.call.phase === 'gather') starts.push([g.gang.members[0], 'gang']);
      const u = sd.ufoPart;
      if (u.ufo && u.ufos.current?.phase === 'signal') starts.push([u.ufo, 'ufo']);
      for (const [key, kind] of starts) {
        if (seen.has(key)) continue;
        seen.add(key);
        if (f.mischiefTarget() !== null) r.markUp++;
        f.pressGo();
        r.presses++;
        r.kinds[kind] = (r.kinds[kind] ?? 0) + 1;
        if (f.dryGo.armed) r.armed++;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/**
 * どの押し方でも毎コマ見張る:
 * - ヒーローが動かされているのに(歩きの途中。空押しで立ち止まっている間は除く)、待機か腕組みの格好でいるコマの数(すべり)
 * - 1人で口笛を吹いたギャング(組にならず、行けのマークが1つ出る)の、マークが出てから消えるまでの時間
 */
const commonWatcher = () => {
  const r = { slide: 0, slideAnims: {}, alone: [], freeScenes: [] };
  window.__common = r;
  let aloneSince = null;
  const tick = () => {
    const sd = window.streetDev;
    const f = sd?.free;
    // フリープレイの場面を伝えた回を、すべて覚える(ステージの場面が先に起きて、場面にならなかった回も)
    if (sd?.stats && !sd.stats.__wrapped) {
      const st = sd.stats;
      const orig = st.reportFreeScene.bind(st);
      st.reportFreeScene = (scene) => { if (scene) r.freeScenes.push(scene); return orig(scene); };
      st.__wrapped = true;
    }
    if (f && sd.sys.isActive()) {
      const anim = sd.hero.anim;
      if (sd.walker && sd.holdMs <= 0 && (anim === 'idle' || anim === 'win_arms')) {
        r.slide++;
        r.slideAnims[anim] = (r.slideAnims[anim] ?? 0) + 1;
      }
      const lone = sd.goHandler !== null && !sd.gangPart.gang && !sd.ufoPart.ufo;
      if (lone && aloneSince === null) aloneSince = sd.time.now;
      if (!lone && aloneSince !== null) { r.alone.push(Math.round(sd.time.now - aloneSince)); aloneSince = null; }
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
  await page.goto(gameUrl(url, { scene: 'Street', free: '1', wave: '1', seed, unlocked }));
  await page.waitForFunction(() => window.streetDev && window.streetDev.free, null, { timeout: 30000 });
  const pad = await touchPad(page);
  const exp = await page.evaluate(expected);
  await page.evaluate(commonWatcher);
  if (policy === 'late') await page.evaluate(lateWatcher);
  if (policy === 'early') await page.evaluate(earlyWatcher);
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
  let civGoId = null;
  const gangHit = new Map();
  let gangPairs = 0;
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
      if (s.goKind === 'mischief' && !s.goLocked && Date.now() - pressedGoAt > 250) {
        pressedGoAt = Date.now();
        await pad.tap(s.goBtn.x, s.goBtn.y);
        continue;
      }
      await page.waitForTimeout(30);
      continue;
    }
    const gangLike = policy === 'gang1' || policy === 'gang1x';
    const goodLike = policy === 'good' || policy === 'civgo' || policy === 'wavego' || gangLike;
    // wavego:素通りしかけたワルへの行けは、ヒーローが手を振り始めるまで待つ
    if (policy === 'wavego' && s.open && !s.leaving && s.goKind === 'passBad' && s.heroAnim !== 'pass') {
      if (s.stopMark && s.stopCiv && pressedStop !== s.stopId && !s.stopLocked) {
        pressedStop = s.stopId;
        await pad.tap(s.stopBtn.x, s.stopBtn.y);
        continue;
      }
      await page.waitForTimeout(20);
      continue;
    }
    if (policy === 'wavego' && s.goKind === 'passBad') await shot('wavego_press');
    if ((goodLike || policy === 'early') && s.open && !s.leaving) {
      // 波1の始め、マークのないときに1回だけ空押し(early はしない)
      if (policy === 'good' && !dryDone && st.wave === 0 && !s.stopMark && !s.go && s.clock > 800) {
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
      // 行けはワルにだけ(素通りしかけたワルと、悪さ)。civgo は、最初に素通りしかけた市民にも1回だけ押す
      const civGo = policy === 'civgo' && s.goKind === 'passCiv' && (civGoId === null || civGoId === s.passId);
      // gang1、gang1x:組の2人目(1人目を行けで倒した組)には、素通りの行けを押さない。gang1x は悪さのマークにも押さない
      if (gangLike && s.goKind === 'passBad' && s.passGroup && gangHit.has(s.passGroup) && gangHit.get(s.passGroup) !== s.passId) {
        await page.waitForTimeout(40);
        continue;
      }
      if (policy === 'gang1x' && s.goKind === 'mischief') { await page.waitForTimeout(40); continue; }
      if (gangLike && s.goKind === 'passBad' && s.passGroup && !gangHit.has(s.passGroup)) { gangHit.set(s.passGroup, s.passId); gangPairs++; await shot('gang1_first'); }
      if (goodLike && (s.goKind === 'mischief' || s.goKind === 'passBad' || civGo) && !s.goLocked && Date.now() - pressedGoAt > 250) {
        pressedGoAt = Date.now();
        if (civGo) { civGoId = s.passId; await shot('civgo_press'); }
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
    const common = await page.evaluate(() => window.__common);
    const hasShot = await page.evaluate(() => !!window.__game.registry.get('run').worstShot);
    console.log(`[${policy}] すべったコマ ${common.slide} ${JSON.stringify(common.slideAnims)}、1人の口笛の行けのマーク ${JSON.stringify(common.alone)}ミリ秒、` +
      `いちばんひどい場面 ${snap.worstScene ?? '-'}/${f.worst ?? '-'}(写真 ${hasShot ? 'あり' : 'なし'})、伝えたフリープレイの場面 ${JSON.stringify(common.freeScenes)}`);
    check(`[${policy}] チャンスの数(待て9、行け8、場面27)`, f.stopChances === 9 && f.goChances === 8 && f.units === 27 && exp.stop === 9 && exp.goScenes === 8);
    check(`[${policy}] ゆっくりモードの印`, f.slow === slow, String(f.slow));
    check(`[${policy}] 時計が進んで止まった`, f.rawSec !== null && f.rawSec > 30 && f.rawSec < 400, String(f.rawSec));
    check(`[${policy}] クリアの時間は、逃がしたワル、市民のけが、ワルへの待て1つにつき3秒を足す`,
      Math.abs(f.clearSec - (f.rawSec + (snap.escaped + snap.civHurt + snap.badSparedByStop) * 3)) < 1e-6);
    check(`[${policy}] 待てと行けのチャンスは巻きぞえで消えない(ヒーローが殴った市民は、守れなかった市民と行けで殴った市民)`,
      snap.civHurtByHero - f.goCivHits + f.stopSaved === 9, `${snap.civHurtByHero}-${f.goCivHits}+${f.stopSaved}`);
    if (policy === 'good') {
      check('[good] 待てで市民を全員守った', f.stopSaved === 9, String(f.stopSaved));
      check('[good] 行けを全部決めた', f.goScenes === 8, String(f.goScenes));
      check('[good] 素通りしかけたワルは、どれも悪さの前に行けで倒した', seen?.passGo === exp.goPeople, `${seen?.passGo}/${exp.goPeople}`);
      check('[good] 市民には行けを押していない', f.goCivHits === 0 && seen?.goCiv === 0, String(f.goCivHits));
      check('[good] 空押しは1回(波1の始め)', f.dryPresses === 1, String(f.dryPresses));
      check('[good] 空押しでヒーローが振り向いた', dryTurned === true);
      check('[good] ヒーローが殴った市民はいない', snap.civHurtByHero === 0, String(snap.civHurtByHero));
      check('[good] 逃がしたワルはいない', snap.escaped === 0, String(snap.escaped));
      check('[good] 直したあとは全部当たり(巻きぞえのほかは)', f.fixedRight === f.units, `${f.fixedRight}/${f.units}`);
    } else if (policy === 'civgo') {
      check('[civgo] 素通りしかけた市民に1回だけ行けを押した', civGoId !== null && seen?.goCiv === 1 && f.goCivHits === 1, `${civGoId} ${seen?.goCiv} ${f.goCivHits}`);
      check('[civgo] 市民のけが(なぐった)に1人数えた', snap.civHurtByHero === 1, String(snap.civHurtByHero));
      check('[civgo] クリアまでの時間に、その市民の分の3秒を足した', snap.civHurt >= 1 && Math.abs(f.clearSec - f.rawSec - (snap.escaped + snap.civHurt + snap.badSparedByStop) * 3) < 1e-6,
        `けが ${snap.civHurt}、足した ${(f.clearSec - f.rawSec).toFixed(1)}秒`);
      check('[civgo] 直したあとの当たりが1つ減った', f.fixedRight === f.units - 1, `${f.fixedRight}/${f.units}`);
      check('[civgo] いちばんひどい場面は市民を殴った場面', ['civHit', 'specialOnCiv'].includes(snap.worstScene), String(snap.worstScene));
      check('[civgo] 待てと行けはほかは全部決めた', f.stopSaved === 9 && f.goScenes === 8, `${f.stopSaved} ${f.goScenes}`);
    } else if (policy === 'gang1' || policy === 'gang1x') {
      console.log(`[${policy}] 1人目だけ先に倒したギャングの組 ${gangPairs}`);
      check(`[${policy}] ギャングの組の1人目を先に倒した`, gangPairs >= 1, String(gangPairs));
      // gang1 は組を全員倒したので8のまま。gang1x は2人目を逃がした組を「行けで決めた」から外す(逃げきった場面に数える)
      const goWant = policy === 'gang1' ? 8 : 8 - gangPairs;
      check(`[${policy}] 行けで決めた場面は ${goWant}(組は1つの場面。2人目を逃がした組は数えない)`, f.goScenes === goWant, String(f.goScenes));
      check(`[${policy}] 待てで市民を全員守った`, f.stopSaved === 9, String(f.stopSaved));
      if (policy === 'gang1') check('[gang1] 1人で口笛を吹いた2人目も行けで倒し、逃がしたワルはいない', snap.escaped === 0, String(snap.escaped));
      else {
        check('[gang1x] 組ごとに2人目を逃がした', snap.escaped === gangPairs, `${snap.escaped}/${gangPairs}`);
        // 行けのマークが出ている時間は、フリープレイの時間(ふつう3秒、ゆっくりモード4.5秒)
        const want = slow ? 4500 : 3000;
        check(`[gang1x] 1人で口笛を吹いた2人目は、行けのマークから約${want / 1000}秒で逃げた`,
          common.alone.length === gangPairs && common.alone.every((ms) => Math.abs(ms - want) < 300), JSON.stringify(common.alone));
        // ステージの場面(市民のけがなど)が起きていなければ、手を振って見送った場面になる
        check('[gang1x] 2人目に逃げられたら、手を振って見送った場面を伝える(ステージの場面がなければ、その場面で写真つき)',
          common.freeScenes.filter((x) => x === 'waveGang').length === gangPairs && (snap.worstScene !== null || (f.worst === 'waveGang' && hasShot)),
          `${JSON.stringify(common.freeScenes)} ${snap.worstScene}/${f.worst} ${hasShot}`);
      }
    } else if (policy === 'wavego') {
      check('[wavego] 行けを全部決めた', f.goScenes === 8, String(f.goScenes));
      check('[wavego] 素通りしかけたワルは、どれも手を振ったあと悪さの前に倒した', seen?.passGo === exp.goPeople, `${seen?.passGo}/${exp.goPeople}`);
      check('[wavego] 手を振ったあとの行けは光の拳', (seen?.fist ?? 0) >= exp.goPeople, `${seen?.fist}/${exp.goPeople}`);
      check('[wavego] 逃がしたワルはいない', snap.escaped === 0, String(snap.escaped));
      check('[wavego] 行けで倒したワルは、手を振った場面にならない(場面を伝えもしない)', f.worst === null && common.freeScenes.length === 0,
        `${f.worst} ${JSON.stringify(common.freeScenes)}`);
      check('[wavego] ヒーローが歩きながら待機や腕組みの格好ですべらない', common.slide === 0, JSON.stringify(common.slideAnims));
      check('[wavego] 待てで市民を全員守った', f.stopSaved === 9, String(f.stopSaved));
    } else if (policy === 'early') {
      const early = await page.evaluate(() => window.__early);
      console.log(`[early] 前ぶれで押した ${JSON.stringify(early)}`);
      check('[early] 前ぶれで行けを押した回数は、行けの場面の数と同じ', early.presses === 8, String(early.presses));
      check('[early] 押したときは、どれも行けのマークがまだ出ていない', early.markUp === 0, String(early.markUp));
      check('[early] 押した行けは、どれも覚えられた', early.armed === early.presses, `${early.armed}/${early.presses}`);
      check('[early] 覚えた行けが、マークが出た瞬間に全部効いた', seen?.early === 8, String(seen?.early));
      check('[early] 行けを全部決めた', f.goScenes === 8, String(f.goScenes));
      check('[early] 空押しはない', f.dryPresses === 0, String(f.dryPresses));
      check('[early] 逃がしたワルはいない', snap.escaped === 0, String(snap.escaped));
      check('[early] 待てで市民を全員守った', f.stopSaved === 9, String(f.stopSaved));
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
    await page.goto(gameUrl(url, { scene: 'Street', free: '1', wave: '3', seed: String(sd), unlocked, threat: '8' }));
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
