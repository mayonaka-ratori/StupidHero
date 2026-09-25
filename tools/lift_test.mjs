// エレベーターラッシュ(Elevator。docs/STAGE4.md「エレベーターラッシュ」)を指で遊んで確かめる。
// 使い方: npm run dev を動かしてから
//   node tools/lift_test.mjs [サーバーかURL] [出力フォルダ]
// サーバーと出力フォルダは、省くか - にすると http://localhost:5173/ と shots/。
// 画面の高さ384と468で、次の3通りを遊ぶ(開発用の入口 ?scene=Elevator&stage=tower から):
//   perfect:市民にだけ待てを押す / none:何も押さない / all:全員に待てを押す(定員オーバーのおまけと、見逃したヴィランの紫の光)
// それぞれで、数(stats の lift)、ほかの数字が変わらないこと、ラッシュの長さ(約17秒)、波4の Sort へ続くことを見る。
// ほかに、波3の答え合わせの「次へ」から Elevator へ来ること、2回目の説明が1つになること、一時停止と画面を離れたときに止まることを見る。
// 撮るもの:乗ってきた人とマーク、ヴィランの光ったボタンと浮いた小物、2列に並んだ奥の人、着いたときの紫の光、定員オーバー、
// 着いたときのまとめ。NG があれば exit code 1。
import { checker, openBrowser, openPage, serverUrl, shotsDir, touchPad } from './lib.mjs';

const [urlArg, outArg] = process.argv.slice(2);
const url = serverUrl(urlArg);
const outDir = shotsDir(outArg);
const browser = await openBrowser();
const { check, fail, done } = checker();
const errors = [];

const S = (page, fn, arg) => page.evaluate(fn, arg);
/** 画面の高さ(論理ドット)から、横390の端末の縦の大きさ */
const viewport = (h) => ({ width: 390, height: Math.round((390 * h) / 216) });

/** 開発用の入口を開く。ctx を渡すと同じ記録(localStorage)で開く */
async function open(h, query, ctx = null) {
  const page = ctx ? await openPage(ctx, { errors }) : await openPage(browser, { ...viewport(h), errors });
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
  await page.goto(u.toString());
  await page.waitForFunction(() => window.__game?.isBooted, null, { timeout: 15000 });
  return { page, pad: await touchPad(page) };
}

/** tower のラッシュのヴィランが villains 人になる種を探す */
async function seedWith(villains) {
  const page = await openPage(browser, { errors });
  const u = new URL(url);
  await page.goto(u.toString());
  await page.waitForFunction(() => window.__game?.isBooted, null, { timeout: 15000 });
  let found = null;
  for (let seed = 1; seed < 60 && found === null; seed++) {
    const n = await S(page, async (sd) => {
      const m = await import('/src/logic/index.ts');
      return m.liftRushOf(m.createStage(sd, 'tower')).villainCount;
    }, seed);
    if (n === villains) found = seed;
  }
  await page.close();
  return found;
}

const lift = (page) => S(page, () => {
  const s = window.liftDev.scene;
  return { phase: s.phase, running: s.running, sec: s.liftSec, total: s.sched.totalSec, log: [...window.liftDev.log] };
});
const snap = (page) => S(page, () => window.liftDev.scene.stats.snapshot());
const stopBtn = (page) => S(page, () => { const b = window.liftDev.scene.stopBtn; return { x: b.x + b.w / 2, y: b.y + b.h / 2, en: b.isEnabled }; });
/** 今マークが出ている人 */
const marked = (page) => S(page, () => {
  const s = window.liftDev.scene;
  const m = s.men.find((x) => x.state === 'mark');
  return s.stopHandler && m ? { i: m.r.index, civ: m.r.truth === 'civ', item: !!m.item, button: m.button } : null;
});
/** ほかの数字(ラッシュで変えてはいけないもの) */
const OTHER = ['defeated', 'civHurt', 'escaped', 'damage', 'sortTotal', 'sortCorrect', 'civSavedByStop', 'badSparedByStop', 'rush'];

/** ▼タップまで待って、タップで始める */
async function start(page, pad, tag, h) {
  await page.waitForFunction(() => window.liftDev?.scene?.phase === 'intro' && window.liftDev.log.some((l) => l.startsWith('intro:')), null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const st = await lift(page);
  check(`${tag}: 帯と説明の間は始まらない`, !st.running && st.phase === 'intro');
  const go = await S(page, () => { const b = window.liftDev.scene.goBtn; return { en: b.isEnabled, alpha: b.alpha }; });
  check(`${tag}: 行けは暗い`, !go.en && go.alpha < 0.5, JSON.stringify(go));
  if (tag.startsWith('perfect')) await page.screenshot({ path: `${outDir}/lift_${h}_intro.png` });
  for (let i = 0; i < 10 && !(await S(page, () => window.liftDev.scene.running)); i++) { await pad.tap(108, 110); await page.waitForTimeout(600); }
  check(`${tag}: タップで始まる`, await S(page, () => window.liftDev.scene.running));
}

/** ラッシュを遊ぶ。press(m) が true の人に待てを押す */
async function playRush(page, pad, tag, h, press, shots = {}) {
  await page.waitForFunction(() => window.liftDev?.scene?.stats, null, { timeout: 20000 });
  const before = await snap(page);
  await start(page, pad, tag, h);
  const shotDone = new Set();
  const shot = async (name) => { if (shotDone.has(name)) return; shotDone.add(name); await page.screenshot({ path: `${outDir}/lift_${h}_${name}.png` }); };
  const handled = new Set();
  let pressed = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 40000 && (await S(page, () => window.liftDev.scene.phase)) === 'rush') {
    const m = await marked(page);
    if (m && !handled.has(m.i)) {
      handled.add(m.i);
      await page.waitForTimeout(250);
      if (shots.mark && m.i === 0) await shot('mark');
      if (shots.villain && !m.civ) {
        const lit = await S(page, () => window.liftDev.scene.men.find((x) => x.state === 'mark')?.item?.visible === true);
        check(`${tag}: ヴィランの頭の上に小物が浮く`, lit && m.item);
        await shot('villain');
      }
      if (shots.rows && m.i === 5) await shot('rows');
      if (press(m)) {
        const b = await stopBtn(page);
        check(`${tag}: マークの間は待てが使える`, b.en);
        await pad.tap(b.x, b.y);
        pressed++;
      }
    }
    await page.waitForTimeout(40);
  }
  // 着いたところ
  if (shots.flash) {
    const ok = await page.waitForFunction(() => window.liftDev.log.includes('flash'), null, { timeout: 8000, polling: 10 }).then(() => true, () => false);
    if (check(`${tag}: 見逃したヴィランがいると紫に光る`, ok)) { await page.waitForTimeout(60); await shot('flash'); }
  }
  if (shots.buzzer) {
    const ok = await page.waitForFunction(() => window.liftDev.log.includes('buzzer'), null, { timeout: 12000 }).then(() => true, () => false);
    if (check(`${tag}: 市民が4人以上で定員オーバー`, ok)) { await page.waitForTimeout(850); await shot('full'); }
  }
  const sumOk = await page.waitForFunction(() => window.liftDev.log.some((l) => l.startsWith('summary:')), null, { timeout: 15000 }).then(() => true, () => false);
  if (shots.summary && sumOk) { await page.waitForTimeout(300); await shot('arrive'); }
  const st = await lift(page);
  check(`${tag}: ラッシュの長さは約17秒`, Math.abs(st.sec - 17) <= 2, `${st.sec.toFixed(2)}秒`);
  const after = await snap(page);
  for (const k of OTHER) check(`${tag}: ${k} は変わらない`, JSON.stringify(before[k]) === JSON.stringify(after[k]), `${JSON.stringify(before[k])} -> ${JSON.stringify(after[k])}`);
  check(`${tag}: まとめを出す`, sumOk, st.log.find((l) => l.startsWith('summary:')) ?? '');
  // 波4の仕分けへ
  const sort = await page.waitForFunction(() => window.__game.scene.isActive('Sort'), null, { timeout: 15000 }).then(() => true, () => false);
  const wave = await S(page, () => window.__game.registry.get('run').waveIndex);
  check(`${tag}: 波4の Sort へ続く`, sort && wave === 3, `waveIndex ${wave}`);
  return { lift: after.lift, log: st.log, pressed };
}

for (const h of [384, 468]) {
  const seed2 = await seedWith(2);
  const seed3 = await seedWith(3);
  // 1. 市民にだけ待て(ヴィラン3人の並び)
  {
    const { page, pad } = await open(h, { scene: 'Elevator', stage: 'tower', seed: seed3 });
    const r = await playRush(page, pad, `perfect${h}`, h, (m) => m.civ, { mark: true, villain: true, summary: true });
    const t = r.lift;
    check(`perfect${h}: ヴィランは全員倒し、市民は全員守る`, t && t.aliens === 3 && t.aliensDefeated === 3 && t.civs === 3 && t.civsSaved === 3 && t.civsHit === 0 && t.aliensSpared === 0, JSON.stringify(t));
    check(`perfect${h}: 初めての説明は2つ`, r.log.includes('intro:2'), r.log.join(','));
    check(`perfect${h}: 紫の光も定員オーバーも出ない`, !r.log.includes('flash') && !r.log.includes('buzzer'));
    // 同じ記録で、もう一度:説明は1つ
    const again = await open(h, { scene: 'Elevator', stage: 'tower', seed: seed3 }, page.context());
    await again.page.waitForFunction(() => window.liftDev?.log.some((l) => l.startsWith('intro:')), null, { timeout: 20000 });
    check(`perfect${h}: 2回目の説明は1つ`, (await lift(again.page)).log.includes('intro:1'));
    await again.page.close();
    await page.close();
  }
  // 2. 何も押さない
  {
    const { page, pad } = await open(h, { scene: 'Elevator', stage: 'tower', seed: seed2 });
    const r = await playRush(page, pad, `none${h}`, h, () => false);
    const t = r.lift;
    check(`none${h}: 全員を殴る`, t && t.aliensDefeated === t.aliens && t.civsHit === t.civs && t.civsSaved === 0 && t.aliens + t.civs === 6, JSON.stringify(t));
    const worst = await S(page, () => ({ w: window.__game.registry.get('run').stats.snapshot().worstScene, shot: !!window.__game.registry.get('run').worstShot }));
    check(`none${h}: 市民を殴った場面を撮る`, worst.w === 'civHit' && worst.shot, JSON.stringify(worst));
    await page.close();
  }
  // 3. 全員に待て(ヴィラン2人の並び:市民4人で定員オーバー、ヴィランが奥にいて紫の光)
  {
    const { page, pad } = await open(h, { scene: 'Elevator', stage: 'tower', seed: seed2 });
    const r = await playRush(page, pad, `all${h}`, h, () => true, { rows: true, flash: true, buzzer: true });
    const t = r.lift;
    check(`all${h}: 全員を待てで通す`, t && t.civsSaved === 4 && t.aliensSpared === 2 && t.aliensDefeated === 0 && t.civsHit === 0, JSON.stringify(t));
    await page.close();
  }
}

// 4. 波3の答え合わせの「次へ」から Elevator へ。一時停止と、画面を離れたときに止まる
{
  const { page, pad } = await open(468, { scene: 'WaveReview', stage: 'tower', wave: 3, sorts: 'truth', seed: 4 });
  await page.waitForFunction(() => window.reviewDev?.next, null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const nb = await S(page, () => { const b = window.reviewDev.next; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
  for (let i = 0; i < 4 && !(await S(page, () => window.__game.scene.isActive('Elevator'))); i++) { await pad.tap(nb.x, nb.y); await page.waitForTimeout(900); }
  check('波3の答え合わせの次は Elevator', await S(page, () => window.__game.scene.isActive('Elevator')));
  check('Elevator に来たときは波4', await S(page, () => window.__game.registry.get('run').waveIndex === 3));
  await start(page, pad, 'route', 468);
  await page.waitForTimeout(1500);
  // 中断ボタン(右上は階の数字の枠なので、左上にある)
  const pb = await S(page, () => { const b = window.liftDev.scene.icons[0]; return { x: b.x, y: b.y }; });
  await pad.tap(pb.x, pb.y);
  await page.waitForTimeout(300);
  const a = await lift(page);
  await page.waitForTimeout(1000);
  const b = await lift(page);
  check('中断ボタンで止まる', await S(page, () => window.liftDev.scene.scene.isPaused()) && a.sec === b.sec, `${a.sec} -> ${b.sec}`);
  const r = await S(page, () => { const x = window.pauseDev.resume; return { x: x.x + x.w / 2, y: x.y + x.h / 2 }; });
  await pad.tap(r.x, r.y);
  await page.waitForTimeout(500);
  const c = await lift(page);
  check('「つづける」で再開', c.sec > b.sec);
  // 画面を離れたとき
  await S(page, () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  const d = await lift(page);
  await page.waitForTimeout(800);
  const e = await lift(page);
  check('画面を離れたら止まる', await S(page, () => window.liftDev.scene.scene.isPaused()) && d.sec === e.sec);
  await page.close();
}

check('エラーが出ない', errors.length === 0, errors.join('\n'));
await browser.close();
done();
