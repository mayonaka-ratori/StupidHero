// 結果発表(Street)を指で試す(担当 street 用)。中断ボタン、待て、行けを指で押して、止まるか、反応するかを見る。
// 使い方: npx vite --port 5202 --strictPort を動かしてから
//   node tools/street_tap.mjs <URL(例 http://localhost:5202/)> [出力フォルダ] [ステージ(alley か garage)] [種]
// alley :中断と再開、早送り(▶▶。合図の間はふつうの速さ)、待て(市民をワルに仕分けた人)、行け(見逃したワルへの追い打ち)
// garage:中断と再開、見逃したギャングが仲間を呼んで集まったところで行け(まとめて吹き飛ばす)、
//         ワゴンに乗りこんだところで行け(車ごと止める)
// URL に ?scene= がなければ、開発用の入口で波1から始める。NG があれば exit code 1。
import { checker, openBrowser, openPage, touchPad } from './lib.mjs';

const [url, outDir = '.', stage = 'alley', seed = stage === 'garage' ? '3' : '1'] = process.argv.slice(2);
if (!url) { console.error('usage: node tools/street_tap.mjs <url> [outDir] [alley|garage] [seed]'); process.exit(2); }
const browser = await openBrowser();
const { check, fail, done } = checker();
const errors = [];

const S = (page, fn, arg) => page.evaluate(fn, arg);
/** 開発用の入口で Street を開く。sorts:truth / random / bad / civ */
async function open(sorts) {
  const page = await openPage(browser, { errors });
  const u = new URL(url);
  if (!u.searchParams.has('scene')) {
    u.searchParams.set('scene', 'Street');
    u.searchParams.set('wave', '1');
    u.searchParams.set('sorts', sorts);
    u.searchParams.set('seed', seed);
    u.searchParams.set('stage', stage);
  }
  await page.goto(u.toString());
  await page.waitForFunction(() => window.streetDev && window.streetDev.goBtn, null, { timeout: 15000 });
  return { page, pad: await touchPad(page) };
}
const btn = (page, k) => S(page, (key) => { const b = window.streetDev[key]; return { x: b.x + b.w / 2, y: b.y + b.h / 2, en: b.isEnabled }; }, k);
const stats = (page) => S(page, () => window.streetDev.stats.snapshot());

/** 中断ボタンで止まり、タップで戻る */
async function pauseCheck(page, pad) {
  await page.waitForTimeout(1500);
  await pad.tap(204, 12);
  await page.waitForTimeout(200);
  check('中断ボタンで止まる', await S(page, () => window.streetDev.scene.isPaused()));
  const x1 = await S(page, () => window.streetDev.hero.x);
  await page.waitForTimeout(1200);
  check('止まっている間ヒーローは動かない', (await S(page, () => window.streetDev.hero.x)) === x1);
  await page.screenshot({ path: `${outDir}/${stage}_tap_pause.png` });
  // 一時停止はメニュー。少し待ってから「つづける」を押す
  await page.waitForTimeout(400);
  const r = await S(page, () => { const b = window.pauseDev.resume; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
  await pad.tap(r.x, r.y);
  await page.waitForTimeout(300);
  check('「つづける」で再開', !(await S(page, () => window.streetDev.scene.isPaused())));
}

if (stage === 'alley') {
  const { page, pad } = await open('random');
  await pauseCheck(page, pad);
  // 早送り(中断ボタンの2つ左)。押すと時計も動きも2倍
  await pad.tap(160, 12);
  await page.waitForTimeout(200);
  check('早送りで2倍になる', await S(page, () => window.streetDev.speed === 2 && window.streetDev.time.timeScale === 2));
  // 合図がないときの待ては暗く、押しても何も起きない
  check('合図がないとき待ては使えない', !(await btn(page, 'stopBtn')).en);
  // 合図が出るまで待って、指で待てを押す
  await page.waitForFunction(() => window.streetDev.stopHandler, null, { timeout: 40000 }).catch(() => null);
  if (await S(page, () => !!window.streetDev.stopHandler)) {
    await page.waitForTimeout(60);
    const s = await btn(page, 'stopBtn');
    check('合図が出たら待てが使える', s.en);
    check('待ての合図の間は、早送りでもふつうの速さ', await S(page, () => window.streetDev.speed === 1 && window.streetDev.time.timeScale === 1));
    const before = await stats(page);
    await page.waitForTimeout(500);
    await pad.tap(s.x, s.y);
    await page.waitForTimeout(200);
    const after = await stats(page);
    check('待てで止まる(数える)', after.civSavedByStop + after.badSparedByStop === before.civSavedByStop + before.badSparedByStop + 1);
    await page.screenshot({ path: `${outDir}/${stage}_tap_stop.png` });
  } else fail('待ての場面がない(種を変える)', `seed ${seed}`);
  // 行け
  await page.waitForFunction(() => window.streetDev.goHandler, null, { timeout: 40000 }).catch(() => null);
  if (await S(page, () => !!window.streetDev.goHandler)) {
    const g = await btn(page, 'goBtn');
    const before = (await stats(page)).defeatedByGo;
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/${stage}_tap_gomark.png` });
    await pad.tap(g.x, g.y);
    await page.waitForTimeout(2500);
    check('行けで追い打ち', (await stats(page)).defeatedByGo === before + 1);
    await page.screenshot({ path: `${outDir}/${stage}_tap_go.png` });
  } else fail('行けの場面がない(種を変える)', `seed ${seed}`);
} else {
  // 1. 集まったところで行け → まとめて吹き飛ばす(全員を市民に仕分けて、ギャングを見逃す)
  {
    const { page, pad } = await open('civ');
    await pauseCheck(page, pad);
    const gathered = await page.waitForFunction(() => window.streetDev.gang?.call.phase === 'wait' && window.streetDev.goHandler, null, { timeout: 40000 })
      .then(() => true, () => false);
    if (check('見逃したギャングが仲間を呼んで集まる', gathered)) {
      const size = await S(page, () => window.streetDev.gang.call.size);
      const before = await stats(page);
      const g = await btn(page, 'goBtn');
      check('集まったら行けが使える', g.en);
      await page.screenshot({ path: `${outDir}/${stage}_tap_gathered.png` });
      await pad.tap(g.x, g.y);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${outDir}/${stage}_tap_wipe.png` });
      const after = await stats(page);
      check('行けでまとめて吹き飛ばす', after.groupsWiped === before.groupsWiped + (size >= 2 ? 1 : 0) && after.defeatedByWipe === before.defeatedByWipe + size,
        `組${size}人 撃破 ${before.defeated}->${after.defeated}`);
      check('ワゴンは壊れない', after.vansStopped === before.vansStopped);
    }
    await page.close();
  }
  // 2. ワゴンに乗りこんだところで行け → 車ごと止める
  {
    const { page, pad } = await open('civ');
    const boarding = await page.waitForFunction(() => ['board', 'drive'].includes(window.streetDev.gang?.call.phase) && window.streetDev.goHandler, null, { timeout: 45000 })
      .then(() => true, () => false);
    if (check('押さずにいると、組がワゴンに乗りこむ', boarding)) {
      const size = await S(page, () => window.streetDev.gang.call.size);
      const before = await stats(page);
      const g = await btn(page, 'goBtn');
      await page.screenshot({ path: `${outDir}/${stage}_tap_board.png` });
      await pad.tap(g.x, g.y);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${outDir}/${stage}_tap_vanstop.png` });
      const after = await stats(page);
      check('行けで車ごと止める', after.vansStopped === before.vansStopped + 1 && after.defeatedByVan === before.defeatedByVan + size,
        `組${size}人 被害額 ${before.damage}->${after.damage}`);
      check('ワゴンの¥500万', after.damage - before.damage === 5_000_000);
      check('逃がしていない', after.escaped === before.escaped);
    }
    await page.close();
  }
}
check('エラーが出ない', errors.length === 0, errors.join('\n'));
await browser.close();
done();
