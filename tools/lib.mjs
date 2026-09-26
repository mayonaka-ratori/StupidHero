// tools/ のスクリプトで共通に使う部品(ブラウザを開く、論理ドットで指を置く、合否を数える)。
//
// 論理ドットから画面の位置へ:ゲームの座標は横216の論理ドット。キャンバスは細かく描いている(src/hires.ts)ので、
// キャンバスの画素数ではなく「横は216、縦は論理ドットの高さ」で割る。論理ドットの高さは
// config.height ÷ (config.width ÷ 216)。ページの中のゲームは window.__game(開発用のサーバーのときだけある)、
// なければ dev/ui.html の window.uiDev.game を使う(どちらも同じ割り方でよい)。
//
// 開発用のサーバー:先に npm run dev を動かしておく。スクリプトはふつう http://localhost:5173/ を開く。
// ほかの場所のサーバーを使うときは、環境変数 DEV_URL か、スクリプトの引数で渡す(数字だけならポートとして読む)。
// 画面を撮ったものは、ふつう shots/ に置く(.gitignore に入れてある)。環境変数 SHOTS_DIR か引数で変えられる。
//
// 使い方:
//   import { openBrowser, openPage, touchPad, checker, serverUrl, shotsDir } from './lib.mjs';
//   const base = serverUrl(process.argv[3]);             // 'http://localhost:5173/' など
//   const outDir = shotsDir(process.argv[2]);            // なければ作る
//   const browser = await openBrowser();
//   const page = await openPage(browser, { dpr: 2 });   // Vite の通知は切ってある
//   const pad = await touchPad(page);                    // pad.tap(108, 300)、pad.touch('touchStart', [...])、pad.css(x, y)
//   const { check, done } = checker();  check('名前', ok, '補足');  await browser.close(); done();

import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

// ブラウザの置き場所。環境変数 CHROME で変えられる。置き場所に何もなければ playwright-core が自分で探す
const DEFAULT_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const CHROME = process.env.CHROME ?? (existsSync(DEFAULT_CHROME) ? DEFAULT_CHROME : undefined);
/** 開発用のサーバー(npm run dev のふつうのポートは 5173) */
export const DEV_URL = process.env.DEV_URL ?? 'http://localhost:5173/';

/** 引数で渡されたサーバーの場所を URL にする。省略(か - )なら DEV_URL、数字だけならそのポート。URL はそのまま */
export function serverUrl(arg) {
  if (!arg || arg === '-') return DEV_URL;
  if (/^\d+$/.test(arg)) return `http://localhost:${arg}/`;
  return new URL(arg).href;
}

/** 撮ったものを置くフォルダ。省略なら SHOTS_DIR か shots/。なければ作る */
export function shotsDir(arg) {
  const dir = arg && arg !== '-' ? arg : process.env.SHOTS_DIR || 'shots';
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 論理画面の横幅(src/config.ts の GAME_W) */
export const GAME_W = 216;

/** 論理ドットの高さ h になる、横390の端末のビューポート(縦は h に合わせて計算する) */
export const viewportFor = (h) => ({ width: 390, height: Math.round((390 * h) / GAME_W) });

export const openBrowser = () => chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

/** スマホの大きさ(タッチあり)の新しい context。addInitScript などを先に仕込みたいときに使う。mobile: false でパソコンの画面 */
export const mobileContext = (browser, { width = 390, height = 844, dpr = 1, mobile = true } = {}) =>
  browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: mobile, isMobile: mobile });

/**
 * スマホの大きさのページを開く(browser か、mobileContext で作った context から)。
 * - muteVite:Vite の通知を切る(ほかの担当がファイルを書きかえてもページを読み直さない)
 * - errors:配列を渡すと、ページのエラーと console.error をためる(渡さなければ表示する)
 */
export async function openPage(from, { width = 390, height = 844, dpr = 1, mobile = true, muteVite = true, errors = null } = {}) {
  const ctx = typeof from.newContext === 'function' ? await mobileContext(from, { width, height, dpr, mobile }) : from;
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

/** ステージを1つ倒した記録(src/logic/records.ts の形)。stats を渡すと数字(mostDefeated など)を上書きできる(省くと未設定 null) */
export function clearedRecord(stats = {}) {
  return { plays: 1, clears: 1, mostDefeated: null, fewestHurt: null, highestDamage: null, fastestBossSec: null, titles: [], ...stats };
}

/**
 * 複数のステージを倒した記録一式(localStorage の stupidhero.records.v2 に入れる形。playthrough.mjs、stageselect_scroll.mjs で使う)。
 * どのステージも同じ数字(clearedRecord(stats))にする。lastStage を渡すと「最後に遊んだステージ」も入れる
 */
export function clearedRecords(stageIds, { stats = {}, lastStage } = {}) {
  const rec = clearedRecord(stats);
  const records = { version: 2, stages: Object.fromEntries(stageIds.map((id) => [id, rec])), titles: [], introSeen: [...stageIds], rushSeen: [] };
  if (lastStage) records.lastStage = lastStage;
  return records;
}

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
  // 端末が重くて、確かめたい瞬間に間に合わなかったもの。NG には数えないが、最後に件数を出す
  let skipped = 0;
  const skip = (name, why = '') => {
    console.log(`SKIP ${name} ${why}`);
    skipped++;
  };
  const done = () => {
    if (skipped) console.log(`SKIP ${skipped} 件(重くて測れなかった。ほかのものを止めて動かし直すと確かめられる)`);
    console.log(failed ? `NG ${failed} 件` : 'ぜんぶ OK');
    process.exit(failed ? 1 : 0);
  };
  return { check, fail, skip, done, get failed() { return failed; } };
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
