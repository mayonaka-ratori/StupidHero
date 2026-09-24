// tools/ のスクリプトで共通に使う部品(ブラウザを開く、論理ドットで指を置く、合否を数える)。
//
// 論理ドットから画面の位置へ:ゲームの座標は横216の論理ドット。キャンバスは細かく描いている(src/hires.ts)ので、
// キャンバスの画素数ではなく「横は216、縦は論理ドットの高さ」で割る。論理ドットの高さは
// config.height ÷ (config.width ÷ 216)。ページの中のゲームは window.__game(開発用のサーバーのときだけある)、
// なければ dev/ui.html の window.uiDev.game を使う(どちらも同じ割り方でよい)。
//
// 使い方:
//   import { openBrowser, openPage, touchPad, checker } from './lib.mjs';
//   const browser = await openBrowser();
//   const page = await openPage(browser, { dpr: 2 });   // Vite の通知は切ってある
//   const pad = await touchPad(page);                    // pad.tap(108, 300)、pad.touch('touchStart', [...])、pad.css(x, y)
//   const { check, done } = checker();  check('名前', ok, '補足');  await browser.close(); done();

import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

// ブラウザの置き場所。環境変数 CHROME で変えられる。置き場所に何もなければ playwright-core が自分で探す
const DEFAULT_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const CHROME = process.env.CHROME ?? (existsSync(DEFAULT_CHROME) ? DEFAULT_CHROME : undefined);
/** 論理画面の横幅(src/config.ts の GAME_W) */
export const GAME_W = 216;

export const openBrowser = () => chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

/** スマホの大きさ(タッチあり)の新しい context。addInitScript などを先に仕込みたいときに使う */
export const mobileContext = (browser, { width = 390, height = 844, dpr = 1 } = {}) =>
  browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });

/**
 * スマホの大きさのページを開く(browser か、mobileContext で作った context から)。
 * - muteVite:Vite の通知を切る(ほかの担当がファイルを書きかえてもページを読み直さない)
 * - errors:配列を渡すと、ページのエラーと console.error をためる(渡さなければ表示する)
 */
export async function openPage(from, { width = 390, height = 844, dpr = 1, muteVite = true, errors = null } = {}) {
  const ctx = typeof from.newContext === 'function' ? await mobileContext(from, { width, height, dpr }) : from;
  const page = await ctx.newPage();
  if (muteVite) await page.routeWebSocket(/.*/, () => {});
  const report = (msg) => (errors ? errors.push(msg) : console.error(msg));
  page.on('pageerror', (e) => report('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) report('console: ' + m.text()); });
  return page;
}

/** 論理ドット (lx, ly) を、ページの CSS の位置に */
export function logicalToCss(page, lx, ly) {
  return page.evaluate(([x, y, W]) => {
    const g = window.__game ?? window.uiDev?.game;
    const r = g.canvas.getBoundingClientRect();
    const H = g.config.height / (g.config.width / W);
    return { x: r.left + (x * r.width) / W, y: r.top + (y * r.height) / H };
  }, [lx, ly, GAME_W]);
}

/** 論理画面の高さ(ドット) */
export const logicalHeight = (page) =>
  page.evaluate((W) => {
    const g = window.__game ?? window.uiDev?.game;
    return Math.round(g.config.height / (g.config.width / W));
  }, GAME_W);

/** ページのゲームができるまで待つ */
export const waitForGame = (page, timeout = 15000) =>
  page.waitForFunction(() => (window.__game ?? window.uiDev?.game)?.isBooted, null, { timeout });

/** 指で触る部品。座標はどれも論理ドット */
export async function touchPad(page) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const css = (lx, ly) => logicalToCss(page, lx, ly);
  /** 1本の指で押して離す */
  const tap = async (lx, ly, holdMs = 40) => {
    const p = await css(lx, ly);
    await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    await page.waitForTimeout(holdMs);
    await touch('touchEnd', []);
    await page.waitForTimeout(40);
  };
  return { cdp, touch, css, tap };
}

/** 合否を数える。done() で結果を出し、NG があれば exit code 1 で終わる */
export function checker() {
  let failed = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? 'OK ' : 'NG '} ${name} ${extra}`);
    if (!ok) failed++;
    return ok;
  };
  const fail = (name, extra = '') => check(name, false, extra);
  const done = () => {
    console.log(failed ? `NG ${failed} 件` : 'ぜんぶ OK');
    process.exit(failed ? 1 : 0);
  };
  return { check, fail, done, get failed() { return failed; } };
}

/** 何枚かの画像を横に並べた1枚にする(半分の大きさ) */
export async function contactSheet(browser, bufs, out, height = 844) {
  if (!bufs.length) return;
  const imgs = bufs.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}" style="width:195px;margin-right:4px">`).join('');
  const sheet = await browser.newPage({ viewport: { width: Math.min(200 * bufs.length, 1600), height: Math.ceil(height / 2) * Math.ceil(bufs.length / 8) } });
  await sheet.setContent(`<body style="margin:0;background:#888;display:flex;flex-wrap:wrap">${imgs}</body>`);
  await sheet.waitForTimeout(200);
  await sheet.screenshot({ path: out });
  await sheet.close();
}
