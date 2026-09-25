// ステージを選ぶ画面を、指で上下にずらして確かめる(docs/SPEC.md「ステージを選ぶ画面」)。
// 高さ384と468の画面で、4つのステージのカードを並べて撮る(高層ビルがまだ開いていない記録、開いたばかりの記録、全部遊んだ記録)。
// ずらす(指を8ドットより動かす)とカードを選ばないか、離したあとすべって止まるか、端で止まるか、
// 動かさずに離すとカードを選ぶか、開いたばかりのステージ(&justunlocked=tower)まで自動でずれるかを見る。
// 使い方: npm run dev を動かしてから node tools/stageselect_scroll.mjs [サーバーかURL] [出力フォルダ]
import { checker, openBrowser, openPage, serverUrl, shotsDir, touchPad, waitForGame } from './lib.mjs';

const url = serverUrl(process.argv[2]);
const outDir = shotsDir(process.argv[3]);
const { check, done } = checker();
const browser = await openBrowser();

const rec = (clears) => ({ plays: 1, clears, mostDefeated: 12, fewestHurt: 1, highestDamage: 3_400_000, fastestBossSec: 7.2, titles: [] });
/** 路地裏と地下駐車場を倒し、モールはまだ遊んでいない記録(モールに NEW!) */
const FRESH_MALL = { version: 2, stages: { alley: rec(1), garage: rec(1) }, titles: [], introSeen: ['alley', 'garage'], rushSeen: [], lastStage: 'garage' };
/** モールまで倒し、高層ビルはまだ遊んでいない記録(高層ビルに NEW!) */
const FRESH_TOWER = { ...FRESH_MALL, stages: { alley: rec(1), garage: rec(1), mall: rec(1) }, introSeen: ['alley', 'garage', 'mall'], lastStage: 'mall' };
/** 全部遊んだ記録(最後に遊んだのは路地裏) */
const ALL_PLAYED = { ...FRESH_MALL, stages: { alley: rec(1), garage: rec(1), mall: rec(1), tower: rec(1) }, introSeen: ['alley', 'garage', 'mall', 'tower'], lastStage: 'alley' };
/** カードの全部が見えているか */
const inView = (c, s) => c.y - c.h / 2 >= s.viewTop && c.y + c.h / 2 <= s.viewTop + s.viewH;

/** 論理ドットの高さ H になる窓(横390) */
async function open(H, query, records) {
  const errors = [];
  const page = await openPage(browser, { width: 390, height: Math.round((390 * H) / 216), errors });
  await page.addInitScript((r) => localStorage.setItem('stupidhero.records.v2', r), JSON.stringify(records));
  await page.goto(`${url}?scene=StageSelect${query}`);
  await waitForGame(page, 60000);
  await page.waitForFunction(() => window.__sh?.key === 'StageSelect' && window.__sh.scroll, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const pad = await touchPad(page);
  return { page, pad, errors };
}
const info = (page) => page.evaluate(() => ({ s: window.__sh.scroll(), cards: window.__sh.cards() }));
/** すべりが止まるまで待つ(コマが遅い環境では時間がかかる) */
const settle = (page) => page.waitForFunction(() => !window.__sh.scroll().moving, null, { timeout: 20000 }).then(() => page.waitForTimeout(100));
const scenes = (page) => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key).filter((k) => !k.startsWith('Ui')));

/** 指で (x, y0) から (x, y1) までずらす。stepMs ごとに1回動かす */
async function drag(page, pad, x, y0, y1, steps = 10, stepMs = 16) {
  let p = await pad.css(x, y0);
  await pad.touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
  for (let i = 1; i <= steps; i++) {
    p = await pad.css(x, y0 + ((y1 - y0) * i) / steps);
    await pad.touch('touchMove', [{ x: p.x, y: p.y, id: 1 }]);
    await page.waitForTimeout(stepMs);
  }
  await pad.touch('touchEnd', []);
}

/**
 * 速くはじく。コマが遅い環境では、指を送るのに1回ごとに時間がかかり、ゆっくりずらしたことになってしまう。
 * 画面はイベントの時刻(timeStamp)で速さを測るので、ページの中でタッチのイベントを作り、時刻を16ミリ秒おきにして送る
 */
async function flick(page, pad, x, y0, y1, steps = 5) {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(await pad.css(x, y0 + ((y1 - y0) * i) / steps));
  await page.evaluate((pts) => {
    const cv = window.__game.canvas;
    const t0 = performance.now();
    const send = (type, p, ms) => {
      const t = new Touch({ identifier: 7, target: cv, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y, screenX: p.x, screenY: p.y });
      const end = type === 'touchend';
      const ev = new TouchEvent(type, { touches: end ? [] : [t], targetTouches: end ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'timeStamp', { value: t0 + ms });
      cv.dispatchEvent(ev);
    };
    send('touchstart', pts[0], 0);
    pts.slice(1).forEach((p, i) => send('touchmove', p, (i + 1) * 16));
    send('touchend', pts[pts.length - 1], pts.length * 16);
  }, pts);
}

for (const H of [384, 468]) {
  // ─── モールが NEW!(高層ビルはまだ鍵) ───
  {
    const { page, errors } = await open(H, '', FRESH_MALL);
    const { s, cards } = await info(page);
    await page.screenshot({ path: `${outDir}/stageselect_${H}_mall_new.png` });
    check(`${H}: 4つのステージのカード`, cards.map((c) => c.id).join(',') === 'alley,garage,mall,tower', cards.map((c) => c.id).join(','));
    check(`${H}: 絵がいつも出る`, cards.every((c) => c.thumbH >= 58), cards.map((c) => c.thumbH).join(','));
    check(`${H}: 高層ビルは鍵がかかっている`, cards.find((c) => c.id === 'tower')?.locked === true);
    check(`${H}: 4枚はずらせる`, s.max > 0, `max=${s.max}`);
    check(`${H}: 開いたときに NEW! のモールが全部見えている`, inView(cards.find((c) => c.id === 'mall'), s), `pos=${s.pos}`);
    check(`${H}: エラーなし`, errors.length === 0, errors.join(' / '));
    await page.close();
  }
  // ─── 高層ビルが NEW! ───
  {
    const { page, errors } = await open(H, '', FRESH_TOWER);
    const { s, cards } = await info(page);
    await page.screenshot({ path: `${outDir}/stageselect_${H}_tower_new.png` });
    const tower = cards.find((c) => c.id === 'tower');
    check(`${H}: 高層ビルは開いている`, tower?.locked === false);
    check(`${H}: 開いたときに NEW! の高層ビルが全部見えている`, inView(tower, s), `pos=${s.pos}`);
    check(`${H}: エラーなし(高層ビルが NEW!)`, errors.length === 0, errors.join(' / '));
    await page.close();
  }
  // ─── 全部遊んだ記録 ───
  {
    const { page, pad, errors } = await open(H, '', ALL_PLAYED);
    let { s, cards } = await info(page);
    await page.screenshot({ path: `${outDir}/stageselect_${H}_4_top.png` });
    check(`${H}: 4枚はずらせる`, s.max > 0, `max=${s.max}`);
    check(`${H}: 4枚でも絵が出る`, cards.every((c) => c.thumbH >= 58), cards.map((c) => c.thumbH).join(','));
    check(`${H}: 最後に遊んだ路地裏(1枚目)が見えている`, s.pos === 0, `pos=${s.pos}`);
    // 次のカードの頭が見えている
    const bottom = s.viewTop + s.viewH;
    const cut = cards.find((c) => c.y - c.h / 2 < bottom && c.y + c.h / 2 > bottom);
    check(`${H}: 下の端で次のカードが少し見える`, !!cut && bottom - (cut.y - cut.h / 2) >= 20, cut ? `見えている高さ ${bottom - (cut.y - cut.h / 2)}` : '');

    // ずらす(ゆっくり動かして止めてから離す):カードを選ばない
    const before = await scenes(page);
    await drag(page, pad, 100, s.viewTop + 200, s.viewTop + 120, 10, 30);
    await page.waitForTimeout(300);
    ({ s } = await info(page));
    check(`${H}: 指で上へずらすと下のカードが出る`, s.pos > 60, `pos=${s.pos.toFixed(1)}`);
    await page.waitForTimeout(500);
    check(`${H}: ずらしてもカードを選ばない`, JSON.stringify(await scenes(page)) === JSON.stringify(before), (await scenes(page)).join(','));

    // 速くはじく:すべって、いちばん下で止まる
    const p0 = s.pos;
    await flick(page, pad, 100, s.viewTop + 180, s.viewTop + 100, 5);
    await page.waitForTimeout(60);
    const mid = (await info(page)).s;
    await settle(page);
    ({ s, cards } = await info(page));
    check(`${H}: はじくと、離したあともすべる(指で動かした72ドットより先まで)`, s.pos > p0 + 72 + 30 || s.pos === s.max, `離した直後 ${mid.pos.toFixed(1)} → ${s.pos.toFixed(1)}`);
    check(`${H}: いちばん下で止まる`, Math.abs(s.pos - s.max) < 0.5 && !s.moving, `pos=${s.pos.toFixed(1)} max=${s.max}`);
    await page.screenshot({ path: `${outDir}/stageselect_${H}_4_bottom.png` });

    // 下へ大きくずらす:いちばん上で止まる
    await drag(page, pad, 100, s.viewTop + 20, s.viewTop + s.viewH - 10, 6, 16);
    await settle(page);
    ({ s } = await info(page));
    check(`${H}: いちばん上で止まる`, s.pos === 0, `pos=${s.pos}`);

    // 8ドットまでの動きはタップ:カードを選ぶ
    ({ cards } = await info(page));
    const c = cards[1];
    await drag(page, pad, c.x, c.y, c.y - 6, 3, 16);
    const picked = () => window.__sh.key !== 'StageSelect' || window.__sh.scene.leaving;
    await page.waitForFunction(picked, null, { timeout: 15000 }).catch(() => {});
    check(`${H}: 6ドット動かして離すとカードを選ぶ`, await page.evaluate(picked), `カード ${c.id}`);
    check(`${H}: エラーなし(4枚)`, errors.length === 0, errors.join(' / '));
    await page.close();
  }
  // ─── 開いたばかりの高層ビル:自動でずらしてから鍵がこわれる ───
  {
    const { page, errors } = await open(H, '&justunlocked=tower', FRESH_TOWER);
    await page.waitForTimeout(400);
    const s0 = (await info(page)).s;
    let unlocked = false;
    for (let i = 0; i < 100 && !unlocked; i++) {
      await page.waitForTimeout(150);
      unlocked = (await info(page)).cards.find((c) => c.id === 'tower').locked === false;
    }
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${outDir}/stageselect_${H}_4_unlock.png` });
    const { s, cards } = await info(page);
    const tower = cards.find((c) => c.id === 'tower');
    check(`${H}: 開いたばかりの高層ビルの鍵がこわれる`, unlocked);
    check(`${H}: 鍵がこわれるとき高層ビルが全部見えている`, inView(tower, s), `pos ${s0.pos} → ${s.pos}`);
    check(`${H}: エラーなし(開く演出)`, errors.length === 0, errors.join(' / '));
    await page.close();
  }
}

await browser.close();
done();
