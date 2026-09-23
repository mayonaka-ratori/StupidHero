// UIの部品をタッチで試す(dev/ui.html 用)。指の操作はCDPのタッチイベントで送る(2本指も試せる)。
// 使い方: npx vite --port 5104 --strictPort を動かしてから
//   node tools/uitest.mjs [出力フォルダ]     (途中のスクリーンショットをそこに置く)
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5104/dev/ui.html';
const outDir = process.argv[2] ?? '.';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
const cdp = await page.context().newCDPSession(page);

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK ' : 'NG '} ${name} ${extra}`); if (!ok) failed++; };
const wait = (ms) => page.waitForTimeout(ms);
const log = () => page.evaluate(() => window.uiDev.log.slice());
const clearLog = () => page.evaluate(() => { window.uiDev.log.length = 0; });

/** 論理座標をCSSの座標に */
async function css(lx, ly) {
  return page.evaluate(([x, y]) => {
    const r = window.uiDev.game.canvas.getBoundingClientRect();
    return { x: r.left + (x * r.width) / 216, y: r.top + (y * r.height) / window.uiDev.game.scale.height };
  }, [lx, ly]);
}
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
async function tap(lx, ly) {
  const p = await css(lx, ly);
  await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
  await wait(40);
  await touch('touchEnd', []);
  await wait(40);
}
async function drag(fromCss, dxCss, steps, stepMs, id = 1) {
  await touch('touchStart', [{ x: fromCss.x, y: fromCss.y, id }]);
  for (let i = 1; i <= steps; i++) {
    await wait(stepMs);
    await touch('touchMove', [{ x: fromCss.x + (dxCss * i) / steps, y: fromCss.y, id }]);
  }
  await wait(stepMs);
  await touch('touchEnd', []);
  await wait(60);
}
async function open(p) {
  await page.goto(`${BASE}?page=${p}`);
  await page.waitForFunction(() => window.uiDev && window.uiDev.scene && window.uiDev.game, null, { timeout: 8000 });
  await wait(700);
}
const btnCenter = (name) => page.evaluate((n) => { const b = window.uiDev[n]; return { x: b.x + b.w / 2, y: b.y + b.h / 2, bx: b.x, by: b.y, w: b.w, h: b.h }; }, name);

// 1. ボタンは触れた瞬間に反応する
await open('sort');
await clearLog();
let b = await btnCenter('bad');
let p = await css(b.x, b.y);
await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
await wait(30);
check('ボタンは指が触れた瞬間に反応する', (await log()).includes('press:bad'), JSON.stringify(await log()));
check('押している間は押した見た目', await page.evaluate(() => window.uiDev.bad.pressed));
await page.screenshot({ path: `${outDir}/test-pressed.png` });
await touch('touchEnd', []);
await wait(150);
check('離すと戻る', !(await page.evaluate(() => window.uiDev.bad.pressed)));

// 2. 当たり判定はボタンより少し広い
await clearLog();
await tap(b.bx - 3, b.y);
check('ボタンの3ドット外でも押せる', (await log()).includes('press:bad'));
await clearLog();
await tap(b.bx - 12, b.y);
check('12ドット外では押せない', !(await log()).includes('press:bad'));

// 3. 2本の指で交互に連打
await open('result');
await clearLog();
b = await btnCenter('go');
const a1 = await css(b.x - 20, b.y), a2 = await css(b.x + 20, b.y);
// 指1を置く → 指2を置く → 指1を離す → 指3を置く → 全部離す(押したのは3回)
await touch('touchStart', [{ x: a1.x, y: a1.y, id: 1 }]); await wait(30);
await touch('touchStart', [{ x: a1.x, y: a1.y, id: 1 }, { x: a2.x, y: a2.y, id: 2 }]); await wait(30);
await touch('touchEnd', [{ x: a1.x, y: a1.y, id: 1 }]); await wait(30); // 指1だけ離す(touchEnd には離す指を書く)
await touch('touchStart', [{ x: a2.x, y: a2.y, id: 2 }, { x: a1.x, y: a1.y, id: 3 }]); await wait(30);
await touch('touchEnd', []); await wait(30);
const goCount = (await log()).filter((s) => s === 'press:go').length;
check('2本の指で交互に押すと毎回数える', goCount === 3, `count=${goCount}`);

// 4. カットインのタップで文字送りを飛ばす
await page.evaluate(() => { window.uiDev.done = false; window.uiDev.cut.say('ずいぶん長いセリフだけど、タップしたら全部すぐに出るはず', 'normal').then(() => { window.uiDev.done = true; }); });
await wait(100);
const cutPos = await page.evaluate(() => { const c = window.uiDev.cut; return { x: c.x + c.w / 2, y: c.y + c.h / 2 }; });
await tap(cutPos.x, cutPos.y);
let st = await page.evaluate(() => ({ typing: window.uiDev.cut.isTyping, pages: window.uiDev.cut.pages.length }));
check('タップで文字送りを飛ばす', !st.typing, JSON.stringify(st));
await tap(cutPos.x, cutPos.y); // 2ページ目へ
await tap(cutPos.x, cutPos.y); // 2ページ目も飛ばす
await wait(100);
check('最後まで飛ばすと say の Promise が解決する', await page.evaluate(() => window.uiDev.done));
await page.screenshot({ path: `${outDir}/test-cut-skip.png` });

// 5. 中断ボタン → 「タップで再開」 → 再開
await clearLog();
await tap(216 - 34, 12);
await wait(100);
st = await page.evaluate(() => ({ paused: window.uiDev.scene.scene.isPaused(), overlay: window.uiDev.game.scene.isActive('UiPause') }));
check('中断ボタンで止まる', (await log()).includes('pause:button') && st.paused && st.overlay, JSON.stringify(st));
await page.screenshot({ path: `${outDir}/test-pause.png` });
await wait(350);
await tap(108, 300);
await wait(100);
st = await page.evaluate(() => ({ paused: window.uiDev.scene.scene.isPaused(), overlay: window.uiDev.game.scene.isActive('UiPause') }));
check('タップで再開', (await log()).includes('resume') && !st.paused && !st.overlay, JSON.stringify(st));

// 6. 画面が隠れたら止まる
await clearLog();
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await wait(100);
check('画面が隠れたら止まる', (await log()).includes('pause:hidden'));
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
});
await wait(400);
check('戻っても止まったまま(タップ待ち)', await page.evaluate(() => window.uiDev.scene.scene.isPaused()));
await tap(108, 300);
await wait(100);
check('タップで再開(隠れたあと)', !(await page.evaluate(() => window.uiDev.scene.scene.isPaused())));

// 7. 音のボタン
await clearLog();
await tap(216 - 56, 12);
check('音のボタンで toggle が呼ばれる', (await log()).includes('muted:true'));
await wait(200);
await page.screenshot({ path: `${outDir}/test-muted.png`, clip: { x: 200, y: 0, width: 190, height: 60 } });
await tap(216 - 56, 12);

// 8. スワイプ
await open('swipe');
const center = await css(108, 150);
await clearLog();
await drag(center, -80, 8, 30);
check('左へ大きく動かすと「左」', (await log()).some((s) => s.startsWith('swipe:left')), JSON.stringify(await log()));
await wait(300);
await clearLog();
await drag(center, 90, 8, 30);
check('右へ大きく動かすと「右」', (await log()).some((s) => s.startsWith('swipe:right')), JSON.stringify(await log()));
await wait(300);
await clearLog();
await drag(center, -15, 6, 60);
check('少しだけゆっくり動かすと取り消し', (await log()).includes('swipe:cancel'), JSON.stringify(await log()));
await clearLog();
// はじく:待たずに続けて送る
await page.evaluate(() => { window.tt = []; for (const t of ['touchstart', 'touchmove', 'touchend']) window.addEventListener(t, (e) => window.tt.push(t[5] + Math.round(e.timeStamp)), true); });
// CDPの返事を待つと1回ごとに1コマ以上かかるので、返事を待たずに続けて送る
await Promise.all([
  touch('touchStart', [{ x: center.x, y: center.y, id: 1 }]),
  ...[4, 8, 34].map((d) => touch('touchMove', [{ x: center.x + d, y: center.y, id: 1 }])),
  touch('touchEnd', [])
]);
await wait(60);
check('素早くはじくと決まる', (await log()).some((s) => s.startsWith('swipe:right')), JSON.stringify(await log()) + ' speed=' + (await page.evaluate(() => window.uiDev.swipe.lastSpeed)).toFixed(3) + ' ' + (await page.evaluate(() => window.tt.join(' '))));
await wait(300);
await clearLog();
const outside = await css(108, 40);
await drag(outside, -90, 8, 30);
check('四角の外から始めた動きは無視', !(await log()).some((s) => s.startsWith('swipe')), JSON.stringify(await log()));
// 画面の端:四角を画面いっぱいにして、端の10ピクセルから始める
await page.evaluate(() => window.uiDev.swipe.setArea({ contains: () => true }));
await clearLog();
await drag({ x: 10, y: center.y }, 120, 8, 30);
check('左の端(16px以内)から始めた動きは無視', !(await log()).some((s) => s.startsWith('swipe')), JSON.stringify(await log()));
await drag({ x: 385, y: center.y }, -120, 8, 30);
check('右の端から始めた動きも無視', !(await log()).some((s) => s.startsWith('swipe')));
await drag({ x: 30, y: center.y }, 120, 8, 30);
check('端より内側からなら受け付ける', (await log()).some((s) => s.startsWith('swipe:right')));
// 動いている間ずっと知らせる(前のカードの動きが終わるのを待つ)
await wait(400);
await clearLog();
await touch('touchStart', [{ x: center.x, y: center.y, id: 1 }]);
await wait(30);
await touch('touchMove', [{ x: center.x - 36, y: center.y, id: 1 }]);
await wait(60);
const cardX = await page.evaluate(() => window.uiDev.card.x);
await page.screenshot({ path: `${outDir}/test-swipe-drag.png` });
await touch('touchEnd', []);
check('動かしている間カードが指について動く', cardX < 108 - 10, `card.x=${cardX}`);

// 9. 画面の切り替え
await wait(300);
await tap(216 - 12, 12);
await wait(120);
await page.screenshot({ path: `${outDir}/test-wipe.png` });
await wait(800);
const active = await page.evaluate(() => window.uiDev.game.scene.getScenes(true).map((s) => s.scene.key));
check('ワイプで次のシーンへ', active.includes('text') && !active.includes('swipe') && !active.includes('UiWipe'), JSON.stringify(active));

await browser.close();
console.log(failed ? `${failed} NG` : 'all OK');
process.exit(failed ? 1 : 0);
